use drift_math::ship_design_calc::*;

// ---------------------------------------------------------------------------
// Expected types the production module must export:
//
//   struct EngineTierDef { id, name, base_accel_g, base_isp_s, base_mass_per_hs,
//                          prerequisite_tech: Option<String> }
//
//   struct ComponentDef  { id, name, category: ComponentCategory, mass_kg,
//                          description, prerequisite_tech: Option<String>,
//                          fuel_capacity_kg: Option<f64>,
//                          cargo_capacity_kg: Option<f64>,
//                          crew_capacity: Option<u32>,
//                          supplies_capacity: Option<u32>,
//                          sensor_bonus: Option<f64>,
//                          armor_hp: Option<u32> }
//
//   enum ComponentCategory { Bridge, CrewQuarters, FuelTank, CargoBay,
//                             MaintenanceBay, SensorSuite, Armor }
//
//   struct EngineDesign { id, name, tier_id, power_pct, size_hs,
//                         accel_g, isp_s, mass_kg, fuel_mod, is_commercial }
//
//   struct ShipDesignComponent { component_id: String, count: u32 }
//
//   struct EngineStats { accel_g, isp_s, mass_kg, fuel_mod, is_commercial }
//
//   struct ShipStats { dry_mass_kg, fuel_capacity_kg, cargo_capacity_kg,
//                      crew_capacity, max_supplies, sensor_multiplier,
//                      accel_g, isp_s, armor_hp }
//
//   struct ValidationResult { valid: bool, errors: Vec<String> }
//
//   fn find_engine_tier(id: &str) -> Option<&'static EngineTierDef>
//   fn find_component(id: &str)   -> Option<&'static ComponentDef>
//   fn get_unlocked_engine_tiers(researched: &HashSet<&str>) -> Vec<&'static EngineTierDef>
//   fn get_unlocked_components(researched: &HashSet<&str>)   -> Vec<&'static ComponentDef>
//   fn compute_engine_stats(tier: &EngineTierDef, power_pct: f64, size_hs: f64) -> EngineStats
//   fn compute_ship_stats(engine: &EngineDesign, engine_count: u32,
//                         components: &[ShipDesignComponent]) -> ShipStats
//   fn validate_ship_design(engine_count: u32,
//                            components: &[ShipDesignComponent]) -> ValidationResult
// ---------------------------------------------------------------------------

use std::collections::HashSet;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn require_tier(id: &str) -> &'static EngineTierDef {
    find_engine_tier(id).unwrap_or_else(|| panic!("Engine tier not found: {id}"))
}

fn require_component(id: &str) -> &'static ComponentDef {
    find_component(id).unwrap_or_else(|| panic!("Component not found: {id}"))
}

fn make_engine_design() -> EngineDesign {
    let tier = require_tier("conventional");
    let stats = compute_engine_stats(tier, 100.0, 10.0);
    EngineDesign {
        id: "eng-1".to_string(),
        name: "Test Engine".to_string(),
        tier_id: "conventional".to_string(),
        power_pct: 100.0,
        size_hs: 10.0,
        accel_g: stats.accel_g,
        isp_s: stats.isp_s,
        mass_kg: stats.mass_kg,
        fuel_mod: stats.fuel_mod,
        is_commercial: stats.is_commercial,
    }
}

// Basic explorer: bridge + crew + fuel + maintenance + sensor
fn explorer_components() -> Vec<ShipDesignComponent> {
    vec![
        ShipDesignComponent {
            component_id: "bridge-standard".to_string(),
            count: 1,
        },
        ShipDesignComponent {
            component_id: "crew-small".to_string(),
            count: 1,
        },
        ShipDesignComponent {
            component_id: "fuel-standard".to_string(),
            count: 1,
        },
        ShipDesignComponent {
            component_id: "maint-basic".to_string(),
            count: 1,
        },
        ShipDesignComponent {
            component_id: "sensor-basic".to_string(),
            count: 1,
        },
    ]
}

// ---------------------------------------------------------------------------
// computeEngineStats
// ---------------------------------------------------------------------------

mod compute_engine_stats {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn power_100_size_10_returns_expected_values() {
        let tier = require_tier("conventional");
        let stats = compute_engine_stats(tier, 100.0, 10.0);
        assert_eq!(stats.accel_g, 0.1);
        assert_eq!(stats.isp_s, 1_000_000.0);
        assert_eq!(stats.mass_kg, 10.0 * tier.base_mass_per_hs);
        // fuelMod = (100/100)^2.5 * (1 - 10/100) = 1.0 * 0.9 = 0.9
        assert_relative_eq!(stats.fuel_mod, 1.0_f64.powf(2.5) * 0.9, max_relative = 1e-4);
    }

