// Survey planner — ported from src/core/survey-planner.ts

use std::collections::HashSet;

use drift_math::orbit::DIST_SCALE;
use drift_math::ship_physics::{compute_total_fuel_cost, AU_TO_KM};

use crate::colonies::get_nearest_colony_for_ship;
use crate::entities::find_body;
use crate::intents::{clear_intent, get_claimed_targets, publish_intent};
use crate::ship_utils::{resolve_ship_physics, resolve_ship_sensor_level};
use crate::state::{ShipEntry, ShipIntent, State, SurveyPlan};

const AVG_SURVEY_DAYS: f64 = 10.0;
const THROTTLE_LEVELS: &[f64] = &[1.0, 0.5, 0.25];
const MIN_PLAN_TARGETS: usize = 2;
const CLAIM_LOOKAHEAD: usize = 3;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

struct SurveyCandidate {
    name: String,
    x: f32,
    z: f32,
}

struct TourResult {
    targets: Vec<String>,
    total_days: f64,
}

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

/// Convert world-space position to AU distance from star.
fn world_to_au(x: f32, z: f32) -> f64 {
    let world_r = ((x as f64) * (x as f64) + (z as f64) * (z as f64)).sqrt();
    let ratio = world_r / DIST_SCALE;
    ratio * ratio
}

/// Estimate km distance between two world-space points using AU chord distance.
fn candidate_dist_km(ax: f32, az: f32, bx: f32, bz: f32) -> f64 {
    let au_a = world_to_au(ax, az);
    let au_b = world_to_au(bx, bz);
    let angle_a = (az as f64).atan2(ax as f64);
    let angle_b = (bz as f64).atan2(bx as f64);
    let ax_au = angle_a.cos() * au_a;
    let az_au = angle_a.sin() * au_a;
    let bx_au = angle_b.cos() * au_b;
    let bz_au = angle_b.sin() * au_b;
    ((bx_au - ax_au).powi(2) + (bz_au - az_au).powi(2)).sqrt() * AU_TO_KM
}

// ---------------------------------------------------------------------------
// Candidate collection
// ---------------------------------------------------------------------------

fn collect_body_candidates(
    sx: f32,
    sz: f32,
    claimed: &HashSet<String>,
    max_level: u32,
    state: &State,
) -> Vec<SurveyCandidate> {
    let mut out = Vec::new();
    for body in &state.body_meshes {
        if body.is_ship {
            continue;
        }
        // Only bodies that are surveyable (have a non-trivial body type)
        if body.data.body_type == "Star" {
            continue;
        }
        // Skip fully surveyed bodies
        if body.survey.survey_level >= max_level {
            continue;
        }
        if claimed.contains(&body.data.name) {
            continue;
        }
        let bx = body.position[0];
        let bz = body.position[2];
        let dx = bx - sx;
        let dz = bz - sz;
        let _ = dx * dx + dz * dz; // distSq unused beyond ordering; keep for parity
        out.push(SurveyCandidate {
            name: body.data.name.clone(),
            x: bx,
            z: bz,
        });
    }
    out
}

fn collect_asteroid_candidates(
    _sx: f32,
    _sz: f32,
    claimed: &HashSet<String>,
    max_level: u32,
    state: &State,
) -> Vec<SurveyCandidate> {
    let mut out = Vec::new();
    for belt_entry in &state.asteroid_belts {
        for asteroid in &belt_entry.asteroids {
            if asteroid.survey.survey_level >= max_level {
                continue;
            }
            if claimed.contains(&asteroid.designation) {
                continue;
            }
            let idx = asteroid.belt_index;
            let bx = belt_entry.positions.get(idx * 3).copied().unwrap_or(0.0);
            let bz = belt_entry
                .positions
                .get(idx * 3 + 2)
                .copied()
                .unwrap_or(0.0);
            out.push(SurveyCandidate {
                name: asteroid.designation.clone(),
                x: bx,
                z: bz,
            });
        }
    }
    out
}

fn collect_plan_candidates(ship: &ShipEntry, state: &State) -> Vec<SurveyCandidate> {
    let sx = ship.position[0];
    let sz = ship.position[2];
    let claimed = get_claimed_targets(&ship.name, state);
    let max_level = resolve_ship_sensor_level(ship, state);
    let mut candidates = collect_body_candidates(sx, sz, &claimed, max_level, state);
    candidates.extend(collect_asteroid_candidates(
        sx, sz, &claimed, max_level, state,
    ));
    candidates
}

// ---------------------------------------------------------------------------
// Intent publishing
// ---------------------------------------------------------------------------

fn publish_plan_claims(ship_name: &str, targets: &[String], state: &mut State) {
    if targets.is_empty() {
        clear_intent(ship_name, state);
        return;
    }
    let lookahead: Vec<String> = targets.iter().take(CLAIM_LOOKAHEAD).cloned().collect();
    publish_intent(
        ship_name,
        ShipIntent::SurveyPlan {
            targets: lookahead,
            ship_name: ship_name.to_string(),
        },
        state,
    );
}

