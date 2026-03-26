# Aurora 4X Ship Design → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

Aurora treats ship design as a foundational strategic lever. Ships are built from discrete components measured in hull spaces (HS, ~50 tons each), with no hard upper size limit. Key mechanics:

- **Hull Classes:** 500-ton destroyers to 50,000+ ton capital ships, classified by displacement tonnage
- **Armor Layers:** 0–9+ layers of advancing materials. Each layer trades firepower/sensors/fuel for durability
- **Engines:** 15 tiers (1.0→100.0 EP/HS). Fuel consumption is quadratic: 10% power boost above 100% multiplies fuel by 25% compounding. High-speed builds hemorrhage fuel.
- **Sensors:** Passive thermal (engine heat), passive EM (active systems), active (targeting). Resolution must match target size.
- **Weapons:** Lasers, kinetics, missiles, plasma carronades, meson cannons (armor-bypassing), particle beams
- **Maintenance:** Ships degrade over time. Engineering spaces (5–10% of hull) dramatically reduce failure rates. Ships without engineering face catastrophic cascading failures.
- **Construction:** Shipyards with minimum capacities build ships over months to years

**Design philosophy:** Hard tradeoffs enforced by tonnage. Every ton of weapon is a ton of fuel/sensors/armor you didn't bring.

---

## Drift Design Constraints

- **Single engine per ship:** `engineId` string, one of 4 ENGINE_TYPES (conventional, improved, advanced, extreme) — all have identical `dryMassKg: 5000`
- **Fixed ship specs at creation:** `dryMassKg`, `fuelKg`, `fuelCapacityKg` set via `ShipConfig`
- **Brachistochrone transfers:** Constant-burn straight-line transfers in world space
- **Hull integrity mechanics:** `hullCeiling(totalAge, lastRefitAge)`, overhaul/major-refit system fully implemented
- **Bathtub curve malfunctions:** Phase 1 (infant mortality), Phase 2 (constant), Phase 3 (wear-out)
- **Shipyard colony installation:** Exists, affects `colonyQualities.shipbuilding` multiplier
- **Design goal:** Meaningful role differentiation without overwhelming complexity. No dominant strategy.

---

## Drift Implementation Sketches

### 1. Fuel Economy Modifiers on Engine Tiers

**Gap:** All 4 ENGINE_TYPES have equal fuel economy — differentiation is only acceleration.

**What to add:** `fuelEconomyModifier` field — faster engines cost more per day of transfer.

```typescript
interface EngineType {
  id: string;
  name: string;
  accelG: number;
  ispS: number;
  dryMassKg: number;
  fuelEconomyModifier: number;  // 1.0 = baseline, 0.7 = efficient, 1.5 = power-hungry
  requiredTech?: string;        // tech gate (see research implementation)
}

// Updated ENGINE_TYPES:
{ id: "conventional",  accelG: 0.1,  fuelEconomyModifier: 1.0 }  // baseline
{ id: "improved",      accelG: 10,   fuelEconomyModifier: 0.8 }  // 20% more efficient
{ id: "advanced",      accelG: 50,   fuelEconomyModifier: 0.6 }  // 40% more efficient
{ id: "extreme",       accelG: 200,  fuelEconomyModifier: 1.5 }  // power-hungry, ultra-fast
```

Apply in `checkTransfer()`: `fuelUsedKg = baseFuelUsed * engine.fuelEconomyModifier`

**Why:** Creates the Aurora tradeoff — fast ships burn through reserves faster. Tankers want efficient engines; scouts can afford expensive burns.

---

### 2. Dry Mass Configuration (Ship Sizing)

**Gap:** All ships have the same dry mass as their engine (5,000 kg). No size variation.

**What to add:** `dryMassKg` and `fuelRatioToMass` in ShipConfig.

```typescript
interface ShipConfig {
  name: string;
  hostPlanetName: string;
  engineId?: string;
  color?: string;
  dryMassKg?: number;            // hull/structure mass (default: engine.dryMassKg)
  fuelRatioToMass?: number;      // fuelCapacity = dryMass × ratio (default: 3)
  fuelCapacityKg?: number;       // overrides ratio if specified directly
}

// In createShip():
const resolvedDryMassKg = config.dryMassKg ?? engine.dryMassKg;
const fuelRatio = config.fuelRatioToMass ?? 3;
const resolvedFuelCapacity = config.fuelCapacityKg ?? (resolvedDryMassKg * fuelRatio);
```

**Effect:** Heavier ships = slower (more total mass, same engine acceleration) but larger absolute fuel tanks = longer range. Mirrors Aurora: hull size determines endurance.

---

### 3. Ship Role Archetypes (Inferred from Design)

**What to add:** Role inferred from build parameters — no hardcoded role flag.

```typescript
type ShipRole = "scout" | "tanker" | "explorer" | "cruiser";

export function inferShipRole(dryMassKg: number, fuelRatio: number, accelG: number): ShipRole {
  if (accelG >= 50 && fuelRatio < 2.5) return "scout";
  if (fuelRatio >= 4.0 && accelG < 5) return "tanker";
  if (accelG >= 5 && fuelRatio >= 2.5 && fuelRatio < 4.0) return "explorer";
  return "cruiser";
}
```

