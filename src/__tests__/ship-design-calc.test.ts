import { describe, expect, it } from "vitest";
import {
	type ComponentDef,
	type EngineTierDef,
	findComponent,
	findEngineTier,
	getUnlockedComponents,
	getUnlockedEngineTiers,
} from "../data/components";
import type { EngineDesign, ShipDesignComponent } from "../data/ship-designs";
import { computeEngineStats, computeShipStats, validateShipDesign } from "../math/ship-design-calc";

// --- Helpers ---

function requireTier(id: string): EngineTierDef {
	const t = findEngineTier(id);
	if (!t) throw new Error(`Engine tier not found: ${id}`);
	return t;
}

function requireComponent(id: string): ComponentDef {
	const c = findComponent(id);
	if (!c) throw new Error(`Component not found: ${id}`);
	return c;
}

function makeEngineDesign(overrides: Partial<EngineDesign> = {}): EngineDesign {
	const tier = requireTier("conventional");
	const stats = computeEngineStats(tier, 100, 10);
	return {
		id: "eng-1",
		name: "Test Engine",
		tierId: "conventional",
		powerPct: 100,
		sizeHS: 10,
		accelG: stats.accelG,
		ispS: stats.ispS,
		massKg: stats.massKg,
		fuelMod: stats.fuelMod,
		...overrides,
	};
}

// Basic explorer: bridge + crew + fuel + maintenance + sensor + 1 engine
const EXPLORER_COMPONENTS: ShipDesignComponent[] = [
	{ componentId: "bridge-standard", count: 1 },
	{ componentId: "crew-small", count: 1 },
	{ componentId: "fuel-standard", count: 1 },
	{ componentId: "maint-basic", count: 1 },
	{ componentId: "sensor-basic", count: 1 },
];

// --- computeEngineStats ---

describe("computeEngineStats", () => {
	it("100% power, 10 HS returns expected values", () => {
		const tier = requireTier("conventional");
		const stats = computeEngineStats(tier, 100, 10);
		expect(stats.accelG).toBe(0.1);
		expect(stats.ispS).toBe(1_000_000);
		expect(stats.massKg).toBe(10 * tier.baseMassPerHS);
		expect(stats.fuelMod).toBeCloseTo(1.0 * 0.9, 4); // 100%^2.5 * (1 - 10/100)
	});

	it("50% power has lower accel and much lower fuel modifier", () => {
		const stats = computeEngineStats(requireTier("conventional"), 50, 10);
		expect(stats.accelG).toBeCloseTo(0.05, 10);
		expect(stats.ispS).toBe(1_000_000); // Isp constant per tier
		expect(stats.fuelMod).toBeCloseTo(Math.pow(0.5, 2.5) * 0.9, 4);
	});

	it("150% power has higher accel but exponentially higher fuel", () => {
		const stats = computeEngineStats(requireTier("conventional"), 150, 10);
		expect(stats.accelG).toBeCloseTo(0.15, 10);
		expect(stats.fuelMod).toBeCloseTo(Math.pow(1.5, 2.5) * 0.9, 4);
	});

	it("larger engine size reduces fuel modifier", () => {
		const stats10 = computeEngineStats(requireTier("conventional"), 100, 10);
		const stats30 = computeEngineStats(requireTier("conventional"), 100, 30);
		expect(stats30.fuelMod).toBeLessThan(stats10.fuelMod);
		expect(stats30.massKg).toBeGreaterThan(stats10.massKg);
	});
});

// --- computeShipStats: basic explorer ---

