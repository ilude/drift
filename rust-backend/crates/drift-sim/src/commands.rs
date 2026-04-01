// Command tree evaluation and ship simulation helpers.
// Ported from src/core/commands.ts.

use std::collections::HashSet;

use crate::state::{BodyEntry, ShipEntry, State};

// ---------------------------------------------------------------------------
// Command tree types
// ---------------------------------------------------------------------------

/// Condition type string for a command entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum CommandCondition {
    Always,
    FuelBelow { threshold: f64 },
    MoraleBelow { threshold: f64 },
    HullBelow { threshold: f64 },
    SuppliesBelow { threshold: f64 },
}

use serde::{Deserialize, Serialize};

/// The command to execute when a condition is met.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandType {
    SurveyNearest,
    TransferTo,
    Refuel,
    RefuelShip,
    ShoreLeave,
    Overhaul,
    MajorRefit,
    ReturnToBase,
    LoadCargo,
    UnloadCargo,
    Idle,
}

/// A single entry in the command priority tree.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandEntry {
    pub id: String,
    pub command: CommandType,
    pub condition: CommandCondition,
    pub target: Option<String>,
    pub enabled: bool,
    pub origin: String,
}

/// Priority-ordered list of commands.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CommandTree {
    pub entries: Vec<CommandEntry>,
}

/// The resolved action returned by command tree evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "kebab-case")]
pub enum CommandResult {
    Transfer { target: Option<String> },
    Survey,
    Refuel,
    RefuelShip,
    Overhaul,
    MajorRefit,
    ShoreLeave,
    LoadCargo,
    UnloadCargo,
    Idle,
}

// ---------------------------------------------------------------------------
// Ship simulation sub-types (not stored on ShipEntry in Rust — passed
// explicitly to pure functions that need them).
// ---------------------------------------------------------------------------

/// Crew state for morale / deployment tracking.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShipCrew {
    pub count: u32,
    pub morale: f64,
    pub last_shore_leave: f64,
    pub deployment_limit: f64,
}

/// Maintenance state for hull and supply tracking.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ShipMaintenance {
    pub age: f64,
    pub total_age: f64,
    pub last_refit_age: f64,
    pub supplies: f64,
    pub max_supplies: f64,
    pub hull_integrity: f64,
    pub overhauls_since_refit: u32,
    pub overhauls_until_refit: u32,
}

// ---------------------------------------------------------------------------
// Pure math functions
// ---------------------------------------------------------------------------

/// Hull ceiling: lifetime degradation limiting maximum restorable hull.
/// `max(30, 100 - years_since_refit * 1.5)`
pub fn hull_ceiling(total_age: f64, last_refit_age: f64) -> f64 {
    let years_since_refit = (total_age - last_refit_age) / 365.0;
    f64::max(30.0, 100.0 - years_since_refit * 1.5)
}

/// Bathtub curve malfunction probability per check interval.
///
/// Phase 1 (0–90 days):  infant mortality, ~2.5% decaying to ~1%
/// Phase 2 (90d–3yr):    useful life, constant ~1%
/// Phase 3 (3yr+):       wear-out, quadratic acceleration
///
/// The integrity multiplier uses sqrt to prevent a death spiral (25% hull = 2×
/// rate, not 4×). Crew morale and experience reduce the rate.
pub fn bathtub_fail_rate(
    days_since_overhaul: f64,
    hull_integrity: f64,
    morale: f64,
    experience: f64,
) -> f64 {
    let years = days_since_overhaul / 365.0;

    let base_rate = if years < 0.25 {
        // Phase 1: infant mortality — elevated then decaying
        0.01 + 0.015 * (1.0 - years / 0.25)
    } else if years < 3.0 {
        // Phase 2: useful life — low constant rate
        0.01
    } else {
        // Phase 3: wear-out — quadratic acceleration
        let wear_years = years - 3.0;
        0.01 + 0.005 * wear_years * wear_years
    };

    // Hull integrity: sqrt prevents death spiral
    let integrity_multiplier = (100.0 / f64::max(1.0, hull_integrity)).sqrt();

    // Crew quality: morale and experience reduce failures
    let morale_factor = 1.0 - (morale - 50.0) * 0.003;
    let exp_reduction = f64::min(0.2, experience * 0.005);
    let crew_factor = morale_factor * (1.0 - exp_reduction);

    base_rate * integrity_multiplier * crew_factor
}

/// Compute morale from deployment duration.
///
/// Returns 100 when within the deployment limit. Past the limit, decays with a
/// 1.5 exponent. Values below 1 are floored to 0.
pub fn compute_morale(days_since_leave: f64, deployment_limit: f64) -> f64 {
    if days_since_leave <= deployment_limit {
        return 100.0;
    }
    let raw = 100.0 * (deployment_limit / days_since_leave).powf(1.5);
    if raw < 1.0 {
        0.0
    } else {
        raw
    }
}

// ---------------------------------------------------------------------------
// Command tree evaluation
// ---------------------------------------------------------------------------

