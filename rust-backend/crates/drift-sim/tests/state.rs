// Ported from src/__tests__/state.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_sim::state::{
    format_date_time, load_saved_state, load_saved_state_from_json, restore_colony_state,
    restore_ship_state, save_state, sim_time_to_date, speed_label, truncate_date, SimDateTime,
    State,
};
use drift_sim::state::{ResearchProjectEntry, SavedStateData, ScientistEntry};

// ─── simTimeToDate ────────────────────────────────────────────────────────────

mod sim_time_to_date {
    use super::*;

    #[test]
    fn returns_epoch_date_at_sim_time_0() {
        let d = sim_time_to_date(0.0);
        assert_eq!(d.year, 2038);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 20);
    }

    #[test]
    fn advances_by_one_day_per_sim_time_unit() {
        let d = sim_time_to_date(10.0);
        assert_eq!(d.day, 30);
    }

    #[test]
    fn rolls_over_months_correctly() {
        let d = sim_time_to_date(365.0);
        assert_eq!(d.year, 2039);
    }
}

// ─── simTimeToDate fractional days ───────────────────────────────────────────

mod sim_time_to_date_fractional {
    use super::*;

    #[test]
    fn returns_noon_for_sim_time_0_5() {
        let d = sim_time_to_date(0.5);
        assert_eq!(d.hour, 12);
        assert_eq!(d.minute, 0);
    }

    #[test]
    fn returns_6_am_for_sim_time_0_25() {
        let d = sim_time_to_date(0.25);
        assert_eq!(d.hour, 6);
        assert_eq!(d.minute, 0);
    }

    #[test]
    fn returns_6_pm_for_sim_time_0_75() {
        let d = sim_time_to_date(0.75);
        assert_eq!(d.hour, 18);
        assert_eq!(d.minute, 0);
    }

    #[test]
    fn handles_fractional_hours() {
        let d = sim_time_to_date(1.0 / 24.0); // 1 hour into day
        assert_eq!(d.day, 20);
        assert_eq!(d.hour, 1);
    }
}

// ─── truncateDate ─────────────────────────────────────────────────────────────

mod truncate_date {
    use super::*;

    #[test]
    fn preserves_full_precision_at_very_slow_speeds() {
        let mut d = SimDateTime {
            year: 2038,
            month: 1,
            day: 20,
            hour: 14,
            minute: 30,
            second: 45,
        };
        truncate_date(&mut d, 5.0 / 86400.0);
        assert_eq!(d.hour, 14);
        assert_eq!(d.minute, 30);
        assert_eq!(d.second, 45);
    }

    #[test]
    fn zeros_seconds_at_minute_level_speeds() {
        let mut d = SimDateTime {
            year: 2038,
            month: 1,
            day: 20,
            hour: 14,
            minute: 30,
            second: 45,
        };
        truncate_date(&mut d, 2.0 / 1440.0);
        assert_eq!(d.hour, 14);
        assert_eq!(d.minute, 30);
        assert_eq!(d.second, 0);
    }

    #[test]
    fn zeros_minutes_and_seconds_at_hour_level_speeds() {
        let mut d = SimDateTime {
            year: 2038,
            month: 1,
            day: 20,
            hour: 14,
            minute: 30,
            second: 45,
        };
        truncate_date(&mut d, 1.0 / 24.0);
        assert_eq!(d.hour, 14);
        assert_eq!(d.minute, 0);
        assert_eq!(d.second, 0);
    }

    #[test]
    fn zeros_hours_minutes_seconds_at_day_level_speeds() {
        let mut d = SimDateTime {
            year: 2038,
            month: 1,
            day: 20,
            hour: 14,
            minute: 30,
            second: 45,
        };
        truncate_date(&mut d, 8.0 / 24.0);
        assert_eq!(d.hour, 0);
        assert_eq!(d.minute, 0);
        assert_eq!(d.second, 0);
        assert_eq!(d.day, 20);
    }

