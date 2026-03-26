import { beforeEach, describe, expect, it } from "vitest";
import {
	addColonyStock,
	addConstructionProject,
	computeColonyQualities,
	computeColonyWorkforce,
	consumeColonyFuel,
	consumeColonySupplies,
	getColony,
	getColonyResourceStock,
	getNearestColonyForShip,
	seedStartingColonies,
	startResearchProject,
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
			lab: 1,
			academy: 0,
			storage: 1,
			shipyard: 0,
		},
		stockpile: { fuelKg: 1000, supplies: 100, resources: {} },
		researchPoints: 0,
		constructionProjects: [],
		currentResearch: null,
		researchQueue: [],
		...overrides,
	};
}

describe("colonies", () => {
	beforeEach(() => {
		state.colonies.clear();
		state.researchedTechs.clear();
		state.bodyMeshes = [];
		rebuildEntityMaps();
	});

	it("seedStartingColonies creates Earth colony when Earth exists", () => {
		state.bodyMeshes = [mockPlanet("Earth")];
		rebuildEntityMaps();
		seedStartingColonies();

		const [colony, found] = getColony("Earth");
		expect(found).toBe(true);
		expect(colony.population).toBeGreaterThan(1_000_000_000);
		expect(colony.installations.lab).toBeGreaterThan(0);
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

	it("tickColony does not mine unsurveyed bodies", () => {
		const earth = mockPlanet("Earth", {
			survey: {
				surveyLevel: 0,
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

		expect(getColonyResourceStock("Earth", "iron")).toBe(0);
		expect(earth.survey?.deposits[0].mined).toBe(0);
	});

	it("tickColony generates research points from labs when research is active", () => {
		const earth = mockPlanet("Earth");
		state.bodyMeshes = [earth];
		rebuildEntityMaps();
		const colony = makeColony("Earth", {
			researchPoints: 0,
			currentResearch: { techId: "survey-automation", assignedLabs: 1, progressRp: 0, paused: false },
		});
		state.colonies.set("Earth", colony);

		tickColony(colony, 2);

		expect(colony.researchPoints).toBeGreaterThan(0);
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
		});
		state.colonies.set("Earth", colony);
		addConstructionProject("Earth", "mine", 1, 100);

		tickColony(colony, 20);

		expect(colony.installations.mine).toBeGreaterThan(0);
		expect(colony.constructionProjects).toHaveLength(0);
	});

	it("tickColony completes research projects and records researched techs", () => {
		const earth = mockPlanet("Earth");
		state.bodyMeshes = [earth];
		const colony = makeColony("Earth", {
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
		});
		state.colonies.set("Earth", colony);
		state.researchedTechs.clear();
		startResearchProject("Earth", "survey-automation", 3);

		tickColony(colony, 20);

		expect(state.researchedTechs.has("survey-automation")).toBe(true);
		expect(colony.currentResearch).toBeNull();
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
		expect(nearest.data.name).toBe("Earth");
	});

	it("getNearestColonyForShip works when ship is at an asteroid", () => {
		state.bodyMeshes = [
			mockPlanet("Earth", { data: { ...mockPlanet("Earth").data, distance: 1 } }),
			mockPlanet("Mars", { data: { ...mockPlanet("Mars").data, distance: 1.5 } }),
		];
		const positions = new Float32Array(3);
		state.asteroidBelts = [
			{
				belt: {
					name: "Main Belt",
					minAU: 2.2,
					maxAU: 3.2,
					count: 1,
					color: "#999",
					size: 0.5,
					maxInc: 10,
				},
				asteroids: [
					{
						designation: "MA-G113",
						au: 2.5,
						period: 3.95,
						diameter: 1,
						mass: 1e15,
						beltIndex: 0,
						survey: { surveyLevel: 0, deposits: [] },
					},
				],
				positions,
			} as unknown as import("../types").AsteroidBeltEntry,
		];
		rebuildEntityMaps();
		state.colonies.set("Earth", makeColony("Earth"));
		state.colonies.set("Mars", makeColony("Mars"));

		const [nearest, nearestFound] = getNearestColonyForShip(mockShip("MA-G113"));
		expect(nearestFound).toBe(true);
		expect(nearest.data.name).toBe("Mars"); // Mars at 1.5 AU is closer to 2.5 than Earth at 1
	});
});
