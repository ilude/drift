/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	formatDateTime,
	loadSavedState,
	restoreShipState,
	saveState,
	simTimeToDate,
	speedLabel,
	state,
	truncateDate,
} from "../core/state";
import type { SavedStateData, ShipEntry } from "../types";

describe("simTimeToDate", () => {
	it("returns epoch date at simTime 0", () => {
		const d = simTimeToDate(0);
		expect(d.getFullYear()).toBe(2038);
		expect(d.getMonth()).toBe(0);
		expect(d.getDate()).toBe(20);
	});

	it("advances by one day per simTime unit", () => {
		const d = simTimeToDate(10);
		expect(d.getDate()).toBe(30);
	});

	it("rolls over months correctly", () => {
		const d = simTimeToDate(365);
		expect(d.getFullYear()).toBe(2039);
	});
});

describe("simTimeToDate fractional days", () => {
	it("returns noon for simTime 0.5", () => {
		const d = simTimeToDate(0.5);
		expect(d.getHours()).toBe(12);
		expect(d.getMinutes()).toBe(0);
	});

	it("returns 6 AM for simTime 0.25", () => {
		const d = simTimeToDate(0.25);
		expect(d.getHours()).toBe(6);
		expect(d.getMinutes()).toBe(0);
	});

	it("returns 6 PM for simTime 0.75", () => {
		const d = simTimeToDate(0.75);
		expect(d.getHours()).toBe(18);
		expect(d.getMinutes()).toBe(0);
	});

	it("handles fractional hours", () => {
		const d = simTimeToDate(1 / 24); // 1 hour into day
		expect(d.getDate()).toBe(20);
		expect(d.getHours()).toBe(1);
	});
});

describe("truncateDate", () => {
	it("preserves full precision at very slow speeds", () => {
		const d = new Date(2038, 0, 20, 14, 30, 45);
		truncateDate(d, 5 / 86400);
		expect(d.getHours()).toBe(14);
		expect(d.getMinutes()).toBe(30);
		expect(d.getSeconds()).toBe(45);
	});

	it("zeros seconds at minute-level speeds", () => {
		const d = new Date(2038, 0, 20, 14, 30, 45);
		truncateDate(d, 2 / 1440);
		expect(d.getHours()).toBe(14);
		expect(d.getMinutes()).toBe(30);
		expect(d.getSeconds()).toBe(0);
	});

	it("zeros minutes and seconds at hour-level speeds", () => {
		const d = new Date(2038, 0, 20, 14, 30, 45);
		truncateDate(d, 1 / 24);
		expect(d.getHours()).toBe(14);
		expect(d.getMinutes()).toBe(0);
		expect(d.getSeconds()).toBe(0);
	});

	it("zeros hours, minutes, seconds at day-level speeds", () => {
		const d = new Date(2038, 0, 20, 14, 30, 45);
		truncateDate(d, 8 / 24);
		expect(d.getHours()).toBe(0);
		expect(d.getMinutes()).toBe(0);
		expect(d.getSeconds()).toBe(0);
		expect(d.getDate()).toBe(20);
	});

	it("pins day to 1st at month-level speeds", () => {
		const d = new Date(2038, 5, 15, 14, 30, 45);
		truncateDate(d, 30);
		expect(d.getDate()).toBe(1);
		expect(d.getHours()).toBe(0);
	});
});

describe("formatDateTime", () => {
	it("formats date with zero-padded components", () => {
		const d = new Date(2038, 0, 5, 3, 7, 9);
		expect(formatDateTime(d)).toBe("2038-01-05 03:07:09");
	});

	it("formats midnight as 00:00:00", () => {
		const d = new Date(2038, 0, 20, 0, 0, 0);
		expect(formatDateTime(d)).toBe("2038-01-20 00:00:00");
	});

	it("formats end of day correctly", () => {
		const d = new Date(2038, 11, 31, 23, 59, 59);
		expect(formatDateTime(d)).toBe("2038-12-31 23:59:59");
	});
});

