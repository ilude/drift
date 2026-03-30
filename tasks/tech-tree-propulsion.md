# Tech Tree: Propulsion & Power (Kouri Domain)

> Status: Draft design (2026-03-29, rev 2). Performance-calibrated engine progression. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

The domain that makes interplanetary civilization possible. Kouri Drive Works and its successor companies dominate this space.

---

## 1. Power Plants

Ship power plants provide energy for all systems — engines, sensors, weapons, life support. Power output determines what a ship can mount and run simultaneously. Each power plant type is a distinct technology with different characteristics — not just "better reactor," but fundamentally different approaches to power generation with tradeoffs in output, mass, fuel consumption, reliability, and explosion risk.

**Capacitor Recharge Rate** is a separate tech line that affects how quickly power plants can feed energy weapons and shields. Higher recharge = faster sustained fire and shield recovery.

### Power Plant Classification: Commercial vs Military

Power plants follow the same commercial/military classification as engines (see Section 2). The distinction affects minimum hull size, thermal signature, and maintenance requirements:

| Aspect | Military Reactor | Commercial Reactor |
|--------|-----------------|-------------------|
| **Size** | Compact (min 2 HS) | Bulky (min 10 HS) |
| **Output/mass** | Higher | Lower |
| **Thermal signature** | Higher | Lower |
| **Maintenance** | More frequent | Less frequent |
| **Reliability** | Standard | Higher (safer) |
| **Fuel consumption** | Standard | 10% of military |
| **Role** | Warships, fast escorts | Freighters, stations, colony ships |

Military reactors pack more output per ton but run hotter and break more often. Commercial reactors sacrifice output density for fuel economy, reliability, and lower signatures — exactly what you want on a freighter hauling cargo for months between ports.

### Fission Era (Game Start)

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Pressurized Water Reactor** | 1 | — | Baseline power plant. Heavy, reliable, proven. Available at game start. Low output-to-mass. |
| PWR Efficiency I-V | 2 | Pressurized Water Reactor | Output per ton improvements. |
| **Pebble Bed Reactor** | 2 | PWR Efficiency II | Passively safe fission design. Better fuel utilization, lower maintenance. Slightly less output than PWR but much safer — reduced explosion risk on critical damage. |
| Pebble Bed Efficiency I-V | 3 | Pebble Bed Reactor | |
| **Gas-Cooled Fast Reactor** | 3 | Pebble Bed Efficiency II | High-temperature gas coolant. Best fission output-to-mass ratio. Runs hotter — more thermal signature, needs better cooling. |
| GCFR Efficiency I-V | 4 | Gas-Cooled Fast Reactor | |

### Fusion Era

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Stellarator Fusion Reactor** | 4 | GCFR Efficiency II, Applied TN Physics I, Magnetic Containment I | First fusion reactor. Steady-state operation, moderate output. Corbomite-enhanced superconducting magnets enable practical containment. The cautious approach — reliable but bulky. |
| Stellarator Efficiency I-V | 5 | Stellarator Fusion Reactor | |
| **Tokamak Fusion Reactor** | 5 | Stellarator Efficiency II, Magnetic Containment II | Pulsed confinement fusion. Higher peak output than Stellarator but cycles between charge/discharge. Better output-to-mass. Standard warship reactor. |
| Tokamak Efficiency I-V | 6 | Tokamak Fusion Reactor | |
| **Inertial Confinement Fusion** | 6 | Tokamak Efficiency II, Laser Emitter | Laser-ignited fusion pellets. Highest burst output of any fusion type — ideal for energy weapon platforms. Fuel-hungry. |
| ICF Efficiency I-V | 7 | Inertial Confinement Fusion | |
| **Magnetic Confinement Fusion** | 7 | Tokamak Efficiency III, Magnetic Containment III | Advanced mag-bottle containment. Best sustained output of fusion types. The fleet workhorse reactor. |
| MCF Efficiency I-V | 8 | Magnetic Confinement Fusion | |
| **Partial Confinement Fusion** | 8 | MCF Efficiency II, TN Field Theory I | TN field-assisted confinement. Smaller and lighter — enables fusion power on destroyer-class hulls. |
| PCF Efficiency I-V | 9 | Partial Confinement Fusion | |
| Fusion Miniaturization I-V | 6 | Stellarator Efficiency III or Tokamak Efficiency III | Cross-type miniaturization research. Reduces minimum hull size for any fusion reactor. |
| Reactor Power Boost I-VIII | 5 | Any Fusion Reactor | Overcharge capability. Each tier allows higher boost % but increases explosion risk on critical hit. +5%/+10%/+15%/+20%/+25%/+30%/+40%/+50%. Risk: 50%/100%/150%/200%/250%/300%/400%/450% explosion chance multiplier. |

