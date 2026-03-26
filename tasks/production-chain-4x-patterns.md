# Production Chain Design — 4X Strategy Game Patterns

## Survey of Approaches

### Aurora 4X (Population-Constrained Simulation)

Mining deposits on planets/asteroids yield ore based on accessibility and mining tech. Ore is finite per deposit. Core loop: mine → refinery → construction factory. All facilities compete for the same worker pool: 50,000 population per mine OR per construction factory.

**Depth generator:** Population as the contested resource creates real trade-offs. Every mine means fewer construction workers. Finite ore deposits create natural scarcity and geography-based strategy.

**Failure mode:** Most players never engage with the depth because it's buried under 50+ colony micromanagement. Governors automate away the meaningful decisions.

### Star Ruler 1 (Stockpile + Conversion Ratios)

`Ore → Metal → Electronics → Advanced Parts` with strict 2:1 conversion ratios. Empire-wide shared resource pool (Galactic Bank) — any planet with a spaceport imports/exports instantly.

**Depth generator:** Conversion ratios create genuine production balance puzzles. A 2:1 Metal→Electronics ratio means you need twice as many electronics factories.

**Failure mode:** Galactic Bank makes geography irrelevant. A far colony has identical resource access as the capital. Late-game becomes raw numbers, not strategic positioning.

### Star Ruler 2 (Pressure-Driven Network)

No stockpiles. Resources are permanent exports, not consumables. Each imported resource generates "pressure" of a type (Money, Research, Defense, Energy). Pressure drives civilian auto-construction of matching buildings. Planets level 0→5 by meeting tier requirements (water + food = level 1, etc.). Territory-based trade connections — resources only flow between connected regions.

**Depth generator:** Resource networks create geographic vulnerability. Cutting a supply line cascades de-levels through dependent planets. Geography matters again. Civilian automation removes micromanagement while preserving strategy.

**Failure mode:** Auto-build feels passive for players who want direct control. Network-centric design is elegant but abstract.

### Factorio (Throughput Optimization)

Shallow but wide chains (2–3 steps typically). Core gameplay: identify throughput mismatches. If a belt carries 30 items/sec but an assembler needs 60/sec, it starves. Science pack ratios (5:6:5:12:7:7) enforce production variety at scale.

**Depth generator:** Bottleneck solving is endlessly engaging. Solving one bottleneck reveals the next. Visual belt feedback makes the system legible and self-teaching.

**Failure mode:** Chain depth is shallow. Most complexity comes from *scale*, not interdependency. Green circuits become the universal mid-game bottleneck; the solution is always "build more."

### Victoria 3 (Production Methods)

No placement, no ratios, no visualization. Each building has production methods; choosing a method determines inputs, outputs, profit, and workforce. Profit motive drives capitalist behavior. Wealthy populations demand goods further up production chains.

**Depth generator:** Economic decisions (which methods are profitable), not spatial optimization. Historical accuracy justifies abstraction.

**Failure mode:** Completely opaque. No feedback on why production is failing. Players feel passive watching AI capitalists. Production system divorced from geography/warfare.

### Distant Worlds 2 (Research Thresholds)

Mining colonies → fuel processors → research planets → shipyards. Each tier depends on the tier below. Strategic planning must account for dependencies.

**Depth generator:** Dependency chains create cascade failures. Losing a fuel processor impacts all downstream construction.

### Stellaris (Districts/Jobs/Pops)

Planets have district slots (farming, mining, generator, city). Each district creates jobs; pops fill jobs and generate resources. Amenity/housing as secondary constraints.

**Depth generator:** Pop allocation between districts is the core decision. Specialist jobs (researchers, engineers) require consumer goods from other pops.

**Failure mode:** Late-game micromanagement of 50+ planets with individually managed districts. Planetary automation removes the interesting decisions with it.

---

## Depth Generators

### 1. Population as the Contested Resource

The single most powerful depth-creating mechanic across all reviewed games.

Every installation (factory, lab, academy, shipyard) draws from the same finite workforce. The trade-off is real: more mines means fewer researchers. More construction workers means slower research. Population growth is slow, creating long-term bottlenecks.

**Why this works:** Simple to understand; creates genuine emergent decisions. You can't make every colony good at everything. Specialization becomes forced.

**Aurora 4X example:** 50,000 pop per mine; 50,000 per construction factory. A 1M-population colony with 20 mines has zero construction capacity.

**Drift:** Already implemented in `colonies.ts` via `staffingRatio`. The key is making this visible in the UI so players can reason about it.

### 2. Finite Geographical Resources

Different bodies have different resource pools, accessibility levels, and scarcity. You must explore to find what you need.

**Why this works:** Location becomes strategic. A water-rich moon feeds multiple colonies. Losing it cascades failures through dependent settlements. Trade becomes necessary.

**Drift:** Already implemented — 27 resource types, body-type-specific deposit pools, `minSurveyLevel` accessibility gates. What's missing is the logistics layer that makes location matter.

### 3. Conversion Ratios as Balancing Puzzles

If Metal→Electronics is 2:1, you need twice as many metal refineries as electronics factories. Getting this wrong creates cascading bottlenecks.

