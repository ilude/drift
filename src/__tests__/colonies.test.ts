import { beforeEach, describe, expect, it } from "vitest";
import {
	addColonyStock,
	addConstructionProject,
	addProductionProject,
	addShipbuildProject,
	canAffordConstruction,
	canAffordProduction,
	cancelShipbuildProject,
	computeColonyQualities,
	computeColonyWorkforce,
	computeResearchProgress,
	computeShipResourceCost,
	consumeColonyFuel,
	consumeColonySupplies,
	drainCompletedShipbuilds,
	getColony,
	getColonyResourceStock,
	getNearestColonyForShip,
	getScientistsAtColony,
	getShipbuildBpPerDay,
	pauseShipbuildProject,
	queueResearchProjectForScientist,
	resetColonyWarningState,
	seedStartingColonies,
	setScientistLabs,
	tickColony,
} from "../core/colonies";
import { rebuildEntityMaps } from "../core/entities";
import { state } from "../core/state";
import type { ColonyState, PlanetEntry, ShipEntry } from "../types";

function mockPlanet(name: string, overrides: Partial<PlanetEntry> = {}): PlanetEntry {
	return {
		data: {
			name,
			type: "Planet",
			distance: 1,
			e: 0,
			period: 365,
			radius: 6371,
			mass: 5.972e24,
			color: "#fff",
			moons: [],
			_category: "rocky",
		},
		mesh: { position: { x: 0, y: 0, z: 0 } },
		selRing: {},
		orbitLine: null,
		orbitRadius: 0,
		labelDiv: {},
		trail: {} as PlanetEntry["trail"],
		angle: 0,
		speed: 0,
		parentMesh: null,
		moons: [],
		isMoon: false,
		screenSize: 0,
		geomLevels: null,
		lodLevel: 0,
		planetRing: null,
		cloudMesh: null,
		baseSize: 1,
		realisticSize: 1,
		survey: { surveyLevel: 0, deposits: [] },
		...overrides,
	} as unknown as PlanetEntry;
}

function mockShip(hostPlanetName: string): ShipEntry {
	return {
		data: {
			name: "ISS Test",
			type: "Ship",
			distance: 1,
			period: 1,
			radius: 1,
			color: "#fff",
			moons: [],
		},
		mesh: { position: { x: 0, y: 0, z: 0 } },
		hostPlanetName,
		shipState: "orbiting",
	} as unknown as ShipEntry;
}

function makeColony(bodyName: string, overrides: Partial<ColonyState> = {}): ColonyState {
	return {
		bodyName,
		name: `${bodyName} Colony`,
		population: 1_000_000,
		habitability: 1,
		installations: {
			constructionFactory: 1,
			repairYard: 1,
			fuelDepot: 1,
			mine: 1,
			lab: 3,
			academy: 0,
			storage: 1,
			shipyard: 0,
		},
		stockpile: { fuelKg: 1000, supplies: 100, resources: {}, flatPacked: {} },
		researchPoints: 0,
		constructionProjects: [],
		productionProjects: [],
		shipbuildProjects: [],
		transferQueue: [],
		...overrides,
	};
}

