// Ship intent broadcast — mirrors src/core/intents.ts

use std::collections::HashSet;

use crate::state::{ShipIntent, State};

/// Publish (or overwrite) an intent for a ship.
pub fn publish_intent(ship_name: &str, intent: ShipIntent, state: &mut State) {
    state.ship_intents.insert(ship_name.to_string(), intent);
}

/// Remove the intent for a ship.
pub fn clear_intent(ship_name: &str, state: &mut State) {
    state.ship_intents.remove(ship_name);
}

/// Get the current intent for a ship, if any.
pub fn get_intent_for_ship<'a>(ship_name: &str, state: &'a State) -> Option<&'a ShipIntent> {
    state.ship_intents.get(ship_name)
}

/// Returns true if a target is claimed by any ship other than `exclude_ship`.
pub fn is_target_claimed(target: &str, exclude_ship: &str, state: &State) -> bool {
    for (ship_name, intent) in &state.ship_intents {
        if ship_name == exclude_ship {
            continue;
        }
        let claimed = match intent {
            ShipIntent::Surveying { target: t, .. } => t == target,
            ShipIntent::Transferring { destination: d, .. } => d == target,
            ShipIntent::SurveyPlan { targets, .. } => targets.iter().any(|t| t == target),
            _ => false,
        };
        if claimed {
            return true;
        }
    }
    false
}

/// Returns the set of targets claimed by all ships except `exclude_ship`.
pub fn get_claimed_targets(exclude_ship: &str, state: &State) -> HashSet<String> {
    let mut claimed = HashSet::new();
    for (ship_name, intent) in &state.ship_intents {
        if ship_name == exclude_ship {
            continue;
        }
        match intent {
            ShipIntent::Surveying { target, .. } => {
                claimed.insert(target.clone());
            }
            ShipIntent::Transferring { destination, .. } => {
                claimed.insert(destination.clone());
            }
            ShipIntent::SurveyPlan { targets, .. } => {
                for t in targets {
                    claimed.insert(t.clone());
                }
            }
            _ => {}
        }
    }
    claimed
}

/// Stub — in the full sim this invalidates a cached refuel-target.
/// Not needed for current tests but referenced from commands tests.
pub fn invalidate_intents_cache(_state: &mut State) {}

/// Returns true if any tanker ship has a Tanking intent targeting the given ship.
pub fn is_tanker_inbound_for(ship_name: &str, state: &State) -> bool {
    state
        .ship_intents
        .values()
        .any(|intent| matches!(intent, ShipIntent::Tanking { target, .. } if target == ship_name))
}
