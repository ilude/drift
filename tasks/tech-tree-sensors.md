# Tech Tree: Detection & Sensing (Okafor Domain)

> Status: Draft design (2026-03-28). Needs Aurora-scale expansion. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

The domain of finding things — from asteroids to enemy ships to TNE deposits. Two parallel spectra: conventional electromagnetic and the TN spectrum discovered by Okafor's methods. The Okafor legacy splits into two schools: detection purists (this domain) and the EW shadow school (see [tech-tree-electronic-warfare.md](tech-tree-electronic-warfare.md)).

**Core design tension:** Every sensor has a detection axis (what it finds) and a signature axis (what it reveals about the user). Passive sensors are invisible but limited. Active sensors are powerful but broadcast your position. The player must decide how much information is worth how much exposure — and that calculus changes with every ship role and tactical situation.

---

## 1. Electromagnetic Sensors — Passive

Passive sensors detect emissions without revealing the observer. Each band of the EM spectrum is a separate sensor type with different strengths. The full EM spectrum progression mirrors how real-world astronomy evolved — each band reveals different phenomena.

### Sensor Sizing

Every sensor has a **size in Hull Spaces** that determines its sensitivity baseline. Larger sensors detect at greater range but consume more mass budget. The player chooses sensor size during ship design — a 10 HS thermal array on a dedicated picket vs. a 1 HS thermal sensor on a frigate. Tech improvements apply multiplicatively to the size-based baseline.

### EM Passive Sensor Progression

| Tech | Rank | Prerequisites | Description | Detects |
|------|------|--------------|-------------|---------|
| **Thermal Imaging** | 1 | — | Infrared detection. Baseline passive sensor. Every ship has basic thermal sensors. | Engine heat, reactor signatures, warm bodies, re-entry signatures |
| Thermal Sensitivity I-XII | 2-8 | Thermal Imaging | 12 tiers of resolution and range improvement. Each tier: ~15% range increase. Early tiers cheap (rank 2), late tiers expensive (rank 8). | |
| **Visual Spectrum Array** | 1 | — | Optical detection and tracking. Daylight-equivalent passive observation. | Physical objects, reflected light, surface features, visual identification |
| Visual Resolution I-XII | 2-8 | Visual Spectrum Array | 12 tiers. Aperture, adaptive optics, and processing improvements. | |
| **Radio Receiver** | 1 | — | Passive radio/microwave intercept. Detects deliberate and unintentional emissions. | Communications, electronic emissions, navigation beacons, radar spillover |
| Radio Sensitivity I-XII | 2-8 | Radio Receiver | 12 tiers. Bandwidth and sensitivity improvements. Late tiers can intercept tight-beam comms at distance. | |
| **UV/X-Ray Detector** | 3 | Thermal Sensitivity III, Visual Resolution III | Short-wavelength passive detection. Requires preliminary EM sensor experience. | High-energy events, stellar phenomena, active weapon discharge, shield emissions |
| UV/X-Ray Sensitivity I-X | 4-10 | UV/X-Ray Detector | 10 tiers. | |
| **Gamma Ray Telescope** | 6 | UV/X-Ray Sensitivity IV | Highest-energy EM detection. Detects nuclear and antimatter events. | Nuclear detonations, antimatter reactor leakage, exotic energy sources, TN warhead detonations |
| Gamma Sensitivity I-VIII | 8-12 | Gamma Ray Telescope | 8 tiers. Expensive — each tier is rank 8+. | |
| **Neutrino Detector** | 8 | Gamma Sensitivity III, Quantum Computing I | Detects neutrino flux from fusion and fission reactors. Nearly impossible to shield against — the "you can't hide a running reactor" sensor. | Active fission/fusion reactors regardless of other stealth. Does NOT detect antimatter or exotic reactors (different particle emissions). |
| Neutrino Sensitivity I-VI | 10-14 | Neutrino Detector | 6 tiers. Very expensive. The arms race: as reactor tech advances past fusion, neutrino sensors become less useful — creating a window where they dominate, then a tech transition to TN sensors. | |

