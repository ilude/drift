# Drift

A 4X space exploration sim with procedural star systems, Kepler-based orbital mechanics, and engine-driven ship transfers.

Built with [Three.js](https://threejs.org/) and vanilla JavaScript, bundled with [Vite](https://vite.dev/).

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
| `make lint` | ESLint |
| `make check` | Lint + test + build (full verify) |
| `make clean` | Remove `dist/` and `coverage/` |

## Features

- **Procedural star systems** — Seed-based generation with deterministic RNG. Enter a seed or discover random systems.
- **Kepler orbits** — Planets and moons follow eccentric orbits solved with Newton's method.
- **Ship transfers** — Cubic Hermite spline trajectories with smooth departure/arrival arcs, stable at any time speed.
- **Procedural textures** — Canvas-generated rocky, gas giant, ice giant, and moon surfaces. GLSL star shader with animated granulation.
- **Planetary rings and clouds** — LOD-gated ring systems and semi-transparent cloud layers.
- **Time control** — 11 speeds from 5 seconds to 30 days per frame, with pause and step-through.
- **Save/restore** — Discovered systems and simulation state persist to localStorage.

## Architecture

All source lives in the project root:

```
main.js              Orchestrator: init, teardown, animation loop
state.js             Centralized state, date/time utils, save/load
orbit.js             Kepler solver, orbital mechanics primitives
visual.js            Display math: sizing, LOD, screen radius
scene.js             Three.js setup, camera, controls, grid
rendering.js         Body creation, position updates, ship transfers
selection.js         Click detection, fly-to, info panel, follow camera
transfer.js          Transfer math (Hermite splines, Lambert reference)
ui.js                Body list, system switcher, time controls, HUD
textures.js          Procedural planet/star/cloud textures
system-generator.js  Procedural star system generation
sol-data.js          Sol System preset data
utils.js             Seeded RNG helpers
```

## Testing

172 tests across 8 files using [Vitest](https://vitest.dev/) with jsdom.

```bash
make test          # single run
make test-watch    # watch mode
make coverage      # with v8 coverage
```

## License

ISC
