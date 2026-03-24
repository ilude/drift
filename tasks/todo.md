# System Generator Plan — COMPLETED

## Status
Implemented in `src/data/system-generator.ts` with tests in `src/__tests__/system-generator.test.ts`. System switcher UI in header bar. Sol is built-in preset; procedural systems generated from seed on demand.

## Implementation Tasks

### Phase 1: Generator Module
- [x] Create `system-generator.ts` with seeded RNG utilities
- [x] Star generation (spectral type, mass, radius, luminosity, color)
- [x] Binary star generation (separation, mass ratio, S-type/P-type selection)
- [x] System class selection (weighted roll from seed)
- [x] Planet orbital spacing (log-period ratios with Hill stability)
- [x] Planet sizing (radius valley, intra-system similarity)
- [x] Moon generation (count/size scaled to parent type)
- [x] Asteroid belt placement (resonance boundaries with giants, 0-2 belts + optional Kuiper)
- [x] Comet generation (3-10, high eccentricity, low inclination)
- [x] Catalog naming system (star catalog ID + planet letters + moon Roman numerals)

### Phase 2: Integration
- [x] Export generator output matching BODIES/COMETS/ASTEROID_BELTS shapes
- [x] Refactor main.ts to consume generated data instead of hardcoded arrays
- [x] Keep Sol as a built-in preset (not generated)
- [x] Add system switcher UI (panel with Sol + generated systems)
- [x] Wire seed-based discovery (new system from seed on demand)

## Design Reference (kept for context)

### System Classes (weighted)

| Class | Weight | Description |
|-------|--------|-------------|
| Peas-in-a-Pod | 40% | 3-7 similarly-sized sub-Neptunes/super-Earths packed < 1 AU |
| Solar-like | 15% | Rocky inner, gas giants outer, ice giants furthest |
| Hot Jupiter | 10% | 1 dominant gas giant close in, few or no companions |
| Warm Jupiter Mixed | 15% | Gas giant + mix of smaller planets |
| Compact Multi | 10% | 4-8 small planets within 0.5 AU |
| Giant Dominated | 10% | 2-3 gas giants, no inner rocky planets |

### Constraints
- All output matches existing data structure shapes
- Deterministic: same seed = same system every time
- Performance: generation < 100ms
- Sol always available as home system
