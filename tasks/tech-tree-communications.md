# Tech Tree: Communications (Cross-Domain)

> Status: Draft design (2026-03-28). New domain emerging from the Harrington/Culture research. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

Communications determines the speed of information flow across the player's empire — fleet coordination, colony management, sensor data relay, fire control links, and trade. This is an infrastructure domain that scales every other system.

**Core design tension:** Light-speed comms create an information delay proportional to distance. At 1 AU, one-way delay is ~8 minutes. At Jupiter distance, ~43 minutes. At another star system — hours to days. FTL comms collapse this delay but start with severe bandwidth limitations. The research progression from "I can send a ping" to "I can send full sensor telemetry in real-time" is a multi-decade investment that reshapes how the player can manage their empire.

**Gameplay impact:** This is one of the deepest systems-interaction techs in the tree. FTL comms don't just let you talk faster — they enable:
- Real-time fire control at range (Apollo-style missile guidance)
- Coordinated fleet maneuvers across light-minutes
- Colony management without multi-hour decision lag
- Sensor networks that report in real-time instead of delayed
- Trade route optimization with current pricing data

Without FTL comms, distant colonies are autonomous by necessity. With them, centralized empire management becomes possible — but the bandwidth determines HOW MUCH control you can exert at distance.

---

## 1. Light-Speed Communications

The baseline. All starting comms are EM-based and propagate at c. Reliable, well-understood, unlimited bandwidth at short range. The limitation is purely physics — distance = delay.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Radio Communications** | 1 | — | Standard radio transceiver. Available at game start. Unlimited bandwidth at short range. Delay = distance/c. |
| Radio Range I-V | 2 | Radio Communications | Transmitter power and receiver sensitivity. Extends reliable range (signal-to-noise), not speed. |
| **Laser Communications** | 2 | Visual Spectrum Array | Tight-beam optical comms. Much harder to intercept than radio (directional). Higher bandwidth. Requires line-of-sight and precise pointing. |
| Laser Comm Bandwidth I-V | 3 | Laser Communications | Data rate improvements. |
| Laser Comm Precision I-V | 3 | Laser Communications | Pointing accuracy — enables laser comm at greater distances without signal loss. |
| **Encrypted Communications** | 2 | Radio Communications, Optical Computing | Computational encryption of all comm channels. Without this, all transmissions are interceptable. |
| Encryption Strength I-V | 3 | Encrypted Communications | Higher tiers require Quantum Computing to break. |
| **Burst Transmission** | 3 | Laser Communications, Encrypted Communications | Compressed high-speed data burst. Minimizes transmission window (harder to intercept/locate). Trade-off: higher power draw per message. |
| Burst Efficiency I-V | 4 | Burst Transmission | |
| **Deep Space Relay Network** | 4 | Laser Comm Precision III, Radio Range III | Automated relay stations that extend comm range across the system. Each relay receives, amplifies, and retransmits. Reduces effective delay for multi-hop routes vs. direct transmission. |
| Relay Network Capacity I-V | 5 | Deep Space Relay Network | Number of simultaneous channels and data throughput per relay. |
| **Quantum Key Distribution** | 6 | Encrypted Communications, Quantum Computing I | Provably unbreakable encryption using quantum entanglement for key exchange. Still light-speed transmission — this is security, not FTL. |
| QKD Throughput I-V | 8 | Quantum Key Distribution | |

---

## 2. FTL Communications (TN-Based)

FTL comms exploit the trans-newtonian spectrum — specifically, modulated perturbations in the TN field that propagate faster than light. The Sakarov Framework predicts this is possible; making it practical is an engineering challenge that takes decades to mature.

**The bandwidth problem:** Early FTL comms can send simple signals (pings, binary codes, short text). The TN field doesn't carry information the way EM radiation does — it requires encoding data as field perturbations, which are noisy, low-resolution, and power-hungry. Each tier of bandwidth research represents a breakthrough in encoding density, noise filtering, and transmitter/receiver precision.

