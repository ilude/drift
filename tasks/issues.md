Action view for ships is not right justifying when it in Surveying mode, like it does for other mode text.

pathing between astroids is not right, there is alot of screen shake and it seems like the ship jumps around instead of smoothing moving to the next astroid

---

# Multi-Ship & Entity Resolution Plan

## Overview

This plan addresses three interconnected needs:
1. **P0 bug fixes** — immediate correctness issues found by code review
2. **Entity resolution refactor** — unified lookup layer to eliminate fragile asteroid fallback patterns
3. **Ship intent broadcast system** — coordination for multi-ship autonomous behavior
4. **Multi-ship support** — parameterized ship creation, save/restore, UI

## Dependency Graph

```
Phase 0: P0 Bug Fixes (no dependencies)
    |
Phase 1: Entity Resolution (core/entities.ts)
    |
Phase 2: Ship Intent System (core/intents.ts) — depends on Phase 1
    |
Phase 3: Multi-Ship Creation — depends on Phase 1
    |
Phase 4: Multi-Ship Save/Restore — depends on Phase 3
    |
Phase 5: UI Fleet Awareness — depends on Phase 3
    |
Phase 6: Validation & Cleanup
```

---

## Phase 0: P0 Bug Fixes

No architectural changes. Fix bugs that would compound with multiple ships.

### T0.1: `immediateCommand` infinite loop
- **File:** `src/main.ts` — `dispatchCommand()`
- **Bug:** `ship.immediateCommand = null` only in `case "transfer"` branch. All other command types loop forever.
- **Fix:** Move `ship.immediateCommand = null` to top of `dispatchCommand()`, before the switch.

### T0.2: "System survey complete" notification spam
- **File:** `src/main.ts` — `dispatchCommand()` survey case
- **Bug:** When `selectNextSurveyTarget()` returns null, `noAction()` is set, ship re-evaluates next frame, fires notification again. Every frame.
- **Fix:** Set `ship.action = mkAction("idle", "idle")` instead of `noAction()` so the idle check in `tickShip` doesn't re-evaluate. Use `addCoalescedNotification` instead of `addNotification`.

### T0.3: `_proxyPos` shared mutable aliasing
- **File:** `src/rendering/ship-transfer.ts` — `asteroidProxy()`
- **Bug:** Two calls in the same expression overwrite each other's position data. Affects asteroid-to-asteroid transfers.
- **Fix:** Allocate a fresh `{ x, y, z }` object per call. These calls are sparse (not hot-loop), allocation is negligible.

### T0.4: `beginTransfer` can't find asteroid targets
- **File:** `src/rendering/ship-transfer.ts` — `beginTransfer()`
- **Bug:** `findBodyEntry(p.targetName)` returns undefined for asteroids. Pending transfers to asteroids never fire.
- **Fix:** Add `findAsteroid` fallback (same pattern as `initiateTransfer`).

### T0.5: Shore-leave/overhaul missing stranded notifications
- **File:** `src/main.ts` — `dispatchCommand()` shore-leave and overhaul cases
- **Bug:** When transfer to colony fails, refuel emits stranded notification but shore-leave and overhaul silently go idle.
- **Fix:** Add `addNotification("low-fuel", ...)` to both failure paths.

### T0.6: Guard survey start against already-surveyed targets
- **File:** `src/main.ts` — `onTransferComplete()`
- **Bug:** If target gets surveyed mid-transfer (by another ship), arriving ship wastes days re-surveying.
- **Fix:** Check `surveyLevel > 0` before starting survey timer. If already surveyed, skip to re-evaluation.

**Tests:** Update `commands.test.ts` and add cases for immediateCommand clearing, idle-on-survey-complete.

---

## Phase 1: Entity Resolution — `core/entities.ts`

Unified lookup layer replacing 6 inconsistent patterns. Lives in `core/` so `commands.ts` can use it.

### T1.1: Create `src/core/entities.ts`

**New types:**
```ts
interface ResolvedEntity {
  name: string;
  type: string;
  position: { x: number; y: number; z: number };  // fresh copy per call
  distance: number;
  mass: number;
  speed: number;
  isMoon: boolean;
  survey?: SurveyState;
  bodyEntry?: BodyEntry;
  asteroidHit?: { asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry };
}
```

**Exports:**
| Function | Description |
|---|---|
| `rebuildEntityMaps()` | Rebuilds bodyMap + asteroidMap from state |
| `resolveEntity(name)` | Canonical lookup → ResolvedEntity or null |
| `findBody(name)` | O(1) BodyEntry lookup |
| `findPlanet(name)` | O(1) planet-only lookup |
| `findAsteroidEntity(name)` | O(1) asteroid lookup |
| `findShip(name?)` | Find ship by name (or first ship if no name) |
| `findStar()` | Cached star reference |

