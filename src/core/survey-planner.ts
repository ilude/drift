import { DIST_SCALE } from "../math/orbit";
import { AU_TO_KM, computeTotalFuelCost } from "../math/ship-physics";
import type { ShipEntry, SurveyCandidate, SurveyPlan } from "../types";
import { isSurveyable } from "../types";
import { getNearestColonyForShip } from "./colonies";
import { collectAsteroidCandidates, collectBodyCandidates } from "./commands";
import { findBody } from "./entities";
import { getClaimedTargets, publishIntent } from "./intents";
import { resolveShipPhysics, resolveShipSensorLevel } from "./ship-utils";
import { state } from "./state";

const AVG_SURVEY_DAYS = 10;
const THROTTLE_LEVELS = [1.0, 0.5, 0.25];
const MIN_PLAN_TARGETS = 2;

/** Convert world-space position to AU distance from star. */
function worldToAU(x: number, z: number): number {
	const worldR = Math.sqrt(x * x + z * z);
	return (worldR / DIST_SCALE) ** 2;
}

/** Estimate km distance between two world-space points using AU chord distance. */
function candidateDistKm(ax: number, az: number, bx: number, bz: number): number {
	const auA = worldToAU(ax, az);
	const auB = worldToAU(bx, bz);
	const angleA = Math.atan2(az, ax);
	const angleB = Math.atan2(bz, bx);
	const axAU = Math.cos(angleA) * auA;
	const azAU = Math.sin(angleA) * auA;
	const bxAU = Math.cos(angleB) * auB;
	const bzAU = Math.sin(angleB) * auB;
	return Math.hypot(bxAU - axAU, bzAU - azAU) * AU_TO_KM;
}

/** Collect all candidates reachable by this ship's sensor level with world positions. */
function collectPlanCandidates(ship: ShipEntry): SurveyCandidate[] {
	const sx = ship.mesh.position.x;
	const sz = ship.mesh.position.z;
	const claimed = getClaimedTargets(ship.data.name);
	const maxLevel = resolveShipSensorLevel(ship);
	return [
		...collectBodyCandidates(sx, sz, claimed, maxLevel),
		...collectAsteroidCandidates(sx, sz, claimed, maxLevel),
	];
}

/** Get the morale threshold from the ship's command tree (or default 30). */
function getMoraleThreshold(ship: ShipEntry): number {
	for (const entry of ship.commandTree.entries) {
		if (entry.enabled && entry.condition.type === "morale-below") {
			return entry.condition.threshold;
		}
	}
	return 30;
}

interface TourResult {
	targets: string[];
	totalDays: number;
}

/** Simulate a greedy nearest-neighbor tour at a given acceleration. */
function simulateTour(
	candidates: SurveyCandidate[],
	startX: number,
	startZ: number,
	colonyX: number,
	colonyZ: number,
	accelG: number,
	fuelBudgetKg: number,
	daysBudget: number,
	physics: { ispS: number; dryMassKg: number; fuelCapacityKg: number; fuelMod: number },
	opMult: number,
): TourResult {
	const remaining = [...candidates];
	const targets: string[] = [];
	let curX = startX;
	let curZ = startZ;
	let fuelUsed = 0;
	let daysUsed = 0;

	while (remaining.length > 0) {
		// Find nearest candidate to current position
		let bestIdx = 0;
		let bestDistSq = Number.POSITIVE_INFINITY;
		for (let i = 0; i < remaining.length; i++) {
			const dx = remaining[i].x - curX;
			const dz = remaining[i].z - curZ;
			const d2 = dx * dx + dz * dz;
			if (d2 < bestDistSq) {
				bestDistSq = d2;
				bestIdx = i;
			}
		}

		const next = remaining[bestIdx];
		const hopDistKm = candidateDistKm(curX, curZ, next.x, next.z);
		const hopCost = computeTotalFuelCost(
			hopDistKm,
			accelG,
			physics.ispS,
			physics.dryMassKg,
			physics.fuelCapacityKg,
			opMult,
			physics.fuelMod,
		);

		// Check return cost from this candidate
		const returnDistKm = candidateDistKm(next.x, next.z, colonyX, colonyZ);
		const returnCost = computeTotalFuelCost(
			returnDistKm,
			accelG,
			physics.ispS,
			physics.dryMassKg,
			physics.fuelCapacityKg,
			opMult,
			physics.fuelMod,
		);

		const projectedFuel = fuelUsed + hopCost.totalFuelKg + returnCost.totalFuelKg;
		const projectedDays = daysUsed + hopCost.transferDays + AVG_SURVEY_DAYS;

		if (projectedFuel > fuelBudgetKg) break;
		if (projectedDays > daysBudget) break;

		targets.push(next.name);
		fuelUsed += hopCost.totalFuelKg;
		daysUsed += hopCost.transferDays + AVG_SURVEY_DAYS;
		curX = next.x;
		curZ = next.z;
		remaining.splice(bestIdx, 1);
	}

	return { targets, totalDays: daysUsed };
}

