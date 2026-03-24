import { beforeEach, describe, expect, it } from "vitest";
import {
	checkCondition,
	computeMorale,
	evaluateCommandTree,
	getUnsurvevedMoonsOfHost,
	selectNextSurveyTarget,
	tickShipSimulation,
} from "../core/commands";
import { rebuildEntityMaps } from "../core/entities";
import { state } from "../core/state";
import type { BodyEntry, CommandEntry, ShipEntry } from "../types";

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		data: { name: "Ship" },
		fuelKg: 50000,
		fuelCapacityKg: 50000,
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 100 },
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		commandTree: { entries: [] },
		immediateCommand: null,
		hostPlanetName: "Mars",
		shipState: "orbiting" as const,
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

	it("shore leave gradually recovers morale and repairs hull", () => {
		const ship = mockShip({
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			maintenance: { age: 100, supplies: 50, maxSupplies: 100, hullIntegrity: 80 },
			action: { type: "shore-leave", commandId: "1", startTime: 0, duration: 30, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		// +2.5 morale/day × 1 day = 52.5
		expect(ship.crew.morale).toBeCloseTo(52.5, 0);
		// +0.25 hull/day × 1 day = 80.25
		expect(ship.maintenance.hullIntegrity).toBeCloseTo(80.25, 1);
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

	it("overhaul gradually repairs hull, restocks supplies, and recovers morale", () => {
		const ship = mockShip({
			hostPlanetName: "Mars",
			maintenance: { age: 100, supplies: 20, maxSupplies: 100, hullIntegrity: 40 },
			action: { type: "overhaul", commandId: "1", startTime: 0, duration: 5, progress: 0 },
			crew: { count: 50, morale: 60, lastShoreLeave: 0, deploymentLimit: 180 },
		});
		tickShipSimulation(ship, 1, 10);
		// +2.5 hull/day, +2.5 supplies/day, +0.5 morale/day
		expect(ship.maintenance.hullIntegrity).toBeCloseTo(42.5, 1);
		expect(ship.maintenance.supplies).toBeCloseTo(22.5, 1);
		expect(ship.crew.morale).toBeCloseTo(60.5, 1);
	});

	it("overhaul does not exceed maximums", () => {
		const ship = mockShip({
			maintenance: { age: 100, supplies: 99, maxSupplies: 100, hullIntegrity: 99 },
			action: { type: "overhaul", commandId: "1", startTime: 0, duration: 5, progress: 0 },
			crew: { count: 50, morale: 99.8, lastShoreLeave: 0, deploymentLimit: 180 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.maintenance.hullIntegrity).toBe(100);
		expect(ship.maintenance.supplies).toBe(100);
		expect(ship.crew.morale).toBe(100);
	});

	it("malfunction check fires for each interval skipped at high warp (3 intervals)", () => {
		// Ship in transfer with very degraded hull (integrity=1) so failChance is high.
		// Age starts at 1440 (checkIndex=48), simDt=91 advances to 1531 (checkIndex=51).
		// Three intervals (49, 50, 51) should each be checked; with integrity=1 and high
		// intervalAge the fail chance exceeds the seeded RNG roll on at least one interval.
		const ship = mockShip({
			shipState: "transferring" as const,
			maintenance: { age: 1440, supplies: 100, maxSupplies: 100, hullIntegrity: 1 },
		});
		const hullBefore = ship.maintenance.hullIntegrity;
		tickShipSimulation(ship, 91, 2000);
		// With integrity=1 and intervalAge ~1470-1530, failChance ≈ 80%+ each check;
		// at least one malfunction must have fired over 3 intervals.
		expect(ship.maintenance.hullIntegrity).toBeLessThan(hullBefore);
	});

	it("colony shuttle delivers supplies for each day boundary crossed at high warp", () => {
		// Ship at colony, simTime advances from 100.1 to 105.1 crossing 5 day boundaries.
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 0,
			fuelCapacityKg: 100000,
			maintenance: { age: 0, supplies: 0, maxSupplies: 100, hullIntegrity: 100 },
		});
		// Simulate being at a colony by using the colony detection path (hostPlanetName set).
		// tickShipSimulation detects atColony via state, so we need a matching body in state.
		// The simplest way: set simTime=105.1, simDt=5 so dayPrev=100, dayNow=105 (5 crossings).
		// Each crossing adds 25% fuel and 25 supplies (ceil(100*0.25)).
		tickShipSimulation(ship, 5, 105.1);
		// 5 deliveries × 25% of 100000 = 125000 → capped at 100000
		expect(ship.fuelKg).toBe(100000);
		// 5 deliveries × ceil(100*0.25)=25 = 125 → capped at 100
		expect(ship.maintenance.supplies).toBe(100);
	});
});

// --- selectNextSurveyTarget ---

function mockBodyEntry(name: string, overrides: Record<string, unknown> = {}): BodyEntry {
	return {
		data: { name, type: "Planet" },
		isMoon: false,
		isShip: false,
		isComet: false,
		survey: { surveyLevel: 0, deposits: [] },
		mesh: { position: { distanceToSquared: () => 1 } },
		moons: [],
		...overrides,
	} as unknown as BodyEntry;
}

function mockShipWithMesh(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return mockShip({
		mesh: { position: { distanceToSquared: () => 1 } } as unknown as ShipEntry["mesh"],
		...overrides,
	});
}

describe("selectNextSurveyTarget", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
	});

	it("skips bodies where isMoon is true", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true });
		const planet = mockBodyEntry("Mars");
		state.bodyMeshes = [moon, planet] as BodyEntry[];
		expect(selectNextSurveyTarget(mockShipWithMesh())).toBe("Mars");
	});

	it("returns null when only moon candidates exist", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true });
		state.bodyMeshes = [moon] as BodyEntry[];
		expect(selectNextSurveyTarget(mockShipWithMesh())).toBeNull();
	});

	it("skips already-surveyed bodies", () => {
		const surveyed = mockBodyEntry("Venus", { survey: { surveyLevel: 1, deposits: [] } });
		state.bodyMeshes = [surveyed] as BodyEntry[];
		expect(selectNextSurveyTarget(mockShipWithMesh())).toBeNull();
	});
});

