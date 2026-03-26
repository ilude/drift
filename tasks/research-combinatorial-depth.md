# Combinatorial Depth in Card Games: Design Reference

Game design research on how collectible/trading card games create emergent strategic depth through combinatorial systems. Focused on extractable principles applicable to 4X game design.

---

## Part 1: Magic: The Gathering

### Scale of the Problem Space

MTG has approximately 29,000 unique card names in paper (over 86,000 counting reprints and alternate treatments). Starting from 295 cards in the 1993 Alpha set, the game adds ~2,000 new unique cards per year. The interaction space is managed through:

- **Format segmentation**: Standard (~2,000 cards), Modern (~15,000+), Commander (nearly everything). Each format creates a different-sized interaction space with different emergent properties.
- **Multi-team design pipeline**: Vision Design (concept), Set Design (implementation), Play Design (competitive balance), Casual Play Design (Commander/casual balance). Each team focuses on a different layer of interaction management.
- **Ban lists as safety valves**: When unforeseen interactions emerge that warp a format, individual cards are banned. Vintage uses a "restricted list" (1 copy only) instead of outright bans.

### The Color Pie: Constraints That Create Depth

Richard Garfield identified the "Queen Problem" — if you could choose what chess pieces to play with, everyone would bring fifteen queens and a king. Two interlocking constraints solve this:

1. **The mana system** forces resource tension. Cards have varying costs, so their value shifts as the game progresses. You can't play everything at once; you must sequence.
2. **The color pie** assigns strengths and weaknesses to five colors. Each color can do some things well and literally cannot do others.

**The push-pull**: Each color having weaknesses pushes toward playing more colors to cover gaps — but more colors means harder mana requirements and greater risk of "color screw" (having the wrong color of mana). This creates a fundamental deckbuilding tension with no universal correct answer.

**Key principle**: The color pie turns limitation into creativity. No single color can do everything, so players must make meaningful choices about which colors to combine, how to build their mana bases, and what weaknesses to accept.

A dedicated "Council of Colors" within Wizards of the Coast maintains the color pie, preventing gradual drift that would erode the constraint system.

### The Stack and Priority: Rule Layering as Emergent Engine

The stack is a LIFO (Last-In, First-Out) zone where spells and abilities wait to resolve. The priority system determines who can act and when.

**How this creates depth:**

1. **Responsive play**: After any spell is cast, the opponent gets a chance to respond before it resolves. This means every action can be countered, modified, or exploited.
2. **Nested responses**: Multiple spells can pile onto the stack. A player can cast Brainstorm, resolve it, find a Counterspell, and use it to counter a Lightning Bolt still waiting on the stack.
3. **Holding priority**: A player can explicitly retain priority to stack multiple effects before the opponent can respond — enabling combo sequences.
4. **State-based actions**: The game's "physics" (creatures die when toughness reaches 0, etc.) are checked automatically and don't use the stack — they're consequences of effects that could have been responded to earlier.
5. **Replacement effects**: Some effects modify other effects rather than using the stack at all, creating a parallel layer of interaction.

**Design significance**: The layering of these systems — LIFO ordering, priority pass-back, state-based actions, replacement effects — means simple individual rules combine into an extraordinarily rich interaction space. Players who master these layers discover tactical options invisible to those who don't.

### Famous Unintended Combos

**Channel + Fireball (1993)**: Channel converts life to mana at 1:1; Fireball converts unlimited mana to damage. With Black Lotus providing fast mana, this enabled a turn-one kill from 20 life. The individual designs were reasonable in isolation — life-to-mana conversion and scalable damage are sensible card types. The lethal interaction emerged because each card operated on a *different* axis (life vs. mana vs. damage) and the conversion chain was unbounded.

**Splinter Twin + Deceiver Exarch (2011)**: Splinter Twin lets a creature clone itself by tapping. Deceiver Exarch untaps a permanent when it enters play. The clone enters, untaps the original, which makes another clone... infinite loop, infinite attackers. Key design factors:
- Two-card combo (maximum consistency, minimum deck slots devoted)
- Instant-speed threat: the opponent had to respect the combo every turn, creating "false tempo" — the threat consumed opponent resources even when not executed
- Functioned as a win condition inside a control shell, not a dedicated combo deck

