import type * as THREE from "three";
import { findAsteroidEntity, findBody } from "../core/entities";
import { gameLog, state } from "../core/state";
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
import { COMET_TRAIL_STEP_ARC, orbitToWorld } from "./bodies";
import { ZOOM_BASE } from "./scene";
import {
	asteroidProxy,
	completeTransfer,
	hermiteDerivative,
	SHIP_LOCAL_ORBIT,
	stationKeepingOffset,
	transferPosition,
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
	createComets,
	orbitToWorld,
	sharedResources,
} from "./bodies";
export { createShip, initiateTransfer } from "./ship-transfer";

export function updateAsteroids(dt: number): void {
	const simDt = dt * state.timeSpeed;
	if (simDt === 0) return;

	state.asteroidBelts.forEach(
		({ positions, angles, radii, speeds, cosInc, sinInc, cosNode, sinNode, count, points }) => {
			for (let i = 0; i < count; i++) {
				angles[i] += speeds[i] * simDt;
				const r = radii[i];
				const x = Math.cos(angles[i]) * r;
				const z = Math.sin(angles[i]) * r;
				const p = inclinedPosition(x, z, cosNode[i], sinNode[i], cosInc[i], sinInc[i]);
				positions[i * 3] = p.x;
				positions[i * 3 + 1] = p.y;
				positions[i * 3 + 2] = p.z;
			}
			points.geometry.attributes.position.needsUpdate = true;
		},
	);
}

