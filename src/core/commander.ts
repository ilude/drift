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
import { resolveShipPhysics } from "./ship-utils";
import { state } from "./state";

export function isAtColony(ship: ShipEntry): boolean {
	return ship.shipState === "orbiting" && hasColony(ship.hostPlanetName);
}

// --- Judgment constants ---

const PREEMPTIVE_BUFFER = 0.3;
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
		case "idle":
			return { action: "idle" };
	}
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

	const j = ship.commander.judgment;

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		const cond = entry.condition;
		if (cond.type === "always") continue;

		// Raise threshold based on commander judgment
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

function hasUnsurvedWorkAtHost(hostName: string): boolean {
	const [host, hostFound] = findBody(hostName);
	if (!hostFound) return false;
	if (isSurveyable(host) && host.survey.surveyLevel === 0) return true;
	return host.moons?.some((m) => isSurveyable(m) && m.survey.surveyLevel === 0) ?? false;
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
	if (!hasUnsurvedWorkAtHost(ship.hostPlanetName)) return null;

	const j = ship.commander.judgment;
	// Low-judgment commanders don't defer -- they follow orders literally
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
	);
	return cost.totalFuelKg;
}

function checkDeferRefuel(ship: ShipEntry, pendingResult: CommandResult): CommandResult | null {
	if (pendingResult.action !== "refuel") return null;
	if (ship.shipState !== "orbiting") return null;
	if (hasColony(ship.hostPlanetName)) return null;

	const j = ship.commander.judgment;
	if (j < 0.2) return null;

	const returnCost = estimateReturnFuelKg(ship);
	if (returnCost == null) return null;

	// Safety margin: low-judgment commanders want 2x return fuel, high-judgment 1.3x
	const margin = 2.0 - j * 0.7;
	const fuelNeeded = returnCost * margin;

	if (ship.fuelKg <= fuelNeeded) return null; // genuinely need to head home

	return { action: "survey" };
}

// --- The single decision entry point ---

// The commander evaluates standing orders, then applies judgment.
// Returns the final decision for the crew to execute, or err() if nothing to do.
export function commanderDecide(ship: ShipEntry): Result<CommandResult> {
	const [result, found] = evaluateCommandTree(ship);
	if (!found) return err();

	// Judgment overrides applied in order:
	// 1. Preemptive service at colony (top off before departing)
	// 2. Hold for inbound tanker (don't leave if tanker is coming)
	// 3. Defer refuel when fuel allows (keep surveying in the field)
	// 4. Defer maintenance in the field (finish survey before heading home)
	const decided =
		checkPreemptiveService(ship, result) ??
		checkHoldForTanker(ship, result) ??
		checkDeferRefuel(ship, result) ??
		checkDeferMaintenance(ship, result) ??
		result;
	return ok(decided);
}

// --- Learning ---

export function learnFromMalfunction(ship: ShipEntry): void {
	ship.commander.judgment = Math.min(
		JUDGMENT_CAP,
		ship.commander.judgment + MALFUNCTION_LEARNING_RATE * (1 - ship.commander.judgment),
	);
}

export function learnFromEmergencyReturn(ship: ShipEntry): void {
	ship.commander.judgment = Math.min(
		JUDGMENT_CAP,
		ship.commander.judgment + EMERGENCY_RETURN_LEARNING_RATE * (1 - ship.commander.judgment),
	);
}

export function incrementExperience(ship: ShipEntry): void {
	ship.commander.experience++;
}
