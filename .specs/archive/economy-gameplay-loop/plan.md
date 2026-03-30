---
created: 2026-03-30
status: completed
completed: 2026-03-30
---

# Plan: Economy Gameplay Loop

## Context & Motivation

Drift has solid foundations — ships transfer, surveys reveal deposits, colonies mine resources,
construction builds installations, research unlocks techs. But the economy is inert: supplies
never deplete, construction resources are enforced but there's no pressure to mine, fuel
production is a placeholder (Earth generates 5000 kg/day magically), academies exist but
produce nothing, and ships can't run cargo routes.

These 5 features create the core economic pressure loop:
1. **Supply consumption** forces logistics planning (colonies need feeding)
2. **Resource costs already enforced** but mining needs to feel necessary
3. **Fuel refinery** replaces Earth's magic fuel tap with real production
4. **Academy scientist generation** creates the research pipeline
5. **Mission order UI** lets players set up cargo routes to feed it all

Together: mine methane → refine fuel → supply colonies → run cargo → train scientists → research.

## Constraints

- Platform: Windows 11, bash shell
- All 773+ tests must continue passing
- Zero lint (biome), zero type errors (tsc)
- Deterministic: all rates use existing `depotQuality` × `hardnessMultiplier` pattern
- No new files except tests — all features extend existing modules
- Mission order core logic already exists in `src/core/cargo.ts` — this plan adds the UI
- Earth fuel placeholder stays during transition (remove only after refinery is tested)

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Implement all 5 as one integrated batch | Systems chain naturally | Large scope, hard to test incrementally | Rejected: too monolithic |
| Implement in dependency order with validation gates | Each wave is independently testable | Slightly more overhead | **Selected** |
| Skip supply consumption, just add fuel refinery | Simpler | No economic pressure from population | Rejected: supply drain is the core pressure source |

## Objective

When complete: colonies consume supplies (creating demand), fuel refineries convert methane
to fuel (replacing the Earth placeholder), academies produce scientists over time, and
players can assign mission order sequences to ships via UI for cargo logistics.

## Project Context

- **Language**: TypeScript (Vite + Three.js)
- **Test command**: `bun run test`
- **Lint command**: `bun run lint`
- **Typecheck**: `bun run typecheck`

## Task Breakdown

| # | Task | Files | Type | Model | Agent | Depends On |
|---|------|-------|------|-------|-------|------------|
| T1 | Population supply consumption | 3 | feature | sonnet | builder | — |
| T2 | Fuel refinery installation | 3 | feature | sonnet | builder | — |
| T3 | Academy scientist generation | 3 | feature | sonnet | builder | — |
| V1 | Validate wave 1 | — | validation | sonnet | validator-heavy | T1, T2, T3 |
| T4 | Mission order UI | 4 | feature | opus | builder-heavy | V1 |
| V2 | Validate wave 2 | — | validation | sonnet | validator-heavy | T4 |

## Execution Waves

### Wave 1 (parallel)

**T1: Population supply consumption** [sonnet] — builder

- Description: Add per-tick supply drain to colonies based on population. When supplies
  run out, apply a quality penalty that reduces all colony output (mining, construction,
  research, training). Add colony warning for low supplies.

  Implementation:
  1. In `src/core/colonies.ts`, add `tickSupplyConsumption(colony, simDtDays, qualities)`:
     - `dailyDrain = colony.population * SUPPLY_CONSUMPTION_RATE * simDtDays`
       where `SUPPLY_CONSUMPTION_RATE = 0.001` (1 supply per 1000 pop per day)
     - Scale by `state.supplyMultiplier` (existing hardness multiplier)
     - Deduct from `colony.stockpile.supplies`
     - If supplies hit 0, set a `supplyShortage` flag on colony qualities
  2. In `computeColonyQualities()`, when `colony.stockpile.supplies <= 0`, apply a 0.5×
     penalty multiplier to construction, mining, research, repair qualities.
     When supplies < 30 days worth, apply proportional penalty (lerp from 1.0 to 0.5).
  3. Call `tickSupplyConsumption()` in `tickColony()` BEFORE other ticks so quality
     penalty applies to the current frame.
  4. Add `colony-low-supplies` warning type in `checkColonyWarnings()` when
     `supplies < population * SUPPLY_CONSUMPTION_RATE * 90` (< 90 days remaining).
  5. Earth starts with 50,000 supplies (check current seed value and adjust if needed).
  6. Export `computeSupplyDrain` as a pure function for testing.

- Files:
  - `src/core/colonies.ts` — add consumption tick, quality penalty, warning
  - `src/types.ts` — add `colony-low-supplies` to notification types if needed
  - `src/__tests__/colonies.test.ts` — add tests

