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
    camera: { position: { length: () => 120 }, aspect: 1, updateProjectionMatrix: vi.fn() },
    renderer: { setSize: vi.fn(), setPixelRatio: vi.fn(), domElement: { addEventListener: vi.fn() } },
    controls: { target: { x: 0, z: 0 } },
    labelContainer: { appendChild: vi.fn(), style: {} },
    trailGroups: { add: vi.fn() },
    cometGroup: { add: vi.fn() },
    gridGroup: { visible: true },
}));

vi.mock('../ui/selection.js', () => ({
    selectBody: vi.fn(),
}));

import { hashString } from '../ui/ui.js';

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
