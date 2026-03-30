/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
	ZOOM_BASE: 300,
}));

import { rebuildEntityMaps } from "../core/entities";
import { invalidateIntentsCache, publishIntent } from "../core/intents";
import { state } from "../core/state";
import { advanceSurveyPlan, clearSurveyPlan, computeSurveyPlan } from "../core/survey-planner";
import type { BodyEntry, ShipEntry } from "../types";

function mockBody(name: string, x: number, z: number, surveyed = false): BodyEntry {
	return {
		data: { name, type: "Planet", distance: 1, color: "#fff", radius: 1000 },
		mesh: { position: { x, y: 0, z } },
		survey: { surveyLevel: surveyed ? 1 : 0, surveyDuration: 10, surveyProgress: 0 },
		isMoon: false,
		isShip: false,
		isComet: false,
		speed: 0,
		moons: [],
	} as unknown as BodyEntry;
}

function mockShip(name: string, x: number, z: number, overrides?: Partial<ShipEntry>): ShipEntry {
	return {
		data: { name, type: "Ship", color: "#f00" },
		mesh: { position: { x, y: 0, z } },
		isShip: true,
		isMoon: false,
		isComet: false,
		shipState: "orbiting",
		hostPlanetName: "Earth",
		fuelKg: 50_000,
		fuelCapacityKg: 50_000,
		dryMassKg: 5_000,
		engineId: "conventional",
		designId: null,
		crew: { count: 10, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		commander: { caution: 0.5, initiative: 0.5, experience: 0 },
		maintenance: {
			age: 0,
			totalAge: 0,
			lastRefitAge: 0,
			supplies: 100,
			maxSupplies: 100,
			hullIntegrity: 100,
			overhaulsSinceRefit: 0,
			overhaulsUntilRefit: 3,
		},
		commandTree: {
			entries: [
				{
					id: "fuel",
					command: "refuel" as const,
					condition: { type: "fuel-below" as const, threshold: 20 },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "morale",
					command: "shore-leave" as const,
					condition: { type: "morale-below" as const, threshold: 30 },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "survey",
					command: "survey-nearest" as const,
					condition: { type: "always" as const, threshold: 0 },
					enabled: true,
					origin: "ship" as const,
				},
			],
		},
		surveyPlan: null,
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		survey: { surveyLevel: 0, surveyDuration: 0, surveyProgress: 0 },
		...overrides,
	} as unknown as ShipEntry;
}

function setupSystem(bodies: BodyEntry[], ships: ShipEntry[]): void {
	state.bodyMeshes = [...bodies, ...ships] as BodyEntry[];
	state.asteroidBelts = [];
	state.shipIntents = new Map();
	state.simTime = { days: 100 };
	state.fuelBurnMultiplier = 1;
	state.surveyMultiplier = 0.1;
	state.colonies = new Map();
	state.engineDesigns = new Map();
	state.shipDesigns = new Map();
	rebuildEntityMaps();
	invalidateIntentsCache();
}

describe("computeSurveyPlan", () => {
	beforeEach(() => {
		state.colonies = new Map();
		state.colonies.set("Earth", {
			bodyName: "Earth",
		} as never);
	});

	it("returns null when commander judgment is too low", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const target1 = mockBody("Mars", 248, 0);
		const target2 = mockBody("Jupiter", 454, 0);
		const ship = mockShip("Explorer", 200, 0, {
			commander: { caution: 0.1, initiative: 0.1, experience: 0 },
		});
		setupSystem([earth, target1, target2], [ship]);

		const plan = computeSurveyPlan(ship);
		expect(plan).toBeNull();
	});

	it("returns null when fewer than 2 candidates", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const target1 = mockBody("Mars", 248, 0);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, target1], [ship]);

		const plan = computeSurveyPlan(ship);
		expect(plan).toBeNull();
	});

	it("produces a plan with multiple targets when candidates exist", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const t1 = mockBody("Target-A", 210, 0);
		const t2 = mockBody("Target-B", 220, 0);
		const t3 = mockBody("Target-C", 230, 0);
		const ship = mockShip("Explorer", 200, 0, { fuelKg: 50_000 });
		setupSystem([earth, t1, t2, t3], [ship]);

		const plan = computeSurveyPlan(ship);
		expect(plan).not.toBeNull();
		if (!plan) return;
		expect(plan.targets.length).toBeGreaterThanOrEqual(2);
		expect(plan.accelG).toBeGreaterThan(0);
	});

	it("orders targets by nearest-neighbor from ship position", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const far = mockBody("Far", 400, 0);
		const near = mockBody("Near", 210, 0);
		const mid = mockBody("Mid", 250, 0);
		const ship = mockShip("Explorer", 200, 0, { fuelKg: 50_000 });
		setupSystem([earth, far, near, mid], [ship]);

		const plan = computeSurveyPlan(ship);
		if (!plan) throw new Error("expected plan");
		// Nearest-neighbor: Near should come before Mid, Mid before Far
		const nearIdx = plan.targets.indexOf("Near");
		const midIdx = plan.targets.indexOf("Mid");
		if (nearIdx >= 0 && midIdx >= 0) {
			expect(nearIdx).toBeLessThan(midIdx);
		}
	});

	it("publishes survey-plan intent claiming all targets", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const t1 = mockBody("A", 210, 0);
		const t2 = mockBody("B", 220, 0);
		const t3 = mockBody("C", 230, 0);
		const ship = mockShip("Explorer", 200, 0, { fuelKg: 50_000 });
		setupSystem([earth, t1, t2, t3], [ship]);

		computeSurveyPlan(ship);
		const intent = state.shipIntents.get("Explorer");
		expect(intent).toBeDefined();
		expect(intent?.type).toBe("survey-plan");
		if (intent?.type === "survey-plan") {
			expect(intent.targets.length).toBeGreaterThanOrEqual(2);
		}
	});
});

