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
	GameLogCategory,
	PlanetEntry,
	Result,
	ScientistDashboardRow,
	ScientistState,
	ShipEntry,
} from "../types";
import { isPlanetEntry, isSurveyable } from "../types";
import { findAsteroidEntity, findBody, listShipsAtBody } from "./entities";
import { err, ok } from "./result";
import { simTimeToDate, state } from "./state";

const WORKFORCE_RATIO = 0.45;
const BASE_STORAGE_CAPACITY = 100_000;
const STORAGE_CAPACITY_PER_INSTALLATION = 50_000;
const BASE_SERVICE_QUALITY = 0.5;
const BASE_MINING_RATE = 10;
const BASE_RESEARCH_RATE = 5;
const BASE_CONSTRUCTION_BP_RATE = 2;
const CATEGORY_GROWTH_RATE = 0.0015;

let projectCounter = 0;
let transferCounter = 0;
let scientistCounter = 0;

export type ResearchCategory = "industry" | "survey" | "logistics" | "research";

const RESEARCH_CATEGORIES: ResearchCategory[] = ["industry", "survey", "logistics", "research"];

const SCIENTIST_NAMES = [
	"John Doe",
	"Maya Ivanova",
	"Victor Hale",
	"Elena Park",
	"Darius Quinn",
	"Rina Solberg",
	"Anika Rao",
	"Thomas Vale",
	"Nadia Ilyin",
	"Sara Kincaid",
	"Haruto Sato",
	"Milo Graves",
];

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
	difficulty: number;
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
		difficulty: 1.1,
		description: "Refines mission-planning and scan interpretation.",
		effectText: "-15% survey duration",
	},
	{
		id: "mining-drills",
		name: "Improved Mining Drills",
		category: "industry",
		rpCost: 120,
		difficulty: 1.2,
		description: "Better extraction tooling and haul discipline for frontier colonies.",
		effectText: "+25% mine output",
	},
	{
		id: "maintenance-doctrine",
		name: "Maintenance Doctrine",
		category: "logistics",
		rpCost: 140,
		difficulty: 1.3,
		description: "Standardized service routines for yard crews and depot handling.",
		effectText: "+15% repair/refuel quality",
	},
	{
		id: "lab-instrumentation",
		name: "Lab Instrumentation",
		category: "research",
		rpCost: 150,
		difficulty: 1.35,
		description: "Denser instrumentation packages for better throughput per active lab.",
		effectText: "+20% research output",
	},
	{
		id: "fabrication-methods",
		name: "Fabrication Methods",
		category: "industry",
		rpCost: 160,
		difficulty: 1.4,
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

function rand(): number {
	return state.masterRng ? state.masterRng() : Math.random();
}

function pickCategory(): ResearchCategory {
	const idx = Math.floor(rand() * RESEARCH_CATEGORIES.length);
	return RESEARCH_CATEGORIES[Math.max(0, Math.min(RESEARCH_CATEGORIES.length - 1, idx))];
}

function bodyDistanceAU(body: BodyEntry): number {
	if (body.data.distance > 0 && !body.isMoon) return body.data.distance;
	const { x, y, z } = body.mesh.position;
	return (Math.hypot(x, y, z) / DIST_SCALE) ** 2;
}

function makeScientistName(): string {
	const idx = scientistCounter % SCIENTIST_NAMES.length;
	const cycle = Math.floor(scientistCounter / SCIENTIST_NAMES.length);
	return cycle === 0 ? SCIENTIST_NAMES[idx] : `${SCIENTIST_NAMES[idx]} ${cycle + 1}`;
}

function clampBonus(value: number): number {
	return Math.max(0, Math.min(0.5, value));
}

function getScientistMultiplier(scientist: ScientistState, category: string): number {
	return 1 + clampBonus(scientist.categoryBonuses[category] ?? 0);
}

function ensureExperienceKey(scientist: ScientistState, category: string): void {
	if (scientist.experienceByCategory[category] === undefined)
		scientist.experienceByCategory[category] = 0;
	if (scientist.categoryBonuses[category] === undefined) scientist.categoryBonuses[category] = 0;
}

function pushGameLog(
	category: GameLogCategory,
	message: string,
	meta?: Record<string, string | number | boolean | null>,
): void {
	state.gameLog.push({
		id: state.gameLog.length + 1,
		category,
		simTime: state.simTime.days,
		message,
		meta,
	});
}

export function formatSimDate(simDay: number): string {
	return simTimeToDate(simDay).toISOString().slice(0, 10);
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
		transferQueue: [],
	};
}

