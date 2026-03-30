import * as THREE from "three";
import { findAsteroidEntity, findBody, findByMesh, rebuildEntityMaps } from "../core/entities";
import { gameWarn, state } from "../core/state";
import { commitTransferSim, completeTransferSim } from "../core/transfers";
import { rngInt, seededRandom } from "../core/utils";
import { keplerRadius, MOON_DIST_SCALE, meanToTrue, orbitSpeed, scaleDist } from "../math/orbit";
import { ENGINE_TYPES } from "../math/ship-physics";
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
	orbitToWorld,
	SEL_RING_INNER,
	SEL_RING_OUTER,
	SEL_RING_SEGS,
	SHIP_TRAIL_MAX_POINTS,
} from "./bodies";
import { scene } from "./scene";

const SHIP_SIZE: number = 0.02;
export const SHIP_LOCAL_ORBIT: number = 1.5; // world-space radius around host planet
const SHIP_LOCAL_SPEED: number = (Math.PI * 2) / 365; // slow station-keeping drift (~1 rotation/year, visual only)

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
	p0y: number,
	p0z: number,
	t0x: number,
	t0y: number,
	t0z: number,
	p1x: number,
	p1y: number,
	p1z: number,
	t1x: number,
	t1y: number,
	t1z: number,
	t: number,
): Vector3Like {
	const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
	const h10 = t * (1 - t) * (1 - t);
	const h01 = t * t * (3 - 2 * t);
	const h11 = t * t * (t - 1);
	_hermiteOut.x = h00 * p0x + h10 * t0x + h01 * p1x + h11 * t1x;
	_hermiteOut.y = h00 * p0y + h10 * t0y + h01 * p1y + h11 * t1y;
	_hermiteOut.z = h00 * p0z + h10 * t0z + h01 * p1z + h11 * t1z;
	return _hermiteOut;
}

const _hermiteDerivOut: Vector3Like = { x: 0, y: 0, z: 0 };

/** Compute the tangent (derivative) of the cubic Hermite spline at parameter t. */
export function hermiteDerivative(
	p0x: number,
	p0y: number,
	p0z: number,
	t0x: number,
	t0y: number,
	t0z: number,
	p1x: number,
	p1y: number,
	p1z: number,
	t1x: number,
	t1y: number,
	t1z: number,
	t: number,
): Vector3Like {
	// Derivatives of Hermite basis functions
	const dh00 = 6 * t * t - 6 * t;
	const dh10 = 3 * t * t - 4 * t + 1;
	const dh01 = -6 * t * t + 6 * t;
	const dh11 = 3 * t * t - 2 * t;
	_hermiteDerivOut.x = dh00 * p0x + dh10 * t0x + dh01 * p1x + dh11 * t1x;
	_hermiteDerivOut.y = dh00 * p0y + dh10 * t0y + dh01 * p1y + dh11 * t1y;
	_hermiteDerivOut.z = dh00 * p0z + dh10 * t0z + dh01 * p1z + dh11 * t1z;
	return _hermiteDerivOut;
}

export function transferPosition(entry: ShipEntry, t: number): Vector3Like {
	return hermiteEval(
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
		t,
	);
}

const _targetWorldOut = { x: 0, y: 0, z: 0 };

/** Handle stationary bodies (stars), ships, or entities without orbital elements. */
function predictStationaryOrLinearTarget(
	targetEntry: BodyEntry,
	px: number,
	py: number,
	pz: number,
	daysFromNow: number,
): { x: number; y: number; z: number } | null {
	// Fall back to linear extrapolation for entities without Kepler elements
	if (targetEntry.speed !== 0 && targetEntry.angle === undefined) {
		const currentAngle = Math.atan2(pz, px);
		const currentR = Math.hypot(px, pz);
		const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
		_targetWorldOut.x = Math.cos(arrivalAngle) * currentR;
		_targetWorldOut.y = py;
		_targetWorldOut.z = Math.sin(arrivalAngle) * currentR;
		return _targetWorldOut;
	}
	// Stationary: use current position
	_targetWorldOut.x = px;
	_targetWorldOut.y = py;
	_targetWorldOut.z = pz;
	return _targetWorldOut;
}

