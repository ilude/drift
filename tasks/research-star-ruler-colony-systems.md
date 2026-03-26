# Star Ruler 1 & 2: Colony and Planet Management Systems

Game design research reference. Focused on player experience and practical gameplay.

---

## Star Ruler 1

### 1. Planet Colonization

Colony ships are purpose-built vessels with a Colonizer module. The colonizer's scale determines how many starting buildings the new colony gets: every 15 size-units of colonizer yields one initial building. A scale-15 ship with a scale-4 colonizer lands 4 buildings. Players quickly learn to maximize either colonizer scale or cargo capacity -- a colony ship with a huge cargo bay dumps all stored resources onto the planet surface on landing, giving the new colony a massive economic head start. This cargo-dump trick is more impactful than a bigger colonizer in most cases.

You cannot boost an already-colonized planet with additional colony ships. Once it's founded, the colony grows through its own economy and imports via spaceports.

**Player experience:** Early game is a land-rush. You want the biggest planets in each system first (more building slots). The tension is expanding fast enough to claim territory without over-extending your economy -- colonizing too fast starves existing worlds of resources.

### 2. Building Slots and Structures

Each planet has a fixed number of building slots determined by planet size, ranging roughly from small single-digit planets up to ~30+ slots on large worlds (the theoretical maximum is 50 in the data files). Planets also have 1-2 random planetary conditions that modify construction or production (e.g., "strong winds -- buildings cost 50% more" or "geothermal vents -- +25% electronics/advanced parts production").

**Core building types:**

| Building | Function |
|---|---|
| City | Provides population, some labor |
| Farm | Produces food (population starves without it) |
| Metal Mine | Extracts ore, refines to metal |
| Electronics Factory | Converts metal to electronics (2:1 ratio) |
| Advanced Parts Factory | Converts metal + electronics to advanced parts (2 metal + 1 electronic) |
| Shipyard | Provides labor for ship/station construction |
| Spaceport | Transfers resources to/from the Galactic Bank (empire resource pool) |
| Goods Factory | Produces goods (prevents unhappiness) |
| Luxury Factory | Produces luxuries (boosts happiness, increases production) |
| Science Lab | Generates research |
| Capital | Special building, stores more food, administrative center |
| Storage | Holds resources on-planet |
| Defenses | Shield emplacements, weapon emplacements |

**Typical starting planet layout (25 slots):** 4 mines, 3 electronics factories, 2 advanced parts factories, 1 spaceport, 1 shipyard, 7+ cities, 2 farms, galactic capital.

**Spaceport scaling rule of thumb:** ~2 spaceports for planets under 16 slots, ~5 for planets near 30 slots. Spaceports are the logistical bottleneck -- without enough, the planet can't import/export fast enough to sustain production.

**Key mechanic -- instant construction:** Unlike most 4X games, SR1 has no build timers. If you have enough resources stockpiled at the build site, construction is instant. If not, the planet pulls from the Galactic Bank via spaceports. This makes spaceport capacity a critical throughput constraint rather than just a nice-to-have.

**Resource chain:**
- Ore (finite but never fully depletes -- extraction rate drops as reserves fall) -> Metal
- Metal -> Electronics (2:1)
- Metal + Electronics -> Advanced Parts (2:1:1)
- Metal is semi-finite: each planet has a reserve that decays to a floor. Mid-game, you need orbital mining ships and processing stations to keep up.

### 3. Governor System

Governors are the primary automation tool. You assign a governor type to each planet, and it automatically queues and builds structures according to that profile. Governor types include:

- **Balanced (default):** Mix of everything -- mines, factories, cities, farms, spaceports, shipyards, labs. The safe choice for new colonies.
- **Research:** Prioritizes science labs with minimal food/housing support.
- **Shipyard:** Focuses on shipyard capacity and supporting infrastructure.
- **Economic:** Emphasizes raw material production (mines, factories), builds spaceports.
- **Single-resource governors:** Focus on one resource type (metal, electronics, etc.). Build spaceports to export surplus.
- **Renovate-Only:** Upgrades existing buildings to higher-tech versions but doesn't change the building mix.

**Behavior details:**
- All governors except Balanced and Renovate-Only will steadily demolish unrelated buildings to make room for their specialty.
- Colony ships have their own hardcoded initial build list (defined in script, not XML), independent of the governor assigned.
- Governors are defined in `build_queues.xml` and are moddable. They use ratio-based logic: "BuildPerN per 5" means "build 1 of these for every 5 existing buildings."
- As tech advances, governors automatically upgrade structures to better versions.

