// Integration tests for drift_sim::colonies
// Ported from src/__tests__/colonies.test.ts
//
// RED phase: these tests define the required public API.
// All tests will fail to compile until production code is implemented.

use std::collections::HashMap;

use drift_sim::colonies::*;
use drift_types::*;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

fn minimal_body_data(name: &str, distance: f64) -> BodyData {
    BodyData {
        name: name.to_string(),
        body_type: BodyType::Planet,
        distance,
        e: 0.0,
        period: 365.0,
        radius: 6371.0,
        mass: 5.972e24,
        color: "#fff".to_string(),
        emissive: None,
        moons: vec![],
        rings: None,
        radius_earths: None,
        category: Some(PlanetCategory::Rocky),
        is_dwarf: None,
        is_detached: None,
    }
}

fn make_colony(body_name: &str) -> ColonyState {
    make_colony_opts(body_name, None, None, None, None)
}

fn make_colony_opts(
    body_name: &str,
    population: Option<f64>,
    habitability: Option<f64>,
    installations: Option<ColonyInstallations>,
    stockpile: Option<ColonyStockpile>,
) -> ColonyState {
    ColonyState {
        body_name: body_name.to_string(),
        name: format!("{body_name} Colony"),
        population: population.unwrap_or(1_000_000.0),
        habitability: habitability.unwrap_or(1.0),
        installations: installations.unwrap_or(ColonyInstallations {
            construction_factory: 1,
            repair_yard: 1,
            fuel_depot: 1,
            mine: 1,
            lab: 3,
            academy: 0,
            storage: 1,
            shipyard: 0,
            automated_mine: 0,
            mass_driver: 0,
            fuel_refinery: 0,
        }),
        stockpile: stockpile.unwrap_or(ColonyStockpile {
            fuel_kg: 1000.0,
            supplies: 100.0,
            resources: HashMap::new(),
            flat_packed: HashMap::new(),
        }),
        mass_driver_target: None,
        research_points: 0.0,
        construction_projects: vec![],
        production_projects: vec![],
        shipbuild_projects: vec![],
        transfer_queue: vec![],
        academy_progress: 0.0,
    }
}

fn default_installations() -> ColonyInstallations {
    ColonyInstallations {
        construction_factory: 1,
        repair_yard: 1,
        fuel_depot: 1,
        mine: 1,
        lab: 3,
        academy: 0,
        storage: 1,
        shipyard: 0,
        automated_mine: 0,
        mass_driver: 0,
        fuel_refinery: 0,
    }
}

fn make_ship_design(dry_mass_kg: f64) -> ShipDesign {
    ShipDesign {
        id: "design-test".to_string(),
        name: "Test Ship".to_string(),
        engine_design_id: "eng-1".to_string(),
        engine_count: 1,
        components: vec![],
        dry_mass_kg,
        fuel_capacity_kg: 10_000.0,
        cargo_capacity_kg: 0.0,
        crew_capacity: 10,
        max_supplies: 100,
        sensor_multiplier: 1.0,
        accel_g: 0.1,
        isp_s: 10_000.0,
        armor_hp: 0,
    }
}

fn fresh_state() -> SimState {
    SimState::new()
}

// ---------------------------------------------------------------------------
// colonies
// ---------------------------------------------------------------------------

mod colonies {
    use super::*;

    #[test]
    fn seed_starting_colonies_creates_earth_colony_and_initial_scientists() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        seed_starting_colonies(&mut state);

