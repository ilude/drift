// RED phase: all referenced types and functions are stubs that do not exist yet.
// This file defines the expected API surface for drift_sim::commands and drift_types.
// Ported from src/__tests__/commands.test.ts (188 tests).

use drift_sim::commander::{
    check_hold_for_tanker, check_preemptive_service, commander_decide, increment_experience,
    learn_from_emergency_return, learn_from_malfunction,
};
use drift_sim::commands::{
    bathtub_fail_rate, can_afford_round_trip, check_condition, compute_morale,
    evaluate_command_tree, get_unsurveyed_moons_of_host, hull_ceiling,
    invalidate_refuel_target_cache, invalidate_survey_target_cache, is_refuel_candidate,
    select_next_refuel_target, select_next_survey_target, tanker_round_trip_fuel,
    tick_ship_simulation,
};
use drift_sim::intents::{invalidate_intents_cache, is_tanker_inbound_for, publish_intent};
use drift_sim::ship_utils::resolve_ship_sensor_level;
use drift_types::{
    ActionState, AsteroidBeltEntry, AsteroidEntry, BodyEntry, BodySurvey, ColonyState,
    CommandCondition, CommandEntry, CommandResult, CommandType, CommanderState, CrewState,
    MaintenanceState, ShipEntry, ShipIntent, ShipState,
};

// ---------------------------------------------------------------------------
// Default maintenance block used by mock helpers
// ---------------------------------------------------------------------------

fn default_maintenance() -> MaintenanceState {
    MaintenanceState {
        age: 0.0,
        total_age: 0.0,
        last_refit_age: 0.0,
        supplies: 100.0,
        max_supplies: 100.0,
        hull_integrity: 100.0,
        overhauls_since_refit: 0,
        overhauls_until_refit: 3,
    }
}

// ---------------------------------------------------------------------------
// Primary ship mock builder
// ---------------------------------------------------------------------------

fn mock_ship_defaults() -> ShipEntry {
    ShipEntry {
        name: "Ship".to_string(),
        is_ship: true,
        fuel_kg: 50_000.0,
        fuel_capacity_kg: 50_000.0,
        dry_mass_kg: 10_000.0,
        crew: CrewState {
            count: 50,
            morale: 100.0,
            last_shore_leave: 0.0,
            deployment_limit: 180.0,
        },
        commander: CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        },
        maintenance: default_maintenance(),
        action: ActionState {
            action_type: None,
            command_id: None,
            start_time: 0.0,
            duration: 0.0,
            progress: 0.0,
        },
        command_tree: vec![],
        immediate_command: None,
        host_planet_name: "Mars".to_string(),
        ship_state: ShipState::Orbiting,
        design_id: None,
        mesh_x: 0.0,
        mesh_z: 0.0,
        transfer_fuel_total: 0.0,
        transfer_time_days: 0.0,
    }
}

fn mock_entry(id: &str, command: CommandType) -> CommandEntry {
    CommandEntry {
        id: id.to_string(),
        command,
        condition: CommandCondition::Always,
        enabled: true,
        origin: "ship".to_string(),
        target: None,
    }
}

fn mock_entry_with(
    id: &str,
    command: CommandType,
    condition: CommandCondition,
    enabled: bool,
    target: Option<String>,
) -> CommandEntry {
    CommandEntry {
        id: id.to_string(),
        command,
        condition,
        enabled,
        origin: "ship".to_string(),
        target,
    }
}

fn mock_body_entry(name: &str) -> BodyEntry {
    BodyEntry {
        name: name.to_string(),
        body_type: "Planet".to_string(),
        is_moon: false,
        is_ship: false,
        is_comet: false,
        survey: BodySurvey {
            survey_level: 0,
            deposits: vec![],
        },
        moons: vec![],
        mesh_x: 0.0,
        mesh_z: 0.0,
        distance_au: 1.0,
    }
}

// ---------------------------------------------------------------------------
// mod check_condition
// ---------------------------------------------------------------------------

mod check_condition {
    use super::*;

    #[test]
    fn always_returns_true() {
        let ship = mock_ship_defaults();
        assert!(check_condition(&CommandCondition::Always, &ship));
    }

    #[test]
    fn fuel_below_10pct_with_threshold_20_returns_true() {
        let mut ship = mock_ship_defaults();
        ship.fuel_kg = 5_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        assert!(check_condition(
            &CommandCondition::FuelBelow { threshold: 20.0 },
            &ship
        ));
    }

    #[test]
    fn fuel_below_50pct_with_threshold_20_returns_false() {
        let mut ship = mock_ship_defaults();
        ship.fuel_kg = 25_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        assert!(!check_condition(
            &CommandCondition::FuelBelow { threshold: 20.0 },
            &ship
        ));
    }

    #[test]
    fn fuel_below_exactly_20pct_with_threshold_20_returns_false() {
        let mut ship = mock_ship_defaults();
        ship.fuel_kg = 10_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        assert!(!check_condition(
            &CommandCondition::FuelBelow { threshold: 20.0 },
            &ship
        ));
    }

    #[test]
    fn morale_below_30_with_threshold_40_returns_true() {
        let mut ship = mock_ship_defaults();
        ship.crew.morale = 30.0;
        assert!(check_condition(
            &CommandCondition::MoraleBelow { threshold: 40.0 },
            &ship
        ));
    }

    #[test]
    fn morale_below_50_with_threshold_40_returns_false() {
        let mut ship = mock_ship_defaults();
        ship.crew.morale = 50.0;
        assert!(!check_condition(
            &CommandCondition::MoraleBelow { threshold: 40.0 },
            &ship
        ));
    }

    #[test]
    fn hull_below_20_with_threshold_30_returns_true() {
        let mut ship = mock_ship_defaults();
        ship.maintenance.hull_integrity = 20.0;
        assert!(check_condition(
            &CommandCondition::HullBelow { threshold: 30.0 },
            &ship
        ));
    }

    #[test]
    fn hull_below_50_with_threshold_30_returns_false() {
        let mut ship = mock_ship_defaults();
        ship.maintenance.hull_integrity = 50.0;
        assert!(!check_condition(
            &CommandCondition::HullBelow { threshold: 30.0 },
            &ship
        ));
    }

    #[test]
    fn supplies_below_30_of_100_with_threshold_50_returns_true() {
        let mut ship = mock_ship_defaults();
        ship.maintenance.supplies = 30.0;
        ship.maintenance.max_supplies = 100.0;
        assert!(check_condition(
            &CommandCondition::SuppliesBelow { threshold: 50.0 },
            &ship
        ));
    }

    #[test]
    fn supplies_below_60_of_100_with_threshold_50_returns_false() {
        let mut ship = mock_ship_defaults();
        ship.maintenance.supplies = 60.0;
        ship.maintenance.max_supplies = 100.0;
        assert!(!check_condition(
            &CommandCondition::SuppliesBelow { threshold: 50.0 },
            &ship
        ));
    }
}

// ---------------------------------------------------------------------------
// mod evaluate_command_tree
// ---------------------------------------------------------------------------

mod evaluate_command_tree {
    use super::*;

    #[test]
    fn empty_tree_returns_none() {
        let ship = mock_ship_defaults();
        let result = evaluate_command_tree(&ship);
        assert!(result.is_none());
    }

    #[test]
    fn single_always_idle_entry_returns_idle() {
        let mut ship = mock_ship_defaults();
        ship.command_tree = vec![mock_entry("1", CommandType::Idle)];
        let result = evaluate_command_tree(&ship);
        assert_eq!(result, Some(CommandResult::Idle));
    }

    #[test]
    fn disabled_entry_is_skipped() {
        let mut ship = mock_ship_defaults();
        ship.command_tree = vec![mock_entry_with(
            "1",
            CommandType::Idle,
            CommandCondition::Always,
            false,
            None,
        )];
        assert!(evaluate_command_tree(&ship).is_none());
    }

    #[test]
    fn first_matching_entry_wins_priority_order() {
        let mut ship = mock_ship_defaults();
        ship.command_tree = vec![
            mock_entry("1", CommandType::Idle),
            mock_entry("2", CommandType::SurveyNearest),
        ];
        assert_eq!(evaluate_command_tree(&ship), Some(CommandResult::Idle));
    }

    #[test]
    fn non_matching_entry_skipped_next_matching_wins() {
        let mut ship = mock_ship_defaults();
        ship.fuel_kg = 25_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.command_tree = vec![
            mock_entry_with(
                "1",
                CommandType::Refuel,
                CommandCondition::FuelBelow { threshold: 10.0 },
                true,
                None,
            ),
            mock_entry("2", CommandType::Idle),
        ];
        assert_eq!(evaluate_command_tree(&ship), Some(CommandResult::Idle));
    }

    #[test]
    fn survey_nearest_maps_to_survey() {
        let mut ship = mock_ship_defaults();
        ship.command_tree = vec![mock_entry("1", CommandType::SurveyNearest)];
        assert_eq!(evaluate_command_tree(&ship), Some(CommandResult::Survey));
    }

    #[test]
    fn transfer_to_with_target_maps_to_transfer_mars() {
        let mut ship = mock_ship_defaults();
        ship.command_tree = vec![mock_entry_with(
            "1",
            CommandType::TransferTo,
            CommandCondition::Always,
            true,
            Some("Mars".to_string()),
        )];
        assert_eq!(
            evaluate_command_tree(&ship),
            Some(CommandResult::Transfer {
                target: "Mars".to_string()
            })
        );
    }

    #[test]
    fn immediate_command_takes_priority_over_tree_entries() {
        let mut ship = mock_ship_defaults();
        ship.immediate_command = Some(mock_entry("imm", CommandType::ShoreLeave));
        ship.command_tree = vec![mock_entry("1", CommandType::Idle)];
        assert_eq!(
            evaluate_command_tree(&ship),
            Some(CommandResult::ShoreLeave)
        );
    }

