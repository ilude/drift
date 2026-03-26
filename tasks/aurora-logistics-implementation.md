# Aurora 4X Logistics → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

### Fuel Management
- Fuel derives from **Sorium**, refined at colonies (48k–280k liters/year depending on tech)
- Alternative: ship-mounted Sorium harvesters and orbital harvesting facilities
- Fuel consumption is quadratic: 2× speed = 4× fuel burn
- **Fuel Depots** positioned along transit routes extend range without full colonies
- Tanker operations distribute fuel via underway replenishment or shuttle runs

### Maintenance System
- Two independent timers per ship: **Maintenance Clock** (since overhaul) and **Deployment Clock** (since port)
- Component failures trigger randomly as maintenance clock advances; failed components stop functioning until repaired with Maintenance Supply Points (MSP)
- **Critical failures** (engine, fuel tank, crew quarters) can strand ships or trigger cascading failure spirals
- **Maintenance facilities**: 1,000 tons base capacity, 50,000 workers required; EMR = Total Capacity / Total Tonnage
- **MSP production**: 20–100/year depending on tech; costs Duranium + Gallicite + Uridium
- **Overhaul** (only at naval shipyards): resets both clocks, repairs all damage, restores morale
- **Deployment clock** tracks time away from port; exceeding intended duration causes morale degradation and order refusal

### Supply Ships
- **Tankers** carry fuel; **Colliers** carry ordnance
- Transfer rate: 40 MSP/hour baseline (scales to 400 MSP/hour at tech level 11)
- **Underway Replenishment** tech enables transfers while moving (20–100% of stationary rates)
- Fleet resupply hierarchy: parent commands supply subordinates

### Orbital Habitats & Depots
- Space stations provide infrastructure without requiring planetary surfaces
- Orbital Defense Platforms mount weapons/sensors, lack engines
- Strategic positioning at jump points provides critical refueling/staging

---

## Drift Design Constraints

- Tiered maintenance already exists: routine (crew idle), overhaul (depot-level, resets `age`), major-refit (structural, resets `lastRefitAge`)
- Hull ceiling: `hullCeiling(totalAge, lastRefitAge) = max(30, 100 - yearsSinceRefit * 1.5)`
- Bathtub curve malfunction model already implemented
- Fleet refueling: tanker ships with `refuel-ship` command, `TANKER_TRANSFER_RATE_PER_DAY = 10,000 kg/day`, `TANKER_RESERVE_FLOOR = 0.15`
- `depotQuality` per-colony drives repair/refuel rates
- Rate modifier pattern: `effectiveRate = baseRate * quality / hardnessMultiplier`

---

## Drift Implementation Sketches

### 1. Supply Drain During Operations (highest impact)

**What's missing:** Supplies drain passively during active missions; depletion increases malfunction severity.

**Approach:**
- Passive drain during transfer: `supplyDrain = 0.1 supplies/day * (1 + yearsDeployed)`
- Malfunction damage if supplies < 50%: base damage doubled (3–12 → 6–24)
- No "supply ship" command needed — supplies drain and force earlier overhauls naturally

```typescript
function tickSupplyDrain(ship: ShipEntry, simDt: number): void {
  if (ship.shipState !== "transferring") return;
  const yearsDeployed = ship.maintenance.age / 365;
  const drainRate = 0.1 * (1 + yearsDeployed);
  ship.maintenance.supplies = Math.max(0, ship.maintenance.supplies - drainRate * simDt);
}
```

**Chains to:** Overhaul frequency; forward supply caches; colony stockpile management

---

### 2. Fuel Production at Colonies (enables forward bases)

**What's missing:** Colonies don't produce fuel — all fuel comes from Earth or transfers.

**Approach:**
- Add `"fuel-refinery"` installation (25,000 population, builds from hydrocarbons)
- Input: water + methane deposits (accessibility > 0.3 required)
- `fuelKgPerDay = BASE_REFINERY_RATE * refinery_count * quality * (water_access + methane_access) / 2 * dt`
- Gas giants and Centaurs get `soriumMultiplier = 1.5`

