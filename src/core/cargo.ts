// Cargo hold management and mission order execution.
// Ships with cargo capacity carry items between colonies following sequential mission steps.

import type { ColonyState, MissionStep, ShipEntry } from "../types";
import { state } from "./state";

// Flat-packed items (prefixed "flat-") weigh 500 kg each; resources weigh 1 kg per unit.
const FLAT_PACKED_WEIGHT_KG = 500;
const RESOURCE_WEIGHT_KG = 1;

// Loading/unloading rate: 1000 kg per sim-day
const CARGO_TRANSFER_RATE_KG_PER_DAY = 1000;

export function getCargoWeightKg(ship: ShipEntry): number {
	let weight = 0;
	for (const [itemId, qty] of Object.entries(ship.cargoHold)) {
		weight += qty * (itemId.startsWith("flat-") ? FLAT_PACKED_WEIGHT_KG : RESOURCE_WEIGHT_KG);
	}
	return weight;
}

export function getCargoCapacityKg(ship: ShipEntry): number {
	const design = ship.designId ? state.shipDesigns.get(ship.designId) : undefined;
	return design?.cargoCapacityKg ?? 0;
}

/** Weight per unit for a given item id. */
function itemWeightKg(itemId: string): number {
	return itemId.startsWith("flat-") ? FLAT_PACKED_WEIGHT_KG : RESOURCE_WEIGHT_KG;
}

/** How many units of an item can still fit in the cargo hold. */
function remainingCapacityUnits(ship: ShipEntry, itemId: string): number {
	const freeKg = getCargoCapacityKg(ship) - getCargoWeightKg(ship);
	if (freeKg <= 0) return 0;
	return Math.floor(freeKg / itemWeightKg(itemId));
}

/** Find the colony at the ship's current orbit location, if any. */
function getColonyAtShip(ship: ShipEntry): ColonyState | undefined {
	return state.colonies.get(ship.hostPlanetName);
}

/** Resolve item source in a colony stockpile (resources or flatPacked). */
function getColonyStock(colony: ColonyState, itemId: string): number {
	if (itemId.startsWith("flat-")) {
		return colony.stockpile.flatPacked[itemId] ?? 0;
	}
	return colony.stockpile.resources[itemId] ?? 0;
}

function setColonyStock(colony: ColonyState, itemId: string, value: number): void {
	if (itemId.startsWith("flat-")) {
		colony.stockpile.flatPacked[itemId] = value;
	} else {
		colony.stockpile.resources[itemId] = value;
	}
}

function advanceStep(ship: ShipEntry): void {
	ship.missionOrderIndex++;
	if (ship.missionOrderIndex >= ship.missionOrders.length) {
		// Past the end with no repeat — stay at end (idle)
		ship.missionOrderIndex = ship.missionOrders.length;
	}
}

/** Execute a load-cargo step: transfer items from colony to ship at a rate per day. */
function tickLoadCargo(ship: ShipEntry, step: MissionStep, simDt: number): void {
	if (ship.shipState !== "orbiting") return;
	const colony = getColonyAtShip(ship);
	if (!colony) return;

	const itemId = step.itemId;
	if (!itemId) {
		advanceStep(ship);
		return;
	}

	const weightPerUnit = itemWeightKg(itemId);
	const maxUnitsByRate = Math.floor((CARGO_TRANSFER_RATE_KG_PER_DAY * simDt) / weightPerUnit);
	if (maxUnitsByRate <= 0) return;

	const colonyAvailable = getColonyStock(colony, itemId);
	const capacityUnits = remainingCapacityUnits(ship, itemId);
	const wantedUnits =
		step.quantity != null && step.quantity > 0
			? Math.max(0, step.quantity - (ship.cargoHold[itemId] ?? 0))
			: colonyAvailable;

	const transferUnits = Math.min(maxUnitsByRate, colonyAvailable, capacityUnits, wantedUnits);

	if (transferUnits > 0) {
		ship.cargoHold[itemId] = (ship.cargoHold[itemId] ?? 0) + transferUnits;
		setColonyStock(colony, itemId, colonyAvailable - transferUnits);
	}

	// Advance when done: colony empty, cargo full, or desired quantity reached
	const doneLoading =
		colonyAvailable - transferUnits <= 0 ||
		capacityUnits - transferUnits <= 0 ||
		(step.quantity != null && step.quantity > 0 && (ship.cargoHold[itemId] ?? 0) >= step.quantity);
	if (doneLoading) advanceStep(ship);
}

