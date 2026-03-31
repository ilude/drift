use approx::{assert_abs_diff_eq, assert_relative_eq};
use drift_math::ship_physics::*;

// Helper: build a ShipPhysicsState from a named ENGINE_TYPES entry
fn ship_from_engine(engine_id: &str, fuel_kg: f64, dry_mass_kg: f64) -> ShipPhysicsState {
    let engine = ENGINE_TYPES
        .iter()
        .find(|e| e.id == engine_id)
        .unwrap_or_else(|| panic!("Unknown engine id: {engine_id}"));
    ShipPhysicsState {
        fuel_kg,
        dry_mass_kg,
        accel_g: engine.accel_g,
        isp_s: engine.isp_s,
        fuel_mod: 1.0,
    }
}

// --- Cycle 1: Constants and conversions ---

mod constants {
    use super::*;

    #[test]
    fn au_to_km_is_149_597_870_7() {
        assert_abs_diff_eq!(AU_TO_KM, 149_597_870.7, epsilon = 0.0);
    }

    #[test]
    fn g_accel_is_standard_gravity() {
        assert_abs_diff_eq!(G_ACCEL, 9.80665, epsilon = 1e-4);
    }
}

mod mu_km_s {
    use super::*;

    #[test]
    fn returns_sun_gravitational_parameter_for_1_solar_mass() {
        let mu = mu_km_s(1.0);
        assert_relative_eq!(mu / 1e11, 1.327, epsilon = 1e-2);
    }

    #[test]
    fn scales_linearly_with_mass() {
        assert_abs_diff_eq!(mu_km_s(2.0), mu_km_s(1.0) * 2.0, epsilon = 1e5);
    }
}

mod exhaust_velocity {
    use super::*;

    #[test]
    fn chemical_engine_isp_320s_gives_approx_3139_m_per_s() {
        let ve = exhaust_velocity(320.0);
        assert_abs_diff_eq!(ve, 3138.1, epsilon = 0.5);
    }

    #[test]
    fn ion_engine_isp_3000s_gives_approx_29420_m_per_s() {
        let ve = exhaust_velocity(3000.0);
        assert_abs_diff_eq!(ve, 29420.0, epsilon = 10.0);
    }
}

// --- Cycle 2: Tsiolkovsky rocket equation ---

mod rocket_delta_v {
    use super::*;

    #[test]
    fn mass_ratio_3_with_ve_3_138_km_per_s_gives_approx_3_45_km_per_s() {
        let dv = rocket_delta_v(3.138, 30_000.0, 10_000.0);
        assert_abs_diff_eq!(dv, 3.45, epsilon = 0.05);
    }

    #[test]
    fn returns_0_when_wet_lte_dry() {
        assert_abs_diff_eq!(
            rocket_delta_v(3.138, 10_000.0, 10_000.0),
            0.0,
            epsilon = 0.0
        );
        assert_abs_diff_eq!(rocket_delta_v(3.138, 5_000.0, 10_000.0), 0.0, epsilon = 0.0);
    }

    #[test]
    fn returns_0_when_dry_mass_is_zero() {
        assert_abs_diff_eq!(rocket_delta_v(3.138, 10_000.0, 0.0), 0.0, epsilon = 0.0);
    }
}

mod fuel_required {
    use super::*;

    #[test]
    fn inverse_of_rocket_delta_v_mass_ratio_3_case() {
        let fuel = fuel_required(3.138, 10_000.0, 3.45);
        assert_abs_diff_eq!(fuel, 20_000.0, epsilon = 100.0);
    }

    #[test]
    fn returns_0_for_zero_delta_v() {
        assert_abs_diff_eq!(fuel_required(3.138, 10_000.0, 0.0), 0.0, epsilon = 0.0);
    }

    #[test]
    fn round_trip_consistency_with_rocket_delta_v() {
        let ve = 3.138;
        let wet = 50_000.0_f64;
        let dry = 15_000.0_f64;
        let dv = rocket_delta_v(ve, wet, dry);
        let fuel_calc = fuel_required(ve, dry, dv);
        assert_abs_diff_eq!(fuel_calc, wet - dry, epsilon = 0.5);
    }
}

// --- Cycle 3: Hohmann transfer math (retained for reference) ---

mod hohmann_delta_v {
    use super::*;

    #[test]
    fn earth_to_mars_approx_5_59_km_per_s_total() {
        let result = hohmann_delta_v(1.0, 1.524, 1.0);
        assert_abs_diff_eq!(result.dv_total, 5.59, epsilon = 0.05);
    }

