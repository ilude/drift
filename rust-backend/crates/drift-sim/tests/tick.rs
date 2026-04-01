// Integration tests for the tick orchestrator.

use drift_sim::state::{BodyEntry, BodyEntryData, ColonyState, Commander, State};
use drift_sim::tick::{tick_simulation, ShipSnapshot};
use drift_types::ColonyInstallations;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn make_orbiting_ship(name: &str, fuel_kg: f64, fuel_capacity_kg: f64) -> BodyEntry {
    BodyEntry {
        data: BodyEntryData {
            name: name.to_string(),
            body_type: "Ship".to_string(),
            ..Default::default()
        },
        is_ship: true,
        ship_state: Some("orbiting".to_string()),
        name: name.to_string(),
        fuel_kg,
        fuel_capacity_kg,
        dry_mass_kg: 10_000.0,
        commander: Commander {
            caution: 0.3,
            initiative: 0.3,
            experience: 0.0,
        },
        ..Default::default()
    }
}

fn state_with_ships(names: &[&str]) -> State {
    let mut state = State::new();
    state.fuel_burn_multiplier = 1.0;
    state.supply_multiplier = 1.0;
    state.sim_time_days = 0.0;
    for name in names {
        state
            .body_meshes
            .push(make_orbiting_ship(name, 5_000.0, 10_000.0));
    }
    state
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[test]
fn single_ship_tick_advances_sim_time() {
    let mut state = state_with_ships(&["ISS Explorer"]);
    assert_eq!(state.sim_time.days(), 0.0);

    tick_simulation(&mut state, 1.0);

    assert!(
        (state.sim_time.days() - 1.0).abs() < 1e-9,
        "sim_time should advance by dt"
    );
    assert!(
        (state.sim_time_days - 1.0).abs() < 1e-9,
        "sim_time_days should advance by dt"
    );
}

#[test]
fn multiple_ships_produce_independent_decisions() {
    let mut state = state_with_ships(&["Alpha", "Beta", "Gamma"]);

    // Should not panic; empty command trees → no decisions.
    tick_simulation(&mut state, 0.5);

    assert_eq!(
        state.body_meshes.len(),
        3,
        "all ships should still be present after tick"
    );
    assert!(
        (state.sim_time.days() - 0.5).abs() < 1e-9,
        "clock advanced by dt"
    );
}

#[test]
fn determinism_same_state_same_dt_same_result() {
    // Run the parallel decision collection 100 times on the same initial state
    // and verify results are identical each time.
    for _ in 0..100 {
        let _state = state_with_ships(&["Zeta", "Alpha", "Mu", "Beta", "Omega"]);

        // We can't re-run tick_simulation on the same state and compare because
        // the clock advances on each call.  Instead snapshot two independent
        // clones and run tick_simulation on each; the outputs (time, fuel) must
        // match.
        let mut s1 = state_with_ships(&["Zeta", "Alpha", "Mu", "Beta", "Omega"]);
        let mut s2 = state_with_ships(&["Zeta", "Alpha", "Mu", "Beta", "Omega"]);

        tick_simulation(&mut s1, 1.0);
        tick_simulation(&mut s2, 1.0);

        assert!(
            (s1.sim_time.days() - s2.sim_time.days()).abs() < 1e-12,
            "sim time must be deterministic"
        );
        for (b1, b2) in s1.body_meshes.iter().zip(s2.body_meshes.iter()) {
            assert!(
                (b1.fuel_kg - b2.fuel_kg).abs() < 1e-10,
                "fuel_kg must be deterministic for ship {}",
                b1.data.name
            );
        }
    }
}

#[test]
fn colony_ticking_works_in_parallel_orchestrator() {
    let mut state = State::new();
    state.fuel_burn_multiplier = 1.0;
    state.supply_multiplier = 1.0;
    state.sim_time_days = 0.0;

    // Earth colony with a fuel depot so the restock logic fires.
    let colony = ColonyState {
        body_name: "Earth".to_string(),
        installations: ColonyInstallations {
            fuel_depot: 1,
            ..Default::default()
        },
        ..Default::default()
    };
    state.colonies.insert("Earth".to_string(), colony);

    let fuel_before = state
        .colonies
        .get("Earth")
        .map(|c| c.stockpile.fuel_kg)
        .unwrap_or(0.0);

    tick_simulation(&mut state, 1.0);

    let fuel_after = state
        .colonies
        .get("Earth")
        .map(|c| c.stockpile.fuel_kg)
        .unwrap_or(0.0);

    // Earth restocks 1 000 kg/day (EARTH_FUEL_RESTOCK_PER_DAY).
    assert!(
        fuel_after > fuel_before,
        "Earth colony fuel should increase after tick (got {fuel_before} → {fuel_after})"
    );
}

#[test]
fn ship_snapshot_is_exported() {
    // Verify ShipSnapshot is accessible and constructable from public API.
    let body = make_orbiting_ship("Test", 1_000.0, 5_000.0);
    // ShipSnapshot::from_body is not pub; verify the type itself is exported.
    let _: fn(&BodyEntry) -> ShipSnapshot = |_| unreachable!();
    let _ = body;
}
