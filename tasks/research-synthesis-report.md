# Research Synthesis Report: Tech Trees, Colonies, and Depth

> **Date:** 2026-03-25
> **Scope:** Comprehensive design research session covering tech/research systems, colony management, game depth theory, combinatorial design, and emergent systems.
> **Status:** Discussion document. No implementation decisions finalized.

---

## 1. What We Researched

### Game-Specific Systems Research
| Game | Topics Covered | Reference File |
|------|---------------|----------------|
| **Aurora 4X** | Tech tree (9 fields, scientist system, RP formula), colony management (installations, population sectors, specialization), lab/scientist player experience | `aurora-4x-research-reference.md`, `research-aurora4x-colony-management.md`, `aurora-research-reference.md` |
| **Star Ruler 1** | Infinite-level hex tech grid, hunch/guess discovery, ship design (unlimited scaling), stockpile economy, building slots, governors | `reference-star-ruler-research.md`, `reference-star-ruler-ships.md`, `research-star-ruler-economy.md`, `research-star-ruler-colony-systems.md` |
| **Star Ruler 2** | Finite hex grid with path-buying, diminishing returns formula, pressure/level economy, planet leveling, territory trade | Same files as SR1 (both covered) |
| **Stellaris** | Weighted card draw, scientist expertise (10x draw weight swing), 3-area parallel research | `research-tech-tree-reference.md` |
| **Civ VI** | Dual trees, eureka boost system (gameplay actions → research discounts) | Same |
| **Endless Space 2** | 4-quadrant grid, era gating via breadth, exclusive tech pairs, political affinity | Same |
| **Distant Worlds 2** | Semi-hidden randomized tree, research bonus thresholds tied to territorial control | Same |
| **Master of Orion 1/2** | Forced exclusion, slider allocation, miniaturization, Creative trait | Same |
| **Sword of the Stars** | Per-race cascading probability rolls, salvage from combat | Same |

### Depth & Design Theory Research
| Topic | Key Findings | Reference File |
|-------|-------------|----------------|
| **Deep sim design** (DF, RimWorld, Factorio, Shadow Empire) | 10 core patterns including Endless Bottleneck, Failure as Content, Director Pattern. Shadow Empire's logistics preventing late-game snowball. RimWorld's 5-15 named characters for max narrative. | `design-patterns-depth-longevity.md` |
| **Survival sim depth** (CDDA, UnReal World, Caves of Qud, ONI) | 5 Pillars of Depth: Consistent Simulation, Systems Interaction, Constrained Resources, Player Agency Without Prescription, Legible Complexity | `design-patterns-depth-research.md` |
| **Emergent gameplay theory** | Formal emergence definition, progressive disclosure, "losing is fun" requirements, longevity patterns, complexity management | `design-theory-reference.md` |
| **Game depth theory** (from video transcript) | Shannon number vs viable strategies, dominant strategies reduce depth, risk-reward as eternal depth, managed uncertainty, heuristics at different levels | `research-game-depth-theory.md` |
| **CCG combinatorial depth** (MTG, Slay the Spire, Dominion, Netrunner) | 10 extractable principles: simple pieces/complex interactions, constraints create depth, modular over parasitic, hidden synergy, the 2+2=5 test | `research-combinatorial-depth.md` |
| **Emergent system interactions** (DF deep cuts, RimWorld, KSP, Minecraft, Noita) | 10 design principles + 7 anti-patterns. Output-to-input chaining. Persistent relational entities. Cascading failure as feature. | `emergent-systems-research.md` |
| **Academic papers & GDC talks** | "Depth in Strategic Games" (Lantz 2017), Felder's complexity budget, Burgun's elegant vs patchwork, Johnson's "remove rote decisions", Sylvester's apophenia, Adams' autonomous agents | `research-academic-depth-bibliography.md` |

### Codebase Analysis
| Topic | Key Findings | Source |
|-------|-------------|--------|
| **Drift systems audit** | 4 engine tiers, 3 survey levels, rate modifier pattern, ~15 hardcoded constants, commander judgment system. No progression system exists yet. | Subagent analysis of src/ |

