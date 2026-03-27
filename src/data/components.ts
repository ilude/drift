// Static component catalog and engine tier definitions.
// Pure data — no app imports, no state dependencies.

export interface EngineTierDef {
	readonly id: string;
	readonly name: string;
	readonly baseAccelG: number;
	readonly baseIspS: number;
	readonly baseMassKg: number;
	readonly prerequisiteTech: string | null;
	readonly minPowerMod: number;
	readonly maxPowerMod: number;
}

export const ENGINE_TIER_DEFS: readonly EngineTierDef[] = [
	{
		id: "conventional",
		name: "Conventional TN",
		baseAccelG: 0.1,
		baseIspS: 1_000_000,
		baseMassKg: 3_000,
		prerequisiteTech: null,
		minPowerMod: 0.5,
		maxPowerMod: 3.0,
	},
	{
		id: "improved",
		name: "Improved TN",
		baseAccelG: 10,
		baseIspS: 2_000_000,
		baseMassKg: 4_000,
		prerequisiteTech: "fleet-logistics",
		minPowerMod: 0.5,
		maxPowerMod: 3.0,
	},
	{
		id: "advanced",
		name: "Advanced TN",
		baseAccelG: 50,
		baseIspS: 5_000_000,
		baseMassKg: 5_000,
		prerequisiteTech: "applied-physics",
		minPowerMod: 0.5,
		maxPowerMod: 3.0,
	},
	{
		id: "extreme",
		name: "Extreme TN",
		baseAccelG: 200,
		baseIspS: 10_000_000,
		baseMassKg: 6_000,
		prerequisiteTech: "unified-field-theory",
		minPowerMod: 0.5,
		maxPowerMod: 3.0,
	},
];

export type ComponentCategory =
	| "bridge"
	| "crew-quarters"
	| "fuel-tank"
	| "cargo-bay"
	| "maintenance-bay"
	| "sensor-suite"
	| "armor";

export interface ComponentDef {
	readonly id: string;
	readonly name: string;
	readonly category: ComponentCategory;
	readonly massKg: number;
	readonly description: string;
	readonly prerequisiteTech: string | null;
	readonly fuelCapacityKg?: number;
	readonly cargoCapacityKg?: number;
	readonly crewCapacity?: number;
	readonly suppliesCapacity?: number;
	readonly sensorBonus?: number;
	readonly armorHp?: number;
}

