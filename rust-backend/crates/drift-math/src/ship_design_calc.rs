// Engine/ship stat derivation — ported from src/math/ship-design-calc.ts

use std::collections::HashSet;

// ---------------------------------------------------------------------------
// Engine tier definitions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct EngineTierDef {
    pub id: &'static str,
    pub name: &'static str,
    pub base_accel_g: f64,
    pub base_isp_s: f64,
    pub base_mass_per_hs: f64,
    pub prerequisite_tech: Option<&'static str>,
}

pub static ENGINE_TIER_DEFS: &[EngineTierDef] = &[
    EngineTierDef {
        id: "conventional",
        name: "Nuclear Thermal Engine",
        base_accel_g: 0.1,
        base_isp_s: 1_000_000.0,
        base_mass_per_hs: 60.0,
        prerequisite_tech: None,
    },
    EngineTierDef {
        id: "nuclear-pulse",
        name: "Nuclear Pulse Engine",
        base_accel_g: 0.3,
        base_isp_s: 800_000.0,
        base_mass_per_hs: 70.0,
        prerequisite_tech: Some("nuclear-pulse-engine"),
    },
    EngineTierDef {
        id: "ion-drive",
        name: "Ion Drive",
        base_accel_g: 0.02,
        base_isp_s: 5_000_000.0,
        base_mass_per_hs: 40.0,
        prerequisite_tech: Some("ion-drive"),
    },
    EngineTierDef {
        id: "magneto-drive",
        name: "Magnetospheric Drive",
        base_accel_g: 0.08,
        base_isp_s: 100_000_000.0,
        base_mass_per_hs: 50.0,
        prerequisite_tech: Some("magneto-drive"),
    },
    EngineTierDef {
        id: "icf-drive",
        name: "ICF Drive",
        base_accel_g: 1.0,
        base_isp_s: 3_000_000.0,
        base_mass_per_hs: 75.0,
        prerequisite_tech: Some("icf-drive"),
    },
    EngineTierDef {
        id: "mcf-drive",
        name: "MCF Drive",
        base_accel_g: 2.0,
        base_isp_s: 4_000_000.0,
        base_mass_per_hs: 80.0,
        prerequisite_tech: Some("mcf-drive"),
    },
    EngineTierDef {
        id: "plasma-drive",
        name: "Plasma Drive",
        base_accel_g: 5.0,
        base_isp_s: 6_000_000.0,
        base_mass_per_hs: 90.0,
        prerequisite_tech: Some("plasma-drive"),
    },
    EngineTierDef {
        id: "am-solid",
        name: "AM Solid-Core Drive",
        base_accel_g: 10.0,
        base_isp_s: 8_000_000.0,
        base_mass_per_hs: 100.0,
        prerequisite_tech: Some("am-solid-drive"),
    },
    EngineTierDef {
        id: "am-gas",
        name: "AM Gas-Core Drive",
        base_accel_g: 20.0,
        base_isp_s: 9_000_000.0,
        base_mass_per_hs: 110.0,
        prerequisite_tech: Some("am-gas-drive"),
    },
    EngineTierDef {
        id: "am-plasma",
        name: "AM Plasma-Core Drive",
        base_accel_g: 40.0,
        base_isp_s: 10_000_000.0,
        base_mass_per_hs: 120.0,
        prerequisite_tech: Some("am-plasma-drive"),
    },
    EngineTierDef {
        id: "am-beam",
        name: "AM Beam-Core Drive",
        base_accel_g: 15.0,
        base_isp_s: 15_000_000.0,
        base_mass_per_hs: 95.0,
        prerequisite_tech: Some("am-beam-drive"),
    },
    EngineTierDef {
        id: "gravity-drive",
        name: "Gravity Drive",
        base_accel_g: 5.0,
        base_isp_s: 100_000_000.0,
        base_mass_per_hs: 100.0,
        prerequisite_tech: Some("gravity-drive"),
    },
    EngineTierDef {
        id: "photonic-drive",
        name: "Photonic Drive",
        base_accel_g: 0.5,
        base_isp_s: 100_000_000.0,
        base_mass_per_hs: 80.0,
        prerequisite_tech: Some("photonic-drive"),
    },
];

/// Returns the conventional (no-prereq) engine tier.
pub fn conventional_tier() -> &'static EngineTierDef {
    // Safety: ENGINE_TIER_DEFS always starts with "conventional".
    &ENGINE_TIER_DEFS[0]
}

pub fn find_engine_tier(id: &str) -> Option<&'static EngineTierDef> {
    ENGINE_TIER_DEFS.iter().find(|t| t.id == id)
}

