import type { BodyData, BodyEntry, HohmannResult, Vector3Like } from "../types";
import {
	DAYS_PER_YEAR,
	DIST_SCALE,
	keplerPeriod,
	keplerRadius,
	MOON_DIST_SCALE,
	meanToTrue,
	orbitSpeed,
	orbitToWorld,
	scaleDist,
} from "./orbit";
import { AU_TO_KM } from "./ship-physics";

// --- Orbital position prediction ---

/** Parameters for predicting an orbital body's future position in world space. */
export interface OrbitalPredictionParams {
	/** Current world-space position */
	x: number;
	y: number;
	z: number;
	/** Angular speed (rad/day) */
	speed: number;
	/** Current mean anomaly */
	angle: number;
	/** Days to propagate forward */
	daysFromNow: number;
	/** Eccentricity */
	e: number;
	/** Semi-major axis (AU) */
	distance: number;
	/** Comet 3D orbital elements, if applicable */
	comet?: { a: number; e: number; incRad: number; nodeRad: number; periRad: number };
	/** Moon orbital data, if applicable */
	moon?: {
		parentX: number;
		parentZ: number;
		parentAngle: number;
		parentSpeed: number;
		parentDistance: number;
		parentE: number;
	};
}

const _predictOut: Vector3Like = { x: 0, y: 0, z: 0 };

/**
 * Predict an orbital body's world-space position after daysFromNow.
 * Pure math -- no rendering dependencies.
 * Handles three orbit types: comet (3D inclined), moon (parent+child), planet (2D ecliptic).
 */
export function predictOrbitalPosition(p: OrbitalPredictionParams): Vector3Like {
	if (p.comet) {
		const { a, e, incRad, nodeRad, periRad } = p.comet;
		const futureM = p.angle + p.speed * p.daysFromNow;
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
		_predictOut.x = w.x;
		_predictOut.y = w.y;
		_predictOut.z = w.z;
		return _predictOut;
	}

	if (p.moon) {
		const futureParentM = p.moon.parentAngle + p.moon.parentSpeed * p.daysFromNow;
		const parentTheta = meanToTrue(futureParentM, p.moon.parentE);
		const parentKr = keplerRadius(p.moon.parentDistance, p.moon.parentE, parentTheta);
		const parentR = scaleDist(parentKr);
		const parentFutureX = Math.cos(parentTheta) * parentR;
		const parentFutureZ = Math.sin(parentTheta) * parentR;

		const futureMoonM = p.angle + p.speed * p.daysFromNow;
		const moonTheta = meanToTrue(futureMoonM, p.e);
		const moonKr = keplerRadius(p.distance, p.e, moonTheta);
		const moonR = moonKr * MOON_DIST_SCALE;
		_predictOut.x = parentFutureX + Math.cos(moonTheta) * moonR;
		_predictOut.y = 0;
		_predictOut.z = parentFutureZ + Math.sin(moonTheta) * moonR;
		return _predictOut;
	}

	// Regular planet: Kepler propagation in the ecliptic plane
	const futureM = p.angle + p.speed * p.daysFromNow;
	const theta = meanToTrue(futureM, p.e);
	const kr = keplerRadius(p.distance, p.e, theta);
	const r = scaleDist(kr);
	_predictOut.x = Math.cos(theta) * r;
	_predictOut.y = 0;
	_predictOut.z = Math.sin(theta) * r;
	return _predictOut;
}

// --- Hermite transfer knots ---

/** Hermite spline control points for a ship transfer arc. */
export interface HermiteKnots {
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
}

/**
 * Compute Hermite spline knots for a transfer between two positions.
 * Tangent direction: unit vector from departure to arrival, scaled by 0.4 * distance.
 */
export function computeTransferKnots(depart: Vector3Like, target: Vector3Like): HermiteKnots {
	const dx = target.x - depart.x;
	const dy = target.y - depart.y;
	const dz = target.z - depart.z;
	const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
	const invDist = dist > 0 ? 1 / dist : 0;
	const ux = dx * invDist;
	const uy = dy * invDist;
	const uz = dz * invDist;
	const tangentMag = dist * 0.4;
	return {
		p0x: depart.x,
		p0y: depart.y,
		p0z: depart.z,
		t0x: ux * tangentMag,
		t0y: uy * tangentMag,
		t0z: uz * tangentMag,
		p1x: target.x,
		p1y: target.y,
		p1z: target.z,
		t1x: ux * tangentMag,
		t1y: uy * tangentMag,
		t1z: uz * tangentMag,
	};
}

// --- Respline decision ---

/**
 * Determine if a transfer arc needs re-splining based on endpoint drift.
 * Returns true when drift exceeds 1% of remaining distance or absolute threshold.
 */
export function shouldRespline(endpointDeltaSq: number, remainingDistSq: number): boolean {
	return endpointDeltaSq > Math.max(0.25, remainingDistSq * 0.01);
}

/**
 * Compute new Hermite knots for a mid-transfer re-spline.
 * Preserves current velocity direction (from derivative), adjusts tangent scale.
 */
