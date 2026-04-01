// Commander AI judgment — the human judgment layer on top of mechanical standing orders.
// The command tree (commands.rs) is the "dumb computer" — it evaluates rules top-to-bottom.
// The commander interprets those rules, applying experience and judgment to override them
// when the situation calls for it.

use drift_math::ship_physics::compute_total_fuel_cost;
use drift_math::transfer::distance_km_between;

use crate::colonies::{get_nearest_colony_for_ship, has_colony};
use crate::commands::{
    check_condition, evaluate_command_tree, hull_ceiling, CommandCondition, CommandEntry,
    CommandResult, CommandTree, ShipCrew, ShipMaintenance,
};
use crate::entities::find_body;
use crate::intents::is_tanker_inbound_for;
use crate::ship_utils::{resolve_ship_physics, resolve_ship_sensor_level};
use crate::state::{BodyEntry, ShipEntry, State};
use crate::survey_planner::compute_survey_plan;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREEMPTIVE_BUFFER: f64 = 0.3;
const MALFUNCTION_LEARNING_RATE: f64 = 0.08;
const EMERGENCY_RETURN_LEARNING_RATE: f64 = 0.05;
const JUDGMENT_CAP: f64 = 0.9;
const JUDGMENT_DRIFT_RATE: f64 = 0.002;

// Critical thresholds below which no commander would defer maintenance.
const CRITICAL_HULL: f64 = 10.0;
const CRITICAL_FUEL_PCT: f64 = 5.0;
const CRITICAL_SUPPLIES: f64 = 5.0;

// ---------------------------------------------------------------------------
// Public pure helpers
// ---------------------------------------------------------------------------

/// Safety margin for fuel planning: low-caution commanders cut it close,
/// high-caution want more buffer.
pub fn compute_safety_margin(caution: f64) -> f64 {
    2.0 - caution * 0.7
}

/// Returns true if the ship is orbiting a body that has a colony.
pub fn is_at_colony(ship: &BodyEntry, state: &State) -> bool {
    ship.ship_state.as_deref() == Some("orbiting")
        && has_colony(ship.host_planet_name.as_deref().unwrap_or(""), state)
}

// ---------------------------------------------------------------------------
// Internal condition helpers
// ---------------------------------------------------------------------------

/// Evaluate a condition against effective (raised) threshold without relying on
/// the entry's stored threshold. Used by preemptive-service override.
fn check_condition_with_threshold(
    cond_type: &CommandCondition,
    threshold: f64,
    ship: &BodyEntry,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
) -> bool {
    match cond_type {
        CommandCondition::Always => false,
        CommandCondition::FuelBelow { .. } => {
            if ship.fuel_capacity_kg <= 0.0 {
                return false;
            }
            (ship.fuel_kg / ship.fuel_capacity_kg) * 100.0 < threshold
        }
        CommandCondition::MoraleBelow { .. } => crew.map(|c| c.morale < threshold).unwrap_or(false),
        CommandCondition::HullBelow { .. } => maintenance
            .map(|m| m.hull_integrity < threshold)
            .unwrap_or(false),
        CommandCondition::SuppliesBelow { .. } => maintenance
            .map(|m| {
                if m.max_supplies <= 0.0 {
                    return false;
                }
                (m.supplies / m.max_supplies) * 100.0 < threshold
            })
            .unwrap_or(false),
    }
}

fn threshold_from_condition(cond: &CommandCondition) -> Option<f64> {
    match cond {
        CommandCondition::FuelBelow { threshold } => Some(*threshold),
        CommandCondition::MoraleBelow { threshold } => Some(*threshold),
        CommandCondition::HullBelow { threshold } => Some(*threshold),
        CommandCondition::SuppliesBelow { threshold } => Some(*threshold),
        CommandCondition::Always => None,
    }
}

