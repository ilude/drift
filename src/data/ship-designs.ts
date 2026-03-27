// Ship design interfaces — pure data shapes, no logic, no state.

export interface EngineDesign {
	id: string;
	name: string;
	tierId: string;
	powerMod: number;
	accelG: number;
	ispS: number;
	massKg: number;
}

export interface ShipDesignComponent {
	componentId: string;
	count: number;
}

export interface ShipDesign {
	id: string;
	name: string;
	engineDesignId: string;
	engineCount: number;
	components: ShipDesignComponent[];
	dryMassKg: number;
	fuelCapacityKg: number;
	cargoCapacityKg: number;
	crewCapacity: number;
	maxSupplies: number;
	sensorMultiplier: number;
	accelG: number;
	ispS: number;
	armorHp: number;
}
