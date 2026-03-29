import type { BodyData, BodyEntry, HohmannResult } from "../types";
import { DAYS_PER_YEAR, DIST_SCALE, keplerPeriod, orbitSpeed } from "./orbit";
import { AU_TO_KM } from "./ship-physics";

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
