// Standing orders: the mechanical command tree and ship simulation tick.
// This is the "dumb computer" — it evaluates rules top-to-bottom without judgment.
// The commander (commander.ts) interprets these results and applies judgment overrides.

import type { BodyEntry, CommandCondition, CommandResult, ShipEntry } from "../types";
import { isCometEntry, isShipEntry, isSurveyable } from "../types";
import { isAtColony, learnFromMalfunction } from "./commander";
import { findBody, findShip } from "./entities";
import { getClaimedTargets } from "./intents";
import { state } from "./state";
import { seededRandom } from "./utils";

export function checkCondition(condition: CommandCondition, ship: ShipEntry): boolean {
	switch (condition.type) {
		case "always":
			return true;
		case "fuel-below":
			return (ship.fuelKg / ship.fuelCapacityKg) * 100 < condition.threshold;
		case "morale-below":
			return ship.crew.morale < condition.threshold;
		case "hull-below":
			return ship.maintenance.hullIntegrity < condition.threshold;
		case "supplies-below":
			return (ship.maintenance.supplies / ship.maintenance.maxSupplies) * 100 < condition.threshold;
	}
}

function commandToResult(
	command: ShipEntry["commandTree"]["entries"][number]["command"],
	target?: string,
): CommandResult {
	switch (command) {
		case "survey-nearest":
			return { action: "survey" };
		case "transfer-to":
			return { action: "transfer", target };
		case "refuel":
			return { action: "refuel" };
		case "shore-leave":
			return { action: "shore-leave" };
		case "overhaul":
			return { action: "overhaul" };
		case "refuel-ship":
			return { action: "refuel-ship" };
		case "return-to-base":
			return { action: "refuel" };
		case "idle":
			return { action: "idle" };
	}
}

export function evaluateCommandTree(ship: ShipEntry): CommandResult | null {
	if (ship.immediateCommand?.enabled) {
		return commandToResult(ship.immediateCommand.command, ship.immediateCommand.target);
	}

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		if (checkCondition(entry.condition, ship)) {
			return commandToResult(entry.command, entry.target);
		}
	}

	return null;
}

export function computeMorale(daysSinceLeave: number, deploymentLimit: number): number {
	if (daysSinceLeave <= deploymentLimit) return 100;
	const raw = 100 * (deploymentLimit / daysSinceLeave) ** 1.5;
	// Floor values below 1 to 0 -- morale bottoms out at extreme deployment lengths
	return raw < 1 ? 0 : raw;
}

// Malfunction check interval in days
const MALFUNCTION_INTERVAL = 30;

// Gradual recovery rates (per day)
const MORALE_RECOVERY_PER_DAY = 2.5; // +2.5 morale/day during shore leave (~28 days from 30% to full)
const REFUEL_RATE_PER_DAY = 0.2; // 20% of capacity/day
export const HULL_REPAIR_PER_DAY = 2.5; // +2.5% hull/day during overhaul (~40 days from 0% to full)
export const SUPPLY_RESTOCK_PER_DAY = 2.5; // +2.5 supplies/day during overhaul
const SHORE_LEAVE_REPAIR_PER_DAY = 0.25; // +0.25% hull/day from repair crew during shore leave
const OVERHAUL_MORALE_PER_DAY = 0.5; // +0.5 morale/day during overhaul ("working from home", ~140 days from 30% to full)

type SimRates = {
	moraleRate: number;
	overhaulMoraleRate: number;
	repairRate: number;
	repairCrewRate: number;
	refuelRate: number;
	supplyRate: number;
};

function computeSimRates(): SimRates {
	const dq = state.depotQuality;
	return {
		moraleRate: (MORALE_RECOVERY_PER_DAY * dq) / state.moraleMultiplier,
		overhaulMoraleRate: (OVERHAUL_MORALE_PER_DAY * dq) / state.moraleMultiplier,
		repairRate: (HULL_REPAIR_PER_DAY * dq) / state.repairMultiplier,
		repairCrewRate: (SHORE_LEAVE_REPAIR_PER_DAY * dq) / state.repairMultiplier,
		refuelRate: (REFUEL_RATE_PER_DAY * dq) / state.refuelMultiplier,
		supplyRate: (SUPPLY_RESTOCK_PER_DAY * dq) / state.supplyMultiplier,
	};
}