### Antimatter Era

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Solid-Core Antimatter Drive** | 10 | MCF Efficiency IV, TN Field Theory II, Quantum Computing II | First antimatter reactor. Antiprotons annihilate against solid target, heating working fluid. Relatively safe (for antimatter). Massive output leap over fusion. |
| Solid-Core AM Efficiency I-V | 11 | Solid-Core Antimatter Drive | |
| **Gas-Core Antimatter Drive** | 12 | Solid-Core AM Efficiency III | Gaseous annihilation medium. Higher output, higher operating temperature. Less mass per unit output but more demanding thermal management. |
| Gas-Core AM Efficiency I-V | 13 | Gas-Core Antimatter Drive | |
| **Plasma-Core Antimatter Drive** | 13 | Gas-Core AM Efficiency II, TN Field Theory III | Plasma-state annihilation. Near-total mass-energy conversion. Extreme output. Requires Corbomite thermal systems at maximum rating. |
| Plasma-Core AM Efficiency I-V | 14 | Plasma-Core Antimatter Drive | |
| **Beam-Core Antimatter Drive** | 14 | Plasma-Core AM Efficiency III | Direct charged-pion beam from annihilation. Maximum theoretical antimatter efficiency. No thermal intermediary — output is a directed relativistic beam. Can double as a weapon in desperation. |
| Beam-Core AM Efficiency I-V | 15 | Beam-Core Antimatter Drive | |

### Exotic Era

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Vacuum Energy Power Plant** | 15 | Beam-Core AM Efficiency III, Unified TN Theory, TN Computing III | Extracts energy from TN vacuum fluctuations. No fuel consumption. Output scales with TN field strength. Near-unlimited sustained power. |
| Vacuum Energy Efficiency I-V | 16 | Vacuum Energy Power Plant | |
| **Zero-Point Reactor** | 16 | Vacuum Energy Efficiency III | Capstone power technology. Direct conversion of zero-point energy via TN field coupling. Effectively unlimited power with zero fuel. Enables capstone systems across all domains (Active Cloaking, TN Barriers, Photonic Drive). |

### Capacitor Systems

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| Capacitor Recharge Rate I-XXV | 3-16 | Scales with reactor tech | How fast the reactor feeds energy weapons and shields between shots. 25 tiers — each improves recharge by ~10-15%. Early tiers are cheap (rank 3), late tiers are expensive (rank 12+). The single longest refinement chain in the power domain. |

---

## 2. Engines

Each engine technology is a distinct propulsion concept with different physics — not just "better numbers" but fundamentally different approaches to generating thrust. The player designs specific engines within each type via the power modifier system (thrust vs efficiency vs mass tradeoff). Researching a new engine type doesn't obsolete the previous one — different types suit different ship roles.

### Engine Classification: Commercial vs Military

Inspired by Aurora 4X, every engine design falls into one of two classifications based on its size and power settings. This isn't a separate tech — it emerges from the design choices the player makes:

| Aspect | Military Engine | Commercial Engine |
|--------|----------------|-------------------|
| **Size** | Fixed 5 HS (compact) | 25+ HS (bulky) |
| **Power** | Any power setting | Max 50% power |
| **Fuel consumption** | Standard | 10% of military |
| **Thrust/mass** | Higher | Lower |
| **Thermal signature** | Higher | Lower |
| **Min hull size** | None | Larger |
| **Role** | Warships, fast interceptors | Freighters, tankers, colony ships |

**Classification rule:** An engine of 25 HS or greater with power ≤ 50% is classified as commercial. All other engines are military.

