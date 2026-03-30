/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { BodyEntry, PlanetEntry } from "../types";

// Mock scene.js to avoid DOM/Three.js side effects at import time
vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	labelContainer: { appendChild: vi.fn() },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
	ZOOM_BASE: 300,
}));

import { GameClock } from "../core/game-clock";
import { state } from "../core/state";
import { setTransferHooks } from "../core/transfers";
import { orbitToWorld } from "../math/orbit";
import { COMET_TRAIL_STEP_ARC } from "../rendering/bodies";
import {
	buildTrailIndices,
	createShip,
	hasAngleCrossed,
	initiateTransfer,
} from "../rendering/rendering";
import { ZOOM_BASE } from "../rendering/scene";
import {
	asteroidProxy,
	showTransferStatus,
	visualCommitTransfer,
} from "../rendering/ship-transfer";

describe("orbitToWorld", () => {
	const PI = Math.PI;

	it("passes through with zero angles (identity)", () => {
		const w = orbitToWorld(10, 5, 0, 0, 0);
		expect(w.x).toBeCloseTo(10);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(5);
	});

	it("90° inclination maps z to y", () => {
		const w = orbitToWorld(0, 5, PI / 2, 0, 0);
		expect(w.x).toBeCloseTo(0);
		expect(w.y).toBeCloseTo(5);
		expect(w.z).toBeCloseTo(0, 5);
	});

	it("180° node rotation negates x and z", () => {
		const w = orbitToWorld(10, 5, 0, PI, 0);
		expect(w.x).toBeCloseTo(-10);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(-5);
	});

	it("90° perihelion argument rotates in orbital plane", () => {
		const w = orbitToWorld(10, 0, 0, 0, PI / 2);
		expect(w.x).toBeCloseTo(0, 5);
		expect(w.y).toBeCloseTo(0);
		expect(w.z).toBeCloseTo(10);
	});

	it("returns the same object reference (reused scratch)", () => {
		const w1 = orbitToWorld(1, 2, 0, 0, 0);
		const ref = w1;
		const w2 = orbitToWorld(3, 4, 0, 0, 0);
		expect(w2).toBe(ref);
	});

	it("combined angles produce expected transformation", () => {
		const inc = PI / 4;
		const w = orbitToWorld(0, 10, inc, 0, 0);
		const expectedY = 10 * Math.sin(inc);
		const expectedZ = 10 * Math.cos(inc);
		expect(w.x).toBeCloseTo(0);
		expect(w.y).toBeCloseTo(expectedY);
		expect(w.z).toBeCloseTo(expectedZ);
	});
});

describe("createShip", () => {
	it("returns ship entry with physics properties", () => {
		state.BODIES = [
			{
				name: "Sun",
				type: "Star" as const,
				distance: 0,
				e: 0,
				period: 0,
				radius: 696340,
				mass: 1.989e30,
				color: "#ffdd44",
				moons: [],
			},
			{
				name: "Earth",
				type: "Planet" as const,
				distance: 1.0,
				e: 0.017,
				period: 1.0,
				radius: 6371,
				mass: 5.972e24,
				color: "#4488ff",
				moons: [],
			},
		];
		state.bodyMeshes = [];

		const entry = createShip({ name: "Ship", hostPlanetName: "Earth" });
		if (!entry) throw new Error("createShip returned undefined");
		expect(entry.isShip).toBe(true);
		expect(entry).toHaveProperty("dryMassKg");
		expect(entry).toHaveProperty("fuelKg");
		expect(entry).toHaveProperty("fuelCapacityKg");
		expect(entry).toHaveProperty("engineId");
		expect(entry.dryMassKg).toBeGreaterThan(0);
		expect(entry.fuelKg).toBeGreaterThan(0);
		expect(entry.fuelCapacityKg).toBeGreaterThan(0);
		expect(typeof entry.engineId).toBe("string");
	});
});