        let colony = state.colonies.get("Earth").expect("Earth colony not found");
        assert!(colony.population > 1_000_000_000.0);
        assert!(!get_scientists_at_colony(&state, "Earth").is_empty());
    }

    #[test]
    fn compute_colony_workforce_reports_staffing_ratio() {
        let colony = make_colony_opts(
            "Earth",
            Some(100_000.0),
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 2,
                fuel_depot: 2,
                mine: 2,
                lab: 2,
                academy: 2,
                storage: 2,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            None,
        );

        let workforce = compute_colony_workforce(&colony);
        assert!(workforce.used_workers > workforce.available_workers);
        assert!(workforce.staffing_ratio < 1.0);
    }

    #[test]
    fn compute_colony_qualities_scales_down_when_understaffed() {
        let state = fresh_state();
        let full = compute_colony_qualities(&make_colony("Earth"), &state);
        let understaffed = compute_colony_qualities(
            &make_colony_opts(
                "Earth",
                Some(100_000.0),
                None,
                Some(ColonyInstallations {
                    construction_factory: 0,
                    repair_yard: 3,
                    fuel_depot: 3,
                    mine: 3,
                    lab: 3,
                    academy: 3,
                    storage: 3,
                    shipyard: 0,
                    automated_mine: 0,
                    mass_driver: 0,
                    fuel_refinery: 0,
                }),
                None,
            ),
            &state,
        );

        assert!(understaffed.repair < full.repair);
        assert!(understaffed.refuel < full.refuel);
    }

    #[test]
    fn stockpile_helpers_add_and_consume_resources() {
        let mut state = fresh_state();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        add_colony_stock(&mut state, "Earth", "iron", 25.0);
        assert_eq!(get_colony_resource_stock(&state, "Earth", "iron"), 25.0);

        let consumed_fuel = consume_colony_fuel(&mut state, "Earth", 400.0);
        assert_eq!(consumed_fuel, 400.0);
        assert_eq!(state.colonies["Earth"].stockpile.fuel_kg, 600.0);

        let consumed_supplies = consume_colony_supplies(&mut state, "Earth", 30.0);
        assert_eq!(consumed_supplies, 30.0);
        assert_eq!(state.colonies["Earth"].stockpile.supplies, 70.0);
    }

    #[test]
    fn tick_colony_mines_surveyed_deposits_into_stockpile() {
        let mut state = fresh_state();
        let survey = SurveyState {
            survey_level: 1,
            deposits: vec![ResourceDeposit {
                resource_id: "iron".to_string(),
                quantity: 100,
                accessibility: 1.0,
                mined: 0.0,
                min_survey_level: 1,
            }],
        };
        state.add_body(minimal_body_data("Earth", 1.0), Some(survey));
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        tick_colony(&mut state, "Earth", 1.0);

        assert!(get_colony_resource_stock(&state, "Earth", "iron") > 0.0);
        let deposits = state.get_body_deposits("Earth");
        assert!(deposits[0].mined > 0.0);
    }

    #[test]
    fn scientist_queue_drives_active_research_and_completion() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));
        seed_starting_colonies(&mut state);

        let scientists = get_scientists_at_colony(&state, "Earth");
        let scientist_id = scientists
            .first()
            .expect("expected at least one scientist")
            .id
            .clone();
        // adminCap is 1–5 (RNG), so request 1 which is always valid
        assert!(set_scientist_labs(&mut state, &scientist_id, 1));
        assert!(queue_research_project_for_scientist(
            &mut state,
            &scientist_id,
            "survey-automation"
        ));

        for _ in 0..30 {
            tick_colony(&mut state, "Earth", 1.0);
        }

        assert!(state.researched_techs.contains("survey-automation"));
        assert!(state
            .game_log
            .iter()
            .any(|e| e.category == GameLogCategory::Research));
    }

    #[test]
    fn get_nearest_colony_for_ship_returns_closest_colony_by_orbital_distance() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.add_body(minimal_body_data("Mars", 1.5), None);
        state.add_body(minimal_body_data("Jupiter", 5.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));
        state
            .colonies
            .insert("Jupiter".to_string(), make_colony("Jupiter"));

        // Ship orbiting Mars (no colony there) — nearest should be Earth (dist 0.5 away vs Jupiter 3.5 away)
        let result = get_nearest_colony_for_ship(&state, "Mars");
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "Earth");
    }

    #[test]
    fn tick_colony_advances_construction_projects_into_completed_installations() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();

        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        resources.insert("copper".to_string(), 2000.0);

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 4,
                repair_yard: 1,
                fuel_depot: 1,
                mine: 0,
                lab: 1,
                academy: 0,
                storage: 1,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 1000.0,
                supplies: 100.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        add_construction_project(&mut state, "Earth", ColonyInstallationId::Mine, 1, 100.0);

        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }

        let colony = &state.colonies["Earth"];
        assert!(colony.installations.mine > 0);
        assert!(colony.construction_projects.is_empty());
    }

    #[test]
    fn construction_deducts_resources_from_colony_stockpile_on_completion() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();

        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 500.0);
        resources.insert("copper".to_string(), 100.0);

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 4,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        add_construction_project(&mut state, "Earth", ColonyInstallationId::Mine, 1, 100.0);

        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }

        let colony = &state.colonies["Earth"];
        assert_eq!(colony.installations.mine, 1);
        assert_eq!(
            colony
                .stockpile
                .resources
                .get("iron")
                .copied()
                .unwrap_or(0.0),
            300.0
        );
        assert_eq!(
            colony
                .stockpile
                .resources
                .get("copper")
                .copied()
                .unwrap_or(0.0),
            50.0
        );
    }

    #[test]
    fn construction_stalls_when_colony_lacks_resources() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();

        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 10.0);

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 4,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        add_construction_project(&mut state, "Earth", ColonyInstallationId::Mine, 1, 100.0);

        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }

        let colony = &state.colonies["Earth"];
        assert_eq!(colony.installations.mine, 0);
        assert_eq!(colony.construction_projects.len(), 1);
        // Progress must be >= 80 BP (mine costs 80 BP total, stalled at ceiling)
        assert!(colony.construction_projects[0].progress_bp >= 80.0);
    }

    #[test]
    fn can_afford_construction_returns_false_when_resources_insufficient() {
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 100.0);
        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        assert!(!can_afford_construction(
            &colony,
            ColonyInstallationId::Mine
        ));
        assert!(!can_afford_construction(
            &colony,
            ColonyInstallationId::Storage
        ));
    }

    #[test]
    fn can_afford_construction_returns_true_when_resources_sufficient() {
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        resources.insert("copper".to_string(), 2000.0);
        resources.insert("aluminum".to_string(), 1000.0);
        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        assert!(can_afford_construction(&colony, ColonyInstallationId::Mine));
        assert!(can_afford_construction(
            &colony,
            ColonyInstallationId::ConstructionFactory
        ));
    }

    #[test]
    fn warns_when_colony_is_severely_understaffed() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        let colony = make_colony_opts(
            "Earth",
            Some(100.0),
            None,
            Some(ColonyInstallations {
                construction_factory: 10,
                repair_yard: 10,
                fuel_depot: 10,
                mine: 10,
                lab: 10,
                academy: 10,
                storage: 10,
                shipyard: 10,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            None,
        );
        state.colonies.insert("Earth".to_string(), colony);

        tick_colony(&mut state, "Earth", 1.0);

        let warning = state
            .notifications
            .iter()
            .find(|n| n.notification_type == NotificationType::ColonyUnderstaffed);
        assert!(warning.is_some());
        assert!(warning.unwrap().message.contains("understaffing"));
    }

    #[test]
    fn does_not_warn_when_colony_is_well_staffed() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        tick_colony(&mut state, "Earth", 1.0);

        let warning = state
            .notifications
            .iter()
            .find(|n| n.notification_type == NotificationType::ColonyUnderstaffed);
        assert!(warning.is_none());
    }

    #[test]
    fn warns_when_construction_factories_are_idle() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        tick_colony(&mut state, "Earth", 1.0);

        let warning = state.notifications.iter().find(|n| {
            n.notification_type == NotificationType::ColonyIdle
                && n.message.contains("construction")
        });
        assert!(warning.is_some());
    }

    #[test]
    fn does_not_repeat_warning_within_30_game_days() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        tick_colony(&mut state, "Earth", 1.0);
        let count1 = state
            .notifications
            .iter()
            .filter(|n| n.notification_type == NotificationType::ColonyIdle)
            .count();

        tick_colony(&mut state, "Earth", 1.0);
        let count2 = state
            .notifications
            .iter()
            .filter(|n| n.notification_type == NotificationType::ColonyIdle)
            .count();

        assert_eq!(count2, count1);
    }

    #[test]
    fn repeats_warning_after_warning_state_is_reset_and_30_days_elapse() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));

        tick_colony(&mut state, "Earth", 1.0);
        let idle_count1 = state
            .notifications
            .iter()
            .filter(|n| n.notification_type == NotificationType::ColonyIdle)
            .count();
        assert!(idle_count1 > 0);

        state.notifications.clear();
        state.sim_time_days += 31.0;
        state.reset_colony_warning_state();
        tick_colony(&mut state, "Earth", 1.0);
        let idle_count2 = state
            .notifications
            .iter()
            .filter(|n| n.notification_type == NotificationType::ColonyIdle)
            .count();
        assert!(idle_count2 > 0);
    }
}

