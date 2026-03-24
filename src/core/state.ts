import type { AppState, CategoryKey, CategoryVisibility, SavedStateData } from "../types";
import { isShipEntry } from "../types";

export const MAX_CLICK_DIST = 50;

// Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow)
export const SIM_EPOCH: Date = new Date(2038, 0, 20);

export function simTimeToDate(simTime: number): Date {
	const ms = simTime * 86400000;
	return new Date(SIM_EPOCH.getTime() + ms);
}

export function simTimeToDay(simTime: number): number {
	return Math.floor(simTime);
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

export function speedLabel(timeSpeed: number): string {
	if (timeSpeed === 0) return "Paused";
	if (timeSpeed < 1) return `${Math.round(timeSpeed * 24)} hrs / sec`;
	if (timeSpeed < 30) return `${timeSpeed} day${timeSpeed === 1 ? "" : "s"} / sec`;
	return `${Math.round(timeSpeed / 30)} month${timeSpeed < 60 ? "" : "s"} / sec`;
}

export const MASTER_SEED: number = 42;
const SAVE_KEY = "solar-sim-state";
const SAVE_VERSION = 3;

export const state: AppState = {
	bodyMeshes: [],
	asteroidBelts: [],
	selectedBody: null,
	flyTo: null,
	simTime: 0,
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
				trails: k === "Comet",
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
	},
	firstSurveyCompleted: false,
};

export function saveState(): void {
	const systems: Array<{ key: string; name: string; seed: number }> = [];
	state.discoveredSystems.forEach((sys, key) => {
		if (key === "sol") return;
		systems.push({ key, name: sys.name, seed: sys.seed as number });
	});
	// Capture ship physics state
	const shipEntry = state.bodyMeshes.find((e) => isShipEntry(e));
	const shipData =
		shipEntry && isShipEntry(shipEntry)
			? {
					fuelKg: shipEntry.fuelKg,
					engineId: shipEntry.engineId,
					crew: shipEntry.crew,
					maintenance: shipEntry.maintenance,
					commandTree: shipEntry.commandTree,
				}
			: null;

	const data: SavedStateData = {
		version: SAVE_VERSION,
		simTime: state.simTime,
		currentSystemKey: state.currentSystemKey,
		randomClickCount: state.randomClickCount,
		discoveredSystems: systems,
		ship: shipData,
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
		if (data.version !== SAVE_VERSION) return null;
		return data;
	} catch (_) {
		return null;
	}
}

export function restoreShipState(savedData: SavedStateData | null): void {
	if (!savedData || !savedData.ship) return;
	const shipEntry = state.bodyMeshes.find((e) => isShipEntry(e));
	if (!shipEntry || !isShipEntry(shipEntry)) return;
	if (savedData.ship.fuelKg !== undefined) shipEntry.fuelKg = savedData.ship.fuelKg;
	if (savedData.ship.engineId !== undefined) shipEntry.engineId = savedData.ship.engineId;
	if (savedData.ship.crew) shipEntry.crew = savedData.ship.crew;
	if (savedData.ship.maintenance) shipEntry.maintenance = savedData.ship.maintenance;
	if (savedData.ship.commandTree) shipEntry.commandTree = savedData.ship.commandTree;
}
