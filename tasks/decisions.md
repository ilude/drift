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