// ---------------------------------------------------------------------------
// computeResearchProgress
// ---------------------------------------------------------------------------

mod compute_research_progress {
    use super::*;
    use approx::assert_relative_eq;

    const BASE_RESEARCH_RATE: f64 = 5.0;
    const CATEGORY_GROWTH_RATE: f64 = 0.0015;

    #[test]
    fn rp_gain_scales_linearly_with_labs() {
        let a = compute_research_progress(1.0, 1.0, 1.0, 1.0, 1.0);
        let b = compute_research_progress(3.0, 1.0, 1.0, 1.0, 1.0);
        assert_relative_eq!(b.rp_gain, a.rp_gain * 3.0, max_relative = 1e-9);
    }

    #[test]
    fn rp_gain_scales_with_research_quality() {
        let a = compute_research_progress(2.0, 0.5, 1.0, 1.0, 1.0);
        let b = compute_research_progress(2.0, 1.5, 1.0, 1.0, 1.0);
        assert_relative_eq!(b.rp_gain, a.rp_gain * 3.0, max_relative = 1e-9);
    }

    #[test]
    fn rp_gain_scales_with_category_multiplier() {
        let a = compute_research_progress(2.0, 1.0, 1.0, 1.0, 1.0);
        let b = compute_research_progress(2.0, 1.0, 2.0, 1.0, 1.0);
        assert_relative_eq!(b.rp_gain, a.rp_gain * 2.0, max_relative = 1e-9);
    }

