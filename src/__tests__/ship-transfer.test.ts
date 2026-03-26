/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn(), remove: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
}));

import { rebuildEntityMaps } from "../core/entities";
import { state } from "../core/state";
import { keplerRadius, meanToTrue, orbitSpeed, scaleDist } from "../math/orbit";
import {
	completeTransferState,
	computeHermiteKnots,
	distanceKmBetween,
	hermiteDerivative,
	hermiteEval,
	predictTargetWorld,
	setOnTransferComplete,
} from "../rendering/ship-transfer";
import type { BodyEntry, PlanetEntry, ShipEntry } from "../types";

// Minimal PlanetEntry mock -- only fields these functions actually read
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
		const r = hermiteEval(10, 0, 5, 0, 0, 0, 20, 0, 15, 0, 0, 0, 0);
		expect(r.x).toBeCloseTo(10);
		expect(r.z).toBeCloseTo(5);
	});

	it("t=1 returns the arrival point", () => {
		const r = hermiteEval(10, 0, 5, 0, 0, 0, 20, 0, 15, 0, 0, 0, 1);
		expect(r.x).toBeCloseTo(20);
		expect(r.z).toBeCloseTo(15);
	});

	it("midpoint with zero tangents returns average of endpoints", () => {
		const r = hermiteEval(0, 0, 0, 0, 0, 0, 10, 0, 20, 0, 0, 0, 0.5);
		expect(r.x).toBeCloseTo(5);
		expect(r.z).toBeCloseTo(10);
	});

	it("non-zero tangent produces a midpoint different from the zero-tangent case", () => {
		hermiteEval(0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0.5);
		const flatX = hermiteEval(0, 0, 0, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0.5).x;
		const curvedX = hermiteEval(0, 0, 0, 20, 0, 0, 10, 0, 0, 0, 0, 0, 0.5).x;
		expect(curvedX).not.toBeCloseTo(flatX);
	});

	it("returns a Vector3Like (has x, y, z)", () => {
		const r = hermiteEval(1, 0, 2, 0, 0, 0, 3, 0, 4, 0, 0, 0, 0.5);
		expect(typeof r.x).toBe("number");
		expect(typeof r.y).toBe("number");
		expect(typeof r.z).toBe("number");
	});

	it("returns the same scratch object reference on every call", () => {
		const r1 = hermiteEval(0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0.5);
		const ref = r1;
		const r2 = hermiteEval(5, 0, 5, 0, 0, 0, 10, 0, 10, 0, 0, 0, 0.5);
		expect(r2).toBe(ref);
	});

	it("interpolates Y component correctly", () => {
		const r = hermiteEval(0, 10, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0.5);
		expect(r.y).toBeCloseTo(15);
		expect(hermiteEval(0, 10, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 0).y).toBeCloseTo(10);
		expect(hermiteEval(0, 10, 0, 0, 0, 0, 0, 20, 0, 0, 0, 0, 1).y).toBeCloseTo(20);
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
		// Circular orbit (e=0) -- world-space radius is constant
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
		// Star at origin -- speed=0 means no orbital motion
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
		// The angular propagation preserves radius -- perihelion and a later position
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

	it("handles asteroid proxy without angle/e fields (no NaN)", () => {
		// Asteroid proxies are cast as BodyEntry but lack angle and data.e
		const proxy = {
			mesh: { position: { x: 10, y: 0, z: 5 } },
			data: { name: "2024-MB-001", distance: 2.5, type: "Asteroid" },
			speed: orbitSpeed(3),
			isMoon: false,
			isShip: false,
			isComet: false,
			parentMesh: null,
			// angle intentionally omitted -- this is the bug case
		} as unknown as BodyEntry;
		const result = predictTargetWorld(proxy, 100);
		expect(Number.isNaN(result.x)).toBe(false);
		expect(Number.isNaN(result.z)).toBe(false);
		// Should use linear extrapolation -- radius preserved
		const inputR = Math.hypot(10, 5);
		const resultR = Math.hypot(result.x, result.z);
		expect(resultR).toBeCloseTo(inputR, 3);
	});
});