/// Map a CommandType + optional target to a CommandResult (mirrors TS commandToResult).
fn command_entry_to_result(entry: &CommandEntry) -> CommandResult {
    use crate::commands::CommandType;
    match entry.command {
        CommandType::SurveyNearest => CommandResult::Survey,
        CommandType::TransferTo => CommandResult::Transfer {
            target: entry.target.clone(),
        },
        CommandType::Refuel => CommandResult::Refuel,
        CommandType::RefuelShip => CommandResult::RefuelShip,
        CommandType::ShoreLeave => CommandResult::ShoreLeave,
        CommandType::Overhaul => CommandResult::Overhaul,
        CommandType::MajorRefit => CommandResult::MajorRefit,
        CommandType::ReturnToBase => CommandResult::Refuel,
        CommandType::LoadCargo => CommandResult::LoadCargo,
        CommandType::UnloadCargo => CommandResult::UnloadCargo,
        CommandType::Idle => CommandResult::Idle,
    }
}

// ---------------------------------------------------------------------------
// Per-condition current value and critical floor
// ---------------------------------------------------------------------------

struct ConditionMetrics {
    current: f64,
    critical: f64,
}

fn get_condition_metrics(
    cond: &CommandCondition,
    ship: &BodyEntry,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
) -> Option<ConditionMetrics> {
    match cond {
        CommandCondition::FuelBelow { .. } => Some(ConditionMetrics {
            current: if ship.fuel_capacity_kg > 0.0 {
                (ship.fuel_kg / ship.fuel_capacity_kg) * 100.0
            } else {
                100.0
            },
            critical: CRITICAL_FUEL_PCT,
        }),
        CommandCondition::HullBelow { .. } => maintenance.map(|m| ConditionMetrics {
            current: m.hull_integrity,
            critical: CRITICAL_HULL,
        }),
        CommandCondition::SuppliesBelow { .. } => maintenance.map(|m| ConditionMetrics {
            current: if m.max_supplies > 0.0 {
                (m.supplies / m.max_supplies) * 100.0
            } else {
                100.0
            },
            critical: CRITICAL_SUPPLIES,
        }),
        // Morale is never critical enough to abort a survey
        CommandCondition::MoraleBelow { .. } => crew.map(|c| ConditionMetrics {
            current: c.morale,
            critical: 5.0,
        }),
        CommandCondition::Always => None,
    }
}

fn is_maintenance_action(result: &CommandResult) -> bool {
    matches!(
        result,
        CommandResult::Refuel
            | CommandResult::Overhaul
            | CommandResult::MajorRefit
            | CommandResult::ShoreLeave
    )
}

// ---------------------------------------------------------------------------
// Unsurveyed work check
// ---------------------------------------------------------------------------

fn has_unsurveyed_work_at_host(host_name: &str, max_survey_level: u32, state: &State) -> bool {
    let (body_opt, found) = find_body(host_name, state);
    if !found {
        return false;
    }
    let Some(body) = body_opt else {
        return false;
    };
    if !body.is_ship && body.survey.survey_level < max_survey_level {
        return true;
    }
    // Check moons by name from the body's moon list
    for moon_name in &body.moons {
        let (moon_opt, moon_found) = find_body(moon_name, state);
        if !moon_found {
            continue;
        }
        if let Some(moon) = moon_opt {
            if !moon.is_ship && moon.survey.survey_level < max_survey_level {
                return true;
            }
        }
    }
    false
}

// ---------------------------------------------------------------------------
// Return fuel estimate
// ---------------------------------------------------------------------------

fn estimate_return_fuel_kg(ship: &BodyEntry, state: &State) -> Option<f64> {
    let host_name = ship.host_planet_name.as_deref().unwrap_or("");
    let colony_name = get_nearest_colony_for_ship(state, host_name)?;

    // Build a minimal ShipEntry for resolve_ship_physics
    let ship_entry = body_entry_to_ship_entry(ship);
    let physics = resolve_ship_physics(&ship_entry, state);

    let (host_opt, host_found) = find_body(host_name, state);
    if !host_found {
        return None;
    }
    let host = host_opt?;

    let (colony_opt, colony_found) = find_body(colony_name, state);
    if !colony_found {
        return None;
    }
    let colony = colony_opt?;

    let host_pos = drift_math::transfer::Vec3 {
        x: host.position[0] as f64,
        y: host.position[1] as f64,
        z: host.position[2] as f64,
    };
    let colony_pos = drift_math::transfer::Vec3 {
        x: colony.position[0] as f64,
        y: colony.position[1] as f64,
        z: colony.position[2] as f64,
    };

    let host_au = host.data.distance;
    let colony_au = colony.data.distance;

    let dist_km = distance_km_between(host_au, &host_pos, colony_au, &colony_pos);
    if dist_km < 1.0 {
        return Some(0.0);
    }

    let cost = compute_total_fuel_cost(
        dist_km,
        physics.accel_g,
        physics.isp_s,
        physics.dry_mass_kg,
        ship.fuel_capacity_kg,
        state.fuel_burn_multiplier,
        physics.fuel_mod,
    );
    Some(cost.total_fuel_kg)
}

