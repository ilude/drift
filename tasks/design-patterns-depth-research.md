# Design Patterns for Depth in Survival and Open-Ended Games

Research reference covering extractable design patterns from CDDA, UnReal World, Caves of Qud, and Oxygen Not Included.

---

## 1. Cataclysm: Dark Days Ahead (CDDA)

### 1.1 Item & Crafting System

**Scale:** Thousands of items and recipes defined in JSON data files (`data/json/recipes/`). Over 1,000 contributors have expanded the content base over 10+ years. The exact count is a moving target due to constant community development, but the scope dwarfs any commercial game's crafting system.

**What makes it deep:**

- **Realism as constraint.** The core design tenet: "if it works in reality, it works in the game." Crafting reflects real-world parameters — skill, tools, raw materials, and time. This means a wooden axe cannot be crafted from banging rocks together. Steel crafting uses simplified SAE grading (mild/medium/high), with metallurgical operations (hardening, tempering) applied to worked items, not raw ingots.
- **Knowledge gating.** Not all recipes are known at start. Recipes come from: character creation, skill level-ups, reading specific books, or disassembling items to reverse-engineer them. This creates a discovery arc where finding a book is as valuable as finding a weapon.
- **Tool and workspace requirements.** Crafting requires appropriate tools within a 6-tile radius, specific skill levels, adequate lighting, a flat surface or workbench, and functional limbs. Morale below a threshold prevents crafting entirely.
- **Failure with consequences.** Crafting below the required skill level risks failure and partial component loss. Having 25% above the required skill guarantees success. This creates a meaningful risk/reward calculation.
- **Proficiency system.** Beyond raw skill levels, specific proficiencies gate access to recipe categories, adding a second axis of progression.
- **Data-driven architecture.** All items and recipes are JSON-defined, enabling modding without C++ changes. This is why the content has scaled so massively.

**Extractable pattern: Constrained Realism Crafting.** Depth comes not from recipe quantity but from realistic prerequisites forming a dependency graph. Each crafted item requires solving a supply chain problem (find book, gather materials, acquire tools, level skill). The crafting system is essentially a puzzle layer on top of exploration.

### 1.2 Vehicle Construction

**What makes it deep:**

- **Freeform tile-based construction.** Vehicles are assembled tile-by-tile from individual parts (frames, wheels, engines, armor, solar panels, turrets, cargo space). No templates — every vehicle is designed from scratch.
- **Multiple propulsion types.** Internal combustion (gas/diesel), electric motors, steam engines, sails, muscle power. Hybrid configurations are possible (e.g., solar panels charging batteries powering electric motors).
- **Energy systems.** Solar panels, wind turbines, water wheels, alternators on combustion engines, battery banks. Players design power grids within their vehicles.
- **Realistic constraints.** Weight, friction, structural integrity, fuel types, and power generation all matter. Parts have durability and can be damaged or destroyed.
- **The "deathmobile" metagame.** Players optimize mobile bases that serve as housing, workshop, power plant, and weapon platform simultaneously. This emergent gameplay loop of vehicle optimization sustains hundreds of hours.

**Extractable pattern: Component-Based Freeform Engineering.** Give players a vocabulary of realistic parts with physical constraints, and let them compose solutions. No blueprints, no predefined vehicles — just parts, physics, and player creativity. The engineering IS the content.

### 1.3 Nutrition & Health Model

- **Calorie and hydration tracking** with energy expenditure based on weather, activity, and body weight.
- **Vitamin system** with multiple tracked nutrients (calcium, iron, vitamin C, etc.). Prolonged deficiency in any vitamin triggers status effects (scurvy from vitamin C deficiency, etc.). Counter resets upon eating non-deficient food.
- **Deficiency tiers** with escalating severity.
- **Drug metabolism** modeled as a separate vitamin type with 30-minute stomach cycle delay.
- **Psychological vs. physical hunger** — "energy" (calories) and "hydration" (ml) affect the body physically, while hunger and thirst have psychological effects.
- **Body part damage model** — broken limbs affect crafting, combat, and movement independently.

