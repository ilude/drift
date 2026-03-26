# Aurora 4X Exploration → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

### Geological Survey
- Ships with geological survey sensors generate survey points continuously (1 point/hour base, up to 5 with advanced sensors)
- Each body requires points based on size; time = required points ÷ points per day
- **Mineral discovery**: ~5% of bodies contain deposits with quantity (100s to millions of tons) and accessibility (0.1–1.0)
- Accessibility decreases over time as deposits deplete
- Sensor tech affects survey duration only — not discovery probability
- Three-phase generation: body potential → mineral type → accessibility assessment

### Gravitational Survey
- Discovers **jump points** for inter-system travel (fixed positions, 2–6 per system typical)
- Uses gravitational sensors, distinct from geological sensors
- Can also discover **Ancient Constructs** (precursor structures granting research bonuses)

### Xenoarchaeology
- Alien ruins spawn on eligible terrestrial bodies (200K–360K temp, 0.4G+ gravity)
- Default 20% chance per qualifying body
- Excavation via ground formations; yields individual technologies, alien installations, research points
- Artifacts generated (4–200 per successful recovery), depletable from reserves

### Survey Mechanics
- Survey prioritization: home system → habitable worlds → inner system → asteroid belts
- Fleet organization: 2–4 geological survey ships per system group + tanker support
- High-accessibility deposits (asteroids, comets) immediately valuable; deep deposits require advanced sensors

---

## Drift Design Constraints

- Survey system already exists: multi-level surveys (1–3), `surveyLevel` per body, deposits revealed by level with `minSurveyLevel` tied to accessibility
- `selectNextSurveyTarget()` picks nearest unsurveyed body (`surveyLevel === 0`)
- `surveyMultiplier` hardness setting already exists
- 27 resource types across 5 categories; sub-typed pools by body type (gas giant, ice moon, C-type asteroid, etc.)
- No jump points yet — inter-system travel not implemented
- Design goal: survey results → colony placement decisions → research capacity → tech progression chain

---

## Drift Implementation Sketches

### 1. Multi-Level Deep Survey (enhancement to existing)

**Current state:** `surveyLevel: 0–3`, deposits only appear at level 1+, `minSurveyLevel` already gates by accessibility.

**What to add:**
- **Level 2 resurvey** (mid-game): reveals deep deposits (minSurveyLevel = 2, accessibility 0.2–0.5)
  - Requires returning to already-level-1 bodies
  - Duration: 20–50% of initial survey (incremental deep scan)
  - Gated behind "Advanced Sensors" research tech
- **Level 3 resurvey** (late-game): extreme deposits (minSurveyLevel = 3, accessibility < 0.2)
  - Only useful for rare umbral resources (ortheum, tessarene, istrium)
  - Requires "Exogeology" research

**Decision chain:** Level 1 → basic colony supply (iron, water, silicon). Level 2 → advanced materials (rare-earth, uranium). Level 3 → endgame umbral resources.

**Implementation path:**
1. Add `lastSurveyedDay` to `SurveyState`
2. Extend `generateDeposits()` to split output by accessibility tier
3. Add research gate before `selectNextSurveyTarget()` bumps past level 1
4. In `completeSurvey()`: check researchLevel and set `surveyLevel` accordingly

---

### 2. Survey Prioritization Scoring (new)

**Current state:** `selectNextSurveyTarget()` picks nearest unsurveyed body only.

**What to add:** Body scoring in `collectBodyCandidates()`:
- Boost habitable worlds (+50% score) — colony placement value
- Boost moons of already-surveyed planets (+25%) — incremental cost is low
- Penalize comets/centaurs initially (low accessibility, far travel)

**Also add:** Special discovery chance (5–10% during any survey):
- Rare "sealed vault" deposits with 2–3× normal quantity but `minSurveyLevel = 3`
- One-time tech bonus notification when found (not a separate UI — folded into survey completion)
- `isAnomaly: boolean` flag on `ResourceDeposit` for UI highlighting in resource viewer

---

### 3. Survey Sensor Tech Tiers (via research)

**What Aurora does:** Sensor tech upgrades improve survey speed. Drift should follow this without the per-ship sensor slot complexity.

**Approach:**
- 4 tiers via research tree: 1× → 1.5× → 2× → 3× survey speed
- Do NOT differentiate discovery probability — keep that uniform (Aurora mistake to complicate)
- Computed as `getSurveySpeedMultiplier()` reading from `state.researchedTechs`
- Modify `getSurveyDuration(mass, ship)` to divide by speed multiplier

**Chains to:** Research (labs → sensor tech); colony decisions (tech investment vs. construction)

---

### 4. Gravitational Survey / Jump Points (future, not yet)

Hold for Phase 2 when inter-system travel is implemented. Gravitational survey mechanics (discovering jump points) would use the existing `selectNextSurveyTarget()` infrastructure with a new body category.

---

### 5. Xenoarchaeology → Anomaly Discoveries (simplified)

Don't create a separate archaeology system. Fold into existing survey completion:
- 3–5% chance per completed survey to generate a one-time "artifact cache" notification
- Grants tech bonus (equivalent to 500–2000 RP toward a random current research)
- Logged as a game event; no separate management UI

---

## Recommended Next Steps (prioritized)

1. **Level-2 deep survey** (2–3 days) — gated by research; reveals rare-earth/uranium; strongest decision chain impact
2. **Body scoring improvements to `selectNextSurveyTarget()`** (1 day) — guides survey ships toward inner system and habitable worlds first
3. **Survey sensor tech tiers** (1–2 days) — adds research investment incentive; straightforward `getSurveySpeedMultiplier()` hook
4. **Special discovery anomalies** (1–2 days) — rewards exploration; makes early finds exciting without new UI
5. **Level-3 deep survey gate** (1–2 days, post level-2) — endgame sink; unlocks final umbral resources
6. **Survey UI polish** (1–2 days) — show `minSurveyLevel` in resource viewer; "Needs Level 2" indicator on locked deposits

---

## Anti-patterns to Avoid

- **Per-deposit accessibility modifiers** — `minSurveyLevel` as the gate is enough; don't add per-deposit mining efficiency curves
- **Gravitational surveys before jump points** — don't build the mechanic before the feature it serves exists
- **Xenoarchaeology as a separate system** — fold artifact discoveries into survey completion notifications
- **Ground-based survey crews** — no landing mechanics in Drift; pure orbital surveys only
- **Forced survey ship specialization** — any ship can survey; don't require dedicated survey-only vessels
- **Survey point accumulation UI** — Aurora's survey point bar is visual noise; Drift's "X days remaining" is cleaner
- **Sensor stacking** — multiple sensors on one ship don't stack; use research tier multipliers only
- **Gating level-2 too early** — should unlock only after ~5 planets surveyed, not at game start
- **Mandatory deep surveys** — make level-2/3 optional for players who want to min-max resources, not required for basic play