**What made these possible**: Neither combo was intentionally designed. They emerged because card effects were *open-ended* — Channel didn't say "spend this mana only on creatures," Splinter Twin didn't say "the copy can't have enter-the-battlefield abilities." Open-ended effects maximize interaction potential but create unpredictable combinations.

### Keyword Layering: Combinatorial Multiplication

MTG has ~10 "evergreen" combat keywords (flying, deathtouch, trample, lifelink, first strike, haste, vigilance, menace, reach, double strike). Each is simple alone, but combinations create multiplicative value:

- **Deathtouch + Trample**: Deathtouch means 1 damage is lethal. Trample means excess damage hits the player. So a 6/4 with both needs to assign only 1 to each blocker and sends the rest to the player's face. No creature naturally has both — you must build this.
- **Lifelink + Trample**: If the blocker is small or removed, the full power hits the player AND you gain that much life.
- **Flying + Deathtouch**: Hard to block (flying), and lethal if you do (deathtouch).

**Key principle**: Multiple instances of the *same* keyword are redundant, but stacking *different* keywords creates multiplicative value because each enhances the context in which the others operate. The combinatorial space of N keywords grows as 2^N subsets.

### Player Psychographics: Serving Different Motivations

Mark Rosewater identified three psychographic profiles (2002):

- **Timmy/Tammy** (Experience): Plays for the feeling. Wants big, exciting moments. Drawn to high-impact effects.
- **Johnny/Jenny** (Expression): Plays to show creativity. The "combo player" — finds obscure card interactions, builds around cards widely considered bad, wins "their way." Happiest when an elaborate plan comes together.
- **Spike** (Competition): Plays to prove skill. Finds the optimal strategy and executes it perfectly. Values efficiency and win rate.

Most players are blends. The design team creates cards for each profile deliberately. Johnny/Jenny cards are often open-ended "build-around" effects that do nothing without a supporting engine but become powerful when the right pieces come together.

**Design takeaway**: A system with combinatorial depth inherently serves the "Johnny" motivation — the joy of discovering a non-obvious interaction that nobody else found. But the same system must also provide obvious power (Timmy) and competitive efficiency (Spike).

### Card Advantage and Hidden Synergy

Mark Rosewater on synergy in design: synergy creates gameplay that "hides between the cards." Until a player is ready to seek it out, it's invisible. This is a feature: it ensures low barrier to entry for new players while rewarding advanced players who look for interactions.

The concept of "lenticular design" — cards that read simply for beginners but reveal deeper interactions to experts. A card like "draw two cards" is simple. But combined with cards that trigger on draw, or cards that reduce the cost of drawing, or a deck built to exploit card advantage... the simple card becomes a key engine piece.

**Key principle**: By hiding complexity in the interactions between cards rather than on any single card, you can have a system that is both accessible (each piece is simple) and deep (combinations are complex).

### Parasitic vs. Modular Design

This is one of the most important spectrums in combinatorial design:

**Parasitic mechanics** only interact with a narrow subset of other cards, usually from the same set. Example: "Splice onto Arcane" only works with Arcane spells, which only exist in one block. If you want to use it, you're locked into a tiny card pool.

- Pros: Focused, flavorful, creates unique play experiences, enables coherent themes
- Cons: Linear deckbuilding, limited combination potential, dies if the set isn't powerful enough, poor long-term value

**Modular mechanics** work with the broadest possible set of other elements. Example: Equipment attaches to any creature. Kicker adds an optional extra cost to any spell. These are "Lego pieces" — they connect to everything.

- Pros: Maximum creative deckbuilding, long-term value, rewards experienced players who find unexpected uses
- Cons: Harder to evaluate, less thematic focus, harder to balance

**The spectrum**: All designs fall somewhere between fully parasitic and fully modular. Different players prefer different points — casual players often prefer the clarity of linear/parasitic design, while experienced players gravitate toward modular designs that reward creative combination.

**Key principle**: The most robust combinatorial systems lean modular — each piece should connect to as many other pieces as possible. But *some* parasitic elements create identity and focus. The ratio matters.

### How the Design Team Thinks About "Design Space"

When creating a new card or mechanic, designers evaluate its "design space" — how many interesting cards can be built around this concept? A mechanic with large design space (like Equipment) can support hundreds of cards across many sets. A mechanic with small design space (like Banding) runs out of interesting variations quickly.

