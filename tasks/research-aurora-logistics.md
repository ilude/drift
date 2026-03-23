# Aurora 4X: Ship Design, Logistics & Manufacturing Systems

Reference material for Drift's ship design, logistics, and production mechanics.

## Ship Design System

### Hull & Tonnage
Ships defined by Hull Spaces (HS). Actual tonnage = sum of components. Range from 500 tons (fighters) to massive capital ships.

| Metric | Description |
|--------|-------------|
| Hull Spaces | Size unit = ship capacity |
| Build Points (BP) | Total construction cost |
| TCS (Total Cross Section) | Sensor detection size |
| Thermal Signature | Heat from engines |
| EM Signature | Electromagnetic emissions from shields |

### Core Components

| Component | Purpose | Notes |
|-----------|---------|-------|
| Bridge | Command & control | Required; auto-allocated |
| Crew Quarters | Personnel | Scales with crew size |
| Engineering Spaces | Maintenance | Decreases malfunction rate |
| Fuel Storage | Propellant | 3x more expensive than cargo per HS |
| Cargo Holds | General storage | Multiple sizes |
| Engines | Propulsion | Must be researched; larger = more fuel efficient |
| Sensors | Detection | Customizable resolution/power |
| Weapons | Combat | Beams, missiles, kinetic |
| Armor | Protection | Adjustable thickness |

### Design Constraints
- Larger engines: +1% fuel efficiency per HS, increased durability (non-linear cost curve)
- Large ships can't land — need Cargo Shuttle Bays (10 HS each) to load/unload
- Engineering spaces + maintenance supplies must cover mission duration
- Every component must be researched separately before use

### Design Process
1. Research components via tech tree
2. Select class size, add components from available inventory
3. Bridge, crew, fuel, engineering auto-allocated
4. Lock design before construction; retooling shipyards changes require time

## Survey Ships

### Standard Survey Ship Loadout
| Component | Purpose | Notes |
|-----------|---------|-------|
| 2x Engines | Propulsion | Redundancy for reliability |
| Geological Survey Sensors | Surveying | 1 survey point/hour (base) |
| Engineering Spaces | Maintenance | Increases deployment life |
| Maintenance Bay | Supply storage | 5 years recommended |
| Large Fuel Storage | Range | ~157.8 billion km range |
| Armor | Protection | Basic shielding |

- **Deployment time:** Set to match expected mission (48 months for solar surveys)
- **Maint Life** must exceed deployment time
- Survey must complete before mining can begin on a body

## Logistics & Transport

### Cargo Ships (Freighters)
- Transport colonists, installations, trade goods between colonies
- Speed vs. cost: faster hauling = better ROI but non-linear cost increase
- Large ships require Cargo Shuttle Bays to load/unload without Spaceport

### Standing Orders (Automation)
- Define default behavior when no active orders
- Ships auto-return, refuel, resupply per standing orders
- Civilian shipping lines automatically establish profitable trade routes
- Require two-way Jump Gates for interstellar travel

### Resource Movement Pipeline
```
Mines → Colony Stockpile → Construction Factories → Component Storage → Shipyards → Ships
                ↑
        Mass Drivers / Freighters (intercolony transport)
```

## Mass Drivers

### Mechanics
- Surface installation that launches mineral packets to other locations
- **Throughput:** 5,000 tons of minerals per year per driver
- **Receiver:** Only 1 mass driver needed to receive (unlimited capacity)
- **Range:** Intrasystem only (single star system)
- Multiple senders can target one central receiver

### Dual-Use: Transport & Weapons
- **Civilian:** Move 5,000 tons/year, concentrate scattered mining output, reduce freighter dependency
- **Military:** 5,000-ton kinetic impacts deliver massive damage, hard to defend against
- **Key design:** Receiver requirement creates interesting gameplay — without receiver, packets become kinetic weapons

### Logistics Comparison
| Method | Speed | Cost | Capacity | Automation |
|--------|-------|------|----------|-----------|
| Mass Drivers | Instant | Low | 5,000 t/yr | Full |
| Freighters | Slow | Moderate | Large | Partial (standing orders) |
| Mining Ships | Slow | Moderate | Variable | Manual |
| Tugs | Slow | Low | Variable | Manual |

## Mining Operations

### Mine Types
| Type | Population | Cost | Notes |
|------|-----------|------|-------|
| Standard Mine | 50,000 per mine | Base | Can be shutdown (6-month reactivation) |
| Automated Mine | None | 2x normal | Cannot be shutdown; same extraction rate |
| Civilian Mining Complex | Managed by private sector | Special | = 10 automated mines; taxable |

### Mining Deployment
1. Survey body to identify accessible minerals
2. Deploy mining installation (standard or automated)
3. Installation auto-extracts minerals to colony stockpile
4. Transport via mass driver or freighter to processing location

### CMC Requirements
- Body must have 10,000+ tons accessible minerals
- System must have 10M+ population within 80 AU of star
- Taxable: 125 wealth/year per CMC

## Manufacturing & Production

### Facility Types
| Facility | Pop/Unit | Output | Produces |
|----------|----------|--------|----------|
| Construction Factory | 50,000 | Racial construction rate/year | Installations, components, supplies |
| Ordnance Factory | 50,000 | 10 missiles/year (upgradeable) | Missiles |
| Fighter Factory | 50,000 | Racial fighter rate/year | Fighters (<500 tons) |
| Research Lab | Variable | 200 RP/year (upgradeable) | Research points |

### Shipyard Mechanics
| Type | Base Capacity | Slipway Cost | Notes |
|------|---------------|-------------|-------|
| Naval | 1,000 tons | 120 BP/slipway | Can build all designs including warships |
| Commercial | 10,000 tons | 12 BP/slipway | 10x capacity, can't build warships |

- Each slipway builds ONE ship concurrently
- Capacity expandable: 500, 1,000, 2,000, 5,000, 10,000 ton increments
- Must retool shipyard when switching ship designs

### Ship Building Process
1. Design ship class (select components, lock design)
2. Retool shipyard to that design
3. Queue construction
4. Shipyard draws components from storage + minerals from stockpile
5. Completed ship enters fleet

## Research & Tech Progression

### Research Mechanics
- Each tech requires Research Points (RP)
- Labs generate RP based on: base rate (200/yr) × scientist bonus × specialization (4x in their field)
- Technologies researched sequentially or in parallel
- **Key early techs:** Improved construction rate, improved research rate (cascading benefit)

### Typical Tech Progression
1. Basic engines, sensors, armor
2. Construction rate improvements (reduce build times)
3. Research rate improvements (accelerate all future research)
4. Combat systems
5. Advanced propulsion (jump drives)
6. Specialized systems (jump gates, cloaking, shields)

## Production Bottlenecks by Game Phase

| Phase | Bottleneck | Why |
|-------|-----------|-----|
| Early | Construction factories | Slow component production |
| Mid | Shipyard slipways | Limits parallel construction |
| Late | Research labs | Tech advancement rate |
| Always | Freighter fleet size | Material transport capacity |