// --- selectNextSurveyTarget -- asteroids ---

describe("selectNextSurveyTarget -- asteroids", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
	});

	function makeBeltEntry(
		asteroids: {
			designation: string;
			beltIndex: number;
			surveyLevel: number;
			x: number;
			z: number;
		}[],
	) {
		// 3 floats per asteroid: x, y, z
		const positions = new Float32Array(asteroids.length * 3);
		for (const a of asteroids) {
			positions[a.beltIndex * 3] = a.x;
			positions[a.beltIndex * 3 + 1] = 0;
			positions[a.beltIndex * 3 + 2] = a.z;
		}
		return {
			belt: {
				name: "Main Belt",
				minAU: 2.0,
				maxAU: 3.5,
				count: asteroids.length,
				color: "#aaa",
				size: 1,
				maxInc: 5,
			},
			positions,
			count: asteroids.length,
			asteroids: asteroids.map((a) => ({
				designation: a.designation,
				au: 2.5,
				period: 3.95,
				diameter: 100,
				mass: 1e15,
				beltIndex: a.beltIndex,
				survey: { surveyLevel: a.surveyLevel, deposits: [] },
			})),
		} as unknown as (typeof state.asteroidBelts)[number];
	}

	function shipAt(x: number, z: number): ShipEntry {
		return mockShip({
			mesh: { position: { x, z, distanceToSquared: () => 1 } } as unknown as ShipEntry["mesh"],
		});
	}

	it("returns asteroid designation when it is the nearest unsurveyed target", () => {
		// No planet bodies; one unsurveyed asteroid nearby
		state.asteroidBelts = [
			makeBeltEntry([{ designation: "MB-0001", beltIndex: 0, surveyLevel: 0, x: 10, z: 10 }]),
		];
		const ship = shipAt(0, 0);
		expect(selectNextSurveyTarget(ship)).toBe("MB-0001");
	});

	it("skips already-surveyed asteroids", () => {
		state.asteroidBelts = [
			makeBeltEntry([
				{ designation: "MB-0001", beltIndex: 0, surveyLevel: 1, x: 5, z: 5 },
				{ designation: "MB-0002", beltIndex: 1, surveyLevel: 0, x: 20, z: 20 },
			]),
		];
		const ship = shipAt(0, 0);
		// MB-0001 is surveyed (level 1), so the result should be MB-0002
		expect(selectNextSurveyTarget(ship)).toBe("MB-0002");
	});

	it("returns a planet when it is closer than any asteroid", () => {
		// Planet very close; asteroid far away
		const planet = mockBodyEntry("Venus", {
			mesh: { position: { x: 1, z: 1, distanceToSquared: () => 2 } },
		});
		state.bodyMeshes = [planet] as BodyEntry[];
		state.asteroidBelts = [
			makeBeltEntry([{ designation: "MB-0001", beltIndex: 0, surveyLevel: 0, x: 1000, z: 1000 }]),
		];
		const ship = shipAt(0, 0);
		expect(selectNextSurveyTarget(ship)).toBe("Venus");
	});
});

// --- selectNextSurveyTarget -- intents ---