export function computeResplineKnots(
	curPos: Vector3Like,
	curDeriv: Vector3Like,
	newTarget: Vector3Like,
	remainingDays: number,
	totalDays: number,
): HermiteKnots {
	const dx = newTarget.x - curPos.x;
	const dy = newTarget.y - curPos.y;
	const dz = newTarget.z - curPos.z;
	const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
	const invDist = dist > 0 ? 1 / dist : 0;
	const tangentMag = dist * 0.4;
	const scale = remainingDays / Math.max(totalDays, 0.01);
	return {
		p0x: curPos.x,
		p0y: curPos.y,
		p0z: curPos.z,
		t0x: curDeriv.x * scale,
		t0y: curDeriv.y * scale,
		t0z: curDeriv.z * scale,
		p1x: newTarget.x,
		p1y: newTarget.y,
		p1z: newTarget.z,
		t1x: dx * invDist * tangentMag,
		t1y: dy * invDist * tangentMag,
		t1z: dz * invDist * tangentMag,
	};
}

// --- Capture blend ---

/**
 * Apply capture-blend smoothing in the final 15% of a transfer.
 * Returns blended position between spline point and station-keeping orbit around target.
 */
export function captureBlendPosition(
	p: Vector3Like,
	targetPos: Vector3Like,
	stationOffset: number,
	tNow: number,
): Vector3Like {
	if (tNow <= 0.85) return p;
	const blendRaw = (tNow - 0.85) / 0.15;
	const blend = blendRaw * blendRaw * (3 - 2 * blendRaw); // smoothstep
	const capAngle = Math.atan2(p.z - targetPos.z, p.x - targetPos.x);
	const capX = targetPos.x + Math.cos(capAngle) * stationOffset;
	const capZ = targetPos.z + Math.sin(capAngle) * stationOffset;
	return {
		x: p.x + blend * (capX - p.x),
		y: p.y + blend * (targetPos.y - p.y),
		z: p.z + blend * (capZ - p.z),
	};
}

// --- Transfer arrival check ---

/**
 * Check if a transfer has arrived at its destination.
 * Arrival occurs when elapsed time exceeds transfer duration OR distance is within station orbit.
 */
export function checkTransferArrival(
	elapsedDays: number,
	transferTimeDays: number,
	distToTarget: number,
	stationOrbit: number,
): { arrived: boolean; reason: "time" | "distance" | "none" } {
	if (isTransferComplete(elapsedDays, transferTimeDays)) {
		return { arrived: true, reason: "time" };
	}
	if (distToTarget <= stationOrbit) {
		return { arrived: true, reason: "distance" };
	}
	return { arrived: false, reason: "none" };
}

// --- Gravitational parameter ---

/**
 * Compute mu (gravitational parameter) in AU³/day² from star mass in solar masses.
 * Kepler: T² = 4π²a³/(GM), in AU+years for M=1 solar mass: GM = 4π².
 * Convert to days: mu = 4π² * starMass / DAYS_PER_YEAR²
 */
export function computeMu(starMass: number): number {
	return (4 * Math.PI * Math.PI * starMass) / (DAYS_PER_YEAR * DAYS_PER_YEAR);
}

/**
 * Derive star mass from a planet's orbital data using Kepler's third law.
 * starMass = distance³ / period² (AU, years → solar masses)
 */
export function deriveStarMass(bodies: BodyData[]): number {
	const planet = bodies.find(
		(b) => (b.type === "Planet" || b.type === "Dwarf Planet") && b.period > 0 && b.distance > 0,
	);
	if (!planet) return 1;
	return planet.distance ** 3 / planet.period ** 2;
}

// --- Existing game transfer helpers ---

export function hohmannTransfer(r1: number, r2: number, starMass: number = 1): HohmannResult {
	const a = (r1 + r2) / 2;
	const e = Math.abs(r2 - r1) / (r1 + r2);
	const periodYears = keplerPeriod(a, starMass);
	const transferTimeDays = (periodYears * DAYS_PER_YEAR) / 2;
	return { a, e, periodYears, transferTimeDays };
}

export function transferSpeed(periodYears: number): number {
	return orbitSpeed(periodYears);
}

export function transferStartAngle(r1: number, r2: number): number {
	return r2 >= r1 ? 0 : Math.PI;
}

export function gameTransferDays(r1: number, r2: number): number {
	return 3 + 3 * Math.abs(r2 - r1);
}

export function gameTransferSpeed(transferDays: number): number {
	return Math.PI / transferDays;
}

export function isTransferComplete(elapsedDays: number, transferTimeDays: number): boolean {
	return elapsedDays >= transferTimeDays;
}

/**
 * Compute the real AU distance of a body from the star using world position.
 * World coords use sqrt compression: worldR = sqrt(au) * DIST_SCALE
 * Reverse: au = (worldR / DIST_SCALE)^2
 */
export function bodyAUFromPosition(body: BodyEntry): number {
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
	const angleA = Math.atan2(a.mesh.position.z, a.mesh.position.x);
	const angleB = Math.atan2(b.mesh.position.z, b.mesh.position.x);
	const axAU = Math.cos(angleA) * auA;
	const azAU = Math.sin(angleA) * auA;
	const bxAU = Math.cos(angleB) * auB;
	const bzAU = Math.sin(angleB) * auB;
	return Math.hypot(bxAU - axAU, bzAU - azAU) * AU_TO_KM;
}
