import { seededRandom } from "../core/utils";
import type { ResourceCategory, ResourceDeposit } from "../types";

// Inlined to avoid pulling the Three.js rendering chain into non-DOM contexts.
// Must stay byte-for-byte identical to nameHash in src/rendering/bodies.ts.
function nameHash(str: string): number {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
	}
	return h;
}

interface ResourceDef {
	readonly id: string;
	readonly name: string;
	readonly category: ResourceCategory;
	readonly symbol: string;
	readonly description: string;
	readonly minable: boolean;
}

export const RESOURCES: readonly ResourceDef[] = [
	// Metals (5)
	{
		id: "iron",
		name: "Iron",
		category: "metal",
		symbol: "Fe",
		description: "Primary structural metal",
		minable: true,
	},
	{
		id: "copper",
		name: "Copper",
		category: "metal",
		symbol: "Cu",
		description: "Wiring, electronics",
		minable: true,
	},
	{
		id: "aluminum",
		name: "Aluminum",
		category: "metal",
		symbol: "Al",
		description: "Lightweight structures",
		minable: true,
	},
	{
		id: "titanium",
		name: "Titanium",
		category: "metal",
		symbol: "Ti",
		description: "High-strength alloys",
		minable: true,
	},
	{
		id: "platinum",
		name: "Platinum Group",
		category: "metal",
		symbol: "Pt",
		description: "Catalysts, precision electronics",
		minable: true,
	},
	// Industrial (4)
	{
		id: "silicon",
		name: "Silicon",
		category: "industrial",
		symbol: "Si",
		description: "Semiconductors, solar cells",
		minable: true,
	},
	{
		id: "carbon",
		name: "Carbon",
		category: "industrial",
		symbol: "C",
		description: "Composites, organic chemistry",
		minable: true,
	},
	{
		id: "rare-earth",
		name: "Rare Earth Elements",
		category: "industrial",
		symbol: "RE",
		description: "Magnets, advanced electronics",
		minable: true,
	},
	{
		id: "phosphorus",
		name: "Phosphorus",
		category: "industrial",
		symbol: "P",
		description: "Agriculture, chemical processes",
		minable: true,
	},
	// Volatiles (4)
	{
		id: "water",
		name: "Water",
		category: "volatile",
		symbol: "H2O",
		description: "Life support, propellant, industrial solvent",
		minable: true,
	},
	{
		id: "nitrogen",
		name: "Nitrogen",
		category: "volatile",
		symbol: "N",
		description: "Atmospherics, agriculture",
		minable: true,
	},
	{
		id: "helium-3",
		name: "Helium-3",
		category: "volatile",
		symbol: "He3",
		description: "Fusion fuel",
		minable: true,
	},
	{
		id: "hydrocarbons",
		name: "Hydrocarbons",
		category: "volatile",
		symbol: "HC",
		description: "Plastics, chemical feedstock",
		minable: true,
	},
	// Radioactive (6)
	{
		id: "uranium",
		name: "Uranium",
		category: "radioactive",
		symbol: "U",
		description: "Natural fission fuel, baseline power",
		minable: true,
	},
	{
		id: "thorium",
		name: "Thorium",
		category: "radioactive",
		symbol: "Th",
		description: "Alternative fission cycle, safer reactors",
		minable: true,
	},
	{
		id: "deuterium",
		name: "Deuterium",
		category: "radioactive",
		symbol: "D",
		description: "Heavy hydrogen, fusion fuel component",
		minable: true,
	},
	{
		id: "enriched-uranium",
		name: "Enriched Uranium",
		category: "radioactive",
		symbol: "EU",
		description: "Processed from uranium; higher energy density",
		minable: false,
	},
	{
		id: "plutonium",
		name: "Plutonium",
		category: "radioactive",
		symbol: "Pu",
		description: "Bred from uranium in breeder reactors",
		minable: false,
	},
	{
		id: "tritium",
		name: "Tritium",
		category: "radioactive",
		symbol: "T",
		description: "Bred from lithium/heavy water; fusion booster",
		minable: false,
	},
	// Umbral (8)
	{
		id: "ortheum",
		name: "Ortheum",
		category: "umbral",
		symbol: "Or",
		description: "Stable post-baryonic substrate; FTL navigation, gate alignment",
		minable: true,
	},
	{
		id: "cadrine",
		name: "Cadrine",
		category: "umbral",
		symbol: "Cr",
		description: "Curvature-responsive heavy material; gravitic drives, tractor systems",
		minable: true,
	},
	{
		id: "vantine",
		name: "Vantine",
		category: "umbral",
		symbol: "Vt",
		description: "Low-cross-section interaction medium; stealth, ECM",
		minable: true,
	},
	{
		id: "nemorin",
		name: "Nemorin",
		category: "umbral",
		symbol: "Nm",
		description: "Metastable condensate host; shields, capacitors",
		minable: true,
	},
	{
		id: "caritene",
		name: "Caritene",
		category: "umbral",
		symbol: "Ct",
		description: "Dense shear-resistant lattice; armor, structural reinforcement",
		minable: true,
	},
	{
		id: "heliate",
		name: "Heliate",
		category: "umbral",
		symbol: "Hl",
		description: "Energetic transfer medium; reactors, beam weapons",
		minable: true,
	},
	{
		id: "tessarene",
		name: "Tessarene",
		category: "umbral",
		symbol: "Ts",
		description: "Topological-active crystal; jump cores, phase weapons",
		minable: true,
	},
	{
		id: "istrium",
		name: "Istrium",
		category: "umbral",
		symbol: "Is",
		description: "Unstable transitory from collapse events; torpedoes, singularity weapons",
		minable: true,
	},
] as const;