describe("colonies", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.scientists.clear();
		state.researchProjects.clear();
		state.researchedTechs.clear();
		state.notifications = [];
		resetColonyWarningState();
		state.bodyMeshes = [];
		rebuildEntityMaps();
	});

	it("seedStartingColonies creates Earth colony and initial scientists", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		rebuildEntityMaps();
		seedStartingColonies();

		const [colony, found] = getColony("Earth");
		expect(found).toBe(true);
		if (!colony) throw new Error("expected colony");
		expect(colony.population).toBeGreaterThan(1_000_000_000);
		expect(getScientistsAtColony("Earth").length).toBeGreaterThan(0);
	});

	it("computeColonyWorkforce reports staffing ratio", () => {
		const workforce = computeColonyWorkforce(
			makeColony("Earth", {
				population: 100_000,
				installations: {
					constructionFactory: 0,
					repairYard: 2,
					fuelDepot: 2,
					mine: 2,
					lab: 2,
					academy: 2,
					storage: 2,
					shipyard: 0,
				},
			}),
		);

		expect(workforce.usedWorkers).toBeGreaterThan(workforce.availableWorkers);
		expect(workforce.staffingRatio).toBeLessThan(1);
	});

	it("computeColonyQualities scales down when understaffed", () => {
		const full = computeColonyQualities(makeColony("Earth"));
		const understaffed = computeColonyQualities(
			makeColony("Earth", {
				population: 100_000,
				installations: {
					constructionFactory: 0,
					repairYard: 3,
					fuelDepot: 3,
					mine: 3,
					lab: 3,
					academy: 3,
					storage: 3,
					shipyard: 0,
				},
			}),
		);

		expect(understaffed.repair).toBeLessThan(full.repair);
		expect(understaffed.refuel).toBeLessThan(full.refuel);
	});

	it("stockpile helpers add and consume resources", () => {
		state.colonies.set("Earth", makeColony("Earth"));

		addColonyStock("Earth", "iron", 25);
		expect(getColonyResourceStock("Earth", "iron")).toBe(25);

		expect(consumeColonyFuel("Earth", 400)).toBe(400);
		const [earthColony] = getColony("Earth");
		expect(earthColony?.stockpile.fuelKg).toBe(600);

		expect(consumeColonySupplies("Earth", 30)).toBe(30);
		const [earthColony2] = getColony("Earth");
		expect(earthColony2?.stockpile.supplies).toBe(70);
	});

	it("tickColony mines surveyed deposits into stockpile", () => {
		const earth = mockPlanet("Earth", {
			survey: {
				surveyLevel: 1,
				deposits: [
					{ resourceId: "iron", quantity: 100, accessibility: 1, mined: 0, minSurveyLevel: 1 },
				],
			},
		});
		state.bodyMeshes = [earth];
		rebuildEntityMaps();
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);

		expect(getColonyResourceStock("Earth", "iron")).toBeGreaterThan(0);
		expect(earth.survey?.deposits[0].mined).toBeGreaterThan(0);
	});

	it("scientist queue drives active research and completion", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		rebuildEntityMaps();
		state.colonies.set("Earth", makeColony("Earth"));
		seedStartingColonies();
		const scientist = getScientistsAtColony("Earth")[0];
		expect(scientist).toBeDefined();
		// adminCap is 1–5 (RNG), so request 1 which is always valid
		const setLabs = setScientistLabs(scientist.id, 1);
		expect(setLabs).toBe(true);
		const queued = queueResearchProjectForScientist(scientist.id, "survey-automation");
		expect(queued).toBe(true);

		const [colony] = getColony("Earth");
		tickColony(colony as ColonyState, 30);

		expect(state.researchedTechs.has("survey-automation")).toBe(true);
		expect(state.gameLog.some((entry) => entry.category === "Research")).toBe(true);
	});

	it("getNearestColonyForShip returns closest colony by orbital distance", () => {
		state.bodyMeshes = [
			mockPlanet("Earth", { data: { ...mockPlanet("Earth").data, distance: 1 } }),
			mockPlanet("Mars", { data: { ...mockPlanet("Mars").data, distance: 1.5 } }),
			mockPlanet("Jupiter", { data: { ...mockPlanet("Jupiter").data, distance: 5 } }),
		];
		rebuildEntityMaps();
		state.colonies.set("Earth", makeColony("Earth"));
		state.colonies.set("Jupiter", makeColony("Jupiter"));

		const [nearest, nearestFound] = getNearestColonyForShip(mockShip("Mars"));
		expect(nearestFound).toBe(true);
		if (!nearest) throw new Error("expected colony");
		expect(nearest.data.name).toBe("Earth");
	});

	it("tickColony advances construction projects into completed installations", () => {
		const earth = mockPlanet("Earth");
		state.bodyMeshes = [earth];
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 4,
				repairYard: 1,
				fuelDepot: 1,
				mine: 0,
				lab: 1,
				academy: 0,
				storage: 1,
				shipyard: 0,
			},
			stockpile: { fuelKg: 1000, supplies: 100, resources: { iron: 5000, copper: 2000 } },
		});
		state.colonies.set("Earth", colony);
		addConstructionProject("Earth", "mine", 1, 100);

		tickColony(colony, 20);

		expect(colony.installations.mine).toBeGreaterThan(0);
		expect(colony.constructionProjects).toHaveLength(0);
	});

	it("construction deducts resources from colony stockpile on completion", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 4,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 0,
			},
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 500, copper: 100 } },
		});
		state.colonies.set("Earth", colony);
		addConstructionProject("Earth", "mine", 1, 100);

		tickColony(colony, 20);

		expect(colony.installations.mine).toBe(1);
		expect(colony.stockpile.resources.iron).toBe(300);
		expect(colony.stockpile.resources.copper).toBe(50);
	});

	it("construction stalls when colony lacks resources", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 4,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 0,
			},
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 10 } },
		});
		state.colonies.set("Earth", colony);
		addConstructionProject("Earth", "mine", 1, 100);

		tickColony(colony, 20);

		expect(colony.installations.mine).toBe(0);
		expect(colony.constructionProjects).toHaveLength(1);
		const project = colony.constructionProjects[0];
		expect(project.progressBp).toBeGreaterThanOrEqual(80);
	});

	it("canAffordConstruction returns false when resources insufficient", () => {
		const colony = makeColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 100 } },
		});
		expect(canAffordConstruction(colony, "mine")).toBe(false);
		expect(canAffordConstruction(colony, "storage")).toBe(false);
	});

	it("canAffordConstruction returns true when resources sufficient", () => {
		const colony = makeColony("Earth", {
			stockpile: { fuelKg: 0, supplies: 0, resources: { iron: 5000, copper: 2000, aluminum: 1000 } },
		});
		expect(canAffordConstruction(colony, "mine")).toBe(true);
		expect(canAffordConstruction(colony, "construction-factory")).toBe(true);
	});

	it("warns when colony is severely understaffed", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth", {
			population: 100,
			installations: {
				constructionFactory: 10,
				repairYard: 10,
				fuelDepot: 10,
				mine: 10,
				lab: 10,
				academy: 10,
				storage: 10,
				shipyard: 10,
			},
		});
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);

		const warning = state.notifications.find((n) => n.type === "colony-understaffed");
		expect(warning).toBeDefined();
		expect(warning?.message).toContain("understaffing");
	});

	it("does not warn when colony is well-staffed", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);

		const warning = state.notifications.find((n) => n.type === "colony-understaffed");
		expect(warning).toBeUndefined();
	});

	it("warns when construction factories are idle", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);

		const warning = state.notifications.find(
			(n) => n.type === "colony-idle" && n.message.includes("construction"),
		);
		expect(warning).toBeDefined();
	});

	it("does not repeat warning within 30 game-days", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);
		const count1 = state.notifications.filter((n) => n.type === "colony-idle").length;

		tickColony(colony, 1);
		const count2 = state.notifications.filter((n) => n.type === "colony-idle").length;

		expect(count2).toBe(count1);
	});

	it("repeats warning after warning state is reset and 30 days elapse", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);

		tickColony(colony, 1);
		const idleWarnings1 = state.notifications.filter((n) => n.type === "colony-idle");
		expect(idleWarnings1.length).toBeGreaterThan(0);

		state.notifications = [];
		state.simTime = { days: state.simTime.days + 31 } as typeof state.simTime;
		resetColonyWarningState();
		tickColony(colony, 1);
		const idleWarnings2 = state.notifications.filter((n) => n.type === "colony-idle");
		expect(idleWarnings2.length).toBeGreaterThan(0);
	});
});

