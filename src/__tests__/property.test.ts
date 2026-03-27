import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bathtubFailRate, computeMorale, hullCeiling } from "../core/commands";
import { findEngineTier } from "../data/components";
import type { WeightedResource } from "../data/resources";
import { pickWeighted } from "../data/resources";
import { generateSystem } from "../data/system-generator";
import { computeEngineStats } from "../math/ship-design-calc";

// ---------------------------------------------------------------------------
// hullCeiling — property: result always ∈ [30, 100]
// ---------------------------------------------------------------------------

describe("hullCeiling — property: result always ∈ [30, 100]", () => {
	it("holds for any non-negative age values", () => {
		fc.assert(
			fc.property(
				// lastRefitAge <= totalAge: a refit cannot happen in the future
				fc.float({ min: 0, max: 365 * 50, noNaN: true }),
				fc.float({ min: 0, max: 1, noNaN: true }),
				(totalAge, refitFraction) => {
					const lastRefitAge = totalAge * refitFraction;
					const result = hullCeiling(totalAge, lastRefitAge);
					return result >= 30 && result <= 100;
				},
			),
		);
	});

	it("returns exactly 30 when ship is very old since last refit", () => {
		// Floor of 30% after enough years without refit
		const result = hullCeiling(365 * 50, 0);
		expect(result).toBe(30);
	});

	it("returns exactly 100 when totalAge equals lastRefitAge", () => {
		fc.assert(
			fc.property(fc.float({ min: 0, max: 365 * 50, noNaN: true }), (age) => {
				const result = hullCeiling(age, age);
				return result === 100;
			}),
		);
	});
});

// ---------------------------------------------------------------------------
// bathtubFailRate — property: result always >= 0 for valid inputs
// ---------------------------------------------------------------------------

describe("bathtubFailRate — property: result always >= 0", () => {
	it("holds for any non-negative realistic inputs", () => {
		fc.assert(
			fc.property(
				fc.float({ min: 0, max: 365 * 20, noNaN: true }), // daysSinceOverhaul
				fc.float({ min: 1, max: 100, noNaN: true }), // hullIntegrity
				fc.float({ min: 0, max: 100, noNaN: true }), // morale
				fc.float({ min: 0, max: 100, noNaN: true }), // experience
				(days, hull, morale, exp) => {
					const result = bathtubFailRate(days, hull, morale, exp);
					return result >= 0 && Number.isFinite(result);
				},
			),
		);
	});

	it("phase 1 (< 90 days) rate is higher than phase 2 (constant) at equivalent hull/crew", () => {
		const phase1 = bathtubFailRate(1, 100, 50, 0);
		const phase2 = bathtubFailRate(200, 100, 50, 0);
		expect(phase1).toBeGreaterThan(phase2);
	});

	it("lower hull integrity increases fail rate", () => {
		const goodHull = bathtubFailRate(200, 100, 50, 0);
		const badHull = bathtubFailRate(200, 10, 50, 0);
		expect(badHull).toBeGreaterThan(goodHull);
	});

	it("more experience reduces fail rate", () => {
		const novice = bathtubFailRate(200, 100, 50, 0);
		const veteran = bathtubFailRate(200, 100, 50, 40);
		expect(veteran).toBeLessThan(novice);
	});
});

// ---------------------------------------------------------------------------
// computeMorale — property: result always ∈ [0, 100] for non-negative inputs
// ---------------------------------------------------------------------------

describe("computeMorale — property: result always ∈ [0, 100] for non-negative inputs", () => {
	it("holds for any non-negative daysSinceLeave and deploymentLimit", () => {
		fc.assert(
			fc.property(
				fc.float({ min: 0, max: 365 * 5, noNaN: true }),
				fc.float({ min: 0, max: 365 * 5, noNaN: true }),
				(daysSinceLeave, deploymentLimit) => {
					const result = computeMorale(daysSinceLeave, deploymentLimit);
					return result >= 0 && result <= 100;
				},
			),
		);
	});

	it("returns 100 when within deployment limit", () => {
		fc.assert(
			fc.property(fc.float({ min: 0, max: 365, noNaN: true }), (days) => {
				// deploymentLimit >= daysSinceLeave → always 100
				return computeMorale(days, days + 1) === 100;
			}),
		);
	});

	it("morale decreases as deployment exceeds limit", () => {
		const atLimit = computeMorale(180, 180);
		const overLimit = computeMorale(270, 180);
		const farOverLimit = computeMorale(540, 180);
		expect(atLimit).toBe(100);
		expect(overLimit).toBeLessThan(atLimit);
		expect(farOverLimit).toBeLessThan(overLimit);
	});
});

// ---------------------------------------------------------------------------
// computeEngineStats — property: all outputs finite and positive for powerPct > 0
// ---------------------------------------------------------------------------

