# UX Colony Management

> **Status:** Active UX/product planning doc for the first colony gameplay loop.

## Purpose

Define the user stories and screen responsibilities for colony management in Drift's early playable state.

This document is intentionally narrower than full colony design. It focuses on the user-facing interfaces needed to make colony construction, research, and mining understandable and actionable.

## Product Goal

The player should be able to answer these questions quickly:

- What can this colony currently do?
- What is this colony bad at?
- What should I build next?
- What should I research next?
- Why is my colony or fleet underperforming?

If the player cannot answer those questions from the UI, the system is not ready.

## Core User Stories

### Starting Earth

1. As a player, I want Earth to start functional but strategically constrained so I can make meaningful early decisions.
2. As a player, I want to understand at a glance that Earth has people and basic industry, but limited research, academy, and shipyard capacity.

### Colony Inspection

3. As a player, I want to select a colony body and see its population, workforce, stockpiles, and key capacities immediately.
4. As a player, I want to tell whether a colony is understaffed, production-focused, research-focused, or service-focused without reading deep tooltips.

### Construction

5. As a player, I want to queue installations at a colony so I can shape its role.
6. As a player, I want to assign some share of colony industry to a project so build priorities feel intentional.
7. As a player, I want to pause or cancel construction so I can react to changing priorities.

### Research

8. As a player, I want to start colony-local research so labs feel like real strategic infrastructure.
9. As a player, I want to assign lab count to a project so research throughput reflects infrastructure constraints.
10. As a player, I want to queue future techs so I do not need to babysit the colony constantly.
11. As a player, I want completed research to have visible gameplay effects so research feels worth the investment.

### Mining and Resources

12. As a player, I want surveyed colony bodies to produce visible resources over time so surveying leads into economy.
13. As a player, I want to see resource stockpiles and know whether a colony is actually generating anything useful.

### Fleet Integration

14. As a player, I want ships to benefit from colony infrastructure so colonies matter to fleet operations.
15. As a player, I want to know which colony is supporting a ship and how strong that support is.

### Expansion

16. As a player, I want to compare colonies so I can decide which one should specialize and which one should expand support functions.
17. As a player, I want surveyed worlds to feel like future colony candidates rather than just map objects.

## UX Principles

### 1. One screen should answer one class of question

- colony detail = "what is happening here?"
- colony overview = "how do my colonies compare?"
- founding flow = "should I create a colony here?"

### 2. Bottlenecks must be visible

If a colony is weak because of:

- no workers
- no labs
- no construction capacity
- poor stockpiles
- no survey deposits

the UI should say so directly.

### 3. Infrastructure first, flavor second

The first colony interfaces should prioritize:

- comprehension
- actionability
- throughput

over decorative complexity.

### 4. Use Aurora's structure, not Aurora's friction

Good Aurora-inspired elements:

- colony-local build and research
- explicit project queues
- labs and build capacity as real infrastructure

Bad Aurora-inspired elements to avoid right now:

- sprawling dense spreadsheets
- too many hidden prerequisites
- too many clicks to start or reprioritize work

## Screen Plan

## 1. Colony Detail Panel

**Status:** Exists in first-pass form inside the existing body info panel.

**Purpose:** Primary management surface for an individual colony.

**Must show:**

- colony identity
- population
- available vs used workforce
- staffing ratio
- major quality values
- stockpiles
- installation counts
- active construction projects
- active research project
- queued research
- completed starter techs

**Current direction:** Keep this embedded in the body info panel until colony count grows enough to require a broader empire-management surface.

**Future additions:**

- warnings
- build costs in stockpiled resources
- current bottleneck explanation
- local specialization tags

## 2. Empire Colonies Overview

**Status:** Needed next.

**Purpose:** Compare all colonies in one place.

**Why it matters:** Once the player has Earth plus at least one or two more colonies, clicking bodies individually becomes poor management UX.

**Must show:**

- colony name
- population
- workforce used / available
- mines
- labs
- construction factories
- shipyards
- active construction
- active research
- warning state

**Desired behavior:**

- clicking a row focuses/selects that colony in the main view
- red/yellow state indicators surface bottlenecks fast

## 3. Colony Founding Flow

**Status:** Needed after current loop is stable.

**Purpose:** Turn surveyed worlds into actual economic choices.

**Must show:**

- target body
- colony viability summary
- initial setup package or default starter loadout
- founding cost
- resulting starter infrastructure

**Can start as:** a small inline panel in body info, not a full separate screen.

## 4. Research Browser

**Status:** Embedded in colony detail for now.

**Purpose:** Show research options clearly enough that the player can make intentional long-term choices.

**Current requirement:** A simple embedded list is enough.

**Later expansion:**

- categories
- completed tech archive
- prerequisites
- colony research comparison

## 5. Construction Browser

**Status:** Embedded in colony detail for now.

**Purpose:** Show installable structures and colony development priorities.

**Current requirement:** Project entry, allocation, progress, queue controls.

**Later expansion:**

- worker impact
- resource cost
- prerequisites
- "recommended next build" hints

## Milestone UX Backlog

### Milestone A: Make current colony panel solid

- Auto-refresh colony panel while selected
- Show clearer bottleneck indicators
- Show projected gains from starter techs/installations
- Show worker impact for each buildable installation

### Milestone B: Add empire colony overview

- New panel listing all colonies
- Quick comparison of capacities and bottlenecks
- Fast navigation to selected colony

### Milestone C: Add colony founding flow

- Found colony from surveyed body
- Show default starter package
- Show founding constraints

### Milestone D: Improve alerts and feedback

- construction complete
- research complete
- colony understaffed
- no active research
- no active construction
- colony low on critical stockpiles

## UX Acceptance Criteria

The colony UX is good enough for this stage when:

1. A new player can select Earth and understand its current role within a few seconds.
2. A player can queue a construction project without external explanation.
3. A player can start research and understand how lab count affects progress.
4. A player can tell whether a colony is mining effectively.
5. A player can understand why their fleet servicing is fast or slow.
6. Once multiple colonies exist, the player has a screen to compare them without map-clicking each one.

## Immediate Next UX Work

The next highest-value UX surface is:

**Empire Colonies Overview**

Reason:

- the single-colony panel is enough for Earth-only play
- the moment expansion begins, comparison becomes the dominant player need

That screen should be built before any major deepening of colony mechanics.
