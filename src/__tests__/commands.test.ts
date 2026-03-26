import { beforeEach, describe, expect, it } from "vitest";
import { getColony } from "../core/colonies";
import {
	checkHoldForTanker,
	checkPreemptiveService,
	commanderDecide,
	incrementExperience,
	learnFromEmergencyReturn,
	learnFromMalfunction,
} from "../core/commander";
import {
	bathtubFailRate,
	checkCondition,
	computeMorale,
	evaluateCommandTree,
	getUnsurvevedMoonsOfHost,
	hullCeiling,
	invalidateSurveyTargetCache,
	selectNextSurveyTarget,
	tickShipSimulation,
} from "../core/commands";
import { rebuildEntityMaps } from "../core/entities";
import { invalidateIntentsCache } from "../core/intents";
import { state } from "../core/state";
import type { BodyEntry, ColonyState, CommandEntry, ShipEntry } from "../types";

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		data: { name: "Ship" },
		fuelKg: 50000,
		fuelCapacityKg: 50000,
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		commander: { judgment: 0.3, experience: 0 },
		maintenance: {
			age: 0,
			totalAge: 0,
			lastRefitAge: 0,
			supplies: 100,
			maxSupplies: 100,
			hullIntegrity: 100,
		},
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
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 20,
			},
		});
		expect(checkCondition({ type: "hull-below", threshold: 30 }, ship)).toBe(true);
	});

	it("hull-below: hull 50 with threshold 30 → false", () => {
		const ship = mockShip({
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 50,
			},
		});
		expect(checkCondition({ type: "hull-below", threshold: 30 }, ship)).toBe(false);
	});

	it("supplies-below: 30/100 supplies with threshold 50 → true", () => {
		const ship = mockShip({
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 30,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
		});
		expect(checkCondition({ type: "supplies-below", threshold: 50 }, ship)).toBe(true);
	});

	it("supplies-below: 60/100 supplies with threshold 50 → false", () => {
		const ship = mockShip({
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 60,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
		});
		expect(checkCondition({ type: "supplies-below", threshold: 50 }, ship)).toBe(false);
	});
});

// --- evaluateCommandTree ---

describe("evaluateCommandTree", () => {
	it("empty tree → null", () => {
		const ship = mockShip();
		const [, found] = evaluateCommandTree(ship);
		expect(found).toBe(false);
	});

	it("single 'always → idle' entry returns { action: 'idle' }", () => {
		const ship = mockShip({
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "idle" });
	});

	it("disabled entry is skipped", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "idle", { enabled: false })],
			},
		});
		const [, found] = evaluateCommandTree(ship);
		expect(found).toBe(false);
	});

	it("first matching entry wins (priority order)", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "idle"), mockEntry("2", "survey-nearest")],
			},
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "idle" });
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
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "idle" });
	});

	it("survey-nearest maps to { action: 'survey' }", () => {
		const ship = mockShip({
			commandTree: { entries: [mockEntry("1", "survey-nearest")] },
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "survey" });
	});

	it("transfer-to with target maps to { action: 'transfer', target: 'Mars' }", () => {
		const ship = mockShip({
			commandTree: {
				entries: [mockEntry("1", "transfer-to", { target: "Mars" })],
			},
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "transfer", target: "Mars" });
	});

	it("immediateCommand takes priority over tree entries", () => {
		const immediate = mockEntry("imm", "shore-leave");
		const ship = mockShip({
			immediateCommand: immediate,
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "shore-leave" });
	});

	it("disabled immediateCommand falls through to tree", () => {
		const immediate = mockEntry("imm", "shore-leave", { enabled: false });
		const ship = mockShip({
			immediateCommand: immediate,
			commandTree: { entries: [mockEntry("1", "idle")] },
		});
		const [result, found] = evaluateCommandTree(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "idle" });
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
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
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
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 80,
			},
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
			hostPlanetName: "Earth",
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
			hostPlanetName: "Earth",
			fuelKg: 25000,
			fuelCapacityKg: 50000,
			action: { type: "refuel", commandId: "1", startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, 1, 10);
		expect(ship.fuelKg).toBeGreaterThan(25000);
	});

	it("overhaul gradually repairs hull, restocks supplies, and recovers morale", () => {
		const ship = mockShip({
			hostPlanetName: "Earth",
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 20,
				maxSupplies: 100,
				hullIntegrity: 40,
			},
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
			hostPlanetName: "Earth",
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 99,
				maxSupplies: 100,
				hullIntegrity: 99,
			},
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
			maintenance: {
				age: 1440,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 1,
			},
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
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 0,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
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

	it("colony shuttle capped case: large time step fills to capacity directly", () => {
		// Ship at colony with very large simDt that exceeds cap limit (30 iterations).
		// When daysCrossed > 30 (capped), we hit the "capped case" at lines 153-156.
		// This case directly fills fuel and supplies to max capacity.
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 10000,
			fuelCapacityKg: 100000,
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 10,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
		});
		// Advance 40 days at once: dayNow - dayPrev = 40, capped at 30.
		// The condition: daysCrossed >= dayNow - dayPrev should fail, entering the else if.
		// Set simTime=140, simDt=40 so dayPrev=100, dayNow=140, actual=40 but capped to 30.
		tickShipSimulation(ship, 40, 140);
		// Capped case fills directly to capacity
		expect(ship.fuelKg).toBe(100000);
		expect(ship.maintenance.supplies).toBe(100);
	});

	it("fuel drain at idle rate (0.05%/day) when action.type is null", () => {
		// Lines 169-170: When action.type === null, station-keeping rate is 0.0005.
		// This tests the idle branch specifically.
		const ship = mockShip({
			fuelKg: 50000,
			fuelCapacityKg: 50000,
			shipState: "orbiting" as const,
			action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		});
		const fuelBefore = ship.fuelKg;
		tickShipSimulation(ship, 1, 10); // simDt=1 day
		const fuelDrained = fuelBefore - ship.fuelKg;
		// Idle rate: 0.0005 * 50000 * 1 = 25 kg/day
		expect(fuelDrained).toBeCloseTo(25, 0);
		expect(ship.fuelKg).toBeCloseTo(49975, 0);
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
		invalidateSurveyTargetCache();
	});

	it("skips bodies where isMoon is true", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true });
		const planet = mockBodyEntry("Mars");
		state.bodyMeshes = [moon, planet] as BodyEntry[];
		const [target, targetFound] = selectNextSurveyTarget(mockShipWithMesh());
		expect(targetFound).toBe(true);
		expect(target).toBe("Mars");
	});

	it("returns null when only moon candidates exist", () => {
		const moon = mockBodyEntry("Luna", { isMoon: true });
		state.bodyMeshes = [moon] as BodyEntry[];
		const [, notFound] = selectNextSurveyTarget(mockShipWithMesh());
		expect(notFound).toBe(false);
	});

	it("skips already-surveyed bodies", () => {
		const surveyed = mockBodyEntry("Venus", { survey: { surveyLevel: 1, deposits: [] } });
		state.bodyMeshes = [surveyed] as BodyEntry[];
		const [, notFound] = selectNextSurveyTarget(mockShipWithMesh());
		expect(notFound).toBe(false);
	});
});

