import type {
	BodyData,
	HohmannResult,
	LambertResult,
	Vector2Like,
} from "../types";
import { DAYS_PER_YEAR, DIST_SCALE, keplerPeriod, orbitSpeed } from "./orbit";

// --- Stumpff functions for universal variable formulation ---

function stumpffC(psi: number): number {
	if (psi > 1e-6) return (1 - Math.cos(Math.sqrt(psi))) / psi;
	if (psi < -1e-6) return (Math.cosh(Math.sqrt(-psi)) - 1) / -psi;
	return 0.5 - psi / 24 + (psi * psi) / 720;
}

function stumpffS(psi: number): number {
	if (psi > 1e-6) {
		const sq = Math.sqrt(psi);
		return (sq - Math.sin(sq)) / (sq * sq * sq);
	}
	if (psi < -1e-6) {
		const sq = Math.sqrt(-psi);
		return (Math.sinh(sq) - sq) / (sq * sq * sq);
	}
	return 1 / 6 - psi / 120 + (psi * psi) / 5040;
}

// --- Lambert solver ---

/**
 * Solve Lambert's problem: find the conic orbit connecting two positions
 * in a given time of flight. Works for elliptic, parabolic, and hyperbolic transfers.
 *
 * @param r1x - departure x (AU)
 * @param r1z - departure z (AU)
 * @param r2x - arrival x (AU)
 * @param r2z - arrival z (AU)
 * @param tof - time of flight (days)
 * @param mu - gravitational parameter (AU³/day²)
 * @returns velocity vectors at departure and arrival
 */
export function lambertSolve(
	r1x: number,
	r1z: number,
	r2x: number,
	r2z: number,
	tof: number,
	mu: number,
): LambertResult | null {
	const r1 = Math.hypot(r1x, r1z);
	const r2 = Math.hypot(r2x, r2z);
	if (r1 < 1e-14 || r2 < 1e-14 || tof <= 0) return null;

	// Transfer angle — always use the short way (most direct path)
	const cosD = Math.max(-1, Math.min(1, (r1x * r2x + r1z * r2z) / (r1 * r2)));

	let dtheta = Math.acos(cosD); // [0, π] — always short way

	// Guard near-degenerate angles
	if (dtheta < 0.01) dtheta = 0.01;
	if (Math.abs(dtheta - Math.PI) < 0.01) dtheta += 0.01;

	const sinD = Math.sin(dtheta);
	const cosD2 = Math.cos(dtheta);
	const A = sinD * Math.sqrt((r1 * r2) / (1 - cosD2));
	if (Math.abs(A) < 1e-14) return null;

	const sqrtMu = Math.sqrt(mu);
	const target = sqrtMu * tof;

	// Evaluate F(z) — the time residual for a given z value
	function evalF(zv: number): number {
		const Cv = stumpffC(zv);
		const Sv = stumpffS(zv);
		const sqCv = Math.sqrt(Math.abs(Cv));
		if (sqCv < 1e-14) return NaN;
		const yv = r1 + r2 + (A * (zv * Sv - 1)) / sqCv;
		if (yv < 0) return NaN;
		const sqYv = Math.sqrt(yv);
		const chiv = sqYv / sqCv;
		return chiv * chiv * chiv * Sv + A * sqYv - target;
	}

	// Bracket the root: find zLow (F<=0 or NaN) and zHigh (F>0)
	// F decreases monotonically as z decreases for the direct transfer.
	// When y<0 (evalF returns NaN), we've gone past the minimum-energy boundary.
	let zLow = 0,
		zHigh: number;
	const F0 = evalF(0);

	if (Number.isNaN(F0)) return null;

	if (F0 > 0) {
		// Parabolic time too long — need z < 0 (hyperbolic)
		zHigh = 0;
		// Find zLow: expand until F <= 0 or NaN (y < 0 means we passed the root)
		let lastPositive = 0;
		let zProbe = -1;
		let found = false;
		for (let i = 0; i < 40; i++) {
			const Fl = evalF(zProbe);
			if (Number.isNaN(Fl)) {
				// y < 0: root is between lastPositive and zProbe
				// Bisect this sub-interval to find where F <= 0 with y >= 0
				let lo = lastPositive,
					hi = zProbe;
				for (let j = 0; j < 80; j++) {
					const mid = (lo + hi) / 2;
					const Fm = evalF(mid);
					if (Number.isNaN(Fm)) {
						hi = mid;
						continue;
					} // y < 0, back off
					if (Fm <= 0) {
						zLow = mid;
						found = true;
						break;
					}
					lo = mid; // F > 0, go more negative
				}
				if (!found) zLow = (lo + hi) / 2; // best guess near boundary
				found = true;
				break;
			}
			if (Fl <= 0) {
				zLow = zProbe;
				found = true;
				break;
			}
			lastPositive = zProbe;
			zProbe *= 2;
		}
		if (!found) zLow = zProbe;
	} else {
		// Parabolic time too short — need z > 0 (elliptic)
		zLow = 0;
		zHigh = 4 * Math.PI * Math.PI;
		for (let i = 0; i < 60; i++) {
			const Fh = evalF(zHigh);
			if (!Number.isNaN(Fh) && Fh >= 0) break;
			zHigh *= 0.5;
		}
	}

	// Bisection: find z where F(z) = 0, treating NaN as "too far negative"
	let z = (zLow + zHigh) / 2;
	for (let iter = 0; iter < 100; iter++) {
		const Fz = evalF(z);
		if (Number.isNaN(Fz)) {
			// y < 0: went too far, root is between z and zHigh
			zLow = z;
		} else if (Math.abs(Fz) < 1e-10) {
			break;
		} else if (Fz > 0) {
			zHigh = z;
		} else {
			zLow = z;
		}
		if (Math.abs(zHigh - zLow) < 1e-12 * (1 + Math.abs(z))) break;
		z = (zLow + zHigh) / 2;
	}

	// Final Lagrange coefficients
	const C = stumpffC(z);
	const S = stumpffS(z);
	const sqC = Math.sqrt(Math.abs(C));
	if (sqC < 1e-14) return null;
	const y = r1 + r2 + (A * (z * S - 1)) / sqC;
	if (y < 0) return null;

	const f = 1 - y / r1;
	const g = A * Math.sqrt(y / mu);
	const gdot = 1 - y / r2;

	if (Math.abs(g) < 1e-14) return null;

	return {
		v1x: (r2x - f * r1x) / g,
		v1z: (r2z - f * r1z) / g,
		v2x: (gdot * r2x - r1x) / g,
		v2z: (gdot * r2z - r1z) / g,
	};
}

