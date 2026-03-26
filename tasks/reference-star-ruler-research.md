# Star Ruler Research & Tech Tree Reference

Reference document covering the research and technology systems in Star Ruler 1 and Star Ruler 2.

---

## Star Ruler 1

### Overview

Star Ruler 1 (2010, Blind Mind Studios) features a research system built around a **hexagonal grid of interconnected technologies** with **infinite level progression**. Each technology can be leveled up without limit, and every level improves the subsystems governed by that technology. The result is a game where tech differences compound exponentially, enabling absurd late-game scales — fighters that one-shot stars, ships the size of planets, billions of HP.

### Research Point Generation

- **Science Labs** are the primary research infrastructure, built on planets as structures.
- Labs are governed by the **General Sciences** technology — their output scales with General Sciences level. Level 1 General Sciences = Level 1 labs, Level 2 = Level 2 labs, etc. Existing labs auto-upgrade when the governing tech levels up.
- Labs consume **Advanced Parts** (a resource), so building many early is unsustainable. The typical early strategy is to build few labs until the economy can support them.
- Two factors define total research rate: (1) number of labs and (2) General Sciences level. Trying to compensate for low General Sciences with lab quantity alone is ineffective — the tech level multiplier dominates.
- **Analyzer Level** (for sensors/scanning) uses the formula: `floor(General Sciences + Metallurgy * 0.5)`.

### Discovery: The Hunch/Guess System

Not all technologies are visible at game start. The grid contains hidden nodes marked with "?" symbols. To discover new tech branches:

1. Select an already-known technology adjacent to the hidden node.
2. Choose either **"Hunch"** (cheaper, lower success chance) or **"Guess"** (more expensive, higher success chance).
3. On success, the hidden technology is revealed and becomes available for research.

This introduces controlled randomness — Metallurgy might reveal Chemistry or Nanotechnology depending on which direction you probe. The grid connections are fixed (Metallurgy always links to Chemistry and Nanotechnology), but the discovery order is player-driven.

**Player reception:** The hunch/guess system was praised for adding exploration and surprise to research but criticized for being poorly explained. Tooltips were insufficient, and new players found it confusing to understand what they were actually doing.

### Tech Tree Structure

Technologies are laid out in a connected hex grid. Each tech can connect to adjacent techs cheaply and diagonal techs at higher cost. The grid can optionally be **shuffled per game** for replayability.

#### Complete Technology List (Base Game)

**Root:**
- **General Sciences** — Links to: Energy Sciences, Particle Physics, Gravitics, Propulsion, Chemistry, Biology. No prerequisites. Starting cost: 20,000 points. Governs science lab output.

**Physical Sciences:**
- **Particle Physics** — Links to: Propulsion, Armor, Projectile Weapons, Sociology, Biology. Links from: General Sciences, Chemistry, Biology, Projectile Weapons, Propulsion, Armor.
- **Energy Sciences** — Links to: Gravitics, Beam Weapons, Chemistry. Links from: General Sciences.
- **Chemistry** — Links to: Energy Sciences, Missiles, Metallurgy, Particle Physics. Links from: General Sciences, Energy Sciences.
- **Gravitics** — Links to: Energy Sciences, Ship Construction, Sensors, Spatial Dynamics, Beam Weapons. Links from: General Sciences, Energy Sciences.

**Materials & Manufacturing:**
- **Metallurgy** — Links to: Missiles, Nanotechnology, Chemistry. Links from: Chemistry.
- **Nanotechnology** — Links to: Metallurgy, Computers, Biology, Sociology. Links from: Metallurgy.

**Social Sciences:**
- **Biology** — Links to: Particle Physics, General Sciences, Sociology. Links from: General Sciences, Particle Physics, Nanotechnology.
- **Sociology** — Links to: Economics, Projectile Weapons, Biology, Computers. Links from: Biology, Particle Physics, Nanotechnology.
- **Economics** — Links to/from: Sociology. Governs trade and income.
- **Computers** — Links to: Nanotechnology, Sociology. Links from: Nanotechnology.

**Weapons:**
- **Projectile Weapons** — Links to: Particle Physics, Armor, Propulsion, Ship Systems. Links from: Particle Physics, Sociology.
- **Beam Weapons** — Links from: Gravitics, Energy Sciences.
- **Missiles** — Links from: Metallurgy, Chemistry. Must be discovered (not a starting tech).