describe("initiateTransfer", () => {
	setTransferHooks(visualCommitTransfer, showTransferStatus, asteroidProxy);

	function setupSystem() {
		state.BODIES = [
			{
				name: "Sun",
				type: "Star" as const,
				distance: 0,
				e: 0,
				period: 0,
				radius: 696340,
				mass: 1.989e30,
				color: "#ffdd44",
				moons: [],
			},
			{
				name: "Earth",
				type: "Planet" as const,
				distance: 1.0,
				e: 0.017,
				period: 1.0,
				radius: 6371,
				mass: 5.972e24,
				color: "#4488ff",
				moons: [],
			},
			{
				name: "Mars",
				type: "Planet" as const,
				distance: 1.524,
				e: 0.093,
				period: 1.881,
				radius: 3390,
				mass: 6.417e23,
				color: "#ff6644",
				moons: [],
			},
		];
		state.bodyMeshes = [];
		state.simTime = new GameClock(0);

		state.BODIES?.forEach((b) => {
			if (b.type !== "Star") {
				state.bodyMeshes.push({
					data: b,
					mesh: { position: { x: 100 * b.distance, y: 0, z: 0, set: vi.fn() } },
					isShip: false,
					isMoon: false,
					isComet: false,
					speed: 0.01,
					angle: 0,
				} as unknown as BodyEntry);
			}
		});

		const ship = createShip({ name: "Ship", hostPlanetName: "Earth" });
		if (!ship) throw new Error("createShip returned undefined");
		return ship;
	}

	it("stores fuel cost for gradual consumption during transfer", () => {
		const ship = setupSystem();
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		// Fuel is NOT deducted upfront -- stored for per-frame consumption
		expect(ship.transferFuelTotal).toBeGreaterThan(0);
		expect(ship.shipState).toBe("transferring");
	});

	it("rejects transfer when fuel is insufficient", () => {
		const ship = setupSystem();
		ship.fuelKg = 1; // near-zero fuel
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		expect(ship.shipState).toBe("orbiting");
	});

	it("uses brachistochrone transfer time (~6 days for Earth-Mars at 0.1g)", () => {
		const ship = setupSystem();
		const mars = state.bodyMeshes.find((e) => e.data.name === "Mars");
		expect(mars).toBeDefined();
		initiateTransfer(ship, mars as unknown as PlanetEntry);
		// Ship goes directly to transferring (no departing state)
		expect(ship.shipState).toBe("transferring");
		// Brachistochrone at 0.1g: ~6 days Earth->Mars
		expect(ship.transferTimeDays).toBeLessThan(15);
		expect(ship.transferTimeDays).toBeGreaterThan(2);
	});
});

describe("buildTrailIndices", () => {
	it("full buffer, head at 0: indices wrap around correctly", () => {
		const max = 5;
		const indices = new Uint16Array(max);
		buildTrailIndices(0, max, max, indices);
		expect(Array.from(indices)).toEqual([0, 1, 2, 3, 4]);
	});

	it("full buffer, head at mid: oldest starts at head", () => {
		const max = 10;
		const indices = new Uint16Array(max);
		buildTrailIndices(5, max, max, indices);
		expect(Array.from(indices)).toEqual([5, 6, 7, 8, 9, 0, 1, 2, 3, 4]);
	});

	it("partially filled buffer: only count entries are set", () => {
		const max = 10;
		const count = 4;
		const indices = new Uint16Array(max);
		buildTrailIndices(4, count, max, indices);
		expect(Array.from(indices.subarray(0, count))).toEqual([0, 1, 2, 3]);
	});

	it("head wraps around: head=2, count=10, max=10", () => {
		const max = 10;
		const indices = new Uint16Array(max);
		buildTrailIndices(2, max, max, indices);
		expect(Array.from(indices)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 0, 1]);
	});

	it("single point: count=1", () => {
		const max = 8;
		const indices = new Uint16Array(max);
		buildTrailIndices(3, 1, max, indices);
		expect(indices[0]).toBe(2);
	});
});

describe("hasAngleCrossed", () => {
	const TWO_PI = Math.PI * 2;

	it("normal crossing: target between prev and cur", () => {
		expect(hasAngleCrossed(1.0, 2.0, 1.5)).toBe(true);
	});

	it("no crossing: cur does not reach target", () => {
		expect(hasAngleCrossed(1.0, 1.4, 1.5)).toBe(false);
	});

	it("wraparound crossing: prev near 2π, cur wraps past 0", () => {
		expect(hasAngleCrossed(6.0, 0.5, 6.2)).toBe(true);
	});

	it("exact match at cur: target equals cur", () => {
		expect(hasAngleCrossed(1.0, 1.5, 1.5)).toBe(true);
	});

	it("exact match at prev: target equals prev", () => {
		expect(hasAngleCrossed(1.5, 2.0, 1.5)).toBe(true);
	});

	it("target just beyond cur: no crossing", () => {
		expect(hasAngleCrossed(1.0, 2.0, 2.1)).toBe(false);
	});

	it("handles angles beyond 2π via normalization", () => {
		// prev=7.28 (≈1.0 mod 2π), cur=8.78 (≈2.5 mod 2π), target=7.78 (≈1.5 mod 2π)
		expect(hasAngleCrossed(TWO_PI + 1.0, TWO_PI + 2.5, TWO_PI + 1.5)).toBe(true);
	});
});