**Design tension:** Commercial engines are enormously fuel-efficient (10% fuel burn) but occupy 5x the hull space and produce less thrust per ton. A freighter with commercial engines can cross the solar system on a fraction of the fuel a warship burns — but it takes much longer and can't evade threats. This creates genuine logistical decisions: do you build fast military tankers that burn their own cargo, or slow commercial tankers that arrive with full holds?

**Key stats per engine type:** base accelG (thrust), base ISP (fuel efficiency), thermal signature, minimum engine size, and reliability. The power modifier system adjusts thrust/efficiency/mass within each type's envelope.

### Performance Calibration

All base accel values assume 100% power, military-class (5 HS). Refinement tiers (I-V) each improve the stat by ~20%, giving ~2.5x improvement from base to Tier V. Commercial engines at 50% power produce half the base accel but at 10% fuel burn.

**Design goal:** The fastest endgame engine (AM Plasma-Core at max refinement) tops out around 40g. At 40g, Earth-to-Neptune takes ~2.4 days — fast enough to feel powerful, slow enough that logistics still matter. The solar system never becomes trivially small.

#### Travel Time Reference (Earth to target, brachistochrone)

| Engine | Base accelG | Tier V accelG | Mars (1 AU) | Jupiter (4 AU) | Neptune (29 AU) |
|--------|------------|---------------|-------------|----------------|-----------------|
| Nuclear Thermal | 0.10g | 0.25g | 9.0d / 5.7d | 18.1d / 11.4d | 48.7d / 30.8d |
| Nuclear Pulse | 0.30g | 0.75g | 5.2d / 3.3d | 10.4d / 6.6d | 28.1d / 17.8d |
| Ion Drive | 0.02g | 0.05g | 20.2d / 12.8d | 40.4d / 25.6d | 108.9d / 68.9d |
| ICF Drive | 1.0g | 2.5g | 2.9d / 1.8d | 5.7d / 3.6d | 15.4d / 9.7d |
| MCF Drive | 2.0g | 5.0g | 2.0d / 1.3d | 4.0d / 2.6d | 10.9d / 6.9d |
| Plasma Drive | 5.0g | 12.0g | 1.3d / 20h | 2.6d / 1.7d | 6.9d / 4.4d |
| AM Solid-Core | 10.0g | 25.0g | 22h / 14h | 1.8d / 1.1d | 4.9d / 3.1d |
| AM Gas-Core | 20.0g | — | 15h | 1.3d | 3.4d |
| AM Plasma-Core | 40.0g | — | 11h | 22h | 2.4d |
| AM Beam-Core | 15.0g | — | 18h | 1.5d | 4.0d |
| Gravity Drive | 5.0g | 15.0g | 1.3d / 18h | 2.6d / 1.5d | 6.9d / 4.0d |
| Photonic Drive | 0.5g | — | 4.0d | 8.1d | 21.8d |

*Format: base / tier V. Single value = no refinement tiers or same as base.*

#### Key Thresholds

- Neptune in 1 week: needs ~5g (mid-fusion era — MCF Drive)
- Neptune in 3 days: needs ~26g (late antimatter era — AM Solid-Core V)
- Neptune in 1 day: needs ~237g (never reached — preserves logistics)

### Conventional Era (Game Start)

| Tech | Rank | Prerequisites | Base accelG | ISP | Description | Character |
|------|------|--------------|-------------|-----|-------------|-----------|
| **Nuclear Thermal Engine** | 1 | — | 0.10 | 1M s | Kouri's original design. Fission-heated propellant. Available at game start. | High thrust for its era, terrible fuel economy. The workhorse. |
| NTE Thrust I-V | 2 | Nuclear Thermal Engine | +20%/tier | — | | |
| NTE Efficiency I-V | 2 | Nuclear Thermal Engine | — | +20%/tier | | |
| **Nuclear Pulse Engine** | 2 | NTE Efficiency II | 0.30 | 800K s | Directional nuclear detonations against a pusher plate. Crude but enormously powerful. | Extreme thrust, very poor efficiency. The "brute force" option. Massive thermal signature. Military only — no commercial variant (too violent for civilian use). |
| Nuclear Pulse Thrust I-V | 3 | Nuclear Pulse Engine | +20%/tier | — | | |
| Nuclear Pulse Efficiency I-V | 3 | Nuclear Pulse Engine | — | +20%/tier | | |
| **Ion Drive** | 3 | NTE Efficiency III, Optical Computing | 0.02 | 5M s | Electrostatic ion acceleration. Extremely fuel-efficient but very low thrust. | Minimal thrust, superb fuel economy. Survey ships, long-haul commercial freighters. Nearly invisible thermal signature. The quintessential commercial engine. |
| Ion Drive Thrust I-V | 4 | Ion Drive | +20%/tier | — | | |
| Ion Drive Efficiency I-V | 4 | Ion Drive | — | +20%/tier | | |

