# V1 Design Constraints (Consolidated)

> Status: Accepted for v1 implementation planning
> Source: Interactive design Q&A (player goals, economy, research, logistics, UI)

## 1) Game Shape and Success Criteria

- Open-ended sandbox with no fixed win condition.
- Player sets self-directed goals; fun comes from managing interacting systems.
- Design target: depth without unnecessary complexity.
- Pressure profile: mixed by default (planning + periodic crises), configurable at game start (storyteller-style).
- Development sequence: single-faction economy/expansion first; rival factions later.

## 2) Scope for Current Milestone

- Implement `Phase 0` colonies plus minimal research gating.
- Research tree is deterministic and shared across runs (Aurora-style broad tree).
- Core fiction: game begins at the moment dark-matter discovery becomes available to humanity; players guide outcomes from there.
- Dark-matter elements are already discovered at game start and serve as research foundation.

## 3) Logistics and Economy

- No global magical resource pool.
- Goods/resources must move physically by ships.
- Ships require role-appropriate modules/configuration for handled resource types.
- Early control mode is mostly manual (no heavy automation/governor behavior yet).
- Preserve skillful emergent play by default; only remove behaviors that collapse decision quality.
- Austrian-econ lens is a design heuristic for solution proposals (local information, tradeoffs, coordination via system signals).

## 4) Colonization and Industry Direction

- North star remains Aurora-like ship design and shipyard tonnage/capacity constraints.
- No fixed ship templates as long-term design; player-designed ships are core. No ship can be built without a player-authored design.
- Ship components (engines, life support, cargo bays, maintenance bays, hibernation tubes) are research unlocks with mass, crew requirements, and performance characteristics. No visual placement — component list only.
- Colonization depends on researched capabilities and logistics (cargo lift, infrastructure/supplies, industrial staging).
- Earth starts "at the margin" — constrained but functional. Player must grow factories, farming, and mines before expansion is viable.
- Colony infrastructure is manufactured as **flat-packed modules** at Earth (or any colony with factories), loaded onto cargo ships, and assembled at the destination. A colony cannot build installations it hasn't received modules for (or manufactured locally).
- Production chains are non-spatial abstract entities (spreadsheet-style I/O systems), not map placement gameplay.
- Blueprinted production chains are detached copies.
- Blueprint construction requires required facilities/modules to exist in inventory/warehouse.
- No v1 blueprint retrofit propagation (YAGNI).

## 4a) Factory Allocation Model

Factory capacity is allocated by percentage across a construction queue. Both queue order and allocation % matter:

- Each queued job has an assigned desired capacity % (e.g., 20% of all factories work on this job)
- The tick assigns actual capacity dynamically: fill each job up to its desired %, roll any unused % to the next waiting job
- If a job cannot reach its desired %, it waits for another job to free capacity, then claims that capacity up to its desired % or until the job completes
- No factory capacity is wasted — unused allocation always flows to the next available job
- Multiple jobs run in parallel, each progressing proportional to actual allocated capacity

## 4b) Mines

Two mine types:
- **Standard mine** — requires workforce to operate; cheaper and faster to build
- **Automated mine** — no workforce required; more expensive and slower to build

Mines are tracked as counts on a colony (`colony.installations.mine`, `colony.installations.automatedMine`). They are not individual entities. Mine output is computed from the count each tick — no explicit assignment needed.

Mines can be physically transferred between colonies via cargo ship orders: subtract from source colony count, add to ship cargo, subtract from ship cargo at destination, add to destination colony count. The cargo ship order system handles the logistics sequence.

Resource-specific mine targeting (e.g., "80% iron output") is a future mechanic. In v1, mines extract whatever deposits are available on the body.

## 5) Research System (V1 Rules)

**Implementation Status (2026-03-26):**
- Tech tree: 20 techs across 5 categories with prerequisites ✓
- Project management UI: Global research popout screen ✓
- Project tracking: Active/paused/queued groups with ETAs ✓
- Scientist assignment: Single-assignment model (one active project per scientist) ✓
- Project persistence: Full pause/resume ✓
- Still pending: Tech effects applying to game systems (engine gates, survey/industry bonuses); academy scientist generation; eureka breakthroughs

**Rules:**
- Many projects may run in parallel, constrained by scientists/labs.
- Progress persistence is full (pause/resume with no decay).
- Scientists are single-assignment only (one active project per scientist).
- If lead scientist is removed/lost, project hard-stops until a replacement is assigned.
- New scientists come only from academy/training pipeline.
- Initial scientist pool is seed-driven at game start with wide variance.
- Academy output model: fixed baseline durations + small condition modifiers.
- Scientists are assigned to specific projects (not domains only).
- Research is colony-local: scientist uses labs where they are located.
- Labs are generic in v1 (specialized labs are a future mechanic).
- Labs are assigned to scientists (not directly to projects).
- Lab reassignment between scientists is instant.
- Admin rule: hard cap only; assignment above cap is disallowed.
- Scientist swap on a project has no handoff penalty.

## 6) Scientist Skill Model

- Base effectiveness is 100% in any category.
- Scientists can have category bonuses; initial profile can include standout experts.
- Bonus application is multiplicative (example: +30% => 1.30x completion rate).
- Per-category bonus cap is +50% (max 1.50x).
- Scientists can gain new category improvements via sustained work in those categories.
- Skill growth depends on time-on-task plus project difficulty weighting.
- No skill decay in unused categories for v1.

## 7) Research UX and Queues

- Main table columns: `Project`, `Lead Scientist`, `Progress %`, `ETA`, `Allocated Labs`.
- `ETA` is a projected completion date and updates immediately on condition changes.
- Same table includes active/paused/queued jobs, grouped Outlook-style:
  - Active
  - Paused
  - Queued
- Sorting is supported; default is nearest completion date.
- Queues are scientist-bound: when a scientist finishes, they take their highest queued project assigned to them.
- Queue default order is FIFO insertion, with player reordering allowed for research queues.
- If scientist has no queued assignment, they remain idle.
- One lead scientist per project at a time.

## 8) Scientist Transfer Rules

- Scientists relocate via transport time/logistics (not instant relocation).
- Personnel can deadhead on any available transport in v1.
- Deadhead capacity is limited by crew with diminishing returns; proposed starting rule:
  - `deadhead_cap = min(floor(crew * 0.10), 20)` for ships with crew >= 10
- Deadheads do not add extra supply consumption in v1.
- Transfer requests queue per origin colony (not global), FIFO.

## 9) Narrative and Logs (Mechanics-First)

- Narrative remains secondary to core mechanics in v1.
- Include lightweight scientist history (completed projects only).
- Record research completion in global game log with:
  - tech
  - scientist
  - completion date
  - colony/location
- Log is append-only.
- Log viewer supports filtering/search.
- Log entries are categorized at write time.

## 10) Metrics and Tooling Priority

- Validation is qualitative-first.
- Metrics/tools are welcome where helpful.
- Priority order:
  1. Research staffing dashboard
  2. Production bottleneck tooling (after enough industry depth exists)
- Do not provide explicit "bottleneck reason" labels in v1; player infers from visible data.

## 11) Open Items (Intentionally Deferred)

- Austrian-econ representation: implicit vs explicit UI surfacing is not yet fixed.
- Specialized labs and richer staffing economics (salary/upkeep) are deferred.
- Blueprint propagation/retrofit behavior is deferred.
- Rival factions/conflict systems are deferred until economy + expansion loops are solid.
