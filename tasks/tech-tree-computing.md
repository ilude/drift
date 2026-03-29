# Tech Tree: Computing & AI (Sakarov + Okafor Heritage)

> Status: Draft design (2026-03-28). Needs Aurora-scale expansion. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

Computing underlies everything — fire control, navigation, automation, sensor processing. The progression from silicon to TN-enhanced computing mirrors the power plant progression.

---

## 1. Computer Hardware

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Optical Computing** | 3 | — | Photonic processors. Faster than silicon, lower power. First ship-grade improvement. |
| Optical Computing I-V | 4 | Optical Computing | Speed and reliability improvements. |
| **Quantum Computing** | 6 | Optical Computing III, Applied TN Physics II | Quantum state processors. Exponential speedup for specific problem classes (cryptography, optimization, simulation). |
| Quantum Computing I-V | 8 | Quantum Computing | |
| **TN Computing** | 12 | Quantum Computing IV, Unified TN Theory | Processors that operate partially in the TN regime. Computation at speeds conventional physics doesn't allow. |
| TN Computing I-V | 14 | TN Computing | |

## 2. Ship AI

AI systems that automate ship functions. Each tier reduces crew requirements and improves autonomous performance.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Basic Automation** | 2 | — | Standard autopilot, environmental controls, routine monitoring. |
| **Navigation AI** | 3 | Basic Automation, Optical Computing | Automated course plotting, collision avoidance, fuel-optimal routing. |
| Navigation AI I-V | 4 | Navigation AI | Higher tiers enable autonomous multi-body gravity-assist routing, real-time re-planning. |
| **Damage Control AI** | 4 | Basic Automation, Optical Computing | Automated damage assessment, repair prioritization, system rerouting. |
| Damage Control AI I-V | 5 | Damage Control AI | Higher tiers reduce malfunction severity, faster emergency response. |
| **Targeting AI** | 5 | Basic Automation, Predictive Fire Control, Optical Computing II | Machine learning target identification and engagement prioritization. |
| Targeting AI I-V | 6 | Targeting AI | Higher tiers improve engagement rate, reduce friendly fire risk. |
| **Ship AI Core** | 8 | Navigation AI III, Damage Control AI III, Targeting AI III, Quantum Computing II | Integrated AI managing all ship systems. Major crew reduction. Commander judgment augmentation. |
| Ship AI I-V | 10 | Ship AI Core | Each tier further reduces crew needs and improves autonomous decision quality. |
| **Autonomous Ship Operations** | 14 | Ship AI IV, TN Computing II | Ship can operate with zero crew for extended periods. Commander sets objectives, AI executes. |

## 3. Autonomous Systems (Drones)

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Remote Operated Vehicle** | 3 | Basic Automation | Manually piloted drones for survey, inspection, hazardous work. |
| **Semi-Autonomous Drone** | 5 | Remote Operated Vehicle, Navigation AI II | Drone follows waypoints and simple rules. Returns if signal lost. |
| Drone Autonomy I-V | 6 | Semi-Autonomous Drone | |
| **Combat Drone** | 8 | Semi-Autonomous Drone, Targeting AI III, Ship AI II | Armed autonomous drone with engagement capability. |
| Combat Drone Performance I-V | 10 | Combat Drone | |
| **Drone Swarm Coordination** | 10 | Combat Drone, Ship AI III | Multiple drones operating as a coordinated unit. Emergent tactical behavior. |
| Swarm Intelligence I-V | 12 | Drone Swarm Coordination | |
| **Von Neumann Probe** | 16 | Autonomous Ship Operations, Drone Swarm Coordination, TN Computing III | Self-replicating exploration probe. Capstone autonomous system. Uses in-situ resources to build copies. |

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| Hardware | 3 | 3 × V tiers | ~18 |
| Ship AI | 6 | 5 × V tiers | ~31 |
| Drones | 5 | 3 × V tiers | ~20 |
| **Domain Total** | **~14** | **~11 lines** | **~69** |

**Needs expansion:** Hardware should have more computing architectures (neuromorphic, photonic crystal, biological computing). Ship AI should have more specialized subsystems (logistics AI, diplomacy AI, research AI). Drones need size classes, specializations (survey drone, repair drone, mining drone), and carrier/hangar tech.
