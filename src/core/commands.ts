import type { BodyEntry, CommandCondition, CommandResult, ShipEntry } from "../types";
import { isShipEntry, isSurveyable } from "../types";
import { findBody } from "./entities";
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
	// Floor values below 1 to 0 — morale bottoms out at extreme deployment lengths
	return raw < 1 ? 0 : raw;
}

// Malfunction check interval in days
const MALFUNCTION_INTERVAL = 30;

// Colony names — ships at these locations get shore leave and resupply automatically
const COLONY_NAMES = new Set(["Earth"]);

function isAtColony(ship: ShipEntry): boolean {
	return ship.shipState === "orbiting" && COLONY_NAMES.has(ship.hostPlanetName);
}

// Gradual recovery rates (per day)
const MORALE_RECOVERY_PER_DAY = 2.5; // +2.5 morale/day during shore leave (~28 days from 30% to full)
const REFUEL_RATE_PER_DAY = 0.2; // 20% of capacity/day
const HULL_REPAIR_PER_DAY = 2.5; // +2.5% hull/day during overhaul (~40 days from 0% to full)
const SUPPLY_RESTOCK_PER_DAY = 2.5; // +2.5 supplies/day during overhaul
const SHORE_LEAVE_REPAIR_PER_DAY = 0.25; // +0.25% hull/day from repair crew during shore leave
const OVERHAUL_MORALE_PER_DAY = 0.5; // +0.5 morale/day during overhaul ("working from home", ~140 days from 30% to full)

export function tickShipSimulation(ship: ShipEntry, simDt: number, simTime: number): void {
	const atColony = isAtColony(ship);

	// Recovery actions only apply while orbiting (not during transfer to destination)
	const isOrbiting = ship.shipState === "orbiting";

	// Effective rates: baseRate * depotQuality / hardnessMultiplier
	// depotQuality represents location facilities (1.0 = standard, eventually per-location)
	// hardness multipliers are player-set difficulty (1.0 = default, higher = slower)
	const dq = state.depotQuality;
	const moraleRate = (MORALE_RECOVERY_PER_DAY * dq) / state.moraleMultiplier;
	const overhaulMoraleRate = (OVERHAUL_MORALE_PER_DAY * dq) / state.moraleMultiplier;
	const repairRate = (HULL_REPAIR_PER_DAY * dq) / state.repairMultiplier;
	const repairCrewRate = (SHORE_LEAVE_REPAIR_PER_DAY * dq) / state.repairMultiplier;
	const refuelRate = (REFUEL_RATE_PER_DAY * dq) / state.refuelMultiplier;
	const supplyRate = (SUPPLY_RESTOCK_PER_DAY * dq) / state.supplyMultiplier;

	// Morale: gradual recovery during shore leave or overhaul, decay when deployed
	if (isOrbiting && ship.action.type === "shore-leave") {
		ship.crew.morale = Math.min(100, ship.crew.morale + moraleRate * simDt);
		ship.crew.lastShoreLeave = simTime;
		// Repair crew works on hull during shore leave
		ship.maintenance.hullIntegrity = Math.min(
			100,
			ship.maintenance.hullIntegrity + repairCrewRate * simDt,
		);
	} else if (isOrbiting && ship.action.type === "overhaul") {
		// Crew recovers morale slowly during overhaul ("working from home")
		ship.crew.morale = Math.min(100, ship.crew.morale + overhaulMoraleRate * simDt);
		ship.crew.lastShoreLeave = simTime;
	} else if (!atColony) {
		const daysSinceLeave = simTime - ship.crew.lastShoreLeave;
		ship.crew.morale = computeMorale(daysSinceLeave, ship.crew.deploymentLimit);
	}

	// Gradual refueling during refuel action (only while orbiting)
	if (isOrbiting && ship.action.type === "refuel") {
		const fuelPerFrame = refuelRate * ship.fuelCapacityKg * simDt;
		ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + fuelPerFrame);
	}

	// Gradual hull repair + supply restock during overhaul (only while orbiting)
	if (isOrbiting && ship.action.type === "overhaul") {
		ship.maintenance.hullIntegrity = Math.min(
			100,
			ship.maintenance.hullIntegrity + repairRate * simDt,
		);
		ship.maintenance.supplies = Math.min(
			ship.maintenance.maxSupplies,
			ship.maintenance.supplies + supplyRate * simDt,
		);
	}

	// Colony supply shuttles: fuel + supplies only (not morale — that's shore leave)
	if (atColony) {
		const dayNow = Math.floor(simTime);
		const dayPrev = Math.floor(simTime - simDt);
		if (dayNow > dayPrev) {
			const fuelPerShuttle = ship.fuelCapacityKg * 0.25;
			ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + fuelPerShuttle);
			const supplyPerShuttle = Math.ceil(ship.maintenance.maxSupplies * 0.25);
			ship.maintenance.supplies = Math.min(
				ship.maintenance.maxSupplies,
				ship.maintenance.supplies + supplyPerShuttle,
			);
		}
	}

	// Maintenance age: only accumulates away from colony
	if (!atColony) {
		ship.maintenance.age += simDt;
	}

	// Fuel consumption (skip during refuel action — ship is being topped off)
	if (!atColony && ship.action.type !== "refuel") {
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

	// Malfunction check: only during transfers (hull degrades in transit)
	if (ship.shipState === "transferring") {
		const checkIndex = Math.floor(ship.maintenance.age / MALFUNCTION_INTERVAL);
		const prevCheckIndex = Math.floor((ship.maintenance.age - simDt) / MALFUNCTION_INTERVAL);
		if (checkIndex > prevCheckIndex) {
			const rng = seededRandom(Math.floor(ship.maintenance.age));
			const integrity = Math.max(1, ship.maintenance.hullIntegrity);
			const failChance = (ship.maintenance.age / (365 * 5)) * (100 / integrity);
			const roll = rng();
			if (roll < failChance) {
				const damage = ship.maintenance.supplies <= 0 ? 15 : 5 + Math.floor(rng() * 11);
				ship.maintenance.hullIntegrity = Math.max(0, ship.maintenance.hullIntegrity - damage);
				ship.maintenance.supplies = Math.max(0, ship.maintenance.supplies - damage);
			}
		}
	}
}

export function selectNextSurveyTarget(ship: ShipEntry): string | null {
	const sx = ship.mesh.position.x;
	const sz = ship.mesh.position.z;
	const claimed = getClaimedTargets(ship.data.name);

	// Collect body candidates with distance
	const candidates: { name: string; distSq: number }[] = [];

	for (const body of state.bodyMeshes) {
		if (body === (ship as unknown)) continue;
		if (isShipEntry(body)) continue;
		if (!isSurveyable(body)) continue;
		if (body.survey.surveyLevel !== 0) continue;
		if (body.data.type === "Star") continue;
		if (body.isMoon) continue;
		if (claimed.has(body.data.name)) continue;
		const dx = body.mesh.position.x - sx;
		const dz = body.mesh.position.z - sz;
		candidates.push({ name: body.data.name, distSq: dx * dx + dz * dz });
	}

	// Collect unsurveyed asteroids
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

	if (candidates.length === 0) return null;

	candidates.sort((a, b) => a.distSq - b.distSq);
	return candidates[0].name;
}

export function getUnsurvevedMoonsOfHost(ship: ShipEntry): BodyEntry[] {
	const host = findBody(ship.hostPlanetName);
	if (!host) return [];
	return host.moons.filter((moon) => isSurveyable(moon) && moon.survey.surveyLevel === 0);
}
