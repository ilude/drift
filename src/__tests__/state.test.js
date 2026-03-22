/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { simTimeToDay, simTimeToDate, speedLabel, truncateDate, formatDateTime, state, restoreShipState } from '../core/state.js';

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

describe('simTimeToDate fractional days', () => {
    it('returns noon for simTime 0.5', () => {
        const d = simTimeToDate(0.5);
        expect(d.getHours()).toBe(12);
        expect(d.getMinutes()).toBe(0);
    });

    it('returns 6 AM for simTime 0.25', () => {
        const d = simTimeToDate(0.25);
        expect(d.getHours()).toBe(6);
        expect(d.getMinutes()).toBe(0);
    });

    it('returns 6 PM for simTime 0.75', () => {
        const d = simTimeToDate(0.75);
        expect(d.getHours()).toBe(18);
        expect(d.getMinutes()).toBe(0);
    });

    it('handles fractional hours', () => {
        const d = simTimeToDate(1 / 24); // 1 hour into day
        expect(d.getDate()).toBe(20);
        expect(d.getHours()).toBe(1);
    });
});

describe('truncateDate', () => {
    it('preserves full precision at very slow speeds', () => {
        const d = new Date(2038, 0, 20, 14, 30, 45);
        truncateDate(d, 5 / 86400);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(30);
        expect(d.getSeconds()).toBe(45);
    });

    it('zeros seconds at minute-level speeds', () => {
        const d = new Date(2038, 0, 20, 14, 30, 45);
        truncateDate(d, 2 / 1440);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(30);
        expect(d.getSeconds()).toBe(0);
    });

    it('zeros minutes and seconds at hour-level speeds', () => {
        const d = new Date(2038, 0, 20, 14, 30, 45);
        truncateDate(d, 1 / 24);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
    });

    it('zeros hours, minutes, seconds at day-level speeds', () => {
        const d = new Date(2038, 0, 20, 14, 30, 45);
        truncateDate(d, 8 / 24);
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
        expect(d.getDate()).toBe(20);
    });

    it('pins day to 1st at month-level speeds', () => {
        const d = new Date(2038, 5, 15, 14, 30, 45);
        truncateDate(d, 30);
        expect(d.getDate()).toBe(1);
        expect(d.getHours()).toBe(0);
    });
});

describe('formatDateTime', () => {
    it('formats date with zero-padded components', () => {
        const d = new Date(2038, 0, 5, 3, 7, 9);
        expect(formatDateTime(d)).toBe('2038-01-05 03:07:09');
    });

    it('formats midnight as 00:00:00', () => {
        const d = new Date(2038, 0, 20, 0, 0, 0);
        expect(formatDateTime(d)).toBe('2038-01-20 00:00:00');
    });

    it('formats end of day correctly', () => {
        const d = new Date(2038, 11, 31, 23, 59, 59);
        expect(formatDateTime(d)).toBe('2038-12-31 23:59:59');
    });
});

describe('speedLabel', () => {
    it('returns Paused for 0', () => {
        expect(speedLabel(0)).toBe('Paused');
    });

    it('shows hours for fractional days', () => {
        expect(speedLabel(0.25)).toBe('6 hrs / sec');
        expect(speedLabel(0.5)).toBe('12 hrs / sec');
    });

    it('shows days for 1-29', () => {
        expect(speedLabel(1)).toBe('1 day / sec');
        expect(speedLabel(5)).toBe('5 days / sec');
    });

    it('shows months for 30+', () => {
        expect(speedLabel(30)).toBe('1 month / sec');
        expect(speedLabel(90)).toBe('3 months / sec');
    });
});

describe('ship state persistence', () => {
    it('restoreShipState round-trips fuelKg and engineId', () => {
        // Simulate a save payload (what saveState would produce)
        const saved = {
            version: 1,
            ship: { fuelKg: 75000, engineId: 'nuclear' },
        };

        state.bodyMeshes = [{
            isShip: true,
            fuelKg: 100000,
            engineId: 'chemical',
        }];

        restoreShipState(saved);

        expect(state.bodyMeshes[0].fuelKg).toBe(75000);
        expect(state.bodyMeshes[0].engineId).toBe('nuclear');
    });

    it('restoreShipState applies saved ship data', () => {
        state.bodyMeshes = [{
            isShip: true,
            fuelKg: 100000,
            engineId: 'chemical',
        }];

        const saved = { ship: { fuelKg: 75000, engineId: 'nuclear' } };
        restoreShipState(saved);

        expect(state.bodyMeshes[0].fuelKg).toBe(75000);
        expect(state.bodyMeshes[0].engineId).toBe('nuclear');
    });

    it('restoreShipState handles missing ship data gracefully', () => {
        state.bodyMeshes = [{
            isShip: true,
            fuelKg: 100000,
            engineId: 'chemical',
        }];

        restoreShipState(null);
        expect(state.bodyMeshes[0].fuelKg).toBe(100000);

        restoreShipState({});
        expect(state.bodyMeshes[0].fuelKg).toBe(100000);

        restoreShipState({ ship: null });
        expect(state.bodyMeshes[0].fuelKg).toBe(100000);
    });
});