describe("computeResearchProgress", () => {
	const BASE_RESEARCH_RATE = 5;
	const CATEGORY_GROWTH_RATE = 0.0015;

	it("RP gain scales linearly with labs", () => {
		const a = computeResearchProgress(1, 1, 1, 1, 1);
		const b = computeResearchProgress(3, 1, 1, 1, 1);
		expect(b.rpGain).toBeCloseTo(a.rpGain * 3);
	});

	it("RP gain scales with research quality", () => {
		const a = computeResearchProgress(2, 0.5, 1, 1, 1);
		const b = computeResearchProgress(2, 1.5, 1, 1, 1);
		expect(b.rpGain).toBeCloseTo(a.rpGain * 3);
	});

	it("RP gain scales with category multiplier", () => {
		const a = computeResearchProgress(2, 1, 1, 1, 1);
		const b = computeResearchProgress(2, 1, 2, 1, 1);
		expect(b.rpGain).toBeCloseTo(a.rpGain * 2);
	});

	it("RP gain scales with simDtDays", () => {
		const a = computeResearchProgress(2, 1, 1, 1, 1);
		const b = computeResearchProgress(2, 1, 1, 1, 10);
		expect(b.rpGain).toBeCloseTo(a.rpGain * 10);
	});

	it("RP gain matches formula: BASE_RESEARCH_RATE * labs * quality * multiplier * dt", () => {
		const result = computeResearchProgress(4, 1.2, 1.5, 2, 3);
		expect(result.rpGain).toBeCloseTo(BASE_RESEARCH_RATE * 4 * 1.2 * 1.5 * 3);
	});

	it("experience gain proportional to difficulty * time", () => {
		const result = computeResearchProgress(1, 1, 1, 3, 7);
		expect(result.experienceGain).toBeCloseTo(3 * 7);
	});

	it("bonus growth proportional to difficulty * time * CATEGORY_GROWTH_RATE", () => {
		const result = computeResearchProgress(1, 1, 1, 2, 5);
		expect(result.bonusGrowth).toBeCloseTo(2 * 5 * CATEGORY_GROWTH_RATE);
	});

	it("zero labs produces zero RP gain", () => {
		const result = computeResearchProgress(0, 1, 1, 1, 1);
		expect(result.rpGain).toBe(0);
	});
});

