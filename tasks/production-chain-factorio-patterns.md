# Factorio Production Chain Patterns — Design Reference

## Why Factorio Is Relevant to Drift

Factorio is the canonical throughput-optimization game. Its production chains are intentionally simple (2–3 steps per chain) but create extraordinarily deep emergent gameplay through bottleneck cascades, ratio puzzles, and logistical constraints. This document extracts the patterns applicable to a 4X colony simulation.

---

## Core Factorio Mechanics

### Chain Structure

Factorio chains are **shallow but wide**: most end-products require only 2–4 processing steps, but the sheer variety of end-products (100+) creates complexity through simultaneous management.

```
Iron Ore → Iron Plate → Iron Gear / Steel Plate / Electronic Circuit → ...
Copper Ore → Copper Plate → Copper Cable / Electronic Circuit → ...
Oil → Petroleum Gas → Plastic / Sulfuric Acid / ...
```

Key observation: **depth is rare**; most complexity comes from managing *many shallow chains simultaneously*.

### Throughput Ratios

Every machine has an explicit production rate (items/second). The core puzzle is ensuring producers and consumers are in ratio.

**Example:** Yellow Assembler produces gears at 0.5/sec. Each gear requires 2 iron plates; Iron furnace smelts plates at 0.9/sec. Ratio: need 2 iron for 1 gear → need 2 × 0.5 / 0.9 ≈ 1.1 furnaces per assembler.

This is Factorio's core engagement loop: **players discover mismatches through backlog/starvation and fix them by adding machines**.

### The Belt as Feedback Mechanism

Factorio's belts make throughput *visible*. A full belt = backed up (producer bottleneck or consumer too slow). An empty belt = starved (consumer too fast or producer too slow). Players diagnose problems visually.

**This is the key insight for Drift:** Production problems must be *visually* surfaced. In Factorio, backed-up belts are the feedback. In Drift, it must be status indicators and notifications.

### Bottleneck Culture

Factorio's late-game is pure bottleneck management. Solving one bottleneck reveals the next. The game has no "solved" state — scaling up always exposes a new constraint.

This aligns directly with Drift's design principle: "The Endless Bottleneck. Never let the player reach a fully solved state. Every optimization should shift the constraint rather than remove it."

---

## Depth Generators in Factorio Chains

### 1. Ratio Optimization

Players must balance producers and consumers across the full chain. Getting ratios right is satisfying; getting them wrong creates cascading shortages.

**What creates depth:** Multiple chains sharing the same intermediate product (e.g., electronic circuits used by 20 different recipes). Optimizing for one product steals from another.

**Drift application:** If Iron is used by both Construction (buildings) and Fabrication (ship components), the player must allocate between them. Simple 2:1 type ratios keep this tractable without spreadsheets.

### 2. Bottleneck Shifting

Solving one constraint reveals the next. This creates a satisfying progression with no dead-end states.

**What creates depth:** The bottleneck location is not predictable — it depends on the player's expansion path and current demands. Two players can have entirely different bottlenecks at the same game stage.

**Drift application:** Colony specialization creates natural bottleneck shifting. A mining colony that's fully optimized for ore will next be constrained by fuel. A research colony will next be constrained by scientist count.

### 3. Tech Unlock Sequencing

Research unlocks more efficient machines (yellow → red → blue assemblers = 0.5x → 0.75x → 1.25x speed). This forces players to re-optimize chains as tech advances.

**What creates depth:** Every tech level potentially changes the optimal ratio of machines. The player must recognize which chains are now bottlenecked by outdated machines.

**Drift application:** Research-gated engine tiers, survey sensor upgrades, and better refineries would create similar re-optimization moments. "I researched Advanced Metallurgy — now my old smelters are the bottleneck."

### 4. The Oil Problem (Multi-Output Processing)

Oil refining produces three outputs simultaneously (petroleum, diesel, heavy oil) in fixed ratios. The player's demand rarely matches the output ratios — they crack excess heavy oil into diesel, which creates new excess.

**What creates depth:** Managing multi-output processes is genuinely harder than single-output. The player must build cracking chains to absorb unwanted byproducts.

**Drift application:** Ore refining could produce both a primary refined metal and a byproduct (slag, tailings, waste heat). Handling byproducts creates an optional advanced optimization path — players can ignore them early but eventually need to deal with them to maximize efficiency.

### 5. Pollution/Power as Asymmetric Resource Drains

Power generation and pollution management are secondary chains that compete with production for inputs (coal, uranium) and create external constraints (biter attacks scale with pollution).

**What creates depth:** Secondary resource chains create budget tradeoffs — coal can power furnaces OR fuel trains OR support the steam grid. This creates meaningful allocation decisions.

**Drift application:** Fuel is Drift's equivalent — fuel powers ships AND is required for colony operations AND can be traded. Fuel decisions involve non-trivial allocation.

---

## Anti-patterns in Factorio That Drift Should Avoid

### The Infinite Scaling Treadmill

