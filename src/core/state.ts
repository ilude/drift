import type {
	AppState,
	CategoryKey,
	CategoryVisibility,
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
		commander: { ...ship.commander },
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

function restoreShipFields(ship: ShipEntry, saved: SavedShipData): void {
	ship.fuelKg = saved.fuelKg;
	ship.engineId = saved.engineId;
	if (saved.crew) ship.crew = saved.crew;
	if (saved.maintenance) ship.maintenance = saved.maintenance;
	if (saved.commandTree) ship.commandTree = saved.commandTree;
	if (saved.commander) ship.commander = saved.commander;
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