    #[test]
    fn pins_day_to_1st_at_month_level_speeds() {
        let mut d = SimDateTime {
            year: 2038,
            month: 6,
            day: 15,
            hour: 14,
            minute: 30,
            second: 45,
        };
        truncate_date(&mut d, 30.0);
        assert_eq!(d.day, 1);
        assert_eq!(d.hour, 0);
    }
}

// ─── formatDateTime ───────────────────────────────────────────────────────────

mod format_date_time {
    use super::*;

    #[test]
    fn formats_date_with_zero_padded_components() {
        let d = SimDateTime {
            year: 2038,
            month: 1,
            day: 5,
            hour: 3,
            minute: 7,
            second: 9,
        };
        assert_eq!(format_date_time(&d), "2038-01-05 03:07:09");
    }

    #[test]
    fn formats_midnight_as_00_00_00() {
        let d = SimDateTime {
            year: 2038,
            month: 1,
            day: 20,
            hour: 0,
            minute: 0,
            second: 0,
        };
        assert_eq!(format_date_time(&d), "2038-01-20 00:00:00");
    }

    #[test]
    fn formats_end_of_day_correctly() {
        let d = SimDateTime {
            year: 2038,
            month: 12,
            day: 31,
            hour: 23,
            minute: 59,
            second: 59,
        };
        assert_eq!(format_date_time(&d), "2038-12-31 23:59:59");
    }
}

// ─── speedLabel ───────────────────────────────────────────────────────────────

mod speed_label {
    use super::*;

    #[test]
    fn returns_paused_for_0() {
        assert_eq!(speed_label(0.0), "Paused");
    }

    #[test]
    fn shows_hours_for_fractional_days() {
        assert_eq!(speed_label(0.25), "6 hrs / sec");
        assert_eq!(speed_label(0.5), "12 hrs / sec");
    }

    #[test]
    fn shows_days_for_1_to_29() {
        assert_eq!(speed_label(1.0), "1 day / sec");
        assert_eq!(speed_label(5.0), "5 days / sec");
    }

    #[test]
    fn shows_months_for_30_plus() {
        assert_eq!(speed_label(30.0), "1 month / sec");
        assert_eq!(speed_label(90.0), "3 months / sec");
    }
}

// ─── ship state persistence ───────────────────────────────────────────────────

mod ship_state_persistence {
    use super::*;