    #[test]
    fn earth_to_jupiter_departure_burn_approx_8_79_total_approx_14_4() {
        let result = hohmann_delta_v(1.0, 5.203, 1.0);
        assert_abs_diff_eq!(result.dv_depart, 8.79, epsilon = 0.5);
        assert_abs_diff_eq!(result.dv_total, 14.4, epsilon = 0.5);
    }

    #[test]
    fn symmetry_dv_total_is_same_regardless_of_direction() {
        let outbound = hohmann_delta_v(1.0, 1.524, 1.0);
        let inbound = hohmann_delta_v(1.524, 1.0, 1.0);
        assert_relative_eq!(outbound.dv_total, inbound.dv_total, epsilon = 1e-6);
    }

    #[test]
    fn has_departure_and_arrival_components() {
        let result = hohmann_delta_v(1.0, 1.524, 1.0);
        assert!(result.dv_depart > 0.0);
        assert!(result.dv_arrive > 0.0);
        assert_abs_diff_eq!(
            result.dv_depart + result.dv_arrive,
            result.dv_total,
            epsilon = 1e-10
        );
    }
}

mod hohmann_transfer_days {
    use super::*;

    #[test]
    fn earth_to_mars_approx_259_days() {
        let days = hohmann_transfer_days(1.0, 1.524, 1.0);
        assert_abs_diff_eq!(days, 259.0, epsilon = 10.0);
    }

    #[test]
    fn earth_to_jupiter_approx_997_days() {
        let days = hohmann_transfer_days(1.0, 5.203, 1.0);
        assert_abs_diff_eq!(days, 997.0, epsilon = 10.0);
    }

    #[test]
    fn symmetry_same_time_regardless_of_direction() {
        let outbound = hohmann_transfer_days(1.0, 1.524, 1.0);
        let inbound = hohmann_transfer_days(1.524, 1.0, 1.0);
        assert_relative_eq!(outbound, inbound, epsilon = 1e-6);
    }
}

// --- Brachistochrone transfer math ---

mod brachistochrone_time {
    use super::*;

    #[test]
    fn earth_to_mars_at_20g_approx_0_42_days() {
        let accel_ms2 = 20.0 * G_ACCEL;
        let days = brachistochrone_time(1.0, 1.524, accel_ms2);
        assert_abs_diff_eq!(days, 0.42, epsilon = 0.05);
    }

    #[test]
    fn symmetry_same_time_regardless_of_direction() {
        let accel = 20.0 * G_ACCEL;
        let outbound = brachistochrone_time(1.0, 1.524, accel);
        let inbound = brachistochrone_time(1.524, 1.0, accel);
        assert_relative_eq!(outbound, inbound, epsilon = 1e-10);
    }

    #[test]
    fn higher_accel_equals_shorter_time() {
        let t20g = brachistochrone_time(1.0, 1.524, 20.0 * G_ACCEL);
        let t200g = brachistochrone_time(1.0, 1.524, 200.0 * G_ACCEL);
        assert!(t200g < t20g);
    }

    #[test]
    fn earth_to_neptune_at_20g_under_5_days() {
        let days = brachistochrone_time(1.0, 30.07, 20.0 * G_ACCEL);
        assert!(days < 5.0);
        assert!(days > 1.0);
    }
}

mod brachistochrone_delta_v {
    use super::*;

    #[test]
    fn earth_to_mars_at_20g_approx_7840_km_per_s() {
        let accel_ms2 = 20.0 * G_ACCEL;
        let dv = brachistochrone_delta_v(1.0, 1.524, accel_ms2);
        assert_abs_diff_eq!(dv, 7840.0, epsilon = 100.0);
    }

    #[test]
    fn symmetry_same_dv_regardless_of_direction() {
        let accel = 20.0 * G_ACCEL;
        let outbound = brachistochrone_delta_v(1.0, 1.524, accel);
        let inbound = brachistochrone_delta_v(1.524, 1.0, accel);
        assert_relative_eq!(outbound, inbound, epsilon = 1e-10);
    }

    #[test]
    fn higher_accel_equals_higher_delta_v() {
        let dv20g = brachistochrone_delta_v(1.0, 1.524, 20.0 * G_ACCEL);
        let dv200g = brachistochrone_delta_v(1.0, 1.524, 200.0 * G_ACCEL);
        assert!(dv200g > dv20g);
    }
}

// --- TN Engine presets ---