    #[test]
    fn power_50_has_lower_accel_and_much_lower_fuel_modifier() {
        let tier = require_tier("conventional");
        let stats = compute_engine_stats(tier, 50.0, 10.0);
        assert_relative_eq!(stats.accel_g, 0.05, max_relative = 1e-10);
        assert_eq!(stats.isp_s, 1_000_000.0); // Isp constant per tier
        assert_relative_eq!(stats.fuel_mod, 0.5_f64.powf(2.5) * 0.9, max_relative = 1e-4);
    }

    #[test]
    fn power_150_has_higher_accel_but_exponentially_higher_fuel() {
        let tier = require_tier("conventional");
        let stats = compute_engine_stats(tier, 150.0, 10.0);
        assert_relative_eq!(stats.accel_g, 0.15, max_relative = 1e-10);
        assert_relative_eq!(stats.fuel_mod, 1.5_f64.powf(2.5) * 0.9, max_relative = 1e-4);
    }

    #[test]
    fn larger_engine_size_reduces_fuel_modifier() {
        let tier = require_tier("conventional");
        let stats10 = compute_engine_stats(tier, 100.0, 10.0);
        let stats30 = compute_engine_stats(tier, 100.0, 30.0);
        assert!(stats30.fuel_mod < stats10.fuel_mod);
        assert!(stats30.mass_kg > stats10.mass_kg);
    }
}

// ---------------------------------------------------------------------------
// computeShipStats — basic explorer
// ---------------------------------------------------------------------------

mod compute_ship_stats_basic_explorer {
    use super::*;
    use approx::assert_relative_eq;

    // bridge(500) + crew-small(1000) + fuel-standard(1000) + maint-basic(800) + sensor-basic(300) = 3600
    // + engine(3000) = 6600 dry mass

    #[test]
    fn dry_mass_kg_sums_all_component_masses_plus_engine_mass() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        let component_mass = 500.0 + 1_000.0 + 1_000.0 + 800.0 + 300.0; // 3600
        assert_eq!(stats.dry_mass_kg, component_mass + engine.mass_kg);
    }

    #[test]
    fn fuel_capacity_kg_matches_fuel_standard() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        let fuel_cap = require_component("fuel-standard")
            .fuel_capacity_kg
            .unwrap_or(0.0);
        assert_eq!(stats.fuel_capacity_kg, fuel_cap);
    }

    #[test]
    fn crew_capacity_matches_crew_small() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        let expected = require_component("crew-small").crew_capacity.unwrap_or(0);
        assert_eq!(stats.crew_capacity, expected);
    }

    #[test]
    fn max_supplies_matches_maint_basic() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        let expected = require_component("maint-basic")
            .supplies_capacity
            .unwrap_or(0);
        assert_eq!(stats.max_supplies, expected);
    }

    #[test]
    fn sensor_multiplier_matches_sensor_basic_bonus() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        let expected = require_component("sensor-basic")
            .sensor_bonus
            .unwrap_or(0.0);
        assert_eq!(stats.sensor_multiplier, expected);
    }

    #[test]
    fn cargo_capacity_kg_is_0_with_no_cargo_bay() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        assert_eq!(stats.cargo_capacity_kg, 0.0);
    }

    #[test]
    fn armor_hp_is_0_with_no_armor() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        assert_eq!(stats.armor_hp, 0);
    }

    #[test]
    fn isp_s_equals_engine_isp_s() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &explorer_components());
        assert_eq!(stats.isp_s, engine.isp_s);
    }

    #[test]
    fn accel_g_identity_single_engine_ship_where_dry_mass_equals_engine_mass() {
        // A ship with zero component mass has dryMass = engineMass, so accelG = engineAccelG.
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 1, &[]);
        assert_relative_eq!(stats.accel_g, engine.accel_g, max_relative = 1e-10);
    }
}

// ---------------------------------------------------------------------------
// computeShipStats — tanker fuel stacking
// ---------------------------------------------------------------------------

mod compute_ship_stats_tanker_fuel_stacking {
    use super::*;

