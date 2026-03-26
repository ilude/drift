# Aurora 4X: Colony-Based Research Infrastructure — Player Experience Reference

## Overview

Research in Aurora 4X is deeply intertwined with colony economics. It is not a separate system you manage in isolation — it competes directly with industrial output, population allocation, and mineral consumption. Every research lab built is a factory not built. Every million population staffing labs is a million not operating mines. This tension is the core design achievement of Aurora's research system.

---

## 1. Research Lab Mechanics

### The Basics

- Each Research Lab produces the empire's **base research rate** in RP/year (starts at 200 RP/year, upgradeable).
- Labs cost **1,200 Duranium + 1,200 Mercassium** each to construct.
- Each lab requires **1 million population** to operate — 20x what a factory or mine needs (50K each).
- Labs have a mass of **500,000 tons** (20x a normal installation), making them expensive to transport off-world.
- Default game start: **20 labs** on Earth.

### Competition with Other Installations

Labs compete for three scarce resources simultaneously:

| Resource | Research Lab | Construction Factory | Mine |
|----------|-------------|---------------------|------|
| Population per unit | 1,000,000 | 50,000 | 50,000 |
| Build cost (Duranium) | 1,200 | 120 | 120 |
| Build cost (Mercassium) | 1,200 | — | — |
| Mass (tons) | 500,000 | 25,000 | 25,000 |

One research lab = 20 factories or 20 mines in population consumption. This ratio is the fundamental constraint on research expansion.

### When Do Players Build Labs?

- **Early game:** The 20 starting labs are sufficient for initial research. Players prioritize factory construction for exponential industrial growth.
- **Common advice:** Reserve at least 5% of industrial capacity for building new labs at all times. This ensures steady growth without crippling factory/mine output.
- **Typical early ratios:** Heavy factory-first (70-80% of construction), with labs as a steady trickle. Mines built to keep mineral income ahead of consumption.
- **Mid game:** Once factory count is high enough for comfortable growth, lab construction percentage increases. Players often bump lab construction to 10-20% or do targeted batches (e.g., "build 20 more labs at 30% capacity, then stop").

### Population as the Binding Constraint

If total installation requirements exceed available workforce, **all** installations lose efficiency proportionally. Overbuilding labs can tank factory and mine output across the entire colony. Players must watch the workforce efficiency percentage — dropping below 100% means everything slows down, not just research.

---

## 2. Scientist Assignment Workflow

### The Player Experience, Step by Step