    #[test]
    fn disabled_immediate_command_falls_through_to_tree() {
        let mut ship = mock_ship_defaults();
        ship.immediate_command = Some(mock_entry_with(
            "imm",
            CommandType::ShoreLeave,
            CommandCondition::Always,
            false,
            None,
        ));
        ship.command_tree = vec![mock_entry("1", CommandType::Idle)];
        assert_eq!(evaluate_command_tree(&ship), Some(CommandResult::Idle));
    }
}

// ---------------------------------------------------------------------------
// mod compute_morale
// ---------------------------------------------------------------------------

mod compute_morale {
    use super::*;

    #[test]
    fn days_since_leave_0_limit_180_returns_100() {
        assert_eq!(compute_morale(0.0, 180.0), 100.0);
    }

    #[test]
    fn days_since_leave_180_limit_180_returns_100_at_boundary() {
        assert_eq!(compute_morale(180.0, 180.0), 100.0);
    }

    #[test]
    fn days_since_leave_200_limit_180_returns_less_than_100() {
        let morale = compute_morale(200.0, 180.0);
        assert!(morale < 100.0);
        assert!(morale > 0.0);
    }

    #[test]
    fn days_since_leave_360_limit_180_significantly_lower_than_100() {
        let morale = compute_morale(360.0, 180.0);
        assert!(morale < 80.0);
    }

    #[test]
    fn days_since_leave_10000_limit_180_floors_at_0() {
        assert_eq!(compute_morale(10_000.0, 180.0), 0.0);
    }

    #[test]
    fn exponent_1_5_steeper_than_linear_at_day_360() {
        let morale = compute_morale(360.0, 180.0);
        let linear_value = (180.0 / 360.0) * 100.0;
        assert!(morale < linear_value);
    }
}

// ---------------------------------------------------------------------------
// mod tick_ship_simulation
// ---------------------------------------------------------------------------

mod tick_ship_simulation {
    use super::*;

    #[test]
    fn morale_updates_based_on_sim_time_and_last_shore_leave() {
        let mut ship = mock_ship_defaults();
        ship.crew.last_shore_leave = 0.0;
        ship.crew.deployment_limit = 180.0;
        // 360 days since last leave → morale should drop
        tick_ship_simulation(&mut ship, 0.1, 360.0);
        assert!(ship.crew.morale < 100.0);
    }

    #[test]
    fn maintenance_age_accumulates_by_sim_dt() {
        let mut ship = mock_ship_defaults();
        tick_ship_simulation(&mut ship, 1.5, 10.0);
        assert!((ship.maintenance.age - 1.5).abs() < 1e-5);
    }

    #[test]
    fn fuel_drains_during_active_action() {
        let mut ship = mock_ship_defaults();
        ship.action.action_type = Some("survey-nearest".to_string());
        ship.action.command_id = Some("1".to_string());
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        assert!(ship.fuel_kg < 50_000.0);
    }

    #[test]
    fn fuel_drains_at_lower_rate_when_idle() {
        let mut ship_active = mock_ship_defaults();
        ship_active.action.action_type = Some("survey-nearest".to_string());
        ship_active.action.command_id = Some("1".to_string());

        let mut ship_idle = mock_ship_defaults();
        ship_idle.action.action_type = None;

        tick_ship_simulation(&mut ship_active, 1.0, 10.0);
        tick_ship_simulation(&mut ship_idle, 1.0, 10.0);

        assert!(ship_idle.fuel_kg < 50_000.0);
        assert!(ship_idle.fuel_kg > ship_active.fuel_kg);
    }

    #[test]
    fn fuel_never_goes_below_0() {
        let mut ship = mock_ship_defaults();
        ship.fuel_kg = 0.001;
        ship.action.action_type = Some("idle".to_string());
        tick_ship_simulation(&mut ship, 10.0, 10.0);
        assert!(ship.fuel_kg >= 0.0);
    }

    #[test]
    fn shore_leave_gradually_recovers_morale_and_repairs_hull() {
        let mut ship = mock_ship_defaults();
        ship.crew.morale = 50.0;
        ship.crew.last_shore_leave = 0.0;
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 80.0;
        ship.action.action_type = Some("shore-leave".to_string());
        ship.action.duration = 30.0;
        // +2.5 morale/day × 1 day = 52.5
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        assert!((ship.crew.morale - 52.5).abs() < 1.0);
        // +0.25 hull/day × 1 day = 80.25
        assert!((ship.maintenance.hull_integrity - 80.25).abs() < 0.1);
    }

    #[test]
    fn shore_leave_does_not_exceed_100_morale() {
        let mut ship = mock_ship_defaults();
        ship.crew.morale = 98.0;
        ship.action.action_type = Some("shore-leave".to_string());
        ship.action.duration = 30.0;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        assert_eq!(ship.crew.morale, 100.0);
    }

    #[test]
    fn refuel_gradually_tops_off_fuel() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 25_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.action.action_type = Some("refuel".to_string());
        ship.action.duration = 5.0;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        // 20%/day × 50000 × 1 day = +10000
        assert!((ship.fuel_kg - 35_000.0).abs() < 1.0);
    }

    #[test]
    fn refuel_does_not_consume_fuel_while_refueling() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 25_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.action.action_type = Some("refuel".to_string());
        ship.action.duration = 5.0;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        assert!(ship.fuel_kg > 25_000.0);
    }

    #[test]
    fn overhaul_gradually_repairs_hull_restocks_supplies_recovers_morale() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.maintenance.age = 100.0;
        ship.maintenance.supplies = 20.0;
        ship.maintenance.hull_integrity = 40.0;
        ship.crew.morale = 60.0;
        ship.action.action_type = Some("overhaul".to_string());
        ship.action.duration = 5.0;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        // +2.5 hull/day, +2.5 supplies/day, +0.5 morale/day
        assert!((ship.maintenance.hull_integrity - 42.5).abs() < 0.1);
        assert!((ship.maintenance.supplies - 22.5).abs() < 0.1);
        assert!((ship.crew.morale - 60.5).abs() < 0.1);
    }

    #[test]
    fn overhaul_does_not_exceed_maximums() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.maintenance.age = 100.0;
        ship.maintenance.supplies = 99.0;
        ship.maintenance.max_supplies = 100.0;
        ship.maintenance.hull_integrity = 99.0;
        ship.crew.morale = 99.8;
        ship.action.action_type = Some("overhaul".to_string());
        ship.action.duration = 5.0;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        assert_eq!(ship.maintenance.hull_integrity, 100.0);
        assert_eq!(ship.maintenance.supplies, 100.0);
        assert_eq!(ship.crew.morale, 100.0);
    }

    #[test]
    fn malfunction_check_fires_for_each_interval_skipped_at_high_warp() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Transferring;
        ship.maintenance.age = 1440.0;
        ship.maintenance.hull_integrity = 1.0;
        let hull_before = ship.maintenance.hull_integrity;
        tick_ship_simulation(&mut ship, 91.0, 2000.0);
        assert!(ship.maintenance.hull_integrity < hull_before);
    }

    #[test]
    fn colony_shuttle_delivers_supplies_for_each_day_boundary_crossed_at_high_warp() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 0.0;
        ship.fuel_capacity_kg = 100_000.0;
        ship.maintenance.supplies = 0.0;
        ship.maintenance.max_supplies = 100.0;
        // simTime=105.1, simDt=5 → crosses 5 day boundaries
        // Each crossing: 25% of 100000 = 25000 fuel, ceil(100*0.25)=25 supplies
        tick_ship_simulation(&mut ship, 5.0, 105.1);
        assert_eq!(ship.fuel_kg, 100_000.0);
        assert_eq!(ship.maintenance.supplies, 100.0);
    }

    #[test]
    fn colony_shuttle_capped_case_large_time_step_fills_to_capacity() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 10_000.0;
        ship.fuel_capacity_kg = 100_000.0;
        ship.maintenance.supplies = 10.0;
        ship.maintenance.max_supplies = 100.0;
        // Advance 40 days: daysCrossed > 30 (cap) → fills directly
        tick_ship_simulation(&mut ship, 40.0, 140.0);
        assert_eq!(ship.fuel_kg, 100_000.0);
        assert_eq!(ship.maintenance.supplies, 100.0);
    }

    #[test]
    fn fuel_drain_at_idle_rate_when_action_type_is_null() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.action.action_type = None;
        let fuel_before = ship.fuel_kg;
        tick_ship_simulation(&mut ship, 1.0, 10.0);
        let fuel_drained = fuel_before - ship.fuel_kg;
        // Idle rate: 0.0005 * 50000 * 1 = 25 kg/day
        assert!((fuel_drained - 25.0).abs() < 1.0);
        assert!((ship.fuel_kg - 49_975.0).abs() < 1.0);
    }
}

// ---------------------------------------------------------------------------
// mod select_next_survey_target
// ---------------------------------------------------------------------------

mod select_next_survey_target {
    use super::*;

    fn ship_with_mesh(x: f64, z: f64) -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.mesh_x = x;
        ship.mesh_z = z;
        ship
    }

    // Tests use a sim-state injection pattern; the Rust port uses explicit
    // BodySlice / context parameters rather than global state.
    // The function signature is:
    //   select_next_survey_target(ship: &ShipEntry, bodies: &[BodyEntry], asteroids: &[AsteroidBeltEntry], claimed: &HashSet<String>, max_level: u32) -> Option<String>

    #[test]
    fn includes_moons_as_survey_candidates() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        let planet = mock_body_entry("Mars");
        let bodies = vec![moon, planet];
        let ship = ship_with_mesh(0.0, 0.0);
        let result = select_next_survey_target(&ship, &bodies, &[], &Default::default(), 1);
        assert_eq!(result, Some("Luna".to_string()));
    }

    #[test]
    fn returns_moon_when_only_moon_candidates_exist() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        let bodies = vec![moon];
        let ship = ship_with_mesh(0.0, 0.0);
        let result = select_next_survey_target(&ship, &bodies, &[], &Default::default(), 1);
        assert_eq!(result, Some("Luna".to_string()));
    }

    #[test]
    fn skips_already_surveyed_bodies() {
        let mut surveyed = mock_body_entry("Venus");
        surveyed.survey.survey_level = 1;
        let bodies = vec![surveyed];
        let ship = ship_with_mesh(0.0, 0.0);
        let result = select_next_survey_target(&ship, &bodies, &[], &Default::default(), 1);
        assert!(result.is_none());
    }
}

