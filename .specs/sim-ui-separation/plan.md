---
created: 2026-03-29
status: draft
completed:
---

# Plan: Sim/UI Layer Separation Refactor

## Context & Motivation

During the fuel economy rework, we established the architectural principle: "Sim is source of truth; UI is read-only projection." We relocated `initiateTransfer` to `core/transfers.ts` and `distanceKmBetween` to `math/transfer.ts`, proving the pattern works. An audit of the remaining codebase revealed three categories of violations where rendering and UI layers directly mutate game state:

1. **CRITICAL** — `rendering/rendering.ts` `maybeResplineTransfer()` mutates `transferFuelTotal` and `transferTimeDays` during visual updates. The rendering layer adjusts fuel budgets, meaning visual correction frequency affects game physics.
2. **HIGH** — `rendering/ship-transfer.ts` `completeTransferState()` and `commitTransfer()` mutate ~20 ShipEntry fields (shipState, hostPlanetName, speed, angle, orbitA, etc.). These are game state transitions that belong in core/.
3. **HIGH** — `ui/commands.ts` directly mutates command tree state in 7 places (splice, push, toggle enabled, set threshold, set immediateCommand). Should go through core/ functions.

## Constraints

- Platform: Windows 11, bash shell, Bun runtime
- Import hierarchy: math/ → core/ → rendering/ → ui/ → main.ts (no circular deps)
- Biome lint: zero warnings, cognitive complexity max 15
- 679+ tests must continue passing
- Hook pattern (like `setTransferHooks`) is the established way for core/ to call back into rendering/
- Spline knot fields (p0x, t0x, p1x, etc.) are visual-only — they can stay in rendering layer
- `entry.angle` is visual-only (station-keeping drift) — LOW priority, can stay for now

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Move all state mutations to core/, rendering gets hooks | Clean separation, testable sim | More hook boilerplate, ~15 files touched | **Selected** — matches proven pattern from fuel rework |
| Keep mutations in rendering, document as exceptions | No code changes | Violations grow, bugs like the fuel drain recur | Rejected: tech debt compounds |
| Event-driven (sim emits events, rendering subscribes) | Very clean separation | Over-engineered for current codebase size, major rewrite | Rejected: KISS violation |

## Objective

All game state mutations (ShipEntry fields that affect simulation: shipState, hostPlanetName, transferFuelTotal, transferTimeDays, action, commandTree, fuelKg, crew, maintenance) originate exclusively from `core/` and `math/`. Rendering and UI layers only read state and set visual properties (mesh positions, materials, trail geometry, DOM content).

## Project Context

- **Language**: TypeScript (Vite + Bun)
- **Test command**: `bun run test`
- **Lint command**: `bun run lint`
- **Typecheck**: `bun run typecheck`

## Task Breakdown

| # | Task | Files | Type | Model | Agent | Depends On |
|---|------|-------|------|-------|-------|------------|
| T1 | Move `completeTransferState` sim logic to `core/transfers.ts` | 3 | feature | sonnet | builder | — |
| T2 | Move `commitTransfer` sim fields to `core/transfers.ts` | 3 | feature | sonnet | builder | — |
| T3 | Extract command tree mutations to `core/commands.ts` | 2 | feature | sonnet | builder | — |
| V1 | Validate wave 1 | — | validation | sonnet | validator-heavy | T1, T2, T3 |
| T4 | Move re-spline fuel/timing mutation to core/ | 3 | feature | sonnet | builder | V1 |
| T5 | Wire `immediateCommand` through core/ | 2 | mechanical | haiku | builder-light | V1 |
| V2 | Validate wave 2 | — | validation | sonnet | validator-heavy | T4, T5 |

## Execution Waves

### Wave 1 (parallel)