**Extractable pattern: Multi-Axis Health Simulation.** Don't model health as a single HP bar. Separate physical needs (calories, hydration, vitamins) from psychological state (morale, hunger perception). Each axis creates its own gameplay pressure and solution space.

### 1.4 Living World Without Scripts

- **Fully destructible environment.** Mine, smash, deconstruct, or burn almost anything.
- **Dynamic simulation.** Realistic fire spread, smoke propagation, weather effects, temperature.
- **NPC factions** with their own behaviors and territories.
- **No scripted narrative.** The world is procedurally generated and simulated. Events emerge from systems interaction, not authored sequences.
- **Persistent world.** The map persists between play sessions. Buildings you loot stay looted. Structures you build remain.

**Extractable pattern: Simulate, Don't Script.** A world feels alive when its elements follow consistent physical rules rather than scripted behaviors. Fire spreads because it's simulated, not because a quest triggered it.

### 1.5 System Layering (Bionics, Mutations, Martial Arts)

- **Bionics (CBMs):** Cybernetic implants installed via autodoc. Body part slots with safe/max limits. Require surgery, anesthetic, and medical infrastructure. Mid-to-late game progression.
- **Mutations:** Gained through mutagens. Both positive and negative effects. Mutations on a body part reduce bionic slot capacity on that part — creating a genuine tradeoff between cybernetic and biological enhancement.
- **Martial arts:** Learned from books or training. Each style has unique techniques, buffs, and requirements. Bionic Combatives is a unique martial art learned only through CBM activation.
- **The tension:** Historically, bionics and mutations were fully complementary ("only plusses"). The design direction is toward meaningful tradeoffs — biological mutation vs. mechanical augmentation as competing paths.

**Extractable pattern: Competing Enhancement Paths.** Create multiple upgrade systems that share a resource (body part slots). Investing in one path reduces capacity in another. This creates build diversity through constraint, not just through option count.

---

## 2. UnReal World

### 2.1 Historical Realism as Depth Engine

- **Setting:** Iron Age Finland, ~1000 AD. Pagan tribes subsisting on hunting, fishing, farming, and fur trading.
- **Research-driven authenticity.** Developer Sami Maaranen's "urge to dive deeper and deeper into cultural roots of ancient Finns" drives every system. Crafts use period-appropriate methods. No anachronistic shortcuts.
- **Removal of convenience.** The monetary system was removed. Abundant imported goods were trimmed. Metal goods became scarce. Each removal forced the player deeper into self-sufficiency.
- **Finnish mythology integration.** Folklore and spiritual elements woven into the survival simulation.

**Extractable pattern: Constraint Through Historical Fidelity.** Choosing a specific historical period and committing to its material constraints automatically generates depth. You don't need to invent arbitrary limitations — history already provides them. Removing modern conveniences forces players into the full depth of period-appropriate problem-solving.

### 2.2 The Crafting/Trapping/Hunting Loop

- **50+ fauna species** with realistic behaviors, seasonal migrations (elk herds moving south in winter), and territorial patterns.
- **Trap variety** including pit traps, deadfalls, snares, and fences. Multi-kilometer trap fences are a viable strategy.
- **Hunting as skill expression.** Tracking, stalking, weather conditions, terrain, and weapon choice all affect outcomes. No "click to hunt" abstraction.
- **Tool quality matters.** The quality of tools affects crafting outcomes. Finding or making better tools is a meaningful progression.
- **Hideworking pipeline.** Kill animal, skin it, tan the hide, work the leather, craft clothing or trade goods. Each step requires specific tools, skills, and time.

**Extractable pattern: Deep Production Chains.** Satisfaction comes from multi-step processes where each step has its own skill expression. "Kill animal" is not the endpoint — it's the beginning of a production chain (skin, tan, work, craft, trade). Length of chain = depth of engagement.

### 2.3 Seasonal Cycles