/// Minimal conversion from BodyEntry ship fields to ShipEntry for physics resolution.
fn body_entry_to_ship_entry(body: &BodyEntry) -> ShipEntry {
    ShipEntry {
        name: body.data.name.clone(),
        position: body.position,
        is_ship: body.is_ship,
        ship_state: body.ship_state.clone().unwrap_or_default(),
        host_planet_name: body.host_planet_name.clone().unwrap_or_default(),
        fuel_kg: body.fuel_kg,
        fuel_capacity_kg: body.fuel_capacity_kg,
        dry_mass_kg: body.dry_mass_kg,
        engine_id: body.engine_id.clone(),
        design_id: body.design_id.clone(),
        commander: body.commander.clone(),
        survey_plan: body.survey_plan.clone(),
        cargo_hold: body.cargo_hold.clone(),
        mission_orders: body.mission_orders.clone(),
        mission_order_index: body.mission_order_index,
    }
}

// ---------------------------------------------------------------------------
// Pure scoring helpers (exported for tests)
// ---------------------------------------------------------------------------

/// Pure decision: should this ship defer refueling based on fuel margin?
pub fn should_defer_refueling(current_fuel: f64, return_cost_estimate: f64, caution: f64) -> bool {
    let margin = compute_safety_margin(caution);
    current_fuel > return_cost_estimate * margin
}

/// Pure scoring: compute how confident we are about deferring refueling.
pub fn compute_refuel_deferral_score(
    fuel_available: f64,
    return_cost_estimate: f64,
    safety_margin: f64,
) -> f64 {
    if return_cost_estimate == 0.0 {
        return 0.6;
    }
    let fuel_margin = fuel_available / (return_cost_estimate * safety_margin);
    0.5 + 0.35 * (fuel_margin - 1.0).min(1.0)
}

// ---------------------------------------------------------------------------
// Judgment overrides — each returns Option<CommandResult> and a score
// ---------------------------------------------------------------------------

/// "Service before departing colony" — raise maintenance thresholds when about
/// to leave, so the ship tops off proactively instead of discovering the
/// problem mid-mission.
pub fn check_preemptive_service(
    ship: &BodyEntry,
    pending_result: &CommandResult,
    tree: &CommandTree,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
    state: &State,
) -> Option<CommandResult> {
    // Only intercept departure actions
    if !matches!(
        pending_result,
        CommandResult::Survey | CommandResult::Transfer { .. }
    ) {
        return None;
    }
    // Only applies when at a colony (where servicing is possible)
    let host_name = ship.host_planet_name.as_deref().unwrap_or("");
    if ship.ship_state.as_deref() != Some("orbiting") || !has_colony(host_name, state) {
        return None;
    }

    let j = ship.commander.caution;

    for entry in &tree.entries {
        if !entry.enabled {
            continue;
        }
        let cond = &entry.condition;
        if matches!(cond, CommandCondition::Always) {
            continue;
        }

        let base_threshold = match threshold_from_condition(cond) {
            Some(t) => t,
            None => continue,
        };

        // Raise threshold based on commander caution
        let mut effective = base_threshold + (100.0 - base_threshold) * j * PREEMPTIVE_BUFFER;

        // Cap hull threshold at hull ceiling — can't demand more than the ship can achieve
        if let CommandCondition::HullBelow { .. } = cond {
            if let Some(m) = maintenance {
                let ceiling = hull_ceiling(m.total_age, m.last_refit_age);
                effective = effective.min(ceiling);
            }
        }

        if check_condition_with_threshold(cond, effective, ship, crew, maintenance) {
            return Some(command_entry_to_result(entry));
        }
    }
    None
}