### Planetary/System-Scale Sensors

Sensors mounted on colonies and orbital installations rather than ships. Larger baselines, fixed position.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Planetary Sensor Array** | 2 | Thermal Imaging, Radio Receiver | Ground-based sensor installation. Huge aperture but fixed to one body. |
| Planetary Sensor Strength I-XIII | 3-10 | Planetary Sensor Array | 13 tiers. From early warning to deep-system surveillance. |
| **Deep Space Tracking Network** | 6 | Planetary Sensor Strength V, Phased Array Radar | Multi-body sensor network. Installations on multiple colonies triangulate for extreme-range detection. |
| Network Sensitivity I-V | 8 | Deep Space Tracking Network | |

---

## 2. Electromagnetic Sensors — Active

Active sensors emit energy and read the return. More information than passive, but reveals the emitter's position and bearing. The fundamental tradeoff: **knowledge vs. exposure.**

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Search Radar** | 2 | Radio Receiver | Active radio/microwave pulse. Standard detection and ranging. The workhorse. |
| Radar Range I-XII | 3-8 | Search Radar | 12 tiers. Detection distance improvements. |
| Radar Resolution I-XII | 3-8 | Search Radar | 12 tiers. Ability to distinguish multiple targets at range and classify by size/type. |
| **LIDAR Array** | 3 | Visual Spectrum Array, Search Radar | Laser-based ranging. Extremely precise at shorter range. Better angular resolution than radar. |
| LIDAR Precision I-X | 4-8 | LIDAR Array | 10 tiers. |
| LIDAR Range I-X | 4-8 | LIDAR Array | 10 tiers. Extending useful engagement envelope. |
| **Phased Array Radar** | 5 | Radar Range IV, Radar Resolution IV | Electronically steered beam. Multi-target tracking, rapid scan sector switching. Enables fire control for multiple simultaneous weapons. |
| Phased Array Tracking I-X | 6-10 | Phased Array Radar | 10 tiers. Number of simultaneous tracks and track update rate. |
| Phased Array Range I-X | 6-10 | Phased Array Radar | 10 tiers. |
| **Synthetic Aperture Radar** | 6 | Phased Array Tracking III | Uses ship motion to simulate a much larger antenna. Extreme surface detail at range. Survey and reconnaissance applications. |
| SAR Resolution I-V | 7 | Synthetic Aperture Radar | |
| **Multispectral Active Scanner** | 8 | Phased Array Tracking IV, LIDAR Precision V, UV/X-Ray Sensitivity III | Simultaneous multi-band active scanning. Fuses radar, LIDAR, and UV/X-ray active returns for near-complete target characterization. |
| Multispectral Performance I-VIII | 10-14 | Multispectral Active Scanner | 8 tiers. |

### Active Sensor Support

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| Sensor Range Bonus I-X | 3-10 | Search Radar | Global active sensor range modifier. 10 tiers. Each adds ~8% to all active sensor ranges. Stacks with per-sensor-type improvements. |
| **Narrow Beam Focus** | 4 | Radar Range III | Concentrates active sensor energy into a tight beam. Extreme range on a single bearing but loses area coverage. Toggle between search (wide) and track (narrow) modes. |
| Narrow Beam Intensity I-V | 5 | Narrow Beam Focus | |
| **Low Probability of Intercept** | 5 | Radar Range III, Signal Filtering | Spread-spectrum active emissions that are harder for enemy passive sensors to detect. Reduces the "I see you seeing me" problem. |
| LPI Quality I-V | 6 | Low Probability of Intercept | |

---

## 3. Trans-Newtonian Sensors — Passive

The TN spectrum is invisible to conventional instruments. Okafor's original detection methods, refined over decades. These sensors detect phenomena that EM sensors cannot — TN field signatures, stabilized TNE masses, and gravitational anomalies caused by TN-coupled matter.

**Key difference from EM sensors:** TN sensors have no equivalent of "visual" detection — you can't "see" in the TN spectrum. Instead, you detect perturbations in the TN field. This means TN sensor data is inherently more abstract — mass estimates, field strength readings, resonance patterns — rather than images. Interpretation requires computing support (hence the Quantum Computing prerequisites).