**T1: Move `completeTransferState` sim logic to `core/transfers.ts`** [sonnet] — builder
- Description: Extract the game-state fields from `completeTransferState()` in `rendering/ship-transfer.ts` into a new function `completeTransferSim()` in `core/transfers.ts`. The rendering function keeps only mesh positioning (snap to target). The core function sets: `shipState`, `hostPlanetName`, `transferTarget`, `transferFuelTotal`, `pendingTransfer`, `speed`, `angle`, `data.distance`, `orbitA`. Use the hook pattern — rendering calls core, then does visual snap.
- Files: `src/core/transfers.ts`, `src/rendering/ship-transfer.ts`, `src/__tests__/ship-transfer.test.ts`
- Acceptance Criteria:
  1. [ ] `completeTransferSim()` exists in `core/transfers.ts` and sets all sim fields
     - Verify: `grep "function completeTransferSim" src/core/transfers.ts`
     - Pass: match found
     - Fail: function not created or in wrong file
  2. [ ] `completeTransferState()` in rendering only does mesh positioning after calling core
     - Verify: `grep -c "entry.shipState\|entry.hostPlanetName\|entry.transferFuelTotal" src/rendering/ship-transfer.ts`
     - Pass: 0 matches (all moved to core)
     - Fail: sim fields still mutated in rendering
  3. [ ] All tests pass
     - Verify: `bun run test`
     - Pass: 679+ tests pass
     - Fail: check which transfer tests broke, fix hook wiring

**T2: Move `commitTransfer` sim fields to `core/transfers.ts`** [sonnet] — builder
- Description: Extract sim-state fields from `commitTransfer()` in `rendering/ship-transfer.ts` into a new function `commitTransferSim()` in `core/transfers.ts`. Sim fields: `transferStartTime`, `transferTimeDays`, `transferDisplayStart`, `transferDisplayDays`, `transferTarget`, `shipState`, `pendingTransfer`, `stationTarget`. Spline knot fields (p0x/y/z, t0x/y/z, p1x/y/z, t1x/y/z) and trail clearing stay in rendering. The existing `visualCommitTransfer()` should call the core function first, then set spline knots and clear trails.
- Files: `src/core/transfers.ts`, `src/rendering/ship-transfer.ts`, `src/__tests__/rendering.test.ts`
- Acceptance Criteria:
  1. [ ] `commitTransferSim()` exists in `core/transfers.ts`
     - Verify: `grep "function commitTransferSim" src/core/transfers.ts`
     - Pass: match found
     - Fail: function not created
  2. [ ] `commitTransfer()` in rendering only sets spline knots and trail data
     - Verify: `grep -c "entry.shipState\|entry.transferTarget\|entry.transferStartTime" src/rendering/ship-transfer.ts` — should only appear in type imports or comments, not assignments
     - Pass: no assignment matches
     - Fail: sim fields still assigned in rendering
  3. [ ] All tests pass
     - Verify: `bun run test`
     - Pass: 679+ tests pass
     - Fail: check rendering.test.ts initiateTransfer tests

**T3: Extract command tree mutations to `core/commands.ts`** [sonnet] — builder
- Description: Create exported functions in `core/commands.ts` for each command tree mutation currently done inline in `ui/commands.ts`: `reorderCommand(ship, index, direction)`, `toggleCommand(ship, index)`, `removeCommand(ship, index)`, `setCommandThreshold(ship, index, value)`, `addCommand(ship, entry)`. The UI calls these functions instead of mutating `ship.commandTree.entries` directly.
- Files: `src/core/commands.ts`, `src/ui/commands.ts`
- Acceptance Criteria:
  1. [ ] Core functions exist for all 5 mutation types
     - Verify: `grep -c "export function reorderCommand\|export function toggleCommand\|export function removeCommand\|export function setCommandThreshold\|export function addCommand" src/core/commands.ts`
     - Pass: 5 matches
     - Fail: missing functions
  2. [ ] `ui/commands.ts` has no direct `entries.splice`, `entry.enabled =`, `entry.condition.threshold =`, or `entries.push`
     - Verify: `grep -c "entries.splice\|entry.enabled =\|\.threshold =.*val\|entries.push" src/ui/commands.ts`
     - Pass: 0 matches
     - Fail: direct mutations remain
  3. [ ] All tests pass and lint passes
     - Verify: `bun run test && bun run lint`
     - Pass: all pass
     - Fail: check commands.test.ts for regressions

### Wave 1 — Validation Gate

**V1: Validate wave 1** [sonnet] — validator-heavy
- Blocked by: T1, T2, T3
- Checks:
  1. Run acceptance criteria for T1, T2, T3
  2. `bun run test` — all tests pass
  3. `bun run lint` — no warnings
  4. `bun run typecheck` — no type errors
  5. Cross-task: verify `core/transfers.ts` has no circular imports with rendering/
  6. Cross-task: verify `ui/commands.ts` imports command mutation functions from `core/commands.ts`
- On failure: Create fix task, re-validate after fix