**Conventional era design space:**
- **Military survey/patrol:** Nuclear Thermal (0.1g). Gets you to Mars in 9 days. Reliable, cheap.
- **Military assault/intercept:** Nuclear Pulse (0.3g). Three times faster but burns fuel like water. Short-range strike.
- **Commercial freighter:** Ion Drive (0.02g, commercial class). Mars in 20 days but burns almost no fuel. The economics work because fuel is expensive.
- **Commercial tanker:** Nuclear Thermal (0.1g, commercial class at 50% power). 0.05g, but 10% fuel burn means the tanker actually delivers most of its cargo.

### Fusion Era

| Tech | Rank | Prerequisites | Base accelG | ISP | Description | Character |
|------|------|--------------|-------------|-----|-------------|-----------|
| **Magnetospheric Drive** | 5 | Ion Drive Efficiency III, Stellarator Fusion Reactor | 0.08 | ∞ (inner) | Uses fusion reactor's magnetic field to accelerate solar wind and plasma. | Near-zero fuel use in inner system. Thrust drops with distance from star. Exploration/patrol niche. |
| Magneto Drive Performance I-V | 6 | Magnetospheric Drive | +20%/tier | — | | |
| **Inertial Confinement Fusion Drive** | 5 | Inertial Confinement Fusion, NTE Thrust III | 1.0 | 3M s | Fusion pellet detonations for thrust. First engine competitive on both thrust and efficiency. | Balanced high performance. Standard military engine for mid-game. Bursty — thrust varies with pellet ignition cycle. |
| ICF Drive Thrust I-V | 6 | Inertial Confinement Fusion Drive | +20%/tier | — | | |
| ICF Drive Efficiency I-V | 6 | Inertial Confinement Fusion Drive | — | +20%/tier | | |
| **Magnetic Confinement Fusion Drive** | 6 | Magnetic Confinement Fusion, ICF Drive Thrust II | 2.0 | 4M s | Sustained fusion exhaust via magnetic nozzle. Smooth, continuous thrust. | Excellent sustained thrust. Best all-rounder in fusion era. Lower peak than ICF but no cycling. |
| MCF Drive Thrust I-V | 7 | Magnetic Confinement Fusion Drive | +20%/tier | — | | |
| MCF Drive Efficiency I-V | 7 | Magnetic Confinement Fusion Drive | — | +20%/tier | | |
| **Plasma Drive** | 7 | MCF Drive Thrust II, TN Field Theory I | 5.0 | 6M s | TN field-shaped plasma exhaust. First engine to exploit TN physics for thrust, not just containment. | Step change in efficiency. Plasma exhaust velocity exceeds what conventional mag-nozzles allow. |
| Plasma Drive Thrust I-V | 8 | Plasma Drive | +20%/tier | — | | |
| Plasma Drive Efficiency I-V | 8 | Plasma Drive | — | +20%/tier | | |

**Fusion era design space:**
- **Military fast attack:** Plasma Drive (5g mil). Neptune in 7 days. The era when the outer system opens up.
- **Military escort:** ICF Drive (1g mil). Affordable, balanced. The fleet workhorse.
- **Commercial bulk hauler:** MCF Drive (2g, commercial class at 50% = 1g, 10% fuel). Crosses the system on fumes.
- **Deep space surveyor:** Magnetospheric Drive. Free fuel in the inner system — infinite range. Terrible beyond Jupiter.
- **Commercial tanker:** ICF Drive (1g, commercial class at 50% = 0.5g, 10% fuel). 5x cheaper to operate than military tanker.