**How to avoid the trap:** Don't make ratios so complex they require external calculators (Factorio's community spreadsheets are a symptom). Aim for ratios players can estimate in their head: 2:1, 3:1, rough halving/doubling.

### 4. Tiered Accessibility (Depth Increases Gradually)

Early deposits are easy to access; deeper deposits require better tech, give up less per effort. Creates natural progression from abundant early-game to constrained late-game.

**Drift:** Already implemented — survey level 1 (access ≥ 0.5), level 2 (access ≥ 0.2), level 3 (access < 0.2). What's missing is tech gates making level 2/3 surveys require research investment.

### 5. Supply Chain Pyramid

Many colonies producing raw materials feed fewer colonies producing intermediates, which feed rare specialized hubs (shipyards, research centers).

**Why this works:** Natural bottlenecks form. Geographic vulnerability — cutting a base supply cascades upward. Specialization is rewarded without being mandated.

---

## Failure Modes (What Not to Do)

### Aurora's Fidelity Trap

Component-level micromanagement with hundreds of choices per system. The system is *complex* (many choices) but not *deep* (optimal choices are obvious). Most players use community wiki designs. Aurora spends its complexity budget on fidelity that produces no meaningful decisions.

**Lesson:** Simulation depth (emergent properties) ≠ fidelity depth (realistic detail). Every mechanic should answer "what decision does this enable?" If it doesn't create a meaningful choice, it's fidelity bloat.

### Over-Abstraction (SR1's Galactic Bank)

Removing geography makes logistics strategy irrelevant. The abstraction eliminates *tedium* (good) but also eliminates *strategy* (bad).

**Lesson:** The best abstraction eliminates tedium while preserving meaningful strategy. Don't abstract away geographic constraints.

### Dominant Strategies

When one production approach always wins, depth collapses. Victoria 3's method selection becomes a chore if one method is always most profitable.

**Lesson:** Vary production costs based on current resource scarcity. If ore is abundant, ore-heavy recipes are cheap. If ore is scarce, ore-light recipes are valuable.

### Invisible Chains

No feedback on why output is low. Players stop engaging because they can't learn from the system.

**Lesson:** Every production step must be visible. Show production rates, bottlenecks, and what would fix them.

---

## Star Ruler 2's Nodal Ship Design — Deep Dive

SR2's ship design uses a literal circuit-board interface. Ships are designed by placing and connecting nodes:
- **Resource nodes:** Ore extractor, fuel cell, solar panel (inputs to the circuit)
- **Processing nodes:** Refinery, factory, reactor (transformers)
- **Output nodes:** Engine, weapon, shield (what the processed resources power)
- **Connection topology:** Player draws connections between nodes; flow is limited by node throughput

**What makes it elegant:**
1. Ships double as production infrastructure — a mining ship is literally a mining circuit board
2. Visual causality — players can trace "why is my engine weak?" by following the connection path
3. Bottlenecks are visible as connection saturation (red connections = overloaded)
4. No external spreadsheet needed — the board is the calculator

**What makes it difficult:**
1. Players unfamiliar with circuit-board thinking find it non-intuitive
2. Optimal designs emerge quickly (community shares templates)
3. Tooltip overload on dense boards

**Drift application:** A colony production graph with a similar node-connection visual, but less complex (4–6 node types vs. SR2's 15+). The key SR2 insight: **the graph IS the interface** — don't build a separate production menu, build a graph that you can inspect visually.

---

## Recommended Pattern for Drift

### MVP: Population + Stockpile + Simple Chains

1. **Population as constraint:** Already implemented via `staffingRatio`. Make it visible.
2. **Simple 2-step chains:** Ore → Refined Material (1 conversion). Player builds mine + refinery at same colony; output feeds construction queue.
3. **Colony specialization emerges naturally:** Bodies with high ore but no water specialize in ore. Player discovers this is efficient.
4. **Bottleneck notification:** When production is starved (inputs < demand), surface it in the colony panel with a specific message.

### Extension: Nodal Production Graph

After MVP is stable, add a nodal graph UI for colony production:
- Nodes = mine, refinery, factory, lab, shipyard
- Edges = resource flows with capacities
- Player connects nodes to define the chain
- Bottlenecks shown as red/orange edges
- No micromanagement of individual rates — just the topology

This reuses the directed graph data structure from `production-chain-graph-theory.md` and surfaces via a canvas-based UI in the colony panel.

### Avoid

- **Aurora's component micromanagement** — abstract the details, expose the strategy
- **Per-node rate sliders** — players set topology, not rates
- **Global resource pooling** — resources stay in colony stockpiles; logistics creates geography
- **Complex conversion ratios** — stick to 2:1 or 3:1; no multi-input recipes until late game

---

## Anti-patterns to Avoid

- **Aurora's trap:** Extraordinary simulation fidelity, but most players never experience the depth because complexity budget is overspent on component-level micromanagement.
- **Dead-end outputs:** Values that nothing else reads. Every resource must chain to something.
- **Invisible bottlenecks:** Production that fails silently. Always surface why a chain is stalled.
- **Forced specialization:** Don't mandate which bodies must specialize. Let geographic resources drive it emergently.
- **Infinite scaling treadmills:** Don't make the solution to every bottleneck "build more." Add diminishing returns or new constraints at scale.
