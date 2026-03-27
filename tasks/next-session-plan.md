# Next Session Plan — Ship Tech Research Trees & Game Lore

## Session Goals

1. **Review ship tech research trees** — Map out what technologies gate which ship components and design capabilities
2. **Plan ship components** — Complete component catalog for engines, missiles, turrets, sensors, defensive systems
3. **Flesh out research trees** — Design prerequisite chains for all ship-related technologies
4. **Develop game lore** — Create foundational lore that informs and motivates the tech tree structure

## Why Lore Matters for Tech Trees

Tech trees feel arbitrary without narrative grounding. Lore answers:
- Why does this tech exist? (What problem does it solve in-universe?)
- Why does it come in this order? (What scientific/engineering breakthroughs are prerequisites?)
- What faction/era does it belong to? (Creates thematic coherence)
- What are the tradeoffs? (In-universe engineering constraints map to gameplay tradeoffs)

Example: "Nuclear Radioisotope Engines are first-gen TN drives — cheap, reliable, but slow. The breakthrough to Nuclear Thermal requires understanding pressurized water reactors, which is why it's gated behind that research."

## Topics to Cover

### Ship Tech Categories
- **Propulsion:** Engine tiers, fuel efficiency research, thermal reduction, commercial vs military
- **Weapons:** Beam weapons (laser, railgun, particle beam, gauss), missile systems, turret mounting
- **Sensors:** Geological survey, gravitational survey, active sensors (resolution tradeoff), passive (thermal/EM)
- **Defense:** Armor tech, shields, ECM/ECCM
- **Logistics:** Cargo systems, cryo transport, refueling systems, tractor beams, maintenance
- **Crew:** Life support, crew quarters, recreation, engineering spaces

### Research Tree Structure
- How many total techs? (Aurora has hundreds, Drift should have 40-80 for v1)
- How many categories? (Currently 5: survey, industry, logistics, research, biology — need propulsion, weapons, sensors, defense)
- Prerequisite depth? (2-4 tiers per category seems right)
- Cross-category prerequisites? (e.g., "Applied Physics" unlocking both advanced engines AND particle beams)

### Lore Topics
- Setting era and faction identity (Terran Space Agency, 2038+)
- Trans-Newtonian physics — what is it, how was it discovered?
- Why exploration matters (resource scarcity? existential threat? curiosity?)
- Ship naming conventions and traditions
- Colony founding narratives
- The "why" behind each tech tier

## Existing References
- `tasks/aurora-research-implementation.md` — Current 20-tech tree
- `tasks/aurora-wiki-ship-creation.md` — Aurora component catalog
- `tasks/aurora-ship-design-implementation.md` — Ship design notes
- `tasks/research-tech-tree-reference.md` — Tech tree reference
- `tasks/aurora4x_tech_tree.md` — Aurora tech tree data
- `tasks/design-viewer-rework.md` — Current rework plan (needs tech data to complete)
- `.claude/CLAUDE.md` Design Philosophy section — depth principles
