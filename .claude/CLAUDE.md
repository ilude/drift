# Drift

4X space exploration sim built with Three.js and TypeScript (Vite bundler).

## Commands

- `bun run dev` — Start dev server
- `bun run build` — Production build
- `bun run test` — Run tests
- `bun run test:watch` — Watch mode tests
- `bun run test:coverage` — Coverage report (v8)
- `bun run lint` — Biome (linter + formatter), includes cognitive complexity checking (max 15)
- `bun run dead-code` — Knip (unused files, exports, types, dependencies)
- `bun run typecheck` — TypeScript type checking

## Architecture

All source lives under `src/` with logical subdirectories. Tests live in `src/__tests__/`. Static assets go in `public/` (served as-is by Vite). `index.html` stays at project root (Vite entry point).

```
public/                                  (static assets: favicon, images, etc.)
src/
  style.css                              (app styles, imported by main.ts)
  core/       state.ts, utils.ts,        (app state, RNG helpers)
              entities.ts,               (unified O(1) entity resolution)
              intents.ts,                (ship intent broadcast for coordination)
              commands.ts,               (command tree evaluation, ship simulation)
              commander.ts,              (commander judgment: decide, defer, preempt)
              notifications.ts,          (notification system with coalescing)
              ship-utils.ts,             (resolveShipPhysics helper)
              transfers.ts              (transfer initiation, fuel budget, throttle)
  math/       orbit.ts, visual.ts,       (pure math, no app imports)
              transfer.ts, ship-physics.ts,  (distance, fuel cost, throttle search)
              ship-design-calc.ts         (ship/engine stat derivation)
  rendering/  rendering.ts, scene.ts,    (Three.js scene, bodies, textures)
              textures.ts, bodies.ts,    (body init, survey state)
              ship-transfer.ts           (Hermite spline visuals, ship creation)
  ui/         ui.ts, selection.ts,       (HUD, labels, click handlers)
              commands.ts,               (command tree editor UI)
              resource-viewer.ts,        (popout resource matrix window)
              design-viewer.ts           (popout engine/ship designer)
  data/       sol-data.ts,               (system data & generation)
              system-generator.ts,
              resources.ts,              (resource catalog, deposit generation)
              components.ts,             (component catalog, engine tier defs)
              ship-designs.ts            (EngineDesign, ShipDesign interfaces)
  types.ts                               (shared TypeScript interfaces)
  main.ts                                (orchestrator, entry point)
  __tests__/  *.test.ts                  (all test files)
```

**Import hierarchy (no circular deps):**
```
core/utils.ts, math/orbit.ts, math/visual.ts  (pure math, no app imports)
        |
  data/components.ts, data/ship-designs.ts, math/ship-design-calc.ts  (pure data + calc)
        |
    core/state.ts  (imports nothing)
        |
    core/entities.ts  (imports: state.ts, types.ts, math/orbit.ts)
        |
  core/intents.ts, core/commands.ts, core/commander.ts, core/notifications.ts, data/resources.ts
        |
  core/ship-utils.ts  (imports: state.ts, ship-physics.ts)
        |
  core/transfers.ts  (imports: entities, ship-utils, state, math/ship-physics, math/transfer)
        |
  rendering/scene.ts, rendering/textures.ts, rendering/bodies.ts
        |
  rendering/rendering.ts, rendering/ship-transfer.ts, math/transfer.ts
        |
  ui/selection.ts, ui/ui.ts, ui/commands.ts, ui/resource-viewer.ts, ui/design-viewer.ts
        |
     main.ts  (orchestrator)
```

