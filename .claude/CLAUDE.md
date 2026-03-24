# Drift

4X space exploration sim built with Three.js and TypeScript (Vite bundler).

## Commands

- `bun run dev` — Start dev server
- `bun run build` — Production build
- `bun run test` — Run tests
- `bun run test:watch` — Watch mode tests
- `bun run test:coverage` — Coverage report (v8)
- `bun run lint` — Biome (linter + formatter)

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
              notifications.ts           (notification system with coalescing)
  math/       orbit.ts, visual.ts,       (pure math, no app imports)
              transfer.ts, ship-physics.ts
  rendering/  rendering.ts, scene.ts,    (Three.js scene, bodies, textures)
              textures.ts, bodies.ts,    (body init, survey state)
              ship-transfer.ts           (Hermite spline transfers, capture blend)
  ui/         ui.ts, selection.ts,       (HUD, labels, click handlers)
              commands.ts                (command tree editor UI)
  data/       sol-data.ts,               (system data & generation)
              system-generator.ts,
              resources.ts               (resource catalog, deposit generation)
  types.ts                               (shared TypeScript interfaces)
  main.ts                                (orchestrator, entry point)
  __tests__/  *.test.ts                  (all test files)
```

**Import hierarchy (no circular deps):**
```
core/utils.ts, math/orbit.ts, math/visual.ts  (pure math, no app imports)
        |
    core/state.ts  (imports nothing)
        |
    core/entities.ts  (imports: state.ts, types.ts, math/orbit.ts)
        |
  core/intents.ts, core/commands.ts, core/notifications.ts, data/resources.ts
        |
  rendering/scene.ts, rendering/textures.ts, rendering/bodies.ts
        |
  rendering/rendering.ts, rendering/ship-transfer.ts, math/transfer.ts
        |
  ui/selection.ts, ui/ui.ts, ui/commands.ts
        |
     main.ts  (orchestrator)
