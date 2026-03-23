import * as THREE from "three";
import { state } from "../core/state";
import { scaleDist } from "../math/orbit";
import { checkTransfer, ENGINE_TYPES } from "../math/ship-physics";
import { deriveStarMass } from "../math/transfer";
import type { BodyEntry, MoonData, PlanetEntry, ShipEntry, Vector3Like } from "../types";
import { isShipEntry } from "../types";
import {
	buildPlanetMap,
	createLabel,
	createTrail,
	findPlanetEntry,
	SEL_RING_INNER,
	SEL_RING_OUTER,
	SEL_RING_SEGS,
	TRAIL_MAX_POINTS,
} from "./bodies";
import { scene } from "./scene";

const SHIP_SIZE: number = 0.02;
export const SHIP_LOCAL_ORBIT: number = 1.5; // world-space radius around host planet
export const SHIP_LOCAL_SPEED: number = (Math.PI * 2) / 7; // ~7 day orbital period (visual clarity over realism)
const SHIP_TAIL_LENGTH: number = 20;
const shipTailMat: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
	color: "#999999",
	transparent: true,
	opacity: 0.6,
});

/**
 * Blend a position toward the target's local orbit over the full transfer.
 * Uses t^4 so the blend is negligible early (<1% until t~0.3) and ramps up smoothly.
 * Mutates p in place. Returns 'complete' if within orbit radius, else 'blending'.
 */
export function applyCaptureBlend(
	p: Vector3Like,
	tgtEntry: PlanetEntry | undefined,
	t: number,
): string {
	if (!tgtEntry) return "blending";
	const dist = Math.hypot(p.x - tgtEntry.mesh.position.x, p.z - tgtEntry.mesh.position.z);
	if (dist <= SHIP_LOCAL_ORBIT) return "complete";
	const angle = Math.atan2(p.z - tgtEntry.mesh.position.z, p.x - tgtEntry.mesh.position.x);
	const orbitX = tgtEntry.mesh.position.x + Math.cos(angle) * SHIP_LOCAL_ORBIT;
	const orbitZ = tgtEntry.mesh.position.z + Math.sin(angle) * SHIP_LOCAL_ORBIT;
	const blend = t * t * t * t;
	p.x = p.x + (orbitX - p.x) * blend;
	p.z = p.z + (orbitZ - p.z) * blend;
	return "blending";
}

const _hermiteOut: Vector3Like = { x: 0, y: 0, z: 0 };

export function hermiteEval(
	p0x: number,
	p0z: number,
	t0x: number,
	t0z: number,
	p1x: number,
	p1z: number,
	t1x: number,
	t1z: number,
	t: number,
): Vector3Like {
	const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
	const h10 = t * (1 - t) * (1 - t);
	const h01 = t * t * (3 - 2 * t);
	const h11 = t * t * (t - 1);
	_hermiteOut.x = h00 * p0x + h10 * t0x + h01 * p1x + h11 * t1x;
	_hermiteOut.z = h00 * p0z + h10 * t0z + h01 * p1z + h11 * t1z;
	return _hermiteOut;
}

export function transferPosition(entry: ShipEntry, t: number): Vector3Like {
	return hermiteEval(
		entry.p0x,
		entry.p0z,
		entry.t0x,
		entry.t0z,
		entry.p1x,
		entry.p1z,
		entry.t1x,
		entry.t1z,
		t,
	);
}

const _targetWorldOut = { x: 0, z: 0 };
export function predictTargetWorld(
	targetEntry: PlanetEntry,
	daysFromNow: number,
): { x: number; z: number } {
	const currentAngle = Math.atan2(targetEntry.mesh.position.z, targetEntry.mesh.position.x);
	const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
	const targetR = scaleDist(targetEntry.data.distance);
	_targetWorldOut.x = Math.cos(arrivalAngle) * targetR;
	_targetWorldOut.z = Math.sin(arrivalAngle) * targetR;
	return _targetWorldOut;
}

const SHIP_PATH_LOOKAHEAD: number = 0.25; // show 25% of curve ahead
const SHIP_TRANSFER_PTS: number = 128; // transfer curve sample points
const SHIP_MAX_ARC_PTS: number = 48; // max orbit arc points
const SHIP_PATH_BUFFER: number = SHIP_TRANSFER_PTS + SHIP_MAX_ARC_PTS + 1; // total buffer capacity