| Tech | Rank | Prerequisites | Description | Detects |
|------|------|--------------|-------------|---------|
| **Gravitometric Sensor** | 3 | Applied TN Physics I | Detects mass concentrations through TN gravitational coupling. Okafor's original instrument, refined for ship mounting. | TNE deposits, large ships (by mass), planetary cores, asteroid composition |
| Gravitometric Sensitivity I-XII | 4-10 | Gravitometric Sensor | 12 tiers. Range and mass-resolution improvements. Late tiers can distinguish ship classes by mass signature. | |
| **TN Resonance Detector** | 5 | Gravitometric Sensitivity III, TN Field Theory I | Detects active TN field signatures — any device exploiting TN physics produces a detectable resonance. This is the first sensor that can reliably detect TN-era ships. | Ships under power (TN engines), active TN reactors, TN industrial processes, active TN sensors |
| TN Resonance Sensitivity I-X | 6-10 | TN Resonance Detector | 10 tiers. | |
| **TN Emission Classifier** | 7 | TN Resonance Sensitivity IV, Optical Computing III | Analyzes the resonance pattern to identify the *type* of TN device producing it. Distinguishes engine signatures from reactor signatures from weapon signatures. The TN equivalent of radar classification. | Device-level identification: engine type, reactor class, weapon charging state |
| Classifier Accuracy I-VIII | 8-12 | TN Emission Classifier | 8 tiers. Higher tiers identify specific engine models and reactor configurations. | |
| **Dark Matter Interferometer** | 8 | TN Resonance Sensitivity V, Quantum Computing I | Measures TN binding state perturbations. Detects stabilized TNE materials even without active TN fields — a powered-down ship with Duranium hull is still visible. | TN-alloy structures even when powered down, refined TNE stockpiles, TNE-rich geological formations |
| Interferometer Sensitivity I-VIII | 10-14 | Dark Matter Interferometer | 8 tiers. Very expensive. | |
| **TN Background Mapper** | 12 | Interferometer Sensitivity IV | Maps the ambient TN field topology of a region. Reveals large-scale TN structures — hidden deposits, TN field anomalies, and (critically) jump point locations. | Deep subsurface TNE deposits, TN field anomalies, jump point detection, precursor artifacts |
| Background Mapper Resolution I-V | 14 | TN Background Mapper | 5 tiers. | |

---

## 4. Trans-Newtonian Sensors — Active

Active TN sensors emit pulses through the TN spectrum. Extremely powerful detection — TN pulses interact with all TN-coupled matter regardless of EM stealth. But the pulse is detectable by any TN-capable receiver in an enormous volume. Using active TN sensors is the loudest thing a ship can do.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **TN Pulse Scanner** | 6 | Gravitometric Sensitivity IV, TN Field Theory I | Emits a TN field pulse and reads the return. Reveals all TN-interacting matter in range regardless of EM stealth. The "I don't care about stealth, I need to know what's out there" option. |
| TN Pulse Range I-X | 8-14 | TN Pulse Scanner | 10 tiers. |
| TN Pulse Resolution I-X | 8-14 | TN Pulse Scanner | 10 tiers. Ability to characterize targets — mass, TN material composition, approximate component layout. |
| **TN Pulse Frequency Control** | 8 | TN Pulse Resolution III | Ability to tune the pulse frequency. Different frequencies interact more strongly with different TNEs. Enables targeted scans — "show me everything with Sorium" or "show me Gallicite concentrations." |
| Frequency Control Precision I-V | 10 | TN Pulse Frequency Control | |
| **Deep TN Scan** | 10 | TN Pulse Resolution V, Dark Matter Interferometer | Focused, narrow-beam TN scan. Extreme range and detail on a single target. Reveals component-level data — what reactors, what engines, what weapons a ship is carrying. The TN equivalent of a full intelligence assessment. |
| Deep Scan Performance I-VIII | 12-16 | Deep TN Scan | 8 tiers. |
| **TN Omniscanner** | 16 | Deep Scan Performance IV, TN Background Mapper, TN Computing II | Full-sphere continuous TN scan with classification capability. Nothing TN-interacting can hide within range. Complete real-time picture of all TN matter and active TN fields. Capstone sensor technology. |