// ---------------------------------------------------------------------------
// Tour simulation helpers
// ---------------------------------------------------------------------------

struct PhysicsParams {
    isp_s: f64,
    dry_mass_kg: f64,
    fuel_capacity_kg: f64,
    fuel_mod: f64,
}

#[allow(clippy::too_many_arguments)]
fn simulate_tour(
    candidates: &[SurveyCandidate],
    start_x: f32,
    start_z: f32,
    colony_x: f32,
    colony_z: f32,
    accel_g: f64,
    fuel_budget_kg: f64,
    days_budget: f64,
    physics: &PhysicsParams,
    op_mult: f64,
) -> TourResult {
    let mut remaining: Vec<usize> = (0..candidates.len()).collect();
    let mut targets: Vec<String> = Vec::new();
    let mut cur_x = start_x;
    let mut cur_z = start_z;
    let mut fuel_used = 0.0f64;
    let mut days_used = 0.0f64;

    while !remaining.is_empty() {
        // Find nearest candidate to current position
        let mut best_idx_in_remaining = 0usize;
        let mut best_dist_sq = f64::INFINITY;
        for (i, &ci) in remaining.iter().enumerate() {
            let dx = candidates[ci].x - cur_x;
            let dz = candidates[ci].z - cur_z;
            let d2 = (dx as f64) * (dx as f64) + (dz as f64) * (dz as f64);
            if d2 < best_dist_sq {
                best_dist_sq = d2;
                best_idx_in_remaining = i;
            }
        }

        let next_ci = remaining[best_idx_in_remaining];
        let next = &candidates[next_ci];

        let hop_dist_km = candidate_dist_km(cur_x, cur_z, next.x, next.z);
        let hop_cost = compute_total_fuel_cost(
            hop_dist_km,
            accel_g,
            physics.isp_s,
            physics.dry_mass_kg,
            physics.fuel_capacity_kg,
            op_mult,
            physics.fuel_mod,
        );

        let return_dist_km = candidate_dist_km(next.x, next.z, colony_x, colony_z);
        let return_cost = compute_total_fuel_cost(
            return_dist_km,
            accel_g,
            physics.isp_s,
            physics.dry_mass_kg,
            physics.fuel_capacity_kg,
            op_mult,
            physics.fuel_mod,
        );

        let projected_fuel = fuel_used + hop_cost.total_fuel_kg + return_cost.total_fuel_kg;
        let projected_days = days_used + hop_cost.transfer_days + AVG_SURVEY_DAYS;

        if projected_fuel > fuel_budget_kg {
            break;
        }
        if projected_days > days_budget {
            break;
        }

        targets.push(next.name.clone());
        fuel_used += hop_cost.total_fuel_kg;
        days_used += hop_cost.transfer_days + AVG_SURVEY_DAYS;
        cur_x = next.x;
        cur_z = next.z;
        remaining.remove(best_idx_in_remaining);
    }

    TourResult {
        targets,
        total_days: days_used,
    }
}

/// Compute total tour distance for an ordered sequence of candidate names.
fn tour_distance(names: &[String], candidates: &[SurveyCandidate]) -> f64 {
    let mut total = 0.0f64;
    for i in 0..names.len().saturating_sub(1) {
        let a = candidates.iter().find(|c| c.name == names[i]);
        let b = candidates.iter().find(|c| c.name == names[i + 1]);
        if let (Some(a), Some(b)) = (a, b) {
            total += candidate_dist_km(a.x, a.z, b.x, b.z);
        }
    }
    total
}

/// 2-opt local search: try reversing each sub-segment and keep improvements.
fn two_opt_improve(targets: Vec<String>, candidates: &[SurveyCandidate]) -> Vec<String> {
    let mut best = targets;
    let mut improved = true;
    while improved {
        improved = false;
        let n = best.len();
        'outer: for i in 1..n.saturating_sub(1) {
            for j in (i + 1)..n {
                let mut candidate = best[..i].to_vec();
                candidate.extend(best[i..=j].iter().cloned().rev());
                candidate.extend_from_slice(&best[j + 1..]);
                if tour_distance(&candidate, candidates) < tour_distance(&best, candidates) {
                    best = candidate;
                    improved = true;
                    break 'outer;
                }
            }
        }
    }
    best
}

