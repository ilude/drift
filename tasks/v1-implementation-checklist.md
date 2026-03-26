# V1 Implementation Checklist (Phased, Testable Slices)

> Source constraints: `tasks/v1-design-constraints.md`
> Goal: Deliver economy + expansion + research foundations with minimal scope drift.

## Phase 0 - Foundation and Data Contracts

- [ ] Define/confirm core domain types for:
  - [ ] Scientist profile (base rate, category bonuses, admin cap, location, assignment)
  - [ ] Research project state (active/paused/queued, progress, lead scientist, labs)
  - [ ] Colony-local lab pool and assignment map (labs -> scientist)
  - [ ] Transfer request (origin, destination, person, queue position, status)
  - [ ] Append-only log event schema (category, timestamp, payload)
- [ ] Add deterministic seed hooks for initial scientist pool variance.
- [ ] Add/confirm project categories/domains for bonus application.

Verification:

- [ ] Type-level compile checks pass.
- [ ] Seeded runs reproduce identical initial scientist pools.

## Phase 1 - Research Core Engine (No UI Dependencies)

- [ ] Implement project lifecycle states: Active / Paused / Queued.
- [ ] Implement full persistence on pause/resume (no progress loss).
- [ ] Implement single lead scientist per project.
- [ ] Implement single-assignment scientist rule.
- [ ] Implement hard-stop behavior when lead scientist removed/lost.
- [ ] Implement parallel project execution constrained by scientist/labs.
- [ ] Implement immediate completion-date recalculation on state/staff/lab changes.

Verification:

- [ ] Unit tests for state transitions and persistence behavior.
- [ ] Unit tests proving hard-stop and resume behaviors.
- [ ] Unit tests proving immediate ETA recompute after each relevant change.

## Phase 2 - Scientist Effectiveness and Growth

- [ ] Implement base 1.00x effectiveness in all categories.
- [ ] Implement multiplicative category bonus model (e.g., 1.30x).
- [ ] Enforce bonus cap at 1.50x per category.
- [ ] Implement time + project-difficulty weighted growth.
- [ ] Allow learning/improving categories through sustained work.
- [ ] Ensure no skill decay in unused categories.

Verification:

- [ ] Unit tests for multiplier math and 1.50x cap enforcement.
- [ ] Unit tests for growth progression by difficulty tier.
- [ ] Unit tests proving no decay over inactive periods.

## Phase 3 - Labs and Admin Capacity Model

- [ ] Implement labs assigned to scientists (not projects).
- [ ] Implement colony-local lab availability and usage.
- [ ] Implement admin hard cap for effective lab assignment.
- [ ] Disallow assignment above admin cap.
- [ ] Implement instant lab reassignment between scientists.

Verification:

- [ ] Unit tests for lab assignment routing (scientist -> active project).
- [ ] Unit tests for cap rejection behavior.
- [ ] Unit tests for instant reassignment and ETA update effects.

## Phase 4 - Scientist Queues and Scheduling

- [ ] Implement scientist-bound queue model (not single global project queue).
- [ ] Queue default order: FIFO insertion.
- [ ] Allow manual up/down reorder for queued research jobs.
- [ ] On completion, scientist auto-pulls next assigned queued project.
- [ ] If no queued work assigned to scientist, scientist remains idle.

Verification:

- [ ] Unit tests for FIFO default and manual reorder correctness.
- [ ] Unit tests for post-completion next-job selection.
- [ ] Unit tests for idle behavior when no assignment exists.

## Phase 5 - Colony Locality and Transfers

- [ ] Enforce colony-bound research (scientist uses labs where located).
- [ ] Implement scientist relocation via transport time/logistics.
- [ ] Implement per-origin-colony FIFO transfer queues.
- [ ] Implement deadhead-on-any-ship policy with capacity limit:
  - [ ] Starting rule: `deadhead_cap = min(floor(crew * 0.10), 20)` for crew >= 10
- [ ] Deadheads do not add extra supply use in v1.

Verification:

- [ ] Unit tests for locality constraints and relocation gating.
- [ ] Unit tests for per-origin FIFO queue behavior.
- [ ] Unit tests for deadhead capacity limits at sample crew sizes.

## Phase 6 - Research Dashboard (First UI Slice)

- [ ] Build grouped table with sections:
  - [ ] Active
  - [ ] Paused
  - [ ] Queued
- [ ] Default sort: nearest completion date.
- [ ] Provide manual sorting controls.
- [ ] Required columns:
  - [ ] Project
  - [ ] Lead Scientist
  - [ ] Progress %
  - [ ] ETA (completion date)
  - [ ] Allocated Labs
- [ ] Keep paused projects visible in same table structure.
- [ ] Do not show explicit "bottleneck reason" labels.

Verification:

- [ ] UI checks for grouping/sorting stability across updates.
- [ ] UI checks for immediate ETA refresh after edits.
- [ ] UI checks for pause/queue visibility and consistency.

## Phase 7 - Logs and Lightweight Narrative Support

- [ ] Implement append-only categorized game log writer.
- [ ] On research completion, write event with:
  - [ ] Tech
  - [ ] Scientist
  - [ ] Completion date
  - [ ] Colony/location
- [ ] Add filtering/search in log viewer.
- [ ] Add scientist lightweight career history: completed projects only.

Verification:

- [ ] Unit tests for append-only behavior.
- [ ] Unit tests for required research completion payload fields.
- [ ] UI checks for deterministic category filtering and search.

## Phase 8 - Colony Phase 0 Integration

- [ ] Wire research gating into Phase 0 colony capabilities.
- [ ] Confirm minimal gating loop supports economy/expansion flow.
- [ ] Validate no enemy/faction assumptions are introduced.

Verification:

- [ ] Playtest: start -> first gated unlock -> actionable colony impact.
- [ ] Playtest: multiple parallel projects with meaningful staffing tradeoffs.

## Phase 9 - Production Chain Primitives (Post-Research Dashboard)

- [ ] Add non-spatial production chain entities (I/O only).
- [ ] Add detached chain blueprint save/load and instantiate.
- [ ] Validate construction prerequisites from inventory/warehouse.
- [ ] Defer blueprint retrofit propagation.

Verification:

- [ ] Playtest: create chain, save blueprint, instantiate copy elsewhere.
- [ ] Playtest: missing prerequisite correctly blocks instantiation.

## Definition of Done for This Roadmap Slice

- [ ] Research runs with colony-local constraints and scientist/lab/admin rules.
- [ ] Research UI supports grouped operations and manual queue management.
- [ ] Transfer and deadhead rules function with per-origin FIFO queues.
- [ ] Logging/history supports mechanics-first narrative traceability.
- [ ] Player can make meaningful economy + research tradeoffs without enemies.

## Deferred by Design (Do Not Pull Into V1 Without New Decision)

- [ ] Rival factions and conflict systems.
- [ ] Specialized/typed labs.
- [ ] Scientist salary/upkeep economics.
- [ ] Blueprint retrofitting/propagation.
- [ ] Explicit bottleneck reason explanations in UI.