### T1.2: Create `src/__tests__/entities.test.ts`
- Map building from bodyMeshes and asteroidBelts
- resolveEntity for planets, moons, comets, ships, asteroids, unknown names
- Position freshness (two calls return different position objects)
- findBody, findPlanet, findAsteroidEntity edge cases

### T1.3: Wire up map rebuilds
- Replace `buildPlanetMap()` calls in `bodies.ts` and `ship-transfer.ts` with `rebuildEntityMaps()`
- Add `rebuildEntityMaps()` after `createAsteroidBelts()` in `main.ts`
- Remove `planetMap`, `buildPlanetMap` from `bodies.ts`

### T1.4: Migrate `core/` layer
- `commands.ts:224` — `getUnsurvevedMoonsOfHost` → `findBody()`
- `state.ts:117,158` — `saveState`/`restoreShipState` → `findShip()`

### T1.5: Migrate `main.ts`
- Remove local `findBodyByName()`, `resolveBody()`
- Replace all 12+ call sites with `resolveEntity`/`findBody`/`findPlanet`
- Fix `dispatchCommand("transfer")` to use `findBody` instead of `findPlanetEntry` (enables transfer to any body type)

### T1.6: Migrate `rendering/`
- `rendering.ts` — Replace host/target lookups with `findBody` + `resolveEntity` fallback
- `ship-transfer.ts` — Replace all `findBodyEntry`/`findAsteroid`/`asteroidProxy` patterns
- Deprecate `asteroidProxy`, `findAsteroid`, `_proxyPos`

### T1.7: Migrate `ui/`
- `selection.ts` — `findStar()`, `findBody()` for transfer button handler
- `ui.ts` — `findShip()` for HUD, `findBody()` for notification click

### T1.8: Cleanup
- Remove deprecated exports from `bodies.ts` and `ship-transfer.ts`
- Remove `_proxyPos` scratch object
- Update CLAUDE.md import hierarchy

---

## Phase 2: Ship Intent Broadcast — `core/intents.ts`

### T2.1: Add types to `types.ts`
```ts
type ShipIntent =
  | { type: "surveying"; target: string; shipName: string }
  | { type: "transferring"; destination: string; shipName: string }
  | { type: "refueling"; location: string; shipName: string }
  | { type: "overhauling"; location: string; shipName: string }
  | { type: "shore-leave"; location: string; shipName: string }
  | { type: "idle"; location: string; shipName: string };
```
Add `shipIntents: Map<string, ShipIntent>` to `AppState`.

### T2.2: Create `src/core/intents.ts`
**Exports:**
| Function | Description |
|---|---|
| `publishIntent(shipName, intent)` | Set/update a ship's intent |
| `clearIntent(shipName)` | Remove on ship destruction/removal |
| `getIntentForShip(shipName)` | Query specific ship's intent |
| `isTargetClaimed(target, excludeShip)` | Is target claimed by another ship? |
| `getClaimedTargets(excludeShip)` | Set of all claimed targets (O(1) lookups) |

### T2.3: Create `src/__tests__/intents.test.ts`
- publishIntent adds/overwrites
- clearIntent removes
- isTargetClaimed: surveying, transferring, self-exclusion, unclaimed, empty pool
- getClaimedTargets: multi-ship, self-exclusion, ignores non-target intents

### T2.4: Integrate with `selectNextSurveyTarget()`
- `commands.ts` — import `getClaimedTargets`, skip claimed bodies/asteroids in candidate loop

### T2.5: Publish intents in `main.ts`
- `dispatchCommand()` — publish intent for each action type
- `onTransferComplete()` — update intent from "transferring" to "surveying"
- `teardownSystem()` — `state.shipIntents.clear()`

### T2.6: Add intent-aware test to `commands.test.ts`
- `selectNextSurveyTarget` skips bodies claimed by other ships

---

## Phase 3: Multi-Ship Creation

### T3.1: Parameterize `createShip()`
- **File:** `src/rendering/ship-transfer.ts`
- Change signature: `createShip(config: { name: string; hostPlanetName: string; engineId?: string; color?: string })`
- Use config values instead of hardcoded "Ship" / Earth

### T3.2: Create multiple ships at init
- **File:** `src/main.ts`
- Replace single `createShip()` with 2-3 named ships:
  - "ISS Explorer" at Earth
  - "Magellan" at Mars
  - "Kepler" at Jupiter