function createTransferPath(): THREE.Line {
	const positions = new Float32Array(SHIP_PATH_BUFFER * 3);
	const colors = new Float32Array(SHIP_PATH_BUFFER * 4);
	const geom = new THREE.BufferGeometry();
	geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geom.setAttribute("color", new THREE.BufferAttribute(colors, 4));
	const mat = new THREE.LineBasicMaterial({
		transparent: true,
		vertexColors: true,
		opacity: 1.0,
	});
	const line = new THREE.Line(geom, mat);
	line.frustumCulled = false;
	scene.add(line);
	return line;
}

export function updateTransferPath(entry: ShipEntry, elapsedDays: number): void {
	if (!entry.transferPath) return;
	const positions = entry.transferPath.geometry.attributes.position.array as Float32Array;
	const colors = entry.transferPath.geometry.attributes.color.array as Float32Array;
	const isSelected = state.selectedBody === entry;
	const baseAlpha = isSelected ? 0.5 : 0.2;

	const tCurrent = elapsedDays / entry.transferTimeDays;
	const tEnd = Math.min(tCurrent + SHIP_PATH_LOOKAHEAD, 1.0);
	const tRange = tEnd - tCurrent;

	const transferTarget = entry.transferTarget;
	if (!transferTarget) return;
	const tgt = findPlanetEntry(transferTarget);

	for (let i = 0; i <= SHIP_TRANSFER_PTS; i++) {
		const frac = i / SHIP_TRANSFER_PTS;
		const t = tCurrent + frac * tRange;
		const p = transferPosition(entry, t);
		applyCaptureBlend(p, tgt, t);
		const idx3 = i * 3;
		positions[idx3] = p.x;
		positions[idx3 + 1] = 0;
		positions[idx3 + 2] = p.z;
		const idx4 = i * 4;
		colors[idx4] = 0.33;
		colors[idx4 + 1] = 0.33;
		colors[idx4 + 2] = 0.33;
		colors[idx4 + 3] = baseAlpha * (1 - frac);
	}
	entry.transferPath.geometry.attributes.position.needsUpdate = true;
	entry.transferPath.geometry.attributes.color.needsUpdate = true;
	entry.transferPath.geometry.setDrawRange(0, SHIP_TRANSFER_PTS + 1);
}

export function computeHermiteKnots(
	departX: number,
	departZ: number,
	departAngle: number,
	targetEntry: PlanetEntry,
	gameDays: number,
): {
	p0x: number;
	p0z: number;
	t0x: number;
	t0z: number;
	p1x: number;
	p1z: number;
	t1x: number;
	t1z: number;
} {
	const targetWorld = predictTargetWorld(targetEntry, gameDays);
	const dist = Math.hypot(targetWorld.x - departX, targetWorld.z - departZ);
	const tangentDir = departAngle + Math.PI / 2;
	// Target orbit tangent (CCW): perpendicular to radial direction
	const targetAngle = Math.atan2(targetWorld.z, targetWorld.x);
	const targetTangentDir = targetAngle + Math.PI / 2;
	return {
		p0x: departX,
		p0z: departZ,
		t0x: Math.cos(tangentDir) * dist * 0.4,
		t0z: Math.sin(tangentDir) * dist * 0.4,
		p1x: targetWorld.x,
		p1z: targetWorld.z,
		t1x: Math.cos(targetTangentDir) * dist * 0.3,
		t1z: Math.sin(targetTangentDir) * dist * 0.3,
	};
}

