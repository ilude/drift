import { beforeEach, describe, expect, it } from "vitest";
import {
	advanceMissionTransferStep,
	getCargoCapacityKg,
	getCargoWeightKg,
	getMissionTransferTarget,
	hasMissionOrders,
	tickMissionOrders,
} from "../core/cargo";
import { state } from "../core/state";
import type { ColonyState, MissionStep, ShipDesign, ShipEntry } from "../types";

function mockShip(overrides: Partial<ShipEntry> = {}): ShipEntry {
	return {
		data: { name: "Cargo Ship" },
		isShip: true,
		fuelKg: 50000,
		fuelCapacityKg: 50000,
		crew: { count: 50, morale: 100, lastShoreLeave: 0, deploymentLimit: 180 },
		commander: { caution: 0.3, initiative: 0.3, experience: 0 },
		maintenance: {
			age: 0,
			totalAge: 0,
			lastRefitAge: 0,
			supplies: 100,
			maxSupplies: 100,
			hullIntegrity: 100,
			overhaulsSinceRefit: 0,
			overhaulsUntilRefit: 3,
		},
		action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
		commandTree: { entries: [] },
		immediateCommand: null,
		shipState: "orbiting",
		hostPlanetName: "Earth",
		designId: "test-design",
		cargoHold: {},
		missionOrders: [],
		missionOrderIndex: 0,
		mesh: { position: { x: 0, y: 0, z: 0 } },
		...overrides,
	} as unknown as ShipEntry;
}

function mockColony(bodyName: string, overrides: Partial<ColonyState> = {}): ColonyState {
	return {
		bodyName,
		name: bodyName,
		population: 1000,
		habitability: 1,
		installations: {
			constructionFactory: 0,
			repairYard: 0,
			fuelDepot: 0,
			mine: 0,
			lab: 0,
			academy: 0,
			storage: 0,
			shipyard: 0,
		},
		stockpile: {
			fuelKg: 100000,
			supplies: 1000,
			resources: {},
			flatPacked: {},
		},
		researchPoints: 0,
		constructionProjects: [],
		productionProjects: [],
		shipbuildProjects: [],
		transferQueue: [],
		...overrides,
	};
}

function step(type: MissionStep["type"], opts: Partial<MissionStep> = {}): MissionStep {
	return { id: `step-${Math.random()}`, type, ...opts };
}

describe("cargo weight", () => {
	it("computes zero weight for empty hold", () => {
		const ship = mockShip();
		expect(getCargoWeightKg(ship)).toBe(0);
	});

	it("computes correct weight for resources (1 kg/unit)", () => {
		const ship = mockShip({ cargoHold: { iron: 500, copper: 200 } });
		expect(getCargoWeightKg(ship)).toBe(700);
	});

	it("computes correct weight for flat-packed items (500 kg each)", () => {
		const ship = mockShip({ cargoHold: { "flat-mine": 2, "flat-factory": 3 } });
		expect(getCargoWeightKg(ship)).toBe(2500);
	});

	it("computes mixed weight correctly", () => {
		const ship = mockShip({ cargoHold: { iron: 1000, "flat-mine": 1 } });
		expect(getCargoWeightKg(ship)).toBe(1500);
	});
});

describe("cargo capacity", () => {
	beforeEach(() => {
		state.shipDesigns.clear();
	});

	it("returns 0 when no design", () => {
		const ship = mockShip({ designId: null });
		expect(getCargoCapacityKg(ship)).toBe(0);
	});

	it("returns design cargo capacity", () => {
		const design = { id: "test-design", cargoCapacityKg: 5000 } as ShipDesign;
		state.shipDesigns.set("test-design", design);
		const ship = mockShip({ designId: "test-design" });
		expect(getCargoCapacityKg(ship)).toBe(5000);
	});
});

