import { describe, expect, it } from "vitest";
import {
	generateDeposits,
	getMinableResources,
	getResourceDef,
	getResourcesByCategory,
	RESOURCES,
} from "../data/resources";

describe("RESOURCES catalog", () => {
	it("has exactly 27 entries", () => {
		expect(RESOURCES).toHaveLength(27);
	});

	it("all ids are unique", () => {
		const ids = RESOURCES.map((r) => r.id);
		const unique = new Set(ids);
		expect(unique.size).toBe(27);
	});

	it("all entries have non-empty name, symbol, description", () => {
		for (const r of RESOURCES) {
			expect(r.name.length).toBeGreaterThan(0);
			expect(r.symbol.length).toBeGreaterThan(0);
			expect(r.description.length).toBeGreaterThan(0);
		}
	});
});

describe("getResourceDef", () => {
	it("returns iron entry for 'iron'", () => {
		const def = getResourceDef("iron");
		expect(def).toBeDefined();
		expect(def?.id).toBe("iron");
		expect(def?.category).toBe("metal");
		expect(def?.symbol).toBe("Fe");
	});

	it("returns undefined for nonexistent id", () => {
		expect(getResourceDef("nonexistent")).toBeUndefined();
	});
});

describe("getResourcesByCategory", () => {
	it("returns exactly 8 umbral resources", () => {
		expect(getResourcesByCategory("umbral")).toHaveLength(8);
	});

	it("returns exactly 6 radioactive resources", () => {
		expect(getResourcesByCategory("radioactive")).toHaveLength(6);
	});

	it("returns exactly 5 metal resources", () => {
		expect(getResourcesByCategory("metal")).toHaveLength(5);
	});
});

describe("getMinableResources", () => {
	it("returns exactly 24 entries (excludes enriched-uranium, plutonium, tritium)", () => {
		const minable = getMinableResources();
		expect(minable).toHaveLength(24);
		const ids = minable.map((r) => r.id);
		expect(ids).not.toContain("enriched-uranium");
		expect(ids).not.toContain("plutonium");
		expect(ids).not.toContain("tritium");
	});
});

// Helper to count resource categories across multiple generated deposits.
// Useful for testing body-type-specific deposit distributions.
function countDepositCategories(
	bodyType: string,
	radius: number,
	namePrefix: string,
	targetNonEmpty: number,
): Record<string, number> {
	const categoryCounts: Record<string, number> = {};
	let nonEmpty = 0;
	for (let i = 0; i < 200 && nonEmpty < targetNonEmpty; i++) {
		const deposits = generateDeposits(1, `${namePrefix}${i}`, bodyType, radius);
		if (deposits.length === 0) continue;
		nonEmpty++;
		for (const d of deposits) {
			const def = getResourceDef(d.resourceId);
			if (def) categoryCounts[def.category] = (categoryCounts[def.category] ?? 0) + 1;
		}
	}
	return categoryCounts;
}