---

## 2. Key Insights by System

### Tech Tree / Research

**What works in other games:**
- **Aurora's scientist scarcity** is the gold standard for making research feel like a real strategic choice. Limited high-quality scientists + 4x specialization bonus + admin rating cap = genuine tradeoffs.
- **Civ VI's eureka system** is the best model for tying research to gameplay actions. "Survey a gas giant → boost atmospheric processing tech" would feel natural in Drift.
- **MOO1's forced exclusion** creates strategic identity per playthrough. When you can't have everything, your choices define you.
- **SR2's diminishing returns** (`2000 / (2000 + totalGenerated)`) prevent runaway tech leads — an elegant anti-snowball mechanism.
- **Stellaris's expertise-biasing-draws** creates a feedback loop: your scientist's specialty shapes what techs you see, which shapes your capabilities, which shapes your strategy.

**What doesn't work:**
- **SR1's infinite levels** caused "research is the only thing that matters" — whoever researched fastest won regardless of other factors.
- **Aurora's micromanagement** of individual tech components (designing a laser takes 15 minutes) drives players away despite deep simulation.
- **Fully visible static trees** (Civ VI, ES2) become "solved" after many playthroughs.

**Drift's existing hooks:**
- 4 engine tiers in `ship-physics.ts` — natural tech progression
- 3 survey levels gated by accessibility — sensor tech hook
- Rate modifier pattern (`base * depotQuality / hardness`) — tech would be a third axis
- Commander judgment + experience — crew/personnel tech hook
- ~15 hardcoded constants that could become tech-driven

### Colony Management

**What works in other games:**
- **Aurora's population-as-contested-resource** — labs, factories, mines all compete for workers. Every installation is an opportunity cost. This is the core tension.
- **Aurora's colony cost** — single number from worst environmental factor. Elegant habitability model.
- **Aurora's automated mines** — zero-population mining outposts enable early expansion without full colony infrastructure.
- **SR2's pressure system** — civilians auto-build based on imported resource pressure. Reduces micro while making geography matter.
- **SR2's resource pyramid** — many food/water planets feed fewer high-tier planets. Creates natural supply chain vulnerability.
- **SR1's governor profiles** — automation is required past ~20 colonies. Plan for it from the start.

**What doesn't work:**
- **SR1's Galactic Bank** — shared empire-wide resource pool makes geography irrelevant.
- **Aurora's extreme micromanagement** — managing individual labs, factory counts, population transport across dozens of colonies.
- **SR2's civilian auto-build** — some players felt passive, lacking agency.

**Drift's design direction (from discussion):**
- Population modeled as demographic cohorts (children → students → workers → elderly), NOT 1:1
- Birth rate tied to breeding-age adults
- Workforce is the contested resource — installations compete for working-age population
- Specialists (scientists, engineers, naval officers) from academy pipeline
- Colony-local research (Aurora model) — forces "research world" specialization
- `depotQuality` becomes per-colony, calculated from actual facilities
- Incremental build: Phase 0 (flag + pop + depot) → Phase 1 (workforce + buildings) → Phase 2 (demographics + specialists) → Phase 3 (production + logistics)

### Depth Without Complexity

**The central framework:**
> "Complexity is a budget. Every new rule costs comprehension and tracking. Spend that budget on systems that create depth (harder to find optimal play), not on systems that create verisimilitude for its own sake." — Dan Felder

**Key diagnostic tools:**
1. **Felder's three-way test:** Does this add Depth (harder to find optimal play), Comprehension Complexity (harder to learn), or Tracking Complexity (harder to monitor)? Only the first is worth the cost.
2. **Burgun's patchwork test:** Does this new system link to 2-3 existing systems? If not, it's patchwork — cut it.
3. **The interaction test:** Can system A's state change what system B does? If not, they coexist rather than interact.
4. **The 2+2=5 test:** Do two elements combined produce more value than the sum of their parts? If tech + commander skill + body type + resource accessibility = emergent strategy, that's depth. If they're independent multipliers with no interaction, that's just numbers.
5. **The rote decision test:** Is there a dominant strategy? If so, it's not a decision — it's a tax on the player's time.