    #[test]
    fn restore_ship_state_round_trips_fuel_kg_and_engine_id() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "ISS Explorer".to_string(),
                ..Default::default()
            },
            fuel_kg: 100_000.0,
            engine_id: Some("chemical".to_string()),
            ..Default::default()
        }];

        let saved = SavedStateData {
            version: 4,
            sim_time: 0.0,
            current_system_key: "sol".to_string(),
            random_click_count: 0,
            discovered_systems: vec![],
            ships: vec![drift_sim::state::SavedShip {
                name: "ISS Explorer".to_string(),
                host_planet_name: "Earth".to_string(),
                fuel_kg: 75_000.0,
                engine_id: Some("nuclear".to_string()),
                ..Default::default()
            }],
            ..Default::default()
        };

        restore_ship_state(&saved, &mut state);

        let ship = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Explorer")
            .unwrap();
        assert_eq!(ship.fuel_kg, 75_000.0);
        assert_eq!(ship.engine_id.as_deref(), Some("nuclear"));
    }

    #[test]
    fn restore_ship_state_applies_saved_ship_data() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "ISS Explorer".to_string(),
                ..Default::default()
            },
            fuel_kg: 100_000.0,
            engine_id: Some("chemical".to_string()),
            ..Default::default()
        }];

        let saved = SavedStateData {
            version: 4,
            sim_time: 0.0,
            current_system_key: "sol".to_string(),
            random_click_count: 0,
            discovered_systems: vec![],
            ships: vec![drift_sim::state::SavedShip {
                name: "ISS Explorer".to_string(),
                host_planet_name: "Earth".to_string(),
                fuel_kg: 75_000.0,
                engine_id: Some("nuclear".to_string()),
                ..Default::default()
            }],
            ..Default::default()
        };

        restore_ship_state(&saved, &mut state);

        let ship = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Explorer")
            .unwrap();
        assert_eq!(ship.fuel_kg, 75_000.0);
        assert_eq!(ship.engine_id.as_deref(), Some("nuclear"));
    }

    #[test]
    fn restore_ship_state_handles_missing_ship_data_gracefully() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "ISS Explorer".to_string(),
                ..Default::default()
            },
            fuel_kg: 100_000.0,
            engine_id: Some("chemical".to_string()),
            ..Default::default()
        }];

        // null equivalent — empty SavedStateData
        restore_ship_state(&SavedStateData::default(), &mut state);
        let ship = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Explorer")
            .unwrap();
        assert_eq!(ship.fuel_kg, 100_000.0);

        // ships array present but empty
        let saved_empty = SavedStateData {
            ships: vec![],
            ..Default::default()
        };
        restore_ship_state(&saved_empty, &mut state);
        let ship = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Explorer")
            .unwrap();
        assert_eq!(ship.fuel_kg, 100_000.0);
    }

    #[test]
    fn restore_ship_state_matches_ships_by_name() {
        let mut state = State::default();
        state.body_meshes = vec![
            drift_sim::state::BodyEntry {
                is_ship: true,
                data: drift_sim::state::BodyEntryData {
                    name: "ISS Explorer".to_string(),
                    ..Default::default()
                },
                fuel_kg: 100_000.0,
                engine_id: Some("chemical".to_string()),
                ..Default::default()
            },
            drift_sim::state::BodyEntry {
                is_ship: true,
                data: drift_sim::state::BodyEntryData {
                    name: "ISS Magellan".to_string(),
                    ..Default::default()
                },
                fuel_kg: 50_000.0,
                engine_id: Some("chemical".to_string()),
                ..Default::default()
            },
        ];

        let saved = SavedStateData {
            version: 4,
            ships: vec![drift_sim::state::SavedShip {
                name: "ISS Magellan".to_string(),
                host_planet_name: "Mars".to_string(),
                fuel_kg: 30_000.0,
                engine_id: Some("nuclear".to_string()),
                ..Default::default()
            }],
            ..Default::default()
        };

        restore_ship_state(&saved, &mut state);

        let explorer = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Explorer")
            .unwrap();
        assert_eq!(explorer.fuel_kg, 100_000.0);

        let magellan = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "ISS Magellan")
            .unwrap();
        assert_eq!(magellan.fuel_kg, 30_000.0);
        assert_eq!(magellan.engine_id.as_deref(), Some("nuclear"));
    }
}

// ─── transfer state persistence ───────────────────────────────────────────────

mod transfer_state_persistence {
    use super::*;

