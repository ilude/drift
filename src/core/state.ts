import type {
	AppState,
	CategoryKey,
	CategoryVisibility,
	ColonyState,
	SavedShipData,
	SavedStateData,
	ShipEntry,
} from "../types";
import { isShipEntry } from "../types";
import { GameClock } from "./game-clock";

export const MAX_CLICK_DIST = 50;

// Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow)
const SIM_EPOCH: Date = new Date(2038, 0, 20);

export function simTimeToDate(simTime: number): Date {
	const ms = simTime * 86400000;
	return new Date(SIM_EPOCH.getTime() + ms);
}

export function truncateDate(date: Date, speed: number): Date {
	if (speed >= 30) {
		date.setDate(1);
		date.setHours(0, 0, 0, 0);
	} else if (speed >= 8 / 24) {
		date.setHours(0, 0, 0, 0);
	} else if (speed >= 1 / 24) {
		date.setMinutes(0, 0, 0);
	} else if (speed >= 2 / 1440) {
		date.setSeconds(0, 0);
	}
	return date;
}

export function formatDateTime(date: Date): string {
	const y = date.getFullYear();
	const mo = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const h = String(date.getHours()).padStart(2, "0");
	const mi = String(date.getMinutes()).padStart(2, "0");
	const s = String(date.getSeconds()).padStart(2, "0");
	return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/** Log with in-game datetime prefix. */
export function gameLog(...args: unknown[]): void {
	console.log(`[${state.simTime.formatDateTime()}]`, ...args);
}

/** Warn with in-game datetime prefix. */
export function gameWarn(...args: unknown[]): void {
	console.warn(`[${state.simTime.formatDateTime()}]`, ...args);
}

export function speedLabel(timeSpeed: number): string {
	if (timeSpeed === 0) return "Paused";
	if (timeSpeed < 1) return `${Math.round(timeSpeed * 24)} hrs / sec`;
	if (timeSpeed < 30) return `${timeSpeed} day${timeSpeed === 1 ? "" : "s"} / sec`;
	return `${Math.round(timeSpeed / 30)} month${timeSpeed < 60 ? "" : "s"} / sec`;
}

export const MASTER_SEED: number = 42;
const SAVE_KEY = "solar-sim-state";
const SAVE_VERSION = 10;

export const state: AppState = {
	bodyMeshes: [],
	asteroidBelts: [],
	selectedBody: null,
	flyTo: null,
	simTime: new GameClock(0),
	timeSpeed: 1,
	backgroundSim: false,
	currentSystemKey: "sol",
	discoveredSystems: new Map(),
	masterRng: null,
	randomClickCount: 0,
	BODIES: null,
	COMETS: null,
	ASTEROID_BELTS: null,
	categoryVisibility: Object.fromEntries(
		(
			[
				"Star",
				"Planet",
				"Dwarf Planet",
				"Centaur",
				"Moon",
				"Comet",
				"Asteroid",
				"Ship",
			] as CategoryKey[]
		).map((k) => [
			k,
			{
				labels: true,
				orbits: k !== "Comet" && k !== "Dwarf Planet" && k !== "Centaur" && k !== "Asteroid",
				trails:
					k === "Comet" || k === "Dwarf Planet" || k === "Centaur" || k === "Asteroid" || k === "Ship",
			},
		]),
	) as Record<CategoryKey, CategoryVisibility>,
	debugStepFrames: 0,
	debugStepSpeed: 0,
	renderNeeded: true,
	surveyMultiplier: 0.1,
	repairMultiplier: 1,
	refuelMultiplier: 1,
	moraleMultiplier: 1,
	supplyMultiplier: 1,
	fuelBurnMultiplier: 1,
	depotQuality: 1,
	shipIntents: new Map(),
	colonies: new Map(),
	scientists: new Map(),
	researchProjects: new Map(),
	gameLog: [],
	researchedTechs: new Set(),
	notifications: [],
	notificationPauseConfig: {
		info: false,
		"survey-complete": false,
		"low-fuel": false,
		"low-morale": false,
		"maintenance-needed": false,
		"mission-complete": true,
		malfunction: true,
		"ship-destroyed": true,
		"transfer-complete": false,
		"action-complete": false,
		"colony-understaffed": false,
		"colony-idle": false,
		"colony-blocked": false,
		"colony-low-supplies": false,
		"ship-built": false,
		"scientist-graduated": false,
	},
	firstSurveyCompleted: false,
	surveyedCount: 0,
	totalSurveyableCount: 0,
	engineDesigns: new Map(),
	shipDesigns: new Map(),
	missileDesigns: new Map(),
	turretDesigns: new Map(),
	sensorDesigns: new Map(),
	designCounter: 0,
};

export function saveState(): void {
	const systems: Array<{ key: string; name: string; seed: number }> = [];
	state.discoveredSystems.forEach((sys, key) => {
		if (key === "sol") return;
		systems.push({ key, name: sys.name, seed: sys.seed as number });
	});
	const ships: SavedShipData[] = state.bodyMeshes.filter(isShipEntry).map((ship) => ({
		name: ship.data.name,
		hostPlanetName: ship.hostPlanetName,
		keelDate: ship.keelDate,
		fuelKg: ship.fuelKg,
		engineId: ship.engineId,
		crew: { ...ship.crew },
		commander: { ...ship.commander },
		maintenance: { ...ship.maintenance },
		commandTree: { entries: [...ship.commandTree.entries] },
		cargoHold: { ...(ship.cargoHold ?? {}) },
		missionOrders: (ship.missionOrders ?? []).map((s) => ({ ...s })),
		missionOrderIndex: ship.missionOrderIndex ?? 0,
		...(ship.surveyPlan
			? {
					surveyPlan: {
						targets: [...ship.surveyPlan.targets],
						accelG: ship.surveyPlan.accelG,
						returnFuelKg: ship.surveyPlan.returnFuelKg,
					},
				}
			: {}),
		...(ship.shipState === "transferring"
			? {
					shipState: ship.shipState,
					transferTarget: ship.transferTarget ?? undefined,
					transferStartTime: ship.transferStartTime,
					transferTimeDays: ship.transferTimeDays,
					transferFuelTotal: ship.transferFuelTotal,
					p0x: ship.p0x,
					p0y: ship.p0y,
					p0z: ship.p0z,
					t0x: ship.t0x,
					t0y: ship.t0y,
					t0z: ship.t0z,
					p1x: ship.p1x,
					p1y: ship.p1y,
					p1z: ship.p1z,
					t1x: ship.t1x,
					t1y: ship.t1y,
					t1z: ship.t1z,
				}
			: {}),
	}));

	const data: SavedStateData = {
		version: SAVE_VERSION,
		simTime: state.simTime.days,
		currentSystemKey: state.currentSystemKey,
		randomClickCount: state.randomClickCount,
		discoveredSystems: systems,
		ships,
		colonies: Array.from(state.colonies.values()).map((colony) => ({
			...colony,
			installations: { ...colony.installations },
			stockpile: {
				fuelKg: colony.stockpile.fuelKg,
				supplies: colony.stockpile.supplies,
				resources: { ...colony.stockpile.resources },
				flatPacked: { ...colony.stockpile.flatPacked },
			},
			constructionProjects: (colony.constructionProjects ?? []).map((project) => ({ ...project })),
			productionProjects: (colony.productionProjects ?? []).map((project) => ({ ...project })),
			shipbuildProjects: (colony.shipbuildProjects ?? []).map((project) => ({
				...project,
				resourceCost: { ...project.resourceCost },
			})),
			transferQueue: (colony.transferQueue ?? []).map((request) => ({ ...request })),
		})),
		scientists: Array.from(state.scientists.values()).map((scientist) => ({
			...scientist,
			projectQueue: [...scientist.projectQueue],
			categoryBonuses: { ...scientist.categoryBonuses },
			completedProjects: [...scientist.completedProjects],
			experienceByCategory: { ...scientist.experienceByCategory },
		})),
		researchProjects: Array.from(state.researchProjects.values()).map((project) => ({ ...project })),
		gameLog: state.gameLog.map((entry) => ({
			...entry,
			meta: entry.meta ? { ...entry.meta } : undefined,
		})),
		researchedTechs: Array.from(state.researchedTechs.values()),
		engineDesigns: Array.from(state.engineDesigns.values()),
		shipDesigns: Array.from(state.shipDesigns.values()).map((d) => ({
			...d,
			components: [...d.components],
		})),
		designCounter: state.designCounter,
		missileDesigns: Array.from(state.missileDesigns.values()),
		turretDesigns: Array.from(state.turretDesigns.values()),
		sensorDesigns: Array.from(state.sensorDesigns.values()),
	};
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify(data));
	} catch (_) {
		/* storage full or unavailable */
	}
}

