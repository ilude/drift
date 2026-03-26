# Aurora 4X Colonies → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

Aurora 4X treats colonies as dynamic economic and logistical hubs with deep mechanical interconnection:

- **Population & Environment**: Colony cost increases based on gravity, temperature, and atmosphere tolerance. Population grows passively; environment suitability (habitability) affects available workforce.
- **Infrastructure Dependencies**: Mines extract surveyed resources. Construction factories build new installations. Repair yards and fuel depots service ships. Labs conduct research. All installations require workers from the available workforce pool.
- **Production Chains**: Worker allocation follows a priority system. Environmental work and agriculture consume a baseline percentage. Remaining workers distribute across active installations. Output (mining rate, construction speed, research points) scales with quality, staffing ratio, and tech bonuses.
- **Wealth & Supplies**: Colonies accumulate minerals and industrial materials. Wealth determines construction ability. Maintenance requirements ensure long-term sustainability.
- **Terraforming**: Expensive, long-duration process that reduces colony cost by modifying atmosphere/temperature. Opens marginal worlds to colonization over decades.

---

## Drift Design Constraints

- Depth without complexity: Aurora's fidelity yes, Aurora's micromanagement no
- Every system must chain to 2-3 others or it's patchwork
- No dominant strategies — colony types (homeworld vs. frontier vs. research hub) should all remain viable
- Rate modifier pattern: `effectiveRate = baseRate * quality / hardnessMultiplier`
- Current Drift state:
  - `ColonyState`: population, habitability, installations (8 types), stockpile (fuelKg, supplies, resources), researchPoints, constructionProjects[], currentResearch, researchQueue
  - `ColonyQualities`: construction, repair, refuel, research, training, mining, shipbuilding, storageCapacity, staffingRatio
  - `depotQuality` (global 1.0, eventually per-colony). `repairMultiplier`, `refuelMultiplier`, `surveyMultiplier`, `supplyMultiplier`, `moraleMultiplier` (hardness knobs in AppState)

---

## Drift Implementation Sketches

### 1. Population Growth (new)

**What Aurora does:** Population grows passively at ~0.5–2% per year, modified by happiness, environment, and food.

**Drift simplified approach:**
- Add `populationGrowthRate: number` to ColonyState (default 0.003 = 0.3%/day ≈ 10%/year)
- `effectiveGrowth = baseGrowth * habitability * (1 + moraleFactor) * (1 - deathRate)`
- Cap at ~100M per planet (prevents runaway growth, forces specialization)
- Log when population crosses order-of-magnitude thresholds

**Chains to:** Workforce (more pop = more workers); supply consumption (more pop = more drain); resource demand (creates trade incentives between colonies)

---

### 2. Supply Chain (partial)

**What Aurora does:** Supplies consumed for maintenance, population welfare, and construction. Shortages cause morale loss and slowdowns.

**Drift simplified approach:**
- Supply consumption sources:
  - Ships: `crew.count * 0.01` per day (morale decay if below min reserves)
  - Population: `population * 0.001` per day (see economy doc for details)
- Morale effects: if colony supply ratio < 0.1, apply −0.25 morale/day to docked ships; if < 0.05, block repair/refuel
- Storage constraint already exists (`BASE_STORAGE_CAPACITY + storage * 50_000`)

**Chains to:** Ship logistics (tankers/supply ships become vital); colony specialization (high-production colonies export to homeworld); research ("Supply Doctrine" → −20% consumption)

---

### 3. Habitability Modifiers (enhancement)

**Current state:** `getHabitabilityForBody()` maps planet type → habitability ∈ [0, 1]. Earth = 1.0, Moon/Dwarf = 0.35, etc.

**Expand to:**
- `populationGrowthMultiplier = habitability` (worse worlds grow slower)
- `miningHardness = (1 - habitability) * 0.5 + 0.5` (marginal worlds have harder deposits)
- `researchQualityPenalty = 1 - (habitability * 0.3)` (harsh environments reduce lab efficiency)
- `maintenanceDrainMultiplier = 1 / habitability` (ships degrade faster in harsh environments)