**Defense:**
- **Armor** — Links to/from: Particle Physics, Projectile Weapons, Propulsion, Ship Construction, Ship Systems, Cargo Storage.
- **Shields** — Links from: Sensors, Stealth, Armor. Application of energy physics and stealth into projected barriers.

**Ship Engineering:**
- **Propulsion** — Links to: Cargo Storage, Ship Systems, Particle Physics, Armor, Ship Construction. Links from: General Sciences, Particle Physics, Projectile Weapons, Ship Construction, Ship Systems.
- **Ship Construction** — Links to: Propulsion, Gravitics. Links from: Gravitics, Propulsion.
- **Ship Systems** — Links to: Armor, Cargo Storage, Propulsion. Links from: Propulsion, Ship Construction, Cargo Storage, Armor.
- **Cargo Storage** — Links from: Propulsion, Ship Systems.

**Advanced Technologies:**
- **Sensors** — Links to: Gravitics, Stealth, Spatial Dynamics, Shields. Links from: Gravitics.
- **Stealth** — Links to: Spatial Dynamics, Shields, Sensors, Beam Weapons. Links from: Sensors, Armor.
- **Spatial Dynamics** — Study of space-time physics; leads to highly advanced technologies. Links from: Gravitics, Sensors, Stealth.

**Total: ~20 technology branches**, each with infinite levels.

### Level Scaling

This is the core mechanic that defines Star Ruler's identity:

- **Cost per level:** Each level costs **2x** the previous level. Base cost for General Sciences is 20,000 points. Level 2 = 40,000, Level 3 = 80,000, etc.
- **Improvement per level (default):** Each level grants a **35% multiplicative improvement** over the previous level for all governed subsystems.
  - At Level 10: subsystems are **14.9x** their Level 1 values.
  - At Level 20: subsystems are **221x** their Level 1 values.
  - At Level 50: values become astronomically large.
- **Exponential curve:** The default exponential leveling curve means that small differences in research rate compound dramatically. A player 2-3 levels ahead in weapons tech has a massive, often insurmountable advantage.

**Consequence:** Research rate is the single most important factor in the game. The developers themselves acknowledged this — whoever researches fastest usually wins, regardless of ship design skill or empire management. This was the primary criticism of SR1's tech system.

**Patch adjustments:** A patch decreased gains to science labs from General Sciences — reaching Level 10 took about 2x as long post-patch, and Level 20 took 4x as long.

### Subsystem Unlocks via Research

Research doesn't just improve existing subsystems — it unlocks new ones:

- Researching **Energy Weapons** (via Energy Sciences + Beam Weapons path) first unlocks standard lasers, then pulse lasers, then higher-tier variants.
- Each newly unlocked subsystem starts weak and requires continued research in its branch to become competitive.
- The relationship is linear within a branch — you research lasers sequentially (Laser → Pulse Laser → etc.), but the branches themselves are interconnected via the hex grid.

### Strategic Research Patterns

Common opening priorities:
1. **General Sciences** first and always — keep it at or above your highest other tech level.
2. **Metallurgy** — enables Missiles and Nanotechnology.
3. **Economics** — income scaling.
4. **Sociology** — population efficiency.
5. **Biology** — growth and connections to other branches.

Repeat this cycle approximately 5 times, then specialize based on military needs.

### Modding: Galactic Armory Overhaul

The Galactic Armory mod (the most popular SR1 mod) attempted to fix the research system's problems. Their design goals:

1. **Specialization:** Unlocking everything should not be expected in an average game. Players should be rewarded for focusing on specific branches.
2. **Clarity:** The tech tree structure should be easy to understand.
3. **Balanced importance:** Research should matter but not be the sole determinant of victory.

Key changes:
- Changed the exponential level gain curve to reduce the power gap between tech levels.
- Spread subsystems across more nodes, making it harder to unlock everything.
- Advanced subsystems designed as lateral alternatives rather than strict upgrades.
- Added **92 new research nodes** to create a much larger, more branching tree.

---

## Star Ruler 2

### Overview

Star Ruler 2 (2015, Blind Mind Studios) completely redesigned the research system. Instead of infinite levels on a hidden hex grid, SR2 uses a **finite hex grid** visible from the start, with **one-time purchases** at each node. The grid radiates outward from a central "Science" node, and players buy paths through it toward desired technologies.

The developers noted they thought SR1 had a better research system in some ways, but SR2's was designed to address the runaway exponential scaling problem.

### Research Point Generation

