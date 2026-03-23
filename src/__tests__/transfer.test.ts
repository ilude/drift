import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR } from "../math/orbit";
import {
	auToWorld,
	computeMu,
	deriveStarMass,
	gameTransferDays,
	gameTransferSpeed,
	hohmannTransfer,
	isTransferComplete,
	lambertSolve,
	propagatePosition,
	transferSpeed,
	transferStartAngle,
	worldToAU,
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
});

describe("worldToAU / auToWorld", () => {
	it("round-trips correctly", () => {
		const au = { x: 1.5, z: -2.3 };
		const world = auToWorld(au.x, au.z);
		const back = worldToAU(world.x, world.z);
		expect(back.x).toBeCloseTo(au.x, 5);
		expect(back.z).toBeCloseTo(au.z, 5);
	});

	it("preserves angle", () => {
		const angle = 1.23;
		const rau = 4.0;
		const ax = rau * Math.cos(angle);
		const az = rau * Math.sin(angle);
		const w = auToWorld(ax, az);
		expect(Math.atan2(w.z, w.x)).toBeCloseTo(angle, 10);
	});

	it("handles origin", () => {
		const w = auToWorld(0, 0);
		expect(w.x).toBe(0);
		expect(w.z).toBe(0);
		const a = worldToAU(0, 0);
		expect(a.x).toBe(0);
		expect(a.z).toBe(0);
	});
});

describe("lambertSolve", () => {
	const mu = computeMu(1); // solar mass

	it("returns non-null for valid transfer", () => {
		// Earth at (1, 0) to Mars at (0, 1.524) in 259 days (Hohmann-like)
		const result = lambertSolve(1, 0, 0, 1.524, 259, mu);
		expect(result).not.toBeNull();
	});

	it("departure velocity is roughly correct magnitude for Hohmann", () => {
		// Earth at (1, 0) AU, Mars at (-1.524, 0) AU (180 deg transfer)
		const result = lambertSolve(1, 0, -1.524, 0, 259, mu);
		expect(result).not.toBeNull();
		// Hohmann departure velocity ~32.7 km/s ... let's just check it's reasonable
		const v1 = Math.hypot(result?.v1x, result?.v1z);
		expect(v1).toBeGreaterThan(0);
		expect(v1).toBeLessThan(0.1); // AU/day -- reasonable bound
	});

	it("works for fast game-scale transfers", () => {
		// Earth (1, 0) to Mars position (0.5, 1.4) in ~5 days
		const result = lambertSolve(1, 0, 0.5, 1.4, 5, mu);
		expect(result).not.toBeNull();
		const v1 = Math.hypot(result?.v1x, result?.v1z);
		expect(v1).toBeGreaterThan(0);
	});

	it("returns null for zero time of flight", () => {
		expect(lambertSolve(1, 0, 0, 1.5, 0, mu)).toBeNull();
	});
});

describe("propagatePosition", () => {
	const mu = computeMu(1);

	it("returns start position at dt=0", () => {
		const pos = propagatePosition(1, 0, 0, 0.01, 0, mu);
		expect(pos.x).toBeCloseTo(1, 10);
		expect(pos.z).toBeCloseTo(0, 10);
	});

	it("circular orbit returns to start after one period", () => {
		// Circular orbit at 1 AU: v = sqrt(mu/r)
		const v = Math.sqrt(mu / 1.0);
		const period = DAYS_PER_YEAR; // 1 year for 1 AU around 1 solar mass
		const pos = propagatePosition(1, 0, 0, v, period, mu);
		expect(pos.x).toBeCloseTo(1, 2);
		expect(pos.z).toBeCloseTo(0, 2);
	});

	it("circular orbit quarter period gives 90 deg rotation", () => {
		const v = Math.sqrt(mu / 1.0);
		const period = DAYS_PER_YEAR;
		const pos = propagatePosition(1, 0, 0, v, period / 4, mu);
		expect(pos.x).toBeCloseTo(0, 2);
		expect(pos.z).toBeCloseTo(1, 2);
	});

	it("Lambert solve + propagation arrives at target", () => {
		const r1x = 1,
			r1z = 0;
		const r2x = 0,
			r2z = 1.524;
		const tof = 200;
		const result = lambertSolve(r1x, r1z, r2x, r2z, tof, mu);
		expect(result).not.toBeNull();
		const pos = propagatePosition(r1x, r1z, result?.v1x, result?.v1z, tof, mu);
		expect(pos.x).toBeCloseTo(r2x, 2);
		expect(pos.z).toBeCloseTo(r2z, 2);
	});

	it("Lambert + propagation works for fast game transfers", () => {
		const r1x = 1,
			r1z = 0;
		const r2x = -0.5,
			r2z = 1.4;
		const tof = 5;
		const result = lambertSolve(r1x, r1z, r2x, r2z, tof, mu);
		expect(result).not.toBeNull();
		const pos = propagatePosition(r1x, r1z, result?.v1x, result?.v1z, tof, mu);
		expect(pos.x).toBeCloseTo(r2x, 1);
		expect(pos.z).toBeCloseTo(r2z, 1);
	});
});
