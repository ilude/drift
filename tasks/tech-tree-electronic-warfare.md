# Tech Tree: Electronic Warfare & Countermeasures (Okafor Derivative)

> Status: Draft design (2026-03-28). Needs Aurora-scale expansion. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

The shadow domain — using the Okafor sensor heritage for deception and denial. Second-generation Okafor school that split from the detection purists.

---

## 1. Electronic Countermeasures (ECM)

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **EM Jamming** | 3 | Search Radar, Radio Receiver | Broadband EM noise generation. Degrades enemy radar/radio. |
| Jamming Power I-V | 4 | EM Jamming | |
| **Targeted ECM** | 5 | Jamming Power II, Phased Array Radar | Focused jamming on specific sensor bands or individual targets. |
| Targeted ECM Efficiency I-V | 6 | Targeted ECM | |
| **TN Spectrum Jamming** | 8 | TN Resonance Detector, Jamming Power III | Disrupts TN sensor returns. First counter to gravitometric detection. |
| TN Jamming Power I-V | 10 | TN Spectrum Jamming | |
| **Adaptive Broadband ECM** | 12 | Targeted ECM Efficiency IV, TN Jamming Power III | AI-driven jamming that reads enemy sensor emissions and optimally counters them in real-time. |

## 2. Electronic Counter-Countermeasures (ECCM)

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Signal Filtering** | 3 | Search Radar | Basic noise rejection. Reduces ECM effectiveness against your sensors. |
| Filter Quality I-V | 4 | Signal Filtering | |
| **Frequency Hopping** | 5 | Filter Quality II, Phased Array Radar | Rapid frequency changes make targeted jamming ineffective. |
| Hop Rate I-V | 6 | Frequency Hopping | |
| **TN Signal Hardening** | 8 | TN Resonance Detector, Filter Quality III | Protects TN sensors from TN-spectrum jamming. |
| TN Hardening Quality I-V | 10 | TN Signal Hardening | |
| **Cognitive ECCM** | 14 | Hop Rate IV, TN Hardening Quality III, Ship AI III | AI-driven pattern recognition that identifies and nullifies jamming patterns. Arms race with Adaptive ECM. |

## 3. Stealth & Signature Reduction

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Thermal Signature Reduction** | 3 | Thermal Imaging | Heat sinks and radiator management. Reduces IR detection range. |
| Thermal Stealth I-V | 4 | Thermal Signature Reduction | |
| **EM Emission Control** | 4 | Radio Receiver, Signal Filtering | Protocols for minimizing detectable emissions. Ship goes "dark." |
| EMCON Discipline I-V | 5 | EM Emission Control | |
| **Radar Absorbent Materials** | 5 | Thermal Stealth II, Advanced Metallurgy | Hull coatings that reduce radar cross-section. |
| RAM Effectiveness I-V | 6 | Radar Absorbent Materials | Uses Uridium for TN-spectrum absorption properties. |
| **TN Signature Masking** | 10 | TN Spectrum Jamming, RAM Effectiveness III | Suppresses the ship's TN field signature. Counters gravitometric detection. |
| TN Masking Quality I-V | 12 | TN Signature Masking | |
| **Active Cloaking Field** | 16 | TN Masking Quality IV, Zero-Point Reactor | TN field manipulation bends EM and TN detection around the ship. Near-total invisibility. Extreme power draw. Capstone stealth. |

## 4. Decoys & Deception

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **EM Decoy Buoy** | 3 | EM Jamming | Deployable device that mimics a ship's EM signature. |
| Decoy Fidelity I-V | 4 | EM Decoy Buoy | How convincing the fake signature is. |
| **TN Decoy Buoy** | 8 | TN Spectrum Jamming, Decoy Fidelity III | Mimics a ship's TN signature. Fools gravitometric sensors. |
| TN Decoy Fidelity I-V | 10 | TN Decoy Buoy | |
| **Ghost Generator** | 14 | TN Decoy Fidelity IV, Active Cloaking Field | Projects false TN/EM signatures at a distance. Creates phantom contacts on enemy sensors. |

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| ECM | 4 | 3 × V tiers | ~19 |
| ECCM | 4 | 3 × V tiers | ~19 |
| Stealth | 5 | 4 × V tiers | ~25 |
| Decoys | 3 | 2 × V tiers | ~13 |
| **Domain Total** | **~16** | **~12 lines** | **~76** |

**Needs expansion:** This domain should grow significantly. ECM/ECCM should have Aurora-scale depth with 10+ tiers per line. Stealth should have more distinct signature types. Decoys need autonomous decoy drones and coordinated deception systems.