- **Four seasons** with realistic weather simulation.
- **Resource availability cycles.** Berry picking, mushroom hunting, fishing, and hunting all follow seasonal patterns. You can't fish through frozen lakes without tools. Berries exist only in late summer.
- **Agriculture.** Planting and harvesting crops with seasonal growth cycles. Turnips, barley, etc. require specific planting windows.
- **Preservation.** Cellars for food storage. Smoking, drying, salting meat. Winter preparation is a major gameplay phase.
- **Clothing needs.** Seasonal clothing requirements — summer and winter gear are different problems entirely.

**Extractable pattern: Temporal Resource Scarcity.** Seasons create natural gameplay phases without explicit quest design. "Prepare for winter" is an emergent goal driven by systems, not a quest marker. Time pressure comes from the calendar, not a countdown timer.

### 2.4 Sustaining Hundreds of Hours (Single Character, No Story)

- **10 starting cultures** with different strengths (fisherman, hermit, trapper, tradesman, etc.).
- **No win condition.** Game continues until death. Open-ended by design.
- **Player-set goals.** Build a cabin, establish a farm, explore the map, raid enemy villages, become self-sufficient, raise a hunting party.
- **Permadeath with investment.** Characters represent real time investment, making each death meaningful.
- **Slow-burn progression.** Skills improve through use over in-game months and years. No level-up dopamine hits — instead, gradual competence that you feel in outcomes.
- **The rhythm of daily life.** The game sustains engagement through satisfying daily routines — check traps, tend crops, fish, craft — that change with seasons and character development.

**Extractable pattern: Routine as Content.** When individual activities are satisfying and interconnected, the daily gameplay loop itself becomes the content. No explicit goals needed — the rhythm of survival provides structure. The key is that each routine activity has enough depth and variation to remain engaging.

---

## 3. Caves of Qud

### 3.1 Procedural History & Lore

- **Sultan system.** Each run generates 5 ancient rulers ("Sultans") with procedural biographies. Historical events are generated first, then rationalized after the fact — subverting traditional cause-and-effect narrative.
- **State machine + replacement grammar.** Technical approach uses a state machine to generate event sequences and a replacement grammar to produce narrative text, creating coherent biographical narratives.
- **Biased historical accounts.** History is presented through word of mouth and ancient texts, allowing for conflicting perspectives and unreliable narrators. Different sources disagree about the same events.
- **Procedural villages** with their own histories, cultures, architectural styles, storytelling traditions, NPCs, and quests (GDC 2019 talk by Bucklew & Grinblat).
- **Legendary items** with procedurally generated backstories tied to the sultan history.
- **In-game history books** written by procedurally generated historians (including "plant historians").
- **Wave Function Collapse** for map generation (Roguelike Celebration 2019 talk).

**Extractable pattern: Generate Events, Rationalize Post-Hoc.** Instead of simulating history forward (computationally expensive, often incoherent), generate disconnected historical events and then construct causal narratives linking them. This produces "mythic" history that feels authored because narrative coherence is applied after generation. The key insight: history doesn't need to be simulated — it needs to feel plausible when read.

**Extractable pattern: Unreliable Procedural Sources.** Present generated history through multiple in-world sources that disagree. This turns potential generation artifacts (inconsistencies) into a feature (competing historical accounts). Players engage more deeply when they're reconstructing truth from conflicting sources.

### 3.2 Mutation/Cybernetics Build Diversity

- **70+ mutations** including physical (wings, four arms, two heads), elemental (flaming hands), psychic (telepathy, teleportation), and biological (cloning).
- **Mutation levels** that increase with mutation points gained per character level. Higher levels = more powerful effects.
- **Genotype split:** Mutated Humans get mutations; True Kin get cybernetics. Fundamentally different character-building experiences from the same game.
- **Cybernetics** are found in the world and installed at "becoming nooks." Require body part slots and license tiers (purchased with cybernetic credit wedges). More powerful but must be discovered, not grown.
- **12 callings/castes** per genotype affecting starting skills, stats, and gear.
- **Combinatorial build space.** The interaction between mutations, equipment, skills, and the world's hazards creates a vast space of viable builds.

**Extractable pattern: Divergent Character Archetypes.** A single binary choice at creation (mutant vs. true kin) that fundamentally changes how you interact with every other system. Not just stat differences — entirely different progression mechanics, different resources to seek, different risks to manage.