    #[test]
    fn save_state_and_load_saved_state_round_trip_transfer_fields() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "Pathfinder".to_string(),
                body_type: "Ship".to_string(),
                ..Default::default()
            },
            host_planet_name: Some("Earth".to_string()),
            fuel_kg: 60_000.0,
            engine_id: Some("nuclear".to_string()),
            ship_state: Some("transferring".to_string()),
            transfer_target: Some("Mars".to_string()),
            transfer_start_time: Some(100.0),
            transfer_time_days: Some(200.0),
            transfer_fuel_total: Some(5000.0),
            p0x: Some(1.1),
            p0y: Some(1.15),
            p0z: Some(2.2),
            t0x: Some(3.3),
            t0y: Some(3.35),
            t0z: Some(4.4),
            p1x: Some(5.5),
            p1y: Some(5.55),
            p1z: Some(6.6),
            t1x: Some(7.7),
            t1y: Some(7.75),
            t1z: Some(8.8),
            ..Default::default()
        }];
        state.current_system_key = "sol".to_string();
        state.random_click_count = 0;
        state.discovered_systems.clear();

        save_state(&state);
        let loaded = load_saved_state().expect("loadSavedState returned None");

        let s = &loaded.ships[0];
        assert_eq!(s.ship_state.as_deref(), Some("transferring"));
        assert_eq!(s.transfer_target.as_deref(), Some("Mars"));
        assert_eq!(s.transfer_start_time, Some(100.0));
        assert_eq!(s.transfer_time_days, Some(200.0));
        assert_eq!(s.transfer_fuel_total, Some(5000.0));
        assert_eq!(s.p0x, Some(1.1));
        assert_eq!(s.p0y, Some(1.15));
        assert_eq!(s.p0z, Some(2.2));
        assert_eq!(s.t0x, Some(3.3));
        assert_eq!(s.t0y, Some(3.35));
        assert_eq!(s.t0z, Some(4.4));
        assert_eq!(s.p1x, Some(5.5));
        assert_eq!(s.p1y, Some(5.55));
        assert_eq!(s.p1z, Some(6.6));
        assert_eq!(s.t1x, Some(7.7));
        assert_eq!(s.t1y, Some(7.75));
        assert_eq!(s.t1z, Some(8.8));
    }

    #[test]
    fn restore_ship_state_restores_transfer_fields_onto_ship_entry() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "Pathfinder".to_string(),
                ..Default::default()
            },
            fuel_kg: 0.0,
            engine_id: Some("chemical".to_string()),
            ship_state: Some("orbiting".to_string()),
            transfer_target: None,
            ..Default::default()
        }];

        let saved = SavedStateData {
            version: 5,
            ships: vec![drift_sim::state::SavedShip {
                name: "Pathfinder".to_string(),
                host_planet_name: "Earth".to_string(),
                fuel_kg: 60_000.0,
                engine_id: Some("nuclear".to_string()),
                ship_state: Some("transferring".to_string()),
                transfer_target: Some("Mars".to_string()),
                transfer_start_time: Some(100.0),
                transfer_time_days: Some(200.0),
                transfer_fuel_total: Some(5000.0),
                p0x: Some(1.1),
                p0y: Some(1.15),
                p0z: Some(2.2),
                t0x: Some(3.3),
                t0y: Some(3.35),
                t0z: Some(4.4),
                p1x: Some(5.5),
                p1y: Some(5.55),
                p1z: Some(6.6),
                t1x: Some(7.7),
                t1y: Some(7.75),
                t1z: Some(8.8),
                ..Default::default()
            }],
            ..Default::default()
        };

        restore_ship_state(&saved, &mut state);

        let e = state
            .body_meshes
            .iter()
            .find(|b| b.data.name == "Pathfinder")
            .unwrap();
        assert_eq!(e.ship_state.as_deref(), Some("transferring"));
        assert_eq!(e.transfer_target.as_deref(), Some("Mars"));
        assert_eq!(e.transfer_start_time, Some(100.0));
        assert_eq!(e.transfer_time_days, Some(200.0));
        assert_eq!(e.transfer_fuel_total, Some(5000.0));
        assert_eq!(e.p0x, Some(1.1));
        assert_eq!(e.p0y, Some(1.15));
        assert_eq!(e.p1z, Some(6.6));
    }

    #[test]
    fn v4_save_loads_correctly_ships_default_to_orbiting() {
        let v4_save = r#"{
            "version": 4,
            "simTime": 0,
            "currentSystemKey": "sol",
            "randomClickCount": 0,
            "discoveredSystems": [],
            "ships": [{
                "name": "ISS Explorer",
                "hostPlanetName": "Earth",
                "fuelKg": 80000,
                "engineId": "chemical",
                "crew": { "size": 6, "morale": 1, "deploymentDays": 0 },
                "maintenance": { "hullIntegrity": 1, "supplies": 1, "age": 0, "lastMalfunction": null },
                "commandTree": { "entries": [] }
            }]
        }"#;

        let loaded = load_saved_state_from_json(v4_save).expect("load failed");
        assert!(!loaded.ships.is_empty());
        assert!(loaded.ships[0].ship_state.is_none());
        assert!(loaded.ships[0].transfer_target.is_none());
    }

    #[test]
    fn orbiting_ship_save_does_not_include_transfer_fields() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "Wanderer".to_string(),
                body_type: "Ship".to_string(),
                ..Default::default()
            },
            host_planet_name: Some("Earth".to_string()),
            fuel_kg: 50_000.0,
            engine_id: Some("chemical".to_string()),
            ship_state: Some("orbiting".to_string()),
            transfer_target: None,
            p0x: None,
            p0y: None,
            p0z: None,
            ..Default::default()
        }];
        state.current_system_key = "sol".to_string();
        state.random_click_count = 0;
        state.discovered_systems.clear();

        save_state(&state);
        let loaded = load_saved_state().expect("loadSavedState returned None");

        let s = &loaded.ships[0];
        assert!(s.ship_state.is_none());
        assert!(s.transfer_target.is_none());
        assert!(s.p0x.is_none());
    }

    #[test]
    fn save_state_includes_non_sol_discovered_systems() {
        let mut state = State::default();
        state.body_meshes = vec![drift_sim::state::BodyEntry {
            is_ship: true,
            data: drift_sim::state::BodyEntryData {
                name: "Scout".to_string(),
                body_type: "Ship".to_string(),
                ..Default::default()
            },
            host_planet_name: Some("Earth".to_string()),
            fuel_kg: 50_000.0,
            ..Default::default()
        }];
        state.current_system_key = "sol".to_string();
        state.random_click_count = 0;
        state.discovered_systems.clear();
        state.discovered_systems.insert(
            "sol".to_string(),
            drift_types::DiscoveredSystem {
                name: "Sol".to_string(),
                seed: 0,
                system_data: None,
            },
        );
        state.discovered_systems.insert(
            "alpha-centauri".to_string(),
            drift_types::DiscoveredSystem {
                name: "Alpha Centauri".to_string(),
                seed: 12345,
                system_data: None,
            },
        );

        save_state(&state);
        let loaded = load_saved_state().expect("loadSavedState returned None");

        assert_eq!(loaded.discovered_systems.len(), 1);
        assert_eq!(loaded.discovered_systems[0].key, "alpha-centauri");
        assert_eq!(loaded.discovered_systems[0].name, "Alpha Centauri");
        assert_eq!(loaded.discovered_systems[0].seed, 12345);
    }

    #[test]
    fn save_state_and_restore_colony_state_round_trip_colonies() {
        let mut state = State::default();
        state.colonies.clear();
        state.colonies.insert(
            "Earth".to_string(),
            drift_types::ColonyState {
                body_name: "Earth".to_string(),
                name: "Earth Colony".to_string(),
                population: 5_000_000_000.0,
                habitability: 1.0,
                installations: drift_types::ColonyInstallations {
                    construction_factory: 4,
                    repair_yard: 4,
                    fuel_depot: 4,
                    mine: 2,
                    lab: 6,
                    academy: 2,
                    storage: 6,
                    shipyard: 1,
                    ..Default::default()
                },
                stockpile: drift_types::ColonyStockpile {
                    fuel_kg: 12345.0,
                    supplies: 678.0,
                    resources: {
                        let mut m = std::collections::HashMap::new();
                        m.insert("iron".to_string(), 99.0);
                        m
                    },
                    flat_packed: std::collections::HashMap::new(),
                },
                research_points: 42.0,
                ..Default::default()
            },
        );
        state.scientists = std::collections::HashMap::new();
        state.research_projects = std::collections::HashMap::new();
        state.game_log = vec![];
        state.body_meshes = vec![];
        state.current_system_key = "sol".to_string();
        state.random_click_count = 0;
        state.discovered_systems.clear();

        save_state(&state);
        let loaded = load_saved_state().expect("loadSavedState returned None");

        state.colonies.clear();
        restore_colony_state(&loaded, &mut state);

        let earth = state.colonies.get("Earth").expect("Earth colony missing");
        assert_eq!(earth.body_name, "Earth");
        assert_eq!(earth.population, 5_000_000_000.0);
        assert_eq!(earth.research_points, 42.0);
        assert_eq!(*earth.stockpile.resources.get("iron").unwrap(), 99.0);
    }

    #[test]
    fn load_saved_state_migrates_v3_save_with_singular_ship_to_v5() {
        let v3_save = r#"{
            "version": 3,
            "simTime": 0,
            "currentSystemKey": "sol",
            "randomClickCount": 0,
            "ship": {
                "fuelKg": 42000,
                "engineId": "chemical",
                "crew": { "size": 6, "morale": 1, "deploymentDays": 0 },
                "maintenance": { "hullIntegrity": 1, "supplies": 1, "age": 0 },
                "commandTree": { "entries": [] }
            }
        }"#;

        let loaded = load_saved_state_from_json(v3_save).expect("migration failed");
        assert_eq!(loaded.ships.len(), 1);
        assert_eq!(loaded.ships[0].name, "ISS Explorer");
        assert_eq!(loaded.ships[0].host_planet_name, "Earth");
        assert_eq!(loaded.ships[0].fuel_kg, 42_000.0);
    }

    #[test]
    fn load_saved_state_returns_none_for_corrupted_json() {
        assert!(load_saved_state_from_json("not valid json {{{").is_none());
    }
}

