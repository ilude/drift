// Ported from src/__tests__/entities.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_sim::entities::{
    find_asteroid_entity, find_body, find_planet, find_ship, find_star, list_ships,
    list_ships_at_body, rebuild_entity_maps, resolve_entity,
};
use drift_sim::state::State;
use drift_types::{AsteroidBeltEntry, AsteroidEntry, BeltDef, BodyData, BodyEntry, SurveyState};

fn mock_body(name: &str, body_type: &str) -> BodyEntry {
    mock_body_ext(name, body_type, false, false, false)
}

fn mock_body_ext(
    name: &str,
    body_type: &str,
    is_moon: bool,
    is_ship: bool,
    is_comet: bool,
) -> BodyEntry {
    BodyEntry {
        data: BodyData {
            name: name.to_string(),
            body_type: body_type.to_string(),
            distance: 1.0,
            mass: 1.0,
        },
        position: [1.0, 0.0, 2.0],
        speed: 0.01,
        is_moon,
        is_ship,
        is_comet,
        survey: SurveyState {
            survey_level: 0,
            deposits: vec![],
        },
        ..BodyEntry::default()
    }
}

fn mock_belt_entry(designations: &[&str]) -> AsteroidBeltEntry {
    let count = designations.len();
    let mut positions = vec![0.0f32; count * 3];
    for (i, _) in designations.iter().enumerate() {
        positions[i * 3] = (i * 10 + 5) as f32;
        positions[i * 3 + 1] = 0.0;
        positions[i * 3 + 2] = (i * 10 + 3) as f32;
    }
    AsteroidBeltEntry {
        belt: BeltDef {
            name: "Main Belt".to_string(),
            min_au: 2.0,
            max_au: 3.5,
            count,
            color: "#aaa".to_string(),
            size: 1.0,
            max_inc: 5.0,
        },
        positions,
        count,
        asteroids: designations
            .iter()
            .enumerate()
            .map(|(i, d)| AsteroidEntry {
                designation: d.to_string(),
                au: 2.5,
                period: 3.95,
                diameter: 100.0,
                mass: 1e15,
                belt_index: i,
                survey: SurveyState {
                    survey_level: 0,
                    deposits: vec![],
                },
            })
            .collect(),
    }
}

// ─── rebuildEntityMaps ────────────────────────────────────────────────────────

mod rebuild_entity_maps {
    use super::*;

    #[test]
    fn populates_body_map_from_state_body_meshes() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_body("Earth", &state);
        assert!(found);
    }

    #[test]
    fn populates_asteroid_map_from_state_asteroid_belts() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0001"])];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_asteroid_entity("MB-0001", &state);
        assert!(found);
    }

    #[test]
    fn clears_stale_entries_on_subsequent_calls() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        state.body_meshes = vec![];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_body("Earth", &state);
        assert!(!found);
    }

    #[test]
    fn clears_stale_asteroid_entries_on_subsequent_calls() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0001"])];
        rebuild_entity_maps(&mut state);
        state.asteroid_belts = vec![];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_asteroid_entity("MB-0001", &state);
        assert!(!found);
    }
}

// ─── resolveEntity ────────────────────────────────────────────────────────────

mod resolve_entity {
    use super::*;

