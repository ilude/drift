# Ship Order System Design

> Status: Design direction accepted (2026-03-26). Aurora research pending — see research agent output.
> Related: `tasks/aurora-logistics-implementation.md`, `tasks/game-vision-early-game.md`

## Intent

All ships use a multi-step order loop system. The current command tree (priority-ordered conditionals) handles autonomous behavior between destinations, but does not model sequential mission procedures with looping.

Aurora 4X's order system is the reference implementation. For MVP: replicate Aurora's approach. Improvements TBD after research.

---

## Known Requirements (From Design Conversations)

### Multi-Step Orders
Ships must be able to execute a defined sequence of steps in order:
1. Transfer to Colony A
2. Load N mines (or load until cargo full)
3. Transfer to Colony B
4. Unload N mines (or unload all of type)
5. Repeat

### Looping
Order sequences can be set to:
- **Execute once** (default)
- **Repeat N times**
- **Repeat indefinitely** (until player cancels or a condition breaks the loop)

### Order Types Needed
At minimum:
- Transfer to [body]
- Load [item type] [quantity | "cargo full"]
- Unload [item type] [quantity | "all"]
- Survey [body]
- Refuel at [body]
- Idle at [body]

### Conditional Orders
The existing command tree handles fuel-below, morale-below, hull-below, supplies-below thresholds. These should integrate with or sit alongside the sequential order system — the commander judgment layer still applies on top.

---

## Aurora Reference

**Sources:** erikevenson/aurora-manual (GitHub), aurorawiki.pentarch.org, 7w1.github.io tutorials, aurora2.pentarch.org forums

---

### Order Queue Structure

Orders are managed in the **Task Group window** (accessed via the Naval Organization window, F4). Every ship belongs to a task group; orders are issued at the task group level, never to individual ships. The task group's speed is always limited by its slowest member.

The order queue is a sequential list. Each order has two parts: **what** (the action) and **where** (the target body, colony, waypoint, or contact). The player selects a target first in the left panel, which updates the available actions in the middle panel. Double-clicking a target executes the default action for that target type.

**Order cancellation:** Orders can only be removed from the bottom of the queue up ("Remove Last" removes one at a time; "Remove All" clears everything). The UI reflects where the fleet will be at the end of the current queue — target selections for later orders show the star system the fleet will be in at that point, not the current system.

---

### Looping / Repeat Orders

Two modes:

- **Repeat Orders button + count:** The player sets a repeat count N. Pressing the button appends (N × current queue) copies of the queue. Pressing it again multiplies exponentially (e.g., pressing with count=2 three times: 3 → 9 → 27 trips). Only valid if the queue ends in the same system as the fleet currently starts. This creates a **finite** loop embedded in the order queue.

- **Cycle Orders:** Makes the fleet repeat the queue **indefinitely**. The ship runs the sequence in a continuous loop until the player manually cancels orders.

**Constraint:** Both repeat modes require the queue to bring the ship back to its starting system. Long loops should include a refuel order, or ships strand themselves.

---

### Full Order Type Inventory

**Movement:**
- Move To (straight-line to body, colony, jump point, coordinate, or waypoint)
- Orbit (stable position relative to body; required for cargo operations)
- Patrol (repeating pattern between waypoints)
- Follow (match position with another task group)
- Move to Contact (chase sensor contact, auto-switches contact types)
- Intercept (calculate fuel-efficient intercept course with moving target)
- Auto-Route by System (auto-generates all jump transit orders to reach a destination system)
- Join as Sub-Fleet (join another fleet as a detachable sub-unit)

**Survey:**
- Survey Nearest Planet or Moon
- Survey Next N System Bodies (queues N bodies; N is configurable, e.g., 5, 10, 30)
- Survey Next Gravitational Survey Location
- Survey All Gravitational Survey Locations

**Logistics / Cargo:**
- Load Cargo (minerals, installations, ground forces, colonists — all via same order with parameters)
- Unload Cargo / Unload All Cargo
- Load All Minerals Until Full
- Load Specific Mineral (with minimum quantity gate — ship waits until minimum available)
- Load Colonists / Unload Colonists
- Load Installation / Unload All Installations
- Load Ordnance from Colony (requires Spaceport or Ordnance Transfer Station)
- Unload Ordnance to Colony
- Load from Ordnance Transfer Hub
- Load All Ship Components (v2.8+; prioritized by component size)
- Load Assigned Ground Templates
- Pick Up Team (diplomacy, geology, espionage teams; no cargo space required)

**Refuelling:**
- Refuel at Colony
- Join & Refuel Fleet (tanker merges into target fleet and begins refuelling)
- Join & Refuel Sub-Fleet
- Refuel from Refuelling Hub (stationary; both ships must be stationary)
- Refuel from Stationary Tanker
- Transfer Fuel to Colony (tanker-only order)
- Transfer Fuel to Refuelling Hub (tanker-only)

**Maintenance:**
- Join Fleet and Begin Overhaul (merge and start maintenance cycle)
- Overhaul at Colony (resets deployment timer; does NOT resupply fuel/MSP)
- Refuel, Resupply, and Overhaul at Colony (combined; most common conditional response)

**Combat:**
- Engage Target / Engage At Will
- Evade (flee at max speed)
- Close to X km / Maintain X km / Open to X km
- Provide Ground Support
- Attempt Boarding Action
- Search and Destroy

**Utility:**
- Launch All (launch parasite craft)
- Launch Ready Ordnance (buoys, mines, unguided)
- Auto-Route (shuttle supply runs between colonies)
- Order Delay (v1.9+; configurable wait before execution; enables synchronized multi-fleet ops)
- Combination orders: Refuel + Resupply + Load Ordnance from Colony simultaneously

