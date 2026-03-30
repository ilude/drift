// Standing orders: the mechanical command tree and ship simulation tick.
// This is the "dumb computer" — it evaluates rules top-to-bottom without judgment.
// The commander (commander.ts) interprets these results and applies judgment overrides.

import { computeTotalFuelCost } from "../math/ship-physics";
import { distanceKmBetween } from "../math/transfer";
import type {
	BodyEntry,
	CommandCondition,
	CommandEntry,
	CommandResult,
	CommandType,
	Result,
	ShipEntry,
} from "../types";
import { isShipEntry, isSurveyable } from "../types";
import {
	consumeColonyFuel,
	consumeColonySupplies,
	getRefuelQualityForShip,
	getServiceQualityForShip,
} from "./colonies";
import { isAtColony, learnFromMalfunction } from "./commander";
import { findBody, findShip } from "./entities";
import { getClaimedTargets, onIntentChange } from "./intents";
import { err, ok } from "./result";
import { resolveShipPhysics } from "./ship-utils";
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
		case "major-refit":
			return { action: "major-refit" };
		case "refuel-ship":
			return { action: "refuel-ship" };
		case "return-to-base":
			return { action: "refuel" };
		case "idle":
			return { action: "idle" };
	}
}

export function evaluateCommandTree(ship: ShipEntry): Result<CommandResult> {
	if (ship.immediateCommand?.enabled) {
		return ok(commandToResult(ship.immediateCommand.command, ship.immediateCommand.target));
	}

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		if (checkCondition(entry.condition, ship)) {
			return ok(commandToResult(entry.command, entry.target));
		}
	}

	return err();
}

export function computeMorale(daysSinceLeave: number, deploymentLimit: number): number {
	if (daysSinceLeave <= deploymentLimit) return 100;
	const raw = 100 * (deploymentLimit / daysSinceLeave) ** 1.5;
	// Floor values below 1 to 0 -- morale bottoms out at extreme deployment lengths
	return raw < 1 ? 0 : raw;
}

// Malfunction check interval in days
const MALFUNCTION_INTERVAL = 30;

// Routine crew maintenance rate (per day, while idle + orbiting)
const ROUTINE_MAINT_RATE = 0.05; // 0.05% hull/day (~18%/year at full morale)

// Major refit base duration
export const REFIT_BASE_DAYS = 180; // 6-month base refit

// Gradual recovery rates (per day)
const MORALE_RECOVERY_PER_DAY = 2.5; // +2.5 morale/day during shore leave (~28 days from 30% to full)
const REFUEL_RATE_PER_DAY = 0.2; // 20% of capacity/day
export const HULL_REPAIR_PER_DAY = 2.5; // +2.5% hull/day during overhaul (~40 days from 0% to full)
export const SUPPLY_RESTOCK_PER_DAY = 2.5; // +2.5 supplies/day during overhaul
const SHORE_LEAVE_REPAIR_PER_DAY = 0.25; // +0.25% hull/day from repair crew during shore leave
const OVERHAUL_MORALE_PER_DAY = 0.5; // +0.5 morale/day during overhaul ("working from home", ~140 days from 30% to full)

// --- Hull ceiling: lifetime degradation ---
// Overhauls restore hull to ceiling and partially recover the ceiling itself.
// Major refit fully resets lastRefitAge (ceiling → 100%).
// 0 years since refit: 100%, 10y: 85%, 20y: 70%, 30y: 55%, floor: 30%
export const OVERHAUL_CEILING_RECOVERY = 0.4; // overhaul recovers 40% of the gap between lastRefitAge and totalAge
export function hullCeiling(totalAge: number, lastRefitAge: number): number {
	const yearsSinceRefit = (totalAge - lastRefitAge) / 365;
	return Math.max(30, 100 - yearsSinceRefit * 1.5);
}