function migrateShipsV5(ships: SavedStateData["ships"]): void {
	for (const ship of ships) {
		const m = ship.maintenance as unknown as Record<string, unknown>;
		if (m.totalAge === undefined) m.totalAge = m.age;
		if (m.lastRefitAge === undefined) m.lastRefitAge = 0;
	}
}

function migrateColoniesV8(colonies: SavedStateData["colonies"]): void {
	for (const colony of colonies ?? []) {
		const s = colony.stockpile as unknown as Record<string, unknown>;
		if (!s.flatPacked) s.flatPacked = {};
		const c = colony as unknown as Record<string, unknown>;
		if (!c.productionProjects) c.productionProjects = [];
	}
}

function migrateColoniesV9(colonies: SavedStateData["colonies"]): void {
	for (const colony of colonies ?? []) {
		const c = colony as unknown as Record<string, unknown>;
		if (!c.shipbuildProjects) c.shipbuildProjects = [];
	}
}

function migrateVersionedState(migrated: SavedStateData): SavedStateData {
	if (migrated.version === 4) migrated.version = 5;
	if (migrated.version === 5) {
		migrateShipsV5(migrated.ships);
		migrated.version = 6;
	}
	if (migrated.version === 6) migrated.version = 7;
	if (migrated.version === 7) migrated.version = 8;
	if (migrated.version === 8) {
		migrateColoniesV8(migrated.colonies);
		migrated.version = 9;
	}
	if (migrated.version === 9) {
		migrateColoniesV9(migrated.colonies);
		migrated.version = 10;
	}
	return migrated;
}