function seedInitialScientistsAtColony(bodyName: string, count: number): void {
	for (let i = 0; i < count; i++) {
		const primary = pickCategory();
		let secondary = pickCategory();
		if (secondary === primary)
			secondary = RESEARCH_CATEGORIES[(RESEARCH_CATEGORIES.indexOf(primary) + 1) % 4];
		const scientist: ScientistState = {
			id: `scientist-${scientistCounter++}`,
			name: makeScientistName(),
			colonyBodyName: bodyName,
			primaryCategory: primary,
			secondaryCategory: secondary,
			activeProjectTechId: null,
			projectQueue: [],
			assignedLabs: 0,
			adminCap: 1 + Math.floor(rand() * 5),
			categoryBonuses: {
				[primary]: clampBonus(0.15 + rand() * 0.35),
				[secondary]: clampBonus(0.05 + rand() * 0.2),
			},
			completedProjects: [],
			experienceByCategory: {},
		};
		state.scientists.set(scientist.id, scientist);
	}
}

export function seedStartingColonies(): void {
	state.colonies.clear();
	state.scientists.clear();
	state.researchProjects.clear();
	state.gameLog = [];

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
					lab: 4,
					academy: 1,
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
		seedInitialScientistsAtColony(earth.data.name, 5);
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
	seedInitialScientistsAtColony(fallback.data.name, 2);
}

export function getScientistsAtColony(bodyName: string): ScientistState[] {
	const scientists: ScientistState[] = [];
	for (const scientist of state.scientists.values()) {
		if (scientist.colonyBodyName === bodyName) scientists.push(scientist);
	}
	return scientists;
}

export function getScientist(scientistId: string): Result<ScientistState> {
	const scientist = state.scientists.get(scientistId);
	return scientist ? ok(scientist) : err();
}

export function setScientistLabs(scientistId: string, requestedLabs: number): boolean {
	const [scientist, found] = getScientist(scientistId);
	if (!found) return false;
	const [colony, colonyFound] = getColony(scientist.colonyBodyName);
	if (!colonyFound) return false;
	const nextLabs = Math.max(0, Math.floor(requestedLabs));
	if (nextLabs > scientist.adminCap) return false;
	let assignedElsewhere = 0;
	for (const peer of getScientistsAtColony(colony.bodyName)) {
		if (peer.id === scientist.id) continue;
		assignedElsewhere += peer.assignedLabs;
	}
	if (assignedElsewhere + nextLabs > colony.installations.lab) return false;
	scientist.assignedLabs = nextLabs;
	return true;
}

function getResearchDef(techId: string): Result<ResearchDefinition> {
	const def = RESEARCH_DEFS.find((entry) => entry.id === techId);
	return def ? ok(def) : err();
}

function getProject(techId: string): Result<ColonyResearchProject> {
	const project = state.researchProjects.get(techId);
	return project ? ok(project) : err();
}

function canStartProject(scientist: ScientistState, techId: string): boolean {
	if (state.researchedTechs.has(techId)) return false;
	const [def, found] = getResearchDef(techId);
	if (!found) return false;
	const [colony, colonyFound] = getColony(scientist.colonyBodyName);
	if (!colonyFound || colony.installations.lab <= 0) return false;
	const [existing, existingFound] = getProject(def.id);
	if (!existingFound) return true;
	if (existing.leadScientistId === scientist.id) return false;
	return existing.leadScientistId === null;
}

