---
created: 2026-03-30
status: completed
completed: 2026-03-30
---

# Plan: Post-Extraction Cleanup

## Context & Motivation

After extracting 11 pure functions from rendering into math/core modules (commit 74dd9bb),
the codebase has residual indirection and duplication. Specifically:

1. `orbitToWorld` was moved to `math/orbit.ts` but `bodies.ts` still re-exports it, and
   `rendering.ts` imports it through that re-export instead of directly.
2. `captureBlend()` in `rendering.ts` is now a single-caller wrapper that just reads mesh
   positions and delegates to `captureBlendPosition()` — can be inlined.
3. The station-keeping offset + angle → position pattern repeats 5+ times across
   `rendering.ts` and `ship-transfer.ts`.
4. The test file `transfers.test.ts` (core/transfers tests) has a confusing name next to
   `transfer.test.ts` (math/transfer tests).

## Constraints

- Platform: Windows 11, bash shell
- All 773 tests must continue passing
- Zero lint warnings (biome), zero type errors (tsc)
- No behavior changes — purely structural cleanup
- Import hierarchy must not introduce circular deps

## Alternatives Considered

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| Clean up imports + inline wrapper + extract helper | Fewer indirections, less duplication | Touches rendering files (risk) | **Selected** |
| Leave as-is, document tech debt | Zero risk | Accumulates cruft | Rejected: cleanup is low-risk and improves clarity |
| Also extract comet world-position helper | Reduces 4 lines at 2 sites | Over-abstraction for 2 call sites, input patterns differ | Rejected: marginal value, different input shapes |

## Objective

Remove the `orbitToWorld` re-export indirection, inline the `captureBlend` wrapper,
extract a `stationKeepingPosition` helper to consolidate 5 offset+angle patterns,
and rename the confusing test file.

## Project Context

- **Language**: TypeScript (Vite + Three.js)
- **Test command**: `bun run test`
- **Lint command**: `bun run lint`
- **Typecheck**: `bun run typecheck`

## Task Breakdown

| # | Task | Files | Type | Model | Agent | Depends On |
|---|------|-------|------|-------|-------|------------|
| T1 | Remove orbitToWorld re-export, fix imports | 3 | mechanical | haiku | builder-light | — |
| T2 | Inline captureBlend wrapper | 1 | mechanical | haiku | builder-light | — |
| T3 | Extract stationKeepingPosition helper | 2 | feature | sonnet | builder | — |
| T4 | Rename transfers.test.ts | 1 | mechanical | haiku | builder-light | — |
| V1 | Validate all changes | — | validation | sonnet | validator-heavy | T1, T2, T3, T4 |

## Execution Waves

### Wave 1 (parallel)

**T1: Remove orbitToWorld re-export** [haiku] — builder-light
- Description: Remove the `export { orbitToWorld } from "../math/orbit"` re-export from `rendering/bodies.ts`. Update `rendering/rendering.ts` to import `orbitToWorld` directly from `../math/orbit` instead of from `./bodies`. Keep the `COMET_TRAIL_STEP_ARC` import from `./bodies` on a separate line. Check `rendering.test.ts` for any import of `orbitToWorld` from bodies and fix similarly.
- Files:
  - `src/rendering/bodies.ts` — remove re-export line 31
  - `src/rendering/rendering.ts` — change import source for `orbitToWorld`
  - `src/__tests__/rendering.test.ts` — update import if needed
- Acceptance Criteria:
  1. [ ] No file imports `orbitToWorld` from `rendering/bodies`
     - Verify: `grep -r "orbitToWorld.*from.*bodies" src/`
     - Pass: No output
     - Fail: Remaining imports need updating
  2. [ ] `orbitToWorld` is only exported from `math/orbit.ts`
     - Verify: `grep -rn "export.*orbitToWorld" src/`
     - Pass: Only `src/math/orbit.ts` appears
     - Fail: Stale re-export remains

**T2: Inline captureBlend wrapper** [haiku] — builder-light
- Description: In `rendering/rendering.ts`, the `captureBlend()` function (lines ~213-225) is called only once at line ~313. Inline it: replace the call with direct reads of `tgt.mesh.position`, a call to `stationKeepingOffset(tgt)`, and delegation to `captureBlendPosition()`. Delete the `captureBlend` function definition.
- Files:
  - `src/rendering/rendering.ts` — inline function, delete definition
- Acceptance Criteria:
  1. [ ] `captureBlend` function no longer exists
     - Verify: `grep -n "function captureBlend" src/rendering/rendering.ts`
     - Pass: No output
     - Fail: Function still defined
  2. [ ] `captureBlendPosition` is called directly at the transfer update site
     - Verify: `grep -n "captureBlendPosition" src/rendering/rendering.ts`
     - Pass: Shows call at the transfer update line
     - Fail: Function not called