---

## 5. Survey Instruments (Brennan Specialization)

Dedicated instruments for resource survey — a specialization within the Okafor sensor domain but following Brennan Protocols. Survey instruments are distinct from combat/detection sensors: they're optimized for geological analysis, not target tracking. A survey ship needs survey instruments; a warship needs combat sensors. Different components, different tech lines, different design considerations.

### Brennan Survey Levels

Survey depth determines what deposits are visible:
- **Level 1 (Surface/Shallow):** Deposits with accessibility ≥ 0.5. Conventional instruments.
- **Level 2 (Mid-Depth):** Deposits with accessibility ≥ 0.2. Requires TN-enhanced penetration.
- **Level 3 (Deep):** Deposits with accessibility < 0.2. Requires advanced TN resonance analysis.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Geological Survey Suite** | 1 | — | Baseline Brennan Protocol survey package. Enables Level 1 surveys. EM-spectrum surface analysis — spectrometry, radar mapping, thermal gradient scanning. |
| Survey Speed I-X | 2-6 | Geological Survey Suite | 10 tiers. Faster scan completion through better automation and processing. |
| Survey Sensor Size Reduction I-V | 3 | Geological Survey Suite | Smaller survey packages. Enables survey capability on smaller hulls without dedicating half the ship to instruments. |
| **Gravimetric Survey Module** | 3 | Geological Survey Suite, Gravitometric Sensor | Combines Brennan Protocol surface survey with Okafor gravitometric mass detection. Reveals bulk composition data that surface-only surveys miss. Enhances Level 1 survey detail — not required, but produces richer deposit data. |
| Gravimetric Survey Quality I-V | 4 | Gravimetric Survey Module | |
| **Deep Penetration Scanner** | 4 | Survey Speed IV, Gravitometric Sensitivity II | Enables Level 2 surveys. TN-enhanced subsurface scanning. Detects mid-depth deposits invisible to surface instruments. |
| Deep Scan Speed I-VIII | 5-8 | Deep Penetration Scanner | 8 tiers. |
| **Sub-Surface Resonance Mapper** | 6 | Deep Scan Speed III, TN Resonance Detector | Detailed 3D mapping of subsurface deposit structure. Provides accessibility, estimated yield, and extraction difficulty data for Level 2 deposits. |
| Resonance Mapper Quality I-V | 7 | Sub-Surface Resonance Mapper | |
| **Core Analysis Suite** | 8 | Deep Scan Speed V, TN Resonance Sensitivity III | Enables Level 3 surveys. Deep subsurface deposit detection using focused TN resonance probing. Reveals deposits buried under kilometers of rock/ice that no conventional instrument could detect. |
| Core Analysis Speed I-VIII | 10-14 | Core Analysis Suite | 8 tiers. Very expensive — deep surveys of large bodies are major time investments even at high tech. |
| **Deposit Yield Estimator** | 5 | Deep Penetration Scanner | Refines resource quantity estimates. Without this, survey results show "deposit present" with rough size categories. With it, you get tonnage estimates with confidence intervals. Higher tiers narrow the confidence band. |
| Yield Estimator Accuracy I-V | 6 | Deposit Yield Estimator | |
| **Brennan Comprehensive Survey** | 12 | Core Analysis Speed IV, Dark Matter Interferometer, TN Emission Classifier | Capstone survey instrument. Single-pass complete survey — all deposits, all depths, all accessibility data, precise yield estimates. What would normally take three survey levels in multiple passes, this does in one. The instrument Annelise Brennan dreamed of building. |
| Comprehensive Survey Speed I-V | 14 | Brennan Comprehensive Survey | Even the capstone instrument benefits from speed improvements for large bodies. |

