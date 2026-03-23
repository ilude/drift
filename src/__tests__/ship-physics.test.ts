import { describe, expect, it } from "vitest";
import {
	AU_TO_KM,
	brachistochroneDeltaV,
	brachistochroneTime,
	checkTransfer,
	ENGINE_TYPES,
	exhaustVelocity,
	fuelRequired,
	G_ACCEL,
	hohmannDeltaV,
	hohmannTransferDays,
	muKmS,
	rocketDeltaV,
} from "../math/ship-physics";

// --- Cycle 1: Constants and conversions ---

describe("constants", () => {
	it("AU_TO_KM is 149,597,870.7", () => {
		expect(AU_TO_KM).toBe(149_597_870.7);
	});

	it("G_ACCEL is standard gravity", () => {
		expect(G_ACCEL).toBeCloseTo(9.80665, 4);
	});
});

describe("muKmS", () => {
	it("returns Sun gravitational parameter for 1 solar mass", () => {
		const mu = muKmS(1.0);
		expect(mu / 1e11).toBeCloseTo(1.327, 2);
	});

	it("scales linearly with mass", () => {
		expect(muKmS(2.0)).toBeCloseTo(muKmS(1.0) * 2, -5);
	});
});

describe("exhaustVelocity", () => {
	it("chemical engine Isp 320s gives ~3139 m/s", () => {
		const ve = exhaustVelocity(320);
		expect(ve).toBeCloseTo(3138.1, 0);
	});

	it("ion engine Isp 3000s gives ~29420 m/s", () => {
		const ve = exhaustVelocity(3000);
		expect(ve).toBeCloseTo(29420, -1);
	});
});

// --- Cycle 2: Tsiolkovsky rocket equation ---

describe("rocketDeltaV", () => {
	it("mass ratio 3 with ve=3.138 km/s gives ~3.45 km/s", () => {
		const dv = rocketDeltaV(3.138, 30000, 10000);
		expect(dv).toBeCloseTo(3.45, 1);
	});

	it("returns 0 when wet <= dry", () => {
		expect(rocketDeltaV(3.138, 10000, 10000)).toBe(0);
		expect(rocketDeltaV(3.138, 5000, 10000)).toBe(0);
	});

	it("returns 0 when dry mass is zero", () => {
		expect(rocketDeltaV(3.138, 10000, 0)).toBe(0);
	});
});

describe("fuelRequired", () => {
	it("inverse of rocketDeltaV: mass ratio 3 case", () => {
		const fuel = fuelRequired(3.138, 10000, 3.45);
		expect(fuel).toBeCloseTo(20000, -2);
	});

	it("returns 0 for zero delta-v", () => {
		expect(fuelRequired(3.138, 10000, 0)).toBe(0);
	});

	it("round-trip consistency with rocketDeltaV", () => {
		const ve = 3.138;
		const wet = 50000;
		const dry = 15000;
		const dv = rocketDeltaV(ve, wet, dry);
		const fuelCalc = fuelRequired(ve, dry, dv);
		expect(fuelCalc).toBeCloseTo(wet - dry, 0);
	});
});

// --- Cycle 3: Hohmann transfer math (retained for reference) ---

describe("hohmannDeltaV", () => {
	it("Earth to Mars (~5.59 km/s total)", () => {
		const result = hohmannDeltaV(1.0, 1.524, 1.0);
		expect(result.dvTotal).toBeCloseTo(5.59, 1);
	});

	it("Earth to Jupiter departure burn ~8.79 km/s, total ~14.4 km/s", () => {
		const result = hohmannDeltaV(1.0, 5.203, 1.0);
		expect(result.dvDepart).toBeCloseTo(8.79, 0);
		expect(result.dvTotal).toBeCloseTo(14.4, 0);
	});

	it("symmetry: dvTotal is same regardless of direction", () => {
		const outbound = hohmannDeltaV(1.0, 1.524, 1.0);
		const inbound = hohmannDeltaV(1.524, 1.0, 1.0);
		expect(outbound.dvTotal).toBeCloseTo(inbound.dvTotal, 6);
	});

	it("has departure and arrival components", () => {
		const result = hohmannDeltaV(1.0, 1.524, 1.0);
		expect(result.dvDepart).toBeGreaterThan(0);
		expect(result.dvArrive).toBeGreaterThan(0);
		expect(result.dvDepart + result.dvArrive).toBeCloseTo(result.dvTotal, 10);
	});
});

describe("hohmannTransferDays", () => {
	it("Earth to Mars ~259 days", () => {
		const days = hohmannTransferDays(1.0, 1.524, 1.0);
		expect(days).toBeCloseTo(259, -1);
	});

	it("Earth to Jupiter ~997 days", () => {
		const days = hohmannTransferDays(1.0, 5.203, 1.0);
		expect(days).toBeCloseTo(997, -1);
	});

	it("symmetry: same time regardless of direction", () => {
		const outbound = hohmannTransferDays(1.0, 1.524, 1.0);
		const inbound = hohmannTransferDays(1.524, 1.0, 1.0);
		expect(outbound).toBeCloseTo(inbound, 6);
	});
});

// --- Brachistochrone transfer math ---

