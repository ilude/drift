import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR } from "../math/orbit";
import {
	computeMu,
	deriveStarMass,
	gameTransferDays,
	gameTransferSpeed,
	hohmannTransfer,
	isTransferComplete,
	transferSpeed,
	transferStartAngle,
} from "../math/transfer";
import type { BodyData } from "../types";

describe("hohmannTransfer", () => {
	it("computes correct semi-major axis", () => {
		const { a } = hohmannTransfer(1.0, 1.524); // Earth -> Mars
		expect(a).toBeCloseTo(1.262, 3);
	});

	it("computes correct eccentricity", () => {
		const { e } = hohmannTransfer(1.0, 1.524);
		expect(e).toBeCloseTo(0.2075, 3);
	});

	it("returns positive transfer time", () => {
		const { transferTimeDays } = hohmannTransfer(1.0, 1.524);
		expect(transferTimeDays).toBeGreaterThan(0);
	});

	it("Earth to Mars transfer time is ~259 days", () => {
		const { transferTimeDays } = hohmannTransfer(1.0, 1.524);
		expect(transferTimeDays).toBeCloseTo(259, -1); // within ~10 days
	});

	it("has symmetric semi-major axis", () => {
		const a1 = hohmannTransfer(1.0, 5.2).a;
		const a2 = hohmannTransfer(5.2, 1.0).a;
		expect(a1).toBeCloseTo(a2, 10);
	});

	it("uses star mass in period calculation", () => {
		const t1 = hohmannTransfer(1.0, 2.0, 1).transferTimeDays;
		const t2 = hohmannTransfer(1.0, 2.0, 4).transferTimeDays;
		expect(t2).toBeLessThan(t1); // heavier star -> shorter period
	});
});

describe("transferSpeed", () => {
	it("returns correct angular velocity", () => {
		const speed = transferSpeed(2.0);
		expect(speed).toBeCloseTo((Math.PI * 2) / (2.0 * DAYS_PER_YEAR), 10);
	});

	it("returns 0 for 0 period", () => {
		expect(transferSpeed(0)).toBe(0);
	});
});

describe("transferStartAngle", () => {
	it("returns 0 for outward transfer", () => {
		expect(transferStartAngle(1.0, 5.2)).toBe(0);
	});

	it("returns PI for inward transfer", () => {
		expect(transferStartAngle(5.2, 1.0)).toBe(Math.PI);
	});

	it("returns 0 for equal radii", () => {
		expect(transferStartAngle(1.0, 1.0)).toBe(0);
	});
});

describe("isTransferComplete", () => {
	it("returns false when elapsed < transfer time", () => {
		expect(isTransferComplete(100, 259)).toBe(false);
	});

	it("returns true when elapsed >= transfer time", () => {
		expect(isTransferComplete(260, 259)).toBe(true);
	});

	it("returns true at exact boundary", () => {
		expect(isTransferComplete(259, 259)).toBe(true);
	});
});

describe("gameTransferDays", () => {
	it("Earth to Mars takes ~5 days", () => {
		const days = gameTransferDays(1.0, 1.524);
		expect(days).toBeCloseTo(4.57, 1);
	});

	it("Earth to Saturn takes ~29 days", () => {
		const days = gameTransferDays(1.0, 9.537);
		expect(days).toBeCloseTo(28.6, 0);
	});

	it("is symmetric", () => {
		expect(gameTransferDays(1.0, 5.0)).toBe(gameTransferDays(5.0, 1.0));
	});
});

describe("gameTransferSpeed", () => {
	it("traverses PI radians in the given days", () => {
		const days = 10;
		const speed = gameTransferSpeed(days);
		expect(speed * days).toBeCloseTo(Math.PI, 10);
	});
});

describe("computeMu", () => {
	it("returns correct mu for solar mass", () => {
		const mu = computeMu(1);
		// mu = 4pi^2/365.25^2 AU^3/day^2
		expect(mu).toBeCloseTo((4 * Math.PI * Math.PI) / (365.25 * 365.25), 10);
	});

	it("scales linearly with star mass", () => {
		expect(computeMu(2)).toBeCloseTo(2 * computeMu(1), 10);
	});
});

describe("deriveStarMass", () => {
	it("returns 1.0 for Earth orbit (1 AU, 1 year)", () => {
		const mass = deriveStarMass([
			{ type: "Star", distance: 0, period: 0 },
			{ type: "Planet", distance: 1.0, period: 1.0, name: "Earth" },
		] as unknown as BodyData[]);
		expect(mass).toBeCloseTo(1.0, 5);
	});

	it("derives consistent mass from Jupiter", () => {
		const mass = deriveStarMass([
			{ type: "Star", distance: 0, period: 0 },
			{ type: "Planet", distance: 5.203, period: 11.86, name: "Jupiter" },
		] as unknown as BodyData[]);
		expect(mass).toBeCloseTo(1.0, 1);
	});

	it("returns 1 when body list is empty", () => {
		expect(deriveStarMass([])).toBe(1);
	});

	it("returns 1 when all bodies have period=0", () => {
		expect(deriveStarMass([{ type: "Planet", period: 0, distance: 1 } as BodyData])).toBe(1);
	});
});