Display role badge in ship info panel. Role can inform command tree defaults (scouts survey more aggressively, tankers prioritize refuel-ship orders).

---

### 4. Ship Class Templates

**What to add:** Predefined templates for quick ship creation.

```typescript
interface ShipClassTemplate {
  id: string;
  name: string;
  description: string;
  engineId: string;
  dryMassKg: number;
  fuelRatioToMass: number;
  requiredTech?: string;    // research gate for advanced classes
}

export const SHIP_CLASSES: ShipClassTemplate[] = [
  {
    id: "courier",
    name: "Courier Scout",
    description: "Fast, fuel-efficient explorer. 6-month endurance.",
    engineId: "improved",
    dryMassKg: 8_000,
    fuelRatioToMass: 2.5,
  },
  {
    id: "tanker",
    name: "Logistics Tanker",
    description: "Heavy fuel capacity. 18-month endurance, minimal acceleration.",
    engineId: "conventional",
    dryMassKg: 20_000,
    fuelRatioToMass: 4.5,
  },
  {
    id: "explorer",
    name: "Survey Cruiser",
    description: "Balanced. 12-month endurance, moderate acceleration.",
    engineId: "improved",
    dryMassKg: 12_000,
    fuelRatioToMass: 3.0,
  },
  {
    id: "heavy",
    name: "Heavy Cruiser",
    description: "Maximum range and endurance. Slow but resilient.",
    engineId: "advanced",
    dryMassKg: 25_000,
    fuelRatioToMass: 3.5,
    requiredTech: "improved-propulsion",
  },
];
```

---

### 5. Hull Ceiling → Automatic Major Refit Trigger

**Gap:** Hull ceiling exists but doesn't automatically trigger refits.

**What to add:** `shouldAutoRefit()` check in command tree evaluation.

```typescript
export function shouldAutoRefit(ship: ShipEntry): boolean {
  const ceiling = hullCeiling(ship.maintenance.totalAge, ship.maintenance.lastRefitAge);
  // Trigger when hull integrity has reached the ceiling (can't be restored further without refit)
  return ship.maintenance.hullIntegrity >= ceiling * 0.95 && ceiling < 90;
}
```

Ships with hull ceiling below 90% and at their ceiling should autonomously queue major-refit when at a colony with a repair yard.

---

### 6. Shipyard Production Queue (Phase 2 Placeholder)

**Gap:** Shipyard colony installation affects quality but doesn't build ships.

**Conceptual addition** (defer actual implementation to v2):

```typescript
interface ShipProductionOrder {
  id: string;
  classId: string;
  colonyBodyName: string;
  progressDays: number;
  estimatedCompletionDay: number;
  status: "queued" | "building" | "complete";
}

export function estimateBuildTime(dryMassKg: number, colonyQuality: number): number {
  const baseTime = 180;  // days
  const massScaling = dryMassKg / 5_000;  // relative to default
  return (baseTime * massScaling) / colonyQuality;
}
```

**Why defer:** Requires save format changes, new UI panel, and colony workforce integration. Ship design parameters (dry mass, engine, fuel ratio) should be established first.

---

## Recommended Next Steps (Prioritized)

1. **Fuel economy modifiers** — Add `fuelEconomyModifier` to ENGINE_TYPES; apply in `checkTransfer()`. Small change, high impact on strategy.
2. **Dry mass configuration** — Extend `ShipConfig` with `dryMassKg` and `fuelRatioToMass`. Update `createShip()`.
3. **Ship class templates** — Define SHIP_CLASSES; add `createShipFromClass()`; update ship creation UI with class picker.
4. **Role inference** — Add `inferShipRole()`; display role badge in ship info panel.
5. **Auto-refit trigger** — `shouldAutoRefit()` check; ships at colony with low ceiling queue major-refit.
6. **Research gates on engines** — Add `requiredTech` to EngineType; filter in ship designer (depends on research tech tree expansion).
7. **Shipyard production queue** — Full ship construction from colony (Phase 2, after above are stable).

---

## Anti-patterns to Avoid

- **Per-component tonnage accounting** — Aurora's component-by-component design is too complex. Use role archetypes + high-level parameters (engine, dry mass, fuel ratio).
- **Armor facing & per-column damage** — Drift uses flat hull integrity %. No per-facing damage.
- **Hard tonnage limits by tech level** — Don't gate max ship size by research. Scale costs/time by size instead; economics will constrain.
- **Exact per-component placement** — No placement UI. Fixed architecture (engine, fuel, sensors as role attributes).
- **Real-time fuel depletion during transfer** — Calculate once at transfer start, deduct at end. No mid-transfer fuel bar.
- **Sensor resolution per ship** — Derive sensor quality from ship role + research tier. No slider.
- **Sub-day maintenance granularity** — Maintenance checks once per N days; supplies drain daily. No hourly modeling.
