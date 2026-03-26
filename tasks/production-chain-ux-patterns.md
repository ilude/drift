# Production Chain UX — Making Chains Legible Without Flow Diagrams

## The Core UX Challenge

Production chains in Drift are sequential dependencies: resources extracted from bodies → processed at colonies → assembled into ships. Without a full node-graph visualization tool, players face two failure modes:

1. **Opacity:** "Why aren't we building ships?" requires tracing through a chain the UI doesn't expose.
2. **Paralysis:** Without visual feedback, players overproduce as insurance, hoarding resources they can't reason about.

**Core insight:** Legibility requires showing dependency flow through *existing UI surfaces* (tables, panels, resource matrices) rather than building new flow diagram tools. Add production-awareness to what's already there.

---

## Legibility Patterns (Without Node Graphs)

### 1. Production Status Section in Colony Panel

**Add to colony panel** after the existing construction/research sections:

```
Production Status
├─ Shipyard (Corvette): 45% complete [8 days] — 🔴 BLOCKED (Nav Computer)
├─ Hull Plates (Factory A): 4/day [85% capacity]
├─ Reactors (Factory B): 1/day [40% capacity] ⚠ INPUT STARVED
└─ Stockpile: 8,500 / 10,000 MSP (85% full) ⚠ Full in ~3 days
```

Status icons:
- `✓ READY` — all inputs available, running normally
- `⚠ LOW INPUTS` — < 50% of next batch's components staged
- `🔴 BLOCKED` — missing required component; production halted
- `⏳ QUEUED` — awaiting research, prior project, or worker allocation

**Implementation:** Add `renderProductionStatus(entry)` in `colony-panel.ts` that calls `getProductionChainSummary(colony)` from `production-graph.ts`.

---

### 2. Resource Viewer Matrix Extension

**Current state:** Body × Resource matrix with categories and sorting.

**Addition:** When a resource column is clicked, show a **Consumption Flow** panel below the table:

```
Iron Ore (selected)
├─ Surveyed: 450t on 3 bodies
├─ Being mined: 15t/day (Colony A)
├─ Consumed by: Hull Plates Factory (Colony A) — 12t/day, 80% utilized
├─ Stockpiled: 120t at Colony A
└─ Status: BALANCED (+3t/day surplus)
```

If consumption exceeds production: `"DEFICIT: +40t/day demand, -10t/day production"` in red.

**Implementation:** Extend postMessage channel between main window and resource-viewer popout. Main sends `{ type: "resource-flow", flows: ConsumptionFlow[] }` when popout requests a specific resource.

---

### 3. Notification Types for Production Events

**Add to `core/notifications.ts`:**

```typescript
type NotificationType =
  | ... // existing types
  | "production-blocked"    // chain halted, requires attention
  | "resource-deficit"      // consumption exceeds supply
  | "production-idle"       // facility at 0% utilization
  | "production-milestone"; // batch completed
```

**Pause config defaults:**
- `production-blocked`: pause = true (high signal, requires action)
- `resource-deficit`: pause = true (high signal, requires action)
- `production-idle`: pause = false (low signal, informational)
- `production-milestone`: pause = false (informational)

**Coalescing:** Use 5-second coalesce window for production events (vs. 2-second for existing events). Multiple blocked projects in same colony coalesce: "3 projects blocked at Colony Alpha."

---

### 4. Inspection Slide-Out in Colony Panel

**Pattern:** Click a blocked/bottlenecked item → drill down shows full dependency chain.

```
Shipyard: Corvette-class [BLOCKED]
├─ Required Inputs
│  ├─ Hull Plates: 8 / 10 (2 more needed)
│  │  └─ Hull Plates Factory (Colony A) — RUNNING at 85%
│  │      Input: Iron Ore (OK)
│  ├─ Reactor Core: 1 / 5 (4 more needed)
│  │  └─ Reactor Facility (Colony B) — RUNNING at 40% ⚠ INPUT STARVED
│  │      Missing: Rare Metals (0 stockpiled, no mine producing)
│  └─ Nav Computer: 0 / 1 (BLOCKED)
│      └─ Not produced — requires research "Advanced Nav"
└─ Quick Actions
   ├─ [→ Colony B] (inspect Reactor facility)
   └─ [→ Queue Research] (Advanced Nav)
```

**Implementation:** New tab in colony panel: `Overview / Construction / Research / [selected project details]`. Avoid modal dialogs — inline drill-down keeps context.

---

## Progressive Disclosure

### Default (Summary Only)