The design team doesn't try to anticipate every combo. Instead, they create "generally useful cards and assume that players will find uses for them." Open-ended design increases flexibility. The philosophy: be responsible for making cards that work well with other cards, but don't generally design two cards specifically to combo together.

---

## Part 2: Slay the Spire (Roguelike Deckbuilders)

### Depth from a Smaller Pool

Slay the Spire has roughly 200-300 cards per character (vs. MTG's 29,000+), yet creates deep combinatorial play. How:

1. **Every element has purpose**: "Every card, relic, and enemy is in for a reason." No filler. In a curated pool, each addition is evaluated for interaction potential.
2. **Relics as a second combinatorial axis**: Relics aren't cards — they're persistent passive effects that fundamentally alter how your deck functions. A relic that gives 6 Block when you don't play Block cards means "never actively defend, kill everything fast." A relic that doubles every 10th attack means "manage timing to align your biggest hit."
3. **Draft/discovery mechanic**: You don't pre-build a deck. You build it one card at a time from random offerings, adapting to what appears. The mantra: "Don't force the deck you want — play the deck the Spire is giving you."
4. **Emergent strategy space**: Card synergies create exponential power growth when properly assembled. A single card that seems unremarkable in isolation becomes devastating with the right relics and supporting cards.

### Why New Synergies Emerge After Hundreds of Hours

Players with 1000+ hours report constantly reevaluating relics and cards as their understanding deepens. Several factors:

- **Context-dependent evaluation**: A relic that seems mediocre at low difficulty becomes essential at high Ascension levels. The evaluation shifts because the *problem space* shifts.
- **Multi-order interactions**: Relic A changes how Card B works, which changes the value of Card C, which makes Relic D worth picking up. These chains aren't visible until you've internalized each component individually.
- **Adaptive heuristics**: Experienced players develop heuristics ("0-cost attacks are good with this relic") that they then refine, combine, and occasionally violate when they discover exceptions.

### Key Deckbuilder Design Principles

- **Avoid archetype lock-in**: Slay the Spire deliberately punishes players who commit to an "archetype" too early (a trap for players coming from MTG). Flexibility and adaptation are rewarded over rigid planning.
- **"1+1=3" design**: Mastery comes from identifying combinations where the interaction value exceeds the sum of parts. The game is "neigh-strictly about the brain-juicy mechanical challenge of combinatorics."
- **Single-player advantage**: Because there's no opponent to overwhelm, the designers had "no issue when players discovered card synergies that created powerful combinations." This freed them to include more volatile interactions.
- **Curated randomness**: Balancing randomness and skill is critical. Too random = unfair. Too predictable = boring. Shops, card removal, and targeted relic choices give players tools to mitigate bad luck.

---

## Part 3: Dominion (Deckbuilding Games)

### The Kingdom Setup: Forced Creativity Through Randomization

Each game of Dominion uses 10 randomly selected card piles from a pool of 500+ unique cards across 15+ expansions. This creates "over one hundred thirty-two septillion possible Kingdom combinations."

**Design effect**: No memorized optimal strategy works across all games. Players must evaluate each kingdom fresh, identify the power cards, find the support cards (draw, actions, villages), and construct an engine from available parts.

### Engine Building as Emergent Strategy

An "engine" in Dominion is a multi-card loop that generates increasing returns. The engine-building process:

1. **Identify power cards** (usually $5 cost cards)
2. **Find support**: terminals need villages, payload needs draw
3. **Plan acceleration**: How do you get these cards as quickly as possible?
4. **Short-term focus**: Dominion is "very snowbally" — advantage compounds. Focus on the next shuffle, not the endgame.

**Engine vs. Big Money**: The simplest viable strategy is "Big Money" — just buy high-value treasure cards and Provinces. This works because it requires no kingdom cards. But most well-built engines beat Big Money consistently. The existence of this baseline creates a measurable bar: your engine must outperform simply buying money.

### Design Principles

- **No dead cards**: "Across over 500 distinct Kingdom card piles there are only a handful that are truly duffers." Nearly every card is viable in some kingdom combination.
- **Context-dependent value**: The same card can be essential in one kingdom and worthless in another. "That card type that was fought over isn't available and new strategies emerge."
- **Skill dominance**: Despite heavy shuffling randomness, "a good Dominion player will wipe the floor with a poor player every single time." The strategic decisions (what to buy, when to switch from building to scoring) dominate outcomes.

---

## Part 4: Netrunner (Asymmetric Card Games)

### Asymmetry as Depth Multiplier

Netrunner has two completely different roles (Corporation and Runner) with different card pools, different mechanics, and different win conditions. This doubles the design space without doubling the card count — every card must be evaluated from both perspectives.

**Corp side**: Plays cards face-down. Builds servers protected by "ICE" (defense programs). Advances agendas toward scoring thresholds.

**Runner side**: Must interact with the opponent's hidden board state. Builds a "rig" of icebreaker programs. Initiates "runs" against servers, not knowing what they'll encounter.

### Hidden Information as Strategic Depth

The Corp plays most cards face-down. The Runner cannot see what they're running at until they encounter it. This creates:

- **Bluffing**: The Corp can place a trap in an unprotected server that looks like an agenda. The Runner must decide whether to risk it.
- **Information warfare**: Every piece of revealed information changes the calculus for both sides.
- **Forced interaction**: "The runner must interact with the opponent's deck to win" — unlike MTG where you can sometimes ignore the opponent and execute your own plan.

### Constraint-Based Deckbuilding

The icebreaker system imposes a structural constraint: there are 3 categories of ICE, and 3 corresponding categories of icebreakers. You need a "suite" that covers all three. Deckbuilding starts with this constraint ("What does my breaker suite look like?") and builds around it.

**Influence system**: Each faction has an "influence" budget for including out-of-faction cards. This mirrors MTG's color pie — it forces hard choices about which out-of-faction tools to import, creating unique deck identities.

### Economy as Opportunity Cost

Economy in Netrunner is not just credits — it's "clicks" (actions per turn). Every action has an opportunity cost:

- Corp: Advancing an agenda takes most of two turns. During that time, you're not building defenses.
- Runner: You can run early (risky, before your rig is ready) or build up (safe, but gives the Corp time to score).

This creates tension between investing and acting that has no universal correct answer.

---

## Part 5: Cross-Cutting Design Principles

### Principle 1: Simple Effects + Composition = Emergent Complexity

The most durable card game systems are built from simple, individually comprehensible pieces that combine in complex ways. MTG keywords are each one sentence. Slay the Spire relics are each one passive effect. Dominion cards each do one or two things. The depth lives in the *interactions between* pieces, not in any single piece.

**The corollary**: Complexity on individual elements is a tax on the player. Complexity in the interaction space is a reward. Minimize the former, maximize the latter.

### Principle 2: Constraints Create, Not Limit

Every great card game's depth comes from constraints:

- MTG: Color pie (can't do everything), mana system (can't play everything at once), deck limits (4 copies, 60 minimum)
- Slay the Spire: Energy per turn, card draft randomness, health as a non-renewable resource
- Dominion: 10 random piles, 1 buy and 1 action per turn (before modifiers)
- Netrunner: Influence budget, click economy, ICE categories requiring specific breakers

Without constraints, there's one optimal solution (the "Queen Problem"). Constraints force players to make meaningful trade-offs, and trade-offs are where strategy lives.

**Richard Garfield's insight**: Mana costs make different cards important at different points in the game. Without costs, you'd always play the most powerful card. With costs, you need cheap cards early and expensive cards late, creating diversity in what's viable.

### Principle 3: The Parasitic-Modular Spectrum

Every game mechanic falls on a spectrum from parasitic (interacts only with specific other elements) to modular (interacts with everything).

**For maximum combinatorial depth, lean modular**: Each piece should connect to as many other pieces as possible. Equipment in MTG works with any creature. Relics in Slay the Spire work with any card configuration.

**But include some parasitic elements for identity**: Tribal synergies in MTG ("all Goblins get +1/+1") create focused, flavorful sub-strategies. The key is ratio — too much parasitism and deckbuilding becomes linear; too much modularity and themes dissolve.

**Applied test**: When designing a new system element, ask: "How many other elements in the game does this interact with?" If the answer is small and fixed, the element is parasitic. If large and open-ended, it's modular.

### Principle 4: Hidden Synergy as Skill Differentiator

Mark Rosewater's "lenticular design" principle: synergy that "hides between the cards" creates a game that is simple for beginners (each piece reads simply) but deep for experts (combinations are complex). The beginner doesn't even see the synergy until they're ready.

**This means**: Don't surface all synergies explicitly. Don't have a tooltip that says "this combines well with X." Let players discover it. The discovery IS the reward.

**Cognitive science backing**: Research shows that discovering non-obvious rules triggers the "Aha!" experience, and the proportion of Aha-ratings *increases with difficulty*. Harder-to-find synergies are more rewarding to discover.

### Principle 5: Open-Ended Effects Enable Unplanned Combos

The most famous combos in MTG were not designed intentionally. They emerged because effects were written broadly — Channel converts "life to mana" without restricting what the mana is used for; Splinter Twin copies "a creature" without restricting which creature.

**Design heuristic**: Write effects in terms of general categories, not specific targets. "Gain X when any ship completes a survey" is more modular than "Gain X when Ship Alpha surveys a planet." The former creates interactions with everything that triggers surveys; the latter is a one-off bonus.

**The trade-off**: Open-ended effects are harder to balance because their interactions are harder to predict. This is the price of combinatorial depth. Safety valves (bans, nerfs, difficulty tuning) are necessary complements.

### Principle 6: Multiple Orthogonal Axes Multiply Depth

Each game creates depth through multiple independent systems that interact:

| Game | Axis 1 | Axis 2 | Axis 3 | Axis 4 |
|------|--------|--------|--------|--------|
| MTG | Cards | Mana colors | Timing (stack) | Formats |
| Slay the Spire | Cards | Relics | Pathing | Energy |
| Dominion | Kingdom cards | Buy economy | Action economy | Deck thinning |
| Netrunner | Cards | Hidden info | Click economy | Asymmetric roles |

When you have N independent axes, the combination space grows multiplicatively (not additively). Adding a *new axis* (like Slay the Spire's relics) multiplies the entire existing space by the size of the new axis.

### Principle 7: Context-Dependent Evaluation

In every deep card game, the same element can be essential in one context and worthless in another:

- MTG: A card is format-defining in Standard but unplayable in Modern
- Dominion: A card is the key engine piece in one kingdom and irrelevant in another
- Slay the Spire: A relic is mediocre at Ascension 1 but essential at Ascension 20

This context-dependence is itself a form of depth. Evaluating "how good is this in my current situation?" is a skill that rewards experience and adaptation over memorized rankings.

### Principle 8: "Build-Around" Elements Create Investment

Build-around cards (MTG) or relics (Slay the Spire) do little on their own but become powerful when you construct a supporting system. These create the deepest engagement because:

1. They require long-term planning (investment)
2. They reward specific knowledge (knowing what supports them)
3. They create unique deck identities (not "good stuff" piles)
4. They produce satisfying payoff when the engine works (the "Johnny" reward)

The key tension: build-around elements must be powerful enough to reward the investment but not so powerful that they're obvious. The sweet spot is where the payoff is high but the path to assembling the engine is non-trivial.

### Principle 9: Combo Depth and the Step Ladder

"Combo depth" describes how many pieces/steps are required before a combination becomes powerful:

- **1-card synergy**: A card that's good on its own (low depth, obvious)
- **2-card combo**: Two specific cards that win the game (Splinter Twin). High consistency, high power, easy to find. These are the combos most likely to need banning.
- **3-4 card engine**: Requires assembling multiple pieces. Less consistent but harder to disrupt. Often the sweet spot for interesting gameplay.
- **5+ card engine**: Full "Rube Goldberg machine." Rarely assembled but spectacular when it works. Primarily serves Johnny/Jenny players.

**Design implication**: The most interesting strategic depth lives in the 3-4 card range — complex enough to reward clever deckbuilding, simple enough to actually assemble in a real game.

### Principle 10: The "2+2=5" Test

The hallmark of good synergy is that combining elements produces more value than their sum:

- Deathtouch (value X) + Trample (value Y) = much more than X+Y because each keyword transforms the context in which the other operates
- A Slay the Spire relic that doubles every 10th attack + a deck full of 0-cost attacks = far more than either alone because the relic's constraint (every 10th) aligns with the deck's strength (many attacks)

**Applied test for new game systems**: After designing two elements, ask: "Does combining these produce a strategy that is qualitatively different from using either alone?" If yes, you have synergy. If combining them just gives the sum of their individual benefits, you have adjacent effects but not true depth.

---

## Part 6: Application to 4X Game Design

### Tech Trees as "Kingdom Cards"

Dominion's kingdom setup creates depth through randomized availability. Applied to tech trees:

- Instead of a fixed tree everyone follows, use branching paths where choosing one tech precludes or delays others (as Master of Orion pioneered)
- "Creative" vs. constrained research: some factions/traits give access to everything in a branch; others force a choice of one from three
- Context-dependent value: a tech should be essential in some situations and irrelevant in others, depending on what resources/threats/neighbors you have

### Ship Loadouts as "Deckbuilding"

Alpha Centauri's insight: techs unlock *components*, not *units*. Players design their own units from available parts. Applied to ship design:

- Ship modules are the "cards" — each simple, each interacting with others
- Constraints create depth: limited module slots (deck size limit), power budget (mana system), mass budget (another orthogonal constraint)
- Module interactions should be multiplicative, not additive: a stealth module + a first-strike weapon should create a qualitatively different combat strategy, not just two independent bonuses
- Some modules should be "build-around" — weak alone but powerful with the right supporting modules

### Colony Building as "Engine Building"

Dominion's engine-building parallels colony development:

- Each building/structure is simple on its own
- Combinations create increasing returns (a mine + a refinery + a trade hub creates an economic engine)
- The environment (planet type, resources available) acts as the "kingdom" — forcing different strategies per colony
- Build order matters: early acceleration compounds (Dominion's "snowball" effect)

### Resource Chains as Combo Depth

Resource processing chains (raw material -> refined good -> manufactured product) naturally create combo depth:

- 1-step chains are obvious (mine ore, sell ore)
- 2-step chains require planning (mine ore, refine metal, sell metal)
- 3-4 step chains with branching create the sweet spot of interesting strategic depth
- Vertical integration (controlling the whole chain) should be a "build-around" strategy — powerful but requiring significant investment

### The Color Pie Analog: Faction/Environment Constraints

The color pie's genius is that each color has things it *cannot* do. In a 4X context:

- Different planet types / regions could have inherent strengths and limitations (like colors)
- Players who spread across diverse environments gain access to more capabilities but face logistical challenges (like multi-color mana bases)
- Specializing in one environment type is efficient but leaves blind spots (like mono-color decks)

### Hidden Synergy in System Interaction

The most important principle: players should discover non-obvious strategies through system interaction, not be told about them.

- Don't surface every synergy bonus explicitly in tooltips
- Let the "2+2=5" moments emerge from system interactions
- The discovery IS the reward — the Aha! experience increases with difficulty
- Design systems to be individually simple but combinatorially rich

### The Relic Analog: Persistent Modifiers

Slay the Spire's relics are persistent effects that change how your entire deck functions. In a 4X context:

- Leaders, doctrines, policies, or discovered technologies could serve as "relics" — persistent modifiers that change the value of everything else
- These should multiply the existing strategy space, not just add to it
- A doctrine that says "all mining operations produce 50% more but cost 25% more power" changes the optimal colony layout, ship design, and tech priorities all at once — one modifier, rippling effects across multiple systems

### The Asymmetry Principle

Netrunner shows that asymmetric roles multiply depth without multiplying content. In a 4X context:

- Different factions with genuinely different mechanics (not just stat tweaks) create more depth than symmetric factions
- Hidden information (fog of war, hidden fleet compositions, concealed colony developments) is a depth multiplier that costs nothing to implement
- Forced interaction (resources that require trading or contested zones) prevents "solitaire" play styles where players ignore each other

---

## Summary: The 10 Extractable Principles

1. **Simple pieces, complex interactions** — depth lives between elements, not within them
2. **Constraints create depth** — limitations force meaningful trade-offs, which IS strategy
3. **Lean modular** — elements should connect to as many other elements as possible
4. **Hide synergy** — don't surface all interactions; discovery is the reward
5. **Open-ended effects** — write in general categories, not specific targets
6. **Orthogonal axes multiply** — adding a new independent system dimension multiplies the entire existing space
7. **Context-dependent value** — the same element should be great in some situations and mediocre in others
8. **Build-around investment** — elements that require constructing a supporting system create the deepest engagement
9. **3-4 piece sweet spot** — the most interesting strategic depth requires assembling a few pieces, not too few (obvious) or too many (impossible)
10. **2+2=5 test** — true synergy produces qualitatively different strategies, not just additive bonuses

---

## Sources

- [Philosophy of Combo (Wizards of the Coast)](https://magic.wizards.com/en/news/feature/philosophy-combo-2017-08-04)
- [Explaining the Genius of the MTG Color Pie (Draftsim)](https://draftsim.com/mtg-color-wheel/)
- [The Council of Colors (Wizards of the Coast)](https://magic.wizards.com/en/news/making-magic/council-colors-2016-08-22)
- [Constraints and Defaults (Mark Rosewater)](https://magic.wizards.com/en/news/making-magic/constraints-and-defaults-2019-07-15)
- [The Stack and Priority Guide (The Gamer)](https://www.thegamer.com/magic-the-gathering-mtg-stack-priority-guide/)
- [Essential MTG Definitions: Priority and The Stack (Card Kingdom)](https://blog.cardkingdom.com/essential-mtg-definitions-priority-and-the-stack/)
- [Timmy, Johnny, and Spike (Wizards of the Coast)](https://magic.wizards.com/en/news/making-magic/timmy-johnny-and-spike-2013-12-03)
- [Living in Synergy (Mark Rosewater)](https://magic.wizards.com/en/news/making-magic/living-synergy-2013-02-25)
- [Parasitic Cards in Magic (Draftsim)](https://draftsim.com/mtg-parasitic-cards/)
- [Come Together — Linear vs. Modular (Wizards of the Coast)](https://magic.wizards.com/en/news/making-magic/come-together-2003-10-06-0)
- [Card-Knapping: Parasitism and Linearity (Goblin Artisans)](http://goblinartisans.blogspot.com/2011/02/card-knapping-parasitism-and-linearity.html)
- [Top 10 Most Iconic Combos in MTG (Cards Realm)](https://mtg.cardsrealm.com/en-us/articles/top-10-most-iconic-combos-in-magic-the-gathering)
- [Combo Crash Course: Splinter Twin (Card Kingdom)](https://blog.cardkingdom.com/combo-crash-course-splinter-twin/)
- [How Many MTG Cards Are There (Draftsim)](https://draftsim.com/how-many-mtg-cards-are-there/)
- [Ranking Creature Keyword Combinations (EDHREC)](https://edhrec.com/articles/ranking-creature-keyword-combinations-in-magic-the-gathering)
- [Card Game Design as Systems Architecture (CritPoints)](https://critpoints.net/2023/05/26/card-game-design-as-systems-architecture/)
- [Complexity Vs. Depth (Benjamin Wolf)](https://medium.com/@BWolf1989/complexity-vs-depth-22b54947aec8)
- [Why Slay the Spire Still Rules the Roguelike Deckbuilder Genre (VideoGamer)](https://www.videogamer.com/features/why-slay-the-spire-still-rules-the-roguelike-deckbuilder-genre/)
- [Slay the Spire Strategy Guide (Slay the Spire Wiki)](https://www.slaythespire.gg/guides/strategy)
- [Developing a Roguelike Deckbuilding Design Tool (DiVA Portal)](https://www.diva-portal.org/smash/get/diva2:1771381/FULLTEXT02.pdf)
- [Guide to Engines (Dominion Strategy)](https://dominionstrategy.com/2021/03/09/guide-to-engines/)
- [Guide to the Dominion Base Game (Dominion Strategy)](https://dominionstrategy.com/2011/06/19/guide-to-the-dominion-base-game/)
- [Android: Netrunner Full Review (Riptide Lab)](https://riptidelab.com/android-netrunner-full-review/)
- [Android: Netrunner Review (The Thoughtful Gamer)](https://thethoughtfulgamer.com/2017/05/15/android-netrunner-review/)
- [Making a Space 4X Game: Technology (SpaceSector)](https://www.spacesector.com/blog/2013/06/making-a-space-4x-game-technology/)
- [Innovative Tech Trees in Space Strategy Games (SpaceSector)](https://www.spacesector.com/blog/2009/07/dynamic-and-specialized-technology-research-in-space-strategy-games/)
- [Search and Insight Processes in Card Sorting Games (Frontiers in Psychology)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1118976/full)
- [Training Rationality Through Deckbuilders (LessWrong)](https://www.lesswrong.com/posts/SogyM9mm2HsiRHTnz/training-rationality-through-deckbuilders)
- [Designing for Deck-Building in Video Games (Game Developer)](https://www.gamedeveloper.com/design/designing-for-deck-building-in-video-games)
- [Archetypes in Deckbuilding Games (TavroxGames)](https://tavroxgames.com/archetypes-in-deckbuilding-games/)
