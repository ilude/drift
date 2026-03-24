/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { getZoomDistance } from "../ui/selection";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	camera: {
		position: {
			length: () => 120,
			clone: () => ({
				x: 0,
				y: 120,
				z: 80,
				subVectors: () => ({ normalize: () => ({ x: 0, y: 1, z: 0 }) }),
			}),
		},
		aspect: 1,
		updateProjectionMatrix: vi.fn(),
	},
	renderer: {
		setSize: vi.fn(),
		setPixelRatio: vi.fn(),
		domElement: { addEventListener: vi.fn() },
	},
	controls: { target: { x: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) } },
	labelContainer: { appendChild: vi.fn(), style: {} },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
	gridGroup: { visible: true },
	ZOOM_BASE: 120,
}));

vi.mock("../rendering/rendering", () => ({
	COMET_ORBIT_OPACITY: 0.03,
	COMET_ORBIT_SELECTED_OPACITY: 0.05,
	initiateTransfer: vi.fn(),
}));

describe("getZoomDistance", () => {
	it("returns large distance for Star", () => {
		const star = getZoomDistance("Star", false);
		const planet = getZoomDistance("Planet", false);
		expect(star).toBeGreaterThan(planet);
	});

	it("returns small distance for Moon type", () => {
		const moon = getZoomDistance("Moon", false);
		const planet = getZoomDistance("Planet", false);
		expect(moon).toBeLessThan(planet);
	});

	it("returns small distance when isMoon flag is true regardless of type", () => {
		const moonFlagged = getZoomDistance("Planet", true);
		const planet = getZoomDistance("Planet", false);
		expect(moonFlagged).toBeLessThan(planet);
	});

	it("returns planet-sized distance for unknown type", () => {
		const unknown = getZoomDistance("Asteroid", false);
		const planet = getZoomDistance("Planet", false);
		expect(unknown).toBe(planet);
	});

	it("returns positive number for all known types", () => {
		for (const type of ["Star", "Planet", "Dwarf Planet", "Moon", "Comet", "Ship"]) {
			expect(getZoomDistance(type, false)).toBeGreaterThan(0);
		}
	});
});