// --- Bathtub curve malfunction model ---
// Phase 1 (0-90 days): infant mortality ~2.5% decaying to ~1%
// Phase 2 (90 days - 3 years): useful life, constant ~1%
// Phase 3 (3+ years): wear-out, quadratic acceleration
export function bathtubFailRate(
	daysSinceOverhaul: number,
	hullIntegrity: number,
	morale: number,
	experience: number,
): number {
	const years = daysSinceOverhaul / 365;

	let baseRate: number;
	if (years < 0.25) {
		// Phase 1: Infant mortality — elevated then decaying
		baseRate = 0.01 + 0.015 * (1 - years / 0.25);
	} else if (years < 3) {
		// Phase 2: Useful life — low constant rate
		baseRate = 0.01;
	} else {
		// Phase 3: Wear-out — quadratic acceleration
		const wearYears = years - 3;
		baseRate = 0.01 + 0.005 * wearYears * wearYears;
	}

	// Hull integrity: sqrt prevents death spiral (25% hull = 2x, not 4x)
	const integrityMultiplier = Math.sqrt(100 / Math.max(1, hullIntegrity));

	// Crew quality: morale and experience reduce failures
	const moraleFactor = 1 - (morale - 50) * 0.003;
	const expReduction = Math.min(0.2, experience * 0.005);
	const crewFactor = moraleFactor * (1 - expReduction);

	return baseRate * integrityMultiplier * crewFactor;
}

type SimRates = {
	moraleRate: number;
	overhaulMoraleRate: number;
	repairRate: number;
	repairCrewRate: number;
	refuelRate: number;
	supplyRate: number;
};

const _cachedRates: SimRates = {
	moraleRate: 0,
	overhaulMoraleRate: 0,
	repairRate: 0,
	repairCrewRate: 0,
	refuelRate: 0,
	supplyRate: 0,
};

function computeSimRates(ship: ShipEntry): SimRates {
	const dqRepair = getServiceQualityForShip(ship);
	const dqRefuel = getRefuelQualityForShip(ship);
	_cachedRates.moraleRate = (MORALE_RECOVERY_PER_DAY * dqRepair) / state.moraleMultiplier;
	_cachedRates.overhaulMoraleRate = (OVERHAUL_MORALE_PER_DAY * dqRepair) / state.moraleMultiplier;
	_cachedRates.repairRate = (HULL_REPAIR_PER_DAY * dqRepair) / state.repairMultiplier;
	_cachedRates.repairCrewRate = (SHORE_LEAVE_REPAIR_PER_DAY * dqRepair) / state.repairMultiplier;
	_cachedRates.refuelRate = (REFUEL_RATE_PER_DAY * dqRefuel) / state.refuelMultiplier;
	_cachedRates.supplyRate = (SUPPLY_RESTOCK_PER_DAY * dqRepair) / state.supplyMultiplier;
	return _cachedRates;
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
		// Repair crew works on hull during shore leave (capped at ceiling)
		const ceiling = hullCeiling(ship.maintenance.totalAge, ship.maintenance.lastRefitAge);
		ship.maintenance.hullIntegrity = Math.min(
			ceiling,
			ship.maintenance.hullIntegrity + rates.repairCrewRate * simDt,
		);
	} else if (isOrbiting && (ship.action.type === "overhaul" || ship.action.type === "major-refit")) {
		// Crew recovers morale slowly during overhaul/refit ("working from home")
		ship.crew.morale = Math.min(100, ship.crew.morale + rates.overhaulMoraleRate * simDt);
		ship.crew.lastShoreLeave = simTime;
	} else if (atColony) {
		// Crew is at port -- deployment clock doesn't tick
		ship.crew.lastShoreLeave = simTime;
	} else {
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
		const deliveredFuel = consumeColonyFuel(ship.hostPlanetName, fuelPerFrame);
		ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + deliveredFuel);
	}

	if (isOrbiting && (ship.action.type === "overhaul" || ship.action.type === "major-refit")) {
		// Major refit targets 100%; overhaul targets projected ceiling (after 40% gap recovery)
		let ceiling: number;
		if (ship.action.type === "major-refit") {
			ceiling = 100;
		} else {
			const gap = ship.maintenance.totalAge - ship.maintenance.lastRefitAge;
			const dq = getServiceQualityForShip(ship);
			const projectedRefitAge = ship.maintenance.lastRefitAge + gap * OVERHAUL_CEILING_RECOVERY * dq;
			ceiling = hullCeiling(ship.maintenance.totalAge, projectedRefitAge);
		}
		ship.maintenance.hullIntegrity = Math.min(
			ceiling,
			ship.maintenance.hullIntegrity + rates.repairRate * simDt,
		);
		const supplyDelivered = consumeColonySupplies(ship.hostPlanetName, rates.supplyRate * simDt);
		ship.maintenance.supplies = Math.min(
			ship.maintenance.maxSupplies,
			ship.maintenance.supplies + supplyDelivered,
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

	if (daysCrossed < dayNow - dayPrev) {
		deliverColonyFill(ship);
		return;
	}
	for (let day = dayPrev + 1; day <= dayNow; day++) {
		deliverColonyShuttle(ship);
	}
}

function deliverColonyShuttle(ship: ShipEntry): void {
	if (ship.action.type !== "refuel") {
		const fuelNeeded = ship.fuelCapacityKg - ship.fuelKg;
		if (fuelNeeded > 0) {
			const fuelPerShuttle = Math.min(ship.fuelCapacityKg * 0.25, fuelNeeded);
			const deliveredFuel = consumeColonyFuel(ship.hostPlanetName, fuelPerShuttle);
			ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + deliveredFuel);
		}
	}
	if (ship.action.type !== "overhaul" && ship.action.type !== "major-refit") {
		const supplyNeeded = ship.maintenance.maxSupplies - ship.maintenance.supplies;
		if (supplyNeeded > 0) {
			const supplyPerShuttle = Math.min(Math.ceil(ship.maintenance.maxSupplies * 0.25), supplyNeeded);
			const deliveredSupplies = consumeColonySupplies(ship.hostPlanetName, supplyPerShuttle);
			ship.maintenance.supplies = Math.min(
				ship.maintenance.maxSupplies,
				ship.maintenance.supplies + deliveredSupplies,
			);
		}
	}
}

