import { DIST_SCALE } from "../math/orbit";
import type {
	BodyEntry,
	ColonyConstructionProject,
	ColonyInstallationId,
	ColonyInstallations,
	ColonyProductionProject,
	ColonyQualities,
	ColonyResearchProject,
	ColonyState,
	ColonyWorkforce,
	GameLogCategory,
	PlanetEntry,
	Result,
	ScientistState,
	ShipEntry,
} from "../types";
import { isPlanetEntry, isSurveyable } from "../types";
import { findAsteroidEntity, findBody, listShipsAtBody } from "./entities";
import { addCoalescedNotification } from "./notifications";
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
let scientistCounter = 0;

// Per-colony project index — eliminates O(C×P) scan in tickResearch / checkColonyWarnings.
const _projectsByColony = new Map<string, Set<ColonyResearchProject>>();

function _indexAdd(project: ColonyResearchProject): void {
	let set = _projectsByColony.get(project.colonyBodyName);
	if (!set) {
		set = new Set();
		_projectsByColony.set(project.colonyBodyName, set);
	}
	set.add(project);
}

function _indexRemove(project: ColonyResearchProject): void {
	_projectsByColony.get(project.colonyBodyName)?.delete(project);
}

export function rebuildProjectIndex(): void {
	_projectsByColony.clear();
	for (const project of state.researchProjects.values()) {
		_indexAdd(project);
	}
}

export function getProjectsForColony(bodyName: string): Set<ColonyResearchProject> {
	return _projectsByColony.get(bodyName) ?? new Set();
}

type ResearchCategory = "industry" | "survey" | "logistics" | "research" | "biology" | "propulsion";

const RESEARCH_CATEGORIES: ResearchCategory[] = [
	"industry",
	"survey",
	"logistics",
	"research",
	"biology",
	"propulsion",
];

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

interface ConstructionDefinition {
	id: ColonyInstallationId;
	name: string;
	bpCost: number;
	description: string;
	resourceCost?: Record<string, number>;
}

interface ResearchDefinition {
	id: string;
	name: string;
	category: ResearchCategory;
	rpCost: number;
	difficulty: number;
	description: string;
	effectText: string;
	prerequisites: string[];
}

export const CONSTRUCTION_DEFS: ConstructionDefinition[] = [
	{
		id: "construction-factory",
		name: "Construction Factory",
		bpCost: 120,
		description: "Adds colony build capacity for new installations.",
		resourceCost: { iron: 500, copper: 150, aluminum: 100 },
	},
	{
		id: "mine",
		name: "Mine",
		bpCost: 80,
		description: "Extracts surveyed deposits into colony stockpiles.",
		resourceCost: { iron: 200, copper: 50 },
	},
	{
		id: "lab",
		name: "Research Lab",
		bpCost: 120,
		description: "Generates RP for colony-local research projects.",
		resourceCost: { iron: 400, copper: 200, silicon: 100 },
	},
	{
		id: "repair-yard",
		name: "Repair Yard",
		bpCost: 90,
		description: "Improves overhaul and refit throughput for ships in port.",
		resourceCost: { iron: 350, copper: 100, aluminum: 100 },
	},
	{
		id: "fuel-depot",
		name: "Fuel Depot",
		bpCost: 70,
		description: "Improves refueling throughput and expands local fuel handling.",
		resourceCost: { iron: 300, copper: 100, aluminum: 50 },
	},
	{
		id: "academy",
		name: "Academy",
		bpCost: 100,
		description: "Foundational training infrastructure for future officers and specialists.",
		resourceCost: { iron: 300, copper: 100 },
	},
	{
		id: "storage",
		name: "Storage",
		bpCost: 60,
		description: "Increases stockpile capacity and logistics slack.",
		resourceCost: { iron: 150, aluminum: 50 },
	},
	{
		id: "shipyard",
		name: "Shipyard",
		bpCost: 180,
		description:
			"Limited hull construction and refit capacity. Placeholder for future ship production.",
		resourceCost: { iron: 1000, copper: 300, aluminum: 200, silicon: 100 },
	},
];

