// Cargo hold management and mission order execution.
// Ported from src/core/cargo.ts

use crate::state::{MissionStep, ShipEntry, State};

const FLAT_PACKED_WEIGHT_KG: f64 = 500.0;
const RESOURCE_WEIGHT_KG: f64 = 1.0;
const CARGO_TRANSFER_RATE_KG_PER_DAY: f64 = 1000.0;

fn item_weight_kg(item_id: &str) -> f64 {
    if item_id.starts_with("flat-") {
        FLAT_PACKED_WEIGHT_KG
    } else {
        RESOURCE_WEIGHT_KG
    }
}

/// Total cargo mass in kg across all items in the hold.
pub fn get_cargo_weight_kg(ship: &ShipEntry) -> f64 {
    ship.cargo_hold
        .iter()
        .map(|(id, qty)| qty * item_weight_kg(id))
        .sum()
}

/// Cargo capacity in kg from the ship's design. Returns 0 if no design is set.
pub fn get_cargo_capacity_kg(ship: &ShipEntry, state: &State) -> f64 {
    let design_id = match &ship.design_id {
        Some(id) => id,
        None => return 0.0,
    };
    state
        .ship_designs
        .get(design_id)
        .map(|d| d.cargo_capacity_kg)
        .unwrap_or(0.0)
}

/// How many units of `item_id` can still fit given remaining capacity.
fn remaining_capacity_units(ship: &ShipEntry, item_id: &str, state: &State) -> f64 {
    let free_kg = get_cargo_capacity_kg(ship, state) - get_cargo_weight_kg(ship);
    if free_kg <= 0.0 {
        return 0.0;
    }
    (free_kg / item_weight_kg(item_id)).floor()
}

/// Get available stock for an item from the colony at the ship's current orbit.
fn get_colony_stock(state: &State, host_planet_name: &str, item_id: &str) -> f64 {
    let colony = match state.colonies.get(host_planet_name) {
        Some(c) => c,
        None => return 0.0,
    };
    if item_id.starts_with("flat-") {
        *colony.stockpile.flat_packed.get(item_id).unwrap_or(&0) as f64
    } else {
        *colony.stockpile.resources.get(item_id).unwrap_or(&0.0)
    }
}

fn advance_step(ship: &mut ShipEntry) {
    ship.mission_order_index += 1;
}

fn tick_load_cargo(ship: &mut ShipEntry, step: &MissionStep, sim_dt: f64, state: &mut State) {
    if ship.ship_state != "orbiting" {
        return;
    }

    let host = ship.host_planet_name.clone();
    if !state.colonies.contains_key(&host) {
        return;
    }

    let item_id = match &step.item_id {
        Some(id) => id.clone(),
        None => {
            advance_step(ship);
            return;
        }
    };

    let weight_per_unit = item_weight_kg(&item_id);
    let max_units_by_rate = ((CARGO_TRANSFER_RATE_KG_PER_DAY * sim_dt) / weight_per_unit).floor();
    if max_units_by_rate <= 0.0 {
        return;
    }

    let colony_available = get_colony_stock(state, &host, &item_id);
    let capacity_units = remaining_capacity_units(ship, &item_id, state);
    let current_in_hold = *ship.cargo_hold.get(&item_id).unwrap_or(&0.0);

    let wanted_units = match step.quantity {
        Some(q) if q > 0.0 => (q - current_in_hold).max(0.0),
        _ => colony_available,
    };

    let transfer_units = max_units_by_rate
        .min(colony_available)
        .min(capacity_units)
        .min(wanted_units);

    if transfer_units > 0.0 {
        let entry = ship.cargo_hold.entry(item_id.clone()).or_insert(0.0);
        *entry += transfer_units;

        let colony = state.colonies.get_mut(&host).unwrap();
        if item_id.starts_with("flat-") {
            let stock = colony
                .stockpile
                .flat_packed
                .entry(item_id.clone())
                .or_insert(0);
            *stock = stock.saturating_sub(transfer_units as u32);
        } else {
            let stock = colony
                .stockpile
                .resources
                .entry(item_id.clone())
                .or_insert(0.0);
            *stock -= transfer_units;
        }
    }

    let new_in_hold = *ship.cargo_hold.get(&item_id).unwrap_or(&0.0);
    let new_colony_available = colony_available - transfer_units;
    let done = new_colony_available <= 0.0
        || remaining_capacity_units(ship, &item_id, state) <= 0.0
        || matches!(step.quantity, Some(q) if q > 0.0 && new_in_hold >= q);

    if done {
        advance_step(ship);
    }
}

