# System Generator Plan

## Goal
Build a procedural star system generator that produces the same data structures currently hardcoded in main.js (BODIES, COMETS, ASTEROID_BELTS), supporting multiple system archetypes including binary stars.

## Architecture

### Input
- Seed (number) — deterministic output for same seed
- System class (optional override, otherwise rolled from weighted distribution)

### Output
```js
{
  stars: [],        // 1-2 stars (single or binary)
  bodies: [],       // same shape as current BODIES array
  comets: [],       // same shape as current COMETS array
  asteroidBelts: [] // same shape as current ASTEROID_BELTS array
}
```

### System Classes (weighted)

| Class | Weight | Description |
|-------|--------|-------------|
| Peas-in-a-Pod | 40% | 3-7 similarly-sized sub-Neptunes/super-Earths packed < 1 AU |
| Solar-like | 15% | Rocky inner, gas giants outer, ice giants furthest. Ordered by composition |
| Hot Jupiter | 10% | 1 dominant gas giant close in, few or no companions |
| Warm Jupiter Mixed | 15% | Gas giant + mix of smaller planets at various distances |
| Compact Multi | 10% | 4-8 small planets within 0.5 AU, tightly packed |
| Giant Dominated | 10% | 2-3 gas giants, no inner rocky planets (cleared by migration) |

### Binary Star Support

| Config | Frequency | Rules |
|--------|-----------|-------|
| Single star | ~65% | Normal generation |
| S-type (circumstellar) | ~25% | Planets orbit primary star only. Planet distance < 1/5 of binary closest approach |
| P-type (circumbinary) | ~10% | Planets orbit both stars. Min distance = 2-4x binary separation |

Binary parameters:
- Separation: log-normal distribution, peak ~50 AU, range 0.1 - 10,000 AU
- Mass ratio: 0.1 - 1.0 (secondary/primary)
- Close binaries (< 1 AU): mostly P-type planets if any
- Wide binaries (> 100 AU): S-type planets around primary, essentially independent

### Star Generation
- Spectral type from weighted distribution (M most common, O rarest)
- Mass, radius, luminosity, color, temperature derived from spectral type
- Binary secondary constrained by mass ratio

### Planet Generation Rules

#### Spacing
- Orbital periods follow log-uniform ratios (each planet ~1.5-3x period of previous)
- Enforce Hill sphere stability (no overlapping gravitational influence)
- Titius-Bode-like spacing with jitter

#### Sizing
- Radius valley: planets cluster around ~1.5 Re (super-Earth) or ~2.5 Re (sub-Neptune)
- Intra-system similarity: same system planets tend toward similar sizes (within class)
- Gas giants: 5-15 Re, placed beyond snow line for Solar-like systems

#### Moons
- Rocky planets: 0-2 small moons
- Gas giants: 1-6 moons (major), procedural count
- Ice giants: 1-4 moons
- Moon distance and period scaled to parent

#### Asteroid Belts
- Placed at resonance boundaries with largest gas giant (if present)
- 0-2 belts per system
- Kuiper-like belt beyond outermost giant (if system has giants)
- Count and spread scaled to system mass

#### Comets
- 3-10 per system
- High eccentricity (0.8-0.999)
- Semi-major axes from near-star to outer system
- Low inclination (1-5 deg, matching current visual style)

### Naming
- Star: procedural name (e.g., "Kepler-442", "HD 219134", or fantasy names)
- Planets: star name + letter suffix (b, c, d...)
- Moons: planet name + Roman numeral (I, II, III...)

## Design Decisions
- On-demand generation: systems created from seed when discovered, infinite expansion
- Separate module: `system-generator.js` as ES module imported by main.js
- System switcher UI: dropdown/list to switch between Sol and generated systems
- Catalog naming: star names like "HD 219134", "GJ 876", planets get letter suffixes (b, c, d...)
- Game context: Sol is home system, other systems discovered during gameplay

## Implementation Tasks

### Phase 1: Generator Module
- [ ] Create `system-generator.js` with seeded RNG utilities
- [ ] Star generation (spectral type, mass, radius, luminosity, color)
- [ ] Binary star generation (separation, mass ratio, S-type/P-type selection)
- [ ] System class selection (weighted roll from seed)
- [ ] Planet orbital spacing (log-period ratios with Hill stability)
- [ ] Planet sizing (radius valley, intra-system similarity)
- [ ] Moon generation (count/size scaled to parent type)
- [ ] Asteroid belt placement (resonance boundaries with giants, 0-2 belts + optional Kuiper)
- [ ] Comet generation (3-10, high eccentricity, low inclination)
- [ ] Catalog naming system (star catalog ID + planet letters + moon Roman numerals)

### Phase 2: Integration
- [ ] Export generator output matching BODIES/COMETS/ASTEROID_BELTS shapes
- [ ] Refactor main.js to consume generated data instead of hardcoded arrays
- [ ] Keep Sol as a built-in preset (not generated)
- [ ] Add system switcher UI (panel with Sol + generated systems)
- [ ] Wire seed-based discovery (new system from seed on demand)

## Constraints
- All output must match existing data structure shapes so rendering code needs zero changes
- Deterministic: same seed = same system every time
- Visually interesting: avoid degenerate systems (1 planet, nothing else)
- Performance: generation should be < 100ms
- Sol always available as home system
