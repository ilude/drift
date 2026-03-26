# Game Depth Theory — Design Reference

> **Source:** YouTube transcript on game depth theory, covering Shannon number, combinatorial depth, emergence, and what makes games persist across centuries. Supplemented with CCG and emergent systems research (pending).

## Core Thesis

**State space alone doesn't create depth.** Chess has ~10^120 possible games but only ~10^40 "sensible" games — an 80 order-of-magnitude gap. Depth comes from the number of **viable, non-redundant, and meaningful strategies** that emerge from that state space.

## Key Frameworks

### 1. Depth ≠ Complexity

Depth is not the number of rules or options. It's the number of **interesting decisions** (Sid Meier) that emerge from those rules. A game can be complex (many rules) without being deep (few meaningful choices), and deep (many meaningful choices) without being complex (few rules). Go has fewer rules than chess but a broader state space — more elegant/efficient, not better or worse.

### 2. Dominant Strategies Reduce Depth

**If one strategy always wins, the game is shallow regardless of its state space.** Devil May Cry 2's gun is a dominant strategy — you can kill from afar with no decision-making. Chess's mid-game has no dominant strategy, forcing constant decision-making. Depth requires that multiple strategies are **viable and non-redundant**.

### 3. Risk-Reward as Eternal Depth

Risk-reward creates situations with no clear answer — the player must weigh options dynamically:
- Geometry Wars: collect pellets for score multiplier, but it puts you in danger
- SSX: tricks fill boost meter, but you can crash and waste time
- Fighting games: attacking does damage but leaves you vulnerable

### 4. Mixed Strategy / Rock-Paper-Scissors Cycles

Games with **no dominant solution** (Nash equilibrium) create depth through reads and adaptation:
- Fighting games: hit beats throw, throw beats block, block beats hit
- These cycles can be **nested** — higher-level strategies built on lower-level RPS cycles
- Virtual Fighter's "yomi" (reads) creates depth from RPS + frame data + positioning
- **Key insight:** RPS alone is shallow. RPS + context + execution + layered strategies = deep.

### 5. Emergence — Systems Exhibiting Unpredicted Properties

The system produces behaviors that individual mechanics don't predict:
- Breath of the Wild's chemistry engine links elements + abilities → strategic and mechanical emergence
- Rocket jumping, Street Fighter 2 combos — glitches that increase state space
- **Designing for emergence requires interconnected systems that create combinatorial explosion**
- Sometimes emergence is unintentional — players push systems beyond designer intent (speedrunning, exploits)

### 6. Heuristics at Different Levels

Deep games have **rules of thumb that change based on context**:
- Chess early game: develop pieces, control center, castle
- Chess mid-game: entirely different heuristics based on position
- Go: shapes, life/death configurations, territory vs influence
- **Deep systems allow interplay between strategic foresight and improvisation — adhering to rules and breaking them**

### 7. Managed Uncertainty Creates Non-Deterministic Depth

Tetris: semi-random blocks fall in bundles of 7, ensuring set play is possible even amidst chaos. Hence openings exist (like chess). **Randomness is a tool for depth, not depth itself.** Same applies to difficulty and balance.

### 8. Mechanics Can Be Deep Individually

From Steve Swink's "Game Feel" + Celia Wagar's extensions:
- **Sensitive:** Input modulation → output variation (how hard you press jump affects arc)
- **Combined:** Move + jump creates more possible states than either alone
- **Versatile:** Multiple uses (jump = traversal AND attack)
- **Unique:** Every element has a niche (no redundancy)
- **Nuanced:** Inputs modulated for different outcomes based on context
- **Synergistic:** Elements used in conjunction for different outcomes

### 9. Orthogonal Unit Differentiation

Different elements should have **specific, distinct roles** used in combination:
- Doom: short-range + long-range + hitscan + projectile enemies in combinations
- Not just variety for its own sake — variety that creates **decision points**

### 10. Functionalism vs Situational Design

- **Functionalism:** lots of versatile options with no context to use them (Platinum Games critique)
- **Situational design:** level design, enemy configurations, difficulty craft scenarios that **ask players to make choices**
- Deep games don't just give you tools — they create situations where choosing the right tool matters

## Depth Metrics (From "Depth in Strategic Games" Paper)

| Metric | Description |
|--------|-------------|
| State space | Total possible game states |
| Viable strategies | Non-redundant, meaningful strategic options |
| Strategy ladder | Tiers of player skill that can be ranked |
| Skill chain | Progression of techniques from basic to advanced |
| Computational complexity | How hard is it for AI to solve? (Deep Blue vs AlphaGo) |
| Elegance | Ratio of rules to state space (fewer rules, more states = more elegant) |

## Application to Drift (4X Space Sim)

### Where Combinatorial Depth Could Emerge

**Tech tree as "card pool":**
- If tech branches combine non-obviously (sensor tech + fuel tech = something neither does alone), players discover synergies
- Forced exclusion (MOO1 style) means different "decks" per playthrough
- Per-seed randomization of available techs = every game has a different "hand"

**Ship configuration as deckbuilding:**
- Engine + hull + sensors + fuel + crew composition as interacting systems
- Constraints (mass budget, power budget, crew requirements) FORCE creative combination
- A ship isn't just stats — it's a build with synergies and tradeoffs

**Colony specialization as engine-building:**
- Research world + mining world + shipyard world as interconnected economy
- The "engine" is the network of colonies, not any single colony
- Bottleneck identification (Factorio pattern) as the core optimization loop

**Commander/crew as "character build":**
- Officer skills + ship configuration + mission type create interaction space
- A navigation specialist on a fast ship surveying comets = synergy
- An engineering specialist on an old ship with high malfunction rate = synergy

**Resource chains as combo engines:**
- 27 resources with processing chains = inputs combining to outputs
- Dual-use systems (mass drivers as weapons, breeder reactors producing weapons-grade material)
- The Dwarf Fortress principle: simulate consistent rules, let players find the implications

### Depth Design Principles for Drift

1. **No dominant strategies** — Every colony type, tech path, ship build should have tradeoffs. If one approach always wins, depth collapses.

2. **Constraints create depth** — Limited workforce, scarce scientists, finite building slots, per-seed tech availability. These FORCE creative solutions.

3. **Systems must interact** — Tech affecting ship performance affecting survey results affecting resource discovery affecting colony placement affecting research. The chain of interactions IS the depth.

4. **Viable non-obvious strategies** — Players should discover after 50 hours that "actually, a constellation of tiny asteroid outposts with automated mines feeding a central research colony is more efficient than one big Earth colony." Not because we told them — because the systems support it.

5. **Heuristics that change with context** — Early game heuristics (explore fast, survey everything) should differ from mid-game (specialize colonies, build tech chains) and late-game (optimize logistics, manage distant colonies).

6. **Emergence from consistent rules** — Don't design "combos." Design consistent systems (physics, demographics, resource flow, tech scaling) and let combinations emerge. The mass driver is a transport mechanism — if it also works as a weapon, that's emergence from consistent rules.

7. **Player mastery as progression** — The player levels up, not just the empire. Understanding the interaction space IS the skill ceiling. 100 hours in, you should still be discovering new strategies.