// --- selectNextSurveyTarget -- asteroids ---

describe("selectNextSurveyTarget -- asteroids", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
		invalidateSurveyTargetCache();
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
		const [asteroidTarget, asteroidFound] = selectNextSurveyTarget(ship);
		expect(asteroidFound).toBe(true);
		expect(asteroidTarget).toBe("MB-0001");
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
		const [asteroidTarget, asteroidFound] = selectNextSurveyTarget(ship);
		expect(asteroidFound).toBe(true);
		expect(asteroidTarget).toBe("MB-0002");
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
		const [closestTarget, closestFound] = selectNextSurveyTarget(ship);
		expect(closestFound).toBe(true);
		expect(closestTarget).toBe("Venus");
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
		invalidateIntentsCache();
		invalidateSurveyTargetCache();
	});

	it("skips bodies claimed by other ships via intents", () => {
		const mars = mockBodyEntry("Mars", { mesh: { position: { x: 5, y: 0, z: 5 } } });
		const jupiter = mockBodyEntry("Jupiter", { mesh: { position: { x: 20, y: 0, z: 20 } } });
		state.bodyMeshes = [mars, jupiter] as BodyEntry[];
		state.shipIntents.set("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		const ship = shipAt(0, 0);
		const [claimTarget, claimFound] = selectNextSurveyTarget(ship);
		expect(claimFound).toBe(true);
		expect(claimTarget).toBe("Jupiter");
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
		const [transferTarget, transferFound] = selectNextSurveyTarget(ship);
		expect(transferFound).toBe(true);
		expect(transferTarget).toBe("Jupiter");
	});

	it("does not skip own claims", () => {
		const mars = mockBodyEntry("Mars", { mesh: { position: { x: 5, y: 0, z: 5 } } });
		state.bodyMeshes = [mars] as BodyEntry[];
		state.shipIntents.set("Ship", { type: "surveying", target: "Mars", shipName: "Ship" });
		const ship = shipAt(0, 0);
		const [ownTarget, ownFound] = selectNextSurveyTarget(ship);
		expect(ownFound).toBe(true);
		expect(ownTarget).toBe("Mars");
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
		invalidateIntentsCache();
		invalidateSurveyTargetCache();
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

		const [nanTarget, nanFound] = selectNextSurveyTarget(ship);
		expect(nanFound).toBe(true);
		// Venus is closer (dist^2 = 50^2+30^2 = 3400 vs 100^2+20^2 = 10400)
		expect(nanTarget).toBe("Venus");
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

		const [mixTarget, mixFound] = selectNextSurveyTarget(ship);
		// Asteroid at (10,10) is closer than Jupiter at (500,0)
		expect(mixFound).toBe(true);
		expect(mixTarget).toBe("AST-001");
	});
});