- Acceptance Criteria:
  1. [ ] Supply drain proportional to population
     - Verify: `bun run test` — new test: colony with 100K pop loses ~100 supplies/day
     - Pass: Test passes
     - Fail: Rate calculation wrong
  2. [ ] Quality penalty when supplies exhausted
     - Verify: `bun run test` — new test: zero supplies → 0.5× quality multiplier
     - Pass: Test passes
     - Fail: Penalty not applied or wrong factor
  3. [ ] Colony warning fires at <90 days supply
     - Verify: `bun run test` — new test: low supply triggers warning
     - Pass: Test passes
     - Fail: Warning not generated
  4. [ ] Pure function `computeSupplyDrain` exported and tested
     - Verify: grep for export + test cases
     - Pass: Function exists with 3+ tests
     - Fail: Missing export or tests

**T2: Fuel refinery installation** [sonnet] — builder

- Description: Add a fuel refinery installation type that converts methane (resource)
  into ship fuel (fuelKg in stockpile). This replaces Earth's placeholder fuel tap.

  Implementation:
  1. In `src/core/colonies.ts`, add to `CONSTRUCTION_DEFS`:
     ```
     { id: "fuel-refinery", name: "Fuel Refinery", bpCost: 100,
       resourceCost: { iron: 400, copper: 150, methane: 200 },
       workersRequired: 50_000 }
     ```
  2. Add `fuelRefinery: number` to `ColonyInstallations` in `src/types.ts`.
     Default to 0 in colony creation. Add worker cost to `INSTALLATION_WORKERS`.
  3. Add `tickFuelRefinery(colony, simDtDays, qualities)`:
     - Per refinery: consume methane from stockpile, produce fuel
     - Rate: `BASE_REFINERY_RATE * refineryCount * qualities.construction * simDtDays`
       where `BASE_REFINERY_RATE = 500` (kg fuel per refinery per day at quality 1.0)
     - Conversion: 1 unit methane → 200 kg fuel (methane is energy-dense)
     - Scale by `state.fuelBurnMultiplier` (reuse existing hardness axis)
     - Cap by methane availability in stockpile
  4. Call `tickFuelRefinery()` in `tickColony()` after mining (so freshly mined methane
     can be refined same tick).
  5. Add `fuelRefinery` to construction completion switch in `tickConstruction()`.
  6. Earth seed: give Earth 1 fuel refinery and 10,000 methane to start. Remove or
     reduce the `EARTH_FUEL_RESTOCK_PER_DAY` placeholder (reduce to 1000 as safety net
     during transition — can be removed fully later).
  7. Export `computeFuelRefineryOutput` as a pure function for testing.
  8. Add fuel refinery to save/restore in state.ts if colony installations are
     individually serialized (check existing pattern — they may be auto-serialized
     with ColonyInstallations).

- Files:
  - `src/core/colonies.ts` — add installation def, refinery tick, construction case
  - `src/types.ts` — add `fuelRefinery` to ColonyInstallations
  - `src/__tests__/colonies.test.ts` — add tests

- Acceptance Criteria:
  1. [ ] Fuel refinery produces fuel from methane
     - Verify: `bun run test` — new test: colony with methane + refinery gains fuel
     - Pass: Test passes, fuel increases proportional to refinery count
     - Fail: No fuel production or wrong rate
  2. [ ] Methane consumed during production
     - Verify: `bun run test` — new test: methane decreases when fuel produced
     - Pass: Methane stock decreases
     - Fail: Free fuel (no consumption)
  3. [ ] Production stops when methane exhausted
     - Verify: `bun run test` — new test: zero methane → zero fuel output
     - Pass: No fuel produced
     - Fail: Fuel generated from nothing
  4. [ ] Construction definition includes fuel refinery
     - Verify: grep for `fuel-refinery` in CONSTRUCTION_DEFS
     - Pass: Found with bpCost and resourceCost
     - Fail: Missing definition
  5. [ ] Earth seed reduced dependency on magic fuel
     - Verify: grep for `EARTH_FUEL_RESTOCK_PER_DAY`
     - Pass: Value reduced from 5000 to 1000
     - Fail: Still at 5000

**T3: Academy scientist generation** [sonnet] — builder

