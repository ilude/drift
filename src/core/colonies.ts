import { DIST_SCALE } from "../math/orbit";
import type {
	BodyEntry,
	ColonyConstructionProject,
	ColonyInstallationId,
	ColonyInstallations,
	ColonyQualities,
	ColonyResearchProject,
	ColonyState,
	ColonyWorkforce,
	PlanetEntry,
	Result,
	ShipEntry,
} from "../types";
import { isPlanetEntry, isSurveyable } from "../types";
import { findAsteroidEntity, findBody } from "./entities";
import { err, ok } from "./result";
import { state } from "./state";

const WORKFORCE_RATIO = 0.45;
const BASE_STORAGE_CAPACITY = 100_000;
const STORAGE_CAPACITY_PER_INSTALLATION = 50_000;
const BASE_SERVICE_QUALITY = 0.5;
const BASE_MINING_RATE = 10;
const BASE_RESEARCH_RATE = 5;
const BASE_CONSTRUCTION_BP_RATE = 2;
let projectCounter = 0;

export type ResearchCategory = "industry" | "survey" | "logistics" | "research";

export interface ConstructionDefinition {
	id: ColonyInstallationId;
	name: string;
	bpCost: number;
	description: string;
}

export interface ResearchDefinition {
	id: string;
	name: string;
	category: ResearchCategory;
	rpCost: number;
	description: string;
	effectText: string;
}

export const CONSTRUCTION_DEFS: ConstructionDefinition[] = [
	{
		id: "construction-factory",
		name: "Construction Factory",
		bpCost: 120,
		description: "Adds colony build capacity for new installations.",
	},
	{
		id: "mine",
		name: "Mine",
		bpCost: 80,
		description: "Extracts surveyed deposits into colony stockpiles.",
	},
	{
		id: "lab",
		name: "Research Lab",
		bpCost: 120,
		description: "Generates RP for colony-local research projects.",
	},
	{
		id: "repair-yard",
		name: "Repair Yard",
		bpCost: 90,
		description: "Improves overhaul and refit throughput for ships in port.",
	},
	{
		id: "fuel-depot",
		name: "Fuel Depot",
		bpCost: 70,
		description: "Improves refueling throughput and expands local fuel handling.",
	},
	{
		id: "academy",
		name: "Academy",
		bpCost: 100,
		description: "Foundational training infrastructure for future officers and specialists.",
	},
	{
		id: "storage",
		name: "Storage",
		bpCost: 60,
		description: "Increases stockpile capacity and logistics slack.",
	},
	{
		id: "shipyard",
		name: "Shipyard",
		bpCost: 180,
		description:
			"Limited hull construction and refit capacity. Placeholder for future ship production.",
	},
];

export const RESEARCH_DEFS: ResearchDefinition[] = [
	{
		id: "survey-automation",
		name: "Survey Automation",
		category: "survey",
		rpCost: 120,
		description: "Refines mission-planning and scan interpretation.",
		effectText: "-15% survey duration",
	},
	{
		id: "mining-drills",
		name: "Improved Mining Drills",
		category: "industry",
		rpCost: 120,
		description: "Better extraction tooling and haul discipline for frontier colonies.",
		effectText: "+25% mine output",
	},
	{
		id: "maintenance-doctrine",
		name: "Maintenance Doctrine",
		category: "logistics",
		rpCost: 140,
		description: "Standardized service routines for yard crews and depot handling.",
		effectText: "+15% repair/refuel quality",
	},
	{
		id: "lab-instrumentation",
		name: "Lab Instrumentation",
		category: "research",
		rpCost: 150,
		description: "Denser instrumentation packages for better throughput per active lab.",
		effectText: "+20% research output",
	},
	{
		id: "fabrication-methods",
		name: "Fabrication Methods",
		category: "industry",
		rpCost: 160,
		description: "Improves construction planning and line efficiency for installation builds.",
		effectText: "+25% construction BP",
	},
];

const INSTALLATION_WORKERS: Record<keyof ColonyInstallations, number> = {
	constructionFactory: 50_000,
	repairYard: 50_000,
	fuelDepot: 25_000,
	mine: 50_000,
	lab: 100_000,
	academy: 50_000,
	storage: 10_000,
	shipyard: 250_000,
};

