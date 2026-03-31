// Ported from src/__tests__/cargo.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_sim::cargo::{
    advance_mission_transfer_step, get_cargo_capacity_kg, get_cargo_weight_kg,
    get_mission_transfer_target, has_mission_orders, tick_mission_orders,
};
use drift_sim::state::State;
use drift_sim::state::{CargoHold, MissionStep, ShipEntry};
use drift_types::{ColonyInstallations, ColonyState, ColonyStockpile, ShipDesign};
use std::collections::HashMap;

fn mock_ship(overrides: ShipOverrides) -> ShipEntry {
    ShipEntry {
        name: overrides.name.unwrap_or_else(|| "Cargo Ship".to_string()),
        fuel_kg: overrides.fuel_kg.unwrap_or(50_000.0),
        fuel_capacity_kg: overrides.fuel_capacity_kg.unwrap_or(50_000.0),
        cargo_hold: overrides.cargo_hold.unwrap_or_default(),
        mission_orders: overrides.mission_orders.unwrap_or_default(),
        mission_order_index: overrides.mission_order_index.unwrap_or(0),
        ship_state: overrides
            .ship_state
            .unwrap_or_else(|| "orbiting".to_string()),
        host_planet_name: overrides
            .host_planet_name
            .unwrap_or_else(|| "Earth".to_string()),
        design_id: overrides.design_id,
        ..ShipEntry::default()
    }
}

#[derive(Default)]
struct ShipOverrides {
    name: Option<String>,
    fuel_kg: Option<f64>,
    fuel_capacity_kg: Option<f64>,
    cargo_hold: Option<CargoHold>,
    mission_orders: Option<Vec<MissionStep>>,
    mission_order_index: Option<usize>,
    ship_state: Option<String>,
    host_planet_name: Option<String>,
    design_id: Option<String>,
}

fn mock_colony(
    body_name: &str,
    resources: HashMap<String, f64>,
    flat_packed: HashMap<String, u32>,
) -> ColonyState {
    ColonyState {
        body_name: body_name.to_string(),
        name: body_name.to_string(),
        population: 1000,
        stockpile: ColonyStockpile {
            fuel_kg: 100_000.0,
            supplies: 1000.0,
            resources,
            flat_packed,
        },
        installations: ColonyInstallations::default(),
        ..ColonyState::default()
    }
}

fn step(step_type: &str) -> MissionStep {
    MissionStep {
        id: format!("step-{}", rand_id()),
        step_type: step_type.to_string(),
        item_id: None,
        quantity: None,
        target: None,
    }
}

fn step_with_item(step_type: &str, item_id: &str) -> MissionStep {
    MissionStep {
        id: format!("step-{}", rand_id()),
        step_type: step_type.to_string(),
        item_id: Some(item_id.to_string()),
        quantity: None,
        target: None,
    }
}

fn step_with_item_qty(step_type: &str, item_id: &str, quantity: f64) -> MissionStep {
    MissionStep {
        id: format!("step-{}", rand_id()),
        step_type: step_type.to_string(),
        item_id: Some(item_id.to_string()),
        quantity: Some(quantity),
        target: None,
    }
}

fn step_with_target(step_type: &str, target: &str) -> MissionStep {
    MissionStep {
        id: format!("step-{}", rand_id()),
        step_type: step_type.to_string(),
        item_id: None,
        quantity: None,
        target: Some(target.to_string()),
    }
}

static STEP_COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
fn rand_id() -> u64 {
    STEP_COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
}

// ─── cargo weight ─────────────────────────────────────────────────────────────

mod cargo_weight {
    use super::*;

    #[test]
    fn computes_zero_weight_for_empty_hold() {
        let ship = mock_ship(ShipOverrides::default());
        assert_eq!(get_cargo_weight_kg(&ship), 0.0);
    }

    #[test]
    fn computes_correct_weight_for_resources_1_kg_per_unit() {
        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 500.0);
        hold.insert("copper".to_string(), 200.0);
        let ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            ..Default::default()
        });
        assert_eq!(get_cargo_weight_kg(&ship), 700.0);
    }

    #[test]
    fn computes_correct_weight_for_flat_packed_items_500_kg_each() {
        let mut hold = CargoHold::default();
        hold.insert("flat-mine".to_string(), 2.0);
        hold.insert("flat-factory".to_string(), 3.0);
        let ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            ..Default::default()
        });
        assert_eq!(get_cargo_weight_kg(&ship), 2500.0);
    }

    #[test]
    fn computes_mixed_weight_correctly() {
        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 1000.0);
        hold.insert("flat-mine".to_string(), 1.0);
        let ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            ..Default::default()
        });
        assert_eq!(get_cargo_weight_kg(&ship), 1500.0);
    }
}

