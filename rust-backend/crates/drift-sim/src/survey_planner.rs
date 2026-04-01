// Survey planner — ported from src/core/survey-planner.ts

use std::collections::HashSet;

use drift_math::orbit::DIST_SCALE;
use drift_math::ship_physics::{compute_total_fuel_cost, AU_TO_KM};

use crate::colonies::get_nearest_colony_for_ship;
use crate::entities::find_body;
use crate::intents::{clear_intent, get_claimed_targets, publish_intent};
use crate::state::{ShipEntry, ShipIntent, State, SurveyPlan};
use drift_math::ship_physics::ENGINE_TYPES;

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

struct ShipPhysics {
    accel_g: f64,
    isp_s: f64,
    dry_mass_kg: f64,
    fuel_capacity_kg: f64,
    fuel_mod: f64,
}

// ---------------------------------------------------------------------------
// Ship physics resolution (inline, operating on ShipEntry snapshot)
// ---------------------------------------------------------------------------

fn resolve_physics_for_snapshot(ship: &ShipEntry, state: &State) -> ShipPhysics {
    if let Some(ref design_id) = ship.design_id {
        if let Some(design) = state.ship_designs.get(design_id) {
            let fuel_mod = state
                .engine_designs
                .get(&design.engine_design_id)
                .map(|e| e.fuel_mod)
                .unwrap_or(1.0);
            return ShipPhysics {
                accel_g: design.accel_g,
                isp_s: design.isp_s,
                dry_mass_kg: ship.dry_mass_kg,
                fuel_capacity_kg: ship.fuel_capacity_kg,
                fuel_mod,
            };
        }
    }
    let engine = ship
        .engine_id
        .as_deref()
        .and_then(|id| ENGINE_TYPES.iter().find(|e| e.id == id))
        .unwrap_or(&ENGINE_TYPES[0]);
    ShipPhysics {
        accel_g: engine.accel_g,
        isp_s: engine.isp_s,
        dry_mass_kg: ship.dry_mass_kg,
        fuel_capacity_kg: ship.fuel_capacity_kg,
        fuel_mod: 1.0,
    }
}

fn sensor_level_for_snapshot(ship: &ShipEntry, state: &State) -> u32 {
    if let Some(ref design_id) = ship.design_id {
        if let Some(design) = state.ship_designs.get(design_id) {
            let bonus = design.sensor_multiplier;
            return if bonus >= 2.0 {
                3
            } else if bonus >= 1.5 {
                2
            } else {
                1
            };
        }
    }
    1
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

/// Estimate km distance between two world-space points via AU chord distance.
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
    claimed: &HashSet<String>,
    max_level: u32,
    state: &State,
) -> Vec<SurveyCandidate> {
    let mut out = Vec::new();
    for body in &state.body_meshes {
        if body.is_ship {
            continue;
        }
        if body.data.body_type == "Star" {
            continue;
        }
        if body.survey.survey_level >= max_level {
            continue;
        }
        if claimed.contains(&body.data.name) {
            continue;
        }
        out.push(SurveyCandidate {
            name: body.data.name.clone(),
            x: body.position[0],
            z: body.position[2],
        });
    }
    out
}