**Player experience:** Governors are essential past the first 20 minutes. The typical workflow: colonize, assign governor, forget about it until something goes wrong. Experienced players eventually turn off governors on developed worlds and hand-tune the building mix, replacing excess buildings with defenses or shipyards as the strategic situation demands.

**Effectiveness:** Governors are adequate but not optimal. They follow simple ratio rules, not strategic awareness. They don't know the empire needs more electronics right now, or that this system is on the front line and needs defenses. Players who micro-manage outperform governors significantly, but at the cost of tedium once you have 50+ worlds.

### 4. Population and Labor

**Population** lives in Cities and the Capital. Population grows when food is available and declines when it's not. Population provides workers for all buildings -- a building without workers produces nothing or produces at reduced capacity.

**Happiness/Morale** is per-planet with three tiers:
1. **Food** -- Base necessity. Without it, population starves and mood craters.
2. **Goods** -- Secondary need. Without goods, population becomes unhappy, slowing production.
3. **Luxuries** -- Bonus. With luxuries, population becomes happy, speeding up production.

Critical nuance: if mood is negative (from lack of food/goods), the population reduces luxury consumption. You can't just flood luxuries to compensate for missing necessities -- you have to fix the basics first, then luxuries amplify from there.

**Labor** is generated by Cities (small amount) and Shipyards (large amount). Labor is the currency for constructing ships, stations, and buildings. Combined with the instant-construction mechanic, the effective "build speed" of a planet is determined by: (a) labor generation rate, (b) resource stockpile/import rate, and (c) spaceport throughput.

Alternative: you can just enslave your population. They produce without needing goods or luxuries, but at reduced effectiveness.

### 5. Planet Specialization

Specialization emerges from the governor system and the slot constraint. Common patterns:

- **Factory world:** All mines + electronics/advanced parts factories + enough cities/farms to staff them + spaceports for export. These are your economic engine.
- **Research world:** Mostly science labs + minimal food/housing. Feed via imports from factory worlds.
- **Farm world:** All farms + enough spaceports to export food to other colonies. Necessary for large empires.
- **Shipyard world:** Shipyards + cities for labor + spaceports for resource import. Late-game variant: pure spaceport planets in systems with orbital construction stations, using hauler ships to feed resources from the Galactic Bank at maximum throughput.
- **Luxury world:** Luxury factories to keep empire-wide happiness high.
- **Fortress world:** Defenses (shields, weapons) + enough economy to sustain. Late-game conversion of front-line planets.

**Progression pattern:** Early game starts Balanced everywhere, then specialization kicks in as you understand your economy's bottlenecks. A common mid-game pivot: "I'm short on electronics" -> re-assign a few balanced worlds to Economic/single-resource governors -> surplus recovers. Late game, experienced players manually re-tune worlds, often converting peaceful interior worlds to pure production and front-line worlds to fortress configurations.

### 6. Scaling to Many Colonies

**The governor system is what makes scaling possible.** Without it, the game would be unplayable past 10 planets.

- **50 planets:** Comfortable. Governors handle most of it. You're manually tweaking maybe 5-10 key worlds.
- **100 planets:** Manageable but tedious. The Galactic Bank abstraction helps -- you don't need to manually route resources between specific planets. But you're spending more time on macro-economy (noticing resource shortages) than micro (individual building placement).
- **150 planets:** Community consensus sweet spot for a "fun game."
- **1000+ systems:** Technically possible (the game supports up to a million star systems), but management becomes painful. Game speed slowdown helps, but the fundamental issue is that governors don't make strategic decisions -- they just follow ratios.

**What breaks down at scale:**
- **Resource visibility:** Hard to tell which planet is the bottleneck. The Galactic Bank pools everything, which is great for logistics but terrible for diagnosis.
- **Governor limitations:** Governors don't adapt to empire-level needs. If you need more of one resource, you have to manually re-assign governors across many planets.
- **Spaceport throughput:** The resource transfer system becomes a hidden bottleneck. Planets can't pull resources fast enough if spaceport capacity isn't scaled up.
- **Performance:** Late-game crashes reported, possibly related to defensive AI systems. Frame rate degrades with massive fleets.
- **Snowball effect:** More planets -> more research -> better tech -> easier expansion. The game lacks natural scaling friction, so the winning strategy is always "expand faster."

---

## Star Ruler 2

