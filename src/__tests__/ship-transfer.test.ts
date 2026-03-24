/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn(), remove: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
}));

import { keplerRadius, meanToTrue, orbitSpeed, scaleDist } from "../math/orbit";
import {
	computeHermiteKnots,
	distanceKmBetween,
	hermiteEval,
	predictTargetWorld,
} from "../rendering/ship-transfer";
import type { BodyEntry, PlanetEntry } from "../types";

// Minimal PlanetEntry mock — only fields these functions actually read
function makePlanetEntry(x: number, z: number, distanceAU: number, speed = 0.01): PlanetEntry {
	return {
		mesh: { position: { x, y: 0, z } },
		data: { name: "TestPlanet", distance: distanceAU, e: 0 },
		angle: 0,
		speed,
		isMoon: false,
		isShip: false,
		isComet: false,
		parentMesh: null,
	} as unknown as PlanetEntry;
}

// ──────────────────────────────────────────────
// hermiteEval
// ──────────────────────────────────────────────
describe("hermiteEval", () => {
	it("t=0 returns the departure point", () => {
		const r = hermiteEval(10, 5, 0, 0, 20, 15, 0, 0, 0);
		expect(r.x).toBeCloseTo(10);
		expect(r.z).toBeCloseTo(5);
	});

	it("t=1 returns the arrival point", () => {
		const r = hermiteEval(10, 5, 0, 0, 20, 15, 0, 0, 1);
		expect(r.x).toBeCloseTo(20);
		expect(r.z).toBeCloseTo(15);
	});

	it("midpoint with zero tangents returns average of endpoints", () => {
		const r = hermiteEval(0, 0, 0, 0, 10, 20, 0, 0, 0.5);
		expect(r.x).toBeCloseTo(5);
		expect(r.z).toBeCloseTo(10);
	});

	it("non-zero tangent produces a midpoint different from the zero-tangent case", () => {
		// hermiteEval reuses a scratch object, so capture values before the next call
		hermiteEval(0, 0, 0, 0, 10, 0, 0, 0, 0.5);
		const flatX = hermiteEval(0, 0, 0, 0, 10, 0, 0, 0, 0.5).x; // 5.0
		// h10 at t=0.5 = 0.5*(0.5)^2 = 0.125 → t0x=20 contributes 2.5, giving x=7.5
		const curvedX = hermiteEval(0, 0, 20, 0, 10, 0, 0, 0, 0.5).x;
		expect(curvedX).not.toBeCloseTo(flatX);
	});

	it("returns a Vector3Like (has x, y, z)", () => {
		const r = hermiteEval(1, 2, 0, 0, 3, 4, 0, 0, 0.5);
		expect(typeof r.x).toBe("number");
		expect(typeof r.y).toBe("number");
		expect(typeof r.z).toBe("number");
	});

	it("returns the same scratch object reference on every call", () => {
		const r1 = hermiteEval(0, 0, 0, 0, 1, 1, 0, 0, 0.5);
		const ref = r1;
		const r2 = hermiteEval(5, 5, 0, 0, 10, 10, 0, 0, 0.5);
		expect(r2).toBe(ref);
	});
});

// ──────────────────────────────────────────────
// predictTargetWorld
// ──────────────────────────────────────────────

function mockTarget(overrides: Record<string, unknown> = {}): BodyEntry {
	return {
		mesh: { position: { x: 10, y: 0, z: 0 } },
		angle: 0,
		speed: orbitSpeed(1), // 1 year period
		data: { distance: 1, e: 0, type: "Planet", name: "Test" },
		isMoon: false,
		isShip: false,
		isComet: false,
		parentMesh: null,
		...overrides,
	} as unknown as BodyEntry;
}