fn collect_asteroid_candidates(
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

fn collect_plan_candidates_from_ship_entry(
    ship: &ShipEntry,
    state: &State,
) -> Vec<SurveyCandidate> {
    let claimed = get_claimed_targets(&ship.name, state);
    let max_level = sensor_level_for_snapshot(ship, state);
    let mut candidates = collect_body_candidates(&claimed, max_level, state);
    candidates.extend(collect_asteroid_candidates(&claimed, max_level, state));
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
// Tour simulation
// ---------------------------------------------------------------------------

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
    physics: &ShipPhysics,
    op_mult: f64,
) -> TourResult {
    let mut remaining: Vec<usize> = (0..candidates.len()).collect();
    let mut targets: Vec<String> = Vec::new();
    let mut cur_x = start_x;
    let mut cur_z = start_z;
    let mut fuel_used = 0.0f64;
    let mut days_used = 0.0f64;

    while !remaining.is_empty() {
        // Nearest-neighbour: find closest candidate from current position.
        let mut best_idx = 0usize;
        let mut best_dist_sq = f64::INFINITY;
        for (i, &ci) in remaining.iter().enumerate() {
            let dx = candidates[ci].x - cur_x;
            let dz = candidates[ci].z - cur_z;
            let d2 = (dx as f64) * (dx as f64) + (dz as f64) * (dz as f64);
            if d2 < best_dist_sq {
                best_dist_sq = d2;
                best_idx = i;
            }
        }

        let next_ci = remaining[best_idx];
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

        if projected_fuel > fuel_budget_kg || projected_days > days_budget {
            break;
        }

        targets.push(next.name.clone());
        fuel_used += hop_cost.total_fuel_kg;
        days_used += hop_cost.transfer_days + AVG_SURVEY_DAYS;
        cur_x = next.x;
        cur_z = next.z;
        remaining.remove(best_idx);
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
        let mut did_swap = false;
        for i in 1..n.saturating_sub(1) {
            if did_swap {
                break;
            }
            for j in (i + 1)..n {
                let mut candidate_route = best[..i].to_vec();
                candidate_route.extend(best[i..=j].iter().cloned().rev());
                candidate_route.extend_from_slice(&best[j + 1..]);
                if tour_distance(&candidate_route, candidates) < tour_distance(&best, candidates) {
                    best = candidate_route;
                    improved = true;
                    did_swap = true;
                    break;
                }
            }
        }
    }
    best
}

/// Pick the best tour: most targets, tie-break by fewest days.
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
    physics: &ShipPhysics,
    op_mult: f64,
) -> f64 {
    let last_name = match targets.last() {
        Some(n) => n,
        None => return 0.0,
    };
    let last = match candidates.iter().find(|c| &c.name == last_name) {
        Some(c) => c,
        None => return 0.0,
    };
    let return_dist = candidate_dist_km(last.x, last.z, colony_x, colony_z);
    let cost = compute_total_fuel_cost(
        return_dist,
        accel_g,
        physics.isp_s,
        physics.dry_mass_kg,
        physics.fuel_capacity_kg,
        op_mult,
        physics.fuel_mod,
    );
    cost.total_fuel_kg
}

// ---------------------------------------------------------------------------
// Budget helpers
// ---------------------------------------------------------------------------

/// Estimate days until morale drops to a threshold given current deployment.
///
/// morale = 100 * (limit / daysSinceLeave)^1.5 when past deployment limit.
/// Solve for days where morale = threshold: days = limit / (threshold/100)^(2/3)
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

/// Safety margin for fuel planning: caution in [0,1] maps to margin in [1.3, 2.0].
fn compute_safety_margin(caution: f64) -> f64 {
    2.0 - caution * 0.7
}

// ---------------------------------------------------------------------------
// Public API
//
// Functions take `ship_name: &str` + `state: &mut State` to avoid double-borrow
// conflicts at call sites. Callers do not need to hold a `&mut BodyEntry` borrow
// while also passing `&mut State`.
// ---------------------------------------------------------------------------