Factorio's answer to every bottleneck is "build more machines." There's no upper bound on expansion — you can always add more furnaces, more assemblers, more belts.

**Why this is a problem for 4X:** In Factorio, space is the only real constraint. In a 4X with colonies and population, you want **meaningful scarcity** — not unlimited expansion. Every bottleneck should be resolvable through *decision* (what to prioritize), not just *expansion* (build more).

**Drift solution:** Population caps, finite deposit accessibility, and colony size limits ensure that expansion has diminishing returns.

### Micromanagement of Individual Machines

Factorio players routinely inspect individual assemblers to check their item slots, upgrade individual machine tiers, and route items around individual choke points.

**Why this is a problem for 4X:** In a game with 10+ colonies, per-facility micromanagement is unsustainable. Drift must abstract facility management to the colony level.

**Drift solution:** Colonies operate at aggregate level (N mines, M refineries). Individual facility details are hidden. The player manages *allocation* and *count*, not individual machine states.

### External Calculator Dependency

Factorio's community has produced extensive ratio calculators (Factorio Calculator, Kirk McDonald's calculator) because the mental math for complex chains is too hard.

**Why this is a warning sign:** If players need external tools to make production decisions, the system has too much numerical complexity. This is comprehension complexity without depth.

**Drift solution:** Stick to simple ratios (2:1, 3:1) that players can estimate mentally. Surface the math in the UI ("This refinery needs 2× its current ore supply") rather than requiring players to calculate it.

### Green Circuit Monoculture

In mid-game Factorio, green circuits (electronic circuits) become the universal bottleneck because they're used in almost every recipe. The solution is always "build more green circuits," which requires more copper cable, which requires more copper plates, which requires more copper ore — a single chain dominates.

**Why this is a problem:** It creates one dominant strategy ("optimize green circuits first") and makes other production decisions feel irrelevant by comparison.

**Drift solution:** Distribute demand across multiple intermediates. Don't make one material used by everything. Ensure that different specialization paths (survey-focused vs. construction-focused vs. research-focused colonies) use different bottleneck resources.

---

## Factorio Patterns Applicable to Drift

### Pattern 1: "Build the Feedback Loop First"

Factorio teaches production chains by making the feedback immediate and visual. Before worrying about ratios, players see that a backed-up belt means "too much input" and an empty belt means "too little."

**For Drift:** Before building a complex production system, build the feedback layer. Players must be able to see "this colony is producing X/day and consuming Y/day" without needing to open multiple panels.

### Pattern 2: "Let the Player Discover Ratios"

Factorio doesn't explain ratios in tutorials. Players discover them by observing bottlenecks. The game trusts players to iterate.

**For Drift:** Surface imbalances (production deficit/surplus indicators) rather than prescribing correct ratios. Let players discover that "2 mines per refinery" is optimal through observation, not through mandatory tutorials.

### Pattern 3: "Intermediate Products Create Decisions"

Factorio's intermediate products (iron plates, copper plates, steel) force players to think about the full chain, not just the end product. "I need 1000 ammo" becomes "I need iron plates, which means I need iron ore and furnaces."

**For Drift:** Multi-step chains from survey resource to ship component force players to think about their whole empire. "I need ship hull plates" becomes "I need refined metals, which means a refinery, which means ore deposits from survey, which means a mining colony." This chain is depth-creating.

### Pattern 4: "The Bottleneck Is the Interesting Part"

Factorio is deliberately designed so there's always a bottleneck. Players are never done — there's always one more constraint to solve.

**For Drift:** Design production chains so that solving a bottleneck reveals the next one. Survey → mine → refine → manufacture → construct → research → better survey → deeper deposits. Each loop should close and open the next.

### Pattern 5: "Automation That Amplifies Decisions, Not Removes Them"

Factorio allows automated trains, robotic logistics, and circuit-condition switching. These tools don't remove decisions — they allow the player to apply their time at higher levels of abstraction. Train routing is more interesting than carrying items by hand; circuit conditions allow emergent logic.

**For Drift:** Drift's command tree system is exactly this pattern — autonomous ships that amplify player decisions (survey this region, prioritize this colony) rather than requiring micromanagement (fly to this body, pick up this resource, return here). Apply the same thinking to production automation.

---

## Summary: What Drift Should Take from Factorio

| Factorio Mechanic | Drift Application | Notes |
|-------------------|-------------------|-------|
| Throughput ratios | Simple 2:1 colony ratios | Exposed in UI, not requiring mental math |
| Belt feedback | Production status in colony panel | Show surplus/deficit, not raw rates |
| Bottleneck culture | "Endless Bottleneck" design principle | Already a core Drift design goal |
| Tech unlock re-optimization | Research gates on tiers | Researching better engines/refineries creates re-optimization moment |
| Multi-output processing | Ore byproducts (optional) | Byproduct chains as optional depth, not required path |
| Automation tools | Command tree for ships | Already implemented — apply same logic to production |
| No external calculators | Simple ratios only | Keep math in-game, surfaced by UI |
| Avoid monoculture | Distributed resource demand | Don't make one material used by everything |