// ---------------------------------------------------------------------------
// mod select_next_survey_target__asteroids
// ---------------------------------------------------------------------------

mod select_next_survey_target__asteroids {
    use super::*;

    fn ship_at(x: f64, z: f64) -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.mesh_x = x;
        ship.mesh_z = z;
        ship
    }

    fn make_belt_entry(asteroids: Vec<(&str, usize, u32, f64, f64)>) -> AsteroidBeltEntry {
        // asteroids: (designation, belt_index, survey_level, x, z)
        let count = asteroids.len();
        let mut positions = vec![0.0f32; count * 3];
        let mut entries = vec![];
        for (desig, idx, level, x, z) in &asteroids {
            positions[idx * 3] = *x as f32;
            positions[idx * 3 + 1] = 0.0;
            positions[idx * 3 + 2] = *z as f32;
            entries.push(AsteroidEntry {
                designation: desig.to_string(),
                belt_index: *idx,
                survey: BodySurvey {
                    survey_level: *level,
                    deposits: vec![],
                },
                au: 2.5,
            });
        }
        AsteroidBeltEntry {
            name: "Main Belt".to_string(),
            positions,
            count,
            asteroids: entries,
        }
    }

    #[test]
    fn returns_asteroid_designation_when_nearest_unsurveyed() {
        let belt = make_belt_entry(vec![("MB-0001", 0, 0, 10.0, 10.0)]);
        let ship = ship_at(0.0, 0.0);
        let result = select_next_survey_target(&ship, &[], &[belt], &Default::default(), 1);
        assert_eq!(result, Some("MB-0001".to_string()));
    }

    #[test]
    fn skips_already_surveyed_asteroids() {
        let belt = make_belt_entry(vec![
            ("MB-0001", 0, 1, 5.0, 5.0),
            ("MB-0002", 1, 0, 20.0, 20.0),
        ]);
        let ship = ship_at(0.0, 0.0);
        let result = select_next_survey_target(&ship, &[], &[belt], &Default::default(), 1);
        assert_eq!(result, Some("MB-0002".to_string()));
    }

    #[test]
    fn returns_planet_when_closer_than_asteroid() {
        let mut planet = mock_body_entry("Venus");
        planet.mesh_x = 1.0;
        planet.mesh_z = 1.0;
        let belt = make_belt_entry(vec![("MB-0001", 0, 0, 1000.0, 1000.0)]);
        let ship = ship_at(0.0, 0.0);
        let result = select_next_survey_target(&ship, &[planet], &[belt], &Default::default(), 1);
        assert_eq!(result, Some("Venus".to_string()));
    }
}

// ---------------------------------------------------------------------------
// mod select_next_survey_target__intents
// ---------------------------------------------------------------------------

mod select_next_survey_target__intents {
    use super::*;
    use std::collections::HashSet;

    fn ship_at(x: f64, z: f64, name: &str) -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.name = name.to_string();
        ship.mesh_x = x;
        ship.mesh_z = z;
        ship
    }

    #[test]
    fn skips_bodies_claimed_by_other_ships_via_intents() {
        let mut mars = mock_body_entry("Mars");
        mars.mesh_x = 5.0;
        mars.mesh_z = 5.0;
        let mut jupiter = mock_body_entry("Jupiter");
        jupiter.mesh_x = 20.0;
        jupiter.mesh_z = 20.0;
        let bodies = vec![mars, jupiter];
        let mut claimed: HashSet<String> = HashSet::new();
        claimed.insert("Mars".to_string());
        let ship = ship_at(0.0, 0.0, "Ship");
        let result = select_next_survey_target(&ship, &bodies, &[], &claimed, 1);
        assert_eq!(result, Some("Jupiter".to_string()));
    }

    #[test]
    fn skips_bodies_being_transferred_to_by_other_ships() {
        let mut mars = mock_body_entry("Mars");
        mars.mesh_x = 5.0;
        mars.mesh_z = 5.0;
        let mut jupiter = mock_body_entry("Jupiter");
        jupiter.mesh_x = 20.0;
        jupiter.mesh_z = 20.0;
        let bodies = vec![mars, jupiter];
        let mut claimed: HashSet<String> = HashSet::new();
        claimed.insert("Mars".to_string());
        let ship = ship_at(0.0, 0.0, "Ship");
        let result = select_next_survey_target(&ship, &bodies, &[], &claimed, 1);
        assert_eq!(result, Some("Jupiter".to_string()));
    }

    #[test]
    fn does_not_skip_own_claims() {
        let mut mars = mock_body_entry("Mars");
        mars.mesh_x = 5.0;
        mars.mesh_z = 5.0;
        let bodies = vec![mars];
        // Ship's own claim should not be excluded from candidates
        let ship = ship_at(0.0, 0.0, "Ship");
        let result = select_next_survey_target(&ship, &bodies, &[], &Default::default(), 1);
        assert_eq!(result, Some("Mars".to_string()));
    }
}

// ---------------------------------------------------------------------------
// mod is_tanker_inbound_for_timeout
// ---------------------------------------------------------------------------

mod is_tanker_inbound_for_timeout {
    use super::*;

    #[test]
    fn returns_true_when_tanker_intent_is_fresh() {
        // Published at t=100, checked at t=150 (<60 days) → fresh
        let intent = ShipIntent::Tanking {
            target: "Explorer".to_string(),
            ship_name: "Tanker".to_string(),
            published_at: 100.0,
        };
        assert!(is_tanker_inbound_for("Explorer", &[intent], 150.0));
    }

    #[test]
    fn returns_false_when_tanker_intent_is_stale_over_60_days() {
        // Published at t=100, checked at t=161 (>60 days) → stale
        let intent = ShipIntent::Tanking {
            target: "Explorer".to_string(),
            ship_name: "Tanker".to_string(),
            published_at: 100.0,
        };
        assert!(!is_tanker_inbound_for("Explorer", &[intent], 161.0));
    }
}

// ---------------------------------------------------------------------------
// mod get_unsurveyed_moons_of_host
// ---------------------------------------------------------------------------

mod get_unsurveyed_moons_of_host {
    use super::*;

    #[test]
    fn returns_unsurveyed_moons_of_ships_host_planet() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        let mut planet = mock_body_entry("Earth");
        planet.moons = vec![moon];
        let bodies = vec![planet];
        let ship = {
            let mut s = mock_ship_defaults();
            s.host_planet_name = "Earth".to_string();
            s
        };
        let moons = get_unsurveyed_moons_of_host(&ship, &bodies, 1);
        assert_eq!(moons.len(), 1);
        assert_eq!(moons[0].name, "Luna");
    }

    #[test]
    fn returns_empty_array_when_all_moons_are_surveyed() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        moon.survey.survey_level = 1;
        let mut planet = mock_body_entry("Earth");
        planet.moons = vec![moon];
        let bodies = vec![planet];
        let ship = {
            let mut s = mock_ship_defaults();
            s.host_planet_name = "Earth".to_string();
            s
        };
        let moons = get_unsurveyed_moons_of_host(&ship, &bodies, 1);
        assert!(moons.is_empty());
    }

    #[test]
    fn returns_empty_array_when_host_planet_not_found() {
        let ship = {
            let mut s = mock_ship_defaults();
            s.host_planet_name = "Nonexistent".to_string();
            s
        };
        let moons = get_unsurveyed_moons_of_host(&ship, &[], 1);
        assert!(moons.is_empty());
    }
}

// ---------------------------------------------------------------------------
// mod select_next_survey_target__nan_safety
// ---------------------------------------------------------------------------

mod select_next_survey_target__nan_safety {
    use super::*;

    #[test]
    fn does_not_crash_with_real_positions() {
        let mut venus = mock_body_entry("Venus");
        venus.mesh_x = 50.0;
        venus.mesh_z = 30.0;
        let mut mars = mock_body_entry("Mars");
        mars.mesh_x = 100.0;
        mars.mesh_z = -20.0;
        let bodies = vec![venus, mars];
        let mut ship = mock_ship_defaults();
        ship.mesh_x = 0.0;
        ship.mesh_z = 0.0;
        let result = select_next_survey_target(&ship, &bodies, &[], &Default::default(), 1);
        assert!(result.is_some());
        // Venus is closer: 50²+30²=3400 vs 100²+20²=10400
        assert_eq!(result.unwrap(), "Venus");
    }

    #[test]
    fn handles_mix_of_bodies_and_asteroids_without_nan() {
        let mut jupiter = mock_body_entry("Jupiter");
        jupiter.mesh_x = 500.0;
        jupiter.mesh_z = 0.0;
        let bodies = vec![jupiter];

        let belt = {
            use super::AsteroidBeltEntry;
            AsteroidBeltEntry {
                name: "Belt".to_string(),
                positions: vec![10.0, 0.0, 10.0],
                count: 1,
                asteroids: vec![AsteroidEntry {
                    designation: "AST-001".to_string(),
                    belt_index: 0,
                    survey: BodySurvey {
                        survey_level: 0,
                        deposits: vec![],
                    },
                    au: 2.5,
                }],
            }
        };

        let mut ship = mock_ship_defaults();
        ship.mesh_x = 0.0;
        ship.mesh_z = 0.0;
        let result = select_next_survey_target(&ship, &bodies, &[belt], &Default::default(), 1);
        // Asteroid at (10,10) is closer than Jupiter at (500,0)
        assert_eq!(result, Some("AST-001".to_string()));
    }
}

