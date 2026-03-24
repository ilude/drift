# Niche Factory & Strategy Game Production Systems Research

> **Status:** Reference material for future production system design. Not yet implemented. Key takeaway: node-graph production with automatic logistics is the target abstraction level.

Reference material for Drift's production system design. Covers SpaceChem, Captains of Industry, Dyson Sphere Program, Shapez, Oxygen Not Included, Victoria 3, and Anno series.

## SpaceChem

### Core Mechanic: Process Definition, Not Physical Placement
- Reactors operate on a 10×8 grid with two manipulators ("waldos")
- Players place command icons to choreograph waldo movement — visual programming
- Chemical bonds form at bonding nodes following real valence rules
- **Key insight:** You define *processes* (what happens to items), not *routing* (where items go)
- Scales elegantly without UI bloat — no belt-laying tedium

### Multi-Reactor Pipelines
- Large puzzles chain multiple reactors on a grid
- Output from one reactor feeds directly into next
- Players decide intermediate products — the supply chain design IS the puzzle
- Each reactor solves one transformation step; complexity emerges from chaining

### Complexity Scaling
- Early: single-waldo movement, basic bonding
- Late: synchronized two-waldo choreography, branching logic
- Teaches programming concepts (abstraction, loops, synchronization) without explicit instruction

## Captains of Industry

### Production Chain Structure
- Extraction → Processing → Manufacturing (standard 3-tier)
- Mining → Smelting → Intermediate factories → Finished products
- Infrastructure tiers unlock deeper chains as game progresses

### Logistics (4 transport types)
| Method | Use Case | Notes |
|--------|----------|-------|
| Trucks | General-purpose, auto-routes | Good for low-throughput |
| Conveyor Belts | High-throughput point-to-point | 4 tiles/sec, continuous flow |
| Pipes | Fluids only (water, oil, steam) | Vertical routing available |
| Rail | Bulk long-distance | Slow setup, massive capacity |

### Key Constraints
- **Population/workforce:** Each building requires workers; advanced buildings need trained specialists
- **Power:** Diverse sources (coal, wind, solar, nuclear); overloading causes brownouts
- **Pollution:** Industrial buildings generate pollution → reduces population happiness → limits growth
- **Waste recycling:** Advanced buildings convert waste to resources (closed loops)

## Dyson Sphere Program

### Belt System
- MK.I (6/s), MK.II (12/s), MK.III (30/s) — clear tier progression
- One item type per belt (no mixing)
- Items flow automatically; belts are "dumb" transport

### Production Design
- Assemblers auto-throttle: stop when starved or blocked, minimal power consumption
- Throughput = slowest machine in chain → ratio balancing is core gameplay
- Sorters filter and route items — critical for splitting flows
- Emphasis on continuous flow over buffering

## Shapez

### Abstract Production
- Extractors → Conveyors → Transformation machines
- "Shape algebra": rotate, color, split quadrants, combine
- Each factory is a self-contained transformation module
- Once optimized, copy-paste to scale

### Visual Design
- All machines are transparent — see items flowing through
- Immediate visual feedback without tooltips
- Math-based: success requires calculating input/output ratios

## Oxygen Not Included

### Resource Loops (Closed Systems)
- Sustainability built on waste→input cycles
- Water → electrolyzer → oxygen + hydrogen; polluted water → slime → algae
- Heat from machines → steam turbines → power (thermal recycling)
- **Key design:** No magic loss — every input must exit somewhere

### Design Philosophy
- Simple mechanics (pipes, pumps, filters) create emergent complexity
- Experimentation-driven — discover relationships through trial
- True sustainability requires balancing ALL inputs and outputs

## Victoria 3

### Highest Abstraction Level
- Each building chooses one **production method** → determines inputs, outputs, workforce
- Single menu choice encodes entire production chain — no physical placement
- Global market with supply/demand price fluctuation
- Regional specialization: different provinces use different methods

### Workforce Integration
- Buildings employ specific professions (laborers, craftsmen, clerks)
- Production scales with employment level
- Wealthier populations demand goods further up production chains → cascading requirements

## Anno Series (1800, 117)

### Production Chains with Ratios
- Sequential: raw materials → processing → manufacturing (e.g., wood → lumber → furniture)
- Pre-calculated ratios: players build correct number of each building type
- Arranged in ~15×15 "squares" around warehouses for replication

### Multi-Island Logistics
- Different islands have different fertility/resources → forces specialization
- Trade ships transport between islands; long routes are expensive
- Central hub model: one productive island, satellites for raw materials

## Cross-Game Abstraction Spectrum

| Game | Abstraction | Focus | UI Model |
|------|------------|-------|----------|
| Factorio | Low (spatial) | Physical layout | Placed objects on grid |
| DSP | Low-Medium | Belt routing + ratios | 3D world placement |
| Captains of Industry | Medium | Building placement + logistics | Factory UI + 3D |
| Anno 1800 | Medium-High | Ratios + spatial layout | City-building |
| Shapez | High | Shape transformations | Conveyor + machines |
| SpaceChem | Very High | Process logic | Grid-based commands |
| Victoria 3 | Very High | Economic methods | Menu-based selection |

**Key insight:** Dedicated factory games emphasize spatial detail. Strategy/4X games abstract to methods and ratios. The sweet spot for Drift is probably between Anno and Victoria 3 — node-graph production with automatic logistics.

## Design Takeaways for Drift

### What Works for 4X (production is ONE system among many)

1. **Abstraction over spatial detail** — Can't afford Factorio-level belt optimization. Use node graphs or production methods.

2. **Workforce as binding constraint** — Population and specialists (engineers, miners, scientists) are more interesting limiters than raw material counts.

3. **Visible feedback** — Whether node graph or menu, make production state visible. Shapez transparency principle: never a black box.

4. **Closed loops encourage emergent play** — ONI's cycling mechanic is powerful. Space-based: energy recycling, water reclamation, waste processing.

5. **Regional specialization** — Like Anno/Victoria 3, let different planets/bodies specialize. Creates trade dependencies and strategic depth.

6. **Automatic logistics** — Players decide *what* to produce, not *how to route it*. Trucks/ships auto-route like Captains of Industry.

### UI Patterns

| Pattern | Pros | Cons | Best For |
|---------|------|------|----------|
| Grid commands (SpaceChem) | Compact, powerful | Steep learning curve | Puzzle games |
| 3D placement (Factorio) | Intuitive, satisfying | Overwhelming at scale | Factory-focused |
| Menu selection (Victoria 3) | No bloat, clear | Feels abstract | Grand strategy |
| **Node graph (overlay)** | **Clarity without 3D** | **Requires learning** | **4X hybrid** |
| World + menu (Anno) | Spatial + logical | Moderate complexity | City builders |