- **Research Pressure:** Resources that provide Research Pressure cause civilian populations to build research infrastructure automatically.
- **Research Banking:** Research points accumulate in a bank (like energy or influence). No research is wasted on forgotten queues. Players spend banked points when ready.
- **Multiple simultaneous research:** You can research multiple technologies at once, as long as none depend on another completing first.

### Research Efficiency (Diminishing Returns)

As a player generates more total research over the course of a game, efficiency decreases:

```
Research Efficiency = 2000 / (2000 + totalGenerated)
```

- After generating 2,000 total research: efficiency = 50%
- After generating 6,000 total research: efficiency = 25%
- After generating 18,000 total research: efficiency = 10%

This is a **global, permanent** efficiency decay based on cumulative research generated, not current rate. Using secondary resources (energy, money, influence) to unlock techs counts toward `totalGenerated`, reducing future efficiency.

**Design intent:** Prevents runaway tech leads. A player who gets ahead early will face diminishing returns, while lagging players can still catch up because the grid is finite — everyone eventually researches everything if the game runs long enough.

### Grid Structure

- **Central node:** "Science" at position (0,0), unlocked by default.
- **Hex adjacency:** Each purchased node makes its 6 adjacent hexes accessible. Each unlocked node makes adjacent hexes purchasable.
- **Node states:** Unlocked → Bought (timer counting down) → Available (adjacent to bought) → Unlockable (adjacent to unlocked) → Queued (auto-research).
- **Radial layout:** The grid radiates outward. Offensive/combat techs tend toward one quadrant, defensive/infrastructure toward another, but there is overlap and many paths to the same destination.
- **Finite:** Unlike SR1, the grid has a fixed number of nodes. No infinite progression (base game). The Wake of the Heralds DLC added some infinite progression nodes at the grid edges.

### Cost & Payment Systems

Each node has two costs:
- **Point Cost:** Research points (500–1500+ range for improvements, higher for major unlocks).
- **Time Cost:** Seconds to unlock after payment (30–180 seconds typical).

**Alternative payment methods** (not all nodes support all methods):
- **Research Points** — Universal, works on all nodes.
- **Energy** — Some nodes accept energy instead of research points.
- **Money** — Some nodes accept money.
- **Influence** — Some nodes accept influence.

Using alternative resources still counts toward the efficiency penalty as if you had generated and spent that many research points.

### Technology Categories (from Source Code)

Based on the SR2 open source data files, the ~120+ nodes on the base grid fall into these categories:

#### Improvements (Stat Boosts) — ~70+ nodes
These are the most numerous. Each provides a one-time permanent bonus:

| Category | Node Prefix | Effect | Tiers |
|---|---|---|---|
| Armor Health | ImpArmorHealth | +HP to armored subsystems | 2 tiers (1.1x, 1.2x+) |
| All Health | ImpAllHealth | +HP to all subsystems | 2 tiers |
| Armor DR | ImpArmorDR | Damage reduction on armor | 1 tier |
| Civilian Health | ImpCivHealth | +HP to civilian structures | 1 tier |
| Damage | ImpDamage | Weapon damage multiplier | 3 tiers (1.1x → 1.2x → 1.4x) |
| Planet Damage | ImpPlanetDamage | Bonus vs planets | 1 tier |
| Fire Rate | ImpFireRate | Attack speed | 1+ tiers |
| Tracking | ImpTracking | Weapon accuracy | 2 tiers |
| Area of Effect | ImpAoE | Splash damage radius | 2 tiers |
| Projectile Speed | ImpProjSpeed | Projectile velocity | 2 tiers |
| Weapon Range | ImpAllRange | All weapon range | 1 tier (appears 5x on grid) |
| Shield Capacity | ImpShieldCap | Shield HP | 2 tiers |
| Shield Regen | ImpShieldReg | Shield recovery rate | 2 tiers |
| Supply Storage | ImpSupplyStorage | Fleet supply capacity | 2 tiers |
| Supply Regen | ImpSupplyRegen | Supply recovery | 2 tiers |
| Supply Use | ImpSupplyUse | Reduced supply consumption | 2 tiers |
| Factory Labor | ImpFactoryLabor | Production output | 2 tiers |
| Construction Rate | ImpImpConstructionRate | Building speed | 2 tiers |
| Civilian Construction | ImpCivConstructionRate | Civilian building speed | 2 tiers |
| Tile Development | ImpTileDevelopment | Planet tile improvement speed | 2 tiers |
| Thrust | ImpThrust | Ship acceleration | 2 tiers |
| Flagship Damage | ImpFlagDamage | Flagship-specific damage bonus | 2 tiers |
| Support Damage | ImpSupportDamage | Support ship damage | 2 tiers |
| Support Cap | ImpSupportCap | Max support ships | 1 tier |
| Support Supply Use | ImpSupportSupplyUse | Support ship supply efficiency | 1 tier |
| Planet Support | ImpPlanetSupport | Planet-based support cap | 1 tier |
| Repair | ImpRepair | Repair rate | 2 tiers |
| Decay Speed | ImpDecaySpeed | Structure decay rate reduction | 1 tier |
| Weapon Spread | ImpSpread | Reduced weapon spread | 1 tier |

