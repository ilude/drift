# Aurora 4X Commanders → Drift Implementation Notes

**Primary source:** https://erikevenson.github.io/aurora-manual/

## What Aurora Does

Aurora's commander system is a deep officer-corps simulation. Officers are generated at Naval Academies (10/year, quality-vs-quantity setting 1–5). Seven specialization types: Naval, Ground, Admin, Scientist, Diplomatic, Explorer, Specialist. Officers have 50+ skills across categories: Ship Handling, Crew Training, Carrier Operations, Energy Weapons, Mining, Production, Survey, etc. Skills improve from time-in-position, combat, mission completion. Ranks progress from Lieutenant Commander to Fleet Admiral; ships require minimum ranks based on installed components. Automatic awards for 60+ achievement conditions. Officers retire after 10+ years at 20%/year chance; assignment attrition doubles this. Crew Grade (0–1000 points) provides up to 21.6% combat/operational bonus based on training.

---

## Drift Design Constraints

- **Commander already exists:** `{ judgment: 0.0–1.0, experience: number }` — three overrides in `commanderDecide()`: preemptive servicing, hold-for-tanker, defer-maintenance
- **Learning from failure:** malfunctions and emergency-returns bump judgment (diminishing returns, cap 0.9)
- **Crew system:** `ShipCrew { count, morale, lastShoreLeave, deploymentLimit }`
- **Academy installation:** `ColonyInstallations.academy` exists but produces nothing
- **Existing `crew-career-system.md`:** Outlines phased expansion
- **North star:** Commanders create emergent narrative through minimal mechanics (Tynan Sylvester's apophenia principle)

---

## Drift Implementation Sketches

### Phase 0: Officer Identity (Foundation)

**What's missing:** Ships have anonymous commanders. Named officers create stories.

**Add `Officer` interface:**
```typescript
interface Officer {
  id: string;
  name: string;          // e.g., "Commander Sarah Chen"
  rank: OfficerRank;
  age: number;           // sim-years
  assignedShipName: string | null;
  judgment: number;      // 0.0–1.0 (migrate from existing Commander.judgment)
  experience: number;    // migrate from existing Commander.experience
  skills: OfficerSkills;
  medals: OfficerMedal[];
  generatedDay: number;  // when the officer was created
}

type OfficerRank = "cadet" | "ensign" | "lieutenant" | "commander" | "captain" | "rear-admiral";

interface OfficerSkills {
  navigation: number;    // 0.0–1.0 — grows from completed transfers
  survey: number;        // 0.0–1.0 — grows from completed surveys
  engineering: number;   // 0.0–1.0 — grows from malfunctions survived
  leadership: number;    // 0.0–1.0 — grows from shore leaves managed well
}
```

Add `officers: Map<string, Officer>` to AppState. Ship's `commander` field references an Officer ID.

**Why Phase 0:** Named entities are prerequisite for emergent narrative. "Green Ensign Chen" is memorable. "judgment: 0.3" is not.

---

### Phase 1: Academy Training

**What to add:** Academy produces cadets at a rate proportional to installation count.

```typescript
// Rate: academy count × 0.5 cadets/day ≈ 15 cadets/month at 1 academy
function tickAcademyProduction(colony: ColonyState, dt: number): void {
  const rate = colony.installations.academy * 0.5;
  colony.cadetProgress = (colony.cadetProgress ?? 0) + rate * dt;

  while (colony.cadetProgress >= 1) {
    colony.cadetProgress -= 1;
    const cadet = generateOfficer("cadet", colony.bodyName);
    state.officers.set(cadet.id, cadet);
  }
}

// Graduation: cadet trains for 30 days before becoming Ensign
function tickCadetTraining(officer: Officer, dt: number): void {
  if (officer.rank !== "cadet") return;
  officer.age += dt / 365;
  const daysTraining = (state.simTime.days - officer.generatedDay);
  if (daysTraining >= 30) {
    officer.rank = "ensign";
    autoAssignOfficerToShip(officer);
    addNotification("info", `Ensign ${officer.name} graduated from ${officer.colony}`, officer.colony);
  }
}
```

Auto-assign ensigns to uncrewed ships in creation order.

---

### Phase 2: Rank Progression & Skill Growth

**Promotion gates:**

| From | To | Requirement |
|------|----|----|
| Ensign | Lieutenant | 20 actions + judgment ≥ 0.4 |
| Lieutenant | Commander | 50 actions + judgment ≥ 0.5 + 1 malfunction survived |
| Commander | Captain | 100 actions + judgment ≥ 0.7 + no ship losses |
| Captain | Rear Admiral | 200 actions + judgment ≥ 0.8 (rare) |

**Skill growth (passive, on action completion):**
```typescript
function tickSkillGrowth(officer: Officer, completedAction: string): void {
  switch (completedAction) {
    case "transfer-complete":
      officer.skills.navigation = Math.min(1, officer.skills.navigation + 0.01);
      break;
    case "survey-complete":
      officer.skills.survey = Math.min(1, officer.skills.survey + 0.01);
      break;
    case "malfunction-survived":
      officer.skills.engineering = Math.min(1, officer.skills.engineering + 0.02);
      break;
    case "shore-leave-morale-high":  // morale ≥ 90% at end of shore leave
      officer.skills.leadership = Math.min(1, officer.skills.leadership + 0.01);
      break;
  }
}
```

**Skill effects on ship stats:**
- `navigation`: `fuelRequired *= (1 - navigation * 0.05)` — up to 5% fuel savings
- `survey`: `surveyDuration *= (1 - survey * 0.10)` — up to 10% faster surveys
- `engineering`: `malfunctionDamage *= (1 - engineering * 0.05)` — up to 5% damage reduction
- `leadership`: `moraleDecayRate *= (1 - leadership * 0.10)` — up to 10% slower morale decay

---

### Phase 3: Medals & Recognition

**Automatic awards:**

| Medal | Condition |
|-------|-----------|
| "Explorer" | 10 consecutive surveys completed |
| "Survivor" | Survived 3+ malfunctions |
| "Safe Hands" | Zero malfunctions over 50 actions |
| "Long Voyage" | Deployed > 200 sim-days without shore leave |
| "Homecoming" | Returned home after critical fuel situation (< 5% fuel) |
| "Veteran" | 100+ actions completed |

```typescript
interface OfficerMedal {
  id: string;
  name: string;
  awardedDay: number;
  bodyName?: string;    // where it was earned
}
```

Medals are visible in the officer detail card. No gameplay effect beyond narrative flavor and promotion score.

---

### Phase 4: Shore Leave & Retirement

**Shore leave:**
- If `currentDay - officer.lastShoreLeave > officer.deploymentLimit`, officer gains "Shore Leave Due" status
- Ships with officers due for shore leave show UI warning; cannot depart colony
- Shore leave restores morale, resets `lastShoreLeave`, costs supplies (rate modifier applies)

**Retirement:**
- Minimum age: 55 sim-years
- Age 55–65: 5% annual retirement chance
- Age 65+: 20% annual retirement chance
- Unassigned officers: 2× retirement rate
- Retiring officers removed from roster (kept in "retired" list for flavor log)

---

### Phase 5: Academy Commandant (Optional)

Assign a high-judgment officer as academy commandant. New cadets start with `+0.1 judgment * commandant.judgment`. Creates a feedback loop: veteran officers train the next generation.

---

## How Skills Connect to Existing Systems

| Skill | Connected System | Formula |
|-------|-----------------|---------|
| navigation | Transfer fuel cost | `fuelRequired *= (1 - nav * 0.05)` |
| survey | Survey duration | `surveyDuration *= (1 - survey * 0.10)` |
| engineering | Malfunction damage | `actualDamage = base * (1 - eng * 0.05)` |
| leadership | Morale decay rate | `decayRate *= (1 - lead * 0.10)` |
| judgment (existing) | Commander overrides | Existing — preemptive service, defer maintenance |

---

## Recommended Next Steps (Prioritized)

1. **Phase 0: Officer Identity** — Add Officer interface; create officer roster in state; display name in ship detail panel; persist to save (SAVE_VERSION bump)
2. **Phase 1: Academy Training** — Cadet production in academy tick; graduation at 30 days; auto-assign ensigns
3. **Phase 2: Rank & Skills** — Promotion gates based on actions + judgment; passive skill growth from actions; wire skills to rate modifiers
4. **Phase 3: Medals** — Auto-award on achievement conditions; display in officer card
5. **Phase 4: Shore Leave & Retirement** — Mandatory leave system; age-based retirement; block departures with UI warning
6. **Phase 5: Commandant Bonus** — Veteran officer → new cadet quality improvement

---

## Anti-patterns to Avoid

- **Executive Officers as separate entities** — creates "assign XO, train XO, promote XO" micromanagement. Use captain skills directly.
- **Ground force officers** — no planetary combat in current scope.
- **50+ skills** — Cap at 5 (judgment, navigation, survey, engineering, leadership). Others are future phases.
- **Retirement surprise** — Always show "Days Until Retirement" in officer card. Lock departure with warning.
- **Training complexity from day 1** — Phase 1 academy is simple rate × count. No quality toggles until Phase 5.
- **Hard judgment ceiling too easy** — After 0.6, skill growth should outpace judgment growth. Prevents "solved" officers.
- **Aurora's dual retirement clocks** — Drift's unified `age` field with shore leave is enough. No "deployment clock + maintenance clock" separation.