describe("generateDeposits", () => {
	it("is deterministic for same seed and body", () => {
		const a = generateDeposits(42, "Mars", "Planet", 3389);
		const b = generateDeposits(42, "Mars", "Planet", 3389);
		expect(a).toEqual(b);
	});

	it("returns different results for different body names", () => {
		const a = generateDeposits(42, "Mars", "Planet", 3389);
		const b = generateDeposits(42, "Venus", "Planet", 6051);
		expect(a).not.toEqual(b);
	});

	it("returns empty array for ~35% of bodies", () => {
		let emptyCount = 0;
		const total = 100;
		for (let i = 0; i < total; i++) {
			const name = `Body${i}`;
			const deposits = generateDeposits(999, name, "Planet", 5000);
			if (deposits.length === 0) emptyCount++;
		}
		expect(emptyCount).toBeGreaterThanOrEqual(25);
		expect(emptyCount).toBeLessThanOrEqual(45);
	});

	it("rocky planet deposits skew toward metals", () => {
		const categoryCounts = countDepositCategories("Planet", 6000, "RockyBody", 20);
		const metalCount = categoryCounts.metal ?? 0;
		const volatileCount = categoryCounts.volatile ?? 0;
		expect(metalCount).toBeGreaterThan(volatileCount);
	});

	it("gas giant deposits skew toward volatiles", () => {
		const categoryCounts = countDepositCategories("Planet", 70000, "GasBody", 20);
		const volatileCount = categoryCounts.volatile ?? 0;
		const metalCount = categoryCounts.metal ?? 0;
		expect(volatileCount).toBeGreaterThan(metalCount);
	});

	it("comet deposits have high accessibility (all >= 0.6)", () => {
		let tested = 0;
		for (let i = 0; i < 200 && tested < 10; i++) {
			const deposits = generateDeposits(7, `Comet${i}`, "Comet", 5);
			if (deposits.length === 0) continue;
			tested++;
			for (const d of deposits) {
				expect(d.accessibility).toBeGreaterThanOrEqual(0.6);
			}
		}
	});

	it("all deposits have minSurveyLevel 1-3", () => {
		for (let i = 0; i < 50; i++) {
			const deposits = generateDeposits(5, `Body${i}`, "Planet", 5000);
			for (const d of deposits) {
				expect(d.minSurveyLevel).toBeGreaterThanOrEqual(1);
				expect(d.minSurveyLevel).toBeLessThanOrEqual(3);
			}
		}
	});

	it("all deposits have accessibility between 0.1 and 1.0", () => {
		for (let i = 0; i < 50; i++) {
			const deposits = generateDeposits(5, `Body${i}`, "Planet", 5000);
			for (const d of deposits) {
				expect(d.accessibility).toBeGreaterThanOrEqual(0.1);
				expect(d.accessibility).toBeLessThanOrEqual(1.0);
			}
		}
	});

	it("all deposits have quantity > 0", () => {
		for (let i = 0; i < 50; i++) {
			const deposits = generateDeposits(5, `Body${i}`, "Planet", 5000);
			for (const d of deposits) {
				expect(d.quantity).toBeGreaterThan(0);
			}
		}
	});

	it("detached object body type uses detached object pool", () => {
		// Detached Object pool includes unique resources like cadrine and caritene
		// that don't appear in the rocky planet pool
		let foundUniqueResource = false;
		const uniqueResources = new Set(["caritene", "heliate", "cadrine"]);
		// Search through multiple seeds to find deposits with unique detached object resources
		for (let seed = 1; seed < 100 && !foundUniqueResource; seed++) {
			const deposits = generateDeposits(seed, `DetachedObject${seed}`, "Detached Object", 500);
			for (const d of deposits) {
				if (uniqueResources.has(d.resourceId)) {
					foundUniqueResource = true;
					break;
				}
			}
		}
		// At least one unique detached object resource should appear
		expect(foundUniqueResource).toBe(true);
	});

	it("detached object deposits have valid resource ids from detached object pool", () => {
		const validDetachedObjectIds = new Set([
			"iron",
			"water",
			"nitrogen",
			"carbon",
			"ortheum",
			"cadrine",
			"vantine",
			"nemorin",
			"caritene",
			"heliate",
			"uranium",
		]);
		let testedCount = 0;
		for (let seed = 1; seed < 100 && testedCount < 10; seed++) {
			const deposits = generateDeposits(seed, `DetachedObject${seed}`, "Detached Object", 500);
			if (deposits.length === 0) continue;
			testedCount++;
			for (const d of deposits) {
				expect(validDetachedObjectIds.has(d.resourceId)).toBe(true);
			}
		}
		expect(testedCount).toBeGreaterThan(0);
	});

	// NOTE: pickWeighted line 275 fallback (return pool[pool.length - 1].id) is a
	// defensive guard for floating-point rounding edge cases. It is not reachable
	// through normal seeded RNG usage because rng() * total will always fall into
	// one of the pool entries before r > 0 persists. This is a legitimate uncovered
	// line—it represents defensive programming for an extremely rare edge case that
	// cannot be triggered without artificial RNG manipulation.
});
