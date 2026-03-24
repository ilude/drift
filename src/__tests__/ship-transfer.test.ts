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
	computeHermiteKnots,
	distanceKmBetween,
	hermiteEval,
	predictTargetWorld,
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
// predictTargetWorld
// ──────────────────────────────────────────────
describe("predictTargetWorld", () => {
	it("zero days returns current position", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0.01);
		const result = predictTargetWorld(planet, 0);
		// Uses mesh position directly: currentR = 100, angle = 0
		expect(result.x).toBeCloseTo(100);
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