**Key modules:**
- `src/types.ts` — Shared interfaces: BodyEntry, ShipEntry, ShipIntent, CommandEntry, AppState, ResolvedEntity, EngineDesign, ShipDesign
- `src/core/state.ts` — Single centralized state object, save/restore to localStorage (SAVE_VERSION 8, plural ships, colonies, researchedTechs, engineDesigns, shipDesigns)
- `src/core/result.ts` — Go-style `Result<T>` helpers: `ok(v)` → `[v, true]`, `err()` → `[null, false]`
- `src/core/colonies.ts` — Colony system: workforce calculation, quality modifiers, per-tick mining/construction/research, colony services for ships. Construction consumes stockpiled resources (`resourceCost` on each installation type, `canAffordConstruction()` helper). Colony warning notifications (understaffing, idle infrastructure, blocked construction) with 30-day rate limiting.
- `src/core/entities.ts` — Unified O(1) entity resolution: resolveEntity, findBody, findPlanet, findShip, findStar, findAsteroidEntity. Backed by Maps rebuilt via rebuildEntityMaps(). Lives in core/ so commands.ts can import it.
- `src/core/intents.ts` — Ship intent broadcast for multi-ship coordination: publishIntent, clearIntent, getClaimedTargets. Ships broadcast current activity, others skip claimed targets.
- `src/core/commands.ts` — Command tree evaluation (pure logic, no rendering imports), ship simulation tick
- `src/core/commander.ts` — Commander judgment layer: `commanderDecide()` entry point. Three overrides applied in order: (1) preemptive servicing at colonies, (2) hold for inbound tanker (`checkHoldForTanker` — ship idles when a `tanking` intent targets it, preventing the tanker chase-and-miss pattern), (3) defer maintenance in the field. Learning from failures (malfunction → judgment bump).
- `src/core/notifications.ts` — Notification system with coalescing, smart pause, FIFO cap (200 entries). Notification types include ship events (low-fuel, malfunction, etc.) and colony warnings (colony-understaffed, colony-idle, colony-blocked).
- `src/math/orbit.ts` — Kepler solver (meanToTrue), orbital mechanics primitives
- `src/core/ship-utils.ts` — `resolveShipPhysics(ship)` resolves ShipEntry to ShipPhysicsState (accelG, ispS) from design or legacy ENGINE_TYPES fallback.
- `src/core/transfers.ts` — `initiateTransfer()` entry point for starting ship transfers. Computes fuel cost (additive model: rocket equation + operational burn), auto-throttles acceleration when fuel is tight, delegates visual commit to rendering layer via hooks.
- `src/math/ship-physics.ts` — Brachistochrone transfer physics, engine tiers, delta-v budget. `checkTransfer()`/`checkTransferKm()` accept resolved accelG/ispS directly. `computeTotalFuelCost()` and `findAffordableAccelG()` implement the additive fuel cost model and commander throttle search.
- `src/math/ship-design-calc.ts` — Pure functions: `computeEngineStats()` (power modifier formula), `computeShipStats()` (derive ship stats from components), `validateShipDesign()`.
- `src/data/components.ts` — Component catalog: `ENGINE_TIER_DEFS` (4 tiers with prerequisiteTech), `COMPONENT_DEFS` (18 components across 7 categories). Helpers: `getUnlockedEngineTiers()`, `getUnlockedComponents()`.
- `src/data/ship-designs.ts` — `EngineDesign` and `ShipDesign` interfaces for player-created designs.
- `src/rendering/rendering.ts` — Position updates, ship transfer dispatch, action completion
- `src/rendering/bodies.ts` — Body/ship creation, survey state initialization
- `src/rendering/ship-transfer.ts` — Hermite spline transfers, capture blend, station-keeping approach
- `src/math/transfer.ts` — Transfer math helpers: Hohmann, game transfer timing, coordinate-independent utilities
- `src/data/system-generator.ts` — Procedural star system generation from seeds
- `src/data/resources.ts` — Resource catalog (27 entries), scientifically-grounded deposit generation. Pools sub-typed by body type, frost line distance, parent distance (moons), belt position (asteroids). Earth homeworld gets all 27 resources via `generateEarthDeposits()`.
- `src/ui/commands.ts` — Command tree editor UI (reorder, toggle, add/remove orders), category-first transfer target picker
- `src/ui/resource-viewer.ts` — Popout resource matrix window. Body rows × resource columns. Category tabs, sortable, body-click navigation. postMessage communication with main window.
- `src/ui/design-viewer.ts` — Popout designer window with 5 tabs: Engine Designs (tier/power/size discrete dropdowns), Ship Designs (component catalog with category grouping, design errors pane, build ship), Missile Design, Turret Design, Sensor Design. postMessage communication with main window.

## UI Structure

- **Header bar:** `[System Name ▾] | [View ▾] | [Resources] | [Research] | [Designs] | [Save] | <spacer> | [Pause] [Speed ▾] | [Date] [Perf]`
- **View menu:** Dropdown with per-category visibility toggles (labels, orbits, trails) for each body type. Recenter button with Ctrl+R shortcut.
- **Body categories:** Star, Planet, Dwarf Planet, Centaur, Moon, Comet, Asteroid, Ship — each with independent visibility controls via `state.categoryVisibility`. Centaurs and Asteroids start collapsed in the body list.
- **Resource viewer:** Popout window (`window.open()`) for multi-monitor. Body×resource matrix table with category tabs (All, Metal, Volatile, Industrial, Radioactive, Umbral). Sortable columns, body name click navigates main window. Communication via `postMessage()`. Code in `src/ui/resource-viewer.ts`.
- **Dropdowns** (system-switcher, speed-selector, view-menu) are positioned dynamically using `getBoundingClientRect()` for alignment.
- **Transfer target picker:** Category-first hierarchy — pick body type (Planets, Dwarf Planets, Centaurs, Asteroids) then specific body within that category.
- **Font:** Exo 2 (Google Fonts) — sans-serif, optimized for small-size data readability.
- **PWA:** `manifest.json` enables chrome-less popout windows when installed as a PWA.