/** Execute an unload-cargo step: transfer items from ship to colony at a rate per day. */
function tickUnloadCargo(ship: ShipEntry, step: MissionStep, simDt: number): void {
	if (ship.shipState !== "orbiting") return;
	const colony = getColonyAtShip(ship);
	if (!colony) return;

	const itemId = step.itemId;
	if (!itemId) {
		advanceStep(ship);
		return;
	}

	const weightPerUnit = itemWeightKg(itemId);
	const maxUnitsByRate = Math.floor((CARGO_TRANSFER_RATE_KG_PER_DAY * simDt) / weightPerUnit);
	if (maxUnitsByRate <= 0) return;

	const shipAvailable = ship.cargoHold[itemId] ?? 0;
	const wantedUnits =
		step.quantity != null && step.quantity > 0
			? Math.min(step.quantity, shipAvailable)
			: shipAvailable;

	const transferUnits = Math.min(maxUnitsByRate, wantedUnits);

	if (transferUnits > 0) {
		ship.cargoHold[itemId] = shipAvailable - transferUnits;
		if (ship.cargoHold[itemId] <= 0) delete ship.cargoHold[itemId];
		setColonyStock(colony, itemId, getColonyStock(colony, itemId) + transferUnits);
	}

	// Advance when ship has no more of this item or desired quantity transferred
	const remaining = ship.cargoHold[itemId] ?? 0;
	if (remaining <= 0 || wantedUnits - transferUnits <= 0) advanceStep(ship);
}

/**
 * Returns true if the current mission step is "transfer-to" and the ship needs to move.
 * The caller (main.ts) is responsible for actually initiating the transfer via the
 * rendering layer, since cargo.ts cannot import rendering code.
 */
export function getMissionTransferTarget(ship: ShipEntry): string | null {
	if (ship.missionOrders.length === 0) return null;
	if (ship.missionOrderIndex >= ship.missionOrders.length) return null;
	const step = ship.missionOrders[ship.missionOrderIndex];
	if (step.type !== "transfer-to" || !step.target) return null;
	if (step.target === ship.hostPlanetName) return null; // already there
	return step.target;
}

/** Advance past a transfer-to step (called after arrival or when already at target). */
export function advanceMissionTransferStep(ship: ShipEntry): void {
	if (ship.missionOrders.length === 0) return;
	if (ship.missionOrderIndex >= ship.missionOrders.length) return;
	const step = ship.missionOrders[ship.missionOrderIndex];
	if (step.type === "transfer-to") advanceStep(ship);
}

/** Returns true if ship has active mission orders to execute. */
export function hasMissionOrders(ship: ShipEntry): boolean {
	return ship.missionOrders.length > 0 && ship.missionOrderIndex < ship.missionOrders.length;
}

/**
 * Tick the current mission step for a ship.
 * Called each frame from the ship tick loop. Transfer-to steps are handled externally
 * (main.ts calls getMissionTransferTarget + initiateTransfer). This function handles
 * load/unload/repeat steps only.
 */
export function tickMissionOrders(ship: ShipEntry, simDt: number): void {
	if (!hasMissionOrders(ship)) return;

	const step = ship.missionOrders[ship.missionOrderIndex];
	switch (step.type) {
		case "load-cargo":
			tickLoadCargo(ship, step, simDt);
			break;
		case "unload-cargo":
			tickUnloadCargo(ship, step, simDt);
			break;
		case "transfer-to":
			// If already at target, advance. Transfer initiation handled by main.ts.
			if (step.target === ship.hostPlanetName) advanceStep(ship);
			break;
		case "repeat":
			ship.missionOrderIndex = 0;
			break;
	}
}
