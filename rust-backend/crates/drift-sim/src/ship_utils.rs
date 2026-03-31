// Ship physics/sensor resolution — ported from src/core/ship-utils.ts

use drift_math::ship_physics::{ShipPhysicsState, ENGINE_TYPES};

use crate::state::ShipEntry;
use crate::SimState;

/// Resolve a ship's physics parameters from its design (preferred) or legacy engine fallback.
pub fn resolve_ship_physics(ship: &ShipEntry, state: &SimState) -> ShipPhysicsState {
    if let Some(ref design_id) = ship.design_id {
        if let Some(design) = state.ship_designs.get(design_id) {
            let fuel_mod = state
                .engine_designs
                .get(&design.engine_design_id)
                .map(|e| e.fuel_mod)
                .unwrap_or(1.0);
            return ShipPhysicsState {
                fuel_kg: ship.fuel_kg,
                dry_mass_kg: ship.dry_mass_kg,
                accel_g: design.accel_g,
                isp_s: design.isp_s,
                fuel_mod,
            };
        }
    }

    // Legacy fallback: resolve from engine_id
    let engine = ship
        .engine_id
        .as_deref()
        .and_then(|id| ENGINE_TYPES.iter().find(|e| e.id == id))
        .unwrap_or(&ENGINE_TYPES[0]);

    ShipPhysicsState {
        fuel_kg: ship.fuel_kg,
        dry_mass_kg: ship.dry_mass_kg,
        accel_g: engine.accel_g,
        isp_s: engine.isp_s,
        fuel_mod: 1.0,
    }
}

fn sensor_bonus_to_level(bonus: f64) -> u32 {
    if bonus >= 2.0 {
        3
    } else if bonus >= 1.5 {
        2
    } else {
        1
    }
}

/// Resolve a ship's sensor capability level (1, 2, or 3) from its design or legacy fallback.
pub fn resolve_ship_sensor_level(ship: &ShipEntry, state: &SimState) -> u32 {
    if let Some(ref design_id) = ship.design_id {
        if let Some(design) = state.ship_designs.get(design_id) {
            return sensor_bonus_to_level(design.sensor_multiplier);
        }
    }
    1 // Legacy ships / no sensors default to level 1
}