describe("speedLabel", () => {
	it("returns Paused for 0", () => {
		expect(speedLabel(0)).toBe("Paused");
	});

	it("shows hours for fractional days", () => {
		expect(speedLabel(0.25)).toBe("6 hrs / sec");
		expect(speedLabel(0.5)).toBe("12 hrs / sec");
	});

	it("shows days for 1-29", () => {
		expect(speedLabel(1)).toBe("1 day / sec");
		expect(speedLabel(5)).toBe("5 days / sec");
	});

	it("shows months for 30+", () => {
		expect(speedLabel(30)).toBe("1 month / sec");
		expect(speedLabel(90)).toBe("3 months / sec");
	});
});

describe("ship state persistence", () => {
	it("restoreShipState round-trips fuelKg and engineId", () => {
		const saved: SavedStateData = {
			version: 4,
			simTime: 0,
			currentSystemKey: "sol",
			randomClickCount: 0,
			discoveredSystems: [],
			ships: [
				{
					name: "ISS Explorer",
					hostPlanetName: "Earth",
					fuelKg: 75000,
					engineId: "nuclear",
					crew: undefined as unknown as ShipEntry["crew"],
					maintenance: undefined as unknown as ShipEntry["maintenance"],
					commandTree: undefined as unknown as ShipEntry["commandTree"],
				},
			],
		};

		state.bodyMeshes = [
			{
				isShip: true,
				data: { name: "ISS Explorer" },
				fuelKg: 100000,
				engineId: "chemical",
			},
		] as typeof state.bodyMeshes;

		restoreShipState(saved);

		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(75000);
		expect((state.bodyMeshes[0] as unknown as ShipEntry).engineId).toBe("nuclear");
	});

	it("restoreShipState applies saved ship data", () => {
		state.bodyMeshes = [
			{
				isShip: true,
				data: { name: "ISS Explorer" },
				fuelKg: 100000,
				engineId: "chemical",
			},
		] as typeof state.bodyMeshes;

		const saved: SavedStateData = {
			version: 4,
			simTime: 0,
			currentSystemKey: "sol",
			randomClickCount: 0,
			discoveredSystems: [],
			ships: [
				{
					name: "ISS Explorer",
					hostPlanetName: "Earth",
					fuelKg: 75000,
					engineId: "nuclear",
					crew: undefined as unknown as ShipEntry["crew"],
					maintenance: undefined as unknown as ShipEntry["maintenance"],
					commandTree: undefined as unknown as ShipEntry["commandTree"],
				},
			],
		};
		restoreShipState(saved);

		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(75000);
		expect((state.bodyMeshes[0] as unknown as ShipEntry).engineId).toBe("nuclear");
	});

	it("restoreShipState handles missing ship data gracefully", () => {
		state.bodyMeshes = [
			{
				isShip: true,
				data: { name: "ISS Explorer" },
				fuelKg: 100000,
				engineId: "chemical",
			},
		] as typeof state.bodyMeshes;

		restoreShipState(null);
		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(100000);

		restoreShipState({} as unknown as SavedStateData);
		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(100000);

		restoreShipState({ ships: [] } as unknown as SavedStateData);
		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(100000);
	});

	it("restoreShipState matches ships by name", () => {
		state.bodyMeshes = [
			{ isShip: true, data: { name: "ISS Explorer" }, fuelKg: 100000, engineId: "chemical" },
			{ isShip: true, data: { name: "ISS Magellan" }, fuelKg: 50000, engineId: "chemical" },
		] as typeof state.bodyMeshes;

		const saved: SavedStateData = {
			version: 4,
			simTime: 0,
			currentSystemKey: "sol",
			randomClickCount: 0,
			discoveredSystems: [],
			ships: [
				{
					name: "ISS Magellan",
					hostPlanetName: "Mars",
					fuelKg: 30000,
					engineId: "nuclear",
					crew: undefined as unknown as ShipEntry["crew"],
					maintenance: undefined as unknown as ShipEntry["maintenance"],
					commandTree: undefined as unknown as ShipEntry["commandTree"],
				},
			],
		};
		restoreShipState(saved);

		expect((state.bodyMeshes[0] as unknown as ShipEntry).fuelKg).toBe(100000);
		expect((state.bodyMeshes[1] as unknown as ShipEntry).fuelKg).toBe(30000);
		expect((state.bodyMeshes[1] as unknown as ShipEntry).engineId).toBe("nuclear");
	});
});