pub fn get_unlocked_engine_tiers(researched: &HashSet<&str>) -> Vec<&'static EngineTierDef> {
    ENGINE_TIER_DEFS
        .iter()
        .filter(|t| match t.prerequisite_tech {
            None => true,
            Some(tech) => researched.contains(tech),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Component definitions
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ComponentCategory {
    Bridge,
    CrewQuarters,
    FuelTank,
    CargoBay,
    MaintenanceBay,
    SensorSuite,
    Armor,
}

#[derive(Debug, Clone)]
pub struct ComponentDef {
    pub id: &'static str,
    pub name: &'static str,
    pub category: ComponentCategory,
    pub mass_kg: f64,
    pub description: &'static str,
    pub prerequisite_tech: Option<&'static str>,
    pub fuel_capacity_kg: Option<f64>,
    pub cargo_capacity_kg: Option<f64>,
    pub crew_capacity: Option<u32>,
    pub supplies_capacity: Option<u32>,
    pub sensor_bonus: Option<f64>,
    pub armor_hp: Option<u32>,
}

pub static COMPONENT_DEFS: &[ComponentDef] = &[
    // Bridge
    ComponentDef {
        id: "bridge-standard",
        name: "Standard Bridge",
        category: ComponentCategory::Bridge,
        mass_kg: 500.0,
        description: "Command and control center required on every vessel.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    // Crew Quarters
    ComponentDef {
        id: "crew-small",
        name: "Small Crew Quarters",
        category: ComponentCategory::CrewQuarters,
        mass_kg: 1_000.0,
        description: "Compact bunk arrangements for a small crew complement.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: Some(25),
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "crew-standard",
        name: "Standard Crew Quarters",
        category: ComponentCategory::CrewQuarters,
        mass_kg: 2_000.0,
        description: "Full-sized quarters with mess and recreation space.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: Some(50),
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "crew-large",
        name: "Large Crew Quarters",
        category: ComponentCategory::CrewQuarters,
        mass_kg: 4_000.0,
        description: "Extended habitat module with closed-cycle life support for long missions.",
        prerequisite_tech: Some("closed-cycle-life-support"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: Some(100),
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    // Fuel Tanks
    ComponentDef {
        id: "fuel-small",
        name: "Small Fuel Tank",
        category: ComponentCategory::FuelTank,
        mass_kg: 500.0,
        description: "Compact trans-Newtonian fuel storage for short-range operations.",
        prerequisite_tech: None,
        fuel_capacity_kg: Some(25_000.0),
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "fuel-standard",
        name: "Standard Fuel Tank",
        category: ComponentCategory::FuelTank,
        mass_kg: 1_000.0,
        description: "General-purpose fuel tank suitable for most mission profiles.",
        prerequisite_tech: None,
        fuel_capacity_kg: Some(50_000.0),
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "fuel-large",
        name: "Large Fuel Tank",
        category: ComponentCategory::FuelTank,
        mass_kg: 2_000.0,
        description: "High-density storage tank enabling extended-range operations.",
        prerequisite_tech: Some("supply-optimization"),
        fuel_capacity_kg: Some(100_000.0),
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "fuel-massive",
        name: "Massive Fuel Tank",
        category: ComponentCategory::FuelTank,
        mass_kg: 3_500.0,
        description: "Fleet-scale fuel storage for tankers and long-duration expeditions.",
        prerequisite_tech: Some("fleet-logistics"),
        fuel_capacity_kg: Some(200_000.0),
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    // Cargo Bays
    ComponentDef {
        id: "cargo-small",
        name: "Small Cargo Bay",
        category: ComponentCategory::CargoBay,
        mass_kg: 500.0,
        description: "Basic pressurized hold for light cargo and consumables.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: Some(10_000.0),
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "cargo-standard",
        name: "Standard Cargo Bay",
        category: ComponentCategory::CargoBay,
        mass_kg: 1_000.0,
        description: "Modular cargo hold with standard pallet interfaces.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: Some(25_000.0),
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "cargo-large",
        name: "Large Cargo Bay",
        category: ComponentCategory::CargoBay,
        mass_kg: 2_000.0,
        description:
            "Oversized hold for bulk resource transport using advanced fabrication methods.",
        prerequisite_tech: Some("fabrication-methods"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: Some(50_000.0),
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: None,
    },
    // Maintenance Bays
    ComponentDef {
        id: "maint-basic",
        name: "Basic Maintenance Bay",
        category: ComponentCategory::MaintenanceBay,
        mass_kg: 800.0,
        description: "Essential workshop and parts locker for routine crew-performed maintenance.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: Some(50),
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "maint-advanced",
        name: "Advanced Maintenance Bay",
        category: ComponentCategory::MaintenanceBay,
        mass_kg: 1_500.0,
        description: "Expanded workshop with precision tooling for component-level repairs.",
        prerequisite_tech: Some("maintenance-doctrine"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: Some(100),
        sensor_bonus: None,
        armor_hp: None,
    },
    ComponentDef {
        id: "maint-full",
        name: "Full Maintenance Bay",
        category: ComponentCategory::MaintenanceBay,
        mass_kg: 3_000.0,
        description: "Complete depot-level facility capable of rapid refit and deep overhaul.",
        prerequisite_tech: Some("rapid-refit"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: Some(200),
        sensor_bonus: None,
        armor_hp: None,
    },
    // Sensor Suites
    ComponentDef {
        id: "sensor-basic",
        name: "Basic Survey Sensor",
        category: ComponentCategory::SensorSuite,
        mass_kg: 300.0,
        description: "Standard-resolution active and passive sensors for surface surveys.",
        prerequisite_tech: None,
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: Some(1.0),
        armor_hp: None,
    },
    ComponentDef {
        id: "sensor-improved",
        name: "Improved Survey Sensor",
        category: ComponentCategory::SensorSuite,
        mass_kg: 600.0,
        description:
            "Enhanced sensor array with improved spectral resolution and depth penetration.",
        prerequisite_tech: Some("advanced-telemetry"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: Some(1.5),
        armor_hp: None,
    },
    ComponentDef {
        id: "sensor-deep",
        name: "Deep Scan Array",
        category: ComponentCategory::SensorSuite,
        mass_kg: 1_200.0,
        description:
            "High-power synthetic aperture array capable of scanning deep subsurface deposits.",
        prerequisite_tech: Some("deep-scan-array"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: Some(2.0),
        armor_hp: None,
    },
    // Armor
    ComponentDef {
        id: "armor-light",
        name: "Light Armor Plating",
        category: ComponentCategory::Armor,
        mass_kg: 1_500.0,
        description: "Advanced metallurgy composite panels providing basic hull reinforcement.",
        prerequisite_tech: Some("advanced-metallurgy"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: Some(20),
    },
    ComponentDef {
        id: "armor-heavy",
        name: "Heavy Armor Plating",
        category: ComponentCategory::Armor,
        mass_kg: 3_000.0,
        description:
            "Nano-manufactured high-density armor for ships operating in hostile environments.",
        prerequisite_tech: Some("nano-manufacturing"),
        fuel_capacity_kg: None,
        cargo_capacity_kg: None,
        crew_capacity: None,
        supplies_capacity: None,
        sensor_bonus: None,
        armor_hp: Some(40),
    },
];

pub fn find_component(id: &str) -> Option<&'static ComponentDef> {
    COMPONENT_DEFS.iter().find(|c| c.id == id)
}

pub fn get_unlocked_components(researched: &HashSet<&str>) -> Vec<&'static ComponentDef> {
    COMPONENT_DEFS
        .iter()
        .filter(|c| match c.prerequisite_tech {
            None => true,
            Some(tech) => researched.contains(tech),
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Engine design
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct EngineDesign {
    pub id: String,
    pub name: String,
    pub tier_id: String,
    pub power_pct: f64,
    pub size_hs: f64,
    pub accel_g: f64,
    pub isp_s: f64,
    pub mass_kg: f64,
    pub fuel_mod: f64,
    pub is_commercial: bool,
}

// ---------------------------------------------------------------------------
// Ship design components
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ShipDesignComponent {
    pub component_id: String,
    pub count: u32,
}

// ---------------------------------------------------------------------------
// Computed stats types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct EngineStats {
    pub accel_g: f64,
    pub isp_s: f64,
    pub mass_kg: f64,
    pub fuel_mod: f64,
    pub is_commercial: bool,
}

#[derive(Debug, Clone)]
pub struct ShipStats {
    pub dry_mass_kg: f64,
    pub fuel_capacity_kg: f64,
    pub cargo_capacity_kg: f64,
    pub crew_capacity: u32,
    pub max_supplies: u32,
    pub sensor_multiplier: f64,
    pub accel_g: f64,
    pub isp_s: f64,
    pub armor_hp: u32,
}

#[derive(Debug, Clone)]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
}

// ---------------------------------------------------------------------------
// Computation functions
// ---------------------------------------------------------------------------

/// Compute engine stats from a tier definition, power percentage, and size in Hull Spaces.
///
/// - `accel_g` scales linearly with `power_pct`
/// - `isp_s` is constant per tier
/// - `mass_kg = size_hs * base_mass_per_hs`
/// - `fuel_mod = (power_pct/100)^2.5 * (1 - size_hs/100)`, clamped to min 0.01
/// - Commercial flag: size_hs >= 25 and power_pct <= 50; commercial engines get 0.1x fuel_mod
pub fn compute_engine_stats(tier: &EngineTierDef, power_pct: f64, size_hs: f64) -> EngineStats {
    let base_fuel_mod = ((power_pct / 100.0).powf(2.5) * (1.0 - size_hs / 100.0)).max(0.01);
    let is_commercial = size_hs >= 25.0 && power_pct <= 50.0;
    let fuel_mod = if is_commercial {
        base_fuel_mod * 0.1
    } else {
        base_fuel_mod
    };
    EngineStats {
        accel_g: tier.base_accel_g * (power_pct / 100.0),
        isp_s: tier.base_isp_s,
        mass_kg: size_hs * tier.base_mass_per_hs,
        fuel_mod,
        is_commercial,
    }
}

/// Derive all ship stats from an engine design, engine count, and component list.
///
/// Sensor bonuses take the best single value (not summed). All other capabilities
/// sum across all components.
///
/// `accel_g = (engine.accel_g * engine.mass_kg * engine_count) / dry_mass_kg`
pub fn compute_ship_stats(
    engine: &EngineDesign,
    engine_count: u32,
    components: &[ShipDesignComponent],
) -> ShipStats {
    let mut mass_kg = 0.0_f64;
    let mut fuel_capacity_kg = 0.0_f64;
    let mut cargo_capacity_kg = 0.0_f64;
    let mut crew_capacity = 0_u32;
    let mut max_supplies = 0_u32;
    let mut best_sensor_bonus = 0.0_f64;
    let mut armor_hp = 0_u32;

    for slot in components {
        if let Some(def) = find_component(&slot.component_id) {
            let n = slot.count as f64;
            mass_kg += def.mass_kg * n;
            fuel_capacity_kg += def.fuel_capacity_kg.unwrap_or(0.0) * n;
            cargo_capacity_kg += def.cargo_capacity_kg.unwrap_or(0.0) * n;
            crew_capacity += def.crew_capacity.unwrap_or(0) * slot.count;
            max_supplies += def.supplies_capacity.unwrap_or(0) * slot.count;
            armor_hp += def.armor_hp.unwrap_or(0) * slot.count;
            // Sensors: take the best single unit, not the sum
            if let Some(bonus) = def.sensor_bonus {
                if bonus > best_sensor_bonus {
                    best_sensor_bonus = bonus;
                }
            }
        }
    }

    let dry_mass_kg = mass_kg + engine.mass_kg * engine_count as f64;
    let accel_g = if dry_mass_kg > 0.0 {
        (engine.accel_g * engine.mass_kg * engine_count as f64) / dry_mass_kg
    } else {
        0.0
    };

    ShipStats {
        dry_mass_kg,
        fuel_capacity_kg,
        cargo_capacity_kg,
        crew_capacity,
        max_supplies,
        sensor_multiplier: best_sensor_bonus,
        accel_g,
        isp_s: engine.isp_s,
        armor_hp,
    }
}

/// Validate a ship design for minimum viability.
///
/// Rules:
/// - At least 1 engine
/// - Exactly 1 bridge component (total count across all bridge slots = 1)
/// - At least 1 crew-quarters component
/// - At least 1 fuel-tank component
pub fn validate_ship_design(
    engine_count: u32,
    components: &[ShipDesignComponent],
) -> ValidationResult {
    let mut errors: Vec<String> = Vec::new();

    if engine_count < 1 {
        errors.push("Ship must have at least one engine.".to_string());
    }

    let mut bridge_count: u32 = 0;
    let mut has_crew_quarters = false;
    let mut has_fuel_tank = false;

    for slot in components {
        if let Some(def) = find_component(&slot.component_id) {
            match def.category {
                ComponentCategory::Bridge => bridge_count += slot.count,
                ComponentCategory::CrewQuarters => has_crew_quarters = true,
                ComponentCategory::FuelTank => has_fuel_tank = true,
                _ => {}
            }
        }
    }

    if bridge_count != 1 {
        errors.push(format!(
            "Ship must have exactly 1 bridge (found {bridge_count})."
        ));
    }

    if !has_crew_quarters {
        errors.push("Ship must have at least one crew quarters component.".to_string());
    }

    if !has_fuel_tank {
        errors.push("Ship must have at least one fuel tank component.".to_string());
    }

    ValidationResult {
        valid: errors.is_empty(),
        errors,
    }
}