describe("advanceSurveyPlan", () => {
	it("returns null when ship has no plan", () => {
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([], [ship]);
		expect(advanceSurveyPlan(ship)).toBeNull();
	});

	it("returns next target from plan", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const t1 = mockBody("Alpha", 210, 0);
		const t2 = mockBody("Beta", 220, 0);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, t1, t2], [ship]);
		ship.surveyPlan = { targets: ["Alpha", "Beta"], accelG: 0.1 };
		publishIntent("Explorer", {
			type: "survey-plan",
			targets: ["Alpha", "Beta"],
			shipName: "Explorer",
		});

		const target = advanceSurveyPlan(ship);
		expect(target).toBe("Alpha");
		expect(ship.surveyPlan?.targets).toEqual(["Beta"]);
	});

	it("skips already-surveyed targets", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const surveyed = mockBody("Done", 210, 0, true);
		const unsurveyed = mockBody("Todo", 220, 0);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, surveyed, unsurveyed], [ship]);
		ship.surveyPlan = { targets: ["Done", "Todo"], accelG: 0.1 };

		const target = advanceSurveyPlan(ship);
		expect(target).toBe("Todo");
	});

	it("clears plan and returns null when all targets consumed", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const surveyed = mockBody("Done", 210, 0, true);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, surveyed], [ship]);
		ship.surveyPlan = { targets: ["Done"], accelG: 0.1 };

		const target = advanceSurveyPlan(ship);
		expect(target).toBeNull();
		expect(ship.surveyPlan).toBeNull();
	});

	it("skips targets claimed by other ships", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const claimed = mockBody("Taken", 210, 0);
		const free = mockBody("Free", 220, 0);
		const ship = mockShip("Explorer", 200, 0);
		const other = mockShip("Other", 210, 0);
		setupSystem([earth, claimed, free], [ship, other]);
		ship.surveyPlan = { targets: ["Taken", "Free"], accelG: 0.1 };
		publishIntent("Other", { type: "surveying", target: "Taken", shipName: "Other" });

		const target = advanceSurveyPlan(ship);
		expect(target).toBe("Free");
	});
});