function bodyDistanceAU(body: BodyEntry): number {
	if (body.data.distance > 0 && !body.isMoon) return body.data.distance;
	const { x, y, z } = body.mesh.position;
	return (Math.hypot(x, y, z) / DIST_SCALE) ** 2;
}

export function getColony(bodyName: string): Result<ColonyState> {
	const colony = state.colonies.get(bodyName);
	return colony ? ok(colony) : err();
}

export function hasColony(bodyName: string): boolean {
	return state.colonies.has(bodyName) || (state.colonies.size === 0 && bodyName === "Earth");
}

function getHabitabilityForBody(entry: PlanetEntry): number {
	if (entry.data.type === "Moon" || entry.data.type === "Dwarf Planet") return 0.35;
	if (entry.data.type === "Centaur") return 0.2;
	if (entry.data.type === "Planet") {
		switch (entry.data._category) {
			case "gasGiant":
			case "iceGiant":
				return 0;
			case "subNeptune":
				return 0.25;
			default:
				return entry.data.name === "Earth" ? 1 : 0.7;
		}
	}
	return 0.25;
}

function createColony(
	bodyName: string,
	name: string,
	population: number,
	installations: ColonyInstallations,
	stockpile?: Partial<ColonyState["stockpile"]>,
): ColonyState {
	const [body] = findBody(bodyName);
	const habitability = body && isPlanetEntry(body) ? getHabitabilityForBody(body) : 0.5;
	return {
		bodyName,
		name,
		population,
		habitability,
		installations,
		stockpile: {
			fuelKg: stockpile?.fuelKg ?? 0,
			supplies: stockpile?.supplies ?? 0,
			resources: { ...(stockpile?.resources ?? {}) },
		},
		researchPoints: 0,
		constructionProjects: [],
		currentResearch: null,
		researchQueue: [],
	};
}

export function seedStartingColonies(): void {
	state.colonies.clear();

	const [earth] = findBody("Earth");
	if (earth && isPlanetEntry(earth)) {
		state.colonies.set(
			earth.data.name,
			createColony(
				earth.data.name,
				"Earth Colony",
				5_000_000_000,
				{
					constructionFactory: 4,
					repairYard: 4,
					fuelDepot: 4,
					mine: 2,
					lab: 1,
					academy: 0,
					storage: 6,
					shipyard: 1,
				},
				{
					fuelKg: 2_000_000,
					supplies: 20_000,
					resources: {
						iron: 15_000,
						aluminum: 8_000,
						copper: 4_000,
						silicon: 3_000,
					},
				},
			),
		);
		return;
	}

	const fallback = state.bodyMeshes.find(
		(entry) =>
			isPlanetEntry(entry) &&
			entry.data.type !== "Star" &&
			entry.data._category !== "gasGiant" &&
			entry.data._category !== "iceGiant",
	);
	if (!fallback || !isPlanetEntry(fallback)) return;

	state.colonies.set(
		fallback.data.name,
		createColony(
			fallback.data.name,
			`${fallback.data.name} Outpost`,
			250_000,
			{
				constructionFactory: 1,
				repairYard: 1,
				fuelDepot: 1,
				mine: 1,
				lab: 1,
				academy: 0,
				storage: 2,
				shipyard: 0,
			},
			{ fuelKg: 100_000, supplies: 2_000 },
		),
	);
}

export function computeColonyWorkforce(colony: ColonyState): ColonyWorkforce {
	const availableWorkers = Math.floor(colony.population * WORKFORCE_RATIO * colony.habitability);
	const usedWorkers =
		colony.installations.constructionFactory * INSTALLATION_WORKERS.constructionFactory +
		colony.installations.repairYard * INSTALLATION_WORKERS.repairYard +
		colony.installations.fuelDepot * INSTALLATION_WORKERS.fuelDepot +
		colony.installations.mine * INSTALLATION_WORKERS.mine +
		colony.installations.lab * INSTALLATION_WORKERS.lab +
		colony.installations.academy * INSTALLATION_WORKERS.academy +
		colony.installations.storage * INSTALLATION_WORKERS.storage +
		colony.installations.shipyard * INSTALLATION_WORKERS.shipyard;
	const staffingRatio =
		usedWorkers <= 0 ? 1 : Math.max(0, Math.min(1, availableWorkers / usedWorkers));
	return {
		totalPopulation: colony.population,
		workforceRatio: WORKFORCE_RATIO,
		habitability: colony.habitability,
		availableWorkers,
		usedWorkers,
		staffingRatio,
	};
}