    #[test]
    fn rp_gain_scales_with_sim_dt_days() {
        let a = compute_research_progress(2.0, 1.0, 1.0, 1.0, 1.0);
        let b = compute_research_progress(2.0, 1.0, 1.0, 1.0, 10.0);
        assert_relative_eq!(b.rp_gain, a.rp_gain * 10.0, max_relative = 1e-9);
    }

    #[test]
    fn rp_gain_matches_formula_base_rate_times_labs_times_quality_times_multiplier_times_dt() {
        let result = compute_research_progress(4.0, 1.2, 1.5, 2.0, 3.0);
        let expected = BASE_RESEARCH_RATE * 4.0 * 1.2 * 1.5 * 3.0;
        assert_relative_eq!(result.rp_gain, expected, max_relative = 1e-9);
    }

    #[test]
    fn experience_gain_proportional_to_difficulty_times_time() {
        let result = compute_research_progress(1.0, 1.0, 1.0, 3.0, 7.0);
        assert_relative_eq!(result.experience_gain, 3.0 * 7.0, max_relative = 1e-9);
    }

    #[test]
    fn bonus_growth_proportional_to_difficulty_times_time_times_category_growth_rate() {
        let result = compute_research_progress(1.0, 1.0, 1.0, 2.0, 5.0);
        let expected = 2.0 * 5.0 * CATEGORY_GROWTH_RATE;
        assert_relative_eq!(result.bonus_growth, expected, max_relative = 1e-9);
    }

    #[test]
    fn zero_labs_produces_zero_rp_gain() {
        let result = compute_research_progress(0.0, 1.0, 1.0, 1.0, 1.0);
        assert_eq!(result.rp_gain, 0.0);
    }
}

// ---------------------------------------------------------------------------
// factory production
// ---------------------------------------------------------------------------

mod factory_production {
    use super::*;

    fn setup() -> SimState {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        seed_starting_colonies(&mut state);
        state
    }