- Description: Academies produce new scientists over time. Each academy generates one
  scientist candidate per training cycle. Training time depends on colony training quality.

  Implementation:
  1. Add `academyProgress: number` to `ColonyState` in `src/types.ts` (tracks progress
     toward next scientist, 0.0 to 1.0). Default 0.
  2. In `src/core/colonies.ts`, add `tickAcademyTraining(colony, simDtDays, qualities)`:
     - If `colony.installations.academy <= 0`, return
     - Progress rate: `ACADEMY_BASE_RATE * academyCount * qualities.training * simDtDays`
       where `ACADEMY_BASE_RATE = 0.001` (~1000 days = ~2.7 years per scientist at
       quality 1.0 with 1 academy)
     - When `academyProgress >= 1.0`:
       - Create a new `ScientistState` with random category affinity
       - Assign to this colony (`colonyBodyName = colony.bodyName`)
       - Use deterministic RNG (`seededRandom`) for name/category selection
       - Reset progress: `academyProgress -= 1.0`
       - Fire notification: "New scientist {name} graduated at {colony}"
  3. Scientist name generation: use a simple deterministic approach — pull from a name
     pool indexed by `state.scientists.size` (so each scientist gets a unique name).
     Keep it simple: a small array of 20-30 first names.
  4. New scientist starts with: `adminCap: 1`, zero category bonuses, empty queue.
  5. Call `tickAcademyTraining()` in `tickColony()` after research tick.
  6. Export `computeAcademyProgress` as a pure function for testing.

- Files:
  - `src/core/colonies.ts` — add academy training tick, scientist creation
  - `src/types.ts` — add `academyProgress` to ColonyState
  - `src/__tests__/colonies.test.ts` — add tests

- Acceptance Criteria:
  1. [ ] Academy produces scientists over time
     - Verify: `bun run test` — new test: colony with academy, after enough ticks, scientist count increases
     - Pass: New scientist created with correct colony assignment
     - Fail: No scientist generated
  2. [ ] Training rate scales with academy count and quality
     - Verify: `bun run test` — new test: 2 academies produce faster than 1
     - Pass: Progress doubles with 2 academies
     - Fail: Rate doesn't scale
  3. [ ] No academies = no progress
     - Verify: `bun run test` — new test: zero academies, progress stays 0
     - Pass: No progress
     - Fail: Progress without academies
  4. [ ] New scientist has valid initial state
     - Verify: `bun run test` — new test: generated scientist has adminCap=1, colonyBodyName set
     - Pass: All fields valid
     - Fail: Missing or wrong fields

### Wave 1 — Validation Gate

**V1: Validate wave 1** [sonnet] — validator-heavy
- Blocked by: T1, T2, T3
- Checks:
  1. Run acceptance criteria for T1, T2, T3
  2. `bun run test` — all tests pass (773+ existing + new)
  3. `bun run typecheck` — no type errors
  4. `bun run lint` — no warnings
  5. Cross-task: verify supply consumption + fuel refinery interact correctly
     (colony with refinery but no supplies should still refine fuel at reduced rate)
  6. Cross-task: verify academy training quality is affected by supply shortage
  7. Verify save/load round-trips new fields (fuelRefinery, academyProgress)
- On failure: Create fix task, re-validate after fix

### Wave 2

**T4: Mission order UI** [opus] — builder-heavy

