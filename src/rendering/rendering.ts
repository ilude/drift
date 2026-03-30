import type * as THREE from "three";
import { findAsteroidEntity, findBody } from "../core/entities";
import { gameLog, state } from "../core/state";
import { adjustTransferBudget } from "../core/transfers";
import {
	inclinedPosition,
	keplerRadius,
	MOON_DIST_SCALE,
	meanToTrue,
	scaleDist,
} from "../math/orbit";
import {
	captureBlendPosition,
	checkTransferArrival,
	computeResplineKnots,
	shouldRespline as shouldResplineCheck,
} from "../math/transfer";
import { moonOrbitScale } from "../math/visual";
import type { CategoryKey, PlanetEntry, ShipEntry } from "../types";
import { isCometEntry, isShipEntry } from "../types";
import { COMET_TRAIL_STEP_ARC, orbitToWorld } from "./bodies";
import { camera, ZOOM_BASE } from "./scene";
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

	// Precompute camera frustum scale for screen-size estimation.
	// tan(fov/2) * 2 gives the ratio of world units to screen height at distance 1.
	const fovScale = 2 * Math.tan(((camera.fov * Math.PI) / 180) * 0.5);

	state.asteroidBelts.forEach(
		({ belt, positions, angles, radii, speeds, cosInc, sinInc, cosNode, sinNode, count, points }) => {
			// Estimate belt screen-space diameter: belt radius in world units / camera distance.
			const midAU = (belt.minAU + belt.maxAU) * 0.5;
			const beltWorldR = scaleDist(midAU);
			const camDist = camera.position.length(); // belt is centered at origin
			const screenPixels = (beltWorldR / (camDist * fovScale)) * window.innerHeight;
			if (screenPixels < 2) return; // belt is sub-pixel; skip update, keep cached positions

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

// ---------------------------------------------------------------------------
// Private helpers for updatePositions
// ---------------------------------------------------------------------------

type BodyEntry = import("../types").BodyEntry;
type TrailData = ShipEntry["trail"];

/** Resolve host or transfer-target body, including asteroid belt proxy. */
function resolveTarget(name: string | undefined | null) {
	if (!name) return null;
	const [body, bodyFound] = findBody(name);
	if (bodyFound) return body;
	const [hit, hitFound] = findAsteroidEntity(name);
	return hitFound ? asteroidProxy(hit.asteroid, hit.beltEntry) : null;
}

/** Update ship angle and mesh position while it is station-keeping. */
function updateOrbitingShip(entry: ShipEntry, simDt: number): void {
	entry.angle += entry.speed * simDt;
	const host = resolveTarget(entry.hostPlanetName);
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
}

/** Re-spline the active transfer when the arrival endpoint has drifted. */
function maybeResplineTransfer(
	entry: ShipEntry,
	tgt: NonNullable<ReturnType<typeof resolveTarget>>,
	tEased: number,
	elapsed: number,
): void {
	const t = Math.min(elapsed / entry.transferTimeDays, 1);
	if (t >= 0.8) {
		// In capture-blend zone — just track target position lightly, skip expensive respline check.
		const tgtY = tgt.mesh.position.y ?? 0;
		entry.p1x = tgt.mesh.position.x;
		entry.p1y = tgtY;
		entry.p1z = tgt.mesh.position.z;
		return;
	}

	const offset = stationKeepingOffset(tgt);
	const approachAngle = Math.atan2(
		entry.mesh.position.z - tgt.mesh.position.z,
		entry.mesh.position.x - tgt.mesh.position.x,
	);
	const newP1x = tgt.mesh.position.x + Math.cos(approachAngle) * offset;
	const newP1y = tgt.mesh.position.y ?? 0;
	const newP1z = tgt.mesh.position.z + Math.sin(approachAngle) * offset;

	const endpointDeltaSq =
		(newP1x - entry.p1x) ** 2 + (newP1y - entry.p1y) ** 2 + (newP1z - entry.p1z) ** 2;
	const remainingDistSq =
		(newP1x - entry.mesh.position.x) ** 2 +
		(newP1y - entry.mesh.position.y) ** 2 +
		(newP1z - entry.mesh.position.z) ** 2;

	if (shouldResplineCheck(endpointDeltaSq, remainingDistSq)) {
		gameLog(
			`[re-spline] ${entry.data.name}: deltaSq=${endpointDeltaSq.toFixed(3)} t=${t.toFixed(4)} remaining=${(entry.transferTimeDays - elapsed).toFixed(1)}d fuel=${entry.fuelKg.toFixed(0)}kg fuelBudget=${entry.transferFuelTotal.toFixed(0)}kg`,
		);
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
		const remainingDays = Math.max(entry.transferTimeDays - elapsed, 0.01);
		const newTarget = { x: newP1x, y: newP1y, z: newP1z };
		const knots = computeResplineKnots(
			curPos,
			curDeriv,
			newTarget,
			remainingDays,
			entry.transferTimeDays,
		);

		entry.p0x = knots.p0x;
		entry.p0y = knots.p0y;
		entry.p0z = knots.p0z;
		entry.t0x = knots.t0x;
		entry.t0y = knots.t0y;
		entry.t0z = knots.t0z;
		entry.p1x = knots.p1x;
		entry.p1y = knots.p1y;
		entry.p1z = knots.p1z;
		entry.t1x = knots.t1x;
		entry.t1y = knots.t1y;
		entry.t1z = knots.t1z;
		adjustTransferBudget(entry, remainingDays);
	} else {
		// Light endpoint update: just track the target position
		entry.p1x = newP1x;
		entry.p1y = newP1y;
		entry.p1z = newP1z;
	}
}

/** Apply capture-blend smoothing in the final 15% of a transfer. */
function captureBlend(
	tgt: NonNullable<ReturnType<typeof resolveTarget>>,
	p: { x: number; y: number; z: number },
	tNow: number,
): { x: number; y: number; z: number } {
	const offset = stationKeepingOffset(tgt);
	const targetPos = {
		x: tgt.mesh.position.x,
		y: tgt.mesh.position.y ?? 0,
		z: tgt.mesh.position.z,
	};
	return captureBlendPosition(p, targetPos, offset, tNow);
}

/** Inject sub-step trail points for high-warp transfers to avoid gaps.
 * Returns true if any points were injected; caller must apply fade + flush. */
function injectSubstepTrail(entry: ShipEntry, simDt: number, tNow: number): boolean {
	const tr = entry.trail;
	if (tr.count === 0 || entry.transferTimeDays === 0) return false;

	const tStep = simDt / entry.transferTimeDays;
	if (tStep <= 1 / 30) return false;

	const tPrev = Math.max(0, tNow - tStep);
	const nSteps = Math.ceil(tStep * 30);
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
	tr.sampleAccum = 0;
	buildTrailIndices(tr.head, tr.count, tr.maxPoints, tr.indices);
	return true;
}

/** Check if the transfer is done and finalize it if so. */
function checkTransferCompletion(
	entry: ShipEntry,
	tgt: ReturnType<typeof resolveTarget>,
	elapsedNow: number,
	tNow: number,
): void {
	const distToTarget = tgt
		? Math.sqrt(
				(entry.mesh.position.x - tgt.mesh.position.x) ** 2 +
					(entry.mesh.position.y - (tgt.mesh.position.y ?? 0)) ** 2 +
					(entry.mesh.position.z - tgt.mesh.position.z) ** 2,
			)
		: Number.POSITIVE_INFINITY;

	if (Math.floor(state.simTime.days * 30) % 30 === 0) {
		gameLog(
			`[transfer] ${entry.data.name}: tNow=${tNow.toFixed(4)} elapsed=${elapsedNow.toFixed(2)}d/${entry.transferTimeDays.toFixed(2)}d dist=${distToTarget.toFixed(3)} fuel=${entry.fuelKg.toFixed(0)}kg stationOrbit=${SHIP_LOCAL_ORBIT}`,
		);
	}

	const arrival = checkTransferArrival(
		elapsedNow,
		entry.transferTimeDays,
		distToTarget,
		SHIP_LOCAL_ORBIT,
	);
	if (arrival.arrived) {
		gameLog(
			`[transfer-complete] ${entry.data.name}: reason=${arrival.reason} dist=${distToTarget.toFixed(3)} t=${tNow.toFixed(4)} fuel=${entry.fuelKg.toFixed(0)}kg`,
		);
		const entryAngle = tgt
			? Math.atan2(
					entry.mesh.position.z - tgt.mesh.position.z,
					entry.mesh.position.x - tgt.mesh.position.x,
				)
			: 0;
		completeTransfer(entry, entryAngle);
	}
}

/** Update a transferring ship's position for this frame, then check for completion. */
function updateTransferringShip(entry: ShipEntry, simDt: number): void {
	const elapsed = state.simTime.days - entry.transferStartTime;
	const t = Math.min(elapsed / entry.transferTimeDays, 1);
	const tEased = t * t * (3 - 2 * t);

	const tgt = resolveTarget(entry.transferTarget);
	if (tgt) maybeResplineTransfer(entry, tgt, tEased, elapsed);

	// Re-read elapsed after potential re-spline (transferStartTime may have changed)
	const elapsedNow = state.simTime.days - entry.transferStartTime;
	const tNow = Math.min(elapsedNow / entry.transferTimeDays, 1);
	const tEasedNow = tNow * tNow * (3 - 2 * tNow);
	const p = transferPosition(entry, tEasedNow);

	const final = tgt ? captureBlend(tgt, p, tNow) : p;
	entry.mesh.position.set(final.x, final.y, final.z);

	const substepsInjected = injectSubstepTrail(entry, simDt, tNow);
	if (substepsInjected) {
		applyTrailFade(entry.trail);
		flushTrailGeometry(entry.trail);
	}
	checkTransferCompletion(entry, tgt, elapsedNow, tNow);
}

/** Update mesh position for a comet body. */
function updateCometPosition(
	entry: ReturnType<typeof isCometEntry> extends true ? BodyEntry : never,
	simDt: number,
): void {
	const comet = entry as import("../types").CometEntry;
	const { a, e, incRad, nodeRad, periRad } = comet.data;
	comet.angle += comet.speed * simDt;
	const theta = meanToTrue(comet.angle, e);
	const r = keplerRadius(a, e, theta);
	const rScaled = scaleDist(r);
	const ox = rScaled * Math.cos(theta);
	const oz = rScaled * Math.sin(theta);
	const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);
	comet.mesh.position.set(w.x, w.y, w.z);
}

/** Update mesh position for a regular (non-comet, non-ship) body. */
function updateBodyPosition(entry: BodyEntry, simDt: number, moonScale: number): void {
	entry.angle += entry.speed * simDt;
	const ecc = (entry.data as { e: number }).e || 0;
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

/** Flush all three trail geometry buffers to GPU. */
function flushTrailGeometry(t: TrailData): void {
	t.line.geometry.attributes.position.needsUpdate = true;
	t.line.geometry.attributes.color.needsUpdate = true;
	(t.line.geometry.index as THREE.BufferAttribute).needsUpdate = true;
	t.line.geometry.setDrawRange(0, t.count);
}

/** Apply oldest-to-newest fade across the trail color buffer. */
function applyTrailFade(t: TrailData): void {
	for (let j = 0; j < t.count; j++) {
		const fade = t.count > 1 ? j / (t.count - 1) : 1;
		const idx = t.indices[j] * 3;
		t.colors[idx] = t.baseColor.r * fade;
		t.colors[idx + 1] = t.baseColor.g * fade;
		t.colors[idx + 2] = t.baseColor.b * fade;
	}
}

/** Seed the first trail point on the first frame of a ship transfer. */
function seedInitialTrailPoint(entry: ShipEntry): void {
	const t = entry.trail;
	if (t.count !== 0) return;
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

/** Advance trail accumulator and return how much was added this frame. */
function advanceTrailAccum(
	entry: BodyEntry,
	t: TrailData,
	isTransferringShip: boolean,
	isComet: boolean,
	simDt: number,
	camDist: number,
): number {
	const SHIP_TRANSFER_TRAIL_STEP = 0.1;
	if (isTransferringShip) {
		let shipDist = 0;
		if (t.count > 0) {
			const prevIdx = ((t.head - 1 + t.maxPoints) % t.maxPoints) * 3;
			shipDist = Math.hypot(
				entry.mesh.position.x - t.positions[prevIdx],
				entry.mesh.position.z - t.positions[prevIdx + 2],
			);
		}
		t.sampleAccum += shipDist;
		return SHIP_TRANSFER_TRAIL_STEP;
	}
	if (isComet) {
		t.sampleAccum += Math.abs((entry as import("../types").CometEntry).speed * simDt);
		return COMET_TRAIL_STEP_ARC * Math.max(1, camDist / ZOOM_BASE);
	}
	t.sampleAccum += simDt;
	return 0.02;
}

/** Write buffered sample points and flush geometry when the accumulator crosses threshold. */
function drainTrailAccum(
	entry: BodyEntry,
	t: TrailData,
	sampleThreshold: number,
	isTransferringShip: boolean,
	isComet: boolean,
): void {
	let trailDirty = false;
	while (t.sampleAccum > sampleThreshold) {
		t.sampleAccum -= sampleThreshold;
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
		buildTrailIndices(t.head, t.count, t.maxPoints, t.indices);
		if (isTransferringShip || isComet) applyTrailFade(t);
		flushTrailGeometry(t);
	}
}

/** Record a new trail sample point and rebuild geometry if the buffer grew. */
function recordTrailSample(entry: BodyEntry, simDt: number, camDist: number): void {
	const isTransferringShip = isShipEntry(entry) && entry.shipState === "transferring";
	const isComet = isCometEntry(entry);
	const t = entry.trail;

	if (isShipEntry(entry)) {
		entry.trail.line.visible = entry.shipState === "transferring";
		if (entry.shipState !== "transferring") return;
	}

	if (isTransferringShip) seedInitialTrailPoint(entry as ShipEntry);

	// Measure distance BEFORE glue overwrites previous position (otherwise dx/dz = 0)
	const threshold = advanceTrailAccum(entry, t, isTransferringShip, isComet, simDt, camDist);

	// Glue last vertex to current mesh position
	if (t.count > 0) {
		const headPhys = ((t.head - 1 + t.maxPoints) % t.maxPoints) * 3;
		t.positions[headPhys] = entry.mesh.position.x;
		t.positions[headPhys + 1] = entry.mesh.position.y;
		t.positions[headPhys + 2] = entry.mesh.position.z;
		t.line.geometry.attributes.position.needsUpdate = true;
	}

	drainTrailAccum(entry, t, threshold, isTransferringShip, isComet);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Dispatch position update to the correct handler for ships, comets, and regular bodies. */
function dispatchPosition(entry: BodyEntry, simDt: number, moonScale: number): void {
	if (isShipEntry(entry)) {
		if (entry.shipState === "orbiting") updateOrbitingShip(entry, simDt);
		else if (entry.shipState === "transferring") updateTransferringShip(entry, simDt);
		if (entry.tailLine) entry.tailLine.visible = false;
	} else if (isCometEntry(entry)) {
		updateCometPosition(entry as never, simDt);
	} else {
		updateBodyPosition(entry, simDt, moonScale);
	}
}

/**
 * Advance position for one body, applying moon LOD guards.
 * Returns false if the entry should skip cloud/trail processing (e.g. culled moon).
 */
function advanceBodyPosition(
	entry: BodyEntry,
	simDt: number,
	zoomFactor: number,
	moonScale: number,
): boolean {
	if (entry.data.distance === 0 && !isCometEntry(entry) && !isShipEntry(entry)) return false;

	// Skip invisible moons
	if (entry.isMoon && !entry.mesh.visible) {
		entry.angle += entry.speed * simDt;
		return false;
	}

	// Skip full orbit math for moons when parent is too small on screen
	if (entry.isMoon && entry.parentMesh) {
		const parentScreenSize = (entry.parentMesh.userData.baseSize ?? 1) * zoomFactor;
		if (parentScreenSize < 2) {
			entry.angle += entry.speed * simDt;
			entry.mesh.position.copy(entry.parentMesh.position);
			return false;
		}
	}

	dispatchPosition(entry, simDt, moonScale);
	return true;
}

/** Per-entry update: position, cloud rotation, and trail recording. */
function updateSingleBody(
	entry: BodyEntry,
	simDt: number,
	camDist: number,
	zoomFactor: number,
	moonScale: number,
): void {
	if (!advanceBodyPosition(entry, simDt, zoomFactor, moonScale)) return;

	// Cloud rotation
	if (!isShipEntry(entry) && !isCometEntry(entry) && (entry as PlanetEntry).cloudMesh?.visible) {
		const cloud = (entry as PlanetEntry).cloudMesh;
		if (cloud) cloud.rotation.y += simDt * 0.002;
	}

	// Trail recording -- skip if trails hidden for this category
	const catKey = (entry.isMoon ? "Moon" : entry.data.type) as CategoryKey;
	if (!state.categoryVisibility[catKey].trails) return;

	recordTrailSample(entry, simDt, camDist);
}

export function updatePositions(dt: number, camDist: number): void {
	const simDt = dt * state.timeSpeed;
	if (simDt === 0) return;

	const zoomFactor = ZOOM_BASE / camDist;
	const moonScale = moonOrbitScale(zoomFactor);

	for (const entry of state.bodyMeshes) {
		updateSingleBody(entry, simDt, camDist, zoomFactor, moonScale);
	}
}
