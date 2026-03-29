# Drift

A 4X space exploration sim with procedural star systems, Kepler-based orbital mechanics, autonomous survey ships, and resource discovery.

Built with [Three.js](https://threejs.org/) and TypeScript, bundled with [Vite](https://vite.dev/).

## Getting Started

```bash
bun install
bun run dev
```

Open http://localhost:5173 in your browser.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start Vite dev server |
| `bun run build` | Production build to `dist/` |
| `bun run test` | Run all tests |
| `bun run test:watch` | Run tests in watch mode |
| `bun run test:coverage` | Test coverage report (v8) |
| `bun run lint` | Biome (linter + formatter) |
| `bun run typecheck` | TypeScript type checking |
| `bun run dead-code` | Knip unused-code scan |
| `bun run verify:fast` | Lint + typecheck |
| `bun run verify` | Lint + typecheck + test + build |
| `bun run clean` | Remove `dist/` and `coverage/` |

`make` targets remain available as thin wrappers, but `bun run ...` is the canonical workflow.

## Contributor Workflow

- Runtime: Bun `1.3.9+` and Node `20+`
- Install: `bun install`
- Fast local verification: `bun run verify:fast`
- Full verification before handoff: `bun run verify`
- Generated output: `dist/` should not be edited manually
- Agent guidance: see [`AGENTS.md`](./AGENTS.md) and [`.claude/CLAUDE.md`](./.claude/CLAUDE.md)

### Targeted Tests

```bash
bunx vitest run src/__tests__/commands.test.ts
bunx vitest run src/__tests__/resource-viewer.test.ts
bunx vitest run src/__tests__/orbit.test.ts
```

## Features

- **Procedural star systems** — Seed-based generation with deterministic RNG. Enter a seed or discover random systems.
- **Kepler orbits** — Planets and moons follow eccentric orbits solved with Newton's method.
- **Autonomous survey ships** — Ships with priority-ordered command trees that drive survey missions, refueling, crew R&R, and maintenance. Immediate command override for manual control.
- **Multi-level surveys** — Three survey levels representing scan depth (surface → mid-depth → deep). 27 resource types across metals, volatiles, industrial, radioactive, and umbral categories. Deposit pools are scientifically grounded — gas giants yield He-3 and deuterium, icy moons yield water, C-type asteroids yield carbon and organics.
- **Resource viewer** — Popout spreadsheet window for multi-monitor setups. Body×resource matrix with category tabs, sortable columns, and click-to-navigate.
- **Brachistochrone transfers** — Hermite spline trajectories with station-keeping arrival. Engine tiers from 0.1g conventional to 200g exotic drives.
- **Colony system** — Per-body colonies with population, habitability, installations (repair yard, fuel depot, mine, lab, academy, construction factory, storage, shipyard), and stockpiles. Colony quality drives ship repair and refuel rates. Construction queue with BP-based project progress and resource costs. Colony warning notifications for understaffing, idle infrastructure, and resource-blocked construction.
- **Ship simulation** — Crew morale decay, hull malfunction cascades (bathtub curve), gradual refueling/repair/shore leave, colony supply shuttles. Tanker ship with fleet refueling and tanker coordination (target ships hold orbit when a tanker is inbound). Configurable difficulty multipliers.
- **Procedural textures** — Canvas-generated rocky, gas giant, ice giant, and moon surfaces. GLSL star shader with animated granulation.
- **Planetary rings and clouds** — LOD-gated ring systems and semi-transparent cloud layers.
- **Time control** — 11 speeds from 5 seconds to 30 days per frame, with pause and step-through.
- **Manual save** — Save button in header bar. Fresh start on each reload.

## Architecture

All source lives under `src/` with logical subdirectories:

```
src/
  core/
    state.ts              Centralized state, date/time utils, save/load
    utils.ts              Seeded RNG helpers
    result.ts             Go-style Result<T> tuple helpers
    commands.ts           Command tree evaluation, ship simulation tick
    commander.ts          Commander judgment layer (preemptive service, defer maintenance, hold for tanker)
    colonies.ts           Colony system: workforce, qualities, ticking (mining, construction, research)
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
    resource-viewer.ts    Popout resource matrix window
    colony-panel.ts       Colony management panel (overview, construction queue, research queue)
  data/
    sol-data.ts           Sol System preset data
    system-generator.ts   Procedural star system generation
    resources.ts          Resource catalog, seeded deposit generation
  types.ts                Shared TypeScript interfaces
  main.ts                 Orchestrator: init, teardown, animation loop
  __tests__/              All test files (24 files, 672+ tests)
```

## Testing

672+ tests across 24 files using [Vitest](https://vitest.dev/) with jsdom.

```bash
bun run test                # single run
bun run test:watch          # watch mode
bun run test:coverage       # with v8 coverage
bun run verify              # full repo verification
```

## License

ISC