// ─── cargo capacity ───────────────────────────────────────────────────────────

mod cargo_capacity {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_designs.clear();
        state
    }

    #[test]
    fn returns_0_when_no_design() {
        let state = setup();
        let ship = mock_ship(ShipOverrides {
            design_id: None,
            ..Default::default()
        });
        assert_eq!(get_cargo_capacity_kg(&ship, &state), 0.0);
    }

    #[test]
    fn returns_design_cargo_capacity() {
        let mut state = setup();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 5000.0,
                ..ShipDesign::default()
            },
        );
        let ship = mock_ship(ShipOverrides {
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });
        assert_eq!(get_cargo_capacity_kg(&ship, &state), 5000.0);
    }
}

// ─── load-cargo step ──────────────────────────────────────────────────────────

mod load_cargo_step {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.colonies.clear();
        state.ship_designs.clear();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 10_000.0,
                ..ShipDesign::default()
            },
        );
        state
    }

    #[test]
    fn transfers_resources_from_colony_to_ship() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 1000.0);
        assert_eq!(
            *state
                .colonies
                .get("Earth")
                .unwrap()
                .stockpile
                .resources
                .get("iron")
                .unwrap(),
            4000.0
        );
    }

    #[test]
    fn transfers_flat_packed_items_from_colony_to_ship() {
        let mut state = setup();
        let mut flat_packed = HashMap::new();
        flat_packed.insert("flat-mine".to_string(), 10u32);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), flat_packed),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "flat-mine")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("flat-mine").unwrap(), 2.0);
        assert_eq!(
            *state
                .colonies
                .get("Earth")
                .unwrap()
                .stockpile
                .flat_packed
                .get("flat-mine")
                .unwrap(),
            8u32
        );
    }

    #[test]
    fn does_not_exceed_cargo_capacity() {
        let mut state = setup();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 500.0,
                ..ShipDesign::default()
            },
        );
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 500.0);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn advances_step_when_colony_runs_out() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 100.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron"), step("repeat")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 100.0);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn loads_specific_quantity_then_advances() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item_qty("load-cargo", "iron", 200.0)]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 200.0);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn does_nothing_when_not_orbiting() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            ship_state: Some("transferring".to_string()),
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert!(ship.cargo_hold.get("iron").is_none());
        assert_eq!(ship.mission_order_index, 0);
    }
}

// ─── unload-cargo step ────────────────────────────────────────────────────────

