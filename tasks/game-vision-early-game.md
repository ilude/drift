# Early Game Vision & Core Loop

> Status: Accepted design direction (2026-03-26)

## Starting Condition: Earth "At The Margin"

The player begins on Earth in a constrained but functional state — not broke, but no slack. The starting economy requires active decisions to grow. Three levers:

1. **Factories** — production capacity; everything else depends on having enough factories
2. **Farming** — food production; required for population sustainability and growth
3. **Mines** — raw materials; feed factories and construction

Earth is the only colony at game start. The player must grow its industrial base before expansion is possible.

---

## The Early Game Gate

Before the player can colonize or survey the solar system, they must:

1. **Grow Earth's industrial base** — enough factories to produce colony modules and ship components
2. **Research ship systems** — engines, life support, and power systems are research unlocks, not starting equipment
3. **Design a ship** — no ship can be built without a player-authored design. The player assembles component lists from unlocked systems.
4. **Build the ship** — requires a shipyard installation and construction time

This sequence ensures the first ship feels *earned*, not given. The player has already invested in the economy before they expand.

---

## Flat-Packed Modules

Earth manufactures **colony infrastructure modules** — prefabricated units that can be loaded onto cargo ships and shipped to new colonies. At the destination, the colony assembles them into operational installations.

This is the core logistics chain:
```
Earth factories → modules → cargo ship → new colony → assembled installation
```

Module types map to installation types: mine modules, construction factory modules, fuel depot modules, lab modules, etc. A colony cannot build beyond what has been physically shipped to it (or what it can manufacture locally once it has factories of its own).

This makes Earth the industrial hub early game and creates natural logistics demand for cargo ships.

---

## Two Core Player Systems

The entire game is built around two primary engagement loops:

### 1. Ship Design
- Early game and persistent throughout
- Every ship requires a player-authored design — no default ships
- Components (engines, life support, cargo bays, maintenance bays, hibernation tubes, weapons) are research unlocks
- Each component has: mass, crew requirement, power draw, and performance characteristics
- No visual placement — a component list that resolves to a ship specification
- The design determines what the ship *can do* (survey, colonize, tanker, cargo, combat)
- Shipyard installation required to build; construction time scales with ship mass

### 2. Nodal Production Chains
- Mid-to-late game depth system
- Player designs blueprints: iron ore + carbon → steel; steel + aluminum → aerospace alloy
- Blueprints chain: mine output feeds refinery input, refinery output feeds factory input
- Factory types specialize: chemical processing (fuel, fertilizer), metallurgy, hydroponics, aerospace fabrication
- Blueprints are reusable templates — deploy the same blueprint at multiple colonies
- Production chain design is the primary optimization puzzle of the empire

---

## The Growth Hook ("The Factory Must Grow")

The game's core compulsion loop:
- Every expansion requires more modules → needs more factories
- More factories need more raw materials → need more mines
- More mines and factories need more workers → need population growth
- Population growth needs food, housing, medical facilities → needs more colony development
- Better colony development unlocks better research → unlocks better ship components
- Better ships enable deeper survey and further colonization → new resources
- New resources feed new production chains → new capabilities → expand again

No endpoint. Every optimization shifts the constraint to the next bottleneck. The player should always have one more thing they want to do before stopping.

---

## Colony Management and the Governor System

Once a colony is established, the player can:

**Full micromanagement:** Assign construction queues manually, set factory allocations %, manage research staffing directly.

**Governor handoff:** Assign a governor to handle colony construction decisions. The governor is a deterministic AI — no RNG behavior, predictable decision-making based on their skill profile and the colony's current needs. The player can constrain the governor's scope (e.g., "manage construction only, I handle research") so the handoff is gradual, not binary.

**Research always stays with the player.** Governors can build academies and labs to maintain staff availability, but the player assigns scientists to projects from the research screen. This is the system that always requires player attention regardless of automation level.

See `tasks/governor-system-design.md` for governor AI design details.