### 3.3 Balancing Procedural and Authored Content

- **"Wild garden of emergent narrative."** Handwritten story weaves through procedural simulations.
- **"A novel's worth of handwritten lore"** knit into procedurally generated history unique each game.
- **Authored main quest** exists alongside procedural world. The handwritten narrative provides structure; the procedural world provides surprise.
- **Design pillar: "Generativity."** "We build complex systems then let players collide them, and together we observe the results."
- **Apophenia as design tool.** Players perceive meaningful connections between unrelated procedural elements. The designers lean into this — generating content that invites pattern-matching rather than explicitly stating meaning.

**Extractable pattern: Authored Skeleton, Procedural Flesh.** Write the bones of the narrative (main quest, key NPCs, thematic pillars). Let procedural generation fill in the world around it. The authored content gives meaning to the procedural content; the procedural content gives freshness to the authored content.

**Extractable pattern: Design for Apophenia.** Generate content that is suggestive rather than explicit. When players connect dots between a sultan's biography, a ruin's architecture, and a legendary item's inscription, they feel like archaeologists — even if the connections are coincidental. Partial information invites interpretation.

### 3.4 Replayability

- **Permadeath** ensures each run is finite.
- **Procedural world generation** ensures each run is different.
- **Build diversity** ensures each run plays differently (mutant vs. true kin, different mutation loadouts, different starting castes).
- **Procedural history** ensures the lore is different each run.
- **Depth of systems** means hundreds of hours before mastering interactions.
- **Discovery-driven.** The game is dense enough that players discover new interactions, items, and locations hundreds of hours in.

**Extractable pattern: Replayability = Variation x Depth x Consequence.** Procedural variation alone doesn't create replayability (infinite sameness). Depth alone doesn't (you eventually master it). Consequence alone doesn't (you just reload). All three together create the loop: each run is different (variation), rewards mastery (depth), and matters (consequence via permadeath).

---

## 4. Oxygen Not Included

### 4.1 Closed-Loop Resource Systems

- **"Every pixel is a limited resource."** Air, ground, water — nothing is free or infinite. No ambient oxygen, no magical waste disposal.
- **Conservation of mass.** Resources transform but don't disappear. Water becomes steam becomes water. Polluted water can be filtered. CO2 sinks to the bottom. Nothing is "consumed" — it changes state.
- **Resource cycling examples:**
  - Simple: Fertilizer maker + natural gas generator form a loop (3 fertilizer makers power 1 gas generator).
  - Complex: Coal generators emit CO2, Slicksters eat CO2 and produce crude oil, oil refinery produces natural gas and petroleum.
  - SPOM (Self-Powering Oxygen Machine): Electrolyzer splits water into oxygen + hydrogen; hydrogen generators produce more power than the electrolyzer consumes.
- **State changes matter.** Water boils at 100C, freezes at -0.6C. Petroleum freezes at -57.1C. Every material has melting points, boiling points, and thermal properties.
- **Waste as resource.** Excrement becomes fertilizer. Polluted water becomes clean water via treatment. CO2 feeds plants or Slicksters. The game has almost no true "waste" — only unprocessed resources.

**Extractable pattern: Conservation-Law Simulation.** When resources transform but never disappear, every waste product becomes a design opportunity. Players stop thinking about "disposal" and start thinking about "what can I feed this into?" This single constraint (no magic loss) generates enormous emergent depth from simple resource transformation rules.

### 4.2 Thermal Simulation as Emergent Complexity

- **Every machine generates heat.** Running equipment raises ambient temperature in enclosed spaces.
- **Temperature propagation.** Heat flows through materials based on thermal conductivity. Metal tiles conduct well. Insulated tiles don't.
- **State change hazards.** Overheated water becomes steam, breaking pipes. Frozen water blocks flow. Crops die outside temperature ranges.
- **Cooling solutions require engineering.** Radiant pipes through metal tiles, aquatuner loops, steam turbines that convert heat into power (deleting thermal energy in the process). Each solution has its own power and resource costs.
- **Thermal management as the late-game.** Early game: get oxygen. Mid game: get food and water. Late game: manage heat. The thermal system is barely noticeable initially but dominates optimization play.

