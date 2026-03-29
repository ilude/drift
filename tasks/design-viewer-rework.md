# Design Viewer Rework — Aurora-Faithful Update

> **Status:** Phases A–E COMPLETE. All goals implemented. Phases B–D UI shells are functional but missile/turret/sensor mechanics are stubs (design intent — full mechanics deferred).

## Context

The current design viewer uses a continuous slider for engine power modifier. Aurora 4X uses discrete dropdown menus for all engine parameters. The user explicitly chose Approach A (Aurora-faithful) and the slider was an error. Additionally, Aurora's Create Research Project window has bottom-row buttons for switching between Engine, Missile, Turret, and GU designers — we need equivalent tabs.

## Goals

1. Replace engine power modifier slider with Aurora-style discrete dropdowns
2. Add Engine Size parameter (in HS, affects fuel efficiency)
3. Use Aurora's fuel modifier formula: `fuelMod = powerMod ^ 2.5`
4. Add Missile Design, Turret Design, and Sensor Design tabs (placeholder UI, data model stubs)
5. Add Design Errors pane to ship design tab
6. Add component filters (group by category)
7. Add Company Name randomizer for engine/missile/turret naming

## Non-Goals (deferred)
- Ground Unit (GU) design
- Thermal signature system
- Armor grid (NxM) — keep HP-based for now
- Prototype workflow
- Full missile/turret/sensor mechanics (just the design UI shell + data model)

---

## Task Breakdown

### Phase A: Data Model Updates (no UI changes)
**Files:** `src/data/components.ts`, `src/data/ship-designs.ts`, `src/math/ship-design-calc.ts`, `src/types.ts`
**Dependencies:** None
**Agent:** typescript-pro (sonnet)