    #[test]
    fn tick_colony_advances_production_projects() {
        let mut state = setup();
        add_colony_stock(&mut state, "Earth", "iron", 10_000.0);
        add_colony_stock(&mut state, "Earth", "copper", 5_000.0);
        add_colony_stock(&mut state, "Earth", "aluminum", 5_000.0);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_production_project(colony, "flat-mine", 1, 100.0);
        }
        // Tick enough days to complete (100 BP at ~8 BP/day = ~12 days)
        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let colony = &state.colonies["Earth"];
        assert!(
            colony
                .stockpile
                .flat_packed
                .get("flat-mine")
                .copied()
                .unwrap_or(0.0)
                >= 1.0
        );
    }

    #[test]
    fn production_deducts_resources_on_completion() {
        let mut state = setup();
        add_colony_stock(&mut state, "Earth", "iron", 10_000.0);
        add_colony_stock(&mut state, "Earth", "copper", 5_000.0);
        add_colony_stock(&mut state, "Earth", "aluminum", 5_000.0);
        let iron_before = get_colony_resource_stock(&state, "Earth", "iron");
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_production_project(colony, "flat-mine", 1, 100.0);
        }
        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let iron_after = get_colony_resource_stock(&state, "Earth", "iron");
        assert!(iron_after < iron_before);
    }

    #[test]
    fn can_afford_production_returns_false_when_resources_insufficient() {
        let mut state = setup();
        state
            .colonies
            .get_mut("Earth")
            .unwrap()
            .stockpile
            .resources
            .clear();
        let colony = &state.colonies["Earth"];
        assert!(!can_afford_production(colony, "flat-mine"));
    }

    #[test]
    fn can_afford_production_returns_true_with_sufficient_resources() {
        let mut state = setup();
        add_colony_stock(&mut state, "Earth", "iron", 10_000.0);
        add_colony_stock(&mut state, "Earth", "copper", 5_000.0);
        add_colony_stock(&mut state, "Earth", "aluminum", 5_000.0);
        let colony = &state.colonies["Earth"];
        assert!(can_afford_production(colony, "flat-mine"));
    }

    #[test]
    fn paused_production_projects_are_skipped() {
        let mut state = setup();
        add_colony_stock(&mut state, "Earth", "iron", 10_000.0);
        add_colony_stock(&mut state, "Earth", "copper", 5_000.0);
        add_colony_stock(&mut state, "Earth", "aluminum", 5_000.0);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_production_project(colony, "flat-mine", 1, 100.0);
            colony.production_projects[0].paused = true;
        }
        for _ in 0..20 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let colony = &state.colonies["Earth"];
        assert_eq!(
            colony
                .stockpile
                .flat_packed
                .get("flat-mine")
                .copied()
                .unwrap_or(0.0),
            0.0
        );
    }
}

// ---------------------------------------------------------------------------
// shipbuilding
// ---------------------------------------------------------------------------

mod shipbuilding {
    use super::*;

    fn setup() -> SimState {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        drain_completed_shipbuilds(&mut state); // clear any leftover queue
        state
    }

    #[test]
    fn compute_ship_resource_cost_scales_with_mass() {
        let design = make_ship_design(1000.0);
        let cost = compute_ship_resource_cost(&design);
        assert_eq!(
            cost.get("iron").copied().unwrap_or(0.0),
            (1000.0_f64 / 5.0).ceil()
        );
        assert_eq!(
            cost.get("aluminum").copied().unwrap_or(0.0),
            (1000.0_f64 / 20.0).ceil()
        );
        assert_eq!(
            cost.get("copper").copied().unwrap_or(0.0),
            (1000.0_f64 / 50.0).ceil()
        );
        assert_eq!(
            cost.get("silicon").copied().unwrap_or(0.0),
            (1000.0_f64 / 100.0).ceil()
        );
    }

    #[test]
    fn get_shipbuild_bp_per_day_is_zero_without_shipyards() {
        let state = fresh_state();
        let colony = make_colony("Earth");
        assert_eq!(get_shipbuild_bp_per_day(&colony, &state), 0.0);
    }

