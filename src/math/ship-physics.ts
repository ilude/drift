// Ship physics: fuel, thrust, and delta-v calculations
// Uses km/kg/s internally; accepts AU at boundaries

import type {
	EngineType,
	FuelCostResult,
	HohmannDeltaVResult,
	ShipPhysicsState,
	ThrottleResult,
	TransferResult,
} from "../types";

// --- Constants ---

export const AU_TO_KM: number = 149_597_870.7;
export const G_ACCEL: number = 9.80665; // m/s², standard gravity

// Sun's gravitational parameter in km³/s²
const MU_SUN_KM3S2: number = 1.32712440018e11;

// --- Conversions ---

/**
 * Gravitational parameter in km³/s² for a star of given solar masses.
 */
export function muKmS(solarMasses: number): number {
	return MU_SUN_KM3S2 * solarMasses;
}

/**
 * Exhaust velocity (m/s) from specific impulse (seconds).
 * ve = Isp * g0
 */
export function exhaustVelocity(ispS: number): number {
	return ispS * G_ACCEL;
}

// --- Tsiolkovsky rocket equation ---

/**
 * Delta-v from the rocket equation (km/s).
 * @param veKmS - exhaust velocity in km/s
 * @param wetMassKg - initial mass (fuel + dry)
 * @param dryMassKg - final mass (no fuel)
 * @returns delta-v in km/s
 */
export function rocketDeltaV(veKmS: number, wetMassKg: number, dryMassKg: number): number {
	if (wetMassKg <= dryMassKg || dryMassKg <= 0) return 0;
	return veKmS * Math.log(wetMassKg / dryMassKg);
}

/**
 * Fuel required (kg) to achieve a given delta-v.
 * Inverse of rocketDeltaV: fuelKg = dryMass * (e^(dv/ve) - 1)
 * @param veKmS - exhaust velocity in km/s
 * @param dryMassKg - dry mass in kg
 * @param dvKmS - desired delta-v in km/s
 * @returns fuel mass in kg
 */
export function fuelRequired(veKmS: number, dryMassKg: number, dvKmS: number): number {
	if (veKmS <= 0 || dryMassKg <= 0 || dvKmS <= 0) return 0;
	return dryMassKg * (Math.exp(dvKmS / veKmS) - 1);
}

// --- Hohmann transfer math ---

/**
 * Hohmann transfer delta-v between two circular orbits.
 * @param r1AU - departure orbit radius (AU)
 * @param r2AU - arrival orbit radius (AU)
 * @param starMassSolar - star mass in solar masses
 * @returns delta-v values in km/s
 */
export function hohmannDeltaV(
	r1AU: number,
	r2AU: number,
	starMassSolar: number,
): HohmannDeltaVResult {
	const mu = muKmS(starMassSolar);
	const r1 = r1AU * AU_TO_KM;
	const r2 = r2AU * AU_TO_KM;

	// Vis-viva: v = sqrt(mu * (2/r - 1/a))
	// Circular orbit velocity: v_circ = sqrt(mu / r)
	const v1circ = Math.sqrt(mu / r1);
	const v2circ = Math.sqrt(mu / r2);

	// Transfer orbit semi-major axis
	const aTransfer = (r1 + r2) / 2;

	// Velocity at departure and arrival on the transfer orbit
	const v1transfer = Math.sqrt(mu * (2 / r1 - 1 / aTransfer));
	const v2transfer = Math.sqrt(mu * (2 / r2 - 1 / aTransfer));

	const dvDepart = Math.abs(v1transfer - v1circ);
	const dvArrive = Math.abs(v2circ - v2transfer);
	const dvTotal = dvDepart + dvArrive;

	return { dvDepart, dvArrive, dvTotal };
}

/**
 * Hohmann transfer time in days.
 * @param r1AU - departure orbit radius (AU)
 * @param r2AU - arrival orbit radius (AU)
 * @param starMassSolar - star mass in solar masses
 * @returns transfer time in days
 */
