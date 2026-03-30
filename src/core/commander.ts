// Commander: the human judgment layer on top of mechanical standing orders.
// The command tree (commands.ts) is the "dumb computer" — it evaluates rules top-to-bottom.
// The commander interprets those rules, applying experience and judgment to override them
// when the situation calls for it. The result is passed to the ship's crew to execute.

import { computeTotalFuelCost } from "../math/ship-physics";
import { distanceKmBetween } from "../math/transfer";
import type { CommandCondition, CommandResult, Result, ShipEntry } from "../types";
import { isSurveyable } from "../types";
import { getNearestColonyForShip, hasColony } from "./colonies";
import { checkCondition, evaluateCommandTree, hullCeiling } from "./commands";
import { findBody } from "./entities";
import { isTankerInboundFor } from "./intents";
import { err, ok } from "./result";
import { resolveShipPhysics, resolveShipSensorLevel } from "./ship-utils";
import { state } from "./state";
import { computeSurveyPlan } from "./survey-planner";

export function isAtColony(ship: ShipEntry): boolean {
	return ship.shipState === "orbiting" && hasColony(ship.hostPlanetName);
}

// --- Judgment constants ---

const PREEMPTIVE_BUFFER = 0.3;

/** Safety margin for fuel planning: low-caution commanders cut it close, high-caution want more buffer. */
export function computeSafetyMargin(caution: number): number {
	return 2.0 - caution * 0.7;
}
const MALFUNCTION_LEARNING_RATE = 0.08;
const EMERGENCY_RETURN_LEARNING_RATE = 0.05;
const JUDGMENT_CAP = 0.9;

// Critical thresholds below which no commander would defer maintenance
const CRITICAL_HULL = 10;
const CRITICAL_FUEL_PCT = 5;
const CRITICAL_SUPPLIES = 5;

// --- Judgment helpers ---

function checkConditionWithThreshold(
	type: Exclude<CommandCondition["type"], "always">,
	threshold: number,
	ship: ShipEntry,
): boolean {
	switch (type) {
		case "fuel-below":
			return (ship.fuelKg / ship.fuelCapacityKg) * 100 < threshold;
		case "morale-below":
			return ship.crew.morale < threshold;
		case "hull-below":
			return ship.maintenance.hullIntegrity < threshold;
		case "supplies-below":
			return (ship.maintenance.supplies / ship.maintenance.maxSupplies) * 100 < threshold;
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
		case "load-cargo":
			return { action: "load-cargo" };
		case "unload-cargo":
			return { action: "unload-cargo" };
		case "idle":
			return { action: "idle" };
	}
}

// --- Scored decision system ---

interface ScoredAction {
	action: CommandResult;
	score: number;
}

// --- Judgment overrides ---

// "Service before departing colony" — raise maintenance thresholds when about to leave,
// so the ship tops off proactively instead of discovering the problem mid-mission.
export function checkPreemptiveService(
	ship: ShipEntry,
	pendingResult: CommandResult,
): CommandResult | null {
	// Only intercept departure actions
	if (pendingResult.action !== "survey" && pendingResult.action !== "transfer") {
		return null;
	}
	// Only applies when at a colony (where servicing is possible)
	if (ship.shipState !== "orbiting" || !hasColony(ship.hostPlanetName)) {
		return null;
	}

	const j = ship.commander.caution;

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		const cond = entry.condition;
		if (cond.type === "always") continue;

		// Raise threshold based on commander caution
		let effective = cond.threshold + (100 - cond.threshold) * j * PREEMPTIVE_BUFFER;
		// Cap hull threshold at hull ceiling — can't demand more than the ship can achieve
		if (cond.type === "hull-below") {
			const ceiling = hullCeiling(ship.maintenance.totalAge, ship.maintenance.lastRefitAge);
			effective = Math.min(effective, ceiling);
		}
		if (checkConditionWithThreshold(cond.type, effective, ship)) {
			return commandToResult(entry.command, entry.target);
		}
	}
	return null;
}

