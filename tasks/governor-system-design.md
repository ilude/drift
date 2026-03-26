# Governor System Design

> Status: Accepted design direction (2026-03-26)
> Related: `tasks/game-vision-early-game.md`, `tasks/colony-system-design.md`

## Purpose

The governor system lets players delegate colony construction management to a deterministic AI, freeing them to focus on ship design, research, and expansion. It is the colony equivalent of the ship commander judgment system — same pattern, different scope.

---

## Core Principles

**Deterministic.** Governor decisions are fully predictable from their skill profile and colony state. No hidden RNG in decision logic. Players can learn governor behavior and trust it.

**Constrained by player.** The player sets the scope of governor authority. Governors never act outside their assigned domain.

**Research is never delegated.** The research queue and scientist assignments always remain the player's responsibility. Governors build the infrastructure (academies, labs) that makes research possible, but never decide what to research.

**Skill-driven priorities.** A governor with high construction skill prioritizes factories and infrastructure. One with high scientific administration prioritizes labs and academies. One with high logistics skill prioritizes fuel depots and cargo handling. Skills shape *what* they build, not whether they behave correctly.

---

## Governor Authority Scope

Players can grant governors control over any subset of colony decisions:

| Domain | When granted | Governor action |
|---|---|---|
| Construction queue | Full or partial | Queues and allocates factory % to installations |
| Mine deployment | Optional | Deploys available mine modules to active extraction |
| Population services | Optional | Queues housing, medical, and food facilities |
| Infrastructure | Optional | Queues fuel depots, repair yards, launch pads |
| Academy/lab building | Optional | Builds research support infrastructure (not research itself) |

When a domain is not granted, the governor ignores it. The player retains full control of ungoverned domains.

---

## Decision Logic (MVP)

The governor evaluates colony state each tick and queues construction if:
1. A domain is within their authority
2. Available factory capacity exists (not already fully allocated)
3. The colony's current state indicates a need (e.g., workforce at capacity → queue housing; mines idle for lack of workers → queue housing before more mines)

Priority order is shaped by skill bonuses:
```
governor.constructionPriority = baseScore(colonyNeed) * (1 + governor.skills.construction * 0.5)
```

The governor picks the highest-priority item from their allowed domains and queues it at a reasonable factory allocation % (not consuming 100% — leaves headroom for player overrides).

---

## Personality Traits (Future)

In a later phase, governors gain personality traits that modify their priorities:

- **Expansionist:** Overweights new capacity (mines, factories) vs. services
- **Cautious:** Overweights stockpiles and redundancy; slow to expand
- **Scientific:** Overweights research infrastructure even outside explicit science domain
- **Logistician:** Overweights fuel, transport, and cargo handling

Traits do not override player constraints — they only shift priorities within allowed domains. Traits create interesting governor selection decisions without making any governor "wrong."

---

## Relationship to Commander Judgment

The ship commander system (`src/core/commander.ts`) is the direct design precedent. Key parallels:

| Ship commanders | Colony governors |
|---|---|
| `commanderDecide()` evaluates ship state | `governorDecide()` evaluates colony state |
| Judgment (0.0–1.0) scales override aggressiveness | Skill level scales priority weighting |
| Player sets command tree constraints | Player sets authority domain |
| Commander never overrides player immediate commands | Governor never touches research queue |
| Learning from failures bumps judgment | Skill growth from successful project completion |

Implementation should follow the same pattern: `governorDecide(colony)` as the entry point, returning a `ConstructionQueueAction | null`. The colony tick calls this when the governor is active and the queue has capacity.
