# Naval Gazing — Aurora 4X Reference

Source: [Naval Gazing Aurora Tag](https://www.navalgazing.net/Tags/Aurora)

14-part tutorial series + 8-part campaign playthrough + 2 mechanics articles. Compiled for Drift design reference — focuses on gameplay mechanics, player flow, and design lessons.

---

## Tutorial Series (Parts 1-14)

### Part 1: Economics Window & Game Structure

Aurora has three interconnected systems: **Economics/Colonization**, **Shipbuilding**, **Naval Operations**.

**Industry Tab — Initial Build Queue:**
- Research Facilities: 20 items at 30% capacity
- Colonial Infrastructure: 1000 units at 10%
- Terraforming: 20 installations at 20%
- Mining: 10 Mass Drivers at 10%
- Military Academies: 5 at 10%
- Commerce: 1 spaceport + commercial shipyard at 20%

**Mining Tab:** Tracks 11 TN minerals. Orange = shortage warning.

**Research Tab:** 9 categories with specialized scientists. **4x bonus** when scientist matches field — cross-field assignment is highly inefficient. Priority techs: Construction/Production, Power/Propulsion, Defensive Systems.

**Wealth/Trade:** Must maintain positive finances. Income via research, Financial Centers, or governors with wealth modifiers.

**Common failure modes:** Combat losses, fuel depletion, accidental destruction. Save frequently.

---

### Part 2: Ship Design (Survey, Cargo, Colony)

**Survey Ship Design:**
- 2 Geological Survey Sensors
- Custom engine: ≤0.7 L/EPH, ≥60 power
- 40+ billion km range
- Crew quarters for 12-24 month deployment
- Maintenance Life must exceed deployment time AND fuel endurance

**Cargo Ship Design:**
- **Civilian classification** (avoids maintenance failures — key distinction)
- Engine size 25+, power modifier ≤0.5
- Cargo Hold + Cargo Shuttle Bay
- ≥20 billion km range, ≥700 km/s speed
- Build 5 (aligns with installation multiples)

**Colony Ship Design:**
- Two options: freighter-based (10 cryo transports) or optimized (5 cryo holds, ~50% faster)
- Optimized design ~35% more efficient in colonists/cost
- Build 2

**Key mechanics:**
- Spacemaster mode for instant research (testing tool)
- Civilian vs military designation affects sensor/weapon mounting AND construction access
- MSP (Maintenance Supply Points) and repair capacity are separate constraints
- Avoid fractional cargo sizing

---

### Part 3: Operations and Colonization

**Turn System:**
- Variable-length turns via interval buttons (default 5-day)
- Events interrupt mid-turn (ship completion, etc.)
- **Auto-turns** (orange button) runs continuously until interrupt
- Economy/research/maintenance/officer-acquisition all tick at intervals

**Survey Procedure:**
1. Naval Operations → Survey Fleet → Movement Orders
2. Check "Moons" option
3. Select target body → Geological Survey
4. Advance time (5-day intervals)

**Colonization:**
- Create colony via System Window → body → Create Colony
- Infrastructure required: **200 per million people** on Luna (atmosphere/temperature multipliers)
- Cargo fleet loads installations from Earth, colony ships deploy colonists

**Standing & Conditional Orders (Aurora's command system):**
- Standing: "Survey Next Five System Bodies" — auto-locates nearest 5 unsurveyed within 10B km
- Conditional: "Fuel < 40% → Refuel at Colony" — prevents stranding
- **Conditional orders execute only at turn conclusion** — interval length affects response time

---

### Part 4: Colony Expansion & Civilian Economy

**Colony Expansion:** Mars colonized once Earth reaches 100 infrastructure. Colonists transported via cargo ships (~2 weeks), generate tax revenue.

**Civilian Shipping Lines** — semi-autonomous vessels:
- Colony ships: transport colonists to destinations under 10M population
- Freighters: carry trade goods/infrastructure between surplus/demand areas
- Requires careful manual control initially to avoid order interrupts

**Terraforming:** Multi-step atmospheric modification via Economics → Environment tab. Add breathable gases, remove CO₂, add oxygen. "Extremely lengthy process."

**Governor Optimization:**
- Earth: production, wealth, shipbuilding, mining bonuses
- Mars: high terraforming rating
- Enable auto-assignment for ship commanders
- Min 5 administration rating
- Expected boost: 20-30% efficiency

---

### Part 5: Interstellar Travel & Jump Points

**Jump Points:** Wormholes linking star systems. Gravitational survey ships discover them. Each system has ~30 potential survey locations, typically 1-6 jump points found.

**Transit Methods:**
1. **Stabilized** — free passage for all ships (slow to set up: months)
2. **Standard Transit** — jump shock prevents immediate action on arrival
3. **Squadron Transit** — arrival at random distances based on drive tech; reduced shock

**Ship Design for Jump:**
- Jump drives are expensive — don't put on every ship
- Three patterns: integrate with fleets, use jump tenders, equip dedicated surveyors
- Tech requirement: Jump Point Theory + Jump Drive Efficiency 5
- Efficiency 1 = 5:1 drive-to-ship capacity ratio

**Strategic:** Jump points are defensible choke points. Forcing a jump point carries significant tactical cost.

---

### Part 6: Beam Weapons & Warship Design

**Three primary beam types:**
- **Lasers:** Range advantage
- **Railguns:** Damage + point defense capability
- **Particle Beams:** Different damage/range curve

**Specialized systems:** Gauss cannons, high-power microwaves, meson cannons, plasma carronades.

**Design Principles — Redundancy:**
- Multiple fire control systems per ship
- Multiple sensors, engines, fuel tanks
- Avoid single points of failure

**Sensor Architecture:** Active sensors with variable resolution. R1 optimal for missile detection. Higher resolution trades range for targeting smaller targets.

**Fire Control:** Determines weapon tracking speed and accuracy (100% at zero range → 0% at max range).

**Example:** Moyote-class Cruiser — 6,000 tons, dual nuclear pulse engines, 8 railguns in quad mounts, dual fire control, 8 reactors, redundant active sensors.

---

### Part 7: Missile Defense

**Beam PD Options:**
- **Gauss Cannons:** Single damage/shot, turreted, bulky. Improve with tech advancement.
- **Railguns:** Compact, higher fire rate, non-turreted. Preferred at baseline tech.

**Fire Control:** Must match tracking rates to missile speeds. Multiple FCs per ship > single FC controlling many weapons. PD effective at 10,000 km.

**Sensor Tracking Bonus:** +1% missile to-hit penalty offset per 5 seconds of pre-impact active tracking. Size 4-5 sensors highly valuable.

**CIWS:** Last-resort close-in systems. Effective with advanced gauss tech.

**Area Defense:** Longer-range options (15cm lasers with capacitor tech) for earlier intercept. Requires multiple firing opportunities.

---

### Part 8: Anti-Missile Missiles (AMMs)

**Core principle:** "Smallest feasible missile, fired at highest possible rate." Size-1 missiles with strength-1 warheads.

**Hit Probability:** `(missile speed × maneuverability × 0.1) / target speed`

**Launchers:** Size-1 preferred (larger = slower fire rate). Standard tech = 5-second increment intervals.

**Magazines:** Minimum 1 HS per launcher. Faster-firing systems need more storage.

**Fire Control Allocation:** 4-8 launchers per FC, accounting for reload timing.

**Key insight:** AMM defense succeeds through volume — sufficient magazines ensure continuous fire during prolonged engagements.

---

### Part 9: Offensive Missile Warfare

**Missile Design:**
- Size 4-6 recommended (active sensor detection threshold)
- Warhead: 25-40% of total mass for optimal armor penetration
- Game rewards specific warhead sizes (4, 9, 16) for armor effectiveness
- Fire control: 1 per 6-8 launchers, typically Range 100 + backup Range 20

**Tactics:**
- Single massive salvos work vs beam PD but struggle vs AMM
- Multiple staggered smaller salvos exploit AMM timing
- Coordinated arrival requires fleet standardization

**Logistics:**
- Three resupply methods: home reload, forward facilities (spaceports), ammunition ships (kept behind fleet)
- Civilian ordnance magazines have **100% explosion chance** if destroyed
- Requires substantial ordnance production capacity

**Production:** Ordnance factories via Industry dropdown. Older stockpiles valuable as backup. Upgrade timing affects fleet coherence.

---

### Part 10: Passive Sensors, Shields, Electronic Warfare

**Passive Sensors:**
- **Thermal:** Detects engine heat
- **EM:** Detects radiation from active systems/shields
- More valuable fleet-wide than per-ship
- ELINT (intelligence gathering) minimally useful in practice

**Shields:** Absorb damage based on tech level. Larger generators more efficient (~40% stronger for 20 HS vs two 10 HS). Efficiency vs redundancy tradeoff.

**Electronic Warfare:**
- **ECM:** -10% per point to beam weapon accuracy
- **ECCM:** Counteracts enemy ECM
- Missiles can carry EW (0.25 MSP each) — potentially invincible against slow-tracking defenses when combined with high speed

**Small Vessels:** Ships <1000 tons don't need bridges. Ships <500 tons are fighters (built from factories, not shipyards). Carriers provide hangars for deployment/repair.

---

### Part 11: Command & Officer System

**Officers:** Assigned to ships, provide bonuses (crew training, survey speed, breakdown reduction, accuracy). Fleet-wide bonuses via flag bridge.

**Automated assignment** with promotion based on skill/time-in-grade when vacancies.

**Rank constraints:** Officers must be 1+ rank higher than subordinates (limits hierarchy to ~3-4 levels).

**Ship Roles:** Commander (required), Auxiliary Control, Science, Main Engineering, CIC, Flag Bridge. Flag officers (fleet-wide bonuses) must be manually appointed.

**Naval Administration:** 7 command types (General, Naval Admin, Patrol, Survey, Training, Logistics, Industrial). Bonuses stack in reporting hierarchies — senior officers organizationally useful beyond individual bonuses.

---

### Part 12: Logistics & Fleet Train

**Four Resource Systems:**
1. **Fuel (Sorium)** — extracted via harvesters/refineries
2. **Maintenance Supplies (MSP)** — repairs damage, prevents failures (failure check every 5-day tick if not at maintenance facility)
3. **Ammunition** — depleted in combat, resupplied via Colliers
4. **Deployment Time** — extended deployments reduce morale/accuracy; restored via Recreation Modules or colonies at 10x rate

**Auxiliary Ship Types:**
- Tankers (~10,000 tons): transfer fuel via Refueling Systems
- Supply Ships: transport MSP via cargo shuttles
- Colliers: carry missiles in magazines
- Tugs: tractor beams to move stations/damaged vessels

**Space Station Types:** Fuel Harvesting, Refueling Hubs (100,000 tons), Recreation Modules, Maintenance Modules, Commercial Hangars.

**Maintenance:** Ships accumulate maintenance clocks. Overhauls at facilities reduce clocks at 3x rate. MSP usage scales with tonnage and build cost. **Commercial ships ignore maintenance; military ships need continuous support.**

**Critical limitation:** "You can't order a tanker to refuel some other ship" — fleets must stay stationary to request fuel. Manual coordination required during long deployments.

---

### Part 13: *(Pending — agent still fetching)*

---

### Part 14: Construction, Minerals, Colonization Maturity

**Construction Management:** Sequential vs parallel building. Bottleneck identification: construction capacity, shipyards, minerals, officers.

**Mineral Management:** Midgame shortages common. Automated mining on extraterrestrial bodies. **Mass drivers: 5,000 tons/year per driver.** Warning against removing Earth's last mass driver.

**Interstellar Colonization:** Terraforming difficulty assessment. CO₂ as atmospheric hazard. Mineral availability from multiple system bodies.

**Colony Population & Growth:**
- Worker guideline: ~0.05M per standard cargo bay
- Gradual infrastructure deployment
- **10M population threshold** triggers growth phase, trade goods production, adjustable population settings (stable/source modes)

**Planetary Protection Value (PPV):**
- System-local only (no cross-system fleet protection)
- Fighters with box launchers as PPV solution
- Inadequate PPV or infrastructure causes unrest
- Ground troops reduce but don't eliminate unrest — root cause fixes needed

---

## Campaign Playthrough (Game 1)

### Setup — Fleet Design Phase
- French Republic faction, alternate history
- **43,350 Build Points** starting budget
- Ship classes: heavy cruisers (12,000t), destroyers (8,000t), escort carriers, transport/colony ships (72,000t)
- Weapon tradeoffs: lasers (range) vs railguns (damage + PD) vs missiles (saturation)
- Build point management forces meaningful composition choices

### Fleet Building (Early Game)
- 12 gravitational survey ships (Orion class, 3000-ton Baudin design)
- 6 geological survey ships, 9 cargo vessels, 3 colony ships
- **Design insight: Multiple smaller survey vessels > fewer large ones** (better sensor/cost ratio, jump-drive scaling)
- Jump point stabilization ship: 31,369 tons, 360-day stabilization
- Moon and Mars lack mineral deposits (economic constraint)

### 1961 — Sol Survey Complete
- 2 jump points discovered, 7 total systems known
- ~3 million colonists on Luna
- Early warship development: "missile frigates up front" as cost-effective defense
- 12 Poignard-class frigates purchased

### First Contact (Dec 1962)
- Alien species detected at Wolf 1061
- Peaceful initial contact (communication, not hostility)
- Design gap exposed: contact vessel lacks sensor equipment
- Proposal for "first-contact optimized" vessel with passive sensors
- Jump-capable tenders proposed for rapid response at jump points

### 1965 — The Fuel Crisis
- **Civilization essentially out of fuel** — forces careful fleet management
- Luna colonization suspended (25M population, infrastructure constrained)
- Solutions: tractor beams, sorium harvesters (4 operational by 1967), refinery improvements
- First new design: Durance class tug (10,000t, tractor beam, 890k-liter fuel)
- **Fuel remains the dominant bottleneck** — all designs optimize around it

### 1968 — Engine Breakthrough
- New commercial engines: 42% less fuel per unit power
- Research/construction efficiency advancing
- Evidence of alien civilization at Gliese 785 (functioning jump gates)
- Ship design branching: large (72k tons) vs small (26-37k tons) transport variants
- Strategic choice: shipyard compatibility vs efficiency

### 1969 — Active Colonization
- First infrastructure to Gliese 892; colony ship en route
- First contact with Zophris Association (Gliese 438) — diplomatic agreement
- Mars exceeds 10M → immigration suspended (population growth must be managed)
- Available manufacturing capacity idle — allocation optimization begins

### 1970 — Decade Milestone
- 10 AKX cargo ships, 1M+ colonists on Gliese 892
- Terraforming active across multiple worlds (Luna nearly complete)
- Suffren Class Replenishment Ship: 8k tons, 2.25M-liter capacity
- Mineral-specific shortages emerging: Corundium, Gallicite

### 1972 — Infrastructure & Bottlenecks
- Lunar terraforming (multi-step: N₂ → O₂)
- Automated colony mining (outer system operations)
- Cargo transport capacity as binding constraint
- Maintenance facility bottlenecks limiting fleet ops
- Tech: armor and anti-missile systems

### Hostilities — First Combat
- Survey ships lost to unknown hostiles (missile + energy weapons)
- Intelligence gathering via scouts with advanced sensors
- Nuclear pulse engine upgrade (+25% power)
- Ship classes: Destroyer Escorts (8000t, railguns) vs Scout (3000t, sensors)
- Jump gate infrastructure as force projection
- Limited life support = death penalty for losses

### 1976-1977 — Late Game Military
- Pattern recognition: two losses to same race in different systems
- Commercial engine tech unlocking new options
- Tanker construction for supply logistics
- Picket ship placement (defensive positioning)
- Railgun destroyer escort retooling
- Monitor/minelayer construction planning
- Colony 10M threshold → frigate deployment
- Weapon specialization: laser vs particle beam choice

---

## Mechanics Articles

### Beam PD Allocation
**Core finding:** Allocation is **per-missile, not per-salvo**. This changes optimal PD design fundamentally.

Higher probability-to-hit (Ph) weapons vastly outperform quantity:
- Base Ph 0.67 with 3 shots: 3.59% leak rate
- Doubled weapon count: 8.65% leaks (worse!)
- Quadrupled: 11.08% leaks

**Recommendation:** Full-size gauss guns superior — higher individual accuracy reduces variability. Split configs fail.

### Advanced Missile Warfare (2.2+)
**ECM problem:** -10% flat per point.
- Small turrets (7.2% base) → 0% with 1 ECM (useless)
- Large turrets (90% base) → 80% with 1 ECM (still effective)

**Conclusion:** Mass-based PD fails catastrophically vs ECM. Quality > quantity. Final design: 3 twin gauss turrets (ECM-resistant balance).

---

## Synthesis: Key Patterns for Drift

### What Aurora Does Well
1. **Bottleneck-driven narrative** — each era has ONE dominant constraint (fuel → efficiency → capacity → minerals). Game surfaces "hard truths" that force creative solutions.
2. **Ship design as strategic expression** — component tradeoffs create genuine depth. Survey ships optimize differently from warships from cargo haulers.
3. **Systems chain** — research → design → construction → operations → logistics. Each system's output feeds the next.
4. **Conditional orders** — "fuel < 40% → refuel" is Aurora's version of Drift's command tree. Eliminates micro while preserving decisions.
5. **Civilian vs military distinction** — different construction, maintenance, and capability rules create two parallel fleet management games.
6. **Mineral-specific supply chains** — each resource has unique sourcing constraints, preventing fungible "just mine more" solutions.
7. **Officer hierarchy with stacking bonuses** — organizational decisions that compound.
8. **Population thresholds as milestones** — 10M triggers new mechanics (trade, PPV, migration controls).

### What Aurora Gets Wrong (Drift Should Avoid)
1. **Tanker refueling coordination** — "you can't order a tanker to refuel some other ship" is a massive UX failure. Drift's tanker intent system already handles this better.
2. **Manual naval organization** — creating admin commands, detaching ships, appointing flag officers is bureaucratic overhead with no strategic depth.
3. **Maintenance failure RNG on 5-day ticks** — feels arbitrary. Drift's bathtub curve is more grounded and predictable.
4. **No design templates** — every ship from scratch. Drift should offer templates.
5. **Deployment time as morale proxy** — crude. Drift's explicit morale system with multiple decay factors is richer.
6. **100% explosion chance on civilian magazines** — feels like a gotcha, not a tradeoff.
7. **Mass driver math** — 5,000 tons/year per driver is a number you just memorize. Should be surfaced in the UI.

### Direct Drift Implications
- **Logistics tutorial flow:** Aurora's Part 12 (fleet train) reveals that fuel/MSP/ammo/deployment are four independent resource axes. Drift currently has fuel + morale + hull + supplies — similar pattern, well-aligned.
- **Commander system:** Aurora's Part 11 maps directly to planned Officer Phase 0. Key insight: **stacking bonuses in hierarchies** create organizational depth. Worth implementing.
- **Colony maturity thresholds:** Aurora's 10M population trigger is a good pattern — colony behavior changes at milestones rather than scaling linearly.
- **Mineral shortages as mid-game driver:** Aurora campaigns consistently hit mineral walls (Corundium, Gallicite) that force expansion. Drift's resource system should create similar pressure.
- **Ship design branching:** The large-vs-small transport decision (72k vs 26-37k tons) shows how shipyard constraints interact with design choices. Drift's ship design system should preserve this.
