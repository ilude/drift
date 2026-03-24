import type { CommandCondition, CommandResult, ShipEntry } from "../types";
import { isShipEntry, isSurveyable } from "../types";
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

export function tickShipSimulation(ship: ShipEntry, simDt: number, simTime: number): void {
	const atColony = isAtColony(ship);

	// At colony: supply shuttles top off ship once per day
	if (atColony) {
		ship.crew.lastShoreLeave = simTime;
		ship.crew.morale = 100;

		// Supply shuttles once per game day (fuel + supplies only)
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
	} else {
		const daysSinceLeave = simTime - ship.crew.lastShoreLeave;
		ship.crew.morale = computeMorale(daysSinceLeave, ship.crew.deploymentLimit);
	}

	// Maintenance age: only accumulates away from colony
	if (!atColony) {
		ship.maintenance.age += simDt;
	}

	// Fuel consumption
	if (!atColony) {
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
	const shipPos = ship.mesh.position;

	const candidates = state.bodyMeshes.filter((body) => {
		if (body === (ship as unknown)) return false;
		if (isShipEntry(body)) return false;
		if (!isSurveyable(body)) return false;
		if (body.survey.surveyLevel !== 0) return false;
		if (body.data.type === "Star") return false;
		return true;
	});

	if (candidates.length === 0) return null;

	candidates.sort((a, b) => {
		const da = a.mesh.position.distanceToSquared(shipPos);
		const db = b.mesh.position.distanceToSquared(shipPos);
		return da - db;
	});

	const nearest = candidates[0];
	if ("data" in nearest) {
		return (nearest as { data: { name: string } }).data.name;
	}
	return null;
}