/// Evaluate a single command condition against ship state.
///
/// The `condition` string is one of: "always", "fuel-below", "morale-below",
/// "hull-below", "supplies-below". `threshold` is ignored for "always".
///
/// Because the Rust `ShipEntry` tracks fuel directly but stores morale, hull,
/// and supplies in separate structs passed by callers, those fields are
/// provided via `crew` and `maintenance`. Pass `None` for fields unavailable
/// in a given context — the condition will return `false` (conservative).
pub fn check_condition(
    condition: &CommandCondition,
    ship: &ShipEntry,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
) -> bool {
    match condition {
        CommandCondition::Always => true,
        CommandCondition::FuelBelow { threshold } => {
            if ship.fuel_capacity_kg <= 0.0 {
                return false;
            }
            (ship.fuel_kg / ship.fuel_capacity_kg) * 100.0 < *threshold
        }
        CommandCondition::MoraleBelow { threshold } => {
            crew.map(|c| c.morale < *threshold).unwrap_or(false)
        }
        CommandCondition::HullBelow { threshold } => maintenance
            .map(|m| m.hull_integrity < *threshold)
            .unwrap_or(false),
        CommandCondition::SuppliesBelow { threshold } => maintenance
            .map(|m| {
                if m.max_supplies <= 0.0 {
                    return false;
                }
                (m.supplies / m.max_supplies) * 100.0 < *threshold
            })
            .unwrap_or(false),
    }
}

/// Map a `CommandType` (and optional target) to a `CommandResult`.
fn command_to_result(command: &CommandType, target: Option<&str>) -> CommandResult {
    match command {
        CommandType::SurveyNearest => CommandResult::Survey,
        CommandType::TransferTo => CommandResult::Transfer {
            target: target.map(str::to_string),
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

/// Evaluate the command priority tree for a ship.
///
/// If the ship has an enabled `immediate_command` it is returned first
/// (one-shot — the caller is responsible for clearing it). Otherwise the
/// entries are iterated top-to-bottom and the first matching enabled entry is
/// returned. Returns `None` if no entry matches.
///
/// `crew` and `maintenance` are optional extended ship state for condition
/// evaluation. Pass `None` when not available — fuel conditions still work.
pub fn evaluate_command_tree(
    ship: &ShipEntry,
    tree: &CommandTree,
    immediate: Option<&CommandEntry>,
    crew: Option<&ShipCrew>,
    maintenance: Option<&ShipMaintenance>,
    _state: &State,
) -> Option<CommandResult> {
    // Immediate command takes priority (one-shot)
    if let Some(imm) = immediate {
        if imm.enabled {
            return Some(command_to_result(&imm.command, imm.target.as_deref()));
        }
    }

    for entry in &tree.entries {
        if !entry.enabled {
            continue;
        }
        if check_condition(&entry.condition, ship, crew, maintenance) {
            return Some(command_to_result(&entry.command, entry.target.as_deref()));
        }
    }

    None
}

// ---------------------------------------------------------------------------
// Survey target selection
// ---------------------------------------------------------------------------

/// Candidate body for survey target selection.
#[derive(Debug)]
struct SurveyCandidate {
    name: String,
    dist_sq: f32,
}

/// Greedy nearest-first unsurveyed body selection.
///
/// Returns the name of the nearest body not yet surveyed to `max_level` and
/// not already claimed by another ship. Searches both regular bodies and
/// asteroid belts via `state`.
pub fn select_next_survey_target(
    ship: &ShipEntry,
    state: &State,
    claimed: &HashSet<String>,
    max_level: u32,
) -> Option<String> {
    let sx = ship.position[0];
    let sz = ship.position[2];

    let mut candidates: Vec<SurveyCandidate> = Vec::new();

    // Regular bodies (planets, moons, comets — not ships)
    for body in &state.body_meshes {
        if body.is_ship {
            continue;
        }
        if body.survey.survey_level >= max_level {
            continue;
        }
        if claimed.contains(&body.data.name) {
            continue;
        }
        let dx = body.position[0] - sx;
        let dz = body.position[2] - sz;
        candidates.push(SurveyCandidate {
            name: body.data.name.clone(),
            dist_sq: dx * dx + dz * dz,
        });
    }

    // Asteroid belts
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
            let dx = bx - sx;
            let dz = bz - sz;
            candidates.push(SurveyCandidate {
                name: asteroid.designation.clone(),
                dist_sq: dx * dx + dz * dz,
            });
        }
    }

    candidates
        .into_iter()
        .min_by(|a, b| {
            a.dist_sq
                .partial_cmp(&b.dist_sq)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|c| c.name)
}

// ---------------------------------------------------------------------------
// Refuel target selection
// ---------------------------------------------------------------------------

/// Returns true if a body has a colony with at least one fuel depot.
pub fn is_refuel_candidate(body: &BodyEntry, state: &State) -> bool {
    if body.is_ship {
        return false;
    }
    state
        .colonies
        .get(&body.data.name)
        .map(|colony| colony.installations.fuel_depot > 0)
        .unwrap_or(false)
}

/// Select the nearest colony body that has a fuel depot.
///
/// Returns the name of the nearest refuel-capable body not claimed by another
/// ship. `claimed` should be derived from `get_claimed_targets`.
pub fn select_next_refuel_target(
    ship: &ShipEntry,
    state: &State,
    claimed: &HashSet<String>,
) -> Option<String> {
    let sx = ship.position[0];
    let sz = ship.position[2];

    struct Candidate {
        name: String,
        dist_sq: f32,
    }

    let best = state
        .body_meshes
        .iter()
        .filter(|body| {
            if body.is_ship {
                return false;
            }
            if claimed.contains(&body.data.name) {
                return false;
            }
            is_refuel_candidate(body, state)
        })
        .map(|body| {
            let dx = body.position[0] - sx;
            let dz = body.position[2] - sz;
            Candidate {
                name: body.data.name.clone(),
                dist_sq: dx * dx + dz * dz,
            }
        })
        .min_by(|a, b| {
            a.dist_sq
                .partial_cmp(&b.dist_sq)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

    best.map(|c| c.name)
}
