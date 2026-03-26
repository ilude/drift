# Colony System Design Notes

> **Status:** Phase 0 implemented (2026-03-25). `src/core/colonies.ts` and `src/ui/colony-panel.ts` are live. Save version 7 includes colony state. See `tasks/decisions.md` for accepted design decisions. This doc captures broader design direction for Phase 1+.

## Core Philosophy

Colonies are infrastructure hubs that compete for a finite workforce. Every installation (factory, lab, academy, shipyard) draws from the colony's working-age population. The system should feel like managing a real settlement without simulating individuals.

## Population Model

Population is NOT modeled 1:1. It's a procedural abstraction representing demographic cohorts.

### Age Cohorts (Approximate Buckets)

| Cohort | Age Range | Role | Notes |
|--------|-----------|------|-------|
| Children | 0-14 | None (consumers only) | Born from breeding-age adults. Eventually age into students |
| Students | 15-18 | School/training | General education pipeline. Feed into workforce or academies |
| Academy Cadets | 18-22 | Specialized training | Science, naval, engineering tracks. Produces specialists |
| Working Age | 18/22-65 | Available workforce | Split between installations. The contested resource |
| Elderly | 65+ | None (consumers only) | Retired. Still consume resources/housing |

### Key Demographic Rules

- **Birth rate** tied to breeding-age adult population (not total pop). More working-age adults = more births, with a natural rate modifier
- **Aging** is continuous — cohorts flow through the pipeline over game time
- **Death rate** increases with age, baseline affected by colony conditions (habitability, medical facilities)
- **Growth is organic** — you can't rush population. You can import colonists via transport, but natural growth is the long-term engine
- **Colony conditions affect demographics** — harsh environments increase mortality, reduce birth rate. Good conditions (hospitals, habitability) improve both

### Workforce Allocation

The working-age population is the pool that installations draw from:

- Each installation type requires N workers to operate
- Understaffed installations operate at reduced efficiency (not binary on/off)
- Players allocate workforce priority, not individual workers
- Specialists (scientists, engineers, naval officers) come from academy graduates — they're a subset of the workforce with specific training

## Installation Types (Planned)

| Installation | Workers | Purpose | Notes |
|-------------|---------|---------|-------|
| Factory | Medium | Manufacturing, component production | Core economic engine |
| Mine | Medium | Resource extraction from deposits | Tied to surveyed deposits |
| Research Lab | High | RP generation (assigned to scientists) | Aurora-style: colony-local, scientist-managed |
| Academy | Medium | Trains specialists (science, naval, engineering) | Pipeline for scientists, officers, engineers |
| Shipyard | High | Ship construction and refit | Major workforce sink |
| Fuel Refinery | Low | Fuel production | |
| Commercial District | Medium | Trade, income generation | |
| Infrastructure | Low | Housing, services, capacity expansion | Enables more population/buildings |
| Medical Facility | Low | Reduces mortality, improves growth | Quality of life |
| Spaceport | Medium | Import/export throughput | Logistics bottleneck (Aurora pattern) |

## Colony Sizing

Colony size is constrained by:
- **Body type** — Larger bodies support larger colonies. Gas giants can't be colonized (orbital stations instead?)
- **Habitability** — Affects population cap, growth rate, and mortality
- **Infrastructure** — Must be built to support population growth (housing, power, life support)
- **Building slots** — Physical limit on installations, determined by body size/type

## Design Constraints (From Discussion)

