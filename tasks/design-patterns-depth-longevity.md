# Design Patterns for Depth and Longevity in Open-Ended Simulation Games

Research reference covering the design patterns that make deep simulation games feel endlessly replayable. Drawn from analysis of Dwarf Fortress, RimWorld, Factorio, and Shadow Empire.

---

## Table of Contents

1. [Core Design Patterns](#1-core-design-patterns)
2. [Game-by-Game Analysis](#2-game-by-game-analysis)
3. [Cross-Cutting Themes](#3-cross-cutting-themes)
4. [The Five Questions](#4-the-five-questions-answered-per-game)
5. [Applicability to Drift](#5-applicability-to-drift)

---

## 1. Core Design Patterns

### Pattern 1: Simple Rules, Complex Interactions (Emergent Complexity)

The foundation of every game on this list. A small number of individually simple systems interact to produce outcomes the designer never explicitly authored. Conway's Game of Life is the canonical example: three rules, infinite complexity.

**How it works:** Each system (physics, needs, economy, relationships) follows straightforward rules. Depth comes from the *combinatorial explosion* of interactions between systems, not from any single system being complicated.

**Key insight:** The gap between "component complexity" (how hard each rule is to learn) and "emergent complexity" (how many surprising outcomes arise) is what Keith Burgun calls *elegance*. Maximize that gap.

**Examples:**
- Dwarf Fortress: A dwarf's preference for plump helmet wine leads to stockpile theft, which triggers a tavern brawl, which escalates into a loyalty cascade. No single system is complex; the chain is.
- RimWorld: A colonist with the "Brawler" trait gets insulted by an "Abrasive" colonist during a cold snap, breaks down, starts a fire in the food stockpile. Three simple systems (traits, mood, temperature) create a crisis.
- Factorio: Solving a copper bottleneck overloads the power grid, which browns out the inserters feeding the furnaces, which backs up the belt, which starves the circuit assemblers. Each link is trivial; the cascade is not.

### Pattern 2: The Endless Bottleneck (Self-Generating Goals)

The game always presents a next problem to solve without the designer scripting it. Solving one problem reveals or creates the next.

**How it works:** Systems are designed so that improving one dimension creates pressure on adjacent dimensions. There is no stable equilibrium the player can reach and coast.

**Examples:**
- Factorio: Fix coal shortage -> copper becomes bottleneck -> scale copper -> power grid fails -> expand power -> pollution attracts biters -> need military. Every fix reveals three new challenges.
- Shadow Empire: Expand territory -> logistics strain -> build infrastructure -> need more bureaucracy points -> fund councils -> leaders get unhappy -> political crisis.
- Dwarf Fortress: More dwarves arrive -> need more food -> farm expansion needs water -> aquifer management -> flooding -> drownings -> unhappy dwarves -> tantrum spiral.

**Design principle:** Never let the player reach a fully "solved" state. Every optimization should shift the constraint rather than remove it.

### Pattern 3: Failure as Content (Losing is Fun)

Failure is not a punishment or a dead end — it is a story, a teacher, and a source of engagement. The game is designed so that catastrophe is interesting, not just frustrating.

**How it works:** Three mechanisms make failure engaging:
1. **Narrative value:** Failures generate better stories than successes. "Everyone survived and prospered" is boring. "The fortress fell because a dwarf went insane over a sock" is legendary.
2. **Learning meta-game:** Each failure teaches something that improves the next attempt. The player's skill accumulates across playthroughs even when in-game progress is lost.
3. **Inevitability removes anxiety:** When the game communicates that failure is expected (Dwarf Fortress's "losing is fun" motto), players stop trying to play perfectly and start embracing chaos.

**Key insight:** Permadeath and permanent consequences work only when the game provides enough randomization and procedural generation that starting over feels like a new experience, not repetition.

### Pattern 4: The Storytelling Engine (Emergent Narrative)

The game provides ingredients for stories rather than telling a specific story. The player's mind performs apophenia — pattern-matching random events into coherent narratives.

**How it works:** Characters have visible internal states (needs, traits, relationships, memories). Events happen to specific named entities. The player observes cause-and-effect chains and constructs meaning from them.

**Requirements for emergent narrative:**
- **Named agents with visible motivations:** Not anonymous units but characters with traits, moods, and histories.
- **Consequential events:** Things that happen must have lasting effects — injuries, grudges, relationships, reputation.
- **Observable cause-and-effect:** The player must be able to trace *why* something happened, even if the chain is long and surprising.
- **No embedded narrative:** The less scripted story exists, the more the player's mind fills the gap.

**Examples:**
- Dwarf Fortress: Every narrative is emergent. There are zero embedded narratives. Character bios span multiple screens of history, personality, memories, and relationships. The game is "a storytelling engine as much as it is a game."
- RimWorld: The storyteller AI provides pacing (rising/falling tension) but not plot. The player constructs the story from colonist interactions, random events, and consequences.

### Pattern 5: Procedural Uniqueness (No Two Games Alike)

Each playthrough presents genuinely different strategic situations, not just shuffled versions of the same puzzle.

**How it works:** Procedural generation that goes deep enough to change strategy, not just cosmetics. Geography, resources, starting conditions, and available options vary enough that solutions from one game don't transfer directly to the next.

**Levels of procedural depth (shallow to deep):**
1. **Cosmetic:** Different names, colors, map layouts (minimal replay value).
2. **Tactical:** Different resource placement, terrain features (changes approach but not strategy).
3. **Strategic:** Different available technologies, resource types, environmental constraints (forces new strategies).
4. **Systemic:** The rules themselves vary — what's possible in this world differs from the last (maximum replay value).

**Examples:**
- Shadow Empire: Procedural planets follow astrobiology rules. A planet without abiogenesis has no fossil fuels, eliminating an entire tech path. Thin atmospheres preclude aircraft. The *possibility space itself* changes.
- Dwarf Fortress: World generation creates geology, 2000 years of history, civilizations, wars, languages, musical forms, and named artifacts before the player even starts. Each world is a unique fantasy novel.
- Factorio: Map generation changes resource distribution and biter placement, but the tech tree is fixed. This is closer to tactical-level procedural variation.

### Pattern 6: The Director Pattern (Pacing Without Scripting)

An AI system monitors game state and adjusts event frequency/intensity to maintain dramatic pacing, without prescribing specific outcomes.

**How it works:** The system tracks metrics (colony wealth, time since last crisis, recent casualties) and modulates the probability and severity of events to create rising/falling tension curves.

**Examples:**
- RimWorld's Storyteller AI: Three personalities (Cassandra = classic dramatic arc, Phoebe = long breaks with spikes, Randy = pure chaos). Each analyzes colony wealth, population, recent events, and time to decide what happens next. The storyteller creates pacing; the player and systems create plot.
- Left 4 Dead's AI Director (related concept): Monitors player stress and adjusts zombie spawns accordingly. Same principle applied to action rather than simulation.

**Key insight:** The director should control *when* and *how hard*, not *what* or *how*. It sets the difficulty dial; the simulation determines what actually happens.

### Pattern 7: Logistics as Limiter (Rubber-Band Complexity)

A logistics/supply system that makes expansion inherently self-limiting, preventing the late-game snowball that kills most 4X games.

**How it works:** Resources must physically flow through infrastructure from source to consumer. Distance, infrastructure capacity, and network topology create natural constraints that scale with empire size.

**Examples:**
- Shadow Empire: Supply flows from HQ along roads and rail lines to troops. A long, thin empire connected by a single railway is strategically vulnerable — an enemy cutting the line splits the empire in two. This makes geography matter for the entire game, not just early expansion.
- Factorio: Throughput limits on belts, inserters, and train networks mean that scaling up requires redesigning logistics, not just building more.

**Why it matters:** Without logistics, bigger is always better, and late-game becomes a victory lap. With logistics, expansion creates its own problems, maintaining challenge throughout.

### Pattern 8: The Customization Canvas (Player Expression)

The game provides enough degrees of freedom that every player's solution looks different. The factory/colony/fortress becomes an expression of the player's personality and problem-solving style.

**How it works:** Multiple viable approaches exist for every challenge. The game avoids funneling players into a single optimal build. The space of "good enough" solutions is wide.

**Examples:**
- Factorio: The developers "went out of their way to not funnel people into one correct build." Two players with 1000 hours will have completely different factory layouts. The factory *is* the creative artifact.
- Dwarf Fortress: There is no optimal fortress layout. Players build grand dining halls, elaborate trap corridors, magma moats, or underwater glass domes — limited only by simulation rules.
- RimWorld: Colony layout, social structure, and survival strategy all vary dramatically between players and runs.

### Pattern 9: Layered Onboarding (Complexity Without Overwhelm)

Deep systems are introduced gradually, with early gameplay requiring only a fraction of the total system knowledge.

**How it works:**
- **Natural complexity scaling:** Early game uses simple versions of systems that grow more complex as the player progresses (Factorio's progression from hand-crafting to circuits to nuclear).
- **Need-to-know basis:** Systems exist but don't demand attention until relevant (Shadow Empire's councils don't matter until you need stratagems).
- **Accessible UI over simple simulation:** RimWorld keeps Dwarf Fortress's depth concept but provides readable UI, tooltips, and a job management grid that comes stock instead of requiring third-party tools.

**The RimWorld simplification lesson:** RimWorld deliberately simplified Dwarf Fortress's approach:
- 2D instead of 3D z-levels
- 15 colonists instead of 200 dwarves (each more individually important)
- Built-in job management UI (Dwarf Fortress needed third-party Dwarf Therapist)
- Storyteller AI providing pacing guidance
- Result: 90% of the emergent narrative value at 30% of the learning curve

### Pattern 10: The Mod Ecosystem (Community as Content Engine)

A well-designed modding API turns the player community into an infinite content source, extending the game's lifespan by orders of magnitude.

**How it works:** The game provides clear extension points. Modders can add content (items, events, mechanics) without modifying core code. The mod ecosystem creates a positive feedback loop: more mods attract more players, who become more modders.

**Examples:**
- RimWorld: Thousands of mods, "arguably the best modding community out there." Players run mod lists with hundreds of entries. The game is easier to mod than Dwarf Fortress, which cultivated a larger modding community.
- Factorio: Overhaul mods (like Bob's/Angel's, Space Exploration, Krastorio) can require thousands of additional hours to complete, effectively creating new games within the engine.

**Key insight:** Dwarf Fortress proves this pattern is *optional* — its depth is sufficient that "mods aren't really super needed." But for games with less simulation depth, modding support can compensate.

---

## 2. Game-by-Game Analysis

### Dwarf Fortress

**What creates depth:**
- 500+ interlocking needs, skills, and memories per dwarf, all running as deterministic state machines
- Geology with 200+ rock/mineral types placed in proper geological contexts
- World generation: elevation, rainfall, mineral distribution, drainage, temperature, biomes, savagery, alignment
- History generation: civilizations, wars, artifacts, languages, musical forms, poetry — a "giant zero-player strategy game with thousands of agents"
- Combat model: skills, body parts, material properties (density, melting points), aimed attacks, wrestling, pain, nausea, poison effects
- Dynamic weather: wind, humidity, air masses, fronts, clouds, storms, blizzards
- Character psychology: personality traits drawn from Thomas Aquinas's virtue/vice inventories, stress system (injuries, poor clothing, pet death, friend death leads to tantrums, insanity, or berserk rages)
- Generated culture: poetry, musical forms, instruments, dances — procedurally created for each civilization

**What creates longevity:**
- No win condition. Every fortress eventually falls. The only question is how and when.
- The community motto "Losing is Fun" reframes failure as the most interesting part.
- Each world is genuinely unique — 2000 years of simulated history means different civilizations, threats, and contexts.
- The game "plays itself" — you can watch without intervening and it's still interesting. Player participation amplifies, not creates, the experience.

**Emergent interaction example:**
A dwarf prefers plump helmet wine -> steals from stockpile -> tavern brawl -> loyalty cascade -> faction war within the fortress -> structural damage -> flooding -> fortress collapse. No single system is complex. The chain of interactions across systems is.

### RimWorld

**What creates depth:**
- Storyteller AI: Analyzes colony wealth, colonist count, animal count, recent casualties, time since last major event. Chooses events to maximize narrative interest, not just difficulty.
- Three storyteller personalities create genuinely different experiences: Cassandra (dramatic arc), Phoebe (long peace, sudden crisis), Randy (chaos).
- Character system: Traits (Brawler, Depressive, Neurotic, Abrasive), backstories, skills, relationships. Each trait has mechanical consequences — Neurotic colonists work faster but break more easily.
- Mood system: Needs, personality traits, environment, social interactions all feed into a mood meter. Mental breaks (from low mood) cascade into colony crises.
- Small colony size (typically 5-15) makes each colonist irreplaceable. Losing your farmer is devastating in a way that losing dwarf #147 is not.

**What creates longevity:**
- The storyteller AI ensures every game has a different narrative arc even with similar starting conditions.
- The mod ecosystem (thousands of mods) allows players to reinvent the experience repeatedly.
- Multiple biomes, scenarios, and difficulty settings change the strategic puzzle.
- "The value of RimWorld lies not in winning, but in the story of the colony."

**Key design lesson — Accessibility vs. Depth trade-off:**
RimWorld proves you can capture most of the emergent narrative value of Dwarf Fortress while dramatically reducing the learning curve. The simplifications (2D, smaller scale, better UI, storyteller pacing) remove complexity that wasn't contributing to emergent stories while preserving the systems that do (traits, mood, needs, relationships, consequences).

### Factorio

**What creates depth:**
- Production chains with genuine interdependency — every resource feeds into multiple products, creating a web of constraints.
- Throughput as a first-class concern — it's not enough to have the right recipe; you need enough items per second flowing through the right paths.
- Infinite science as an unbounded goal — there is always more optimization possible.
- The UPS (updates per second) ceiling as a meta-constraint — at extreme scales, the player is optimizing against the game engine itself.

**What creates longevity:**
- The "endless bottleneck" pattern: solving one constraint always reveals the next. There is no stable equilibrium.
- The factory as creative expression: no two factories look alike. The game avoids a single optimal build.
- Self-imposed challenges: deathworld, no belts, no bots, ribbon worlds, speed runs — the community generates its own constraints.
- Voluntary restarts: players restart not because they failed but because they now know how to do it better. The learning meta-game drives replayability.
- Overhaul mods create effectively new games within the engine.

**The "one more optimization" loop:**
Factorio's hook is uniquely non-narrative. It's not "what happens next?" but "how can I make this better?" The loop is: observe bottleneck -> diagnose cause -> design solution -> implement -> observe new bottleneck. Each cycle takes 5-30 minutes and always ends with a new visible problem, making it nearly impossible to find a stopping point.

**Key design lesson — Teaching real skills:**
Factorio teaches systems thinking, bottleneck analysis, throughput optimization, and long-term planning. Players report that the skills transfer to real engineering and business problems. Games that teach transferable mental models have deeper engagement because the player is improving themselves, not just their save file.

### Shadow Empire

**What creates depth:**
- **Genre fusion:** 4X + hex wargame + Crusader Kings-style character RPG + bureaucracy simulator. Each layer would be a game on its own; combined, they create unique decision spaces.
- **Logistics as core mechanic:** Supply flows physically through infrastructure. Distance and network topology matter. This is the single system most missing from other 4X games, and its inclusion prevents the late-game snowball.
- **Stratagem card system:** Your bureaucratic departments generate action cards based on funding and leader relationships. This limits choices per turn (preventing analysis paralysis) while rewarding long-term investment in government infrastructure.
- **Leader relationships:** Every leader has skills, personality, faction affiliation, and a relationship score with you. Demoting an incompetent leader angers their entire faction. Suppressing a strike causes lasting civilian resentment. Every personnel decision has political consequences.
- **Unit design:** 30+ unit types with customizable components (gun type, engine type, armor). Technology starts at improvised weapons; advanced tech is found in ruins and must be reverse-engineered. Research paths differ every game.

**What creates longevity:**
- Procedural planets following astrobiology rules: climate, rainfall, geology, biohazards, respiratory hazards, alien life. A planet without fossil fuels eliminates entire tech branches. Thin atmospheres prevent aircraft. The possibility space itself changes per game.
- Procedural everything: equipment, vehicles, leaders, starting position, technology paths. "Not since Aurora 4X or Distant Worlds: Universe" has a game offered this depth of procedural variation.
- Logistics prevents the late-game victory lap. Larger empires have proportionally larger logistical problems. A single railway being cut can split an empire in two.

**Key design lesson — Constraints as content:**
Shadow Empire's stratagem card system is brilliant design. Instead of giving the player access to all possible actions (overwhelming), it generates a hand of available actions based on game state (manageable). The player makes meaningful choices from a curated subset rather than drowning in a menu of hundreds of options. The constraint itself becomes content — "I don't have the card I want, so how do I work with what I have?"

---

## 3. Cross-Cutting Themes

### Theme: The Simulation Spectrum

These four games sit at different points on a spectrum from "pure simulation" to "directed experience":

```
Pure Simulation                                    Directed Experience
     |                                                      |
Dwarf Fortress --- Shadow Empire --- Factorio --- RimWorld
```

- **Dwarf Fortress:** Zero embedded narrative. Zero pacing guidance. The simulation runs; the player observes and intervenes.
- **Shadow Empire:** Simulation-heavy but with structured turn-based pacing and the stratagem card system providing gentle direction.
- **Factorio:** The tech tree provides implicit direction. The factory's needs create urgency. But no AI manages pacing.
- **RimWorld:** The storyteller AI actively manages dramatic pacing. Still emergent, but with a directorial hand.

All four are successful. The lesson is not that one approach is better, but that the level of direction should match the simulation's ability to generate interesting situations on its own. Dwarf Fortress's simulation is so deep it needs no director. A shallower simulation benefits from one.

### Theme: Character Scale and Attachment

There is an inverse relationship between population size and per-character attachment:

| Game | Typical Population | Per-Character Depth | Player Attachment |
|------|-------------------|--------------------|--------------------|
| RimWorld | 5-15 | High (traits, mood, backstory) | Very high — losing one is devastating |
| Dwarf Fortress | 50-200 | Very high (personality, memories, relationships) | Medium — individuals fade into the crowd |
| Shadow Empire | Abstracted populations + ~20 named leaders | Medium (skills, personality, faction) | High for leaders, none for population |
| Factorio | 1 (the player) | N/A | N/A (no characters) |

**Design implication:** If you want emergent narrative, keep the cast small enough that players can track individuals. RimWorld's 15-colonist cap is a deliberate design choice, not a limitation.

### Theme: What "Content" Means in Simulation Games

Traditional games create content by authoring levels, quests, and scripted events. Simulation games create content through systems. The four content generation approaches:

1. **Simulation content:** Systems interacting produce novel situations (Dwarf Fortress, all four games)
2. **Procedural content:** Algorithms generate unique starting conditions (Shadow Empire planets, DF world gen)
3. **Director content:** An AI paces and escalates challenges (RimWorld storyteller)
4. **Player-generated content:** The player's own goals and self-imposed constraints (Factorio megabases, challenge runs)
5. **Community content:** Mods and shared stories extend the game beyond what the developer built (RimWorld, Factorio)

The most replayable games use multiple approaches simultaneously.

---

## 4. The Five Questions, Answered Per Game

### Q1: What creates the "just one more turn/cycle" hook?

| Game | Hook Mechanism |
|------|---------------|
| Dwarf Fortress | "What will happen next?" — The simulation is always producing new events. Curiosity about the unfolding story. |
| RimWorld | "How will we survive this?" — The storyteller creates escalating crises with breathing room between them. Classic dramatic tension. |
| Factorio | "How can I fix this bottleneck?" — Every solved problem reveals the next. The optimization loop has no natural stopping point. |
| Shadow Empire | "Can I hold this together?" — Simultaneous pressure from military, political, logistical, and resource systems. Plate-spinning tension. |

### Q2: How does the game stay interesting after 100+ hours?

| Game | Longevity Source |
|------|-----------------|
| Dwarf Fortress | Procedural world generation so deep that no two worlds are alike. Simulation complexity means novel situations keep emerging. 200+ rock types, generated cultures, 2000-year histories. |
| RimWorld | Mod ecosystem (thousands of mods), multiple biomes/scenarios, storyteller variety, small colony size makes each colonist's story unique. |
| Factorio | Self-imposed goals (megabases, speed runs, challenge modes), overhaul mods, the factory-as-creative-expression means each build is personal. |
| Shadow Empire | Procedural planets that change the possibility space (not just the map), procedural tech trees, leader personality variation, logistics preventing late-game staleness. |

### Q3: What systems interact to create emergent, unscripted moments?

| Game | Key Interacting Systems |
|------|------------------------|
| Dwarf Fortress | Personality + needs + environment + combat + materials + social relationships. A dwarf's emotional state affects their work, which affects fortress output, which affects other dwarves' moods, which can cascade into fortress-wide collapse. |
| RimWorld | Traits + mood + weather + storyteller events + social dynamics + colony infrastructure. A cold snap + food shortage + abrasive colonist = mental break = fire = colony crisis. |
| Factorio | Production chains + power grid + logistics throughput + biters + pollution + research. Each system constrains the others. |
| Shadow Empire | Military + logistics + politics + economy + leader relationships + procedural environment. A war stretches supply lines, which weakens the economy, which angers faction leaders, which triggers a political crisis during a military one. |

### Q4: What is the role of failure/setbacks in engagement?

| Game | Failure Philosophy |
|------|-------------------|
| Dwarf Fortress | "Losing is Fun" — failure IS the content. Every fortress eventually falls. The question is not whether but how, and the how is always a great story. Failure is inevitable, expected, and celebrated. |
| RimWorld | Setbacks create narrative. A raid that kills your best doctor creates a more compelling story than one you repel easily. The game is "about the story of the colony," and the best stories involve adversity. |
| Factorio | Failure is a learning opportunity. Players voluntarily restart because they now know a better way. The spaghetti factory is not a failure — it's a first draft. Biters destroying infrastructure forces creative problem-solving. |
| Shadow Empire | Setbacks test your ability to adapt under constraints. A cut supply line, a rebellious general, a tech path that dead-ends — each forces strategic pivots that make the game more interesting than if everything went smoothly. |

### Q5: How does the game handle complexity without overwhelming the player?

| Game | Complexity Management |
|------|----------------------|
| Dwarf Fortress | It mostly doesn't — the learning curve is famously brutal (10-20 hours before basic understanding). The Steam release improved UI significantly, but complexity is a feature, not a bug. The target audience self-selects. |
| RimWorld | Storyteller AI provides pacing. Built-in tutorials. Clean 2D UI. Small colony scale. Job priority grid. Tooltips everywhere. Complexity is present but surfaced only when relevant. |
| Factorio | Natural complexity scaling: hand-craft -> belts -> trains -> circuits -> nuclear -> space. Each tier introduces new systems only when the player has mastered the previous one. The tech tree IS the onboarding. |
| Shadow Empire | Stratagem cards limit choices per turn (you work with what you draw, not all possible actions). Councils and leaders abstract bureaucracy into manageable units. But the overall system count is still very high — accessibility is the game's weakest point. |

---

## 5. Applicability to Drift

Key patterns from this research that are most relevant to a 4X space exploration sim:

### Already Present in Drift
- **Simple rules, complex interactions:** Ship physics, orbital mechanics, command trees, and resource systems already interact emergently.
- **Procedural uniqueness:** Seed-based system generation, resource sub-typing by body characteristics.
- **The endless bottleneck:** Ship maintenance (fuel, morale, hull, supplies) creates cascading resource pressure.
- **Failure as content:** Bathtub curve malfunctions, hull degradation, and the "losing is fun" sensibility in ship management.

### Patterns Worth Exploring
- **Named agents with visible motivations (Pattern 4):** The commander judgment system is a step toward this. Deeper crew personalities (traits, moods, relationships) could generate RimWorld-style emergent stories at the ship level.
- **Director pattern (Pattern 6):** Event pacing for exploration — not just random encounters but dramatic arcs (discovery, crisis, resolution) tuned to game state.
- **Logistics as limiter (Pattern 7):** As the game scales beyond single ships, supply chains between colonies could provide the rubber-band complexity that keeps late-game interesting (Shadow Empire's key lesson).
- **Stratagem/card-based action limiting (Shadow Empire lesson):** For colony management or diplomatic actions, presenting a curated subset of options rather than all possible actions reduces decision paralysis while adding strategic texture.
- **Mod ecosystem (Pattern 10):** Data-driven resource definitions, ship configurations, and system generation parameters would make the game moddable without requiring code changes.
- **Character scale (Cross-cutting theme):** RimWorld's lesson — keep the cast small enough to track. A ship crew of 5-15 named individuals with traits would generate more stories than 200 anonymous crew members.

---

## Sources

- [Emergent Narrative in Dwarf Fortress — Digital Storytelling](https://digitalst0rytelling.wordpress.com/2016/03/02/a-cheap-fantasy-universe-generator-on-dwarf-fortress-games-procedural-generation-history-self-engagement-difficulty-sociality-and-boatmurdered/)
- [Characterization and Emergent Narrative in Dwarf Fortress — ResearchGate](https://www.researchgate.net/publication/356686095_Characterization_and_Emergent_Narrative_in_Dwarf_Fortress)
- [Interpreting Dwarf Fortress: Finitude, Absurdity, and Narrative — SAGE Journals](https://journals.sagepub.com/doi/full/10.1177/15554120231162418)
- [2006: Dwarf Fortress — 50 Years of Text Games](https://if50.substack.com/p/2006-dwarf-fortress)
- [Dwarf Fortress World Generation — DF Wiki](https://dwarffortresswiki.org/index.php/World_generation)
- [RimWorld AI Storytellers — RimWorld Wiki](https://rimworldwiki.com/wiki/AI_Storytellers)
- [The Story Generator: A Game Design Analysis of RimWorld](https://zaydqazi.substack.com/p/the-story-generator-a-game-design)
- [How Complex AI Can Promote Emergent Narrative](https://www.joeduffy.games/how-complex-ai-can-promote-emergent-narrative)
- [Algorithmic Authors: RimWorld's AI Storytellers as Agents of Literary Genre](https://medium.com/@coyega1328/algorithmic-authors-rimworlds-ai-storytellers-as-agents-of-literary-genre-eff70ea4560c)
- [Factorio Review: When "Just One More Hour" Becomes 30](https://chillplacegaming.com/factorio-review/)
- [Alt-F4 #7: Megabase Mentality](https://alt-f4.blog/ALTF4-7/)
- [Alt-F4 #13: Megabase Archaeology](https://alt-f4.blog/ALTF4-13/)
- [Shadow Empire Review — Wargamer](https://www.wargamer.com/shadow-empire/review)
- [Shadow Empire Review — The Avid Wargamer](https://avidwargamer.com/shadow-empire-review-a-true-4x-wargame/)
- [Shadow Empire: A 4X Where Professionals Talk Logistics](https://www.matchstickeyes.com/2020/06/14/shadow-empire-a-4x-where-professionals-talk-logistics/)
- [What to eXpect: Shadow Empire — eXplorminate](https://explorminate.org/what-to-expect-shadow-empire/)
- [Shadow Empire Developer Log #4: Leaders and Factions](https://forums.matrixgames.com/viewtopic.php?t=347342)
- [Seven Reasons I Keep Trying to Play Shadow Empire — Quarter to Three](https://www.quartertothree.com/fp/2020/07/03/seven-reasons-i-keep-trying-to-play-shadow-empire/)
- [Dwarf Fortress vs RimWorld — Game Pressure](https://www.gamepressure.com/newsroom/dwarf-fortress-vs-rimworld-detailed-comparison/z04ddd)
- [Reflections on RimWorld and Dwarf Fortress — The Wandering Gamist](https://wanderinggamist.blogspot.com/2021/02/reflections-on-rimworld-and-dwarf.html)
- [Emergence in Game Design: A Deep Dive — Number Analytics](https://www.numberanalytics.com/blog/emergence-in-game-design-deep-dive)
- [Emergent Mechanic Design for Video Games — Game Developer](https://www.gamedeveloper.com/design/emergent-mechanic-design-for-video-games-with-procedural-content)
- [From Rules to Emergence — rct AI / Medium](https://rctai.medium.com/from-rules-to-emergence-exploring-the-complexity-of-game-worlds-deb960b2c599)
- [Permadeath: The Heart of Roguelike Gameplay](https://litrpgreads.com/blog/permadeath-the-heart-of-roguelike-gameplay)
- [The Allure of Permadeath — Wayline](https://www.wayline.io/blog/allure-permadeath-permanent-death-gaming)
- [Permadeath Within Video Game Design](https://www.designthegame.com/learning/tutorial/permadeath-video-game-design)