    #[test]
    fn get_shipbuild_bp_per_day_is_positive_with_shipyards() {
        let state = fresh_state();
        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 1,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            None,
        );
        assert!(get_shipbuild_bp_per_day(&colony, &state) > 0.0);
    }

    #[test]
    fn tick_shipbuilding_completes_ship_and_pushes_to_drain_queue() {
        let mut state = setup();
        let design = make_ship_design(500.0);
        let total_bp = (500.0_f64 / 50.0).ceil() as u32; // 10
        let cost = compute_ship_resource_cost(&design);
        state.ship_designs.insert(design.id.clone(), design.clone());

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: cost.clone(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_shipbuild_project(colony, &design.id, "SS Tester", &state.ship_designs);
        }
        for _ in 0..(total_bp * 10) {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let completed = drain_completed_shipbuilds(&mut state);
        assert_eq!(completed.len(), 1);
        assert_eq!(completed[0].name, "SS Tester");
        assert_eq!(completed[0].body_name, "Earth");
        assert_eq!(completed[0].design_id, design.id);
    }

    #[test]
    fn tick_shipbuilding_deducts_resources_on_completion() {
        let mut state = setup();
        let design = make_ship_design(500.0);
        let cost = compute_ship_resource_cost(&design);
        state.ship_designs.insert(design.id.clone(), design.clone());

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: cost.clone(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_shipbuild_project(colony, &design.id, "SS Deduct", &state.ship_designs);
        }
        for _ in 0..200 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        drain_completed_shipbuilds(&mut state);
        for (res, amount) in &cost {
            let remaining = get_colony_resource_stock(&state, "Earth", res);
            assert!(
                remaining <= 0.0,
                "expected {res} to be depleted, got {remaining}"
            );
            assert!(*amount > 0.0);
        }
    }

    #[test]
    fn tick_shipbuilding_stalls_when_resources_insufficient() {
        let mut state = setup();
        let design = make_ship_design(500.0);
        state.ship_designs.insert(design.id.clone(), design.clone());

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: HashMap::new(), // no resources
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_shipbuild_project(colony, &design.id, "SS Stall", &state.ship_designs);
        }
        for _ in 0..200 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let completed = drain_completed_shipbuilds(&mut state);
        assert_eq!(completed.len(), 0);
        let colony = &state.colonies["Earth"];
        assert_eq!(colony.shipbuild_projects.len(), 1);
        assert_eq!(
            colony.shipbuild_projects[0].progress_bp,
            colony.shipbuild_projects[0].total_bp
        );
    }

    #[test]
    fn paused_shipbuild_projects_are_skipped() {
        let mut state = setup();
        let design = make_ship_design(500.0);
        let cost = compute_ship_resource_cost(&design);
        state.ship_designs.insert(design.id.clone(), design.clone());

        let colony = make_colony_opts(
            "Earth",
            None,
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: cost,
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_shipbuild_project(colony, &design.id, "SS Paused", &state.ship_designs);
            let project_id = colony.shipbuild_projects[0].id.clone();
            pause_shipbuild_project(colony, &project_id);
        }
        for _ in 0..200 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        let completed = drain_completed_shipbuilds(&mut state);
        assert_eq!(completed.len(), 0);
        assert_eq!(
            state.colonies["Earth"].shipbuild_projects[0].progress_bp,
            0.0
        );
    }

    #[test]
    fn cancel_shipbuild_project_removes_project() {
        let mut state = setup();
        let design = make_ship_design(500.0);
        state.ship_designs.insert(design.id.clone(), design.clone());
        state
            .colonies
            .insert("Earth".to_string(), make_colony("Earth"));
        {
            let colony = state.colonies.get_mut("Earth").unwrap();
            add_shipbuild_project(colony, &design.id, "SS Cancel", &state.ship_designs);
            assert_eq!(colony.shipbuild_projects.len(), 1);
            let project_id = colony.shipbuild_projects[0].id.clone();
            cancel_shipbuild_project(colony, &project_id);
        }
        assert_eq!(state.colonies["Earth"].shipbuild_projects.len(), 0);
    }
}

// ---------------------------------------------------------------------------
// automated mining + mass driver
// ---------------------------------------------------------------------------

mod automated_mining_and_mass_driver {
    use super::*;