export function updatePositions(dt: number, camDist: number): void {
	const simDt = dt * state.timeSpeed;
	state.simTime.advanceDays(simDt);
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
				let host = findBody(entry.hostPlanetName);
				// Fall back to asteroid lookup if host is not a regular body
				if (!host) {
					const hit = findAsteroidEntity(entry.hostPlanetName);
					if (hit) host = asteroidProxy(hit.asteroid, hit.beltEntry);
				}
				if (host) {
					const offset = stationKeepingOffset(host);
					const ox = Math.cos(entry.angle) * offset;
					const oz = Math.sin(entry.angle) * offset;
					entry.mesh.position.set(
						host.mesh.position.x + ox,
						host.mesh.position.y,
						host.mesh.position.z + oz,
					);
				}
			} else if (entry.shipState === "transferring") {
				const elapsed = state.simTime.days - entry.transferStartTime;
				const t = Math.min(elapsed / entry.transferTimeDays, 1);
				// Smoothstep easing: symmetric acceleration/deceleration
				const tEased = t * t * (3 - 2 * t);

				// Look up target each frame for live tracking
				let tgt = findBody(entry.transferTarget ?? "");
				if (!tgt) {
					const hit = findAsteroidEntity(entry.transferTarget ?? "");
					if (hit) tgt = asteroidProxy(hit.asteroid, hit.beltEntry);
				}

				// Re-spline from the ship's current evaluated position whenever
				// the arrival endpoint has moved significantly. This prevents
				// Hermite basis functions from retroactively shifting the ship's
				// current position when P1 changes mid-transfer.
				if (tgt) {
					const offset = stationKeepingOffset(tgt);
					const approachAngle = Math.atan2(
						entry.mesh.position.z - tgt.mesh.position.z,
						entry.mesh.position.x - tgt.mesh.position.x,
					);
					const newP1x = tgt.mesh.position.x + Math.cos(approachAngle) * offset;
					const newP1y = tgt.mesh.position.y ?? 0;
					const newP1z = tgt.mesh.position.z + Math.sin(approachAngle) * offset;
					const endpointDelta = Math.sqrt(
						(newP1x - entry.p1x) ** 2 + (newP1y - entry.p1y) ** 2 + (newP1z - entry.p1z) ** 2,
					);

					// Only re-spline in the first 80% of transfer (let capture blend handle the rest)
					// and only when endpoint drift is significant relative to remaining distance
					const remainingDist = Math.sqrt(
						(newP1x - entry.mesh.position.x) ** 2 +
							(newP1y - entry.mesh.position.y) ** 2 +
							(newP1z - entry.mesh.position.z) ** 2,
					);
					const shouldRespline = t < 0.8 && endpointDelta > Math.max(0.5, remainingDist * 0.1);

					if (shouldRespline) {
						gameLog(
							`[re-spline] ${entry.data.name}: delta=${endpointDelta.toFixed(3)} t=${t.toFixed(4)} remaining=${(entry.transferTimeDays - elapsed).toFixed(1)}d fuel=${entry.fuelKg.toFixed(0)}kg fuelBudget=${entry.transferFuelTotal.toFixed(0)}kg`,
						);
						// Evaluate current position and velocity on the old spline
						const curPos = transferPosition(entry, tEased);
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

						// Build new spline from current position to updated target
						const remainingDays = Math.max(entry.transferTimeDays - elapsed, 0.01);
						const dx = newP1x - curPos.x;
						const dy = newP1y - curPos.y;
						const dz = newP1z - curPos.z;
						const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
						const invDist = dist > 0 ? 1 / dist : 0;
						const tangentMag = dist * 0.4;

						entry.p0x = curPos.x;
						entry.p0y = curPos.y;
						entry.p0z = curPos.z;
						// Scale derivative from old spline's [0,1] space to new remaining days
						const scale = remainingDays / Math.max(entry.transferTimeDays, 0.01);
						entry.t0x = curDeriv.x * scale;
						entry.t0y = curDeriv.y * scale;
						entry.t0z = curDeriv.z * scale;
						entry.p1x = newP1x;
						entry.p1y = newP1y;
						entry.p1z = newP1z;
						entry.t1x = dx * invDist * tangentMag;
						entry.t1y = dy * invDist * tangentMag;
						entry.t1z = dz * invDist * tangentMag;
						entry.transferStartTime = state.simTime.days;
						// Scale fuel budget proportionally so burn rate stays correct
						if (entry.transferTimeDays > 0) {
							entry.transferFuelTotal *= remainingDays / entry.transferTimeDays;
						}
						entry.transferTimeDays = remainingDays;
					} else if (tgt) {
						// Light endpoint update without re-splining: just track the target
						// position so the spline endpoint stays current
						entry.p1x = newP1x;
						entry.p1y = newP1y;
						entry.p1z = newP1z;
					}
				}

				// Evaluate Hermite spline with eased t and live-tracked endpoint.
				// Re-read elapsed after potential re-spline (transferStartTime may have changed).
				const elapsedNow = state.simTime.days - entry.transferStartTime;
				const tNow = Math.min(elapsedNow / entry.transferTimeDays, 1);
				const tEasedNow = tNow * tNow * (3 - 2 * tNow);
				const p = transferPosition(entry, tEasedNow);

				// Capture blend: smoothly steer toward station-keeping orbit in final 15%
				let finalX = p.x;
				let finalY = p.y;
				let finalZ = p.z;
				if (tNow > 0.85 && tgt) {
					const blendRaw = (tNow - 0.85) / 0.15;
					const blend = blendRaw * blendRaw * (3 - 2 * blendRaw);
					const capOffset = stationKeepingOffset(tgt);
					const capAngle = Math.atan2(p.z - tgt.mesh.position.z, p.x - tgt.mesh.position.x);
					const capX = tgt.mesh.position.x + Math.cos(capAngle) * capOffset;
					const capY = tgt.mesh.position.y ?? 0;
					const capZ = tgt.mesh.position.z + Math.sin(capAngle) * capOffset;
					finalX = p.x + blend * (capX - p.x);
					finalY = p.y + blend * (capY - p.y);
					finalZ = p.z + blend * (capZ - p.z);
				}
				entry.mesh.position.set(finalX, finalY, finalZ);

				// Sub-step trail: at high warp the ship may cover many trail-step distances
				// in a single frame. Inject intermediate Hermite-sampled points so the trail
				// looks continuous instead of showing large gaps between frame positions.
				if (entry.trail.count > 0 && entry.transferTimeDays > 0) {
					const tStep = simDt / entry.transferTimeDays;
					if (tStep > 1 / 30) {
						const tPrev = Math.max(0, tNow - tStep);
						const nSteps = Math.ceil(tStep * 30);
						const tr = entry.trail;
						for (let s = 1; s <= nSteps; s++) {
							const tInterp = tPrev + (tNow - tPrev) * (s / nSteps);
							const tInterpEased = tInterp * tInterp * (3 - 2 * tInterp);
							const ip = transferPosition(entry, tInterpEased);
							const h3 = tr.head * 3;
							tr.positions[h3] = ip.x;
							tr.positions[h3 + 1] = ip.y;
							tr.positions[h3 + 2] = ip.z;
							tr.colors[h3] = tr.baseColor.r;
							tr.colors[h3 + 1] = tr.baseColor.g;
							tr.colors[h3 + 2] = tr.baseColor.b;
							tr.head = (tr.head + 1) % tr.maxPoints;
							if (tr.count < tr.maxPoints) tr.count++;
						}
						// Reset accumulator so normal distance-based sampling restarts cleanly
						tr.sampleAccum = 0;
						// Rebuild indices and apply fade
						buildTrailIndices(tr.head, tr.count, tr.maxPoints, tr.indices);
						for (let j = 0; j < tr.count; j++) {
							const fade = tr.count > 1 ? j / (tr.count - 1) : 1;
							const idx = tr.indices[j] * 3;
							tr.colors[idx] = tr.baseColor.r * fade;
							tr.colors[idx + 1] = tr.baseColor.g * fade;
							tr.colors[idx + 2] = tr.baseColor.b * fade;
						}
						tr.line.geometry.attributes.position.needsUpdate = true;
						tr.line.geometry.attributes.color.needsUpdate = true;
						(tr.line.geometry.index as import("three").BufferAttribute).needsUpdate = true;
						tr.line.geometry.setDrawRange(0, tr.count);
					}
				}

				// Complete when time is up or within station-keeping distance
				const distToTarget = tgt
					? Math.sqrt(
							(entry.mesh.position.x - tgt.mesh.position.x) ** 2 +
								(entry.mesh.position.y - (tgt.mesh.position.y ?? 0)) ** 2 +
								(entry.mesh.position.z - tgt.mesh.position.z) ** 2,
						)
					: Number.POSITIVE_INFINITY;

				// Log completion check every ~30 frames (once per second at 30fps)
				if (Math.floor(state.simTime.days * 30) % 30 === 0) {
					gameLog(
						`[transfer] ${entry.data.name}: tNow=${tNow.toFixed(4)} elapsed=${elapsedNow.toFixed(2)}d/${entry.transferTimeDays.toFixed(2)}d dist=${distToTarget.toFixed(3)} fuel=${entry.fuelKg.toFixed(0)}kg stationOrbit=${SHIP_LOCAL_ORBIT}`,
					);
				}

				if (
					isTransferComplete(elapsedNow, entry.transferTimeDays) ||
					distToTarget <= SHIP_LOCAL_ORBIT
				) {
					gameLog(
						`[transfer-complete] ${entry.data.name}: reason=${isTransferComplete(elapsedNow, entry.transferTimeDays) ? "time" : "distance"} dist=${distToTarget.toFixed(3)} t=${tNow.toFixed(4)} fuel=${entry.fuelKg.toFixed(0)}kg`,
					);
					const entryAngle = tgt
						? Math.atan2(
								entry.mesh.position.z - tgt.mesh.position.z,
								entry.mesh.position.x - tgt.mesh.position.x,
							)
						: 0;
					completeTransfer(entry, entryAngle);
					return;
				}
			}

			// Velocity tail: hidden for ships (trail covers transfers)
			if (entry.tailLine) {
				entry.tailLine.visible = false;
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

		// Trail recording -- skip if trails hidden for this category
		const catKey = (entry.isMoon ? "Moon" : entry.data.type) as CategoryKey;
		if (!state.categoryVisibility[catKey].trails) return;

		const isTransferringShip = isShipEntry(entry) && entry.shipState === "transferring";

		// Ships: trail visible only during transfers
		if (isShipEntry(entry)) {
			entry.trail.line.visible = entry.shipState === "transferring";
			if (entry.shipState !== "transferring") return;
		}

		const t = entry.trail;

		// For transferring ships, compute distance traveled BEFORE the glue
		// code overwrites the previous head position with the current mesh
		// position (otherwise dx/dz would always be zero).
		// Seed the first trail point on the first frame of a transfer so
		// subsequent frames have a previous position to measure distance from.
		if (isTransferringShip && t.count === 0) {
			const h3 = t.head * 3;
			t.positions[h3] = entry.mesh.position.x;
			t.positions[h3 + 1] = entry.mesh.position.y;
			t.positions[h3 + 2] = entry.mesh.position.z;
			t.colors[h3] = t.baseColor.r;
			t.colors[h3 + 1] = t.baseColor.g;
			t.colors[h3 + 2] = t.baseColor.b;
			t.head = (t.head + 1) % t.maxPoints;
			t.count = 1;
			t.line.geometry.setDrawRange(0, 1);
			t.line.geometry.attributes.position.needsUpdate = true;
			t.line.geometry.attributes.color.needsUpdate = true;
		}
		let shipDistThisFrame = 0;
		if (isTransferringShip && t.count > 0) {
			const prevIdx = ((t.head - 1 + t.maxPoints) % t.maxPoints) * 3;
			const prevX = t.positions[prevIdx];
			const prevZ = t.positions[prevIdx + 2];
			shipDistThisFrame = Math.hypot(entry.mesh.position.x - prevX, entry.mesh.position.z - prevZ);
		}

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

		// Transferring ships: distance-based sampling in world space.
		// Comets: accumulate angular distance and sample when threshold reached.
		// Non-comets: accumulate sim time with fixed interval.
		const isComet = isCometEntry(entry);
		const SHIP_TRANSFER_TRAIL_STEP = 0.1; // world-space distance; 80 pts × 0.1 = 8 unit tail
		if (isTransferringShip) {
			t.sampleAccum += shipDistThisFrame;
		} else if (isComet) {
			t.sampleAccum += Math.abs(entry.speed * simDt);
		} else {
			t.sampleAccum += simDt;
		}
		const sampleThreshold = isTransferringShip
			? SHIP_TRANSFER_TRAIL_STEP
			: isComet
				? COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE)
				: 0.02;
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

			// Trails fade from transparent (oldest) to full color (newest)
			if (isTransferringShip || isComet) {
				for (let j = 0; j < t.count; j++) {
					const fade = t.count > 1 ? j / (t.count - 1) : 1;
					const idx = t.indices[j] * 3;
					t.colors[idx] = t.baseColor.r * fade;
					t.colors[idx + 1] = t.baseColor.g * fade;
					t.colors[idx + 2] = t.baseColor.b * fade;
				}
			}

			t.line.geometry.attributes.position.needsUpdate = true;
			t.line.geometry.attributes.color.needsUpdate = true;
			(t.line.geometry.index as THREE.BufferAttribute).needsUpdate = true;
			t.line.geometry.setDrawRange(0, t.count);
		}
	});
}