export function hohmannTransferDays(r1AU: number, r2AU: number, starMassSolar: number): number {
	const mu = muKmS(starMassSolar);
	const r1 = r1AU * AU_TO_KM;
	const r2 = r2AU * AU_TO_KM;
	const aTransfer = (r1 + r2) / 2;

	// Half the orbital period of the transfer ellipse
	const T = Math.PI * Math.sqrt((aTransfer * aTransfer * aTransfer) / mu);
	return T / 86400; // seconds to days
}

// --- Brachistochrone transfer math ---

/**
 * Brachistochrone transfer time from straight-line distance in km.
 * @param distKm - straight-line distance in km
 * @param accelMS2 - sustained acceleration in m/s²
 * @returns transfer time in days
 */
export function brachistochroneTimeKm(distKm: number, accelMS2: number): number {
	const d = distKm * 1000; // meters
	const T = 2 * Math.sqrt(d / accelMS2); // seconds
	return T / 86400; // days
}

/**
 * Brachistochrone delta-v from straight-line distance in km.
 * @param distKm - straight-line distance in km
 * @param accelMS2 - sustained acceleration in m/s²
 * @returns delta-v in km/s
 */
export function brachistochroneDeltaVKm(distKm: number, accelMS2: number): number {
	const d = distKm * 1000; // meters
	const dv = 2 * Math.sqrt(d * accelMS2); // m/s
	return dv / 1000; // km/s
}

/** AU-based wrapper: brachistochrone transfer time between two orbital radii. */
export function brachistochroneTime(r1AU: number, r2AU: number, accelMS2: number): number {
	return brachistochroneTimeKm(Math.abs(r2AU - r1AU) * AU_TO_KM, accelMS2);
}

/** AU-based wrapper: brachistochrone delta-v between two orbital radii. */
export function brachistochroneDeltaV(r1AU: number, r2AU: number, accelMS2: number): number {
	return brachistochroneDeltaVKm(Math.abs(r2AU - r1AU) * AU_TO_KM, accelMS2);
}

// --- Operational burn (fuel consumed by maneuvering, course corrections, thruster wear) ---

/** Operational burn rate: fraction of fuel capacity consumed per transfer day. */
export const OP_BURN_RATE = 0.001; // 0.1%/day

/**
 * Compute total fuel cost for a brachistochrone transfer (additive model).
 * Returns rocket-equation fuel + operational burn as separate and combined values.
 */
export function computeTotalFuelCost(
	distKm: number,
	accelG: number,
	ispS: number,
	dryMassKg: number,
	fuelCapacityKg: number,
	opBurnMultiplier = 1.0,
): FuelCostResult {
	const accelMS2 = accelG * G_ACCEL;
	const dvKmS = brachistochroneDeltaVKm(distKm, accelMS2);
	const veKmS = exhaustVelocity(ispS) / 1000;
	const rocketFuelKg = fuelRequired(veKmS, dryMassKg, dvKmS);
	const transferDays = brachistochroneTimeKm(distKm, accelMS2);
	const opBurnKg = (OP_BURN_RATE * fuelCapacityKg * transferDays) / Math.max(0.01, opBurnMultiplier);
	return {
		rocketFuelKg,
		opBurnKg,
		totalFuelKg: rocketFuelKg + opBurnKg,
		transferDays,
	};
}

/**
 * Binary-search for the highest acceleration a ship can afford for a transfer.
 * Returns null if even minimum acceleration exceeds the fuel budget.
 */
