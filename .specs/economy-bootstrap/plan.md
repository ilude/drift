---
created: 2026-03-30
status: draft
completed:
---

# Plan: Economy Bootstrap — Factories, Shipyards, Cargo, Mining Outposts

## Context & Motivation

The game has survey, research, colony construction, and ship command AI — but no economic loop. Resources are mined and stockpiled but never consumed for anything meaningful. Ships are conjured from nothing. Colonies can't supply each other. The player has no "factory must grow" pressure.

This plan implements the Aurora 4X economic loop: **factories build flat-packed installations → shipyards build ships from raw materials → cargo ships ferry flat-packs to new locations → automated mines + mass drivers create supply chains.**

## Constraints

- Platform: Windows 11, bash shell, Bun + Vite + TypeScript
- Shell: bash
- Biome lint: zero warnings, cognitive complexity max 15
- 773+ tests must pass
- Import hierarchy: math/ → core/ → rendering/ → ui/ → main.ts
- Aurora 4X is the baseline behavior — customize later
- Existing construction system pattern (BP + resource cost + allocation %) is the template for both factory production and ship building

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Full Factorio-style production chains | Deep, emergent | Far too complex for v1, needs chain editor UI | Rejected: vNext+ |
| Simple factory conversion (raw → refined) | Gets bottleneck loop working | Doesn't produce tangible items (ships, installations) | Rejected: not Aurora-like |
| Aurora-style: factories produce flat-packs, shipyards consume raw materials | Matches reference game, creates two distinct production paths | Two queue systems to implement | **Selected** |

## Objective

When complete:
1. Player queues flat-packed installations at factories → produced over time, consuming resources
2. Player queues ships at shipyards → built over time, consuming resources
3. Player designs cargo ships with cargo bays → loads flat-packs → transfers to destination → unloads
4. Automated mines placed on bodies extract resources → mass driver sends to colony
5. All of this creates the "endless bottleneck" loop where solving one constraint reveals the next

## Project Context

- **Language**: TypeScript
- **Test command**: `bun run test`
- **Lint command**: `bun run lint`
- **Typecheck**: `bun run typecheck`

## Task Breakdown

| # | Task | Files | Type | Model | Agent | Depends On |
|---|------|-------|------|-------|-------|------------|
| T1 | Factory production queue (sim logic) | 3 | feature | sonnet | builder | — |
| T2 | Factory production UI in colony panel | 2 | feature | sonnet | builder | — |
| V1 | Validate wave 1 | — | validation | sonnet | validator-heavy | T1, T2 |
| T3 | Ship building queue (sim logic) | 4 | feature | sonnet | builder | V1 |
| T4 | Ship building UI in colony panel | 2 | feature | sonnet | builder | V1 |
| V2 | Validate wave 2 | — | validation | sonnet | validator-heavy | T3, T4 |
| T5 | Cargo hold state + load/unload orders | 5 | feature | opus | builder-heavy | V2 |
| T6 | Cargo order UI + ship order list | 3 | feature | sonnet | builder | V2 |
| V3 | Validate wave 3 | — | validation | sonnet | validator-heavy | T5, T6 |
| T7 | Automated mine + mass driver installations | 4 | feature | sonnet | builder | V3 |
| T8 | Mass driver target UI + outpost panel | 2 | feature | sonnet | builder | V3 |
| V4 | Validate wave 4 | — | validation | sonnet | validator-heavy | T7, T8 |

## Execution Waves

### Wave 1 (parallel): Factory Production

**T1: Factory production queue (sim logic)** [sonnet] — builder
- Description: Add a factory production queue to colonies, parallel to the construction queue. Factories produce flat-packed installations that go into the colony stockpile. Uses the same BP + resource cost + allocation % pattern as construction.
- Files: `src/core/colonies.ts`, `src/types.ts`, `src/__tests__/colonies.test.ts` (new or existing)
- Acceptance Criteria:
  1. [ ] New `ColonyProductionProject` type with installationId, quantity, allocationPct, progressBp, paused
     - Verify: `grep "ColonyProductionProject" src/types.ts`
     - Pass: interface found
     - Fail: missing type
  2. [ ] New `productionProjects: ColonyProductionProject[]` field on `ColonyState`
     - Verify: `grep "productionProjects" src/types.ts`
     - Pass: field on ColonyState
     - Fail: missing field
  3. [ ] New `tickProduction(colony, simDtDays, qualities)` function in colonies.ts
     - Uses `BASE_CONSTRUCTION_BP_RATE * constructionFactory * qualities.construction` (same BP pool as construction? or separate?)
     - **Decision: Separate BP pool from factories.** Factories produce flat-packs, construction factories build installations in-place. Aurora separates these. Add `PRODUCTION_DEFS` array for producible items (flat-packed mine, flat-packed mass driver, flat-packed fuel depot, etc.).
     - Resource cost deducted from stockpile on completion
     - Completed items added to stockpile as `flatPacked: Record<string, number>` (new field on ColonyStockpile)
     - Verify: `bun run test`
     - Pass: all tests pass including new production tick tests
     - Fail: test failures
  4. [ ] Save/load persistence for productionProjects and flatPacked stockpile
     - Verify: save, reload, verify production state preserved
     - Pass: projects and flat-packs survive round-trip
     - Fail: data lost

