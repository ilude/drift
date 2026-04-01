// Ported from src/__tests__/survey-planner.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_math::game_clock::GameClock;
use drift_sim::entities::rebuild_entity_maps;
use drift_sim::intents::publish_intent;
use drift_sim::state::State;
use drift_sim::survey_planner::{advance_survey_plan, clear_survey_plan, compute_survey_plan};
use drift_sim::{BodyEntry, BodyEntryData, Commander, ShipEntry, ShipIntent, SurveyPlan};
use drift_types::SurveyState;

fn mock_body(name: &str, x: f32, z: f32, surveyed: bool) -> BodyEntry {
    BodyEntry {
        data: BodyEntryData {
            name: name.to_string(),
            body_type: "Planet".to_string(),
            distance: 1.0,
            mass: 1e24,
            radius: 1000.0,
            color: "#fff".to_string(),
        },
        position: [x, 0.0, z],
        survey: SurveyState {
            survey_level: if surveyed { 1 } else { 0 },
            survey_duration: 10.0,
            survey_progress: 0.0,
            deposits: vec![],
        },
        is_moon: false,
        is_ship: false,
        is_comet: false,
        ..BodyEntry::default()
    }
}

fn mock_ship(name: &str, x: f32, z: f32) -> ShipEntry {
    mock_ship_ext(name, x, z, ShipOverrides::default())
}

#[derive(Default)]
struct ShipOverrides {
    fuel_kg: Option<f64>,
    commander_caution: Option<f64>,
    commander_initiative: Option<f64>,
    survey_plan: Option<Option<SurveyPlan>>,
}

fn mock_ship_ext(name: &str, x: f32, z: f32, overrides: ShipOverrides) -> ShipEntry {
    ShipEntry {
        name: name.to_string(),
        position: [x, 0.0, z],
        is_ship: true,
        ship_state: "orbiting".to_string(),
        host_planet_name: "Earth".to_string(),
        fuel_kg: overrides.fuel_kg.unwrap_or(50_000.0),
        fuel_capacity_kg: 50_000.0,
        dry_mass_kg: 5_000.0,
        engine_id: Some("conventional".to_string()),
        design_id: None,
        commander: Commander {
            caution: overrides.commander_caution.unwrap_or(0.5),
            initiative: overrides.commander_initiative.unwrap_or(0.5),
            experience: 0.0,
        },
        survey_plan: overrides.survey_plan.flatten(),
        ..ShipEntry::default()
    }
}

fn setup_system(state: &mut State, bodies: Vec<BodyEntry>, ships: Vec<ShipEntry>) {
    let mut all_bodies: Vec<BodyEntry> = bodies;
    for ship in ships {
        all_bodies.push(BodyEntry::from_ship(ship));
    }
    state.body_meshes = all_bodies;
    state.asteroid_belts = vec![];
    state.ship_intents.clear();
    state.sim_time = GameClock::from_days(100.0);
    state.fuel_burn_multiplier = 1.0;
    state.survey_multiplier = 0.1;
    state.colonies.clear();
    state.engine_designs.clear();
    state.ship_designs.clear();
    rebuild_entity_maps(state);
}

// ─── computeSurveyPlan ────────────────────────────────────────────────────────

mod compute_survey_plan {
    use super::*;

    fn setup_with_earth_colony(state: &mut State) {
        state.colonies.clear();
        state.colonies.insert(
            "Earth".to_string(),
            drift_types::ColonyState {
                body_name: "Earth".to_string(),
                ..drift_types::ColonyState::default()
            },
        );
    }