function migrateSavedState(data: SavedStateData | Record<string, unknown>): SavedStateData | null {
	if ((data as Record<string, unknown>).version === 3 && (data as Record<string, unknown>).ship) {
		return {
			...(data as SavedStateData),
			version: 4,
			ships: [
				{
					name: "ISS Explorer",
					hostPlanetName: "Earth",
					...(((data as Record<string, unknown>).ship as object) ?? {}),
				},
			],
		} as SavedStateData;
	}

	const migrated = migrateVersionedState(data as SavedStateData);
	return migrated.version === SAVE_VERSION ? migrated : null;
}

export function loadSavedState(): SavedStateData | null {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		return migrateSavedState(JSON.parse(raw) as SavedStateData);
	} catch (_) {
		return null;
	}
}

function restoreShipFields(ship: ShipEntry, saved: SavedShipData): void {
	ship.keelDate = saved.keelDate ?? 0;
	ship.fuelKg = saved.fuelKg;
	ship.engineId = saved.engineId;
	if (saved.crew) ship.crew = saved.crew;
	if (saved.maintenance) {
		ship.maintenance = saved.maintenance;
		// Ensure new fields exist (forward compat)
		ship.maintenance.totalAge ??= ship.maintenance.age;
		ship.maintenance.lastRefitAge ??= 0;
	}
	if (saved.commandTree) ship.commandTree = saved.commandTree;
	if (saved.commander) ship.commander = saved.commander;
	if (saved.surveyPlan) {
		ship.surveyPlan = { ...saved.surveyPlan, returnFuelKg: saved.surveyPlan.returnFuelKg ?? 0 };
	} else {
		ship.surveyPlan = null;
	}
	ship.cargoHold = saved.cargoHold ? { ...saved.cargoHold } : {};
	ship.missionOrders = (saved.missionOrders ?? []).map((s) => ({ ...s }));
	ship.missionOrderIndex = saved.missionOrderIndex ?? 0;
}