describe("progressive intent claiming", () => {
	beforeEach(() => {
		state.colonies = new Map();
		state.colonies.set("Earth", { bodyName: "Earth" } as never);
	});

	it("computeSurveyPlan claims at most 3 targets in intent", () => {
		const earth = mockBody("Earth", 200, 0, true);
		// Create enough nearby targets to get a plan with 4+ targets
		const bodies = [earth];
		for (let i = 0; i < 8; i++) {
			bodies.push(mockBody(`T${i}`, 205 + i * 5, 0));
		}
		const ship = mockShip("Explorer", 200, 0, { fuelKg: 50_000 });
		setupSystem(bodies, [ship]);

		const plan = computeSurveyPlan(ship);
		if (!plan) throw new Error("expected plan");
		expect(plan.targets.length).toBeGreaterThan(3);

		const intent = state.shipIntents.get("Explorer");
		expect(intent).toBeDefined();
		if (intent?.type === "survey-plan") {
			expect(intent.targets.length).toBeLessThanOrEqual(3);
		}
	});

	it("advanceSurveyPlan shifts claim window", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const t1 = mockBody("A", 210, 0);
		const t2 = mockBody("B", 215, 0);
		const t3 = mockBody("C", 220, 0);
		const t4 = mockBody("D", 225, 0);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, t1, t2, t3, t4], [ship]);
		ship.surveyPlan = { targets: ["A", "B", "C", "D"], accelG: 0.1 };
		publishIntent("Explorer", {
			type: "survey-plan",
			targets: ["A", "B", "C"],
			shipName: "Explorer",
		});

		advanceSurveyPlan(ship);
		const intent = state.shipIntents.get("Explorer");
		if (intent?.type === "survey-plan") {
			expect(intent.targets).toEqual(["B", "C", "D"]);
		}
	});
});

describe("survey plan re-planning", () => {
	beforeEach(() => {
		state.colonies = new Map();
		state.colonies.set("Earth", { bodyName: "Earth" } as never);
	});

	it("recomputes plan when all targets consumed but unsurveyed bodies remain", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const done1 = mockBody("Done1", 210, 0, true);
		const done2 = mockBody("Done2", 215, 0, true);
		const fresh1 = mockBody("Fresh1", 220, 0);
		const fresh2 = mockBody("Fresh2", 225, 0);
		const fresh3 = mockBody("Fresh3", 230, 0);
		const ship = mockShip("Explorer", 200, 0, { fuelKg: 50_000 });
		setupSystem([earth, done1, done2, fresh1, fresh2, fresh3], [ship]);
		ship.surveyPlan = { targets: ["Done1", "Done2"], accelG: 0.1 };

		const target = advanceSurveyPlan(ship);
		// Old plan's targets are all surveyed, but new targets exist
		// Should recompute and return a fresh target
		expect(target).not.toBeNull();
		expect(ship.surveyPlan).not.toBeNull();
		if (ship.surveyPlan) {
			expect(ship.surveyPlan.targets.length).toBeGreaterThan(0);
		}
	});
});

describe("clearSurveyPlan", () => {
	it("sets surveyPlan to null", () => {
		const ship = mockShip("Explorer", 200, 0);
		ship.surveyPlan = { targets: ["A", "B"], accelG: 0.1 };
		clearSurveyPlan(ship);
		expect(ship.surveyPlan).toBeNull();
	});

	it("is a no-op when plan is already null", () => {
		const ship = mockShip("Explorer", 200, 0);
		ship.surveyPlan = null;
		clearSurveyPlan(ship);
		expect(ship.surveyPlan).toBeNull();
	});

	it("removes intent from pool when plan is cleared", () => {
		const earth = mockBody("Earth", 200, 0, true);
		const t1 = mockBody("X", 210, 0);
		const t2 = mockBody("Y", 220, 0);
		const ship = mockShip("Explorer", 200, 0);
		setupSystem([earth, t1, t2], [ship]);
		ship.surveyPlan = { targets: ["X", "Y"], accelG: 0.1 };
		publishIntent("Explorer", { type: "survey-plan", targets: ["X", "Y"], shipName: "Explorer" });

		clearSurveyPlan(ship);
		expect(ship.surveyPlan).toBeNull();
		expect(state.shipIntents.get("Explorer")).toBeUndefined();
	});
});