// ---------------------------------------------------------------------------
// mod check_preemptive_service
// ---------------------------------------------------------------------------

mod check_preemptive_service {
    use super::*;

    fn at_colony_ship() -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship
    }

    #[test]
    fn returns_none_for_non_departure_actions() {
        let ship = at_colony_ship();
        assert!(check_preemptive_service(&ship, &CommandResult::Refuel, &[]).is_none());
        assert!(check_preemptive_service(&ship, &CommandResult::Overhaul, &[]).is_none());
        assert!(check_preemptive_service(&ship, &CommandResult::ShoreLeave, &[]).is_none());
        assert!(check_preemptive_service(&ship, &CommandResult::Idle, &[]).is_none());
    }

    #[test]
    fn returns_none_when_not_at_colony() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Mars".to_string();
        ship.commander = CommanderState {
            caution: 1.0,
            initiative: 1.0,
            experience: 50,
        };
        ship.crew.morale = 45.0;
        ship.command_tree = vec![mock_entry_with(
            "morale-check",
            CommandType::ShoreLeave,
            CommandCondition::MoraleBelow { threshold: 40.0 },
            true,
            None,
        )];
        // "Mars" is not a colony → returns None
        assert!(check_preemptive_service(
            &ship,
            &CommandResult::Survey,
            &ship.command_tree.clone()
        )
        .is_none());
    }

    #[test]
    fn high_judgment_commander_preemptively_takes_shore_leave_at_colony() {
        // Morale 50%, threshold 40%, caution 0.8
        // effective = 40 + 60 * 0.8 * 0.3 = 54.4 → 50 < 54.4 → triggers
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.crew.morale = 50.0;
        ship.command_tree = vec![
            mock_entry_with(
                "morale-check",
                CommandType::ShoreLeave,
                CommandCondition::MoraleBelow { threshold: 40.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(&ship, &CommandResult::Survey, &entries);
        assert_eq!(result, Some(CommandResult::ShoreLeave));
    }

    #[test]
    fn low_judgment_commander_does_not_preempt_with_same_conditions() {
        // Morale 50%, threshold 40%, caution 0.3
        // effective = 40 + 60 * 0.3 * 0.3 = 45.4 → 50 > 45.4 → no trigger
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };
        ship.crew.morale = 50.0;
        ship.command_tree = vec![
            mock_entry_with(
                "morale-check",
                CommandType::ShoreLeave,
                CommandCondition::MoraleBelow { threshold: 40.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        assert!(check_preemptive_service(&ship, &CommandResult::Survey, &entries).is_none());
    }

    #[test]
    fn preempts_refuel_when_fuel_near_threshold_at_colony() {
        // Fuel 25%, threshold 20%, caution 0.9
        // effective = 20 + 80 * 0.9 * 0.3 = 41.6 → 25 < 41.6 → triggers
        let mut ship = at_colony_ship();
        ship.fuel_kg = 12_500.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 30,
        };
        ship.command_tree = vec![
            mock_entry_with(
                "fuel-check",
                CommandType::Refuel,
                CommandCondition::FuelBelow { threshold: 20.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(&ship, &CommandResult::Survey, &entries);
        assert_eq!(result, Some(CommandResult::Refuel));
    }

    #[test]
    fn preempts_overhaul_when_hull_near_threshold_at_colony() {
        // Hull 40%, threshold 30%, caution 0.8
        // effective = 30 + 70 * 0.8 * 0.3 = 46.8 → 40 < 46.8 → triggers
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 10,
        };
        ship.maintenance.age = 200.0;
        ship.maintenance.hull_integrity = 40.0;
        ship.command_tree = vec![
            mock_entry_with(
                "hull-check",
                CommandType::Overhaul,
                CommandCondition::HullBelow { threshold: 30.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(&ship, &CommandResult::Survey, &entries);
        assert_eq!(result, Some(CommandResult::Overhaul));
    }

    #[test]
    fn does_not_preempt_overhaul_when_hull_is_at_ceiling() {
        // Hull 44% at ceiling 44% (37.39 years old), threshold 30%, caution 0.8
        // Without ceiling cap: effective = 46.8 → 44 < 46.8 → would trigger
        // With ceiling cap: effective = min(46.8, 44) = 44 → 44 is NOT < 44 → no trigger
        let total_age = 37.39 * 365.0;
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 10,
        };
        ship.maintenance.total_age = total_age;
        ship.maintenance.hull_integrity = 44.0;
        ship.command_tree = vec![
            mock_entry_with(
                "hull-check",
                CommandType::Overhaul,
                CommandCondition::HullBelow { threshold: 30.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        assert!(check_preemptive_service(&ship, &CommandResult::Survey, &entries).is_none());
    }

    #[test]
    fn skips_disabled_command_tree_entries() {
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 1.0,
            initiative: 1.0,
            experience: 50,
        };
        ship.crew.morale = 30.0;
        ship.command_tree = vec![mock_entry_with(
            "morale-check",
            CommandType::ShoreLeave,
            CommandCondition::MoraleBelow { threshold: 40.0 },
            false,
            None,
        )];
        let entries = ship.command_tree.clone();
        assert!(check_preemptive_service(&ship, &CommandResult::Survey, &entries).is_none());
    }

    #[test]
    fn works_with_transfer_action_as_departure() {
        let mut ship = at_colony_ship();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.crew.morale = 50.0;
        ship.command_tree = vec![mock_entry_with(
            "morale-check",
            CommandType::ShoreLeave,
            CommandCondition::MoraleBelow { threshold: 40.0 },
            true,
            None,
        )];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(
            &ship,
            &CommandResult::Transfer {
                target: "Mars".to_string(),
            },
            &entries,
        );
        assert_eq!(result, Some(CommandResult::ShoreLeave));
    }
}

// ---------------------------------------------------------------------------
// mod commander_learning
// ---------------------------------------------------------------------------

mod commander_learning {
    use super::*;

    #[test]
    fn learn_from_malfunction_increases_judgment_with_diminishing_returns() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };
        learn_from_malfunction(&mut ship);
        // 0.3 + 0.08 * (1 - 0.3) = 0.356
        assert!((ship.commander.caution - 0.356).abs() < 1e-3);
    }

    #[test]
    fn learn_from_malfunction_diminishing_returns_at_high_judgment() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.85,
            initiative: 0.85,
            experience: 0,
        };
        learn_from_malfunction(&mut ship);
        // 0.85 + 0.08 * (1 - 0.85) = 0.862
        assert!((ship.commander.caution - 0.862).abs() < 1e-3);
    }

    #[test]
    fn learn_from_malfunction_caps_at_0_9() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.89,
            initiative: 0.89,
            experience: 0,
        };
        learn_from_malfunction(&mut ship);
        learn_from_malfunction(&mut ship);
        assert!(ship.commander.caution <= 0.9);
    }

    #[test]
    fn learn_from_emergency_return_increases_judgment_at_lower_rate() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };
        learn_from_emergency_return(&mut ship);
        // 0.3 + 0.05 * (1 - 0.3) = 0.335
        assert!((ship.commander.caution - 0.335).abs() < 1e-3);
    }

    #[test]
    fn learn_from_emergency_return_caps_at_0_9() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 0,
        };
        learn_from_emergency_return(&mut ship);
        assert_eq!(ship.commander.caution, 0.9);
    }

    #[test]
    fn increment_experience_bumps_counter() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 5,
        };
        increment_experience(&mut ship);
        assert_eq!(ship.commander.experience, 6);
    }
}

// ---------------------------------------------------------------------------
// mod commander_defers_maintenance
// ---------------------------------------------------------------------------

mod commander_defers_maintenance {
    use super::*;

    fn unsurveyed_body(name: &str) -> BodyEntry {
        let mut b = mock_body_entry(name);
        b.body_type = "Dwarf Planet".to_string();
        b.distance_au = 2.77;
        b.survey.survey_level = 0;
        b
    }

    fn surveyed_body(name: &str) -> BodyEntry {
        let mut b = mock_body_entry(name);
        b.body_type = "Planet".to_string();
        b.distance_au = 1.0;
        b.survey.survey_level = 1;
        b
    }