describe("computeShipStats — basic explorer", () => {
	const engine = makeEngineDesign();
	// bridge(500) + crew-small(1000) + fuel-standard(1000) + maint-basic(800) + sensor-basic(300) = 3600
	// + engine(3000) = 6600 dry mass
	const stats = computeShipStats(engine, 1, EXPLORER_COMPONENTS);

	it("dryMassKg sums all component masses plus engine mass", () => {
		const componentMass = 500 + 1_000 + 1_000 + 800 + 300; // 3600
		expect(stats.dryMassKg).toBe(componentMass + engine.massKg);
	});

	it("fuelCapacityKg matches fuel-standard", () => {
		expect(stats.fuelCapacityKg).toBe(requireComponent("fuel-standard").fuelCapacityKg);
	});

	it("crewCapacity matches crew-small", () => {
		expect(stats.crewCapacity).toBe(requireComponent("crew-small").crewCapacity);
	});

	it("maxSupplies matches maint-basic", () => {
		expect(stats.maxSupplies).toBe(requireComponent("maint-basic").suppliesCapacity);
	});

	it("sensorMultiplier matches sensor-basic bonus", () => {
		expect(stats.sensorMultiplier).toBe(requireComponent("sensor-basic").sensorBonus);
	});

	it("cargoCapacityKg is 0 with no cargo bay", () => {
		expect(stats.cargoCapacityKg).toBe(0);
	});

	it("armorHp is 0 with no armor", () => {
		expect(stats.armorHp).toBe(0);
	});

	it("ispS equals engine ispS", () => {
		expect(stats.ispS).toBe(engine.ispS);
	});

	it("accelG identity: single engine ship where dryMass = engineMass → accelG = engineAccelG", () => {
		// A ship with zero component mass has dryMass = engineMass, so accelG = engineAccelG.
		const soloEngine = makeEngineDesign();
		const soloStats = computeShipStats(soloEngine, 1, []);
		expect(soloStats.accelG).toBeCloseTo(soloEngine.accelG, 10);
	});
});

// --- computeShipStats: tanker with multiple fuel tanks ---

describe("computeShipStats — tanker fuel stacking", () => {
	it("two standard fuel tanks double fuelCapacityKg", () => {
		const engine = makeEngineDesign();
		const fuelCap = requireComponent("fuel-standard").fuelCapacityKg ?? 0;
		const tankerComponents: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 1 },
			{ componentId: "crew-small", count: 1 },
			{ componentId: "fuel-standard", count: 2 },
		];
		const stats = computeShipStats(engine, 1, tankerComponents);
		expect(stats.fuelCapacityKg).toBe(fuelCap * 2);
	});

	it("mixed fuel tanks sum correctly", () => {
		const engine = makeEngineDesign();
		const smallCap = requireComponent("fuel-small").fuelCapacityKg ?? 0;
		const standardCap = requireComponent("fuel-standard").fuelCapacityKg ?? 0;
		const components: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 1 },
			{ componentId: "crew-small", count: 1 },
			{ componentId: "fuel-small", count: 1 },
			{ componentId: "fuel-standard", count: 1 },
		];
		const stats = computeShipStats(engine, 1, components);
		expect(stats.fuelCapacityKg).toBe(smallCap + standardCap);
	});
});

// --- computeShipStats: multi-engine acceleration scaling ---

describe("computeShipStats — multi-engine accel scaling", () => {
	it("doubling engine count increases accelG (scales with thrust-to-mass ratio)", () => {
		const engine = makeEngineDesign();
		const stats1 = computeShipStats(engine, 1, EXPLORER_COMPONENTS);
		const stats2 = computeShipStats(engine, 2, EXPLORER_COMPONENTS);
		expect(stats2.accelG).toBeGreaterThan(stats1.accelG);
	});

	it("accelG formula: engineAccelG * engineMassKg * count / dryMassKg", () => {
		const engine = makeEngineDesign();
		const engineCount = 3;
		const stats = computeShipStats(engine, engineCount, EXPLORER_COMPONENTS);
		const componentMass = 500 + 1_000 + 1_000 + 800 + 300;
		const dryMass = componentMass + engine.massKg * engineCount;
		const expected = (engine.accelG * engine.massKg * engineCount) / dryMass;
		expect(stats.accelG).toBeCloseTo(expected, 10);
	});
});

// --- computeShipStats: sensor takes best, not sum ---

describe("computeShipStats — sensor multiplier", () => {
	it("takes the best sensor bonus, not the sum", () => {
		const engine = makeEngineDesign();
		const basicBonus = requireComponent("sensor-basic").sensorBonus ?? 0;
		const improvedBonus = requireComponent("sensor-improved").sensorBonus ?? 0;
		const components: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 1 },
			{ componentId: "crew-small", count: 1 },
			{ componentId: "fuel-standard", count: 1 },
			{ componentId: "sensor-basic", count: 1 },
			{ componentId: "sensor-improved", count: 1 },
		];
		const stats = computeShipStats(engine, 1, components);
		// Should be max(1.0, 1.5) = 1.5, not 1.0 + 1.5 = 2.5
		expect(stats.sensorMultiplier).toBe(improvedBonus);
		expect(stats.sensorMultiplier).not.toBe(basicBonus + improvedBonus);
	});
});