1. **Open the Economics Screen** (F2) and navigate to the **Research tab**.
2. **Left panel:** Select a research category (one of 9 fields) to filter available technologies.
3. **Center panel:** Browse the available technologies. Each shows its RP cost. Partially completed techs show remaining/total RP (e.g., "3200/5000 RP").
4. **Right panel:** List of available scientists showing their **specialty field**, **bonus percentage**, and **max labs** they can control.
5. **Assign labs:** Set the number of labs in the allocation field (cannot exceed 5x the scientist's admin rating).
6. **Click "Create"** to start the project.

### Multiple Simultaneous Projects

Yes — each scientist runs one project independently. With 6 scientists, you can have 6 projects running simultaneously, each drawing from the colony's pool of unassigned labs. The constraint is total labs available: if you have 40 labs and 3 scientists each using 15, that is 45 — you cannot assign that many. Labs are a shared pool.

### What Happens When a Scientist Finishes

- If the scientist has a **research queue**, they automatically start the next queued project with the same lab allocation. No player intervention needed.
- If no queue exists, the **labs become idle** (returned to the unassigned pool) and the scientist is free. The player must manually assign them to a new project.
- This is a common source of wasted time for inattentive players. Experienced players always queue at least one follow-up project.

### Scientist Retirement and Loss

When a scientist retires or passes away, their project is cancelled. Labs are freed. Crucially, **progress is not lost** — the partially completed technology appears in the available research list with remaining RP shown. A new scientist can pick it up, but they must create a fresh project on the same colony to resume it.

### Changing a Scientist's Field

Via the Commanders screen, you can retrain a scientist to a different specialty — but they lose **75% of their research bonus**. A 20% bonus scientist retrained drops to 5%. They can rebuild over time through active research. This is a last resort when you have no scientists in a critical field.

---

## 3. The Admin Rating / Max Labs Tradeoff

### The Formula

- **Max Labs = 5 x Admin Rating**
- Admin rating 3 = 15 max labs
- Admin rating 9 = 45 max labs

### The Core Tradeoff in Practice

**Scenario A: High bonus, low admin**
- Scientist: 25% bonus, admin rating 3 (15 max labs), in-field specialty
- In-field bonus is quadrupled: 25% x 4 = 100% effective bonus
- Effective output: 15 labs x 2.0 multiplier = **30 equivalent labs**

**Scenario B: Moderate bonus, high admin**
- Scientist: 10% bonus, admin rating 9 (45 max labs), in-field specialty
- In-field bonus quadrupled: 10% x 4 = 40% effective bonus
- Effective output: 45 labs x 1.4 multiplier = **63 equivalent labs**

Scenario B produces **more than double** the RP despite having less than half the bonus percentage.

**Scenario C: The off-field gambit**
- Scientist: 15% bonus, admin rating 5 (25 max labs), **wrong field** (bonus NOT quadrupled)
- Effective output: 25 labs x 1.15 = **28.75 equivalent labs**

This still beats Scenario A's 30 equivalent labs in raw throughput — and in practice, having a slightly lower bonus scientist who can command 25 labs often beats a specialist who can only use 5-15.

### When Each Strategy Wins

- **High-bonus specialist (low admin):** Best for cheap technologies that don't need many labs. Also ideal for "training" — give them 1 lab on a long project to level up their stats over time.
- **High-admin generalist:** Best for expensive, urgent technologies. When you need 50,000 RP researched fast, raw lab count dominates.
- **Experienced player optimization:** Use high-admin scientists for expensive critical techs, park low-admin specialists on cheap or long-term projects with fewer labs. Queue training projects for promising junior scientists on single labs.

### Leveling Up Scientists

Scientists improve their bonus and admin rating through active research. Running a scientist on even a single lab on a long project is a proven way to develop them. This creates a "farm team" dynamic — junior scientists doing background research while senior scientists tackle priority projects.

---

## 4. Colony Specialization for Research

### Dedicated Research Worlds

Players absolutely create dedicated research colonies. The key factors:

**What makes a good research world:**
- **Low colony cost** — On a colony-cost-zero world, only 5% of population goes to agriculture. On high-cost worlds, agriculture consumes much more, leaving fewer workers for labs. Ideal is a habitable or near-habitable world.
- **Research anomalies** — Discovered during gravitational surveys. Anomalies provide a 10-100% bonus to a specific research category when research is conducted on that body. This bonus **multiplies** with the scientist's bonus, creating massive RP output.
- **Sufficient population** — Labs need 1M pop each. A 50-lab research colony needs at least 50M population, plus overhead.

**Anomaly stacking example:**
- Body has a 50% anomaly in Energy Weapons
- Scientist has 25% bonus, specializes in Energy Weapons (quadrupled to 100%)
- Combined: the multiplicative bonus makes those labs far more productive than equivalent labs on Earth
- This can justify the logistics cost of establishing an otherwise unnecessary colony

### The Anomaly Discovery Loop

1. Build and deploy gravitational survey ships
2. Survey system bodies — anomalies are discovered during surveys
3. Find a high-value anomaly (50%+ in a field you need)
4. Decide: is it worth colonizing this body just for research?
5. Transport population, infrastructure, and labs to the body
6. Assign a specialist scientist to projects in the anomaly's field

This loop creates emergent gameplay where survey results directly influence colonial strategy.

---

## 5. Research vs. Other Colony Needs

### The Opportunity Cost Matrix

Building 10 research labs costs:
- 12,000 Duranium + 12,000 Mercassium
- 10 million population to operate
- Construction capacity that could have built 100 factories or 100 mines instead

Those 100 factories would produce 1,000 Build Points/year (at base rate), accelerating everything else. Those 100 mines would produce minerals to fuel future construction.

### The Compounding Problem

Factories compound — more factories = more build capacity = faster construction of everything (including labs). Building labs early slows factory growth, which slows everything downstream. This is why experienced players front-load factory construction.

However, research also compounds: the "Research Rate" technology (under Construction/Production) increases base RP per lab. Researching it early means all future research is faster. This creates a classic explore-exploit tension.

### Mineral Competition

Labs consume Mercassium, which is relatively uncommon. Factories need only Duranium (abundant). Building many labs can deplete Mercassium reserves, which are also needed for sensors and other components. Players must monitor mineral stockpiles.

### Automated Mines as Pressure Relief

Automated Mines require no population (but cost 2x to build). Using them to replace manned mines frees population for labs. This is a common mid-game transition: shift mineral extraction to automated mines, freeing workers for research and factory operation.

---

## 6. Multi-Colony Research Networks

### The Critical Rule: Research is Colony-Specific

Labs on different colonies **cannot** contribute to the same research project. A scientist's project draws labs only from the colony where the project was created.

If you cancel a project on Colony A and restart the same technology on Colony B, the progress made on Colony A **does not transfer**. Cancelled research can only be resumed without penalty **at the same colony where it was initiated**.

### Empire-Level Implications

This means research is fundamentally decentralized:
- Earth might have 50 labs running 4 projects simultaneously
- A research outpost on Titan (with a Sensors anomaly) runs 1 project with 15 labs
- A colony on a habitable exoplanet runs 2 projects with 30 labs

Each colony is an independent research node. You cannot pool 100 labs across 3 colonies onto one urgent project.

### Strategic Consequences

- **Concentration is powerful.** Having one large research colony with 80+ labs is more flexible than four colonies with 20 labs each, because you can allocate more labs to urgent projects.
- **Anomalies justify distribution.** A 70% anomaly on a moon of Jupiter is worth a dedicated colony even if it only has 15 labs — those 15 labs produce as much as 25+ labs elsewhere in that specific field.
- **Scientist logistics matter.** Scientists are assigned to colonies. You cannot move a scientist from Earth to Mars mid-project. Planning which scientists work where is an important decision.

---

## 7. Early Game vs. Late Game Research Infrastructure

### Early Game (First ~5 Years)

- **20 starting labs** on Earth, typically with 3-5 starting scientists.
- Research priorities: Trans-Newtonian Technology first (unlocks everything), then Research Rate upgrades, then engines/sensors for survey ships.
- Labs are adequate. The bottleneck is scientist quality (low bonuses, low admin ratings) and having few scientists.
- **Military Academies** are critical — they produce new officers, scientists, and administrators. Building more academies early means more scientists later.
- Most research happens on Earth. No off-world labs yet.
- Tech costs are low (hundreds to low thousands of RP), so even mediocre scientists with few labs finish projects in reasonable time.

### Mid Game (~5-20 Years)

- Lab count on Earth grows to 50-100+.
- Multiple scientists per field become available. Players start optimizing assignments.
- Off-world colonies begin contributing: Luna, Mars, or anomaly-rich bodies.
- Research Rate upgrades compound: 200 -> 240 -> 320+ RP/lab/year.
- Tech costs escalate rapidly (each tier costs roughly 2x the previous). Lab count growth must keep pace.
- Automated mines start freeing population for more labs.
- Governor bonuses (from Civilian Administrators) become significant — a governor with factory or research bonuses improves colony output.

### Late Game (20+ Years)

- Research empires spanning multiple systems. Dedicated research colonies on anomaly-rich bodies.
- Hundreds of labs across the empire. Individual tech costs reach hundreds of thousands of RP.
- Research Rate technology upgrades are essential — without them, late-game techs take decades.
- Scientist development pipeline is mature: junior scientists trained up, senior scientists with high bonuses and admin ratings leading major projects.
- The bottleneck shifts from "not enough labs" to "not enough good scientists" and "tech costs are enormous."
- Colony specialization is fully realized: industrial worlds feed minerals, research worlds produce RP, shipyard worlds build fleets.

---

## 8. The Research Queue / Project Management UI

### Research Tab Layout (F2 -> Research)

The Economics Screen's Research tab is the primary interface. It contains:

1. **Category filter** (top) — Radio buttons for the 9 research categories, plus an option to show all. Can also filter the scientist list to show only those specializing in the selected category.
2. **Available Research list** (center-left) — Technologies available for research. A filter toggles between: Available, All Projects, Completed, and Completed (ex Start).
3. **Current Research Projects** (top area) — Active projects showing scientist name, technology, labs assigned, RP progress, and estimated completion.
4. **Scientist list** (right) — All available scientists with specialty, bonus %, and max labs.
5. **Lab allocation** (between panels) — Numeric field for how many labs to assign. Shows total and unassigned labs.
6. **Queue controls** (bottom-right) — Queue and Queue Top buttons, plus reordering arrows and Remove.

### Project Management Workflow

**Creating a project:**
1. Select category filter (or "All")
2. Click a technology from the available list
3. Click a scientist from the scientist list
4. Set lab count in the allocation field
5. Click "Create"

**Queuing follow-up research:**
1. Select an active project (highlights the scientist)
2. Select a new technology from the available list
3. Click "Queue" (adds to end) or "Queue Top" (adds to front)
4. When the current project finishes, the scientist automatically starts the queued project with the same lab allocation

**Adjusting a running project:**
- **Add RL:** Adds more labs from the free pool (if scientist's max allows)
- **Remove Labs:** Returns labs to the free pool
- **Pause:** Stops RP generation and wealth cost, but does NOT free the scientist or labs
- **Cancel:** Stops the project entirely, frees scientist and labs, preserves partial RP progress on the technology

### Pause vs. Cancel vs. Shutdown

| Action | Frees Scientist | Frees Labs | Frees Population | Preserves Progress | Restart Delay |
|--------|----------------|------------|-----------------|-------------------|---------------|
| Pause | No | No | No | Yes (in place) | None |
| Cancel | Yes | Yes | Yes | Yes (resumable on same colony) | None |
| Mass Shutdown (Ind Status tab) | Yes | Yes | Yes | Preserves per-tech | **6 months** warm-up |

Pausing is for temporary holds. Cancelling is for reassigning resources. Mass shutdown is for emergencies (freeing population for other industries at the cost of a 6-month restart delay).

### The C# Version Improvements

The C# rewrite of Aurora improved the research UI by integrating the research queue into the same list as current projects, and displaying more information per project including the total effective modifier (scientist bonus + specialization multiplier + anomaly bonuses).

---

## 9. The Nine Research Categories

1. **Biology / Genetics** — Terraforming, environmental adaptation, genetic manipulation
2. **Construction / Production** — Research Rate upgrades, factory output, mine output, Trans-Newtonian Technology
3. **Defensive Systems** — Armor, shields, ECM
4. **Energy Weapons** — Lasers, particle beams, turret tracking
5. **Logistics / Ground Combat** — Crew quarters, troop transport, engineering brigades, supply
6. **Missiles / Kinetic Weapons** — Missile launchers, warheads, gauss cannons, hangars
7. **Power / Propulsion** — Engines, fuel efficiency, reactors, jump drives
8. **Sensors / Fire Control** — Active/passive sensors, fire control, gravity sensors
9. *(The ninth category varies by source — often identified as a subdivision or overlap)*

Each scientist specializes in one category. Working in-field quadruples their bonus; working out-of-field applies the raw bonus only.

---

## Key Design Takeaways for Drift

### What Aurora Gets Right
- **Research is not free.** It competes meaningfully with industrial and military needs for the same scarce resources (population, minerals, construction capacity).
- **Scientists are not interchangeable.** The bonus/admin tradeoff, field specialization, and leveling system make scientist management a genuine mini-game.
- **Colony placement matters for research.** Anomalies create real reasons to establish research outposts on specific bodies.
- **Research is colony-local.** This prevents trivial pooling and forces distributed planning.
- **Queue system respects player time.** Auto-transitioning between queued projects reduces busywork.

### What Aurora Gets Wrong (Player Pain Points)
- **Extreme micromanagement.** Managing 8+ scientists across multiple colonies with different specialties, tracking who finishes when, reassigning labs — it is spreadsheet-heavy.
- **Scientist death/retirement is punishing and random.** Losing your best Propulsion scientist mid-project to random retirement is frustrating with no counterplay.
- **No cross-colony pooling at all.** Realistic but restrictive — players often wish they could route labs from nearby colonies to the same project.
- **The UI is dense.** Even the C# version requires significant mental overhead to parse the research tab effectively.
- **Population math is opaque.** Understanding when you have "enough" population for your labs + factories + mines requires manual calculation.

Sources:
- [Research - AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Research)
- [Research Lab - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Research_Lab)
- [Leaders - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Leaders)
- [Population and Production - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Population_and_Production)
- [Installations - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Installations)
- [Aurora 4x Tutorial Part 2 - Gameplay](https://7w1.github.io/posts/tutorial2/)
- [Aurora 4x Tutorial Part 3 - Research and Engines](https://7w1.github.io/posts/tutorial3/)
- [Quickstart for Beginners - Aurora4x Wikia](https://aurora4x.fandom.com/wiki/Quickstart_for_Beginners)
- [Research | Aurora4x Wikia](https://aurora4x.fandom.com/wiki/Research)
- [One Newbie's Guide to a Conventional Start - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=One_Newbie's_Guide_to_a_Conventional_Start)
- [Sufficient Velocity - Aurora 4X Discussion](https://forums.sufficientvelocity.com/threads/aurora-the-dwarf-fortress-of-4x-games.44387/)
- [Naval Gazing - Aurora Tutorial Part 1](https://www.navalgazing.net/Aurora-Tutorial-Part-1)
- [Aurora 4X Forum - Research and Surplus Scientists](https://aurora2.pentarch.org/index.php?topic=11348.0)
- [Aurora 4X Forum - Slowing Down Research](http://aurora2.pentarch.org/index.php?topic=11432.0)