describe("trail sampling threshold", () => {
	it("threshold equals COMET_TRAIL_STEP_ARC when camDist <= ZOOM_BASE", () => {
		const camDist = ZOOM_BASE * 0.5;
		const threshold = COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE);
		expect(threshold).toBe(COMET_TRAIL_STEP_ARC);
	});

	it("threshold equals COMET_TRAIL_STEP_ARC when camDist = ZOOM_BASE", () => {
		const threshold = COMET_TRAIL_STEP_ARC * Math.max(1, ZOOM_BASE / ZOOM_BASE);
		expect(threshold).toBe(COMET_TRAIL_STEP_ARC);
	});

	it("threshold scales up proportionally when camDist > ZOOM_BASE", () => {
		const camDist = ZOOM_BASE * 3;
		const threshold = COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE);
		expect(threshold).toBeCloseTo(COMET_TRAIL_STEP_ARC * 3);
	});

	it("threshold is always >= COMET_TRAIL_STEP_ARC for any positive camDist", () => {
		for (const camDist of [0.001, 1, ZOOM_BASE / 2, ZOOM_BASE, ZOOM_BASE * 10]) {
			const threshold = COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE);
			expect(threshold).toBeGreaterThanOrEqual(COMET_TRAIL_STEP_ARC);
		}
	});
});

describe("asteroid scheduling coverage", () => {
	it("inner belt: parity 0 and 1 over 2 frames covers all indices for stride 2", () => {
		const N = 10;
		const covered = new Set<number>();
		for (const parity of [0, 1]) {
			for (let i = parity; i < N; i += 2) covered.add(i);
		}
		expect(covered.size).toBe(N);
	});

	it("outer belt: slices 0..5 over 6 frames covers all indices for stride 6", () => {
		const N = 12;
		const covered = new Set<number>();
		for (let slice = 0; slice < 6; slice++) {
			for (let i = slice; i < N; i += 6) covered.add(i);
		}
		expect(covered.size).toBe(N);
	});

	it("inner belt: each parity covers exactly half the indices", () => {
		const N = 100;
		for (const parity of [0, 1]) {
			const count = Math.ceil((N - parity) / 2);
			let actual = 0;
			for (let i = parity; i < N; i += 2) actual++;
			expect(actual).toBe(count);
		}
	});
});

// ──────────────────────────────────────────────
// Capture blend regression tests
// ──────────────────────────────────────────────
describe("capture blend (transfer arrival smoothing)", () => {
	// Reproduces the logic from rendering.ts lines 139-160.
	// The capture blend smoothstep steers the ship from the Hermite spline
	// position toward the actual target station-keeping orbit in the final 15%.
	function captureBlend(
		splineX: number,
		splineZ: number,
		targetX: number,
		targetZ: number,
		offset: number,
		t: number,
	): { x: number; z: number } {
		if (t <= 0.85) return { x: splineX, z: splineZ };
		const aAngle = Math.atan2(splineZ - targetZ, splineX - targetX);
		const capX = targetX + Math.cos(aAngle) * offset;
		const capZ = targetZ + Math.sin(aAngle) * offset;
		const blend = (t - 0.85) / 0.15;
		const s = blend * blend * (3 - 2 * blend);
		return {
			x: splineX + (capX - splineX) * s,
			z: splineZ + (capZ - splineZ) * s,
		};
	}

	it("t <= 0.85 returns pure spline position (no blending)", () => {
		const r = captureBlend(10, 5, 20, 15, 1.5, 0.5);
		expect(r.x).toBe(10);
		expect(r.z).toBe(5);
	});

	it("t = 1.0 lands at station-keeping orbit around target", () => {
		const targetX = 20;
		const targetZ = 15;
		const offset = 1.5;
		const r = captureBlend(22, 17, targetX, targetZ, offset, 1.0);
		// Should be exactly offset distance from target
		const dist = Math.hypot(r.x - targetX, r.z - targetZ);
		expect(dist).toBeCloseTo(offset, 3);
	});

	it("smoothly transitions -- t=0.9 is between spline and target", () => {
		const r085 = captureBlend(10, 5, 20, 15, 1.5, 0.85);
		const r090 = captureBlend(10, 5, 20, 15, 1.5, 0.9);
		const r100 = captureBlend(10, 5, 20, 15, 1.5, 1.0);
		// r090 should be between r085 and r100
		const d085to090 = Math.hypot(r090.x - r085.x, r090.z - r085.z);
		const d090to100 = Math.hypot(r100.x - r090.x, r100.z - r090.z);
		const d085to100 = Math.hypot(r100.x - r085.x, r100.z - r085.z);
		expect(d085to090).toBeGreaterThan(0);
		expect(d090to100).toBeGreaterThan(0);
		// Triangle inequality: intermediate point is between endpoints
		expect(d085to090 + d090to100).toBeCloseTo(d085to100, 3);
	});

	it("no jump when prediction is accurate (spline endpoint = target)", () => {
		const offset = 1.5;
		// Spline endpoint is already at the station-keeping orbit
		const targetX = 20;
		const targetZ = 15;
		const angle = Math.atan2(5, 2); // approach angle
		const splineX = targetX + Math.cos(angle) * offset;
		const splineZ = targetZ + Math.sin(angle) * offset;
		const r = captureBlend(splineX, splineZ, targetX, targetZ, offset, 1.0);
		// Should stay at the same position (no correction needed)
		expect(r.x).toBeCloseTo(splineX, 3);
		expect(r.z).toBeCloseTo(splineZ, 3);
	});
});

