import { describe, it, expect } from 'vitest';
import {
    AU_TO_KM, G_ACCEL,
    muKmS, exhaustVelocity,
    rocketDeltaV, fuelRequired,
    hohmannDeltaV, hohmannTransferDays,
    ENGINE_TYPES, checkTransfer,
} from '../math/ship-physics.js';

// --- Cycle 1: Constants and conversions ---

describe('constants', () => {
    it('AU_TO_KM is 149,597,870.7', () => {
        expect(AU_TO_KM).toBe(149_597_870.7);
    });

    it('G_ACCEL is standard gravity', () => {
        expect(G_ACCEL).toBeCloseTo(9.80665, 4);
    });
});

describe('muKmS', () => {
    it('returns Sun gravitational parameter for 1 solar mass', () => {
        const mu = muKmS(1.0);
        expect(mu / 1e11).toBeCloseTo(1.327, 2);
    });

    it('scales linearly with mass', () => {
        expect(muKmS(2.0)).toBeCloseTo(muKmS(1.0) * 2, -5);
    });
});

describe('exhaustVelocity', () => {
    it('chemical engine Isp 320s gives ~3139 m/s', () => {
        const ve = exhaustVelocity(320);
        expect(ve).toBeCloseTo(3138.1, 0);
    });

    it('ion engine Isp 3000s gives ~29420 m/s', () => {
        const ve = exhaustVelocity(3000);
        expect(ve).toBeCloseTo(29420, -1);
    });
});

// --- Cycle 2: Tsiolkovsky rocket equation ---

describe('rocketDeltaV', () => {
    it('mass ratio 3 with ve=3.138 km/s gives ~3.45 km/s', () => {
        const dv = rocketDeltaV(3.138, 30000, 10000);
        expect(dv).toBeCloseTo(3.45, 1);
    });

    it('returns 0 when wet <= dry', () => {
        expect(rocketDeltaV(3.138, 10000, 10000)).toBe(0);
        expect(rocketDeltaV(3.138, 5000, 10000)).toBe(0);
    });

    it('returns 0 when dry mass is zero', () => {
        expect(rocketDeltaV(3.138, 10000, 0)).toBe(0);
    });
});

describe('fuelRequired', () => {
    it('inverse of rocketDeltaV: mass ratio 3 case', () => {
        const fuel = fuelRequired(3.138, 10000, 3.45);
        expect(fuel).toBeCloseTo(20000, -2);
    });

    it('returns 0 for zero delta-v', () => {
        expect(fuelRequired(3.138, 10000, 0)).toBe(0);
    });

    it('round-trip consistency with rocketDeltaV', () => {
        const ve = 3.138;
        const wet = 50000;
        const dry = 15000;
        const dv = rocketDeltaV(ve, wet, dry);
        const fuelCalc = fuelRequired(ve, dry, dv);
        expect(fuelCalc).toBeCloseTo(wet - dry, 0);
    });
});

// --- Cycle 3: Hohmann transfer math ---

describe('hohmannDeltaV', () => {
    it('Earth to Mars (~5.59 km/s total)', () => {
        const result = hohmannDeltaV(1.0, 1.524, 1.0);
        expect(result.dvTotal).toBeCloseTo(5.59, 1);
    });

    it('Earth to Jupiter departure burn ~8.79 km/s, total ~14.4 km/s', () => {
        const result = hohmannDeltaV(1.0, 5.203, 1.0);
        expect(result.dvDepart).toBeCloseTo(8.79, 0);
        expect(result.dvTotal).toBeCloseTo(14.4, 0);
    });

    it('symmetry: dvTotal is same regardless of direction', () => {
        const outbound = hohmannDeltaV(1.0, 1.524, 1.0);
        const inbound = hohmannDeltaV(1.524, 1.0, 1.0);
        expect(outbound.dvTotal).toBeCloseTo(inbound.dvTotal, 6);
    });

    it('has departure and arrival components', () => {
        const result = hohmannDeltaV(1.0, 1.524, 1.0);
        expect(result.dvDepart).toBeGreaterThan(0);
        expect(result.dvArrive).toBeGreaterThan(0);
        expect(result.dvDepart + result.dvArrive).toBeCloseTo(result.dvTotal, 10);
    });
});

describe('hohmannTransferDays', () => {
    it('Earth to Mars ~259 days', () => {
        const days = hohmannTransferDays(1.0, 1.524, 1.0);
        expect(days).toBeCloseTo(259, -1);
    });

    it('Earth to Jupiter ~997 days', () => {
        const days = hohmannTransferDays(1.0, 5.203, 1.0);
        expect(days).toBeCloseTo(997, -1);
    });

    it('symmetry: same time regardless of direction', () => {
        const outbound = hohmannTransferDays(1.0, 1.524, 1.0);
        const inbound = hohmannTransferDays(1.524, 1.0, 1.0);
        expect(outbound).toBeCloseTo(inbound, 6);
    });
});

// --- Cycle 4: Engine presets and transfer feasibility ---

describe('ENGINE_TYPES', () => {
    it('has chemical, ion, nuclear, fusion entries', () => {
        const ids = ENGINE_TYPES.map(e => e.id);
        expect(ids).toContain('chemical');
        expect(ids).toContain('ion');
        expect(ids).toContain('nuclear');
        expect(ids).toContain('fusion');
    });

    it('each engine has required fields', () => {
        ENGINE_TYPES.forEach(engine => {
            expect(engine).toHaveProperty('id');
            expect(engine).toHaveProperty('name');
            expect(engine).toHaveProperty('thrustN');
            expect(engine).toHaveProperty('ispS');
            expect(engine).toHaveProperty('dryMassKg');
        });
    });
});

describe('checkTransfer', () => {
    it('feasible for well-fueled chemical ship (Earth to Mars)', () => {
        const ship = { fuelKg: 80000, dryMassKg: 10000, engineId: 'chemical' };
        const result = checkTransfer(1.0, 1.524, 1.0, ship);
        expect(result.feasible).toBe(true);
        expect(result.fuelUsedKg).toBeGreaterThan(0);
        expect(result.deltaVRequired).toBeCloseTo(5.59, 1);
        expect(result.transferDays).toBeCloseTo(259, -1);
    });

    it('infeasible with near-zero fuel', () => {
        const ship = { fuelKg: 1, dryMassKg: 10000, engineId: 'chemical' };
        const result = checkTransfer(1.0, 1.524, 1.0, ship);
        expect(result.feasible).toBe(false);
    });

    it('fuel consumed matches fuelRequired for same delta-v', () => {
        const ship = { fuelKg: 200000, dryMassKg: 10000, engineId: 'chemical' };
        const result = checkTransfer(1.0, 1.524, 1.0, ship);
        const engine = ENGINE_TYPES.find(e => e.id === 'chemical');
        const veKmS = exhaustVelocity(engine.ispS) / 1000;
        const expectedFuel = fuelRequired(veKmS, ship.dryMassKg, result.deltaVRequired);
        expect(result.fuelUsedKg).toBeCloseTo(expectedFuel, 6);
    });

    it('infeasible with unknown engine', () => {
        const ship = { fuelKg: 100000, dryMassKg: 10000, engineId: 'warp' };
        const result = checkTransfer(1.0, 1.524, 1.0, ship);
        expect(result.feasible).toBe(false);
    });

    it('fusion engine makes Jupiter transfer feasible', () => {
        const ship = { fuelKg: 50000, dryMassKg: 10000, engineId: 'fusion' };
        const result = checkTransfer(1.0, 5.203, 1.0, ship);
        expect(result.feasible).toBe(true);
    });
});