```
Colony Overview
├─ Population: 12,500
├─ Workforce: 450 / 500 (90%)
├─ Active Production: 3 lines (2 running, 1 blocked)
└─ Next Milestone: Corvette completion (8 days)
```

### Intermediate (On-Demand Detail)

Click "1 blocked" → expands to show which facility is blocked and why.

### Advanced (Constraint Analysis Tab — Power Users)

```
Constraint Analysis
├─ Worker Bottleneck: 450 / 500 (90%) → +50 workers = +X% output
├─ Facility Utilization:
│  ├─ Hull Plates Factory: 85% (near-optimal)
│  ├─ Reactor Facility: 40% (input starved — needs Rare Metals mine)
│  └─ Ore Refinery: 100% (bottleneck — add another to increase output)
├─ Storage: 8,500 / 10,000 (85% full — 3 days until full)
└─ Recommendations:
   ├─ Survey for Rare Metals deposits (unlock Reactor throughput)
   └─ Build second Ore Refinery (current one is at capacity)
```

This tab is only shown when the player opens the colony panel's advanced section — not the default view.

---

## Actionable Notifications

Every production notification should carry an implicit action:

```
🔴 Production Blocked: Nav Computer [INSPECT →]
   → Opens colony panel, highlights Shipyard project, shows missing component

🟡 Resource Deficit: Iron Ore (−40t/day) [OPEN RESOURCE VIEWER →]
   → Opens resource viewer filtered to Iron Ore, shows consumption

✓ Corvette Hull Complete (4 units) [QUEUE NEXT BATCH →]
   → Opens construction queue at that colony

⚠ Storage Full: Colony Beta (85%) [EXPORT NOW →]
   → Quick-ship dialog showing transport options
```

**TypeScript implementation:**
```typescript
interface GameNotification {
  id: number;
  type: NotificationType;
  message: string;
  bodyName?: string;
  action?: {
    type: "inspect-colony" | "open-resource-viewer" | "queue-project";
    target?: string;
    filter?: string;
  };
}
```

---

## Node Graph UI — If/When Implemented

When Drift eventually adds a visual production graph editor, avoid these patterns:

**Avoid:**
- SVG-based node graphs (difficult event handling, poor performance at 50+ nodes)
- Drag-to-connect that requires pixel-perfect accuracy (hostile on trackpads)
- Modal node editors (break flow — use inline property panels instead)
- Showing all connections at once on a dense graph (spaghetti)

**Prefer:**
- Canvas-based rendering (2D canvas, not WebGL — sufficient for graph sizes expected)
- Click-to-select + click-to-connect workflow (vs. drag — more forgiving)
- Hierarchical layout (top-to-bottom flow, mines at top, outputs at bottom)
- Color-coded edges: green = healthy flow, yellow = below capacity, red = blocked
- Collapsed node groups (mine cluster = single node until expanded)

**For Drift's Three.js + vanilla DOM stack:** A canvas element inside the colony panel popout is the right approach. The resource-viewer popout already demonstrates this pattern (`window.open()`, postMessage communication).

---

## Concrete Drift Implementation Plan

### Phase 1: Make Chains Legible (No New Paradigm)

1. **Add production status to colony panel** — `renderProductionStatus()` section showing running/blocked facilities with status icons
2. **Add `production-blocked` and `resource-deficit` notification types** — with pause-on-block enabled by default
3. **Resource viewer consumption metadata** — extend postMessage to send consumption flow when a resource column is selected

**Estimated scope:** ~200 lines across `colony-panel.ts`, `notifications.ts`, and `resource-viewer.ts`. No new files. No new architectural patterns.

### Phase 2: Enable Debugging

4. **Inspection drill-down in colony panel** — per-project component requirements with upstream status
5. **Quick-action buttons in notifications** — navigate to relevant colony/resource on click

### Phase 3: Power User Analytics (Optional)

6. **Constraint analysis tab** — worker bottleneck, facility utilization, storage forecast, recommendations
7. **Consumption flow in resource viewer** — full postMessage protocol for multi-colony consumption tracking

---

## Anti-patterns to Avoid

- **Building a node graph first** — Legibility wins from inline panels are faster and more accessible. Build the graph editor only after the simpler surfaces prove insufficient.
- **Modal dialogs for production detail** — Breaks context. Use inline drill-down.
- **Requiring precise drag operations** — Browser-based, trackpad users exist. Click-to-select is safer.
- **Notifications without context** — "Production blocked" with no clickable action frustrates players. Always include a navigation target.
- **Showing all constraints at once** — Default view should be summary only. Progressive disclosure reveals detail on demand.
- **Separate production management screen** — Drift's colony panel is already the right home. Adding a third window creates navigation overhead.