## Conventions

- **Sim is source of truth; UI is read-only projection.** All game logic, physics, entity state, and decisions live in `core/` and `math/`. The `rendering/` and `ui/` layers read sim state and draw it — they never own game logic. Functions that compute game state (distance, fuel cost, transfer decisions) must live in core/math, not rendering/ui.
- **Deterministic:** MASTER_SEED (42) drives all RNG. Same seed = same universe.
- **Scratch objects:** Hot-loop functions (inclinedPosition, orbitToWorld) reuse output objects to avoid GC pressure.
- **World coordinates:** sqrt-compressed mapping: `rWorld = sqrt(rAU) * DIST_SCALE`. Ship transfers use Hermite splines in world space to avoid coordinate distortion.
- **LOD:** 3-tier sphere geometry (8/24/48 segments), rings/clouds gated at 15px screen radius.
- **Multi-ship:** Game supports multiple named ships created via `createShip(config: ShipConfig)`. Ships coordinate via intent broadcast — `selectNextSurveyTarget` skips bodies claimed by other ships. HUD shows selected ship status or fleet aggregate. Save/restore matches ships by name.
- **Ship design system:** Players design engines (power modifier tradeoff: thrust vs efficiency vs mass) and ships (component catalog within mass budget). `createShip()` accepts `designId` to derive stats from a `ShipDesign`. Legacy ships without `designId` fall back to `ENGINE_TYPES` via `resolveShipPhysics()`. Default Explorer-class and Tanker-class designs seeded at game start.
- **Component catalog:** 18 components across 7 categories (bridge, crew-quarters, fuel-tank, cargo-bay, maintenance-bay, sensor-suite, armor). Each gated by `prerequisiteTech`. Engine tiers (conventional → improved → advanced → extreme) gated by research. Discrete power options (10%-150%) with Aurora's exponential fuel formula: `fuelMod = (powerPct/100)^2.5 * (1 - sizeHS/100)`. Engine size in Hull Spaces (1 HS = 50 tons).
- **Design tabs:** Engine (discrete dropdowns, company name randomizer), Ship (component catalog with category grouping, design errors pane), Missile (size/warhead/engine/agility), Turret (weapon type/caliber/tracking), Sensor (type/resolution/size). All designs persist via save/load.
- **Entity resolution:** All entity-by-name lookups go through `core/entities.ts`. Never use `state.bodyMeshes.find()` directly — use `findBody()`, `resolveEntity()`, `findAsteroidEntity()`, etc. Maps rebuilt via `rebuildEntityMaps()` after body/asteroid creation.
- **Ship state machine:** orbiting → transferring → orbiting. Transfer uses 3D cubic Hermite splines with station-keeping capture blend (smoothstep in final 15%). Ships use brachistochrone physics (default 0.1g engine) for transfer timing. Additive fuel model: rocket-equation fuel + operational burn (0.1%/day capacity via `OP_BURN_RATE`). Transfers are rejected if total fuel cost exceeds available fuel. Commanders auto-throttle acceleration when full speed is unaffordable.
- **Ship command tree:** Priority-ordered list of conditional commands (fuel-below, morale-below, hull-below, supplies-below, always). Command types: survey-nearest, transfer-to, refuel, refuel-ship, shore-leave, overhaul, major-refit, return-to-base, idle. Evaluated between actions. `immediateCommand` is one-shot — cleared at the top of `dispatchCommand()` on any dispatch.
- **Ship simulation:** `tickShipSimulation()` runs per-frame: morale decay (1.5 exponent past 180-day deployment limit), maintenance age (both `age` and `totalAge`), malfunction checks (bathtub curve, every 30 days during transfers), fuel drain (station-keeping rates), routine maintenance (idle orbiting only), gradual recovery during actions (refuel: 5d fixed, overhaul: dynamic duration capped at hull ceiling, major-refit: 180d+ base restoring ceiling, shore leave: 30d at +2.5 morale/day +0.25% hull/day from repair crew). All recovery rates scaled by `depotQuality` and per-system hardness multipliers.
- **Tiered maintenance system:** Scientifically grounded, inspired by naval/aircraft bathtub curve maintenance patterns:
  - **Routine maintenance:** Crew-performed while idle+orbiting. 0.05%/day hull restoration scaled by morale, capped at hull ceiling.
  - **Standard overhaul:** Depot-level, every 2-3 years. Restores hull to ceiling (not 100%), resets `maintenance.age` to 0.
  - **Major refit:** Deep structural restoration, 180+ day base duration. Resets `lastRefitAge = totalAge`, restoring hull ceiling to 100%. Available as command type `"major-refit"`.
