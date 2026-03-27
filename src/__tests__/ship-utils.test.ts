import { beforeEach, describe, expect, it } from "vitest";
import { resolveShipPhysics } from "../core/ship-utils";
import { state } from "../core/state";
import type { ShipEntry } from "../types";

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		data: { name: "Test", type: "Ship" },
		engineId: "conventional",
		fuelKg: 10_000,
		dryMassKg: 5_000,
		...overrides,
	} as unknown as ShipEntry;
}

beforeEach(() => {
	state.shipDesigns.clear();
});

describe("resolveShipPhysics", () => {
	it("uses legacy engineId fallback when no designId", () => {
		const physics = resolveShipPhysics(mockShip());
		expect(physics.accelG).toBeGreaterThan(0);
		expect(physics.ispS).toBeGreaterThan(0);
	});

	it("uses design accelG/ispS when designId resolves", () => {
		state.shipDesigns.set("design-1", {
			id: "design-1",
			name: "Test Design",
			engineDesignId: "eng-1",
			engineCount: 1,
			components: [],
			dryMassKg: 5_000,
			fuelCapacityKg: 50_000,
			cargoCapacityKg: 0,
			crewCapacity: 25,
			maxSupplies: 100,
			sensorMultiplier: 1.0,
			accelG: 0.5,
			ispS: 2_000_000,
			armorHp: 0,
		});
		const physics = resolveShipPhysics(mockShip({ designId: "design-1" }));
		expect(physics.accelG).toBe(0.5);
		expect(physics.ispS).toBe(2_000_000);
	});

	it("falls back to engineId when designId is present but design not found", () => {
		const physics = resolveShipPhysics(mockShip({ designId: "missing-design" }));
		expect(physics.accelG).toBeGreaterThan(0);
	});
});