function tickMoraleDecay(
	ship: ShipEntry,
	simDt: number,
	simTime: number,
	atColony: boolean,
	isOrbiting: boolean,
	rates: SimRates,
): void {
	if (isOrbiting && ship.action.type === "shore-leave") {
		ship.crew.morale = Math.min(100, ship.crew.morale + rates.moraleRate * simDt);
		ship.crew.lastShoreLeave = simTime;
		// Repair crew works on hull during shore leave
		ship.maintenance.hullIntegrity = Math.min(
			100,
			ship.maintenance.hullIntegrity + rates.repairCrewRate * simDt,
		);
	} else if (isOrbiting && ship.action.type === "overhaul") {
		// Crew recovers morale slowly during overhaul ("working from home")
		ship.crew.morale = Math.min(100, ship.crew.morale + rates.overhaulMoraleRate * simDt);
		ship.crew.lastShoreLeave = simTime;
	} else if (!atColony) {
		const daysSinceLeave = simTime - ship.crew.lastShoreLeave;
		ship.crew.morale = computeMorale(daysSinceLeave, ship.crew.deploymentLimit);
	}
}

function tickActionRecovery(
	ship: ShipEntry,
	simDt: number,
	isOrbiting: boolean,
	rates: SimRates,
): void {
	if (isOrbiting && ship.action.type === "refuel") {
		const fuelPerFrame = rates.refuelRate * ship.fuelCapacityKg * simDt;
		ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + fuelPerFrame);
	}

	if (isOrbiting && ship.action.type === "overhaul") {
		ship.maintenance.hullIntegrity = Math.min(
			100,
			ship.maintenance.hullIntegrity + rates.repairRate * simDt,
		);
		ship.maintenance.supplies = Math.min(
			ship.maintenance.maxSupplies,
			ship.maintenance.supplies + rates.supplyRate * simDt,
		);
	}
}

function tickColonyServices(
	ship: ShipEntry,
	simTime: number,
	simDt: number,
	atColony: boolean,
): void {
	if (!atColony) return;

	const dayNow = Math.floor(simTime);
	const dayPrev = Math.floor(simTime - simDt);
	// Cap at 30 iterations to prevent runaway loops at extreme time warp
	const daysCrossed = Math.min(dayNow - dayPrev, 30);
	if (daysCrossed <= 0) return;

	if (daysCrossed >= dayNow - dayPrev) {
		// Normal case: deliver for each day boundary crossed
		for (let day = dayPrev + 1; day <= dayNow; day++) {
			const fuelPerShuttle = ship.fuelCapacityKg * 0.25;
			ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + fuelPerShuttle);
			const supplyPerShuttle = Math.ceil(ship.maintenance.maxSupplies * 0.25);
			ship.maintenance.supplies = Math.min(
				ship.maintenance.maxSupplies,
				ship.maintenance.supplies + supplyPerShuttle,
			);
		}
	} else {
		// Capped case: fill to capacity directly
		ship.fuelKg = ship.fuelCapacityKg;
		ship.maintenance.supplies = ship.maintenance.maxSupplies;
	}
}

function tickMaintenanceAge(ship: ShipEntry, simDt: number, atColony: boolean): void {
	if (!atColony) {
		ship.maintenance.age += simDt;
	}
}

function tickFuelConsumption(ship: ShipEntry, simDt: number, atColony: boolean): void {
	if (atColony || ship.action.type === "refuel") return;

	if (ship.shipState === "transferring" && ship.transferTimeDays > 0) {
		// Engine burn: consume transferFuelTotal proportionally over transfer duration
		const fuelPerDay = ship.transferFuelTotal / ship.transferTimeDays;
		ship.fuelKg = Math.max(0, ship.fuelKg - fuelPerDay * simDt);
	} else {
		// Station-keeping: 0.1%/day active, 0.05%/day idle (life support + thrusters)
		const rate = ship.action.type !== null ? 0.001 : 0.0005;
		ship.fuelKg = Math.max(0, ship.fuelKg - rate * ship.fuelCapacityKg * simDt);
	}
}

function tickMalfunctionCheck(ship: ShipEntry, simDt: number): void {
	if (ship.shipState !== "transferring") return;

	const checkIndex = Math.floor(ship.maintenance.age / MALFUNCTION_INTERVAL);
	const prevCheckIndex = Math.floor((ship.maintenance.age - simDt) / MALFUNCTION_INTERVAL);
	// Fire once per 30-day interval crossed, even if multiple intervals skipped at high warp
	let currentCheck = prevCheckIndex;
	while (currentCheck < checkIndex) {
		currentCheck++;
		const intervalAge = currentCheck * MALFUNCTION_INTERVAL;
		const rng = seededRandom(Math.floor(intervalAge));
		const integrity = Math.max(1, ship.maintenance.hullIntegrity);
		const failChance = (intervalAge / (365 * 5)) * (100 / integrity);
		const roll = rng();
		if (roll < failChance) {
			const damage = ship.maintenance.supplies <= 0 ? 15 : 5 + Math.floor(rng() * 11);
			ship.maintenance.hullIntegrity = Math.max(0, ship.maintenance.hullIntegrity - damage);
			ship.maintenance.supplies = Math.max(0, ship.maintenance.supplies - damage);
			learnFromMalfunction(ship);
		}
	}
}

