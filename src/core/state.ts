import type {
	AppState,
	CategoryKey,
	CategoryVisibility,
	SavedShipData,
	SavedStateData,
} from "../types";
import { isShipEntry } from "../types";
import { GameClock } from "./game-clock";

export const MAX_CLICK_DIST = 50;

// Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow)
export const SIM_EPOCH: Date = new Date(2038, 0, 20);

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
const SAVE_VERSION = 5;

export const state: AppState = {
	bodyMeshes: [],
	asteroidBelts: [],
	selectedBody: null,
	flyTo: null,
	simTime: new GameClock(0),
	timeSpeed: 1,
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
				"Detached Object",
				"Moon",
				"Comet",
				"Asteroid",
				"Ship",
			] as CategoryKey[]
		).map((k) => [
			k,
			{
				labels: true,
				orbits: k !== "Comet",
				trails: k === "Comet" || k === "Ship",
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
	depotQuality: 1,
	shipIntents: new Map(),
	notifications: [],
	notificationPauseConfig: {
		"survey-complete": false,
		"low-fuel": false,
		"low-morale": false,
		"maintenance-needed": false,
		"mission-complete": true,
		malfunction: true,
		"ship-destroyed": true,
		"transfer-complete": false,
		"action-complete": false,
	},
	firstSurveyCompleted: false,
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
		fuelKg: ship.fuelKg,
		engineId: ship.engineId,
		crew: { ...ship.crew },
		maintenance: { ...ship.maintenance },
		commandTree: { entries: [...ship.commandTree.entries] },
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
		simTime: state.simTime,
		currentSystemKey: state.currentSystemKey,
		randomClickCount: state.randomClickCount,
		discoveredSystems: systems,
		ships,
	};
	try {
		localStorage.setItem(SAVE_KEY, JSON.stringify(data));
	} catch (_) {
		/* storage full or unavailable */
	}
}

export function loadSavedState(): SavedStateData | null {
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw) as SavedStateData;
		if (data.version === 3 && (data as unknown as Record<string, unknown>).ship) {
			return {
				...data,
				version: 4,
				ships: [
					{
						name: "ISS Explorer",
						hostPlanetName: "Earth",
						...((data as unknown as Record<string, unknown>).ship as object),
					},
				],
			} as SavedStateData;
		}
		if (data.version === 4) {
			// v4 → v5: transfer fields added as optional; no structural change needed
			data.version = 5;
		}
		if (data.version !== SAVE_VERSION) return null;
		return data;
	} catch (_) {
		return null;
	}
}

export function restoreShipState(savedData: SavedStateData | null): void {
	if (!savedData || !savedData.ships || savedData.ships.length === 0) return;
	for (const savedShip of savedData.ships) {
		const shipEntry = state.bodyMeshes.find((e) => isShipEntry(e) && e.data.name === savedShip.name);
		if (!shipEntry || !isShipEntry(shipEntry)) continue;
		shipEntry.fuelKg = savedShip.fuelKg;
		shipEntry.engineId = savedShip.engineId;
		if (savedShip.crew) shipEntry.crew = savedShip.crew;
		if (savedShip.maintenance) shipEntry.maintenance = savedShip.maintenance;
		if (savedShip.commandTree) shipEntry.commandTree = savedShip.commandTree;
		if (savedShip.shipState === "transferring" && savedShip.transferTarget) {
			shipEntry.shipState = "transferring";
			shipEntry.transferTarget = savedShip.transferTarget;
			shipEntry.transferStartTime = savedShip.transferStartTime ?? 0;
			shipEntry.transferTimeDays = savedShip.transferTimeDays ?? 0;
			shipEntry.transferFuelTotal = savedShip.transferFuelTotal ?? 0;
			shipEntry.p0x = savedShip.p0x ?? 0;
			shipEntry.p0y = savedShip.p0y ?? 0;
			shipEntry.p0z = savedShip.p0z ?? 0;
			shipEntry.t0x = savedShip.t0x ?? 0;
			shipEntry.t0y = savedShip.t0y ?? 0;
			shipEntry.t0z = savedShip.t0z ?? 0;
			shipEntry.p1x = savedShip.p1x ?? 0;
			shipEntry.p1y = savedShip.p1y ?? 0;
			shipEntry.p1z = savedShip.p1z ?? 0;
			shipEntry.t1x = savedShip.t1x ?? 0;
			shipEntry.t1y = savedShip.t1y ?? 0;
			shipEntry.t1z = savedShip.t1z ?? 0;
		}
	}
}