### Engine Variant Technologies

Parallel branches that modify how engines of any type are mounted and operated. These aren't engines themselves — they're engineering techniques that apply across engine types.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Pulsed Power Engine Technology** | 4 | Nuclear Pulse Efficiency II | Applies nuclear pulse principles to other engine types. Overclocks any engine for short burst thrust at the cost of fuel and thermal signature. |
| **Rotational Engine Technology** | 4 | NTE Thrust III | Centrifugal engine mount. Improves thrust vectoring and reduces structural stress on the hull during high-G burns. |
| Rotational Engine Efficiency I-V | 5 | Rotational Engine Technology | |
| **Ion Drive Nacelles** | 5 | Ion Drive Efficiency III | External engine pods that decouple ion drive vibration from the hull. Enables larger ion drives on smaller hulls. |
| **Plasma Nacelle Technology** | 8 | Plasma Drive Efficiency II | External plasma drive pods. Reduces thermal bleedthrough to hull. Enables closer engine spacing on large warships. |
| Plasma Nacelle Efficiency I-VI | 9 | Plasma Nacelle Technology | |

### Antimatter Era

| Tech | Rank | Prerequisites | Base accelG | ISP | Description | Character |
|------|------|--------------|-------------|-----|-------------|-----------|
| **Solid-Core AM Thermal Drive** | 10 | Solid-Core Antimatter Drive, Plasma Drive Thrust III | 10.0 | 8M s | Antimatter heats a solid-core heat exchanger, superheating propellant. Simple, reliable. | High thrust, moderate efficiency. The "safe" antimatter engine. Good for capital ships where reliability matters. |
| SCAM Thrust I-V | 11 | Solid-Core AM Thermal Drive | +20%/tier | — | | |
| SCAM Efficiency I-V | 11 | Solid-Core AM Thermal Drive | — | +20%/tier | | |
| **Gas-Core AM Thermal Drive** | 11 | Gas-Core Antimatter Drive, SCAM Efficiency II | 20.0 | 9M s | Antihydrogen annihilates in gaseous uranium core. Much higher operating temperature than solid-core. | Better efficiency than SCAM, similar thrust class. Runs very hot — high thermal signature. |
| GCAM Thrust I-V | 12 | Gas-Core AM Thermal Drive | +20%/tier | — | | |
| GCAM Efficiency I-V | 12 | Gas-Core AM Thermal Drive | — | +20%/tier | | |
| **Plasma-Core AM Drive** | 12 | Plasma-Core Antimatter Drive, GCAM Efficiency II | 40.0 | 10M s | Direct plasma exhaust from matter-antimatter annihilation. No intermediate heating step. | Extreme thrust AND efficiency. The premier warship engine. Demands the best thermal management. **Ceiling engine — highest accelG in the game.** |
| PCAM Thrust I-V | 13 | Plasma-Core AM Drive | +20%/tier | — | | |
| PCAM Efficiency I-V | 13 | Plasma-Core AM Drive | — | +20%/tier | | |
| **Beam-Core AM Drive** | 13 | Beam-Core Antimatter Drive, PCAM Efficiency II | 15.0 | 15M s | Charged pion beam exhaust from annihilation. Maximum theoretical propulsive efficiency. | Best efficiency in the game but moderate thrust. The long-range explorer's engine. Not the fastest — the most fuel-efficient. |
| Beam-Core AM Thrust I-V | 14 | Beam-Core AM Drive | +20%/tier | — | | |
| Beam-Core AM Efficiency I-V | 14 | Beam-Core AM Drive | — | +20%/tier | | |

**Antimatter era design space:**
- **Military battleship:** Plasma-Core AM (40g mil). Neptune in 2.4 days. The ultimate combat engine — but demands exotic TNEs and perfect thermal management.
- **Military fast scout:** Gas-Core AM (20g mil). Cheaper than Plasma-Core, still very fast.
- **Commercial super-freighter:** Solid-Core AM (10g, commercial at 50% = 5g, 10% fuel). Hauls vast tonnage economically.
- **Exploration flagship:** Beam-Core AM (15g mil). Not the fastest, but ISP of 15M means it can cross the entire solar system and back on one tank.
- **Critical design tension:** AM Plasma-Core has the raw speed, but Beam-Core AM goes further on less fuel. Speed vs range — different missions demand different engines.