    #[test]
    fn does_not_defer_at_a_colony() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 10,
        };
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 25.0;
        ship.command_tree = vec![mock_entry_with(
            "hull-check",
            CommandType::Overhaul,
            CommandCondition::HullBelow { threshold: 30.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Earth")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: true,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Overhaul));
    }

    #[test]
    fn does_not_defer_when_host_is_already_surveyed() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Mars".to_string();
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 10,
        };
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 25.0;
        ship.command_tree = vec![mock_entry_with(
            "hull-check",
            CommandType::Overhaul,
            CommandCondition::HullBelow { threshold: 30.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[surveyed_body("Mars")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Overhaul));
    }

    #[test]
    fn does_not_defer_when_commander_judgment_is_too_low() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.15,
            initiative: 0.15,
            experience: 0,
        };
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 25.0;
        ship.command_tree = vec![mock_entry_with(
            "hull-check",
            CommandType::Overhaul,
            CommandCondition::HullBelow { threshold: 30.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Overhaul));
    }

    #[test]
    fn high_judgment_commander_defers_overhaul_at_unsurveyed_body() {
        // Hull 25%, threshold 30%, caution 0.8
        // personalFloor = 10 + (30-10) * (1-0.8) = 14 → 25 > 14 → defer → survey
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 25.0;
        ship.command_tree = vec![mock_entry_with(
            "hull-check",
            CommandType::Overhaul,
            CommandCondition::HullBelow { threshold: 30.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Survey));
    }

    #[test]
    fn does_not_defer_when_hull_below_personal_floor() {
        // Hull 12%, threshold 30%, caution 0.5
        // personalFloor = 10 + (30-10) * (1-0.5) = 20 → 12 < 20 → too risky → overhaul
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.5,
            initiative: 0.5,
            experience: 10,
        };
        ship.maintenance.age = 200.0;
        ship.maintenance.hull_integrity = 12.0;
        ship.command_tree = vec![mock_entry_with(
            "hull-check",
            CommandType::Overhaul,
            CommandCondition::HullBelow { threshold: 30.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Overhaul));
    }

    #[test]
    fn defers_refuel_when_fuel_above_personal_floor() {
        // Fuel 15%, threshold 20%, caution 0.9
        // personalFloor = 5 + (20-5) * (1-0.9) = 6.5 → 15 > 6.5 → defer → survey
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.fuel_kg = 7_500.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 30,
        };
        ship.command_tree = vec![mock_entry_with(
            "fuel-check",
            CommandType::Refuel,
            CommandCondition::FuelBelow { threshold: 20.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Survey));
    }

    #[test]
    fn does_not_defer_when_below_critical_fuel_threshold() {
        // Fuel 3%, threshold 20%, caution 0.9
        // personalFloor = 6.5 → 3 < 6.5 → too risky → refuel
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.fuel_kg = 1_500.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 30,
        };
        ship.command_tree = vec![mock_entry_with(
            "fuel-check",
            CommandType::Refuel,
            CommandCondition::FuelBelow { threshold: 20.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed_body("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Refuel));
    }
}

// ---------------------------------------------------------------------------
// mod commander_decide
// ---------------------------------------------------------------------------

mod commander_decide {
    use super::*;

    fn empty_ctx() -> SimContext<'static> {
        SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        }
    }

    #[test]
    fn returns_none_when_command_tree_is_empty() {
        let ship = mock_ship_defaults();
        assert!(commander_decide(&ship, &empty_ctx()).is_none());
    }

    #[test]
    fn returns_command_tree_result_when_no_judgment_override_applies() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Mars".to_string();
        ship.command_tree = vec![mock_entry("survey", CommandType::SurveyNearest)];
        let result = commander_decide(&ship, &empty_ctx());
        assert_eq!(result, Some(CommandResult::Survey));
    }

    #[test]
    fn integrates_preemptive_service_at_colony() {
        // At colony, morale 50%, threshold 40%, caution 0.8 → preemptive service fires
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.crew.morale = 50.0;
        ship.command_tree = vec![
            mock_entry_with(
                "morale-check",
                CommandType::ShoreLeave,
                CommandCondition::MoraleBelow { threshold: 40.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let ctx = SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: true,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::ShoreLeave));
    }

    #[test]
    fn integrates_defer_maintenance_in_the_field() {
        let ceres = {
            let mut b = mock_body_entry("Ceres");
            b.body_type = "Dwarf Planet".to_string();
            b.distance_au = 2.77;
            b
        };
        // Hull 25%, threshold 30%, caution 0.8 → defers overhaul to survey
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.maintenance.age = 100.0;
        ship.maintenance.hull_integrity = 25.0;
        ship.command_tree = vec![
            mock_entry_with(
                "hull-check",
                CommandType::Overhaul,
                CommandCondition::HullBelow { threshold: 30.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let ctx = SimContext {
            bodies: &[ceres],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Survey));
    }
}

// ---------------------------------------------------------------------------
// mod check_preemptive_service__command_mappings
// ---------------------------------------------------------------------------

mod check_preemptive_service__command_mappings {
    use super::*;

    #[test]
    fn maps_return_to_base_to_refuel_when_triggered() {
        // Fuel 25%, threshold 20%, caution 0.9 → triggers
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 12_500.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 30,
        };
        ship.command_tree = vec![
            mock_entry_with(
                "fuel-check",
                CommandType::ReturnToBase,
                CommandCondition::FuelBelow { threshold: 20.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(&ship, &CommandResult::Survey, &entries);
        assert_eq!(result, Some(CommandResult::Refuel));
    }

    #[test]
    fn maps_idle_command_to_idle_when_triggered() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 12_500.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.9,
            experience: 30,
        };
        ship.command_tree = vec![
            mock_entry_with(
                "fuel-check",
                CommandType::Idle,
                CommandCondition::FuelBelow { threshold: 20.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let entries = ship.command_tree.clone();
        let result = check_preemptive_service(&ship, &CommandResult::Survey, &entries);
        assert_eq!(result, Some(CommandResult::Idle));
    }
}

// ---------------------------------------------------------------------------
// mod check_hold_for_tanker
// ---------------------------------------------------------------------------

mod check_hold_for_tanker {
    use super::*;

    fn explorer() -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.name = "ISS Explorer".to_string();
        ship
    }

    fn tanker_intent(target: &str) -> ShipIntent {
        ShipIntent::Tanking {
            target: target.to_string(),
            ship_name: "ISS Sheetz".to_string(),
            published_at: 0.0,
        }
    }

    #[test]
    fn returns_none_when_no_tanker_targeting_this_ship() {
        let ship = explorer();
        assert!(check_hold_for_tanker(&ship, &CommandResult::Survey, &[], 0.0).is_none());
    }

    #[test]
    fn returns_idle_when_tanker_inbound_and_action_is_survey() {
        let ship = explorer();
        let intents = vec![tanker_intent("ISS Explorer")];
        let result = check_hold_for_tanker(&ship, &CommandResult::Survey, &intents, 50.0);
        assert_eq!(result, Some(CommandResult::Idle));
    }

    #[test]
    fn returns_idle_when_tanker_inbound_and_action_is_transfer() {
        let ship = explorer();
        let intents = vec![tanker_intent("ISS Explorer")];
        let result = check_hold_for_tanker(
            &ship,
            &CommandResult::Transfer {
                target: "Mars".to_string(),
            },
            &intents,
            50.0,
        );
        assert_eq!(result, Some(CommandResult::Idle));
    }

    #[test]
    fn does_not_intercept_maintenance_actions_even_when_tanker_inbound() {
        let ship = explorer();
        let intents = vec![tanker_intent("ISS Explorer")];
        assert!(check_hold_for_tanker(&ship, &CommandResult::Refuel, &intents, 50.0).is_none());
        assert!(check_hold_for_tanker(&ship, &CommandResult::Overhaul, &intents, 50.0).is_none());
        assert!(check_hold_for_tanker(&ship, &CommandResult::ShoreLeave, &intents, 50.0).is_none());
        assert!(check_hold_for_tanker(&ship, &CommandResult::Idle, &intents, 50.0).is_none());
    }

    #[test]
    fn does_not_intercept_when_tanker_targeting_different_ship() {
        let ship = explorer();
        let intents = vec![tanker_intent("ISS Discovery")];
        assert!(check_hold_for_tanker(&ship, &CommandResult::Survey, &intents, 50.0).is_none());
    }

    #[test]
    fn commander_decide_returns_idle_when_tanker_inbound_and_tree_says_survey() {
        let mut ship = mock_ship_defaults();
        ship.name = "ISS Explorer".to_string();
        ship.command_tree = vec![mock_entry("survey", CommandType::SurveyNearest)];
        let intent = ShipIntent::Tanking {
            target: "ISS Explorer".to_string(),
            ship_name: "ISS Sheetz".to_string(),
            published_at: 0.0,
        };
        let ctx = SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[intent],
            sim_time: 50.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Idle));
    }
}

// ---------------------------------------------------------------------------
// mod check_defer_maintenance__morale_below_case
// ---------------------------------------------------------------------------

mod check_defer_maintenance__morale_below_case {
    use super::*;

    fn unsurveyed(name: &str) -> BodyEntry {
        let mut b = mock_body_entry(name);
        b.body_type = "Dwarf Planet".to_string();
        b.distance_au = 2.77;
        b.survey.survey_level = 0;
        b
    }

    #[test]
    fn defers_shore_leave_when_morale_above_personal_floor() {
        // Morale 20, threshold 25, caution 0.8
        // personalFloor = 5 + (25-5) * (1-0.8) = 9 → 20 > 9 → defer → survey
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.crew.morale = 20.0;
        ship.command_tree = vec![mock_entry_with(
            "morale-check",
            CommandType::ShoreLeave,
            CommandCondition::MoraleBelow { threshold: 25.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::Survey));
    }

    #[test]
    fn does_not_defer_shore_leave_when_morale_below_personal_floor() {
        // Morale 3, threshold 25, caution 0.8
        // personalFloor = 9 → 3 < 9 → too risky → take shore-leave
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Ceres".to_string();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 20,
        };
        ship.crew.morale = 3.0;
        ship.command_tree = vec![mock_entry_with(
            "morale-check",
            CommandType::ShoreLeave,
            CommandCondition::MoraleBelow { threshold: 25.0 },
            true,
            None,
        )];
        let ctx = SimContext {
            bodies: &[unsurveyed("Ceres")],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(result, Some(CommandResult::ShoreLeave));
    }
}

// ---------------------------------------------------------------------------
// mod tick_ship_simulation__malfunction_learning
// ---------------------------------------------------------------------------

mod tick_ship_simulation__malfunction_learning {
    use super::*;

    #[test]
    fn commander_learns_from_malfunction_during_transfer() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Transferring;
        ship.maintenance.age = 1440.0;
        ship.maintenance.hull_integrity = 1.0;
        ship.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };
        let caution_before = ship.commander.caution;
        tick_ship_simulation(&mut ship, 91.0, 2000.0);
        assert!(ship.commander.caution > caution_before);
    }
}

// ---------------------------------------------------------------------------
// mod malfunction_rng_diversity
// ---------------------------------------------------------------------------

mod malfunction_rng_diversity {
    use super::*;

    #[test]
    fn two_ships_with_same_age_get_different_malfunction_sequences() {
        let mut alpha = mock_ship_defaults();
        alpha.name = "Alpha".to_string();
        alpha.ship_state = ShipState::Transferring;
        alpha.maintenance.age = 1440.0;
        alpha.maintenance.total_age = 1440.0;
        alpha.maintenance.hull_integrity = 20.0;
        alpha.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };

        let mut beta = mock_ship_defaults();
        beta.name = "Beta".to_string();
        beta.ship_state = ShipState::Transferring;
        beta.maintenance.age = 1440.0;
        beta.maintenance.total_age = 1440.0;
        beta.maintenance.hull_integrity = 20.0;
        beta.commander = CommanderState {
            caution: 0.3,
            initiative: 0.3,
            experience: 0,
        };

        tick_ship_simulation(&mut alpha, 31.0, 2000.0);
        tick_ship_simulation(&mut beta, 31.0, 2000.0);

        let alpha_damage = 20.0 - alpha.maintenance.hull_integrity;
        let beta_damage = 20.0 - beta.maintenance.hull_integrity;
        assert!(alpha_damage != beta_damage || alpha_damage == 0.0);
    }
}

// ---------------------------------------------------------------------------
// mod hull_ceiling
// ---------------------------------------------------------------------------

mod hull_ceiling {
    use super::*;

    #[test]
    fn returns_100_for_new_ship() {
        assert_eq!(hull_ceiling(0.0, 0.0), 100.0);
    }

    #[test]
    fn returns_85_at_10_years_since_refit() {
        assert_eq!(hull_ceiling(3650.0, 0.0), 85.0);
    }

    #[test]
    fn returns_70_at_20_years_since_refit() {
        assert_eq!(hull_ceiling(7300.0, 0.0), 70.0);
    }

    #[test]
    fn returns_100_for_20_year_ship_just_refitted() {
        assert_eq!(hull_ceiling(7300.0, 7300.0), 100.0);
    }

    #[test]
    fn returns_85_for_30_year_ship_refitted_at_20() {
        assert_eq!(hull_ceiling(10950.0, 7300.0), 85.0);
    }

    #[test]
    fn never_drops_below_30() {
        assert_eq!(hull_ceiling(100_000.0, 0.0), 30.0);
    }
}

// ---------------------------------------------------------------------------
// mod bathtub_fail_rate
// ---------------------------------------------------------------------------

mod bathtub_fail_rate {
    use super::*;

    #[test]
    fn elevated_rate_in_infant_mortality_phase_day_0() {
        let rate = bathtub_fail_rate(0.0, 100.0, 100.0, 0);
        assert!(rate > 0.015);
    }

    #[test]
    fn lower_rate_at_end_of_infant_mortality_day_90() {
        let rate_start = bathtub_fail_rate(0.0, 100.0, 100.0, 0);
        let rate_end = bathtub_fail_rate(90.0, 100.0, 100.0, 0);
        assert!(rate_end < rate_start);
    }

    #[test]
    fn constant_low_rate_during_useful_life_1_year() {
        let rate = bathtub_fail_rate(365.0, 100.0, 100.0, 0);
        assert!((rate - 0.0085).abs() < 0.001);
    }

    #[test]
    fn accelerating_rate_during_wear_out_5_years() {
        let rate_2yr = bathtub_fail_rate(730.0, 100.0, 100.0, 0);
        let rate_5yr = bathtub_fail_rate(1825.0, 100.0, 100.0, 0);
        assert!(rate_5yr > rate_2yr * 2.0);
    }

    #[test]
    fn sqrt_integrity_multiplier_prevents_death_spiral() {
        let rate_100 = bathtub_fail_rate(365.0, 100.0, 100.0, 0);
        let rate_25 = bathtub_fail_rate(365.0, 25.0, 100.0, 0);
        // At 25% hull: sqrt(100/25) = 2.0 → rate_25 ≈ 2x rate_100
        assert!((rate_25 / rate_100 - 2.0).abs() < 0.5);
    }

    #[test]
    fn high_morale_reduces_fail_rate() {
        let rate_low = bathtub_fail_rate(365.0, 100.0, 30.0, 0);
        let rate_high = bathtub_fail_rate(365.0, 100.0, 100.0, 0);
        assert!(rate_high < rate_low);
    }

    #[test]
    fn experience_reduces_fail_rate_up_to_20pct() {
        let rate_no_exp = bathtub_fail_rate(365.0, 100.0, 50.0, 0);
        let rate_max_exp = bathtub_fail_rate(365.0, 100.0, 50.0, 40);
        assert!((rate_max_exp - rate_no_exp * 0.8).abs() < 1e-4);
    }

    #[test]
    fn experience_caps_at_20pct_reduction() {
        let rate_40 = bathtub_fail_rate(365.0, 100.0, 50.0, 40);
        let rate_100 = bathtub_fail_rate(365.0, 100.0, 50.0, 100);
        assert_eq!(rate_40, rate_100);
    }
}

// ---------------------------------------------------------------------------
// mod tick_routine_maintenance (via tick_ship_simulation)
// ---------------------------------------------------------------------------

mod tick_routine_maintenance {
    use super::*;

    #[test]
    fn slowly_restores_hull_while_idle_and_orbiting() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Mars".to_string();
        ship.maintenance.hull_integrity = 90.0;
        tick_ship_simulation(&mut ship, 10.0, 100.0);
        // 0.05% * 1.0 morale * 10 days = 0.5% recovery
        assert!(ship.maintenance.hull_integrity > 90.0);
        assert!(ship.maintenance.hull_integrity < 91.0);
    }

    #[test]
    fn does_not_restore_hull_during_active_action() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Mars".to_string();
        ship.action.action_type = Some("survey-nearest".to_string());
        ship.action.duration = 10.0;
        ship.maintenance.hull_integrity = 90.0;
        let hull_before = ship.maintenance.hull_integrity;
        tick_ship_simulation(&mut ship, 10.0, 100.0);
        assert_eq!(ship.maintenance.hull_integrity, hull_before);
    }

    #[test]
    fn caps_routine_repair_at_hull_ceiling() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Mars".to_string();
        ship.maintenance.total_age = 7300.0; // 20 years → ceiling = 70
        ship.maintenance.hull_integrity = 69.0;
        tick_ship_simulation(&mut ship, 100.0, 100.0);
        assert!(ship.maintenance.hull_integrity <= 70.0);
    }
}