function maybeActivateNextProject(scientist: ScientistState): void {
	if (scientist.activeProjectTechId !== null) return;
	while (scientist.projectQueue.length > 0) {
		const nextTechId = scientist.projectQueue[0];
		if (!canStartProject(scientist, nextTechId)) {
			scientist.projectQueue.shift();
			continue;
		}
		const [existing, found] = getProject(nextTechId);
		if (found) {
			existing.leadScientistId = scientist.id;
			existing.colonyBodyName = scientist.colonyBodyName;
			existing.paused = false;
			existing.startedAt ??= state.simTime.days;
			existing.assignedLabs = Math.min(scientist.assignedLabs, scientist.adminCap);
		} else {
			const [def] = getResearchDef(nextTechId);
			state.researchProjects.set(nextTechId, {
				techId: nextTechId,
				colonyBodyName: scientist.colonyBodyName,
				leadScientistId: scientist.id,
				assignedLabs: Math.min(scientist.assignedLabs, scientist.adminCap),
				progressRp: 0,
				paused: false,
				queuedAt: state.simTime.days,
				startedAt: state.simTime.days,
				difficulty: def?.difficulty ?? 1,
			});
		}
		scientist.activeProjectTechId = nextTechId;
		scientist.projectQueue.shift();
		break;
	}
}

export function queueResearchProjectForScientist(scientistId: string, techId: string): boolean {
	const [scientist, found] = getScientist(scientistId);
	if (!found) return false;
	if (!canStartProject(scientist, techId) && state.researchedTechs.has(techId)) return false;
	if (scientist.activeProjectTechId === techId) return false;
	if (scientist.projectQueue.includes(techId)) return false;
	const [existing, existingFound] = getProject(techId);
	if (existingFound && existing.leadScientistId && existing.leadScientistId !== scientist.id)
		return false;
	scientist.projectQueue.push(techId);
	maybeActivateNextProject(scientist);
	return true;
}

export function reorderScientistQueue(
	scientistId: string,
	fromIndex: number,
	toIndex: number,
): boolean {
	const [scientist, found] = getScientist(scientistId);
	if (!found) return false;
	if (fromIndex < 0 || toIndex < 0) return false;
	if (fromIndex >= scientist.projectQueue.length || toIndex >= scientist.projectQueue.length)
		return false;
	if (fromIndex === toIndex) return true;
	const [item] = scientist.projectQueue.splice(fromIndex, 1);
	scientist.projectQueue.splice(toIndex, 0, item);
	return true;
}

export function setResearchPaused(techId: string, paused: boolean): boolean {
	const [project, found] = getProject(techId);
	if (!found) return false;
	project.paused = paused;
	if (paused && project.leadScientistId) {
		const [scientist, scientistFound] = getScientist(project.leadScientistId);
		if (scientistFound && scientist.activeProjectTechId === techId)
			scientist.activeProjectTechId = null;
	}
	if (!paused && project.leadScientistId) {
		const [scientist, scientistFound] = getScientist(project.leadScientistId);
		if (scientistFound && scientist.activeProjectTechId === null)
			scientist.activeProjectTechId = techId;
	}
	return true;
}

export function getProjectCompletionDate(techId: string): string {
	const [project, projectFound] = getProject(techId);
	if (!projectFound) return "--";
	const eta = estimateProjectEta(project);
	return eta === null ? "--" : formatSimDate(eta);
}

function estimateProjectEta(project: ColonyResearchProject): number | null {
	if (project.paused) return null;
	const [def, defFound] = getResearchDef(project.techId);
	if (!defFound || def.rpCost <= project.progressRp) return state.simTime.days;
	if (!project.leadScientistId) return null;
	const [scientist, scientistFound] = getScientist(project.leadScientistId);
	if (!scientistFound) return null;
	const [colony, colonyFound] = getColony(project.colonyBodyName);
	if (!colonyFound) return null;
	const qualities = computeColonyQualities(colony);
	const effLabs = Math.min(scientist.assignedLabs, scientist.adminCap, colony.installations.lab);
	if (effLabs <= 0) return null;
	const multiplier = getScientistMultiplier(scientist, def.category);
	const rpPerDay = BASE_RESEARCH_RATE * effLabs * qualities.research * multiplier;
	if (rpPerDay <= 0) return null;
	return state.simTime.days + (def.rpCost - project.progressRp) / rpPerDay;
}