    #[test]
    fn automated_mines_extract_without_workforce() {
        let mut state = fresh_state();
        let survey = SurveyState {
            survey_level: 1,
            deposits: vec![ResourceDeposit {
                resource_id: "iron".to_string(),
                quantity: 1000,
                accessibility: 1.0,
                mined: 0.0,
                min_survey_level: 1,
            }],
        };
        state.add_body(minimal_body_data("Asteroid-1", 2.5), Some(survey));
        state.rebuild_entity_maps();

        let colony = make_colony_opts(
            "Asteroid-1",
            Some(0.0),
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 0,
                automated_mine: 2,
                mass_driver: 0,
                fuel_refinery: 0,
            }),
            None,
        );
        state.colonies.insert("Asteroid-1".to_string(), colony);

        tick_colony(&mut state, "Asteroid-1", 1.0);
        assert!(get_colony_resource_stock(&state, "Asteroid-1", "iron") > 0.0);
    }

    #[test]
    fn mass_driver_transfers_resources_to_target_colony() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Outpost", 2.0), None);
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();

        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 1000.0);
        let mut outpost = make_colony_opts(
            "Outpost",
            Some(0.0),
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 1,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        outpost.mass_driver_target = Some("Earth".to_string());

        let mut earth = make_colony("Earth");
        earth.installations.mass_driver = 1;

        state.colonies.insert("Outpost".to_string(), outpost);
        state.colonies.insert("Earth".to_string(), earth);

        tick_colony(&mut state, "Outpost", 1.0);

        assert!(
            state.colonies["Outpost"]
                .stockpile
                .resources
                .get("iron")
                .copied()
                .unwrap_or(0.0)
                < 1000.0
        );
        assert!(get_colony_resource_stock(&state, "Earth", "iron") > 0.0);
    }

    #[test]
    fn mass_driver_requires_receiver_to_have_mass_driver() {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Outpost", 2.0), None);
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();

        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 1000.0);
        let mut outpost = make_colony_opts(
            "Outpost",
            Some(0.0),
            None,
            Some(ColonyInstallations {
                construction_factory: 0,
                repair_yard: 0,
                fuel_depot: 0,
                mine: 0,
                lab: 0,
                academy: 0,
                storage: 0,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 1,
                fuel_refinery: 0,
            }),
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources,
                flat_packed: HashMap::new(),
            }),
        );
        outpost.mass_driver_target = Some("Earth".to_string());

        let earth = make_colony("Earth"); // no mass driver
        state.colonies.insert("Outpost".to_string(), outpost);
        state.colonies.insert("Earth".to_string(), earth);

        tick_colony(&mut state, "Outpost", 1.0);
        assert_eq!(
            state.colonies["Outpost"]
                .stockpile
                .resources
                .get("iron")
                .copied()
                .unwrap_or(0.0),
            1000.0
        ); // no transfer
    }

    #[test]
    fn assemble_flat_pack_converts_flat_pack_to_installation() {
        let mut flat_packed = HashMap::new();
        flat_packed.insert("flat-mine".to_string(), 2.0);
        let mut colony = make_colony_opts(
            "Earth",
            None,
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: HashMap::new(),
                flat_packed,
            }),
        );
        assert!(assemble_flat_pack(&mut colony, "flat-mine"));
        assert_eq!(colony.installations.automated_mine, 1);
        assert_eq!(
            colony
                .stockpile
                .flat_packed
                .get("flat-mine")
                .copied()
                .unwrap_or(0.0),
            1.0
        );
    }

    #[test]
    fn assemble_flat_pack_fails_when_no_flat_packs() {
        let mut colony = make_colony("Earth");
        assert!(!assemble_flat_pack(&mut colony, "flat-mine"));
        assert_eq!(colony.installations.automated_mine, 0);
    }
}

// ---------------------------------------------------------------------------
// computeSupplyDrain
// ---------------------------------------------------------------------------

mod compute_supply_drain {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn is_proportional_to_population() {
        let a = compute_supply_drain(1_000_000.0, 1.0, 1.0);
        let b = compute_supply_drain(2_000_000.0, 1.0, 1.0);
        assert_relative_eq!(b, a * 2.0, max_relative = 1e-9);
    }

    #[test]
    fn scales_with_supply_multiplier() {
        let a = compute_supply_drain(1_000_000.0, 1.0, 1.0);
        let b = compute_supply_drain(1_000_000.0, 2.0, 1.0);
        assert_relative_eq!(b, a * 2.0, max_relative = 1e-9);
    }

    #[test]
    fn scales_with_sim_dt_days() {
        let a = compute_supply_drain(1_000_000.0, 1.0, 1.0);
        let b = compute_supply_drain(1_000_000.0, 1.0, 10.0);
        assert_relative_eq!(b, a * 10.0, max_relative = 1e-9);
    }