**Chains to:** Terraforming (future, reduces penalties); colony tradeoffs (comfortable worlds = fast growth, marginal worlds = better minerals)

---

### 4. Installation Wear & Maintenance (new)

**What Aurora does:** Installations age, require periodic overhauls, eventually fail.

**Drift simplified approach:**
- Add `installationAge: Record<ColonyInstallationId, number>` to ColonyState
- Maintenance supply drain: `installationAgeCost = sum(age[i] / 3650) * quality` (amortized over ~10 years)
- Efficiency penalty: `ageEfficiencyFactor = max(0.5, 1 - age / 3650 * 0.5)` — old installations output 50% less
- Overhaul: pause installation, spend 100 BP, reset age to 0

**Chains to:** Research ("Maintenance Doctrine" → −10% aging rate); construction (factories continuously replace worn-out installations); supply economy (maintenance drain creates baseline demand)

---

### 5. Workforce Reallocation (enhancement)

**Current state:** Staffing ratio applies uniformly to all installations.

**Drift simplified approach:** Add optional priority overrides (min/max workers per installation type). Default: no overrides (current behavior). Advanced players can optimize.

- If `usedWorkers > availableWorkers`: apply priority rules, scale installations pro-rata
- Research "Workforce Optimization" could improve reallocation efficiency by 10%

---

### 6. Resource Complexity (defer)

Current generic `stockpile.resources: Record<string, number>` is fine for now. Distinct resource types and processing chains are a Phase 3 feature — requires mineral balance review and research tree integration.

---

### 7. Colony Specialization (medium term)

Implicit specialization via installation queuing. Add efficiency bonus:
- If >50% of workforce is in one category → +10% efficiency for that category
- "Mining Engineering", "Lab Efficiency", "Logistics Hub" as planet-specific research options

---

## Recommended Next Steps (prioritized)

### Phase 1 (core dependencies)
1. **Population growth** (1–2 days) — unlocks all downstream workforce/supply effects
2. **Supply consumption** (3 days) — population + ships draw from colony stockpiles; motivates logistics
3. **Installation maintenance** (2 days) — wear + age penalties; justifies continuous construction

### Phase 2 (polish & rebalance)
4. **Habitability modifiers** (1 day) — expand to affect growth, mining, research, maintenance
5. **Rebalance rates** — with growth + drain + maintenance, retest Earth's starting population and outpost sustainability
6. **Tutorial hints** — explain supply economy and population dynamics

### Phase 3 (optional depth)
7. **Workforce reallocation UI** (2–3 days) — priority overrides for expert players
8. **Specialization bonuses** (2 days) — reward focused development
9. **Resource differentiation** (5+ days) — distinct processing chains (defer until campaign needs variety)

### Phase 4 (future)
- Terraforming (expensive, slow, reduces habitability penalty)
- Disease/crisis events (population shocks)
- Alien colonies (NPC trade/conflict)

---

## Anti-patterns to Avoid

- **Deep demographic modeling** — age cohorts, fertility rates, disease vectors add bookkeeping, not fun. `populationGrowthRate * modifier` is enough.
- **Per-installation micromanagement UI** — Aurora's per-installation worker % leads to endless fiddling. Drift's uniform staffing ratio is better; optional priority overrides only if expertise mode is valuable.
- **Disconnected mechanics** — every system must chain to 2+ others. Population → Workforce → Output. Installation age → Supply drain → Morale → Ship logistics. If a mechanic touches nothing, delete it.
- **Balancing via hardness multipliers only** — leave multipliers for difficulty presets, not balance. The real knobs are population growth rate, habitability spread, and installation costs.
- **Supply as invisible abstraction** — if colonies don't consume supplies, players ignore stockpiles entirely.