function getConditionMetrics(
	ship: ShipEntry,
	type: Exclude<CommandCondition["type"], "always">,
): { current: number; critical: number } {
	switch (type) {
		case "fuel-below":
			return { current: (ship.fuelKg / ship.fuelCapacityKg) * 100, critical: CRITICAL_FUEL_PCT };
		case "hull-below":
			return { current: ship.maintenance.hullIntegrity, critical: CRITICAL_HULL };
		case "supplies-below":
			return {
				current: (ship.maintenance.supplies / ship.maintenance.maxSupplies) * 100,
				critical: CRITICAL_SUPPLIES,
			};
		case "morale-below":
			// Morale is never critical enough to abort a survey -- crew can tough it out
			return { current: ship.crew.morale, critical: 5 };
	}
}

function isMaintenanceAction(action: CommandResult["action"]): boolean {
	return (
		action === "refuel" ||
		action === "overhaul" ||
		action === "major-refit" ||
		action === "shore-leave"
	);
}

// "Hold for inbound tanker" — if a tanker has been dispatched to refuel this ship,
// hold orbit instead of departing. The tanker's intent is cleared when it finishes.
export function checkHoldForTanker(ship: ShipEntry, result: CommandResult): CommandResult | null {
	// Only intercept departure actions (survey or transfer)
	if (result.action !== "survey" && result.action !== "transfer") return null;
	if (isTankerInboundFor(ship.data.name)) return { action: "idle" };
	return null;
}

function hasUnsurvedWorkAtHost(hostName: string, maxSurveyLevel: number): boolean {
	const [host, hostFound] = findBody(hostName);
	if (!hostFound) return false;
	if (isSurveyable(host) && host.survey.surveyLevel < maxSurveyLevel) return true;
	return host.moons?.some((m) => isSurveyable(m) && m.survey.surveyLevel < maxSurveyLevel) ?? false;
}

// "Finish the job before heading home" — defer maintenance when already at an unsurveyed
// body (or one with unsurveyed moons), if the commander judges it safe enough to finish first.
function checkDeferMaintenance(
	ship: ShipEntry,
	pendingResult: CommandResult,
): CommandResult | null {
	// Only intercept maintenance actions
	if (!isMaintenanceAction(pendingResult.action)) return null;
	// Only applies while orbiting (not mid-transfer)
	if (ship.shipState !== "orbiting") return null;
	// Only applies at non-colony locations (at a colony, just do the maintenance)
	if (hasColony(ship.hostPlanetName)) return null;
	const maxLevel = resolveShipSensorLevel(ship);
	if (!hasUnsurvedWorkAtHost(ship.hostPlanetName, maxLevel)) return null;

	const j = ship.commander.initiative;
	// Low-initiative commanders don't defer -- they follow orders literally
	if (j < 0.2) return null;

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		const cond = entry.condition;
		if (cond.type === "always") continue;

		if (!checkCondition(cond, ship)) continue;

		// This condition fired -- would the commander defer it?
		const { current, critical } = getConditionMetrics(ship, cond.type);

		// Commander's personal floor: interpolate from threshold down toward critical
		const personalFloor = critical + (cond.threshold - critical) * (1 - j);
		if (current < personalFloor) {
			// Too risky even for this commander -- don't defer
			return null;
		}
	}

	// All firing conditions are above the commander's personal floor -- defer and survey
	return { action: "survey" };
}

// "Keep surveying while fuel allows" — when the command tree says refuel but the ship
// has enough fuel to return home, continue surveying nearby targets instead of heading
// back immediately. The commander estimates return fuel cost and only triggers return
// when fuel is genuinely needed for the trip home.
function estimateReturnFuelKg(ship: ShipEntry): number | null {
	const [colony, colonyFound] = getNearestColonyForShip(ship);
	if (!colonyFound) return null;
	const [host, hostFound] = findBody(ship.hostPlanetName);
	if (!hostFound) return null;
	const distKm = distanceKmBetween(host, colony);
	if (distKm < 1) return 0;
	const physics = resolveShipPhysics(ship);
	const cost = computeTotalFuelCost(
		distKm,
		physics.accelG,
		physics.ispS,
		physics.dryMassKg,
		ship.fuelCapacityKg,
		state.fuelBurnMultiplier,
		physics.fuelMod,
	);
	return cost.totalFuelKg;
}

/** Pure decision: should this ship defer refueling based on fuel margin? */
export function shouldDeferRefueling(
	currentFuel: number,
	returnCostEstimate: number,
	caution: number,
): boolean {
	const margin = computeSafetyMargin(caution);
	return currentFuel > returnCostEstimate * margin;
}

