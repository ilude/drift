import { describe, it, expect } from 'vitest';
import { seededRandom } from '../core/utils';

describe('seededRandom', () => {
    it('produces deterministic output for same seed', () => {
        const rng1 = seededRandom(42);
        const rng2 = seededRandom(42);
        for (let i = 0; i < 100; i++) {
            expect(rng1()).toBe(rng2());
        }
    });

    it('produces different output for different seeds', () => {
        const rng1 = seededRandom(1);
        const rng2 = seededRandom(2);
        const seq1 = Array.from({ length: 10 }, () => rng1());
        const seq2 = Array.from({ length: 10 }, () => rng2());
        expect(seq1).not.toEqual(seq2);
    });

    it('returns values in [0, 1) range', () => {
        const rng = seededRandom(12345);
        for (let i = 0; i < 1000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('handles seed=0 by defaulting to 1', () => {
        const rng = seededRandom(0);
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
    });

    it('handles negative seed', () => {
        const rng = seededRandom(-99);
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
    });

    it('handles large seed', () => {
        const rng = seededRandom(2147483646);
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
    });
});
