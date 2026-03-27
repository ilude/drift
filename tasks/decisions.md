# Architecture & Design Decisions

Record of why things work the way they do. Goals, rationale, and trade-offs — not implementation steps.

---

## Transfer System

### Hermite Spline Transfers (not Hohmann/Lambert)
**Goal:** Smooth, visually appealing ship movement between bodies.
**Why Hermite:** Hohmann ellipses require precise orbital insertion burns and look unnatural at game scale with sqrt-compressed coordinates. Lambert solvers were prototyped but added complexity without visual benefit. Cubic Hermite splines give smooth S-curves with simple tangent control, and the math is cheap (4 basis functions per frame).

### Full 3D Splines (not ecliptic-plane only)
**Goal:** Eliminate camera jumps when transferring to/from inclined asteroids.
**Why:** Asteroids have orbital inclination producing non-zero Y positions. The original 2D spline (X/Z only) forced ships to Y=0 during transfer, causing a visible snap when departing or arriving at inclined bodies. Full 3D interpolation (X/Y/Z) through the spline eliminates this.

### Live Endpoint Tracking with Re-spline
**Goal:** Ships arrive at the target's actual position, not where it was predicted to be.
**Why:** Targets move during multi-day transfers. Rather than freezing the spline, the rendering loop tracks the target's live position and re-splines when endpoint drift exceeds a threshold. Re-splining uses the ship's current position/velocity as the new P0/T0, preserving continuity.

### Capture Blend (final 15%)
**Goal:** Smooth visual transition from transfer arc to station-keeping orbit.
**Why:** Hermite endpoints don't perfectly match the live station-keeping offset. In the final 15% of transfer, a smoothstep blend steers the ship toward the exact station-keeping position, preventing a visible snap at arrival.

### Minimum Fuel Floor for TN Engines
**Goal:** Make transfer fuel cost visible and meaningful.
**Why:** Trans-Newtonian engines have extreme Isp (~1M seconds), making rocket-equation fuel negligible for any realistic delta-v (e.g., 17 kg for a 2 AU transfer from a 50,000 kg tank). A floor of 1% capacity per transfer day ensures transfers have noticeable fuel cost representing thruster wear, active maneuvering, and mid-course corrections.

### Brachistochrone Timing (not Hohmann timing)
**Goal:** Transfer times that feel right for TN engine performance.
**Why:** Hohmann transfers assume coasting ellipses. TN engines provide sustained thrust, so brachistochrone (constant-acceleration flip-and-burn) timing is more appropriate and gives shorter, more engaging transfer windows.

### Kepler Prediction for Target Position
**Goal:** Accurate arrival point prediction for eccentric orbits.
**Why:** Linear extrapolation (constant radius, constant angular velocity) misses badly for eccentric orbits. Full Kepler propagation (mean anomaly advance, Kepler equation solve, radius from conic) matches the render loop's orbital mechanics. Special cases: comets use 3D inclined orbits via `orbitToWorld`, moons propagate parent + offset, asteroids fall back to linear (roughly circular).

---

## Ship Simulation

### Rate Modifier Pattern (quality x hardness)
**Goal:** Consistent difficulty scaling across all rate-based systems.
**Why:** Every recovery/drain rate uses two orthogonal axes: depot quality (location facilities, currently global 1.0) and game hardness multiplier (player-chosen difficulty). Formula: `effectiveRate = baseRate * quality / hardness`. This ensures new systems automatically support difficulty tuning.

### Dynamic Overhaul Duration
**Goal:** Overhauls actually restore the ship to full health.
**Why:** A fixed 5-day duration only recovered ~12.5% hull at 2.5%/day repair rate. Duration is now calculated from the actual hull/supplies deficit, accounting for depot quality and hardness multipliers, ensuring the ship reaches full repair.

### Command Tree (Standing Orders)
**Goal:** Autonomous ship behavior without micromanagement.
**Why:** Priority-ordered conditional commands evaluated between actions. Ships check conditions top-to-bottom, execute the first match. `immediateCommand` provides one-shot overrides cleared on dispatch. This gives players Aurora 4X-style automation with visual feedback (condition indicators show which rules are active).

### Intent Broadcast for Multi-Ship Coordination
**Goal:** Multiple ships survey different targets without contention.
**Why:** Ships publish their current activity (surveying X, transferring to Y). `selectNextSurveyTarget` skips bodies claimed by other ships. Simple publish/query pattern — no central scheduler, no complex negotiation.

### Transfer Error Flash (UI-only, not autonomous)
**Goal:** Show "Need X km/s, have Y km/s" only when the player clicks Go.
**Why:** Autonomous command evaluation tries transfers repeatedly; showing error flashes for every failed attempt creates persistent red text in the info panel. The `showUI` parameter on `initiateTransfer` gates the flash to manual actions only.

---

## Entity Resolution

### Unified O(1) Lookup via `core/entities.ts`
**Goal:** Single source of truth for finding any game entity by name.
**Why:** The codebase had 6+ inconsistent lookup patterns (bodyMeshes.find, planetMap, findBodyEntry, findAsteroid, etc.) with subtle differences in what they matched. Unified Maps rebuilt via `rebuildEntityMaps()` provide O(1) lookup for bodies, asteroids, ships, and stars. All old wrappers have been deprecated and removed.