function applySplineFields(ship: ShipEntry, saved: SavedShipData): void {
	ship.p0x = saved.p0x ?? 0;
	ship.p0y = saved.p0y ?? 0;
	ship.p0z = saved.p0z ?? 0;
	ship.t0x = saved.t0x ?? 0;
	ship.t0y = saved.t0y ?? 0;
	ship.t0z = saved.t0z ?? 0;
	ship.p1x = saved.p1x ?? 0;
	ship.p1y = saved.p1y ?? 0;
	ship.p1z = saved.p1z ?? 0;
	ship.t1x = saved.t1x ?? 0;
	ship.t1y = saved.t1y ?? 0;
	ship.t1z = saved.t1z ?? 0;
}

function restoreTransferState(ship: ShipEntry, saved: SavedShipData): void {
	if (saved.shipState !== "transferring" || !saved.transferTarget) return;
	ship.shipState = "transferring";
	ship.transferTarget = saved.transferTarget;
	ship.transferStartTime = saved.transferStartTime ?? 0;
	ship.transferTimeDays = saved.transferTimeDays ?? 0;
	ship.transferFuelTotal = saved.transferFuelTotal ?? 0;
	applySplineFields(ship, saved);
}

export function restoreShipState(savedData: SavedStateData | null): void {
	if (!savedData || !savedData.ships || savedData.ships.length === 0) return;
	for (const savedShip of savedData.ships) {
		const shipEntry = state.bodyMeshes.find((e) => isShipEntry(e) && e.data.name === savedShip.name);
		if (!shipEntry || !isShipEntry(shipEntry)) continue;
		restoreShipFields(shipEntry, savedShip);
		restoreTransferState(shipEntry, savedShip);
	}
}

function deepCopyColony(colony: ColonyState): ColonyState {
	return {
		...colony,
		installations: { ...colony.installations },
		stockpile: {
			fuelKg: colony.stockpile.fuelKg,
			supplies: colony.stockpile.supplies,
			resources: { ...colony.stockpile.resources },
			flatPacked: { ...(colony.stockpile.flatPacked ?? {}) },
		},
		constructionProjects: (colony.constructionProjects ?? []).map((p) => ({ ...p })),
		productionProjects: (colony.productionProjects ?? []).map((p) => ({ ...p })),
		shipbuildProjects: (colony.shipbuildProjects ?? []).map((p) => ({
			...p,
			resourceCost: { ...p.resourceCost },
		})),
		transferQueue: (colony.transferQueue ?? []).map((r) => ({ ...r })),
	};
}

export function restoreColonyState(savedData: SavedStateData | null): void {
	state.colonies.clear();
	state.scientists.clear();
	state.researchProjects.clear();
	state.gameLog = [];
	if (!savedData) return;
	for (const colony of savedData.colonies ?? []) {
		state.colonies.set(colony.bodyName, deepCopyColony(colony));
	}
	for (const scientist of savedData.scientists ?? []) {
		state.scientists.set(scientist.id, {
			...scientist,
			projectQueue: [...scientist.projectQueue],
			categoryBonuses: { ...scientist.categoryBonuses },
			completedProjects: [...scientist.completedProjects],
			experienceByCategory: { ...scientist.experienceByCategory },
		});
	}
	for (const project of savedData.researchProjects ?? []) {
		state.researchProjects.set(project.techId, { ...project });
	}
	state.gameLog = (savedData.gameLog ?? []).map((entry) => ({
		...entry,
		meta: entry.meta ? { ...entry.meta } : undefined,
	}));
	state.researchedTechs = new Set(savedData.researchedTechs ?? []);
	restoreDesignState(savedData);
}

function restoreDesignState(savedData: SavedStateData): void {
	state.engineDesigns.clear();
	for (const ed of savedData.engineDesigns ?? []) {
		state.engineDesigns.set(ed.id, { ...ed });
	}
	state.shipDesigns.clear();
	for (const sd of savedData.shipDesigns ?? []) {
		state.shipDesigns.set(sd.id, { ...sd, components: [...sd.components] });
	}
	state.missileDesigns.clear();
	for (const md of savedData.missileDesigns ?? []) {
		state.missileDesigns.set(md.id, { ...md });
	}
	state.turretDesigns.clear();
	for (const td of savedData.turretDesigns ?? []) {
		state.turretDesigns.set(td.id, { ...td });
	}
	state.sensorDesigns.clear();
	for (const sd2 of savedData.sensorDesigns ?? []) {
		state.sensorDesigns.set(sd2.id, { ...sd2 });
	}
	state.designCounter = savedData.designCounter ?? 0;
}
