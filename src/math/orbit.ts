import type { PlanetCategory, Vector3Like } from "../types";

export const DIST_SCALE: number = 200;
export const MOON_DIST_SCALE: number = 25;

export function scaleDist(au: number): number {
	return Math.sqrt(au) * DIST_SCALE;
}

export function keplerRadius(a: number, e: number, theta: number): number {
	return (a * (1 - e * e)) / (1 + e * Math.cos(theta));
}

export const DAYS_PER_YEAR: number = 365.25;

export function orbitSpeed(period: number): number {
	return period > 0 ? (Math.PI * 2) / (period * DAYS_PER_YEAR) : 0;
}

export function meanToTrue(M: number, e: number): number {
	// Normalize M to [0, 2π]
	M = M % (Math.PI * 2);
	if (M < 0) M += Math.PI * 2;

	// Solve Kepler's equation: M = E - e*sin(E)
	// Better initial guess for high eccentricity
	let E: number = e < 0.8 ? M + e * Math.sin(M) : Math.PI;

	for (let i = 0; i < 20; i++) {
		const denom: number = 1 - e * Math.cos(E);
		if (Math.abs(denom) < 1e-12) break;
		const dE: number = (E - e * Math.sin(E) - M) / denom;
		E -= dE;
		if (Math.abs(dE) < 1e-12) break;
	}

	// Eccentric anomaly E → true anomaly θ
	const halfE: number = E / 2;
	return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(halfE), Math.sqrt(1 - e) * Math.cos(halfE));
}

// Transform orbital plane coordinates to 3D world space using Ω, i, ω
const _orbitOut: Vector3Like = { x: 0, y: 0, z: 0 };

export function orbitToWorld(
	x: number,
	z: number,
	incRad: number,
	nodeRad: number,
	periRad: number,
): Vector3Like {
	const cosW = Math.cos(periRad),
		sinW = Math.sin(periRad);
	const x1 = x * cosW - z * sinW;
	const z1 = x * sinW + z * cosW;

	const cosI = Math.cos(incRad),
		sinI = Math.sin(incRad);
	const x2 = x1;
	const y2 = z1 * sinI;
	const z2 = z1 * cosI;

	const cosN = Math.cos(nodeRad),
		sinN = Math.sin(nodeRad);
	_orbitOut.x = x2 * cosN - z2 * sinN;
	_orbitOut.y = y2;
	_orbitOut.z = x2 * sinN + z2 * cosN;

	return _orbitOut;
}

const _incOut: Vector3Like = { x: 0, y: 0, z: 0 };

export function inclinedPosition(
	x: number,
	z: number,
	cosN: number,
	sinN: number,
	cosI: number,
	sinI: number,
): Vector3Like {
	const xn: number = x * cosN + z * sinN;
	const zn: number = -x * sinN + z * cosN;
	const yn: number = zn * sinI;
	const znTilt: number = zn * cosI;
	_incOut.x = xn * cosN - znTilt * sinN;
	_incOut.y = yn;
	_incOut.z = xn * sinN + znTilt * cosN;
	return _incOut;
}

export function keplerPeriod(distAU: number, starMass: number): number {
	return Math.sqrt(distAU ** 3 / starMass);
}

export function radiusToMassEarths(radiusEarths: number): number {
	if (radiusEarths < 1.5) return radiusEarths ** 3.7;
	if (radiusEarths < 4) return 2.7 * radiusEarths ** 1.3;
	return 10 * (radiusEarths / 4) ** 2 * 317.8;
}

export function hillRadius(
	distAU: number,
	planetMassEarths: number,
	starMassSolar: number,
): number {
	const massRatio: number = (planetMassEarths * 3e-6) / starMassSolar;
	return distAU * (massRatio / 3) ** (1 / 3);
}

export function categorizePlanet(radiusEarths: number): PlanetCategory {
	if (radiusEarths < 1.8) return "rocky";
	if (radiusEarths < 4) return "subNeptune";
	if (radiusEarths < 8) return "iceGiant";
	return "gasGiant";
}

/**
 * Generate trail positions by computing orbital positions backwards through time.
 * Returns flat Float32Array of [x,y,z, x,y,z, ...] positions in world space.
 * All positions are planar (y=0) — inclination is not applied here.
 */
export function generateTrailPositions(
	baseAngle: number,
	angularSpeed: number,
	eccentricity: number,
	distance: number,
	maxPoints: number,
): Float32Array {
	const positions = new Float32Array(maxPoints * 3);
	const stepAngle = Math.abs(angularSpeed) * 0.02;
	if (stepAngle === 0) return positions;

	for (let i = 0; i < maxPoints; i++) {
		const pastAngle = baseAngle - stepAngle * (maxPoints - i);
		const theta = meanToTrue(pastAngle, eccentricity);
		const kr = keplerRadius(distance, eccentricity, theta);
		const r = scaleDist(kr);
		const i3 = i * 3;
		positions[i3] = Math.cos(theta) * r;
		positions[i3 + 1] = 0;
		positions[i3 + 2] = Math.sin(theta) * r;
	}

	return positions;
}
