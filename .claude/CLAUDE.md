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
  core/       state.ts, utils.ts         (app state, RNG helpers)
  math/       orbit.ts, visual.ts,       (pure math, no app imports)
              transfer.ts, ship-physics.ts
  rendering/  rendering.ts, scene.ts,    (Three.js scene, bodies, textures)
              textures.ts
  ui/         ui.ts, selection.ts        (HUD, labels, click handlers)
  data/       sol-data.ts,               (system data & generation)
              system-generator.ts
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
  rendering/scene.ts, rendering/textures.ts
        |
  rendering/rendering.ts, math/transfer.ts, ui/selection.ts, ui/ui.ts
        |
     main.ts  (orchestrator)
```

**Key modules:**
- `src/types.ts` — Shared interfaces: BodyEntry, AppState, CategoryVisibility, CategoryKey
- `src/core/state.ts` — Single centralized state object, save/restore to localStorage
- `src/math/orbit.ts` — Kepler solver (meanToTrue), orbital mechanics primitives
- `src/rendering/rendering.ts` — Body creation, position updates, Hermite spline ship transfers
- `src/math/transfer.ts` — Transfer math (Lambert solver retained for reference, Hermite used in practice)
- `src/data/system-generator.ts` — Procedural star system generation from seeds

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
- **Ship state machine:** orbiting → departing → transferring → orbiting. Departure uses angle-crossing detector; transfer uses cubic Hermite with capture blend (t^4).
- **Comet trails:** Pre-filled on creation by computing past orbital positions backwards. Trail buffer is 1200 points (vs 400 for planets). Sample rate scales with zoom level.
- **Render-on-demand:** 30fps cap; render loop stops when paused and resumes on input (wake-render event).
- **No circular imports.** Pure math modules have zero app imports.
- **Biome enforced:** Linter + formatter. Tabs, double quotes, trailing commas. Zero warnings policy. Config in `biome.json`.

## Testing

215 tests across 9 files using Vitest + jsdom. Tests cover:
- Orbital math (orbit.test.ts)
- Visual scaling (visual.test.ts)
- Date/time formatting (state.test.ts)
- Transfer mechanics (transfer.test.ts)
- System generation (system-generator.test.ts)
- UI helpers (ui.test.ts)
- Coordinate transforms (rendering.test.ts)
- Ship physics (ship-physics.test.ts)
- RNG (utils.test.ts)

All tests must pass before committing. Run `bun run test` to verify.