**Chains to:** Mining (hydrocarbon deposits); ship fuel demand; research ("Fuel Processing" unlock); cross-colony trade

---

### 3. Repair Yard Supply Production (makes repair capacity tangible)

**What's missing:** Repair yards provide quality bonuses but don't produce a concrete resource.

**Approach:** Unify "supplies" as the MSP-equivalent:
- Repair yards produce `BASE_SUPPLY_PRODUCTION = 5 supplies/day` per yard, modulated by quality
- Overhaul consumes: `hullDamage * 1.5` supplies
- Major-refit consumes: 100 supplies (fixed, represents deep structural work)
- Ships at colonies auto-resupply (slow passive top-up, same pattern as fuel)

**Chains to:** Colony construction (build repair yards); supply drain (consumption vs. production balance); research ("Advanced Maintenance Doctrine" → +20% production)

---

### 4. Mandatory Overhaul Trigger (deployment cycles)

**What's missing:** Ships can deploy indefinitely via morale management; no hard overhaul cadence.

**Approach:**
- Add age threshold: if `maintenance.age > 365 * 2` (2 years), flag ship "Needs Overhaul"
- Ships autonomously enter overhaul at home colony when flagged (standing order behavior)
- Implement as `CommandCondition`: `{ type: "age-above"; threshold: number }` triggering `overhaul`

**Chains to:** Commander judgment (high-judgment commanders pre-empt this); colony repair yards (needed to perform overhaul); supply consumption (supplies required)

---

### 5. Hull Performance Degradation (makes integrity visible)

**What's missing:** Low hull integrity only affects malfunction rate; no transfer performance impact.

**Approach:**
- At hull < 50%, apply delta-v penalty: `effectiveDeltaV = baseDeltaV * (0.5 + hull / 200)`
- Makes low-hull ships visibly slower; creates incentive to prioritize repair without adding a new system

**Chains to:** Overhaul timing (slow ships prioritize repair); transfer planning (injured ships can't reach distant targets)

---

### 6. Orbital Fuel Depots (forward base infrastructure)

**What's missing:** Ships can only refuel at colonies; no forward staging posts.

**Approach:**
- `OrbitalDepot` entity type (stationary, placed by player at any body)
- Has `stockpile: { fuelKg }` and `quality`
- Ships orbit depots same as planets; existing refuel logic unchanged
- Stocked via "supply depot" command or passively from nearby colonies
- No tanker micromanagement — fuel flows automatically

**Chains to:** Colony fuel production (depots draw from producing colonies); survey (place depots at mineral-rich waypoints); research ("Jump Point Infrastructure" for inter-system depots)

---

## Recommended Next Steps (prioritized)

1. **Supply drain during operations** (2–3 hours) — highest impact, minimal complexity; forces logistics planning naturally
2. **Fuel production at colonies** (1–2 hours) — eliminates early-game fuel bottleneck; enables forward bases
3. **Repair yard supply production** (3–4 hours) — makes repair yards a concrete strategic resource, not just a quality modifier
4. **Mandatory overhaul age trigger** (1 hour) — adds crew rotation without player micromanagement
5. **Hull performance degradation** (1 hour) — makes hull integrity mechanically meaningful beyond malfunction risk
6. **Orbital fuel depots** (2–3 hours) — supports mid-game forward base strategy

---

## Anti-patterns to Avoid

- **Explicit tanker dispatcher AI** — Aurora forces manual tanker routing; Drift should use passive production + autonomous docking instead
- **Micromanaged supply convoys** — time-critical load sequences become busywork; fast automatic transfers are better
- **Component failure repair queue** — dozens of failed components requiring individual MSP allocation; Drift's unified `supplies` abstraction handles this cleanly
- **Dual-timer micromanagement** — Aurora's separate deployment vs. maintenance clocks with mid-transit shore leave demands; Drift's unified `age` trigger is enough
- **Per-facility EMR calculations** — Aurora's Effective Maintenance Rate math; Drift's simple `staffingRatio * quality` achieves the same effect without the bookkeeping
- **Exhaustible Sorium deposits** — creates pressure to colonize everywhere for fuel; make high-richness bodies effectively infinite in the early game
