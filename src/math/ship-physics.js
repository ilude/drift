// Ship physics: fuel, thrust, and delta-v calculations
// Uses km/kg/s internally; accepts AU at boundaries

// --- Constants ---

export const AU_TO_KM = 149_597_870.7;
export const G_ACCEL = 9.80665; // m/s², standard gravity

// Sun's gravitational parameter in km³/s²
const MU_SUN_KM3S2 = 1.32712440018e11;

// --- Conversions ---

/**
 * Gravitational parameter in km³/s² for a star of given solar masses.
 */
export function muKmS(solarMasses) {
    return MU_SUN_KM3S2 * solarMasses;
}

/**
 * Exhaust velocity (m/s) from specific impulse (seconds).
 * ve = Isp * g0
 */
export function exhaustVelocity(ispS) {
    return ispS * G_ACCEL;
}

// --- Tsiolkovsky rocket equation ---

/**
 * Delta-v from the rocket equation (km/s).
 * @param {number} veKmS - exhaust velocity in km/s
 * @param {number} wetMassKg - initial mass (fuel + dry)
 * @param {number} dryMassKg - final mass (no fuel)
 * @returns {number} delta-v in km/s
 */
export function rocketDeltaV(veKmS, wetMassKg, dryMassKg) {
    if (wetMassKg <= dryMassKg || dryMassKg <= 0) return 0;
    return veKmS * Math.log(wetMassKg / dryMassKg);
}

/**
 * Fuel required (kg) to achieve a given delta-v.
 * Inverse of rocketDeltaV: fuelKg = dryMass * (e^(dv/ve) - 1)
 * @param {number} veKmS - exhaust velocity in km/s
 * @param {number} dryMassKg - dry mass in kg
 * @param {number} dvKmS - desired delta-v in km/s
 * @returns {number} fuel mass in kg
 */
export function fuelRequired(veKmS, dryMassKg, dvKmS) {
    if (veKmS <= 0 || dryMassKg <= 0 || dvKmS <= 0) return 0;
    return dryMassKg * (Math.exp(dvKmS / veKmS) - 1);
}

// --- Hohmann transfer math ---

/**
 * Hohmann transfer delta-v between two circular orbits.
 * @param {number} r1AU - departure orbit radius (AU)
 * @param {number} r2AU - arrival orbit radius (AU)
 * @param {number} starMassSolar - star mass in solar masses
 * @returns {{ dvDepart: number, dvArrive: number, dvTotal: number }} delta-v values in km/s
 */
export function hohmannDeltaV(r1AU, r2AU, starMassSolar) {
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
 * @param {number} r1AU - departure orbit radius (AU)
 * @param {number} r2AU - arrival orbit radius (AU)
 * @param {number} starMassSolar - star mass in solar masses
 * @returns {number} transfer time in days
 */
export function hohmannTransferDays(r1AU, r2AU, starMassSolar) {
    const mu = muKmS(starMassSolar);
    const r1 = r1AU * AU_TO_KM;
    const r2 = r2AU * AU_TO_KM;
    const aTransfer = (r1 + r2) / 2;

    // Half the orbital period of the transfer ellipse
    const T = Math.PI * Math.sqrt(aTransfer * aTransfer * aTransfer / mu);
    return T / 86400; // seconds to days
}

// --- Brachistochrone transfer math ---

/**
 * Brachistochrone transfer time: accelerate halfway, flip, decelerate.
 * @param {number} r1AU - departure orbit radius (AU)
 * @param {number} r2AU - arrival orbit radius (AU)
 * @param {number} accelMS2 - sustained acceleration in m/s²
 * @returns {number} transfer time in days
 */
export function brachistochroneTime(r1AU, r2AU, accelMS2) {
    const d = Math.abs(r2AU - r1AU) * AU_TO_KM * 1000; // meters
    const T = 2 * Math.sqrt(d / accelMS2); // seconds
    return T / 86400; // days
}

/**
 * Brachistochrone delta-v: dv = 2 * sqrt(d * a).
 * @param {number} r1AU - departure orbit radius (AU)
 * @param {number} r2AU - arrival orbit radius (AU)
 * @param {number} accelMS2 - sustained acceleration in m/s²
 * @returns {number} delta-v in km/s
 */
export function brachistochroneDeltaV(r1AU, r2AU, accelMS2) {
    const d = Math.abs(r2AU - r1AU) * AU_TO_KM * 1000; // meters
    const dv = 2 * Math.sqrt(d * accelMS2); // m/s
    return dv / 1000; // km/s
}

// --- Engine presets (Trans-Newtonian) ---

export const ENGINE_TYPES = [
    { id: 'conventional', name: 'Conventional TN', accelG: 1,   ispS: 1_000_000,  dryMassKg: 5_000 },
    { id: 'improved',     name: 'Improved TN',     accelG: 10,  ispS: 2_000_000,  dryMassKg: 5_000 },
    { id: 'advanced',     name: 'Advanced TN',     accelG: 50,  ispS: 5_000_000,  dryMassKg: 5_000 },
    { id: 'extreme',      name: 'Extreme TN',      accelG: 200, ispS: 10_000_000, dryMassKg: 5_000 },
];

// --- Transfer feasibility check ---

/**
 * Check if a ship can perform a brachistochrone transfer between two orbits.
 * @param {number} r1AU - departure orbit radius (AU)
 * @param {number} r2AU - arrival orbit radius (AU)
 * @param {number} starMassSolar - star mass in solar masses (unused, kept for API compat)
 * @param {{ fuelKg: number, dryMassKg: number, engineId: string }} shipState
 * @returns {{ feasible: boolean, fuelUsedKg?: number, deltaVRequired?: number,
 *             deltaVAvailable?: number, transferDays?: number }}
 */
export function checkTransfer(r1AU, r2AU, starMassSolar, shipState) {
    const engine = ENGINE_TYPES.find(e => e.id === shipState.engineId);
    if (!engine) return { feasible: false };

    const accelMS2 = engine.accelG * G_ACCEL;
    const dvTotal = brachistochroneDeltaV(r1AU, r2AU, accelMS2);
    const veKmS = exhaustVelocity(engine.ispS) / 1000; // m/s to km/s
    const wetMass = shipState.dryMassKg + shipState.fuelKg;
    const deltaVAvailable = rocketDeltaV(veKmS, wetMass, shipState.dryMassKg);
    const fuelUsedKg = fuelRequired(veKmS, shipState.dryMassKg, dvTotal);
    const transferDays = brachistochroneTime(r1AU, r2AU, accelMS2);

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