### Wave 2

**T4: Move re-spline fuel/timing mutation to core/** [sonnet] — builder
- Blocked by: V1
- Description: In `rendering/rendering.ts`, `maybeResplineTransfer()` (lines 198-202) adjusts `entry.transferFuelTotal` and `entry.transferTimeDays` when re-splining. Extract this logic into a core function `adjustTransferBudget(entry, remainingDays)` in `core/transfers.ts` that proportionally adjusts the fuel budget. The rendering function calls this core function, then updates spline knots. Also move `entry.transferStartTime = state.simTime.days` into the core function.
- Files: `src/core/transfers.ts`, `src/rendering/rendering.ts`, `src/__tests__/rendering.test.ts`
- Acceptance Criteria:
  1. [ ] `adjustTransferBudget()` exists in `core/transfers.ts`
     - Verify: `grep "function adjustTransferBudget" src/core/transfers.ts`
     - Pass: match found
     - Fail: function not created
  2. [ ] `rendering.ts` does not assign `transferFuelTotal` or `transferTimeDays`
     - Verify: `grep -c "entry.transferFuelTotal\s*[*=]\|entry.transferTimeDays\s*=" src/rendering/rendering.ts`
     - Pass: 0 matches (only reads, no assignments)
     - Fail: mutations remain in rendering
  3. [ ] All tests pass
     - Verify: `bun run test`
     - Pass: 679+ tests pass
     - Fail: check transfer re-spline behavior

**T5: Wire `immediateCommand` through core/** [haiku] — builder-light
- Blocked by: V1
- Description: In `ui/commands.ts` line 175, `ship.immediateCommand = { ... }` is set directly. Create `setImmediateCommand(ship, command, target?)` in `core/commands.ts` and call it from the UI instead.
- Files: `src/core/commands.ts`, `src/ui/commands.ts`
- Acceptance Criteria:
  1. [ ] `setImmediateCommand()` exists in `core/commands.ts`
     - Verify: `grep "export function setImmediateCommand" src/core/commands.ts`
     - Pass: match found
     - Fail: function not created
  2. [ ] `ui/commands.ts` does not assign `ship.immediateCommand` directly
     - Verify: `grep -c "ship.immediateCommand\s*=" src/ui/commands.ts`
     - Pass: 0 matches
     - Fail: direct mutation remains
  3. [ ] All tests pass
     - Verify: `bun run test && bun run lint`
     - Pass: all pass
     - Fail: check command dispatch tests

### Wave 2 — Validation Gate

**V2: Validate wave 2** [sonnet] — validator-heavy
- Blocked by: T4, T5
- Checks:
  1. Run acceptance criteria for T4 and T5
  2. `bun run test` — all tests pass
  3. `bun run lint` — no warnings
  4. `bun run typecheck` — no type errors
  5. Final audit: `grep -rn "entry\.\(shipState\|hostPlanetName\|transferFuelTotal\|transferTimeDays\|fuelKg\) *=" src/rendering/ src/ui/` — should return 0 sim-field assignments
- On failure: Create fix task, re-validate after fix

## Dependency Graph

```
Wave 1: T1, T2, T3 (parallel) → V1
Wave 2: T4, T5 (parallel) → V2
```

## Success Criteria

1. [ ] No game state mutations in rendering/ or ui/ layers
   - Verify: `grep -rn "entry\.\(shipState\|hostPlanetName\|transferFuelTotal\|transferTimeDays\) *=" src/rendering/ src/ui/`
   - Pass: 0 matches
2. [ ] All 679+ tests pass with zero lint warnings
   - Verify: `bun run test && bun run lint && bun run typecheck`
   - Pass: all green
3. [ ] Game runs correctly — ships transfer, dock, refuel, complete actions
   - Verify: `bun run dev` + manual observation
   - Pass: ships behave identically to pre-refactor

## Handoff Notes

- The hook pattern from `core/transfers.ts` (`setTransferHooks`) is the established way to bridge core → rendering. New hooks should follow this pattern.
- `entry.angle` and spline knot fields (p0x, t0x, etc.) are visual-only — they're acceptable in rendering. Only fields that affect simulation logic need to move.
- `entry.speed` set in `completeTransferState` is `SHIP_LOCAL_SPEED` — a visual drift rate. It could arguably stay in rendering, but moving it to core is cleaner since it's bundled with sim fields.