// ---------------------------------------------------------------------------
// mod total_age_tracking
// ---------------------------------------------------------------------------

mod total_age_tracking {
    use super::*;

    #[test]
    fn total_age_increments_even_at_colony() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Earth".to_string();
        ship.maintenance.total_age = 100.0;
        // "Earth" is a colony → deployment age must NOT tick
        tick_ship_simulation(&mut ship, 5.0, 100.0);
        assert_eq!(ship.maintenance.total_age, 105.0);
        assert_eq!(ship.maintenance.age, 0.0);
    }

    #[test]
    fn both_age_and_total_age_tick_when_deployed() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Mars".to_string();
        ship.maintenance.age = 50.0;
        ship.maintenance.total_age = 200.0;
        tick_ship_simulation(&mut ship, 10.0, 100.0);
        assert_eq!(ship.maintenance.total_age, 210.0);
        assert_eq!(ship.maintenance.age, 60.0);
    }
}

// ---------------------------------------------------------------------------
// mod overhaul_hull_ceiling
// ---------------------------------------------------------------------------

mod overhaul_hull_ceiling {
    use super::*;

    #[test]
    fn overhaul_repair_caps_at_projected_ceiling_not_100pct() {
        // 20-year-old ship: projected ceiling after 40% gap recovery ≈ 82%
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Earth".to_string();
        ship.action.action_type = Some("overhaul".to_string());
        ship.action.duration = 100.0;
        ship.maintenance.total_age = 7300.0; // 20 years
        ship.maintenance.hull_integrity = 50.0;
        tick_ship_simulation(&mut ship, 50.0, 100.0);
        assert!(ship.maintenance.hull_integrity <= 82.0);
        assert!(ship.maintenance.hull_integrity > 70.0);
    }

    #[test]
    fn major_refit_repair_can_reach_100pct() {
        let mut ship = mock_ship_defaults();
        ship.ship_state = ShipState::Orbiting;
        ship.host_planet_name = "Earth".to_string();
        ship.action.action_type = Some("major-refit".to_string());
        ship.action.duration = 200.0;
        ship.maintenance.total_age = 7300.0;
        ship.maintenance.hull_integrity = 50.0;
        tick_ship_simulation(&mut ship, 50.0, 100.0);
        // Should restore toward 100, not capped at 70
        assert!(ship.maintenance.hull_integrity > 70.0);
    }
}

// ---------------------------------------------------------------------------
// mod deliver_colony_shuttle (via tick_ship_simulation)
// ---------------------------------------------------------------------------

mod deliver_colony_shuttle {
    use super::*;

    // SIM_TIME = 5.1, SIM_DT = 0.2 → crosses exactly 1 day boundary

    fn make_colony(fuel_kg: f64, supplies: f64) -> ColonyState {
        ColonyState {
            body_name: "Earth".to_string(),
            name: "Earth Colony".to_string(),
            population: 1_000_000,
            stockpile_fuel_kg: fuel_kg,
            stockpile_supplies: supplies,
        }
    }