describe("predictTargetWorld", () => {
	it("zero days returns Kepler position at current mean anomaly", () => {
		// Planet at 1 AU, e=0, angle=0 → position is (scaleDist(1), 0)
		const distAU = 1.0;
		const r = scaleDist(distAU);
		const planet = makePlanetEntry(r, 0, distAU, orbitSpeed(1));
		const result = predictTargetWorld(planet, 0);
		expect(result.x).toBeCloseTo(r, 3);
		expect(result.z).toBeCloseTo(0, 3);
	});

	it("non-zero days advances the planet along its Kepler orbit", () => {
		// Circular orbit (e=0) — world-space radius is constant
		const distAU = 1.0;
		const r = scaleDist(distAU);
		const planet = makePlanetEntry(r, 0, distAU, orbitSpeed(1));

		const r0 = predictTargetWorld(planet, 0);
		const dist0 = Math.hypot(r0.x, r0.z);

		const r1 = predictTargetWorld(planet, 100);
		// After 100 days the z component should be non-zero
		expect(r1.z).not.toBeCloseTo(0);
		// Circular orbit: world-space radius stays constant
		const dist1 = Math.hypot(r1.x, r1.z);
		expect(dist1).toBeCloseTo(dist0, 3);
	});

	it("returns a scratch object with x and z fields", () => {
		const planet = makePlanetEntry(50, 30, 1.5, 0.005);
		const result = predictTargetWorld(planet, 10);
		expect(typeof result.x).toBe("number");
		expect(typeof result.z).toBe("number");
	});

	it("stationary body (speed=0) returns current mesh position", () => {
		// Star at origin — speed=0 means no orbital motion
		const star = mockTarget({ mesh: { position: { x: 0, y: 0, z: 0 } }, speed: 0 });
		const result = predictTargetWorld(star, 100);
		expect(result.x).toBeCloseTo(0);
		expect(result.z).toBeCloseTo(0);
	});

	it("circular orbit advances ~90 degrees after a quarter period", () => {
		// Body at (scaleDist(1), 0) with a 1-year circular orbit
		const r = scaleDist(1);
		const body = mockTarget({ mesh: { position: { x: r, y: 0, z: 0 } }, speed: orbitSpeed(1) });
		const quarterYear = 365.25 / 4;
		const result = predictTargetWorld(body, quarterYear);
		// Radius should stay the same (circular orbit, no eccentricity in angular propagation)
		expect(Math.hypot(result.x, result.z)).toBeCloseTo(r, 3);
		// Angle should be ~π/2
		const angle = Math.atan2(result.z, result.x);
		expect(angle).toBeCloseTo(Math.PI / 2, 2);
	});

	it("two different positions in same orbit have equal world-space radii", () => {
		// The angular propagation preserves radius — perihelion and a later position
		// both sit at currentR, so two snapshots 180 days apart share the same radius
		const r = scaleDist(1);
		const body = mockTarget({ mesh: { position: { x: r, y: 0, z: 0 } }, speed: orbitSpeed(1) });
		const r0 = predictTargetWorld(body, 0);
		const radius0 = Math.hypot(r0.x, r0.z);
		const r1 = predictTargetWorld(body, 365.25 / 2);
		const radius1 = Math.hypot(r1.x, r1.z);
		expect(radius1).toBeCloseTo(radius0, 3);
	});

	it("prediction matches manual Kepler propagation", () => {
		// Verify: futureM = angle + speed*days → theta via meanToTrue → keplerRadius → scaleDist
		const distAU = 2.0;
		const ecc = 0.1;
		const speed = orbitSpeed(2); // 2-year period
		const startAngle = 0.5; // non-zero mean anomaly
		const days = 200;
		const body = mockTarget({
			mesh: { position: { x: scaleDist(distAU), y: 0, z: 0 } },
			speed,
			angle: startAngle,
			data: { distance: distAU, e: ecc, type: "Planet", name: "Test" },
		});
		const result = predictTargetWorld(body, days);
		const futureM = startAngle + speed * days;
		const theta = meanToTrue(futureM, ecc);
		const kr = keplerRadius(distAU, ecc, theta);
		const expectedX = Math.cos(theta) * scaleDist(kr);
		const expectedZ = Math.sin(theta) * scaleDist(kr);
		expect(result.x).toBeCloseTo(expectedX, 5);
		expect(result.z).toBeCloseTo(expectedZ, 5);
	});

	it("returns the same scratch object reference on every call (no allocation)", () => {
		const body = mockTarget();
		const ref = predictTargetWorld(body, 0);
		const second = predictTargetWorld(body, 10);
		expect(second).toBe(ref);
	});
});