function deliverColonyFill(ship: ShipEntry): void {
	if (ship.action.type !== "refuel") {
		const deliveredFuel = consumeColonyFuel(ship.hostPlanetName, ship.fuelCapacityKg - ship.fuelKg);
		ship.fuelKg = Math.min(ship.fuelCapacityKg, ship.fuelKg + deliveredFuel);
	}
	if (ship.action.type !== "overhaul" && ship.action.type !== "major-refit") {
		const deliveredSupplies = consumeColonySupplies(
			ship.hostPlanetName,
			ship.maintenance.maxSupplies - ship.maintenance.supplies,
		);
		ship.maintenance.supplies = Math.min(
			ship.maintenance.maxSupplies,
			ship.maintenance.supplies + deliveredSupplies,
		);
	}
}

function tickMaintenanceAge(ship: ShipEntry, simDt: number, atColony: boolean): void {
	ship.maintenance.totalAge += simDt; // lifetime clock always ticks
	if (!atColony) {
		ship.maintenance.age += simDt; // deployment clock pauses at colony
	}
}

function tickFuelConsumption(ship: ShipEntry, simDt: number, atColony: boolean): void {
	if (atColony || (ship.action.type === "refuel" && ship.shipState !== "transferring")) return;

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
		const failChance = bathtubFailRate(
			ship.maintenance.age,
			ship.maintenance.hullIntegrity,
			ship.crew.morale,
			ship.commander.experience,
		);
		const roll = rng();
		if (roll < failChance) {
			const damage = ship.maintenance.supplies <= 0 ? 12 : 3 + Math.floor(rng() * 10);
			ship.maintenance.hullIntegrity = Math.max(0, ship.maintenance.hullIntegrity - damage);
			ship.maintenance.supplies = Math.max(0, ship.maintenance.supplies - damage);
			learnFromMalfunction(ship);
		}
	}
}

function tickRoutineMaintenance(ship: ShipEntry, simDt: number): void {
	// Crew performs routine maintenance only while idle and orbiting
	if (ship.shipState !== "orbiting" || ship.action.type !== null) return;

	const moraleFactor = ship.crew.morale / 100;
	const ceiling = hullCeiling(ship.maintenance.totalAge, ship.maintenance.lastRefitAge);
	ship.maintenance.hullIntegrity = Math.min(
		ceiling,
		ship.maintenance.hullIntegrity + ROUTINE_MAINT_RATE * moraleFactor * simDt,
	);
}