function completeProject(project: ColonyResearchProject, scientist: ScientistState): void {
	state.researchedTechs.add(project.techId);
	state.researchProjects.delete(project.techId);
	scientist.activeProjectTechId = null;
	scientist.completedProjects.push(project.techId);
	const [def] = getResearchDef(project.techId);
	pushGameLog("Research", `Completed ${def?.name ?? project.techId}`, {
		techId: project.techId,
		scientist: scientist.name,
		date: formatSimDate(state.simTime.days),
		colony: project.colonyBodyName,
	});
	maybeActivateNextProject(scientist);
}

function tickResearchProject(project: ColonyResearchProject, simDtDays: number): void {
	if (project.paused || !project.leadScientistId) return;
	const [def, defFound] = getResearchDef(project.techId);
	const [scientist, scientistFound] = getScientist(project.leadScientistId);
	const [colony, colonyFound] = getColony(project.colonyBodyName);
	if (!defFound || !scientistFound || !colonyFound) return;
	if (scientist.colonyBodyName !== colony.bodyName) return;
	if (scientist.activeProjectTechId !== project.techId) return;
	const qualities = computeColonyQualities(colony);
	const effectiveLabs = Math.min(
		scientist.assignedLabs,
		scientist.adminCap,
		colony.installations.lab,
	);
	project.assignedLabs = effectiveLabs;
	if (effectiveLabs <= 0) return;
	const categoryMultiplier = getScientistMultiplier(scientist, def.category);
	const rpGain =
		BASE_RESEARCH_RATE * effectiveLabs * qualities.research * categoryMultiplier * simDtDays;
	project.progressRp += rpGain;
	colony.researchPoints += rpGain;

	ensureExperienceKey(scientist, def.category);
	scientist.experienceByCategory[def.category] += simDtDays * def.difficulty;
	const grown =
		scientist.categoryBonuses[def.category] + simDtDays * def.difficulty * CATEGORY_GROWTH_RATE;
	scientist.categoryBonuses[def.category] = clampBonus(grown);

	if (project.progressRp >= def.rpCost) {
		completeProject(project, scientist);
	}
}

export function getResearchDashboardRows(bodyName: string): ScientistDashboardRow[] {
	const rows: ScientistDashboardRow[] = [];
	for (const project of state.researchProjects.values()) {
		if (project.colonyBodyName !== bodyName) continue;
		const [lead] = project.leadScientistId ? getScientist(project.leadScientistId) : [null, false];
		rows.push({
			techId: project.techId,
			status: project.paused ? "paused" : "active",
			leadScientistId: project.leadScientistId,
			leadScientistName: lead?.name ?? "Unassigned",
			assignedLabs: project.assignedLabs,
			progressRp: project.progressRp,
			etaSimDay: estimateProjectEta(project),
		});
	}
	for (const scientist of getScientistsAtColony(bodyName)) {
		for (const techId of scientist.projectQueue) {
			rows.push({
				techId,
				status: "queued",
				leadScientistId: scientist.id,
				leadScientistName: scientist.name,
				assignedLabs: Math.min(scientist.assignedLabs, scientist.adminCap),
				progressRp: 0,
				etaSimDay: null,
			});
		}
	}
	return rows;
}

export function getDeadheadCapacityForShip(ship: ShipEntry): number {
	if (ship.crew.count < 10) return 0;
	return Math.min(Math.floor(ship.crew.count * 0.1), 20);
}

