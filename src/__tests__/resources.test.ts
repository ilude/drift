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
		const categoryCounts: Record<string, number> = {};
		// Use enough bodies to get a distribution, skipping empty ones
		let nonEmpty = 0;
		for (let i = 0; i < 200 && nonEmpty < 20; i++) {
			const deposits = generateDeposits(1, `RockyBody${i}`, "Planet", 6000);
			if (deposits.length === 0) continue;
			nonEmpty++;
			for (const d of deposits) {
				const def = getResourceDef(d.resourceId);
				if (def) categoryCounts[def.category] = (categoryCounts[def.category] ?? 0) + 1;
			}
		}
		const metalCount = categoryCounts.metal ?? 0;
		const volatileCount = categoryCounts.volatile ?? 0;
		expect(metalCount).toBeGreaterThan(volatileCount);
	});

	it("gas giant deposits skew toward volatiles", () => {
		const categoryCounts: Record<string, number> = {};
		let nonEmpty = 0;
		// radius > 30000 triggers gas giant path
		for (let i = 0; i < 200 && nonEmpty < 20; i++) {
			const deposits = generateDeposits(1, `GasBody${i}`, "Planet", 70000);
			if (deposits.length === 0) continue;
			nonEmpty++;
			for (const d of deposits) {
				const def = getResourceDef(d.resourceId);
				if (def) categoryCounts[def.category] = (categoryCounts[def.category] ?? 0) + 1;
			}
		}
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
});
