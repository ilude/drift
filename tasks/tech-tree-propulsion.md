# Tech Tree: Propulsion & Power (Kouri Domain)

> Status: Draft design (2026-03-28). Fleshed out to Aurora-scale depth. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

The domain that makes interplanetary civilization possible. Kouri Drive Works and its successor companies dominate this space.

---

## 1. Power Plants

Ship power plants provide energy for all systems — engines, sensors, weapons, life support. Power output determines what a ship can mount and run simultaneously. Each power plant type is a distinct technology with different characteristics — not just "better reactor," but fundamentally different approaches to power generation with tradeoffs in output, mass, fuel consumption, reliability, and explosion risk.

**Capacitor Recharge Rate** is a separate tech line that affects how quickly power plants can feed energy weapons and shields. Higher recharge = faster sustained fire and shield recovery.

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

**Key stats per engine type:** base thrust, base fuel efficiency (L/EPH — litres per engine-power-hour), thermal signature, minimum engine size, and reliability. The power modifier system adjusts thrust/efficiency/mass within each type's envelope.

### Conventional Era (Game Start)

| Tech | Rank | Prerequisites | Description | Character |
|------|------|--------------|-------------|-----------|
| **Nuclear Thermal Engine** | 1 | — | Kouri's original design. Fission-heated propellant. Available at game start. | High thrust, terrible fuel economy. Good for initial in-system movement. |
| NTE Thrust I-V | 2 | Nuclear Thermal Engine | | |
| NTE Efficiency I-V | 2 | Nuclear Thermal Engine | | |
| **Nuclear Pulse Engine** | 2 | NTE Efficiency II | Directional nuclear detonations against a pusher plate. Crude but enormously powerful. | Extreme thrust, very poor efficiency. The "brute force" option. Massive thermal signature. |
| Nuclear Pulse Thrust I-V | 3 | Nuclear Pulse Engine | | |
| Nuclear Pulse Efficiency I-V | 3 | Nuclear Pulse Engine | | |
| **Ion Drive** | 3 | NTE Efficiency III, Optical Computing | Electrostatic ion acceleration. Extremely fuel-efficient but very low thrust. | Minimal thrust, superb fuel economy. Survey ships, long-haul freighters. Nearly invisible thermal signature. |
| Ion Drive Thrust I-V | 4 | Ion Drive | | |
| Ion Drive Efficiency I-V | 4 | Ion Drive | | |

### Fusion Era

| Tech | Rank | Prerequisites | Description | Character |
|------|------|--------------|-------------|-----------|
| **Magnetospheric Drive** | 5 | Ion Drive Efficiency III, Stellarator Fusion Reactor | Uses fusion reactor's magnetic field to accelerate solar wind and plasma. Low thrust but essentially free fuel in inner system. | Near-zero fuel use in inner system. Thrust drops with distance from star. Exploration/patrol niche. |
| Magneto Drive Performance I-V | 6 | Magnetospheric Drive | | |
| **Inertial Confinement Fusion Drive** | 5 | Inertial Confinement Fusion, NTE Thrust III | Fusion pellet detonations for thrust. High thrust AND good efficiency — first engine that's competitive on both axes. | Balanced high performance. Standard military engine for mid-game. Bursty — thrust varies with pellet ignition cycle. |
| ICF Drive Thrust I-V | 6 | Inertial Confinement Fusion Drive | | |
| ICF Drive Efficiency I-V | 6 | Inertial Confinement Fusion Drive | | |
| **Magnetic Confinement Fusion Drive** | 6 | Magnetic Confinement Fusion, ICF Drive Thrust II | Sustained fusion exhaust via magnetic nozzle. Smooth, continuous thrust. | Excellent sustained thrust. Best all-rounder in fusion era. Lower peak than ICF but no cycling. |
| MCF Drive Thrust I-V | 7 | Magnetic Confinement Fusion Drive | | |
| MCF Drive Efficiency I-V | 7 | Magnetic Confinement Fusion Drive | | |
| **Plasma Drive** | 7 | MCF Drive Thrust II, TN Field Theory I | TN field-shaped plasma exhaust. First engine to exploit TN physics for thrust, not just containment. | Step change in efficiency. Plasma exhaust velocity exceeds what conventional mag-nozzles allow. |
| Plasma Drive Thrust I-V | 8 | Plasma Drive | | |
| Plasma Drive Efficiency I-V | 8 | Plasma Drive | | |

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