// ─── restoreColonyState — scientists and researchProjects ─────────────────────

mod restore_colony_state_scientists_and_research {
    use super::*;

    #[test]
    fn restores_scientists_map_from_saved_data() {
        let mut state = State::default();
        state.scientists.clear();
        state.research_projects.clear();

        let saved = SavedStateData {
            version: 8,
            sim_time: 0.0,
            current_system_key: "sol".to_string(),
            random_click_count: 0,
            discovered_systems: vec![],
            ships: vec![],
            colonies: vec![],
            scientists: vec![ScientistEntry {
                id: "sci-1".to_string(),
                name: "Dr. Test".to_string(),
                colony_body_name: "Earth".to_string(),
                primary_category: "physics".to_string(),
                secondary_category: Some("engineering".to_string()),
                active_project_tech_id: None,
                project_queue: vec!["survey-automation".to_string()],
                assigned_labs: 2,
                admin_cap: 3,
                category_bonuses: std::collections::HashMap::new(),
                completed_projects: vec![],
                experience_by_category: std::collections::HashMap::new(),
            }],
            research_projects: vec![],
            ..Default::default()
        };

        restore_colony_state(&saved, &mut state);
        assert_eq!(state.scientists.len(), 1);
        assert_eq!(
            state.scientists.get("sci-1").unwrap().project_queue,
            vec!["survey-automation".to_string()]
        );
    }

    #[test]
    fn restores_research_projects_map_from_saved_data() {
        let mut state = State::default();
        state.scientists.clear();
        state.research_projects.clear();

        let saved = SavedStateData {
            version: 8,
            sim_time: 0.0,
            current_system_key: "sol".to_string(),
            random_click_count: 0,
            discovered_systems: vec![],
            ships: vec![],
            colonies: vec![],
            scientists: vec![],
            research_projects: vec![ResearchProjectEntry {
                tech_id: "survey-automation".to_string(),
                colony_body_name: "Earth".to_string(),
                lead_scientist_id: None,
                assigned_labs: 2,
                progress_rp: 15.0,
                paused: false,
                queued_at: 100.0,
                started_at: 100.0,
                difficulty: 1.0,
            }],
            ..Default::default()
        };

        restore_colony_state(&saved, &mut state);
        assert_eq!(state.research_projects.len(), 1);
        assert_eq!(
            state
                .research_projects
                .get("survey-automation")
                .unwrap()
                .progress_rp,
            15.0
        );
    }
}
