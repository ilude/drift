# Aurora 4X — Installations Reference

Source: [Aurora 4X Wiki](https://aurora4x.fandom.com/wiki/Installations), community documentation

---

## Installation Types

### Production Installations (50k population requirement each)

| Installation | Function | Rate | Notes |
|---|---|---|---|
| Construction Factory | Builds all installations | Base BP/year | Core production facility |
| Ordnance Factory | Produces missiles | Per-unit output | Separate from construction |
| Fighter Factory | Builds fighters (<500 tons) | Per-unit output | Fighters don't need shipyards |
| Fuel Refinery | Converts Sorium → fuel | Base rate/year | Critical for fleet operations |
| Mine | Extracts minerals | 10 units/year base | Research-upgradable extraction rate |
| Automated Mine | Extracts without workers | Lower rate than manned | For remote/hostile colonies |

### Support & Services

| Installation | Function | Pop Requirement | Notes |
|---|---|---|---|
| Maintenance Facility | Logistics support for ships | 50k | Ships need these for overhaul |
| Financial Centre | Increases colony wealth | 50k | Income generation |
| Terraforming Installation | Modifies atmosphere | 250k | Very slow process |
| Ground Force Training Facility | Trains ground units | 50k | For ground combat |
| Spaceport | Orbital cargo handling | 50k | Enables cargo shuttle operations |
| Mass Driver | Launches mineral packets | 50k | 5,000 tons/year per driver |

### Leadership & Research

| Installation | Function | Pop Requirement | Notes |
|---|---|---|---|
| Military Academy | Generates 5 leaders/year | 50k | Officers, scientists, administrators |
| Research Lab | Enables tech research | 1M | High population requirement |
| Sector Command | Administrative headquarters | 50k | For sector governance |

### Infrastructure

| Installation | Function | Notes |
|---|---|---|
| Infrastructure | Life support for low-suitability bodies | Bio-domes with food/water/atmosphere |
| Conventional Industry | Pre-TN production | Converted to TN facilities |

---

## Key Mechanics

- All installations require **population** to operate (staffing)
- Construction Factories build other installations (bootstrap loop)
- Production rates scale with **research tech** and **colony quality**
- Automated mines work without population but at reduced rates
- Mass drivers transport minerals between bodies at 5,000 tons/year each
- Research labs require 1M population — high barrier for new colonies

---

## Comparison with Drift's Colony System

### Currently Implemented in Drift (Phase 0)
| Drift Installation | Aurora Equivalent | Status |
|---|---|---|
| repair-yard | Maintenance Facility | ✓ Implemented |
| fuel-depot | Fuel Refinery | ✓ Implemented |
| mine | Mine | ✓ Implemented |
| lab | Research Lab | ✓ Implemented |
| academy | Military Academy | ✓ Implemented |
| construction-factory | Construction Factory | ✓ Implemented |
| storage | (No direct equivalent) | ✓ Implemented |
| shipyard | (Part of Shipyard tab) | ✓ Implemented |

### Missing from Drift (potential additions)
| Aurora Installation | Priority | Notes |
|---|---|---|
| Ordnance Factory | Medium | Needed when missile system exists |
| Fighter Factory | Low | Deferred — no fighters in Drift yet |
| Financial Centre | Low | Drift uses simpler economy |
| Terraforming Installation | Medium | Referenced in bio tech tree |
| Mass Driver | High | Key logistics mechanism (5k tons/yr) |
| Automated Mine | Medium | For remote colonies |
| Spaceport | Medium | Cargo shuttle operations |
| Ground Force Training | Low | No ground combat in Drift |
| Infrastructure | Already exists | Drift handles differently |

### Highest-Value Additions
1. **Mass Driver** — Creates interesting logistics chains between bodies
2. **Automated Mine** — Enables resource extraction from inhospitable bodies
3. **Terraforming Installation** — Already referenced in Drift's bio tech tree
4. **Ordnance Factory** — Prerequisite for missile/combat systems
