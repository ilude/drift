import { describe, it, expect } from 'vitest';
import { scaleDist, bodySize, DIST_SCALE, BODY_MIN_SIZE, BODY_MAX_SIZE } from './state.js';

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