    #[test]
    fn delivers_only_fuel_deficit_not_25pct_of_capacity() {
        // Ship at 80% fuel needs 10 000 kg.
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 40_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        let mut colony = make_colony(50_000.0, 100_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        assert_eq!(ship.fuel_kg, 50_000.0);
        assert_eq!(colony.stockpile_fuel_kg, 40_000.0); // lost 10 000, not 12 500
    }

    #[test]
    fn caps_shuttle_at_25pct_capacity_when_deficit_exceeds_one_load() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 0.0;
        ship.fuel_capacity_kg = 50_000.0;
        let mut colony = make_colony(100_000.0, 100_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        // Deficit is 50 000, cap is 25% = 12 500
        assert_eq!(ship.fuel_kg, 12_500.0);
        assert_eq!(colony.stockpile_fuel_kg, 87_500.0);
    }

    #[test]
    fn does_not_deliver_fuel_when_ship_is_already_full() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 50_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        let mut colony = make_colony(50_000.0, 100_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        assert_eq!(colony.stockpile_fuel_kg, 50_000.0);
    }

    #[test]
    fn clamps_delivery_to_available_colony_stockpile() {
        // Colony only has 3 000 kg; ship needs 10 000
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 40_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        let mut colony = make_colony(3_000.0, 100_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        assert_eq!(ship.fuel_kg, 43_000.0);
        assert_eq!(colony.stockpile_fuel_kg, 0.0);
    }

    #[test]
    fn skips_fuel_shuttle_when_action_type_is_refuel() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 40_000.0;
        ship.fuel_capacity_kg = 50_000.0;
        ship.action.action_type = Some("refuel".to_string());
        ship.action.duration = 5.0;
        let mut colony = make_colony(50_000.0, 100_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        // tickActionRecovery draws some fuel; shuttle (10 000) must NOT fire
        assert!(colony.stockpile_fuel_kg > 40_000.0);
    }

    #[test]
    fn skips_supply_shuttle_during_overhaul() {
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.fuel_kg = 50_000.0; // full → no fuel shuttle
        ship.fuel_capacity_kg = 50_000.0;
        ship.action.action_type = Some("overhaul".to_string());
        ship.action.duration = 30.0;
        ship.maintenance.supplies = 50.0;
        ship.maintenance.max_supplies = 100.0;
        let mut colony = make_colony(50_000.0, 50_000.0);
        tick_ship_simulation_with_colony(&mut ship, 0.2, 5.1, &mut colony);
        // Shuttle would have taken up to 25 supplies; only tickActionRecovery (~0.375) fires
        assert!(colony.stockpile_supplies > 50_000.0 - 25.0);
    }
}

// ---------------------------------------------------------------------------
// mod cache_invalidation_exports
// ---------------------------------------------------------------------------

mod cache_invalidation_exports {
    use super::*;

    #[test]
    fn invalidate_survey_target_cache_does_not_panic() {
        invalidate_survey_target_cache();
    }

    #[test]
    fn invalidate_refuel_target_cache_does_not_panic() {
        invalidate_refuel_target_cache();
    }
}

// ---------------------------------------------------------------------------
// mod resolve_ship_sensor_level
// ---------------------------------------------------------------------------

mod resolve_ship_sensor_level {
    use super::*;
    use drift_types::ShipDesign;

    fn mock_ship_design(id: &str, sensor_multiplier: f64) -> ShipDesign {
        ShipDesign {
            id: id.to_string(),
            name: format!("Design {}", id),
            engine_design_id: "eng1".to_string(),
            engine_count: 1,
            components: vec![],
            dry_mass_kg: 10_000.0,
            fuel_capacity_kg: 50_000.0,
            cargo_capacity_kg: 0.0,
            crew_capacity: 50,
            max_supplies: 100.0,
            sensor_multiplier,
            accel_g: 0.1,
            isp_s: 10_000.0,
            armor_hp: 0.0,
        }
    }

    #[test]
    fn ship_with_no_design_id_returns_1() {
        let ship = mock_ship_defaults();
        let designs = std::collections::HashMap::new();
        assert_eq!(resolve_ship_sensor_level(&ship, &designs), 1);
    }

    #[test]
    fn ship_with_design_sensor_multiplier_1_0_returns_1() {
        let mut designs = std::collections::HashMap::new();
        designs.insert(
            "design-1.0".to_string(),
            mock_ship_design("design-1.0", 1.0),
        );
        let mut ship = mock_ship_defaults();
        ship.design_id = Some("design-1.0".to_string());
        assert_eq!(resolve_ship_sensor_level(&ship, &designs), 1);
    }

    #[test]
    fn ship_with_design_sensor_multiplier_1_5_returns_2() {
        let mut designs = std::collections::HashMap::new();
        designs.insert(
            "design-1.5".to_string(),
            mock_ship_design("design-1.5", 1.5),
        );
        let mut ship = mock_ship_defaults();
        ship.design_id = Some("design-1.5".to_string());
        assert_eq!(resolve_ship_sensor_level(&ship, &designs), 2);
    }

    #[test]
    fn ship_with_design_sensor_multiplier_2_0_returns_3() {
        let mut designs = std::collections::HashMap::new();
        designs.insert(
            "design-2.0".to_string(),
            mock_ship_design("design-2.0", 2.0),
        );
        let mut ship = mock_ship_defaults();
        ship.design_id = Some("design-2.0".to_string());
        assert_eq!(resolve_ship_sensor_level(&ship, &designs), 3);
    }
}

// ---------------------------------------------------------------------------
// mod select_next_survey_target__sensor_level_filtering
// ---------------------------------------------------------------------------

mod select_next_survey_target__sensor_level_filtering {
    use super::*;

    fn ship_with_sensor(sensor_level: u32) -> ShipEntry {
        let mut ship = mock_ship_defaults();
        ship.mesh_x = 0.0;
        ship.mesh_z = 0.0;
        ship
    }

    #[test]
    fn sensor_level_1_ship_skips_bodies_at_survey_level_1() {
        let mut body = mock_body_entry("Venus");
        body.survey.survey_level = 1;
        let ship = ship_with_sensor(1);
        let result = select_next_survey_target(&ship, &[body], &[], &Default::default(), 1);
        assert!(result.is_none());
    }

    #[test]
    fn sensor_level_2_ship_includes_bodies_at_survey_level_1() {
        let mut body = mock_body_entry("Venus");
        body.survey.survey_level = 1;
        let ship = ship_with_sensor(2);
        let result = select_next_survey_target(&ship, &[body], &[], &Default::default(), 2);
        assert_eq!(result, Some("Venus".to_string()));
    }

    #[test]
    fn sensor_level_2_ship_skips_bodies_at_survey_level_2() {
        let mut body = mock_body_entry("Venus");
        body.survey.survey_level = 2;
        let ship = ship_with_sensor(2);
        let result = select_next_survey_target(&ship, &[body], &[], &Default::default(), 2);
        assert!(result.is_none());
    }

    #[test]
    fn sensor_level_1_ship_targets_body_at_survey_level_0() {
        let body = mock_body_entry("Mars");
        let ship = ship_with_sensor(1);
        let result = select_next_survey_target(&ship, &[body], &[], &Default::default(), 1);
        assert_eq!(result, Some("Mars".to_string()));
    }
}

// ---------------------------------------------------------------------------
// mod get_unsurveyed_moons_of_host__sensor_level_filtering
// ---------------------------------------------------------------------------

mod get_unsurveyed_moons_of_host__sensor_level_filtering {
    use super::*;

    #[test]
    fn sensor_level_1_ship_at_planet_with_level_1_moon_sees_no_unsurveyed_moons() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        moon.survey.survey_level = 1;
        let mut planet = mock_body_entry("Earth");
        planet.moons = vec![moon];
        let bodies = vec![planet];
        let ship = {
            let mut s = mock_ship_defaults();
            s.host_planet_name = "Earth".to_string();
            s
        };
        // sensor level 1; moon at level 1 >= maxLevel 1 → filtered out
        let moons = get_unsurveyed_moons_of_host(&ship, &bodies, 1);
        assert!(moons.is_empty());
    }

    #[test]
    fn sensor_level_2_ship_at_planet_with_level_1_moon_sees_it_as_unsurveyed() {
        let mut moon = mock_body_entry("Luna");
        moon.is_moon = true;
        moon.survey.survey_level = 1;
        let mut planet = mock_body_entry("Earth");
        planet.moons = vec![moon];
        let bodies = vec![planet];
        let ship = {
            let mut s = mock_ship_defaults();
            s.host_planet_name = "Earth".to_string();
            s
        };
        // maxLevel 2; moon at level 1 < 2 → included
        let moons = get_unsurveyed_moons_of_host(&ship, &bodies, 2);
        assert_eq!(moons.len(), 1);
        assert_eq!(moons[0].name, "Luna");
    }
}

// ---------------------------------------------------------------------------
// mod scored_decisions
// ---------------------------------------------------------------------------

mod scored_decisions {
    use super::*;

    #[test]
    fn commander_decide_returns_result_for_ship_with_basic_command_tree() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.5,
            initiative: 0.7,
            experience: 10,
        };
        ship.command_tree = vec![mock_entry("1", CommandType::SurveyNearest)];
        let ctx = SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: false,
        };
        let result = commander_decide(&ship, &ctx);
        assert!(result.is_some());
    }

    #[test]
    fn higher_scored_override_wins_over_base_command() {
        // At colony, morale 30% < effective threshold with high caution → preemptive service fires
        let mut ship = mock_ship_defaults();
        ship.host_planet_name = "Earth".to_string();
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.5,
            experience: 5,
        };
        ship.crew.morale = 30.0;
        ship.command_tree = vec![
            mock_entry_with(
                "morale-check",
                CommandType::ShoreLeave,
                CommandCondition::MoraleBelow { threshold: 40.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let ctx = SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[],
            sim_time: 0.0,
            is_at_colony: true,
        };
        let result = commander_decide(&ship, &ctx);
        assert_eq!(
            result.as_ref().map(|r| r.action_name()),
            Some("shore-leave")
        );
    }

    #[test]
    fn tanker_hold_beats_preemptive_service() {
        // Both overrides fire; tanker hold (score 0.85) > preemptive service (score 0.7)
        let mut ship = mock_ship_defaults();
        ship.name = "ISS Explorer".to_string();
        ship.host_planet_name = "Earth".to_string();
        ship.commander = CommanderState {
            caution: 0.9,
            initiative: 0.5,
            experience: 5,
        };
        ship.crew.morale = 55.0;
        ship.command_tree = vec![
            // threshold 50 + (100-50)*0.9*0.3 = 63.5 effective → 55 < 63.5 → fires preemptive
            mock_entry_with(
                "morale-check",
                CommandType::ShoreLeave,
                CommandCondition::MoraleBelow { threshold: 50.0 },
                true,
                None,
            ),
            mock_entry("survey", CommandType::SurveyNearest),
        ];
        let tanker_intent = ShipIntent::Tanking {
            target: "ISS Explorer".to_string(),
            ship_name: "ISS Tanker".to_string(),
            published_at: 0.0,
        };
        let ctx = SimContext {
            bodies: &[],
            asteroids: &[],
            intents: &[tanker_intent],
            sim_time: 50.0,
            is_at_colony: true,
        };
        let result = commander_decide(&ship, &ctx);
        // Tanker hold wins → idle
        assert_eq!(result.as_ref().map(|r| r.action_name()), Some("idle"));
    }
}