**Important:** The same improvement appears at multiple locations on the grid (e.g., ImpAllRange appears at 5 different coordinates). This means there are multiple paths to the same bonus, but also that the same improvement cannot be stacked — if Destruction 2 appears in two places, researching either one gives you the bonus.

#### Development Nodes (Resource Generation) — ~15 nodes

| Node | Effect |
|---|---|
| DevBudget / DevBudgetSmall | Increase empire budget |
| DevDefenseIncome | Defense infrastructure income |
| DevEnergyIncome / DevEnergy | Energy generation / storage |
| DevFTLIncome / DevFTL | FTL generation / storage |
| DevInfluenceIncome / DevInfluence | Influence generation |
| DevMoney | Direct money bonus |
| DevEnhance | Enhancement capabilities |
| DevNegotiate | Negotiation bonuses |
| DevSurge | Surge ability |

#### System Unlocks (New Subsystems) — 18 nodes

These unlock entirely new ship components:

| Node | Unlocks |
|---|---|
| SysLiquidArmor | Liquid Armor — adaptive armor type |
| SysNeutronArmor | Neutron Armor — heavy armor |
| SysTitanHull | Titan Hull — massive ship hull |
| SysShieldGen | Shield Generator |
| SysShieldHardener | Shield Hardener — focused shield defense |
| SysConstructionBay | Construction Bay — build ships from ships |
| SysHyperLaser | Hyper Laser — high-power beam weapon |
| SysMuonCannon | Muon Cannon — particle weapon |
| SysIonCannon | Ion Cannon — energy weapon |
| SysGravitonCondenser | Graviton Condenser — gravity weapon |
| SysSelfDestruct | Self-Destruct system |
| SysGravityEngine | Gravity Engine — advanced propulsion |
| SysSkipDrive | Skip Drive — short-range FTL |
| SysOreProcessor | Ore Processor — in-ship resource processing |
| SysCloakPlating | Cloak Plating — stealth system |
| SysShipComputer | Ship Computer — targeting/automation |
| SysEmergencySupplies | Emergency Supplies — crisis supply system |
| SysAntimatterGen | Antimatter Generator — advanced power |

#### Orbital & Building Unlocks — 6 nodes

| Node | Unlocks |
|---|---|
| OrbStarForge | Star Forge — massive orbital factory |
| OrbVacuumTelescope | Vacuum Telescope — deep space sensor |
| OrbRingworld | Ringworld — megastructure habitat |
| OrbArtificialPlanetoid | Artificial Planetoid — constructed world |
| BldMegacity | Megacity — ultra-dense population building |
| BldPlanetaryEngine | Planetary Engine — move planets |

#### Module Unlocks — 6 nodes

| Node | Unlocks |
|---|---|
| ModBulkhead | Bulkhead — ship compartmentalization |
| ModTargetSensor | Target Sensor — improved targeting |
| ModAugmentReload | Augment: Reload — weapon reload speed |
| ModAugmentDamage | Augment: Damage — weapon damage module |
| ModAugmentSupply | Augment: Supply — supply efficiency module |
| ModQuantumBattery | Quantum Battery — energy storage module |

#### Keystone Technologies — 3 nodes

Special high-impact techs at the grid edges:

| Node | Effect |
|---|---|
| KeyBuildCost | Reduced construction costs |
| KeyRailgunKnockback | Railguns knock back targets |
| KeyEmergencyShields | Emergency shield activation |

#### Faction-Specific Technologies — 2 files

- **DevoutTechs** — Special techs for the Devout faction.
- **StarChildrenTechs** — Special techs for the Star Children faction.

### Research Efficiency in the Source Code

From `scripts/definitions/research.as`:

```
class TechnologyType:
    pointCost        // Base research point cost
    timeCost         // Base time to unlock (seconds)
    hooks[]          // Array of ITechnologyHook for effects/conditions

    getPointCost(Empire):
        // Base pointCost → modified by hooks → multiplied by emp.ResearchCostFactor

    getTimeCost(Empire):
        // Base timeCost → modified by hooks
```