// --- checkPreemptiveService ---

describe("checkPreemptiveService", () => {
	it("returns null for non-departure actions", () => {
		const ship = mockShip({ hostPlanetName: "Earth" });
		expect(checkPreemptiveService(ship, { action: "refuel" })).toBeNull();
		expect(checkPreemptiveService(ship, { action: "overhaul" })).toBeNull();
		expect(checkPreemptiveService(ship, { action: "shore-leave" })).toBeNull();
		expect(checkPreemptiveService(ship, { action: "idle" })).toBeNull();
	});

	it("returns null when not at colony", () => {
		const ship = mockShip({
			hostPlanetName: "Mars",
			commander: { judgment: 1.0, experience: 50 },
			crew: { count: 50, morale: 45, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
					}),
				],
			},
		});
		expect(checkPreemptiveService(ship, { action: "survey" })).toBeNull();
	});

	it("high judgment commander preemptively takes shore leave at colony", () => {
		// Morale 50%, threshold 40%, judgment 0.8
		// effective = 40 + 60 * 0.8 * 0.3 = 54.4 → 50 < 54.4 → triggers
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.8, experience: 20 },
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toEqual({ action: "shore-leave" });
	});

	it("low judgment commander does not preempt with same conditions", () => {
		// Morale 50%, threshold 40%, judgment 0.3
		// effective = 40 + 60 * 0.3 * 0.3 = 45.4 → 50 > 45.4 → no trigger
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.3, experience: 0 },
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toBeNull();
	});

	it("preempts refuel when fuel is near threshold at colony", () => {
		// Fuel 25%, threshold 20%, judgment 0.9
		// effective = 20 + 80 * 0.9 * 0.3 = 41.6 → 25 < 41.6 → triggers
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 12500,
			fuelCapacityKg: 50000,
			commander: { judgment: 0.9, experience: 30 },
			commandTree: {
				entries: [
					mockEntry("fuel-check", "refuel", {
						condition: { type: "fuel-below", threshold: 20 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toEqual({ action: "refuel" });
	});

	it("preempts overhaul when hull is near threshold at colony", () => {
		// Hull 40%, threshold 30%, judgment 0.8
		// effective = 30 + 70 * 0.8 * 0.3 = 46.8 → 40 < 46.8 → triggers
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.8, experience: 10 },
			maintenance: {
				age: 200,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 40,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toEqual({ action: "overhaul" });
	});

	it("skips disabled command tree entries", () => {
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 1.0, experience: 50 },
			crew: { count: 50, morale: 30, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
						enabled: false,
					}),
				],
			},
		});
		expect(checkPreemptiveService(ship, { action: "survey" })).toBeNull();
	});

	it("works with transfer action as departure", () => {
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.8, experience: 20 },
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
					}),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "transfer", target: "Mars" });
		expect(result).toEqual({ action: "shore-leave" });
	});
});

// --- Commander learning ---

describe("commander learning", () => {
	it("learnFromMalfunction increases judgment with diminishing returns", () => {
		const ship = mockShip({ commander: { judgment: 0.3, experience: 0 } });
		learnFromMalfunction(ship);
		// 0.3 + 0.08 * (1 - 0.3) = 0.3 + 0.056 = 0.356
		expect(ship.commander.judgment).toBeCloseTo(0.356, 3);
	});

	it("learnFromMalfunction has diminishing returns at high judgment", () => {
		const ship = mockShip({ commander: { judgment: 0.85, experience: 0 } });
		learnFromMalfunction(ship);
		// 0.85 + 0.08 * (1 - 0.85) = 0.85 + 0.012 = 0.862
		expect(ship.commander.judgment).toBeCloseTo(0.862, 3);
	});

	it("learnFromMalfunction caps at 0.9", () => {
		const ship = mockShip({ commander: { judgment: 0.89, experience: 0 } });
		learnFromMalfunction(ship);
		// 0.89 + 0.08 * 0.11 = 0.89 + 0.0088 = 0.8988 → below cap
		learnFromMalfunction(ship);
		// Should approach but not exceed 0.9
		expect(ship.commander.judgment).toBeLessThanOrEqual(0.9);
	});

	it("learnFromEmergencyReturn increases judgment at lower rate", () => {
		const ship = mockShip({ commander: { judgment: 0.3, experience: 0 } });
		learnFromEmergencyReturn(ship);
		// 0.3 + 0.05 * (1 - 0.3) = 0.3 + 0.035 = 0.335
		expect(ship.commander.judgment).toBeCloseTo(0.335, 3);
	});

	it("learnFromEmergencyReturn caps at 0.9", () => {
		const ship = mockShip({ commander: { judgment: 0.9, experience: 0 } });
		learnFromEmergencyReturn(ship);
		expect(ship.commander.judgment).toBe(0.9);
	});

	it("incrementExperience bumps counter", () => {
		const ship = mockShip({ commander: { judgment: 0.3, experience: 5 } });
		incrementExperience(ship);
		expect(ship.commander.experience).toBe(6);
	});
});

