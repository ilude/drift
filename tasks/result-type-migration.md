# Result<T> Migration Plan

Convert nullable return values in simulation logic to Go-style `[value, ok]` tuples,
forcing callers to explicitly handle the "not found" case at the type level.

## Type Definition

Add to `src/types.ts`:

```typescript
// Go-style result tuple: [value, true] on success, [null, false] on failure.
// Usage: const [body, found] = findBody("Earth");
//        if (!found) return;  // body is guaranteed BodyEntry here
export type Result<T> = readonly [T, true] | readonly [null, false];
```

Add factory helpers to a new `src/core/result.ts`:

```typescript
import type { Result } from "../types";
export const ok  = <T>(value: T): Result<T> => [value, true] as const;
export const err = <T>(): Result<T>          => [null,  false] as const;
```

`ok`/`err` keep construction sites readable and avoid raw tuple literals everywhere.

---

## Scope: What to Convert

### Group 1 — Entity resolution (highest value, root of both bugs)
`src/core/entities.ts`
- `findBody(name)` → `Result<BodyEntry>`
- `findPlanet(name)` → `Result<PlanetEntry>`
- `findShip(name?)` → `Result<ShipEntry>`
- `findStar()` → `Result<PlanetEntry>`
- `resolveEntity(name)` → `Result<ResolvedEntity>`
- `findAsteroidEntity(name)` → `Result<{ asteroid; beltEntry }>`

### Group 2 — Colony lookups (simulation logic, drove the asteroid bugs)
`src/core/colonies.ts`
- `getNearestColonyForShip(ship)` → `Result<PlanetEntry>`
- `getColonyQualitiesAtBody(name)` → `Result<ColonyQualities>`
- `getColony(bodyName)` → `Result<ColonyState>`
- `getResearchDef(techId)` → `Result<ResearchDefinition>`

### Group 3 — Command tree signals
`src/core/commands.ts` / `src/core/commander.ts`
- `evaluateCommandTree(ship)` → `Result<CommandResult>`
- `commanderDecide(ship)` → `Result<CommandResult>`
- `selectNextSurveyTarget(ship)` → `Result<string>`
- `selectNextRefuelTarget(tanker)` → `Result<string>`

Note: these return null as a meaningful "nothing to do" signal, not as an error.
The Result wrapper still applies — callers must explicitly handle `[null, false]`
rather than forgetting to check `if (result)`.

### Group 4 — Skip (intentionally null by design)
- `src/data/resources.ts` `getResourceDef` — catalog Map.get(), undefined is fine
- `src/rendering/*` — Three.js / DOM null is conventional (rings, cloud mesh, etc.)
- `src/core/state.ts` `loadSavedState` — null = no save exists, callers all check
- `createShip` returning undefined — guard against duplicate name, one callsite
- `getIntentForShip` — Map.get() semantic, fine as undefined

---

## Migration Order

Follow the import hierarchy bottom-up so each layer compiles before its dependents.

```
Step 1  src/types.ts              — add Result<T>
Step 2  src/core/result.ts        — add ok / err helpers
Step 3  src/core/entities.ts      — Group 1 (no app imports, convert + update tests)
Step 4  src/core/colonies.ts      — Group 2 (imports entities, convert + update tests)
Step 5  src/core/commands.ts      — Group 3 partial (selectNext* functions)
Step 6  src/core/commander.ts     — Group 3 (evaluateCommandTree, commanderDecide)
Step 7  src/main.ts               — update all dispatch callers
Step 8  src/ui/*                  — update UI callers (selection.ts, ui.ts, etc.)
Step 9  src/rendering/*           — update rendering callers
Step 10 All test files            — update mocks and assertions
```

---

## Caller Patterns

### Before
```typescript
const body = findBody("Earth");
if (!body) return;
doSomething(body);
```

### After
```typescript
const [body, found] = findBody("Earth");
if (!found) return;
doSomething(body);  // body: BodyEntry — non-null guaranteed by type narrowing
```

### Null-coalescing pattern (before)
```typescript
const body = findBody(name) ?? fallback;
```

### Null-coalescing pattern (after)
```typescript
const [body] = findBody(name);
const resolved = body ?? fallback;
// OR keep the intent clear:
const [body, found] = findBody(name);
const resolved = found ? body : fallback;
```

### commanderDecide callers (before)
```typescript
const decision = commanderDecide(ship);
if (decision) dispatchCommand(ship, decision);
```

### commanderDecide callers (after)
```typescript
const [decision, hasDecision] = commanderDecide(ship);
if (hasDecision) dispatchCommand(ship, decision);
```

---

## What This Prevents

The asteroid bug pattern:
```typescript
// Before: silent null propagation
const host = findBody(ship.hostPlanetName);  // null for asteroids — no warning
if (!host) return null;                       // caller forgot this check → bug
const dist = bodyDistanceAU(host);            // host used as if non-null elsewhere

// After: compiler enforces the check
const [host, found] = findBody(ship.hostPlanetName);
// Using `host` without checking `found` first is a type error
```

TypeScript's type narrowing means inside `if (found)`, `host` is `T` not `T | null`.
Outside that branch it remains `T | null` — you cannot accidentally use it.

---

## Estimated Blast Radius

- ~25 functions to convert
- ~120-150 callsites to update (entities functions are called most widely)
- All 21 test files will need some updates
- No new runtime behavior — purely a type-safety refactor

---

## Out of Scope

- Error messages / reasons (Go's `(T, error)` with message) — not needed here;
  "not found" is the only failure mode for all functions in scope. Use `(T, bool)`.
- Async results — no async code in simulation logic.
- Chaining / monadic transforms — KISS; explicit destructuring is sufficient.