    #[test]
    fn returns_null_when_commander_judgment_is_too_low() {
        let mut state = State::default();
        setup_with_earth_colony(&mut state);
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let target1 = mock_body("Mars", 248.0, 0.0, false);
        let target2 = mock_body("Jupiter", 454.0, 0.0, false);
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                commander_caution: Some(0.1),
                commander_initiative: Some(0.1),
                ..Default::default()
            },
        );
        setup_system(&mut state, vec![earth, target1, target2], vec![ship]);

        let plan = compute_survey_plan("Explorer", &mut state);
        assert!(plan.is_none());
    }

    #[test]
    fn returns_null_when_fewer_than_2_candidates() {
        let mut state = State::default();
        setup_with_earth_colony(&mut state);
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let target1 = mock_body("Mars", 248.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, target1], vec![ship]);

        let plan = compute_survey_plan("Explorer", &mut state);
        assert!(plan.is_none());
    }

    #[test]
    fn produces_a_plan_with_multiple_targets_when_candidates_exist() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let t1 = mock_body("Target-A", 210.0, 0.0, false);
        let t2 = mock_body("Target-B", 220.0, 0.0, false);
        let t3 = mock_body("Target-C", 230.0, 0.0, false);
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                fuel_kg: Some(50_000.0),
                ..Default::default()
            },
        );
        setup_system(&mut state, vec![earth, t1, t2, t3], vec![ship]);
        setup_with_earth_colony(&mut state);

        let plan = compute_survey_plan("Explorer", &mut state);
        assert!(plan.is_some());
        let p = plan.unwrap();
        assert!(p.targets.len() >= 2);
        assert!(p.accel_g > 0.0);
    }

    #[test]
    fn orders_targets_by_nearest_neighbor_from_ship_position() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let far = mock_body("Far", 400.0, 0.0, false);
        let near = mock_body("Near", 210.0, 0.0, false);
        let mid = mock_body("Mid", 250.0, 0.0, false);
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                fuel_kg: Some(50_000.0),
                ..Default::default()
            },
        );
        setup_system(&mut state, vec![earth, far, near, mid], vec![ship]);
        setup_with_earth_colony(&mut state);

        let plan = compute_survey_plan("Explorer", &mut state).expect("expected plan");
        let near_idx = plan.targets.iter().position(|t| t == "Near");
        let mid_idx = plan.targets.iter().position(|t| t == "Mid");
        if let (Some(ni), Some(mi)) = (near_idx, mid_idx) {
            assert!(ni < mi);
        }
    }

    #[test]
    fn publishes_survey_plan_intent_claiming_all_targets() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let t1 = mock_body("A", 210.0, 0.0, false);
        let t2 = mock_body("B", 220.0, 0.0, false);
        let t3 = mock_body("C", 230.0, 0.0, false);
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                fuel_kg: Some(50_000.0),
                ..Default::default()
            },
        );
        setup_system(&mut state, vec![earth, t1, t2, t3], vec![ship]);
        setup_with_earth_colony(&mut state);

        compute_survey_plan("Explorer", &mut state);

        let intent = state.ship_intents.get("Explorer");
        assert!(intent.is_some());
        assert!(matches!(intent, Some(ShipIntent::SurveyPlan { .. })));
        if let Some(ShipIntent::SurveyPlan { targets, .. }) = intent {
            assert!(targets.len() >= 2);
        }
    }
}

// ─── advanceSurveyPlan ────────────────────────────────────────────────────────

mod advance_survey_plan {
    use super::*;

    #[test]
    fn returns_null_when_ship_has_no_plan() {
        let mut state = State::default();
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![], vec![ship]);

        assert!(advance_survey_plan("Explorer", &mut state).is_none());
    }

    #[test]
    fn returns_next_target_from_plan() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let t1 = mock_body("Alpha", 210.0, 0.0, false);
        let t2 = mock_body("Beta", 220.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, t1, t2], vec![ship]);

        publish_intent(
            "Explorer",
            ShipIntent::SurveyPlan {
                targets: vec!["Alpha".to_string(), "Beta".to_string()],
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["Alpha".to_string(), "Beta".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        let target = advance_survey_plan("Explorer", &mut state);
        assert_eq!(target, Some("Alpha".to_string()));
        assert_eq!(
            state
                .find_ship_mut("Explorer")
                .unwrap()
                .survey_plan
                .as_ref()
                .unwrap()
                .targets,
            vec!["Beta".to_string()]
        );
    }

    #[test]
    fn skips_already_surveyed_targets() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let surveyed = mock_body("Done", 210.0, 0.0, true);
        let unsurveyed = mock_body("Todo", 220.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, surveyed, unsurveyed], vec![ship]);

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["Done".to_string(), "Todo".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        let target = advance_survey_plan("Explorer", &mut state);
        assert_eq!(target, Some("Todo".to_string()));
    }

    #[test]
    fn clears_plan_and_returns_null_when_all_targets_consumed() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let surveyed = mock_body("Done", 210.0, 0.0, true);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, surveyed], vec![ship]);

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["Done".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        let target = advance_survey_plan("Explorer", &mut state);
        assert!(target.is_none());
        assert!(state
            .find_ship_mut("Explorer")
            .unwrap()
            .survey_plan
            .is_none());
    }

    #[test]
    fn skips_targets_claimed_by_other_ships() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let claimed = mock_body("Taken", 210.0, 0.0, false);
        let free = mock_body("Free", 220.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        let other = mock_ship("Other", 210.0, 0.0);
        setup_system(&mut state, vec![earth, claimed, free], vec![ship, other]);

        publish_intent(
            "Other",
            ShipIntent::Surveying {
                target: "Taken".to_string(),
                ship_name: "Other".to_string(),
            },
            &mut state,
        );

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["Taken".to_string(), "Free".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        let target = advance_survey_plan("Explorer", &mut state);
        assert_eq!(target, Some("Free".to_string()));
    }
}

// ─── progressive intent claiming ─────────────────────────────────────────────

mod progressive_intent_claiming {
    use super::*;

    fn setup_with_earth_colony(state: &mut State) {
        state.colonies.clear();
        state.colonies.insert(
            "Earth".to_string(),
            drift_types::ColonyState {
                body_name: "Earth".to_string(),
                ..drift_types::ColonyState::default()
            },
        );
    }