interface ProductionDefinition {
	id: string;
	name: string;
	bpCost: number;
	description: string;
	resourceCost?: Record<string, number>;
}

export const PRODUCTION_DEFS: readonly ProductionDefinition[] = [
	{
		id: "flat-mine",
		name: "Automated Mine (flat-packed)",
		bpCost: 100,
		description: "Flat-packed automated mine for deployment at remote bodies.",
		resourceCost: { iron: 300, copper: 100, aluminum: 50 },
	},
	{
		id: "flat-mass-driver",
		name: "Mass Driver (flat-packed)",
		bpCost: 150,
		description: "Flat-packed mass driver for launching resources to other colonies.",
		resourceCost: { iron: 500, copper: 200, aluminum: 100, silicon: 50 },
	},
	{
		id: "flat-fuel-depot",
		name: "Fuel Depot (flat-packed)",
		bpCost: 80,
		description: "Flat-packed fuel depot for remote refueling.",
		resourceCost: { iron: 300, copper: 100, aluminum: 50 },
	},
];

export const RESEARCH_DEFS: ResearchDefinition[] = [
	// --- Survey ---
	{
		id: "survey-automation",
		name: "Survey Automation",
		category: "survey",
		rpCost: 120,
		difficulty: 1.1,
		description: "Refines mission-planning and scan interpretation routines.",
		effectText: "-15% survey duration",
		prerequisites: [],
	},
	{
		id: "advanced-telemetry",
		name: "Advanced Telemetry",
		category: "survey",
		rpCost: 250,
		difficulty: 1.2,
		description:
			"Higher-fidelity sensor arrays and real-time data compression improve scan resolution.",
		effectText: "-20% survey duration. Unlocks level-2 deposit detection.",
		prerequisites: ["survey-automation"],
	},
	{
		id: "predictive-analysis",
		name: "Predictive Analysis",
		category: "survey",
		rpCost: 500,
		difficulty: 1.35,
		description:
			"Statistical modelling of geological strata lets survey crews target deposits proactively.",
		effectText: "+30% chance of eureka breakthrough on survey completion.",
		prerequisites: ["advanced-telemetry"],
	},
	{
		id: "deep-scan-array",
		name: "Deep Scan Array",
		category: "survey",
		rpCost: 1000,
		difficulty: 1.5,
		description: "Penetrating gravimetric sensors capable of mapping deep subsurface structure.",
		effectText: "Unlocks level-3 deposit detection. -25% survey duration.",
		prerequisites: ["predictive-analysis"],
	},
	// --- Industry ---
	{
		id: "mining-drills",
		name: "Improved Mining Drills",
		category: "industry",
		rpCost: 120,
		difficulty: 1.2,
		description: "Better extraction tooling and haul discipline for frontier colonies.",
		effectText: "+25% mine output",
		prerequisites: [],
	},
	{
		id: "fabrication-methods",
		name: "Fabrication Methods",
		category: "industry",
		rpCost: 160,
		difficulty: 1.4,
		description: "Improves construction planning and line efficiency for installation builds.",
		effectText: "+25% construction BP",
		prerequisites: ["mining-drills"],
	},
	{
		id: "advanced-metallurgy",
		name: "Advanced Metallurgy",
		category: "industry",
		rpCost: 500,
		difficulty: 1.45,
		description:
			"High-temperature alloy processing and vacuum casting unlock superior structural materials.",
		effectText: "+20% mine output. Unlocks advanced ship hull components.",
		prerequisites: ["fabrication-methods"],
	},
	{
		id: "nano-manufacturing",
		name: "Nano-Manufacturing",
		category: "industry",
		rpCost: 1000,
		difficulty: 1.6,
		description: "Molecular-scale assembly lines produce components with near-zero tolerance error.",
		effectText: "+30% construction BP. -20% component mass for manufactured ship parts.",
		prerequisites: ["advanced-metallurgy"],
	},
	// --- Logistics ---
	{
		id: "maintenance-doctrine",
		name: "Maintenance Doctrine",
		category: "logistics",
		rpCost: 140,
		difficulty: 1.3,
		description: "Standardized service routines for yard crews and depot handling.",
		effectText: "+15% repair/refuel quality",
		prerequisites: [],
	},
	{
		id: "supply-optimization",
		name: "Supply Optimization",
		category: "logistics",
		rpCost: 250,
		difficulty: 1.35,
		description:
			"Inventory forecasting and route compression reduce waste across the logistics chain.",
		effectText: "-20% supply consumption rate. +10% refuel quality.",
		prerequisites: ["maintenance-doctrine"],
	},
	{
		id: "fleet-logistics",
		name: "Fleet Logistics",
		category: "logistics",
		rpCost: 500,
		difficulty: 1.4,
		description: "Multi-ship resupply coordination and underway replenishment protocols.",
		effectText: "+15% overhaul quality.",
		prerequisites: ["supply-optimization"],
	},
	{
		id: "rapid-refit",
		name: "Rapid Refit",
		category: "logistics",
		rpCost: 1000,
		difficulty: 1.5,
		description: "Modular ship architecture and pre-staged component bundles cut major refit time.",
		effectText: "-40% major refit duration. Hull ceiling degradation rate -25%.",
		prerequisites: ["fleet-logistics"],
	},
	// --- Research ---
	{
		id: "lab-instrumentation",
		name: "Lab Instrumentation",
		category: "research",
		rpCost: 150,
		difficulty: 1.35,
		description: "Denser instrumentation packages for better throughput per active lab.",
		effectText: "+20% research output per lab",
		prerequisites: [],
	},
	{
		id: "sensor-theory",
		name: "Sensor Theory",
		category: "research",
		rpCost: 250,
		difficulty: 1.4,
		description: "Unified mathematical framework for passive and active sensor interpretation.",
		effectText: "+15% research output. Prerequisite for advanced survey sensors.",
		prerequisites: ["lab-instrumentation"],
	},
	{
		id: "applied-physics",
		name: "Applied Physics",
		category: "research",
		rpCost: 500,
		difficulty: 1.45,
		description:
			"Practical derivations from theoretical physics yield breakthroughs in materials and propulsion.",
		effectText: "+20% research output.",
		prerequisites: ["sensor-theory"],
	},
	{
		id: "unified-field-theory",
		name: "Unified Field Theory",
		category: "research",
		rpCost: 1000,
		difficulty: 1.6,
		description:
			"A coherent model of fundamental forces enables a new generation of energy and propulsion systems.",
		effectText: "+30% research output.",
		prerequisites: ["applied-physics"],
	},
	// --- Biology ---
	{
		id: "basic-hydroponics",
		name: "Basic Hydroponics",
		category: "biology",
		rpCost: 120,
		difficulty: 1.15,
		description:
			"Closed-cycle nutrient delivery and growth lighting for food production in any environment.",
		effectText: "Unlocks hydroponics installation. Colony food production enables population growth.",
		prerequisites: [],
	},
	{
		id: "genetic-medicine",
		name: "Genetic Medicine",
		category: "biology",
		rpCost: 250,
		difficulty: 1.3,
		description: "Targeted gene therapies and population health monitoring improve colony longevity.",
		effectText: "+15% population growth rate. Scientist and officer career lengths extended.",
		prerequisites: ["basic-hydroponics"],
	},
	{
		id: "closed-cycle-life-support",
		name: "Closed-Cycle Life Support",
		category: "biology",
		rpCost: 250,
		difficulty: 1.3,
		description:
			"Atmospheric recycling and water reclamation reduce crew supply requirements on long deployments.",
		effectText: "-20% ship supply consumption rate. Extended crew endurance.",
		prerequisites: ["basic-hydroponics"],
	},
	{
		id: "xenobiology",
		name: "Xenobiology",
		category: "biology",
		rpCost: 500,
		difficulty: 1.45,
		description:
			"Study of non-terrestrial biochemistry and atmospheric chemistry enables biosphere classification.",
		effectText: "Prerequisite for terraforming. Unlocks habitability assessment surveys.",
		prerequisites: ["genetic-medicine", "closed-cycle-life-support"],
	},
	{
		id: "terraforming",
		name: "Terraforming",
		category: "biology",
		rpCost: 1000,
		difficulty: 1.6,
		description:
			"Long-duration atmospheric seeding, ice delivery, and microorganism introduction can transform a hostile world over decades.",
		effectText: "Unlocks terraforming colony projects. Habitability modification rate: +0.001/year.",
		prerequisites: ["xenobiology"],
	},
	// --- Propulsion ---
	{
		id: "nuclear-pulse-engine",
		name: "Nuclear Pulse Engine",
		category: "propulsion",
		rpCost: 200,
		difficulty: 1.2,
		description:
			"Directional nuclear detonations against a pusher plate. Extreme thrust, very poor efficiency.",
		effectText: "Unlocks Nuclear Pulse engine tier.",
		prerequisites: [],
	},
	{
		id: "ion-drive",
		name: "Ion Drive",
		category: "propulsion",
		rpCost: 300,
		difficulty: 1.3,
		description: "Electrostatic ion acceleration. Extremely fuel-efficient but very low thrust.",
		effectText: "Unlocks Ion Drive engine tier.",
		prerequisites: [],
	},
	{
		id: "magneto-drive",
		name: "Magnetospheric Drive",
		category: "propulsion",
		rpCost: 500,
		difficulty: 1.4,
		description:
			"Uses fusion reactor magnetic field to accelerate solar wind plasma. Near-zero fuel in inner system.",
		effectText: "Unlocks Magnetospheric Drive engine tier.",
		prerequisites: ["ion-drive"],
	},
	{
		id: "icf-drive",
		name: "ICF Drive",
		category: "propulsion",
		rpCost: 500,
		difficulty: 1.4,
		description:
			"Fusion pellet detonations for thrust. First engine competitive on both thrust and efficiency.",
		effectText: "Unlocks ICF Drive engine tier.",
		prerequisites: ["nuclear-pulse-engine"],
	},
	{
		id: "mcf-drive",
		name: "MCF Drive",
		category: "propulsion",
		rpCost: 800,
		difficulty: 1.5,
		description: "Sustained fusion exhaust via magnetic nozzle. Best all-rounder in fusion era.",
		effectText: "Unlocks MCF Drive engine tier.",
		prerequisites: ["icf-drive"],
	},
	{
		id: "plasma-drive",
		name: "Plasma Drive",
		category: "propulsion",
		rpCost: 1200,
		difficulty: 1.6,
		description:
			"TN field-shaped plasma exhaust. Step change in efficiency over conventional drives.",
		effectText: "Unlocks Plasma Drive engine tier.",
		prerequisites: ["mcf-drive"],
	},
	{
		id: "am-solid-drive",
		name: "AM Solid-Core Drive",
		category: "propulsion",
		rpCost: 2000,
		difficulty: 1.7,
		description: "Antimatter heats solid-core heat exchanger. Reliable antimatter propulsion.",
		effectText: "Unlocks AM Solid-Core Drive engine tier.",
		prerequisites: ["plasma-drive"],
	},
	{
		id: "am-gas-drive",
		name: "AM Gas-Core Drive",
		category: "propulsion",
		rpCost: 3000,
		difficulty: 1.8,
		description:
			"Antihydrogen annihilates in gaseous uranium core. Very hot, high thermal signature.",
		effectText: "Unlocks AM Gas-Core Drive engine tier.",
		prerequisites: ["am-solid-drive"],
	},
	{
		id: "am-plasma-drive",
		name: "AM Plasma-Core Drive",
		category: "propulsion",
		rpCost: 4000,
		difficulty: 1.9,
		description:
			"Direct plasma exhaust from matter-antimatter annihilation. Fastest engine in the game.",
		effectText: "Unlocks AM Plasma-Core Drive engine tier.",
		prerequisites: ["am-gas-drive"],
	},
	{
		id: "am-beam-drive",
		name: "AM Beam-Core Drive",
		category: "propulsion",
		rpCost: 3500,
		difficulty: 1.85,
		description: "Charged pion beam exhaust. Maximum propulsive efficiency, moderate thrust.",
		effectText: "Unlocks AM Beam-Core Drive engine tier.",
		prerequisites: ["am-plasma-drive"],
	},
	{
		id: "gravity-drive",
		name: "Gravity Drive",
		category: "propulsion",
		rpCost: 5000,
		difficulty: 2.0,
		description: "TN field spacetime gradient manipulation. No propellant, no exhaust signature.",
		effectText: "Unlocks Gravity Drive engine tier.",
		prerequisites: ["plasma-drive"],
	},
	{
		id: "photonic-drive",
		name: "Photonic Drive",
		category: "propulsion",
		rpCost: 8000,
		difficulty: 2.2,
		description: "Pure photon exhaust powered by vacuum energy. No fuel, infinite endurance.",
		effectText: "Unlocks Photonic Drive engine tier. Capstone propulsion.",
		prerequisites: ["am-beam-drive", "gravity-drive"],
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

function formatSimDate(simDay: number): string {
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
			flatPacked: {},
		},
		researchPoints: 0,
		constructionProjects: [],
		productionProjects: [],
		transferQueue: [],
	};
}

