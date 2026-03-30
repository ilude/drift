import { ENGINE_TYPES } from "../math/ship-physics";
import type { ShipEntry, ShipPhysicsState } from "../types";
import { state } from "./state";

export function resolveShipPhysics(ship: ShipEntry): ShipPhysicsState {
	if (ship.designId) {
		const design = state.shipDesigns.get(ship.designId);
		if (design) {
			const engineDesign = state.engineDesigns.get(design.engineDesignId);
			return {
				fuelKg: ship.fuelKg,
				dryMassKg: ship.dryMassKg,
				accelG: design.accelG,
				ispS: design.ispS,
				fuelMod: engineDesign?.fuelMod ?? 1,
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
		fuelMod: 1,
	};
}

function sensorBonusToLevel(bonus: number): number {
	if (bonus >= 2.0) return 3;
	if (bonus >= 1.5) return 2;
	return 1;
}

export function resolveShipSensorLevel(ship: ShipEntry): number {
	if (ship.designId) {
		const design = state.shipDesigns.get(ship.designId);
		if (design) return sensorBonusToLevel(design.sensorMultiplier);
	}
	return 1; // Legacy ships / no sensors default to level 1
}