```

**Key modules:**
- `src/types.ts` — Shared interfaces: BodyEntry, ShipEntry, ShipIntent, CommandEntry, AppState, ResolvedEntity
- `src/core/state.ts` — Single centralized state object, save/restore to localStorage (SAVE_VERSION 5, plural ships)
- `src/core/entities.ts` — Unified O(1) entity resolution: resolveEntity, findBody, findPlanet, findShip, findStar, findAsteroidEntity. Backed by Maps rebuilt via rebuildEntityMaps(). Lives in core/ so commands.ts can import it.
- `src/core/intents.ts` — Ship intent broadcast for multi-ship coordination: publishIntent, clearIntent, getClaimedTargets. Ships broadcast current activity, others skip claimed targets.
- `src/core/commands.ts` — Command tree evaluation (pure logic, no rendering imports), ship simulation tick, commander judgment (preemptive servicing, learning)
- `src/core/notifications.ts` — Notification system with coalescing, smart pause, FIFO cap (200 entries)
- `src/math/orbit.ts` — Kepler solver (meanToTrue), orbital mechanics primitives
- `src/math/ship-physics.ts` — Brachistochrone transfer physics, engine tiers, delta-v budget
- `src/rendering/rendering.ts` — Position updates, ship transfer dispatch, action completion
- `src/rendering/bodies.ts` — Body/ship creation, survey state initialization
- `src/rendering/ship-transfer.ts` — Hermite spline transfers, capture blend, station-keeping approach
- `src/math/transfer.ts` — Transfer math helpers: Hohmann, game transfer timing, coordinate-independent utilities
- `src/data/system-generator.ts` — Procedural star system generation from seeds
- `src/data/resources.ts` — Resource catalog (27 entries), seeded deposit generation per body
- `src/ui/commands.ts` — Command tree editor UI (reorder, toggle, add/remove orders)

## UI Structure

- **Header bar:** `[System Name ▾] | [View ▾] | <spacer> | [Pause] [Speed ▾] | [Date] [Perf]`
- **View menu:** Dropdown with per-category visibility toggles (labels, orbits, trails) for each body type. Recenter button with Ctrl+R shortcut.
- **Body categories:** Star, Planet, Dwarf Planet, Detached Object, Moon, Comet, Asteroid, Ship — each with independent visibility controls via `state.categoryVisibility`.
- **Dropdowns** (system-switcher, speed-selector, view-menu) are positioned dynamically using `getBoundingClientRect()` for alignment.

## Conventions

- **Deterministic:** MASTER_SEED (42) drives all RNG. Same seed = same universe.
- **Scratch objects:** Hot-loop functions (inclinedPosition, orbitToWorld) reuse output objects to avoid GC pressure.
- **World coordinates:** sqrt-compressed mapping: `rWorld = sqrt(rAU) * DIST_SCALE`. Ship transfers use Hermite splines in world space to avoid coordinate distortion.
- **LOD:** 3-tier sphere geometry (8/24/48 segments), rings/clouds gated at 15px screen radius.
- **Multi-ship:** Game supports multiple named ships created via `createShip(config: ShipConfig)`. Ships coordinate via intent broadcast — `selectNextSurveyTarget` skips bodies claimed by other ships. HUD shows selected ship status or fleet aggregate. Save/restore matches ships by name.
- **Entity resolution:** All entity-by-name lookups go through `core/entities.ts`. Never use `state.bodyMeshes.find()` directly — use `findBody()`, `resolveEntity()`, `findAsteroidEntity()`, etc. Maps rebuilt via `rebuildEntityMaps()` after body/asteroid creation.
- **Ship state machine:** orbiting → transferring → orbiting. Transfer uses 3D cubic Hermite splines with station-keeping capture blend (smoothstep in final 15%). Ships use brachistochrone physics (default 0.1g engine) for transfer timing. Minimum fuel floor of 1% capacity/day ensures visible transfer cost with high-Isp TN engines.
- **Ship command tree:** Priority-ordered list of conditional commands (fuel-below, morale-below, hull-below, supplies-below, always). Evaluated between actions. `immediateCommand` is one-shot — cleared at the top of `dispatchCommand()` on any dispatch.
- **Ship simulation:** `tickShipSimulation()` runs per-frame: morale decay (1.5 exponent past 180-day deployment limit), maintenance age, malfunction checks (every 30 days during transfers), fuel drain (station-keeping rates), gradual recovery during actions (refuel: 5d fixed, overhaul: dynamic duration based on hull/supply deficit at +2.5%/day each +0.5 morale/day, shore leave: 30d at +2.5 morale/day +0.25% hull/day from repair crew). All recovery rates scaled by `depotQuality` and per-system hardness multipliers.
- **Survey system:** Multi-level surveys (1-3) revealing progressively rarer resources. Duration scales with body type and crew/hull condition. `surveyMultiplier` state setting for difficulty tuning.
- **Rate modifier pattern:** Every rate-based game system uses two orthogonal scaling axes:
  1. **Quality modifier** (`depotQuality`): represents location facilities — crew competence, equipment modernity, depot capacity. Currently a single global value (1.0 = 100%), eventually calculated per-location from base/colony subsystems.
  2. **Game hardness multiplier** (per-system on AppState): player-chosen difficulty. 1.0 = default, higher = slower/harder. Current multipliers: `surveyMultiplier`, `repairMultiplier`, `refuelMultiplier`, `moraleMultiplier`, `supplyMultiplier`.
  - **Formula:** `effectiveRate = baseRate * quality / hardnessMultiplier`
  - **Convention:** All new rate-based systems MUST include both modifiers. Values are stored as decimals (1.0 = 100%). When brainstorming new systems, proactively identify where quality and hardness modifiers should apply.
- **Commander judgment:** Ships have a `Commander` with `judgment` (0.0–1.0) and `experience` counter. Judgment enables preemptive servicing at colonies: before departing, raises command tree thresholds by `(100 - base) * judgment * 0.3`. Learning from failure: malfunctions and emergency-returns bump judgment with diminishing returns, capped at 0.9. New ships start at 0.3. Future crew career system designed in `tasks/crew-career-system.md`.
- **Comet trails:** Pre-filled on creation by computing past orbital positions backwards. Trail buffer is 1200 points (vs 400 for planets). Sample rate scales with zoom level.
- **Render-on-demand:** 30fps cap; render loop stops when paused and resumes on input (wake-render event).
- **No circular imports.** Pure math modules have zero app imports.
- **Biome enforced:** Linter + formatter. Tabs, double quotes, trailing commas. Zero warnings policy. Config in `biome.json`.

## Testing

501 tests across 19 files using Vitest + jsdom. Tests cover:
- Orbital math (orbit.test.ts)
- Visual scaling (visual.test.ts)
- Date/time formatting & save/restore (state.test.ts)
- Transfer mechanics (transfer.test.ts)
- System generation (system-generator.test.ts)
- UI helpers (ui.test.ts, ui-helpers.test.ts)
- Coordinate transforms (rendering.test.ts)
- Ship physics (ship-physics.test.ts)
- Ship transfers (ship-transfer.test.ts)
- RNG (utils.test.ts)
- Command tree, ship simulation & intent-aware survey (commands.test.ts)
- Notifications (notifications.test.ts)
- Resources & deposits (resources.test.ts)
- Body creation & selection (bodies.test.ts, selection.test.ts)
- Entity resolution & maps (entities.test.ts)
- Ship intent broadcast (intents.test.ts)

All tests must pass before committing. Run `bun run test` to verify.