describe("factory production", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.bodyMeshes = [mockPlanet("Earth")];
		rebuildEntityMaps();
		seedStartingColonies();
	});

	it("tickColony advances production projects", () => {
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("no colony");
		// Ensure resources available
		addColonyStock("Earth", "iron", 10_000);
		addColonyStock("Earth", "copper", 5_000);
		addColonyStock("Earth", "aluminum", 5_000);
		addProductionProject(colony, "flat-mine", 1, 100);
		// Tick enough days to complete (100 BP at ~8 BP/day = ~12 days)
		for (let i = 0; i < 20; i++) tickColony(colony, 1);
		expect(colony.stockpile.flatPacked["flat-mine"] ?? 0).toBeGreaterThanOrEqual(1);
	});

	it("production deducts resources on completion", () => {
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("no colony");
		addColonyStock("Earth", "iron", 10_000);
		addColonyStock("Earth", "copper", 5_000);
		addColonyStock("Earth", "aluminum", 5_000);
		const ironBefore = colony.stockpile.resources.iron ?? 0;
		addProductionProject(colony, "flat-mine", 1, 100);
		for (let i = 0; i < 20; i++) tickColony(colony, 1);
		expect(colony.stockpile.resources.iron ?? 0).toBeLessThan(ironBefore);
	});

	it("canAffordProduction returns false when resources insufficient", () => {
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("no colony");
		colony.stockpile.resources = {}; // empty
		expect(canAffordProduction(colony, "flat-mine")).toBe(false);
	});

	it("canAffordProduction returns true with sufficient resources", () => {
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("no colony");
		addColonyStock("Earth", "iron", 10_000);
		addColonyStock("Earth", "copper", 5_000);
		addColonyStock("Earth", "aluminum", 5_000);
		expect(canAffordProduction(colony, "flat-mine")).toBe(true);
	});

	it("paused production projects are skipped", () => {
		const [colony] = getColony("Earth");
		if (!colony) throw new Error("no colony");
		addColonyStock("Earth", "iron", 10_000);
		addColonyStock("Earth", "copper", 5_000);
		addColonyStock("Earth", "aluminum", 5_000);
		addProductionProject(colony, "flat-mine", 1, 100);
		colony.productionProjects[0].paused = true;
		for (let i = 0; i < 20; i++) tickColony(colony, 1);
		expect(colony.stockpile.flatPacked["flat-mine"] ?? 0).toBe(0);
	});
});