/**
 * Compute a survey mission plan for a ship departing a colony.
 * Returns null if fewer than 2 candidates or commander judgment too low.
 */
export function computeSurveyPlan(ship: ShipEntry): SurveyPlan | null {
	if (ship.commander.judgment < 0.15) return null;

	const candidates = collectPlanCandidates(ship);
	if (candidates.length < MIN_PLAN_TARGETS) return null;

	const [colony, colonyFound] = getNearestColonyForShip(ship);
	if (!colonyFound) return null;
	const [colonyBody, colonyBodyFound] = findBody(colony.data.name);
	if (!colonyBodyFound) return null;

	const colonyX = colonyBody.mesh.position.x;
	const colonyZ = colonyBody.mesh.position.z;
	const shipX = ship.mesh.position.x;
	const shipZ = ship.mesh.position.z;

	const physics = resolveShipPhysics(ship);
	const opMult = state.fuelBurnMultiplier;
	const j = ship.commander.judgment;

	// Safety margin: high-judgment commanders cut it closer
	const margin = 2.0 - j * 0.7; // 1.3x–2.0x

	// Days budget: time until morale drops to threshold
	const moraleThreshold = getMoraleThreshold(ship);
	const daysSinceLeave = state.simTime.days - ship.crew.lastShoreLeave;
	const daysBudget = estimateDaysBudget(daysSinceLeave, ship.crew.deploymentLimit, moraleThreshold);

	let bestPlan: TourResult | null = null;
	let bestAccelG = physics.accelG;

	for (const fraction of THROTTLE_LEVELS) {
		const accelG = physics.accelG * fraction;
		const tour = simulateTour(
			candidates,
			shipX,
			shipZ,
			colonyX,
			colonyZ,
			accelG,
			ship.fuelKg / margin,
			daysBudget,
			{
				ispS: physics.ispS,
				dryMassKg: physics.dryMassKg,
				fuelCapacityKg: ship.fuelCapacityKg,
				fuelMod: physics.fuelMod,
			},
			opMult,
		);
		if (!bestPlan || tour.targets.length > bestPlan.targets.length) {
			bestPlan = tour;
			bestAccelG = accelG;
		} else if (
			tour.targets.length === bestPlan.targets.length &&
			tour.totalDays < bestPlan.totalDays
		) {
			bestPlan = tour;
			bestAccelG = accelG;
		}
	}

	if (!bestPlan || bestPlan.targets.length < MIN_PLAN_TARGETS) return null;

	const plan: SurveyPlan = { targets: bestPlan.targets, accelG: bestAccelG };

	// Publish flight plan intent to claim all targets
	publishIntent(ship.data.name, {
		type: "survey-plan",
		targets: [...plan.targets],
		shipName: ship.data.name,
	});

	return plan;
}

/** Estimate days until morale drops to a threshold. */
function estimateDaysBudget(
	daysSinceLeave: number,
	deploymentLimit: number,
	moraleThreshold: number,
): number {
	// morale = 100 * (limit / daysSinceLeave)^1.5 when > limit
	// Solve for days where morale = threshold:
	// threshold = 100 * (limit / days)^1.5
	// days = limit / (threshold/100)^(2/3)
	if (moraleThreshold <= 0) return 365 * 10; // effectively unlimited
	const daysAtThreshold = deploymentLimit / (moraleThreshold / 100) ** (2 / 3);
	return Math.max(0, daysAtThreshold - daysSinceLeave);
}

/**
 * Pop the next valid target from the ship's survey plan.
 * Skips targets that are already surveyed or claimed by other ships.
 * Returns null (and clears the plan) when all targets are consumed.
 */
export function advanceSurveyPlan(ship: ShipEntry): string | null {
	if (!ship.surveyPlan) return null;

	const claimed = getClaimedTargets(ship.data.name);

	while (ship.surveyPlan.targets.length > 0) {
		const target = ship.surveyPlan.targets.shift();
		if (!target) break;

		// Skip if already surveyed
		const [body, bodyFound] = findBody(target);
		if (bodyFound && isSurveyable(body) && body.survey.surveyLevel > 0) continue;
		// Skip if claimed by another ship
		if (claimed.has(target)) continue;

		// Update the flight plan intent with remaining targets
		publishIntent(ship.data.name, {
			type: "survey-plan",
			targets: [...ship.surveyPlan.targets],
			shipName: ship.data.name,
		});
		return target;
	}

	// Plan exhausted
	ship.surveyPlan = null;
	return null;
}

/** Clear a ship's survey plan and release claimed targets. */
export function clearSurveyPlan(ship: ShipEntry): void {
	if (!ship.surveyPlan) return;
	ship.surveyPlan = null;
}