- **Hull ceiling:** Lifetime degradation limiting maximum restorable hull. `hullCeiling(totalAge, lastRefitAge) = max(30, 100 - yearsSinceRefit * 1.5)`. At 10 years: 85%, 20 years: 70%, 30 years: 55%. Floor of 30%. Major refit resets the ceiling clock. Displayed in HUD as `Hull: 85% / 95%` when ceiling < 100%.
- **Bathtub curve malfunctions:** `bathtubFailRate()` replaces linear formula. Phase 1 (0-90 days): infant mortality ~2.5% decaying. Phase 2 (90d-3yr): constant ~1%. Phase 3 (3yr+): quadratic wear-out. Integrity uses sqrt multiplier (25% hull = 2x, not 4x) to prevent death spiral. Crew morale and commander experience reduce fail rates.
- **Survey system:** Multi-level surveys (1-3) representing scan depth. Level 1 = surface/shallow (access ≥ 0.5), Level 2 = mid-depth (access ≥ 0.2), Level 3 = deep (access < 0.2). Higher sensor tech scans deeper into the body, revealing harder-to-extract deposits. Small bodies may be fully scanned at level 1. `minSurveyLevel` on deposits is determined by accessibility, not resource category. Duration scales with body type and crew/hull condition. `surveyMultiplier` state setting for difficulty tuning.
- **Resource sub-typing:** Deposit pools vary by body sub-type, determined procedurally from existing data:
  - **Planets:** Gas giant (r>30k km) / Ice giant (r>15k) / Cold rocky (>2.7 AU frost line) / Warm rocky (<2.7 AU)
  - **Moons:** Icy outer (parent >5 AU) / Mid-system (parent >2.7 AU) / Rocky inner (parent <2.7 AU)
  - **Asteroids:** C-type carbonaceous (outer belt) / M-type metallic (mid belt) / S-type silicate (inner belt)
  - **Dwarf Planets:** Outer nitrogen-ice (>10 AU, Pluto analog) / Inner water-ice (<10 AU, Ceres analog)
  - **Comets/Centaurs:** Fixed pools (water/nitrogen/hydrocarbon dominated)
- **Rate modifier pattern:** Every rate-based game system uses two orthogonal scaling axes:
  1. **Quality modifier** (`depotQuality`): represents location facilities — crew competence, equipment modernity, depot capacity. Currently a single global value (1.0 = 100%), eventually calculated per-location from base/colony subsystems.
  2. **Game hardness multiplier** (per-system on AppState): player-chosen difficulty. 1.0 = default, higher = slower/harder. Current multipliers: `surveyMultiplier`, `repairMultiplier`, `refuelMultiplier`, `moraleMultiplier`, `supplyMultiplier`, `fuelBurnMultiplier`.
  - **Formula:** `effectiveRate = baseRate * quality / hardnessMultiplier`
  - **Convention:** All new rate-based systems MUST include both modifiers. Values are stored as decimals (1.0 = 100%). When brainstorming new systems, proactively identify where quality and hardness modifiers should apply.