### Survey Automation

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Automated Survey Processing** | 3 | Geological Survey Suite, Basic Automation | Reduces crew skill dependency for survey operations. Lower-skill crews can produce adequate survey results. |
| **AI-Assisted Survey** | 6 | Automated Survey Processing, Navigation AI II | AI handles routine survey decisions — orbit selection, scan scheduling, anomaly flagging. Commander only needs to designate targets. |
| AI Survey Quality I-V | 8 | AI-Assisted Survey | Higher tiers approach human-expert survey quality with zero crew intervention. |

---

## 6. Fire Control Sensors (Combat Integration)

Fire control is where detection meets weapons. Listed here because fire control is fundamentally a sensor problem — acquiring, tracking, and predicting target behavior.

See also: [tech-tree-weapons.md](tech-tree-weapons.md) for weapon-specific fire control interactions.

### Beam Fire Control

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Basic Beam Fire Control** | 2 | Search Radar | Manual targeting with radar assist. One target at a time. |
| Beam FC Range I-XIII | 3-10 | Basic Beam Fire Control | 13 tiers. Maximum engagement range. Each tier extends by ~20%. Aurora pattern: 10,000 → 16,000 → 24,000 → ... → 175,000 km. |
| Beam FC Tracking Speed I-XII | 3-10 | Basic Beam Fire Control | 12 tiers. Rate at which the fire control can follow a maneuvering target. Determines hit probability against agile ships. |
| **Predictive Fire Control** | 4 | Beam FC Range IV, Beam FC Tracking III, Optical Computing I | Lead computation and target behavior prediction. Dramatically improves hit rate against maneuvering targets at range. |
| Predictive FC Accuracy I-V | 5 | Predictive Fire Control | |
| **Integrated Fire Control** | 8 | Predictive FC Accuracy III, Multispectral Active Scanner, Quantum Computing I | Fuses all sensor data (EM + TN) for weapon targeting. Compensates for ECM. Multi-target engagement from a single fire control suite. |
| Integrated FC Performance I-VIII | 10-14 | Integrated Fire Control | 8 tiers. |
| **TN-Enhanced Fire Control** | 12 | Integrated FC Performance IV, TN Emission Classifier | Fire control that uses TN sensor data for targeting. Can engage targets that are EM-stealthy but TN-visible. Also provides superior tracking of TN-propelled missiles. |
| TN FC Quality I-V | 14 | TN-Enhanced Fire Control | |

### Missile Fire Control

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Missile Fire Control** | 3 | Search Radar, Conventional Missile | Guidance uplink and target designation for missiles. Range determines how far the controlling ship can guide missiles. |
| Missile FC Range I-X | 4-10 | Missile Fire Control | 10 tiers. Beyond this range, missiles go autonomous (if they have the tech) or ballistic. |
| Missile FC Resolution I-X | 4-10 | Missile Fire Control | 10 tiers. How many individual missiles can be guided simultaneously. Low resolution = fewer missiles per salvo under active guidance. |
| **Tracking Time Bonus vs Missiles I-IX** | 4-10 | Basic Beam Fire Control | 9 tiers. Improves point defense effectiveness by extending the tracking window before an incoming missile reaches the ship. 5% → 10% → 20% → 30% → 40% → 50% → 60% → 80% → 100%. |

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| EM Passive | 8 | 7 lines × VI-XII tiers | ~78 |
| EM Active | 8 | 9 lines × V-XII tiers | ~80 |
| Planetary Sensors | 2 | 2 lines × V-XIII tiers | ~20 |
| TN Passive | 6 | 6 lines × V-XII tiers | ~56 |
| TN Active | 4 | 4 lines × V-X tiers | ~38 |
| Survey | 10 | 9 lines × V-X tiers | ~65 |
| Fire Control | 7 | 8 lines × V-XIII tiers | ~80 |
| **Domain Total** | **~45** | **~45 lines** | **~417** |

Massive expansion from the original ~98. The sensor domain is now comparable in depth to propulsion — which makes sense, because "finding things" is as fundamental to a space exploration sim as "getting to things."
