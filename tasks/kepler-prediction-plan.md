# Kepler Transfer Prediction Plan

## Problem
`predictTargetWorld()` in `ship-transfer.ts` uses linear extrapolation (constant radius, constant angular velocity) to predict where a target body will be at transfer arrival. This causes the Hermite spline endpoint to miss the actual body position for eccentric orbits, producing a visible jump at transfer completion.

## Root Cause
```ts
// Current: assumes circular orbit
const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
x = cos(arrivalAngle) * currentR;  // constant radius — WRONG for elliptical orbits
```

The render loop uses proper Kepler mechanics:
```ts
const theta = meanToTrue(entry.angle, ecc);        // solve Kepler's equation
const kr = keplerRadius(entry.data.distance, ecc, theta);  // varying radius
const r = scaleDist(kr);                            // world-space radius
```

## Solution
Replace linear extrapolation with Kepler propagation using the same math the render loop already uses. All required functions exist in `math/orbit.ts`.

## Implementation

### T1: Update `predictTargetWorld()` in `ship-transfer.ts`

Current signature stays the same:
```ts
predictTargetWorld(targetEntry: BodyEntry, daysFromNow: number): { x: number; z: number }
```

New logic:
1. Get current mean anomaly: `targetEntry.angle`
2. Get orbital elements: `targetEntry.data.distance` (semi-major axis), `targetEntry.data.e` (eccentricity)
3. Propagate mean anomaly: `futureM = entry.angle + entry.speed * daysFromNow`
4. Solve Kepler: `futureTheta = meanToTrue(futureM, ecc)`
5. Compute future radius: `futureR_AU = keplerRadius(a, ecc, futureTheta)`
6. Convert to world: `futureR_world = scaleDist(futureR_AU)`
7. Compute world position: `x = cos(futureTheta) * futureR_world`, `z = sin(futureTheta) * futureR_world`

**Special cases:**
- **Moons:** Moons orbit a parent planet, not the star. Their position is parent + offset. Need to propagate BOTH the parent and the moon.
  - Propagate parent: `parentTheta`, `parentR` → parent world position
  - Propagate moon: `moonTheta`, `moonR` (using MOON_DIST_SCALE) → offset from parent
  - Final position = parent world + moon offset
  - Use `moonOrbitScale(zoomFactor)` — but we don't know future zoom. Use current scale or 1.0.
  - Actually, moons use `MOON_DIST_SCALE * moonScale` where moonScale depends on camera. For prediction, use MOON_DIST_SCALE alone (matches the orbital mechanics, visual scaling is cosmetic).

- **Comets:** Comets have inclined 3D orbits with `incRad`, `nodeRad`, `periRad` parameters. Use the `orbitToWorld()` function from bodies.ts to handle the coordinate transform.

- **Asteroids:** Asteroid proxies don't have orbital elements on the BodyEntry. They have `speed` and current position. For asteroids, fall back to the existing linear extrapolation (their orbits are roughly circular within belts).

- **Star (distance=0):** Return current position (stationary). Already handled.

### T2: Import required functions

Add to `ship-transfer.ts` imports:
```ts
import { keplerRadius, meanToTrue, scaleDist, MOON_DIST_SCALE } from "../math/orbit";
```

`scaleDist` and `MOON_DIST_SCALE` may already be imported — check first.

### T3: Handle the `updateTransferPath()` lookahead

`updateTransferPath()` also calls `predictTargetWorld()` to draw the spline preview during transit. With proper Kepler propagation, the preview curve will also be more accurate — no additional changes needed since it uses the same function.

### T4: Tests

Add to `ship-transfer.test.ts` or create focused test:

1. **Circular orbit prediction matches linear:** For e=0, Kepler prediction should match the old linear extrapolation (regression test).
2. **Eccentric orbit prediction differs from linear:** For e=0.2, the predicted position should differ from a naive constant-radius extrapolation.
3. **Stationary body returns current position:** Star with distance=0.
4. **Moon prediction includes parent motion:** Moon position accounts for parent planet's orbital motion.
5. **Comet prediction uses 3D orbit:** Verify inclined orbit produces non-zero y coordinate.