- **Commander judgment:** Ships have a `Commander` with `judgment` (0.0–1.0) and `experience` counter. Lives in `core/commander.ts` — the judgment layer on top of the mechanical command tree (`core/commands.ts`). Three judgment overrides applied in order: (1) **preemptive servicing** at colonies — raises maintenance thresholds before departure by `(100 - base) * judgment * 0.3`; (2) **hold for inbound tanker** (`checkHoldForTanker`) — if a `tanking` intent targets this ship, override survey/transfer with idle, preventing the tanker chase-and-miss pattern; (3) **defer maintenance** in the field — at unsurveyed bodies, defers maintenance commands when judgment says it's safe to survey first (personal floor interpolates from command threshold toward critical by judgment). Learning from failure: malfunctions and emergency-returns bump judgment with diminishing returns, capped at 0.9. New ships start at 0.3. All callers use `commanderDecide(ship)` — never call `evaluateCommandTree` directly for dispatch.
- **Construction resource costs:** Each installation type has a `resourceCost?: Record<string, number>` on its `ConstructionDefinition`. BP accumulates normally, but completion blocks if the colony's stockpile lacks required resources. Use `canAffordConstruction(colony, installationId)` to check. Costs range from 250 (mine) to 1600 (shipyard) total resources.
- **Colony warning notifications:** `checkColonyWarnings()` runs after each colony tick. Warns on severe understaffing (<50%), idle factories/labs (capacity with no projects), and resource-blocked construction. Uses a 30-day rate limiter (`lastWarningDay` Map) to prevent spam. Warning types: `colony-understaffed`, `colony-idle`, `colony-blocked`.
- **Pre-filled trails:** Comets, Dwarf Planets, Centaurs, and Asteroids get trails pre-filled on creation by computing past orbital positions backwards (orbits hidden by default). Comet trail buffer is 1200 points (vs 400 for others). Sample rate scales with zoom level.
- **Save system:** Manual save only via header "Save" button. No auto-save on unload. Game always starts fresh with Sol system and default ships.
- **Render-on-demand:** 30fps cap; render loop stops when paused and resumes on input (wake-render event).
- **No circular imports.** Pure math modules have zero app imports.
- **Biome enforced:** Linter + formatter. Tabs, double quotes, trailing commas. Zero warnings policy. Config in `biome.json`.

## Design Philosophy

Drift aims for **depth without complexity** — the gap between component complexity (how hard each rule is to learn) and emergent complexity (how many surprising outcomes arise) should be maximized. This is what Keith Burgun calls *elegance*.

### Core Design Principles

1. **Complexity is a budget.** Every new rule costs comprehension and tracking. Spend that budget on systems that create depth (harder to find optimal play), not on systems that create verisimilitude for its own sake. (Dan Felder's framework: Comprehension Complexity vs Tracking Complexity vs Depth.)
2. **Interaction multiplies depth; addition multiplies complexity.** Two interacting simple systems create more depth than two independent complex ones. Every new system must link to 2-3 existing systems or it's patchwork. (Matthias Worch, Keith Burgun's "Elegant vs Patchwork" diagnostic.)
3. **No dominant strategies.** If one approach always wins, depth collapses regardless of state space size. Every colony type, tech path, and ship build should have meaningful tradeoffs.
4. **Systems must chain.** One system's output becomes another's input. Tech → ship performance → survey results → resource discovery → colony placement → research capacity → tech. Dead-end outputs (values nothing else reads) are anti-depth.
5. **Constraints create depth.** Limited workforce, scarce scientists, finite building slots, per-seed tech availability. These FORCE creative solutions — like MTG's color pie turning limitation into creativity.
6. **Simulate consistent rules, not specific outcomes.** Don't design "combos." Design consistent systems (physics, demographics, resource flow, tech scaling) and let combinations emerge. The mass driver is a transport mechanism; if it also works as a weapon, that's emergence from consistent rules. (Dwarf Fortress philosophy.)
7. **Player mastery is the real progression.** The player levels up, not just the empire. Understanding the interaction space IS the skill ceiling. 100 hours in, you should still be discovering new strategies. (Raph Koster: "Fun is learning.")
8. **Remove rote decisions.** If a choice has a dominant strategy, it's not a decision — it's a tax on the player's time. The command tree system is Drift's response to Aurora 4X's micromanagement anti-pattern. (Soren Johnson.)
9. **Autonomous agents create emergent narrative.** Give ships/commanders enough autonomy to surprise the player, and the player will construct stories. Minimal representation + meaningful mechanical events = rich player-imagined narrative. (Tynan Sylvester's apophenia principle, Tarn Adams' DF philosophy.)
10. **The Endless Bottleneck.** Never let the player reach a fully "solved" state. Every optimization should shift the constraint rather than remove it. Solving one problem should reveal or create the next.

### Anti-Patterns to Avoid
- **Aurora's trap:** Extraordinary simulation fidelity, but most players never experience the depth because the complexity budget is overspent on component-level micromanagement.
- **Dead-end outputs:** Values that nothing else reads. If a system produces data no other system consumes, it's isolated complexity.
- **Fixing skillful exploits:** If players discover non-obvious strategies through system interaction, that's emergence working as intended. Only fix genuinely broken interactions, not creative use of consistent rules.
- **Abstract counters over persistent entities:** Entities with identity, relationships, and history enable emergence. Anonymous numbers don't.

