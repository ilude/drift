import { describe, expect, it } from "vitest";
import { computeAdjustedFuelBudget } from "../core/transfers";

describe("computeAdjustedFuelBudget", () => {
	it("proportionally reduces budget for partial remaining time", () => {
		expect(computeAdjustedFuelBudget(100, 10, 5)).toBe(50);
	});

	it("returns zero when totalDays is zero", () => {
		expect(computeAdjustedFuelBudget(100, 0, 5)).toBe(0);
	});

	it("returns full budget when remaining equals total", () => {
		expect(computeAdjustedFuelBudget(100, 10, 10)).toBe(100);
	});

	it("returns zero budget when remaining is zero", () => {
		expect(computeAdjustedFuelBudget(100, 10, 0)).toBe(0);
	});

	it("handles fractional days correctly", () => {
		expect(computeAdjustedFuelBudget(300, 15, 5)).toBeCloseTo(100, 10);
	});
});