**Extractable pattern: Slow-Burn Systemic Pressure.** Introduce a system that is trivially manageable early but grows in importance as other systems scale. Heat is ignorable with 3 duplicants but critical with 12. This creates natural difficulty progression without explicit difficulty scaling — the player's own success creates the challenge.

### 4.3 Teaching Without Tutorials

- **Deliberate design choice.** "We still strive to teach people how to play through natural discovery and helpful UI rather than dragging them through a tutorial."
- **Discovery as fun.** "A big part of the fun is the sense of figuring things out... introducing proper tutorials would kill that first joyful moment."
- **Players learn through failure.** Colony dies from CO2 buildup. Player learns CO2 sinks and needs scrubbing. Colony overheats. Player learns about thermal management.
- **Bottom-up simulation design.** The developers created temperature, pressure, and chemical simulations first, then designed gameplay within the challenges the simulation provided. The simulation IS the teacher.
- **Degrees of success.** "I have enough air to not die, but it's kinda low pressure so it causes me stress." Players first solve problems crudely, then refine.
- **Polarizing approach.** Some players need 400 hours to grasp most mechanics. Critics question whether requiring external guides means the design failed. Defenders argue the discovery IS the game.

**Extractable pattern: Simulation as Tutorial.** If the simulation is consistent and legible (you can observe cause and effect), players will teach themselves. The key requirement is that effects are visible — CO2 visibly sinking, heat visibly spreading, water visibly freezing. Players need to see the simulation to learn from it.

### 4.4 Survival to Optimization Progression

- **Natural progression arc:** Oxygen (immediate survival) -> Food (short-term) -> Water recycling (medium-term) -> Power grid (infrastructure) -> Temperature management (long-term) -> Base optimization (endgame).
- **Each solution creates new problems.** Getting oxygen requires an electrolyzer, which requires power, which generates heat, which requires cooling, which requires water, which you're also using for oxygen. Ripple effects sometimes manifest hours later.
- **Brute force to elegance.** Players first solve problems with crude solutions (manual delivery, basic research), then iterate toward automated, efficient systems (conveyor belts, smart storage, liquid locks).
- **No finish line.** There is no "you win" condition. The game shifts from "don't die" to "how elegant can I make this?" Optimization becomes its own reward.

**Extractable pattern: Solution Chains Create Depth.** Design systems where solving problem A creates problem B. Not as punishment, but as natural consequence of scale. This means the player never runs out of problems to solve — they just encounter increasingly sophisticated ones. The progression from survival to optimization happens organically as players move from "make it work" to "make it efficient."

---

## 5. Cross-Cutting Patterns

### 5.1 "The Player Writes the Story"

All four games create player-authored narratives through the same mechanism: **systems interaction producing unique situations that the player interprets as story.**

- **CDDA:** "I found a working car with no gas, but I found a book on biodiesel and a field of canola..." The story emerges from the intersection of loot tables, crafting prerequisites, and map generation.
- **UnReal World:** "The first winter nearly killed me, but I'd built enough traps to survive on hare meat and traded furs for an iron knife..." The story is the seasonal survival arc.
- **Caves of Qud:** "This ruin was built by Sultan Resheph, who was betrayed by..." The story is reconstructed from procedural lore fragments.
- **ONI:** "My base was perfect until cycle 200 when the heat from the metal refinery melted the water pipes feeding the electrolyzers..." The story is system cascade failure.

**Pattern: Emergent Narrative = Interlocking Systems + Player Agency + Uncertainty.**
Three requirements (identified in academic research on emergent narrative):
1. Large number of consistent, interacting subsystems (combinatorial explosion of game states).
2. Player intentionality (ability to envision goals and work toward them).
3. Uncertainty (randomness or AI preventing total player control).

All four games satisfy all three. Games that fail at emergent narrative typically lack one: too few systems (1), too little agency (2), or too deterministic (3).

### 5.2 Systems Interaction vs. Systems in Isolation

**The multiplicative principle:** N systems in isolation create N sources of depth. N systems that interact create N-factorial potential interactions.