describe("computeEngineStats — property: all outputs finite and positive for powerPct > 0", () => {
	const conventionalTier = findEngineTier("conventional");
	if (!conventionalTier) throw new Error("conventional tier not found");

	it("holds for any positive powerPct and sizeHS", () => {
		fc.assert(
			fc.property(
				fc.float({ min: 1, max: 150, noNaN: true }), // powerPct
				fc.float({ min: 1, max: 90, noNaN: true }), // sizeHS (< 100 so fuelMod stays positive)
				(powerPct, sizeHS) => {
					const result = computeEngineStats(conventionalTier, powerPct, sizeHS);
					return (
						Number.isFinite(result.accelG) &&
						Number.isFinite(result.ispS) &&
						Number.isFinite(result.massKg) &&
						Number.isFinite(result.fuelMod) &&
						result.accelG > 0 &&
						result.ispS > 0 &&
						result.massKg > 0 &&
						result.fuelMod > 0
					);
				},
			),
		);
	});

	it("accelG scales linearly with powerPct", () => {
		fc.assert(
			fc.property(
				fc.float({ min: 1, max: 150, noNaN: true }),
				fc.float({ min: 1, max: 150, noNaN: true }),
				(pct1, pct2) => {
					const sizeHS = 10;
					const r1 = computeEngineStats(conventionalTier, pct1, sizeHS);
					const r2 = computeEngineStats(conventionalTier, pct2, sizeHS);
					// accelG ratio should equal powerPct ratio
					const accelRatio = r1.accelG / r2.accelG;
					const pctRatio = pct1 / pct2;
					return Math.abs(accelRatio - pctRatio) < 1e-9;
				},
			),
		);
	});

	it("higher powerPct means higher fuelMod (efficiency tradeoff)", () => {
		fc.assert(
			fc.property(fc.float({ min: 1, max: 99, noNaN: true }), (basePct) => {
				const sizeHS = 10;
				const low = computeEngineStats(conventionalTier, basePct, sizeHS);
				const high = computeEngineStats(conventionalTier, basePct + 1, sizeHS);
				return high.fuelMod >= low.fuelMod;
			}),
		);
	});

	it("ispS is constant per tier regardless of powerPct or sizeHS", () => {
		fc.assert(
			fc.property(
				fc.float({ min: 1, max: 150, noNaN: true }),
				fc.float({ min: 1, max: 90, noNaN: true }),
				(powerPct, sizeHS) => {
					const result = computeEngineStats(conventionalTier, powerPct, sizeHS);
					return result.ispS === conventionalTier.baseIspS;
				},
			),
		);
	});
});

// ---------------------------------------------------------------------------
// pickWeighted — property: always returns a valid id from non-empty pool
// ---------------------------------------------------------------------------

describe("pickWeighted — property: always returns a valid id", () => {
	it("returns one of the pool ids for any positive-weight pool", () => {
		fc.assert(
			fc.property(
				fc.array(
					fc.record({
						id: fc.string({ minLength: 1, maxLength: 10 }),
						// Math.fround required: fast-check fc.float enforces 32-bit float boundaries
						weight: fc.float({ min: Math.fround(0.01), max: 100, noNaN: true }),
					}),
					{ minLength: 1, maxLength: 20 },
				),
				(pool: WeightedResource[]) => {
					// Use deterministic rng for reproducibility
					let seed = 42;
					const rng = () => {
						seed = (seed * 1664525 + 1013904223) & 0xffffffff;
						return (seed >>> 0) / 0x100000000;
					};
					const result = pickWeighted(rng, pool);
					return pool.some((e) => e.id === result);
				},
			),
		);
	});

	it("distribution is approximately proportional to weights", () => {
		const pool: WeightedResource[] = [
			{ id: "rare", weight: 1 },
			{ id: "common", weight: 9 },
		];
		let rareCount = 0;
		let seed = 12345;
		const rng = () => {
			seed = (seed * 1664525 + 1013904223) & 0xffffffff;
			return (seed >>> 0) / 0x100000000;
		};
		const trials = 1000;
		for (let i = 0; i < trials; i++) {
			if (pickWeighted(rng, pool) === "rare") rareCount++;
		}
		// rare should be picked ~10% of the time ± 5%
		expect(rareCount / trials).toBeGreaterThan(0.05);
		expect(rareCount / trials).toBeLessThan(0.2);
	});
});

// ---------------------------------------------------------------------------
// generateSystem — property: deterministic (same seed → same output)
// ---------------------------------------------------------------------------

describe("generateSystem — property: deterministic for same seed", () => {
	it("produces identical output for the same seed", () => {
		fc.assert(
			fc.property(fc.integer({ min: 0, max: 2 ** 31 - 1 }), (seed) => {
				const a = generateSystem(seed);
				const b = generateSystem(seed);
				// Compare key structural properties
				return (
					a.name === b.name &&
					a.bodies.length === b.bodies.length &&
					a.bodies.every((body, i) => body.name === b.bodies[i].name)
				);
			}),
		);
	});

	it("well-separated seeds produce different systems", () => {
		// Spot-check a spread of seeds far enough apart that hash collisions are negligible
		const seeds = [1, 100, 1000, 9999, 99999, 999999, 12345678];
		for (let i = 0; i < seeds.length - 1; i++) {
			const a = generateSystem(seeds[i]);
			const b = generateSystem(seeds[i + 1]);
			expect(
				a.name !== b.name || a.bodies.length !== b.bodies.length,
				`seeds ${seeds[i]} and ${seeds[i + 1]} should produce different systems`,
			).toBe(true);
		}
	});

	it("Sol system (seed 42) always produces the same body count", () => {
		const a = generateSystem(42);
		const b = generateSystem(42);
		expect(a.bodies.length).toBe(b.bodies.length);
		expect(a.name).toBe(b.name);
	});
});