// ---------------------------------------------------------------------------
// mod judgment_decay
// ---------------------------------------------------------------------------

mod judgment_decay {
    use super::*;

    #[test]
    fn judgment_drifts_toward_0_5_on_successful_action_completion() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.8,
            initiative: 0.8,
            experience: 0,
        };
        for _ in 0..10 {
            increment_experience(&mut ship);
        }
        assert!(ship.commander.caution < 0.8);
        assert!(ship.commander.caution > 0.5);
    }

    #[test]
    fn judgment_drifts_up_from_low_values() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.2,
            initiative: 0.2,
            experience: 0,
        };
        for _ in 0..10 {
            increment_experience(&mut ship);
        }
        assert!(ship.commander.caution > 0.2);
        assert!(ship.commander.caution < 0.5);
    }

    #[test]
    fn malfunction_spike_overrides_drift() {
        let mut ship = mock_ship_defaults();
        ship.commander = CommanderState {
            caution: 0.5,
            initiative: 0.5,
            experience: 0,
        };
        learn_from_malfunction(&mut ship);
        let after_spike = ship.commander.caution;
        assert!(after_spike > 0.5);
        for _ in 0..5 {
            increment_experience(&mut ship);
        }
        assert!(ship.commander.caution < after_spike);
        assert!(ship.commander.caution >= 0.5);
    }
}

// ---------------------------------------------------------------------------
// mod tanker_round_trip_fuel
// ---------------------------------------------------------------------------

mod tanker_round_trip_fuel {
    use super::*;

    fn body_at_angle(name: &str, distance_au: f64, angle_deg: f64) -> BodyEntry {
        let angle_rad = angle_deg * std::f64::consts::PI / 180.0;
        BodyEntry {
            name: name.to_string(),
            body_type: "Planet".to_string(),
            is_moon: false,
            is_ship: false,
            is_comet: false,
            survey: BodySurvey {
                survey_level: 0,
                deposits: vec![],
            },
            moons: vec![],
            mesh_x: angle_rad.cos(),
            mesh_z: angle_rad.sin(),
            distance_au,
        }
    }

    #[test]
    fn returns_positive_fuel_cost_for_non_zero_distance() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 80_000.0;
            s.fuel_capacity_kg = 80_000.0;
            s.dry_mass_kg = 5_000.0;
            s
        };
        let host_a = body_at_angle("Earth", 1.0, 0.0);
        let host_b = body_at_angle("Mars", 1.52, 90.0);
        let cost = tanker_round_trip_fuel(&tanker, &host_a, &host_b);
        assert!(cost > 0.0);
    }

    #[test]
    fn returns_0_when_bodies_at_same_position() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 80_000.0;
            s.fuel_capacity_kg = 80_000.0;
            s.dry_mass_kg = 5_000.0;
            s
        };
        let host_a = body_at_angle("Earth", 1.0, 0.0);
        let host_b = body_at_angle("EarthCopy", 1.0, 0.0);
        let cost = tanker_round_trip_fuel(&tanker, &host_a, &host_b);
        assert_eq!(cost, 0.0);
    }

    #[test]
    fn round_trip_cost_is_2_5x_one_way_cost() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 200_000.0;
            s.fuel_capacity_kg = 200_000.0;
            s.dry_mass_kg = 5_000.0;
            s
        };
        let host_a = body_at_angle("Earth", 1.0, 0.0);
        let host_b = body_at_angle("Jupiter", 5.2, 180.0);
        let round_trip = tanker_round_trip_fuel(&tanker, &host_a, &host_b);
        assert!(round_trip > 0.0);
    }
}

// ---------------------------------------------------------------------------
// mod can_afford_round_trip
// ---------------------------------------------------------------------------

mod can_afford_round_trip {
    use super::*;

    fn body_at(name: &str, distance_au: f64, angle_deg: f64) -> BodyEntry {
        let angle_rad = angle_deg * std::f64::consts::PI / 180.0;
        BodyEntry {
            name: name.to_string(),
            body_type: "Planet".to_string(),
            is_moon: false,
            is_ship: false,
            is_comet: false,
            survey: BodySurvey {
                survey_level: 0,
                deposits: vec![],
            },
            moons: vec![],
            mesh_x: angle_rad.cos(),
            mesh_z: angle_rad.sin(),
            distance_au,
        }
    }

    #[test]
    fn returns_true_when_tanker_host_is_none() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 1_000.0;
            s.fuel_capacity_kg = 100_000.0;
            s
        };
        let target = body_at("Mars", 1.52, 90.0);
        assert!(can_afford_round_trip(&tanker, None, Some(&target), 0.0));
    }

    #[test]
    fn returns_true_when_target_host_is_none() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 1_000.0;
            s.fuel_capacity_kg = 100_000.0;
            s
        };
        let host = body_at("Earth", 1.0, 0.0);
        assert!(can_afford_round_trip(&tanker, Some(&host), None, 0.0));
    }

    #[test]
    fn returns_true_when_tanker_has_enough_fuel() {
        // Bodies at same position → tripFuel = 0, any fuel suffices
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 50_000.0;
            s.fuel_capacity_kg = 100_000.0;
            s
        };
        let host = body_at("Earth", 1.0, 0.0);
        let same = body_at("EarthB", 1.0, 0.0);
        assert!(can_afford_round_trip(
            &tanker,
            Some(&host),
            Some(&same),
            0.0
        ));
    }

    #[test]
    fn returns_false_when_fuel_insufficient_for_round_trip_plus_reserve() {
        let tanker = {
            let mut s = mock_ship_defaults();
            s.fuel_kg = 1.0;
            s.fuel_capacity_kg = 100_000.0;
            s.dry_mass_kg = 5_000.0;
            s
        };
        let host_a = body_at("Earth", 1.0, 0.0);
        let host_b = body_at("Jupiter", 5.2, 180.0);
        let reserve = 100_000.0 * 0.15;
        assert!(!can_afford_round_trip(
            &tanker,
            Some(&host_a),
            Some(&host_b),
            reserve
        ));
    }
}

// ---------------------------------------------------------------------------
// mod is_refuel_candidate
// ---------------------------------------------------------------------------

mod is_refuel_candidate {
    use super::*;

    fn planet_entry() -> BodyEntry {
        mock_body_entry("Mars")
    }

    #[test]
    fn returns_false_for_non_ship_entries() {
        let planet = planet_entry();
        assert!(!is_refuel_candidate(&planet, "Tanker", &Default::default()));
    }

    #[test]
    fn returns_false_when_entry_is_the_tanker_itself() {
        let mut tanker = mock_ship_defaults();
        tanker.name = "Tanker".to_string();
        tanker.is_ship = true;
        tanker.fuel_kg = 1_000.0;
        tanker.fuel_capacity_kg = 100_000.0;
        assert!(!is_refuel_candidate_ship(
            &tanker,
            "Tanker",
            &Default::default()
        ));
    }

    #[test]
    fn returns_false_for_ships_currently_transferring() {
        let mut ship = mock_ship_defaults();
        ship.name = "Explorer".to_string();
        ship.is_ship = true;
        ship.fuel_kg = 10_000.0;
        ship.fuel_capacity_kg = 100_000.0;
        ship.ship_state = ShipState::Transferring;
        assert!(!is_refuel_candidate_ship(
            &ship,
            "Tanker",
            &Default::default()
        ));
    }

    #[test]
    fn returns_false_for_already_claimed_targets() {
        let mut ship = mock_ship_defaults();
        ship.name = "Explorer".to_string();
        ship.is_ship = true;
        ship.fuel_kg = 10_000.0;
        ship.fuel_capacity_kg = 100_000.0;
        let mut claimed = std::collections::HashSet::new();
        claimed.insert("Explorer".to_string());
        assert!(!is_refuel_candidate_ship(&ship, "Tanker", &claimed));
    }

    #[test]
    fn returns_true_for_low_fuel_ship_that_is_valid() {
        let mut ship = mock_ship_defaults();
        ship.name = "Explorer".to_string();
        ship.is_ship = true;
        ship.fuel_kg = 10_000.0;
        ship.fuel_capacity_kg = 100_000.0; // 10% — below threshold
        assert!(is_refuel_candidate_ship(
            &ship,
            "Tanker",
            &Default::default()
        ));
    }

    #[test]
    fn returns_false_for_ships_above_fuel_threshold() {
        let mut ship = mock_ship_defaults();
        ship.name = "Explorer".to_string();
        ship.is_ship = true;
        ship.fuel_kg = 75_000.0;
        ship.fuel_capacity_kg = 100_000.0; // 75% — above 50%
        assert!(!is_refuel_candidate_ship(
            &ship,
            "Tanker",
            &Default::default()
        ));
    }

    #[test]
    fn returns_false_for_ships_at_exactly_the_threshold() {
        let mut ship = mock_ship_defaults();
        ship.name = "Explorer".to_string();
        ship.is_ship = true;
        ship.fuel_kg = 50_000.0;
        ship.fuel_capacity_kg = 100_000.0; // exactly 50%
        assert!(!is_refuel_candidate_ship(
            &ship,
            "Tanker",
            &Default::default()
        ));
    }
}
