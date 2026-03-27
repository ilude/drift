# Aurora 4X — Ship Creation & Component Design Reference

Source: [Aurora 4X Wiki - Basic Ship Creation](https://aurora4x.fandom.com/wiki/Basic_Ship_Creation), [7w1 Tutorials](https://7w1.github.io/), [Naval Gazing Tutorials](https://www.navalgazing.net/Tags/Aurora)

---

## Class Design Window (F5)

The primary ship design interface. Tabs:
- **Design View** — Available components + current components (only visible if design is unlocked)
- **Brief Summary** — Copy of class summary
- **Design Errors** — Lists inconsistencies (weapons without fire controls, insufficient life support, etc.)

### Component Filters
- "Own Tech Only" — Hides salvaged/captured foreign components
- "Group Components" — Organizes by category
- "Show Obsolete Tech" — Displays obsolete components
- "Commercial Only" — Hides military-flagged components

---

## Units: Hull Spaces (HS)

All Aurora components are measured in Hull Spaces. **1 HS = 50 tons.**

- **Target Cross Section (TCS)** — Rounded-up class size, used for active sensor detection
- **Build Points (BP)** — Total wealth cost for all systems + armor

---

## Engine Design (Create Research Project Window)

Engine design uses **6-7 discrete dropdown menus**, not sliders:

1. **Project Type** — "Engines" (vs Missiles, Turrets, Ground Units)
2. **Engine Tier** — "Nuclear Radioisotope Engine", "Nuclear Thermal Engine", etc.
3. **Engine Power / Fuel Consumption** — Discrete steps (e.g., "Engine Power: 40%, Fuel Consumption: 0.1")
4. **Fuel Consumption per EPH** — Discrete research-gated options (e.g., "0.9 Litres per Engine Power Hour")
5. **Thermal Reduction** — "Signature 100% Normal", "Signature 75%", etc.
6. **Engine Size** — In Hull Spaces (1-50 HS). Fuel consumption reduced by 1% per HS. Larger = more efficient but less flexible.

### Engine Power Formula
- `Max Speed = (Total Engine Output / Class Size) × 1000 km/s`
- One unit of engine power propels 50 tons (1 HS) at 1000 km/s

### Engine Types
- **Military Engines:** 5 HS fixed, higher power-to-weight ratio (25 power base)
- **Commercial Engines:** Higher output (62 power), only 10% fuel consumption, but requires 5× more space
- Engines of 25 HS or greater with power ≤50% are classed as commercial

### Fuel Modifier Formula
- `Fuel Modifier = Power Modifier ^ 2.5`
- So 2× Power = 5.66× Fuel consumption
- This is the core tradeoff: power costs fuel exponentially

### Thermal Signature
- Increases with engine power output
- Thermal reduction options trade cost/size for lower detectability

### Company Name + Project Name
- Cosmetic naming (company + engine designation)
- "Company Name" button generates random name from naming theme

### Bottom Row Buttons
- **Create** — Finalize the design as a researchable project
- **Prototype** — Create for testing without full research
- **Company Name** — Random generator
- **Missile Design** — Switch to missile designer
- **Turret Design** — Switch to turret designer
- **GU Design** — Switch to ground unit designer

---

## Ship Components (Available Components Pane)

### Auto-Allocated (default on new design)
- Armor (base layer)
- Crew Quarters (base)
- Fuel Storage (base)
- Engineering Spaces
- Bridge

### Core Components
| Component | Purpose | Notes |
|---|---|---|
| Bridge | Required for all ships | 1 per ship |
| Crew Quarters | Life support | Standard: 250 crew capacity |
| Engineering Spaces | Maintenance life | Improves time between overhauls |
| Maintenance Storage Bay | Repair supplies (MSP) | Scales with ship complexity |
| Fuel Storage | Range | Standard and large variants |

### Propulsion
| Component | Purpose | Notes |
|---|---|---|
| Engine (player-designed) | Thrust | Military or commercial type |
| Jump Drive | Interstellar transit | Expensive, not on every ship |

### Sensors
| Component | Purpose | Notes |
|---|---|---|
| Geological Survey Sensor | Survey bodies for minerals | Required for survey ships |
| Gravitational Survey Sensor | Discover jump points | Required for grav survey |
| Active Sensor | Detect targets | Resolution tradeoff: bigger targets = more range, smaller = less |
| Passive Sensor (Thermal) | Detect engine heat | Fleet-wide value |
| Passive Sensor (EM) | Detect active systems | Fleet-wide value |

### Weapons
| Component | Purpose | Notes |
|---|---|---|
| Laser | Long range beam | Requires fire control |
| Railgun | Damage + point defense | Compact, high fire rate |
| Particle Beam | Penetrating beam | Different damage curve |
| Gauss Cannon | Anti-missile PD | Single damage per shot |
| Missile Launcher | Fires player-designed missiles | Size 1-6, requires magazine |
| Magazine | Stores missiles | Civilian magazines have 100% explosion risk |
| Fire Control | Targeting system | 1 per 6-8 weapons recommended |

### Defensive
| Component | Purpose | Notes |
|---|---|---|
| Armor | Damage absorption | NxM grid (thickness × width) |
| Shield Generator | Energy shield | Larger = more efficient |
| ECM | Reduces enemy beam accuracy | -10% per point |
| ECCM | Counters enemy ECM | |

### Logistics
| Component | Purpose | Notes |
|---|---|---|
| Cargo Hold | Transport goods | Standard and large |
| Cryo Transport | Transport colonists | For colony ships |
| Cargo Shuttle Bay | Load/unload cargo | Required for cargo/colony ships |
| Tractor Beam | Move stations/ships | For tugs |
| Refueling System | Transfer fuel to other ships | For tankers |
| Recreation Module | Reset deployment clock | For fleet train |

---

## Active Sensor Range Formula

```
Range = Sensor Strength × Sensor Size × √(Resolution) × EM Sensitivity × 10,000 km
```

Higher resolution = better against larger targets, worse against smaller. Must be configured per design goals.

---

## Armor System

- NxM grid: **N = thickness** (adjustable), **M = width** (determined by ship size/components)
- Missiles create craters (wide, shallow damage)
- Lasers penetrate narrowly but deeply
- Armor rating adjustable via arrows in design panel

---

## Design Validation Rules

Aurora flags these errors:
- Weapons without fire controls
- Insufficient life support (crew quarters < required crew)
- No engine
- Missing bridge
- Deployment time exceeded by maintenance life
- MSP insufficient for expected deployment

---

## Design Workflow

1. Open Class Design (F5)
2. Set name, type, hull designation
3. Switch to Design View tab
4. Add components from Available Components pane
5. Configure armor thickness
6. Set deployment time
7. Verify: maintenance life > deployment, MSP sufficient, fuel range adequate, no design errors
8. Lock design for production
9. Retool shipyard
10. Queue construction

---

## Missile Design (Create Research Project)

- Size 1-6 recommended (active sensor detection threshold)
- Warhead: 25-40% of total mass for optimal armor penetration
- Game rewards specific warhead sizes (4, 9, 16)
- Fire control: 1 per 6-8 launchers
- Anti-missile missiles (AMMs): size-1, strength-1 warheads, maximum fire rate

## Turret Design

- Mounts beam weapons for tracking
- Tracking speed determines accuracy vs fast targets
- Size affects mounting options and fire rate

---

## Relevance to Drift

### What to adopt
- Discrete dropdown engine parameters (not sliders)
- Design Errors pane for validation feedback
- Component catalog with category grouping
- HS as unit system (or equivalent mass units)
- Fuel modifier formula: `power ^ 2.5` for exponential fuel cost
- Separate design tabs: Engine, Missile, Turret, Sensor
- Create + Prototype workflow

### What to simplify
- Aurora's 7 engine dropdowns can be reduced to 4-5 meaningful choices
- Armor grid system is visual — Drift can use simpler HP-based armor
- Skip GU (Ground Unit) design for now
- Thermal signature system can be deferred
