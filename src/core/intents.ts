import type { ShipIntent } from "../types";
import { state } from "./state";

/** Publish or update a ship's intent in the shared pool. */
export function publishIntent(shipName: string, intent: ShipIntent): void {
	state.shipIntents.set(shipName, intent);
}

/** Remove a ship's intent from the pool (ship destroyed or removed). */
export function clearIntent(shipName: string): void {
	state.shipIntents.delete(shipName);
}

/** Get the current intent for a specific ship, or undefined. */
export function getIntentForShip(shipName: string): ShipIntent | undefined {
	return state.shipIntents.get(shipName);
}

/** Check if a target body/asteroid is claimed by any ship OTHER than the given one. */
export function isTargetClaimed(targetName: string, excludeShipName: string): boolean {
	for (const [shipName, intent] of state.shipIntents) {
		if (shipName === excludeShipName) continue;
		if (intent.type === "surveying" && intent.target === targetName) return true;
		if (intent.type === "transferring" && intent.destination === targetName) return true;
	}
	return false;
}

/** Get all target names claimed by ships other than the given one. Returns a Set for O(1) lookups. */
export function getClaimedTargets(excludeShipName: string): Set<string> {
	const claimed = new Set<string>();
	for (const [shipName, intent] of state.shipIntents) {
		if (shipName === excludeShipName) continue;
		if (intent.type === "surveying") claimed.add(intent.target);
		if (intent.type === "transferring") claimed.add(intent.destination);
	}
	return claimed;
}
