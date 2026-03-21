import { describe, it, expect } from 'vitest';
import { bodySize, screenRadius, lodLevel, easeOutCubic, BODY_MIN_SIZE, BODY_MAX_SIZE } from './visual.js';

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