### 1. The Pressure/Level System in Practice

Star Ruler 2 fundamentally changed colony management. Instead of placing individual buildings, you manipulate **pressure** -- an abstract force that tells your civilian population what to build. You don't build factories. You import resources that create "money pressure," and your civilians build income-generating structures automatically.

**Walking through a new colony (Level 0 to 3):**

1. **Colonize:** Right-click an uncolonized planet, select "Colonize." 1 billion population transfers from a source world. The planet starts at Level 0 with 1 population, -80k income, and 0 pressure capacity. At this point, the planet is an economic drain. If it has a Tier 0 resource (food, water, iron, etc.), that resource is immediately available for export without leveling.

2. **Level 1:** Import 1 Food + 1 Water from two Tier 0 planets. The planet levels up to Level 1: 3 population, +80k income, 1 pressure capacity. If the planet has a Tier 1 resource, it can now be exported. The pressure capacity is low, so the planet won't produce much on its own -- it's mainly valuable for its exportable resource.

3. **Level 2:** Import 2 Food + 1 Water + 1 Tier 1 resource. Now the planet has 8 population, +350k income, and 14 pressure capacity. This is where things get interesting -- 14 pressure means the planet can support significant civilian construction. The imported Tier 1 resource determines what the civilians build: if you imported Textiles (+3 Money pressure), they build income structures. If you imported Chemicals (+3 Research pressure), they build universities.

4. **Level 3:** Import 3 Food + 1 Water + 2 Tier 1 resources + 1 Tier 2 resource. Population 16, +500k income, 32 pressure capacity. This is a workhorse planet. With 32 pressure capacity, it can absorb substantial pressure and produce meaningfully. The mix of imports determines its economic role.

