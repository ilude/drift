/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { BodyEntry, PlanetEntry } from "../types";

// Mock scene.js to avoid DOM/Three.js side effects at import time
vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
}));

import { state } from "../core/state";
import { createShip, initiateTransfer, orbitToWorld } from "../rendering/rendering";

describe("orbitToWorld", () => {
	const PI = Math.PI;

	it("passes through with zero angles (identity)", () => {
		const w = orbitToWorld(10, 5, 0, 0, 0);
		expect(w.x).toBeCloseTo(10);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(5);
	});

	it("90° inclination maps z to y", () => {
		const w = orbitToWorld(0, 5, PI / 2, 0, 0);
		expect(w.x).toBeCloseTo(0);
		expect(w.y).toBeCloseTo(5);
		expect(w.z).toBeCloseTo(0, 5);
	});

	it("180° node rotation negates x and z", () => {
		const w = orbitToWorld(10, 5, 0, PI, 0);
		expect(w.x).toBeCloseTo(-10);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(-5);
	});

	it("90° perihelion argument rotates in orbital plane", () => {
		const w = orbitToWorld(10, 0, 0, 0, PI / 2);
		expect(w.x).toBeCloseTo(0, 5);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(10);
	});

	it("returns the same object reference (reused scratch)", () => {
		const w1 = orbitToWorld(1, 2, 0, 0, 0);
		const ref = w1;
		const w2 = orbitToWorld(3, 4, 0, 0, 0);
		expect(w2).toBe(ref);
	});

	it("combined angles produce expected transformation", () => {
		const inc = PI / 4;
		const w = orbitToWorld(0, 10, inc, 0, 0);
		const expectedY = 10 * Math.sin(inc);
		const expectedZ = 10 * Math.cos(inc);
		expect(w.x).toBeCloseTo(0);
		expect(w.y).toBeCloseTo(expectedY);
		expect(w.z).toBeCloseTo(expectedZ);
	});
});

describe("createShip", () => {
	it("returns ship entry with physics properties", () => {
		state.BODIES = [
			{
				name: "Sun",
				type: "Star" as const,
				distance: 0,
				e: 0,
				period: 0,
				radius: 696340,
				color: "#ffdd44",
				moons: [],
			},
			{
				name: "Earth",
				type: "Planet" as const,
				distance: 1.0,
				e: 0.017,
				period: 1.0,
				radius: 6371,
				color: "#4488ff",
				moons: [],
			},
		];
		state.bodyMeshes = [];

		const entry = createShip();
		expect(entry).toBeDefined();
		expect(entry.isShip).toBe(true);
		expect(entry).toHaveProperty("dryMassKg");
		expect(entry).toHaveProperty("fuelKg");
		expect(entry).toHaveProperty("fuelCapacityKg");
		expect(entry).toHaveProperty("engineId");
		expect(entry.dryMassKg).toBeGreaterThan(0);
		expect(entry.fuelKg).toBeGreaterThan(0);
		expect(entry.fuelCapacityKg).toBeGreaterThan(0);
		expect(typeof entry.engineId).toBe("string");
	});
});

describe("initiateTransfer", () => {
	function setupSystem() {
		state.BODIES = [
			{
				name: "Sun",
				type: "Star" as const,
				distance: 0,
				e: 0,
				period: 0,
				radius: 696340,
				color: "#ffdd44",
				moons: [],
			},
			{
				name: "Earth",
				type: "Planet" as const,
				distance: 1.0,
				e: 0.017,
				period: 1.0,
				radius: 6371,
				color: "#4488ff",
				moons: [],
			},
			{
				name: "Mars",
				type: "Planet" as const,
				distance: 1.524,
				e: 0.093,
				period: 1.881,
				radius: 3390,
				color: "#ff6644",
				moons: [],
			},
		];
		state.bodyMeshes = [];
		state.simTime = 0;

		state.BODIES?.forEach((b) => {
			if (b.type !== "Star") {
				state.bodyMeshes.push({
					data: b,
					mesh: { position: { x: 100 * b.distance, y: 0, z: 0, set: vi.fn() } },
					isShip: false,
					isMoon: false,
					isComet: false,
					speed: 0.01,
					angle: 0,
				} as unknown as BodyEntry);
			}
		});

		const ship = createShip();
		if (!ship) throw new Error("createShip returned undefined");
		return ship;
	}

	it("deducts fuel on successful transfer", () => {
		const ship = setupSystem();
		const fuelBefore = ship.fuelKg;
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		expect(ship.fuelKg).toBeLessThan(fuelBefore);
	});

	it("rejects transfer when fuel is insufficient", () => {
		const ship = setupSystem();
		ship.fuelKg = 1; // near-zero fuel
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		expect(ship.shipState).toBe("orbiting");
	});

	it("uses brachistochrone transfer time (~2 days for Earth-Mars at 1g)", () => {
		const ship = setupSystem();
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		// Brachistochrone at 1g: ~2 days Earth->Mars
		expect(ship.pendingTransfer?.gameDays).toBeLessThan(5);
		expect(ship.pendingTransfer?.gameDays).toBeGreaterThan(1);
	});
});