// ──────────────────────────────────────────────
// computeHermiteKnots
// ──────────────────────────────────────────────
describe("computeHermiteKnots", () => {
	it("departure point matches given depart coordinates", () => {
		const planet = makePlanetEntry(100, 0, 1.0);
		const knots = computeHermiteKnots(10, 5, planet, 0);
		expect(knots.p0x).toBeCloseTo(10);
		expect(knots.p0z).toBeCloseTo(5);
	});

	it("arrival point matches predicted target world position", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, planet, 0);
		expect(knots.p1x).toBeCloseTo(100, 2);
		expect(knots.p1z).toBeCloseTo(0, 2);
	});

	it("departure tangent points directly toward target", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, planet, 0);
		// Both tangents should point along +x (direct line to target)
		const mag = Math.hypot(knots.t0x, knots.t0z);
		expect(mag).toBeGreaterThan(0);
		expect(knots.t0x / mag).toBeCloseTo(1, 3);
		expect(knots.t0z / mag).toBeCloseTo(0, 3);
	});

	it("arrival tangent points along approach direction", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, planet, 0);
		const mag = Math.hypot(knots.t1x, knots.t1z);
		expect(mag).toBeGreaterThan(0);
		expect(knots.t1x / mag).toBeCloseTo(1, 3);
		expect(knots.t1z / mag).toBeCloseTo(0, 3);
	});

	it("tangent magnitudes are proportional to travel distance", () => {
		const nearPlanet = makePlanetEntry(10, 0, 0.1, 0);
		const farPlanet = makePlanetEntry(200, 0, 4.0, 0);
		const kNear = computeHermiteKnots(0, 0, nearPlanet, 0);
		const kFar = computeHermiteKnots(0, 0, farPlanet, 0);
		const nearMag = Math.hypot(kNear.t0x, kNear.t0z);
		const farMag = Math.hypot(kFar.t0x, kFar.t0z);
		expect(farMag).toBeGreaterThan(nearMag);
	});
});

// ──────────────────────────────────────────────
// distanceKmBetween
// ──────────────────────────────────────────────
describe("distanceKmBetween", () => {
	const AU_TO_KM = 149_597_870.7;

	// Helper: place a body at a given AU radius and angle (radians) in the XZ plane.
	// DIST_SCALE = 200 (from math/orbit.ts), world coord = sqrt(au) * DIST_SCALE
	const DIST_SCALE = 200;
	function makeBodyAtAngle(auRadius: number, angleRad: number, isMoon = false) {
		const worldR = Math.sqrt(auRadius) * DIST_SCALE;
		return {
			mesh: { position: { x: Math.cos(angleRad) * worldR, y: 0, z: Math.sin(angleRad) * worldR } },
			data: { name: "Test", distance: auRadius },
			isMoon,
		} as unknown as Parameters<typeof distanceKmBetween>[0];
	}

	it("same position returns zero distance", () => {
		const a = makeBodyAtAngle(1.0, 0);
		const b = makeBodyAtAngle(1.0, 0);
		expect(distanceKmBetween(a, b)).toBeCloseTo(0);
	});

	it("opposite sides of star at same radius returns 2x the radius", () => {
		// Two bodies at 1 AU on opposite sides: chord = 2 AU
		const a = makeBodyAtAngle(1.0, 0);
		const b = makeBodyAtAngle(1.0, Math.PI);
		expect(distanceKmBetween(a, b)).toBeCloseTo(2.0 * AU_TO_KM, -3);
	});

	it("is greater than radial difference for bodies on opposite sides", () => {
		// 1 AU and 1.5 AU on opposite sides: real dist ≈ 2.5 AU, old formula gave 0.5 AU
		const a = makeBodyAtAngle(1.0, 0);
		const b = makeBodyAtAngle(1.5, Math.PI);
		const dist = distanceKmBetween(a, b);
		const radialDiff = Math.abs(1.5 - 1.0) * AU_TO_KM;
		expect(dist).toBeGreaterThan(radialDiff * 4); // should be ~2.5x larger, not 0.5 AU
	});

	it("90 degrees apart at same radius returns sqrt(2) times the radius", () => {
		const a = makeBodyAtAngle(1.0, 0);
		const b = makeBodyAtAngle(1.0, Math.PI / 2);
		expect(distanceKmBetween(a, b)).toBeCloseTo(Math.SQRT2 * AU_TO_KM, -3);
	});
});
