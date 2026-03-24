# Sim/UI Alignment — Implementation Plan

Expert panel review identified 16 tasks across 4 waves. Each wave is parallelizable internally; waves have cross-dependencies.

## Wave 0: Foundation Fixes (no dependencies, 4 parallel agents)

### W0-A: Fix live endpoint tracking (root cause of transfer jitter)
- [ ] **Files:** `src/rendering/rendering.ts` (lines 139-153)
- **Problem:** Mutating p1x/p1z/t1x/t1z every frame shifts ship's current Hermite position retroactively
- **Fix:** When updating endpoint, re-spline from ship's current position — set current pos as new P0, estimate velocity as new T0, reset transferStartTime, adjust transferTimeDays for remaining fraction
- **Tests:** Update `ship-transfer.test.ts` — verify no position discontinuity when endpoint moves

### W0-B: Fix day-boundary event skipping at high warp
- [ ] **Files:** `src/core/commands.ts` (lines 140-151, 172-186)
- **Problem:** `if (checkIndex > prevCheckIndex)` fires once instead of looping. At 30 days/sec, multiple malfunction intervals and colony shuttle deliveries are skipped.
- **Fix:** `while (checkIndex > prevCheckIndex) { fire; prevCheckIndex++; }`
- **Tests:** Update `commands.test.ts` — verify multiple events fire when simDt spans multiple intervals

### W0-C: Add smoothstep easing to transfer t parameter
- [ ] **Files:** `src/rendering/rendering.ts` (line ~127)
- **Problem:** Linear t with asymmetric tangents gives fast-start/slow-end (opposite of brachistochrone)
- **Fix:** `t_eased = t*t*(3-2*t)` before `transferPosition(entry, t_eased)`. Also equalize tangent magnitudes in `computeHermiteKnots` (both 0.4 instead of 0.5/0.3)
- **Tests:** Add test verifying symmetric speed profile

### W0-D: Add camera follow damping
- [ ] **Files:** `src/ui/selection.ts` (lines 400-412)
- **Problem:** `updateFollow()` hard-snaps camera, amplifying all jitter
- **Fix:** Exponential damping: `delta * (1 - exp(-damping * dt))` with damping ~12
- **Tests:** None required (feel improvement, validated visually)

---

## Wave 1: Visual Feedback (W0-A must complete first; 4 parallel agents)

### W1-A: Draw transfer path preview line
- [ ] **Files:** `src/rendering/ship-transfer.ts`, `src/rendering/rendering.ts`
- **Problem:** `ShipEntry.transferPath` exists in types.ts but is NEVER populated
- **Fix:** In `commitTransfer()`: sample Hermite at 64 t-values, create `THREE.Line` with `LineDashedMaterial`, store in `entry.transferPath`. Update each frame. Dispose in `completeTransfer()`.
- **Tests:** Verify transferPath lifecycle (created on commit, disposed on complete)

### W1-B: Add star field background
- [ ] **Files:** `src/rendering/scene.ts`
- **Problem:** Flat void with no depth cues
- **Fix:** 4000 `THREE.Points` on sphere at r=4000. Varying sizes, subtle color variation. Attach to camera so it rotates but doesn't translate.
- **Tests:** None (visual only)

### W1-C: Light falloff + AU distance rings
- [ ] **Files:** `src/rendering/scene.ts`, `src/ui/ui.ts` (view menu)
- **Problem:** Uniform illumination + no spatial reference
- **Fix:** Point light decay 0.5 -> 2.0. Add concentric `THREE.Line` circles at 1, 5, 10, 30 AU using `scaleDist()`. Low opacity (0.06). Toggle via View menu.
- **Tests:** None (visual only)

### W1-D: Reintroduce capture blend for transfer arrival
- [ ] **Files:** `src/rendering/rendering.ts`
- **Problem:** Ships snap to station-keeping. Capture blend was tested but never integrated.
- **Fix:** For t > 0.85, smoothstep-blend between Hermite position and live station-keeping position. Match algorithm from existing `rendering.test.ts:334-401`.
- **Tests:** Existing tests should pass with production code

---

## Wave 2: UX & Information (W1-A, W1-C must complete; 4 parallel agents)

### W2-A: Ship outliner in body list
- [ ] **Files:** `src/ui/ui.ts`
- **Problem:** No fleet overview; must click each ship
- **Fix:** In `buildBodyList()` ship section: show action, duration progress, compact fuel/hull indicators per ship. Add `updateShipOutliner()` to animation loop for live updates. Color-code by status.
- **Tests:** Test outliner content generation

### W2-B: Transfer status display (ETA, distance, fuel)
- [ ] **Files:** `src/ui/selection.ts`
- **Problem:** `#info-transfer-status` row only used for errors
- **Fix:** During active transfers show: ETA (days remaining), distance (AU), fuel consumed/total. Show distance-to-star in AU for all selected bodies. Add to `updateShipStatus()`.
- **Tests:** Test transfer status formatting