Examples of systems INTERACTING (not just coexisting):

| Game | System A | System B | Emergent Interaction |
|------|----------|----------|---------------------|
| CDDA | Nutrition (vitamins) | Crafting (cooking) | Must craft varied meals, not just calories — drives foraging diversity |
| CDDA | Mutations (body changes) | Bionics (implant slots) | Biological mutation reduces cybernetic capacity — forces build commitment |
| CDDA | Vehicles (fuel) | Crafting (biodiesel) | Vehicle use drives agricultural/chemical crafting progression |
| UnReal World | Seasons (winter) | Trapping (fur) | Must trap for fur clothing before winter — creates preparation arc |
| UnReal World | Agriculture (planting window) | Hunting (food bridge) | Must hunt to survive while crops grow — multi-system food security |
| Caves of Qud | Mutations (body plan) | Equipment (slot requirements) | Four arms = more weapon slots but fewer armor options |
| ONI | Thermal (machine heat) | Resources (state changes) | Machine heat boils water in nearby pipes — infrastructure placement matters |
| ONI | Biology (food) | Thermal (crop temperature) | Farms require specific temperature ranges — base layout is thermal puzzle |

**Pattern: Design system connections, not just systems.** When designing a new system, the first question should be: "which existing systems does this interact with, and how?" A system that doesn't interact with at least 2-3 others adds linear depth. A system that interacts with 5+ others adds exponential depth.

### 5.3 Simulation Depth vs. Playability

The tension is real and every game handles it differently:

| Game | Approach | Tradeoff |
|------|----------|----------|
| CDDA | Maximum simulation depth, minimal UI accommodation | Steep learning curve, niche audience, but unmatched depth for those who persist |
| UnReal World | Deep simulation with simple interface | Slow pace alienates action-oriented players; rewards patience |
| Caves of Qud | Authored content provides handholds | Main quest gives direction; procedural world provides depth |
| ONI | Visual legibility of simulation | 400 hours to "get it," but cause/effect is always observable |
| Dwarf Fortress (comparison) | Maximum depth, historically worst accessibility | Steam release proved better UI doesn't require less depth |

**Pattern: Legibility over Simplification.** The solution to the depth/playability tension is NOT reducing depth — it's making depth legible. ONI shows heat through color gradients. Caves of Qud shows mutation effects in character descriptions. CDDA's crafting menu shows exactly what's missing. The simulation can be as deep as you want if the player can observe and understand cause and effect.

**Pattern: Progressive Disclosure of Complexity.** ONI's thermal system barely matters in the first 50 cycles. UnReal World's agricultural system is irrelevant until you settle down. CDDA's bionics don't appear until mid-game. Let players master simple systems before the complex ones become relevant.

### 5.4 Engagement Without Explicit Goals

What keeps players engaged when there's no win condition:

1. **Self-set goals with system support.** The game doesn't tell you to build a deathmobile, but the vehicle system makes it possible and rewarding. The game doesn't tell you to survive winter, but the seasonal system makes it necessary.

2. **Mastery as intrinsic motivation.** Understanding the crafting tree IS the progression. Knowing which mutations synergize IS the reward. The dopamine comes from competence, not achievement popups.

3. **Routine satisfaction.** UnReal World's daily trap-checking loop. ONI's colony management cycle. When individual actions are satisfying, repetition is not boring — it's meditative.

4. **Escalating self-imposed challenges.** Once you survive, can you thrive? Once you thrive, can you optimize? Once you optimize, can you do it with harder constraints?

5. **Community knowledge sharing.** CDDA's deathmobile designs. ONI's SPOM blueprints. Caves of Qud build guides. The community extends the game's depth through shared knowledge and challenges.

**Pattern: Provide Verbs, Not Quests.** Give players powerful, flexible tools (crafting, building, exploring, fighting, trading) and let them compose their own objectives. The game's job is to make the verbs deep and interconnected, not to prescribe which verbs to use when.

### 5.5 Procedural Generation: Contribution vs. Substitution