/** Pure scoring: compute how confident we are about deferring refueling. */
export function computeRefuelDeferralScore(
	fuelAvailable: number,
	returnCostEstimate: number,
	safetyMargin: number,
): number {
	if (returnCostEstimate === 0) return 0.6;
	const fuelMargin = fuelAvailable / (returnCostEstimate * safetyMargin);
	return 0.5 + 0.35 * Math.min(1, fuelMargin - 1);
}

function checkDeferRefuel(ship: ShipEntry, pendingResult: CommandResult): CommandResult | null {
	if (pendingResult.action !== "refuel") return null;
	if (ship.shipState !== "orbiting") return null;
	if (hasColony(ship.hostPlanetName)) return null;

	if (ship.commander.initiative < 0.2) return null;

	const returnCost = estimateReturnFuelKg(ship);
	if (returnCost == null) return null;

	if (!shouldDeferRefueling(ship.fuelKg, returnCost, ship.commander.caution)) return null;

	const maxLevel = resolveShipSensorLevel(ship);
	if (!hasUnsurvedWorkAtHost(ship.hostPlanetName, maxLevel)) return null;

	return { action: "survey" };
}

// --- Score wrappers ---

function scorePreemptiveService(ship: ShipEntry, base: CommandResult): ScoredAction | null {
	const action = checkPreemptiveService(ship, base);
	if (!action) return null;
	return { action, score: 0.7 };
}

function scoreHoldForTanker(ship: ShipEntry, base: CommandResult): ScoredAction | null {
	const action = checkHoldForTanker(ship, base);
	if (!action) return null;
	return { action, score: 0.85 };
}

function scoreDeferRefuel(ship: ShipEntry, base: CommandResult): ScoredAction | null {
	const action = checkDeferRefuel(ship, base);
	if (!action) return null;
	const returnCost = estimateReturnFuelKg(ship);
	if (returnCost == null) return { action, score: 0.6 };
	const margin = computeSafetyMargin(ship.commander.caution);
	const score = computeRefuelDeferralScore(ship.fuelKg, returnCost, margin);
	return { action, score };
}

function scoreDeferMaintenance(ship: ShipEntry, base: CommandResult): ScoredAction | null {
	const action = checkDeferMaintenance(ship, base);
	if (!action) return null;
	return { action, score: 0.6 };
}

// --- The single decision entry point ---

// The commander evaluates standing orders, then applies judgment via a scored candidate system.
// Each override returns a score (0–1); the highest score wins. Base command scores 0.5.
// Returns the final decision for the crew to execute, or err() if nothing to do.
export function commanderDecide(ship: ShipEntry): Result<CommandResult> {
	const [result, found] = evaluateCommandTree(ship);
	if (!found) return err();

	const candidates: ScoredAction[] = [{ action: result, score: 0.5 }];

	for (const scorer of [
		scorePreemptiveService,
		scoreHoldForTanker,
		scoreDeferRefuel,
		scoreDeferMaintenance,
	]) {
		const scored = scorer(ship, result);
		if (scored) candidates.push(scored);
	}

	const best = candidates.reduce((a, b) => (a.score >= b.score ? a : b));

	// Side-effect: create survey plan when departing colony for survey work
	if (best.action.action === "survey" && isAtColony(ship) && !ship.surveyPlan) {
		ship.surveyPlan = computeSurveyPlan(ship);
	}

	return ok(best.action);
}

// --- Learning ---

export function learnFromMalfunction(ship: ShipEntry): void {
	ship.commander.caution = Math.min(
		JUDGMENT_CAP,
		ship.commander.caution + MALFUNCTION_LEARNING_RATE * (1 - ship.commander.caution),
	);
}

export function learnFromEmergencyReturn(ship: ShipEntry): void {
	ship.commander.caution = Math.min(
		JUDGMENT_CAP,
		ship.commander.caution + EMERGENCY_RETURN_LEARNING_RATE * (1 - ship.commander.caution),
	);
}

const JUDGMENT_DRIFT_RATE = 0.002;

export function incrementExperience(ship: ShipEntry): void {
	ship.commander.experience++;
	for (const axis of ["caution", "initiative"] as const) {
		const v = ship.commander[axis];
		if (v > 0.5) ship.commander[axis] = Math.max(0.5, v - JUDGMENT_DRIFT_RATE);
		else if (v < 0.5) ship.commander[axis] = Math.min(0.5, v + JUDGMENT_DRIFT_RATE);
	}
}
