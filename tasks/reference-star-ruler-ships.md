# Star Ruler Ship Design & Fleet Systems Reference

Comprehensive reference covering Star Ruler 1 (2010, Blind Mind Studios) and Star Ruler 2 (2015). SR2 source is open under MIT at [BlindMindStudios/StarRuler2-Source](https://github.com/BlindMindStudios/StarRuler2-Source). SR1 is **not** open source.

---

## 1. Ship Designer

### Star Ruler 1: Circular Blueprint

The ship designer uses a **circular blueprint area** with ~14-16 units of subsystem capacity. Every subsystem placed inside occupies some of that capacity. Placement within the circle is strategic: **subsystems closer to the center are damaged last**, because incoming damage penetrates from the edge inward.

**Design workflow:**
1. **Pick a hull type** — determines available capacity and ship role constraints:
   - **Normal Hull** — balanced capacity and resilience
   - **Fighter Hull** — maximum ship size capped at 1.0
   - **Station Hull** — most component space, highest resilience, but **cannot mount engines**
   - **Heavy Hull** (unlocked via research) — more resilient, less component space
   - **Stealth Hull** (unlocked via research) — lower signature, tradeoffs in capacity
2. **Place subsystems** into the circular blueprint — each at a scale from **0.25 to 4.00** (default 1.0). A subsystem at scale 2.0 takes twice the space but is twice as effective.
3. **Add armor plates** — armor does NOT consume internal blueprint space but significantly increases resource cost and mass.
4. **Set ship scale** — the global size multiplier (from ~1 to effectively unlimited). All subsystem stats are multiplied by ship scale.
5. **Configure automation orders** — per-blueprint AI settings: auto-refuel thresholds, auto-explore, defend behaviors, targeting priorities.

**Key design constraint:** The blueprint capacity is fixed regardless of ship scale. A size-1 ship and a size-500 ship have the same internal layout space. But every subsystem's effectiveness scales multiplicatively with ship size. So a scale-1.0 laser on a size-500 ship deals 500x the damage of the same laser on a size-1 ship.

**Subsystem effectiveness formula:**
```
effective_stat = base_stat * subsystem_scale * ship_size
```

This means a 2.0-scale railgun on a size-100 ship = 200 effective units. A 4.0-scale railgun on the same ship = 400 effective units. The same 2.0-scale railgun on a size-500 ship = 1000 effective units.

### Star Ruler 2: Hex Grid Blueprint

SR2 replaced the circular blueprint with a **hex grid**. Subsystems are painted onto hexes, with each subsystem spanning one or more hexes. The hex count scales with ship size — larger ships get more hexes to fill.

**Core/Turret mechanic:** Multi-hex subsystems have one designated **core hex** (or turret hex for weapons). If the core hex is destroyed, the **entire subsystem goes offline** even if other hexes remain intact. This creates a critical vulnerability/redundancy tradeoff:
- **Fewer, larger subsystems** = more HP on the core hex, harder to knock out, but total loss if the core falls
- **Multiple smaller subsystems** = redundancy (lose one, others keep working), but each core is individually fragile and total cost is higher

**Damage penetration:** Attacks enter through the flat sides of hexes and penetrate inward, destroying each hex until damage is spent. Armor placement must account for attack direction — front armor doesn't protect the rear. Ships can be asymmetrically armored (heavy front, light rear).

**Two ship classes:**
- **Flagships** — directly commandable, carry supply, command support ships
- **Support Ships** — assigned to flagships or planets, cannot be independently commanded, automatically follow behavioral directives (shield, flank, etc.)

---

## 2. Scale System

### Star Ruler 1: Unlimited Scaling (The Crown Jewel)

The scale system was SR1's most famous and distinctive feature. Ships could be built at **any scale** from near-microscopic to larger than stars.

**How it works:**
- Ship size is a **continuous multiplier** set in the designer (not discrete classes)
- All subsystem outputs (damage, thrust, power generation, HP, etc.) scale linearly with ship size
- Resource costs scale **super-linearly** — cost of a size-200 ship is more than 2x cost of size-100
- The cost exponent follows approximately: `cost ~ size^exponent` where exponent > 1
- The **Megaconstruction** research tech reduces this exponent, making larger ships increasingly feasible as the game progresses

**What changes at larger scales:**
- Raw stats (damage, HP, thrust) scale linearly with size
- Resource costs scale exponentially (mitigated by Megaconstruction tech)
- Build time increases dramatically — need to build shipyards in stages (size-10 station builds size-50, which builds size-200, etc.)
- Design inefficiencies compound — a slight energy surplus at size-1 becomes a massive surplus at size-500, meaning the design wastes capacity
- Weapon reload times also scale up, so bigger isn't always better per-resource-spent
- Technology level dominates over size: a size-1 fighter with tech level 40 components destroys a size-1000 battleship with tech level 1 components

**Notable scale achievements players reported:**
- Ships larger than planets (size ~2500+ visually dwarfs planets)
- Ships larger than stars
- Ships larger than the galaxy itself
- Matryoshka ships — ships carrying ships carrying ships, exploiting Spatial Dynamics and Cargo Storage research to nest progressively larger ships inside smaller ones (going from size 1.0 fighters to size 256 battleships through ~12 nesting transitions)

### Star Ruler 2: Structured Scaling

SR2 retained large-scale ships but added more structure:
- Ship size determines hex count on the design grid
- Hull types impose different constraints (fighters vs. flagships vs. stations vs. carriers)
- Armor stats on support ships are approximately **2x health and 2x damage resistance** compared to flagships, compensating for their fragility
- At flagship size ~64+, raw flagship weapons begin outperforming support fleets in efficiency, creating a natural scaling inflection point

---

## 3. Subsystem Mechanics

### Star Ruler 1: Complete Subsystem Catalog

**Mandatory subsystems (ship dies without these):**
| Subsystem | Function |
|-----------|----------|
| Bridge | Provides control; losing it = dead ship |
| Crew Quarters | Houses crew who provide control; gives small HP regen |
| Life Support | Keeps crew alive |
| Power Generator | Powers all active systems; no power = no weapons, shields, etc. |

**Alternative control:** Computer Core can replace crew (Bridge + Crew Quarters + Life Support) with a single subsystem. Trade-off: no crew HP regen, but less blueprint space used.

**Propulsion:**
| Subsystem | Notes |
|-----------|-------|
| Engine | Standard thrust; uses fuel; more engines = faster but higher fuel consumption |
| Ram Scoop | Zero fuel consumption, very low thrust; can supplement regular engines to reduce fuel use |
| Jump Drive | FTL capability; at high research levels can replace engines entirely |
| Fuel Storage | Extends operational range |

**Weapons:**
| Category | Types | Notes |
|----------|-------|-------|
| Projectile/Kinetic | Railgun, Artillery | Shields have % chance to block entirely rather than reducing damage |
| Energy | Laser, Overcharged Laser | Short range, high damage; power-hungry |
| Missile/Torpedo | Missiles, Torpedoes, Barrage Launcher, Cluster Launcher | Longer range; consume ammo |
| Graviton | Repulsor Beam, Attractor Beam, Interdictor | Utility — push/pull ships, prevent FTL escape |
| Special | Tractor Beam | Can pull stations out of orbit or fling ships out of systems |

**Defense:**
| Subsystem | Notes |
|-----------|-------|
| Deflector Shield | Light, regenerates, power-hungry; damage leaks through as shield HP drops |
| Armor Plates | Heavy, no power draw, does not consume blueprint space, high resource cost |
| Nano Armor | Self-repairing armor; only repairs itself, not other subsystems |
| Bulkheads | Modifier — adds HP to connected subsystem |

**Support/Utility:**
| Subsystem | Notes |
|-----------|-------|
| Cooling System | Modifier — increases connected weapon's fire rate |
| Shield Recharger | Modifier — increases shield regeneration rate |
| Repair Bay | Provides HP regeneration to all subsystems (not just armor) |
| Ammo Cache | Stores ammunition; **explosive** — can chain-react if hit |
| Matter Generator | At high research levels, generates more ammo than weapons consume |
| Cargo Storage | Enables carrying cargo, other ships (Matryoshka nesting) |

**Economic subsystems (for stations/mobile shipyards):**
| Subsystem | Function |
|-----------|----------|
| Metal Refinery | Processes ore into metal |
| Electronics Fabricator | Converts metal into electronics |
| Advanced Parts Assembler | Converts metal + electronics into advanced parts |
| Export Dock | Transfers goods to/from Galactic Bank |

**Key interactions:**
- Weapons need **power** (from generators) and **ammo** (from caches/Matter Generators)
- Power systems need **control** (from Bridge/Computer + crew/computers)
- Crew needs **quarters** and **life support**
- More weapons → more power → more control → more crew space → less room for weapons
- This circular dependency is the core design tension: squeezing weapons onto a ship while keeping it functional
- Damaged subsystems can **explode** (especially ammo caches, anti-matter storage), causing chain reactions
- Subsystem destruction is location-based: shots from a direction hit the outermost subsystem from that direction first

### Star Ruler 2: Hex Subsystems

**Weapons:**
| Type | Behavior | Best Against |
|------|----------|--------------|
| Railgun | Continuous fire, long range, skirmish weapon | General purpose |
| Laser | Burst fire, high alpha damage, medium range | Timed strikes |
| Missile | Retargets if original target dies; configurable as few large or many small | Flagships (large) or supports (many small) |
| Rocket | Rear-facing, armor-piercing, penetrates deep into ship | Flagships, heavy supports |
| Torpedo | AoE blast radius, damages multiple hexes across ship face | Finding gaps in armor |
| Carpet Bomb | Dedicated anti-planet weapon | Planetary sieges |

**Armor types:**
| Type | HP | Resistance | Special |
|------|-----|-----------|---------|
| Plate | Medium | Medium (all types) | General purpose |
| Ablative | Low | High (especially vs. beams) | Anti-energy |
| Reactive | Medium | Very high vs. large hits, poor vs. small | Anti-alpha |
| Neutronium | Very high | Medium | Extremely heavy and expensive |
| Liquid | Medium | None | HP flows between adjacent hexes; regenerating barrier |

**Other key subsystems:**
- **Supply Storage** — fleet ammo/fuel; below 50% supply = reduced effectiveness
- **Support Command** — enables commanding support ships; losing it = supports go uncontrolled
- **Energy/Generator** — powers flagship, boosts out-of-combat resupply rate
- **Bulkheads** — can be added to any non-core hex for extra HP
- **Sinew** — structural reinforcement (cannot accept bulkheads)
- **Shields** — trade hex space (could be weapons/supply) for damage absorption

---

## 4. Fleet Management

### Star Ruler 1: Automation-Heavy

**Fleet formation:**
- Select ships → press **F** to Form Fleet, **J** to Join Nearest Fleet
- Selecting any ship in a fleet selects the entire fleet; click again to select individual ship
- Fleet Management Window (**U**) shows all fleets empire-wide

**Automation orders (per-blueprint, inherited by all ships of that design):**
- **Fetch Fuel at X%** — auto-refuel when fuel drops below threshold (default 48%)
- **Fetch Ammo at X%** — auto-resupply ammunition
- **Auto Explore** — scout ships find unscouted systems, fly to them, repeat
- **Auto Defend** — guard a system, engage hostiles
- **Ranged Defend** — engage hostile systems within a configurable radius, return when cleared
- **Auto Refuel** — ships out of fuel head to nearest planet, refuel, return to formation

**Carrier automation:** Carriers can be configured with a default strike craft blueprint. Carriers automatically order nearby planets to build replacement strike craft when losses occur.

**Build queues:** Shift-click adds 5 ships to queue, Ctrl-click sets custom count. Queues can be saved and reused.

**Newtonian physics impact on fleet tactics:** Ships have no top speed; they accelerate constantly. Moving between systems, ships accelerate to midpoint then flip and decelerate. More engines = faster transit but higher fuel consumption. Engine placement matters: engines at the rear get hit first during deceleration approach (ship is flying backward to brake).

### Star Ruler 2: Flagship + Support Fleet Model

**Fleet structure:**
- Every fleet has exactly **one flagship** — the command vessel
- Flagship carries **support ships** (10 added per click during construction)
- Support ships build in parallel with the flagship; unfinished ones continue building while fleet stays in-system
- If supports die, they're recorded as **"ghost" ships** — the fleet remembers its composition for easy refresh
- When a flagship is destroyed, orphaned supports seek nearby leaders; if none have capacity, supports eventually expire

**Support ship behaviors (set in design):**
- **Shield** — ships with heavy front armor actively block shots for the fleet
- **Flank** — attack from the sides
- **Various combat roles** — carrier, support killer, flagship killer archetypes

**Supply mechanics:**
- Every fleet has a Supply bar representing ammo/fuel/materials for combat
- Weapons drain supply; sieging planets drains supply
- Below **50% supply** — damage output, repair rate, and all operations degraded
- At **0% supply** — fleet operates at half effectiveness (not completely disabled)
- Resupply occurs in friendly uncontested systems
- All supply comes from the flagship — destroying the flagship cripples the fleet

**Defense generation:** Planets with Defense stat auto-produce free support ships (no build cost, no maintenance). These can be transferred to fleets like regular supports.

---

## 5. Ship Production

### Star Ruler 1: Resource Chain + Instant Build

**Resources required:**
| Resource | Source | Notes |
|----------|--------|-------|
| Ore | Mined from planets/asteroids | Raw material; extraction rate drops as deposits deplete (never reaches zero) |
| Metal | Refined from Ore | Base building material |
| Electronics | Fabricated from Metal (2 Metal → 1 Electronics) | Intermediate material |
| Advanced Parts | Assembled from Metal + Electronics (2 Metal + 1 Electronics → 1 AP) | High-tech material |
| Labor | Generated by cities and shipyards | Production capacity |

**Optimal production ratio:** 4 Metal factories : 2 Electronics factories : 1 Advanced Parts factory yields a balanced output of 2 Metal + 1 Electronics + 1 Advanced Parts.

**Build speed:** There is **no build timer** in the traditional sense. If sufficient resources and labor are stockpiled at the construction point, ships build nearly instantly. The bottleneck is accumulating resources and labor, not waiting.

**Galactic Bank:** Empire-wide resource pool. Planets pull resources from the bank via spaceports (limited throughput). Cargo capacity on stations determines transfer rate between planet and station.

**Cost scaling for ship size:**
```
cost ~ base_cost * ship_size^exponent
```
The exponent is > 1, meaning costs grow faster than linearly. The **Megaconstruction** tech reduces this exponent, making larger ships progressively cheaper relative to their size. **External racks** also help mitigate the efficiency penalty.

**Shipyard bootstrapping:** A small station builds a medium station, which builds a large station, which builds capital ships. Trying to build a massive ship from a tiny shipyard takes prohibitively long. Incremental upgrades waste more total resources but dramatically reduce wall-clock time.

**Cancellation:** Canceling construction refunds **50%** of resource cost (except Labor, which is lost).

### Star Ruler 2: Budget Cycles + Labor

**Budget system:** Every **3 minutes**, a new budget cycle starts. Budget = Money Income - Maintenance Costs. If maintenance exceeds income, the empire enters **Debt**: population growth drops, and at severe debt, all fleet weapons stop firing.

**Ship costs expressed as:** `Build Cost / Maintenance Cost` (e.g., 300k/120k = 300k one-time, 120k per cycle ongoing).

**Labor:** Determines construction rate at planets and shipyards. Sources:
- Planetary resources (titanium, iron, supercarbons) create labor pressure
- Asteroid belts give **+50% labor bonus** (non-exportable)
- Multiple planets can pool labor into a shared shipyard

**Drydocks:** For ships whose build cost exceeds a single budget cycle, a **Drydock** orbital distributes the cost across multiple cycles. Created by double-clicking the desired ship at the planetary build screen.

**Shipyard orbitals:** Space stations that allow multiple planets to contribute labor to a single construction project. Critical for late-game capital ship production.

**Support ship production:**
- Built in parallel with flagships (10 per click)
- Unfinished supports continue building while fleet stays in system
- Defense-generated supports are free (no build cost or maintenance)
- Support ships with supply crates do incur maintenance

---

## 6. What Made It Special

### The Ship Design Loop Was "A Game Within The Game"

Players consistently cited ship design as SR1's greatest strength. The interdependent subsystem web — weapons need power, power needs control, control needs crew, crew needs quarters and life support, all consuming the same fixed blueprint space — created a deeply satisfying optimization puzzle. Every design was a series of meaningful tradeoffs with no single correct answer.

### Infinite Scale Created Memorable Moments

The unlimited scaling produced emergent scenarios no other 4X offered:
- **Accidental planet destruction** — fielding ships powerful enough to crack worlds while trying to merely cleanse enemy populations
- **Star-killing superweapons** — the Heliocide Hull (from Galactic Armory mod) could destroy stars
- **Galaxy-spanning ships** — ships physically larger than the playable galaxy
- **Matryoshka doll ships** — ships carrying progressively larger ships inside themselves via high-level Spatial Dynamics and Cargo Storage research
- **Tractor beam trolling** — using graviton beams to pull enemy stations out of orbit or fling ships out of star systems

### Technology vs. Scale Created Natural Progression

Because tech level improvements multiplicatively enhanced subsystem efficiency, the game had a natural arc: early game was about expanding economy and research, mid-game was about unlocking efficient enough subsystems to make warships viable (early designs were too space-constrained to carry meaningful weapons), and late game was about scaling proven designs up while pushing tech further.

### Newtonian Physics Made Combat Visceral

No top speed, no drag. Ships had to flip and decelerate. Engine placement in the blueprint had tactical implications (rear engines get hit during braking approach). Massive fleets of thousands of ships created physics-driven shockwaves and particle effects. Combat was fast and brutal — subsystem chain reactions (exploding ammo caches, lost power cascades) could destroy ships in seconds.

### Automation Respected Player Intelligence

Rather than dumbing down empire management, SR1 gave players powerful automation tools: per-blueprint AI orders, configurable thresholds, saved build queues, carrier auto-replenishment. This let players focus on design and strategy while delegating logistics. The game scaled to millions of stars and thousands of races — automation wasn't optional, it was essential, and it was well-implemented.

### The Design Space Was Genuinely Open

Modding (especially Galactic Armory with 100+ subsystems) and the text-file-editable game data meant the community could extend the design space indefinitely. The research system's semi-random tech links meant each game presented different subsystem availability and synergies, preventing solved-game stagnation.

### SR2's Hex Grid Added Tactical Depth

The move to hex grids with directional damage, core hex vulnerabilities, and distinct armor types (plate/ablative/reactive/neutronium/liquid) made ship design more spatially interesting. The flagship/support fleet model added a layer of fleet composition strategy. The budget cycle economy created temporal pressure absent in SR1's stockpile model.

### What Players Criticized

- **Learning curve** — both games were notoriously hard to learn, with minimal tutorials
- **SR1 late-game devolved** into "make everything bigger" once Megaconstruction was maxed
- **SR2 hex design** could feel more like exploiting the system than making interesting choices for some players
- **AI quality** was inconsistent; human opponents were needed for the deepest strategic experience
- **SR1's balance** was fragile — certain tech rushes (especially Ram Scoop + high-level weapons) could trivialize the game

---

## Key Differences: SR1 vs SR2

| Aspect | Star Ruler 1 | Star Ruler 2 |
|--------|-------------|-------------|
| Ship designer | Circular blueprint, 14-16 units capacity | Hex grid, scales with ship size |
| Ship scaling | Continuous, unlimited (size 1 to galaxy-sized) | Structured sizes with hull type constraints |
| Damage model | Radial from edge to center | Directional through hex faces, penetrating inward |
| Fleet model | Loose fleet grouping, individual ship control | Flagship + support ships, supports not independently commandable |
| Economy | Stockpile-based (Metal/Electronics/AP/Labor) | Budget cycles (3-minute money cycles) + Labor |
| Build speed | Near-instant if resources available | Labor-gated, drydocks for expensive ships |
| Subsystem unlock | Research tree with semi-random links, infinite levels | Tech tree with discrete unlocks |
| Open source | No | Yes (MIT license, GitHub) |

---

## Sources

- [Star Ruler - Wikipedia](https://en.wikipedia.org/wiki/Star_Ruler)
- [Star Ruler (Video Game) - TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/StarRuler)
- [Star Ruler Review - StrategyCore](https://www.strategycore.co.uk/articles/reviews/star-ruler-review/)
- [Star Ruler - One of my favourite 4X games](https://itsmorethanjustgaming.com/2018/03/12/star-ruler-one-of-my-favourite-4x-games/)
- [Star Ruler on Steam](https://store.steampowered.com/app/70900/Star_Ruler/)
- [Star Ruler 2 Wiki - Designs](http://wiki.starruler2.com/Designs)
- [Star Ruler 2 Wiki - Ships and Combat](http://wiki.starruler2.com/Ships_and_Combat)
- [Star Ruler 2 Wiki - Game Mechanics](http://wiki.starruler2.com/Game_Mechanics)
- [Star Ruler 2 Wiki - Economy](http://wiki.starruler2.com/Economy)
- [Star Ruler 2 Wiki - Buildings and Orbitals](http://wiki.starruler2.com/Buildings_and_Orbitals)
- [A Basic Guide to Ship Design - SR2 Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=754765783)
- [Snprook's Guide to Ship Design - SR2 Steam Guide](https://steamcommunity.com/sharedfiles/filedetails/?id=386168594)
- [Star Ruler 2 Review - SpaceSector](https://www.spacesector.com/blog/2015/05/star-ruler-2-review/)
- [Star Ruler 2 Review - The Escapist](https://www.escapistmagazine.com/star-ruler-2-review-unique-in-nearly-every-way/)
- [BlindMindStudios/StarRuler2-Source - GitHub](https://github.com/BlindMindStudios/StarRuler2-Source)
- [OpenSRProject/OpenStarRuler - GitHub](https://github.com/OpenSRProject/OpenStarRuler)
- [Galactic Armory Mod - ModDB](https://www.moddb.com/mods/galactic-armory)
- [Star Ruler - Critical Moves Podcast](https://criticalmovespodcast.com/star-ruler/)
- [Star Ruler Gold Review - SpaceSector](https://www.spacesector.com/blog/2011/09/star-ruler-gold-review/)
- [Star Ruler 1/Star Ruler 2 - SpaceBattles Forum](https://forums.spacebattles.com/threads/star-ruler-1-star-ruler-2.329736/)