### Core Game Vision
- **Two primary player systems:** Ship Design (early game, persistent) and Nodal Production Chains (mid/late game optimization). Everything else serves these two loops.
- **Earth starts at the margin.** Player grows factories → farming → mines → flat-packed modules → first ship design → first colony. No ships without a player-authored design.
- **Flat-packed modules:** Colony infrastructure is manufactured at Earth (or any factory colony), shipped by cargo, assembled at destination. Physical logistics, not instant placement.
- **Mines are counts, not entities.** `colony.installations.mine` and `colony.installations.automatedMine` are integers. Transfer via cargo ship = subtract/add counts. Resource-specific targeting is a future mechanic.
- **Factory allocation:** Both queue and percentage-based. Each job has a desired capacity %; unused % flows to next waiting job. Multiple jobs run in parallel proportional to actual allocated capacity.
- **Governor system:** Deterministic colony AI (mirrors commander judgment pattern). Player constrains scope. Research always stays with the player — governors build labs/academies but never assign scientists.
- **Ship order system:** Multi-step sequential mission orders with loop/repeat (Aurora-style). Separate from the autonomous command tree. Architecture TBD pending Aurora research. See `tasks/ship-order-system-design.md`.

### Design Research Library
Detailed research references in `tasks/`:
- `v1-design-constraints.md` — Accepted v1 rules: factory allocation, mine model, ship design, research rules
- `game-vision-early-game.md` — Early game loop and "The Factory Must Grow" hook
- `governor-system-design.md` — Deterministic colony governor AI design
- `ship-order-system-design.md` — Multi-step order loop system (Aurora-style)
- `research-game-depth-theory.md` — Game depth theory, Shannon number, combinatorial depth
- `research-combinatorial-depth.md` — CCG patterns (MTG, Slay the Spire), 4X application
- `emergent-systems-research.md` — Emergent interactions, 10 principles, 7 anti-patterns
- `design-theory-reference.md` — Emergent gameplay theory, complexity management
- `design-patterns-depth-longevity.md` — DF, RimWorld, Factorio, Shadow Empire depth patterns
- `design-patterns-depth-research.md` — CDDA, UnReal World, Caves of Qud, ONI depth patterns
- `research-academic-depth-bibliography.md` — Academic papers, GDC talks, books annotated bibliography
- `colony-system-design.md` — Colony system design notes (living document)
- `resource-system-design.md` — Resource catalog, production chains, mining design
- `tech-tree-overview.md` — 10-domain tech tree structure with MTG set philosophy
- `tech-tree-propulsion.md`, `tech-tree-sensors.md`, `tech-tree-weapons.md`, `tech-tree-communications.md`, `tech-tree-computing.md`, `tech-tree-electronic-warfare.md`, `tech-tree-materials.md`, `tech-tree-life-support.md`, `tech-tree-theoretical-physics.md` — Per-domain tech tree designs
- `lore-trans-newtonian-discovery.md` — TN physics discovery lore
- `lore-tech-attribution.md` — Idea attribution tracking for tech/lore

## Testing

672+ tests across 24 files using Vitest + jsdom. Tests cover:
- Orbital math (orbit.test.ts)
- Visual scaling (visual.test.ts)
- Date/time formatting & save/restore (state.test.ts)
- Transfer mechanics (transfer.test.ts)
- System generation (system-generator.test.ts)
- UI helpers (ui.test.ts, ui-helpers.test.ts)
- Coordinate transforms (rendering.test.ts)
- Ship physics (ship-physics.test.ts)
- Ship transfers (ship-transfer.test.ts)
- Ship design calculations (ship-design-calc.test.ts)
- RNG (utils.test.ts)
- Command tree, ship simulation & intent-aware survey (commands.test.ts)
- Notifications (notifications.test.ts)
- Resources & deposits (resources.test.ts)
- Body creation & selection (bodies.test.ts, selection.test.ts)
- Entity resolution & maps (entities.test.ts)
- Ship intent broadcast (intents.test.ts)
- Resource viewer data collection (resource-viewer.test.ts)
- Colony system: workforce, construction costs, mining, research, warnings (colonies.test.ts)
- Property-based invariants (property.test.ts)
- Transfer initiation & fuel budget (transfers.test.ts)

All tests must pass before committing. Run `bun run test` to verify.