    #[test]
    fn two_standard_fuel_tanks_double_fuel_capacity_kg() {
        let engine = make_engine_design();
        let fuel_cap = require_component("fuel-standard")
            .fuel_capacity_kg
            .unwrap_or(0.0);
        let tanker_components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 2,
            },
        ];
        let stats = compute_ship_stats(&engine, 1, &tanker_components);
        assert_eq!(stats.fuel_capacity_kg, fuel_cap * 2.0);
    }

    #[test]
    fn mixed_fuel_tanks_sum_correctly() {
        let engine = make_engine_design();
        let small_cap = require_component("fuel-small")
            .fuel_capacity_kg
            .unwrap_or(0.0);
        let standard_cap = require_component("fuel-standard")
            .fuel_capacity_kg
            .unwrap_or(0.0);
        let components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 1,
            },
        ];
        let stats = compute_ship_stats(&engine, 1, &components);
        assert_eq!(stats.fuel_capacity_kg, small_cap + standard_cap);
    }
}

// ---------------------------------------------------------------------------
// computeShipStats — multi-engine accel scaling
// ---------------------------------------------------------------------------

mod compute_ship_stats_multi_engine_accel_scaling {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn doubling_engine_count_increases_accel_g() {
        let engine = make_engine_design();
        let stats1 = compute_ship_stats(&engine, 1, &explorer_components());
        let stats2 = compute_ship_stats(&engine, 2, &explorer_components());
        assert!(stats2.accel_g > stats1.accel_g);
    }

    #[test]
    fn accel_g_formula_engine_accel_g_times_engine_mass_kg_times_count_div_dry_mass_kg() {
        let engine = make_engine_design();
        let engine_count = 3u32;
        let stats = compute_ship_stats(&engine, engine_count, &explorer_components());
        let component_mass = 500.0 + 1_000.0 + 1_000.0 + 800.0 + 300.0;
        let dry_mass = component_mass + engine.mass_kg * engine_count as f64;
        let expected = (engine.accel_g * engine.mass_kg * engine_count as f64) / dry_mass;
        assert_relative_eq!(stats.accel_g, expected, max_relative = 1e-10);
    }
}

// ---------------------------------------------------------------------------
// computeShipStats — sensor multiplier
// ---------------------------------------------------------------------------

mod compute_ship_stats_sensor_multiplier {
    use super::*;

    #[test]
    fn takes_the_best_sensor_bonus_not_the_sum() {
        let engine = make_engine_design();
        let basic_bonus = require_component("sensor-basic")
            .sensor_bonus
            .unwrap_or(0.0);
        let improved_bonus = require_component("sensor-improved")
            .sensor_bonus
            .unwrap_or(0.0);
        let components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "sensor-basic".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "sensor-improved".to_string(),
                count: 1,
            },
        ];
        let stats = compute_ship_stats(&engine, 1, &components);
        // Should be max(1.0, 1.5) = 1.5, not 1.0 + 1.5 = 2.5
        assert_eq!(stats.sensor_multiplier, improved_bonus);
        assert_ne!(stats.sensor_multiplier, basic_bonus + improved_bonus);
    }
}

// ---------------------------------------------------------------------------
// validateShipDesign — valid design
// ---------------------------------------------------------------------------

mod validate_ship_design_valid {
    use super::*;

    #[test]
    fn valid_design_with_bridge_crew_and_fuel_passes() {
        let result = validate_ship_design(1, &explorer_components());
        assert!(result.valid);
        assert!(result.errors.is_empty());
    }
}

// ---------------------------------------------------------------------------
// validateShipDesign — missing bridge
// ---------------------------------------------------------------------------

mod validate_ship_design_missing_bridge {
    use super::*;

    #[test]
    fn fails_when_no_bridge_component_is_present() {
        let components = vec![
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 1,
            },
        ];
        let result = validate_ship_design(1, &components);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.to_lowercase().contains("bridge")));
    }

    #[test]
    fn fails_when_two_bridges_are_present() {
        let components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 2,
            },
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 1,
            },
        ];
        let result = validate_ship_design(1, &components);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.to_lowercase().contains("bridge")));
    }
}

// ---------------------------------------------------------------------------
// validateShipDesign — missing crew
// ---------------------------------------------------------------------------

mod validate_ship_design_missing_crew {
    use super::*;

    #[test]
    fn fails_when_no_crew_quarters_component_is_present() {
        let components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "fuel-standard".to_string(),
                count: 1,
            },
        ];
        let result = validate_ship_design(1, &components);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.to_lowercase().contains("crew")));
    }
}

// ---------------------------------------------------------------------------
// validateShipDesign — missing fuel
// ---------------------------------------------------------------------------