1. **Population is the contested resource** — Every installation competes for the same workforce pool. Building a lab means NOT building a factory (Aurora's core tension).
2. **Specialists are scarce** — Scientists, naval officers, engineers come from academies. Academy capacity and training time create a pipeline bottleneck.
3. **Demographics are procedural** — No individual simulation. Math represents cohort flows: births → children → students → workers/cadets → elderly. Same seed = same demographic curve.
4. **Colony-local research** — Following Aurora's model: labs on a colony serve scientists assigned to that colony. No cross-colony pooling (this forces "research world" specialization).
5. **depotQuality becomes real** — Currently a global placeholder (1.0). Will be calculated per-colony from actual facilities (repair yards, fuel depots, medical, etc.).

## Incremental Build Plan

Design for the full vision but build incrementally. Each phase extends the previous without rework.

### Phase 0: Colony Foundation
- Colony = flag on a body + population number + depot quality
- Population grows at a simple rate (single number, no cohorts yet)
- Few installation types: fuel depot, repair yard, mine
- `depotQuality` becomes per-colony, calculated from installations present
- Ships "return to base" now means a real colony with real quality

### Phase 1: Workforce & Buildings
- Population splits into working-age vs dependents (cohort model activates)
- More installations: factories, research labs, academies
- Workforce competition becomes real — labs vs mines vs factories
- Scientists (from commander/crew system) assigned to colony labs
- Research system comes online, gated by colony infrastructure

### Phase 2: Demographics & Specialists
- Full cohort aging pipeline (children → students → workers → elderly)
- Academies produce specialists (scientists, engineers, naval officers)
- Birth rate tied to breeding-age adults
- Specialist scarcity creates Aurora-style tension

### Phase 3: Production & Logistics
- Mines extract surveyed deposits (connecting resource system)
- Factories consume raw resources, produce components
- Inter-colony logistics (freighters, mass drivers)
- Node-graph production UI from resource design doc

## Research Insights (From Reference Games)

### From Aurora 4X
- **Colony cost** = single number from worst environmental factor (temperature, atmosphere, gravity, water). Elegant — one number captures habitability. Infrastructure needed = pop × colony_cost × 100.
- **Automated mines** need no workers — ship them to mineral-rich bodies for zero-population mining outposts. Good pattern for early expansion.
- **Research is colony-local** — labs on different colonies can't pool into one project. Forces concentration and "research world" specialization.
- **Labs need 20x the workers of factories** (50K per lab in Aurora). Every lab is a huge opportunity cost. This is the core tension.
- **Scientist admin rating caps labs** — max_labs = admin_rating × 5. Creates high-bonus/few-labs vs low-bonus/many-labs tradeoff.
- **Factories-building-factories** is the exponential growth engine. Players front-load factory construction because output compounds.
- **Self-sufficiency takes decades** — colonies are long-term investments, not instant payoffs.
- **Population sectors**: 5% agriculture, scaling service industry, remainder is productive manufacturing. Service overhead grows with pop size.

### From Star Ruler 1
- **Building slots per planet** based on planet size (8-30+ slots). Simple, clear constraint.
- **Governor profiles** (Balanced, Research, Shipyard, Economic, etc.) handle automation. Essential past 20 planets. Adequate but not optimal — players who micro outperform governors.
- **Happiness tiers**: Food (survival) → Goods (prevents unhappiness) → Luxuries (boosts production). Three-tier morale is clean.
- **Spaceport as throughput bottleneck** — can't build faster than you can import. Elegant logistics constraint.
- **Instant construction if resources stockpiled** — production rate is the real limiter, not build timers.

### From Star Ruler 2
- **Pressure system** = imported resources drive civilian auto-construction. Player is architect of the network, not micromanager of buildings. Reduces tedium at scale.
- **Planet levels** (0-5) from importing required resource tiers. Creates natural pyramid: many food/water planets feed fewer high-tier planets.
- **Civilian auto-build** — players felt less in control but appreciated reduced micro. The tension: agency vs tedium.
- **Territory-based trade** — resources only flow within connected territory. Makes geography matter (vs Aurora/SR1 where shared pools make location irrelevant).
- **Losing a food planet cascades** — de-levels dependent planets. Creates meaningful strategic targets.

### Design Lessons (Cross-Game)
- **Population as contested resource** is the best scaling constraint. Works at 5 colonies and 500.
- **Governor/automation is required** past ~20 colonies. Plan for it from the start.
- **Colony cost as single number** (Aurora) is more elegant than multi-factor habitability displays.
- **Specialist scarcity** (Aurora scientists, SR2 labor) creates real strategic tension.
- **Research competing with production** for the same workforce pool makes guns-vs-butter real.

## Open Questions

- How does colonization work? Colony ships? What's the initial population?
- Orbital stations vs surface colonies — can you colonize asteroids? Gas giant moons only?
- How does habitability map to our existing body types? (gas giant = uninhabitable, Earth-like = ideal, asteroid = pressurized habitat?)
- What's the minimum viable colony? (outpost with a fuel depot and 1000 people?)
- How do academies interact with the crew career system (tasks/crew-career-system.md)?
- Resource consumption — do colonists eat? Need supplies? How does this create logistics demand?
- How does this interact with the resource system (tasks/resource-system-design.md)? Mines extract surveyed deposits?
- Governor/automation system — what profiles? When does it kick in? How much player control?
- Colony cost formula — adapt Aurora's single-worst-factor approach to our body types?

## References

- `tasks/aurora-4x-reference.md` — Aurora minerals and survey mechanics
- `tasks/aurora-research-reference.md` — Aurora lab/scientist management (colony-local, admin rating tradeoffs)
- `tasks/research-aurora-logistics.md` — Aurora ship design, mass drivers, manufacturing
- `tasks/aurora-4x-research-reference.md` — Aurora tech tree, research categories, scientist system
- `tasks/research-star-ruler-economy.md` — SR1 stockpile economy, SR2 pressure/level system
- `tasks/reference-star-ruler-ships.md` — SR1/SR2 ship production and fleet management
- `tasks/crew-career-system.md` — Officer careers, academy training (feeds into colony academies)
- `tasks/resource-system-design.md` — Resource catalog, production chains, mining