### Initial FTL Breakthrough

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **TN Field Modulation** | 8 | TN Field Theory II, Gravitometric Sensitivity IV | The fundamental discovery: TN fields can carry modulated information. First demonstrated as a detectable "ping" — a binary yes/no signal transmitted FTL. Range: system-wide. Bandwidth: effectively zero (single-bit signals). |
| **FTL Communicator (Mk I)** | 9 | TN Field Modulation, Quantum Computing I | First practical FTL comm device. Transmits encoded text at ~10 characters/second. Enormous power draw. Receiver must be a dedicated installation (not ship-portable initially). Think telegraph, not telephone. |
| FTL Comm Range I-V | 10 | FTL Communicator (Mk I) | Extends range from in-system to interstellar. Each tier roughly doubles effective range. |

### Bandwidth Progression

The core research line. Each tier represents an order-of-magnitude increase in data throughput. This is the most impactful progression in the domain — every other FTL system is gated by how much data you can push through the link.

| Tech | Rank | Prerequisites | Description | Bandwidth | Enables |
|------|------|--------------|-------------|-----------|---------|
| FTL Bandwidth I | 10 | FTL Communicator (Mk I) | Improved encoding. ~100 chars/sec. Text messages with acceptable delay. | Text | Basic fleet orders, colony directives, trade pricing |
| FTL Bandwidth II | 11 | FTL Bandwidth I, TN Field Theory III | Noise filtering breakthrough. ~1 KB/sec. Short reports, sensor summaries. | Data packets | Compressed sensor reports, colony status updates |
| FTL Bandwidth III | 12 | FTL Bandwidth II, TN Computing I | TN-enhanced signal processing. ~100 KB/sec. Detailed telemetry. | Telemetry | Real-time ship status, basic fire control data relay |
| FTL Bandwidth IV | 13 | FTL Bandwidth III, TN Computing II | Multi-channel encoding. ~10 MB/sec. Full sensor feeds. | Sensor streams | Real-time sensor sharing across fleets, Apollo-style missile guidance |
| FTL Bandwidth V | 14 | FTL Bandwidth IV, TN Computing III | Wideband TN modulation. ~1 GB/sec. Full-fidelity data. | Full duplex | Real-time fleet coordination indistinguishable from light-speed proximity, remote colony micromanagement, AI-to-AI Mind links |
| FTL Bandwidth VI | 16 | FTL Bandwidth V, Unified TN Theory | Capstone. Effectively unlimited bandwidth. TN field carries data as efficiently as EM carries radio. | Unlimited | Everything. Empire-wide real-time information. The "ansible." |

### FTL Comm Hardware Progression

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **FTL Communicator (Mk II)** | 10 | FTL Communicator (Mk I), FTL Bandwidth I | Ship-portable FTL comm. Still large (dedicated compartment), but doesn't need a ground station. Capital ships and dedicated comm ships only. |
| **FTL Communicator (Mk III)** | 12 | FTL Communicator (Mk II), FTL Bandwidth III, Gallicite Semiconductors | Miniaturized FTL comm. Fits in any ship with available hull space. Escort-class vessels can carry one. |
| FTL Comm Miniaturization I-V | 13 | FTL Communicator (Mk III) | Further size reduction. Tier V: small enough for missiles, drones, and recon probes. This is the Apollo enabler — FTL data link in a missile. |
| **FTL Relay Buoy** | 11 | FTL Communicator (Mk II), Deep Space Relay Network | Automated FTL relay station. Extends FTL comm range and acts as a network node. Deployable at jump points, colony systems, and along trade routes. |
| FTL Relay Capacity I-V | 12 | FTL Relay Buoy | Throughput and simultaneous channel improvements. |
| **FTL Comm Array (Colony)** | 10 | FTL Communicator (Mk I) | Ground-based FTL transceiver installation. Much higher power and sensitivity than ship-mounted units. The colony's link to the empire. |
| FTL Array Power I-V | 11 | FTL Comm Array (Colony) | Range and bandwidth multiplier for colony-based comms. |