fn tick_unload_cargo(ship: &mut ShipEntry, step: &MissionStep, sim_dt: f64, state: &mut State) {
    if ship.ship_state != "orbiting" {
        return;
    }

    let host = ship.host_planet_name.clone();
    if !state.colonies.contains_key(&host) {
        return;
    }

    let item_id = match &step.item_id {
        Some(id) => id.clone(),
        None => {
            advance_step(ship);
            return;
        }
    };

    let weight_per_unit = item_weight_kg(&item_id);
    let max_units_by_rate = ((CARGO_TRANSFER_RATE_KG_PER_DAY * sim_dt) / weight_per_unit).floor();
    if max_units_by_rate <= 0.0 {
        return;
    }

    let ship_available = *ship.cargo_hold.get(&item_id).unwrap_or(&0.0);
    let wanted_units = match step.quantity {
        Some(q) if q > 0.0 => q.min(ship_available),
        _ => ship_available,
    };

    let transfer_units = max_units_by_rate.min(wanted_units);

    if transfer_units > 0.0 {
        let new_amount = ship_available - transfer_units;
        if new_amount <= 0.0 {
            ship.cargo_hold.remove(&item_id);
        } else {
            *ship.cargo_hold.entry(item_id.clone()).or_insert(0.0) = new_amount;
        }

        let colony = state.colonies.get_mut(&host).unwrap();
        if item_id.starts_with("flat-") {
            let stock = colony
                .stockpile
                .flat_packed
                .entry(item_id.clone())
                .or_insert(0);
            *stock += transfer_units as u32;
        } else {
            let stock = colony
                .stockpile
                .resources
                .entry(item_id.clone())
                .or_insert(0.0);
            *stock += transfer_units;
        }
    }

    let remaining = *ship.cargo_hold.get(&item_id).unwrap_or(&0.0);
    let done = remaining <= 0.0 || wanted_units - transfer_units <= 0.0;
    if done {
        advance_step(ship);
    }
}

/// Returns true if the ship has active mission orders to execute.
pub fn has_mission_orders(ship: &ShipEntry) -> bool {
    !ship.mission_orders.is_empty() && ship.mission_order_index < ship.mission_orders.len()
}

/// Returns the transfer target if the current step is a pending "transfer-to".
/// Returns None if already at the target, no orders, or wrong step type.
pub fn get_mission_transfer_target(ship: &ShipEntry) -> Option<String> {
    if ship.mission_orders.is_empty() {
        return None;
    }
    let step = ship.mission_orders.get(ship.mission_order_index)?;
    if step.step_type != "transfer-to" {
        return None;
    }
    let target = step.target.as_deref()?;
    if target == ship.host_planet_name {
        return None;
    }
    Some(target.to_string())
}

/// Advance past a "transfer-to" step (called after arrival).
pub fn advance_mission_transfer_step(ship: &mut ShipEntry) {
    if ship.mission_orders.is_empty() {
        return;
    }
    if ship.mission_order_index >= ship.mission_orders.len() {
        return;
    }
    if ship.mission_orders[ship.mission_order_index].step_type == "transfer-to" {
        advance_step(ship);
    }
}

/// Tick the current mission step. Handles load/unload/repeat/transfer-to steps.
pub fn tick_mission_orders(ship: &mut ShipEntry, sim_dt: f64, state: &mut State) {
    if !has_mission_orders(ship) {
        return;
    }

    let step = ship.mission_orders[ship.mission_order_index].clone();
    match step.step_type.as_str() {
        "load-cargo" => tick_load_cargo(ship, &step, sim_dt, state),
        "unload-cargo" => tick_unload_cargo(ship, &step, sim_dt, state),
        "transfer-to" => {
            if step.target.as_deref() == Some(ship.host_planet_name.as_str()) {
                advance_step(ship);
            }
        }
        "repeat" => {
            ship.mission_order_index = 0;
        }
        _ => {}
    }
}