- Description: Add UI for assigning mission order sequences to ships. The core logic
  already exists in `src/core/cargo.ts` (load/unload/transfer/repeat steps are fully
  implemented). This task adds the player-facing editor.

  The mission order system is SEPARATE from the command tree (standing orders). Mission
  orders are sequential: "go to Earth → load iron → go to Mars → unload iron → repeat".
  The command tree is conditional: "if fuel < 20%, refuel". Mission orders take priority
  when active; safety conditions from the command tree still override.

  Implementation:
  1. In `src/ui/commands.ts`, add a "Mission Orders" section below the command tree:
     - Header: "Mission Orders" with [+ Add Step] button
     - List of current `ship.missionOrders` with step type icons
     - Each step shows: type, target/item, quantity (if applicable)
     - [▲][▼] reorder buttons, [✕] remove button per step
     - [Clear All] button to remove all orders
     - Progress indicator showing current step index
  2. Step types in the [+ Add Step] dropdown:
     - "Transfer to..." → category-first body picker (reuse existing transfer target picker)
     - "Load cargo..." → item picker (resources from available colonies + flat-pack types)
     - "Unload cargo..." → item picker (resources currently in cargo hold)
     - "Repeat" → loops back to step 0 (always last step)
  3. For load/unload steps, allow optional quantity input (blank = all available).
  4. Wire step additions to `ship.missionOrders.push(newStep)` and removals to splice.
  5. Add `ship.missionOrderIndex = 0` reset when orders are modified (restart sequence).
  6. Show cargo hold contents in ship HUD panel (existing `buildPinnedBodyHTML` in
     `src/ui/selection.ts`) — display items and weight if `cargoHold` is non-empty.
  7. The `cargoCapacityKg` is defined on `ShipDesign`. Verify the default ship designs
     (Explorer, Tanker) have `cargoCapacityKg` set. If Tanker doesn't have cargo capacity,
     add it (Tanker's role is logistics).

  Read existing code carefully:
  - `src/core/cargo.ts` — already implements `tickMissionOrders`, `hasMissionOrders`,
    `getMissionTransferTarget`, `advanceMissionTransferStep`, load/unload logic
  - `src/main.ts` — already calls cargo functions in ship tick loop
  - `src/ui/commands.ts` — existing command tree editor, reuse patterns
  - `src/types.ts` — `MissionStep`, `MissionStepType` already defined

- Files:
  - `src/ui/commands.ts` — add mission order editor section
  - `src/ui/selection.ts` — show cargo hold in ship HUD
  - `src/data/ship-designs.ts` — ensure Tanker has cargoCapacityKg
  - `src/__tests__/cargo.test.ts` — new test file for cargo.ts logic (currently untested)

- Acceptance Criteria:
  1. [ ] Mission order editor renders in ship panel
     - Verify: `bun run dev` → select ship → mission orders section visible
     - Pass: Section shows with "+ Add Step" button
     - Fail: Section missing or errors in console
  2. [ ] Can add transfer-to step via UI
     - Verify: manual test — click "+ Add Step" → "Transfer to..." → select body
     - Pass: Step appears in order list with target name
     - Fail: Step not added or wrong target
  3. [ ] Can add load/unload steps
     - Verify: manual test — add load/unload step with item selection
     - Pass: Step appears with item name and optional quantity
     - Fail: Item picker missing or step not added
  4. [ ] Repeat step loops the sequence
     - Verify: `bun run test` — test in cargo.test.ts: ship at end of orders with repeat → index resets to 0
     - Pass: Index wraps to 0
     - Fail: Ship stays idle at end
  5. [ ] Cargo hold displayed in ship HUD
     - Verify: `bun run dev` → ship with cargo → HUD shows items
     - Pass: Cargo items and weight visible
     - Fail: Cargo section missing
  6. [ ] Core cargo.ts logic tested
     - Verify: `bun run test` — cargo.test.ts passes with 8+ tests
     - Pass: Load, unload, transfer advance, repeat, empty hold edge cases
     - Fail: Tests fail or missing coverage
  7. [ ] Tanker design has cargoCapacityKg > 0
     - Verify: grep for cargoCapacityKg in ship-designs or state initialization
     - Pass: Tanker has non-zero capacity
     - Fail: Zero or missing

### Wave 2 — Validation Gate

**V2: Validate wave 2** [sonnet] — validator-heavy
- Blocked by: T4
- Checks:
  1. Run acceptance criteria for T4
  2. `bun run test` — all tests pass
  3. `bun run typecheck` — no type errors
  4. `bun run lint` — no warnings
  5. Integration: verify mission orders work with supply/fuel systems
     (ship loads supplies at Earth, delivers to Mars colony)
  6. `bun run dev` — manual smoke test of full loop
- On failure: Create fix task, re-validate after fix

## Dependency Graph

```
Wave 1: T1 (supply drain), T2 (fuel refinery), T3 (academy) → V1
Wave 2: T4 (mission order UI) → V2
```

## Success Criteria

1. [ ] All tests pass (773 existing + ~30 new)
   - Verify: `bun run test`
   - Pass: All pass, zero failures
2. [ ] Colony supplies deplete over time
   - Verify: `bun run dev` — observe Earth supplies decreasing each game-day
   - Pass: Supply counter decreases; warning fires when low
3. [ ] Fuel refinery produces fuel from methane
   - Verify: `bun run dev` — build refinery at colony with methane deposits, observe fuel increase
   - Pass: Fuel stock rises while methane decreases
4. [ ] Academy produces scientists
   - Verify: `bun run dev` — fast-forward 3+ years at colony with academy
   - Pass: New scientist appears in research panel
5. [ ] Mission orders execute cargo routes
   - Verify: `bun run dev` — assign tanker: transfer Earth → load supplies → transfer Mars → unload → repeat
   - Pass: Tanker cycles between colonies, supplies transfer
6. [ ] Economic pressure creates meaningful decisions
   - Verify: play for 10 minutes — must choose between expanding mining vs research vs logistics
   - Pass: Resources feel scarce, choices feel consequential

## Handoff Notes

- `src/core/cargo.ts` is already 193 lines of working code. T4 should NOT rewrite it — only add UI and tests.
- The `EARTH_FUEL_RESTOCK_PER_DAY` placeholder should be reduced but not removed in T2. Full removal happens after playtesting confirms refinery rates are balanced.
- Colony save/restore serializes `ColonyInstallations` as a plain object — new fields (fuelRefinery) need default values in the restore path. Check `restoreColony()` or equivalent.
- `state.supplyMultiplier` already exists as a hardness axis. T1 should use it.
- Scientist names should be deterministic (seeded RNG). Use `seededRandom()` from `core/utils.ts`.
- Mission order UI should reuse the transfer target picker pattern from the command tree editor (category-first body selection). Don't reinvent it.
