# Tech Tree: Overview & Design Principles

> Status: Draft design (2026-03-28). Master document for the tech tree — principles, domain index, and scaling framework. Individual domains have their own docs.

## Design Principles

1. **Every tech has a rank** (1-16) that multiplies the base RP cost. Rank 1 techs are foundational and cheap. Rank 16 techs are capstone achievements requiring years of research infrastructure.
2. **Refinement tiers** (I-V) exist within key techs. Tier I unlocks the system. Tiers II-V improve it. Tier V costs ~4x as much as tiers I-IV combined (Eve scaling curve). Not every tech has tiers — some are binary unlocks.
3. **TNE cost scales with tier.** Building a Tier I component needs modest Duranium/Sorium. Tier V needs exotic TNEs (Gallicite, Vendarite) in large quantities. The Tanaka cascade.
4. **Cross-domain prerequisites.** Advanced techs in one domain require foundational techs in others. No isolated branches — everything connects.
5. **Founder domains organize the tree.** Six primary schools, each traceable to a founder's legacy.
6. **Tech generations are MTG sets.** See below.

---

## The MTG Principle: Tech Generations as Card Sets

The deepest design insight for Drift's tech tree comes from Magic: The Gathering's multi-set design philosophy. In MTG, each set/block has a **mechanical identity** — Mirrodin is artifacts, Innistrad is graveyard mechanics, Ravnica is color-pair guilds. Cards from different sets interact in ways designers didn't explicitly plan. The richest gameplay emerges from cross-set combinations that players discover themselves.

**In Drift, tech generations ARE sets. Ship design IS deckbuilding.**

### How This Works

Each **technology era** (Fission, Fusion, Antimatter, Exotic) has its own mechanical identity — a set of tradeoffs, synergies, and design signatures that make components from that era feel distinct. But components from different eras can coexist on the same ship. The magic happens in the interactions.

#### Era Mechanical Identities

| Era | MTG Analog | Mechanical Identity | Design Signature |
|-----|-----------|---------------------|-----------------|
| **Fission/Conventional** | Core Set | Reliable, heavy, cheap, fuel-hungry. No exotic dependencies. | High mass, low TNE cost, proven reliability. The "basic lands" of ship design. |
| **Fusion** | First expansion block | Lighter, more efficient, but demands Corbomite cooling and Sorium fuel infrastructure. Multiple competing reactor/engine types create genuine choice. | Balanced performance. Components interact through thermal management — hot reactors stress nearby systems. |
| **Antimatter** | Powered set | Extreme output but cascading dependencies. Each AM reactor type needs specific thermal, containment, and computing support. Miss one link and the chain breaks. | High ceiling, high floor. The "combo deck" era — devastating when the synergies line up, fragile when they don't. |
| **Exotic** | Mythic/capstone set | Rule-breaking capabilities (no fuel, no propellant, FTL, cloaking). Each system needs capstone tech from multiple domains. | Each component is a build-around. A single exotic system reshapes the entire ship design. |

#### Cross-Era Interactions (The Interesting Part)

The depth comes from **mixing eras on a single ship** — just like a competitive MTG deck draws cards from multiple sets:

**Deliberate Synergies (designed-in):**
- Fusion reactor + Antimatter engine = natural pairing. The reactor provides containment power, the engine provides thrust. But the reactor might be the bottleneck — your AM engine can't run at full power without a matching-tier reactor.
- Advanced sensors + Conventional weapons = viable scout/picket build. You don't need exotic weapons if your sensors let you see first and report to the fleet.
- Fission reactor + Ion Drive = the immortal survey ship. No exotic dependencies, runs forever on minimal fuel, cheap to build in quantity. Still viable in the late game for the same reason Lightning Bolt is still played — raw efficiency at low cost.

