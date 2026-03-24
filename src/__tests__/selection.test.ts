/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";

import { GameClock } from "../core/game-clock";
import { state } from "../core/state";
import type { ShipEntry } from "../types";
import {
	formatShipAction,
	formatShipDuration,
	formatTransferStatus,
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
		// elapsed=10, remaining=ceil(15-10)=5
		expect(formatShipAction(ship)).toBe("In transit to Mars (5d)");
	});

	it("shows 0d remaining when transfer is past due", () => {
		state.simTime = new GameClock(120);
		const ship = mockShip({
			shipState: "transferring",
			transferTarget: "Jupiter",
			transferStartTime: 100,
			transferTimeDays: 15,
			transferDisplayStart: 100,
			transferDisplayDays: 15,
		});
		expect(formatShipAction(ship)).toBe("In transit to Jupiter (0d)");
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
	it("shows elapsed/total days during transfer", () => {
		state.simTime = new GameClock(107.9);
		const ship = mockShip({
			shipState: "transferring",
			transferStartTime: 100,
			transferTimeDays: 15,
			transferDisplayStart: 100,
			transferDisplayDays: 15,
		});
		// elapsed=floor(7.9)=7, total=floor(15)=15
		expect(formatShipDuration(ship)).toBe("7d / 15d");
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

describe("formatTransferStatus", () => {
	const AU_KM = 149_597_871;

	it("shows days for ETA >= 1 day", () => {
		const result = formatTransferStatus(3.7, AU_KM * 0.72, 42100, 50000);
		expect(result).toBe("ETA: 4d | 0.72 AU | Fuel: 42.1t / 50.0t (84%)");
	});

	it("shows hours for ETA < 1 day", () => {
		const result = formatTransferStatus(0.5, AU_KM * 0.1, 10000, 20000);
		expect(result).toBe("ETA: 12h | 0.10 AU | Fuel: 10.0t / 20.0t (50%)");
	});

	it("shows km for very short distances (< 0.01 AU)", () => {
		const result = formatTransferStatus(2, 500000, 30000, 50000);
		expect(result).toContain("500,000 km");
	});

	it("shows 0% fuel when fuelTotalKg is 0", () => {
		const result = formatTransferStatus(1, AU_KM, 0, 0);
		expect(result).toContain("(0%)");
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
