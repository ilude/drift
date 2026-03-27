# Aurora 4X — Early Game Player Flow Reference

Source: [7w1 Tutorial Series](https://7w1.github.io/)

This documents the actual player experience flow through the first hours of Aurora 4X gameplay, from game creation through first survey missions. Relevant for informing Drift's early game design — what works, what's tedious, and where the friction lives.

---

## Phase 1: Game Creation (Tutorial 1)

### Steps
1. Settings → New Game
2. Name the game, optionally tweak research speed and NPC generation
3. Create race: name empire + homeworld, pick naming themes (systems, ships, ranks, characters)
4. Select "Conventional Empire" mode (starts pre-TN, must research Trans-Newtonian tech)
5. Cosmetic: flags, portraits
6. Enable Events display window — critical for monitoring game happenings
7. Import event color presets (CSV) for readability

### Observations
- **Multi-monitor recommended** — tutorial explicitly says "have a second monitor or be ready to alt-tab frequently." Aurora's UI is spread across many windows.
- **Event coloring** is a manual CSV import step. The default colors are hard to parse. This is a UX failure Drift should avoid — event categories should be visually distinct by default.
- **Conventional vs TN start** is Aurora's biggest early decision. Conventional means you start without space capability and must research your way to it. This is the "factory must grow" hook.

---

## Phase 2: Initial Economy Setup (Tutorial 2)

### Industry Tab — First Actions
1. Queue construction of **Military Academies** to generate officers, scientists, and administrators
2. This is the player's first interaction with the production queue

### Research Tab — First Research
1. Open Research window
2. Select Construction/Production category
3. Begin researching **Trans-Newtonian Technology** — the gateway tech to space
4. If no scientist matches the needed field, player must:
   - Open Commanders window → Scientists list
   - Manually reassign a scientist's specialization via confirmation popup
5. This is a **4-click deep workflow** for what should be a simple action

### Shipyard Tab — Capacity Upgrades
1. Upgrade naval shipyard to 10,000 tons
2. Upgrade commercial shipyard to 50,000 tons
3. These are prerequisite capacity increases for building ships later

### Governor Assignment
1. Assign colony governor with production/mining/wealth bonuses
2. Governor selection popup shows available candidates and their bonus types

### Key Friction Points
- **Scientist reassignment** is buried deep — new players often don't realize they need to do this
- **Shipyard upgrades** are fire-and-forget but take real game time — the player queues them and then waits
- **Governor assignment** is easy to miss entirely — the game doesn't prompt for it
- **Everything is a separate window** with separate tabs. No unified "here's what you should do next" flow

---

## Phase 3: Research & Engine Development (Tutorial 3)

### Academy Optimization
1. Open Race menu → Academies tab
2. Set **Training Level** to 4 or 5 — fewer but higher-quality officers
3. This is a quality-vs-quantity tradeoff: fewer graduates, but each is more skilled

### Time Advancement
- Aurora uses a hybrid turn/real-time system: 5-day ticks for economy/research, down to 30-second/5-second increments for combat
- Enable **Automated Turns** so the game auto-advances until an event fires
- Hit **5 Days** repeatedly — game pauses on each research completion event

### Research Flow: TN Tech → Engine
1. TN Tech completes (queued in Phase 2)
2. Open Research → **Power and Propulsion** category
3. Required: **Radioisotope Thermal Generator** (prerequisite for first nuclear engine)
4. Optional but recommended: **Fuel Consumption 0.9** (efficiency) and **Minimum Engine Power 0.4x** (allows lower power = better fuel economy)
5. Queue all three using **Add to Queue** button
6. Wait for completion, then queue **Nuclear Radioisotope Engine**
7. After engine tech completes, open **Create Project** window to design the actual engine component

### Engine Design (First Custom Component)
The Create Project window has 5 areas:
1. **Project type** selector (Engine, Missile, etc.)
2. **Options** for that project type
3. **Naming** (company name + project name, cosmetic only)
4. **Stats preview** showing projected performance
5. **Actions**: Create, Prototype, random Company Name, plus Missile/Turret/Ground Unit designers

For survey ships: select **Nuclear Radioisotope Engine**, choose most **fuel-efficient** options (lowest fuel consumption). Speed doesn't matter for surveyors — range does.

After creating the engine design, it appears as a researchable project. Queue it, wait for completion.

### Recommended Research Queue
**Construction/Production:** Research Rate 240 RP (speeds all future research), Construction Rate 12 BP
**Logistics:** Cargo Hold - Large, Fuel Storage - Large, TN Cargo Shuttles
**Power/Propulsion:** Pressurised Water Reactor (next engine tier prerequisite), more fuel efficiency
**Sensors:** Science Department (ship science boost), **Geological Survey Sensors** (REQUIRED for survey ships)

### Key Observations
- **The research tree is the first real decision space** — player chooses what to prioritize with limited scientists
- **Scientist specialization matching** is the bottleneck — wrong specialty = can't research that category
- **Engine design is Aurora's first taste of component design** — the Create Project window is where ship design depth begins
- The tutorial explicitly says "this engine will suck" — first engine tier is intentionally weak, teaching the design flow on a low-stakes component
- **"Aurora 4x is a game with tons of playstyles"** — the tutorial diverges here, offering recommended but optional paths. This is where player agency begins
- Only **Geological Survey Sensors** is strictly required for the next phase — everything else is optimization

---

## Phase 4: Ship Design & Construction (Tutorial 4)

### Industry Conversion (Pre-construction)
Before building ships, player must convert conventional industry into specialized TN facilities:
- **Construction Factories** (~50% of capacity) — build things
- **Fuel Refineries** (15%, ~60 units) — produce Sorium fuel
- **Mines** (35%, ~140 units) — extract minerals
- Optional: convert some to automated variants for future off-world use

This is a **permanent, irreversible resource allocation decision** with no clear guidance on ratios.

### Shipyard Preparation
- Expand commercial shipyard capacity
- Add multiple slipways to military shipyard for concurrent construction
- Slipway count determines how many ships can build simultaneously

### Survey Ship Design — Component Selection
Required components:
- At least one **engine**
- One **Geological Survey Sensor** (the whole point of the ship)
- **Engineering Spaces** (improve maintenance life)
- **Maintenance Storage Bay** (supply capacity for long deployments)
- **Fuel Storage** (standard or large variants)

### Critical Design Metrics
- **Maintenance Life** must exceed intended deployment duration
- **MSP (Maintenance Supply Points)** capacity should support multi-year missions
- **Fuel range** of ~157.8 billion km recommended for exploration beyond Earth orbit

### Construction
1. Retool military shipyard for the new design
2. Queue construction via Shipyards tab
3. Monitor progress — retooling itself takes time before construction begins

### Design Observations
- **Ship design is Aurora's deepest early-game system** — there are dozens of component choices with interacting tradeoffs (speed vs range vs maintenance vs sensor capability)
- **No templates or presets** — every new player designs from scratch with no guidance on what "good" looks like
- **Metrics are numbers, not visualizations** — maintenance life is "4.2 years" in a text field, not a bar or gauge
- **14 screenshots** needed just to walk through the design window — this is where Aurora's complexity budget is heavily spent
- The interplay between engine choice → fuel consumption → range → deployment time → maintenance needs is genuine depth, but the UI makes it feel like homework

---

## Phase 5: Surveying (Tutorial 5)

### Naval Organization
1. Detach survey ships from the default Survey Fleet
2. Create an **admin command** labeled "Survey Command"
3. Assign ships to the new command structure
4. Appoint commanders with survey-focused boosts
5. Enable automated assignments for admin commands

### Standing Orders — The Core Survey Loop
- Survey nearest planets and moons first
- Queue **thirty system bodies** for surveying simultaneously
- Refuel when reserves drop below 30%
- Reset deployments after 48 months at colonies
- Scanned locations show a white circle indicator

### Resource Analysis
- Analyze survey results through Economics window → Mining section
- Examine: production rates, depletion timelines, stockpile levels
- Use Minerals window to filter deposits by resource type
- Filter by **accessibility ratings** to identify optimal mining locations

### Colony Establishment
- Create colonies at high-value asteroid/body locations
- Enable automated mining operations
- This is the payoff of the entire survey pipeline

### Research Queue (Recommended Next Techs)
- Nuclear Thermal Engine (better propulsion)
- Trans-Newtonian Cargo Shuttles
- Various storage upgrades

### Survey Observations
- **Standing orders ARE Aurora's version of Drift's command tree** — priority-ordered conditional behaviors
- The "queue 30 bodies" pattern reveals that survey is tedious without automation
- **Refuel threshold + deployment reset** are the two key logistics constraints the player manages
- **Accessibility ratings** as a filter for mining decisions is a good design — it creates a quality-vs-quantity tradeoff
- Survey → Resource discovery → Colony placement is the core early-game progression chain

---

## Synthesis: Early Game Flow Summary

```
Game Setup → Economy Bootstrap → Research → Ship Design → Construction → Survey → Colonize
   (1 min)     (5 min)          (wait)     (30 min)       (wait)         (ongoing)  (ongoing)
```

### What Aurora Gets Right
1. **Systems chain** — each phase feeds the next. Research enables design, design enables construction, construction enables survey, survey enables colonization.
2. **Ship design as a deep decision space** — component tradeoffs create genuine depth (speed vs range vs maintenance)
3. **Standing orders** — conditional automation that reduces micro without removing decisions
4. **Accessibility as a resource quality axis** — not just "how much" but "how easy to get"
5. **Conventional start** creates a "factory must grow" hook — you earn space capability, not start with it

### What Aurora Gets Wrong (Drift Should Avoid)
1. **Window soup** — every subsystem is a separate window. No unified dashboard or flow guidance.
2. **Buried critical actions** — scientist reassignment is 4 clicks deep; governor assignment is easy to miss entirely
3. **No design guidance** — ship design has no templates, presets, or "good enough" starting points. New players are overwhelmed.
4. **Waiting as gameplay** — shipyard retooling, construction, research all involve "advance time and check back." The interesting decisions are front-loaded, then you wait.
5. **Numbers without context** — "maintenance life: 4.2 years" means nothing to a new player. No visual indicators, no warnings, no comparisons.
6. **Manual naval organization** — creating admin commands and detaching ships is bureaucratic overhead with no strategic depth
7. **Industry conversion ratios** — permanent early decision with no undo and no guidance. Classic trap for new players.

### Implications for Drift
- Drift's **command tree** already solves the standing orders problem more elegantly than Aurora
- The **early game factory loop** (from `game-vision-early-game.md`) maps well to Aurora's Phase 2
- Ship design should offer **templates with customization** rather than blank-slate design
- Survey results should flow directly into colony placement decisions without window-switching
- Industry allocation should be **adjustable, not permanent** — let players learn and correct
- Research should have visible progress and clear "what unlocks what" visualization
