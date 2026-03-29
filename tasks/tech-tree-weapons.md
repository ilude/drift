# Tech Tree: Weapons & Defense (Cross-Domain)

> Status: Draft design (2026-03-28). Needs Aurora-scale expansion. Parent doc: [tech-tree-overview.md](tech-tree-overview.md)

Weapons draw from Kouri (energy generation), Meijer (materials), and Okafor (targeting). No single founder — this is a second-generation domain.

---

## 1. Energy Weapons

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Laser Emitter** | 3 | Fusion Reactor, LIDAR Array | First ship-mounted directed energy weapon. Infrared/visible band. |
| Laser Focal Size I-V | 4 | Laser Emitter | Larger aperture = more damage at range. |
| Laser Wavelength I-V | 4 | Laser Emitter | Shorter wavelength = better armor penetration. IR → Visible → UV → X-Ray. |
| **Particle Beam** | 6 | Laser Wavelength III, Magnetic Containment III | Accelerated particle stream. Ignores some armor types. |
| Particle Beam Strength I-V | 8 | Particle Beam | |
| Particle Beam Range I-V | 8 | Particle Beam | |
| **Plasma Cannon** | 8 | Particle Beam Strength II, TN Field Theory II | TN-contained plasma bolt. Area effect on impact. |
| Plasma Intensity I-V | 10 | Plasma Cannon | |
| Plasma Stability I-V | 10 | Plasma Cannon | Range extension through better containment. |
| **Meson Projector** | 14 | Plasma Intensity IV, Unified TN Theory | Beam passes through conventional matter, damages internal systems directly. Ignores all armor. Capstone energy weapon. |
| Meson Focus I-V | 16 | Meson Projector | |

## 2. Kinetic Weapons

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Railgun** | 2 | Fission Reactor | Electromagnetic acceleration. Simple, reliable, power-hungry. |
| Railgun Velocity I-V | 3 | Railgun | Higher velocity = more kinetic energy on impact. |
| Railgun Caliber I-V | 3 | Railgun | Larger projectile = more damage, slower rate of fire. |
| **Gauss Cannon** | 5 | Railgun Velocity III, Magnetic Containment II | Superconducting magnetic acceleration. Higher velocity, less barrel wear. |
| Gauss Performance I-V | 6 | Gauss Cannon | |
| **Mass Driver** | 4 | Railgun Caliber III | Large-bore kinetic launcher. Ship weapon or orbital bombardment. Also functions as cargo launcher (dual-use: consistent rules, emergent applications). |
| Mass Driver Performance I-V | 5 | Mass Driver | |
| **TN-Enhanced Penetrator** | 8 | Gauss Performance III, TN Materials III | Projectiles with Duranium/Neutronium cores. Extreme armor penetration. |
| Penetrator Quality I-V | 10 | TN-Enhanced Penetrator | |

## 3. Missiles

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Conventional Missile** | 2 | — | Chemical propulsion, conventional warhead. Short range, basic guidance. |
| Missile Speed I-V | 3 | Conventional Missile | Engine improvements. |
| Missile Agility I-V | 3 | Conventional Missile | Maneuverability against evasive targets. |
| Warhead Yield I-V | 3 | Conventional Missile | Damage output. |
| **TN-Propelled Missile** | 5 | Conventional TN Drive, Missile Speed III | Sorium-fueled missiles. Extreme range and speed. |
| TN Missile Speed I-V | 6 | TN-Propelled Missile | |
| TN Missile Agility I-V | 6 | TN-Propelled Missile | |
| **TN Warhead** | 6 | TN-Propelled Missile, Warhead Yield III | Sorium-detonation warhead. Massive yield. |
| TN Warhead Yield I-V | 8 | TN Warhead | |
| **Autonomous Missile** | 8 | TN-Propelled Missile, Ship AI II, Targeting AI II | Self-guided missile with onboard AI. Can select targets, evade countermeasures, coordinate with other missiles in flight. |
| Autonomous Guidance I-V | 10 | Autonomous Missile | |
| **Missile ECM Suite** | 6 | TN-Propelled Missile, EM Jamming | Onboard countermeasures on missiles. Harder to intercept. |
| Missile ECM Quality I-V | 8 | Missile ECM Suite | |

## 4. Point Defense

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Point Defense Cannon** | 3 | Railgun | Rapid-fire small-caliber kinetic system for missile intercept. |
| PD Tracking Speed I-V | 4 | Point Defense Cannon | Rate of target acquisition. |
| PD Rate of Fire I-V | 4 | Point Defense Cannon | |
| **Laser Point Defense** | 5 | Laser Emitter, PD Tracking Speed II | Directed energy missile intercept. Instant hit, no ammunition. |
| Laser PD Efficiency I-V | 6 | Laser Point Defense | Power consumption and sustained fire rate. |
| **Area Defense Screen** | 8 | Laser PD Efficiency III, Phased Array Performance II | Covers a volume of space, not just the host ship. Protects nearby friendlies. |
| Area Defense Range I-V | 10 | Area Defense Screen | |
| **TN Interception Field** | 14 | Area Defense Range IV, TN Field Theory III | Disrupts incoming TN-propelled ordnance by interfering with their drive fields. |

## 5. Armor & Shields

| Tech | Rank | Prerequisites | Description |
|------|------|--------------|-------------|
| **Conventional Armor** | 1 | — | Standard metal plating. |
| Armor Thickness I-V | 2 | Conventional Armor | More protection, more mass. |
| **Duranium Armor** | 3 | TN Materials I | TN-alloy plating. Superior strength-to-weight. |
| Duranium Armor Quality I-V | 4 | Duranium Armor | |
| **Neutronium Armor** | 6 | Duranium Armor Quality III, TN Materials III | Extreme density armor. Best physical protection possible. Very heavy. |
| Neutronium Armor Quality I-V | 8 | Neutronium Armor | |
| **Radiation Shielding** | 2 | Conventional Armor | Protection from stellar radiation, nuclear weapons. |
| Rad Shield Quality I-V | 3 | Radiation Shielding | |
| **EM Shield** | 8 | Magnetic Containment IV, Fusion Reactor Efficiency III | Energy barrier. Absorbs energy weapon damage. Regenerates. Draws power. |
| Shield Strength I-V | 10 | EM Shield | |
| Shield Regeneration I-V | 10 | EM Shield | |
| **TN Barrier** | 14 | Shield Strength IV, TN Field Theory III | TN field that deflects both kinetic and energy attacks. Capstone defense. |
| TN Barrier Quality I-V | 16 | TN Barrier | |

---

## Scale Summary

| Section | Base Techs | Refinement Lines | Approx Nodes |
|---------|-----------|-----------------|-------------|
| Energy Weapons | 4 | 6 × V tiers | ~34 |
| Kinetic Weapons | 4 | 5 × V tiers | ~29 |
| Missiles | 6 | 7 × V tiers | ~41 |
| Point Defense | 4 | 4 × V tiers | ~24 |
| Armor & Shields | 6 | 6 × V tiers | ~36 |
| **Domain Total** | **~24** | **~28 lines** | **~164** |

**Needs expansion:** Energy weapons should have Aurora-scale wavelength progressions (11 tiers), focal size progressions (12+ tiers), turret tracking speeds, spinal mounts, and plasma variants. Kinetic weapons need more caliber options and ammunition types. Missiles need size classes, launcher types, and warhead variants. Armor needs more TNE-alloy types.