**Aurora as the anti-pattern:**
Aurora proves that simulation fidelity ≠ depth. Most players never experience Aurora's depth because the complexity budget is overspent on component-level micromanagement. Drift's command tree system is specifically the response: instead of micromanaging each ship's maintenance schedule, the player expresses intent through priorities and the commander executes. The depth is in designing the command tree, not in manually scheduling overhauls.

---

## 3. How Systems Should Interact in Drift

The research consistently shows: **depth comes from system interactions, not system count.** Here's how Drift's planned systems create interaction chains:

```
Demographics (colony workforce)
    ↕ competes with
Installations (factories, labs, mines, shipyards, academies)
    ↕ produces
Specialists (scientists, engineers, naval officers)
    ↕ assigned to
Research Labs (colony-local, scientist-managed)
    ↕ generates
Tech Levels (propulsion, sensors, hull, fuel, crew, etc.)
    ↕ improves
Ship Performance (engine tier, survey depth, repair rate, fuel efficiency)
    ↕ enables
Exploration (survey deeper, reach farther, last longer)
    ↕ discovers
Resources (deposits revealed by survey, body sub-type determines pools)
    ↕ extracted by
Mines (colony installation, competes for workforce)
    ↕ feeds
Production Chains (raw → processed → components)
    ↕ enables
Ship Construction & Colony Growth
    ↕ requires
More Population (back to demographics)
```

**Every link in this chain is a decision point.** Do you allocate workforce to mines or labs? Do you research better engines or better sensors? Do you survey the distant asteroid belt or develop the colony you have? Do you build a shipyard or an academy?

**The chain creates the Endless Bottleneck pattern:** solving one problem (not enough fuel range) shifts the constraint (need better engines → need research → need labs → need workforce → need colony growth → need food/housing → need infrastructure). The player is never "done."

**Emergent strategies should be discoverable but not obvious:**
- A constellation of automated mining outposts feeding a central research colony (no population needed at outposts, all workers concentrated on labs)
- A high-judgment commander with sensor specialization stationed at a research colony near exotic bodies (judgment boosts research, proximity reduces survey transit time)
- Deferring colony development in favor of survey-driven breakthroughs (eureka-style: survey a gas giant → propulsion research boost)
- Specializing colonies based on body type and available deposits rather than trying to make every colony self-sufficient

---

## 4. The Combinatorial Depth Opportunity

From the CCG research, the most applicable principle: **modular design over parasitic design.**

- **Parasitic:** A system that only interacts with one other system. "Survey speed bonus" only affects surveying. It's a flat number that does one thing.
- **Modular:** A system that interacts with many others. "Commander experience" affects survey speed AND malfunction resistance AND judgment learning rate AND preemptive servicing thresholds. One concept, multiple interaction points.

**Drift already has modular design in its ship simulation:**
- Hull integrity affects: malfunction rate (sqrt multiplier), routine maintenance cap, overhaul duration, survey condition penalty
- Morale affects: routine maintenance rate, malfunction rate, deployment limit decay
- Commander judgment affects: preemptive servicing, maintenance deferral, learning from failure

**The opportunity with colonies + tech:**
Each new system (workforce, research, tech levels) should touch multiple existing systems. A tech upgrade to "hull materials" should improve:
- Hull ceiling degradation rate (slower aging)
- Routine maintenance effectiveness (better materials = easier repair)
- Malfunction severity (better materials = less damage per malfunction)
- Ship construction time at colony shipyards (new materials = different build process)

That's one tech concept touching four existing systems. The player discovers that hull tech isn't just "more HP" — it changes the maintenance calculus, the refit schedule, the deployment strategy, and the construction pipeline. That's depth.

---

## 5. Open Design Questions