// --- validateShipDesign ---

describe("validateShipDesign — valid design", () => {
	it("valid design with bridge, crew, and fuel passes", () => {
		const result = validateShipDesign(1, EXPLORER_COMPONENTS);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});
});

describe("validateShipDesign — missing bridge", () => {
	it("fails when no bridge component is present", () => {
		const components: ShipDesignComponent[] = [
			{ componentId: "crew-small", count: 1 },
			{ componentId: "fuel-standard", count: 1 },
		];
		const result = validateShipDesign(1, components);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.toLowerCase().includes("bridge"))).toBe(true);
	});

	it("fails when two bridges are present", () => {
		const components: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 2 },
			{ componentId: "crew-small", count: 1 },
			{ componentId: "fuel-standard", count: 1 },
		];
		const result = validateShipDesign(1, components);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.toLowerCase().includes("bridge"))).toBe(true);
	});
});

describe("validateShipDesign — missing crew", () => {
	it("fails when no crew quarters component is present", () => {
		const components: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 1 },
			{ componentId: "fuel-standard", count: 1 },
		];
		const result = validateShipDesign(1, components);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.toLowerCase().includes("crew"))).toBe(true);
	});
});

describe("validateShipDesign — missing fuel", () => {
	it("fails when no fuel tank component is present", () => {
		const components: ShipDesignComponent[] = [
			{ componentId: "bridge-standard", count: 1 },
			{ componentId: "crew-small", count: 1 },
		];
		const result = validateShipDesign(1, components);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.toLowerCase().includes("fuel"))).toBe(true);
	});
});

describe("validateShipDesign — zero engines", () => {
	it("fails when engineCount is 0", () => {
		const result = validateShipDesign(0, EXPLORER_COMPONENTS);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.toLowerCase().includes("engine"))).toBe(true);
	});
});

// --- getUnlockedEngineTiers ---

describe("getUnlockedEngineTiers", () => {
	it("empty tech set returns only conventional (no prereq)", () => {
		const tiers = getUnlockedEngineTiers(new Set());
		expect(tiers).toHaveLength(1);
		expect(tiers[0].id).toBe("conventional");
	});

	it("with fleet-logistics unlocked, returns conventional + improved", () => {
		const tiers = getUnlockedEngineTiers(new Set(["fleet-logistics"]));
		const ids = tiers.map((t) => t.id);
		expect(ids).toContain("conventional");
		expect(ids).toContain("improved");
		expect(ids).toHaveLength(2);
	});

	it("all prereqs unlocked returns all four tiers", () => {
		const tiers = getUnlockedEngineTiers(
			new Set(["fleet-logistics", "applied-physics", "unified-field-theory"]),
		);
		expect(tiers).toHaveLength(4);
	});
});

// --- getUnlockedComponents ---

describe("getUnlockedComponents", () => {
	it("empty tech set returns only base components (no prereq)", () => {
		const components = getUnlockedComponents(new Set());
		expect(components.every((c) => c.prerequisiteTech === null)).toBe(true);
		// Spot-check known base components are present
		const ids = components.map((c) => c.id);
		expect(ids).toContain("bridge-standard");
		expect(ids).toContain("crew-small");
		expect(ids).toContain("fuel-standard");
		expect(ids).toContain("sensor-basic");
	});

	it("tech-gated components are excluded without the prereq", () => {
		const components = getUnlockedComponents(new Set());
		const ids = components.map((c) => c.id);
		expect(ids).not.toContain("crew-large"); // requires closed-cycle-life-support
		expect(ids).not.toContain("sensor-improved"); // requires advanced-telemetry
	});

	it("tech-gated component is included once its prereq is researched", () => {
		const components = getUnlockedComponents(new Set(["advanced-telemetry"]));
		const ids = components.map((c) => c.id);
		expect(ids).toContain("sensor-improved");
	});
});

describe("computeShipStats — zero dryMass guard", () => {
	it("returns accelG 0 when engineCount is 0 and no components", () => {
		const engine = makeEngineDesign();
		const stats = computeShipStats(engine, 0, []);
		expect(stats.accelG).toBe(0);
		expect(stats.dryMassKg).toBe(0);
	});
});