// --- Commander defers maintenance (tested through commanderDecide) ---

describe("commander defers maintenance", () => {
	function mockUnsurveyed(name: string): BodyEntry {
		return {
			data: { name, type: "Dwarf Planet", distance: 2.77 },
			isMoon: false,
			survey: { surveyLevel: 0, deposits: [] },
		} as unknown as BodyEntry;
	}

	function mockSurveyed(name: string): BodyEntry {
		return {
			data: { name, type: "Planet", distance: 1.0 },
			isMoon: false,
			survey: { surveyLevel: 1, deposits: [] },
		} as unknown as BodyEntry;
	}

	beforeEach(() => {
		state.bodyMeshes = [];
	});

	it("does not defer at a colony (just do the maintenance)", () => {
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.9, experience: 10 },
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 25,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Earth")] as BodyEntry[];
		rebuildEntityMaps();
		const [colonyResult, colonyFound] = commanderDecide(ship);
		expect(colonyFound).toBe(true);
		expect(colonyResult).toEqual({ action: "overhaul" });
	});

	it("does not defer when host is already surveyed", () => {
		const ship = mockShip({
			hostPlanetName: "Mars",
			commander: { judgment: 0.9, experience: 10 },
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 25,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockSurveyed("Mars")] as BodyEntry[];
		rebuildEntityMaps();
		const [surveyedResult, surveyedFound] = commanderDecide(ship);
		expect(surveyedFound).toBe(true);
		expect(surveyedResult).toEqual({ action: "overhaul" });
	});

	it("does not defer when commander judgment is too low", () => {
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.15, experience: 0 },
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 25,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [lowJudgmentResult, lowJudgmentFound] = commanderDecide(ship);
		expect(lowJudgmentFound).toBe(true);
		expect(lowJudgmentResult).toEqual({ action: "overhaul" });
	});

	it("high judgment commander defers overhaul at unsurveyed body", () => {
		// Hull 25%, threshold 30%, judgment 0.8
		// personalFloor = 10 + (30 - 10) * (1 - 0.8) = 10 + 4 = 14
		// 25 > 14 → safe to defer → survey instead
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.8, experience: 20 },
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 25,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [deferResult, deferFound] = commanderDecide(ship);
		expect(deferFound).toBe(true);
		expect(deferResult).toEqual({ action: "survey" });
	});

	it("does not defer when hull is below commander's personal floor", () => {
		// Hull 12%, threshold 30%, judgment 0.5
		// personalFloor = 10 + (30 - 10) * (1 - 0.5) = 10 + 10 = 20
		// 12 < 20 → too risky → overhaul
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.5, experience: 10 },
			maintenance: {
				age: 200,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 12,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [floorResult, floorFound] = commanderDecide(ship);
		expect(floorFound).toBe(true);
		expect(floorResult).toEqual({ action: "overhaul" });
	});

	it("defers refuel when fuel is above personal floor", () => {
		// Fuel 15%, threshold 20%, judgment 0.9
		// personalFloor = 5 + (20 - 5) * (1 - 0.9) = 5 + 1.5 = 6.5
		// 15 > 6.5 → safe to defer → survey instead
		const ship = mockShip({
			hostPlanetName: "Ceres",
			fuelKg: 7500,
			fuelCapacityKg: 50000,
			commander: { judgment: 0.9, experience: 30 },
			commandTree: {
				entries: [
					mockEntry("fuel-check", "refuel", {
						condition: { type: "fuel-below", threshold: 20 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [deferFuelResult, deferFuelFound] = commanderDecide(ship);
		expect(deferFuelFound).toBe(true);
		expect(deferFuelResult).toEqual({ action: "survey" });
	});

	it("does not defer when below critical fuel threshold", () => {
		// Fuel 3%, threshold 20%, judgment 0.9
		// personalFloor = 5 + (20 - 5) * (1 - 0.9) = 6.5
		// 3 < 6.5 → too risky → refuel
		const ship = mockShip({
			hostPlanetName: "Ceres",
			fuelKg: 1500,
			fuelCapacityKg: 50000,
			commander: { judgment: 0.9, experience: 30 },
			commandTree: {
				entries: [
					mockEntry("fuel-check", "refuel", {
						condition: { type: "fuel-below", threshold: 20 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [criticalFuelResult, criticalFuelFound] = commanderDecide(ship);
		expect(criticalFuelFound).toBe(true);
		expect(criticalFuelResult).toEqual({ action: "refuel" });
	});
});

// --- commanderDecide ---

describe("commanderDecide", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
	});

	it("returns null when command tree is empty", () => {
		const ship = mockShip({ commandTree: { entries: [] } });
		const [, emptyFound] = commanderDecide(ship);
		expect(emptyFound).toBe(false);
	});

	it("returns command tree result when no judgment override applies", () => {
		const ship = mockShip({
			hostPlanetName: "Mars",
			commandTree: {
				entries: [mockEntry("survey", "survey-nearest")],
			},
		});
		const [treeResult, treeFound] = commanderDecide(ship);
		expect(treeFound).toBe(true);
		expect(treeResult).toEqual({ action: "survey" });
	});

	it("integrates preemptive service at colony", () => {
		// At colony, morale 50%, threshold 40%, judgment 0.8 → preemptive service fires
		const ship = mockShip({
			hostPlanetName: "Earth",
			commander: { judgment: 0.8, experience: 20 },
			crew: { count: 50, morale: 50, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 40 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const [preemptResult, preemptFound] = commanderDecide(ship);
		expect(preemptFound).toBe(true);
		expect(preemptResult).toEqual({ action: "shore-leave" });
	});

	it("integrates defer maintenance in the field", () => {
		const ceres = {
			data: { name: "Ceres", type: "Dwarf Planet", distance: 2.77 },
			isMoon: false,
			survey: { surveyLevel: 0, deposits: [] },
		} as unknown as BodyEntry;
		state.bodyMeshes = [ceres] as BodyEntry[];
		rebuildEntityMaps();

		// Hull 25%, threshold 30%, judgment 0.8 → defers overhaul to survey
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.8, experience: 20 },
			maintenance: {
				age: 100,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 25,
			},
			commandTree: {
				entries: [
					mockEntry("hull-check", "overhaul", {
						condition: { type: "hull-below", threshold: 30 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const [fieldResult, fieldFound] = commanderDecide(ship);
		expect(fieldFound).toBe(true);
		expect(fieldResult).toEqual({ action: "survey" });
	});
});

// --- checkPreemptiveService: return-to-base and idle command mappings ---

describe("checkPreemptiveService -- command mappings", () => {
	it("maps return-to-base command to { action: 'refuel' } when triggered", () => {
		// Fuel 25%, threshold 20%, judgment 0.9
		// effective = 20 + 80 * 0.9 * 0.3 = 41.6 → 25 < 41.6 → triggers
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 12500,
			fuelCapacityKg: 50000,
			commander: { judgment: 0.9, experience: 30 },
			commandTree: {
				entries: [
					mockEntry("fuel-check", "return-to-base", {
						condition: { type: "fuel-below", threshold: 20 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toEqual({ action: "refuel" });
	});

	it("maps idle command to { action: 'idle' } when triggered", () => {
		// Fuel 25%, threshold 20%, judgment 0.9 → triggers
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 12500,
			fuelCapacityKg: 50000,
			commander: { judgment: 0.9, experience: 30 },
			commandTree: {
				entries: [
					mockEntry("fuel-check", "idle", {
						condition: { type: "fuel-below", threshold: 20 },
					}),
					mockEntry("survey", "survey-nearest"),
				],
			},
		});
		const result = checkPreemptiveService(ship, { action: "survey" });
		expect(result).toEqual({ action: "idle" });
	});
});

// --- checkHoldForTanker ---

describe("checkHoldForTanker", () => {
	beforeEach(() => {
		state.shipIntents.clear();
		invalidateIntentsCache();
	});

	it("returns null when no tanker is targeting this ship", () => {
		const ship = mockShip({ data: { name: "ISS Explorer" } } as Partial<ShipEntry>);
		expect(checkHoldForTanker(ship, { action: "survey" })).toBeNull();
	});

	it("returns idle when a tanker is inbound and action is survey", () => {
		const ship = mockShip({ data: { name: "ISS Explorer" } } as Partial<ShipEntry>);
		state.shipIntents.set("ISS Sheetz", {
			type: "tanking",
			target: "ISS Explorer",
			shipName: "ISS Sheetz",
		});
		invalidateIntentsCache();
		expect(checkHoldForTanker(ship, { action: "survey" })).toEqual({ action: "idle" });
	});

	it("returns idle when a tanker is inbound and action is transfer", () => {
		const ship = mockShip({ data: { name: "ISS Explorer" } } as Partial<ShipEntry>);
		state.shipIntents.set("ISS Sheetz", {
			type: "tanking",
			target: "ISS Explorer",
			shipName: "ISS Sheetz",
		});
		invalidateIntentsCache();
		expect(checkHoldForTanker(ship, { action: "transfer", target: "Mars" })).toEqual({
			action: "idle",
		});
	});

	it("does not intercept maintenance actions even when tanker is inbound", () => {
		const ship = mockShip({ data: { name: "ISS Explorer" } } as Partial<ShipEntry>);
		state.shipIntents.set("ISS Sheetz", {
			type: "tanking",
			target: "ISS Explorer",
			shipName: "ISS Sheetz",
		});
		invalidateIntentsCache();
		expect(checkHoldForTanker(ship, { action: "refuel" })).toBeNull();
		expect(checkHoldForTanker(ship, { action: "overhaul" })).toBeNull();
		expect(checkHoldForTanker(ship, { action: "shore-leave" })).toBeNull();
		expect(checkHoldForTanker(ship, { action: "idle" })).toBeNull();
	});

	it("does not intercept when tanker is targeting a different ship", () => {
		const ship = mockShip({ data: { name: "ISS Explorer" } } as Partial<ShipEntry>);
		state.shipIntents.set("ISS Sheetz", {
			type: "tanking",
			target: "ISS Discovery",
			shipName: "ISS Sheetz",
		});
		invalidateIntentsCache();
		expect(checkHoldForTanker(ship, { action: "survey" })).toBeNull();
	});

	it("commanderDecide returns idle when tanker is inbound and tree says survey", () => {
		const ship = mockShip({
			data: { name: "ISS Explorer" },
			commandTree: {
				entries: [mockEntry("survey", "survey-nearest")],
			},
		} as Partial<ShipEntry>);
		state.shipIntents.set("ISS Sheetz", {
			type: "tanking",
			target: "ISS Explorer",
			shipName: "ISS Sheetz",
		});
		invalidateIntentsCache();
		const [result, found] = commanderDecide(ship);
		expect(found).toBe(true);
		expect(result).toEqual({ action: "idle" });
	});
});

// --- checkDeferMaintenance: morale-below case ---

describe("checkDeferMaintenance -- morale-below case", () => {
	function mockUnsurveyed(name: string): BodyEntry {
		return {
			data: { name, type: "Dwarf Planet", distance: 2.77 },
			isMoon: false,
			survey: { surveyLevel: 0, deposits: [] },
		} as unknown as BodyEntry;
	}

	beforeEach(() => {
		state.bodyMeshes = [];
	});

	it("defers shore-leave triggered by morale-below when morale is above personal floor", () => {
		// Morale 20, threshold 25, judgment 0.8
		// personalFloor = 5 + (25 - 5) * (1 - 0.8) = 5 + 4 = 9
		// 20 > 9 → safe to defer → survey instead
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.8, experience: 20 },
			crew: { count: 50, morale: 20, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 25 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [deferMoraleResult, deferMoraleFound] = commanderDecide(ship);
		expect(deferMoraleFound).toBe(true);
		expect(deferMoraleResult).toEqual({ action: "survey" });
	});

	it("does not defer shore-leave when morale is below commander's personal floor", () => {
		// Morale 3, threshold 25, judgment 0.8
		// personalFloor = 5 + (25 - 5) * (1 - 0.8) = 9
		// 3 < 9 → too risky → take shore-leave
		const ship = mockShip({
			hostPlanetName: "Ceres",
			commander: { judgment: 0.8, experience: 20 },
			crew: { count: 50, morale: 3, lastShoreLeave: 0, deploymentLimit: 180 },
			commandTree: {
				entries: [
					mockEntry("morale-check", "shore-leave", {
						condition: { type: "morale-below", threshold: 25 },
					}),
				],
			},
		});
		state.bodyMeshes = [mockUnsurveyed("Ceres")] as BodyEntry[];
		rebuildEntityMaps();
		const [lowMoraleResult, lowMoraleFound] = commanderDecide(ship);
		expect(lowMoraleFound).toBe(true);
		expect(lowMoraleResult).toEqual({ action: "shore-leave" });
	});
});

// --- tickShipSimulation malfunction learning ---

describe("tickShipSimulation -- malfunction learning", () => {
	it("commander learns from malfunction during transfer", () => {
		// Use same setup as the existing malfunction test: degraded hull, high age
		const ship = mockShip({
			shipState: "transferring" as const,
			maintenance: {
				age: 1440,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 1,
			},
			commander: { judgment: 0.3, experience: 0 },
		});
		const judgmentBefore = ship.commander.judgment;
		tickShipSimulation(ship, 91, 2000);
		// Malfunction fires with integrity=1 and high age → judgment should increase
		expect(ship.commander.judgment).toBeGreaterThan(judgmentBefore);
	});
});

// --- Hull ceiling ---

describe("hullCeiling", () => {
	it("returns 100 for a new ship", () => {
		expect(hullCeiling(0, 0)).toBe(100);
	});

	it("returns ~85 at 10 years since refit", () => {
		expect(hullCeiling(3650, 0)).toBe(85);
	});

	it("returns ~70 at 20 years since refit", () => {
		expect(hullCeiling(7300, 0)).toBe(70);
	});

	it("returns 100 for a 20-year ship just refitted", () => {
		expect(hullCeiling(7300, 7300)).toBe(100);
	});

	it("returns ~85 for a 30-year ship refitted at 20", () => {
		expect(hullCeiling(10950, 7300)).toBe(85);
	});

	it("never drops below 30", () => {
		expect(hullCeiling(100000, 0)).toBe(30);
	});
});

// --- Bathtub fail rate ---

describe("bathtubFailRate", () => {
	it("has elevated rate in infant mortality phase (day 0)", () => {
		const rate = bathtubFailRate(0, 100, 100, 0);
		expect(rate).toBeGreaterThan(0.015);
	});

	it("has lower rate at end of infant mortality (day 90)", () => {
		const rateStart = bathtubFailRate(0, 100, 100, 0);
		const rateEnd = bathtubFailRate(90, 100, 100, 0);
		expect(rateEnd).toBeLessThan(rateStart);
	});

	it("has constant low rate during useful life (1 year)", () => {
		const rate = bathtubFailRate(365, 100, 100, 0);
		expect(rate).toBeCloseTo(0.0085, 3); // ~1% base * 0.85 morale factor
	});

	it("has accelerating rate during wear-out (5 years)", () => {
		const rate2yr = bathtubFailRate(730, 100, 100, 0);
		const rate5yr = bathtubFailRate(1825, 100, 100, 0);
		expect(rate5yr).toBeGreaterThan(rate2yr * 2);
	});

	it("sqrt integrity multiplier prevents death spiral", () => {
		const rate100 = bathtubFailRate(365, 100, 100, 0);
		const rate25 = bathtubFailRate(365, 25, 100, 0);
		// At 25% hull, sqrt(100/25) = 2.0, so rate should be ~2x, not 4x
		expect(rate25 / rate100).toBeCloseTo(2, 0);
	});

	it("high morale reduces fail rate", () => {
		const rateLow = bathtubFailRate(365, 100, 30, 0);
		const rateHigh = bathtubFailRate(365, 100, 100, 0);
		expect(rateHigh).toBeLessThan(rateLow);
	});

	it("experience reduces fail rate up to 20%", () => {
		const rateNoExp = bathtubFailRate(365, 100, 50, 0);
		const rateMaxExp = bathtubFailRate(365, 100, 50, 40);
		expect(rateMaxExp).toBeCloseTo(rateNoExp * 0.8, 4);
	});

	it("experience caps at 20% reduction", () => {
		const rate40 = bathtubFailRate(365, 100, 50, 40);
		const rate100 = bathtubFailRate(365, 100, 50, 100);
		expect(rate40).toBe(rate100);
	});
});

// --- Routine maintenance ---

describe("tickRoutineMaintenance (via tickShipSimulation)", () => {
	it("slowly restores hull while idle and orbiting", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Mars",
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 90,
			},
		});
		tickShipSimulation(ship, 10, 100);
		// 0.05% * (100/100 morale) * 10 days = 0.5% recovery
		expect(ship.maintenance.hullIntegrity).toBeGreaterThan(90);
		expect(ship.maintenance.hullIntegrity).toBeLessThan(91);
	});

	it("does not restore hull during active action", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Mars",
			action: {
				type: "survey-nearest",
				commandId: null,
				startTime: 0,
				duration: 10,
				progress: 0,
			},
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 90,
			},
		});
		const hullBefore = ship.maintenance.hullIntegrity;
		tickShipSimulation(ship, 10, 100);
		expect(ship.maintenance.hullIntegrity).toBe(hullBefore);
	});

	it("caps routine repair at hull ceiling", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Mars",
			maintenance: {
				age: 0,
				totalAge: 7300, // 20 years → ceiling = 70
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 69,
			},
		});
		tickShipSimulation(ship, 100, 100);
		expect(ship.maintenance.hullIntegrity).toBeLessThanOrEqual(70);
	});
});

// --- totalAge always ticks ---

describe("totalAge tracking", () => {
	it("totalAge increments even at colony", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Earth",
			maintenance: {
				age: 0,
				totalAge: 100,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
		});
		tickShipSimulation(ship, 5, 100);
		expect(ship.maintenance.totalAge).toBe(105);
		// deployment age should NOT tick at colony
		expect(ship.maintenance.age).toBe(0);
	});

	it("both age and totalAge tick when deployed", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Mars",
			maintenance: {
				age: 50,
				totalAge: 200,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 100,
			},
		});
		tickShipSimulation(ship, 10, 100);
		expect(ship.maintenance.totalAge).toBe(210);
		expect(ship.maintenance.age).toBe(60);
	});
});

// --- Overhaul respects hull ceiling ---

describe("overhaul hull ceiling", () => {
	it("overhaul repair caps at ceiling, not 100%", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Earth",
			action: {
				type: "overhaul",
				commandId: null,
				startTime: 0,
				duration: 100,
				progress: 0,
			},
			maintenance: {
				age: 0,
				totalAge: 7300, // 20 years → ceiling = 70
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 50,
			},
		});
		// Simulate enough days for full repair
		tickShipSimulation(ship, 50, 100);
		expect(ship.maintenance.hullIntegrity).toBeLessThanOrEqual(70);
	});

	it("major-refit repair can reach 100%", () => {
		const ship = mockShip({
			shipState: "orbiting" as const,
			hostPlanetName: "Earth",
			action: {
				type: "major-refit",
				commandId: null,
				startTime: 0,
				duration: 200,
				progress: 0,
			},
			maintenance: {
				age: 0,
				totalAge: 7300,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
				hullIntegrity: 50,
			},
		});
		tickShipSimulation(ship, 50, 100);
		// Should restore toward 100, not be capped at 70
		expect(ship.maintenance.hullIntegrity).toBeGreaterThan(70);
	});
});