// --- Universal variable orbit propagation ---

/**
 * Propagate a position along an orbit using universal variables.
 * Handles elliptic, parabolic, and hyperbolic orbits uniformly.
 *
 * @param r0x - initial x position (AU)
 * @param r0z - initial z position (AU)
 * @param v0x - initial x velocity (AU/day)
 * @param v0z - initial z velocity (AU/day)
 * @param dt - time step (days)
 * @param mu - gravitational parameter (AU³/day²)
 */
export function propagatePosition(
	r0x: number,
	r0z: number,
	v0x: number,
	v0z: number,
	dt: number,
	mu: number,
): Vector2Like {
	if (Math.abs(dt) < 1e-14) return { x: r0x, z: r0z };

	const r0 = Math.hypot(r0x, r0z);
	if (r0 < 1e-14) return { x: r0x, z: r0z };

	const v0sq = v0x * v0x + v0z * v0z;
	const vr0 = (r0x * v0x + r0z * v0z) / r0;
	const sqrtMu = Math.sqrt(mu);
	const alpha = 2 / r0 - v0sq / mu; // = 1/a

	// Initial chi estimate
	let chi: number;
	if (Math.abs(alpha) < 1e-10) {
		// Near-parabolic
		chi = (sqrtMu * dt) / r0;
	} else if (alpha > 0) {
		// Elliptic
		chi = sqrtMu * dt * alpha;
	} else {
		// Hyperbolic — use asymptotic estimate: chi ≈ sign(dt) * sqrt(-1/alpha) * ln(...)
		const a = 1 / alpha;
		const sma = Math.sqrt(-mu * a);
		const denom = r0 * vr0 + Math.sign(dt) * sma * (1 - r0 * alpha);
		if (Math.abs(denom) > 1e-14) {
			const arg = (-2 * mu * alpha * dt) / denom;
			if (arg > 0) {
				chi = Math.sign(dt) * Math.sqrt(-a) * Math.log(arg);
			} else {
				chi = Math.sign(dt) * Math.sqrt(-a) * 2; // fallback: moderate step
			}
		} else {
			chi = Math.sign(dt) * Math.sqrt(-a) * 2;
		}
	}
	if (!Number.isFinite(chi)) chi = (sqrtMu * dt) / r0;

	// Newton iteration: solve universal Kepler equation
	for (let iter = 0; iter < 50; iter++) {
		const psi = alpha * chi * chi;
		const c2 = stumpffC(psi);
		const c3 = stumpffS(psi);

		// Time from universal variable
		const Ftime =
			(vr0 / sqrtMu) * chi * chi * c2 +
			(1 - alpha * r0) * chi * chi * chi * c3 +
			r0 * chi;

		// Current radius (also the derivative dFtime/dchi)
		const r =
			chi * chi * c2 +
			(vr0 / sqrtMu) * chi * (1 - psi * c3) +
			r0 * (1 - psi * c2);

		if (r < 1e-14) break;

		const residual = sqrtMu * dt - Ftime;
		chi = chi + residual / r;

		if (Math.abs(residual) < 1e-10 * (1 + Math.abs(sqrtMu * dt))) break;
	}

	// Lagrange f and g coefficients
	const psi = alpha * chi * chi;
	const c2 = stumpffC(psi);
	const c3 = stumpffS(psi);

	const f = 1 - ((chi * chi) / r0) * c2;
	const g = dt - ((chi * chi * chi) / sqrtMu) * c3;

	return {
		x: f * r0x + g * v0x,
		z: f * r0z + g * v0z,
	};
}