export function tickShipSimulation(ship: ShipEntry, simDt: number, simTime: number): void {
	const atColony = isAtColony(ship);
	const isOrbiting = ship.shipState === "orbiting";
	const rates = computeSimRates(ship);

	tickMoraleDecay(ship, simDt, simTime, atColony, isOrbiting, rates);
	tickActionRecovery(ship, simDt, isOrbiting, rates);
	tickColonyServices(ship, simTime, simDt, atColony);
	tickMaintenanceAge(ship, simDt, atColony);
	tickFuelConsumption(ship, simDt, atColony);
	tickMalfunctionCheck(ship, simDt);
	tickRoutineMaintenance(ship, simDt);
}

// --- Fleet refueling ---
const FLEET_FUEL_THRESHOLD = 50; // ships below this % are candidates
const TANKER_TRANSFER_RATE_PER_DAY = 10_000; // kg/day ship-to-ship
const TANKER_RESERVE_FLOOR = 0.15; // keep 15% for return trip

const _refuelTargetCache = new Map<string, Result<string>>();

/** Estimate round-trip fuel cost for tanker to reach a target ship and return. */
function tankerRoundTripFuel(
	tanker: ShipEntry,
	tankerHost: BodyEntry,
	targetHost: BodyEntry,
): number {
	const distKm = distanceKmBetween(tankerHost, targetHost);
	if (distKm < 1) return 0;
	const physics = resolveShipPhysics(tanker);
	const oneWay = computeTotalFuelCost(
		distKm,
		physics.accelG,
		physics.ispS,
		physics.dryMassKg,
		tanker.fuelCapacityKg,
		state.fuelBurnMultiplier,
		physics.fuelMod,
	);
	return oneWay.totalFuelKg * 2.5; // 2x travel + safety margin
}

/** Check if a tanker can afford the round trip to a candidate's host body. */
function canAffordRoundTrip(
	tanker: ShipEntry,
	tankerHost: BodyEntry | undefined | null,
	candidateHostName: string,
	reserveFloor: number,
): boolean {
	if (!tankerHost) return true; // can't compute distance, allow optimistically
	const [targetHost, targetHostFound] = findBody(candidateHostName);
	if (!targetHostFound) return true;
	const tripFuel = tankerRoundTripFuel(tanker, tankerHost, targetHost);
	return tripFuel + reserveFloor <= tanker.fuelKg;
}

/** Check if a ship is a valid refuel candidate for the given tanker. */
function isRefuelCandidate(
	entry: BodyEntry,
	tankerName: string,
	claimed: Set<string>,
): entry is ShipEntry & BodyEntry {
	if (!isShipEntry(entry)) return false;
	if (entry.data.name === tankerName) return false;
	if (entry.shipState === "transferring") return false;
	if (claimed.has(entry.data.name)) return false;
	const fuelPct = (entry.fuelKg / entry.fuelCapacityKg) * 100;
	return fuelPct < FLEET_FUEL_THRESHOLD;
}

export function selectNextRefuelTarget(tanker: ShipEntry): Result<string> {
	const shipName = tanker.data.name;
	if (_refuelTargetCache.has(shipName)) return _refuelTargetCache.get(shipName) as Result<string>;

	const claimed = getClaimedTargets(shipName);
	const [tankerHost] = findBody(tanker.hostPlanetName);
	const reserveFloor = tanker.fuelCapacityKg * TANKER_RESERVE_FLOOR;
	const candidates: { name: string; fuelPct: number }[] = [];

	for (const entry of state.bodyMeshes) {
		if (!isRefuelCandidate(entry, shipName, claimed)) continue;
		if (!canAffordRoundTrip(tanker, tankerHost, entry.hostPlanetName, reserveFloor)) continue;
		const fuelPct = (entry.fuelKg / entry.fuelCapacityKg) * 100;
		candidates.push({ name: entry.data.name, fuelPct });
	}

	const result =
		candidates.length === 0
			? err<string>()
			: ok(candidates.sort((a, b) => a.fuelPct - b.fuelPct)[0].name);
	_refuelTargetCache.set(shipName, result);
	return result;
}