describe("brachistochroneTime", () => {
	it("Earth to Mars at 20g ≈ 0.42 days", () => {
		const accelMS2 = 20 * G_ACCEL; // 196.133 m/s²
		const days = brachistochroneTime(1.0, 1.524, accelMS2);
		expect(days).toBeCloseTo(0.42, 1);
	});

	it("symmetry: same time regardless of direction", () => {
		const accel = 20 * G_ACCEL;
		const outbound = brachistochroneTime(1.0, 1.524, accel);
		const inbound = brachistochroneTime(1.524, 1.0, accel);
		expect(outbound).toBeCloseTo(inbound, 10);
	});

	it("higher accel = shorter time", () => {
		const t20g = brachistochroneTime(1.0, 1.524, 20 * G_ACCEL);
		const t200g = brachistochroneTime(1.0, 1.524, 200 * G_ACCEL);
		expect(t200g).toBeLessThan(t20g);
	});

	it("Earth to Neptune at 20g under 5 days", () => {
		const days = brachistochroneTime(1.0, 30.07, 20 * G_ACCEL);
		expect(days).toBeLessThan(5);
		expect(days).toBeGreaterThan(1);
	});
});

describe("brachistochroneDeltaV", () => {
	it("Earth to Mars at 20g ≈ 7840 km/s", () => {
		const accelMS2 = 20 * G_ACCEL;
		const dv = brachistochroneDeltaV(1.0, 1.524, accelMS2);
		expect(dv).toBeCloseTo(7840, -2);
	});

	it("symmetry: same dv regardless of direction", () => {
		const accel = 20 * G_ACCEL;
		const outbound = brachistochroneDeltaV(1.0, 1.524, accel);
		const inbound = brachistochroneDeltaV(1.524, 1.0, accel);
		expect(outbound).toBeCloseTo(inbound, 10);
	});

	it("higher accel = higher delta-v", () => {
		const dv20g = brachistochroneDeltaV(1.0, 1.524, 20 * G_ACCEL);
		const dv200g = brachistochroneDeltaV(1.0, 1.524, 200 * G_ACCEL);
		expect(dv200g).toBeGreaterThan(dv20g);
	});
});

// --- TN Engine presets ---

describe("ENGINE_TYPES", () => {
	it("has conventional, improved, advanced, extreme entries", () => {
		const ids = ENGINE_TYPES.map((e) => e.id);
		expect(ids).toContain("conventional");
		expect(ids).toContain("improved");
		expect(ids).toContain("advanced");
		expect(ids).toContain("extreme");
	});

	it("each engine has required fields", () => {
		ENGINE_TYPES.forEach((engine) => {
			expect(engine).toHaveProperty("id");
			expect(engine).toHaveProperty("name");
			expect(engine).toHaveProperty("accelG");
			expect(engine).toHaveProperty("ispS");
			expect(engine).toHaveProperty("dryMassKg");
		});
	});

	it("accelG values are 1, 10, 50, 200", () => {
		const accels = ENGINE_TYPES.map((e) => e.accelG);
		expect(accels).toEqual([1, 10, 50, 200]);
	});
});

// --- Transfer feasibility with brachistochrone ---

describe("checkTransfer", () => {
	it("Earth to Mars with conventional TN (1g): feasible, under 5 days", () => {
		const ship = {
			fuelKg: 500_000,
			dryMassKg: 5_000,
			engineId: "conventional",
		};
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		expect(result.feasible).toBe(true);
		expect(result.transferDays).toBeLessThan(5);
		expect(result.deltaVRequired).toBeCloseTo(1755, -2);
	});

	it("Earth to Neptune with extreme TN: feasible, under 5 days", () => {
		const ship = { fuelKg: 500_000, dryMassKg: 5_000, engineId: "extreme" };
		const result = checkTransfer(1.0, 30.07, 1.0, ship);
		expect(result.feasible).toBe(true);
		expect(result.transferDays).toBeLessThan(5);
	});

	it("infeasible with near-zero fuel", () => {
		const ship = { fuelKg: 1, dryMassKg: 5_000, engineId: "conventional" };
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		expect(result.feasible).toBe(false);
	});

	it("fuel consumed matches fuelRequired for same delta-v", () => {
		const ship = {
			fuelKg: 500_000,
			dryMassKg: 5_000,
			engineId: "conventional",
		};
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		const engine = ENGINE_TYPES.find((e) => e.id === "conventional");
		expect(engine).toBeDefined();
		const veKmS =
			exhaustVelocity((engine as NonNullable<typeof engine>).ispS) / 1000;
		const expectedFuel = fuelRequired(
			veKmS,
			ship.dryMassKg,
			result.deltaVRequired ?? 0,
		);
		expect(result.fuelUsedKg).toBeCloseTo(expectedFuel, 6);
	});

	it("infeasible with unknown engine", () => {
		const ship = { fuelKg: 500_000, dryMassKg: 5_000, engineId: "warp" };
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		expect(result.feasible).toBe(false);
	});

	it("TN engines have low fuel fraction (high Isp)", () => {
		const ship = { fuelKg: 500_000, dryMassKg: 5_000, engineId: "extreme" };
		const result = checkTransfer(1.0, 30.07, 1.0, ship);
		expect(result.feasible).toBe(true);
		// High Isp means fuel usage is a small fraction of total
		expect(result.fuelUsedKg).toBeLessThan(ship.fuelKg * 0.5);
	});
});