/// Pick the best tour (most targets; tie-break by fewest days).
fn select_best_tour(tours: Vec<(TourResult, f64)>) -> Option<(Vec<String>, f64)> {
    let mut best_targets: Vec<String> = Vec::new();
    let mut best_days = 0.0f64;
    let mut best_accel = 0.0f64;
    let mut found = false;

    for (tour, accel_g) in tours {
        let better = !found
            || tour.targets.len() > best_targets.len()
            || (tour.targets.len() == best_targets.len() && tour.total_days < best_days);
        if better {
            best_targets = tour.targets;
            best_days = tour.total_days;
            best_accel = accel_g;
            found = true;
        }
    }

    if !found {
        return None;
    }
    Some((best_targets, best_accel))
}

/// Compute return fuel cost from the last plan target back to colony.
fn compute_return_fuel_kg(
    targets: &[String],
    candidates: &[SurveyCandidate],
    colony_x: f32,
    colony_z: f32,
    accel_g: f64,
    physics: &PhysicsParams,
    op_mult: f64,
) -> f64 {
    if targets.is_empty() {
        return 0.0;
    }
    let last_name = targets.last().unwrap();
    let last = candidates.iter().find(|c| &c.name == last_name);
    let Some(last) = last else { return 0.0 };
    let return_dist = candidate_dist_km(last.x, last.z, colony_x, colony_z);
    let return_cost = compute_total_fuel_cost(
        return_dist,
        accel_g,
        physics.isp_s,
        physics.dry_mass_kg,
        physics.fuel_capacity_kg,
        op_mult,
        physics.fuel_mod,
    );
    return_cost.total_fuel_kg
}

/// Estimate days until morale drops to a threshold given current deployment.
///
/// morale = 100 * (limit / daysSinceLeave)^1.5  when > limit
/// Solve for days where morale = threshold:
///   days = limit / (threshold/100)^(2/3)
fn estimate_days_budget(
    days_since_leave: f64,
    deployment_limit: f64,
    morale_threshold: f64,
) -> f64 {
    if morale_threshold <= 0.0 {
        return 365.0 * 10.0; // effectively unlimited
    }
    let days_at_threshold = deployment_limit / (morale_threshold / 100.0).powf(2.0 / 3.0);
    (days_at_threshold - days_since_leave).max(0.0)
}

