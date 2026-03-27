import { ENGINE_TYPES } from "../math/ship-physics";
import type { ShipEntry, ShipPhysicsState } from "../types";
import { state } from "./state";

export function resolveShipPhysics(ship: ShipEntry): ShipPhysicsState {
	if (ship.designId) {
		const design = state.shipDesigns.get(ship.designId);
		if (design) {
			return {
				fuelKg: ship.fuelKg,
				dryMassKg: ship.dryMassKg,
				accelG: design.accelG,
				ispS: design.ispS,
			};
		}
	}
	// Legacy fallback: resolve from engineId
	const engine = ENGINE_TYPES.find((e) => e.id === ship.engineId) ?? ENGINE_TYPES[0];
	return {
		fuelKg: ship.fuelKg,
		dryMassKg: ship.dryMassKg,
		accelG: engine.accelG,
		ispS: engine.ispS,
	};
}