export function computeColonyQualities(colony: ColonyState): ColonyQualities {
	const workforce = computeColonyWorkforce(colony);
	const staffingRatio = workforce.staffingRatio;
	const bonuses = getEmpireTechBonuses();
	return {
		construction:
			(BASE_SERVICE_QUALITY + colony.installations.constructionFactory * 0.2) *
			staffingRatio *
			bonuses.construction,
		repair:
			(BASE_SERVICE_QUALITY + colony.installations.repairYard * 0.25) * staffingRatio * bonuses.repair,
		refuel:
			(BASE_SERVICE_QUALITY + colony.installations.fuelDepot * 0.25) * staffingRatio * bonuses.refuel,
		research:
			(BASE_SERVICE_QUALITY + colony.installations.lab * 0.2) * staffingRatio * bonuses.research,
		training: (BASE_SERVICE_QUALITY + colony.installations.academy * 0.2) * staffingRatio,
		mining: (BASE_SERVICE_QUALITY + colony.installations.mine * 0.2) * staffingRatio * bonuses.mining,
		shipbuilding: (BASE_SERVICE_QUALITY + colony.installations.shipyard * 0.2) * staffingRatio,
		storageCapacity:
			BASE_STORAGE_CAPACITY + colony.installations.storage * STORAGE_CAPACITY_PER_INSTALLATION,
		staffingRatio,
	};
}

export function getEmpireTechBonuses(): {
	survey: number;
	mining: number;
	repair: number;
	refuel: number;
	research: number;
	construction: number;
} {
	return {
		survey: state.researchedTechs.has("survey-automation") ? 1.15 : 1,
		mining: state.researchedTechs.has("mining-drills") ? 1.25 : 1,
		repair: state.researchedTechs.has("maintenance-doctrine") ? 1.15 : 1,
		refuel: state.researchedTechs.has("maintenance-doctrine") ? 1.15 : 1,
		research: state.researchedTechs.has("lab-instrumentation") ? 1.2 : 1,
		construction: state.researchedTechs.has("fabrication-methods") ? 1.25 : 1,
	};
}

export function getSurveySpeedMultiplier(): number {
	return 1 / getEmpireTechBonuses().survey;
}

function getConstructionDef(installationId: ColonyInstallationId): ConstructionDefinition {
	const def = CONSTRUCTION_DEFS.find((entry) => entry.id === installationId);
	if (!def) throw new Error(`Unknown construction installation: ${installationId}`);
	return def;
}

export function getResearchDef(techId: string): Result<ResearchDefinition> {
	const def = RESEARCH_DEFS.find((entry) => entry.id === techId);
	return def ? ok(def) : err();
}

function applyCompletedTech(techId: string): void {
	state.researchedTechs.add(techId);
}

export function getColonyQualitiesAtBody(bodyName: string): Result<ColonyQualities> {
	const [colony, found] = getColony(bodyName);
	return found ? ok(computeColonyQualities(colony)) : err();
}

export function getServiceQualityForShip(ship: ShipEntry): number {
	const [qualities, found] = getColonyQualitiesAtBody(ship.hostPlanetName);
	return found ? Math.max(0.1, qualities.repair) : state.depotQuality;
}

export function getRefuelQualityForShip(ship: ShipEntry): number {
	const [qualities, found] = getColonyQualitiesAtBody(ship.hostPlanetName);
	return found ? Math.max(0.1, qualities.refuel) : state.depotQuality;
}

function resolveHostAU(hostPlanetName: string): number {
	const [host, hostFound] = findBody(hostPlanetName);
	if (hostFound) return bodyDistanceAU(host);
	const [astResult, astFound] = findAsteroidEntity(hostPlanetName);
	return astFound ? astResult.asteroid.au : -1;
}

