# Colony Phase 0 Spec

> **Status:** Active implementation spec. Reflects the current starter colony gameplay layer in code and the intended next steps for making it more game-like.

## Goal

Provide the minimum colony simulation needed to support:

- real ship servicing at actual colonies
- colony-local construction
- colony-local research
- mining from surveyed deposits
- stockpiles that can later feed production, shipbuilding, and expansion

This phase is intentionally smaller than the full colony design in `colony-system-design.md`. It is the bridge from "interesting ship simulation" to "actual 4X progression loop."

## Design Intent

Colonies should start as **infrastructure hubs**, not full demographic simulations.

The player should be able to:

1. inspect a colony
2. understand what it is good at
3. decide what to build next
4. decide what to research next
5. feel the tradeoff between mining, research, service, and future expansion

The first playable loop is:

`survey -> improve Earth / expand colony infrastructure -> mine resources -> research upgrades -> improve survey/service output -> expand further`

## Phase 0 Scope

### Included

- Colony record keyed by body name
- Population as a single scalar
- Habitability as a single scalar
- Workforce calculation
- Installation counts
- Colony-local stockpiles
- Colony-derived service quality
- Construction projects
- Research projects
- Mining from surveyed deposits
- Earth seeded as a starting colony

### Explicitly Deferred

- cohort demographics
- births / deaths / aging pipeline
- scientist characters
- officer/specialist staffing
- colony governors
- logistics routes
- resource processing chains
- full shipyard hull construction
- colony founding package flow
- raw-material construction costs

## Colony Data Model

Each colony tracks:

- `bodyName`
- `name`
- `population`
- `habitability`
- `installations`
- `stockpile`
- `researchPoints`
- `constructionProjects`
- `currentResearch`
- `researchQueue`

## Installations In Phase 0

Supported installations:

- `construction-factory`
- `repair-yard`
- `fuel-depot`
- `mine`
- `lab`
- `academy`
- `storage`
- `shipyard`

### Role of each installation

- `construction-factory`: produces colony build capacity for future installations
- `repair-yard`: improves repair/refit throughput for stationed ships
- `fuel-depot`: improves refueling throughput
- `mine`: extracts surveyed deposits into stockpiles
- `lab`: generates research output for colony-local tech projects
- `academy`: placeholder foundation for future specialist/officer pipeline
- `storage`: increases stockpile capacity / logistics slack
- `shipyard`: placeholder limited build/refit capacity for future ship construction gameplay

## Workforce Model

Population is not yet broken into cohorts. Instead:

- workforce = `population * workforceRatio * habitability`
- installations consume fixed workers
- if used workers exceed available workers, the colony is understaffed
- understaffing reduces all derived colony qualities through a `staffingRatio`

This is the first strategic constraint, but it is intentionally simpler than the full long-term demographic plan.

## Colony Qualities

Derived qualities currently include:

- construction
- repair
- refuel
- research
- training
- mining
- shipbuilding
- storage capacity

These are produced from installation counts and reduced by staffing ratio.

Research can modify some of these values at the empire level.

## Earth Starting State

Earth starts as a **functional but strategically constrained** colony.

Earth should feel like:

- mature
- staffed
- industrially active
- capable of supporting the starting fleet
- not yet optimized for frontier growth

### Earth starts with

- large population
- baseline mining
- baseline fuel/supplies
- strong enough service infrastructure to keep ships operating
- limited research labs
- limited academy capacity
- limited shipyard capacity

### Intended Earth fantasy

Earth is an inherited industrial center with strong legacy infrastructure and weak frontier institutions.

The player should not ask:

- "How do I make Earth work at all?"

The player should ask:

- "What should Earth specialize in first?"
- "Do I fix research, training, or expansion capacity?"

## Construction Model

Construction is inspired by Aurora's installation-building model, simplified for Drift.

### Current rules

- construction is colony-local
- construction factories generate build points over time
- construction projects consume a share of local industry
- each project has:
  - target installation type
  - quantity
  - industry allocation %
  - accumulated progress

### What this achieves

- infrastructure takes time
- build priorities matter
- colony development is visible and intentional

### What is still missing

- installation build costs paid from stockpiled resources
- prerequisites for some structures
- more explicit build queue controls

## Research Model

Research is inspired by Aurora's colony-local labs, but simplified.

### Current rules

- research is colony-local
- labs determine available lab capacity
- one active project per colony
- additional projects can be queued
- active project uses assigned labs
- project progress accumulates RP over time
- completed techs unlock empire-wide bonuses

### Starter techs

Current starter research set:

- `survey-automation`
- `mining-drills`
- `maintenance-doctrine`
- `lab-instrumentation`
- `fabrication-methods`

These are intentionally pragmatic, low-abstraction upgrades that directly improve the core loop.

### Why this structure

It creates a real decision without needing the full scientist/specialist system yet.

## Mining Model

Mines extract from surveyed deposits on the colony body.

### Current rules

- no survey = no mining
- surveyed deposits produce into colony stockpiles
- extraction is scaled by:
  - number of mines
  - mining quality
  - deposit accessibility
  - remaining deposit quantity

This connects exploration directly to colony value.

## First Playable Loop

The intended near-term gameplay loop is:

1. Start on Earth
2. Inspect Earth's constrained infrastructure
3. Choose whether to invest in construction, research, or service support
4. Survey nearby bodies
5. Improve throughput through tech and installations
6. Use better survey/service/mining performance to justify future expansion

## Next Required Upgrades

To move from "playable prototype" to stronger strategy gameplay, the next additions should be:

1. Construction consumes stockpiled resources
2. New colonies can be established on surveyed bodies
3. Empire-wide colony overview screen exists
4. Colony warnings/bottlenecks are surfaced in notifications or overview
5. Labs, mines, and service facilities compete more visibly for colony output

## Non-Goals For This Phase

Do not expand Phase 0 into:

- full demographic realism
- Aurora-scale scientist micromanagement
- SR2-style territory network economy
- complete production chains
- full ship designer dependencies

Phase 0 exists to unlock gameplay, not to finish the grand strategy model in one step.