mod engine_types {
    use super::*;

    #[test]
    fn has_conventional_and_propulsion_ladder_entries() {
        let ids: Vec<&str> = ENGINE_TYPES.iter().map(|e| e.id).collect();
        assert!(ids.contains(&"conventional"));
        assert!(ids.contains(&"nuclear-pulse"));
        assert!(ids.contains(&"ion-drive"));
        assert!(ids.contains(&"am-plasma"));
        assert!(ids.contains(&"photonic-drive"));
    }

    #[test]
    fn each_engine_has_required_fields() {
        for engine in ENGINE_TYPES.iter() {
            assert!(
                !engine.id.is_empty(),
                "id should be non-empty for {}",
                engine.id
            );
            assert!(
                !engine.name.is_empty(),
                "name should be non-empty for {}",
                engine.id
            );
            assert!(
                engine.accel_g > 0.0,
                "accel_g should be > 0 for {}",
                engine.id
            );
            assert!(engine.isp_s > 0.0, "isp_s should be > 0 for {}", engine.id);
            assert!(
                engine.dry_mass_kg > 0.0,
                "dry_mass_kg should be > 0 for {}",
                engine.id
            );
        }
    }

    #[test]
    fn conventional_has_0_1g_accel_and_am_plasma_has_highest_thrust() {
        let conventional = ENGINE_TYPES
            .iter()
            .find(|e| e.id == "conventional")
            .unwrap();
        let am_plasma = ENGINE_TYPES.iter().find(|e| e.id == "am-plasma").unwrap();
        assert_abs_diff_eq!(conventional.accel_g, 0.1, epsilon = 0.0);
        assert_abs_diff_eq!(am_plasma.accel_g, 40.0, epsilon = 0.0);
    }
}

// --- Transfer feasibility with brachistochrone ---

mod check_transfer {
    use super::*;

    #[test]
    fn earth_to_mars_with_conventional_tn_feasible_under_10_days() {
        let ship = ship_from_engine("conventional", 500_000.0, 5_000.0);
        let result = check_transfer(1.0, 1.524, 1.0, &ship);
        assert!(result.feasible);
        assert!(result.transfer_days < 10.0);
        assert_abs_diff_eq!(result.delta_v_required, 555.0, epsilon = 100.0);
    }

    #[test]
    fn earth_to_neptune_with_am_plasma_feasible_under_5_days() {
        let ship = ship_from_engine("am-plasma", 500_000.0, 5_000.0);
        let result = check_transfer(1.0, 30.07, 1.0, &ship);
        assert!(result.feasible);
        assert!(result.transfer_days < 5.0);
    }

    #[test]
    fn infeasible_with_near_zero_fuel() {
        let ship = ship_from_engine("conventional", 1.0, 5_000.0);
        let result = check_transfer(1.0, 1.524, 1.0, &ship);
        assert!(!result.feasible);
    }

    #[test]
    fn fuel_consumed_matches_fuel_required_for_same_delta_v() {
        let ship = ship_from_engine("conventional", 500_000.0, 5_000.0);
        let result = check_transfer(1.0, 1.524, 1.0, &ship);
        let engine = ENGINE_TYPES
            .iter()
            .find(|e| e.id == "conventional")
            .unwrap();
        let ve_km_s = exhaust_velocity(engine.isp_s) / 1000.0;
        let expected_fuel = fuel_required(ve_km_s, ship.dry_mass_kg, result.delta_v_required);
        assert_abs_diff_eq!(result.fuel_used_kg, expected_fuel, epsilon = 1e-6);
    }

    #[test]
    fn high_isp_engines_have_low_fuel_fraction() {
        let ship = ship_from_engine("am-plasma", 500_000.0, 5_000.0);
        let result = check_transfer(1.0, 30.07, 1.0, &ship);
        assert!(result.feasible);
        assert!(result.fuel_used_kg < ship.fuel_kg * 0.5);
    }
}

// --- Fuel cost model ---

mod compute_total_fuel_cost {
    use super::*;

    const DIST_KM: f64 = 1.0 * AU_TO_KM;

