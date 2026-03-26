# Aurora 4X Research & Tech Tree Reference

Game design reference document for Aurora 4X's research mechanics, technology progression, and scientist system. Based on the C# version of Aurora 4X by Steve Walmsley.

---

## 1. Research Categories (9 Fields)

All research in Aurora is divided into 9 specialist categories. Each scientist specializes in exactly one.

| # | Category | Key Technologies |
|---|----------|-----------------|
| 1 | **Biology / Genetics** | Genome sequencing, terraforming rate, colonization cost reduction, genetic modification |
| 2 | **Construction / Production** | Trans-Newtonian Technology (master unlock), research rate upgrades, construction rate, mining production, fuel production, shipbuilding rate, shipyard operations, asteroid mining, sorium harvesters, expand civilian economy |
| 3 | **Power & Propulsion** | Reactor tiers, engine types, fuel efficiency, jump drives, jump gates, hyper drives, power efficiency, capacitor recharge rate, FAC/fighter engines, missile drives |
| 4 | **Sensors & Fire Control** | Active grav sensors, EM sensors, thermal sensors, geological/gravitational survey sensors, beam fire control range/speed, planetary sensors, tracking time bonus |
| 5 | **Defensive Systems** | Armor tiers, shield tiers, shield regeneration, cloaking, damage control, stealth/thermal reduction, ECM |
| 6 | **Missiles / Kinetic Weapons** | Missile warheads, missile agility, launcher reload rate, magazine systems, railguns, gauss cannons, ordnance production, reduced-size launchers |
| 7 | **Energy Weapons** | Laser focal size/wavelength, meson cannons, particle beams, plasma carronades, microwaves, turret tracking, energy weapon mounts (spinal/advanced spinal), reduced-size lasers |
| 8 | **Logistics / Ground Combat** | Cargo handling, fuel storage, crew quarters, troop transport, colony ships (cryogenic transport), maintenance modules, salvage, tractor beams, ground unit types/strength, flag bridge, command modules, orbital habitats, boat bays |
| 9 | **Electronic Warfare** | ECM, ECCM, electronic hardening, compact ECM |

**Note:** Some sources group categories slightly differently (e.g., Kinetic Weapons sometimes separated from Missiles). The exact grouping can vary between VB6 and C# versions.

---

## 2. Research Mechanics

### 2.1 Research Labs

- **Base output:** 200 RP/year/lab (upgradeable via "Research Rate" tech)
- **Build cost:** 1,200 Duranium + 1,200 Mercassium per lab
- **Population requirement:** 1 million population to operate each lab
- **Mass:** 500,000 tons per lab (20x a normal industrial installation)
- **Starting count:** 20 labs by default (configurable at game creation)
- **Game tick:** Research (and industry) processes on 5-day increments

### 2.2 The RP Formula

```
Annual RP = Base_Rate × Num_Labs × (1 + Effective_Bonus)
```

