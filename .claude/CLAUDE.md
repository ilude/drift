# Drift

4X space exploration sim built with Three.js and vanilla JS (Vite bundler).

## Commands

- `bun run dev` — Start dev server
- `bun run build` — Production build
- `bun run test` — Run tests
- `bun run test:watch` — Watch mode tests
- `bun run test:coverage` — Coverage report (v8)
- `bun run lint` — ESLint

## Architecture

All source lives under `src/` with logical subdirectories. Tests live in `src/__tests__/`. Static assets go in `public/` (served as-is by Vite). `index.html` stays at project root (Vite entry point).

```
public/                                  (static assets: favicon, images, etc.)
src/
  style.css                              (app styles, imported by main.js)
  core/       state.js, utils.js         (app state, RNG helpers)
  math/       orbit.js, visual.js,       (pure math, no app imports)
              transfer.js
  rendering/  rendering.js, scene.js,    (Three.js scene, bodies, textures)
              textures.js
  ui/         ui.js, selection.js        (HUD, labels, click handlers)
  data/       sol-data.js,               (system data & generation)
              system-generator.js
  main.js                                (orchestrator, entry point)
  __tests__/  *.test.js                  (all test files)
```

**Import hierarchy (no circular deps):**
```
core/utils.js, math/orbit.js, math/visual.js  (pure math, no app imports)
        |
    core/state.js  (imports nothing)
        |
  rendering/scene.js, rendering/textures.js
        |
  rendering/rendering.js, math/transfer.js, ui/selection.js, ui/ui.js
        |
     main.js  (orchestrator)
```

**Key modules:**
- `src/core/state.js` — Single centralized state object, save/restore to localStorage
- `src/math/orbit.js` — Kepler solver (meanToTrue), orbital mechanics primitives
- `src/rendering/rendering.js` — Body creation, position updates, Hermite spline ship transfers
- `src/math/transfer.js` — Transfer math (Lambert solver retained for reference, Hermite used in practice)
- `src/data/system-generator.js` — Procedural star system generation from seeds

## Conventions

- **Deterministic:** MASTER_SEED (42) drives all RNG. Same seed = same universe.
- **Scratch objects:** Hot-loop functions (inclinedPosition, orbitToWorld) reuse output objects to avoid GC pressure.
- **World coordinates:** sqrt-compressed mapping: `rWorld = sqrt(rAU) * DIST_SCALE`. Ship transfers use Hermite splines in world space to avoid coordinate distortion.
- **LOD:** 3-tier sphere geometry (8/24/48 segments), rings/clouds gated at 15px screen radius.
- **Ship state machine:** orbiting → departing → transferring → orbiting. Departure uses angle-crossing detector; transfer uses cubic Hermite with capture blend (t^4).
- **No circular imports.** Pure math modules have zero app imports.
- **ESLint enforced:** `no-use-before-define`, `no-unused-vars`. Zero warnings policy.

## Testing

172 tests across 8 files using Vitest + jsdom. Tests cover:
- Orbital math (orbit.test.js)
- Visual scaling (visual.test.js)
- Date/time formatting (state.test.js)
- Transfer mechanics (transfer.test.js)
- System generation (system-generator.test.js)
- UI helpers (ui.test.js)
- Coordinate transforms (rendering.test.js)
- RNG (utils.test.js)

All tests must pass before committing. Run `bun run test` to verify.
