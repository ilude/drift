import { describe, it, expect } from 'vitest';
import { scaleDist, keplerRadius, orbitSpeed, DAYS_PER_YEAR, meanToTrue, inclinedPosition, DIST_SCALE } from './orbit.js';

describe('scaleDist', () => {
    it('returns 0 for 0 AU', () => {
        expect(scaleDist(0)).toBe(0);
    });

    it('returns DIST_SCALE for 1 AU', () => {
        expect(scaleDist(1)).toBe(DIST_SCALE);
    });

    it('computes sqrt(au) * DIST_SCALE', () => {
        expect(scaleDist(4)).toBeCloseTo(2 * DIST_SCALE);
        expect(scaleDist(9)).toBeCloseTo(3 * DIST_SCALE);
    });

    it('scales sub-linearly (outer planets not absurdly far)', () => {
        const inner = scaleDist(1);
        const outer = scaleDist(30);
        expect(outer / inner).toBeLessThan(30);
    });
});

describe('keplerRadius', () => {
    it('returns semi-major axis for circular orbit (e=0)', () => {
        expect(keplerRadius(10, 0, 0)).toBeCloseTo(10);
        expect(keplerRadius(10, 0, Math.PI)).toBeCloseTo(10);
    });

    it('returns perihelion at theta=0', () => {
        // perihelion = a * (1 - e)
        expect(keplerRadius(10, 0.5, 0)).toBeCloseTo(10 * (1 - 0.5));
    });

    it('returns aphelion at theta=PI', () => {
        // aphelion = a * (1 + e)
        expect(keplerRadius(10, 0.5, Math.PI)).toBeCloseTo(10 * (1 + 0.5));
    });

    it('perihelion < aphelion for eccentric orbit', () => {
        const peri = keplerRadius(10, 0.9, 0);
        const aph = keplerRadius(10, 0.9, Math.PI);
        expect(peri).toBeLessThan(aph);
    });

    it('is always positive for valid orbital elements', () => {
        for (let theta = 0; theta < Math.PI * 2; theta += 0.1) {
            expect(keplerRadius(5, 0.8, theta)).toBeGreaterThan(0);
        }
    });
});

describe('orbitSpeed', () => {
    it('returns 0 for period 0', () => {
        expect(orbitSpeed(0)).toBe(0);
    });

    it('returns positive for positive period', () => {
        expect(orbitSpeed(1)).toBeGreaterThan(0);
    });

    it('shorter period = faster speed', () => {
        expect(orbitSpeed(1)).toBeGreaterThan(orbitSpeed(10));
    });

    it('computes 2*PI / (period * DAYS_PER_YEAR)', () => {
        expect(orbitSpeed(1)).toBeCloseTo(Math.PI * 2 / DAYS_PER_YEAR);
    });
});

describe('meanToTrue', () => {
    it('returns 0 for M=0 at any eccentricity', () => {
        expect(meanToTrue(0, 0)).toBeCloseTo(0);
        expect(meanToTrue(0, 0.5)).toBeCloseTo(0);
        expect(meanToTrue(0, 0.99)).toBeCloseTo(0);
    });

    it('returns PI for M=PI at any eccentricity', () => {
        expect(meanToTrue(Math.PI, 0)).toBeCloseTo(Math.PI);
        expect(meanToTrue(Math.PI, 0.5)).toBeCloseTo(Math.PI);
        expect(meanToTrue(Math.PI, 0.96)).toBeCloseTo(Math.PI);
    });

    it('equals M for circular orbit (e=0)', () => {
        expect(meanToTrue(1.0, 0)).toBeCloseTo(1.0);
        expect(meanToTrue(2.5, 0)).toBeCloseTo(2.5);
    });

    it('true anomaly leads mean anomaly for 0 < M < PI', () => {
        // Kepler's law: body moves faster at perihelion
        const theta = meanToTrue(1.0, 0.5);
        expect(theta).toBeGreaterThan(1.0);
    });

    it('high eccentricity produces large lead near perihelion', () => {
        // Halley-like e=0.967, small M → theta should be much larger
        const theta = meanToTrue(0.1, 0.967);
        expect(theta).toBeGreaterThan(0.5);
    });
});

describe('inclinedPosition', () => {
    it('returns identity for zero inclination and zero node', () => {
        const p = inclinedPosition(10, 5, 1, 0, 1, 0); // cos(0)=1, sin(0)=0
        expect(p.x).toBeCloseTo(10);
        expect(p.y).toBeCloseTo(0);
        expect(p.z).toBeCloseTo(5);
    });

    it('y is non-zero for non-zero inclination', () => {
        const cosI = Math.cos(0.3);
        const sinI = Math.sin(0.3);
        const p = inclinedPosition(10, 5, 1, 0, cosI, sinI);
        expect(p.y).not.toBeCloseTo(0);
    });

    it('180° node rotation negates x and z', () => {
        const cosN = Math.cos(Math.PI);
        const sinN = Math.sin(Math.PI);
        const p = inclinedPosition(10, 5, cosN, sinN, 1, 0);
        expect(p.x).toBeCloseTo(10);
        expect(p.y).toBeCloseTo(0);
        expect(p.z).toBeCloseTo(5);
    });

    it('preserves distance from origin (no inclination)', () => {
        const x = 3, z = 4;
        const p = inclinedPosition(x, z, 1, 0, 1, 0);
        const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
        expect(dist).toBeCloseTo(5);
    });
});