---

### Standing Orders

Executed automatically when a fleet has no active movement orders. Each fleet gets **two standing order slots** (Primary and Secondary). If Primary can't execute, Secondary fires. If neither can execute, a warning enters the Event Log.

Scope indicator: **S** = current system only; **A** = across all known systems.

| Standing Order | Scope |
|---|---|
| Survey Nearest Planet or Moon | S/A |
| Survey Next N System Bodies | S/A |
| Move to Gravitational Survey System | S/A |
| Move to Geological Survey System | S/A |
| Refuel at Hub | S/A |
| Move to Rendezvous Point | S/A |
| Investigate Point of Interest | S/A |
| Land on Mothership | S |
| Pick Up Lifepod | S |
| Civilian Contract Fulfillment (v2.8+) | A |

Survey standing orders exhaust when all valid targets are complete. The ship generates repeating error events until the standing order is replaced. The common fix is switching from "Survey Planets" to "Survey N System Bodies" to cover remaining asteroid targets.

---

### Conditional Orders

Each fleet gets **two conditional order slots**. These fire based on triggers; when triggered, the existing order queue is **cleared** and the conditional action is inserted immediately. Both conditional and standing orders work by injecting orders into the normal queue.

**Condition categories:**

*Resource thresholds:*
- Fuel below X%
- Ordnance below X%
- Maintenance supplies (MSP) below X%
- Cargo capacity (above/below)

*Contact triggers:*
- Hostile contact within X km
- No hostile contacts detected
- Specific contact type detected
- Contact count exceeds threshold

*Status triggers:*
- Ship damage exceeds X%
- Crew grade below threshold
- Shield percentage below X%
- Speed reduced below threshold
- Deployment Exceeded (primary use: return home for overhaul)

*Time/Position triggers:*
- Arrived at destination
- Elapsed time since last order
- Within X km of location

**Priority ordering:** Conditions are checked in queue order; first matching condition executes. Safety conditions (fuel, damage) should be placed before mission conditions. If no condition matches, the first unconditional order in the queue executes; if the queue is empty, the fleet holds position.

**Important:** Only overhaul resets the deployment timer. Refuel and resupply alone do not. Ships at 95%+ deployment may also fail to execute standing orders.

---

### Fleet vs Individual Ship Orders

Aurora gives **no direct individual ship orders**. All orders are at the task group level. The task group's slowest ship sets the group's speed. Sub-fleets are the organizational unit below task groups: one fleet can contain several sub-fleets that travel together but can detach as independent units on demand.

**Sub-fleet workflow:**
1. Fleet travels as sub-fleets during transit (single movement order manages all)
2. At destination, "Detach Escorts" separates sub-fleets into tactical positions
3. "Recall Escorts" issues "Join As Sub-Fleet" orders to compatible fleets in the same system
4. Sub-fleets retain pre-configured escort settings (distance, bearing, threat axis) that reactivate on detachment

**Escort formation orders:** One fleet is the "Anchor Fleet." Escorts maintain relative position (distance in km + bearing in degrees). Threat hierarchy: designated hostile > nearest armed alien vessel > nearest hostile contact > anchor fleet destination.

---

### Order Templates

Player can save any configured order queue as a named template via "Save Template." Templates are system-specific (they contain absolute references to bodies in a system). Any fleet in the appropriate starting system can load a template via "Order Templates" view in the Movement Orders tab. Practical use: reuse survey configurations, standard supply run loops, patrol routes.

---

### Notable Complexity / Friction Points in Aurora

- Cancellation is bottom-up only; you can't remove an order from the middle of a queue.
- The repeat-orders button doubles exponentially, making it easy to queue 27+ trips accidentally.
- "Cycle Orders" vs "Repeat Orders" are different UI elements with different semantics.
- Sub-fleet management requires knowing to "Detach" before tactical deployment, then "Recall" to re-merge.
- Conditional orders clear the entire queue when triggered — can disrupt complex mission sequences unexpectedly.
- Survey standing orders exhaust silently (only visible via error events, not a status flag).
- Overhaul vs Refuel+Resupply distinction causes confusion: only overhaul resets deployment timer.
- Fleet evaluation order (v2.8+): newest fleet checked first for standing orders, which is counterintuitive when multiple identical ships compete for tasks.

---

### Improvement Opportunities for Drift

- **Non-destructive conditionals:** Instead of clearing the queue, suspend it; resume after the condition resolves.
- **Mid-queue editing:** Allow order insertion/reorder anywhere, not just bottom removal.
- **Named loops:** Label a repeating sequence so the player sees "Mining Loop (cycle 3 of ∞)" in the status.
- **Individual ship orders:** Since Drift ships already have identity and the command tree, the "no individual orders" constraint is artificial and unwanted.
- **Conditional resume vs replace:** Aurora always replaces queue. Drift could offer "interrupt and resume" vs "abandon and replace" semantics per conditional trigger.

---

## Implementation Notes (Preliminary)

The current `commandTree` in `ShipEntry` is a priority-sorted list of conditionals. Sequential mission orders are a different paradigm — more like a program than a priority queue.

Two likely approaches:
1. **Separate mission queue:** A `missionOrders: MissionStep[]` array on `ShipEntry`, separate from `commandTree`. The command tree handles autonomous behavior; mission orders take precedence when active.
2. **Extended command tree:** Add a `sequence` command type to the existing tree that encapsulates an ordered list of steps.

Option 1 is cleaner — mission orders and autonomous behavior are fundamentally different patterns. The mission queue runs when explicitly set; the command tree runs when no mission is active.

Architecture decision deferred until Aurora research is complete.
