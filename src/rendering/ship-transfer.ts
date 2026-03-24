import * as THREE from "three";
import { findAsteroidEntity, rebuildEntityMaps } from "../core/entities";
import { gameWarn, state } from "../core/state";
import {
	DIST_SCALE,
	keplerRadius,
	MOON_DIST_SCALE,
	meanToTrue,
	orbitSpeed,
	scaleDist,
} from "../math/orbit";
import { AU_TO_KM, checkTransferKm, ENGINE_TYPES } from "../math/ship-physics";
import type {
	AsteroidBeltEntry,
	AsteroidInfo,
	BodyEntry,
	MoonData,
	ShipEntry,
	Vector3Like,
} from "../types";
import { isCometEntry, isShipEntry } from "../types";
import {
	createLabel,
	createTrail,
	findBodyEntry,
	orbitToWorld,
	SEL_RING_INNER,
	SEL_RING_OUTER,
	SEL_RING_SEGS,
	SHIP_TRAIL_MAX_POINTS,
} from "./bodies";
import { scene } from "./scene";

const SHIP_SIZE: number = 0.02;
export const SHIP_LOCAL_ORBIT: number = 1.5; // world-space radius around host planet
export const SHIP_LOCAL_SPEED: number = (Math.PI * 2) / 365; // slow station-keeping drift (~1 rotation/year, visual only)

/** Compute station-keeping offset for a ship around a host body.
 *  Scales with host visual size so ship doesn't clip inside large bodies. */
export function stationKeepingOffset(host: { mesh: { userData?: { baseSize?: number } } }): number {
	const hostSize = host.mesh.userData?.baseSize ?? 0.02;
	return Math.max(SHIP_LOCAL_ORBIT * 0.5, hostSize * 1.5);
}
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
	const px = targetEntry.mesh.position.x;
	const pz = targetEntry.mesh.position.z;

	// Stationary bodies (star), ships, or entities without orbital elements (asteroid proxies)
	if (targetEntry.speed === 0 || isShipEntry(targetEntry) || targetEntry.angle === undefined) {
		// Fall back to linear extrapolation for entities without Kepler elements
		if (targetEntry.speed !== 0 && targetEntry.angle === undefined) {
			const currentAngle = Math.atan2(pz, px);
			const currentR = Math.hypot(px, pz);
			const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
			_targetWorldOut.x = Math.cos(arrivalAngle) * currentR;
			_targetWorldOut.z = Math.sin(arrivalAngle) * currentR;
			return _targetWorldOut;
		}
		_targetWorldOut.x = px;
		_targetWorldOut.z = pz;
		return _targetWorldOut;
	}

	// Comets: full 3D inclined Kepler orbit
	if (isCometEntry(targetEntry)) {
		const { a, e, incRad, nodeRad, periRad } = targetEntry.data;
		const futureM = targetEntry.angle + targetEntry.speed * daysFromNow;
		const theta = meanToTrue(futureM, e);
		const r = keplerRadius(a, e, theta);
		const rScaled = scaleDist(r);
		const w = orbitToWorld(
			rScaled * Math.cos(theta),
			rScaled * Math.sin(theta),
			incRad,
			nodeRad,
			periRad,
		);
		_targetWorldOut.x = w.x;
		_targetWorldOut.z = w.z;
		return _targetWorldOut;
	}

	// Moons: propagate parent orbit then add moon offset
	if (targetEntry.isMoon && targetEntry.parentMesh) {
		const parentEntry = state.bodyMeshes.find((e) => e.mesh === targetEntry.parentMesh);
		let parentFutureX: number;
		let parentFutureZ: number;
		if (parentEntry && !isShipEntry(parentEntry) && !isCometEntry(parentEntry)) {
			const pEcc = parentEntry.data.e || 0;
			const futureParentM = parentEntry.angle + parentEntry.speed * daysFromNow;
			const parentTheta = meanToTrue(futureParentM, pEcc);
			const parentKr = keplerRadius(parentEntry.data.distance, pEcc, parentTheta);
			const parentR = scaleDist(parentKr);
			parentFutureX = Math.cos(parentTheta) * parentR;
			parentFutureZ = Math.sin(parentTheta) * parentR;
		} else {
			// Parent position unknown -- use current
			parentFutureX = targetEntry.parentMesh.position.x;
			parentFutureZ = targetEntry.parentMesh.position.z;
		}
		const moonE = targetEntry.data.e || 0;
		const futureMoonM = targetEntry.angle + targetEntry.speed * daysFromNow;
		const moonTheta = meanToTrue(futureMoonM, moonE);
		const moonKr = keplerRadius(targetEntry.data.distance, moonE, moonTheta);
		const moonR = moonKr * MOON_DIST_SCALE;
		_targetWorldOut.x = parentFutureX + Math.cos(moonTheta) * moonR;
		_targetWorldOut.z = parentFutureZ + Math.sin(moonTheta) * moonR;
		return _targetWorldOut;
	}

	// Regular planets: Kepler propagation in the ecliptic plane
	const ecc = targetEntry.data.e || 0;
	const futureM = targetEntry.angle + targetEntry.speed * daysFromNow;
	const theta = meanToTrue(futureM, ecc);
	const kr = keplerRadius(targetEntry.data.distance, ecc, theta);
	const r = scaleDist(kr);
	_targetWorldOut.x = Math.cos(theta) * r;
	_targetWorldOut.z = Math.sin(theta) * r;
	return _targetWorldOut;
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
	// Both tangents point along the direct line to target -- simple S-curve
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

