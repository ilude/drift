# Aurora 4X Economy & Industry → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

Aurora's economy is a production-driven system where colonies are the economic engine:

- **11 mineral types** extracted from planetary bodies via mines, modified by accessibility (hardness) and mining technology
- **Mines** require 50,000 population each; extract minerals from deposits on a curve based on body geology and survey level
- **Construction Factories (CF)** build all installations; each CF requires 50,000 population, produces installations at rates modified by race/governor bonuses
- **Wealth generation** accumulates annually and funds all construction; deficit penalties proportionally throttle production (Economic Production Modifier)
- **5-day construction increment cycle**: each period, mines extract, CFs build, wealth flows
- **Manufacturing efficiency** = % of required workers available; understaffing reduces all facility throughput proportionally
- **Fuel refineries** convert mined Sorium 1:2000 into spacecraft fuel
- **Trade routes** let civilian factions accumulate wealth and build shipping independently
- **Mass drivers** enable inter-planetary mineral transport with logistics costs
- **Civilian mining colonies** operate under different rules; can be taxed or purchased

Aurora couples **resource scarcity** (minerals are finite, location-dependent) with **time cost** (mines + CFs produce slowly) and **population constraints** (installations compete for workers, staffing shortfalls ripple across all production).

---

## Drift Design Constraints

- Depth without complexity: Aurora's fidelity yes, Aurora's micromanagement no
- Every system must chain to 2-3 others or it's patchwork
- No dominant strategies — tradeoffs everywhere (mine ore vs refuel depot; early construction vs ship fuel reserves)
- Rate modifier pattern: `effectiveRate = baseRate * quality * deposit.accessibility / hardnessMultiplier`
- Drift has 27 resource types in 5 categories (metal, volatile, industrial, radioactive, umbral)
- Colonies have: mine installations, constructionFactory, storage, stockpile (fuelKg, supplies, resources map)
- Ships have fuelKg, supplies, maintenance — these are the "economy outputs" (resources consumed)

---

## Drift Implementation Sketches

### 1. Mining → Resource Scarcity

**Status:** Partial. Planets have `deposits[]` with `quantity`, `accessibility`, `mined`, `minSurveyLevel`. Mining ticks `deposit.mined += BASE_MINING_RATE * mine_count * quality * accessibility * dt`.

**Gap:** No hardness modifier per resource (all mine at same rate). Add:
- `hardnessMultiplier: number` per ResourceDef (Plutonium = 2.0x; common metals = 0.8x)
- Formula: `amount = baseRate * installationCount * quality * deposit.accessibility / resource.hardnessMultiplier * dt`

**Connects to:** Construction (ore needed for building); ship maintenance (fuel + supplies); research (tech unlocks better drills → -25% hardness)

---

### 2. Construction Factories → Installation Growth

**Status:** Partial. Colonies have `constructionProjects[]` with bpCost per installation type. Projects tick `progressBp += baseRate * factory_count * quality * dt`, complete when `progressBp >= def.bpCost`.

**Refinements:**
- Add **prerequisite chains** (can't build shipyard until academy exists; can't build lab until constructionFactory >= 2). Prevents rushing endgame, forces infrastructure ordering.
- Add **resource cost** to construction (mine costs 30 iron + 20 aluminum + 10 copper). Makes mining decisions matter; prevents infinite growth; ties into trade.

**Connects to:** Mining (ore costs); research (unlocks buildings); workforce (staffing ratio affects build speed)

---

### 3. Workforce & Staffing

**Status:** Good. `computeColonyWorkforce()` calculates `staffingRatio = availableWorkers / usedWorkers`. Each installation has fixed worker requirement. Staffing ratio multiplies all qualities.

**Refinement:** Add **population supply consumption** (supplies consumed per capita per day):
```
baseSuppliesNeeded = population * 0.001 per day  // 5M pop needs 5k supplies/day
actualSupplied = consumeColonySupplies(bodyName, needed)
if (actualSupplied < needed * 0.5) → morale/productivity penalty
```

**Connects to:** Ships (consume supplies while deployed); trade (import supplies); research (life-support tech → -15% consumption)

---

### 4. Fuel Refineries (missing)

Aurora's wealth → Sorium → fuel pipeline. Drift simplification: skip abstract wealth, add **fuel refineries** as a colony installation.

- New `ColonyInstallationId`: `"fuel-refinery"`
- Requires 25,000 population (less than mine/CF)
- Input: water + methane deposits (accessibility must be > 0.3)
- Formula: `fuelKgPerDay = BASE_REFINERY_RATE * refinery_count * quality * (water_access + methane_access) / 2 * dt`
- Unlock via research "Fuel Processing"

**Connects to:** Mining (hydrocarbon deposits); ships (fuel demand); research (better refining); cross-colony trade (transport hydrocarbons)

---

### 5. Cross-Colony Trade (missing)

Aurora uses mass drivers and civilian shipping. Drift simplification: ship cargo.

- `ShipEntry` gets `cargo: Record<resourceId, number>` and `cargoCapacityKg: number`
- New commands: `"load-cargo"` / `"unload-cargo"` (rate determined by spaceport quality)
- Colonies post "sell mineral X" / "buy mineral X" requests
- Ships route: pickup at colony A → deliver at colony B
- Dynamic pricing: if colony has >50k iron, buyer gets 5% discount per 50k excess

**Justification:** Forces inter-colony logistics decisions; makes surveying new locations valuable (find iron source, set up trade route).

---

### 6. Research → Production Bonuses

**Status:** Good. Researched techs apply bonuses to colony qualities.

**Refinement:** Separate **tech access** from **tech bonus level**:
- Unlock "Mining Automation" at tech level 3 → unlocks automated mines (no population cost)
- Each completion increases bonus: +10% → +15% → +20% (diminishing returns)
- Makes research continuous — always something to improve

---

## Recommended Next Steps (prioritized)

### P1
1. **Add resource hardness multiplier** — `hardnessMultiplier` per ResourceDef, update `tickMining()` (est. 2 days)
2. **Add resource cost to construction** — each `ConstructionDefinition` requires `resourceCosts: Record<resourceId, number>`, deduct on completion (est. 2 days)
3. **Add fuel refinery installation** — new installation type, hydrocarbon → fuel pipeline, tie to research (est. 2 days)

### P2
4. **Add supply consumption** — colony population draws supplies each tick; shortage applies quality penalty (est. 1 day)
5. **Add cargo system to ships** — `cargo` + `cargoCapacityKg` on `ShipEntry`, load/unload commands (est. 3 days)
6. **Add cross-colony trade** — colony buy/sell requests, ship routing, dynamic pricing (est. 4 days)

### P3
7. **Tech-tree prerequisites for installations** — CF before lab/refinery, academy before shipyard, etc. (est. 2 days)
8. **Refactor research bonuses into tech levels** — levels 1–3, diminishing returns curve (est. 2 days)

---

## Anti-patterns to Avoid

- **Per-mine output tweaking** — automate mining; player doesn't click each mine individually
- **Infinite construction** — without resource costs, players snowball. Add ore costs so even spare BP is bottlenecked on supply
- **Isolated colonies** — if inter-colony logistics are optional, systems feel patchwork. Force the issue: make bodies complementary (water-rich but metal-poor)
- **Supply as invisible abstraction** — if colonies don't consume supplies, supplies feel free. Tie population to supply demand: "Earth needs 10k supplies/day; you have 3 days of buffer"
- **Flat research bonuses** — "+15% mining" is boring. Unlock new capabilities (automated mines), then improve them through tech levels
