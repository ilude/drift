/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Set up required DOM elements before ui.js loads
beforeAll(() => {
    const ids = [
        'body-list', 'fps-display', 'time-display', 'zoom-display',
        'toggle-labels', 'toggle-orbits', 'toggle-grid', 'toggle-trails',
        'system-switcher-btn', 'system-switcher-dropdown', 'system-list',
        'btn-discover', 'btn-random', 'seed-input',
        'btn-pause', 'btn-slow', 'btn-normal', 'btn-fast',
        'info-panel', 'info-close', 'info-position',
        'info-ship-engine', 'ship-engine-value',
        'info-ship-fuel', 'ship-fuel-value',
        'info-ship-deltav', 'ship-deltav-value',
    ];
    ids.forEach(id => {
        if (!document.getElementById(id)) {
            const el = document.createElement('div');
            el.id = id;
            if (id.startsWith('toggle-')) {
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = id;
                input.checked = true;
                document.body.appendChild(input);
            } else {
                document.body.appendChild(el);
            }
        }
    });
});

// Mock scene.js and selection.js to avoid Three.js side effects
vi.mock('../rendering/scene.js', () => ({
    scene: { add: vi.fn() },
    camera: {
        position: {
            length: () => 120,
            clone: () => ({ x: 0, y: 120, z: 80, subVectors: () => ({ normalize: () => ({ x: 0, y: 1, z: 0 }) }) }),
        },
        aspect: 1,
        updateProjectionMatrix: vi.fn(),
    },
    renderer: { setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: { addEventListener: vi.fn() } },
    controls: {
        target: {
            x: 0, z: 0,
            clone: () => ({ x: 0, y: 0, z: 0 }),
        },
    },
    labelContainer: { appendChild: vi.fn(), style: {} },
    trailGroups: { add: vi.fn() },
    cometGroup: { add: vi.fn() },
    gridGroup: { visible: true },
    ZOOM_BASE: 120,
}));

vi.mock('../rendering/rendering.js', () => ({
    COMET_ORBIT_OPACITY: 0.03,
    COMET_ORBIT_SELECTED_OPACITY: 0.05,
    initiateTransfer: vi.fn(),
}));

import { hashString } from '../ui/ui.js';
import { selectBody } from '../ui/selection.js';
import { state } from '../core/state.js';

describe('ship info panel', () => {
    it('shows engine, fuel, and delta-v elements for ships', () => {
        // Set up minimal DOM elements selectBody needs
        ['info-panel', 'info-title', 'info-type', 'info-distance', 'info-period',
         'info-radius', 'info-moons', 'info-transfer',
         'info-ship-engine', 'ship-engine-value', 'info-ship-fuel', 'ship-fuel-value',
         'info-ship-deltav', 'ship-deltav-value', 'transfer-target',
        ].forEach(id => {
            if (!document.getElementById(id)) {
                const el = document.createElement(id === 'transfer-target' ? 'select' : 'div');
                el.id = id;
                if (id === 'info-panel' || id === 'info-transfer' ||
                    id === 'info-ship-engine' || id === 'info-ship-fuel' || id === 'info-ship-deltav') {
                    el.classList.add('hidden');
                }
                document.body.appendChild(el);
            }
        });

        state.BODIES = [
            { name: 'Sun', type: 'Star', distance: 0, period: 0, radius: 696340, color: '#ffdd44', moons: [] },
            { name: 'Earth', type: 'Planet', distance: 1.0, period: 1.0, radius: 6371, color: '#4488ff', moons: [] },
        ];
        state.bodyMeshes = [];

        const shipEntry = {
            data: { name: 'Ship', type: 'Ship', distance: 1.0, period: 0, radius: 1, color: '#bbbbbb', moons: [] },
            mesh: { position: { x: 0, y: 0, z: 0 } },
            selRing: { material: { opacity: 0 } },
            isShip: true, isMoon: false, isComet: false,
            shipState: 'orbiting', hostPlanetName: 'Earth',
            screenSize: 0.02, orbitA: 1.0,
            engineId: 'conventional', dryMassKg: 5000, fuelKg: 50000, fuelCapacityKg: 50000,
        };
        state.bodyMeshes.push(shipEntry);
        state.bodyMeshes.push({
            data: state.BODIES[1], mesh: { position: { x: 100, y: 0, z: 0 } },
            isShip: false, isMoon: false, isComet: false,
        });

        selectBody(shipEntry);

        expect(document.getElementById('info-ship-engine').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('info-ship-fuel').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('info-ship-deltav').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('ship-engine-value').textContent).toBe('Conventional TN');
        expect(document.getElementById('ship-fuel-value').textContent).toContain('50.00t');
        expect(document.getElementById('ship-deltav-value').textContent).toContain('km/s');
    });
});

describe('hashString', () => {
    it('is deterministic', () => {
        expect(hashString('test')).toBe(hashString('test'));
    });

    it('different strings produce different hashes', () => {
        expect(hashString('hello')).not.toBe(hashString('world'));
        expect(hashString('abc')).not.toBe(hashString('xyz'));
        expect(hashString('foo')).not.toBe(hashString('bar'));
    });

    it('returns a positive integer', () => {
        const h = hashString('anything');
        expect(h).toBeGreaterThan(0);
        expect(Number.isInteger(h)).toBe(true);
    });

    it('handles empty string', () => {
        const h = hashString('');
        expect(h).toBeGreaterThan(0);
        expect(Number.isInteger(h)).toBe(true);
    });

    it('returns consistent results for same input', () => {
        const results = Array.from({ length: 10 }, () => hashString('consistent'));
        expect(new Set(results).size).toBe(1);
    });
});