export function tickTankerTransfer(ship: ShipEntry, simDt: number): boolean {
	const [target, targetFound] = findShip(ship.action.target ?? undefined);
	if (
		!targetFound ||
		target.hostPlanetName !== ship.hostPlanetName ||
		target.shipState !== "orbiting"
	) {
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

const _surveyTargetCache = new Map<string, Result<string>>();

// Invalidate both caches whenever intents change (claimed targets affect selection results)
onIntentChange(() => {
	_surveyTargetCache.clear();
	_refuelTargetCache.clear();
});

export function invalidateSurveyTargetCache(): void {
	_surveyTargetCache.clear();
}

export function invalidateRefuelTargetCache(): void {
	_refuelTargetCache.clear();
}

export interface SurveyCandidate {
	name: string;
	distSq: number;
	x: number;
	z: number;
}

export function collectBodyCandidates(
	sx: number,
	sz: number,
	claimed: Set<string>,
): SurveyCandidate[] {
	const out: SurveyCandidate[] = [];
	for (const body of state.bodyMeshes) {
		if (isShipEntry(body)) continue;
		if (!isSurveyable(body)) continue;
		if (body.survey.surveyLevel !== 0) continue;
		if (claimed.has(body.data.name)) continue;
		const bx = body.mesh.position.x;
		const bz = body.mesh.position.z;
		const dx = bx - sx;
		const dz = bz - sz;
		out.push({ name: body.data.name, distSq: dx * dx + dz * dz, x: bx, z: bz });
	}
	return out;
}

export function collectAsteroidCandidates(
	sx: number,
	sz: number,
	claimed: Set<string>,
): SurveyCandidate[] {
	const out: SurveyCandidate[] = [];
	for (const beltEntry of state.asteroidBelts) {
		for (const asteroid of beltEntry.asteroids) {
			if (asteroid.survey.surveyLevel !== 0) continue;
			if (claimed.has(asteroid.designation)) continue;
			const idx = asteroid.beltIndex ?? 0;
			const bx = beltEntry.positions[idx * 3];
			const bz = beltEntry.positions[idx * 3 + 2];
			const dx = bx - sx;
			const dz = bz - sz;
			out.push({ name: asteroid.designation, distSq: dx * dx + dz * dz, x: bx, z: bz });
		}
	}
	return out;
}

export function selectNextSurveyTarget(ship: ShipEntry): Result<string> {
	const shipName = ship.data.name;
	if (_surveyTargetCache.has(shipName)) return _surveyTargetCache.get(shipName) as Result<string>;

	const sx = ship.mesh.position.x;
	const sz = ship.mesh.position.z;
	const claimed = getClaimedTargets(shipName);
	const candidates = [
		...collectBodyCandidates(sx, sz, claimed),
		...collectAsteroidCandidates(sx, sz, claimed),
	];

	const result =
		candidates.length === 0
			? err<string>()
			: ok(candidates.sort((a, b) => a.distSq - b.distSq)[0].name);
	_surveyTargetCache.set(shipName, result);
	return result;
}

export function getUnsurvevedMoonsOfHost(ship: ShipEntry): BodyEntry[] {
	const [host, found] = findBody(ship.hostPlanetName);
	if (!found) return [];
	return host.moons.filter((moon) => isSurveyable(moon) && moon.survey.surveyLevel === 0);
}

// --- Command tree mutation helpers (called by UI layer) ---

export function reorderCommand(ship: ShipEntry, index: number, direction: "up" | "down"): void {
	const entries = ship.commandTree.entries;
	if (direction === "up" && index > 0) {
		const temp = entries[index - 1];
		entries[index - 1] = entries[index];
		entries[index] = temp;
	} else if (direction === "down" && index < entries.length - 1) {
		const temp = entries[index + 1];
		entries[index + 1] = entries[index];
		entries[index] = temp;
	}
}

export function toggleCommand(ship: ShipEntry, index: number): void {
	const entry = ship.commandTree.entries[index];
	if (entry) entry.enabled = !entry.enabled;
}

export function removeCommand(ship: ShipEntry, index: number): void {
	ship.commandTree.entries.splice(index, 1);
}

export function setCommandThreshold(ship: ShipEntry, index: number, value: number): void {
	const entry = ship.commandTree.entries[index];
	if (entry && "threshold" in entry.condition) {
		(entry.condition as { threshold: number }).threshold = value;
	}
}

export function addCommand(ship: ShipEntry, entry: CommandEntry): void {
	ship.commandTree.entries.push(entry);
}

export function setImmediateCommand(ship: ShipEntry, command: CommandType, target?: string): void {
	ship.immediateCommand = {
		id: `imm-${Date.now()}`,
		command,
		condition: { type: "always" },
		target: target ?? undefined,
		enabled: true,
		origin: "ship",
	};
}