export function tickShipSimulation(ship: ShipEntry, simDt: number, simTime: number): void {
	const atColony = isAtColony(ship);
	const isOrbiting = ship.shipState === "orbiting";
	const rates = computeSimRates();

	tickMoraleDecay(ship, simDt, simTime, atColony, isOrbiting, rates);
	tickActionRecovery(ship, simDt, isOrbiting, rates);
	tickColonyServices(ship, simTime, simDt, atColony);
	tickMaintenanceAge(ship, simDt, atColony);
	tickFuelConsumption(ship, simDt, atColony);
	tickMalfunctionCheck(ship, simDt);
}

// --- Fleet refueling ---
const FLEET_FUEL_THRESHOLD = 50; // ships below this % are candidates
const TANKER_TRANSFER_RATE_PER_DAY = 10_000; // kg/day ship-to-ship
const TANKER_RESERVE_FLOOR = 0.15; // keep 15% for return trip

export function selectNextRefuelTarget(tanker: ShipEntry): string | null {
	const claimed = getClaimedTargets(tanker.data.name);
	const candidates: { name: string; fuelPct: number }[] = [];

	for (const entry of state.bodyMeshes) {
		if (!isShipEntry(entry)) continue;
		if (entry.data.name === tanker.data.name) continue;
		if (entry.shipState === "transferring") continue;
		if (claimed.has(entry.data.name)) continue;
		const fuelPct = (entry.fuelKg / entry.fuelCapacityKg) * 100;
		if (fuelPct >= FLEET_FUEL_THRESHOLD) continue;
		candidates.push({ name: entry.data.name, fuelPct });
	}

	if (candidates.length === 0) return null;
	candidates.sort((a, b) => a.fuelPct - b.fuelPct);
	return candidates[0].name;
}

export function tickTankerTransfer(ship: ShipEntry, simDt: number): boolean {
	const target = findShip(ship.action.target ?? undefined);
	if (!target || target.hostPlanetName !== ship.hostPlanetName || target.shipState !== "orbiting") {
		return true; // abort -- target moved or departed
	}

	const reserveFloor = ship.fuelCapacityKg * TANKER_RESERVE_FLOOR;
	const available = Math.max(0, ship.fuelKg - reserveFloor);
	const targetDeficit = target.fuelCapacityKg - target.fuelKg;

	if (available <= 0 || targetDeficit <= 0) {
		return true; // done -- tanker dry or target full
	}

	const transferAmount = Math.min(available, targetDeficit, TANKER_TRANSFER_RATE_PER_DAY * simDt);
	ship.fuelKg -= transferAmount;
	target.fuelKg += transferAmount;
	return false;
}

function collectBodyCandidates(
	sx: number,
	sz: number,
	claimed: Set<string>,
): { name: string; distSq: number }[] {
	const candidates: { name: string; distSq: number }[] = [];
	for (const body of state.bodyMeshes) {
		if (isShipEntry(body)) continue;
		if (isCometEntry(body)) continue;
		if (!isSurveyable(body)) continue;
		if (body.survey.surveyLevel !== 0) continue;
		if (body.data.type === "Star") continue;
		if (body.isMoon) continue;
		if (claimed.has(body.data.name)) continue;
		const dx = body.mesh.position.x - sx;
		const dz = body.mesh.position.z - sz;
		candidates.push({ name: body.data.name, distSq: dx * dx + dz * dz });
	}
	return candidates;
}

function collectAsteroidCandidates(
	sx: number,
	sz: number,
	claimed: Set<string>,
): { name: string; distSq: number }[] {
	const candidates: { name: string; distSq: number }[] = [];
	for (const beltEntry of state.asteroidBelts) {
		for (const asteroid of beltEntry.asteroids) {
			if (asteroid.survey.surveyLevel !== 0) continue;
			if (claimed.has(asteroid.designation)) continue;
			const idx = asteroid.beltIndex ?? 0;
			const ax = beltEntry.positions[idx * 3] - sx;
			const az = beltEntry.positions[idx * 3 + 2] - sz;
			candidates.push({ name: asteroid.designation, distSq: ax * ax + az * az });
		}
	}
	return candidates;
}

export function selectNextSurveyTarget(ship: ShipEntry): string | null {
	const sx = ship.mesh.position.x;
	const sz = ship.mesh.position.z;
	const claimed = getClaimedTargets(ship.data.name);

	const candidates = [
		...collectBodyCandidates(sx, sz, claimed),
		...collectAsteroidCandidates(sx, sz, claimed),
	];

	if (candidates.length === 0) return null;

	candidates.sort((a, b) => a.distSq - b.distSq);
	return candidates[0].name;
}

export function getUnsurvevedMoonsOfHost(ship: ShipEntry): BodyEntry[] {
	const host = findBody(ship.hostPlanetName);
	if (!host) return [];
	return host.moons.filter((moon) => isSurveyable(moon) && moon.survey.surveyLevel === 0);
}
