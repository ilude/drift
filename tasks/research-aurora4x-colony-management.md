# Aurora 4X Colony Management System — Reference Document

Game design research for Drift. All mechanics described here are from Aurora 4X (C# version unless noted).

---

## 1. Colony Establishment

### How Colonies Are Created
A colony can be established on any system body except gas giants and super-jovians. The player designates a body as a colony (right-click on system map or via the system view list). This is purely administrative — the colony has no population or installations until you ship them there.

### Colony Ships
Colony ships transport population between worlds. Example designs:
- **Spruance class**: 4,500 tons, 236 crew, carries 50,000 colonists, ~108 day range
- **Ark class**: 8,850 tons, 457 crew, carries 100,000 colonists, ~108 day range

Colony ships are built in commercial shipyards (which start at 10,000-ton capacity). Early game, 50,000 tons of cargo capacity may not be enough for all colonization needs.

### Minimum Viable Colony
A colony does not require population at all. The simplest colony is a single installation (e.g., a Deep Space Tracking Station as a listening post). For productive mining, automated mines require no workers — ship a few dozen automines to a mineral-rich body and you have a functioning mining colony with zero population.

For a populated colony, you need:
- Population (transported via colony ships)
- Infrastructure (if colony cost > 0) to keep them alive
- Installations (factories, mines, etc.) to be productive

### Colony Cost
Colony cost represents how hostile the environment is. It is determined by the **worst** of several factors:

| Factor | Colony Cost Formula |
|--------|-------------------|
| Temperature outside tolerance | Degrees outside range / (half of species range) |
| Low gravity | Fixed 1.00, suffixed "LG" — requires underground infrastructure |
| Insufficient water | (20 - hydro%) / 10 (max 2.00) |
| Dangerous atmosphere | 2.00 for most toxic gases; 3.00 for chlorine/fluorine/bromine |
| Tide-locked worlds | 80% reduction to temperature colony cost factor |

A colony cost of 0.00 means the planet is fully habitable — no infrastructure needed, minimal workforce overhead.

### Infrastructure Requirements
- **Max population** = (Infrastructure x 10,000) / Colony Cost
- **Infrastructure needed** = Population (millions) x Colony Cost x 100
- Example: 1M people on a CC 2.0 world needs 200 infrastructure
- If population exceeds max, deaths occur and civil unrest increases
- Infrastructure costs 2 BP each, weighs 25,000 tons per unit to transport
- **Underground infrastructure** (for low-gravity worlds): 10 BP each, cannot be transported (must be built on-site), world treated as CC 3.0 for support calculations

### Self-Sufficiency Timeline
A colony becomes self-sustaining when it has enough construction factories, mines, and fuel refineries to produce its own needs without imports. This typically takes decades of game time for a major colony. Mining outposts with automines never become "self-sustaining" in the traditional sense — they just export minerals.

---

## 2. Colony Installations (Buildings)

### Production Installations

| Installation | Purpose | Workers | Base Rate | BP Cost | Notes |
|-------------|---------|---------|-----------|---------|-------|
| **Construction Factory** | Builds all other installations, PDCs, space stations | 50,000 | 10 BP/year | 120 BP | Upgradeable via research |
| **Mine** | Extracts minerals | 50,000 | 10 units/year | 120 BP | Rate reduced by accessibility (0.6 acc = 6/year) |
| **Automated Mine** | Extracts minerals without workers | None | 10 units/year | 240 BP | 2x cost of regular mine; can convert mines for 150 BP |
| **Fuel Refinery** | Converts sorium to fuel | 50,000 | Racial rate/year | Standard | 1 sorium = 2,000 litres of fuel |
| **Ordnance Factory** | Produces missiles | 50,000 | 10/year | Standard | Upgradeable via research |
| **Fighter Factory** | Builds fighters (<=500 ton craft) | 50,000 | Standard | Standard | Fighters don't need shipyards |
| **Research Lab** | Generates research points | 50,000 | 200 RP/year | Standard | Upgradeable via research |
| **Financial Centre** | Generates wealth | 50,000 | Equivalent to 250K workers' tax | Standard | Critical for industrial colonies |

### Military & Shipyard Installations

| Installation | Purpose | Workers | Notes |
|-------------|---------|---------|-------|
| **Naval Shipyard Complex** | Builds military ships | 1,000,000 base + 100/ton capacity | Starts at 1,000-ton capacity, 1 slipway |
| **Commercial Shipyard Complex** | Builds civilian ships | 100,000 base + 10/ton capacity | Starts at 10,000-ton capacity, expands faster |
| **Maintenance Facility** | Supports orbiting ships, produces MSP | 50,000 | Supports 1,000-6,250 tons per facility (tech dependent) |
| **Military Academy** | Trains leaders and crew | N/A | 5 leaders + 1,000 crew per year per academy |
| **Ground Force Training Facility** | Trains/upgrades ground units | N/A | Converts conventional to TN units |
| **Deep Space Tracking Station** | Passive thermal/EM sensors | N/A | Base rating 200, upgradeable |

### Logistics Installations

| Installation | Purpose | Notes |
|-------------|---------|-------|
| **Mass Driver** | Launches mineral packets to other colonies | 5,000 tons/year sending; unlimited receiving. Intra-system only. |
| **Spaceport** | Fuel/missile transfer to ships, speeds loading | Required for efficient ship servicing |
| **Cargo Shuttle Station** | Speeds cargo loading/unloading | C# only |
| **Refuelling Station** | Allows fuel transfer to ships | C# only |
| **Ordnance Transfer Station** | Allows missile transfer | C# only |

### Environment & Governance

| Installation | Purpose | Notes |
|-------------|---------|-------|
| **Terraforming Installation** | Modifies atmosphere | 250,000 workers; 0.001 atm/year base; mass 125,000 tons (5x normal) |
| **Genetic Modification Centre** | Creates engineered sub-races | 250,000 pop/year conversion rate |
| **Sector Command** | Enables sector governor assignment | 1/4 of sector governor bonuses apply to all colonies in range |
| **Infrastructure** | Supports population on hostile worlds | 2 BP each; formula above |
| **Forced Labour Construction Camp** | Cheaper factories, consumes population | C# only; causes unrest |
| **Forced Labour Mining Camp** | Cheaper mines, consumes population | C# only; causes unrest |

### Conventional Industry (Pre-TN)
Before Trans-Newtonian technology, colonies use **Conventional Industry** — a generalist installation that produces a mix of fuel, industrial output, and mining. Once TN tech is researched, conventional industry is converted into specialized TN installations (construction factories, fuel refineries, mines, etc.).

---

## 3. Population Mechanics

### Population Sectors
All population is divided into three mandatory sectors:

1. **Agriculture & Environment (A&E)**: Keeps everyone alive.
   - Required: **5% + (5% x Colony Cost)**
   - CC 0.0 = 5%, CC 2.0 = 15%, CC 8.0 = 45%

2. **Service Industries (SI)**: Non-manufacturing services.
   - Automatically assigned based on total population size
   - Grows proportionally as population increases (larger populations need more services)
   - Combined with A&E at CC 8.0, leaves only ~33% for manufacturing

3. **Manufacturing**: The productive remainder.
   - All factories, mines, shipyards, research labs must be staffed from this pool
   - Each installation requires 50,000 workers (except shipyards which need more)

### Population Growth
- Growth rate is inversely proportional to population size — small colonies grow faster (percentage-wise)
- Large populations grow at ~2% or less per year
- Modified by planetary and sector governor Population Growth bonuses
- **Population Capacity** (C#): Maximum population based on body surface area. Earth-sized = 12 billion max, 4 billion is the inflection point. Growth follows normal rules up to 1/3 of max capacity, then linearly declines to zero at max.
- If population exceeds infrastructure-supported maximum: deaths and civil unrest

### Population Transport
- Colony ships carry colonists (50,000-100,000 per trip typically)
- Civilian shipping lines also transport colonists automatically between colonies
- Civilian ships never use jump engines — requires Jump Gates for inter-system colonist transport
- Military colony ships can use jump drives

### Worker Allocation
Workers are consumed by installations at fixed rates:
- Standard installation: 50,000 workers each
- Naval shipyard: 1,000,000 base + 100 per ton of total capacity per slipway
- Commercial shipyard: 100,000 base + 10 per ton of total capacity per slipway
- Terraforming installation: 250,000 workers

If you don't have enough manufacturing-sector workers, installations sit idle.

---

## 4. Colony Infrastructure & Development

### Building Up a Colony

**Manual approach** (military logistics):
1. Design and build freighters and colony ships
2. Ship infrastructure to the target world
3. Ship colonists via colony ships
4. Ship installations (factories, mines, etc.) via freighters
5. Set up repeating freight orders for ongoing supply

**Civilian automation** (civilian contracts):
1. Set a "demand" contract on the new colony for what you need (e.g., 50 mines)
2. Set a "supply" contract on the homeworld
3. Civilian freighters handle the shipping automatically
4. Cost: 2.5 wealth per cargo hold (same system), 5 wealth per jump (interstellar)

### Governor System
Every colony can have a **Planetary Governor** (civilian administrator) whose bonuses apply at full strength:
- Mining bonus → mineral production
- Factory Production → construction output
- Shipbuilding → shipyard output
- Population Growth → growth rate
- Wealth Creation → tax income
- Terraforming → atmospheric modification rate

**Sector Governors** oversee multiple systems from a Sector Command installation:
- Apply **1/4 of their bonuses** to all colonies in the sector
- Sector range: 1 HQ = 1 jump, 2 HQs = 2 jumps, 4 = 3 jumps, 8 = 4 jumps
- Stack with planetary governor bonuses

Administrators are trained at Military Academies, which produce 5 leaders per year per academy. Each has an Administration Rating determining the max population they can govern.

### Typical New Colony Development
1. **Year 0**: Designate colony, ship automines + mass driver (for mining outpost) OR infrastructure + colonists (for populated colony)
2. **Years 1-5**: Colony receives initial shipments; if populated, begin building construction factories on-site
3. **Years 5-15**: Colony begins producing its own installations; population grows
4. **Years 15-30**: Colony approaches self-sufficiency for basic needs
5. **Years 30+**: Mature colony can specialize and export

---

## 5. Resource Flow Between Colonies

### The Eight TN Minerals

| Mineral | Primary Uses |
|---------|-------------|
| **Duranium** | Most common; factories, mines, ship structures, general construction |
| **Neutronium** | Shipyards, advanced armor, kinetic weapons |
| **Sorium** | Jump drives, jump gates; refined into fuel (1 sorium = 2,000L fuel) |
| **Corbomite** | Shields and cloaking devices |
| **Tritanium** | Armor plating |
| **Boronide** | Power plants and capacitors |
| **Mercassium** | Research facilities, life support, tractor beams |
| **Vendarite** | Fighters, fighter factories, fighter bases |
| **Uridium** | Sensors, fire control systems |
| **Corundium** | Energy weapons, mining installations |
| **Gallicite** | Engines (ship, missile, fighter) |

*(Note: Aurora has 11 TN minerals total; the exact list varies slightly by version.)*

### Transport Methods

**Mass Drivers** (intra-system):
- Each launches 5,000 tons of minerals per year
- Unlimited receiving capacity
- Target colony MUST have its own mass driver or the packet impacts the surface (mass casualties)
- Cannot cross jump gates — system-local only
- Set destination via F2 → Mining and Maintenance tab
- Best for: high-volume, steady-state mineral flows within a system

**Military Freighters** (anywhere):
- Player-designed and controlled
- Can cross jump points with jump drives
- Set up repeating orders: Load minerals → travel → unload → return
- Best for: inter-system transport, flexible routing, early game before mass drivers

**Civilian Freighters** (automatic):
- Owned by Shipping Lines (private companies)
- Respond to supply/demand contracts set by the player
- Cannot use jump drives — require Jump Gates for inter-system travel
- Cost wealth per shipment (distance-based)
- Best for: hands-off logistics once jump gate infrastructure is built

### Logistics Chain Pattern
1. **Mining outpost** (automines + mass driver) → fires minerals to...
2. **System hub** (mass driver + stockpile) → freighters carry to...
3. **Industrial colony** (factories consume minerals, produce installations/ships)
4. **Forward base** (maintenance facilities, fuel depots for fleet support)

---

## 6. Colony Specialization Patterns

### Mining World
- **Setup**: Automines + mass driver on mineral-rich body
- **Population**: None required (automines are unmanned)
- **Infrastructure**: None (no population to support)
- **Key advantage**: Zero ongoing population management; just ship automines and forget
- **When to use**: Any mineral-rich body regardless of colony cost
- **Scaling**: Add more automines as needed; limited by mineral accessibility and quantity

### Factory World
- **Setup**: Construction factories, ordnance factories on habitable or low-CC world
- **Population**: Large — each factory needs 50K workers
- **Infrastructure**: Proportional to CC and population
- **Key advantage**: Centralized production; build installations and ship them out
- **When to use**: Habitable worlds with large populations (low CC = more manufacturing workers)
- **Scaling**: Exponential — factories build more factories. Limited by minerals and wealth

### Research World
- **Setup**: Research labs + military academies (for scientist training)
- **Population**: Moderate — 50K per lab
- **Key advantage**: Concentrated research output with good governor bonuses
- **When to use**: Any habitable world; ideally governed by a high-research-bonus administrator

### Shipyard World
- **Setup**: Naval and/or commercial shipyard complexes + maintenance facilities
- **Population**: Very large — naval yards need 1M+ workers each, plus 100 per ton per slipway
- **Infrastructure**: Massive for hostile worlds (rarely done on non-habitable planets)
- **Key advantage**: Ship construction and repair capability
- **When to use**: Habitable worlds with large populations; forward bases for fleet support
- **Scaling**: Add slipways (expensive) or build additional yard complexes

### Fuel Depot
- **Setup**: Fuel refineries + sorium mining (or sorium harvesters on gas giants)
- **Population**: 50K per refinery if ground-based
- **Key advantage**: Fueling infrastructure for fleet operations
- **Ship-based alternative**: Sorium Harvesters stationed at gas giants (20,000L/year/module base)

### Forward Military Base
- **Setup**: Maintenance facilities + fuel stockpile + ordnance stockpile + DSTS
- **Population**: Moderate (maintenance facilities need 50K each)
- **Purpose**: Fleet support away from homeworld; prevents maintenance clock from advancing
- **Key consideration**: Must be self-sustaining in MSP production or have supply chain

### What Drives Specialization
1. **Colony cost**: High-CC worlds can only support mining (automines, no population needed)
2. **Mineral availability**: Rich mineral deposits → mining specialization
3. **Population capacity**: Large habitable worlds → factory/shipyard (need huge labor pools)
4. **Strategic location**: Near jump points → forward bases, fuel depots
5. **Governor bonuses**: Match governor skills to colony purpose

---

## 7. Environmental and Habitability

### What Makes a Planet Habitable (CC 0.00)
- Hydrosphere >= 20% water coverage
- Breathable oxygen partial pressure (0.1-0.3 atm default)
- Oxygen relative pressure < 30% (fire risk above that)
- No dangerous gases above threshold concentrations
- Temperature within species tolerance range
- Gravity within species tolerance
- Minimum total atmosphere ~0.334 atm (0.1 atm O2 + 0.234 atm filler)

### Gravity
- Too high: body cannot be colonized at all
- Too low (below species tolerance): CC 1.00 "LG" — requires underground infrastructure
- Below 0.1g: atmosphere cannot be retained; cannot be terraformed
- Gravity cannot be changed by the player — it's a hard constraint

### Terraforming Mechanics
Terraforming installations modify atmospheric composition:
- Base rate: 0.001 atm/year/installation (upgradeable via research)
- Modified by governor bonuses (planetary + 0.25 x sector)
- Smaller bodies terraform faster (rate scales inversely with diameter)
- Cannot terraform bodies that don't retain atmosphere (<0.1g)

**Key gases:**
- **Oxygen**: The only breathable gas. Must be within pressure range.
- **Aestusium**: Safe greenhouse gas (raises temperature)
- **Frigusium**: Safe anti-greenhouse gas (lowers temperature)
- Non-greenhouse gases raise temperature slightly (1/10th effect per atm)
- Below -18C, water freezes out of atmosphere

**Terraforming strategy** (e.g., Mars-like world):
1. Add greenhouse gases to raise temperature above -18C
2. Once warm enough, water evaporates naturally
3. Add oxygen to breathable levels
4. Ensure non-toxic atmosphere
5. Colony cost drops as each factor improves (determined by worst single factor)

### Hostile Environment Colonies
For worlds that can't be terraformed (or while terraforming is in progress):
- **Infrastructure**: Supports population at cost proportional to CC
- **Orbital Habitats**: Ships without engines; population lives in orbit, ignoring surface conditions. Separate growth rate from surface population.
- **Automated Mines**: No population needed — bypass habitability entirely
- **Underground Infrastructure**: For low-gravity worlds only; 5x cost, built on-site

---

## 8. Early Game Colony Strategy

### Phase 1: Homeworld Buildup (Years 0-5)
1. **Build construction factories** — allocate ~50% of production to more factories (exponential growth)
2. **Build mines** — allocate ~20% to mines (keep mineral supply ahead of consumption)
3. **Build infrastructure** — allocate ~5% (stockpile for future colonies)
4. **Build military academies** — 5+ for leader/crew pipeline
5. **Begin research** — focus on construction rate, mining rate, propulsion
6. **Design ships** — survey vessels (grav survey + geo survey), freighter, colony ship
7. **Monitor Sorium** — fuel supply is often the first bottleneck

### Phase 2: First Expansion (Years 3-10)
1. **Survey home system** — grav survey for jump points, geo survey for minerals
2. **Colonize Luna/Mars** — easy first colonies, builds civilian shipping experience
3. **Ship infrastructure and terraforming installations** to Mars
4. **Identify mineral-rich bodies** — check accessibility (higher = faster mining)

### Phase 3: Mining Network (Years 5-15)
1. **Build automines** — convert or build new ones
2. **Ship automines to mineral-rich bodies** (asteroids, moons)
3. **Install mass drivers** at mining outposts AND receiving hub
4. **Set up civilian contracts** for ongoing logistics
5. **Build Jump Gate** to nearest system if survey reveals good targets

### Phase 4: Interstellar Expansion (Years 10-30)
1. **Establish forward bases** with maintenance facilities in strategic systems
2. **Build fuel infrastructure** — refineries at sorium-rich locations
3. **Specialize colonies** based on planet characteristics
4. **Expand shipyard capacity** — more slipways, higher tonnage
5. **Terraform promising worlds** for long-term habitable colonies

### Key Early Priorities
| Priority | Reason |
|----------|--------|
| More factories | Exponential industrial growth |
| More mines | Prevent mineral starvation |
| Survey ships | Find resources and jump points |
| Freighters | Move stuff between colonies |
| Colony ships | Move people |
| Fuel supply | Ships can't move without fuel; sorium runs out |

### Common Early Mistakes
- Building too many ship types before having industrial base
- Not reserving factory output for more factories
- Ignoring mineral accessibility when choosing mining targets
- Choosing distant mining targets (long freighter round trips)
- Not building Jump Gates for civilian shipping

---

## 9. Colony Capacity and Scaling

### Population Capacity (C# Aurora)
- Based on body surface area
- Earth-sized planet: ~12 billion maximum
- Growth normal up to 1/3 of max capacity (~4 billion for Earth-sized)
- Growth linearly declines from 1/3 to max, hitting zero at capacity
- This is total across ALL populations on the same body

### Scaling From Outpost to Major Colony

**Outpost** (0 population):
- Automines, mass driver, maybe a DSTS
- No workers needed, no infrastructure
- Pure resource extraction

**Small Colony** (< 1 million):
- Some infrastructure, basic installations
- High relative growth rate
- Cannot support shipyards (insufficient workers)
- Governors need low administration rating

**Medium Colony** (1-50 million):
- Self-sustaining in basic production
- Can support research labs, small shipyards
- Civilian shipping lines begin serving it
- Trade goods start appearing at various population thresholds (all 17 types available by 10M)

**Large Colony** (50-500 million):
- Major industrial output
- Can support multiple shipyard complexes
- Significant tax/wealth generation
- Service industry sector grows, reducing manufacturing percentage

**Major Population Center** (500M-5 billion):
- Full spectrum of installations
- Multiple specialized shipyards
- Financial centres needed to fund production
- Service industry overhead is significant

**Homeworld-Scale** (5+ billion):
- Maximum industrial potential
- Growth rate very low (<2%/year)
- Approaching population capacity on smaller worlds
- Wealth generation critical — financial centres essential

### Scaling Constraints
1. **Workers**: Every installation needs workers from the manufacturing sector. Larger service industry at high populations means diminishing returns on factory-to-population ratio.
2. **Minerals**: Factories consume minerals; local deposits deplete over time. Must import.
3. **Wealth**: Every build point costs 1 wealth. Large industrial colonies can bankrupt you without financial centres.
4. **Colony Cost**: High CC worlds lose huge percentages to A&E sector, capping effective industry.
5. **Governor Quality**: Better governors are force multipliers but scarce. Train many at academies.

### Shipyard Scaling Details
Shipyards scale differently from other installations:

- **Base cost**: 2,400 BP for a new complex
- **Starting capacity**: 1,000 tons (naval) or 10,000 tons (commercial)
- **Capacity expansion**: +500 tons costs 120 BP per slipway (naval) or 12 BP per slipway (commercial)
- **Slipway addition**: 120 BP per 500 tons of current capacity per slipway
- **Retooling**: Required when switching ship classes; first assignment is free, subsequent retooling costs time/resources
- **20% rule**: If a second ship class can be refitted from the primary class for <20% of the primary's cost, no retooling is needed

---

## Key Takeaways for Game Design

1. **Colony cost is the central habitability mechanic** — a single number derived from the worst environmental factor, creating a clean tradeoff between "easy but maybe resource-poor" habitable worlds and "hostile but mineral-rich" outposts.

2. **The population-workforce-installation triangle** drives all colony decisions: installations need workers, workers need infrastructure, infrastructure needs factories, factories need workers. Breaking this loop with automines (no workers needed) is the key innovation for hostile-world exploitation.

3. **Specialization emerges from constraints**, not from explicit colony types. Planet characteristics (minerals, habitability, location) naturally push colonies toward roles.

4. **Two logistics modes** — mass drivers (automated, intra-system, fire-and-forget) vs. freighters (flexible, inter-system, requires management or civilian contracts) — create meaningful infrastructure investment decisions.

5. **Civilian economy as autonomous agent** — shipping lines that grow, build ships, and handle logistics independently reduce micromanagement while creating emergent economic behavior.

6. **Exponential early game** — factories building factories is the core early-game loop. The tension between investing in growth (more factories) vs. immediate needs (ships, defenses) is the central strategic decision.

7. **Governor bonuses as soft specialization** — matching administrator skills to colony purpose provides meaningful but not overwhelming optimization.

8. **Colony cost workforce drain** is elegant — high CC doesn't just require infrastructure, it permanently taxes your productive capacity. CC 8.0 worlds lose 2/3 of their workforce to overhead.

---

## Sources

- [Colonization for Beginners — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Colonization_for_Beginners)
- [Colony — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Colony)
- [Installations — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Installations)
- [Installations — Aurora Wiki (C#)](https://aurorawiki2.pentarch.org/index.php?title=Installations)
- [Population and Production — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Population_and_Production)
- [Infrastructure — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Infrastructure)
- [Terraforming — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Terraforming)
- [Colony Cost and Terraforming — Aurora Forums](https://aurora2.pentarch.org/index.php?topic=1960.0)
- [Mass Driver — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Mass_Driver)
- [Commercial Shipping — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Commercial_Shipping)
- [Ship Maintenance — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Ship_Maintenance)
- [Wealth — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Wealth)
- [Civilian Economy — AuroraWiki (C#)](https://aurorawiki.pentarch.org/index.php?title=C-Civilian_Economy)
- [Trade System — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Trade_System)
- [Leaders — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Leaders)
- [Sector Command — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Sector_Command)
- [Shipyards and Shipbuilding — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Shipyards_and_Shipbuilding)
- [Construction Factory — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=Construction_Factory)
- [Fuel Refinery — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Fuel_Refinery)
- [System Bodies — AuroraWiki (C#)](https://aurorawiki.pentarch.org/index.php?title=C-System_Bodies)
- [Quickstart for Beginners — Aurora4x Fandom](https://aurora4x.fandom.com/wiki/Quickstart_for_Beginners)
- [Example Colony Ships — AuroraWiki](http://aurorawiki.pentarch.org/index.php?title=Example_Ships_-_Colony_Ships)
- [One Newbie's Guide to a Conventional Start — AuroraWiki](https://aurorawiki.pentarch.org/index.php?title=One_Newbie's_Guide_to_a_Conventional_Start)
- [Aurora Tutorial Part 1 — Naval Gazing](https://www.navalgazing.net/Aurora-Tutorial-Part-1)
- [Aurora 4x Tutorial Part 2 — 7w1](https://7w1.github.io/posts/tutorial2/)
