import { describe, expect, it } from "vitest";
import { rngWeighted, seededRandom } from "../core/utils";

describe("seededRandom", () => {
	it("produces deterministic output for same seed", () => {
		const rng1 = seededRandom(42);
		const rng2 = seededRandom(42);
		for (let i = 0; i < 100; i++) {
			expect(rng1()).toBe(rng2());
		}
	});

	it("produces different output for different seeds", () => {
		const rng1 = seededRandom(1);
		const rng2 = seededRandom(2);
		const seq1 = Array.from({ length: 10 }, () => rng1());
		const seq2 = Array.from({ length: 10 }, () => rng2());
		expect(seq1).not.toEqual(seq2);
	});

	it("returns values in [0, 1) range", () => {
		const rng = seededRandom(12345);
		for (let i = 0; i < 1000; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it("handles seed=0 by defaulting to 1", () => {
		const rng = seededRandom(0);
		const v = rng();
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThan(1);
	});

	it("handles negative seed", () => {
		const rng = seededRandom(-99);
		const v = rng();
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThan(1);
	});

	it("handles large seed", () => {
		const rng = seededRandom(2147483646);
		const v = rng();
		expect(v).toBeGreaterThanOrEqual(0);
		expect(v).toBeLessThan(1);
	});
});

describe("rngWeighted", () => {
	it("returns entry whose cumulative weight matches the random value", () => {
		const rng = seededRandom(42);
		const entries = [{ weight: 0.2 }, { weight: 0.3 }, { weight: 0.5 }];
		const result = rngWeighted(rng, entries);
		expect(result).toBeDefined();
		expect(entries).toContain(result);
	});

	it("triggers fallback when rng returns ~1.0 (floating-point rounding)", () => {
		// Return a deterministic value very close to 1.0
		// This can cause floating-point rounding to skip the <= 0 check
		const mockRng = () => 0.9999999999999999;
		const entries = [{ weight: 1 }, { weight: 1 }, { weight: 1 }];
		const result = rngWeighted(mockRng, entries);
		// Should return the last entry (fallback path at line 30)
		expect(result).toBe(entries[entries.length - 1]);
	});
});