**T2: Factory production UI in colony panel** [sonnet] — builder
- Description: Add a "Production" section to the colony panel, mirroring the construction section. Dropdown to select flat-packed item, quantity input, allocation %, add/pause/cancel. Shows production capacity (BP/day from factories).
- Files: `src/ui/colony-panel.ts`, `src/core/colonies.ts` (export helpers)
- Acceptance Criteria:
  1. [ ] Production section visible in colony panel when colony has factories
     - Verify: manual test — open colony panel, see "Production" section
     - Pass: section renders with capacity bar
     - Fail: section missing
  2. [ ] Can queue a flat-packed mine, see progress, cancel
     - Verify: manual test
     - Pass: project appears, progress updates each tick
     - Fail: project doesn't appear or progress stuck

### Wave 1 — Validation Gate

**V1: Validate wave 1** [sonnet] — validator-heavy
- Blocked by: T1, T2
- Checks:
  1. `bun run test` — all pass
  2. `bun run lint` — no warnings
  3. `bun run typecheck` — no errors
  4. Factory production produces flat-packed items into stockpile
  5. Production consumes resources from stockpile
  6. UI correctly shows production queue and capacity

### Wave 2: Ship Building

**T3: Ship building queue (sim logic)** [sonnet] — builder
- Description: Add ship construction queue to colonies with shipyards. Aurora-style: shipyard consumes raw materials (iron, aluminum, copper, silicon proportional to ship mass), takes BP over time, ship appears when complete. Each ShipDesign has a bill of materials derived from its dry mass.
- Files: `src/core/colonies.ts`, `src/types.ts`, `src/rendering/ship-transfer.ts` (createShip called on completion), `src/__tests__/colonies.test.ts`
- Acceptance Criteria:
  1. [ ] New `ColonyShipbuildProject` type: designId, name, progressBp, totalBp, paused
     - totalBp derived from design dryMassKg (e.g., 1 BP per 100 kg)
     - Resource cost: proportional to mass by material type
  2. [ ] `shipbuildProjects: ColonyShipbuildProject[]` on ColonyState
  3. [ ] `tickShipbuilding(colony, simDtDays, qualities)` uses `shipyard * qualities.shipbuilding * BP_RATE`
     - On completion: call `createShip({ name, hostPlanetName: colony.bodyName, designId })`
     - Deduct resources, remove project
  4. [ ] Save/load for shipbuild projects
  5. [ ] All tests pass

**T4: Ship building UI in colony panel** [sonnet] — builder
- Description: Add "Shipyard" section to colony panel. Dropdown of available ship designs, name input, queue button. Shows shipyard capacity and active builds with progress/ETA.
- Files: `src/ui/colony-panel.ts`, `src/core/colonies.ts`
- Acceptance Criteria:
  1. [ ] Shipyard section visible when colony has shipyard installation
  2. [ ] Can select a design, name the ship, queue construction
  3. [ ] Progress bar and ETA shown for active builds

### Wave 2 — Validation Gate

**V2: Validate wave 2** [sonnet] — validator-heavy
- Blocked by: T3, T4
- Checks: tests, lint, typecheck, ship appears in game when construction completes

### Wave 3: Cargo Mechanics

**T5: Cargo hold state + load/unload orders** [opus] — builder-heavy
- Description: Implement the cargo logistics chain. Ships with cargo capacity get a `cargoHold: Record<string, number>` tracking what's loaded (flat-packs, resources). New order types: `load-cargo` and `unload-cargo`. Orders specify item type and quantity. Loading/unloading happens over time while docked at a colony. Integrates with the ship order system (new `missionOrders: MissionStep[]` field on ShipEntry, per the ship-order-system-design.md).
- Files: `src/types.ts` (CargoHold, MissionStep, new CommandTypes), `src/core/commands.ts` (tick cargo transfer), `src/main.ts` (dispatch new commands), `src/core/colonies.ts` (colony stockpile transfer), `src/__tests__/commands.test.ts`
- Acceptance Criteria:
  1. [ ] `cargoHold: Record<string, number>` on ShipEntry
  2. [ ] `missionOrders: MissionStep[]` on ShipEntry (sequential order list)
  3. [ ] MissionStep types: "load-cargo", "unload-cargo", "transfer-to", "repeat"
  4. [ ] Loading transfers items from colony stockpile to ship cargo over time
  5. [ ] Unloading transfers items from ship cargo to colony stockpile over time
  6. [ ] Ship follows mission orders sequentially, loops on "repeat"
  7. [ ] Save/load for cargoHold and missionOrders

