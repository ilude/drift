import type { BodyData, HohmannResult } from "../types";
import { DAYS_PER_YEAR, keplerPeriod, orbitSpeed } from "./orbit";

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
