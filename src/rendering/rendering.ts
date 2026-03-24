import type * as THREE from "three";
import { state } from "../core/state";
import {
	inclinedPosition,
	keplerRadius,
	MOON_DIST_SCALE,
	meanToTrue,
	scaleDist,
} from "../math/orbit";
import { isTransferComplete } from "../math/transfer";
import { moonOrbitScale } from "../math/visual";
import type { CategoryKey, PlanetEntry } from "../types";
import { isCometEntry, isShipEntry } from "../types";
import { COMET_TRAIL_STEP_ARC, findBodyEntry, orbitToWorld } from "./bodies";
import { ZOOM_BASE } from "./scene";
import {
	completeTransfer,
	SHIP_LOCAL_ORBIT,
	transferPosition,
	updateTransferPath,
} from "./ship-transfer";

const TWO_PI = Math.PI * 2;

export function buildTrailIndices(
	head: number,
	count: number,
	maxPoints: number,
	indices: Uint16Array,
): void {
	for (let j = 0; j < count; j++) {
		indices[j] = (head - count + j + maxPoints) % maxPoints;
	}
}

export function hasAngleCrossed(prev: number, cur: number, target: number): boolean {
	const tgt = ((target % TWO_PI) + TWO_PI) % TWO_PI;
	const p = ((prev % TWO_PI) + TWO_PI) % TWO_PI;
	const c = ((cur % TWO_PI) + TWO_PI) % TWO_PI;
	return (p <= tgt && c >= tgt) || (p > c && (p <= tgt || c >= tgt));
}

// Re-export from submodules for backward compatibility
export {
	COMET_ORBIT_OPACITY,
	COMET_ORBIT_SELECTED_OPACITY,
	createAsteroidBelts,
	createBodies,
	createBody,
	createComets,
	orbitToWorld,
	sharedResources,
} from "./bodies";
export { createShip, initiateTransfer } from "./ship-transfer";

// Inner belts (< Jupiter): alternate even/odd halves each frame
let innerParity = 0;
let innerAccumDt0 = 0;
let innerAccumDt1 = 0;
// Outer belts (>= Jupiter): update 1 of 6 slices per frame
const OUTER_SLICES = 6;
let outerSlice = 0;
const outerAccumDt: number[] = Array.from({ length: OUTER_SLICES }, () => 0);
const JUPITER_AU = 5.2;

export function updateAsteroids(dt: number): void {
	const simDt = dt * state.timeSpeed;
	if (simDt === 0) return;

	// Accumulate dt for inner belt halves
	innerAccumDt0 += simDt;
	innerAccumDt1 += simDt;
	// Accumulate dt for all outer slices
	for (let s = 0; s < OUTER_SLICES; s++) outerAccumDt[s] += simDt;

	// Inner: alternate even/odd each frame
	const parity = innerParity;
	innerParity = 1 - innerParity;
	const innerDt = parity === 0 ? innerAccumDt0 : innerAccumDt1;
	if (parity === 0) innerAccumDt0 = 0;
	else innerAccumDt1 = 0;

	// Outer: cycle through 1 of 6 slices per frame
	const slice = outerSlice;
	outerSlice = (outerSlice + 1) % OUTER_SLICES;
	const outerDt = outerAccumDt[slice];
	outerAccumDt[slice] = 0;

	function updateBeltSlice(
		positions: Float32Array,
		angles: Float32Array,
		radii: Float32Array,
		speeds: Float32Array,
		cosInc: Float32Array,
		sinInc: Float32Array,
		cosNode: Float32Array,
		sinNode: Float32Array,
		count: number,
		start: number,
		stride: number,
		dt: number,
	): void {
		for (let i = start; i < count; i += stride) {
			angles[i] += speeds[i] * dt;
			const r = radii[i];
			const x = Math.cos(angles[i]) * r;
			const z = Math.sin(angles[i]) * r;
			const p = inclinedPosition(x, z, cosNode[i], sinNode[i], cosInc[i], sinInc[i]);
			positions[i * 3] = p.x;
			positions[i * 3 + 1] = p.y;
			positions[i * 3 + 2] = p.z;
		}
	}

	state.asteroidBelts.forEach(
		({ belt, positions, angles, radii, speeds, cosInc, sinInc, cosNode, sinNode, count, points }) => {
			if (belt.minAU < JUPITER_AU) {
				updateBeltSlice(
					positions,
					angles,
					radii,
					speeds,
					cosInc,
					sinInc,
					cosNode,
					sinNode,
					count,
					parity,
					2,
					innerDt,
				);
			} else {
				updateBeltSlice(
					positions,
					angles,
					radii,
					speeds,
					cosInc,
					sinInc,
					cosNode,
					sinNode,
					count,
					slice,
					OUTER_SLICES,
					outerDt,
				);
			}
			points.geometry.attributes.position.needsUpdate = true;
		},
	);
}