When procedural generation CONTRIBUTES to depth:
- **Caves of Qud's sultan histories:** Each run has unique lore to discover. The procedural content creates investigation gameplay.
- **CDDA's map generation:** Each run has a unique supply chain puzzle (where are the tools? the books? the vehicles?).
- **ONI's asteroid composition:** Different starting resources force different strategies.

When procedural generation SUBSTITUTES for depth (anti-pattern):
- Infinite procedural dungeons with no meaningful variation (same enemies, same loot, different layout).
- Procedural quests that are just "go to [location], kill [enemy]" with swapped names.
- Procedural lore that is obviously random and carries no meaning.

**Pattern: Procedural generation creates depth when it forces strategic adaptation.** If the player responds to procedural variation by changing their approach, it's contributing. If they respond with the same strategy every time, it's just decoration.

**Pattern: Procedural content needs authored semantics.** Caves of Qud's procedural villages work because each generated element (culture, architecture, storytelling tradition) has authored meaning. The generation picks from meaningful options rather than assembling meaningless parts.

### 5.6 Player Knowledge as Progression ("The Player Levels Up")

This is the deepest and most important pattern across all four games.

**What progresses:**
- **Knowledge:** Understanding systems, items, enemies, environments. "I now know that CO2 sinks and needs scrubbing."
- **Strategy:** Building on knowledge to make dynamic, adaptive plans. "I now pre-build cooling before it's critical because I know heat will compound."
- **Intuition:** Internalized understanding that manifests as "feel." "I can sense when my food supply is getting precarious."
- **Creativity:** Using mastery to find novel solutions. "What if I used the steam turbine's heat deletion as my primary cooling and routed the power to..."

**Why it works:**
- **Permadeath validates mastery.** Completing a run without save-scumming proves you actually understand the systems.
- **No mechanical shortcut.** You can't grind your way to safety. There's no "easy mode" gear. Knowledge is the only reliable progression.
- **Transfer across runs.** Character dies but knowledge persists. Each death teaches something. This makes permadeath feel progressive rather than punitive.
- **Infinite ceiling.** There is always more to learn. 400 hours into ONI, players are still discovering interactions. 1000 hours into CDDA, players are still finding items.

**The distinction from RPG progression:** In an RPG, the character gets stronger and the game gets easier. In these games, the PLAYER gets stronger and the game stays the same difficulty — but the player's experience of it transforms from chaotic to controlled to elegant.

**Pattern: Design systems deep enough that 500 hours of play doesn't exhaust discovery.** This doesn't mean "add more content" — it means make systems interact in ways that reveal new possibilities with experience. A chess board has 64 squares and 6 piece types, but the strategic depth is functionally infinite.

---

## 6. Summary: The Five Pillars of Depth

Drawing from all four games, deep open-ended play rests on five reinforcing pillars:

### Pillar 1: Consistent Simulation
Systems follow rules that players can learn, predict, and exploit. Fire burns. Heat rises. Water freezes. Seasons change. When simulations are consistent, player knowledge accumulates meaningfully.

### Pillar 2: Systems Interaction
Individual systems are connected, not isolated. The value of a new system is measured not by its standalone depth but by how many existing systems it creates interactions with. Design the connections first, then the system.

### Pillar 3: Constrained Resources
Scarcity drives all decision-making. Time, materials, body part slots, seasonal windows, thermal budgets — every resource that can run out creates a decision point. Conservation-law simulations (nothing is created or destroyed) maximize this naturally.

### Pillar 4: Player Agency Without Prescription
Provide powerful verbs, not scripted quests. Let goals emerge from systems interaction and player creativity. The game provides the "what is possible" — the player provides the "what I want to do."

### Pillar 5: Legible Complexity
Depth must be observable. Players cannot learn from systems they cannot see. Visual feedback, cause-and-effect chains, and progressive disclosure make deep systems learnable without tutorials.

When all five are present, the result is a game where the player's own growing mastery is the primary progression system, emergent narrative is the primary story engine, and the game sustains thousands of hours because the possibility space is larger than any single playthrough can explore.

---

## Sources