**Emergent Combinations (discovered by players):**
- Gravity Drive (no exhaust signature) + Fission reactor (low EM signature) + Passive TN sensors = ghost ship that detects without being detected. No single tech was designed for stealth — the combination creates it.
- Beam-Core AM engine (extreme range) + Minimal weapons + Jump Drive = dedicated jump scout that arrives in a new system, surveys, and jumps back before anything can intercept. The "combo deck" — fragile but does one thing no other build can.
- Nuclear Pulse Engine (extreme thrust) + Neutronium armor + Point Defense = close-range brawler that sprints into engagement range and tanks incoming fire. Old tech, wrong era, but the synergy works because high thrust + heavy armor is a valid combat doctrine.

**Anti-Synergies (deliberate tension):**
- Hot reactors (ICF, Gas-Core AM) increase the ship's thermal signature, degrading stealth systems mounted on the same hull. Want stealth? Use a cooler reactor — which means less power.
- High-power sensors improve detection but increase EM emissions — which makes you visible to enemy passive sensors. The "active radar dilemma."
- Reactor Power Boost increases weapon output but multiplies explosion risk on critical hit. More power = more boom when the hull is breached.

#### The Meta Shifts

As the player researches deeper into the tree, the "meta" of optimal ship design shifts — exactly like how new MTG sets redefine the competitive meta:

- **Early game meta:** Fission reactors + NTE/Nuclear Pulse engines + basic sensors. Ships are heavy, slow, fuel-hungry. Quantity matters because individual ships are cheap. "Aggro" doctrine.
- **Mid game meta:** Fusion reactors + ICF/MCF/Plasma drives + mixed EM/TN sensors. Ships become more capable but also more expensive. Specialization emerges — dedicated survey ships vs combat ships vs logistics. "Midrange" doctrine.
- **Late game meta:** Antimatter reactors + exotic drives + full sensor suites + advanced weapons. Individual ships are enormously capable but extremely expensive in TNEs. One ship loss is devastating. "Control" doctrine.
- **Endgame meta:** Mix of all eras. The player realizes that a fleet of cheap fusion-era escorts screening a few antimatter-era capitals is more effective than all-capital fleets. Old tech finds new roles. "Eternal format" — every era has viable cards.

#### Design Rules (Avoiding MTG's Mistakes)

1. **No parasitic mechanics.** Every component must be usable outside its "native" era build. If a Fusion-era sensor only works with Fusion-era fire control, that's parasitic design. It should work with any fire control — just *better* with matched tech.
2. **Old tech stays viable.** Fission reactors should never become completely obsolete. They should always have a niche (cheap, reliable, no exotic dependencies) that some ship roles want. Like how basic MTG cards remain tournament staples.
3. **No strictly-better upgrades.** The Tokamak isn't just "better Stellarator." It has higher peak output but cycles between charge/discharge. The Stellarator has lower output but steady-state operation. Different ship roles prefer different reactors, even at the same tech level.
4. **Cross-era combos should emerge from consistent rules, not be hard-coded.** We don't design "if you mount component A with component B, get bonus X." We design consistent thermal, power, and signature systems, and the combos emerge from players understanding those rules. (Design principle #6: simulate consistent rules, not specific outcomes.)
5. **The best builds should be non-obvious.** If the optimal ship at any tech level is "mount the highest-tier version of everything," the system has failed. The optimal build should require understanding the interaction space — hull mass budget means you CAN'T mount everything at top tier. Tradeoffs are mandatory.
6. **Power budget is the mana system.** Just as MTG limits what you can play per turn via mana, the ship's reactor output limits what systems can run simultaneously. A ship with a Fusion reactor can't power Antimatter-era weapons at full rate. The player must balance reactor output against total system power draw — or accept that some systems will run at reduced capacity. This is the core constraint that forces interesting design decisions.

---

## Domain Index

