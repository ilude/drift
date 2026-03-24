import { describe, expect, it } from "vitest";
import {
	checkCondition,
	computeMorale,
	evaluateCommandTree,
	tickShipSimulation,
} from "../core/commands";
import type { CommandEntry, ShipEntry } from "../types";

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		fuelKg: 50000,
		fuelCapacityKg: 50000,
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 100 },
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		commandTree: { entries: [] },
		immediateCommand: null,
		hostPlanetName: "Earth",
		...overrides,
	} as unknown as ShipEntry;
}

function mockEntry(
	id: string,
	command: CommandEntry["command"],
	overrides: Partial<CommandEntry> = {},
): CommandEntry {
	return {
		id,
		command,
		condition: { type: "always" },
		enabled: true,
		origin: "ship",
		...overrides,
	};
}

// --- checkCondition ---

describe("checkCondition", () => {
	it("always → true", () => {
		const ship = mockShip();
		expect(checkCondition({ type: "always" }, ship)).toBe(true);
	});

	it("fuel-below: 10% fuel with threshold 20 → true", () => {
		const ship = mockShip({ fuelKg: 5000, fuelCapacityKg: 50000 });
		expect(checkCondition({ type: "fuel-below", threshold: 20 }, ship)).toBe(true);
	});

	it("fuel-below: 50% fuel with threshold 20 → false", () => {
		const ship = mockShip({ fuelKg: 25000, fuelCapacityKg: 50000 });
		expect(checkCondition({ type: "fuel-below", threshold: 20 }, ship)).toBe(false);
	});

	it("fuel-below: exactly 20% fuel with threshold 20 → false (not strictly below)", () => {
		const ship = mockShip({ fuelKg: 10000, fuelCapacityKg: 50000 });
		expect(checkCondition({ type: "fuel-below", threshold: 20 }, ship)).toBe(false);
	});

	it("morale-below: morale 30 with threshold 40 → true", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 30, lastShoreLeave: 0, deploymentLimit: 180 },
		});
		expect(checkCondition({ type: "morale-below", threshold: 40 }, ship)).toBe(true);
	});

	it("morale-below: morale 50 with threshold 40 → false", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
		});
		expect(checkCondition({ type: "morale-below", threshold: 40 }, ship)).toBe(false);
	});

	it("hull-below: hull 20 with threshold 30 → true", () => {
		const ship = mockShip({
			maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 20 },
		});
		expect(checkCondition({ type: "hull-below", threshold: 30 }, ship)).toBe(true);
	});

	it("hull-below: hull 50 with threshold 30 → false", () => {
		const ship = mockShip({
			maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 50 },
		});
		expect(checkCondition({ type: "hull-below", threshold: 30 }, ship)).toBe(false);
	});

	it("supplies-below: 30/100 supplies with threshold 50 → true", () => {
		const ship = mockShip({
			maintenance: { age: 0, supplies: 30, maxSupplies: 100, hullIntegrity: 100 },
		});
		expect(checkCondition({ type: "supplies-below", threshold: 50 }, ship)).toBe(true);
	});

	it("supplies-below: 60/100 supplies with threshold 50 → false", () => {
		const ship = mockShip({
			maintenance: { age: 0, supplies: 60, maxSupplies: 100, hullIntegrity: 100 },
		});
		expect(checkCondition({ type: "supplies-below", threshold: 50 }, ship)).toBe(false);
	});
});

// --- evaluateCommandTree ---

describe("evaluateCommandTree", () => {
	it("empty tree → null", () => {
		const ship = mockShip();
		expect(evaluateCommandTree(ship)).toBeNull();
	});

	it("single 'always → idle' entry returns { action: 'idle' }", () => {
		const ship = mockShip({
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "idle" });
	});

	it("disabled entry is skipped", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "idle", { enabled: false })],
			},
		});
		expect(evaluateCommandTree(ship)).toBeNull();
	});

	it("first matching entry wins (priority order)", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "idle"), mockEntry("2", "survey-nearest")],
			},
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "idle" });
	});

	it("non-matching entry is skipped, next matching entry wins", () => {
		const ship = mockShip({
			fuelKg: 25000,
			fuelCapacityKg: 50000,
			commandTree: {
				entries: [
					// fuel-below 10 won't trigger at 50%
					mockEntry("1", "refuel", { condition: { type: "fuel-below", threshold: 10 } }),
					mockEntry("2", "idle"),
				],
			},
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "idle" });
	});

	it("survey-nearest maps to { action: 'survey' }", () => {
		const ship = mockShip({
			commandTree: { entries: [mockEntry("1", "survey-nearest")] },
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "survey" });
	});

	it("transfer-to with target maps to { action: 'transfer', target: 'Mars' }", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "transfer-to", { target: "Mars" })],
			},
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "transfer", target: "Mars" });
	});

	it("immediateCommand takes priority over tree entries", () => {
		const immediate = mockEntry("imm", "shore-leave");
		const ship = mockShip({
			immediateCommand: immediate,
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "shore-leave" });
	});

	it("disabled immediateCommand falls through to tree", () => {
		const immediate = mockEntry("imm", "shore-leave", { enabled: false });
		const ship = mockShip({
			immediateCommand: immediate,
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		expect(evaluateCommandTree(ship)).toEqual({ action: "idle" });
	});
});