describe("load-cargo step", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.shipDesigns.clear();
		state.shipDesigns.set("test-design", { id: "test-design", cargoCapacityKg: 10000 } as ShipDesign);
	});

	it("transfers resources from colony to ship", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 5000 }, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		// 1 sim-day at 1000 kg/day = 1000 units of resource (1 kg each)
		tickMissionOrders(ship, 1);

		expect(ship.cargoHold.iron).toBe(1000);
		expect(colony.stockpile.resources.iron).toBe(4000);
	});

	it("transfers flat-packed items from colony to ship", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: {}, flatPacked: { "flat-mine": 10 } },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "flat-mine" })],
			missionOrderIndex: 0,
		});

		// 1 sim-day at 1000 kg/day, flat-mine = 500 kg each -> 2 units
		tickMissionOrders(ship, 1);

		expect(ship.cargoHold["flat-mine"]).toBe(2);
		expect(colony.stockpile.flatPacked["flat-mine"]).toBe(8);
	});

	it("does not exceed cargo capacity", () => {
		state.shipDesigns.set("test-design", { id: "test-design", cargoCapacityKg: 500 } as ShipDesign);
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 5000 }, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		// Can only load 500 units (500 kg capacity, 1 kg/unit), rate allows 1000
		expect(ship.cargoHold.iron).toBe(500);
		// Step should advance (capacity full)
		expect(ship.missionOrderIndex).toBe(1);
	});

	it("advances step when colony runs out", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 100 }, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron" }), step("repeat")],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		expect(ship.cargoHold.iron).toBe(100);
		expect(ship.missionOrderIndex).toBe(1);
	});

	it("loads specific quantity then advances", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 5000 }, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron", quantity: 200 })],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		// Wanted 200, rate allows 1000, so gets exactly 200
		expect(ship.cargoHold.iron).toBe(200);
		expect(ship.missionOrderIndex).toBe(1);
	});

	it("does nothing when not orbiting", () => {
		state.colonies.set(
			"Earth",
			mockColony("Earth", {
				stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 5000 }, flatPacked: {} },
			}),
		);

		const ship = mockShip({
			shipState: "transferring",
			missionOrders: [step("load-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		} as Partial<ShipEntry>);

		tickMissionOrders(ship, 1);

		expect(ship.cargoHold.iron).toBeUndefined();
		expect(ship.missionOrderIndex).toBe(0);
	});
});

describe("unload-cargo step", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.shipDesigns.clear();
		state.shipDesigns.set("test-design", { id: "test-design", cargoCapacityKg: 10000 } as ShipDesign);
	});

	it("transfers resources from ship to colony", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 0 }, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			cargoHold: { iron: 3000 },
			missionOrders: [step("unload-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		// 1000 units transferred at rate
		expect(ship.cargoHold.iron).toBe(2000);
		expect(colony.stockpile.resources.iron).toBe(1000);
	});

	it("removes item from hold when fully unloaded", () => {
		const colony = mockColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: {}, flatPacked: {} },
		});
		state.colonies.set("Earth", colony);

		const ship = mockShip({
			cargoHold: { iron: 500 },
			missionOrders: [step("unload-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		expect(ship.cargoHold.iron).toBeUndefined();
		expect(colony.stockpile.resources.iron).toBe(500);
		expect(ship.missionOrderIndex).toBe(1);
	});

	it("advances step when ship has no cargo of type", () => {
		state.colonies.set("Earth", mockColony("Earth"));

		const ship = mockShip({
			cargoHold: {},
			missionOrders: [step("unload-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		tickMissionOrders(ship, 1);

		expect(ship.missionOrderIndex).toBe(1);
	});
});

describe("mission order flow", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.shipDesigns.clear();
		state.shipDesigns.set("test-design", { id: "test-design", cargoCapacityKg: 10000 } as ShipDesign);
	});

	it("advances through steps sequentially", () => {
		state.colonies.set(
			"Earth",
			mockColony("Earth", {
				stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 100 }, flatPacked: {} },
			}),
		);

		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron" }), step("transfer-to", { target: "Mars" })],
			missionOrderIndex: 0,
		});

		// Load step should complete (only 100 available, all transferred in one tick)
		tickMissionOrders(ship, 1);
		expect(ship.missionOrderIndex).toBe(1);

		// Transfer step: ship is at Earth, target is Mars -> returns Mars
		const target = getMissionTransferTarget(ship);
		expect(target).toBe("Mars");
	});

	it("repeat step resets to index 0", () => {
		state.colonies.set("Earth", mockColony("Earth"));

		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Earth" }), step("repeat")],
			missionOrderIndex: 1,
		});

		tickMissionOrders(ship, 1);

		expect(ship.missionOrderIndex).toBe(0);
	});

	it("stops at end when no repeat", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Earth" })],
			missionOrderIndex: 0,
			hostPlanetName: "Earth",
		});

		// Already at target, should advance past end
		tickMissionOrders(ship, 1);

		expect(ship.missionOrderIndex).toBe(1);
		expect(hasMissionOrders(ship)).toBe(false);
	});

	it("transfer-to advances when already at target", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Earth" }), step("repeat")],
			missionOrderIndex: 0,
			hostPlanetName: "Earth",
		});

		tickMissionOrders(ship, 1);

		// Should advance past transfer-to since already at Earth
		expect(ship.missionOrderIndex).toBe(1);
	});

	it("getMissionTransferTarget returns null when at target", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Earth" })],
			missionOrderIndex: 0,
			hostPlanetName: "Earth",
		});

		expect(getMissionTransferTarget(ship)).toBeNull();
	});

	it("getMissionTransferTarget returns target name when not there", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Mars" })],
			missionOrderIndex: 0,
			hostPlanetName: "Earth",
		});

		expect(getMissionTransferTarget(ship)).toBe("Mars");
	});

	it("advanceMissionTransferStep advances transfer-to step", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Mars" }), step("repeat")],
			missionOrderIndex: 0,
		});

		advanceMissionTransferStep(ship);

		expect(ship.missionOrderIndex).toBe(1);
	});

	it("advanceMissionTransferStep does nothing on non-transfer step", () => {
		const ship = mockShip({
			missionOrders: [step("load-cargo", { itemId: "iron" })],
			missionOrderIndex: 0,
		});

		advanceMissionTransferStep(ship);

		expect(ship.missionOrderIndex).toBe(0);
	});

	it("hasMissionOrders returns false when empty", () => {
		const ship = mockShip();
		expect(hasMissionOrders(ship)).toBe(false);
	});

	it("hasMissionOrders returns false when past end", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Mars" })],
			missionOrderIndex: 1,
		});
		expect(hasMissionOrders(ship)).toBe(false);
	});

	it("hasMissionOrders returns true when active", () => {
		const ship = mockShip({
			missionOrders: [step("transfer-to", { target: "Mars" })],
			missionOrderIndex: 0,
		});
		expect(hasMissionOrders(ship)).toBe(true);
	});
});

