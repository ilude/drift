# Drift

A 4X space exploration sim with procedural star systems, Kepler-based orbital mechanics, autonomous survey ships, and resource discovery.

Built with [Three.js](https://threejs.org/) and TypeScript, bundled with [Vite](https://vite.dev/).

## Getting Started

```bash
bun install
make dev
```

Open http://localhost:5173 in your browser.

## Commands

| Command | Description |
|---|---|
| `make dev` | Start Vite dev server |
| `make build` | Production build to `dist/` |
| `make test` | Run all tests |
| `make test-watch` | Run tests in watch mode |
| `make coverage` | Test coverage report (v8) |
| `make lint` | Biome (linter + formatter) |
| `make check` | Lint + test + build (full verify) |
| `make clean` | Remove `dist/` and `coverage/` |

## Features

- **Procedural star systems** — Seed-based generation with deterministic RNG. Enter a seed or discover random systems.
- **Kepler orbits** — Planets and moons follow eccentric orbits solved with Newton's method.
- **Autonomous survey ships** — Ships with priority-ordered command trees that drive survey missions, refueling, crew R&R, and maintenance. Immediate command override for manual control.
- **Multi-level surveys** — Three survey levels revealing progressively rarer resources. 27 resource types across metals, volatiles, industrial, radioactive, and umbral categories.
- **Brachistochrone transfers** — Hermite spline trajectories with station-keeping arrival. Engine tiers from 0.1g conventional to 200g exotic drives.
- **Ship simulation** — Crew morale decay, hull malfunction cascades, gradual refueling/repair/shore leave, colony supply shuttles. Configurable survey difficulty multiplier.
- **Procedural textures** — Canvas-generated rocky, gas giant, ice giant, and moon surfaces. GLSL star shader with animated granulation.
- **Planetary rings and clouds** — LOD-gated ring systems and semi-transparent cloud layers.
- **Time control** — 11 speeds from 5 seconds to 30 days per frame, with pause and step-through.
- **Save/restore** — Discovered systems and simulation state persist to localStorage.

## Architecture

All source lives under `src/` with logical subdirectories:

```
src/
  core/
    state.ts              Centralized state, date/time utils, save/load
    utils.ts              Seeded RNG helpers
    commands.ts           Command tree evaluation, ship simulation tick
    notifications.ts      Notification system with coalescing and smart pause
  math/
    orbit.ts              Kepler solver, orbital mechanics primitives
    visual.ts             Display math: sizing, LOD, screen radius
    transfer.ts           Transfer math (Hermite splines, Lambert reference)
    ship-physics.ts       Brachistochrone physics, engine tiers, delta-v
  rendering/
    rendering.ts          Position updates, ship transfer dispatch
    scene.ts              Three.js setup, camera, controls, grid
    textures.ts           Procedural planet/star/cloud textures
    bodies.ts             Body/ship creation, survey state init
    ship-transfer.ts      Hermite spline transfers, capture blend
  ui/
    ui.ts                 Body list, system switcher, time controls, HUD
    selection.ts          Click detection, fly-to, info panel, follow camera
    commands.ts           Command tree editor UI
  data/
    sol-data.ts           Sol System preset data
    system-generator.ts   Procedural star system generation
    resources.ts          Resource catalog, seeded deposit generation
  types.ts                Shared TypeScript interfaces
  main.ts                 Orchestrator: init, teardown, animation loop
  __tests__/              All test files (16 files, 392 tests)
```

## Testing

392 tests across 16 files using [Vitest](https://vitest.dev/) with jsdom.

```bash
make test          # single run
make test-watch    # watch mode
make coverage      # with v8 coverage
```

## License

ISC