#### A1: Engine parameter model rework
- Replace `minPowerMod`/`maxPowerMod` floats on `EngineTierDef` with discrete option arrays
- Add `EnginePowerOption`: `{ label: string, powerPct: number, fuelConsumption: number }`
- Add `EngineSizeOption`: `{ sizeHS: number, label: string, fuelReduction: number }`
- Each tier defines its available power options and size options
- Fuel modifier formula: `fuelMod = (powerPct / 100) ^ 2.5` (Aurora's formula)

#### A2: Missile, turret, sensor design interfaces
- `MissileDesign`: `{ id, name, sizeHS, warheadStrength, enginePower, fuelCapacity, sensorStrength, speed, range, damage }`
- `TurretDesign`: `{ id, name, weaponType, trackingSpeed, rateOfFire, damage, range, sizeHS }`
- `SensorDesign`: `{ id, name, sensorType, strength, resolution, sizeHS, range }`
- Add to `AppState`: `missileDesigns`, `turretDesigns`, `sensorDesigns` Maps
- Add save/load serialization for new Maps

#### A3: Update computeEngineStats
- Accept discrete power option + size option instead of continuous powerMod
- New formula using Aurora's exponential fuel cost
- Update `EngineDesign` interface: replace `powerMod: number` with `powerPct: number`, `sizeHS: number`, add `fuelConsumptionPerEPH: number`

#### A4: Tests
- Update `ship-design-calc.test.ts` for new engine parameter model
- Add tests for fuel modifier formula (`powerMod^2.5`)
- Add validation tests for new design types

### Phase B: Engine Design Tab Rework (UI only)
**Files:** `src/ui/design-viewer.ts` (engine tab HTML + JS)
**Dependencies:** Phase A complete
**Agent:** typescript-pro (sonnet)

#### B1: Replace slider with Aurora-style dropdowns
- Engine Tier dropdown (existing, keep)
- Engine Power dropdown: discrete options like "Engine Power: 100%, Fuel Consumption: 1.0" / "Engine Power: 40%, Fuel Consumption: 0.1"
- Fuel Consumption per EPH dropdown: research-gated efficiency tiers
- Engine Size dropdown: 1-50 HS with fuel efficiency label
- Remove the `<input type="range">` entirely

#### B2: Stats readout update
- Show: Engine Power, Fuel Use Per Hour, Fuel Consumption per EPH
- Show: Size (HS), Thermal Signature, Cost, Crew, Development Cost RP
- Show: Materials Required (Gallicite or equivalent)
- Match Aurora's right-side layout

#### B3: Company Name randomizer
- "Company Name" button generates random name from a list
- Pre-populate with sci-fi drive manufacturer names

### Phase C: New Design Tabs (UI shells)
**Files:** `src/ui/design-viewer.ts` (tab bar + new tab HTML + JS)
**Dependencies:** Phase A complete (needs interfaces)
**Agent:** typescript-pro (sonnet)

#### C1: Add tab buttons
- Tab bar: `[Engine Designs] [Ship Designs] [Missile Design] [Turret Design] [Sensor Design]`
- Each tab has the same split-pane layout (list left, form right)

#### C2: Missile Design tab
- Left: existing missile designs list
- Right: form with dropdowns — size (1-6 HS), warhead size, engine type, agility rating, sensor type
- Stats panel showing: speed, range, damage, hit probability
- "Create Missile Design" button
- Research-gated: only shows options player has researched

#### C3: Turret Design tab
- Left: existing turret designs list
- Right: form with dropdowns — weapon type (laser/railgun/gauss/particle beam), tracking speed, caliber
- Stats panel showing: damage, range, rate of fire, tracking speed, accuracy curve
- "Create Turret Design" button

#### C4: Sensor Design tab
- Left: existing sensor designs list
- Right: form with dropdowns — sensor type (geological/gravitational/active/passive thermal/passive EM), resolution, size
- Stats panel showing: range, resolution, detection capabilities
- "Create Sensor Design" button

### Phase D: Ship Design Tab Improvements
**Files:** `src/ui/design-viewer.ts` (ship tab HTML + JS)
**Dependencies:** Phase A, Phase C (missile/turret/sensor designs available as components)
**Agent:** typescript-pro (sonnet)

#### D1: Design Errors pane
- Below the stats panel
- Lists validation errors in red: "No bridge", "Insufficient life support", "Weapons without fire control", etc.
- Updates in real-time as components change

#### D2: Component category grouping
- Dropdown uses `<optgroup>` for each category (Propulsion, Crew, Cargo, Sensors, Weapons, Defense, Logistics)
- Player-designed engines, missiles, turrets, sensors appear in their respective groups
- "Show All" / category filter buttons above component list

#### D3: Player-designed components in ship designer
- Engine designs appear in the engine dropdown (already works)
- Missile designs appear as launchable ordnance components
- Turret designs appear as beam weapon components
- Sensor designs appear as sensor components

### Phase E: Save/Load & State Integration
**Files:** `src/core/state.ts`, `src/types.ts`
**Dependencies:** Phase A
**Agent:** typescript-pro (haiku)

#### E1: Serialize new design types
- Add missileDesigns, turretDesigns, sensorDesigns to saveState()
- Add deserialization in restoreDesignState()
- No version bump needed (optional fields with `??` defaults)

### Phase F: Documentation & Commit
**Files:** `.claude/CLAUDE.md`, `tasks/decisions.md`, memory
**Dependencies:** All phases complete
**Agent:** haiku

---

## Dependency Graph

```
Phase A (Data Model) ──┬── Phase B (Engine Tab Rework)
                       ├── Phase C (New Tabs)
                       ├── Phase E (Save/Load)
                       │
                       └── Phase D (Ship Tab Improvements)
                                ↑
                           Phase C (needs missile/turret/sensor designs)
```

**Parallelizable:** A is prerequisite for everything. Once A is done:
- B, C, E can all run in parallel
- D depends on C completing first
- F runs last

## Execution Strategy

1. **Wave 1:** Phase A (data model) — single typescript-pro agent
2. **Wave 2:** Phases B + C + E in parallel — 3 agents
3. **Wave 3:** Phase D (ship tab improvements) — single agent, after C completes
4. **Wave 4:** Phase F (docs) + verify — haiku agent

## Verification

After each wave:
- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build`

End-to-end:
- Open Designs popout → 5 tabs visible
- Engine tab: all dropdowns, no slider, stats update on selection
- Missile/Turret/Sensor tabs: can create placeholder designs
- Ship tab: errors pane shows validation, components grouped by category
- Save → reload → all designs persist