### Exotic Era

| Tech | Rank | Prerequisites | Base accelG | ISP | Description | Character |
|------|------|--------------|-------------|-----|-------------|-----------|
| **Gravity Drive** | 13 | TN Field Theory IV, Plasma Drive Efficiency IV | 5.0 | ∞ (no fuel) | TN field manipulation creates localized spacetime gradient. Ship "falls" in chosen direction. No propellant. | Zero fuel consumption. Moderate thrust. No exhaust signature at all — the stealth engine. Limited by TN field generator mass. |
| Gravity Drive Performance I-VI | 14 | Gravity Drive | +20%/tier | — | | |
| **Hyper Drive** | 14 | Gravity Drive Performance III, Unified TN Theory | N/A | N/A | Compresses space ahead, expands behind. Not FTL but circumvents normal relativistic speed limits. | Transit speed exceeds anything reaction-based. Not useful for tactical maneuvering — spooling time. The interstellar engine. |
| Hyper Drive Performance I-IV | 15 | Hyper Drive | | | | |
| **Photonic Drive** | 16 | Vacuum Energy Power Plant, Beam-Core AM Efficiency IV | 0.5 | ∞ (no fuel) | Pure photon exhaust powered by vacuum energy. No fuel, no propellant, indefinite operation. | Capstone engine. Low thrust but literally never stops. Given enough time, approaches relativistic speed. Ultimate exploration engine. |
| Photonic Drive Performance I-V | 16 | Photonic Drive | +20%/tier | — | | |

**Exotic era design space:**
- **Ghost ship:** Gravity Drive + cold reactor + passive sensors. Zero exhaust signature, zero fuel burn. Sees without being seen. Neptune in 7 days at base, 4 days at Performance VI.
- **Jump scout:** Hyper Drive + minimal weapons. Arrives in new systems, surveys, jumps back. No other build can do this.
- **Deep space wanderer:** Photonic Drive. 0.5g but never stops accelerating, never runs out of fuel. Spends years reaching relativistic speeds. The ultimate "send it and forget it" probe.
- **Critical insight:** Exotic engines don't replace antimatter for raw speed. Gravity Drive (5-15g, no fuel) is slower than AM Plasma-Core (40g) — but infinite range changes everything. The Photonic Drive is the slowest "endgame" engine but the only one that can reach another star without jump gates.

### Engine Support Systems

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| Fuel Consumption Rate I-X | 2-10 | Scales with engine tech | Global fuel efficiency modifier applying to all engine types. 10 tiers. Each tier reduces base fuel consumption by ~10%. Stacks multiplicatively with per-engine-type efficiency research. |
| Minimum Engine Power Modifier I-V | 3-8 | Scales with engine tech | Allows smaller power settings on engines. Base: x0.5 minimum. Tier V: x0.1 minimum. Enables fuel-sipping cruise modes and ultra-precise maneuvering. |
| Engine Thermal Management I-V | 4 | Corbomite Thermal Systems | Reduces thermal signature generated by engines. Applies to all engine types. Critical for stealth builds. |

---

## 3. Fuel Systems

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Standard Fuel Storage** | 1 | — | Conventional Sorium fuel tanks. |
| Fuel Tank Efficiency I-V | 2 | Standard Fuel Storage | Better containment = more fuel per ton of tank. |
| **Pressurized Fuel Storage** | 3 | Fuel Tank Efficiency II | Higher-density storage. +50% capacity per tank module. |
| **Cryogenic Fuel Storage** | 6 | Pressurized Fuel Storage, Corbomite Thermal Systems II | Supercooled Sorium. +100% capacity per tank module. |
| Fuel Processing I-V | 3 | Standard Fuel Storage | Onboard fuel purification. Higher tiers enable in-situ refueling from gas giants/comets. |
| Fuel Transfer Speed I-VI | 2 | Standard Fuel Storage | How fast tankers can transfer fuel. 32,000 / 64,000 / 128,000 / 256,000 / 512,000 / 1,024,000 L/year. Critical for fleet logistics. |
| **Ram Scoop** | 8 | Fuel Processing IV, Plasma Drive | Continuous low-rate fuel collection during transit through TN field interactions with ambient particles. |
| **Antimatter Fuel Production** | 11 | Solid-Core Antimatter Drive | Colony installation that produces antimatter fuel. Extremely energy-intensive — needs dedicated power infrastructure. |
| Antimatter Production Rate I-V | 12 | Antimatter Fuel Production | |