export function updatePositions(dt: number, camDist: number): void {
	const simDt = dt * state.timeSpeed;
	state.simTime += simDt;
	if (simDt === 0) return;

	const zoomFactor = ZOOM_BASE / camDist;
	const moonScale = moonOrbitScale(zoomFactor);
	state.bodyMeshes.forEach((entry) => {
		if (entry.data.distance === 0 && !isCometEntry(entry) && !isShipEntry(entry)) return;

		// Skip invisible moons
		if (entry.isMoon && !entry.mesh.visible) {
			entry.angle += entry.speed * simDt;
			return;
		}

		// Skip full orbit math for moons when parent is too small on screen
		if (entry.isMoon && entry.parentMesh) {
			const parentScreenSize = (entry.parentMesh.userData.baseSize ?? 1) * zoomFactor;
			if (parentScreenSize < 2) {
				entry.angle += entry.speed * simDt;
				entry.mesh.position.copy(entry.parentMesh.position);
				return;
			}
		}

		if (isShipEntry(entry)) {
			if (entry.shipState === "orbiting") {
				// Station-keeping: hold position near host body with slow visual drift
				entry.angle += entry.speed * simDt;
				const host = findBodyEntry(entry.hostPlanetName);
				if (host) {
					// Offset scales with host's visual size so ship doesn't clip inside large bodies
					const hostSize = host.mesh.userData.baseSize ?? 0.02;
					const offset = Math.max(SHIP_LOCAL_ORBIT * 0.5, hostSize * 1.5);
					const ox = Math.cos(entry.angle) * offset;
					const oz = Math.sin(entry.angle) * offset;
					entry.mesh.position.set(
						host.mesh.position.x + ox,
						host.mesh.position.y,
						host.mesh.position.z + oz,
					);
				}
			} else if (entry.shipState === "transferring") {
				const elapsed = state.simTime - entry.transferStartTime;
				const t = Math.min(elapsed / entry.transferTimeDays, 1);

				// Evaluate frozen Hermite spline — no mid-flight recalculation
				const p = transferPosition(entry, t);
				entry.mesh.position.set(p.x, 0, p.z);

				// Complete when time is up or ship is within station-keeping distance
				const tgt = findBodyEntry(entry.transferTarget ?? "");
				const distToTarget = tgt
					? Math.hypot(p.x - tgt.mesh.position.x, p.z - tgt.mesh.position.z)
					: Number.POSITIVE_INFINITY;

				if (isTransferComplete(elapsed, entry.transferTimeDays) || distToTarget <= SHIP_LOCAL_ORBIT) {
					const entryAngle = tgt ? Math.atan2(p.z - tgt.mesh.position.z, p.x - tgt.mesh.position.x) : 0;
					completeTransfer(entry, entryAngle);
					return;
				}
			}

			if (entry.transferPath) {
				if (entry.shipState === "transferring") {
					const elapsed = state.simTime - entry.transferStartTime;
					updateTransferPath(entry, elapsed);
					entry.transferPath.visible = true;
				} else {
					entry.transferPath.visible = false;
				}
			}

			// Velocity tail: hidden during transfer (path preview covers it)
			if (entry.tailLine) {
				entry.tailLine.visible = false;
				entry.tailCount = 0;
				entry.tailLine.geometry.setDrawRange(0, 0);
			}
		} else if (isCometEntry(entry)) {
			const { a, e, incRad, nodeRad, periRad } = entry.data;
			entry.angle += entry.speed * simDt;

			const theta = meanToTrue(entry.angle, e);
			const r = keplerRadius(a, e, theta);
			const rScaled = scaleDist(r);

			const ox = rScaled * Math.cos(theta);
			const oz = rScaled * Math.sin(theta);
			const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);

			entry.mesh.position.set(w.x, w.y, w.z);
		} else {
			entry.angle += entry.speed * simDt;

			const ecc = entry.data.e || 0;
			const theta = meanToTrue(entry.angle, ecc);
			const kr = keplerRadius(entry.data.distance, ecc, theta);
			const r = entry.isMoon ? kr * MOON_DIST_SCALE * moonScale : scaleDist(kr);
			const x = Math.cos(theta) * r;
			const z = Math.sin(theta) * r;

			if (entry.parentMesh) {
				const px = entry.parentMesh.position.x;
				const pz = entry.parentMesh.position.z;
				entry.mesh.position.set(px + x, 0, pz + z);
				if (entry.orbitLine) {
					entry.orbitLine.position.set(px, 0, pz);
					entry.orbitLine.scale.set(moonScale, 1, moonScale);
				}
			} else {
				entry.mesh.position.set(x, 0, z);
			}
		}

		// Cloud rotation
		if (!isShipEntry(entry) && !isCometEntry(entry) && (entry as PlanetEntry).cloudMesh?.visible) {
			(entry as PlanetEntry).cloudMesh.rotation.y += simDt * 0.002;
		}

		// Trail recording — skip if trails hidden for this category
		const catKey = (entry.isMoon ? "Moon" : entry.data.type) as CategoryKey;
		if (!state.categoryVisibility[catKey].trails) return;

		const t = entry.trail;

		// Always keep the last-drawn vertex glued to the current mesh position
		// so there's no visible gap between sample intervals.
		// With the circular buffer, the newest point is at (head - 1) mod maxPoints.
		if (t.count > 0) {
			const headPhys = ((t.head - 1 + t.maxPoints) % t.maxPoints) * 3;
			t.positions[headPhys] = entry.mesh.position.x;
			t.positions[headPhys + 1] = entry.mesh.position.y;
			t.positions[headPhys + 2] = entry.mesh.position.z;
			t.line.geometry.attributes.position.needsUpdate = true;
		}

		// Comets: accumulate angular distance and sample when threshold reached.
		// Threshold scales up with zoom-out so trails grow longer, but never
		// drops below COMET_TRAIL_STEP_ARC so trails never shrink when zooming in.
		// Non-comets: accumulate sim time with fixed interval.
		const isComet = isCometEntry(entry);
		t.sampleAccum += isComet ? Math.abs(entry.speed * simDt) : simDt;
		const sampleThreshold = isComet ? COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE) : 0.02;
		let trailDirty = false;
		while (t.sampleAccum > sampleThreshold) {
			t.sampleAccum -= sampleThreshold;

			// Circular buffer: overwrite at head, advance head
			const h3 = t.head * 3;
			t.positions[h3] = entry.mesh.position.x;
			t.positions[h3 + 1] = entry.mesh.position.y;
			t.positions[h3 + 2] = entry.mesh.position.z;
			t.colors[h3] = t.baseColor.r;
			t.colors[h3 + 1] = t.baseColor.g;
			t.colors[h3 + 2] = t.baseColor.b;
			t.head = (t.head + 1) % t.maxPoints;
			if (t.count < t.maxPoints) t.count++;
			trailDirty = true;
		}
		if (trailDirty) {
			// Rebuild index array: oldest to newest draw order
			buildTrailIndices(t.head, t.count, t.maxPoints, t.indices);
			t.line.geometry.attributes.position.needsUpdate = true;
			t.line.geometry.attributes.color.needsUpdate = true;
			(t.line.geometry.index as THREE.BufferAttribute).needsUpdate = true;
			t.line.geometry.setDrawRange(0, t.count);
		}
	});
}
