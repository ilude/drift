import { describe, it, expect } from 'vitest';
import { simTimeToDay, simTimeToDate, SIM_EPOCH, speedLabel } from './state.js';

describe('simTimeToDay', () => {
    it('returns 0 for simTime 0', () => {
        expect(simTimeToDay(0)).toBe(0);
    });

    it('returns 1 for simTime 1', () => {
        expect(simTimeToDay(1)).toBe(1);
    });

    it('floors the result', () => {
        expect(simTimeToDay(0.5)).toBe(0);
    });
});

describe('simTimeToDate', () => {
    it('returns epoch date at simTime 0', () => {
        const d = simTimeToDate(0);
        expect(d.getFullYear()).toBe(2038);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(20);
    });

    it('advances by one day per simTime unit', () => {
        const d = simTimeToDate(10);
        expect(d.getDate()).toBe(30);
    });

    it('rolls over months correctly', () => {
        const d = simTimeToDate(365);
        expect(d.getFullYear()).toBe(2039);
    });
});

describe('speedLabel', () => {
    it('returns Paused for 0', () => {
        expect(speedLabel(0)).toBe('Paused');
    });

    it('returns 1 day / sec for 1', () => {
        expect(speedLabel(1)).toBe('1 day / sec');
    });

    it('returns 6 days / sec for 6', () => {
        expect(speedLabel(6)).toBe('6 days / sec');
    });

    it('returns 1 month / sec for 30', () => {
        expect(speedLabel(30)).toBe('1 month / sec');
    });
});