const _byId = new Map<string, ResourceDef>(RESOURCES.map((r) => [r.id, r]));

export function getResourceDef(id: string): ResourceDef | undefined {
	return _byId.get(id);
}

export function getResourcesByCategory(category: ResourceCategory): readonly ResourceDef[] {
	return RESOURCES.filter((r) => r.category === category);
}

export function getMinableResources(): readonly ResourceDef[] {
	return RESOURCES.filter((r) => r.minable);
}

// --- Earth homeworld deposits (all resources available) ---

const EARTH_QUANTITIES: Record<string, { qty: number; access: number }> = {
	// Metals — abundant
	iron: { qty: 50000, access: 0.9 },
	copper: { qty: 25000, access: 0.85 },
	titanium: { qty: 15000, access: 0.7 },
	aluminum: { qty: 35000, access: 0.9 },
	tungsten: { qty: 8000, access: 0.6 },
	// Volatiles — abundant
	water: { qty: 80000, access: 0.95 },
	"helium-3": { qty: 500, access: 0.3 },
	nitrogen: { qty: 40000, access: 0.9 },
	hydrocarbons: { qty: 30000, access: 0.8 },
	carbon: { qty: 20000, access: 0.85 },
	// Industrial — moderate
	silicates: { qty: 60000, access: 0.9 },
	"rare-earths": { qty: 3000, access: 0.5 },
	lithium: { qty: 5000, access: 0.6 },
	germanium: { qty: 1000, access: 0.4 },
	platinum: { qty: 800, access: 0.35 },
	// Radioactive — scarce
	uranium: { qty: 2000, access: 0.5 },
	thorium: { qty: 3000, access: 0.55 },
	plutonium: { qty: 200, access: 0.2 },
	tritium: { qty: 100, access: 0.15 },
	radium: { qty: 500, access: 0.3 },
	// Umbral — rare (deep earth / exotic)
	ortheum: { qty: 50, access: 0.1 },
	cadrine: { qty: 30, access: 0.1 },
	vantine: { qty: 20, access: 0.05 },
	nemorin: { qty: 40, access: 0.1 },
	synthex: { qty: 10, access: 0.05 },
	prothite: { qty: 15, access: 0.05 },
	eclarium: { qty: 5, access: 0.03 },
};

export function generateEarthDeposits(): ResourceDeposit[] {
	return RESOURCES.map((r) => {
		const eq = EARTH_QUANTITIES[r.id] ?? { qty: 100, access: 0.1 };
		return {
			resourceId: r.id,
			quantity: eq.qty,
			accessibility: eq.access,
			mined: 0,
			minSurveyLevel: surveyLevelFromAccess(eq.access),
		};
	});
}

// --- Deposit generation ---

interface WeightedResource {
	id: string;
	weight: number;
}

