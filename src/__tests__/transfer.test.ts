import { describe, expect, it } from "vitest";
import { DAYS_PER_YEAR, scaleDist } from "../math/orbit";
import {
	captureBlendPosition,
	checkTransferArrival,
	computeMu,
	computeResplineKnots,
	computeTransferKnots,
	deriveStarMass,
	gameTransferDays,
	gameTransferSpeed,
	hohmannTransfer,
	isTransferComplete,
	predictOrbitalPosition,
	shouldRespline,
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

describe("captureBlendPosition", () => {
	const ship = { x: 10, y: 0, z: 0 };
	const target = { x: 0, y: 0, z: 0 };
	const offset = 2;

	it("returns original position when tNow <= 0.85", () => {
		const result = captureBlendPosition(ship, target, offset, 0.85);
		expect(result.x).toBeCloseTo(ship.x);
		expect(result.y).toBeCloseTo(ship.y);
		expect(result.z).toBeCloseTo(ship.z);
	});

	it("returns original position at tNow = 0", () => {
		const result = captureBlendPosition(ship, target, offset, 0);
		expect(result.x).toBeCloseTo(ship.x);
		expect(result.z).toBeCloseTo(ship.z);
	});

	it("at tNow = 1.0, position is very close to target + offset along approach angle", () => {
		const result = captureBlendPosition(ship, target, offset, 1.0);
		// Ship is at (10, 0, 0), target at origin — capAngle = atan2(0-0, 10-0) = 0
		// capX = 0 + cos(0) * 2 = 2, capZ = 0 + sin(0) * 2 = 0
		expect(result.x).toBeCloseTo(2, 3);
		expect(result.z).toBeCloseTo(0, 3);
	});

	it("smoothstep at midpoint (tNow = 0.925) is approximately 50% blend", () => {
		// tNow = 0.925: blendRaw = (0.925 - 0.85) / 0.15 = 0.5
		// smoothstep(0.5) = 0.5^2 * (3 - 2*0.5) = 0.25 * 2 = 0.5
		const result = captureBlendPosition(ship, target, offset, 0.925);
		// capX = 2, so blended x = 10 + 0.5 * (2 - 10) = 10 - 4 = 6
		expect(result.x).toBeCloseTo(6, 3);
	});

	it("offset controls approach distance from target", () => {
		const largeOffset = 5;
		const result = captureBlendPosition(ship, target, largeOffset, 1.0);
		// capX = cos(0) * 5 = 5
		expect(result.x).toBeCloseTo(5, 3);
	});

	it("y-axis blends toward target y", () => {
		const shipAbove = { x: 10, y: 5, z: 0 };
		const targetBelow = { x: 0, y: -5, z: 0 };
		const result = captureBlendPosition(shipAbove, targetBelow, 2, 1.0);
		// At t=1, blend=1, y = 5 + 1 * (-5 - 5) = -5
		expect(result.y).toBeCloseTo(-5, 3);
	});
});

describe("predictOrbitalPosition", () => {
	it("planet with zero eccentricity at t=0 returns position on circular orbit", () => {
		const r = scaleDist(1.0); // 1 AU scaled
		const pos = predictOrbitalPosition({
			x: r,
			y: 0,
			z: 0,
			speed: 0.01,
			angle: 0,
			daysFromNow: 0,
			e: 0,
			distance: 1.0,
		});
		// At angle=0, e=0: theta=0, kr=1AU, r=scaleDist(1), x=r*cos(0)=r, z=r*sin(0)=0
		expect(pos.x).toBeCloseTo(r, 3);
		expect(pos.y).toBe(0);
		expect(pos.z).toBeCloseTo(0, 3);
	});

	it("planet propagates forward (position changes with time)", () => {
		const p0 = predictOrbitalPosition({
			x: 0,
			y: 0,
			z: 0,
			speed: 0.01,
			angle: 0,
			daysFromNow: 0,
			e: 0,
			distance: 1.0,
		});
		// Copy scratch object values before next call overwrites them
		const x0 = p0.x;
		const z0 = p0.z;
		const pos1 = predictOrbitalPosition({
			x: 0,
			y: 0,
			z: 0,
			speed: 0.01,
			angle: 0,
			daysFromNow: 100,
			e: 0,
			distance: 1.0,
		});
		// After 100 days, angle has advanced, position should differ
		const dx = pos1.x - x0;
		const dz = pos1.z - z0;
		expect(dx * dx + dz * dz).toBeGreaterThan(0);
	});

	it("comet uses 3D inclined orbit (y != 0 for inclined comet)", () => {
		const pos = predictOrbitalPosition({
			x: 0,
			y: 0,
			z: 0,
			speed: 0.005,
			angle: 1.0,
			daysFromNow: 0,
			e: 0.9,
			distance: 10,
			comet: { a: 10, e: 0.9, incRad: 0.5, nodeRad: 0.3, periRad: 0.1 },
		});
		// Inclined orbit should produce non-zero y
		expect(pos.y).not.toBeCloseTo(0, 1);
	});

	it("moon adds parent offset", () => {
		const pos = predictOrbitalPosition({
			x: 0,
			y: 0,
			z: 0,
			speed: 0.1,
			angle: 0,
			daysFromNow: 0,
			e: 0,
			distance: 0.003,
			moon: {
				parentX: 0,
				parentZ: 0,
				parentAngle: 0,
				parentSpeed: 0.01,
				parentDistance: 1.0,
				parentE: 0,
			},
		});
		// Moon at angle=0 around parent at angle=0: parent at (scaleDist(1), 0)
		// Moon offset added on top of parent position
		const parentR = scaleDist(1.0);
		expect(pos.x).toBeGreaterThan(parentR - 1);
		expect(pos.y).toBe(0);
	});
});

describe("computeTransferKnots", () => {
	const depart = { x: 0, y: 0, z: 0 };
	const target = { x: 10, y: 0, z: 0 };

	it("produces correct distance", () => {
		const knots = computeTransferKnots(depart, target);
		const dx = knots.p1x - knots.p0x;
		const dy = knots.p1y - knots.p0y;
		const dz = knots.p1z - knots.p0z;
		expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeCloseTo(10, 5);
	});

	it("tangent magnitude is 0.4 * distance", () => {
		const knots = computeTransferKnots(depart, target);
		const tMag = Math.sqrt(knots.t0x ** 2 + knots.t0y ** 2 + knots.t0z ** 2);
		expect(tMag).toBeCloseTo(10 * 0.4, 5);
	});

	it("tangents are symmetric (same direction)", () => {
		const knots = computeTransferKnots(depart, target);
		expect(knots.t0x).toBeCloseTo(knots.t1x, 10);
		expect(knots.t0y).toBeCloseTo(knots.t1y, 10);
		expect(knots.t0z).toBeCloseTo(knots.t1z, 10);
	});

	it("zero distance produces zero tangents", () => {
		const same = { x: 5, y: 3, z: 1 };
		const knots = computeTransferKnots(same, same);
		expect(knots.t0x).toBe(0);
		expect(knots.t0y).toBe(0);
		expect(knots.t0z).toBe(0);
		expect(knots.t1x).toBe(0);
		expect(knots.t1y).toBe(0);
		expect(knots.t1z).toBe(0);
	});
});

describe("shouldRespline", () => {
	it("returns false when delta is small", () => {
		expect(shouldRespline(0.01, 100)).toBe(false);
	});

	it("returns true when delta exceeds threshold", () => {
		expect(shouldRespline(5.0, 100)).toBe(true);
	});

	it("threshold scales with remaining distance", () => {
		// At large remaining distance, threshold is remainingDistSq * 0.01
		// At small remaining distance, threshold is 0.25 (absolute floor)
		expect(shouldRespline(0.3, 10)).toBe(true); // 0.3 > max(0.25, 0.1) = 0.25
		expect(shouldRespline(0.3, 1000)).toBe(false); // 0.3 < max(0.25, 10) = 10
	});
});

describe("computeResplineKnots", () => {
	const curPos = { x: 5, y: 0, z: 0 };
	const curDeriv = { x: 10, y: 0, z: 0 };
	const newTarget = { x: 15, y: 0, z: 0 };

	it("preserves departure position", () => {
		const knots = computeResplineKnots(curPos, curDeriv, newTarget, 50, 100);
		expect(knots.p0x).toBe(curPos.x);
		expect(knots.p0y).toBe(curPos.y);
		expect(knots.p0z).toBe(curPos.z);
	});

	it("scales departure tangent by time ratio", () => {
		const knots = computeResplineKnots(curPos, curDeriv, newTarget, 50, 100);
		// scale = 50 / 100 = 0.5
		expect(knots.t0x).toBeCloseTo(curDeriv.x * 0.5, 5);
		expect(knots.t0y).toBeCloseTo(curDeriv.y * 0.5, 5);
		expect(knots.t0z).toBeCloseTo(curDeriv.z * 0.5, 5);
	});

	it("arrival tangent points toward target", () => {
		const knots = computeResplineKnots(curPos, curDeriv, newTarget, 50, 100);
		// newTarget is at (15,0,0), curPos at (5,0,0) -> direction is +x
		expect(knots.t1x).toBeGreaterThan(0);
		expect(knots.t1y).toBeCloseTo(0, 10);
		expect(knots.t1z).toBeCloseTo(0, 10);
	});
});

describe("checkTransferArrival", () => {
	it("returns time-arrived when elapsed >= total", () => {
		const result = checkTransferArrival(100, 90, 5.0, 1.5);
		expect(result.arrived).toBe(true);
		expect(result.reason).toBe("time");
	});

	it("returns distance-arrived when close enough", () => {
		const result = checkTransferArrival(50, 100, 1.0, 1.5);
		expect(result.arrived).toBe(true);
		expect(result.reason).toBe("distance");
	});

	it("returns not-arrived when both conditions fail", () => {
		const result = checkTransferArrival(50, 100, 5.0, 1.5);
		expect(result.arrived).toBe(false);
		expect(result.reason).toBe("none");
	});

	it("time takes priority over distance when both true", () => {
		const result = checkTransferArrival(100, 90, 1.0, 1.5);
		expect(result.arrived).toBe(true);
		expect(result.reason).toBe("time");
	});
});
