# Transfer System Simplification Plan — COMPLETED

All 10 tasks across 5 waves completed and merged to main. Based on expert reviews from physics, animation, and moon-routing specialists.

## Dependency Graph

```
Wave 1 (parallel):  T1  T2  T3
                     |       |
Wave 2 (sequential): T4 → T5 → T6
                              |
Wave 3 (parallel):       T7  T8
                          |   |
Wave 4 (parallel):       T9
                          |
Wave 5:                  T10
```

## Wave 1 — Independent Bug Fixes (parallel, no dependencies)

### T1: Fix `distanceKmBetween` to use world-space vector distance [DONE]
**Files:** `src/rendering/ship-transfer.ts`, `src/__tests__/ship-transfer.test.ts`
**Issues:** B1

`distanceKmBetween` uses `Math.abs(auB - auA)` — radial difference, not actual distance.
Bodies on opposite sides of the star get wildly wrong fuel/time estimates.

Fix: Use `Math.hypot(dx, dy, dz)` on world positions, then reverse sqrt-compression
to get AU: `au = (worldDist / DIST_SCALE)^2`. Pattern already exists in `bodyAUFromPosition`.

Add test: two bodies at same orbital radius but opposite sides should have distance ~2x radius.

### T2: Delete dead code — `departing` state + Lambert solver [DONE]
**Files:** `src/types.ts`, `src/ui/selection.ts`, `src/ui/ui.ts`, `src/math/transfer.ts`,
`src/__tests__/transfer.test.ts`, `.claude/CLAUDE.md`
**Issues:** S5, S7

1. Remove `"departing"` from `ShipState` union type
2. Remove all dead UI branches that check `=== "departing"` in selection.ts and ui.ts
3. Move or delete Lambert solver, orbit propagator, `auVelToWorldDir`, `worldToAU`,
   `auToWorld` from transfer.ts (only used in tests, not production)
4. Update CLAUDE.md state machine description

### T3: Guard `hostPlanetName` against moon names [DONE]
**Files:** `src/rendering/ship-transfer.ts`, `src/__tests__/ship-transfer.test.ts`
**Issues:** B3, M3

In `completeTransfer`: if `transferTarget` resolves to a moon (`isMoon === true`),
find the parent planet via `state.bodyMeshes.find(e => e.mesh === target.parentMesh)`
and use the parent's name for `hostPlanetName`.

## Wave 2 — Transfer Simplification (sequential, depends on Wave 1)

### T4: Extract shared transfer-commit helper [DONE]
**Files:** `src/rendering/ship-transfer.ts`
**Issues:** S6
**Depends on:** T1, T2, T3

`beginTransfer` and `initiateTransfer` both compute knots and write identical fields
with subtle divergence (e.g., `stationTarget = null` only in one). Extract:

```ts
function commitTransfer(entry, knots, gameDays, targetName): void {
  // write p0/p1/t0/t1, set state, create path, prefill tail
}
```

Both callers use this helper. Ensures they stay in sync.

### T5: Freeze spline + delete recalc + delete captureBlend + delete blendTarget [DONE]
**Files:** `src/rendering/ship-transfer.ts`, `src/rendering/rendering.ts`,
`src/types.ts`, `src/__tests__/ship-transfer.test.ts`, `src/__tests__/rendering.test.ts`
**Issues:** S1, S2, S4
**Depends on:** T4

The big simplification. Three removals:

1. **Delete spline recalculation block** in rendering.ts (~15 lines). Remove
   `transferRecalcCounter` from ShipEntry. Spline is frozen at departure.

2. **Delete `applyCaptureBlend` function** and all call sites. Transfer completes when
   `t >= 1.0` or distance to target < SHIP_LOCAL_ORBIT. `completeTransfer` already
   snaps to station-keeping position.

3. **Delete `blendTarget` field** from ShipEntry. In the completion check, compute
   entry angle inline: `Math.atan2(dz, dx)` from final spline position relative
   to target. Pass as parameter to `completeTransfer(entry, entryAngle)`.