| Tech | Rank | Prerequisites | Description | Character |
|------|------|--------------|-------------|-----------|
| **Solid-Core Antimatter Thermal Drive** | 10 | Solid-Core Antimatter Drive, Plasma Drive Thrust III | Antimatter heats a solid-core heat exchanger, superheating propellant. Simple, reliable. | High thrust, moderate efficiency. The "safe" antimatter engine. Good for capital ships where reliability matters. |
| SCAM Thrust I-V | 11 | Solid-Core AM Thermal Drive | | |
| SCAM Efficiency I-V | 11 | Solid-Core AM Thermal Drive | | |
| **Gas-Core Antimatter Thermal Drive** | 11 | Gas-Core Antimatter Drive, SCAM Efficiency II | Antihydrogen annihilates in gaseous uranium core. Much higher operating temperature than solid-core. | Better efficiency than SCAM, similar thrust. Runs very hot — high thermal signature. |
| GCAM Thrust I-V | 12 | Gas-Core AM Thermal Drive | | |
| GCAM Efficiency I-V | 12 | Gas-Core AM Thermal Drive | | |
| **Plasma-Core Antimatter Drive** | 12 | Plasma-Core Antimatter Drive, GCAM Efficiency II | Direct plasma exhaust from matter-antimatter annihilation. No intermediate heating step. | Extreme thrust AND efficiency. The premier warship engine. Demands the best thermal management. |
| PCAM Thrust I-V | 13 | Plasma-Core AM Drive | | |
| PCAM Efficiency I-V | 13 | Plasma-Core AM Drive | | |
| **Beam-Core Antimatter Drive** | 13 | Beam-Core Antimatter Drive, PCAM Efficiency II | Charged pion beam exhaust from annihilation. Maximum theoretical propulsive efficiency. | Best efficiency in the game. Moderate thrust (beam divergence limits it). The long-range explorer's engine. |
| Beam-Core AM Thrust I-V | 14 | Beam-Core AM Drive | | |
| Beam-Core AM Efficiency I-V | 14 | Beam-Core AM Drive | | |

### Exotic Era

| Tech | Rank | Prerequisites | Description | Character |
|------|------|--------------|-------------|-----------|
| **Gravity Drive** | 13 | TN Field Theory IV, Plasma Drive Efficiency IV | TN field manipulation creates localized spacetime gradient. Ship "falls" in chosen direction. No propellant. | Zero fuel consumption. Moderate thrust. No exhaust signature at all — the stealth engine. Limited by TN field generator mass. |
| Gravity Drive Performance I-VI | 14 | Gravity Drive | | |
| **Hyper Drive** | 14 | Gravity Drive Performance III, Unified TN Theory | Compresses space ahead, expands behind. Not faster-than-light but circumvents normal relativistic speed limits. | Transit speed exceeds anything reaction-based. Not useful for tactical maneuvering — spooling time. The interstellar engine. |
| Hyper Drive Performance I-IV | 15 | Hyper Drive | | |
| **Photonic Drive** | 16 | Vacuum Energy Power Plant, Beam-Core AM Efficiency IV | Pure photon exhaust powered by vacuum energy. No fuel, no propellant, indefinite operation. | Capstone engine. Low thrust but literally never stops. Given enough time, approaches relativistic speed. Ultimate exploration engine. |
| Photonic Drive Performance I-V | 16 | Photonic Drive | | |

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
| Fuel Transfer Speed I-VI | 2 | Standard Fuel Storage | How fast tankers can transfer fuel. 32,000 → 64,000 → 128,000 → 256,000 → 512,000 → 1,024,000 L/year. Critical for fleet logistics. |
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

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| Power Plants | 16 | 18 × V tiers + Capacitor ×25 + Boost ×8 | ~139 |
| Engines | 15 | 24 × V tiers + support lines | ~155 |
| Fuel Systems | 5 | 5 × V-VI tiers | ~35 |
| Jump Drive | 4 | 5 × V-X tiers | ~30 |
| **Domain Total** | **~40** | **~52 lines** | **~359** |
