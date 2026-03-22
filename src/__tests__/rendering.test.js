import { describe, it, expect, vi } from 'vitest';

// Mock scene.js to avoid DOM/Three.js side effects at import time
vi.mock('../rendering/scene.js', () => ({
    scene: { add: vi.fn() },
    labelContainer: { appendChild: vi.fn() },
    trailGroups: { add: vi.fn() },
    cometGroup: { add: vi.fn() },
}));

import { orbitToWorld } from '../rendering/rendering.js';

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