---

## Coordinate System

### Sqrt-Compressed World Space
**Goal:** Show inner and outer solar system simultaneously without 1000:1 scale ratio.
**Why:** Real AU distances make inner planets invisible next to outer planets. `worldR = sqrt(rAU) * DIST_SCALE` compresses the range while preserving relative ordering. Ship transfers use Hermite splines in world space to avoid distortion artifacts from computing curves in AU space then compressing.

---

## UI Philosophy

### No Redundant Displays
**Goal:** Each piece of information appears once, in its canonical location.
**Why:** Status bars below Standing Orders duplicated Fuel/Hull/Morale/Supplies from the detail rows above. Removed to reduce visual noise. Duration row is the single source for transfer timing (remaining/total). Action row shows what, not when.

### Deterministic Formatting
**Goal:** Consistent number display across all ship stats.
**Why:** Fractional accumulation (e.g., supplies += rate * simDt) produces long decimals. All displayed values use appropriate rounding: `Math.round()` for percentages and integer quantities, `.toFixed(2)` for fuel tonnes, `formatDays()` for durations (decimal for sub-day, floor for multi-day).

---

## Tanker Coordination

### Hold-for-Tanker via Intent Broadcast (`checkHoldForTanker`)
**Goal:** Tanker ships can rendezvous with their target without the target departing before the tanker arrives.
**Why:** Without coordination, a tanker dispatched to refuel Ship A would often arrive to find Ship A had already left for the next survey target. The fix: when a tanker publishes a `{ type: "tanking", target: "Ship A" }` intent, `checkHoldForTanker` in the commander judgment layer intercepts any `survey` or `transfer` dispatch and substitutes `idle` until the tanker departs (clears the intent). This is purely passive — no new state, no timers — and the hold resolves automatically when the tanker finishes and publishes a new intent.
**Priority:** Second override in `commanderDecide()`, after preemptive servicing, before defer-maintenance.

---

## Type System

### `Result<T>` Go-style Tuple (`core/result.ts`)
**Goal:** Explicit, non-throwing error handling for operations that may fail without exceptional conditions.
**Why:** `null` returns lose the reason for failure; thrown exceptions interrupt control flow for expected conditions (e.g., "no valid survey target found"). Go-style `[T, true] | [null, false]` tuples make the success/failure branch explicit at the call site with destructuring. Kept minimal: just `ok(v)` and `err()` helpers — no `Either` monad complexity.

---

## Colony System

### Phase 0: Colony as Flag + Installations + Stockpile
**Goal:** Ship repair/refuel rates driven by actual colony infrastructure, not a global constant.
**Why:** The pre-colony codebase used a hardcoded `depotQuality = 1.0` for all repair/refuel math. Phase 0 replaces this with a per-body `ColonyState` containing population, 8 installation types (repair yard, fuel depot, mine, lab, academy, construction factory, storage, shipyard), and stockpiles. `ColonyQualities` derived from installations drives the same rate modifier formulas — no other ship logic changed.
**Phase 0 scope:** Colony placement (flag on body), workforce allocation, quality calculation, mining/construction/research ticks. No cross-colony trade or inter-system logistics yet.
**Installation types accepted:** `repair-yard`, `fuel-depot`, `mine`, `lab`, `academy`, `construction-factory`, `storage`, `shipyard`. Construction queue with BP-based progress. Research queue consuming scientist-hours.

## Ship Design System

### Aurora-Faithful Component Catalog (not sliders or templates)
**Goal:** Player agency over ship/engine design with genuine tradeoffs.
**Why component catalog over sliders:** Sliders (percentage-based allocation) explore quickly and don't create enough "aha" moments for a game where ship design is a primary player system. Discrete component choices create more surprising emergent builds. Aurora's reference material confirms component-level design is where the deepest early-game decisions live.
**Why not hybrid:** A hybrid (templates + key components + balance slider) was considered but rejected as a compromise that dilutes both approaches. Full catalog creates more depth even at the cost of higher learning curve, which is acceptable for Drift's target audience.

### Power Modifier Engine Design
**Goal:** Engine customization within a tier — not just "pick the best engine."
**Formula:** `accelG = base * p`, `ispS = base / sqrt(p)`, `massKg = base * p` where `p` is power modifier (0.5x–3.0x).
**Why this formula:** Creates three-way tradeoff — high power gives more thrust but heavier engine AND worse fuel efficiency. `1/sqrt(p)` for Isp is a compromise between Aurora's harsher penalty and keeping the slider feel responsive. At p=2: double thrust, 1.41x mass, 0.71x efficiency.

### ShipPhysicsState: Resolved Values (not engine ID lookup)
**Goal:** Keep math module pure — no state dependencies.
**Why:** `checkTransfer()` and `checkTransferKm()` previously looked up `ENGINE_TYPES` by `engineId`. With custom engine designs, this would require importing state into the math module, creating a circular dependency risk. Instead, callers resolve the engine (from design or legacy) via `resolveShipPhysics()` and pass raw `accelG`/`ispS` values. Math functions stay pure and testable.
