import { describe, expect, it } from "vitest";
import {
	AU_TO_KM,
	brachistochroneDeltaV,
	brachistochroneTime,
	checkTransfer,
	computeTotalFuelCost,
	ENGINE_TYPES,
	exhaustVelocity,
	findAffordableAccelG,
	fuelRequired,
	G_ACCEL,
	hohmannDeltaV,
	hohmannTransferDays,
	muKmS,
	OP_BURN_RATE,
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

	it("accelG values are 0.1, 10, 50, 200", () => {
		const accels = ENGINE_TYPES.map((e) => e.accelG);
		expect(accels).toEqual([0.1, 10, 50, 200]);
	});
});

// --- Transfer feasibility with brachistochrone ---

// Helper to build a ShipPhysicsState from a named ENGINE_TYPES entry
function shipFromEngine(engineId: string, fuelKg: number, dryMassKg: number) {
	const engine = ENGINE_TYPES.find((e) => e.id === engineId);
	if (!engine) throw new Error(`Unknown engine id: ${engineId}`);
	return { fuelKg, dryMassKg, accelG: engine.accelG, ispS: engine.ispS };
}

describe("checkTransfer", () => {
	it("Earth to Mars with conventional TN (0.1g): feasible, under 10 days", () => {
		const ship = shipFromEngine("conventional", 500_000, 5_000);
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		expect(result.feasible).toBe(true);
		expect(result.transferDays).toBeLessThan(10);
		expect(result.deltaVRequired).toBeCloseTo(555, -2);
	});

	it("Earth to Neptune with extreme TN: feasible, under 5 days", () => {
		const ship = shipFromEngine("extreme", 500_000, 5_000);
		const result = checkTransfer(1.0, 30.07, 1.0, ship);
		expect(result.feasible).toBe(true);
		expect(result.transferDays).toBeLessThan(5);
	});

	it("infeasible with near-zero fuel", () => {
		const ship = shipFromEngine("conventional", 1, 5_000);
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		expect(result.feasible).toBe(false);
	});

	it("fuel consumed matches fuelRequired for same delta-v", () => {
		const ship = shipFromEngine("conventional", 500_000, 5_000);
		const result = checkTransfer(1.0, 1.524, 1.0, ship);
		const engine = ENGINE_TYPES.find((e) => e.id === "conventional");
		expect(engine).toBeDefined();
		const veKmS = exhaustVelocity((engine as NonNullable<typeof engine>).ispS) / 1000;
		const expectedFuel = fuelRequired(veKmS, ship.dryMassKg, result.deltaVRequired ?? 0);
		expect(result.fuelUsedKg).toBeCloseTo(expectedFuel, 6);
	});

	it("TN engines have low fuel fraction (high Isp)", () => {
		const ship = shipFromEngine("extreme", 500_000, 5_000);
		const result = checkTransfer(1.0, 30.07, 1.0, ship);
		expect(result.feasible).toBe(true);
		// High Isp means fuel usage is a small fraction of total
		expect(result.fuelUsedKg).toBeLessThan(ship.fuelKg * 0.5);
	});
});

// --- Fuel cost model ---

describe("computeTotalFuelCost", () => {
	const distKm = 1.0 * AU_TO_KM; // ~1 AU (Earth to ~Mars)

	it("returns additive fuel cost (rocket + operational burn)", () => {
		const cost = computeTotalFuelCost(distKm, 0.1, 1_000_000, 5_000, 50_000);
		expect(cost.rocketFuelKg).toBeGreaterThan(0);
		expect(cost.opBurnKg).toBeGreaterThan(0);
		expect(cost.totalFuelKg).toBeCloseTo(cost.rocketFuelKg + cost.opBurnKg, 6);
		expect(cost.transferDays).toBeGreaterThan(0);
	});

	it("operational burn scales with OP_BURN_RATE and transfer days", () => {
		const cost = computeTotalFuelCost(distKm, 0.1, 1_000_000, 5_000, 50_000);
		const expectedOp = OP_BURN_RATE * 50_000 * cost.transferDays;
		expect(cost.opBurnKg).toBeCloseTo(expectedOp, 6);
	});

	it("opBurnMultiplier > 1 reduces operational burn", () => {
		const base = computeTotalFuelCost(distKm, 0.1, 1_000_000, 5_000, 50_000, 1.0);
		const hard = computeTotalFuelCost(distKm, 0.1, 1_000_000, 5_000, 50_000, 2.0);
		expect(hard.opBurnKg).toBeCloseTo(base.opBurnKg / 2, 6);
	});

	it("100-day trip costs ~10% capacity in op burn (not 100% like old formula)", () => {
		// Find distance that gives ~100 day transfer at 0.1g
		// T = 2*sqrt(d/a), d = (T/2)^2 * a, T=100d=8.64e6s, a=0.981
		const d100 = ((100 * 86400) / 2) ** 2 * (0.1 * G_ACCEL);
		const distKm100 = d100 / 1000;
		const cost = computeTotalFuelCost(distKm100, 0.1, 1_000_000, 5_000, 50_000);
		expect(cost.transferDays).toBeCloseTo(100, 0);
		// Op burn should be ~10% of capacity, not 100%
		expect(cost.opBurnKg / 50_000).toBeCloseTo(0.1, 1);
	});
});

describe("findAffordableAccelG", () => {
	const distKm = 1.0 * AU_TO_KM;

	it("returns max accel when affordable", () => {
		const result = findAffordableAccelG(distKm, 1_000_000, 5_000, 50_000, 0.1, 50_000);
		if (!result) throw new Error("expected non-null result");
		expect(result.accelG).toBeCloseTo(0.1, 3);
	});

	it("returns null when even minimum accel is unaffordable", () => {
		const result = findAffordableAccelG(distKm, 1_000_000, 5_000, 50_000, 0.1, 1);
		expect(result).toBeNull();
	});

	it("finds a throttled accel between min and max when budget is tight", () => {
		// Use lower Isp (10,000s) where rocket fuel is significant and throttling helps
		const lowIsp = 10_000;
		const fullCost = computeTotalFuelCost(distKm, 10, lowIsp, 5_000, 50_000);
		// Budget is 80% of full cost — forces throttle
		const budget = fullCost.totalFuelKg * 0.8;
		const result = findAffordableAccelG(distKm, lowIsp, 5_000, 50_000, 10, budget);
		if (!result) throw new Error("expected non-null result");
		expect(result.accelG).toBeLessThan(10);
		expect(result.accelG).toBeGreaterThan(0.001);
		expect(result.totalFuelKg).toBeLessThanOrEqual(budget);
		expect(result.transferDays).toBeGreaterThan(fullCost.transferDays);
	});
});