Update rendering.ts transfer block to:
```ts
const t = Math.min(elapsed / entry.transferTimeDays, 1);
const p = transferPosition(entry, t);
entry.mesh.position.set(p.x, 0, p.z);
if (t >= 1.0 || distToTarget < SHIP_LOCAL_ORBIT) {
    const angle = Math.atan2(p.z - tgt.z, p.x - tgt.x);
    completeTransfer(entry, angle);
}
```

Update tests: remove applyCaptureBlend tests, update completion logic tests.

### T6: Simplify `computeHermiteKnots` tangent math [DONE]
**Files:** `src/rendering/ship-transfer.ts`, `src/__tests__/ship-transfer.test.ts`
**Issues:** S3
**Depends on:** T5

Current tangent blending (`directAngle * 0.7 + tangentDir * 0.3`) is geometrically
broken for angle wrapping. Simplify to:

- **Departure tangent:** direct-to-target angle, magnitude = 0.5 * chord length
- **Arrival tangent:** same direction (approach angle), magnitude = 0.3 * chord length

This gives a smooth S-curve departure without the angle-wrapping bug. If we want
more curve, we can later switch to a quadratic Bezier (1 control point vs 4 tangent
values) but the Hermite simplification is lower-risk for now.

Update tangent-direction tests to match new simpler behavior.

## Wave 3 — Moon Survey Routing (parallel, depends on T3)

### T7: Rewrite `selectNextSurveyTarget` to skip moons [DONE]
**Files:** `src/core/commands.ts`, `src/__tests__/commands.test.ts`
**Issues:** B2, M1
**Depends on:** T3

When filtering candidates, skip bodies where `isMoon === true`. If the nearest
unsurveyed body is a moon, find its parent planet and return that as the target.
The ship transfers to the parent planet, not the moon.

Add tests:
- Moon is nearest unsurveyed → returns parent planet name
- Planet with unsurveyed moons → returns planet name (not moon)
- All moons surveyed → skips them, returns next planet

### T8: Add local moon sweep logic [DONE]
**Files:** `src/main.ts`, `src/core/commands.ts`, `src/__tests__/commands.test.ts`
**Issues:** M2
**Depends on:** T3, T7

When a ship arrives at a planet and the command tree says "survey":
1. If the host body itself is unsurveyed → survey it
2. If the host body is surveyed but has unsurveyed moons → survey next moon
   (without transferring — set action target to moon name, start survey timer)
3. If all local bodies surveyed → `selectNextSurveyTarget` picks next planet

Need a helper: `getUnsurvevedMoonsOfHost(ship)` that finds moons whose
`parentMesh` matches the host planet's mesh.

Survey duration for moons uses the moon's body type and size, not the parent planet's.

## Wave 4 — Performance Polish (parallel, depends on Wave 2)

### T9: Transfer path + departure arc performance [DONE]
**Files:** `src/rendering/ship-transfer.ts`
**Issues:** P1, P2, P3
**Depends on:** T5

1. **Transfer path dirty flag:** Only recompute 128 Hermite points when spline
   changes (which is now never mid-flight — only at creation). Cache positions.
2. **Departure arc skip:** Track lastAngle/lastOptimalAngle, skip geometry rebuild
   if neither changed by > epsilon
3. **Departure recalc rate:** Change from every 8 frames to every 30 frames

## Wave 5 — Validation

### T10: Full test/lint/build verification [DONE]
**Depends on:** T6, T8, T9

- `bun run test` — all tests pass
- `bun run lint` — zero errors
- `bun run build` — successful
- Manual smoke test: transfer Earth→Mars, survey, moon sweep, fuel display

## File Ownership (prevents merge conflicts in parallel tasks)

| File | Owner |
|------|-------|
| `ship-transfer.ts` | T1 → T3 → T4 → T5 → T6 → T9 (sequential) |
| `rendering.ts` | T5 only |
| `types.ts` | T2 (departing), T5 (blendTarget/recalcCounter) |
| `commands.ts` | T7, T8 |
| `main.ts` | T8 only |
| `transfer.ts` | T2 only |
| `selection.ts`, `ui.ts` | T2 only |
| Tests mirror their source file ownership |
