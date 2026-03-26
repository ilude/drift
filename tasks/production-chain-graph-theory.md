# Production Chain — Graph Theory & Implementation Model

## Overview

This document specifies a directed acyclic graph (DAG) system for modeling resource production chains in Drift. Nodes represent production facilities (mines, refineries, factories, labs); edges represent material flows. The system integrates with existing `ColonyState`, `ColonyQualities`, and the rate modifier pattern to compute actual throughput rates each simulation day.

---

## 1. Formal Model

A production chain is a directed graph where:
- **Nodes** = production facilities with time-based processing
- **Edges** = resource flows with rates (kg/day, units/day)
- **Flow constraints** = node input capacities, output rates, quality modifiers

**Directed but not strictly acyclic:** Some chains contain intentional loops (e.g., refinery → slag → crusher → refinery). The tick algorithm handles cycles via convergence iteration.

---

## 2. Data Structures

### Production Node

```typescript
interface ProductionNode {
  id: string;
  facilityType: "mine" | "refinery" | "factory" | "lab";
  colonyBodyName: string;
  installationId?: ColonyInstallationId;

  inputs: ResourceInput[];
  outputs: ResourceOutput[];

  baseProcessingRate: number;   // units/day at full staffing
  efficiency: number;           // [0, 1] quality multiplier

  // Per-tick state (mutated each tick)
  inputBuffers: Record<string, number>;
  outputBuffers: Record<string, number>;
  lastTickInputs: Record<string, number>;
  lastTickOutputs: Record<string, number>;
  isDirty: boolean;

  // Cached effective rate (invalidated when colony state changes)
  cachedEffectiveRate: number;
  cachedEffectiveRateDay: number;
}

interface ResourceInput {
  resourceId: string;
  ratePerUnit: number;     // kg of this input consumed per unit output
  optional?: boolean;      // if true, absence doesn't halt production
}

interface ResourceOutput {
  resourceId: string;
  ratePerUnit: number;     // kg of this output produced per unit
}
```

### Production Edge

```typescript
interface ProductionEdge {
  id: string;
  sourceNodeId: string;
  sinkNodeId: string;
  resourceId: string;
  maxFlowPerDay: number;   // transport capacity cap
  flowThisDay: number;     // actual flow (mutated each tick)
}
```

### Production Graph (Colony-Scoped)

```typescript
interface ProductionGraph {
  colonyBodyName: string;
  nodes: Map<string, ProductionNode>;
  edges: Map<string, ProductionEdge>;
  dirtyNodes: Set<string>;
  graphEpochDay: number;
}
```

### Integration with ColonyState

```typescript
// Extend ColonyState in types.ts:
interface ColonyState {
  // ... existing fields ...
  productionGraph?: ProductionGraph;
  productionGraphEnabled?: boolean;
}
```

---

## 3. Quality Modifiers (Matches Existing Rate Pattern)

Each node's effective rate uses the same quality × hardness pattern as the rest of Drift:

```typescript
// effectiveRate = baseRate * quality / hardnessMultiplier
function computeEffectiveRate(node: ProductionNode, colony: ColonyState): number {
  const today = Math.floor(state.simTime.days);
  if (node.cachedEffectiveRateDay === today) return node.cachedEffectiveRate;

  const qualities = computeColonyQualities(colony);
  let quality: number;
  switch (node.facilityType) {
    case "mine":    quality = qualities.mining; break;
    case "refinery":
    case "lab":     quality = qualities.research; break;
    case "factory": quality = qualities.construction; break;
  }

  const rate = node.baseProcessingRate * node.efficiency * quality;
  node.cachedEffectiveRate = rate;
  node.cachedEffectiveRateDay = today;
  return rate;
}
```

---

## 4. Topological Sort with Cycle Tolerance