// ──────────────────────────────────────────────
// computeHermiteKnots
// ──────────────────────────────────────────────
describe("computeHermiteKnots", () => {
	it("departure point matches given depart coordinates", () => {
		const planet = makePlanetEntry(100, 0, 1.0);
		const knots = computeHermiteKnots(10, 0, 5, planet, 0);
		expect(knots.p0x).toBeCloseTo(10);
		expect(knots.p0y).toBeCloseTo(0);
		expect(knots.p0z).toBeCloseTo(5);
	});

	it("arrival point matches predicted target world position", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		expect(knots.p1x).toBeCloseTo(100, 2);
		expect(knots.p1z).toBeCloseTo(0, 2);
	});

	it("departure tangent points directly toward target", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		const mag = Math.hypot(knots.t0x, knots.t0z);
		expect(mag).toBeGreaterThan(0);
		expect(knots.t0x / mag).toBeCloseTo(1, 3);
		expect(knots.t0z / mag).toBeCloseTo(0, 3);
	});

	it("arrival tangent points along approach direction", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		const mag = Math.hypot(knots.t1x, knots.t1z);
		expect(mag).toBeGreaterThan(0);
		expect(knots.t1x / mag).toBeCloseTo(1, 3);
		expect(knots.t1z / mag).toBeCloseTo(0, 3);
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

	it("includes Y in knots when target has non-zero Y", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		(planet.mesh.position as { y: number }).y = 5;
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		expect(knots.p1y).toBeCloseTo(5);
		expect(knots.t0y).not.toBe(0);
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

// ──────────────────────────────────────────────
// NaN safety -- incomplete BodyEntry objects
// ──────────────────────────────────────────────
import { stationKeepingOffset } from "../rendering/ship-transfer";

/** Minimal asteroid-like proxy: worst case with most BodyEntry fields missing. */
function minimalProxy(x: number, z: number, speed: number): BodyEntry {
	return {
		mesh: { position: { x, y: 0, z } },
		data: { name: "Proxy", distance: 2.5, type: "Asteroid" },
		speed,
		isMoon: false,
		isShip: false,
		isComet: false,
		parentMesh: null,
	} as unknown as BodyEntry;
}

describe("NaN safety -- incomplete BodyEntry objects", () => {
	it("predictTargetWorld with minimal proxy produces no NaN", () => {
		const proxy = minimalProxy(10, 5, orbitSpeed(3));
		const result = predictTargetWorld(proxy, 100);
		expect(Number.isNaN(result.x)).toBe(false);
		expect(Number.isNaN(result.y)).toBe(false);
		expect(Number.isNaN(result.z)).toBe(false);
	});

	it("predictTargetWorld with zero-speed proxy produces no NaN", () => {
		const proxy = minimalProxy(10, 5, 0);
		const result = predictTargetWorld(proxy, 100);
		expect(Number.isNaN(result.x)).toBe(false);
		expect(Number.isNaN(result.y)).toBe(false);
		expect(Number.isNaN(result.z)).toBe(false);
	});

	it("computeHermiteKnots with minimal proxy produces no NaN in any knot value", () => {
		const proxy = minimalProxy(10, 5, orbitSpeed(3));
		const knots = computeHermiteKnots(0, 0, 0, proxy, 100);
		for (const key of [
			"p0x",
			"p0y",
			"p0z",
			"t0x",
			"t0y",
			"t0z",
			"p1x",
			"p1y",
			"p1z",
			"t1x",
			"t1y",
			"t1z",
		] as const) {
			expect(Number.isNaN(knots[key])).toBe(false);
		}
	});

	it("hermiteEval with knots from minimal proxy produces no NaN", () => {
		const proxy = minimalProxy(10, 5, orbitSpeed(3));
		const knots = computeHermiteKnots(0, 0, 0, proxy, 100);
		for (const t of [0, 0.25, 0.5, 0.75, 1]) {
			const result = hermiteEval(
				knots.p0x,
				knots.p0y,
				knots.p0z,
				knots.t0x,
				knots.t0y,
				knots.t0z,
				knots.p1x,
				knots.p1y,
				knots.p1z,
				knots.t1x,
				knots.t1y,
				knots.t1z,
				t,
			);
			expect(Number.isNaN(result.x)).toBe(false);
			expect(Number.isNaN(result.y)).toBe(false);
			expect(Number.isNaN(result.z)).toBe(false);
		}
	});

	it("distanceKmBetween with minimal proxies produces no NaN", () => {
		const a = minimalProxy(10, 5, orbitSpeed(3));
		const b = minimalProxy(-20, 15, orbitSpeed(5));
		const dist = distanceKmBetween(a, b);
		expect(Number.isNaN(dist)).toBe(false);
		expect(dist).toBeGreaterThan(0);
	});

	it("stationKeepingOffset with minimal proxy (no mesh.userData) produces no NaN", () => {
		const proxy = minimalProxy(10, 5, 0);
		const offset = stationKeepingOffset(proxy);
		expect(Number.isNaN(offset)).toBe(false);
		expect(offset).toBeGreaterThan(0);
	});

	it("computeHermiteKnots with coincident departure and target produces no NaN", () => {
		const proxy = minimalProxy(0, 0, 0);
		const knots = computeHermiteKnots(0, 0, 0, proxy, 0);
		for (const key of [
			"p0x",
			"p0y",
			"p0z",
			"t0x",
			"t0y",
			"t0z",
			"p1x",
			"p1y",
			"p1z",
			"t1x",
			"t1y",
			"t1z",
		] as const) {
			expect(Number.isNaN(knots[key])).toBe(false);
		}
	});
});

// ──────────────────────────────────────────────
// computeHermiteKnots: equal tangent magnitudes
// ──────────────────────────────────────────────
describe("computeHermiteKnots tangent symmetry", () => {
	it("departure and arrival tangents have equal magnitude", () => {
		const planet = makePlanetEntry(100, 0, 1.0, 0);
		const knots = computeHermiteKnots(0, 0, 0, planet, 0);
		const t0mag = Math.hypot(knots.t0x, knots.t0y, knots.t0z);
		const t1mag = Math.hypot(knots.t1x, knots.t1y, knots.t1z);
		expect(t0mag).toBeCloseTo(t1mag, 6);
	});

	it("equal tangent magnitudes hold for diagonal transfers", () => {
		const planet = makePlanetEntry(80, 60, 1.5, 0);
		const knots = computeHermiteKnots(10, 0, 20, planet, 0);
		const t0mag = Math.hypot(knots.t0x, knots.t0y, knots.t0z);
		const t1mag = Math.hypot(knots.t1x, knots.t1y, knots.t1z);
		expect(t0mag).toBeCloseTo(t1mag, 6);
	});
});

// ──────────────────────────────────────────────
// Re-spline continuity: position does not jump when endpoint moves
// ──────────────────────────────────────────────
describe("re-spline endpoint continuity", () => {
	function resplineFromCurrent(
		entry: {
			p0x: number;
			p0y: number;
			p0z: number;
			t0x: number;
			t0y: number;
			t0z: number;
			p1x: number;
			p1y: number;
			p1z: number;
			t1x: number;
			t1y: number;
			t1z: number;
			transferTimeDays: number;
		},
		tEased: number,
		elapsed: number,
		newP1x: number,
		newP1y: number,
		newP1z: number,
	) {
		const curPos = hermiteEval(
			entry.p0x,
			entry.p0y,
			entry.p0z,
			entry.t0x,
			entry.t0y,
			entry.t0z,
			entry.p1x,
			entry.p1y,
			entry.p1z,
			entry.t1x,
			entry.t1y,
			entry.t1z,
			tEased,
		);
		const posBeforeX = curPos.x;
		const posBeforeY = curPos.y;
		const posBeforeZ = curPos.z;

		const curDeriv = hermiteDerivative(
			entry.p0x,
			entry.p0y,
			entry.p0z,
			entry.t0x,
			entry.t0y,
			entry.t0z,
			entry.p1x,
			entry.p1y,
			entry.p1z,
			entry.t1x,
			entry.t1y,
			entry.t1z,
			tEased,
		);

		const remainingDays = Math.max(entry.transferTimeDays - elapsed, 1);
		const dx = newP1x - curPos.x;
		const dy = newP1y - curPos.y;
		const dz = newP1z - curPos.z;
		const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const invDist = dist > 0 ? 1 / dist : 0;
		const tangentMag = dist * 0.4;
		const scale = remainingDays / Math.max(entry.transferTimeDays, 1);

		const newEntry = {
			p0x: curPos.x,
			p0y: curPos.y,
			p0z: curPos.z,
			t0x: curDeriv.x * scale,
			t0y: curDeriv.y * scale,
			t0z: curDeriv.z * scale,
			p1x: newP1x,
			p1y: newP1y,
			p1z: newP1z,
			t1x: dx * invDist * tangentMag,
			t1y: dy * invDist * tangentMag,
			t1z: dz * invDist * tangentMag,
			transferTimeDays: remainingDays,
		};

		const posAfter = hermiteEval(
			newEntry.p0x,
			newEntry.p0y,
			newEntry.p0z,
			newEntry.t0x,
			newEntry.t0y,
			newEntry.t0z,
			newEntry.p1x,
			newEntry.p1y,
			newEntry.p1z,
			newEntry.t1x,
			newEntry.t1y,
			newEntry.t1z,
			0,
		);

		return {
			posBeforeX,
			posBeforeY,
			posBeforeZ,
			posAfterX: posAfter.x,
			posAfterY: posAfter.y,
			posAfterZ: posAfter.z,
		};
	}

	it("position is continuous when arrival endpoint moves mid-transfer", () => {
		const knots = computeHermiteKnots(0, 0, 0, makePlanetEntry(100, 0, 1.0, 0), 365);
		const entry = { ...knots, transferTimeDays: 365 };

		const t = 0.4;
		const tEased = t * t * (3 - 2 * t);
		const elapsed = 365 * t;

		const r = resplineFromCurrent(entry, tEased, elapsed, 95, 0, 20);
		expect(
			Math.sqrt(
				(r.posAfterX - r.posBeforeX) ** 2 +
					(r.posAfterY - r.posBeforeY) ** 2 +
					(r.posAfterZ - r.posBeforeZ) ** 2,
			),
		).toBeLessThan(0.01);
	});

	it("position is continuous for a transfer near completion (80%)", () => {
		const knots = computeHermiteKnots(0, 0, 0, makePlanetEntry(50, 50, 1.0, 0), 200);
		const entry = { ...knots, transferTimeDays: 200 };

		const t = 0.8;
		const tEased = t * t * (3 - 2 * t);
		const elapsed = 200 * t;

		const r = resplineFromCurrent(entry, tEased, elapsed, 52, 0, 48);
		expect(
			Math.sqrt(
				(r.posAfterX - r.posBeforeX) ** 2 +
					(r.posAfterY - r.posBeforeY) ** 2 +
					(r.posAfterZ - r.posBeforeZ) ** 2,
			),
		).toBeLessThan(0.01);
	});
});

// ──────────────────────────────────────────────
// completeTransferState
// ──────────────────────────────────────────────

function makeTransferShip(
	transferTarget: string,
	overrides: Record<string, unknown> = {},
): ShipEntry {
	return {
		shipState: "transferring",
		transferTarget,
		hostPlanetName: "Earth",
		transferFuelTotal: 5_000,
		pendingTransfer: { foo: 1 },
		speed: 0.5,
		angle: Math.PI / 4,
		data: { name: "ISS-1", distance: 1.0 },
		orbitA: 1.0,
		trail: {
			count: 50,
			head: 25,
			sampleAccum: 0.3,
			line: { geometry: { setDrawRange: vi.fn() } },
		},
		mesh: { position: { x: 0, y: 0, z: 0 } },
		...overrides,
	} as unknown as ShipEntry;
}

function makePlanetBody(name: string, distanceAU: number): PlanetEntry {
	return {
		data: { name, distance: distanceAU, type: "Planet" },
		mesh: { position: { x: 50, y: 0, z: 0 } },
		isMoon: false,
		parentMesh: null,
		angle: 0,
		speed: 0,
	} as unknown as PlanetEntry;
}

describe("completeTransferState", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
		rebuildEntityMaps();
		setOnTransferComplete(() => {});
	});

	it("sets shipState to orbiting and clears all transfer fields", () => {
		const ship = makeTransferShip("Mars");
		completeTransferState(ship);

		expect(ship.shipState).toBe("orbiting");
		expect(ship.transferTarget).toBeNull();
		expect(ship.transferFuelTotal).toBe(0);
		expect(ship.pendingTransfer).toBeNull();
	});

	it("resets trail counters and calls setDrawRange(0, 0)", () => {
		const ship = makeTransferShip("Mars");
		completeTransferState(ship);

		expect(ship.trail.count).toBe(0);
		expect(ship.trail.head).toBe(0);
		expect(ship.trail.sampleAccum).toBe(0);
		expect(ship.trail.line.geometry.setDrawRange).toHaveBeenCalledWith(0, 0);
	});

	it("sets hostPlanetName from transferTarget when body not found", () => {
		const ship = makeTransferShip("Unknown-Body");
		completeTransferState(ship);

		expect(ship.hostPlanetName).toBe("Unknown-Body");
		expect(ship.angle).toBe(0);
	});

	it("updates hostPlanetName, distance, and orbitA from target body", () => {
		state.bodyMeshes = [makePlanetBody("Mars", 1.524)];
		rebuildEntityMaps();

		const ship = makeTransferShip("Mars");
		completeTransferState(ship);

		expect(ship.hostPlanetName).toBe("Mars");
		expect(ship.data.distance).toBeCloseTo(1.524);
		expect(ship.orbitA).toBeCloseTo(1.524);
		expect(ship.angle).toBe(0);
	});

	it("uses parent planet as hostPlanetName when target is a moon", () => {
		const earthMesh = { position: { x: 10, y: 0, z: 0 } };
		const earth = {
			data: { name: "Earth", distance: 1.0, type: "Planet" },
			mesh: earthMesh,
			isMoon: false,
			parentMesh: null,
			angle: 0,
			speed: 0,
		} as unknown as PlanetEntry;
		const luna = {
			data: { name: "Luna", distance: 0.0026, type: "Moon" },
			mesh: { position: { x: 10.5, y: 0, z: 0 } },
			isMoon: true,
			parentMesh: earthMesh, // same reference as earth.mesh
			angle: 0,
			speed: 0,
		} as unknown as PlanetEntry;
		state.bodyMeshes = [earth, luna];
		rebuildEntityMaps();

		const ship = makeTransferShip("Luna");
		completeTransferState(ship);

		expect(ship.hostPlanetName).toBe("Earth");
	});

	it("sets station-keeping speed and resets angle to 0", () => {
		const ship = makeTransferShip("Mars", { angle: Math.PI / 2, speed: 5 });
		completeTransferState(ship);

		expect(ship.angle).toBe(0);
		// SHIP_LOCAL_SPEED ≈ 2π/365 ≈ 0.0172 rad/day
		expect(ship.speed).toBeGreaterThan(0);
		expect(ship.speed).toBeLessThan(0.1);
	});

	it("calls onTransferCompleteHook with the ship", () => {
		const hook = vi.fn();
		setOnTransferComplete(hook);

		const ship = makeTransferShip("Mars");
		completeTransferState(ship);

		expect(hook).toHaveBeenCalledOnce();
		expect(hook).toHaveBeenCalledWith(ship);
	});
});