export const COMPONENT_DEFS: readonly ComponentDef[] = [
	// Bridge
	{
		id: "bridge-standard",
		name: "Standard Bridge",
		category: "bridge",
		massKg: 500,
		description: "Command and control center required on every vessel.",
		prerequisiteTech: null,
	},

	// Crew Quarters
	{
		id: "crew-small",
		name: "Small Crew Quarters",
		category: "crew-quarters",
		massKg: 1_000,
		description: "Compact bunk arrangements for a small crew complement.",
		prerequisiteTech: null,
		crewCapacity: 25,
	},
	{
		id: "crew-standard",
		name: "Standard Crew Quarters",
		category: "crew-quarters",
		massKg: 2_000,
		description: "Full-sized quarters with mess and recreation space.",
		prerequisiteTech: null,
		crewCapacity: 50,
	},
	{
		id: "crew-large",
		name: "Large Crew Quarters",
		category: "crew-quarters",
		massKg: 4_000,
		description: "Extended habitat module with closed-cycle life support for long missions.",
		prerequisiteTech: "closed-cycle-life-support",
		crewCapacity: 100,
	},

	// Fuel Tanks
	{
		id: "fuel-small",
		name: "Small Fuel Tank",
		category: "fuel-tank",
		massKg: 500,
		description: "Compact trans-Newtonian fuel storage for short-range operations.",
		prerequisiteTech: null,
		fuelCapacityKg: 25_000,
	},
	{
		id: "fuel-standard",
		name: "Standard Fuel Tank",
		category: "fuel-tank",
		massKg: 1_000,
		description: "General-purpose fuel tank suitable for most mission profiles.",
		prerequisiteTech: null,
		fuelCapacityKg: 50_000,
	},
	{
		id: "fuel-large",
		name: "Large Fuel Tank",
		category: "fuel-tank",
		massKg: 2_000,
		description: "High-density storage tank enabling extended-range operations.",
		prerequisiteTech: "supply-optimization",
		fuelCapacityKg: 100_000,
	},
	{
		id: "fuel-massive",
		name: "Massive Fuel Tank",
		category: "fuel-tank",
		massKg: 3_500,
		description: "Fleet-scale fuel storage for tankers and long-duration expeditions.",
		prerequisiteTech: "fleet-logistics",
		fuelCapacityKg: 200_000,
	},

	// Cargo Bays
	{
		id: "cargo-small",
		name: "Small Cargo Bay",
		category: "cargo-bay",
		massKg: 500,
		description: "Basic pressurized hold for light cargo and consumables.",
		prerequisiteTech: null,
		cargoCapacityKg: 10_000,
	},
	{
		id: "cargo-standard",
		name: "Standard Cargo Bay",
		category: "cargo-bay",
		massKg: 1_000,
		description: "Modular cargo hold with standard pallet interfaces.",
		prerequisiteTech: null,
		cargoCapacityKg: 25_000,
	},
	{
		id: "cargo-large",
		name: "Large Cargo Bay",
		category: "cargo-bay",
		massKg: 2_000,
		description: "Oversized hold for bulk resource transport using advanced fabrication methods.",
		prerequisiteTech: "fabrication-methods",
		cargoCapacityKg: 50_000,
	},

	// Maintenance Bays
	{
		id: "maint-basic",
		name: "Basic Maintenance Bay",
		category: "maintenance-bay",
		massKg: 800,
		description: "Essential workshop and parts locker for routine crew-performed maintenance.",
		prerequisiteTech: null,
		suppliesCapacity: 50,
	},
	{
		id: "maint-advanced",
		name: "Advanced Maintenance Bay",
		category: "maintenance-bay",
		massKg: 1_500,
		description: "Expanded workshop with precision tooling for component-level repairs.",
		prerequisiteTech: "maintenance-doctrine",
		suppliesCapacity: 100,
	},
	{
		id: "maint-full",
		name: "Full Maintenance Bay",
		category: "maintenance-bay",
		massKg: 3_000,
		description: "Complete depot-level facility capable of rapid refit and deep overhaul.",
		prerequisiteTech: "rapid-refit",
		suppliesCapacity: 200,
	},

	// Sensor Suites
	{
		id: "sensor-basic",
		name: "Basic Survey Sensor",
		category: "sensor-suite",
		massKg: 300,
		description: "Standard-resolution active and passive sensors for surface surveys.",
		prerequisiteTech: null,
		sensorBonus: 1.0,
	},
	{
		id: "sensor-improved",
		name: "Improved Survey Sensor",
		category: "sensor-suite",
		massKg: 600,
		description: "Enhanced sensor array with improved spectral resolution and depth penetration.",
		prerequisiteTech: "advanced-telemetry",
		sensorBonus: 1.5,
	},
	{
		id: "sensor-deep",
		name: "Deep Scan Array",
		category: "sensor-suite",
		massKg: 1_200,
		description: "High-power synthetic aperture array capable of scanning deep subsurface deposits.",
		prerequisiteTech: "deep-scan-array",
		sensorBonus: 2.0,
	},

	// Armor
	{
		id: "armor-light",
		name: "Light Armor Plating",
		category: "armor",
		massKg: 1_500,
		description: "Advanced metallurgy composite panels providing basic hull reinforcement.",
		prerequisiteTech: "advanced-metallurgy",
		armorHp: 20,
	},
	{
		id: "armor-heavy",
		name: "Heavy Armor Plating",
		category: "armor",
		massKg: 3_000,
		description: "Nano-manufactured high-density armor for ships operating in hostile environments.",
		prerequisiteTech: "nano-manufacturing",
		armorHp: 40,
	},
];

export function getUnlockedEngineTiers(researchedTechs: Set<string>): EngineTierDef[] {
	return ENGINE_TIER_DEFS.filter(
		(t) => t.prerequisiteTech === null || researchedTechs.has(t.prerequisiteTech),
	);
}

export function getUnlockedComponents(researchedTechs: Set<string>): ComponentDef[] {
	return COMPONENT_DEFS.filter(
		(c) => c.prerequisiteTech === null || researchedTechs.has(c.prerequisiteTech),
	);
}

export function findEngineTier(tierId: string): EngineTierDef | undefined {
	return ENGINE_TIER_DEFS.find((t) => t.id === tierId);
}

export function findComponent(componentId: string): ComponentDef | undefined {
	return COMPONENT_DEFS.find((c) => c.id === componentId);
}