export interface ShipConfig {
	name: string;
	hostPlanetName: string;
	engineId?: string;
	color?: string;
}

export function createShip(config: ShipConfig): ShipEntry | undefined {
	if (state.bodyMeshes.some((e) => e.data.name === config.name)) {
		gameWarn(`Ship "${config.name}" already exists`);
		return undefined;
	}

	// Find host planet by name; fall back to planet closest to 1 AU
	const hostPlanetEntry = findBodyEntry(config.hostPlanetName);
	const planets = state.BODIES?.filter((b) => b.type === "Planet");
	if (!hostPlanetEntry && (!planets || planets.length === 0)) return undefined;
	const homePlanetData = hostPlanetEntry
		? hostPlanetEntry.data
		: (planets.find((b) => b.name === config.hostPlanetName) ??
			planets.reduce((best, b) =>
				Math.abs(b.distance - 1) < Math.abs(best.distance - 1) ? b : best,
			));
	if (!homePlanetData) return undefined;

	const shipColor = config.color ?? "#bbbbbb";
	const geom = new THREE.SphereGeometry(SHIP_SIZE, 8, 8);
	const mat = new THREE.MeshStandardMaterial({
		color: shipColor,
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

	const labelDiv = createLabel(config.name, shipColor, false);
	const trail = createTrail(shipColor, SHIP_TRAIL_MAX_POINTS);

	const resolvedEngineId = config.engineId ?? ENGINE_TYPES[0].id;
	const defaultEngine = ENGINE_TYPES.find((e) => e.id === resolvedEngineId) ?? ENGINE_TYPES[0];
	const entry = {
		data: {
			name: config.name,
			type: "Ship" as const,
			distance: homePlanetData.distance,
			period: 0,
			radius: 1,
			color: shipColor,
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
		isComet: false as const,
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
		hostPlanetName: homePlanetData.name,
		orbitA: homePlanetData.distance,
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

	// Velocity tail -- always visible, short trail showing direction
	const tailGeom = new THREE.BufferGeometry();
	tailGeom.setAttribute("position", new THREE.BufferAttribute(entry.tailPositions, 3));
	tailGeom.setDrawRange(0, 0);
	entry.tailLine = new THREE.Line(tailGeom, shipTailMat);
	scene.add(entry.tailLine);

	// Snap ship to host planet's station-keeping orbit on creation
	if (hostPlanetEntry) {
		const offset = stationKeepingOffset(hostPlanetEntry);
		mesh.position.set(
			hostPlanetEntry.mesh.position.x + Math.cos(entry.angle) * offset,
			hostPlanetEntry.mesh.position.y,
			hostPlanetEntry.mesh.position.z + Math.sin(entry.angle) * offset,
		);
	}

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
	// Clear the transfer trail
	entry.trail.count = 0;
	entry.trail.head = 0;
	entry.trail.sampleAccum = 0;
	entry.trail.line.geometry.setDrawRange(0, 0);

	const transferTarget = entry.transferTarget ?? "";

	// Find the target body -- could be a planet, moon, or comet
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

		// Snap to station-keeping orbit using the same offset as the render loop
		const offset = stationKeepingOffset(target);
		entry.mesh.position.set(
			target.mesh.position.x + Math.cos(entry.angle) * offset,
			target.mesh.position.y,
			target.mesh.position.z + Math.sin(entry.angle) * offset,
		);
	} else {
		// Check if target is an asteroid
		const hit = findAsteroid(transferTarget);
		if (hit) {
			const proxy = asteroidProxy(hit.asteroid, hit.beltEntry);
			const offset = stationKeepingOffset(proxy);
			entry.data.distance = hit.asteroid.au;
			entry.orbitA = hit.asteroid.au;
			entry.angle = entryAngle;
			entry.mesh.position.set(
				proxy.mesh.position.x + Math.cos(entry.angle) * offset,
				0,
				proxy.mesh.position.z + Math.sin(entry.angle) * offset,
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

	// Clear the trail for a fresh start
	entry.trail.count = 0;
	entry.trail.head = 0;
	entry.trail.sampleAccum = 0;
	entry.trail.line.geometry.setDrawRange(0, 0);
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
 * per call -- safe to hold references across multiple calls.
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

	// Store fuel cost -- consumed gradually during transfer, not upfront
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