/// "Hold for inbound tanker" — if a tanker has been dispatched to refuel this
/// ship, hold orbit instead of departing.
pub fn check_hold_for_tanker(
    ship: &BodyEntry,
    result: &CommandResult,
    state: &State,
) -> Option<CommandResult> {
    // Only intercept departure actions
    if !matches!(
        result,
        CommandResult::Survey | CommandResult::Transfer { .. }
    ) {
        return None;
    }
    if is_tanker_inbound_for(&ship.data.name, state) {
        return Some(CommandResult::Idle);
    }
    None
}

/// "Finish the job before heading home" — defer maintenance when already at an
/// unsurveyed body (or one with unsurveyed moons), if the commander judges it
/// safe enough to finish first.
fn check_defer_maintenance(
    ship: &BodyEntry,
    pending_result: &CommandResult,
    tree: &CommandTree,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
    state: &State,
) -> Option<CommandResult> {
    if !is_maintenance_action(pending_result) {
        return None;
    }
    if ship.ship_state.as_deref() != Some("orbiting") {
        return None;
    }
    let host_name = ship.host_planet_name.as_deref().unwrap_or("");
    if has_colony(host_name, state) {
        return None;
    }

    let ship_entry = body_entry_to_ship_entry(ship);
    let max_level = resolve_ship_sensor_level(&ship_entry, state);
    if !has_unsurveyed_work_at_host(host_name, max_level, state) {
        return None;
    }

    let j = ship.commander.initiative;
    if j < 0.2 {
        return None;
    }

    for entry in &tree.entries {
        if !entry.enabled {
            continue;
        }
        let cond = &entry.condition;
        if matches!(cond, CommandCondition::Always) {
            continue;
        }

        // Build a temporary ShipEntry to call check_condition
        if !check_condition(cond, &ship_entry, crew, maintenance) {
            continue;
        }

        // This condition fired — would the commander defer it?
        let metrics = match get_condition_metrics(cond, ship, crew, maintenance) {
            Some(m) => m,
            None => continue,
        };

        let base_threshold = match threshold_from_condition(cond) {
            Some(t) => t,
            None => continue,
        };

        // Commander's personal floor: interpolate from threshold down toward critical
        let personal_floor = metrics.critical + (base_threshold - metrics.critical) * (1.0 - j);
        if metrics.current < personal_floor {
            // Too risky even for this commander — don't defer
            return None;
        }
    }

    // All firing conditions are above the commander's personal floor — defer and survey
    Some(CommandResult::Survey)
}

/// "Keep surveying while fuel allows" — when the command tree says refuel but
/// the ship has enough fuel to return home, continue surveying instead.
fn check_defer_refuel(
    ship: &BodyEntry,
    pending_result: &CommandResult,
    state: &State,
) -> Option<CommandResult> {
    if !matches!(pending_result, CommandResult::Refuel) {
        return None;
    }
    if ship.ship_state.as_deref() != Some("orbiting") {
        return None;
    }
    let host_name = ship.host_planet_name.as_deref().unwrap_or("");
    if has_colony(host_name, state) {
        return None;
    }

    if ship.commander.initiative < 0.2 {
        return None;
    }

    let return_cost = estimate_return_fuel_kg(ship, state)?;

    if !should_defer_refueling(ship.fuel_kg, return_cost, ship.commander.caution) {
        return None;
    }

    let ship_entry = body_entry_to_ship_entry(ship);
    let max_level = resolve_ship_sensor_level(&ship_entry, state);
    if !has_unsurveyed_work_at_host(host_name, max_level, state) {
        return None;
    }

    Some(CommandResult::Survey)
}

// ---------------------------------------------------------------------------
// Scored candidate system
// ---------------------------------------------------------------------------

struct ScoredAction {
    action: CommandResult,
    score: f64,
}

// ---------------------------------------------------------------------------
// Main decision entry point
// ---------------------------------------------------------------------------