/// Safety margin for fuel planning: caution interpolates from 1.3 (fearless) to 2.0 (cautious).
fn compute_safety_margin(caution: f64) -> f64 {
    2.0 - caution * 0.7
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Compute a survey mission plan for a ship departing a colony.
/// Returns None if fewer than MIN_PLAN_TARGETS candidates or initiative too low.
pub fn compute_survey_plan(ship: &ShipEntry, state: &mut State) -> Option<SurveyPlan> {
    if ship.commander.initiative < 0.15 {
        return None;
    }

    let candidates = collect_plan_candidates(ship, state);
    if candidates.len() < MIN_PLAN_TARGETS {
        return None;
    }

    // Find the nearest colony body and get its world-space position.
    // get_nearest_colony_for_ship takes a BodyEntry, so look up the ship first.
    let (ship_body, ship_found) = find_body(&ship.name, state);
    if !ship_found {
        return None;
    }
    let ship_body = ship_body?;
    // Shadow to avoid lifetime issues — copy what we need.
    let _ship_body_host = ship_body.host_planet_name.clone();

    // Build a temporary BodyEntry-like value to find the nearest colony.
    // We pass the ship BodyEntry directly.
    let colony_body_name = {
        // We need to use get_nearest_colony_for_ship but it borrows state.
        // Look up the ship entry immutably first.
        let (ship_body_ref, _) = find_body(&ship.name, state);
        let colony_body = get_nearest_colony_for_ship(ship_body_ref?, state)?;
        colony_body.data.name.clone()
    };

    let (colony_body_ref, found) = find_body(&colony_body_name, state);
    if !found {
        return None;
    }
    let colony_body_ref = colony_body_ref?;
    let colony_x = colony_body_ref.position[0];
    let colony_z = colony_body_ref.position[2];

    let ship_x = ship.position[0];
    let ship_z = ship.position[2];

    let physics_state = resolve_ship_physics(ship, state);
    let op_mult = state.fuel_burn_multiplier;
    let margin = compute_safety_margin(ship.commander.caution);

    // Morale-based days budget.
    // ShipEntry in Rust doesn't carry crew; use conservative defaults.
    let days_since_leave = 0.0_f64;
    let deployment_limit = 180.0_f64;
    let morale_threshold = 30.0_f64;
    let days_budget = estimate_days_budget(days_since_leave, deployment_limit, morale_threshold);

    let physics = PhysicsParams {
        isp_s: physics_state.isp_s,
        dry_mass_kg: physics_state.dry_mass_kg,
        fuel_capacity_kg: ship.fuel_capacity_kg,
        fuel_mod: physics_state.fuel_mod,
    };

    let fuel_budget_kg = ship.fuel_kg / margin;

    let tours: Vec<(TourResult, f64)> = THROTTLE_LEVELS
        .iter()
        .map(|&fraction| {
            let accel_g = physics_state.accel_g * fraction;
            let tour = simulate_tour(
                &candidates,
                ship_x,
                ship_z,
                colony_x,
                colony_z,
                accel_g,
                fuel_budget_kg,
                days_budget,
                &physics,
                op_mult,
            );
            (tour, accel_g)
        })
        .collect();

    let (mut best_targets, best_accel_g) = select_best_tour(tours)?;
    if best_targets.len() < MIN_PLAN_TARGETS {
        return None;
    }

    if best_targets.len() >= 4 {
        best_targets = two_opt_improve(best_targets, &candidates);
    }

    let return_fuel_kg = compute_return_fuel_kg(
        &best_targets,
        &candidates,
        colony_x,
        colony_z,
        best_accel_g,
        &physics,
        op_mult,
    );

    let plan = SurveyPlan {
        targets: best_targets,
        accel_g: best_accel_g,
        return_fuel_kg,
    };

    publish_plan_claims(&ship.name, &plan.targets, state);

    Some(plan)
}

/// Pop the next valid target from the ship's survey plan.
/// Skips targets that are already surveyed or claimed by other ships.
/// Returns None (and clears the plan) when all targets are consumed.
pub fn advance_survey_plan(ship_name: &str, state: &mut State) -> Option<String> {
    // Check if ship has a plan
    let has_plan = {
        let (body, found) = find_body(ship_name, state);
        found && body.map(|b| b.survey_plan.is_some()).unwrap_or(false)
    };
    if !has_plan {
        return None;
    }

    let claimed = get_claimed_targets(ship_name, state);

    loop {
        // Check remaining targets
        let next_target = {
            let (body, found) = find_body(ship_name, state);
            if !found {
                return None;
            }
            let body = body?;
            if body
                .survey_plan
                .as_ref()
                .map(|p| p.targets.is_empty())
                .unwrap_or(true)
            {
                None
            } else {
                body.survey_plan
                    .as_ref()
                    .and_then(|p| p.targets.first().cloned())
            }
        };

        let Some(target) = next_target else {
            break;
        };

        // Remove from front of plan
        {
            let found = find_body(ship_name, state).1;
            if found {
                if let Some(ship_body) = state.find_ship_mut(ship_name) {
                    if let Some(plan) = ship_body.survey_plan.as_mut() {
                        if !plan.targets.is_empty() {
                            plan.targets.remove(0);
                        }
                    }
                }
            }
        }

        // Skip if already surveyed
        let (body_ref, body_found) = find_body(&target, state);
        if body_found {
            if let Some(b) = body_ref {
                if b.data.body_type != "Ship" && b.survey.survey_level > 0 {
                    continue;
                }
            }
        }

        // Skip if claimed by another ship
        if claimed.contains(&target) {
            continue;
        }

        // Valid target — update intent with remaining targets and return it
        let remaining = {
            let (body, _) = find_body(ship_name, state);
            body.and_then(|b| b.survey_plan.as_ref())
                .map(|p| p.targets.clone())
                .unwrap_or_default()
        };
        publish_plan_claims(ship_name, &remaining, state);
        return Some(target);
    }

    // Plan exhausted — try recomputing from current position
    if let Some(ship_body) = state.find_ship_mut(ship_name) {
        ship_body.survey_plan = None;
    }

    // Build a temporary ShipEntry to call compute_survey_plan
    let ship_entry = {
        let (body, found) = find_body(ship_name, state);
        if !found {
            return None;
        }
        let body = body?;
        ShipEntry {
            name: body.data.name.clone(),
            position: body.position,
            is_ship: true,
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
    };

    let new_plan = compute_survey_plan(&ship_entry, state)?;
    if new_plan.targets.is_empty() {
        return None;
    }

    let first = new_plan.targets.first().cloned()?;
    // Store plan without first target (already being returned)
    let remaining_targets = new_plan.targets[1..].to_vec();
    let stored_plan = SurveyPlan {
        targets: remaining_targets.clone(),
        accel_g: new_plan.accel_g,
        return_fuel_kg: new_plan.return_fuel_kg,
    };
    if let Some(ship_body) = state.find_ship_mut(ship_name) {
        ship_body.survey_plan = Some(stored_plan);
    }
    publish_plan_claims(ship_name, &remaining_targets, state);
    Some(first)
}

/// Clear a ship's survey plan and release claimed targets.
pub fn clear_survey_plan(ship_name: &str, state: &mut State) {
    let has_plan = {
        let (body, found) = find_body(ship_name, state);
        found && body.map(|b| b.survey_plan.is_some()).unwrap_or(false)
    };
    if !has_plan {
        return;
    }
    if let Some(ship_body) = state.find_ship_mut(ship_name) {
        ship_body.survey_plan = None;
    }
    clear_intent(ship_name, state);
}
