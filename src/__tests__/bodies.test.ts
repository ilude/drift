/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
}));

import { isInKirkwoodGap, nameHash, orbitSegmentCount } from "../rendering/bodies";

describe("nameHash", () => {
	it("is deterministic — same input returns same value", () => {
		expect(nameHash("Earth")).toBe(nameHash("Earth"));
	});

	it("different inputs produce different outputs", () => {
		expect(nameHash("Earth")).not.toBe(nameHash("Mars"));
	});

	it("returns a non-negative integer (& 0x7fffffff mask)", () => {
		for (const s of ["", "a", "Earth", "Saturn", "x".repeat(200)]) {
			const h = nameHash(s);
			expect(Number.isInteger(h)).toBe(true);
			expect(h).toBeGreaterThanOrEqual(0);
		}
	});

	it("handles empty string without throwing", () => {
		expect(() => nameHash("")).not.toThrow();
	});

	it("single character produces consistent result", () => {
		expect(nameHash("a")).toBe(nameHash("a"));
		expect(nameHash("a")).not.toBe(nameHash("b"));
	});

	it("long string produces consistent result", () => {
		const long = "x".repeat(500);
		expect(nameHash(long)).toBe(nameHash(long));
	});
});

describe("isInKirkwoodGap", () => {
	const gaps = [
		{ center: 2.06, width: 0.03 },
		{ center: 2.5, width: 0.04 },
		{ center: 2.82, width: 0.03 },
	];

	it("returns false for empty gaps array", () => {
		expect(isInKirkwoodGap(2.5, [])).toBe(false);
	});

	it("returns true when AU is inside a gap (first gap)", () => {
		expect(isInKirkwoodGap(2.06, gaps)).toBe(true);
	});

	it("returns true when AU is inside a gap (second gap)", () => {
		expect(isInKirkwoodGap(2.5, gaps)).toBe(true);
	});

	it("returns true when AU is in second gap but not first", () => {
		expect(isInKirkwoodGap(2.52, gaps)).toBe(true);
	});

	it("returns false when AU is outside all gaps", () => {
		expect(isInKirkwoodGap(2.3, gaps)).toBe(false);
	});

	it("returns false when AU is well outside all gaps", () => {
		expect(isInKirkwoodGap(1.0, gaps)).toBe(false);
		expect(isInKirkwoodGap(4.0, gaps)).toBe(false);
	});

	it("returns true at exact boundary (< width, not <=)", () => {
		// Math.abs(2.06 - (2.06 + 0.03 - epsilon)) < 0.03 → true
		const justInside = 2.06 + 0.03 - 0.0001;
		expect(isInKirkwoodGap(justInside, gaps)).toBe(true);
	});

	it("returns false just outside the boundary", () => {
		// Math.abs(2.06 - (2.06 + 0.03 + epsilon)) >= 0.03 → false
		const justOutside = 2.06 + 0.03 + 0.0001;
		expect(isInKirkwoodGap(justOutside, gaps)).toBe(false);
	});
});

describe("orbitSegmentCount", () => {
	it("clamps to 128 for small radius", () => {
		expect(orbitSegmentCount(0)).toBe(128);
		expect(orbitSegmentCount(10)).toBe(128);
		expect(orbitSegmentCount(32)).toBe(128);
	});

	it("clamps to 512 for large radius", () => {
		expect(orbitSegmentCount(200)).toBe(512);
		expect(orbitSegmentCount(1000)).toBe(512);
	});

	it("scales linearly for medium radius (approxR * 4)", () => {
		// approxR=50 → 200, approxR=80 → 320, approxR=100 → 400
		expect(orbitSegmentCount(50)).toBe(200);
		expect(orbitSegmentCount(80)).toBe(320);
		expect(orbitSegmentCount(100)).toBe(400);
	});

	it("lower boundary: radius=32 clamps to 128", () => {
		expect(orbitSegmentCount(32)).toBe(128);
	});

	it("just above lower boundary: radius=33 produces 132", () => {
		expect(orbitSegmentCount(33)).toBe(132);
	});

	it("upper boundary: radius=128 produces 512", () => {
		expect(orbitSegmentCount(128)).toBe(512);
	});

	it("just below upper boundary: radius=127 produces 508", () => {
		expect(orbitSegmentCount(127)).toBe(508);
	});
});