// --- deliverColonyShuttle ---
// Tested indirectly via tickShipSimulation: crossing exactly 1 integer day boundary
// triggers one shuttle delivery. simTime=5.1, simDt=0.2 → floor(5.1)=5, floor(4.9)=4 → 1 shuttle.

function makeColony(bodyName: string, overrides: Partial<ColonyState> = {}): ColonyState {
	return {
		bodyName,
		name: `${bodyName} Colony`,
		population: 1_000_000,
		habitability: 1,
		installations: {
			constructionFactory: 0,
			repairYard: 1,
			fuelDepot: 1,
			mine: 0,
			lab: 0,
			academy: 0,
			storage: 0,
			shipyard: 0,
		},
		stockpile: { fuelKg: 2_000_000, supplies: 100_000, resources: {} },
		researchPoints: 0,
		constructionProjects: [],
		currentResearch: null,
		researchQueue: [],
		...overrides,
	} as unknown as ColonyState;
}

describe("deliverColonyShuttle (via tickShipSimulation)", () => {
	const SIM_TIME = 5.1; // floor=5
	const SIM_DT = 0.2; // floor(5.1-0.2)=floor(4.9)=4 → crosses 1 day

	beforeEach(() => {
		state.colonies.clear();
		state.bodyMeshes = [];
		rebuildEntityMaps();
	});

	it("delivers only the fuel deficit, not 25% of capacity", () => {
		// Ship at 80% fuel needs 10 000 kg. Old bug: always requested 12 500 (25% capacity).
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 50_000, supplies: 100_000, resources: {} },
			}),
		);
		const ship = mockShip({ hostPlanetName: "Earth", fuelKg: 40_000, fuelCapacityKg: 50_000 });
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		expect(ship.fuelKg).toBe(50_000); // topped up to full
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		expect(colony.stockpile.fuelKg).toBe(40_000); // lost 10 000, not 12 500
	});

	it("caps shuttle at 25% capacity when deficit exceeds one load", () => {
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 100_000, supplies: 100_000, resources: {} },
			}),
		);
		const ship = mockShip({ hostPlanetName: "Earth", fuelKg: 0, fuelCapacityKg: 50_000 });
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		// Deficit is 50 000, but shuttle cap is 25% = 12 500
		expect(ship.fuelKg).toBe(12_500);
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		expect(colony.stockpile.fuelKg).toBe(87_500);
	});

	it("does not deliver fuel when ship is already full", () => {
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 50_000, supplies: 100_000, resources: {} },
			}),
		);
		const ship = mockShip({ hostPlanetName: "Earth", fuelKg: 50_000, fuelCapacityKg: 50_000 });
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		expect(colony.stockpile.fuelKg).toBe(50_000); // colony unchanged
	});

	it("clamps delivery to available colony stockpile", () => {
		// Colony only has 3 000 kg; ship needs 10 000
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 3_000, supplies: 100_000, resources: {} },
			}),
		);
		const ship = mockShip({ hostPlanetName: "Earth", fuelKg: 40_000, fuelCapacityKg: 50_000 });
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		expect(ship.fuelKg).toBe(43_000); // only 3 000 available
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		expect(colony.stockpile.fuelKg).toBe(0);
	});

	it("skips fuel shuttle when action type is refuel", () => {
		// The refuel action uses a separate continuous delivery path (tickActionRecovery).
		// The shuttle must not also fire — that would double-charge the colony.
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 50_000, supplies: 100_000, resources: {} },
			}),
		);
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 40_000,
			fuelCapacityKg: 50_000,
			action: { type: "refuel", commandId: null, startTime: 0, duration: 5, progress: 0 },
		});
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		// tickActionRecovery draws ~1 500 kg (refuelRate * capacity * simDt). Shuttle (10 000) must NOT fire.
		expect(colony.stockpile.fuelKg).toBeGreaterThan(40_000);
	});

	it("skips supply shuttle during overhaul", () => {
		state.colonies.set(
			"Earth",
			makeColony("Earth", {
				stockpile: { fuelKg: 50_000, supplies: 50_000, resources: {} },
			}),
		);
		const ship = mockShip({
			hostPlanetName: "Earth",
			fuelKg: 50_000, // full — no fuel shuttle fires either
			fuelCapacityKg: 50_000,
			action: { type: "overhaul", commandId: null, startTime: 0, duration: 30, progress: 0 },
			maintenance: {
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 50,
				maxSupplies: 100,
				hullIntegrity: 80,
			},
		});
		tickShipSimulation(ship, SIM_DT, SIM_TIME);

		const [colony] = getColony("Earth");
		if (!colony) throw new Error("expected colony");
		// Shuttle would have taken up to 25 supplies. Only tickActionRecovery (~0.375) should fire.
		expect(colony.stockpile.supplies).toBeGreaterThan(50_000 - 25);
	});
});