---

## 4. Jump Drive (Interstellar Transit)

A separate propulsion system from main engines. Jump drives create temporary transit points between star systems. Doesn't replace engines — you still need conventional propulsion within systems.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Jump Drive Theory** | 10 | TN Field Theory III, Gravity Drive | Theoretical basis for creating localized TN field tunnels between gravitationally linked points. |
| **Jump Drive** | 12 | Jump Drive Theory, Quantum Computing III | First functional jump drive. Creates temporary transit point. Limited by drive size and squadron tonnage. |
| Jump Drive Max Squadron Size I-V | 13 | Jump Drive | How much total tonnage can transit per jump. |
| Jump Drive Max Squadron Radius I-VIII | 13 | Jump Drive | Maximum distance between ships that can be included in a single jump. |
| Jump Drive Minimum Size I-IX | 13 | Jump Drive | Allows smaller jump drives. Base: 15 HS. Tier IX: 2 HS. Enables jump-capable escorts. |
| Jump Drive Efficiency I-X | 14 | Jump Drive | Fuel cost per jump. 10 tiers of improvement. |
| **Jump Gate Construction** | 14 | Jump Drive Efficiency IV | Permanent two-way transit infrastructure. Eliminates need for jump-drive-equipped ships on established routes. Colony ships and freighters can use gates without their own jump drive. |
| Jump Gate Stabilization I-V | 15 | Jump Gate Construction | Gate capacity and reliability improvements. |

---

## 5. Performance Progression Philosophy

### The Endless Bottleneck Applied to Propulsion

The engine progression is calibrated so that **solving one constraint reveals the next:**

1. **Conventional era** (0.02-0.3g): The inner system is accessible but the outer system is a multi-month expedition. The bottleneck is *reach* — fuel and time limit how far you can explore.

2. **Fusion era** (1-12g): The outer system opens up. Neptune is reachable in a week. But now the bottleneck shifts to *fuel logistics* — faster engines burn more fuel, and your colony network can't produce enough Sorium to keep a large fleet operating at full speed. Commercial engines become critical for economic hauling.

3. **Antimatter era** (10-40g): Transit time is no longer the problem — you can reach anywhere in Sol in days. The bottleneck shifts to *exotic resources* — antimatter fuel production requires massive colony infrastructure, and the TNE requirements for AM engines are extreme. You have the technology for 40g ships but can only afford to build and fuel a handful.

4. **Exotic era** (∞ range, modest speed): The Gravity Drive eliminates fuel entirely, but at 5-15g it's slower than antimatter engines. The Photonic Drive has infinite endurance but only 0.5g. The bottleneck shifts to *time* — interstellar distances are so vast that even "fast" ships take years. Jump Drives solve this but require enormous research investment and per-jump fuel costs.

### Why Not Faster?

The maximum practical acceleration (AM Plasma-Core V at ~40g with refinement) means:
- **Neptune in ~2.4 days** (base) to **~1.5 days** (max refinement + power modifiers)
- **Pluto in ~2.8 days** base
- Never reaches "instant" — logistics always matter

At 200g (the old Extreme tier), Neptune was 1.1 days and the solar system felt like a single room. At 40g, it's a large house — rooms are distinct, travel between them is quick but not free, and you still need to think about where you station your fleet.

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| Power Plants | 16 | 18 × V tiers + Capacitor ×25 + Boost ×8 | ~139 |
| Engines | 15 | 24 × V tiers + support lines | ~155 |
| Fuel Systems | 5 | 5 × V-VI tiers | ~35 |
| Jump Drive | 4 | 5 × V-X tiers | ~30 |
| **Domain Total** | **~40** | **~52 lines** | **~359** |