export function getNearestColonyForShip(ship: ShipEntry): Result<PlanetEntry> {
	const hostAU = resolveHostAU(ship.hostPlanetName);
	if (hostAU < 0) return err();

	if (state.colonies.size === 0) {
		const [earth, earthFound] = findBody("Earth");
		return earthFound && isPlanetEntry(earth) ? ok(earth) : err();
	}

	let best: PlanetEntry | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;

	for (const bodyName of state.colonies.keys()) {
		const [body, bodyFound] = findBody(bodyName);
		if (!bodyFound || !isPlanetEntry(body)) continue;
		const dist = Math.abs(bodyDistanceAU(body) - hostAU);
		if (dist < bestDistance) {
			bestDistance = dist;
			best = body;
		}
	}

	return best ? ok(best) : err();
}

export function addColonyStock(bodyName: string, resourceId: string, amount: number): void {
	if (amount <= 0) return;
	const [colony, found] = getColony(bodyName);
	if (!found) return;
	colony.stockpile.resources[resourceId] = (colony.stockpile.resources[resourceId] ?? 0) + amount;
}

export function getColonyResourceStock(bodyName: string, resourceId: string): number {
	const [colony] = getColony(bodyName);
	return colony?.stockpile.resources[resourceId] ?? 0;
}

export function addConstructionProject(
	bodyName: string,
	installationId: ColonyInstallationId,
	quantity: number,
	allocationPct: number,
): ColonyConstructionProject | null {
	const [colony, found] = getColony(bodyName);
	if (!found || quantity <= 0 || allocationPct <= 0) return null;
	const project: ColonyConstructionProject = {
		id: `build-${projectCounter++}`,
		installationId,
		quantityRemaining: quantity,
		totalQuantity: quantity,
		allocationPct,
		progressBp: 0,
		paused: false,
	};
	colony.constructionProjects.push(project);
	return project;
}

export function cancelConstructionProject(bodyName: string, projectId: string): void {
	const [colony, found] = getColony(bodyName);
	if (!found) return;
	colony.constructionProjects = colony.constructionProjects.filter(
		(project) => project.id !== projectId,
	);
}

export function toggleConstructionProjectPaused(bodyName: string, projectId: string): void {
	const [colony] = getColony(bodyName);
	const project = colony?.constructionProjects.find((entry) => entry.id === projectId);
	if (!project) return;
	project.paused = !project.paused;
}

export function startResearchProject(
	bodyName: string,
	techId: string,
	assignedLabs: number,
	queue = false,
): void {
	const [colony, colonyFound] = getColony(bodyName);
	const [_def, defFound] = getResearchDef(techId);
	if (!colonyFound || !defFound || state.researchedTechs.has(techId) || assignedLabs <= 0) return;
	const project: ColonyResearchProject = {
		techId,
		assignedLabs,
		progressRp: 0,
		paused: false,
	};
	if (!queue && !colony.currentResearch) {
		colony.currentResearch = project;
		return;
	}
	if (!queue && colony.currentResearch?.techId === techId) return;
	if (colony.researchQueue.some((entry) => entry.techId === techId)) return;
	colony.researchQueue.push(project);
}

export function cancelResearchProject(bodyName: string, techId: string): void {
	const [colony, found] = getColony(bodyName);
	if (!found) return;
	if (colony.currentResearch?.techId === techId) {
		colony.currentResearch = colony.researchQueue.shift() ?? null;
		return;
	}
	colony.researchQueue = colony.researchQueue.filter((entry) => entry.techId !== techId);
}

export function setResearchLabs(bodyName: string, assignedLabs: number): void {
	const [colony] = getColony(bodyName);
	if (!colony?.currentResearch) return;
	colony.currentResearch.assignedLabs = Math.max(1, assignedLabs);
}

export function consumeColonyFuel(bodyName: string, amountKg: number): number {
	const [colony, found] = getColony(bodyName);
	if (amountKg <= 0) return 0;
	if (!found) return state.colonies.size === 0 && bodyName === "Earth" ? amountKg : 0;
	const consumed = Math.min(colony.stockpile.fuelKg, amountKg);
	colony.stockpile.fuelKg -= consumed;
	return consumed;
}