    #[test]
    fn returns_body_for_a_planet() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Mars", "Planet")];
        rebuild_entity_maps(&mut state);
        let (result, found) = resolve_entity("Mars", &state);
        assert!(found);
        let r = result.unwrap();
        assert_eq!(r.name, "Mars");
        assert_eq!(r.body_type, "Planet");
        assert!(r.body_entry.is_some());
        assert!(r.asteroid_hit.is_none());
    }

    #[test]
    fn returns_body_for_a_moon() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Titan", "Moon", true, false, false)];
        rebuild_entity_maps(&mut state);
        let (result, found) = resolve_entity("Titan", &state);
        assert!(found);
        let r = result.unwrap();
        assert!(r.is_moon);
    }

    #[test]
    fn returns_body_for_a_comet() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Halley", "Comet", false, false, true)];
        rebuild_entity_maps(&mut state);
        let (result, found) = resolve_entity("Halley", &state);
        assert!(found);
        let r = result.unwrap();
        assert_eq!(r.body_type, "Comet");
    }

    #[test]
    fn returns_body_for_a_ship() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Endeavour", "Ship", false, true, false)];
        rebuild_entity_maps(&mut state);
        let (result, found) = resolve_entity("Endeavour", &state);
        assert!(found);
        let r = result.unwrap();
        assert_eq!(r.body_type, "Ship");
    }

    #[test]
    fn returns_asteroid_entity_for_a_designation() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0042"])];
        rebuild_entity_maps(&mut state);
        let (result, found) = resolve_entity("MB-0042", &state);
        assert!(found);
        let r = result.unwrap();
        assert_eq!(r.name, "MB-0042");
        assert_eq!(r.body_type, "Asteroid");
        assert!(r.asteroid_hit.is_some());
        assert!(r.body_entry.is_none());
    }

    #[test]
    fn returns_null_for_unknown_name() {
        let mut state = State::default();
        rebuild_entity_maps(&mut state);
        let (_, found) = resolve_entity("Unknown-9999", &state);
        assert!(!found);
    }

    #[test]
    fn returns_a_fresh_position_object_per_call_no_aliasing() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Venus", "Planet")];
        rebuild_entity_maps(&mut state);
        let (r1, _) = resolve_entity("Venus", &state);
        let (r2, _) = resolve_entity("Venus", &state);
        let r1 = r1.unwrap();
        let r2 = r2.unwrap();
        // Each call returns an independent position value (not a shared reference)
        // In Rust we verify by mutation: they are separate structs on the stack
        assert_eq!(r1.position, r2.position);
        // If they were aliased, this would be the same pointer — in Rust this
        // is always satisfied since values are moved/copied, not shared.
        // The test just confirms both calls succeed and produce equal values.
    }

    #[test]
    fn returns_fresh_asteroid_position_per_call() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0001"])];
        rebuild_entity_maps(&mut state);
        let (r1, _) = resolve_entity("MB-0001", &state);
        let (r2, _) = resolve_entity("MB-0001", &state);
        let r1 = r1.unwrap();
        let r2 = r2.unwrap();
        assert_eq!(r1.position, r2.position);
    }

    #[test]
    fn asteroid_position_matches_float32_array_data() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0001"])];
        rebuild_entity_maps(&mut state);
        let (result, _) = resolve_entity("MB-0001", &state);
        // belt_index 0 → positions[0]=5, [1]=0, [2]=3
        let r = result.unwrap();
        assert_eq!(r.position[0], 5.0);
        assert_eq!(r.position[1], 0.0);
        assert_eq!(r.position[2], 3.0);
    }
}

// ─── findBody ─────────────────────────────────────────────────────────────────

mod find_body {
    use super::*;

    #[test]
    fn returns_body_entry_for_known_name() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Jupiter", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_body("Jupiter", &state);
        assert!(found);
    }

    #[test]
    fn returns_undefined_for_unknown_name() {
        let mut state = State::default();
        rebuild_entity_maps(&mut state);
        let (_, found) = find_body("Nonexistent", &state);
        assert!(!found);
    }

    #[test]
    fn returns_ships_too() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Pioneer", "Ship", false, true, false)];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_body("Pioneer", &state);
        assert!(found);
    }
}

// ─── findPlanet ───────────────────────────────────────────────────────────────

mod find_planet {
    use super::*;

    #[test]
    fn returns_planet_entry_for_a_planet() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Saturn", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_planet("Saturn", &state);
        assert!(found);
    }

    #[test]
    fn rejects_moons_is_comet_undefined_but_is_moon_true_is_planet_entry_passes_so_moon_is_a_planet_entry(
    ) {
        // Moons are stored as PlanetEntry with is_moon=true — find_planet returns them
        let moon = mock_body_ext("Phobos", "Moon", true, false, false);
        let mut state = State::default();
        state.body_meshes = vec![moon];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_planet("Phobos", &state);
        assert!(found);
    }

    #[test]
    fn rejects_ships() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Voyager", "Ship", false, true, false)];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_planet("Voyager", &state);
        assert!(!found);
    }

    #[test]
    fn rejects_comets() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Comet-X", "Comet", false, false, true)];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_planet("Comet-X", &state);
        assert!(!found);
    }

    #[test]
    fn returns_undefined_for_unknown_name() {
        let mut state = State::default();
        rebuild_entity_maps(&mut state);
        let (_, found) = find_planet("Unknown", &state);
        assert!(!found);
    }
}

// ─── findAsteroidEntity ───────────────────────────────────────────────────────

mod find_asteroid_entity {
    use super::*;

    #[test]
    fn returns_hit_for_known_designation() {
        let mut state = State::default();
        state.asteroid_belts = vec![mock_belt_entry(&["MB-0007"])];
        rebuild_entity_maps(&mut state);
        let (hit, found) = find_asteroid_entity("MB-0007", &state);
        assert!(found);
        let h = hit.unwrap();
        assert_eq!(h.asteroid.designation, "MB-0007");
    }

