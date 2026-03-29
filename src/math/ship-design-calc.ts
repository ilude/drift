// Pure calculation functions for ship design stats.
// Imports only from data/components, data/ship-designs, and the G_ACCEL constant.

import type { ComponentDef, EngineTierDef } from "../data/components";
import { COMPONENT_DEFS } from "../data/components";
import type { EngineDesign, ShipDesignComponent } from "../data/ship-designs";
/**
 * Compute engine stats from a tier definition, power percentage, and size in Hull Spaces.
 *
 * - accelG scales linearly with powerPct (more power → more thrust)
 * - ispS is constant per tier — fuel tradeoff is expressed entirely through fuelMod
 * - massKg = sizeHS * baseMassPerHS
 * - fuelMod = (powerPct/100)^2.5 * (1 - sizeHS/100), clamped to min 0.01
 */
export function computeEngineStats(
	tier: EngineTierDef,
	powerPct: number,
	sizeHS: number,
): { accelG: number; ispS: number; massKg: number; fuelMod: number } {
	const fuelMod = Math.max(0.01, (powerPct / 100) ** 2.5 * (1 - sizeHS / 100));
	return {
		accelG: tier.baseAccelG * (powerPct / 100),
		ispS: tier.baseIspS,
		massKg: sizeHS * tier.baseMassPerHS,
		fuelMod,
	};
}

interface ShipStats {
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

interface ComponentTotals {
	massKg: number;
	fuelCapacityKg: number;
	cargoCapacityKg: number;
	crewCapacity: number;
	maxSupplies: number;
	bestSensorBonus: number;
	armorHp: number;
}

function accumulateSlot(totals: ComponentTotals, def: ComponentDef, count: number): void {
	totals.massKg += def.massKg * count;
	totals.fuelCapacityKg += (def.fuelCapacityKg ?? 0) * count;
	totals.cargoCapacityKg += (def.cargoCapacityKg ?? 0) * count;
	totals.crewCapacity += (def.crewCapacity ?? 0) * count;
	totals.maxSupplies += (def.suppliesCapacity ?? 0) * count;
	totals.armorHp += (def.armorHp ?? 0) * count;
	// Sensors: take the best single unit, not the sum
	if ((def.sensorBonus ?? 0) > totals.bestSensorBonus) {
		totals.bestSensorBonus = def.sensorBonus ?? 0;
	}
}

function accumulateComponents(components: ShipDesignComponent[]): ComponentTotals {
	const totals: ComponentTotals = {
		massKg: 0,
		fuelCapacityKg: 0,
		cargoCapacityKg: 0,
		crewCapacity: 0,
		maxSupplies: 0,
		bestSensorBonus: 0,
		armorHp: 0,
	};
	for (const slot of components) {
		const def = COMPONENT_DEFS.find((c) => c.id === slot.componentId);
		if (def) accumulateSlot(totals, def, slot.count);
	}
	return totals;
}

/**
 * Derive all ship stats from an engine design and a list of components.
 *
 * Sensor bonuses take the best single value (not summed) — better sensors
 * replace lesser ones rather than stacking. All other capabilities sum across
 * all components of that type.
 *
 * Ship accelG = (engineAccelG * engineMassKg * engineCount) / dryMassKg
 * This preserves the identity: a ship whose dry mass equals one engine mass
 * accelerates at exactly that engine's accelG.
 */
export function computeShipStats(
	engineDesign: EngineDesign,
	engineCount: number,
	components: ShipDesignComponent[],
): ShipStats {
	const totals = accumulateComponents(components);
	const dryMassKg = totals.massKg + engineDesign.massKg * engineCount;

	// Total thrust (in mass-equivalent units) divided by total dry mass.
	// Force of one engine = accelG * massKg * G_ACCEL (Newtons).
	// Ship accelG = totalForce / (dryMassKg * G_ACCEL) = accelG * massKg * count / dryMassKg.
	const accelG =
		dryMassKg > 0 ? (engineDesign.accelG * engineDesign.massKg * engineCount) / dryMassKg : 0;

	return {
		dryMassKg,
		fuelCapacityKg: totals.fuelCapacityKg,
		cargoCapacityKg: totals.cargoCapacityKg,
		crewCapacity: totals.crewCapacity,
		maxSupplies: totals.maxSupplies,
		sensorMultiplier: totals.bestSensorBonus,
		accelG,
		ispS: engineDesign.ispS,
		armorHp: totals.armorHp,
	};
}

interface ValidationResult {
	valid: boolean;
	errors: string[];
}

/**
 * Validate a ship design for minimum viability.
 *
 * Rules:
 * - At least 1 engine
 * - Exactly 1 bridge component (total count across all bridge slots = 1)
 * - At least 1 crew-quarters component
 * - At least 1 fuel-tank component
 */
export function validateShipDesign(
	engineCount: number,
	components: ShipDesignComponent[],
): ValidationResult {
	const errors: string[] = [];

	if (engineCount < 1) {
		errors.push("Ship must have at least one engine.");
	}

	let bridgeCount = 0;
	let hasCrewQuarters = false;
	let hasFuelTank = false;

	for (const slot of components) {
		const def = COMPONENT_DEFS.find((c) => c.id === slot.componentId);
		if (!def) continue;

		if (def.category === "bridge") bridgeCount += slot.count;
		if (def.category === "crew-quarters") hasCrewQuarters = true;
		if (def.category === "fuel-tank") hasFuelTank = true;
	}

	if (bridgeCount !== 1) {
		errors.push(`Ship must have exactly 1 bridge (found ${bridgeCount}).`);
	}

	if (!hasCrewQuarters) {
		errors.push("Ship must have at least one crew quarters component.");
	}

	if (!hasFuelTank) {
		errors.push("Ship must have at least one fuel tank component.");
	}

	return { valid: errors.length === 0, errors };
}