describe("transfer state persistence", () => {
	const store: Record<string, string> = {};
	beforeEach(() => {
		for (const key of Object.keys(store)) delete store[key];
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => store[k] ?? null,
			setItem: (k: string, v: string) => {
				store[k] = v;
			},
			removeItem: (k: string) => {
				delete store[k];
			},
		});
	});

	it("saveState and loadSavedState round-trip transfer fields", () => {
		const ship = {
			isShip: true,
			data: { name: "Pathfinder", category: "Ship", type: "Ship" },
			hostPlanetName: "Earth",
			fuelKg: 60000,
			engineId: "nuclear",
			shipState: "transferring" as ShipEntry["shipState"],
			transferTarget: "Mars",
			transferStartTime: 100,
			transferTimeDays: 200,
			transferFuelTotal: 5000,
			p0x: 1.1,
			p0y: 1.15,
			p0z: 2.2,
			t0x: 3.3,
			t0y: 3.35,
			t0z: 4.4,
			p1x: 5.5,
			p1y: 5.55,
			p1z: 6.6,
			t1x: 7.7,
			t1y: 7.75,
			t1z: 8.8,
			crew: { size: 6, morale: 0.9, deploymentDays: 30 },
			maintenance: { hullIntegrity: 1, supplies: 1, age: 0, lastMalfunction: null },
			commandTree: { entries: [] },
		} as unknown as (typeof state.bodyMeshes)[0];

		state.bodyMeshes = [ship];
		state.discoveredSystems = new Map();
		state.currentSystemKey = "sol";
		state.randomClickCount = 0;

		saveState();
		const loaded = loadSavedState();

		expect(loaded).not.toBeNull();
		const s = loaded?.ships[0];
		expect(s.shipState).toBe("transferring");
		expect(s.transferTarget).toBe("Mars");
		expect(s.transferStartTime).toBe(100);
		expect(s.transferTimeDays).toBe(200);
		expect(s.transferFuelTotal).toBe(5000);
		expect(s.p0x).toBe(1.1);
		expect(s.p0y).toBe(1.15);
		expect(s.p0z).toBe(2.2);
		expect(s.t0x).toBe(3.3);
		expect(s.t0y).toBe(3.35);
		expect(s.t0z).toBe(4.4);
		expect(s.p1x).toBe(5.5);
		expect(s.p1y).toBe(5.55);
		expect(s.p1z).toBe(6.6);
		expect(s.t1x).toBe(7.7);
		expect(s.t1y).toBe(7.75);
		expect(s.t1z).toBe(8.8);
	});

	it("restoreShipState restores transfer fields onto ship entry", () => {
		const shipEntry = {
			isShip: true,
			data: { name: "Pathfinder" },
			fuelKg: 0,
			engineId: "chemical",
			shipState: "orbiting" as ShipEntry["shipState"],
			transferTarget: null,
			transferStartTime: 0,
			transferTimeDays: 0,
			transferFuelTotal: 0,
			p0x: 0,
			p0y: 0,
			p0z: 0,
			t0x: 0,
			t0y: 0,
			t0z: 0,
			p1x: 0,
			p1y: 0,
			p1z: 0,
			t1x: 0,
			t1y: 0,
			t1z: 0,
		} as unknown as (typeof state.bodyMeshes)[0];

		state.bodyMeshes = [shipEntry];

		const saved: SavedStateData = {
			version: 5,
			simTime: 0,
			currentSystemKey: "sol",
			randomClickCount: 0,
			discoveredSystems: [],
			ships: [
				{
					name: "Pathfinder",
					hostPlanetName: "Earth",
					fuelKg: 60000,
					engineId: "nuclear",
					crew: undefined as unknown as ShipEntry["crew"],
					maintenance: undefined as unknown as ShipEntry["maintenance"],
					commandTree: undefined as unknown as ShipEntry["commandTree"],
					shipState: "transferring",
					transferTarget: "Mars",
					transferStartTime: 100,
					transferTimeDays: 200,
					transferFuelTotal: 5000,
					p0x: 1.1,
					p0y: 1.15,
					p0z: 2.2,
					t0x: 3.3,
					t0y: 3.35,
					t0z: 4.4,
					p1x: 5.5,
					p1y: 5.55,
					p1z: 6.6,
					t1x: 7.7,
					t1y: 7.75,
					t1z: 8.8,
				},
			],
		};
		restoreShipState(saved);

		const e = state.bodyMeshes[0] as unknown as ShipEntry;
		expect(e.shipState).toBe("transferring");
		expect(e.transferTarget).toBe("Mars");
		expect(e.transferStartTime).toBe(100);
		expect(e.transferTimeDays).toBe(200);
		expect(e.transferFuelTotal).toBe(5000);
		expect(e.p0x).toBe(1.1);
		expect(e.p0y).toBe(1.15);
		expect(e.p1z).toBe(6.6);
	});

	it("v4 save loads correctly — ships default to orbiting", () => {
		const v4Save = JSON.stringify({
			version: 4,
			simTime: 0,
			currentSystemKey: "sol",
			randomClickCount: 0,
			discoveredSystems: [],
			ships: [
				{
					name: "ISS Explorer",
					hostPlanetName: "Earth",
					fuelKg: 80000,
					engineId: "chemical",
					crew: { size: 6, morale: 1, deploymentDays: 0 },
					maintenance: { hullIntegrity: 1, supplies: 1, age: 0, lastMalfunction: null },
					commandTree: { entries: [] },
				},
			],
		});
		localStorage.setItem("solar-sim-state", v4Save);

		const loaded = loadSavedState();
		expect(loaded).not.toBeNull();
		expect(loaded?.ships[0].shipState).toBeUndefined();
		expect(loaded?.ships[0].transferTarget).toBeUndefined();
	});

	it("orbiting ship save does not include transfer fields", () => {
		const ship = {
			isShip: true,
			data: { name: "Wanderer", category: "Ship", type: "Ship" },
			hostPlanetName: "Earth",
			fuelKg: 50000,
			engineId: "chemical",
			shipState: "orbiting" as ShipEntry["shipState"],
			transferTarget: null,
			transferStartTime: 0,
			transferTimeDays: 0,
			transferFuelTotal: 0,
			p0x: 0,
			p0y: 0,
			p0z: 0,
			t0x: 0,
			t0y: 0,
			t0z: 0,
			p1x: 0,
			p1y: 0,
			p1z: 0,
			t1x: 0,
			t1y: 0,
			t1z: 0,
			crew: { size: 6, morale: 1, deploymentDays: 0 },
			maintenance: { hullIntegrity: 1, supplies: 1, age: 0, lastMalfunction: null },
			commandTree: { entries: [] },
		} as unknown as (typeof state.bodyMeshes)[0];

		state.bodyMeshes = [ship];
		state.discoveredSystems = new Map();
		state.currentSystemKey = "sol";
		state.randomClickCount = 0;

		saveState();
		const loaded = loadSavedState();

		expect(loaded).not.toBeNull();
		const s = loaded?.ships[0];
		expect(s.shipState).toBeUndefined();
		expect(s.transferTarget).toBeUndefined();
		expect(s.p0x).toBeUndefined();
	});
});