describe("shipbuilding", () => {
	function makeShipDesign(dryMassKg: number) {
		return {
			id: "design-test",
			name: "Test Ship",
			engineDesignId: "eng-1",
			engineCount: 1,
			components: [],
			dryMassKg,
			fuelCapacityKg: 10_000,
			cargoCapacityKg: 0,
			crewCapacity: 10,
			maxSupplies: 100,
			sensorMultiplier: 1,
			accelG: 0.1,
			ispS: 10_000,
			armorHp: 0,
		};
	}

	beforeEach(() => {
		state.colonies.clear();
		state.shipDesigns.clear();
		state.bodyMeshes = [mockPlanet("Earth")];
		rebuildEntityMaps();
		// drain any leftover completed builds from previous tests
		drainCompletedShipbuilds();
	});

	it("computeShipResourceCost scales with mass", () => {
		const design = makeShipDesign(1000);
		const cost = computeShipResourceCost(design);
		expect(cost.iron).toBe(Math.ceil(1000 / 5));
		expect(cost.aluminum).toBe(Math.ceil(1000 / 20));
		expect(cost.copper).toBe(Math.ceil(1000 / 50));
		expect(cost.silicon).toBe(Math.ceil(1000 / 100));
	});

	it("getShipbuildBpPerDay is zero without shipyards", () => {
		const colony = makeColony("Earth");
		expect(getShipbuildBpPerDay(colony)).toBe(0);
	});

	it("getShipbuildBpPerDay is positive with shipyards", () => {
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 1,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 1,
			},
		});
		expect(getShipbuildBpPerDay(colony)).toBeGreaterThan(0);
	});

	it("tickShipbuilding completes ship and pushes to drain queue", () => {
		const design = makeShipDesign(500);
		state.shipDesigns.set(design.id, design);
		const totalBp = Math.ceil(500 / 50); // 10
		const cost = computeShipResourceCost(design);
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 0,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 1,
			},
			stockpile: {
				fuelKg: 0,
				supplies: 0,
				resources: { ...cost },
				flatPacked: {},
			},
		});
		state.colonies.set("Earth", colony);
		addShipbuildProject(colony, design.id, "SS Tester");
		// Tick enough days to finish (10 BP, ~0.7 BP/day with base quality)
		for (let i = 0; i < totalBp * 10; i++) tickColony(colony, 1);
		const completed = drainCompletedShipbuilds();
		expect(completed.length).toBe(1);
		expect(completed[0].name).toBe("SS Tester");
		expect(completed[0].bodyName).toBe("Earth");
		expect(completed[0].designId).toBe(design.id);
	});

	it("tickShipbuilding deducts resources on completion", () => {
		const design = makeShipDesign(500);
		state.shipDesigns.set(design.id, design);
		const cost = computeShipResourceCost(design);
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 0,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 1,
			},
			stockpile: {
				fuelKg: 0,
				supplies: 0,
				resources: { ...cost },
				flatPacked: {},
			},
		});
		state.colonies.set("Earth", colony);
		addShipbuildProject(colony, design.id, "SS Deduct");
		for (let i = 0; i < 200; i++) tickColony(colony, 1);
		drainCompletedShipbuilds();
		// Resources should be depleted
		for (const [res, amount] of Object.entries(cost)) {
			expect(colony.stockpile.resources[res] ?? 0).toBeLessThanOrEqual(0);
			expect(amount).toBeGreaterThan(0);
		}
	});

	it("tickShipbuilding stalls when resources insufficient", () => {
		const design = makeShipDesign(500);
		state.shipDesigns.set(design.id, design);
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 0,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 1,
			},
			stockpile: {
				fuelKg: 0,
				supplies: 0,
				resources: {}, // no resources
				flatPacked: {},
			},
		});
		state.colonies.set("Earth", colony);
		addShipbuildProject(colony, design.id, "SS Stall");
		for (let i = 0; i < 200; i++) tickColony(colony, 1);
		const completed = drainCompletedShipbuilds();
		expect(completed.length).toBe(0);
		// Project still present, stalled at totalBp
		expect(colony.shipbuildProjects.length).toBe(1);
		expect(colony.shipbuildProjects[0].progressBp).toBe(colony.shipbuildProjects[0].totalBp);
	});

	it("paused shipbuild projects are skipped", () => {
		const design = makeShipDesign(500);
		state.shipDesigns.set(design.id, design);
		const cost = computeShipResourceCost(design);
		const colony = makeColony("Earth", {
			installations: {
				constructionFactory: 0,
				repairYard: 0,
				fuelDepot: 0,
				mine: 0,
				lab: 0,
				academy: 0,
				storage: 0,
				shipyard: 1,
			},
			stockpile: {
				fuelKg: 0,
				supplies: 0,
				resources: { ...cost },
				flatPacked: {},
			},
		});
		state.colonies.set("Earth", colony);
		addShipbuildProject(colony, design.id, "SS Paused");
		pauseShipbuildProject(colony, colony.shipbuildProjects[0].id);
		for (let i = 0; i < 200; i++) tickColony(colony, 1);
		const completed = drainCompletedShipbuilds();
		expect(completed.length).toBe(0);
		expect(colony.shipbuildProjects[0].progressBp).toBe(0);
	});

	it("cancelShipbuildProject removes project", () => {
		const design = makeShipDesign(500);
		state.shipDesigns.set(design.id, design);
		const colony = makeColony("Earth");
		state.colonies.set("Earth", colony);
		addShipbuildProject(colony, design.id, "SS Cancel");
		expect(colony.shipbuildProjects.length).toBe(1);
		cancelShipbuildProject(colony, colony.shipbuildProjects[0].id);
		expect(colony.shipbuildProjects.length).toBe(0);
	});
});