mod unload_cargo_step {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.colonies.clear();
        state.ship_designs.clear();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 10_000.0,
                ..ShipDesign::default()
            },
        );
        state
    }

    #[test]
    fn transfers_resources_from_ship_to_colony() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 0.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 3000.0);
        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step_with_item("unload-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 2000.0);
        assert_eq!(
            *state
                .colonies
                .get("Earth")
                .unwrap()
                .stockpile
                .resources
                .get("iron")
                .unwrap(),
            1000.0
        );
    }

    #[test]
    fn removes_item_from_hold_when_fully_unloaded() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 500.0);
        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step_with_item("unload-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert!(ship.cargo_hold.get("iron").is_none());
        assert_eq!(
            *state
                .colonies
                .get("Earth")
                .unwrap()
                .stockpile
                .resources
                .get("iron")
                .unwrap(),
            500.0
        );
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn advances_step_when_ship_has_no_cargo_of_type() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(CargoHold::default()),
            mission_orders: Some(vec![step_with_item("unload-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(ship.mission_order_index, 1);
    }
}

// ─── mission order flow ───────────────────────────────────────────────────────

mod mission_order_flow {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.colonies.clear();
        state.ship_designs.clear();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 10_000.0,
                ..ShipDesign::default()
            },
        );
        state
    }

    #[test]
    fn advances_through_steps_sequentially() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 100.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![
                step_with_item("load-cargo", "iron"),
                step_with_target("transfer-to", "Mars"),
            ]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(ship.mission_order_index, 1);

        let target = get_mission_transfer_target(&ship);
        assert_eq!(target, Some("Mars".to_string()));
    }

    #[test]
    fn repeat_step_resets_to_index_0() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![
                step_with_target("transfer-to", "Earth"),
                step("repeat"),
            ]),
            mission_order_index: Some(1),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(ship.mission_order_index, 0);
    }

    #[test]
    fn stops_at_end_when_no_repeat() {
        let mut state = setup();
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Earth")]),
            mission_order_index: Some(0),
            host_planet_name: Some("Earth".to_string()),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(ship.mission_order_index, 1);
        assert!(!has_mission_orders(&ship));
    }

    #[test]
    fn transfer_to_advances_when_already_at_target() {
        let mut state = setup();
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![
                step_with_target("transfer-to", "Earth"),
                step("repeat"),
            ]),
            mission_order_index: Some(0),
            host_planet_name: Some("Earth".to_string()),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn get_mission_transfer_target_returns_null_when_at_target() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Earth")]),
            mission_order_index: Some(0),
            host_planet_name: Some("Earth".to_string()),
            ..Default::default()
        });

        assert_eq!(get_mission_transfer_target(&ship), None);
    }

    #[test]
    fn get_mission_transfer_target_returns_target_name_when_not_there() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Mars")]),
            mission_order_index: Some(0),
            host_planet_name: Some("Earth".to_string()),
            ..Default::default()
        });

        assert_eq!(get_mission_transfer_target(&ship), Some("Mars".to_string()));
    }

    #[test]
    fn advance_mission_transfer_step_advances_transfer_to_step() {
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![
                step_with_target("transfer-to", "Mars"),
                step("repeat"),
            ]),
            mission_order_index: Some(0),
            ..Default::default()
        });

        advance_mission_transfer_step(&mut ship);

        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn advance_mission_transfer_step_does_nothing_on_non_transfer_step() {
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            ..Default::default()
        });

        advance_mission_transfer_step(&mut ship);

        assert_eq!(ship.mission_order_index, 0);
    }

    #[test]
    fn has_mission_orders_returns_false_when_empty() {
        let ship = mock_ship(ShipOverrides::default());
        assert!(!has_mission_orders(&ship));
    }

    #[test]
    fn has_mission_orders_returns_false_when_past_end() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Mars")]),
            mission_order_index: Some(1),
            ..Default::default()
        });
        assert!(!has_mission_orders(&ship));
    }

    #[test]
    fn has_mission_orders_returns_true_when_active() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Mars")]),
            mission_order_index: Some(0),
            ..Default::default()
        });
        assert!(has_mission_orders(&ship));
    }
}

// ─── edge cases ───────────────────────────────────────────────────────────────