export function updateDepartureArc(entry: ShipEntry): void {
	if (!entry.transferPath || !entry.pendingTransfer) return;
	const host = findPlanetEntry(entry.hostPlanetName);
	if (!host) return;
	const positions = entry.transferPath.geometry.attributes.position.array as Float32Array;
	const colors = entry.transferPath.geometry.attributes.color.array as Float32Array;
	const isSelected = state.selectedBody === entry;
	const baseAlpha = isSelected ? 0.5 : 0.2;
	const pt = entry.pendingTransfer;

	// Recompute departure angle every 8 frames (~4x/sec at 30fps)
	entry.departFrameCount = (entry.departFrameCount || 0) + 1;
	if (entry.departFrameCount % 8 === 0) {
		const targetEntry = state.bodyMeshes.find(
			(e) => e.data.name === pt.targetName && !e.isMoon && !isShipEntry(e),
		) as PlanetEntry | undefined;
		if (targetEntry) {
			const targetWorld = predictTargetWorld(targetEntry, pt.gameDays);
			const toTargetDir = Math.atan2(
				targetWorld.z - host.mesh.position.z,
				targetWorld.x - host.mesh.position.x,
			);
			pt.optimalLocalAngle = toTargetDir - Math.PI / 2;
		}
	}

	const TWO_PI = Math.PI * 2;
	const curAngle = ((entry.angle % TWO_PI) + TWO_PI) % TWO_PI;
	const tgtAngle = ((pt.optimalLocalAngle % TWO_PI) + TWO_PI) % TWO_PI;

	let sweep = tgtAngle - curAngle;
	if (sweep < 0) sweep += TWO_PI;
	if (sweep > TWO_PI) sweep -= TWO_PI;

	const ARC_PTS = Math.max(4, Math.min(SHIP_MAX_ARC_PTS, Math.round(sweep * 8)));
	let idx = 0;

	// Part 1: orbit arc to departure point
	for (let i = 0; i <= ARC_PTS; i++) {
		const frac = i / ARC_PTS;
		const a = curAngle + frac * sweep;
		const idx3 = idx * 3;
		positions[idx3] = host.mesh.position.x + Math.cos(a) * SHIP_LOCAL_ORBIT;
		positions[idx3 + 1] = 0;
		positions[idx3 + 2] = host.mesh.position.z + Math.sin(a) * SHIP_LOCAL_ORBIT;
		const idx4 = idx * 4;
		colors[idx4] = 0.33;
		colors[idx4 + 1] = 0.33;
		colors[idx4 + 2] = 0.33;
		colors[idx4 + 3] = baseAlpha;
		idx++;
	}

	// Part 2: Hermite spline from departure to predicted target
	const targetEntry = state.bodyMeshes.find(
		(e) => e.data.name === pt.targetName && !e.isMoon && !isShipEntry(e),
	) as PlanetEntry | undefined;
	if (targetEntry) {
		const departX = host.mesh.position.x + Math.cos(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
		const departZ = host.mesh.position.z + Math.sin(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
		const knots = computeHermiteKnots(
			departX,
			departZ,
			pt.optimalLocalAngle,
			targetEntry,
			pt.gameDays,
		);

		for (let i = 1; i <= SHIP_TRANSFER_PTS; i++) {
			const frac = i / SHIP_TRANSFER_PTS;
			const p = hermiteEval(
				knots.p0x,
				knots.p0z,
				knots.t0x,
				knots.t0z,
				knots.p1x,
				knots.p1z,
				knots.t1x,
				knots.t1z,
				frac,
			);
			const idx3 = idx * 3;
			positions[idx3] = p.x;
			positions[idx3 + 1] = 0;
			positions[idx3 + 2] = p.z;
			const idx4 = idx * 4;
			colors[idx4] = 0.33;
			colors[idx4 + 1] = 0.33;
			colors[idx4 + 2] = 0.33;
			colors[idx4 + 3] = baseAlpha * (1 - frac * 0.7);
			idx++;
		}
	}

	entry.transferPath.geometry.attributes.position.needsUpdate = true;
	entry.transferPath.geometry.attributes.color.needsUpdate = true;
	entry.transferPath.geometry.setDrawRange(0, idx);
}

function removeTransferPath(entry: ShipEntry): void {
	if (entry.transferPath) {
		scene.remove(entry.transferPath);
		entry.transferPath.geometry.dispose();
		(entry.transferPath.material as THREE.Material).dispose();
		entry.transferPath = null;
	}
}

export function createShip(): ShipEntry | undefined {
	const planets = state.BODIES?.filter((b) => b.type === "Planet");
	if (planets.length === 0) return;
	const homePlanet =
		planets.find((b) => b.name === "Earth") ||
		planets.reduce((best, b) => (Math.abs(b.distance - 1) < Math.abs(best.distance - 1) ? b : best));

	const geom = new THREE.SphereGeometry(SHIP_SIZE, 8, 8);
	const mat = new THREE.MeshStandardMaterial({
		color: "#bbbbbb",
		roughness: 0.6,
		metalness: 0.4,
	});
	const mesh = new THREE.Mesh(geom, mat);
	scene.add(mesh);

	const selGeom = new THREE.RingGeometry(
		SHIP_SIZE * SEL_RING_INNER,
		SHIP_SIZE * SEL_RING_OUTER,
		SEL_RING_SEGS,
	);
	const selMat = new THREE.MeshBasicMaterial({
		color: "#44ff44",
		transparent: true,
		opacity: 0,
		side: THREE.DoubleSide,
	});
	const selRing = new THREE.Mesh(selGeom, selMat);
	selRing.rotation.x = -Math.PI / 2;
	mesh.add(selRing);

	const labelDiv = createLabel("Ship", "#bbbbbb", false);
	const trail = createTrail("#bbbbbb", TRAIL_MAX_POINTS);

	const defaultEngine = ENGINE_TYPES[0]; // conventional TN
	const entry = {
		data: {
			name: "Ship",
			type: "Ship" as const,
			distance: homePlanet.distance,
			period: 0,
			radius: 1,
			color: "#bbbbbb",
			moons: [] as MoonData[],
		},
		mesh,
		selRing,
		planetRing: null,
		cloudMesh: null,
		orbitLine: null,
		orbitRadius: 0,
		labelDiv,
		trail,
		angle: 0,
		speed: SHIP_LOCAL_SPEED,
		parentMesh: null,
		moons: [] as BodyEntry[],
		isMoon: false,
		isShip: true as const,
		screenSize: SHIP_SIZE,
		baseSize: SHIP_SIZE,
		realisticSize: SHIP_SIZE,
		geomLevels: null,
		lodLevel: 0,
		// Ship physics
		engineId: defaultEngine.id,
		dryMassKg: defaultEngine.dryMassKg,
		fuelKg: 50_000,
		fuelCapacityKg: 50_000,
		// Ship state
		shipState: "orbiting" as const,
		hostPlanetName: homePlanet.name,
		orbitA: homePlanet.distance,
		// Transfer fields (Hermite spline)
		transferTarget: null,
		transferStartTime: 0,
		transferTimeDays: 0,
		p0x: 0,
		p0z: 0,
		t0x: 0,
		t0z: 0, // Hermite departure point + tangent
		p1x: 0,
		p1z: 0,
		t1x: 0,
		t1z: 0, // Hermite arrival point + tangent
		pendingTransfer: null,
		transferRecalcCounter: 0,
		// Visual: transfer path line and velocity tail
		transferPath: null,
		tailPositions: new Float32Array(SHIP_TAIL_LENGTH * 3),
		tailIndex: 0,
		tailCount: 0,
		tailLine: null,
	} as ShipEntry;

	// Velocity tail — always visible, short trail showing direction
	const tailGeom = new THREE.BufferGeometry();
	tailGeom.setAttribute("position", new THREE.BufferAttribute(entry.tailPositions, 3));
	tailGeom.setDrawRange(0, 0);
	entry.tailLine = new THREE.Line(tailGeom, shipTailMat);
	scene.add(entry.tailLine);

	state.bodyMeshes.push(entry);
	buildPlanetMap();
	return entry;
}

export function completeTransfer(entry: ShipEntry): void {
	removeTransferPath(entry);
	const transferTarget = entry.transferTarget ?? "";
	const target = findPlanetEntry(transferTarget);

	entry.shipState = "orbiting";
	entry.hostPlanetName = transferTarget;
	entry.transferTarget = null;
	entry.pendingTransfer = null;
	entry.speed = SHIP_LOCAL_SPEED;

	if (target) {
		entry.data.distance = target.data.distance;
		entry.orbitA = entry.data.distance;

		if (entry.blendTarget) {
			entry.angle = entry.blendTarget.entryAngle;
		} else {
			const dx = entry.mesh.position.x - target.mesh.position.x;
			const dz = entry.mesh.position.z - target.mesh.position.z;
			entry.angle = Math.atan2(dz, dx);
		}
		entry.blendTarget = null;
		// Snap to orbit radius
		const preSnap = { x: entry.mesh.position.x, z: entry.mesh.position.z };
		entry.mesh.position.set(
			target.mesh.position.x + Math.cos(entry.angle) * SHIP_LOCAL_ORBIT,
			0,
			target.mesh.position.z + Math.sin(entry.angle) * SHIP_LOCAL_ORBIT,
		);
		console.log("COMPLETE TRANSFER:", {
			to: entry.hostPlanetName,
			entryAngle: `${((entry.angle * 180) / Math.PI).toFixed(1)}°`,
			snapDist: Math.hypot(
				entry.mesh.position.x - preSnap.x,
				entry.mesh.position.z - preSnap.z,
			).toFixed(3),
		});
	} else {
		entry.angle = 0;
	}
}

export function beginTransfer(entry: ShipEntry): void {
	const p = entry.pendingTransfer;
	if (!p) return;

	const tgt = findPlanetEntry(p.targetName);
	if (!tgt) return;

	// Compute Hermite spline control points in world space
	const knots = computeHermiteKnots(
		entry.mesh.position.x,
		entry.mesh.position.z,
		entry.angle,
		tgt,
		p.gameDays,
	);
	entry.p0x = knots.p0x;
	entry.p0z = knots.p0z;
	entry.t0x = knots.t0x;
	entry.t0z = knots.t0z;
	entry.p1x = knots.p1x;
	entry.p1z = knots.p1z;
	entry.t1x = knots.t1x;
	entry.t1z = knots.t1z;

	entry.transferStartTime = state.simTime;
	entry.transferTimeDays = p.gameDays;
	entry.transferTarget = p.targetName;
	entry.shipState = "transferring";
	entry.pendingTransfer = null;
	entry.blendTarget = null;
	entry.transferRecalcCounter = 0;

	removeTransferPath(entry);
	entry.transferPath = createTransferPath();

	// Pre-fill tail buffer with current position to avoid line-to-origin artifact
	for (let i = 0; i < SHIP_TAIL_LENGTH; i++) {
		entry.tailPositions[i * 3] = entry.mesh.position.x;
		entry.tailPositions[i * 3 + 1] = 0;
		entry.tailPositions[i * 3 + 2] = entry.mesh.position.z;
	}
	entry.tailCount = 0;
}

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function showTransferStatus(msg: string): void {
	const el = document.getElementById("transfer-status-value");
	const row = document.getElementById("info-transfer-status");
	if (!el || !row) return;
	el.textContent = msg;
	row.classList.remove("hidden");
	if (statusTimer) window.clearTimeout(statusTimer);
	statusTimer = window.setTimeout(() => row.classList.add("hidden"), 4000);
}

export function initiateTransfer(entry: ShipEntry, targetEntry: PlanetEntry): void {
	if (!entry.isShip || entry.shipState === "transferring" || entry.shipState === "departing") return;
	const host = findPlanetEntry(entry.hostPlanetName);
	if (!host) return;
	const r1 = host.data.distance;
	const r2 = targetEntry.data.distance;
	if (r1 === r2) return;

	// Physics-based transfer feasibility check
	const starMass = deriveStarMass(state.BODIES ?? []);
	const result = checkTransfer(r1, r2, starMass, {
		fuelKg: entry.fuelKg,
		dryMassKg: entry.dryMassKg,
		engineId: entry.engineId,
	});

	if (!result.feasible) {
		showTransferStatus(
			`Need ${result.deltaVRequired?.toFixed(1)} km/s, have ${result.deltaVAvailable?.toFixed(1)} km/s`,
		);
		return;
	}

	// Deduct fuel
	entry.fuelKg -= result.fuelUsedKg ?? 0;

	// Brachistochrone time drives both physics and visuals
	const gameDays = result.transferDays ?? 0;

	entry.orbitA = (r1 + r2) / 2;

	// Departure angle: orbit tangent points toward predicted target position
	const targetWorld = predictTargetWorld(targetEntry, gameDays);
	const toTargetDir = Math.atan2(
		targetWorld.z - host.mesh.position.z,
		targetWorld.x - host.mesh.position.x,
	);
	const optimalLocalAngle = toTargetDir - Math.PI / 2;

	entry.pendingTransfer = {
		gameDays,
		targetName: targetEntry.data.name,
		optimalLocalAngle,
	};
	entry.shipState = "departing";

	removeTransferPath(entry);
	entry.transferPath = createTransferPath();
}
