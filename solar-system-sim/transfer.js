import { DAYS_PER_YEAR, keplerPeriod, orbitSpeed } from './orbit.js';

/**
 * Compute Hohmann transfer orbital elements between two circular orbits.
 * @param {number} r1 - departure orbit radius (AU)
 * @param {number} r2 - arrival orbit radius (AU)
 * @param {number} [starMass=1] - star mass in solar masses
 * @returns {{ a: number, e: number, periodYears: number, transferTimeDays: number }}
 */
export function hohmannTransfer(r1, r2, starMass = 1) {
    const a = (r1 + r2) / 2;
    const e = Math.abs(r2 - r1) / (r1 + r2);
    const periodYears = keplerPeriod(a, starMass);
    const transferTimeDays = (periodYears * DAYS_PER_YEAR) / 2;
    return { a, e, periodYears, transferTimeDays };
}

/**
 * Angular speed for the transfer ellipse (rad/day).
 */
export function transferSpeed(periodYears) {
    return orbitSpeed(periodYears);
}

/**
 * Starting mean anomaly for the transfer.
 * Outward (r2 > r1): depart from periapsis (0).
 * Inward (r2 < r1): depart from apoapsis (PI).
 */
export function transferStartAngle(r1, r2) {
    return r2 >= r1 ? 0 : Math.PI;
}

/**
 * Check if the half-orbit transfer is complete.
 */
export function isTransferComplete(elapsedDays, transferTimeDays) {
    return elapsedDays >= transferTimeDays;
}
