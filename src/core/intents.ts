import type { ShipIntent } from "../types";
import { state } from "./state";

// Cache: map of shipName -> set of target names claimed by that ship.
// Rebuilt on any intent change; one rebuild serves all callers per frame.
let _intentsDirty = true;
const _claimsByShip = new Map<string, Set<string>>();
const _intentChangeCallbacks: (() => void)[] = [];

/** Register a callback to be invoked whenever intents change (for cache invalidation). */
export function onIntentChange(cb: () => void): void {
	_intentChangeCallbacks.push(cb);
}

function rebuildClaimsCache(): void {
	_claimsByShip.clear();
	for (const [shipName, intent] of state.shipIntents) {
		const targets = new Set<string>();
		if (intent.type === "surveying") targets.add(intent.target);
		else if (intent.type === "transferring") targets.add(intent.destination);
		else if (intent.type === "tanking") targets.add(intent.target);
		if (targets.size > 0) _claimsByShip.set(shipName, targets);
	}
	_intentsDirty = false;
}

function markDirty(): void {
	_intentsDirty = true;
	for (const cb of _intentChangeCallbacks) cb();
}

/** Publish or update a ship's intent in the shared pool. */
export function publishIntent(shipName: string, intent: ShipIntent): void {
	state.shipIntents.set(shipName, intent);
	markDirty();
}

/** Remove a ship's intent from the pool (ship destroyed or removed). */
export function clearIntent(shipName: string): void {
	state.shipIntents.delete(shipName);
	markDirty();
}

/** Get the current intent for a specific ship, or undefined. */
export function getIntentForShip(shipName: string): ShipIntent | undefined {
	return state.shipIntents.get(shipName);
}

/** Check if a target body/asteroid is claimed by any ship OTHER than the given one. */
export function isTargetClaimed(targetName: string, excludeShipName: string): boolean {
	if (_intentsDirty) rebuildClaimsCache();
	for (const [shipName, targets] of _claimsByShip) {
		if (shipName === excludeShipName) continue;
		if (targets.has(targetName)) return true;
	}
	return false;
}

/** Force-invalidate the claimed targets cache (call after direct mutation of state.shipIntents in tests). */
export function invalidateIntentsCache(): void {
	_intentsDirty = true;
}

/** Get all target names claimed by ships other than the given one. Returns a Set for O(1) lookups. */
export function getClaimedTargets(excludeShipName: string): Set<string> {
	if (_intentsDirty) rebuildClaimsCache();
	const result = new Set<string>();
	for (const [shipName, targets] of _claimsByShip) {
		if (shipName === excludeShipName) continue;
		for (const t of targets) result.add(t);
	}
	return result;
}