    #[test]
    fn returns_undefined_for_unknown_designation() {
        let mut state = State::default();
        rebuild_entity_maps(&mut state);
        let (_, found) = find_asteroid_entity("ZZ-9999", &state);
        assert!(!found);
    }
}

// ─── findShip ─────────────────────────────────────────────────────────────────

mod find_ship {
    use super::*;

    #[test]
    fn returns_ship_by_name() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body_ext("Argo", "Ship", false, true, false)];
        rebuild_entity_maps(&mut state);
        let (ship, found) = find_ship(Some("Argo"), &state);
        assert!(found);
        let s = ship.unwrap();
        assert_eq!(s.data.name, "Argo");
    }

    #[test]
    fn returns_first_ship_when_no_name_given() {
        let mut state = State::default();
        state.body_meshes = vec![
            mock_body("Earth", "Planet"),
            mock_body_ext("Hermes", "Ship", false, true, false),
        ];
        rebuild_entity_maps(&mut state);
        let (ship, found) = find_ship(None, &state);
        assert!(found);
        let s = ship.unwrap();
        assert_eq!(s.data.body_type, "Ship");
    }

    #[test]
    fn returns_undefined_when_no_ships_exist_and_no_name_given() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_ship(None, &state);
        assert!(!found);
    }

    #[test]
    fn returns_undefined_when_named_ship_does_not_exist() {
        let mut state = State::default();
        rebuild_entity_maps(&mut state);
        let (_, found) = find_ship(Some("Ghost"), &state);
        assert!(!found);
    }

    #[test]
    fn returns_undefined_when_named_entry_exists_but_is_not_a_ship() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_ship(Some("Earth"), &state);
        assert!(!found);
    }
}

// ─── findStar ─────────────────────────────────────────────────────────────────

mod find_star {
    use super::*;

    #[test]
    fn returns_the_star_entry() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Sol", "Star")];
        rebuild_entity_maps(&mut state);
        let (star, found) = find_star(&state);
        assert!(found);
        let s = star.unwrap();
        assert_eq!(s.data.body_type, "Star");
    }

    #[test]
    fn returns_undefined_when_no_star_exists() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        let (_, found) = find_star(&state);
        assert!(!found);
    }
}

// ─── listShips ────────────────────────────────────────────────────────────────

mod list_ships {
    use super::*;

    #[test]
    fn returns_only_ships_from_body_meshes() {
        let mut state = State::default();
        state.body_meshes = vec![
            mock_body("Earth", "Planet"),
            mock_body_ext("Hermes", "Ship", false, true, false),
            mock_body_ext("Ares", "Ship", false, true, false),
        ];
        rebuild_entity_maps(&mut state);
        let ships = list_ships(&state);
        assert_eq!(ships.len(), 2);
        assert!(ships.iter().all(|s| s.data.body_type == "Ship"));
    }

    #[test]
    fn returns_empty_array_when_no_ships_exist() {
        let mut state = State::default();
        state.body_meshes = vec![mock_body("Earth", "Planet")];
        rebuild_entity_maps(&mut state);
        assert_eq!(list_ships(&state).len(), 0);
    }
}

// ─── listShipsAtBody ──────────────────────────────────────────────────────────

mod list_ships_at_body {
    use super::*;

    fn mock_ship_at(name: &str, host: &str, ship_state: &str) -> BodyEntry {
        let mut b = mock_body_ext(name, "Ship", false, true, false);
        b.host_planet_name = Some(host.to_string());
        b.ship_state = Some(ship_state.to_string());
        b
    }

    #[test]
    fn returns_orbiting_ships_at_the_named_body() {
        let mut state = State::default();
        state.body_meshes = vec![
            mock_body("Mars", "Planet"),
            mock_ship_at("Ares", "Mars", "orbiting"),
            mock_ship_at("Hermes", "Earth", "orbiting"),
        ];
        rebuild_entity_maps(&mut state);
        let ships = list_ships_at_body("Mars", &state);
        assert_eq!(ships.len(), 1);
        assert_eq!(ships[0].data.name, "Ares");
    }

    #[test]
    fn excludes_transferring_ships() {
        let mut state = State::default();
        state.body_meshes = vec![
            mock_body("Mars", "Planet"),
            mock_ship_at("Ares", "Mars", "transferring"),
        ];
        rebuild_entity_maps(&mut state);
        assert_eq!(list_ships_at_body("Mars", &state).len(), 0);
    }
}