### Cataclysm: Dark Days Ahead
- [CDDA Wikipedia](https://en.wikipedia.org/wiki/Cataclysm:_Dark_Days_Ahead)
- [CDDA Design Documentation](https://docs.cataclysmdda.org/design-balance-lore/design-doc.html)
- [CDDA Steel Crafting Design](https://docs.cataclysmdda.org/design-balance-lore/STEEL_CRAFTING.html)
- [CDDA UX Design Docs](https://docs.cataclysmdda.org/design-balance-lore/design-user-experience.html)
- [CDDA Crafting Wiki](https://cddawiki.danmakudan.com/wiki/index.php/Crafting)
- [CDDA Vitamin System](https://docs.cataclysmdda.org/JSON/VITAMIN.html)
- [CDDA Nutrition Discussion](https://discourse.cataclysmdda.org/t/nutritional-balancing/12197)
- [CDDA Vehicle Construction Wiki](https://cddawiki.danmakudan.com/wiki/index.php/Vehicle_construction)
- [CDDA Bionic Slots Rework Proposal](https://github.com/CleverRaven/Cataclysm-DDA/issues/28273)
- [CDDA Martial Arts Guide](https://cdda-guide.nornagon.net/martial_art)
- [CDDA GitHub Repository](https://github.com/CleverRaven/Cataclysm-DDA)

### UnReal World
- [UnReal World Wikipedia](https://en.wikipedia.org/wiki/UnReal_World)
- [UnReal World Official Site](http://www.unrealworld.fi/)
- [UnReal World Steam Page](https://store.steampowered.com/app/351700/UnReal_World/)
- [UnReal World TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/UnrealWorld)
- [UnReal World itch.io](https://enormous-elk.itch.io/unreal-world)

### Caves of Qud
- [Caves of Qud Wikipedia](https://en.wikipedia.org/wiki/Caves_of_Qud)
- [Procedural Generation in Caves of Qud (Gamasutra)](https://www.gamedeveloper.com/design/tapping-into-the-potential-of-procedural-generation-in-caves-of-qud)
- [GDC 2018: Procedurally Generating History](https://gdcvault.com/play/1024990/Procedurally-Generating-History-in-Caves)
- [GDC 2019: End-to-End Procedural Generation](https://media.gdcvault.com/gdc2019/presentations/Grinblat_Jason_End-to-End_Procedural_Generation.pdf)
- [Subverting Historical Cause & Effect (Research Paper)](https://www.researchgate.net/publication/319364267_Subverting_historical_cause_effect_generation_of_mythic_biographies_in_Caves_of_Qud)
- [Mutations Wiki](https://wiki.cavesofqud.com/wiki/Mutations)
- [Cybernetics Wiki](https://wiki.cavesofqud.com/wiki/Cybernetics)

### Oxygen Not Included
- [Layering Challenges in ONI (Gamasutra)](https://www.gamedeveloper.com/design/layering-challenges-in-klei-s-survival-sim-i-oxygen-not-included-i-)
- [Behind the Design of ONI (Gamasutra)](https://www.gamedeveloper.com/design/behind-the-design-of-hit-sim-game-i-oxygen-not-included-i-)
- [The Genius Design of ONI (Gideon's Gaming)](https://gideonsgaming.com/the-genius-design-of-oxygen-not-included-a-review/)
- [ONI Resource Cycling Wiki](https://oxygennotincluded.fandom.com/wiki/Resource_Cycling)
- [ONI Wikipedia](https://en.wikipedia.org/wiki/Oxygen_Not_Included)

### Cross-Cutting Design
- [Designing for Mastery in Roguelikes (Grid Sage Games)](https://www.gridsagegames.com/blog/2025/08/designing-for-mastery-in-roguelikes-w-roguelike-radio/)
- [Emergent Gameplay (Wikipedia)](https://en.wikipedia.org/wiki/Emergent_gameplay)
- [Emergent Storytelling in Roguelikes (Thesis)](https://webthesis.biblio.polito.it/38944/1/tesi.pdf)
- [Weaving Narratives into Procedural Worlds (Gamasutra)](https://www.gamedeveloper.com/design/weaving-narratives-into-procedural-worlds)
