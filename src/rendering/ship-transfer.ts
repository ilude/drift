import * as THREE from "three";
import { findAsteroidEntity, rebuildEntityMaps } from "../core/entities";
import { state } from "../core/state";
import { DIST_SCALE, orbitSpeed } from "../math/orbit";
import { AU_TO_KM, checkTransferKm, ENGINE_TYPES } from "../math/ship-physics";
import type {
	AsteroidBeltEntry,
	AsteroidInfo,
	BodyEntry,
	MoonData,
	ShipEntry,
	Vector3Like,
} from "../types";
import { isCometEntry } from "../types";
import {
	createLabel,
	createTrail,
	findBodyEntry,
	SEL_RING_INNER,
	SEL_RING_OUTER,
	SEL_RING_SEGS,
	TRAIL_MAX_POINTS,
} from "./bodies";
import { scene } from "./scene";

const SHIP_SIZE: number = 0.02;
export const SHIP_LOCAL_ORBIT: number = 1.5; // world-space radius around host planet
export const SHIP_LOCAL_SPEED: number = (Math.PI * 2) / 365; // slow station-keeping drift (~1 rotation/year, visual only)
const SHIP_TAIL_LENGTH: number = 20;
const shipTailMat: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
	color: "#999999",
	transparent: true,
	opacity: 0.6,
});

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
	targetEntry: BodyEntry,
	daysFromNow: number,
): { x: number; z: number } {
	// For bodies with a parent (moons) or non-circular orbits (comets),
	// use current position + angular velocity extrapolation
	const px = targetEntry.mesh.position.x;
	const pz = targetEntry.mesh.position.z;
	const currentAngle = Math.atan2(pz, px);
	const currentR = Math.hypot(px, pz);

	if (currentR < 0.001 || targetEntry.speed === 0) {
		// Stationary body (star) — just return current position
		_targetWorldOut.x = px;
		_targetWorldOut.z = pz;
		return _targetWorldOut;
	}

	const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
	_targetWorldOut.x = Math.cos(arrivalAngle) * currentR;
	_targetWorldOut.z = Math.sin(arrivalAngle) * currentR;
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
	entry.departFrameCount = (entry.departFrameCount || 0) + 1;
	if (entry.departFrameCount % 4 !== 0) return;
	const positions = entry.transferPath.geometry.attributes.position.array as Float32Array;
	const colors = entry.transferPath.geometry.attributes.color.array as Float32Array;
	const isSelected = state.selectedBody === entry;
	const baseAlpha = isSelected ? 0.5 : 0.2;

	const tCurrent = elapsedDays / entry.transferTimeDays;
	const tEnd = Math.min(tCurrent + SHIP_PATH_LOOKAHEAD, 1.0);
	const tRange = tEnd - tCurrent;

	for (let i = 0; i <= SHIP_TRANSFER_PTS; i++) {
		const frac = i / SHIP_TRANSFER_PTS;
		const t = tCurrent + frac * tRange;
		const p = transferPosition(entry, t);
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
	targetEntry: BodyEntry,
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
	const dx = targetWorld.x - departX;
	const dz = targetWorld.z - departZ;
	const dist = Math.hypot(dx, dz);
	// Both tangents point along the direct line to target — simple S-curve
	const angle = Math.atan2(dz, dx);
	return {
		p0x: departX,
		p0z: departZ,
		t0x: Math.cos(angle) * dist * 0.5,
		t0z: Math.sin(angle) * dist * 0.5,
		p1x: targetWorld.x,
		p1z: targetWorld.z,
		t1x: Math.cos(angle) * dist * 0.3,
		t1z: Math.sin(angle) * dist * 0.3,
	};
}

export function updateDepartureArc(entry: ShipEntry): void {
	if (!entry.transferPath || !entry.pendingTransfer) return;
	const host = findBodyEntry(entry.hostPlanetName);
	if (!host) return;
	const positions = entry.transferPath.geometry.attributes.position.array as Float32Array;
	const colors = entry.transferPath.geometry.attributes.color.array as Float32Array;
	const isSelected = state.selectedBody === entry;
	const baseAlpha = isSelected ? 0.5 : 0.2;
	const pt = entry.pendingTransfer;

	// Recompute departure angle every 30 frames (~1x/sec at 30fps)
	entry.departFrameCount = (entry.departFrameCount || 0) + 1;
	if (entry.departFrameCount % 30 === 0) {
		const targetEntry = findBodyEntry(pt.targetName);
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

	// Skip full geometry rebuild if ship angle hasn't moved significantly
	const prevAngle = entry.lastAngle ?? curAngle - 1;
	if (Math.abs(curAngle - prevAngle) < 0.01) return;
	entry.lastAngle = curAngle;

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
	const targetEntry = findBodyEntry(pt.targetName);
	if (targetEntry) {
		const departX = host.mesh.position.x + Math.cos(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
		const departZ = host.mesh.position.z + Math.sin(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
		const knots = computeHermiteKnots(departX, departZ, targetEntry, pt.gameDays);

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
		transferFuelTotal: 0,
		p0x: 0,
		p0z: 0,
		t0x: 0,
		t0z: 0, // Hermite departure point + tangent
		p1x: 0,
		p1z: 0,
		t1x: 0,
		t1z: 0, // Hermite arrival point + tangent
		pendingTransfer: null,
		// Visual: transfer path line and velocity tail
		transferPath: null,
		tailPositions: new Float32Array(SHIP_TAIL_LENGTH * 3),
		tailIndex: 0,
		tailCount: 0,
		tailLine: null,
		// Command & autonomy
		commandTree: {
			entries: [
				{
					id: "fuel-check",
					command: "refuel" as const,
					condition: { type: "fuel-below" as const, threshold: 20 },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "hull-check",
					command: "overhaul" as const,
					condition: { type: "hull-below" as const, threshold: 30 },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "morale-check",
					command: "shore-leave" as const,
					condition: { type: "morale-below" as const, threshold: 40 },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "survey",
					command: "survey-nearest" as const,
					condition: { type: "always" as const },
					enabled: true,
					origin: "ship" as const,
				},
				{
					id: "idle",
					command: "idle" as const,
					condition: { type: "always" as const },
					enabled: true,
					origin: "ship" as const,
				},
			],
		},
		immediateCommand: null,
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 100 },
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		stationTarget: null,
	} as ShipEntry;

	// Velocity tail — always visible, short trail showing direction
	const tailGeom = new THREE.BufferGeometry();
	tailGeom.setAttribute("position", new THREE.BufferAttribute(entry.tailPositions, 3));
	tailGeom.setDrawRange(0, 0);
	entry.tailLine = new THREE.Line(tailGeom, shipTailMat);
	scene.add(entry.tailLine);

	state.bodyMeshes.push(entry);
	rebuildEntityMaps();
	return entry;
}

/** Callback invoked after transfer completes. Set by main.ts for command dispatch. */
let onTransferCompleteHook: ((ship: ShipEntry) => void) | null = null;

export function setOnTransferComplete(hook: (ship: ShipEntry) => void): void {
	onTransferCompleteHook = hook;
}

export function completeTransfer(entry: ShipEntry, entryAngle = 0): void {
	removeTransferPath(entry);
	const transferTarget = entry.transferTarget ?? "";

	// Find the target body — could be a planet, moon, or comet
	const target = findBodyEntry(transferTarget);

	entry.shipState = "orbiting";
	// If target is a moon, use parent planet name for station-keeping
	if (target?.isMoon && target.parentMesh) {
		const parent = state.bodyMeshes.find((e) => e.mesh === target.parentMesh);
		entry.hostPlanetName = parent ? parent.data.name : transferTarget;
	} else {
		entry.hostPlanetName = transferTarget;
	}
	entry.transferTarget = null;
	entry.transferFuelTotal = 0;
	entry.pendingTransfer = null;
	entry.speed = SHIP_LOCAL_SPEED;

	if (target) {
		entry.data.distance = target.data.distance || entry.data.distance;
		entry.orbitA = entry.data.distance;
		entry.angle = entryAngle;

		// Comets: station-keep (position tracking handled by render loop)
		// Planets/moons: snap to local orbit
		if (!isCometEntry(target)) {
			entry.mesh.position.set(
				target.mesh.position.x + Math.cos(entry.angle) * SHIP_LOCAL_ORBIT,
				0,
				target.mesh.position.z + Math.sin(entry.angle) * SHIP_LOCAL_ORBIT,
			);
		} else {
			const offset = SHIP_LOCAL_ORBIT * 0.5;
			entry.mesh.position.set(
				target.mesh.position.x + Math.cos(entry.angle) * offset,
				target.mesh.position.y,
				target.mesh.position.z + Math.sin(entry.angle) * offset,
			);
		}
	} else {
		// Check if target is an asteroid
		const hit = findAsteroid(transferTarget);
		if (hit) {
			const proxy = asteroidProxy(hit.asteroid, hit.beltEntry);
			entry.data.distance = hit.asteroid.au;
			entry.orbitA = hit.asteroid.au;
			entry.angle = entryAngle;
			entry.mesh.position.set(
				proxy.mesh.position.x + Math.cos(entry.angle) * SHIP_LOCAL_ORBIT,
				0,
				proxy.mesh.position.z + Math.sin(entry.angle) * SHIP_LOCAL_ORBIT,
			);
		} else {
			entry.angle = 0;
		}
	}

	if (onTransferCompleteHook) onTransferCompleteHook(entry);
}

/** Shared logic: write spline knots, set transfer state, create path, prefill tail. */
function commitTransfer(
	entry: ShipEntry,
	knots: ReturnType<typeof computeHermiteKnots>,
	gameDays: number,
	targetName: string,
): void {
	entry.p0x = knots.p0x;
	entry.p0z = knots.p0z;
	entry.t0x = knots.t0x;
	entry.t0z = knots.t0z;
	entry.p1x = knots.p1x;
	entry.p1z = knots.p1z;
	entry.t1x = knots.t1x;
	entry.t1z = knots.t1z;

	entry.transferStartTime = state.simTime;
	entry.transferTimeDays = gameDays;
	entry.transferTarget = targetName;
	entry.shipState = "transferring";
	entry.pendingTransfer = null;
	entry.stationTarget = null;

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

export function beginTransfer(entry: ShipEntry): void {
	const p = entry.pendingTransfer;
	if (!p) return;

	let tgt: BodyEntry | undefined = findBodyEntry(p.targetName);
	if (!tgt) {
		const hit = findAsteroid(p.targetName);
		if (hit) tgt = asteroidProxy(hit.asteroid, hit.beltEntry);
	}
	if (!tgt) return;

	const knots = computeHermiteKnots(entry.mesh.position.x, entry.mesh.position.z, tgt, p.gameDays);
	commitTransfer(entry, knots, p.gameDays, p.targetName);
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

/**
 * Compute the real AU distance of a body from the star using world position.
 * World coords use sqrt compression: worldR = sqrt(au) * DIST_SCALE
 * Reverse: au = (worldR / DIST_SCALE)^2
 */
function bodyAUFromPosition(body: BodyEntry): number {
	const wx = body.mesh.position.x;
	const wy = body.mesh.position.y;
	const wz = body.mesh.position.z;
	const worldR = Math.sqrt(wx * wx + wy * wy + wz * wz);
	return (worldR / DIST_SCALE) ** 2;
}

/**
 * Compute straight-line distance in km between two bodies.
 * Uses actual angular positions to compute chord distance in AU space,
 * so bodies on opposite sides of the star have the correct large distance.
 */
export function distanceKmBetween(a: BodyEntry, b: BodyEntry): number {
	const auA = a.data.distance > 0 && !a.isMoon ? a.data.distance : bodyAUFromPosition(a);
	const auB = b.data.distance > 0 && !b.isMoon ? b.data.distance : bodyAUFromPosition(b);
	// Derive angular positions from world coordinates (XZ plane)
	const angleA = Math.atan2(a.mesh.position.z, a.mesh.position.x);
	const angleB = Math.atan2(b.mesh.position.z, b.mesh.position.x);
	const axAU = Math.cos(angleA) * auA;
	const azAU = Math.sin(angleA) * auA;
	const bxAU = Math.cos(angleB) * auB;
	const bzAU = Math.sin(angleB) * auB;
	return Math.hypot(bxAU - axAU, bzAU - azAU) * AU_TO_KM;
}

/**
 * Find an asteroid by designation across all belts.
 * Returns the asteroid info and its parent belt entry, or null.
 * @deprecated Use findAsteroidEntity() from core/entities.ts for new code.
 */
export function findAsteroid(
	designation: string,
): { asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry } | null {
	return findAsteroidEntity(designation) ?? null;
}

/**
 * Build a lightweight BodyEntry-compatible proxy for an asteroid.
 * Reads position from the belt's Float32Array. Returns a fresh position object
 * per call — safe to hold references across multiple calls.
 */
export function asteroidProxy(asteroid: AsteroidInfo, beltEntry: AsteroidBeltEntry): BodyEntry {
	const idx = asteroid.beltIndex ?? 0;
	const pos = {
		x: beltEntry.positions[idx * 3],
		y: beltEntry.positions[idx * 3 + 1],
		z: beltEntry.positions[idx * 3 + 2],
	};
	return {
		mesh: { position: pos },
		data: {
			name: asteroid.designation,
			distance: asteroid.au,
			type: "Asteroid",
		},
		speed: orbitSpeed(asteroid.period),
		isMoon: false,
		isShip: false,
		isComet: false,
	} as unknown as BodyEntry;
}

export function initiateTransfer(entry: ShipEntry, targetEntry: BodyEntry): boolean {
	if (!entry.isShip || entry.shipState === "transferring") return false;

	// Find current host body for distance calculation (body or asteroid)
	let host: BodyEntry | undefined = findBodyEntry(entry.hostPlanetName);
	if (!host) {
		const hit = findAsteroid(entry.hostPlanetName);
		if (hit) host = asteroidProxy(hit.asteroid, hit.beltEntry);
	}
	if (!host) return false;

	// Compute real distance in km between ship's host and target
	const distKm = distanceKmBetween(host, targetEntry);
	if (distKm < 1) return false;

	const result = checkTransferKm(distKm, {
		fuelKg: entry.fuelKg,
		dryMassKg: entry.dryMassKg,
		engineId: entry.engineId,
	});

	if (!result.feasible) {
		showTransferStatus(
			`Need ${result.deltaVRequired?.toFixed(1)} km/s, have ${result.deltaVAvailable?.toFixed(1)} km/s`,
		);
		return false;
	}

	// Store fuel cost — consumed gradually during transfer, not upfront
	const gameDays = result.transferDays ?? 0;
	entry.transferFuelTotal = result.fuelUsedKg ?? 0;

	const knots = computeHermiteKnots(
		entry.mesh.position.x,
		entry.mesh.position.z,
		targetEntry,
		gameDays,
	);

	const r1 = host.data.distance || bodyAUFromPosition(host);
	const r2 = targetEntry.data.distance || bodyAUFromPosition(targetEntry);
	entry.orbitA = (r1 + r2) / 2;

	commitTransfer(entry, knots, gameDays, targetEntry.data.name);
	return true;
}