    #[test]
    fn compute_survey_plan_claims_at_most_3_targets_in_intent() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let mut bodies = vec![earth];
        for i in 0..8 {
            bodies.push(mock_body(
                &format!("T{i}"),
                205.0 + i as f32 * 5.0,
                0.0,
                false,
            ));
        }
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                fuel_kg: Some(50_000.0),
                ..Default::default()
            },
        );
        setup_system(&mut state, bodies, vec![ship]);
        setup_with_earth_colony(&mut state);

        let plan = compute_survey_plan("Explorer", &mut state).expect("expected plan");
        assert!(plan.targets.len() > 3);

        let intent = state.ship_intents.get("Explorer");
        assert!(intent.is_some());
        if let Some(ShipIntent::SurveyPlan { targets, .. }) = intent {
            assert!(targets.len() <= 3);
        }
    }

    #[test]
    fn advance_survey_plan_shifts_claim_window() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let t1 = mock_body("A", 210.0, 0.0, false);
        let t2 = mock_body("B", 215.0, 0.0, false);
        let t3 = mock_body("C", 220.0, 0.0, false);
        let t4 = mock_body("D", 225.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, t1, t2, t3, t4], vec![ship]);

        publish_intent(
            "Explorer",
            ShipIntent::SurveyPlan {
                targets: vec!["A".to_string(), "B".to_string(), "C".to_string()],
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec![
                "A".to_string(),
                "B".to_string(),
                "C".to_string(),
                "D".to_string(),
            ],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        advance_survey_plan("Explorer", &mut state);

        let intent = state.ship_intents.get("Explorer");
        if let Some(ShipIntent::SurveyPlan { targets, .. }) = intent {
            assert_eq!(
                targets,
                &vec!["B".to_string(), "C".to_string(), "D".to_string()]
            );
        }
    }
}

// ─── survey plan re-planning ──────────────────────────────────────────────────

mod survey_plan_replanning {
    use super::*;

    fn setup_with_earth_colony(state: &mut State) {
        state.colonies.clear();
        state.colonies.insert(
            "Earth".to_string(),
            drift_types::ColonyState {
                body_name: "Earth".to_string(),
                ..drift_types::ColonyState::default()
            },
        );
    }

    #[test]
    fn recomputes_plan_when_all_targets_consumed_but_unsurveyed_bodies_remain() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let done1 = mock_body("Done1", 210.0, 0.0, true);
        let done2 = mock_body("Done2", 215.0, 0.0, true);
        let fresh1 = mock_body("Fresh1", 220.0, 0.0, false);
        let fresh2 = mock_body("Fresh2", 225.0, 0.0, false);
        let fresh3 = mock_body("Fresh3", 230.0, 0.0, false);
        let ship = mock_ship_ext(
            "Explorer",
            200.0,
            0.0,
            ShipOverrides {
                fuel_kg: Some(50_000.0),
                ..Default::default()
            },
        );
        setup_system(
            &mut state,
            vec![earth, done1, done2, fresh1, fresh2, fresh3],
            vec![ship],
        );
        setup_with_earth_colony(&mut state);

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["Done1".to_string(), "Done2".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        let target = advance_survey_plan("Explorer", &mut state);
        // Old plan's targets are all surveyed, but new targets exist
        // Should recompute and return a fresh target
        assert!(target.is_some());
        assert!(state
            .find_ship_mut("Explorer")
            .unwrap()
            .survey_plan
            .is_some());
        if let Some(ref plan) = state.find_ship_mut("Explorer").unwrap().survey_plan {
            assert!(!plan.targets.is_empty());
        }
    }
}

// ─── clearSurveyPlan ──────────────────────────────────────────────────────────

mod clear_survey_plan {
    use super::*;

    #[test]
    fn sets_survey_plan_to_null() {
        let mut state = State::default();
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![], vec![ship]);

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["A".to_string(), "B".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });
        clear_survey_plan("Explorer", &mut state);
        assert!(state
            .find_ship_mut("Explorer")
            .unwrap()
            .survey_plan
            .is_none());
    }

    #[test]
    fn is_a_no_op_when_plan_is_already_null() {
        let mut state = State::default();
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![], vec![ship]);

        state.find_ship_mut("Explorer").unwrap().survey_plan = None;
        clear_survey_plan("Explorer", &mut state);
        assert!(state
            .find_ship_mut("Explorer")
            .unwrap()
            .survey_plan
            .is_none());
    }

    #[test]
    fn removes_intent_from_pool_when_plan_is_cleared() {
        let mut state = State::default();
        let earth = mock_body("Earth", 200.0, 0.0, true);
        let t1 = mock_body("X", 210.0, 0.0, false);
        let t2 = mock_body("Y", 220.0, 0.0, false);
        let ship = mock_ship("Explorer", 200.0, 0.0);
        setup_system(&mut state, vec![earth, t1, t2], vec![ship]);

        publish_intent(
            "Explorer",
            ShipIntent::SurveyPlan {
                targets: vec!["X".to_string(), "Y".to_string()],
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );

        state.find_ship_mut("Explorer").unwrap().survey_plan = Some(SurveyPlan {
            targets: vec!["X".to_string(), "Y".to_string()],
            accel_g: 0.1,
            return_fuel_kg: 0.0,
        });

        clear_survey_plan("Explorer", &mut state);

        assert!(state
            .find_ship_mut("Explorer")
            .unwrap()
            .survey_plan
            .is_none());
        assert!(state.ship_intents.get("Explorer").is_none());
    }
}