mod validate_ship_design_missing_fuel {
    use super::*;

    #[test]
    fn fails_when_no_fuel_tank_component_is_present() {
        let components = vec![
            ShipDesignComponent {
                component_id: "bridge-standard".to_string(),
                count: 1,
            },
            ShipDesignComponent {
                component_id: "crew-small".to_string(),
                count: 1,
            },
        ];
        let result = validate_ship_design(1, &components);
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.to_lowercase().contains("fuel")));
    }
}

// ---------------------------------------------------------------------------
// validateShipDesign — zero engines
// ---------------------------------------------------------------------------

mod validate_ship_design_zero_engines {
    use super::*;

    #[test]
    fn fails_when_engine_count_is_0() {
        let result = validate_ship_design(0, &explorer_components());
        assert!(!result.valid);
        assert!(result
            .errors
            .iter()
            .any(|e| e.to_lowercase().contains("engine")));
    }
}

// ---------------------------------------------------------------------------
// getUnlockedEngineTiers
// ---------------------------------------------------------------------------

mod get_unlocked_engine_tiers {
    use super::*;

    #[test]
    fn empty_tech_set_returns_only_conventional() {
        let tiers = get_unlocked_engine_tiers(&HashSet::new());
        assert_eq!(tiers.len(), 1);
        assert_eq!(tiers[0].id, "conventional");
    }

    #[test]
    fn with_nuclear_pulse_engine_unlocked_returns_conventional_and_nuclear_pulse() {
        let techs: HashSet<&str> = ["nuclear-pulse-engine"].iter().copied().collect();
        let tiers = get_unlocked_engine_tiers(&techs);
        let ids: Vec<&str> = tiers.iter().map(|t| t.id).collect();
        assert!(ids.contains(&"conventional"));
        assert!(ids.contains(&"nuclear-pulse"));
        assert_eq!(tiers.len(), 2);
    }

    #[test]
    fn all_prereqs_unlocked_returns_all_tiers() {
        let techs: HashSet<&str> = [
            "nuclear-pulse-engine",
            "ion-drive",
            "magneto-drive",
            "icf-drive",
            "mcf-drive",
            "plasma-drive",
            "am-solid-drive",
            "am-gas-drive",
            "am-plasma-drive",
            "am-beam-drive",
            "gravity-drive",
            "photonic-drive",
        ]
        .iter()
        .copied()
        .collect();
        let tiers = get_unlocked_engine_tiers(&techs);
        assert!(tiers.len() > 4);
    }
}

// ---------------------------------------------------------------------------
// getUnlockedComponents
// ---------------------------------------------------------------------------

mod get_unlocked_components {
    use super::*;

    #[test]
    fn empty_tech_set_returns_only_base_components_no_prereq() {
        let components = get_unlocked_components(&HashSet::new());
        assert!(components.iter().all(|c| c.prerequisite_tech.is_none()));
        let ids: Vec<&str> = components.iter().map(|c| c.id).collect();
        assert!(ids.contains(&"bridge-standard"));
        assert!(ids.contains(&"crew-small"));
        assert!(ids.contains(&"fuel-standard"));
        assert!(ids.contains(&"sensor-basic"));
    }

    #[test]
    fn tech_gated_components_are_excluded_without_the_prereq() {
        let components = get_unlocked_components(&HashSet::new());
        let ids: Vec<&str> = components.iter().map(|c| c.id).collect();
        assert!(!ids.contains(&"crew-large")); // requires closed-cycle-life-support
        assert!(!ids.contains(&"sensor-improved")); // requires advanced-telemetry
    }

    #[test]
    fn tech_gated_component_is_included_once_its_prereq_is_researched() {
        let techs: HashSet<&str> = ["advanced-telemetry"].iter().copied().collect();
        let components = get_unlocked_components(&techs);
        let ids: Vec<&str> = components.iter().map(|c| c.id).collect();
        assert!(ids.contains(&"sensor-improved"));
    }
}

// ---------------------------------------------------------------------------
// computeShipStats — zero dryMass guard
// ---------------------------------------------------------------------------

mod compute_ship_stats_zero_dry_mass_guard {
    use super::*;

    #[test]
    fn returns_accel_g_0_when_engine_count_is_0_and_no_components() {
        let engine = make_engine_design();
        let stats = compute_ship_stats(&engine, 0, &[]);
        assert_eq!(stats.accel_g, 0.0);
        assert_eq!(stats.dry_mass_kg, 0.0);
    }
}
