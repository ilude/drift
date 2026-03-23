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

import {
	applyCaptureBlend,
	computeHermiteKnots,
	hermiteEval,
	predictTargetWorld,
	SHIP_LOCAL_ORBIT,
} from "../rendering/ship-transfer";
import type { PlanetEntry } from "../types";

// Minimal PlanetEntry mock — only fields these functions actually read
function makePlanetEntry(x: number, z: number, distanceAU: number, speed = 0.01): PlanetEntry {
	return {
		mesh: { position: { x, y: 0, z } },
		data: { name: "TestPlanet", distance: distanceAU },
		speed,
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
// applyCaptureBlend
// ──────────────────────────────────────────────
describe("applyCaptureBlend", () => {
	it("returns 'blending' when tgtEntry is undefined", () => {
		const p = { x: 0, y: 0, z: 0 };
		expect(applyCaptureBlend(p, undefined, 0.5)).toBe("blending");
	});

	it("returns 'complete' when already within SHIP_LOCAL_ORBIT", () => {
		const planet = makePlanetEntry(10, 0, 1.0);
		// Place p exactly at planet center — dist = 0 < SHIP_LOCAL_ORBIT
		const p = { x: 10, y: 0, z: 0 };
		expect(applyCaptureBlend(p, planet, 1.0)).toBe("complete");
	});

	it("returns 'blending' when outside orbit radius", () => {
		const planet = makePlanetEntry(0, 0, 1.0);
		const p = { x: 100, y: 0, z: 0 };
		expect(applyCaptureBlend(p, planet, 0.5)).toBe("blending");
	});

	it("blend at t=0 leaves position essentially unchanged (blend ≈ 0)", () => {
		const planet = makePlanetEntry(0, 0, 1.0);
		const p = { x: 100, y: 0, z: 0 };
		const xBefore = p.x;
		applyCaptureBlend(p, planet, 0);
		// t^4 = 0, no movement expected
		expect(p.x).toBeCloseTo(xBefore);
	});

	it("blend at t=1 pulls position toward orbit radius", () => {
		const planet = makePlanetEntry(0, 0, 1.0);
		const p = { x: 100, y: 0, z: 0 };
		applyCaptureBlend(p, planet, 1.0);
		// After full blend, p should be at SHIP_LOCAL_ORBIT along x-axis
		expect(p.x).toBeCloseTo(SHIP_LOCAL_ORBIT);
		expect(p.z).toBeCloseTo(0);
	});

	it("mutates p in place", () => {
		const planet = makePlanetEntry(0, 0, 1.0);
		const p = { x: 50, y: 0, z: 0 };
		const originalRef = p;
		applyCaptureBlend(p, planet, 0.8);
		expect(p).toBe(originalRef);
	});
});

// ──────────────────────────────────────────────
// predictTargetWorld
// ──────────────────────────────────────────────
describe("predictTargetWorld", () => {
	it("zero days returns current position (circular orbit approximation)", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0.01);
		const result = predictTargetWorld(planet, 0);
		// Angle is atan2(0, 100) = 0; scaleDist(1.0) * cos(0) = scaleDist(1.0)
		expect(result.x).toBeGreaterThan(0);
		expect(result.z).toBeCloseTo(0);
	});

	it("non-zero days advances the planet along its orbit", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0.01);
		const r0 = predictTargetWorld(planet, 0);
		const x0 = r0.x;
		const z0 = r0.z;

		const r1 = predictTargetWorld(planet, 100);
		// After 100 days of movement the z component should be non-zero
		expect(r1.z).not.toBeCloseTo(z0);
		// Distance from origin should remain equal (circular orbit)
		const dist0 = Math.hypot(x0, z0);
		const dist1 = Math.hypot(r1.x, r1.z);
		expect(dist1).toBeCloseTo(dist0, 3);
	});

	it("returns a scratch object with x and z fields", () => {
		const planet = makePlanetEntry(50, 30, 1.5, 0.005);
		const result = predictTargetWorld(planet, 10);
		expect(typeof result.x).toBe("number");
		expect(typeof result.z).toBe("number");
	});
});

// ──────────────────────────────────────────────
// computeHermiteKnots
// ──────────────────────────────────────────────
describe("computeHermiteKnots", () => {
	it("departure point matches given depart coordinates", () => {
		const planet = makePlanetEntry(100, 0, 1.0);
		const knots = computeHermiteKnots(10, 5, 0, planet, 0);
		expect(knots.p0x).toBeCloseTo(10);
		expect(knots.p0z).toBeCloseTo(5);
	});

	it("arrival point matches predicted target world position", () => {
		// Planet at (100, 0) with speed=0 so it won't move
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		// predictTargetWorld(planet, 0) with speed=0 → atan2(0,100)=0, r = scaleDist(1.0)
		const expectedX = Math.sqrt(1.0) * 200; // DIST_SCALE=200
		expect(knots.p1x).toBeCloseTo(expectedX, 2);
		expect(knots.p1z).toBeCloseTo(0, 2);
	});

	it("departure tangent is rotated 90° from departAngle (CCW perpendicular)", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const angle = Math.PI / 4; // 45°
		const knots = computeHermiteKnots(0, 0, angle, planet, 0);
		const tangentDir = angle + Math.PI / 2;
		// The tangent direction should point in tangentDir; check unit vector matches
		const mag = Math.hypot(knots.t0x, knots.t0z);
		expect(mag).toBeGreaterThan(0);
		expect(knots.t0x / mag).toBeCloseTo(Math.cos(tangentDir), 5);
		expect(knots.t0z / mag).toBeCloseTo(Math.sin(tangentDir), 5);
	});

	it("arrival tangent is perpendicular to radial direction (CCW orbit)", () => {
		// Planet along +x axis; radial direction is 0°, tangent should be 90° (CCW)
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		// targetAngle = atan2(0, predictedX) = 0; targetTangentDir = π/2
		const mag = Math.hypot(knots.t1x, knots.t1z);
		expect(mag).toBeGreaterThan(0);
		const ux = knots.t1x / mag;
		const uz = knots.t1z / mag;
		expect(ux).toBeCloseTo(Math.cos(Math.PI / 2), 5);
		expect(uz).toBeCloseTo(Math.sin(Math.PI / 2), 5);
	});

	it("tangent magnitudes are proportional to travel distance", () => {
		const nearPlanet = makePlanetEntry(10, 0, 0.1, 0);
		const farPlanet = makePlanetEntry(200, 0, 4.0, 0);
		const kNear = computeHermiteKnots(0, 0, 0, nearPlanet, 0);
		const kFar = computeHermiteKnots(0, 0, 0, farPlanet, 0);
		const nearMag = Math.hypot(kNear.t0x, kNear.t0z);
		const farMag = Math.hypot(kFar.t0x, kFar.t0z);
		expect(farMag).toBeGreaterThan(nearMag);
	});
});
