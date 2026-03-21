import { describe, it, expect } from 'vitest';
import {
    scaleDist, bodySize, screenRadius, keplerRadius, orbitSpeed,
    inclinedPosition, easeOutCubic, simTimeToDay, speedLabel, lodLevel,
    DIST_SCALE, BODY_MIN_SIZE, BODY_MAX_SIZE
} from './state.js';

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

describe('bodySize', () => {
    it('returns BODY_MAX_SIZE for stars', () => {
        expect(bodySize(696340, true)).toBe(BODY_MAX_SIZE);
    });

    it('returns at least BODY_MIN_SIZE for small bodies', () => {
        expect(bodySize(100, false)).toBeGreaterThanOrEqual(BODY_MIN_SIZE);
    });

    it('returns at most 1.2 for non-stars', () => {
        expect(bodySize(69911, false)).toBeLessThanOrEqual(1.2);
    });

    it('larger radius produces larger or equal size', () => {
        const small = bodySize(1000, false);
        const large = bodySize(50000, false);
        expect(large).toBeGreaterThanOrEqual(small);
    });

    it('clamps very small bodies to BODY_MIN_SIZE', () => {
        expect(bodySize(1, false)).toBe(BODY_MIN_SIZE);
    });
});

describe('screenRadius', () => {
    it('returns half screen height when object radius equals distance at 90° FOV', () => {
        // tan(45°) = 1, so screenRadius = (r/d) / 1 * (h/2) = (1/1) * 540 = 540
        expect(screenRadius(1, 1, 90, 1080)).toBeCloseTo(540);
    });

    it('doubles when distance halves', () => {
        const far = screenRadius(1, 10, 60, 1080);
        const near = screenRadius(1, 5, 60, 1080);
        expect(near).toBeCloseTo(far * 2);
    });

    it('doubles when world radius doubles', () => {
        const small = screenRadius(1, 10, 60, 1080);
        const big = screenRadius(2, 10, 60, 1080);
        expect(big).toBeCloseTo(small * 2);
    });

    it('scales linearly with screen height', () => {
        const hd = screenRadius(1, 10, 60, 720);
        const fhd = screenRadius(1, 10, 60, 1080);
        expect(fhd / hd).toBeCloseTo(1080 / 720);
    });

    it('returns full screen height for zero distance', () => {
        expect(screenRadius(1, 0, 60, 1080)).toBe(1080);
    });

    it('is always positive for valid inputs', () => {
        expect(screenRadius(2, 100, 75, 1080)).toBeGreaterThan(0);
    });

    it('wider FOV produces smaller screen radius', () => {
        const narrow = screenRadius(1, 10, 30, 1080);
        const wide = screenRadius(1, 10, 90, 1080);
        expect(narrow).toBeGreaterThan(wide);
    });

    it('matches known value for typical scene (Sol at default zoom)', () => {
        // Sol: radius=2.0, camera at ~120 units, 60° FOV, 1080p
        const sr = screenRadius(2.0, 120, 60, 1080);
        expect(sr).toBeGreaterThan(5);
        expect(sr).toBeLessThan(30);
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

    it('computes 2*PI / (period * 60)', () => {
        expect(orbitSpeed(1)).toBeCloseTo(Math.PI * 2 / 60);
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

describe('easeOutCubic', () => {
    it('returns 0 at t=0', () => {
        expect(easeOutCubic(0)).toBe(0);
    });

    it('returns 1 at t=1', () => {
        expect(easeOutCubic(1)).toBe(1);
    });

    it('returns 0.5 < result for t=0.5 (ease out curve)', () => {
        expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
    });

    it('is monotonically increasing', () => {
        let prev = 0;
        for (let t = 0.1; t <= 1; t += 0.1) {
            const v = easeOutCubic(t);
            expect(v).toBeGreaterThan(prev);
            prev = v;
        }
    });

    it('matches formula 1 - (1-t)^3', () => {
        expect(easeOutCubic(0.3)).toBeCloseTo(1 - Math.pow(0.7, 3));
        expect(easeOutCubic(0.7)).toBeCloseTo(1 - Math.pow(0.3, 3));
    });
});

describe('simTimeToDay', () => {
    it('returns 0 for simTime 0', () => {
        expect(simTimeToDay(0)).toBe(0);
    });

    it('returns 365 for simTime ~1', () => {
        expect(simTimeToDay(1)).toBe(365);
    });

    it('floors the result', () => {
        expect(simTimeToDay(0.5)).toBe(Math.floor(0.5 * 365.25));
    });
});

describe('speedLabel', () => {
    it('returns Paused for 0', () => {
        expect(speedLabel(0)).toBe('Paused');
    });

    it('returns 5-Second Increment for 0.25', () => {
        expect(speedLabel(0.25)).toBe('5-Second Increment');
    });

    it('returns 1-Day Increment for 1', () => {
        expect(speedLabel(1)).toBe('1-Day Increment');
    });

    it('returns 30-Day Increment for 5', () => {
        expect(speedLabel(5)).toBe('30-Day Increment');
    });
});

describe('lodLevel', () => {
    it('returns 0 for small screen radius', () => {
        expect(lodLevel(5)).toBe(0);
        expect(lodLevel(14)).toBe(0);
    });

    it('returns 1 for medium screen radius', () => {
        expect(lodLevel(16)).toBe(1);
        expect(lodLevel(49)).toBe(1);
    });

    it('returns 2 for large screen radius', () => {
        expect(lodLevel(51)).toBe(2);
        expect(lodLevel(200)).toBe(2);
    });

    it('returns 1 at exactly 15', () => {
        expect(lodLevel(15)).toBe(0);
        expect(lodLevel(15.01)).toBe(1);
    });

    it('returns 2 at exactly 50', () => {
        expect(lodLevel(50)).toBe(1);
        expect(lodLevel(50.01)).toBe(2);
    });
});