| Domain | Founder | Doc | Key TNEs | Approx Nodes |
|--------|---------|-----|----------|-------------|
| **Propulsion & Power** | Kouri | [tech-tree-propulsion.md](tech-tree-propulsion.md) | Sorium, Corbomite | ~359 |
| **Detection & Sensing** | Okafor | [tech-tree-sensors.md](tech-tree-sensors.md) | Mercassium, Uridium | ~98 (needs expansion) |
| **Electronic Warfare** | Okafor (derivative) | [tech-tree-electronic-warfare.md](tech-tree-electronic-warfare.md) | Uridium, Mercassium | ~86 (needs expansion) |
| **Weapons & Defense** | Cross-domain | [tech-tree-weapons.md](tech-tree-weapons.md) | Sorium, Neutronium, Uridium | ~134 (needs expansion) |
| **Computing & AI** | Sakarov + Okafor | [tech-tree-computing.md](tech-tree-computing.md) | Gallicite | ~74 (needs expansion) |
| **Theoretical Physics** | Sakarov | [tech-tree-theoretical-physics.md](tech-tree-theoretical-physics.md) | All | ~33 (needs expansion) |
| **Materials & Construction** | Meijer | [tech-tree-materials.md](tech-tree-materials.md) | Duranium, Neutronium, Tritanium | ~62 (needs expansion) |
| **Life Support & Crew** | Brennan/Tanaka | [tech-tree-life-support.md](tech-tree-life-support.md) | Vendarite, Corundium | ~31 (needs expansion) |
| **Communications** | Cross-domain | [tech-tree-communications.md](tech-tree-communications.md) | Mercassium, Gallicite, Corbomite | ~108 |
| **Exploration & Survey** | Brennan | (merged into sensors for now) | Mercassium, Uridium | — |
| **Industrial & Economic** | Tanaka | (not yet drafted) | Boronide, Corundium | — |
| **Total** | | | | **~985+** |

---

## Scale Estimate

With rank multipliers (1-16) and Eve-style tier cost curves, total RP to complete everything is approximately **200-500x** the RP to get the first useful tier of each tech. Getting a functional fleet takes 5-10 game years. Mastering a single domain takes a decade. Completing the entire tree takes multiple decades — and that's with aggressive research colony investment.

### The MTG "Eternal Format" Scaling

Because old tech stays viable (design rule #2), the tree never feels like wasted research. Your early Nuclear Thermal Engines are still building survey ships in year 50. Your Fission-era pickets are still screening the fleet. Every "set" you researched is still in your "collection" — the question is which builds are optimal for the current challenge.

### Cross-Domain Dependency Web

No domain is self-contained. Cross-era, cross-domain prerequisites create a dense web:
- **Stellarator Fusion Reactor** needs Applied TN Physics (Sakarov) + Magnetic Containment (Sakarov) + GCFR Efficiency (Kouri fission)
- **Plasma Drive** needs MCF Drive Thrust II (Kouri fusion engines) + TN Field Theory I (Sakarov)
- **Ship AI Core** needs Navigation AI + Damage Control AI + Targeting AI (AI domain) + Quantum Computing (Computing)
- **Active Cloaking Field** needs TN Masking (EW) + Zero-Point Reactor (Kouri exotic power)
- **Autonomous Missile** needs TN-Propelled Missile (Weapons) + Ship AI II (AI) + Targeting AI II (AI)
- **Gravity Drive** needs TN Field Theory IV (Sakarov) + Plasma Drive Efficiency IV (Kouri engines)
- **Jump Drive** needs TN Field Theory III (Sakarov) + Gravity Drive (Kouri exotic) + Quantum Computing III (Computing)

This creates the "overwhelming wall" on first view — hundreds of nodes in a dense web. But when the player picks a goal ("I want Jump Drives"), the prerequisite chain is navigable: follow the dependencies backward and you get a clear research path. The wall becomes a map.

---

## Open Questions

- How do refinement tiers (I-V) affect the ship design component catalog? Does each tier create a new component entry, or does the existing component improve in-place?
- Should some techs be exclusive (Meijer path vs. alternative stabilization method) to create strategic identity, or is everything eventually researchable?
- How do these techs interact with the colony research infrastructure? Do certain techs require lab specialization (Aurora-style anomaly bonuses)?
- Should rank multipliers be fixed per tech, or can they vary by game difficulty/faction?
- What is the exact RP scaling formula? Eve uses `base_SP * rank * level_multiplier`. Drift could use `base_RP * rank * tier^2.5` or similar.
