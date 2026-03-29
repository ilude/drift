import { computeTotalFuelCost, findAffordableAccelG } from "../math/ship-physics";
import { bodyAUFromPosition, distanceKmBetween } from "../math/transfer";
import type { BodyEntry, ShipEntry } from "../types";
import { findAsteroidEntity, findBody } from "./entities";
import { resolveShipPhysics } from "./ship-utils";
import { gameLog, state } from "./state";

// Station-keeping drift speed (~1 rotation/year, visual only)
const SHIP_LOCAL_SPEED = (Math.PI * 2) / 365;

// --- Visual commit hook (set by rendering layer at startup) ---

type VisualCommitFn = (
	entry: ShipEntry,
	targetEntry: BodyEntry,
	gameDays: number,
	targetName: string,
) => void;

type StatusFn = (msg: string) => void;

type AsteroidProxyFn = (
	asteroid: import("../types").AsteroidInfo,
	beltEntry: import("../types").AsteroidBeltEntry,
) => BodyEntry;

let _visualCommit: VisualCommitFn | null = null;
let _showStatus: StatusFn | null = null;
let _asteroidProxy: AsteroidProxyFn | null = null;

export function setTransferHooks(
	commit: VisualCommitFn,
	showStatus: StatusFn,
	proxy: AsteroidProxyFn,
): void {
	_visualCommit = commit;
	_showStatus = showStatus;
	_asteroidProxy = proxy;
}

/** Resolve the host body a ship is orbiting (planet or asteroid). */
function resolveHost(hostName: string): BodyEntry | undefined {
	const [hostBody, hostBodyFound] = findBody(hostName);
	if (hostBodyFound) return hostBody;
	const [hit, hitFound] = findAsteroidEntity(hostName);
	if (hitFound && _asteroidProxy) return _asteroidProxy(hit.asteroid, hit.beltEntry);
	return undefined;
}

/** Try to throttle acceleration to fit fuel budget. Returns null if impossible. */
function tryThrottle(
	entry: ShipEntry,
	distKm: number,
	maxAccelG: number,
	ispS: number,
	dryMassKg: number,
	opMult: number,
	showUI: boolean,
): { totalFuelKg: number; transferDays: number; accelG: number } | null {
	const throttled = findAffordableAccelG(
		distKm,
		ispS,
		dryMassKg,
		entry.fuelCapacityKg,
		maxAccelG,
		entry.fuelKg,
		opMult,
	);
	if (!throttled) {
		if (showUI && _showStatus) {
			_showStatus("Insufficient fuel for transfer at any acceleration");
		}
		return null;
	}
	gameLog(
		`[transfer] ${entry.data.name}: throttled ${maxAccelG.toFixed(3)}G → ${throttled.accelG.toFixed(3)}G (fuel: ${throttled.totalFuelKg.toFixed(0)}kg, ${throttled.transferDays.toFixed(1)}d)`,
	);
	return throttled;
}

/**
 * Set sim-layer transfer fields on a ship entry.
 * Called by the rendering layer's commitTransfer before writing spline knots.
 */
export function commitTransferSim(entry: ShipEntry, gameDays: number, targetName: string): void {
	entry.transferStartTime = state.simTime.days;
	entry.transferTimeDays = gameDays;
	// Preserve original timing for UI display (not reset by re-spline)
	if (entry.shipState !== "transferring") {
		entry.transferDisplayStart = state.simTime.days;
		entry.transferDisplayDays = gameDays;
	}
	entry.transferTarget = targetName;
	entry.shipState = "transferring";
	entry.pendingTransfer = null;
	entry.stationTarget = null;
}

/**
 * Complete a transfer at the sim level: update ship state fields to orbiting.
 * Does not touch mesh position or trail geometry — call this before visual cleanup.
 */
export function completeTransferSim(entry: ShipEntry): void {
	const transferTarget = entry.transferTarget ?? "";
	const [target, targetFound] = findBody(transferTarget);

	entry.shipState = "orbiting";
	if (targetFound && target.isMoon && target.parentMesh) {
		const parent = state.bodyMeshes.find((e) => e.mesh === target.parentMesh);
		entry.hostPlanetName = parent ? parent.data.name : transferTarget;
	} else {
		entry.hostPlanetName = transferTarget;
	}
	entry.transferTarget = null;
	entry.transferFuelTotal = 0;
	entry.pendingTransfer = null;
	entry.speed = SHIP_LOCAL_SPEED;
	entry.angle = 0;

	if (targetFound) {
		entry.data.distance = target.data.distance || entry.data.distance;
		entry.orbitA = entry.data.distance;
	} else {
		const [hit, hitFound] = findAsteroidEntity(transferTarget);
		if (hitFound) {
			entry.data.distance = hit.asteroid.au;
			entry.orbitA = hit.asteroid.au;
		}
	}
}

/**
 * Adjust transfer fuel budget and timing after a mid-transfer re-spline.
 * Proportionally reduces fuel budget for the remaining portion of the transfer.
 */
export function adjustTransferBudget(entry: ShipEntry, remainingDays: number): void {
	if (entry.transferTimeDays > 0) {
		entry.transferFuelTotal *= remainingDays / entry.transferTimeDays;
	}
	entry.transferStartTime = state.simTime.days;
	entry.transferTimeDays = remainingDays;
}

/**
 * Initiate a transfer from a ship to a target body.
 * Computes fuel cost using the additive model (rocket equation + operational burn).
 * If full acceleration is unaffordable, the commander throttles down automatically.
 * Returns false if the transfer is impossible at any acceleration.
 */
export function initiateTransfer(
	entry: ShipEntry,
	targetEntry: BodyEntry,
	showUI = false,
): boolean {
	if (!entry.isShip || entry.shipState === "transferring") return false;

	const host = resolveHost(entry.hostPlanetName);
	if (!host) return false;

	const distKm = distanceKmBetween(host, targetEntry);
	if (distKm < 1) return false;

	const physics = resolveShipPhysics(entry);
	const opMult = state.fuelBurnMultiplier;

	let cost = computeTotalFuelCost(
		distKm,
		physics.accelG,
		physics.ispS,
		physics.dryMassKg,
		entry.fuelCapacityKg,
		opMult,
	);

	if (cost.totalFuelKg > entry.fuelKg) {
		const throttled = tryThrottle(
			entry,
			distKm,
			physics.accelG,
			physics.ispS,
			physics.dryMassKg,
			opMult,
			showUI,
		);
		if (!throttled) return false;
		cost = { rocketFuelKg: 0, opBurnKg: 0, ...throttled };
	}

	entry.transferFuelTotal = cost.totalFuelKg;

	const r1 = host.data.distance || bodyAUFromPosition(host);
	const r2 = targetEntry.data.distance || bodyAUFromPosition(targetEntry);
	entry.orbitA = (r1 + r2) / 2;

	if (_visualCommit) {
		_visualCommit(entry, targetEntry, cost.transferDays, targetEntry.data.name);
	}
	return true;
}