### Tech Tree Structure
- **How random?** Per-seed branch availability (MOO1 style)? Or fully visible tree with forced exclusion (MOO2)?
- **How does research happen?** Colony-based labs (Aurora) + survey-driven breakthroughs (Civ VI eureka)?
- **Categories?** Propulsion, Sensors, Hull/Materials, Fuel Systems, Life Support, Crew Development, Malfunction Resilience — 7 branches? Or fewer, more interconnected?
- **Cost model?** Doubling per level (Aurora/SR1)? Diminishing returns (SR2)? Flat costs?

### Colony Foundation
- **When do we build it?** Phase 0 (flag + pop + depot quality) could be next after this design phase
- **Earth's starting state?** Billions of people, established infrastructure, or smaller frontier colony?
- **Colonization mechanism?** Colony ships carrying population? How much?
- **Automation?** Governor profiles from day one, or manual management first?

### Interaction Design
- **What's the minimum system set for depth?** Colonies (workforce + installations) + Research (labs + scientists + tech tree) + Resources (mining + extraction) as a connected triad?
- **Where are the eureka moments?** Survey-driven breakthroughs: "survey a gas giant → propulsion insight," "find umbral element deposit → unlock umbral research branch"
- **How do we prevent Aurora's trap?** Command tree for ships (done). What's the equivalent abstraction for colony management? Priority-based workforce allocation? Governor profiles?

### Narrative & Feel
- **Ship logs/history?** Commander decisions, malfunctions, surveys completed — visible event history per ship. The "art system" equivalent from Dwarf Fortress.
- **Named specialists?** Scientists and officers as persistent characters with names, skills, history. RimWorld's lesson: 5-15 named characters = maximum emergent narrative.
- **How does failure feel?** A malfunction that cripples a ship during a critical survey should feel like a story, not just bad luck. The notification system needs to support this.

---

## 6. Recommended Reading Order

For anyone coming into this design context cold, read in this order:

1. `research-game-depth-theory.md` — The theoretical foundation (what IS depth?)
2. `research-combinatorial-depth.md` — How CCGs create depth through interaction (the 2+2=5 pattern)
3. `emergent-systems-research.md` — Concrete examples of emergence (DF, RimWorld, etc.)
4. `research-academic-depth-bibliography.md` — Academic grounding (read the Lantz 2017 paper and Felder article)
5. `colony-system-design.md` — Our colony design direction
6. `aurora-4x-research-reference.md` + `aurora-research-reference.md` — Aurora's tech/research (our primary influence)
7. `reference-star-ruler-research.md` + `research-star-ruler-economy.md` — Star Ruler (our secondary influence)
8. `research-tech-tree-reference.md` — Other 4X tech systems for comparison
9. `design-patterns-depth-longevity.md` + `design-patterns-depth-research.md` — Depth patterns from sim games
10. `design-theory-reference.md` — Design theory (emergence, complexity management, failure)

---

## 7. Summary

**Where Drift is today:** A ship simulation with rich emergent behavior (command trees, commander judgment, maintenance/morale/malfunction interactions) but no progression system. Everything is available from the start. There's no reason to colonize, no economy, no tech advancement.

**Where Drift should go:** Colonies provide the economic foundation (workforce, installations, infrastructure). Research provides the progression system (tech trees, scientist management). Resources provide the extraction/production loop (mining, processing, manufacturing). All three systems interact through the workforce constraint (population is the contested resource) and feed back into ship performance (better tech → better ships → better exploration → more discoveries → better colonies).

**The design north star:** Every system should be individually simple but interact with 2-3 other systems. The gap between rule complexity and emergent complexity should be as wide as possible. Aurora's simulation fidelity is the aspiration; Aurora's micromanagement is the anti-pattern. The command tree abstraction is the template: express intent through priorities, let autonomous agents execute.

**Next step when ready to build:** Phase 0 colonies — a flag on a body with a population number and a depot quality calculated from what's there. Simple enough to implement in a session, foundational enough to build everything else on top of.