The hook system makes the research framework highly extensible:
- `SecondaryInfluenceCost(cost)` — Pay influence instead of research
- `SecondaryMoneyCost(cost)` — Pay money instead
- `SecondaryEnergyCost(cost)` — Pay energy instead
- `SecondaryFTLCost(cost)` — Pay FTL instead
- `RequireUnlockTag(tag)` — Node hidden until tag is earned
- `RequireBuildShipsWith(subsystem, count)` — Must build N ships with a subsystem
- `RequireEmpireAttributeGTE(attr, value)` — Empire stat gate
- `SkipOnUnlockedSubsystem/Module/Tag` — Auto-complete if prerequisite already met
- `CivilianHPBonus(factor)` — Direct stat modification

### DLC: Wake of the Heralds

The expansion added a separate grid (`heralds_grid.txt`) with:
- Ringworld and Artificial Planetoid down separate research paths.
- Planetoid path focused on construction/production.
- Ringworld path focused on orbitals, with Megacities as a mid-path milestone.
- **Infinite progression nodes** at the far edges of the grid — the only exception to the "finite grid" rule.

---

## Comparison: SR1 vs SR2

| Aspect | Star Ruler 1 | Star Ruler 2 |
|---|---|---|
| **Grid type** | Hex, partially hidden | Hex, fully visible |
| **Progression** | Infinite levels per tech | One-time purchases, finite grid |
| **Discovery** | Hunch/Guess random reveals | All nodes visible from start |
| **Scaling** | 35% exponential per level | Flat bonuses (1.1x–1.4x per node) |
| **Cost curve** | 2x per level (exponential) | Fixed per node (500–1500 points) |
| **Efficiency** | Unlimited research possible | Diminishing returns: 2000/(2000+total) |
| **Catch-up** | Nearly impossible once behind | Built-in: finite grid + efficiency decay |
| **Subsystem impact** | Massive — tech level dominates | Moderate — ship design matters more |
| **Branches** | ~20 with infinite depth | ~120 nodes, finite, 6 categories |
| **Alternative payment** | Research points only | Research, Energy, Money, Influence |

**Developer opinion:** Blind Mind Studios said they thought SR1 had the better research *system* (discovery, infinite progression feel), even though SR2's was better *balanced*.

---

## What Makes Star Ruler Unique

### SR1's Distinctive Qualities
1. **Infinite tech levels** — No other 4X does this. Most cap at a fixed tree. SR1 lets you keep going indefinitely, with exponential returns creating an arms-race dynamic.
2. **Hunch/Guess discovery** — Adds exploration to research itself. You don't just pick from a menu; you probe into the unknown.
3. **Tech governs everything** — Lab output, ship subsystems, building effectiveness all scale with tech level. Research is the meta-game.
4. **Grid shuffling** — Optional per-game randomization of the tech grid layout, preventing memorized build orders.
5. **Absurd late-game scale** — The combination of infinite levels and exponential scaling creates a game where ships grow to stellar sizes and weapons can destroy stars.

### SR2's Distinctive Qualities
1. **Hex grid with path-buying** — Rather than researching specific techs, you buy a *path* through the grid. Want that tech on the far side? You must purchase every node between here and there.
2. **Alternative payment methods** — Using money, energy, influence, or FTL to unlock tech lets economic or diplomatic empires keep pace with research-focused ones.
3. **Diminishing returns** — The efficiency formula ensures no empire can run away with tech. Everyone converges toward the same endpoint.
4. **Duplicate node placement** — The same improvement appears at multiple grid locations, creating genuine strategic choice about which path to cut toward a goal.
5. **Ship auto-upgrade in territory** — Ships automatically receive researched bonuses when in friendly territory, eliminating the SR1 problem of having to constantly retrofit fleets.

### Common Criticisms
- **SR1:** Unintuitive hunch/guess UI, exponential scaling makes research the only thing that matters, poor documentation.
- **SR2:** "Chaotic" tech web is hard to read visually, many nodes are "just bonuses" rather than interesting new capabilities, the grid becomes rote once you've played a few games, hard to distinguish researched vs locked nodes at a glance.

---

## Open Source Details

### Star Ruler 1
- **NOT open source.** Third-party code dependencies prevent release. A developer confirmed this on Steam discussions.
- Still available for purchase on Steam.