    #[test]
    fn matches_formula_pop_times_0_001_times_multiplier_times_dt() {
        let result = compute_supply_drain(500_000.0, 2.0, 3.0);
        let expected = 500_000.0 * 0.001 * 2.0 * 3.0;
        assert_relative_eq!(result, expected, max_relative = 1e-9);
    }
}

// ---------------------------------------------------------------------------
// computeSupplyPenalty
// ---------------------------------------------------------------------------

mod compute_supply_penalty {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn returns_1_0_when_supplies_cover_90_or_more_days() {
        let drain = 10.0;
        assert_eq!(compute_supply_penalty(900.0, drain), 1.0);
        assert_eq!(compute_supply_penalty(1800.0, drain), 1.0);
    }

    #[test]
    fn returns_0_5_when_supplies_are_zero() {
        assert_eq!(compute_supply_penalty(0.0, 10.0), 0.5);
    }

    #[test]
    fn returns_1_0_when_daily_drain_is_zero() {
        assert_eq!(compute_supply_penalty(0.0, 0.0), 1.0);
    }

    #[test]
    fn lerps_between_0_5_and_1_0_based_on_days_remaining() {
        let drain = 10.0;
        // 45 days = halfway between 0 and 90 → 0.75
        assert_abs_diff_eq!(compute_supply_penalty(450.0, drain), 0.75, epsilon = 1e-9);
    }
}

// ---------------------------------------------------------------------------
// supply consumption integration
// ---------------------------------------------------------------------------

mod supply_consumption_integration {
    use super::*;

    fn setup() -> SimState {
        let mut state = fresh_state();
        state.add_body(minimal_body_data("Earth", 1.0), None);
        state.rebuild_entity_maps();
        state.supply_multiplier = 1.0;
        state.notifications.clear();
        state.reset_colony_warning_state();
        state
    }

    #[test]
    fn supplies_decrease_after_tick_colony() {
        let mut state = setup();
        let colony = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 10_000.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        tick_colony(&mut state, "Earth", 1.0);
        assert!(state.colonies["Earth"].stockpile.supplies < 10_000.0);
    }

    #[test]
    fn supplies_floor_at_zero_and_do_not_go_negative() {
        let mut state = setup();
        let colony = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        for _ in 0..10 {
            tick_colony(&mut state, "Earth", 1.0);
        }
        assert_eq!(state.colonies["Earth"].stockpile.supplies, 0.0);
    }

    #[test]
    fn colony_with_zero_supplies_has_reduced_quality_vs_well_supplied_colony() {
        let state = fresh_state();
        let depleted = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 0.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        let stocked = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 1_000_000.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        let depleted_q = compute_colony_qualities(&depleted, &state);
        let stocked_q = compute_colony_qualities(&stocked, &state);
        assert!(depleted_q.mining < stocked_q.mining);
        assert!(depleted_q.research < stocked_q.research);
        assert!(depleted_q.construction < stocked_q.construction);
    }

    #[test]
    fn warns_when_supplies_drop_below_90_days_remaining() {
        let mut state = setup();
        // 1M pop, drain = 1000/day; 80 days of supplies = 80_000
        let colony = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 80_000.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        tick_colony(&mut state, "Earth", 1.0);
        let warning = state
            .notifications
            .iter()
            .find(|n| n.notification_type == NotificationType::ColonyLowSupplies);
        assert!(warning.is_some());
        assert!(warning.unwrap().message.contains("low supplies"));
    }

    #[test]
    fn does_not_warn_when_supplies_are_above_90_days() {
        let mut state = setup();
        // 1M pop, drain = 1000/day; 100 days = 100_000 supplies
        let colony = make_colony_opts(
            "Earth",
            Some(1_000_000.0),
            None,
            None,
            Some(ColonyStockpile {
                fuel_kg: 0.0,
                supplies: 100_000.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            }),
        );
        state.colonies.insert("Earth".to_string(), colony);
        tick_colony(&mut state, "Earth", 1.0);
        let warning = state
            .notifications
            .iter()
            .find(|n| n.notification_type == NotificationType::ColonyLowSupplies);
        assert!(warning.is_none());
    }
}