// --- Coordinate conversions (world ↔ AU) ---

/**
 * Convert world coordinates to AU.
 * World uses sqrt-compressed radii: rWorld = sqrt(rAU) * DIST_SCALE
 */
export function worldToAU(wx: number, wz: number): Vector2Like {
	const rw = Math.hypot(wx, wz);
	if (rw < 1e-10) return { x: 0, z: 0 };
	const rau = (rw / DIST_SCALE) * (rw / DIST_SCALE);
	const scale = rau / rw;
	return { x: wx * scale, z: wz * scale };
}

/**
 * Convert AU coordinates to world.
 */
export function auToWorld(ax: number, az: number): Vector2Like {
	const rau = Math.hypot(ax, az);
	if (rau < 1e-10) return { x: 0, z: 0 };
	const rw = Math.sqrt(rau) * DIST_SCALE;
	const scale = rw / rau;
	return { x: ax * scale, z: az * scale };
}

/**
 * Convert an AU-space velocity direction to world-space direction.
 * The sqrt-compressed coordinate mapping distorts angles: radial distances
 * scale by 1/(2√r) while tangential distances scale by √r, so a velocity
 * direction in AU space has a different angle in world space.
 */
export function auVelToWorldDir(
	ax: number,
	az: number,
	vx: number,
	vz: number,
): number {
	const speed = Math.hypot(vx, vz);
	if (speed < 1e-14) return 0;
	const eps = 1e-8 / speed;
	const w0 = auToWorld(ax, az);
	const w1 = auToWorld(ax + vx * eps, az + vz * eps);
	return Math.atan2(w1.z - w0.z, w1.x - w0.x);
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
		(b) =>
			(b.type === "Planet" || b.type === "Dwarf Planet") &&
			b.period > 0 &&
			b.distance > 0,
	);
	if (!planet) return 1;
	return planet.distance ** 3 / planet.period ** 2;
}

// --- Existing game transfer helpers ---

export function hohmannTransfer(
	r1: number,
	r2: number,
	starMass: number = 1,
): HohmannResult {
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

export function isTransferComplete(
	elapsedDays: number,
	transferTimeDays: number,
): boolean {
	return elapsedDays >= transferTimeDays;
}