function seedInitialScientistsAtColony(bodyName: string, count: number): void {
	for (let i = 0; i < count; i++) {
		const primary = pickCategory();
		let secondary = pickCategory();
		if (secondary === primary)
			secondary =
				RESEARCH_CATEGORIES[(RESEARCH_CATEGORIES.indexOf(primary) + 1) % RESEARCH_CATEGORIES.length];
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

function getScientist(scientistId: string): Result<ScientistState> {
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
	for (const prereq of def.prerequisites) {
		if (!state.researchedTechs.has(prereq)) return false;
	}
	const [colony, colonyFound] = getColony(scientist.colonyBodyName);
	if (!colonyFound || colony.installations.lab <= 0) return false;
	const [existing, existingFound] = getProject(def.id);
	if (!existingFound) return true;
	if (existing.leadScientistId === scientist.id) return false;
	return existing.leadScientistId === null;
}

export function canResearchTech(techId: string): boolean {
	const [def, found] = getResearchDef(techId);
	if (!found) return false;
	if (state.researchedTechs.has(techId)) return false;
	return def.prerequisites.every((p) => state.researchedTechs.has(p));
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
			const newProject: ColonyResearchProject = {
				techId: nextTechId,
				colonyBodyName: scientist.colonyBodyName,
				leadScientistId: scientist.id,
				assignedLabs: Math.min(scientist.assignedLabs, scientist.adminCap),
				progressRp: 0,
				paused: false,
				queuedAt: state.simTime.days,
				startedAt: state.simTime.days,
				difficulty: def?.difficulty ?? 1,
			};
			state.researchProjects.set(nextTechId, newProject);
			_indexAdd(newProject);
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

export function removeFromScientistQueue(scientistId: string, techId: string): boolean {
	const [scientist, found] = getScientist(scientistId);
	if (!found) return false;
	const idx = scientist.projectQueue.indexOf(techId);
	if (idx === -1) return false;
	scientist.projectQueue.splice(idx, 1);
	return true;
}

export function cancelResearchProject(techId: string): boolean {
	const project = state.researchProjects.get(techId);
	if (project) {
		state.researchProjects.delete(techId);
		_indexRemove(project);
		if (project.leadScientistId) {
			const scientist = state.scientists.get(project.leadScientistId);
			if (scientist && scientist.activeProjectTechId === techId) {
				scientist.activeProjectTechId = null;
				maybeActivateNextProject(scientist);
			}
		}
	}
	// Also remove from all scientist queues so the tech returns to available
	for (const scientist of state.scientists.values()) {
		const idx = scientist.projectQueue.indexOf(techId);
		if (idx !== -1) scientist.projectQueue.splice(idx, 1);
	}
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

function completeProject(project: ColonyResearchProject, scientist: ScientistState): void {
	state.researchedTechs.add(project.techId);
	state.researchProjects.delete(project.techId);
	_indexRemove(project);
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
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("research-state-changed"));
	}
}

/** Pure calculation: compute research progress for one tick. */
export function computeResearchProgress(
	effectiveLabs: number,
	researchQuality: number,
	categoryMultiplier: number,
	difficulty: number,
	simDtDays: number,
): { rpGain: number; experienceGain: number; bonusGrowth: number } {
	const rpGain =
		BASE_RESEARCH_RATE * effectiveLabs * researchQuality * categoryMultiplier * simDtDays;
	const experienceGain = simDtDays * difficulty;
	const bonusGrowth = simDtDays * difficulty * CATEGORY_GROWTH_RATE;
	return { rpGain, experienceGain, bonusGrowth };
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
	const progress = computeResearchProgress(
		effectiveLabs,
		qualities.research,
		categoryMultiplier,
		def.difficulty,
		simDtDays,
	);
	project.progressRp += progress.rpGain;
	colony.researchPoints += progress.rpGain;

	ensureExperienceKey(scientist, def.category);
	scientist.experienceByCategory[def.category] += progress.experienceGain;
	const grown = scientist.categoryBonuses[def.category] + progress.bonusGrowth;
	scientist.categoryBonuses[def.category] = clampBonus(grown);

	if (project.progressRp >= def.rpCost) {
		completeProject(project, scientist);
	}
}

function getDeadheadCapacityForShip(ship: ShipEntry): number {
	if (ship.crew.count < 10) return 0;
	return Math.min(Math.floor(ship.crew.count * 0.1), 20);
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

function getEmpireTechBonuses(): {
	survey: number;
	mining: number;
	repair: number;
	refuel: number;
	research: number;
	construction: number;
} {
	return {
		survey:
			(state.researchedTechs.has("survey-automation") ? 1.15 : 1) *
			(state.researchedTechs.has("advanced-telemetry") ? 1.2 : 1) *
			(state.researchedTechs.has("deep-scan-array") ? 1.25 : 1),
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

export function canAffordConstruction(
	colony: ColonyState,
	installationId: ColonyInstallationId,
): boolean {
	const def = getConstructionDef(installationId);
	if (!def.resourceCost) return true;
	for (const [resourceId, amount] of Object.entries(def.resourceCost)) {
		if ((colony.stockpile.resources[resourceId] ?? 0) < amount) return false;
	}
	return true;
}

function deductConstructionResources(colony: ColonyState, def: ConstructionDefinition): void {
	if (!def.resourceCost) return;
	for (const [resourceId, amount] of Object.entries(def.resourceCost)) {
		colony.stockpile.resources[resourceId] = (colony.stockpile.resources[resourceId] ?? 0) - amount;
	}
}

function getColonyQualitiesAtBody(bodyName: string): Result<ColonyQualities> {
	const [colony, found] = getColony(bodyName);
	return found ? ok(computeColonyQualities(colony)) : err();
}

export function getColonyBuildPointsPerDay(colony: ColonyState): number {
	const qualities = computeColonyQualities(colony);
	return (
		BASE_CONSTRUCTION_BP_RATE * colony.installations.constructionFactory * qualities.construction
	);
}

export function getConstructionProjectEtaDays(
	project: ColonyConstructionProject,
	bpPerDay: number,
	totalAllocationPct: number,
): number | null {
	if (project.paused || bpPerDay <= 0 || project.allocationPct <= 0) return null;
	const def = getConstructionDef(project.installationId);
	const effectiveRate = bpPerDay * (project.allocationPct / Math.max(totalAllocationPct, 100));
	if (effectiveRate <= 0) return null;
	const bpRemaining = project.quantityRemaining * def.bpCost - project.progressBp;
	return bpRemaining / effectiveRate;
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

export function getProductionProjectEtaDays(
	project: ColonyProductionProject,
	bpPerDay: number,
	totalAllocationPct: number,
): number | null {
	if (project.paused || bpPerDay <= 0 || project.allocationPct <= 0) return null;
	const def = getProductionDef(project.itemId);
	if (!def) return null;
	const effectiveRate = bpPerDay * (project.allocationPct / Math.max(totalAllocationPct, 100));
	if (effectiveRate <= 0) return null;
	const bpRemaining = project.quantityRemaining * def.bpCost - project.progressBp;
	return bpRemaining / effectiveRate;
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

export function getProductionDef(itemId: string): ProductionDefinition | undefined {
	return PRODUCTION_DEFS.find((d) => d.id === itemId);
}

export function canAffordProduction(colony: ColonyState, itemId: string): boolean {
	const def = getProductionDef(itemId);
	if (!def?.resourceCost) return true;
	for (const [resourceId, amount] of Object.entries(def.resourceCost)) {
		if ((colony.stockpile.resources[resourceId] ?? 0) < amount) return false;
	}
	return true;
}

export function getProductionBpPerDay(colony: ColonyState): number {
	const qualities = computeColonyQualities(colony);
	return (
		BASE_CONSTRUCTION_BP_RATE * colony.installations.constructionFactory * qualities.construction
	);
}

export function addProductionProject(
	colony: ColonyState,
	itemId: string,
	quantity: number,
	allocationPct: number,
): ColonyProductionProject | null {
	if (!getProductionDef(itemId) || quantity <= 0 || allocationPct <= 0) return null;
	const project: ColonyProductionProject = {
		id: `prod-${projectCounter++}`,
		itemId,
		quantityRemaining: quantity,
		totalQuantity: quantity,
		allocationPct,
		progressBp: 0,
		paused: false,
	};
	colony.productionProjects.push(project);
	return project;
}

export function pauseProductionProject(colony: ColonyState, projectId: string): void {
	const project = colony.productionProjects.find((p) => p.id === projectId);
	if (!project) return;
	project.paused = !project.paused;
}

export function cancelProductionProject(colony: ColonyState, projectId: string): void {
	colony.productionProjects = colony.productionProjects.filter((p) => p.id !== projectId);
}

function completeProductionUnit(
	colony: ColonyState,
	project: ColonyProductionProject,
	def: ProductionDefinition,
): void {
	project.progressBp -= def.bpCost;
	if (def.resourceCost) {
		for (const [resourceId, amount] of Object.entries(def.resourceCost)) {
			colony.stockpile.resources[resourceId] = (colony.stockpile.resources[resourceId] ?? 0) - amount;
		}
	}
	colony.stockpile.flatPacked[project.itemId] =
		(colony.stockpile.flatPacked[project.itemId] ?? 0) + 1;
	project.quantityRemaining--;
}

function tickProductionProject(
	colony: ColonyState,
	project: ColonyProductionProject,
	totalBp: number,
	totalAllocation: number,
): void {
	const def = getProductionDef(project.itemId);
	if (!def) return;
	project.progressBp += totalBp * (project.allocationPct / totalAllocation);
	while (project.quantityRemaining > 0 && project.progressBp >= def.bpCost) {
		if (!canAffordProduction(colony, project.itemId)) break;
		completeProductionUnit(colony, project, def);
	}
}

function tickProduction(colony: ColonyState, simDtDays: number, qualities: ColonyQualities): void {
	if (!colony.productionProjects) return;
	const activeProjects = colony.productionProjects.filter((p) => !p.paused);
	if (activeProjects.length === 0 || colony.installations.constructionFactory <= 0) return;

	const totalAllocation = activeProjects.reduce((sum, p) => sum + p.allocationPct, 0);
	if (totalAllocation <= 0) return;

	const totalBp =
		BASE_CONSTRUCTION_BP_RATE *
		colony.installations.constructionFactory *
		qualities.construction *
		simDtDays;

	for (const project of activeProjects) {
		tickProductionProject(colony, project, totalBp, totalAllocation);
	}

	colony.productionProjects = colony.productionProjects.filter((p) => p.quantityRemaining > 0);
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
	for (const project of getProjectsForColony(colony.bodyName)) {
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
			if (!canAffordConstruction(colony, project.installationId)) break;
			project.progressBp -= def.bpCost;
			deductConstructionResources(colony, def);
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

const WARNING_INTERVAL_DAYS = 30;
const lastWarningDay = new Map<string, number>();

function shouldWarn(key: string): boolean {
	const last = lastWarningDay.get(key) ?? -Infinity;
	if (state.simTime.days - last < WARNING_INTERVAL_DAYS) return false;
	lastWarningDay.set(key, state.simTime.days);
	return true;
}

export function resetColonyWarningState(): void {
	lastWarningDay.clear();
}

function checkColonyWarnings(colony: ColonyState, qualities: ColonyQualities): void {
	if (qualities.staffingRatio < 0.5 && shouldWarn(`${colony.bodyName}:understaffed`)) {
		addCoalescedNotification(
			"colony-understaffed",
			`${colony.name}: severe understaffing (${Math.round(qualities.staffingRatio * 100)}%)`,
			colony.bodyName,
			5000,
		);
	}

	const activeConstruction = colony.constructionProjects.some((p) => !p.paused);
	if (
		colony.installations.constructionFactory > 0 &&
		!activeConstruction &&
		shouldWarn(`${colony.bodyName}:idle-factory`)
	) {
		addCoalescedNotification(
			"colony-idle",
			`${colony.name}: construction factories idle`,
			colony.bodyName,
			5000,
		);
	}

	let hasActiveResearch = false;
	for (const p of getProjectsForColony(colony.bodyName)) {
		if (!p.paused) {
			hasActiveResearch = true;
			break;
		}
	}
	if (
		colony.installations.lab > 0 &&
		!hasActiveResearch &&
		shouldWarn(`${colony.bodyName}:idle-lab`)
	) {
		addCoalescedNotification(
			"colony-idle",
			`${colony.name}: research labs idle`,
			colony.bodyName,
			5000,
		);
	}

	const blockedProject = colony.constructionProjects.find((p) => {
		if (p.paused) return false;
		const def = getConstructionDef(p.installationId);
		return (
			p.progressBp >= def.bpCost &&
			def.resourceCost &&
			!canAffordConstruction(colony, p.installationId)
		);
	});
	if (blockedProject && shouldWarn(`${colony.bodyName}:blocked`)) {
		const def = getConstructionDef(blockedProject.installationId);
		addCoalescedNotification(
			"colony-blocked",
			`${colony.name}: ${def.name} blocked — insufficient resources`,
			colony.bodyName,
			5000,
		);
	}
}

const EARTH_FUEL_RESTOCK_PER_DAY = 5_000; // kg/day placeholder until production chains

export function tickColony(colony: ColonyState, simDtDays: number): void {
	// Placeholder: Earth has unlimited fuel production for early-game debugging
	if (colony.bodyName === "Earth") {
		colony.stockpile.fuelKg += EARTH_FUEL_RESTOCK_PER_DAY * simDtDays;
	}
	const qualities = computeColonyQualities(colony);
	tickConstruction(colony, simDtDays, qualities);
	tickProduction(colony, simDtDays, qualities);
	tickMining(colony, simDtDays, qualities);
	tickResearch(colony, simDtDays);
	routeTransferQueue(colony);
	settleTransfers(colony);
	checkColonyWarnings(colony, qualities);
}

export function tickColonies(simDtDays: number): void {
	for (const colony of state.colonies.values()) {
		tickColony(colony, simDtDays);
	}
}
