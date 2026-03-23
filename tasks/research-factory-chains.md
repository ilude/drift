# Factorio & Satisfactory Production Chain Research

Reference material for Drift's production system design.

## Factorio

### Resource Tiers & Production Chain
```
Raw Ore → Smelted Plates → Intermediate Products → Complex Products → End Products
  (mine)    (furnace)        (assembler)            (assembler)       (rocket/science)
```

- Smelting: 1 ore = 1 plate (1.6–3.2 seconds depending on material)
- Late-game production reaches 100+ machines for single end-products

### Key Production Chains
| Product | Crafting Time | Inputs | Chain Depth |
|---------|-------------|--------|-------------|
| Red Science | 5s | Copper plate + Iron gear | 2 steps |
| Green Science | 6s | Inserter + Transport belt | 3 steps |
| Blue Science | 24s | Red circuits + Engine units + Sulfur | 5+ steps |
| Production Science | complex | Electric furnaces + Productivity modules + Rails | 8+ steps |

### Ratios & Bottlenecks
- Science pack ratio: 5:6:5:12:7:7 (red:green:grey:blue:purple:yellow)
- Calculation: Assemblers needed = Target output ÷ Output per assembler
- Green circuits are universal bottleneck in mid/late-game
- 70%+ of factory complexity comes from intermediate dependencies

### Logistics Tiers
| Method | Capacity | Range | Use Case |
|--------|----------|-------|----------|
| Belts | 2,700 items/min (express) | ~500 tiles | Main bus, local transport |
| Trains | 2,000–4,000 items/wagon | Long distance | Inter-base transport |
| Robots | Low bulk | Short range | Dense areas, late game |

## Satisfactory

### Resource Processing
- Raw ore comes in quality tiers: impure/normal/pure
- Ore → Smelter → Ingots → Assembler → Components
- Mk.1–5 conveyor belts: 60→780 items/min

### Alternate Recipes (Strategic Depth)
- 70% building reduction and 53% resource savings possible with optimal recipes
- Key examples: Pure Copper Ingot (2x output), Steel Rotor, Steel Frame
- Evaluation criteria: resource efficiency, power consumption, building count, complexity

### Power as a Constraint
- Central resource limiting production speed
- Overclocking: exponentially increased power for marginal speed gain
- Underclocking: optimization tool for smoothing consumption peaks

### Conveyor Design Patterns
- **Manifolds:** Compact vertical, simple expansion — items fill first machine, overflow to next
- **Load balancers:** Precise 50/50 distribution, more horizontal space
- **"Split before merge"** principle prevents bottlenecks
- Fluids: auto-balancing pipeline system (no explicit balancers needed)

## Common Patterns (Design Takeaways for Drift)

### What Makes Production Chains Satisfying
- **Feedback loop:** See problem → fix it → optimize the fix (never-ending)
- **Predictable & debuggable:** World is complex but deterministic
- **Optimization culture:** Design once, improve indefinitely
- **Visual flow:** Watching materials move through the chain is inherently satisfying

### Complexity Progression
| Phase | Chain Depth | Machines | Example |
|-------|------------|----------|---------|
| Early | 2–3 steps | 2–5 | Iron ore → plate → gear |
| Mid | 5–10 steps | 10–20 | Oil → plastic → red circuits |
| Late | 15–30+ steps | 100+ | Rocket parts (5+ intermediate stages) |

### Key Design Principle
- **Late-game has exponential resource scaling** (300x resource multiplier in Factorio)
- Neither game visualizes production flow natively — players use mental models and external calculators
- Community blueprints/guides fill the visualization gap (opportunity for Drift's node UI)

### Relevance to Drift
- Production chains should START simple (2-3 steps) and grow organically
- Intermediate products are what create depth (plates → gears → inserters, not ore → inserter)
- Bottleneck identification is the core gameplay loop
- A node-based visual editor would solve a real pain point that Factorio/Satisfactory players work around with external tools