// ──────────────────────────────────────────────
// Trail distance sampling regression tests
// ──────────────────────────────────────────────
describe("trail distance sampling (ship transfer)", () => {
	// Reproduces the bug: if distance is computed AFTER glue update,
	// it reads back the value we just wrote -> dx=0 always -> no samples.
	// The fix computes distance BEFORE the glue overwrites previous position.

	// Seed the trail with the first position (only called on frame 0).
	function seedTrail(
		positions: Float32Array,
		pos: { x: number; z: number },
		state: { head: number; count: number; sampleCount: number },
	): void {
		positions[0] = pos.x;
		positions[2] = pos.z;
		state.head = 1;
		state.count = 1;
		state.sampleCount++;
	}

	// Compute distance from previous position and update glue (head).
	function updateDistance(
		positions: Float32Array,
		pos: { x: number; z: number },
		maxPoints: number,
		state: { head: number; count: number },
		readBeforeGlue: boolean,
	): number {
		let distThisFrame = 0;

		if (readBeforeGlue && state.count > 0) {
			// CORRECT: read previous position BEFORE glue overwrites it
			const prevIdx = ((state.head - 1 + maxPoints) % maxPoints) * 3;
			distThisFrame = Math.hypot(pos.x - positions[prevIdx], pos.z - positions[prevIdx + 2]);
		}

		// Glue: update head to current position
		if (state.count > 0) {
			const headPhys = ((state.head - 1 + maxPoints) % maxPoints) * 3;
			positions[headPhys] = pos.x;
			positions[headPhys + 2] = pos.z;
		}

		if (!readBeforeGlue && state.count > 0) {
			// BUG: read AFTER glue -- always reads back current position
			const prevIdx = ((state.head - 1 + maxPoints) % maxPoints) * 3;
			distThisFrame = Math.hypot(pos.x - positions[prevIdx], pos.z - positions[prevIdx + 2]);
		}

		return distThisFrame;
	}

	// Record samples based on accumulated distance.
	function recordSamples(
		positions: Float32Array,
		pos: { x: number; z: number },
		maxPoints: number,
		threshold: number,
		state: { head: number; count: number; sampleCount: number; sampleAccum: number },
	): void {
		while (state.sampleAccum > threshold) {
			state.sampleAccum -= threshold;
			const h3 = state.head * 3;
			positions[h3] = pos.x;
			positions[h3 + 2] = pos.z;
			state.head = (state.head + 1) % maxPoints;
			if (state.count < maxPoints) state.count++;
			state.sampleCount++;
		}
	}

	function simulateTrailSampling(
		meshPositions: Array<{ x: number; z: number }>,
		threshold: number,
		readBeforeGlue: boolean,
	): number {
		const maxPoints = 400;
		const positions = new Float32Array(maxPoints * 3);
		const state = { head: 0, count: 0, sampleCount: 0, sampleAccum: 0 };

		for (const pos of meshPositions) {
			if (state.count === 0) {
				seedTrail(positions, pos, state);
			} else {
				const distThisFrame = updateDistance(positions, pos, maxPoints, state, readBeforeGlue);
				state.sampleAccum += distThisFrame;
				recordSamples(positions, pos, maxPoints, threshold, state);
			}
		}
		return state.sampleCount;
	}

	it("BUG: reading after glue produces only the seed point", () => {
		const positions = [];
		for (let i = 0; i < 100; i++) {
			positions.push({ x: i * 0.5, z: i * 0.3 });
		}
		const samples = simulateTrailSampling(positions, 0.3, false);
		// Bug: distance is always 0 after glue, so only the initial seed is recorded
		expect(samples).toBe(1);
	});

	it("FIX: reading before glue produces correct samples", () => {
		const positions = [];
		for (let i = 0; i < 100; i++) {
			positions.push({ x: i * 0.5, z: i * 0.3 });
		}
		const samples = simulateTrailSampling(positions, 0.3, true);
		// Seed + many distance-based samples from steady movement
		expect(samples).toBeGreaterThan(50);
	});

	it("stationary ship produces only the seed point", () => {
		const positions = Array(50).fill({ x: 5, z: 3 });
		const samples = simulateTrailSampling(positions, 0.3, true);
		// Only the initial seed -- no movement means no further samples
		expect(samples).toBe(1);
	});
});