### W2-C: Auto-pause on transfer/action completion + advance-to-event
- [ ] **Files:** `src/main.ts`, `src/types.ts`
- **Problem:** No auto-pause on arrival; tedious time management
- **Fix:** Add `transfer-complete` notification type emitted in `onTransferComplete()`. Default to auto-pause. Add "Advance to Next Event" button: max speed + auto-pause on any notification.
- **Tests:** Test notification emission and auto-pause trigger

### W2-D: Scale communication (viewport AU, pan speed, label dimming)
- [ ] **Files:** `src/ui/ui.ts`, `src/rendering/scene.ts`
- **Problem:** "Zoom: 1.00x" is meaningless
- **Fix:** Replace with viewport AU width (`~4.2 AU across`). Scale pan speed proportional to camDist. Add depth-based label opacity.
- **Tests:** Test AU-width calculation

---

## Wave 3: Simulation Hardening (W0-B must complete; 4 parallel agents)

### W3-A: Save/restore transfer state
- [ ] **Files:** `src/types.ts`, `src/core/state.ts`
- **Problem:** Reload during transfer silently abandons it
- **Fix:** Add shipState, transferTarget, transferStartTime, transferTimeDays, spline knots to SavedShipData. Resume on restore. Bump SAVE_VERSION with migration.
- **Tests:** Roundtrip save/restore for mid-transfer ships

### W3-B: Separate pending action from display during transit
- [ ] **Files:** `src/main.ts`, `src/ui/selection.ts`
- **Problem:** HUD shows "Surveying" while ship is in transit
- **Fix:** `formatShipAction` returns "In transit to [target] (Xd remaining)" when shipState is transferring, regardless of action.type
- **Tests:** Update selection tests for transit display

### W3-C: Sub-step ship position at high warp
- [ ] **Files:** `src/rendering/rendering.ts`
- **Problem:** At 30 days/sec, short transfers get 3-6 frames. Trail breaks.
- **Fix:** When simDt > transferTimeDays/30, subdivide Hermite evaluation. Record trail points at sub-step positions. Store previous t on ShipEntry.
- **Tests:** Verify adequate trail point count at high warp

### W3-D: Command tree UI improvements
- [ ] **Files:** `src/ui/commands.ts`, `src/core/commands.ts`
- **Problem:** Command tree reads like code, not fleet management
- **Fix:** Condition status indicators (green/gray dots) via `checkCondition()`. Compact status bars above tree. "Give Order" button for immediateCommand. Rename to "Standing Orders".
- **Tests:** Test condition indicator logic

---

## Validation Wave (all waves complete)

### V1: Full validation pass
- [ ] `bun run test` -- all tests pass
- [ ] `bun run lint` -- zero warnings
- [ ] `bun run build` -- successful production build
- [ ] Visual smoke test: 3 ships, high time warp, verify smooth transfers + trails + auto-pause

---

## Dependency Graph

```
W0-A (endpoint fix) ──┬── W1-A (transfer path)
                       ├── W1-D (capture blend)
                       └── W3-C (sub-stepping)

W0-B (day-boundary) ──── W3-A (save transfer state)

W0-C (smoothstep) ─────── standalone

W0-D (camera damping) ──── standalone

W1-A (transfer path) ──── W2-B (transfer status)

W1-B (star field) ──────── standalone

W1-C (light + AU rings) ── W2-D (scale communication)
```

## File Conflict Matrix (for parallel agent safety)

| File | Wave 0 | Wave 1 | Wave 2 | Wave 3 |
|------|--------|--------|--------|--------|
| rendering/rendering.ts | W0-A, W0-C | W1-A, W1-D | | W3-C |
| rendering/ship-transfer.ts | | W1-A | | |
| rendering/scene.ts | | W1-B, W1-C | W2-D | |
| ui/selection.ts | W0-D | | W2-B | W3-B |
| ui/ui.ts | | W1-C (view) | W2-A, W2-D | |
| ui/commands.ts | | | | W3-D |
| core/commands.ts | W0-B | | | W3-D |
| core/state.ts | | | | W3-A |
| main.ts | | | W2-C | W3-B |
| types.ts | | | W2-C | W3-A |

**Conflicts within waves:**
- Wave 0: W0-A and W0-C both touch `rendering.ts` -- assign to SAME agent
- Wave 1: W1-A and W1-D both touch `rendering.ts` -- assign to SAME agent
- Wave 1: W1-B and W1-C both touch `scene.ts` -- assign to SAME agent
- Wave 2: W2-A and W2-D both touch `ui.ts` -- assign to SAME agent
- Wave 3: W3-A touches types.ts, W2-C also touches types.ts -- safe (different waves)

## Revised Agent Assignment

| Wave | Agent 1 | Agent 2 | Agent 3 |
|------|---------|---------|---------|
| 0 | W0-A + W0-C (rendering.ts) | W0-B (commands.ts) | W0-D (selection.ts) |
| 1 | W1-A + W1-D (rendering.ts, ship-transfer.ts) | W1-B + W1-C (scene.ts, view menu) | |
| 2 | W2-A + W2-D (ui.ts, scene.ts) | W2-B (selection.ts) | W2-C (main.ts, types.ts) |
| 3 | W3-A (state.ts, types.ts) | W3-B (main.ts, selection.ts) | W3-C + W3-D (rendering.ts, commands.ts, ui/commands.ts) |