export function consumeColonySupplies(bodyName: string, amount: number): number {
	const [colony, found] = getColony(bodyName);
	if (amount <= 0) return 0;
	if (!found) return state.colonies.size === 0 && bodyName === "Earth" ? amount : 0;
	const consumed = Math.min(colony.stockpile.supplies, amount);
	colony.stockpile.supplies -= consumed;
	return consumed;
}

function tickMining(colony: ColonyState, simDtDays: number, qualities: ColonyQualities): void {
	if (colony.installations.mine <= 0) return;
	const [body, bodyFound] = findBody(colony.bodyName);
	if (!bodyFound || !isSurveyable(body) || body.survey.surveyLevel <= 0) return;

	for (const deposit of body.survey.deposits) {
		const remaining = Math.max(0, deposit.quantity - deposit.mined);
		if (remaining <= 0 || deposit.minSurveyLevel > body.survey.surveyLevel) continue;
		const amount = Math.min(
			remaining,
			BASE_MINING_RATE *
				colony.installations.mine *
				qualities.mining *
				deposit.accessibility *
				simDtDays,
		);
		if (amount <= 0) continue;
		deposit.mined += amount;
		addColonyStock(colony.bodyName, deposit.resourceId, amount);
	}
}

function tickResearch(colony: ColonyState, simDtDays: number, qualities: ColonyQualities): void {
	if (!colony.currentResearch) {
		colony.currentResearch = colony.researchQueue.shift() ?? null;
	}
	if (!colony.currentResearch || colony.currentResearch.paused || colony.installations.lab <= 0)
		return;

	const [def, defFound] = getResearchDef(colony.currentResearch.techId);
	if (!defFound) return;

	const assignedLabs = Math.max(
		1,
		Math.min(colony.installations.lab, colony.currentResearch.assignedLabs),
	);
	const rpGain = BASE_RESEARCH_RATE * assignedLabs * qualities.research * simDtDays;
	colony.currentResearch.progressRp += rpGain;
	colony.researchPoints += rpGain;

	if (colony.currentResearch.progressRp >= def.rpCost) {
		applyCompletedTech(def.id);
		colony.currentResearch = colony.researchQueue.shift() ?? null;
	}
}

function tickConstruction(
	colony: ColonyState,
	simDtDays: number,
	qualities: ColonyQualities,
): void {
	const activeProjects = colony.constructionProjects.filter((project) => !project.paused);
	if (activeProjects.length === 0 || colony.installations.constructionFactory <= 0) return;

	const totalAllocation = activeProjects.reduce((sum, project) => sum + project.allocationPct, 0);
	if (totalAllocation <= 0) return;

	const totalBp =
		BASE_CONSTRUCTION_BP_RATE *
		colony.installations.constructionFactory *
		qualities.construction *
		simDtDays;

	for (const project of activeProjects) {
		const def = getConstructionDef(project.installationId);
		project.progressBp += totalBp * (project.allocationPct / totalAllocation);

		while (project.quantityRemaining > 0 && project.progressBp >= def.bpCost) {
			project.progressBp -= def.bpCost;
			project.quantityRemaining--;
			switch (project.installationId) {
				case "construction-factory":
					colony.installations.constructionFactory++;
					break;
				case "repair-yard":
					colony.installations.repairYard++;
					break;
				case "fuel-depot":
					colony.installations.fuelDepot++;
					break;
				case "mine":
					colony.installations.mine++;
					break;
				case "lab":
					colony.installations.lab++;
					break;
				case "academy":
					colony.installations.academy++;
					break;
				case "storage":
					colony.installations.storage++;
					break;
				case "shipyard":
					colony.installations.shipyard++;
					break;
			}
		}
	}

	colony.constructionProjects = colony.constructionProjects.filter(
		(project) => project.quantityRemaining > 0,
	);
}

export function tickColony(colony: ColonyState, simDtDays: number): void {
	const qualities = computeColonyQualities(colony);
	tickConstruction(colony, simDtDays, qualities);
	tickMining(colony, simDtDays, qualities);
	tickResearch(colony, simDtDays, qualities);
}

export function tickColonies(simDtDays: number): void {
	for (const colony of state.colonies.values()) {
		tickColony(colony, simDtDays);
	}
}
