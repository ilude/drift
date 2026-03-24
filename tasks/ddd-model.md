# Domain-Driven Design Model

How game entities map to code modules. The goal is for the code structure to mirror how the systems work in-universe, so reading the code tells you the story of what's happening.

---

## Ship Domain

A ship has three conceptual layers:

### 1. Standing Orders (`core/commands.ts`)
The mechanical command tree — a priority-ordered list of conditional rules. A dumb computer evaluates them top-to-bottom: "if fuel below 20%, refuel." No judgment, no context awareness. Also owns the ship simulation tick (fuel drain, morale decay, malfunction checks) since those are physics/bookkeeping, not decisions.

**Key exports:** `evaluateCommandTree`, `checkCondition`, `tickShipSimulation`, `selectNextSurveyTarget`

### 2. Commander (`core/commander.ts`)
The human judgment layer. The commander reads the standing orders, then decides whether to follow them literally or override based on context. Two judgment patterns exist:

- **Preemptive service** — "We're at a colony and about to leave. Let me check if we should top off first." Raises maintenance thresholds before departure based on judgment.
- **Defer maintenance** — "We're already at an unsurveyed body. Let me finish the survey before heading home for repairs." Defers maintenance commands when the commander judges it safe, scaling risk tolerance with judgment.

Both are gated by `commander.judgment` (0.0–0.9). Low-judgment commanders follow orders literally. High-judgment commanders make contextual calls. Judgment grows through experience (malfunctions, emergency returns).

**Key export:** `commanderDecide(ship)` — single entry point. Evaluates standing orders, applies judgment overrides, returns a `CommandResult` for the crew to execute.

### 3. Crew Execution (`main.ts :: dispatchCommand`)
The crew receives the commander's decision and carries it out — initiating transfers, starting surveys, beginning overhauls. This is the "hands on the controls" layer. Currently lives in `main.ts` but could eventually move to its own module as crew specialization grows.

### Flow
```
Standing Orders (commands.ts)     →  raw CommandResult
        ↓
Commander Judgment (commander.ts) →  possibly overridden CommandResult
        ↓
Crew Execution (main.ts)          →  ship state changes, transfers, actions
```

---

## Applying This Pattern to Future Systems

### Crew Career System (`tasks/crew-career-system.md`)
The commander is the first named crew member. As the career system develops:
- **Commander traits** could modify judgment thresholds (cautious vs. bold)
- **Specialist crew** could affect execution quality (faster surveys, better repairs)
- **Crew morale** already affects survey duration — this naturally extends to other actions

### Colony Management (future)
Same three-layer pattern:
- **Standing Orders** — colony production queue, trade routes, resource allocation rules
- **Governor** — judgment layer deciding when to deviate (stockpile before winter, rush military production during threat)
- **Workers** — execution layer carrying out orders (construction, mining, manufacturing)

### Fleet Coordination (future)
- **Admiralty Orders** — fleet-level standing orders (patrol routes, escort assignments)
- **Fleet Commander** — judgment layer coordinating multiple ship commanders
- **Ship Commanders** — each ship's commander interprets fleet orders through their own judgment

---

## Design Principles

1. **Mechanical rules are always evaluatable independently.** You can call `evaluateCommandTree` without the commander. The commander adds a layer, never replaces the base.
2. **Judgment is a modifier, not a replacement.** The commander intercepts and overrides specific results, never rewrites the command tree itself.
3. **Single decision entry point per entity.** `commanderDecide(ship)` is the one function callers use. Internal judgment functions are implementation details.
4. **Learning from consequences.** Judgment grows from failures (malfunctions, emergency returns), not from time or XP. The game rewards commanders who survive difficult situations.
5. **Import hierarchy preserved.** `commander.ts` imports from `commands.ts` (reads standing orders), never the reverse. `main.ts` imports from both but only calls `commanderDecide` for decisions.