/// Evaluate standing orders, then apply commander judgment via a scored
/// candidate system. Each override returns a score (0–1); the highest score
/// wins. The base command tree result scores 0.5.
///
/// Returns `None` if no command matches (nothing to do).
///
/// Side-effect: when the best action is `Survey` and the ship is at a colony
/// with no existing plan, a survey plan is computed and stored.
pub fn commander_decide(
    ship: &BodyEntry,
    tree: &CommandTree,
    immediate: Option<&CommandEntry>,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
    state: &mut State,
) -> Option<CommandResult> {
    let ship_entry = body_entry_to_ship_entry(ship);

    let base_result =
        evaluate_command_tree(&ship_entry, tree, immediate, crew, maintenance, state)?;

    let mut candidates: Vec<ScoredAction> = vec![ScoredAction {
        action: base_result.clone(),
        score: 0.5,
    }];

    // Preemptive service — score 0.7
    if let Some(action) =
        check_preemptive_service(ship, &base_result, tree, crew, maintenance, state)
    {
        candidates.push(ScoredAction { action, score: 0.7 });
    }

    // Hold for inbound tanker — score 0.85
    if let Some(action) = check_hold_for_tanker(ship, &base_result, state) {
        candidates.push(ScoredAction {
            action,
            score: 0.85,
        });
    }

    // Defer refuel — variable score
    {
        let maybe_action = check_defer_refuel(ship, &base_result, state);
        if let Some(action) = maybe_action {
            let return_cost = estimate_return_fuel_kg(ship, state);
            let score = match return_cost {
                None => 0.6,
                Some(cost) => {
                    let margin = compute_safety_margin(ship.commander.caution);
                    compute_refuel_deferral_score(ship.fuel_kg, cost, margin)
                }
            };
            candidates.push(ScoredAction { action, score });
        }
    }

    // Defer maintenance — score 0.6
    if let Some(action) =
        check_defer_maintenance(ship, &base_result, tree, crew, maintenance, state)
    {
        candidates.push(ScoredAction { action, score: 0.6 });
    }

    // Pick the highest-scored candidate (stable: first wins on tie)
    let best = candidates
        .into_iter()
        .fold(None::<ScoredAction>, |acc, c| match acc {
            None => Some(c),
            Some(a) if c.score > a.score => Some(c),
            Some(a) => Some(a),
        })?;

    // Side-effect: create survey plan when departing a colony for survey work
    if matches!(best.action, CommandResult::Survey)
        && is_at_colony(ship, state)
        && ship.survey_plan.is_none()
    {
        let plan = compute_survey_plan(&ship.data.name, state);
        // Store the plan back onto the ship entry in body_meshes
        if let Some(body) = state.find_ship_mut(&ship.data.name) {
            body.survey_plan = plan;
        }
    }

    Some(best.action)
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

/// Bump judgment after a malfunction (diminishing returns, capped at 0.9).
pub fn learn_from_malfunction(ship: &mut BodyEntry) {
    ship.commander.caution = f64::min(
        JUDGMENT_CAP,
        ship.commander.caution + MALFUNCTION_LEARNING_RATE * (1.0 - ship.commander.caution),
    );
}

/// Bump judgment after an emergency return (diminishing returns, capped at 0.9).
pub fn learn_from_emergency_return(ship: &mut BodyEntry) {
    ship.commander.caution = f64::min(
        JUDGMENT_CAP,
        ship.commander.caution + EMERGENCY_RETURN_LEARNING_RATE * (1.0 - ship.commander.caution),
    );
}

/// Increment the commander's experience counter and drift caution/initiative toward 0.5.
pub fn increment_experience(ship: &mut BodyEntry) {
    ship.commander.experience += 1.0;
    for axis in ["caution", "initiative"] {
        let v = match axis {
            "caution" => ship.commander.caution,
            _ => ship.commander.initiative,
        };
        let new_v = if v > 0.5 {
            f64::max(0.5, v - JUDGMENT_DRIFT_RATE)
        } else if v < 0.5 {
            f64::min(0.5, v + JUDGMENT_DRIFT_RATE)
        } else {
            v
        };
        match axis {
            "caution" => ship.commander.caution = new_v,
            _ => ship.commander.initiative = new_v,
        }
    }
}