### FTL Comm Applications (Unlocked by Bandwidth + Hardware)

These aren't separate techs — they're capabilities that become possible when bandwidth and hardware prerequisites are met.

| Capability | Bandwidth Req | Hardware Req | Description |
|------------|--------------|-------------|-------------|
| **Fleet Orders** | I | Mk II (ship) | Send text orders to distant fleets. Minutes of delay eliminated, but low bandwidth means orders only, not coordination. |
| **Colony Management** | II | Colony Array | Send/receive colony reports and directives. Eliminates the "autonomous colony" problem for basic management. |
| **Sensor Data Relay** | III | Mk III (ship) | Ships share compressed sensor data FTL. A picket 10 light-minutes away reports contacts in real-time to the fleet commander. |
| **FTL Fire Control Link** | IV | Miniaturization III (missile-sized) | Apollo-style: FTL data link in the missile salvo itself. Real-time course corrections and target updates at engagement ranges where light-speed lag would make guidance useless. |
| **Distributed Fleet AI** | V | Mk III + Ship AI III | Ship AIs share processing power and sensor data across FTL links. The fleet becomes a single distributed intelligence. |
| **Empire-Wide Market** | III | Colony Array + Relay Network | Real-time commodity pricing across all colonies. Eliminates information lag in trade. Tanaka's dream — perfect market information. |
| **Remote Drone Control** | IV | Miniaturization IV (drone-sized) | Control survey drones, combat drones, and recon probes at interstellar distances in real-time. |
| **Mind Link** | VI | TN Computing III | AI-to-AI direct connection at full fidelity. Culture-style Mind coordination. Capstone capability. |

---

## 3. The Stealth Comms Window

A critical temporal dynamic in the comms domain: **early FTL comms are inherently stealthy.**

When FTL communicators first come online, conventional EM sensors cannot detect TN field modulation. The player with FTL comms can coordinate fleets while appearing radio-silent. Enemy observers see ships maneuvering in suspiciously coordinated ways with no detectable communications — but they can't prove or counter it.

This creates a **stealth comms window** that lasts until gravitometric sensor technology catches up:

| Phase | Comms Tech | Sensor Counter | Comms Advantage |
|-------|-----------|----------------|-----------------|
| **1. Invisible** | FTL Communicator Mk I | No TN sensors yet | Total stealth. Enemy has no idea you're communicating FTL. Massive coordination advantage. |
| **2. Detectable** | FTL Comm (any) | TN Resonance Detector | Enemy knows FTL comms are happening and roughly where from, but can't characterize or decode. You know they can detect it. |
| **3. Classifiable** | FTL Comm (any) | TN Emission Classifier | Enemy can distinguish comm signals from engine/reactor signatures. Can identify which ships are communicating. Comm discipline becomes important — a "silent" ship that sends an FTL burst reveals itself. |
| **4. Interceptable** | FTL Comm (any) | FTL Signal Intercept | Enemy can record your transmissions. Can't decode them yet (if encrypted), but traffic analysis reveals fleet structure and command relationships. |
| **5. Breakable** | FTL Comm (any) | FTL Cryptanalysis | Enemy can attempt to decode intercepted FTL comms. The encryption strength vs. cryptanalysis arms race begins. |
| **6. Jammable** | FTL Comm (any) | FTL Jamming | Enemy can disrupt your FTL comms entirely. Your coordination advantage disappears unless you invest in FTL Comm Hardening. |
| **7. Arms race** | Hardened FTL + burst + frequency agility | Targeted disruption + cognitive ECCM | Continuous measure/counter-measure spiral. Neither side has permanent advantage. |

**MTG parallel:** The stealth comms window is like a new card that's dominant until the meta adapts. Early adopters get a huge advantage, but the counter-tech is already in the sensor tree waiting to be researched. The question is how long the window lasts and how much advantage you extract before it closes.

**Design note:** This means the player's research order matters enormously. Rushing FTL comms before your opponent has TN sensors gives you a period of "free" fleet coordination. But if your opponent is ahead on TN sensors, your FTL comms are compromised from the moment you turn them on. Scouting their tech level before committing to FTL comms is a real decision.