Where:
- `Base_Rate` starts at 200 RP/year/lab, increased by Research Rate tech
- `Num_Labs` is labs assigned to the project (capped by scientist's max labs)
- `Effective_Bonus` is the scientist's bonus percentage (quadrupled if in-specialty)

**Example:** 20 labs, 200 RP base, scientist with 10% bonus:
- Off-specialty: 200 x 20 x 1.10 = **4,400 RP/year**
- In-specialty: 200 x 20 x 1.40 = **5,600 RP/year**

**Example:** Scientist with 25% bonus in-specialty:
- 25% x 4 = 100% effective bonus = **double the base rate**

### 2.3 Ways to Increase RP Generation

1. **Build more labs** — Linear scaling, each lab adds base rate
2. **Better scientists** — Higher bonus percentage, quadrupled in-specialty
3. **Research Rate tech** — Increases base RP/lab/year (cascading effect on everything else)
4. **Anomalies** — 10-100% bonus in one research area, found during gravitational surveys, requires colony with labs on that body. Multiplies with scientist bonus
5. **Reverse engineering** — Disassemble alien/ruin components; each gives 1-5% of RP needed for next tech level in that area

### 2.4 Cost Scaling

**The cost doubles every level within a tech line.** There appears to be no maximum level. This means:
- Early techs: hundreds to low thousands of RP
- Mid-game techs: tens of thousands of RP
- Late-game techs: hundreds of thousands of RP

This doubling creates exponential cost growth that must be offset by Research Rate upgrades, more labs, and better scientists.

---

## 3. Scientists as a Resource

### 3.1 Attributes

Each scientist has:
- **Specialization** — One of the 9 research categories
- **Bonus** — A percentage (e.g., 10%, 15%, 25%) applied to RP generation. Quadrupled when working in-specialty
- **Administration Rating** — Determines max labs: `max_labs = admin_rating x 5` (ranges from 5 to 45+, always a multiple of 5)
- **Additional bonuses** — May have Administration, Research, Survey, Xenoarchaeology bonuses

### 3.2 The Specialization Quadruple

This is the single most important mechanic for research efficiency:
- A scientist working **in their specialty field** has their bonus **quadrupled**
- A 25% Energy Weapons specialist researching lasers: 25% x 4 = 100% bonus (double RP rate)
- A 10% specialist in-field: 10% x 4 = 40% bonus
- You almost never want to use a scientist outside their specialty long-term

### 3.3 Bonus vs. Max Labs Tradeoff

The highest-bonus scientist is not always the best choice:
- A 30% bonus scientist who can only manage 10 labs may produce less total RP than a 15% bonus scientist managing 30 labs
- For urgent, high-priority projects: maximize total RP (favor more labs)
- For long-term projects: a high-bonus scientist with fewer labs may be efficient enough

### 3.4 Training and Improvement

- Scientists **gain skills passively** while actively assigned to a research project
- Even assigning a single lab to a scientist gives them a chance to improve their bonus or max labs over time
- "Parking" promising young scientists on minor projects is a viable training strategy
- Improvement is probabilistic and slow

### 3.5 Changing Specialization

- You can reassign a scientist to a different specialty
- This **cuts their bonus by 75%** (e.g., 20% becomes 5%)
- Any improvements after the change are fully effective
- Best done with scientists at the bottom of their current field (lowest bonus)
- Generally not worthwhile unless you have a severe shortage in a category

### 3.6 Death and Retirement

- **Scientists can die** from poor health, combat, or accidents
- **Minimum retirement:** 40 years of service for scientists and administrators
- **Retirement chance:** 20% per year beyond minimum retirement date
- **Doubled retirement chance** if the scientist has no current assignment
- **Per-increment check:** `(Increment_Length / One_Year) x Retirement_Chance`
- **Story Character flag:** Prevents death, accidents, and retirement (cheat/RP tool)

### 3.7 Academy Training

- Scientists graduate from military academies
- Academy commandant quality affects graduates:
  - If commandant has 20%+ in any bonus: graduates take two rolls per qualifying bonus, keep the higher
  - If commandant is a scientist: 25% chance graduates share their specialization
  - Otherwise specialization is random
- Academy training level (4 or 5) affects officer quality generally

### 3.8 Scarcity

Scientists are a genuinely scarce resource:
- You get a limited pool, generated over time
- High-bonus specialists are rare
- Losing a top scientist to retirement or death mid-project is a real setback
- You cannot mass-produce scientists; they come from academies at a natural rate
- Surplus scientists with poor stats are common; elite scientists are precious

---

## 4. Tech Tree Structure

### 4.1 The Trans-Newtonian Unlock

**Trans-Newtonian Technology** is the master unlock for the entire tech tree. In a TN-start game (default), you begin with it already researched. In a conventional start, researching it is the first priority.

TN Technology unlocks:
- Geological Survey Sensors
- Infrared Laser
- Large Fuel Tank
- Pressurized Water Reactor
- Terraforming Module
- Implosion Fission Missile Warhead
- Research Rate +20% (i.e., Research Rate 240 RP)
- Grav Sensor Strength 10
- And nearly everything else in the game

### 4.2 Prerequisite Chains

Technologies form prerequisite chains within categories. Key chains include:

**Reactor → Engine progression (Power & Propulsion):**
```
Radioisotope Thermal Generator
  → Pressurized Water Reactor
    → Nuclear Thermal Engine
      → Improved Pressurized Water Reactor
        → Improved Nuclear Thermal Engine
          → Pebble Bed Reactor
            → Nuclear Pulse Engine
              → Gas-Cooled Fast Reactor
                → Ion Engine
                  → Stellarator Fusion Reactor
                    → Magneto-Plasma Drive
                      → [higher fusion reactors]
                        → Internal Confinement Fusion
                          → Magnetic Confinement Fusion
                            → Inertial Confinement Fusion
                              → Solid Core Antimatter
                                → Gas Core Antimatter
                                  → Beam Core Antimatter
                                    → Photonic Drive
```

**Armor progression (Defensive Systems):**
```
Conventional Armour (strength 3)
  → Duranium Armour (strength 5) [free with TN start]
    → High Density Duranium Armour (strength 6)
      → Composite Armour
        → Ceramic Composite Armour (strength 10)
          → Laminate Composite
            → [further tiers]
```

**Shield progression (Defensive Systems):**
```
Alpha Shields [free with TN start]
  → Beta Shields
    → Gamma Shields (cost: 4,000 RP)
      → Delta Shields
        → [further Greek letter tiers]
Shield Regeneration Rate: 1 → 1.5 → 2 → ...
```

**Warhead progression (Missiles/Kinetic):**
```
Implosion Fission Warhead: 3x MSP [free with TN start]
  → Levitated-Pit Implosion: 4x MSP
    → Boosted Fission: 5x MSP (8,000 RP)
      → [further tiers, damage scaling by squares: 4, 9, 16, 25...]
```

**Jump Drive chain (Power & Propulsion):**
```
Jump Point Theory
  → Jump Drive Efficiency 3 → 4 (4,000 RP) → ...
  → Max Jump Squadron Size 3 → 4 (4,000 RP) → ...
  → Max Squadron Jump Radius 50k → 100k (2,000 RP) → ...
  → Hyper Drive Size Multiplier (2,000 RP)
```

### 4.3 Research vs. Manufacturing (Two-Step Process)

Researching a technology gives you **scientific understanding**, not a usable component. After researching a base tech (e.g., "Ion Engine Technology"), you must:

1. **Design** a specific component (e.g., an Ion Engine with specific size, power, fuel consumption parameters)
2. **Develop** (research) that specific design (costs a few hundred to a few thousand RP, scaling with component size)
3. **Build** the component in shipyards/factories

This two-step system means researching a tech tier doesn't immediately give you better ships -- you need to design, develop, and then build vessels using the new tech.

### 4.4 Cross-Category Dependencies

While most techs live within one category, there are important cross-category relationships:

- **Capacitor Recharge Rate** (Power & Propulsion) affects all energy weapons' rate of fire
- **Reactor tech** (Power & Propulsion) gates engine tiers, which affect everything
- **Research Rate** (Construction/Production) improves all research across all categories
- **Fire Control Range/Speed** (Sensors) determines effective weapon range regardless of weapon tech
- **Active sensors** (Sensors) are needed to fire weapons at targets
- Ships need both **weapons** AND **fire controls** AND **sensors** AND **power plants** to function

---

## 5. Specific Research Costs (Known Values)

### 5.1 Construction / Production

| Technology | RP Cost |
|------------|---------|
| Research Rate 240 RP | (early, relatively cheap) |
| Research Rate 280 RP | 10,000 |
| Construction Rate 14 BP | 5,000 |
| Mining Production 14 tonnes | 5,000 |
| Fuel Production 24,000 Litres | 3,000 |
| Fighter Production Rate 12 BP | 3,000 |
| Shipbuilding Rate 560 BP | 4,375 |
| Shipyard Operations 5% Saving | 2,500 |
| Asteroid Mining Module | 5,000 |
| Sorium Harvester | 5,000 |
| Expand Civilian Economy 20% | 5,000 |
| Terraforming Module | 5,000 |
| Terraforming Rate 0.0012 atm | 3,000 |
| Jump Gate Construction Module 180 | 5,000 |

### 5.2 Power & Propulsion

| Technology | RP Cost |
|------------|---------|
| Stellarator Fusion Reactor | 12,000 |
| Fighter Engine | 12,000 |
| Fuel Efficiency 2 (0.8x) | 2,000 |
| Nuclear Pulse Drone Engine | 2,000 |
| Capacitor Recharge Rate 2 | 2,000 |
| Power Efficiency modifiers | 2,000 each |
| Jump Drive Efficiency 4 | 4,000 |
| Max Jump Squadron Size 4 | 4,000 |
| Max Squadron Jump Radius 100k | 2,000 |
| Hyper Drive Size Multiplier 2.0 | 2,000 |
| Engine design (15 HS military) | ~2,100 |
| Engine design (45 HS military) | ~6,300 |

### 5.3 Sensors & Fire Control

| Technology | RP Cost |
|------------|---------|
| Active Grav Sensor Strength 16 | 4,000 |
| EM Sensor Sensitivity 11 | 8,000 |
| Thermal Sensor Sensitivity 6 | 2,000 |
| Planetary Sensor Strength 400 | 5,000 |
| Improved Geological Survey Sensors | 10,000 |
| Improved Gravitational Sensors | 10,000 |
| Beam Fire Control Range 24,000 km | 4,000 |
| Fire Control Speed Rating 3000 km/s | 4,000 |
| Max Tracking Time Bonus 20% | 4,000 |

### 5.4 Defensive Systems

| Technology | RP Cost |
|------------|---------|
| Ceramic Composite Armor | 10,000 |
| Cloaking Theory | 10,000 |
| Damage Control | 4,400 |
| Thermal Reduction 50% | 3,000 |

### 5.5 Energy Weapons

| Technology | RP Cost |
|------------|---------|
| 10cm Laser Focal Size | 1,000 |
| Infrared Laser | 500 |
| 15cm Meson Focal Size | 4,000 |
| Meson Focusing Technology 2 | 2,000 |
| 10cm Microwave Focal Size | 1,000 |
| Microwave Focusing 1 | 1,000 |
| 15cm Plasma Carronade | 1,000 |
| Particle Beam Range 60,000 km | 1,000 |
| Particle Beam Strength 2 | 2,000 |
| Turret Tracking Speed 2000 km/s | 1,000 |
| Reduced-size Laser 0.75/4x | 5,000 |

### 5.6 Missiles / Kinetic Weapons

| Technology | RP Cost |
|------------|---------|
| 10cm Railgun | 1,000 |
| Railgun Launch Velocity 2 | 2,000 |
| Gauss Cannon Launch Velocity 1 | 1,000 |
| Gauss Cannon Rate of Fire 1 | 1,000 |
| Enhanced Radiation Warhead | 1,000 |
| Boosted Fission Warhead 5x MSP | 8,000 |
| Missile Agility 32/MSP | 2,000 |
| Missile Launcher Reload Rate 3 | 4,000 |
| Reduced-size Launcher 0.75/2x | 1,000 |
| Magazine Ejection 80% | 1,000 |
| Magazine Feed 80% | 2,000 |
| Ordnance Production 12 BP | 3,000 |

### 5.7 Logistics / Ground Combat

| Technology | RP Cost |
|------------|---------|
| Additional Maintenance Storage | 1,000 |
| Engineering Section - Small | 2,000 |
| Maintenance Module | 5,000 |
| Garrison Battalion | 1,000 |
| Replacement Battalion | 500 |
| Assault Infantry Battalion | 5,000 |
| Brigade Headquarters | 5,000 |
| Ground Unit Strength 14 | 2,000 |
| Combat Drop Module - Battalion | 3,000 |
| Combat Drop Module - Company | 6,000 |
| Small Troop Transport Bay | 2,000 |
| Colonization Cost Reduction 5% | 10,000 |
| Command Module | 2,000 |
| Orbital Habitat Module | 5,000 |
| Improved Command and Control | 5,000 |
| Improved Cargo Handling System | 10,000 |
| Salvage Module 750 | 10,000 |
| Flag Bridge | 1,000 |
| Boat Bay | 1,000 |
| Fuel Storage - Tiny | 3,000 |
| Ship to Ship Tractor Beam | 3,438 |
| Electronic Warfare | 5,000 |
| Electronic Hardening Level 1 | 2,500 |

### 5.8 Biology / Genetics

| Technology | RP Cost |
|------------|---------|
| Genome Sequence Research | 5,000 |

---

## 6. Research Rate Progression

The Research Rate tech line (under Construction/Production) is arguably the most important in the game because it multiplies all future research.

| Level | RP/Year/Lab | Notes |
|-------|-------------|-------|
| Base | 200 | Starting value |
| 1 | 240 | First upgrade -- research this ASAP |
| 2 | 280 | Cost: 10,000 RP |
| 3 | 320 | Referenced in game starts |
| 4+ | ~400, 480, 640... | Pattern: costs double each level, no known cap |

**Cascading effect:** Each Research Rate upgrade speeds up all subsequent research. A 20% improvement to base rate means 20% faster for every project across every category. This makes Research Rate the highest-ROI investment in the game.

**Late game:** Final-tier technologies can cost hundreds of thousands of RP. Without Research Rate upgrades, these would be unreachable. The combination of upgraded research rate + more labs + high-bonus specialists + anomaly bonuses is what makes late-game techs feasible.

---

## 7. Key Tech Milestones (Game-Changing Technologies)

### 7.1 Economic Foundation (Research First)

| Technology | Why It Matters |
|------------|---------------|
| **Research Rate upgrades** | Compound returns on all future research. Always the first priority |
| **Construction Rate** | Faster factory output = faster everything else |
| **Mining Production** | More minerals = more industry capacity |
| **Fuel Production** | Fuel is the lifeblood of fleet operations |
| **Shipbuilding Rate** | Faster ship construction |

### 7.2 Exploration Enablers

| Technology | Why It Matters |
|------------|---------------|
| **Geological Survey Sensors** | Required to find mineral deposits (free with TN start) |
| **Gravitational Survey Sensors** | Required to find jump points between systems |
| **Jump Point Theory** | Enables jump drive research -- the gateway to interstellar travel |
| **Jump Drives** | Ships can transit jump points without jump gates |
| **Jump Gate Construction** | Permanent two-way portals (but enemies can use them too) |

### 7.3 Military Watershed Moments

| Technology | Why It Matters |
|------------|---------------|
| **Each new engine tier** | Faster ships = tactical advantage. Engine tech defines gameplay eras (Nuclear Thermal era, Ion era, Magneto-plasma era, etc.) |
| **Shields** | Absorb damage, regenerate. Better for wars of attrition than armor |
| **Meson cannons** | Bypass shields AND armor. Forces opponents to rethink defense |
| **Gauss cannon ROF upgrades** | At ROF 4+, gauss turrets become dominant point defense |
| **Cloaking** | Invisible ships. Completely changes scouting and ambush dynamics |
| **ECM/ECCM** | Degrades enemy missile fire control range by 10% per level |

### 7.4 Colonization & Expansion

| Technology | Why It Matters |
|------------|---------------|
| **Cryogenic Transport** | Required for colony ships |
| **Terraforming** | Transform hostile worlds into habitable ones (years-long process) |
| **Colonization Cost Reduction** | Reduces infrastructure needed for hostile-environment colonies |
| **Genetic Modification** | Modify your species to tolerate alien environments |

### 7.5 Strategic Choices (Guns vs. Butter)

Aurora forces real tradeoffs because:
- Scientists are specialized and scarce
- Every lab assigned to weapons research is not assigned to economic research
- Research Rate upgrades benefit everything (invest early = compound returns)
- Military tech is useless without economic capacity to build ships
- Economic growth is useless if you can't defend against threats

**Classic dilemmas:**
- Research Rate vs. Engine tech (explore faster vs. research faster)
- Missile tech vs. Beam tech (two completely different fleet doctrines)
- Armor vs. Shields (single-battle survivability vs. war endurance)
- Weapons vs. Sensors (hitting hard vs. seeing first)
- Military vs. Terraforming (conquer worlds vs. make them livable)

---

## 8. Trans-Newtonian Starting Technologies

In a standard TN-start game, you begin with these techs already researched:

- Trans-Newtonian Technology (the master unlock)
- Duranium Armour
- Alpha Shields + Shield Regeneration Rate 1
- 10cm Laser Focal Size + Rank 1 Focusing
- Infrared Laser wavelength
- Nuclear Thermal Engine Technology
- Pressurized Water Reactor
- Cargo Handling System
- Geological Survey Sensors
- Active Grav Sensor Strength 10
- Cloaking Rate 1

A conventional start begins with none of these -- you must research TNT first, then bootstrap everything.

---

## 9. Weapon System Comparison

### Beam Weapons (Energy Weapons category)

| Weapon | Damage Profile | Range | Key Trait |
|--------|---------------|-------|-----------|
| **Laser** | Degrades with range (3-gradient) | Longest beam range | Deepest armor penetration per damage |
| **Particle Beam** | Fixed (constant at all ranges) | Long | Out-damages lasers at max range |
| **Meson Cannon** | Fixed at 1 per shot | Short | Ignores shields AND armor entirely |
| **Plasma Carronade** | Highest per-shot | Very short | Pure close-range brawler |
| **Microwave** | Variable | Medium | Damages electronics; shields absorb at 3x multiplier |

### Kinetic Weapons (Missiles/Kinetic category)

| Weapon | Shots/Cycle | Key Trait |
|--------|-------------|-----------|
| **Railgun** | 4 (5 with Advanced) | Highest close-range DPS, can't turret, good early PD |
| **Gauss Cannon** | Scales with ROF tech | No power required, turreted, dominant late-game PD |

### Missiles

- Fully customizable: warhead, engine, fuel, ECM, sensors
- Size 1 for anti-missile, size 5-15 for anti-ship
- Optimal warhead damage follows squares: 4 (early), 9 (mid), 16 (late)
- Require launchers, magazines, fire controls, and ordnance factories
- Terminal guidance replaced agility as the hit-chance mechanism in C# 2.2+

---

## 10. Sensor System

### Passive Sensors (always on, no emissions)

| Type | Detects | Weakness |
|------|---------|----------|
| **Thermal** | Engine heat, colony activity | Can't find powered-down ships |
| **EM** | Active sensors, shields, colonies | Can't find ships under emissions control |

**Formula:** `Detection_Range = Sensor_Sensitivity x Sensor_Size x Emission_Power x 1000 km`

Every ship has intrinsic thermal + EM sensors of strength 1.

### Active Sensors (emit detectable pulses)

- Radar-like 360-degree coverage
- **Resolution** determines minimum detectable ship size at full range
- Ships smaller than resolution are detected at much shorter range
- Active sensor emissions are detectable by enemy EM sensors (tactical vulnerability)
- Required for fire control target acquisition

**Formula:** `Range = SQRT(Strength x HS x EM_Sensitivity x (Resolution^(1/1.5)) / PI) x 1,000,000 km`

### Survey Sensors

| Type | Purpose | Base Rate |
|------|---------|-----------|
| **Geological** | Find mineral deposits on bodies | 1 survey point/hour |
| **Gravitational** | Find jump points in systems | 1 survey point/hour |

Both upgradeable via research (Improved variants cost 10,000 RP each).

---

## 11. Trans-Newtonian Materials

Key minerals used in research-related construction:

| Mineral | Primary Use |
|---------|------------|
| **Duranium** | Armor, research labs (1,200/lab), most construction |
| **Mercassium** | Research labs (1,200/lab), sensors |
| **Corbomite** | Shields, stealth, electronic warfare |
| **Boronide** | Power systems, capacitors, terraforming facilities |
| **Uridium** | Sensors, fire control systems |
| **Gallicite** | Engines (ship and missile) |
| **Tritanium** | Missile tech, ordnance factories |
| **Sorium** | Jump drives, jump gates; refined into fuel |

---

## 12. Design Observations for Game Design Reference

### What Makes Aurora's Research System Work

1. **Scientist scarcity creates genuine choices** -- You cannot research everything at once. Limited high-quality scientists force prioritization.

2. **The specialization quadruple is the core tension** -- You want specialists in-field for 4x bonus, but sometimes you need to compromise (wrong field, but more labs).

3. **Compound returns reward early economic investment** -- Research Rate upgrades pay dividends on every future project. Players who invest in economy first tend to overtake military-first players.

4. **Two-step research-then-design prevents instant power spikes** -- Researching a tech doesn't immediately upgrade your fleet. You still need to design, develop, build, and deploy.

5. **Cost doubling creates natural diminishing returns** -- Each tech level costs 2x the previous. You hit a point where incremental improvement isn't worth the RP vs. researching something new.

6. **Cross-category dependencies prevent tunnel vision** -- Weapons need sensors need fire controls need power plants. You can't just research guns and ignore everything else.

7. **Anomalies reward exploration** -- Finding a 100% research anomaly on a distant world creates a reason to colonize it, tying exploration to research.

8. **Scientist mortality creates urgency** -- Your best scientist could retire or die. Long projects carry risk.

9. **The conventional-to-TN transition is the biggest single unlock** -- One technology gates the entire rest of the tree, creating a clear "before and after" moment.

10. **Engine tiers define gameplay eras** -- The community naturally refers to "Nuclear Thermal era" vs "Ion era" vs "Magneto-plasma era" -- engine tech is the clearest marker of progression.

---

## Sources

- [Research - AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Research)
- [Technology - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Technology)
- [List of Research Costs - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=List_of_Research_Costs)
- [Leaders - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Leaders)
- [Engine - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Engine)
- [Sensors - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Sensors)
- [Beam Overview - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Beam_Overview)
- [Armor - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Armor)
- [Shields - AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Shields)
- [Missiles - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Missiles)
- [ECM - AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=ECM)
- [Cloaking Device - AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Cloaking_Device)
- [Research Lab - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Research_Lab)
- [Aurora 4x Tutorial Part 3 - Research and Engines](https://7w1.github.io/posts/tutorial3/)
- [Naval Gazing - Aurora Tutorial Part 7](https://www.navalgazing.net/Aurora-Tutorial-Part-7)
- [Technologies - Aurora LP Wiki](http://bgreman.com/AuroraLPWiki/Technologies)
- [Research | Aurora4x Wikia](https://aurora4x.fandom.com/wiki/Research)
- [Summary of Beam Weapons and CIWS - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Summary_of_Beam_Weapons_and_CIWS)
- [Gauss Cannons - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Gauss_Cannons)
- [Railguns - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Railguns)
- [Lasers - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Lasers)
- [Tech Tree Visualization - Aurora 4x Forum](https://aurora2.pentarch.org/index.php?topic=11110.0)
- [A Conclusive Tech Tree (Ongoing) - Aurora 4x Forum](https://aurora2.pentarch.org/index.php?topic=5354.0)
- [Aurora C# Propulsion Design Theory - Forum](https://aurora2.pentarch.org/index.php?topic=12143.0)
- [One Newbie's Guide to a Conventional Start - AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=One_Newbie%27s_Guide_to_a_Conventional_Start)
- [aurora-manual GitHub repo](https://github.com/ErikEvenson/aurora-manual)