mod edge_cases {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.colonies.clear();
        state.ship_designs.clear();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 10_000.0,
                ..ShipDesign::default()
            },
        );
        state
    }

    #[test]
    fn load_step_with_zero_quantity_loads_everything_available() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 300.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item_qty("load-cargo", "iron", 0.0)]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 300.0);
    }

    #[test]
    fn load_step_does_nothing_when_colony_has_no_stock() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert!(ship.cargo_hold.get("iron").is_none());
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn load_step_with_no_item_id_advances_immediately() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step("load-cargo"), step("repeat")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn unload_step_with_no_item_id_advances_immediately() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 100.0);
        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step("unload-cargo"), step("repeat")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn unload_step_does_nothing_when_not_orbiting() {
        let mut state = setup();
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", HashMap::new(), HashMap::new()),
        );

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 500.0);
        let mut ship = mock_ship(ShipOverrides {
            ship_state: Some("transferring".to_string()),
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step_with_item("unload-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 500.0);
        assert_eq!(ship.mission_order_index, 0);
    }

    #[test]
    fn unload_step_does_nothing_when_no_colony_at_location() {
        let mut state = setup();
        // No colony set for Earth

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 500.0);
        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step_with_item("unload-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 500.0);
        assert_eq!(ship.mission_order_index, 0);
    }

    #[test]
    fn advance_mission_transfer_step_does_nothing_when_no_orders() {
        let mut ship = mock_ship(ShipOverrides::default());
        advance_mission_transfer_step(&mut ship);
        assert_eq!(ship.mission_order_index, 0);
    }

    #[test]
    fn advance_mission_transfer_step_does_nothing_when_past_end() {
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Mars")]),
            mission_order_index: Some(1),
            ..Default::default()
        });
        advance_mission_transfer_step(&mut ship);
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn get_mission_transfer_target_returns_null_when_no_orders() {
        let ship = mock_ship(ShipOverrides::default());
        assert_eq!(get_mission_transfer_target(&ship), None);
    }

    #[test]
    fn get_mission_transfer_target_returns_null_when_step_is_not_transfer_to() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            ..Default::default()
        });
        assert_eq!(get_mission_transfer_target(&ship), None);
    }

    #[test]
    fn get_mission_transfer_target_returns_null_when_transfer_to_has_no_target() {
        let ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step("transfer-to")]),
            mission_order_index: Some(0),
            ..Default::default()
        });
        assert_eq!(get_mission_transfer_target(&ship), None);
    }

    #[test]
    fn tick_mission_orders_is_a_no_op_when_past_end_of_orders() {
        let mut state = setup();
        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_target("transfer-to", "Mars")]),
            mission_order_index: Some(5),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });
        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(ship.mission_order_index, 5);
    }

    #[test]
    fn unload_specific_quantity_then_advance() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 0.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut hold = CargoHold::default();
        hold.insert("iron".to_string(), 5000.0);
        let mut ship = mock_ship(ShipOverrides {
            cargo_hold: Some(hold),
            mission_orders: Some(vec![step_with_item_qty("unload-cargo", "iron", 200.0)]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        tick_mission_orders(&mut ship, 1.0, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 4800.0);
        assert_eq!(
            *state
                .colonies
                .get("Earth")
                .unwrap()
                .stockpile
                .resources
                .get("iron")
                .unwrap(),
            200.0
        );
        assert_eq!(ship.mission_order_index, 1);
    }

    #[test]
    fn small_sim_dt_transfers_fewer_units_per_rate() {
        let mut state = setup();
        let mut resources = HashMap::new();
        resources.insert("iron".to_string(), 5000.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            mission_orders: Some(vec![step_with_item("load-cargo", "iron")]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        // 0.5 sim-day at 1000 kg/day = 500 units
        tick_mission_orders(&mut ship, 0.5, &mut state);

        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 500.0);
    }
}

// ─── full cargo cycle ─────────────────────────────────────────────────────────

mod full_cargo_cycle {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.colonies.clear();
        state.ship_designs.clear();
        state.ship_designs.insert(
            "test-design".to_string(),
            ShipDesign {
                id: "test-design".to_string(),
                cargo_capacity_kg: 10_000.0,
                ..ShipDesign::default()
            },
        );
        state
    }

    #[test]
    fn load_at_earth_transfer_unload_at_mars_repeat() {
        let mut state = setup();
        let mut earth_resources = HashMap::new();
        earth_resources.insert("iron".to_string(), 500.0);
        state.colonies.insert(
            "Earth".to_string(),
            mock_colony("Earth", earth_resources, HashMap::new()),
        );

        let mut mars_resources = HashMap::new();
        mars_resources.insert("iron".to_string(), 0.0);
        state.colonies.insert(
            "Mars".to_string(),
            mock_colony("Mars", mars_resources, HashMap::new()),
        );

        let mut ship = mock_ship(ShipOverrides {
            host_planet_name: Some("Earth".to_string()),
            mission_orders: Some(vec![
                step_with_item("load-cargo", "iron"),
                step_with_target("transfer-to", "Mars"),
                step_with_item("unload-cargo", "iron"),
                step_with_target("transfer-to", "Earth"),
                step("repeat"),
            ]),
            mission_order_index: Some(0),
            design_id: Some("test-design".to_string()),
            ..Default::default()
        });

        // Step 0: Load iron at Earth (500 units, all available)
        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(*ship.cargo_hold.get("iron").unwrap(), 500.0);
        assert_eq!(ship.mission_order_index, 1);

        // Step 1: Transfer to Mars — getMissionTransferTarget returns "Mars"
        assert_eq!(get_mission_transfer_target(&ship), Some("Mars".to_string()));

        // Simulate arrival at Mars
        ship.host_planet_name = "Mars".to_string();
        advance_mission_transfer_step(&mut ship);
        assert_eq!(ship.mission_order_index, 2);

        // Step 2: Unload iron at Mars
        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert!(ship.cargo_hold.get("iron").is_none());
        assert_eq!(
            *state
                .colonies
                .get("Mars")
                .unwrap()
                .stockpile
                .resources
                .get("iron")
                .unwrap(),
            500.0
        );
        assert_eq!(ship.mission_order_index, 3);

        // Step 3: Transfer to Earth
        assert_eq!(
            get_mission_transfer_target(&ship),
            Some("Earth".to_string())
        );
        ship.host_planet_name = "Earth".to_string();
        advance_mission_transfer_step(&mut ship);
        assert_eq!(ship.mission_order_index, 4);

        // Step 4: Repeat
        tick_mission_orders(&mut ship, 1.0, &mut state);
        assert_eq!(ship.mission_order_index, 0);
    }
}