export function findAffordableAccelG(
	distKm: number,
	ispS: number,
	dryMassKg: number,
	fuelCapacityKg: number,
	maxAccelG: number,
	fuelBudgetKg: number,
	opBurnMultiplier = 1.0,
	minAccelG = 0.001,
): ThrottleResult | null {
	// Check if max accel is already affordable
	const maxCost = computeTotalFuelCost(
		distKm,
		maxAccelG,
		ispS,
		dryMassKg,
		fuelCapacityKg,
		opBurnMultiplier,
	);
	if (maxCost.totalFuelKg <= fuelBudgetKg) {
		return {
			accelG: maxAccelG,
			totalFuelKg: maxCost.totalFuelKg,
			transferDays: maxCost.transferDays,
		};
	}

	// Check if even minimum accel is unaffordable
	const minCost = computeTotalFuelCost(
		distKm,
		minAccelG,
		ispS,
		dryMassKg,
		fuelCapacityKg,
		opBurnMultiplier,
	);
	if (minCost.totalFuelKg > fuelBudgetKg) return null;

	// Binary search for the highest affordable acceleration
	let lo = minAccelG;
	let hi = maxAccelG;
	for (let i = 0; i < 20; i++) {
		const mid = (lo + hi) / 2;
		const cost = computeTotalFuelCost(distKm, mid, ispS, dryMassKg, fuelCapacityKg, opBurnMultiplier);
		if (cost.totalFuelKg <= fuelBudgetKg) {
			lo = mid;
		} else {
			hi = mid;
		}
	}
	const finalCost = computeTotalFuelCost(
		distKm,
		lo,
		ispS,
		dryMassKg,
		fuelCapacityKg,
		opBurnMultiplier,
	);
	return { accelG: lo, totalFuelKg: finalCost.totalFuelKg, transferDays: finalCost.transferDays };
}

// --- Engine presets (Trans-Newtonian) ---

export const ENGINE_TYPES: EngineType[] = [
	{
		id: "conventional",
		name: "Conventional TN",
		accelG: 0.1,
		ispS: 1_000_000,
		dryMassKg: 5_000,
	},
	{
		id: "improved",
		name: "Improved TN",
		accelG: 10,
		ispS: 2_000_000,
		dryMassKg: 5_000,
	},
	{
		id: "advanced",
		name: "Advanced TN",
		accelG: 50,
		ispS: 5_000_000,
		dryMassKg: 5_000,
	},
	{
		id: "extreme",
		name: "Extreme TN",
		accelG: 200,
		ispS: 10_000_000,
		dryMassKg: 5_000,
	},
];

// --- Transfer feasibility check ---

/**
 * Check if a ship can perform a brachistochrone transfer between two orbits.
 * @param r1AU - departure orbit radius (AU)
 * @param r2AU - arrival orbit radius (AU)
 * @param starMassSolar - star mass in solar masses (unused, kept for API compat)
 * @param shipState - ship physics state
 * @returns transfer feasibility result
 */
/**
 * Check transfer feasibility using straight-line distance in km.
 */
/** AU-based wrapper: check transfer feasibility between two orbital radii. */
export function checkTransfer(
	r1AU: number,
	r2AU: number,
	_starMassSolar: number,
	shipState: ShipPhysicsState,
): TransferResult {
	return checkTransferKm(Math.abs(r2AU - r1AU) * AU_TO_KM, shipState);
}

export function checkTransferKm(distKm: number, shipState: ShipPhysicsState): TransferResult {
	const accelMS2 = shipState.accelG * G_ACCEL;
	const dvTotal = brachistochroneDeltaVKm(distKm, accelMS2);
	const veKmS = exhaustVelocity(shipState.ispS) / 1000;
	const wetMass = shipState.dryMassKg + shipState.fuelKg;
	const deltaVAvailable = rocketDeltaV(veKmS, wetMass, shipState.dryMassKg);
	const fuelUsedKg = fuelRequired(veKmS, shipState.dryMassKg, dvTotal);
	const transferDays = brachistochroneTimeKm(distKm, accelMS2);

	if (dvTotal > deltaVAvailable || fuelUsedKg > shipState.fuelKg) {
		return {
			feasible: false,
			deltaVRequired: dvTotal,
			deltaVAvailable,
			fuelUsedKg,
			transferDays,
		};
	}

	return {
		feasible: true,
		fuelUsedKg,
		deltaVRequired: dvTotal,
		deltaVAvailable,
		transferDays,
	};
}