### T5: Verify no visual regression

- Transfer to Earth (e≈0.017) — should look identical to before
- Transfer to Mars (e≈0.093) — noticeable improvement, less jump
- Transfer to Pluto (e≈0.25) — significant improvement
- Transfer to comet — verify 3D path looks reasonable

## Files Modified

| File | Change |
|------|--------|
| `src/rendering/ship-transfer.ts` | Rewrite `predictTargetWorld()` with Kepler propagation |
| `src/math/orbit.ts` | No changes — all math already exists |
| `src/__tests__/ship-transfer.test.ts` | Add prediction accuracy tests |

## Dependency
None — self-contained change to one function with same signature. No other files need modification.

## Complexity
Low-medium. The math is already written and tested in orbit.ts. The main complexity is handling moons (parent + offset) and comets (3D inclination). Asteroids fall back to linear.

---

# Transfer Trail (replaces spline preview)

## Problem
The current transfer path is a computed Hermite spline preview that shows where the ship WILL go. This is recalculated every 4 frames and doesn't represent actual ship movement. Replace with a reactive trail that builds behind the ship as it moves — similar to comet trails.

## Design
- Use the ship's existing `trail` (TrailState) system during transfers instead of the separate `transferPath` line
- Trail samples position based on distance traveled (velocity-relative), not fixed time intervals
- Minimum trail length so short transfers still show something visible
- Trail only visible during transfers, cleared on arrival
- Remove `transferPath`, `updateTransferPath`, `createTransferPath` — they become dead code

## Implementation

### T6: Enable ship trail recording during transfers

Currently in `rendering.ts`, ships skip trail recording entirely (the velocity tail is hidden, and the main trail system records for all non-ship bodies). The ship's `trail` TrailState exists but isn't populated during transfers.

Changes to `rendering.ts` `updatePositions()`:
1. Remove the `transferPath` visibility block (lines 161-169)
2. Remove the velocity tail hide block (lines 171-176)
3. Instead, when ship is transferring, sample into the ship's existing trail using velocity-based intervals:
   - Compute distance moved this frame: `dx = newPos - prevPos`
   - Accumulate into `trail.sampleAccum`
   - Sample threshold = `max(MIN_TRAIL_STEP, BASE_TRAIL_STEP / velocity)` — faster = more frequent samples = longer trail
4. When ship completes transfer, clear the trail (reset count/head to 0)
5. Ship trail visible = `entry.shipState === "transferring"`

### T7: Remove transfer path infrastructure

- `ship-transfer.ts`: Remove `createTransferPath()`, `updateTransferPath()`, `removeTransferPath()`
- `ship-transfer.ts`: Remove `transferPath` creation in `commitTransfer()`
- `ship-transfer.ts`: Remove `transferPath` cleanup in `completeTransfer()`
- `rendering.ts`: Remove `updateTransferPath` import and usage
- Keep `computeHermiteKnots` and `hermiteEval` — still needed for position interpolation during transfer
- The `transferPath` field on ShipEntry becomes unused but can stay as `null` (removing from type is optional cleanup)

### T8: Tests
- Verify trail is populated during transfer simulation
- Verify trail is cleared on transfer completion
- Verify trail visibility toggles with ship state

## Execution Waves

### Wave A — Independent (parallel)
| Task | Files | Description |
|------|-------|-------------|
| T1-T2 | ship-transfer.ts | Kepler prediction rewrite |
| T4 | ship-transfer.test.ts | Prediction tests |

### Wave B — Depends on Wave A
| Task | Files | Description |
|------|-------|-------------|
| T6 | rendering.ts | Enable velocity-based trail during transfers |
| T7 | ship-transfer.ts, rendering.ts | Remove transfer path infrastructure |
| T8 | ship-transfer.test.ts | Trail behavior tests |

### Wave C — Validation
| Task | Description |
|------|-------------|
| T5 | Visual verification, lint, test, build |