function pickWeighted(rng: () => number, pool: WeightedResource[]): string {
	const total = pool.reduce((s, e) => s + e.weight, 0);
	let r = rng() * total;
	for (const entry of pool) {
		r -= entry.weight;
		if (r <= 0) return entry.id;
	}
	return pool[pool.length - 1].id;
}

/** Survey level = scan depth. High accessibility = near surface (level 1).
 *  Low accessibility = deep deposits requiring advanced sensors. */
function surveyLevelFromAccess(accessibility: number): number {
	if (accessibility >= 0.5) return 1; // surface/shallow — basic sensors
	if (accessibility >= 0.2) return 2; // mid-depth — improved sensors
	return 3; // deep — advanced sensors
}

function buildPool(bodyType: string, radius: number): WeightedResource[] {
	const isGasGiant = bodyType === "Planet" && radius > 30000;

	if (isGasGiant) {
		return [
			{ id: "helium-3", weight: 30 },
			{ id: "hydrocarbons", weight: 25 },
			{ id: "water", weight: 10 },
			{ id: "nitrogen", weight: 10 },
			{ id: "ortheum", weight: 8 },
			{ id: "cadrine", weight: 7 },
			{ id: "vantine", weight: 5 },
			{ id: "nemorin", weight: 5 },
		];
	}

	if (bodyType === "Comet") {
		return [
			{ id: "water", weight: 50 },
			{ id: "nitrogen", weight: 30 },
			{ id: "hydrocarbons", weight: 15 },
			{ id: "carbon", weight: 5 },
		];
	}

	if (bodyType === "Centaur") {
		return [
			{ id: "water", weight: 30 },
			{ id: "nitrogen", weight: 20 },
			{ id: "hydrocarbons", weight: 15 },
			{ id: "carbon", weight: 10 },
			{ id: "helium-3", weight: 8 },
			{ id: "ortheum", weight: 7 },
			{ id: "nemorin", weight: 5 },
			{ id: "vantine", weight: 5 },
		];
	}

	if (bodyType === "Asteroid") {
		return [
			{ id: "iron", weight: 25 },
			{ id: "nickel-iron", weight: 20 },
			{ id: "platinum", weight: 12 },
			{ id: "titanium", weight: 10 },
			{ id: "silicon", weight: 10 },
			{ id: "copper", weight: 8 },
			{ id: "aluminum", weight: 8 },
			{ id: "rare-earth", weight: 7 },
		];
	}

	// Rocky: Planet, Dwarf Planet, Moon -- default
	return [
		{ id: "iron", weight: 25 },
		{ id: "copper", weight: 15 },
		{ id: "aluminum", weight: 12 },
		{ id: "titanium", weight: 10 },
		{ id: "platinum", weight: 5 },
		{ id: "silicon", weight: 10 },
		{ id: "carbon", weight: 8 },
		{ id: "rare-earth", weight: 5 },
		{ id: "phosphorus", weight: 5 },
		{ id: "uranium", weight: 3 },
		{ id: "thorium", weight: 2 },
	];
}

export function generateDeposits(
	systemSeed: number,
	bodyName: string,
	bodyType: string,
	radius: number,
): ResourceDeposit[] {
	const rng = seededRandom(systemSeed ^ nameHash(bodyName));

	// Advance past the seed's initial LCG position so the empty-check draw
	// is uniformly distributed regardless of the combined seed magnitude.
	rng();

	// 30-40% chance of no deposits
	if (rng() < 0.35) return [];

	const pool = buildPool(bodyType, radius);
	const isComet = bodyType === "Comet";

	// Base quantity scales with body radius; comets are small so use a fixed base
	const baseQuantity = isComet ? 500 : Math.max(1000, radius * 0.5);

	const count = 2 + Math.floor(rng() * 7); // 2-8
	const deposits: ResourceDeposit[] = [];

	for (let i = 0; i < count; i++) {
		const resourceId = pickWeighted(rng, pool);

		const quantity = Math.max(1, Math.floor(rng() * baseQuantity));
		const accessibility = isComet
			? 0.6 + rng() * 0.4 // comets: 0.6–1.0
			: 0.1 + rng() * 0.9; // others: 0.1–1.0

		deposits.push({
			resourceId,
			quantity,
			accessibility,
			mined: 0,
			minSurveyLevel: surveyLevelFromAccess(accessibility),
		});
	}

	return deposits;
}