### Star Ruler 2
- **Fully open source** since 2018.
- **License:** MIT (source code), CC-BY-NC 2.0 (art assets).
- **Repository:** [BlindMindStudios/StarRuler2-Source](https://github.com/BlindMindStudios/StarRuler2-Source)
- **Community fork:** [OpenSRProject/OpenStarRuler](https://github.com/OpenSRProject/OpenStarRuler) — maintained by community, compatible with Steam/GOG versions.
- **Engine:** Custom "Starflare" engine. Scripts in AngelScript (.as files).
- **Build:** Visual Studio 2017 (Windows), GCC/Clang (Linux).
- **Music:** Not included in open source release.
- **DLC:** Wake of the Heralds content is always available in the open source version (DLC checks bypassed).

### Source Code Structure (Research System)

```
data/research/
  base_grid.txt              — Main research grid layout (~120+ nodes with coordinates)
  heralds_grid.txt           — DLC expansion grid
  Science.txt                — Root science node definition
  improvements/              — 29 stat-boost node definitions
    ImpDamage.txt, ImpArmorHealth.txt, ImpShields.txt, etc.
  unlocks/                   — 28 subsystem/building/orbital unlock definitions
    SysHyperLaser.txt, OrbRingworld.txt, BldMegacity.txt, etc.
  developments/              — 13 resource-generation node definitions
    DevBudget.txt, DevEnergy.txt, DevFTL.txt, etc.
  keystones/                 — 3 high-impact edge-of-grid nodes
    KeyBuildCost.txt, KeyRailgunKnockback.txt, KeyEmergencyShields.txt
  special/                   — 2 faction-specific tech sets
    DevoutTechs.txt, StarChildrenTechs.txt

scripts/definitions/
  research.as                — Core research system: TechnologyType, TechnologyNode,
                               TechnologyGrid classes, cost calculations, hex adjacency,
                               unlock state machine
  research_effects.as        — Hook classes: secondary costs, conditional unlocks,
                               stat modifiers, skip conditions
```

### Key Implementation Details

The research grid uses a `HexGridi` (integer hex grid) for spatial indexing. Each `TechnologyNode` tracks its state (unlocked/bought/available/unlockable/queued) and a timer for unlock countdown. When a node is bought, `markBought()` propagates availability to all 6 adjacent hex cells. When unlocked, `markUnlocked()` propagates unlockability further.

Cost calculation flows through a hook pipeline: base cost → hook modifiers → empire-wide `ResearchCostFactor` multiplier. This makes the system highly moddable — new hooks can gate, modify, or transform research behavior without changing core code.

---

## Sources

- [Star Ruler (Video Game) - TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/StarRuler)
- [Star Ruler 2 (Video Game) - TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/StarRuler2)
- [Star Ruler — One of my favourite 4X games](https://itsmorethanjustgaming.com/2018/03/12/star-ruler-one-of-my-favourite-4x-games/)
- [Star Ruler "Gold" Review - SpaceSector.com](https://www.spacesector.com/blog/2011/09/star-ruler-gold-review/)
- [Star Ruler Review - SpaceSector.com](https://www.spacesector.com/blog/2010/09/star-ruler-review/)
- [Star Ruler 2 Review - eXplorminate](https://explorminate.org/star-ruler-2/)
- [Star Ruler 2 Review - The Escapist](https://www.escapistmagazine.com/star-ruler-2-review-unique-in-nearly-every-way/)
- [GA 2.0 Dev Update #1 - Research Explained (Galactic Armory mod)](https://www.moddb.com/mods/galactic-armory/news/ga-20-dev-update-1-research-explained)
- [BlindMindStudios/StarRuler2-Source (GitHub)](https://github.com/BlindMindStudios/StarRuler2-Source)
- [OpenSRProject/OpenStarRuler (GitHub)](https://github.com/OpenSRProject/OpenStarRuler)
- [Star Ruler 2 is now Open Source! (Steam Discussion)](https://steamcommunity.com/app/282590/discussions/1/1710690176754840807/)
- [Star Ruler Source Code Discussion (Steam)](https://steamcommunity.com/app/70900/discussions/0/3051734364734148075/)
- [Star Ruler 2 Research Changes (Steam Discussion)](https://steamcommunity.com/app/282590/discussions/1/617319460919145379/)
- [Star Ruler Forum Thread - SpaceBattles](https://forums.spacebattles.com/threads/star-ruler.207365/)
- [Star Ruler Steam Community Discussions](https://steamcommunity.com/app/70900/discussions/0/846942156152600900/)
