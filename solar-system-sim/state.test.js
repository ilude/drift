import { describe, it, expect } from 'vitest';
import { simTimeToDay, speedLabel } from './state.js';

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
