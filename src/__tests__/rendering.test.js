/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';

// Mock scene.js to avoid DOM/Three.js side effects at import time
vi.mock('../rendering/scene.js', () => ({
    scene: { add: vi.fn() },
    labelContainer: { appendChild: vi.fn() },
    trailGroups: { add: vi.fn() },
    cometGroup: { add: vi.fn() },
}));

import { orbitToWorld, createShip, initiateTransfer } from '../rendering/rendering.js';
import { state } from '../core/state.js';

describe('orbitToWorld', () => {
    const PI = Math.PI;

    it('passes through with zero angles (identity)', () => {
        const w = orbitToWorld(10, 5, 0, 0, 0);
        expect(w.x).toBeCloseTo(10);
        expect(w.y).toBeCloseTo(0);
        expect(w.z).toBeCloseTo(5);
    });

    it('90° inclination maps z to y', () => {
        const w = orbitToWorld(0, 5, PI / 2, 0, 0);
        expect(w.x).toBeCloseTo(0);
        expect(w.y).toBeCloseTo(5);
        expect(w.z).toBeCloseTo(0, 5);
    });

    it('180° node rotation negates x and z', () => {
        const w = orbitToWorld(10, 5, 0, PI, 0);
        expect(w.x).toBeCloseTo(-10);
        expect(w.y).toBeCloseTo(0);
        expect(w.z).toBeCloseTo(-5);
    });

    it('90° perihelion argument rotates in orbital plane', () => {
        const w = orbitToWorld(10, 0, 0, 0, PI / 2);
        expect(w.x).toBeCloseTo(0, 5);
        expect(w.y).toBeCloseTo(0);
        expect(w.z).toBeCloseTo(10);
    });

    it('returns the same object reference (reused scratch)', () => {
        const w1 = orbitToWorld(1, 2, 0, 0, 0);
        const ref = w1;
        const w2 = orbitToWorld(3, 4, 0, 0, 0);
        expect(w2).toBe(ref);
    });

    it('combined angles produce expected transformation', () => {
        const inc = PI / 4;
        const w = orbitToWorld(0, 10, inc, 0, 0);
        const expectedY = 10 * Math.sin(inc);
        const expectedZ = 10 * Math.cos(inc);
        expect(w.x).toBeCloseTo(0);
        expect(w.y).toBeCloseTo(expectedY);
        expect(w.z).toBeCloseTo(expectedZ);
    });
});

describe('createShip', () => {
    it('returns ship entry with physics properties', () => {
        state.BODIES = [
            { name: 'Sun', type: 'Star', distance: 0, period: 0, radius: 696340, color: '#ffdd44', moons: [] },
            { name: 'Earth', type: 'Planet', distance: 1.0, period: 1.0, radius: 6371, color: '#4488ff', moons: [] },
        ];
        state.bodyMeshes = [];

        const entry = createShip();
        expect(entry).toBeDefined();
        expect(entry.isShip).toBe(true);
        expect(entry).toHaveProperty('dryMassKg');
        expect(entry).toHaveProperty('fuelKg');
        expect(entry).toHaveProperty('fuelCapacityKg');
        expect(entry).toHaveProperty('engineId');
        expect(entry.dryMassKg).toBeGreaterThan(0);
        expect(entry.fuelKg).toBeGreaterThan(0);
        expect(entry.fuelCapacityKg).toBeGreaterThan(0);
        expect(typeof entry.engineId).toBe('string');
    });
});

describe('initiateTransfer', () => {
    function setupSystem() {
        state.BODIES = [
            { name: 'Sun', type: 'Star', distance: 0, period: 0, radius: 696340, color: '#ffdd44', moons: [] },
            { name: 'Earth', type: 'Planet', distance: 1.0, period: 1.0, radius: 6371, color: '#4488ff', moons: [] },
            { name: 'Mars', type: 'Planet', distance: 1.524, period: 1.881, radius: 3390, color: '#ff6644', moons: [] },
        ];
        state.bodyMeshes = [];
        state.simTime = 0;

        // Create planet entries so findPlanetEntry works
        state.BODIES.forEach(b => {
            if (b.type !== 'Star') {
                const mesh = { position: { x: 100 * b.distance, y: 0, z: 0, set: vi.fn() } };
                state.bodyMeshes.push({
                    data: b, mesh, isShip: false, isMoon: false, isComet: false,
                    speed: 0.01, angle: 0,
                });
            }
        });

        const ship = createShip();
        return ship;
    }

    it('deducts fuel on successful transfer', () => {
        const ship = setupSystem();
        const fuelBefore = ship.fuelKg;
        const mars = state.bodyMeshes.find(e => e.data.name === 'Mars');
        initiateTransfer(ship, mars);
        expect(ship.fuelKg).toBeLessThan(fuelBefore);
    });

    it('rejects transfer when fuel is insufficient', () => {
        const ship = setupSystem();
        ship.fuelKg = 1; // near-zero fuel
        const mars = state.bodyMeshes.find(e => e.data.name === 'Mars');
        initiateTransfer(ship, mars);
        expect(ship.shipState).toBe('orbiting');
    });

    it('uses game transfer time for visual path', () => {
        const ship = setupSystem();
        const mars = state.bodyMeshes.find(e => e.data.name === 'Mars');
        initiateTransfer(ship, mars);
        // Game formula: 3 + 3 * |1.524 - 1.0| ≈ 4.6 days (short visual transfers)
        expect(ship.pendingTransfer.gameDays).toBeLessThan(10);
    });
});