---

## 5. Communications Warfare

If comms are infrastructure, comms warfare is sabotage. Every FTL comm capability creates a corresponding vulnerability.

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **FTL Signal Intercept** | 10 | FTL Communicator (Mk I), TN Resonance Detector | Detect and receive enemy FTL transmissions. Can't decode them (yet) but know they're happening and roughly where from. |
| FTL Intercept Sensitivity I-V | 11 | FTL Signal Intercept | Range and direction accuracy. |
| **FTL Cryptanalysis** | 12 | FTL Signal Intercept, Quantum Computing III | Attempt to decode intercepted FTL transmissions. Success depends on encryption strength vs. cryptanalysis level. |
| Cryptanalysis Power I-V | 14 | FTL Cryptanalysis | |
| **FTL Jamming** | 11 | FTL Signal Intercept, TN Spectrum Jamming | Disrupt enemy FTL communications within a volume of space. Brute-force noise injection into the TN spectrum. |
| FTL Jamming Power I-V | 12 | FTL Jamming | Area and effectiveness. |
| **Targeted FTL Disruption** | 13 | FTL Jamming Power III, TN Emission Classifier | Jam specific FTL comm channels without disrupting your own. Requires identifying the enemy's encoding frequency. |
| Targeted Disruption Quality I-V | 14 | Targeted FTL Disruption | |
| **FTL Comm Hardening** | 11 | FTL Communicator (Mk II), TN Signal Hardening | Resistance to FTL jamming. Frequency agility and redundant encoding. |
| FTL Hardening Quality I-V | 12 | FTL Comm Hardening | |
| **Relay Network Disruption** | 12 | FTL Jamming Power II | Ability to target and disable FTL relay buoys. Cuts enemy communication infrastructure. Strategic-level comms warfare. |

---

## 6. Interaction with Other Domains

Communications is a force multiplier that amplifies every other system:

| Domain | Without FTL Comms | With FTL Comms |
|--------|------------------|----------------|
| **Fleet Command** | Orders sent by courier ship or light-speed radio. Hours/days of lag. Admirals must grant autonomy. | Real-time fleet coordination. Centralized command possible. |
| **Sensors** | Each ship's sensors are local. Pickets report by radio — data arrives late. | Picket sensor data arrives in real-time. Fleet sees with one distributed eye. |
| **Weapons (Missiles)** | Fire-and-forget beyond light-speed control range. Accuracy degrades with range. | Apollo-style FTL guidance. Precision at any range the missile can reach. |
| **Colonies** | Distant colonies are autonomous. Governor AI handles everything. Player gets reports days later. | Player can micromanage distant colonies (if bandwidth allows). Governors become optional, not necessary. |
| **Trade** | Commodity prices are stale. Arbitrage opportunities exist due to information lag. | Real-time market. Efficient allocation. Higher GDP but fewer arbitrage opportunities. |
| **EW** | Jamming is local. You can only disrupt what you can reach with EM. | FTL jamming cuts strategic comms. A fleet cut off from FTL is tactically blind beyond its own sensors. |
| **AI** | Ship AIs operate independently. Commander judgment is per-ship. | Distributed fleet AI. Ships share processing. Collective intelligence. |

**The Tanaka cascade applies here too:** FTL comms don't just require research — they require Mercassium (for TN receivers), Gallicite (for the computing to encode/decode), and Corbomite (for thermal management of high-power transmitters). Building an empire-wide FTL network demands TNE throughput that only expanded mining can provide.

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| Light-Speed Comms | 6 | 7 × V tiers | ~41 |
| FTL Breakthrough | 2 | 1 × V tiers | ~7 |
| FTL Bandwidth | — | 1 × VI tiers | ~6 |
| FTL Hardware | 4 | 4 × V tiers | ~24 |
| Comms Warfare | 5 | 5 × V tiers | ~30 |
| **Domain Total** | **~17** | **~18 lines** | **~108** |