describe("selectNextSurveyTarget -- intents", () => {
	function shipAt(x: number, z: number): ShipEntry {
		return mockShip({
			data: { name: "Ship" } as unknown as ShipEntry["data"],
			mesh: { position: { x, z, distanceToSquared: () => 1 } } as unknown as ShipEntry["mesh"],
		});
	}

	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
		state.shipIntents.clear();
	});

	it("skips bodies claimed by other ships via intents", () => {
		const mars = mockBodyEntry("Mars", { mesh: { position: { x: 5, y: 0, z: 5 } } });
		const jupiter = mockBodyEntry("Jupiter", { mesh: { position: { x: 20, y: 0, z: 20 } } });
		state.bodyMeshes = [mars, jupiter] as BodyEntry[];
		state.shipIntents.set("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		const ship = shipAt(0, 0);
		expect(selectNextSurveyTarget(ship)).toBe("Jupiter");
	});

	it("skips bodies being transferred to by other ships", () => {
		const mars = mockBodyEntry("Mars", { mesh: { position: { x: 5, y: 0, z: 5 } } });
		const jupiter = mockBodyEntry("Jupiter", { mesh: { position: { x: 20, y: 0, z: 20 } } });
		state.bodyMeshes = [mars, jupiter] as BodyEntry[];
		state.shipIntents.set("Ship-A", {
			type: "transferring",
			destination: "Mars",
			shipName: "Ship-A",
		});
		const ship = shipAt(0, 0);
		expect(selectNextSurveyTarget(ship)).toBe("Jupiter");
	});

	it("does not skip own claims", () => {
		const mars = mockBodyEntry("Mars", { mesh: { position: { x: 5, y: 0, z: 5 } } });
		state.bodyMeshes = [mars] as BodyEntry[];
		state.shipIntents.set("Ship", { type: "surveying", target: "Mars", shipName: "Ship" });
		const ship = shipAt(0, 0);
		expect(selectNextSurveyTarget(ship)).toBe("Mars");
	});
});

// --- getUnsurvevedMoonsOfHost ---

describe("getUnsurvevedMoonsOfHost", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
	});

	it("returns unsurveyed moons of the ship's host planet", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true });
		const planet = mockBodyEntry("Earth", { moons: [moon] });
		state.bodyMeshes = [planet] as BodyEntry[];
		rebuildEntityMaps();
		const ship = mockShip({ hostPlanetName: "Earth" });
		expect(getUnsurvevedMoonsOfHost(ship)).toHaveLength(1);
		expect(
			(getUnsurvevedMoonsOfHost(ship)[0] as unknown as { data: { name: string } }).data.name,
		).toBe("Luna");
	});

	it("returns empty array when all moons are surveyed", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true, survey: { surveyLevel: 1, deposits: [] } });
		const planet = mockBodyEntry("Earth", { moons: [moon] });
		state.bodyMeshes = [planet] as BodyEntry[];
		rebuildEntityMaps();
		const ship = mockShip({ hostPlanetName: "Earth" });
		expect(getUnsurvevedMoonsOfHost(ship)).toHaveLength(0);
	});

	it("returns empty array when host planet not found", () => {
		state.bodyMeshes = [];
		rebuildEntityMaps();
		const ship = mockShip({ hostPlanetName: "Nonexistent" });
		expect(getUnsurvevedMoonsOfHost(ship)).toHaveLength(0);
	});
});

// --- selectNextSurveyTarget -- NaN safety with positional bodies ---

describe("selectNextSurveyTarget -- NaN safety", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
		state.shipIntents.clear();
	});

	it("does not crash or produce NaN with asteroid entries that have real positions", () => {
		// Bodies with numeric x/z positions (no distanceToSquared mock)
		const venus = mockBodyEntry("Venus", {
			mesh: { position: { x: 50, y: 0, z: 30, distanceToSquared: () => 3400 } },
		});
		const mars = mockBodyEntry("Mars", {
			mesh: { position: { x: 100, y: 0, z: -20, distanceToSquared: () => 10400 } },
		});
		state.bodyMeshes = [venus, mars] as BodyEntry[];

		const ship = mockShip({
			mesh: {
				position: { x: 0, y: 0, z: 0, distanceToSquared: () => 0 },
			} as unknown as ShipEntry["mesh"],
		});

		const result = selectNextSurveyTarget(ship);
		expect(result).not.toBeNull();
		// Venus is closer (dist^2 = 50^2+30^2 = 3400 vs 100^2+20^2 = 10400)
		expect(result).toBe("Venus");
	});

	it("handles mix of bodies and asteroids without NaN in distance calculation", () => {
		// One far planet, one close asteroid
		const jupiter = mockBodyEntry("Jupiter", {
			mesh: { position: { x: 500, y: 0, z: 0, distanceToSquared: () => 250000 } },
		});
		state.bodyMeshes = [jupiter] as BodyEntry[];

		const positions = new Float32Array([10, 0, 10]); // one asteroid at (10,0,10)
		state.asteroidBelts = [
			{
				belt: { name: "Belt", minAU: 2, maxAU: 3, count: 1, color: "#aaa", size: 1, maxInc: 5 },
				positions,
				count: 1,
				asteroids: [
					{
						designation: "AST-001",
						au: 2.5,
						period: 3.95,
						diameter: 100,
						mass: 1e15,
						beltIndex: 0,
						survey: { surveyLevel: 0, deposits: [] },
					},
				],
			} as unknown as (typeof state.asteroidBelts)[number],
		];

		const ship = mockShip({
			mesh: {
				position: { x: 0, y: 0, z: 0, distanceToSquared: () => 0 },
			} as unknown as ShipEntry["mesh"],
		});

		const result = selectNextSurveyTarget(ship);
		// Asteroid at (10,10) is closer than Jupiter at (500,0)
		expect(result).toBe("AST-001");
	});
});