/// Compute a survey mission plan for the named ship.
/// Returns None if the ship is not found, has fewer than MIN_PLAN_TARGETS
/// candidates, or has insufficient initiative.
/// On success, publishes a `SurveyPlan` intent into `state.ship_intents`.
pub fn compute_survey_plan(ship_name: &str, state: &mut State) -> Option<SurveyPlan> {
    // Snapshot all data we need from the ship entry before any further borrows.
    let (
        initiative,
        caution,
        position,
        fuel_kg,
        fuel_capacity_kg,
        dry_mass_kg,
        engine_id,
        design_id,
        commander_snapshot,
    ) = {
        let (body, found) = find_body(ship_name, state);
        if !found {
            return None;
        }
        let b = body?;
        (
            b.commander.initiative,
            b.commander.caution,
            b.position,
            b.fuel_kg,
            b.fuel_capacity_kg,
            b.dry_mass_kg,
            b.engine_id.clone(),
            b.design_id.clone(),
            b.commander.clone(),
        )
    };

    if initiative < 0.15 {
        return None;
    }

    // Build a temporary ShipEntry to reuse existing candidate collection helpers.
    let ship_snapshot = crate::state::ShipEntry {
        name: ship_name.to_string(),
        position,
        is_ship: true,
        ship_state: "orbiting".to_string(),
        host_planet_name: {
            let (body, _) = find_body(ship_name, state);
            body.and_then(|b| b.host_planet_name.clone())
                .unwrap_or_default()
        },
        fuel_kg,
        fuel_capacity_kg,
        dry_mass_kg,
        engine_id,
        design_id,
        commander: crate::state::Commander {
            caution: commander_snapshot.caution,
            initiative: commander_snapshot.initiative,
            experience: commander_snapshot.experience,
        },
        ..crate::state::ShipEntry::default()
    };

    let candidates = collect_plan_candidates_from_ship_entry(&ship_snapshot, state);
    if candidates.len() < MIN_PLAN_TARGETS {
        return None;
    }

    // Resolve colony position.
    let colony_body_name: String = {
        let (body, found) = find_body(ship_name, state);
        if !found {
            return None;
        }
        let colony = get_nearest_colony_for_ship(body?, state)?;
        colony.data.name.clone()
    };

    let (colony_x, colony_z): (f32, f32) = {
        let (colony_ref, found) = find_body(&colony_body_name, state);
        if !found {
            return None;
        }
        let b = colony_ref?;
        (b.position[0], b.position[2])
    };

    let ship_x = position[0];
    let ship_z = position[2];

    let physics = resolve_physics_for_snapshot(&ship_snapshot, state);
    let op_mult = state.fuel_burn_multiplier;
    let margin = compute_safety_margin(caution);
    let days_budget = estimate_days_budget(0.0, 180.0, 30.0);
    let fuel_budget_kg = fuel_kg / margin;

    let tours: Vec<(TourResult, f64)> = THROTTLE_LEVELS
        .iter()
        .map(|&fraction| {
            let accel_g = physics.accel_g * fraction;
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

    publish_plan_claims(ship_name, &plan.targets, state);

    Some(plan)
}

/// Pop the next valid target from the named ship's survey plan.
/// Skips targets already surveyed or claimed by another ship.
/// When the plan is exhausted, attempts to recompute it from the current position.
/// Returns None when no targets remain.
pub fn advance_survey_plan(ship_name: &str, state: &mut State) -> Option<String> {
    {
        let (body, found) = find_body(ship_name, state);
        if !found || body.map(|b| b.survey_plan.is_none()).unwrap_or(true) {
            return None;
        }
    }

    let claimed = get_claimed_targets(ship_name, state);

    loop {
        let next_target: Option<String> = {
            let (body, _) = find_body(ship_name, state);
            body.and_then(|b| b.survey_plan.as_ref())
                .and_then(|p| p.targets.first().cloned())
        };

        let Some(target) = next_target else {
            break;
        };

        // Remove from the front of the plan.
        if let Some(ship_body) = state.find_ship_mut(ship_name) {
            if let Some(plan) = ship_body.survey_plan.as_mut() {
                if !plan.targets.is_empty() {
                    plan.targets.remove(0);
                }
            }
        }

        // Skip if already surveyed.
        {
            let (body_ref, body_found) = find_body(&target, state);
            if body_found {
                if let Some(b) = body_ref {
                    if b.data.body_type != "Ship" && b.survey.survey_level > 0 {
                        continue;
                    }
                }
            }
        }

        // Skip if claimed by another ship.
        if claimed.contains(&target) {
            continue;
        }

        // Valid target — refresh the intent with the remaining lookahead window.
        let remaining: Vec<String> = {
            let (body, _) = find_body(ship_name, state);
            body.and_then(|b| b.survey_plan.as_ref())
                .map(|p| p.targets.clone())
                .unwrap_or_default()
        };
        publish_plan_claims(ship_name, &remaining, state);
        return Some(target);
    }

    // Plan exhausted — clear it and try to recompute.
    if let Some(ship_body) = state.find_ship_mut(ship_name) {
        ship_body.survey_plan = None;
    }

    let new_plan = compute_survey_plan(ship_name, state)?;
    if new_plan.targets.is_empty() {
        return None;
    }

    let first = new_plan.targets.first().cloned()?;
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

/// Clear a ship's survey plan and release any claimed intent targets.
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