export function predictTargetWorld(
	targetEntry: BodyEntry,
	daysFromNow: number,
): { x: number; y: number; z: number } {
	const px = targetEntry.mesh.position.x;
	const py = targetEntry.mesh.position.y ?? 0;
	const pz = targetEntry.mesh.position.z;

	// Stationary bodies (star), ships, or entities without orbital elements (asteroid proxies)
	if (targetEntry.speed === 0 || isShipEntry(targetEntry) || targetEntry.angle === undefined) {
		return (
			predictStationaryOrLinearTarget(targetEntry, px, py, pz, daysFromNow) ?? { x: px, y: py, z: pz }
		);
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
		_targetWorldOut.y = w.y;
		_targetWorldOut.z = w.z;
		return _targetWorldOut;
	}

	// Moons: propagate parent orbit then add moon offset
	if (targetEntry.isMoon && targetEntry.parentMesh) {
		const parentEntry = findByMesh(targetEntry.parentMesh);
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
		_targetWorldOut.y = 0;
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
	_targetWorldOut.y = 0;
	_targetWorldOut.z = Math.sin(theta) * r;
	return _targetWorldOut;
}

export function computeHermiteKnots(
	departX: number,
	departY: number,
	departZ: number,
	targetEntry: BodyEntry,
	gameDays: number,
): {
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
} {
	const targetWorld = predictTargetWorld(targetEntry, gameDays);
	const dx = targetWorld.x - departX;
	const dy = targetWorld.y - departY;
	const dz = targetWorld.z - departZ;
	const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
	// Tangent direction: unit vector from departure to arrival, scaled by 0.4 * dist
	const invDist = dist > 0 ? 1 / dist : 0;
	const ux = dx * invDist;
	const uy = dy * invDist;
	const uz = dz * invDist;
	const tangentMag = dist * 0.4;
	return {
		p0x: departX,
		p0y: departY,
		p0z: departZ,
		t0x: ux * tangentMag,
		t0y: uy * tangentMag,
		t0z: uz * tangentMag,
		p1x: targetWorld.x,
		p1y: targetWorld.y,
		p1z: targetWorld.z,
		t1x: ux * tangentMag,
		t1y: uy * tangentMag,
		t1z: uz * tangentMag,
	};
}

interface ShipConfig {
	name: string;
	hostPlanetName: string;
	engineId?: string;
	color?: string;
	fuelCapacityKg?: number;
	commandTree?: import("../types").CommandTree;
	designId?: string;
}

interface ResolvedShipStats {
	engineId: string;
	dryMassKg: number;
	fuelCapacityKg: number;
	maxSupplies: number;
}

function resolveShipConfigStats(
	config: ShipConfig,
	defaultEngine: import("../types").EngineType,
): ResolvedShipStats {
	const design = config.designId ? state.shipDesigns.get(config.designId) : undefined;
	if (config.designId && !design) {
		gameWarn(`Ship design "${config.designId}" not found, using defaults`);
	}
	const engineDesign = design ? state.engineDesigns.get(design.engineDesignId) : undefined;
	return {
		engineId: engineDesign?.tierId ?? defaultEngine.id,
		dryMassKg: design?.dryMassKg ?? defaultEngine.dryMassKg,
		fuelCapacityKg: design?.fuelCapacityKg ?? config.fuelCapacityKg ?? 50_000,
		maxSupplies: design?.maxSupplies ?? 100,
	};
}

function hashName(name: string): number {
	let hash = 5381;
	for (let i = 0; i < name.length; i++) {
		hash = ((hash << 5) + hash + name.charCodeAt(i)) & 0x7fffffff;
	}
	return hash || 1;
}

export function rollOverhaulsUntilRefit(seed: string): number {
	return rngInt(seededRandom(hashName(seed)), 3, 5);
}

export function createShip(config: ShipConfig): ShipEntry | undefined {
	if (state.bodyMeshes.some((e) => e.data.name === config.name)) {
		gameWarn(`Ship "${config.name}" already exists`);
		return undefined;
	}

	// Find host planet by name; fall back to planet closest to 1 AU
	const [hostPlanetEntry, hostFound] = findBody(config.hostPlanetName);
	const planets = state.BODIES?.filter((b) => b.type === "Planet");
	if (!hostFound && (!planets || planets.length === 0)) return undefined;
	const homePlanetData = hostFound
		? hostPlanetEntry.data
		: (planets?.find((b) => b.name === config.hostPlanetName) ??
			planets?.reduce((best, b) =>
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
	const resolved = resolveShipConfigStats(config, defaultEngine);

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
		engineId: resolved.engineId,
		dryMassKg: resolved.dryMassKg,
		fuelKg: resolved.fuelCapacityKg,
		fuelCapacityKg: resolved.fuelCapacityKg,
		// Ship state
		shipState: "orbiting" as const,
		hostPlanetName: homePlanetData.name,
		orbitA: homePlanetData.distance,
		// Transfer fields (Hermite spline)
		transferTarget: null,
		transferStartTime: 0,
		transferTimeDays: 0,
		transferDisplayStart: 0,
		transferDisplayDays: 0,
		transferFuelTotal: 0,
		p0x: 0,
		p0y: 0,
		p0z: 0,
		t0x: 0,
		t0y: 0,
		t0z: 0, // Hermite departure point + tangent
		p1x: 0,
		p1y: 0,
		p1z: 0,
		t1x: 0,
		t1y: 0,
		t1z: 0, // Hermite arrival point + tangent
		pendingTransfer: null,
		// Visual: velocity tail
		tailPositions: new Float32Array(SHIP_TAIL_LENGTH * 3),
		tailIndex: 0,
		tailCount: 0,
		tailLine: null,
		// Command & autonomy
		commandTree: config.commandTree ?? {
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
		commander: { judgment: 0.3, experience: 0 },
		maintenance: {
			age: 0,
			totalAge: 0,
			lastRefitAge: 0,
			supplies: resolved.maxSupplies,
			maxSupplies: resolved.maxSupplies,
			hullIntegrity: 100,
			overhaulsSinceRefit: 0,
			overhaulsUntilRefit: rollOverhaulsUntilRefit(config.name),
		},
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		stationTarget: null,
		keelDate: state.simTime.days,
		designId: config.designId ?? null,
	} as ShipEntry;

	// Velocity tail -- always visible, short trail showing direction
	const tailGeom = new THREE.BufferGeometry();
	tailGeom.setAttribute("position", new THREE.BufferAttribute(entry.tailPositions, 3));
	tailGeom.setDrawRange(0, 0);
	entry.tailLine = new THREE.Line(tailGeom, shipTailMat);
	scene.add(entry.tailLine);

	// Snap ship to host planet's station-keeping orbit on creation
	if (hostFound) {
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

/** State-only transfer completion for background simulation. Does not update mesh position. */
export function completeTransferState(entry: ShipEntry): void {
	completeTransferSim(entry);

	entry.trail.count = 0;
	entry.trail.head = 0;
	entry.trail.sampleAccum = 0;
	entry.trail.line.geometry.setDrawRange(0, 0);

	if (onTransferCompleteHook) onTransferCompleteHook(entry);
}

export function completeTransfer(entry: ShipEntry, entryAngle = 0): void {
	const transferTarget = entry.transferTarget ?? "";
	completeTransferState(entry);
	entry.angle = entryAngle;

	// Snap mesh to current visual position of target
	const [target, targetFound] = findBody(transferTarget);
	if (targetFound) {
		const offset = stationKeepingOffset(target);
		entry.mesh.position.set(
			target.mesh.position.x + Math.cos(entry.angle) * offset,
			target.mesh.position.y,
			target.mesh.position.z + Math.sin(entry.angle) * offset,
		);
	} else {
		const [hit, hitFound] = findAsteroidEntity(transferTarget);
		if (hitFound) {
			const proxy = asteroidProxy(hit.asteroid, hit.beltEntry);
			const offset = stationKeepingOffset(proxy);
			entry.mesh.position.set(
				proxy.mesh.position.x + Math.cos(entry.angle) * offset,
				proxy.mesh.position.y ?? 0,
				proxy.mesh.position.z + Math.sin(entry.angle) * offset,
			);
		}
	}
}

/** Shared logic: write spline knots, set transfer state, prefill tail. */
function commitTransfer(
	entry: ShipEntry,
	knots: ReturnType<typeof computeHermiteKnots>,
	gameDays: number,
	targetName: string,
): void {
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

	commitTransferSim(entry, gameDays, targetName);

	// Clear the trail for a fresh start
	entry.trail.count = 0;
	entry.trail.head = 0;
	entry.trail.sampleAccum = 0;
	entry.trail.line.geometry.setDrawRange(0, 0);
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

/** Visual commit: compute spline knots and hand off to commitTransfer. */
export function visualCommitTransfer(
	entry: ShipEntry,
	targetEntry: BodyEntry,
	gameDays: number,
	targetName: string,
): void {
	const knots = computeHermiteKnots(
		entry.mesh.position.x,
		entry.mesh.position.y,
		entry.mesh.position.z,
		targetEntry,
		gameDays,
	);
	commitTransfer(entry, knots, gameDays, targetName);
}

export { initiateTransfer } from "../core/transfers";
export { showTransferStatus };
