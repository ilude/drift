# Resource System Design Notes

Working design document for Drift's resource/mining system. Not a plan — just decisions and ideas captured during discussion.

## Key Design Decisions (confirmed)

- **Survey model:** Progressive — sensor tech level determines which deposits are revealed
- **Mining difficulty:** First 60-80% easy, last 20% increasingly harder (accessibility depletion)
- **Generation:** Lazy deterministic — deposits generated when surveyed, using hash(systemSeed, bodyName). System has a "richness" budget allocated at generation time.
- **Fictional element category:** "Umbral Elements" — discovered through dark matter/dark energy research
- **Naming style:** Lab-coat scientific — sounds like real nomenclature, not fantasy minerals
- **Scope for first pass:** Data model only (types, catalog, interfaces)

## Resource Catalog (27 total)

### Metals (5) — minable
| ID | Name | Symbol | Description |
|----|------|--------|-------------|
| `iron` | Iron | Fe | Primary structural metal |
| `copper` | Copper | Cu | Wiring, electronics |
| `aluminum` | Aluminum | Al | Lightweight structures |
| `titanium` | Titanium | Ti | High-strength alloys |
| `platinum` | Platinum Group | Pt | Catalysts, precision electronics |

### Industrial (4) — minable
| ID | Name | Symbol | Description |
|----|------|--------|-------------|
| `silicon` | Silicon | Si | Semiconductors, solar cells |
| `carbon` | Carbon | C | Composites, organic chemistry |
| `rare-earth` | Rare Earth Elements | RE | Magnets, advanced electronics |
| `phosphorus` | Phosphorus | P | Agriculture, chemical processes |

### Volatiles (4) — minable
| ID | Name | Symbol | Description |
|----|------|--------|-------------|
| `water` | Water | H2O | Life support, propellant, industrial solvent |
| `nitrogen` | Nitrogen | N | Atmospherics, agriculture |
| `helium-3` | Helium-3 | He3 | Fusion fuel |
| `hydrocarbons` | Hydrocarbons | HC | Plastics, chemical feedstock |

### Radioactive (6) — 3 minable, 3 processed
| ID | Name | Symbol | Minable | Description |
|----|------|--------|---------|-------------|
| `uranium` | Uranium | U | yes | Natural fission fuel, baseline power |
| `thorium` | Thorium | Th | yes | Alternative fission cycle, safer reactors |
| `deuterium` | Deuterium | D | yes | Heavy hydrogen, fusion fuel component |
| `enriched-uranium` | Enriched Uranium | EU | no | Processed from uranium; higher energy density, weapons |
| `plutonium` | Plutonium | Pu | no | Bred from uranium in breeder reactors; weapons-grade |
| `tritium` | Tritium | T | no | Bred from lithium/heavy water; fusion booster |

### Umbral Elements (8) — minable
Discovered through dark matter/dark energy research. Named by committees of tired physicists.

| ID | Name | Symbol | Description |
|----|------|--------|-------------|
| `ortheum` | Ortheum | Or | Stable post-baryonic substrate; FTL nav, jump calibration, gate alignment |
| `cadrine` | Cadrine | Cd* | Curvature-responsive heavy material; gravitic drives, tractor systems |
| `vantine` | Vantine | Vt | Low-cross-section interaction medium; stealth, ECM, thermal masking |
| `nemorin` | Nemorin | Nm | Metastable condensate host; shields, capacitors, field reservoirs |
| `caritene` | Caritene | Ct | Dense shear-resistant lattice; armor, structural reinforcement |
| `heliate` | Heliate | He* | Energetic transfer medium; reactors, beam weapons, drive injection |
| `tessarene` | Tessarene | Ts | Topological-active crystal; jump cores, phase weapons |
| `istrium` | Istrium | Is | Unstable transitory from collapse events; torpedoes, singularity weapons |

## Design Principles

### Emergent Dual-Use Systems (Dwarf Fortress philosophy)
Every system should have unintended but mechanically consistent secondary uses. The game should simulate physics/rules, not intent. If a player finds a creative abuse, that's a feature.

**Confirmed examples:**
- **Mass drivers:** Civilian mineral transport. Remove the receiver? Kinetic bombardment weapon. The system doesn't check intent — it launches mass at a target coordinate.
- **Breeder reactors:** Process uranium into plutonium for power. Also produces weapons-grade material. The reactor doesn't know what the plutonium is for.
- **Tritium production:** Bred from lithium for fusion reactors. Also the key ingredient in thermonuclear warheads.

**Design opportunities to explore:**
- **Cargo ships as ramming weapons** — a freighter full of ore at high velocity is a kinetic weapon
- **Mining lasers as surface weapons** — if they can cut rock, they can cut hull plating
- **Fuel refineries near gas giants** — strategic chokepoint; destroy the refinery, strand the fleet
- **Asteroid redirect** — if you can move asteroids for mining, you can move them into collision courses
- **Reactor overload** — if power plants can be pushed past safe limits, they become bombs
- **Atmospheric processors** — terraforming equipment could also be used to make atmospheres toxic/unbreathable
- **Survey data as intelligence** — knowing what resources a system has tells you what the enemy needs to defend

**Implementation principle:** Build systems that simulate consistent rules. Don't add "weapon mode" flags — let the physics and logistics math handle it. If 5,000 tons of iron hitting a planet at orbital velocity does damage, it does damage whether the player "intended" it as a weapon or not.

### Node-Graph Production (ComfyUI-inspired)
- Each node = a facility (mine, smelter, refinery, factory, shipyard)
- Typed input/output ports with throughput rates (tons/year)
- Wire nodes together to define material flow
- Bottlenecks visible as mismatched rates on connections
- Defines *processes* not *routing* (SpaceChem insight) — logistics is automatic

### Abstraction Level
Between Victoria 3 (pure menus) and Anno (ratio-based placement). Players design production workflows, not belt layouts. Automatic logistics handles physical transport.

## Open Questions

- Processing chains: How deep should the dependency graph go? (e.g., Uranium → Enriched Uranium → Plutonium)
- Should normal resources also have processed variants? (e.g., Iron → Steel, Silicon → Microchips)
- Tech tree structure for survey sensors — how many levels?
- What body types favor which resource categories?
- Asteroid mining vs planetary mining — different mechanics?
- How does system richness budget interact with body-level generation?
- What other systems have natural dual-use potential?
- How do we handle "accidental" destruction from dual-use without making the game feel unfair to NPCs?

## Reference
- `tasks/aurora-4x-reference.md` — Aurora 4X minerals and survey mechanics
- `tasks/research-aurora-logistics.md` — Aurora 4X ship design, mass drivers, shipyards
- `tasks/research-factory-chains.md` — Factorio/Satisfactory production patterns
- `tasks/research-niche-factory-games.md` — SpaceChem, Captains of Industry, DSP, Victoria 3, Anno