describe("full cargo cycle", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.shipDesigns.clear();
		state.shipDesigns.set("test-design", { id: "test-design", cargoCapacityKg: 10000 } as ShipDesign);
	});

	it("load at Earth, transfer, unload at Mars, repeat", () => {
		state.colonies.set(
			"Earth",
			mockColony("Earth", {
				stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 500 }, flatPacked: {} },
			}),
		);
		state.colonies.set(
			"Mars",
			mockColony("Mars", {
				stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 0 }, flatPacked: {} },
			}),
		);

		const ship = mockShip({
			hostPlanetName: "Earth",
			missionOrders: [
				step("load-cargo", { itemId: "iron" }),
				step("transfer-to", { target: "Mars" }),
				step("unload-cargo", { itemId: "iron" }),
				step("transfer-to", { target: "Earth" }),
				step("repeat"),
			],
			missionOrderIndex: 0,
		});

		// Step 0: Load iron at Earth (500 units, all available)
		tickMissionOrders(ship, 1);
		expect(ship.cargoHold.iron).toBe(500);
		expect(ship.missionOrderIndex).toBe(1);

		// Step 1: Transfer to Mars -- getMissionTransferTarget returns "Mars"
		expect(getMissionTransferTarget(ship)).toBe("Mars");

		// Simulate arrival at Mars
		ship.hostPlanetName = "Mars";
		advanceMissionTransferStep(ship);
		expect(ship.missionOrderIndex).toBe(2);

		// Step 2: Unload iron at Mars
		tickMissionOrders(ship, 1);
		expect(ship.cargoHold.iron).toBeUndefined();
		expect(state.colonies.get("Mars")?.stockpile.resources.iron).toBe(500);
		expect(ship.missionOrderIndex).toBe(3);

		// Step 3: Transfer to Earth
		expect(getMissionTransferTarget(ship)).toBe("Earth");
		ship.hostPlanetName = "Earth";
		advanceMissionTransferStep(ship);
		expect(ship.missionOrderIndex).toBe(4);

		// Step 4: Repeat
		tickMissionOrders(ship, 1);
		expect(ship.missionOrderIndex).toBe(0);
	});
});
