/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { GameClock } from "../core/game-clock";
import { state } from "../core/state";
import type { ShipEntry } from "../types";
import { formatShipAction, formatShipDuration, getZoomDistance } from "../ui/selection";

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

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		isShip: true,
		data: { name: "TestShip", type: "Ship", distance: 1 },
		shipState: "orbiting",
		transferTarget: null,
		transferStartTime: 0,
		transferTimeDays: 0,
		transferDisplayStart: 0,
		transferDisplayDays: 0,
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		hostPlanetName: "Earth",
		fuelKg: 50000,
		fuelCapacityKg: 50000,
		engineId: "ion",
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		maintenance: { age: 0, supplies: 100, maxSupplies: 100, hullIntegrity: 100 },
		commandTree: { entries: [] },
		immediateCommand: null,
		...overrides,
	} as unknown as ShipEntry;
}

describe("formatShipAction", () => {
	it("shows transit with ETA when transferring", () => {
		state.simTime = new GameClock(110);
		const ship = mockShip({
			shipState: "transferring",
			transferTarget: "Mars",
			transferStartTime: 100,
			transferTimeDays: 15,
			transferDisplayStart: 100,
			transferDisplayDays: 15,
		});
		expect(formatShipAction(ship)).toBe("In transit to Mars");
	});

	it("shows destination when transfer is past due", () => {
		state.simTime = new GameClock(120);
		const ship = mockShip({
			shipState: "transferring",
			transferTarget: "Jupiter",
			transferStartTime: 100,
			transferTimeDays: 15,
			transferDisplayStart: 100,
			transferDisplayDays: 15,
		});
		expect(formatShipAction(ship)).toBe("In transit to Jupiter");
	});

	it("shows Surveying when orbiting with survey in progress", () => {
		state.simTime = new GameClock(50);
		const ship = mockShip({
			shipState: "orbiting",
			action: {
				type: "survey-nearest",
				commandId: null,
				startTime: 40,
				duration: 20,
				progress: 0.5,
				target: "Mars",
			},
		});
		expect(formatShipAction(ship)).toBe("Surveying Mars");
	});

	it("shows En route when orbiting with survey not yet started", () => {
		state.simTime = new GameClock(50);
		const ship = mockShip({
			shipState: "orbiting",
			action: {
				type: "survey-nearest",
				commandId: null,
				startTime: 0,
				duration: 0,
				progress: 0,
				target: "Venus",
			},
		});
		expect(formatShipAction(ship)).toBe("En route to Venus");
	});
});

describe("formatShipDuration", () => {
	it("shows remaining/total days during transfer", () => {
		state.simTime = new GameClock(107.9);
		const ship = mockShip({
			shipState: "transferring",
			transferStartTime: 100,
			transferTimeDays: 15,
			transferDisplayStart: 100,
			transferDisplayDays: 15,
		});
		// elapsed=7.9, remaining=15-7.9=7.1, total=15
		expect(formatShipDuration(ship)).toBe("7d / 15d");
	});

	it("uses decimal format for sub-day transfers", () => {
		state.simTime = new GameClock(100.3);
		const ship = mockShip({
			shipState: "transferring",
			transferStartTime: 100,
			transferTimeDays: 0.8,
			transferDisplayStart: 100,
			transferDisplayDays: 0.8,
		});
		// elapsed=0.3, remaining=0.5, total=0.8
		expect(formatShipDuration(ship)).toBe("0.5d / 0.8d");
	});

	it("shows action progress when orbiting with active action", () => {
		state.simTime = new GameClock(50);
		const ship = mockShip({
			shipState: "orbiting",
			action: {
				type: "survey-nearest",
				commandId: null,
				startTime: 40,
				duration: 20,
				progress: 0.5,
				target: "Mars",
			},
		});
		// elapsed=floor(0.5*20)=10, dur=floor(20)=20
		expect(formatShipDuration(ship)).toBe("10d / 20d");
	});

	it("returns empty string when orbiting with no active action", () => {
		state.simTime = new GameClock(50);
		const ship = mockShip({ shipState: "orbiting" });
		expect(formatShipDuration(ship)).toBe("");
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
