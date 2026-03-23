/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import type { AsteroidInfo } from "../types";
import {
	formatAsteroidInfo,
	formatCometInfo,
	formatPlanetInfo,
	getZoomDistance,
} from "../ui/selection";

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

// Minimal CometEntryData shape for testing
function makeCometData(overrides: Partial<Parameters<typeof formatCometInfo>[0]> = {}) {
	return {
		name: "Halley",
		type: "Comet" as const,
		distance: 0.586,
		period: 75.3,
		radius: 5.5,
		color: "#aaaaaa",
		moons: [],
		a: 17.8,
		e: 0.967,
		inc: 162.3,
		incRad: 2.833,
		nodeRad: 1.006,
		periRad: 1.96,
		...overrides,
	};
}

// Minimal BodyData shape for testing
function makePlanetData(overrides: Partial<Parameters<typeof formatPlanetInfo>[0]> = {}) {
	return {
		name: "Earth",
		type: "Planet" as const,
		distance: 1.0,
		e: 0.017,
		period: 1.0,
		radius: 6371,
		color: "#4488ff",
		moons: [
			{ name: "Moon", distance: 0.00257, e: 0.055, period: 0.0748, radius: 1737, color: "#aaa" },
		],
		...overrides,
	};
}

describe("formatCometInfo", () => {
	it("formats perihelion distance and eccentricity", () => {
		const result = formatCometInfo(makeCometData());
		expect(result.distance).toContain("0.59 AU");
		expect(result.distance).toContain("e: 0.967");
		expect(result.distance).toContain("Perihelion:");
	});

	it("formats period in years when period > 0", () => {
		const result = formatCometInfo(makeCometData({ period: 75.3 }));
		expect(result.period).toBe("75.3 years");
	});

	it("shows dash for period <= 0", () => {
		expect(formatCometInfo(makeCometData({ period: 0 })).period).toBe("-");
		expect(formatCometInfo(makeCometData({ period: -1 })).period).toBe("-");
	});

	it("formats radius with km suffix", () => {
		const result = formatCometInfo(makeCometData({ radius: 5500 }));
		expect(result.radius).toContain("km");
		expect(result.radius).toContain("5");
	});

	it("counts 0 moons when array is empty", () => {
		const result = formatCometInfo(makeCometData({ moons: [] }));
		expect(result.moons).toBe("0");
	});

	it("counts multiple moons", () => {
		const moon = { name: "m", distance: 1, e: 0, period: 1, radius: 1, color: "#fff" };
		const result = formatCometInfo(makeCometData({ moons: [moon, moon] }));
		expect(result.moons).toBe("2");
	});
});

describe("formatPlanetInfo", () => {
	it("formats distance in AU for non-star", () => {
		const result = formatPlanetInfo(makePlanetData({ distance: 1.0 }), false);
		expect(result.distance).toBe("1 AU");
	});

	it("shows Center for distance 0 (star)", () => {
		const result = formatPlanetInfo(makePlanetData({ distance: 0 }), false);
		expect(result.distance).toBe("Center");
	});

	it("formats period in years when > 0", () => {
		const result = formatPlanetInfo(makePlanetData({ period: 1.0 }), false);
		expect(result.period).toBe("1 years");
	});

	it("shows dash when period is 0", () => {
		const result = formatPlanetInfo(makePlanetData({ period: 0 }), false);
		expect(result.period).toBe("-");
	});

	it("formats radius with km suffix", () => {
		const result = formatPlanetInfo(makePlanetData({ radius: 6371 }), false);
		expect(result.radius).toContain("km");
		expect(result.radius).toContain("6");
	});

	it("counts moons from array length", () => {
		const result = formatPlanetInfo(makePlanetData(), false);
		expect(result.moons).toBe("1");
	});

	it("moon flag does not break output", () => {
		const result = formatPlanetInfo(makePlanetData({ distance: 0.00257 }), true);
		expect(result.distance).toContain("AU");
	});
});

describe("formatAsteroidInfo", () => {
	const asteroid: AsteroidInfo = {
		designation: "1 Ceres",
		au: 2.77,
		period: 4.6,
		diameter: 939,
	};

	it("formats distance in AU", () => {
		const result = formatAsteroidInfo(asteroid, "Main Belt");
		expect(result.distance).toBe("2.77 AU");
	});

	it("formats period in years", () => {
		const result = formatAsteroidInfo(asteroid, "Main Belt");
		expect(result.period).toBe("4.6 years");
	});

	it("formats diameter with km dia. suffix", () => {
		const result = formatAsteroidInfo(asteroid, "Main Belt");
		expect(result.radius).toBe("~939 km dia.");
	});

	it("always returns 0 moons", () => {
		const result = formatAsteroidInfo(asteroid, "Main Belt");
		expect(result.moons).toBe("0");
	});

	it("designation does not appear in fields (caller handles title separately)", () => {
		const result = formatAsteroidInfo(asteroid, "Main Belt");
		expect(result.distance).not.toContain("Ceres");
	});
});

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
