// Commander: the human judgment layer on top of mechanical standing orders.
// The command tree (commands.ts) is the "dumb computer" — it evaluates rules top-to-bottom.
// The commander interprets those rules, applying experience and judgment to override them
// when the situation calls for it. The result is passed to the ship's crew to execute.

import type { CommandCondition, CommandResult, ShipEntry } from "../types";
import { isSurveyable } from "../types";
import { checkCondition, evaluateCommandTree } from "./commands";
import { findBody } from "./entities";

// Colony names -- ships at these locations get shore leave and resupply automatically
const COLONY_NAMES = new Set(["Earth"]);

export function isAtColony(ship: ShipEntry): boolean {
	return ship.shipState === "orbiting" && COLONY_NAMES.has(ship.hostPlanetName);
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
	if (ship.shipState !== "orbiting" || !COLONY_NAMES.has(ship.hostPlanetName)) {
		return null;
	}

	const j = ship.commander.judgment;

	for (const entry of ship.commandTree.entries) {
		if (!entry.enabled) continue;
		const cond = entry.condition;
		if (cond.type === "always") continue;

		// Raise threshold based on commander judgment
		const effective = cond.threshold + (100 - cond.threshold) * j * PREEMPTIVE_BUFFER;
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

// "Finish the job before heading home" — defer maintenance when already at an unsurveyed
// body, if the commander judges it safe enough to complete the survey first.
function checkDeferMaintenance(
	ship: ShipEntry,
	pendingResult: CommandResult,
): CommandResult | null {
	// Only intercept maintenance actions
	if (!isMaintenanceAction(pendingResult.action)) return null;
	// Only applies while orbiting (not mid-transfer)
	if (ship.shipState !== "orbiting") return null;
	// Only applies at non-colony locations (at a colony, just do the maintenance)
	if (COLONY_NAMES.has(ship.hostPlanetName)) return null;

	// Check if the current host is unsurveyed
	const host = findBody(ship.hostPlanetName);
	if (!host || !isSurveyable(host) || host.survey.surveyLevel > 0) return null;

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

// --- The single decision entry point ---

// The commander evaluates standing orders, then applies judgment.
// Returns the final decision for the crew to execute, or null if nothing to do.
export function commanderDecide(ship: ShipEntry): CommandResult | null {
	const result = evaluateCommandTree(ship);
	if (!result) return null;

	// Judgment overrides: preemptive service at colony, defer maintenance in the field
	return checkPreemptiveService(ship, result) ?? checkDeferMaintenance(ship, result) ?? result;
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