export function requestScientistTransfer(
	scientistId: string,
	destinationBodyName: string,
): boolean {
	const [scientist, found] = getScientist(scientistId);
	if (!found || scientist.colonyBodyName === destinationBodyName) return false;
	const [origin, originFound] = getColony(scientist.colonyBodyName);
	if (!originFound) return false;
	origin.transferQueue.push({
		id: `xfer-${transferCounter++}`,
		scientistId,
		originBodyName: scientist.colonyBodyName,
		destinationBodyName,
		requestedAt: state.simTime.days,
		status: "queued",
		estimatedArrivalDay: null,
		assignedShipName: null,
	});
	return true;
}

function routeTransferQueue(colony: ColonyState): void {
	if (colony.transferQueue.length === 0) return;
	const request = colony.transferQueue[0];
	if (request.status !== "queued") return;
	const ships = listShipsAtBody(colony.bodyName);
	const ship = ships.find((entry) => getDeadheadCapacityForShip(entry) > 0);
	if (!ship) return;
	request.status = "in-transit";
	request.assignedShipName = ship.data.name;
	request.estimatedArrivalDay = state.simTime.days + 3;
}

function settleTransfers(colony: ColonyState): void {
	while (colony.transferQueue.length > 0) {
		const first = colony.transferQueue[0];
		if (first.status !== "in-transit") break;
		if ((first.estimatedArrivalDay ?? Number.POSITIVE_INFINITY) > state.simTime.days) break;
		const [scientist, found] = getScientist(first.scientistId);
		if (found) {
			scientist.colonyBodyName = first.destinationBodyName;
			if (scientist.activeProjectTechId) {
				const [project, projectFound] = getProject(scientist.activeProjectTechId);
				if (projectFound) {
					project.paused = true;
					project.leadScientistId = null;
				}
				scientist.activeProjectTechId = null;
			}
			pushGameLog("Logistics", `Scientist transfer complete: ${scientist.name}`, {
				scientist: scientist.name,
				origin: first.originBodyName,
				destination: first.destinationBodyName,
				ship: first.assignedShipName,
			});
		}
		colony.transferQueue.shift();
	}
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
	scientistId?: string,
): void {
	const scientist =
		scientistId !== undefined
			? state.scientists.get(scientistId)
			: getScientistsAtColony(bodyName).find((entry) => entry.activeProjectTechId === null);
	if (!scientist) return;
	setScientistLabs(scientist.id, Math.max(0, assignedLabs));
	if (queue || scientist.activeProjectTechId !== null) {
		queueResearchProjectForScientist(scientist.id, techId);
		return;
	}
	queueResearchProjectForScientist(scientist.id, techId);
	maybeActivateNextProject(scientist);
}

export function cancelResearchProject(bodyName: string, techId: string): void {
	for (const scientist of getScientistsAtColony(bodyName)) {
		scientist.projectQueue = scientist.projectQueue.filter((queued) => queued !== techId);
		if (scientist.activeProjectTechId === techId) scientist.activeProjectTechId = null;
	}
	state.researchProjects.delete(techId);
}

export function setResearchLabs(
	bodyName: string,
	assignedLabs: number,
	scientistId?: string,
): void {
	const scientist =
		scientistId !== undefined
			? state.scientists.get(scientistId)
			: getScientistsAtColony(bodyName).find((entry) => entry.activeProjectTechId !== null);
	if (!scientist) return;
	setScientistLabs(scientist.id, assignedLabs);
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

function tickResearch(colony: ColonyState, simDtDays: number): void {
	for (const project of state.researchProjects.values()) {
		if (project.colonyBodyName !== colony.bodyName) continue;
		tickResearchProject(project, simDtDays);
	}
	for (const scientist of getScientistsAtColony(colony.bodyName)) {
		maybeActivateNextProject(scientist);
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
	tickResearch(colony, simDtDays);
	routeTransferQueue(colony);
	settleTransfers(colony);
}

export function tickColonies(simDtDays: number): void {
	for (const colony of state.colonies.values()) {
		tickColony(colony, simDtDays);
	}
}