```typescript
function topologicalSort(graph: ProductionGraph): string[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const order: string[] = [];

  function visit(nodeId: string, path: Set<string>): void {
    if (visiting.has(nodeId) || visited.has(nodeId)) return;
    visiting.add(nodeId);
    path.add(nodeId);

    for (const edge of graph.edges.values()) {
      if (edge.sourceNodeId === nodeId && !path.has(edge.sinkNodeId)) {
        visit(edge.sinkNodeId, new Set(path));
      }
    }

    visiting.delete(nodeId);
    visited.add(nodeId);
    order.push(nodeId);
  }

  for (const nodeId of graph.nodes.keys()) {
    if (!visited.has(nodeId)) visit(nodeId, new Set());
  }

  return order;
}
```

Cycle handling: back edges (detected via `path.has()`) are skipped. The convergence loop below handles cycle resolution.

---

## 5. Daily Tick Algorithm

```typescript
export function tickProductionGraph(graph: ProductionGraph, colony: ColonyState): void {
  const order = topologicalSort(graph);

  // Iterate up to 5 times to let cycles converge
  for (let iteration = 0; iteration < 5; iteration++) {
    let anyDirty = false;
    for (const nodeId of order) {
      const node = graph.nodes.get(nodeId)!;
      if (!graph.dirtyNodes.has(nodeId) && iteration > 0) continue;
      tickProductionNode(node, graph, colony);
      if (node.isDirty) anyDirty = true;
    }
    if (!anyDirty) break;
  }

  graph.dirtyNodes.clear();
  graph.graphEpochDay = Math.floor(state.simTime.days);
}

function tickProductionNode(
  node: ProductionNode,
  graph: ProductionGraph,
  colony: ColonyState
): void {
  const inputCheck = checkInputAvailability(node, colony);
  if (!inputCheck.allRequiredAvailable) {
    node.lastTickInputs = {};
    node.lastTickOutputs = {};
    return;
  }

  const effectiveRate = computeEffectiveRate(node, colony);

  // Consume inputs from colony stockpile
  const consumed: Record<string, number> = {};
  for (const input of node.inputs) {
    const needed = input.ratePerUnit * effectiveRate;
    const available = colony.stockpile.resources[input.resourceId] ?? 0;
    const toConsume = Math.min(needed, available);
    if (!input.optional && toConsume < needed * 0.95) return;
    consumed[input.resourceId] = toConsume;
    colony.stockpile.resources[input.resourceId] =
      (colony.stockpile.resources[input.resourceId] ?? 0) - toConsume;
  }

  // Produce outputs
  const produced: Record<string, number> = {};
  for (const output of node.outputs) {
    const amount = output.ratePerUnit * effectiveRate;
    produced[output.resourceId] = amount;
    const current = colony.stockpile.resources[output.resourceId] ?? 0;
    colony.stockpile.resources[output.resourceId] =
      Math.min(current + amount, getColonyMaxStorage(colony));
  }

  node.lastTickInputs = consumed;
  node.lastTickOutputs = produced;
  node.isDirty = false;
}
```

---

## 6. Bottleneck Detection

```typescript
interface BottleneckInfo {
  nodeId: string;
  facilityType: string;
  reason: "insufficient-input" | "low-quality" | "storage-full" | "none";
  primaryLimitingInput?: string;
  utilization: number;      // [0, 1]
  potentialIncrease: number; // fractional output gain if constraint removed
}

export function identifyBottlenecks(
  graph: ProductionGraph,
  colony: ColonyState
): BottleneckInfo[] {
  return Array.from(graph.nodes.values()).map(node => {
    const inputCheck = checkInputAvailability(node, colony);
    const effectiveRate = computeEffectiveRate(node, colony);
    const utilization = effectiveRate / node.baseProcessingRate;

    if (!inputCheck.allRequiredAvailable) {
      const limitingInput = Object.entries(inputCheck.shortfalls)
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      return {
        nodeId: node.id, facilityType: node.facilityType,
        reason: "insufficient-input" as const,
        primaryLimitingInput: limitingInput,
        utilization, potentialIncrease: 1 - utilization,
      };
    }
    if (node.efficiency < 0.8) {
      return {
        nodeId: node.id, facilityType: node.facilityType,
        reason: "low-quality" as const,
        utilization, potentialIncrease: (0.8 - node.efficiency),
      };
    }
    return {
      nodeId: node.id, facilityType: node.facilityType,
      reason: "none" as const, utilization, potentialIncrease: 0,
    };
  }).filter(b => b.reason !== "none");
}
```

