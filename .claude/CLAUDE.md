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

All source lives in the project root — no `src/` directory.

**Import hierarchy (no circular deps):**
```
utils.js, orbit.js, visual.js  (pure math, no app imports)
        |
    state.js  (imports nothing)
        |
  scene.js, textures.js
        |
  rendering.js, transfer.js, selection.js, ui.js
        |
     main.js  (orchestrator)
```

**Key modules:**
- `state.js` — Single centralized state object, save/restore to localStorage
- `orbit.js` — Kepler solver (meanToTrue), orbital mechanics primitives
- `rendering.js` — Body creation, position updates, Hermite spline ship transfers
- `transfer.js` — Transfer math (Lambert solver retained for reference, Hermite used in practice)
- `system-generator.js` — Procedural star system generation from seeds

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