// --- computeMorale ---

describe("computeMorale", () => {
	it("daysSinceLeave = 0, limit = 180 → 100", () => {
		expect(computeMorale(0, 180)).toBe(100);
	});

	it("daysSinceLeave = 180, limit = 180 → 100 (at boundary)", () => {
		expect(computeMorale(180, 180)).toBe(100);
	});

	it("daysSinceLeave = 200, limit = 180 → less than 100", () => {
		const morale = computeMorale(200, 180);
		expect(morale).toBeLessThan(100);
		expect(morale).toBeGreaterThan(0);
	});

	it("daysSinceLeave = 360, limit = 180 → significantly lower than 100", () => {
		const morale = computeMorale(360, 180);
		expect(morale).toBeLessThan(80);
	});

	it("daysSinceLeave = 10000, limit = 180 → 0 (floors at 0)", () => {
		expect(computeMorale(10000, 180)).toBe(0);
	});

	it("exponent 1.5 makes it steeper than linear at day 360", () => {
		// linear would be 180/360 * 100 = 50
		// with exponent 1.5 it should be below 50
		const morale = computeMorale(360, 180);
		const linearValue = (180 / 360) * 100;
		expect(morale).toBeLessThan(linearValue);
	});
});

// --- tickShipSimulation ---

describe("tickShipSimulation", () => {
	it("morale updates correctly based on simTime and lastShoreLeave", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		});
		// 360 days since last leave → morale should drop
		tickShipSimulation(ship, 0.1, 360);
		expect(ship.crew.morale).toBeLessThan(100);
	});

	it("maintenance age accumulates by simDt", () => {
		const ship = mockShip({
			maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 100 },
		});
		tickShipSimulation(ship, 1.5, 10);
		expect(ship.maintenance.age).toBeCloseTo(1.5, 5);
	});

	it("fuel drains during active action (non-null action.type)", () => {
		const ship = mockShip({
			fuelKg: 50000,
			fuelCapacityKg: 50000,
			action: { type: "survey-nearest", commandId: "1", startTime: 0, duration: 0, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.fuelKg).toBeLessThan(50000);
	});

	it("fuel drains at lower rate when idle (baseline station-keeping)", () => {
		const shipActive = mockShip({
			fuelKg: 50000,
			fuelCapacityKg: 50000,
			action: { type: "survey-nearest", commandId: "1", startTime: 0, duration: 0, progress: 0 },
		});
		const shipIdle = mockShip({
			fuelKg: 50000,
			fuelCapacityKg: 50000,
			action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		});
		tickShipSimulation(shipActive, 1, 10);
		tickShipSimulation(shipIdle, 1, 10);
		expect(shipIdle.fuelKg).toBeLessThan(50000);
		expect(shipIdle.fuelKg).toBeGreaterThan(shipActive.fuelKg);
	});

	it("fuel never goes below 0", () => {
		const ship = mockShip({
			fuelKg: 0.001,
			fuelCapacityKg: 50000,
			action: { type: "idle", commandId: "1", startTime: 0, duration: 0, progress: 0 },
		});
		tickShipSimulation(ship, 10, 10);
		expect(ship.fuelKg).toBeGreaterThanOrEqual(0);
	});

	it("shore leave gradually recovers morale", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			action: { type: "shore-leave", commandId: "1", startTime: 0, duration: 30, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		// +5 morale/day × 1 day = 55
		expect(ship.crew.morale).toBeCloseTo(55, 0);
	});

	it("shore leave does not exceed 100 morale", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 98, lastShoreLeave: 0, deploymentLimit: 180 },
			action: { type: "shore-leave", commandId: "1", startTime: 0, duration: 30, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.crew.morale).toBe(100);
	});

	it("refuel gradually tops off fuel", () => {
		const ship = mockShip({
			fuelKg: 25000,
			fuelCapacityKg: 50000,
			action: { type: "refuel", commandId: "1", startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		// 20%/day × 50000 × 1 day = +10000
		expect(ship.fuelKg).toBeCloseTo(35000, 0);
	});

	it("refuel does not consume fuel while refueling", () => {
		const ship = mockShip({
			fuelKg: 25000,
			fuelCapacityKg: 50000,
			action: { type: "refuel", commandId: "1", startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.fuelKg).toBeGreaterThan(25000);
	});

	it("overhaul gradually repairs hull and restocks supplies", () => {
		const ship = mockShip({
			maintenance: { age: 100, supplies: 20, maxSupplies: 100, hullIntegrity: 40 },
			action: { type: "overhaul", commandId: "1", startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		// +20 hull/day, +20 supplies/day
		expect(ship.maintenance.hullIntegrity).toBeCloseTo(60, 0);
		expect(ship.maintenance.supplies).toBeCloseTo(40, 0);
	});

	it("overhaul does not exceed maximums", () => {
		const ship = mockShip({
			maintenance: { age: 100, supplies: 95, maxSupplies: 100, hullIntegrity: 95 },
			action: { type: "overhaul", commandId: "1", startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.maintenance.hullIntegrity).toBe(100);
		expect(ship.maintenance.supplies).toBe(100);
	});
});