---

## 7. Dirty-Flag Invalidation (O(n) typical case)

Without dirty flags, every tick is O(V × k). With dirty flags, clean nodes are skipped — O(1) per clean node.

```typescript
function markNodeDirty(graph: ProductionGraph, nodeId: string): void {
  graph.dirtyNodes.add(nodeId);
  // Cascade to downstream dependents
  for (const edge of graph.edges.values()) {
    if (edge.sourceNodeId === nodeId) {
      graph.dirtyNodes.add(edge.sinkNodeId);
    }
  }
}

// Call these in colonies.ts when relevant state changes:
export function invalidateProductionCaches(colony: ColonyState): void {
  if (!colony.productionGraph) return;
  for (const node of colony.productionGraph.nodes.values()) {
    node.cachedEffectiveRateDay = -1;
  }
  for (const nodeId of colony.productionGraph.nodes.keys()) {
    markNodeDirty(colony.productionGraph, nodeId);
  }
}
// Call on: construction completion, tech research, staffing changes
```

---

## 8. Complexity Analysis

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Topological sort | O(V + E) | V = nodes, E = edges |
| Single tick (no cycles) | O(V × k) | k = avg inputs per node |
| Convergence (cycles) | O(V² + VE) worst | Usually converges in 2–3 iterations |
| Dirty-flag tick | ~O(V) | Only dirty subgraph recomputed |
| Bottleneck scan | O(V × k) | Linear pass over all nodes |

For typical colonies (10–50 nodes), ticking takes < 1ms. For 100+ nodes, implement colony-scoped subgraphs.

---

## 9. Example: Iron → Steel → Armor Plate

```typescript
// Setup
const nodes: ProductionNode[] = [
  {
    id: "iron-mine", facilityType: "mine",
    baseProcessingRate: 100,   // 100 units/day
    inputs: [],
    outputs: [{ resourceId: "iron", ratePerUnit: 1 }],
  },
  {
    id: "smelter", facilityType: "refinery",
    baseProcessingRate: 80,
    inputs: [{ resourceId: "iron", ratePerUnit: 1.2 }],   // needs 96 iron/day
    outputs: [{ resourceId: "steel", ratePerUnit: 1 }],
  },
  {
    id: "forge", facilityType: "factory",
    baseProcessingRate: 60,
    inputs: [
      { resourceId: "steel", ratePerUnit: 1.5 },          // needs 90 steel/day
      { resourceId: "carbon", ratePerUnit: 0.3, optional: true },
    ],
    outputs: [{ resourceId: "armor-plate", ratePerUnit: 1 }],
  },
];

// Daily tick result (all at 100% efficiency, quality 1.0):
// Iron Mine:  produces 100 iron/day
// Smelter:    consumes 96 iron/day → produces ~80 steel/day
// Forge:      needs 90 steel/day but has 80 → runs at 80/90 = 88.9% capacity
//             bottleneck: "insufficient-input: steel"
// Recommendation: add another smelter OR improve smelter efficiency
```

---

## 10. Integration Points

- **New file:** `src/core/production-graph.ts`
- **Tick integration:** Call `tickProductionGraph()` in the colony tick loop when `productionGraphEnabled`
- **Invalidation hooks:** `completeConstructionProject()`, `completeResearchProject()` → call `invalidateProductionCaches()`
- **UI:** `getProductionChainSummary()` → feed into colony-panel bottleneck display
- **Save/load:** Serialize node topology and edges in `SavedStateData.colonies[]`; re-initialize runtime state (buffers, dirty flags) on load

---

## 11. Phased Rollout

- **Phase 1 (Read-only UI):** Display `getProductionChainSummary()` as bottleneck panel in colony overview — read-only, no player editing
- **Phase 2 (Design mode):** Let player manually define chains; preview flows without real tick effects
- **Phase 3 (Active chains):** Enable in-game ticking; production graph outputs feed colony stockpiles