**T3: Extract stationKeepingPosition helper** [sonnet] — builder
- Description: The pattern `const offset = stationKeepingOffset(host); host.mesh.position.x + Math.cos(angle) * offset` repeats in 5+ locations. Create and export a `stationKeepingPosition(host, angle)` function in `rendering/ship-transfer.ts` that returns `{x, y, z}`. Update all call sites in `rendering/rendering.ts` and `rendering/ship-transfer.ts` to use it. The function signature should be:
  ```typescript
  export function stationKeepingPosition(
    host: { mesh: { position: { x: number; y: number; z: number }; userData?: { baseSize?: number } } },
    angle: number,
  ): { x: number; y: number; z: number }
  ```
  Call sites to update (verify exact locations by reading the files first):
  - `rendering.ts` `updateOrbitingShip()` — ship position around host
  - `rendering.ts` `maybeResplineTransfer()` — newP1 approach position
  - `ship-transfer.ts` `createShip()` — initial ship placement
  - `ship-transfer.ts` `completeTransfer()` — arrival position
  - `ship-transfer.ts` second `completeTransfer` path (asteroid proxy)
- Files:
  - `src/rendering/ship-transfer.ts` — add function, update local call sites
  - `src/rendering/rendering.ts` — import and use at call sites
- Acceptance Criteria:
  1. [ ] `stationKeepingPosition` function is exported
     - Verify: `grep -n "export function stationKeepingPosition" src/rendering/ship-transfer.ts`
     - Pass: Shows function definition
     - Fail: Function not found
  2. [ ] Inline offset+cos/sin pattern eliminated from call sites
     - Verify: `grep -c "stationKeepingOffset" src/rendering/rendering.ts src/rendering/ship-transfer.ts`
     - Pass: Count decreases (only the helper + its definition remain)
     - Fail: Pattern still repeated at call sites

**T4: Rename transfers.test.ts** [haiku] — builder-light
- Description: Rename `src/__tests__/transfers.test.ts` to `src/__tests__/core-transfers.test.ts` to distinguish it from `transfer.test.ts` (which tests `math/transfer.ts`). Update any import references if needed (Vitest auto-discovers, so no config changes needed).
- Files:
  - `src/__tests__/transfers.test.ts` → `src/__tests__/core-transfers.test.ts`
- Acceptance Criteria:
  1. [ ] Old file doesn't exist, new file does
     - Verify: `ls src/__tests__/transfers.test.ts 2>/dev/null; ls src/__tests__/core-transfers.test.ts`
     - Pass: Only new file exists
     - Fail: Old file still present
  2. [ ] Tests still discover and run the renamed file
     - Verify: `bun run test 2>&1 | grep "core-transfers"`
     - Pass: Test file appears in output
     - Fail: File not found by runner

### Wave 1 — Validation Gate

**V1: Validate wave 1** [sonnet] — validator-heavy
- Blocked by: T1, T2, T3, T4
- Checks:
  1. Run acceptance criteria for T1, T2, T3, T4
  2. `bun run test` — all 773 tests pass
  3. `bun run typecheck` — no type errors
  4. `bun run lint` — no warnings
  5. Cross-task: verify no circular imports introduced by T1 import change
  6. Cross-task: verify T2 inline + T3 helper don't conflict in rendering.ts
- On failure: Create fix task, re-validate after fix

## Dependency Graph

```
Wave 1: T1, T2, T3, T4 (parallel) → V1
```

## Success Criteria

1. [ ] All 773 tests pass
   - Verify: `bun run test`
   - Pass: 773 passed, 0 failed
2. [ ] Zero lint warnings, zero type errors
   - Verify: `bun run lint && bun run typecheck`
   - Pass: Clean output
3. [ ] `orbitToWorld` imported from one canonical source
   - Verify: `grep -r "orbitToWorld.*from" src/ | grep -v node_modules | grep -v "math/orbit"`
   - Pass: No output (all imports from math/orbit)
4. [ ] No `captureBlend` wrapper function remains
   - Verify: `grep "function captureBlend[^P]" src/`
   - Pass: No output
5. [ ] Station-keeping offset pattern consolidated
   - Verify: `grep -c "stationKeepingOffset" src/rendering/rendering.ts`
   - Pass: Count is 0 (all replaced by stationKeepingPosition)

## Handoff Notes

- T2 (inline captureBlend) and T3 (stationKeepingPosition) both modify `rendering.ts`. Since T2 removes a function and T3 changes different call sites, they should not conflict — but the validator should check the final file compiles.
- The `captureBlend` inline (T2) may interact with the T3 helper if the inlined code also uses stationKeepingOffset. If so, the inlined code should use `stationKeepingPosition` instead. The validator should check this.