- Call `rebuildEntityMaps()` after all ships created

### T3.3: Ship name uniqueness
- Enforce unique names at creation time (check bodyMap)

---

## Phase 4: Multi-Ship Save/Restore

### T4.1: Update `SavedShipData`
- **File:** `src/types.ts`
- Add `name: string`, `hostPlanetName: string` to `SavedShipData`
- Change `SavedStateData.ship: SavedShipData | null` → `ships: SavedShipData[]`

### T4.2: Update save/restore logic
- **File:** `src/core/state.ts`
- `saveState()` — iterate all ship entries, save each
- `restoreShipState()` — match ships by name
- Bump `SAVE_VERSION` to 4
- Migration: v3 `ship` singular → v4 `ships: [{ name: "ISS Explorer", ...ship }]`

### T4.3: Test save/restore roundtrip
- Save with 3 ships, restore, verify all ship state matches
- Version migration from v3 to v4

---

## Phase 5: UI Fleet Awareness

### T5.1: HUD ship activity
- **File:** `src/ui/ui.ts` — `updateHUD()`
- If a ship is selected, show that ship's status (prefixed with name)
- Otherwise show fleet summary: "3 ships: 1 surveying, 1 in transit, 1 idle"

### T5.2: Labels — multi-ship survey markers
- **File:** `src/ui/ui.ts` — `updateLabels()`
- Collect all active survey targets into a Set before label loop
- Any ship surveying a body shows the `*` marker

### T5.3: Notification click for asteroids
- **File:** `src/ui/ui.ts` — notification click handler
- Use `resolveEntity` instead of `bodyMeshes.find` to handle asteroid notifications

---

## Phase 6: Validation & Cleanup

### T6.1: Full test suite
- `bun run test` — all tests pass
- `bun run lint` — zero warnings
- `bun run build` — successful

### T6.2: Update CLAUDE.md
- Update import hierarchy with `core/entities.ts` and `core/intents.ts`
- Update ship simulation docs for multi-ship
- Update test count
- Add intent system to conventions

### T6.3: Integration smoke test
- 3 ships, high time speed, verify independent autonomous behavior
- Ships select different survey targets (no contention)
- Save/restore preserves all ship state
- Survey complete notification fires once, not per-frame

---

## Execution Waves (Parallel Agent Assignment)

### Wave 0 — Bug Fixes (sequential, quick)
| Task | Files | Agent |
|------|-------|-------|
| T0.1-T0.6 | main.ts, ship-transfer.ts | Single builder |

### Wave 1 — Foundation (parallel, independent new files)
| Task | Files | Agent |
|------|-------|-------|
| T1.1-T1.2 | core/entities.ts, __tests__/entities.test.ts | Builder A |
| T2.1-T2.3 | types.ts (intents), core/intents.ts, __tests__/intents.test.ts | Builder B |

### Wave 2 — Migration (sequential, depends on Wave 1)
| Task | Files | Agent |
|------|-------|-------|
| T1.3-T1.8 | bodies.ts, ship-transfer.ts, rendering.ts, main.ts, commands.ts, ui/ | Builder (large) |

### Wave 3 — Multi-Ship + Intents Integration (parallel, depends on Wave 2)
| Task | Files | Agent |
|------|-------|-------|
| T2.4-T2.6 | commands.ts, main.ts, commands.test.ts | Builder A |
| T3.1-T3.3 | ship-transfer.ts, main.ts | Builder B |

### Wave 4 — Persistence + UI (parallel, depends on Wave 3)
| Task | Files | Agent |
|------|-------|-------|
| T4.1-T4.3 | types.ts, state.ts, state.test.ts | Builder A |
| T5.1-T5.3 | ui.ts | Builder B |

### Wave 5 — Validation
| Task | Files | Agent |
|------|-------|-------|
| T6.1-T6.3 | CLAUDE.md, full test/lint/build | Validator |

---

## Future (not in this plan)

- **Separate `state.ships[]` index** — when ship count > ~50
- **Instanced rendering** — `THREE.InstancedMesh` for ships when count > ~200
- **Canvas/WebGL labels** — replace DOM labels when count > ~100
- **Spatial indexing** — quadtree for `selectNextSurveyTarget` when O(N×B) matters
- **Command tree batching** — shared evaluation for identical trees
- **Moon visit queue** — survey moons of non-nearest planets
- **Rescue/tow missions** — intent type "requesting-rescue"
- **Fleet formation** — intent type "escorting"
