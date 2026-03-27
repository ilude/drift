// Static component catalog and engine tier definitions.
// Pure data — no app imports, no state dependencies.

export interface EnginePowerOption {
	readonly label: string;
	readonly powerPct: number;
	readonly fuelMod: number;
}

export interface EngineSizeOption {
	readonly sizeHS: number;
	readonly label: string;
	readonly fuelReductionPct: number;
}

export interface EngineTierDef {
	readonly id: string;
	readonly name: string;
	readonly baseAccelG: number;
	readonly baseIspS: number;
	readonly baseMassPerHS: number;
	readonly prerequisiteTech: string | null;
	readonly powerOptions: readonly EnginePowerOption[];
	readonly sizeOptions: readonly EngineSizeOption[];
}

const STANDARD_POWER_OPTIONS: readonly EnginePowerOption[] = [
	{ label: "10% Power, 0.003 Fuel", powerPct: 10, fuelMod: 0.003 },
	{ label: "20% Power, 0.018 Fuel", powerPct: 20, fuelMod: 0.018 },
	{ label: "30% Power, 0.049 Fuel", powerPct: 30, fuelMod: 0.049 },
	{ label: "40% Power, 0.101 Fuel", powerPct: 40, fuelMod: 0.101 },
	{ label: "50% Power, 0.177 Fuel", powerPct: 50, fuelMod: 0.177 },
	{ label: "60% Power, 0.279 Fuel", powerPct: 60, fuelMod: 0.279 },
	{ label: "70% Power, 0.410 Fuel", powerPct: 70, fuelMod: 0.41 },
	{ label: "80% Power, 0.572 Fuel", powerPct: 80, fuelMod: 0.572 },
	{ label: "90% Power, 0.769 Fuel", powerPct: 90, fuelMod: 0.769 },
	{ label: "100% Power, 1.000 Fuel", powerPct: 100, fuelMod: 1.0 },
	{ label: "125% Power, 1.747 Fuel", powerPct: 125, fuelMod: 1.747 },
	{ label: "150% Power, 2.756 Fuel", powerPct: 150, fuelMod: 2.756 },
];

const STANDARD_SIZE_OPTIONS: readonly EngineSizeOption[] = [
	{ sizeHS: 1, label: "1 HS (50 tons)", fuelReductionPct: 1 },
	{ sizeHS: 5, label: "5 HS (250 tons)", fuelReductionPct: 5 },
	{ sizeHS: 10, label: "10 HS (500 tons)", fuelReductionPct: 10 },
	{ sizeHS: 15, label: "15 HS (750 tons)", fuelReductionPct: 15 },
	{ sizeHS: 20, label: "20 HS (1,000 tons)", fuelReductionPct: 20 },
	{ sizeHS: 25, label: "25 HS (1,250 tons)", fuelReductionPct: 25 },
	{ sizeHS: 30, label: "30 HS (1,500 tons)", fuelReductionPct: 30 },
	{ sizeHS: 40, label: "40 HS (2,000 tons)", fuelReductionPct: 40 },
	{ sizeHS: 50, label: "50 HS (2,500 tons)", fuelReductionPct: 50 },
];

export const ENGINE_TIER_DEFS: readonly EngineTierDef[] = [
	{
		id: "conventional",
		name: "Conventional TN",
		baseAccelG: 0.1,
		baseIspS: 1_000_000,
		baseMassPerHS: 60,
		prerequisiteTech: null,
		powerOptions: STANDARD_POWER_OPTIONS,
		sizeOptions: STANDARD_SIZE_OPTIONS,
	},
	{
		id: "improved",
		name: "Improved TN",
		baseAccelG: 10,
		baseIspS: 2_000_000,
		baseMassPerHS: 80,
		prerequisiteTech: "fleet-logistics",
		powerOptions: STANDARD_POWER_OPTIONS,
		sizeOptions: STANDARD_SIZE_OPTIONS,
	},
	{
		id: "advanced",
		name: "Advanced TN",
		baseAccelG: 50,
		baseIspS: 5_000_000,
		baseMassPerHS: 100,
		prerequisiteTech: "applied-physics",
		powerOptions: STANDARD_POWER_OPTIONS,
		sizeOptions: STANDARD_SIZE_OPTIONS,
	},
	{
		id: "extreme",
		name: "Extreme TN",
		baseAccelG: 200,
		baseIspS: 10_000_000,
		baseMassPerHS: 120,
		prerequisiteTech: "unified-field-theory",
		powerOptions: STANDARD_POWER_OPTIONS,
		sizeOptions: STANDARD_SIZE_OPTIONS,
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