**T6: Cargo order UI + ship order list** [sonnet] — builder
- Description: Add mission order editor to the ship info panel. List of sequential steps (load X at Y, transfer to Z, unload X at Z, repeat). Add/remove/reorder steps. Item picker dropdown for cargo types.
- Files: `src/ui/commands.ts` (or new `src/ui/orders.ts`), `src/ui/selection.ts`
- Acceptance Criteria:
  1. [ ] Mission order list visible in ship detail panel
  2. [ ] Can add load/unload/transfer/repeat steps
  3. [ ] Ship executes orders autonomously

### Wave 3 — Validation Gate

**V3: Validate wave 3** [sonnet] — validator-heavy
- Blocked by: T5, T6
- Checks: full cargo loop works — load flat-packs at Earth, transfer to Mars, unload

### Wave 4: Automated Mining + Mass Driver

**T7: Automated mine + mass driver installations** [sonnet] — builder
- Description: Add "automated-mine" and "mass-driver" to the installation/production catalog. Automated mines extract resources without workforce (Aurora-style). Mass driver is an installation with a `targetColony: string` that automatically launches extracted resources to the target each tick. Both can be flat-packed at factories and shipped via cargo.
- Files: `src/core/colonies.ts` (new installation types, tick logic), `src/types.ts` (ColonyInstallations extended), `src/data/components.ts` (if needed), `src/__tests__/colonies.test.ts`
- Acceptance Criteria:
  1. [ ] `automatedMine` and `massDriver` in ColonyInstallations
  2. [ ] Automated mines extract at mining rate without workforce requirement
  3. [ ] Mass driver has `massDriverTarget: string` on ColonyState
  4. [ ] Each tick, mass driver sends extracted resources to target colony's stockpile
  5. [ ] Flat-packed versions in PRODUCTION_DEFS

**T8: Mass driver target UI + outpost management** [sonnet] — builder
- Description: Add mass driver target dropdown to colony panel (lists colonies with mass driver receivers). Show outpost status (installations, extraction rates, mass driver throughput). Allow "assembling" flat-packed installations at a colony from its stockpile.
- Files: `src/ui/colony-panel.ts`, `src/core/colonies.ts`
- Acceptance Criteria:
  1. [ ] Mass driver target dropdown in colony panel
  2. [ ] "Assemble" button to convert flat-packed items in stockpile to active installations
  3. [ ] Outpost overview shows mining output and mass driver throughput

### Wave 4 — Validation Gate

**V4: Validate wave 4** [sonnet] — validator-heavy
- Blocked by: T7, T8
- Checks: full economic loop — Earth factories produce flat-packed mines → cargo ship delivers to asteroid colony → automated mines extract → mass driver sends to Earth

## Dependency Graph

```
Wave 1: T1, T2 (parallel) → V1
Wave 2: T3, T4 (parallel) → V2
Wave 3: T5, T6 (parallel) → V3
Wave 4: T7, T8 (parallel) → V4
```

## Success Criteria

1. [ ] Complete economic loop: factory → flat-pack → cargo ship → outpost → mine → mass driver → resources back to factory
   - Verify: manual playtest
   - Pass: resources flow from mining outpost back to Earth
2. [ ] Ship building works end-to-end: design ship → queue at shipyard → resources consumed → ship appears
   - Verify: manual test
   - Pass: new ship orbits colony on completion
3. [ ] All 773+ tests pass, zero lint warnings
   - Verify: `bun run test && bun run lint && bun run typecheck`
   - Pass: all green

## Handoff Notes

- The existing `constructionProjects` pattern (BP pool, allocation %, resource cost, pause/cancel) is the template for both factory production and ship building. Copy the pattern, don't reinvent.
- `cargoCapacityKg` is already computed on ShipDesign — use it for cargo hold max capacity.
- The ship order system design doc (`tasks/ship-order-system-design.md`) recommends `missionOrders: MissionStep[]` as the preferred approach. Follow that.
- Earth starts with 4 construction factories. These are for building installations in-place. Factories for producing flat-packs will need to be built by the player (or seeded for early game testing).
- Mass driver "receiver" in vNext is just "any colony with a mass driver." No special receiver installation needed — the mass driver both sends and receives.