    #[test]
    fn returns_additive_fuel_cost_rocket_plus_operational_burn() {
        let cost = compute_total_fuel_cost(DIST_KM, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        assert!(cost.rocket_fuel_kg > 0.0);
        assert!(cost.op_burn_kg > 0.0);
        assert_abs_diff_eq!(
            cost.total_fuel_kg,
            cost.rocket_fuel_kg + cost.op_burn_kg,
            epsilon = 1e-6
        );
        assert!(cost.transfer_days > 0.0);
    }

    #[test]
    fn operational_burn_scales_with_op_burn_rate_and_transfer_days() {
        let cost = compute_total_fuel_cost(DIST_KM, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        let expected_op = OP_BURN_RATE * 50_000.0 * cost.transfer_days;
        assert_abs_diff_eq!(cost.op_burn_kg, expected_op, epsilon = 1e-6);
    }

    #[test]
    fn op_burn_multiplier_greater_than_1_reduces_operational_burn() {
        let base = compute_total_fuel_cost(DIST_KM, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        let hard = compute_total_fuel_cost(DIST_KM, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 2.0, 1.0);
        assert_abs_diff_eq!(hard.op_burn_kg, base.op_burn_kg / 2.0, epsilon = 1e-6);
    }

    #[test]
    fn hundred_day_trip_costs_approx_10_percent_capacity_in_op_burn() {
        // T = 2*sqrt(d/a), d = (T/2)^2 * a, T=100d=8.64e6s, a=0.981
        let t_seconds = 100.0 * 86400.0_f64;
        let a_ms2 = 0.1 * G_ACCEL;
        let d_meters = (t_seconds / 2.0).powi(2) * a_ms2;
        let dist_km100 = d_meters / 1000.0;
        let cost =
            compute_total_fuel_cost(dist_km100, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        assert_abs_diff_eq!(cost.transfer_days, 100.0, epsilon = 0.5);
        // Op burn should be ~10% of capacity, not 100%
        assert_abs_diff_eq!(cost.op_burn_kg / 50_000.0, 0.1, epsilon = 0.05);
    }

    #[test]
    fn high_g_transfer_has_higher_op_burn_per_day_than_low_g() {
        let dist = 1.0 * AU_TO_KM;
        let high_g = compute_total_fuel_cost(dist, 10.0, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        let low_g = compute_total_fuel_cost(dist, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        let high_g_per_day = high_g.op_burn_kg / high_g.transfer_days;
        let low_g_per_day = low_g.op_burn_kg / low_g.transfer_days;
        assert!(high_g_per_day > low_g_per_day);
    }

    #[test]
    fn acceleration_stress_is_1_0_at_0_1g() {
        let dist = 1.0 * AU_TO_KM;
        let cost = compute_total_fuel_cost(dist, 0.1, 1_000_000.0, 5_000.0, 50_000.0, 1.0, 1.0);
        let expected_op = OP_BURN_RATE * 50_000.0 * cost.transfer_days;
        assert_abs_diff_eq!(cost.op_burn_kg, expected_op, epsilon = 1e-4);
    }
}

mod find_affordable_accel_g {
    use super::*;

    const DIST_KM: f64 = 1.0 * AU_TO_KM;

    #[test]
    fn returns_max_accel_when_affordable() {
        let result = find_affordable_accel_g(
            DIST_KM,
            1_000_000.0,
            5_000.0,
            50_000.0,
            0.1,
            50_000.0,
            1.0,
            1.0,
            0.001,
        );
        let r = result.expect("expected non-null result");
        assert_abs_diff_eq!(r.accel_g, 0.1, epsilon = 1e-3);
    }

    #[test]
    fn returns_none_when_even_minimum_accel_is_unaffordable() {
        let result = find_affordable_accel_g(
            DIST_KM,
            1_000_000.0,
            5_000.0,
            50_000.0,
            0.1,
            1.0,
            1.0,
            1.0,
            0.001,
        );
        assert!(result.is_none());
    }

    #[test]
    fn finds_throttled_accel_between_min_and_max_when_budget_is_tight() {
        // Use lower Isp (10,000s) where rocket fuel is significant and throttling helps
        let low_isp = 10_000.0;
        let full_cost =
            compute_total_fuel_cost(DIST_KM, 10.0, low_isp, 5_000.0, 50_000.0, 1.0, 1.0);
        // Budget is 80% of full cost — forces throttle
        let budget = full_cost.total_fuel_kg * 0.8;
        let result = find_affordable_accel_g(
            DIST_KM, low_isp, 5_000.0, 50_000.0, 10.0, budget, 1.0, 1.0, 0.001,
        );
        let r = result.expect("expected non-null result");
        assert!(r.accel_g < 10.0);
        assert!(r.accel_g > 0.001);
        assert!(r.total_fuel_kg <= budget);
        assert!(r.transfer_days > full_cost.transfer_days);
    }
}