**What decisions matter:**
- Which resources to import (determines the planet's economic output via pressure type)
- Which planet to invest in leveling (higher-tier native resources are more valuable to level)
- Where in the supply chain this planet sits (feeder planet vs. endpoint)

**What the workflow actually feels like:** Select planet, right-click target, choose export. Repeat. For Level 2+, you're doing this across many planets simultaneously. The game provides a Planets screen with drag-and-drop resource management and an auto-import button. Early game is manual; late game is mostly auto-import with occasional manual intervention.

### 2. Resource Export Connections

**Manual export:** Select source planet, right-click destination, choose which resource to export. The resource becomes "locked" to that destination -- it can only be available on one planet at a time.

**Auto-import:** Select a planet, click auto-import, and the game automatically finds and assigns nearby planets with the resources needed for the next level-up. This is convenient but suboptimal -- it grabs the nearest available resource without considering the broader network efficiency.

**When manual matters:**
- Setting up your first few Level 2-3 planets (getting the pressure types right)
- After losing a planet in war (the network breaks and auto-import may make poor choices rebuilding it)
- Terraforming workflows (need to free up exporting planets)
- Optimizing pressure allocation on key worlds

**When auto-import is fine:**
- Mass-colonizing Tier 0 food/water worlds (they just need to exist and export)
- Late-game when you have 50+ planets and can't track everything
- Filling in gaps after major network restructuring

**Territory constraint:** Resources can only be traded within connected territory. If your empire is split into two disconnected zones, you need Commerce Stations or Gates to bridge them (see section 5).

### 3. Civilian Auto-Construction

Two building categories exist in SR2:
- **Imperial buildings:** You place them, you pay for them, you pay maintenance. These are strategic structures (defenses, orbitals, special buildings).
- **Civilian buildings:** Auto-built by your population based on pressure. Cost nothing to build or maintain. You cannot directly control what gets built.

**How it feels in practice:** Passive, but intentionally so. The design philosophy is "you are the emperor, not the city planner." You set economic direction via resource imports; your civilians execute.

**Player control comes from:**
- Choosing which resources to import (determines pressure type -> building type)
- Building Metropolises (+6 pressure cap) or Megacities (space-efficient population + pressure cap)
- Leveling up the planet (higher level = more population = more pressure capacity)
- Importing Aluminum (raises pressure cap)
- Strategic placement of imperial buildings (which take surface tiles away from civilian buildings)

**The control/passivity tension:** Some players love the hands-off approach -- it keeps you focused on empire-level strategy and prevents getting bogged down in building queues for 50+ planets. Other players feel detached, like they're playing a logistics puzzle rather than managing a civilization. The lack of direct control over civilian building is SR2's most polarizing design decision.

**When it works well:** Large empires (30+ planets). You simply cannot manually manage building queues at that scale, so the abstraction is welcome.

**When it frustrates:** When you know exactly what you want a planet to produce but can't directly make it happen. You have to manipulate pressure indirectly, which feels like steering with suggestions rather than commands.

### 4. The Resource Pyramid

The pyramid structure defines SR2's economy. Higher-tier planets require imports from many lower-tier feeder planets.

**Level requirements (cumulative, including feeders):**

| Level | Direct Imports | Total planets needed (including feeder chains) |
|---|---|---|
| 0 | None | 1 (itself) |
| 1 | 1 Water + 1 Food | 3 (itself + 2 feeders) |
| 2 | 1 Water + 2 Food + 1 T1 | ~7 (the T1 planet itself needs leveling) |
| 3 | 1 Water + 3 Food + 2 T1 + 1 T2 | ~15-20 |
| 4 | 1 Water + 4 Food + 4 T1 + 2 T2 | ~25-30 |
| 5 | (Adds T3 requirements) | ~30-40+ |

**The math for a Level 4 planet (total chain):** Water x11, Food x17, Level 1 planets x7, Level 2 planets x3. A single Level 5 planet requires roughly 30-40 feeder planets when you account for the full recursive chain.

**Practical pyramid shape:**
```
                    [Level 5 Capital]
                   /        |        \
          [L3 planet]  [L3 planet]  [L2 planets...]
          /    |   \
   [L2]  [L1] [L1]  [Food] [Food] [Water]
    |      |    |
  [Food] [F] [Water]
   ...cascading food/water feeders...
```

**Tier 0 key insight:** Tier 0 planets (food, water, basic materials) can export from Level 0. They never need to be leveled up. This is crucial -- it means feeder planets are "free" in terms of resource investment, costing only the -80k income drain of an unleveled colony.

**Pressure capacity by level:**
| Level | Population | Income | Pressure Cap |
|---|---|---|---|
| 0 | 1B | -80k | 0 |
| 1 | 3B | +80k | 1 |
| 2 | 8B | +350k | 14 |
| 3 | 16B | +500k | 32 |
| 4 | 24B | +1M | 60 |
| 5 | 36B | +1.6M | 100 |

The jump from Level 1 (1 pressure) to Level 2 (14 pressure) is massive. Level 2 is where a planet starts actually producing. Levels 3-5 are economic powerhouses. This creates a clear tier structure: most planets exist only to feed a few key high-level worlds.

**Income math:** On default settings, ~5 Level 2 planets generating ~1250k total income is enough to start absorbing the cost of building a Level 5 chain. Most games support 1-2 Level 5 planets. You need 300+ planet maps to sustain more.

### 5. Territory and Trade

**Territory** is defined as a contiguous block of space your empire controls. Resources can only be traded within the same territory. Your trade zone extends one "hop" beyond your border.

**When territory splits:** If your empire gets cut in two (enemy captures systems in the middle, or you colonize distant systems), you have two disconnected territories. Resources cannot flow between them without bridging.

**Commerce Stations:** Orbital structures that bridge disconnected territories for trade. You need one in each disconnected zone. They also extend your border one system outward, functioning as a cheaper alternative to establishing a full colony for border expansion. Cost: built with labor; can also spend 500k to buy research, production speed, diplomacy, or energy.

**Gates:** Permanent FTL connections between any two gate structures. Ships enter one gate and exit any other. Gates also enable trade between their zones (unlike Slipstreams, which are temporary and don't enable trade). Gates can be packed up and moved. Each gate has an FTL upkeep cost. Gates can be destroyed or boarded by enemies, breaking the connection.

**Trade agreements (diplomacy):** Allow you to use another empire's territory as a trade zone. Critical for bridging gaps through allied/neutral space.

**When trade routes break:** Losing a planet that sits in the middle of your resource network is devastating. The immediate effect: all planets that depended on imports through that system lose their imports, potentially dropping levels. Retaking the planet does NOT restore previous connections -- you have to manually re-establish the entire export network. This is one of the most-criticized aspects of SR2's design: a brief enemy incursion can require 10+ minutes of network rebuilding.

### 6. What Worked and What Didn't

**What players loved:**
- **Innovative design:** The resource network felt genuinely new for the 4X genre. "A type of evolution for the genre."
- **Streamlined colonization:** Less than one click to colonize in some cases. No colony ship micromanagement.
- **Leveling system:** Surprisingly enjoyable. Building up a Level 5 capital from scratch feels like a real achievement.
- **Empire-level thinking:** Forces you to think about your economy as a network rather than a collection of isolated worlds. Strategic decisions about which planets to invest in feel meaningful.
- **Ship design sandbox:** (Not colony-related, but universally praised.)
- **Scale handling:** The abstraction makes 50+ planets feel manageable.

**What frustrated players:**
- **Network fragility in war:** Losing one planet can cascade-break dozens of connections. Retaking doesn't restore them. This is the single most common complaint.
- **No attachment to individual worlds:** "You don't really care about any individual worlds or grow attached to them except for the inconvenience of how losing one messes up your network." Planets feel like nodes in a graph, not places.
- **Obtuse systems:** New players struggle to understand pressure, pressure capacity, tier requirements, and why their economy isn't working. "Some systems such as the economy, resource dependency, and planetary development are too obtuse even after hours of play."
- **Infinite colony spam (ICS):** No reason not to colonize everything. Tier 0 planets cost nothing to maintain long-term, and every food/water planet is useful. No natural scaling friction.
- **Shallow individual planets:** Most planets do exactly one thing (export their resource). There's no meaningful per-planet development beyond "level it up enough to export."
- **Abstract feel:** "Plays more like a big abstract puzzle." Importing fruit to get electronics to level up your homeworld doesn't create narrative immersion.
- **Auto-import limitations:** Auto-import is convenient but makes poor choices. Manual management is tedious at scale. No good middle ground.
- **Pressure over-cap waste:** Exceeding pressure capacity causes 50% efficiency loss, but the game doesn't clearly communicate when this is happening or how to fix it.

**Overall reception:** Metacritic reviews are generally positive. The game is respected for its ambition and innovation. The colony system is its most unique feature and also its most divisive -- players either love the network-building puzzle or find it soulless and frustrating.

---

## 7. SR1 vs SR2: Colony Management Philosophy Comparison

### The Fundamental Shift

| Aspect | Star Ruler 1 | Star Ruler 2 |
|---|---|---|
| Core metaphor | City planner | Emperor/logistics director |
| Building placement | Manual (with governor automation) | Fully automated (pressure-driven) |
| Planet identity | Strong (unique building mix, conditions) | Weak (defined by native resource tier) |
| Resource flow | Pooled (Galactic Bank) | Network (explicit export connections) |
| Scaling mechanism | Governors (ratio-based automation) | Pressure system (remove the decision entirely) |
| Player attachment to planets | High (you built this) | Low (it's a node in your network) |
| Information clarity | Direct (see buildings, see production) | Abstract (pressure, capacity, efficiency) |
| Failure mode at scale | Tedium (too many planets to optimize) | Fragility (network breaks cascade) |

### Why They Changed

SR1's governor system worked for its era but had clear scaling problems. At 100+ planets, even with governors, you needed periodic manual intervention. The game's "no build timers" design meant throughput was constrained by spaceports and resource availability, creating invisible bottlenecks that were hard to diagnose.

SR2 was designed partly for "quick multiplayer matches" -- the developers explicitly wanted to reduce time spent on planet management so players could focus on fleet composition, diplomacy, and territorial strategy. The pressure system achieves this: once you set up imports, planets develop themselves.

### Was It Successful?

**For the intended goal (reducing micro, enabling larger empires):** Yes. SR2 handles 50+ planets with less player effort than SR1 handles 20.

**For player satisfaction:** Mixed.

The players who wanted a "big picture" strategy game loved it. The players who enjoyed the tactile satisfaction of building up individual worlds -- choosing exactly which buildings go where, optimizing production chains at the planet level -- felt the game took something away without replacing it.

The most telling criticism: in SR1, losing a planet was a military setback. In SR2, losing a planet is an administrative nightmare. The shift from "I lost my shipyard world" (clear, tangible) to "I need to rebuild 15 export connections" (abstract, tedious) is the cost of the abstraction.

### Key Design Lessons

1. **Abstraction trades one problem for another.** SR1's problem was tedium at scale. SR2's problem is fragility and detachment. Neither is solved.

2. **Players want to feel ownership over places.** SR1's building slots created identity ("my research world"). SR2's pressure system creates function ("the Tier 2 node in my network"). Function is less emotionally engaging.

3. **The pooled-vs-network resource model is a deep choice.** SR1's Galactic Bank hides logistics complexity (good for simplicity, bad for diagnosis). SR2's explicit connections surface logistics complexity (good for strategy, bad for maintenance burden).

4. **Governor effectiveness matters more than governor existence.** SR1's governors were simple ratio-followers that didn't adapt to empire needs. A smarter governor -- one that could detect "the empire is short on electronics" and adjust accordingly -- might have preserved the direct-control feel while solving the scaling problem.

5. **Fragile networks need fast repair tools.** SR2's biggest UX failure is that retaking a planet doesn't restore connections. An "undo last disruption" or "restore previous network state" feature would have dramatically improved the war experience.

6. **ICS needs structural resistance.** Both games suffer from colony spam. SR2's Tier 0 planets cost -80k but that's negligible. A meaningful per-colony overhead (administrative capacity, governor limits, influence cost) would create interesting colonization decisions instead of "colonize everything."

7. **The best system might be a hybrid.** Direct control for key worlds (your capital, your fortress world, your Level 5 powerhouse) with automated management for the feeder tier. SR1's governors on SR2's network structure, with the ability to override the automation when it matters.

---

## Sources

### Star Ruler 1
- [Colonization ship questions - Steam](https://steamcommunity.com/app/70900/discussions/0/357286663676360576/)
- [How do you make colonized systems to grow? - Steam](https://steamcommunity.com/app/70900/discussions/0/357287304420655698/)
- [Question on Adding Governors - Steam](https://steamcommunity.com/app/70900/discussions/0/4783413655229044290/)
- [Star Ruler - One of my favourite 4X games](https://itsmorethanjustgaming.com/2018/03/12/star-ruler-one-of-my-favourite-4x-games/)
- [Some basic questions - Steam](https://steamcommunity.com/app/70900/discussions/0/353915847942534307)
- [Does anybody have some healthy advice for a Novice? - Steam](https://steamcommunity.com/app/70900/discussions/0/846942156152600900)
- [Star Ruler Elite mod progress - Steam](https://steamcommunity.com/app/70900/discussions/0/1470841715930747530/)
- [Star Ruler - TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/StarRuler)
- [Star Ruler patch notes - Steam](https://store.steampowered.com/oldnews/4419)

### Star Ruler 2
- [Planets and Resources - SR2 Wiki](http://wiki.starruler2.com/Planets_and_Resources)
- [Buildings and Orbitals - SR2 Wiki](http://wiki.starruler2.com/Buildings_and_Orbitals)
- [FAQ: Pressure - SR2 Wiki](http://wiki.starruler2.com/FAQ:Pressure)
- [SR2 Economy Guide - Steam](https://steamcommunity.com/sharedfiles/filedetails/?id=752803956)
- [What's 'pressure'? - Steam](https://steamcommunity.com/app/282590/discussions/1/611702631238914053/)
- [Basic questions about the economy - Steam](https://steamcommunity.com/app/282590/discussions/1/1473095965285204311/)
- [Auto-import or manual? - Steam](https://steamcommunity.com/app/282590/discussions/1/594820656473089722/)
- [Commerce Station questions - Steam](https://steamcommunity.com/app/282590/discussions/1/343786745997413625/)
- [Territory - Steam](https://steamcommunity.com/app/282590/discussions/1/1368380934266802454/)
- [Suitable level 5 planets - Steam](https://steamcommunity.com/app/282590/discussions/1/523890046868307296/)
- [Upgrading planets - Steam](https://steamcommunity.com/app/282590/discussions/1/142261352642935994)
- [Suggestions for reducing micro-management - Steam](https://steamcommunity.com/app/282590/discussions/1/37470848284841273)
- [Impossibly frustrating - Steam](https://steamcommunity.com/app/282590/discussions/1/1697167168519438648/)
- [Infinite Colony Spam - Steam](https://steamcommunity.com/app/282590/discussions/1/34095131944728640)
- [Star Ruler 2 Review - SpaceSector](https://www.spacesector.com/blog/2015/05/star-ruler-2-review/)
- [Star Ruler 2 Review - eXplorminate](https://explorminate.org/star-ruler-2/)
- [Star Ruler 2 - Before I Play](https://beforeiplay.com/index.php?title=Star_Ruler_2)
- [A 4X-RTS Comparison - Awkward Mixture](http://awkwardmixture.blogspot.com/2018/02/a-4x-rts-comparison-sins-of-solar.html)
- [Star Ruler 1/Star Ruler 2 - SpaceBattles](https://forums.spacebattles.com/threads/star-ruler-1-star-ruler-2.329736/)
