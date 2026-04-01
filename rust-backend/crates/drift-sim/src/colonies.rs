// Colony simulation — ported from src/core/colonies.ts

use std::collections::HashMap;

use drift_math::orbit::DIST_SCALE;
use drift_types::{
    ColonyInstallationId, ColonyInstallations, ColonyState, ColonyStockpile, ColonyWorkforce,
    TransferStatus,
};

use crate::entities::{find_asteroid_entity, find_body, list_ships_at_body};
use crate::notifications::add_coalesced_notification;
use crate::state::{BodyEntry, CompletedShipbuild, ResearchProjectEntry, ScientistEntry, State};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFORCE_RATIO: f64 = 0.45;
const BASE_STORAGE_CAPACITY: f64 = 100_000.0;
const STORAGE_CAPACITY_PER_INSTALLATION: f64 = 50_000.0;
const BASE_SERVICE_QUALITY: f64 = 0.5;
const BASE_MINING_RATE: f64 = 10.0;
const BASE_RESEARCH_RATE: f64 = 5.0;
const BASE_CONSTRUCTION_BP_RATE: f64 = 2.0;
const CATEGORY_GROWTH_RATE: f64 = 0.0015;
const ACADEMY_BASE_RATE: f64 = 0.001;
const SUPPLY_CONSUMPTION_RATE: f64 = 0.001;
const BASE_SHIPBUILD_BP_RATE: f64 = 1.0;
const EARTH_FUEL_RESTOCK_PER_DAY: f64 = 1_000.0;
const BASE_REFINERY_RATE: f64 = 500.0;
const METHANE_TO_FUEL_RATIO: f64 = 200.0;
const MASS_DRIVER_RATE_PER_DAY: f64 = 500.0;
const WARNING_INTERVAL_DAYS: f64 = 30.0;

// ---------------------------------------------------------------------------
// ColonyQualities (local re-use — also re-exported from drift_types)
// ---------------------------------------------------------------------------

pub use drift_types::ColonyQualities;

// ---------------------------------------------------------------------------
// Construction definitions
// ---------------------------------------------------------------------------

struct ConstructionDef {
    id: ColonyInstallationId,
    bp_cost: f64,
    resource_cost: &'static [(&'static str, f64)],
}

static CONSTRUCTION_DEFS: &[ConstructionDef] = &[
    ConstructionDef {
        id: ColonyInstallationId::ConstructionFactory,
        bp_cost: 120.0,
        resource_cost: &[("iron", 500.0), ("copper", 150.0), ("aluminum", 100.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::Mine,
        bp_cost: 80.0,
        resource_cost: &[("iron", 200.0), ("copper", 50.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::Lab,
        bp_cost: 120.0,
        resource_cost: &[("iron", 400.0), ("copper", 200.0), ("silicon", 100.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::RepairYard,
        bp_cost: 90.0,
        resource_cost: &[("iron", 350.0), ("copper", 100.0), ("aluminum", 100.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::FuelDepot,
        bp_cost: 70.0,
        resource_cost: &[("iron", 300.0), ("copper", 100.0), ("aluminum", 50.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::Academy,
        bp_cost: 100.0,
        resource_cost: &[("iron", 300.0), ("copper", 100.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::Storage,
        bp_cost: 60.0,
        resource_cost: &[("iron", 150.0), ("aluminum", 50.0)],
    },
    ConstructionDef {
        id: ColonyInstallationId::Shipyard,
        bp_cost: 180.0,
        resource_cost: &[
            ("iron", 1000.0),
            ("copper", 300.0),
            ("aluminum", 200.0),
            ("silicon", 100.0),
        ],
    },
    ConstructionDef {
        id: ColonyInstallationId::AutomatedMine,
        bp_cost: 120.0,
        resource_cost: &[
            ("iron", 400.0),
            ("copper", 150.0),
            ("aluminum", 100.0),
            ("silicon", 50.0),
        ],
    },
    ConstructionDef {
        id: ColonyInstallationId::MassDriver,
        bp_cost: 200.0,
        resource_cost: &[
            ("iron", 800.0),
            ("copper", 300.0),
            ("aluminum", 200.0),
            ("silicon", 150.0),
        ],
    },
    ConstructionDef {
        id: ColonyInstallationId::FuelRefinery,
        bp_cost: 100.0,
        resource_cost: &[("iron", 400.0), ("copper", 150.0), ("methane", 200.0)],
    },
];

fn get_construction_def(id: &ColonyInstallationId) -> Option<&'static ConstructionDef> {
    CONSTRUCTION_DEFS.iter().find(|d| d.id == *id)
}

// ---------------------------------------------------------------------------
// Production definitions
// ---------------------------------------------------------------------------

struct ProductionDef {
    id: &'static str,
    bp_cost: f64,
    resource_cost: &'static [(&'static str, f64)],
}

static PRODUCTION_DEFS: &[ProductionDef] = &[
    ProductionDef {
        id: "flat-mine",
        bp_cost: 100.0,
        resource_cost: &[("iron", 300.0), ("copper", 100.0), ("aluminum", 50.0)],
    },
    ProductionDef {
        id: "flat-mass-driver",
        bp_cost: 150.0,
        resource_cost: &[
            ("iron", 500.0),
            ("copper", 200.0),
            ("aluminum", 100.0),
            ("silicon", 50.0),
        ],
    },
    ProductionDef {
        id: "flat-fuel-depot",
        bp_cost: 80.0,
        resource_cost: &[("iron", 300.0), ("copper", 100.0), ("aluminum", 50.0)],
    },
];

fn get_production_def(item_id: &str) -> Option<&'static ProductionDef> {
    PRODUCTION_DEFS.iter().find(|d| d.id == item_id)
}

// ---------------------------------------------------------------------------
// Installation worker requirements
// ---------------------------------------------------------------------------

fn installation_workers(installations: &ColonyInstallations) -> f64 {
    installations.construction_factory as f64 * 50_000.0
        + installations.repair_yard as f64 * 50_000.0
        + installations.fuel_depot as f64 * 25_000.0
        + installations.mine as f64 * 50_000.0
        + installations.lab as f64 * 100_000.0
        + installations.academy as f64 * 50_000.0
        + installations.storage as f64 * 10_000.0
        + installations.shipyard as f64 * 250_000.0
        + installations.fuel_refinery as f64 * 50_000.0
        + installations.mass_driver as f64 * 10_000.0
    // automated_mine: 0 workers
}

// ---------------------------------------------------------------------------
// Empire tech bonuses
// ---------------------------------------------------------------------------

struct EmpireTechBonuses {
    survey: f64,
    mining: f64,
    repair: f64,
    refuel: f64,
    research: f64,
    construction: f64,
}

fn get_empire_tech_bonuses(state: &State) -> EmpireTechBonuses {
    let survey = (if state.researched_techs.contains("survey-automation") {
        1.15
    } else {
        1.0
    }) * (if state.researched_techs.contains("advanced-telemetry") {
        1.2
    } else {
        1.0
    }) * (if state.researched_techs.contains("deep-scan-array") {
        1.25
    } else {
        1.0
    });

    EmpireTechBonuses {
        survey,
        mining: if state.researched_techs.contains("mining-drills") {
            1.25
        } else {
            1.0
        },
        repair: if state.researched_techs.contains("maintenance-doctrine") {
            1.15
        } else {
            1.0
        },
        refuel: if state.researched_techs.contains("maintenance-doctrine") {
            1.15
        } else {
            1.0
        },
        research: if state.researched_techs.contains("lab-instrumentation") {
            1.2
        } else {
            1.0
        },
        construction: if state.researched_techs.contains("fabrication-methods") {
            1.25
        } else {
            1.0
        },
    }
}

pub fn get_survey_speed_multiplier(state: &State) -> f64 {
    1.0 / get_empire_tech_bonuses(state).survey
}

// ---------------------------------------------------------------------------
// Supply drain helpers
// ---------------------------------------------------------------------------

pub fn compute_supply_drain(population: f64, supply_multiplier: f64, sim_dt_days: f64) -> f64 {
    population * SUPPLY_CONSUMPTION_RATE * supply_multiplier * sim_dt_days
}

pub fn compute_supply_penalty(supplies: f64, daily_drain: f64) -> f64 {
    if daily_drain <= 0.0 {
        return 1.0;
    }
    let days_remaining = supplies / daily_drain;
    if days_remaining >= 90.0 {
        return 1.0;
    }
    if days_remaining <= 0.0 {
        return 0.5;
    }
    0.5 + 0.5 * (days_remaining / 90.0)
}

// ---------------------------------------------------------------------------
// Core colony calculations
// ---------------------------------------------------------------------------

/// Compute workforce breakdown for a colony.
pub fn compute_colony_workforce(colony: &ColonyState) -> ColonyWorkforce {
    let available_workers = (colony.population * WORKFORCE_RATIO * colony.habitability).floor();
    let used_workers = installation_workers(&colony.installations);
    let staffing_ratio = if used_workers <= 0.0 {
        1.0
    } else {
        (available_workers / used_workers).clamp(0.0, 1.0)
    };
    ColonyWorkforce {
        total_population: colony.population,
        workforce_ratio: WORKFORCE_RATIO,
        habitability: colony.habitability,
        available_workers,
        used_workers,
        staffing_ratio,
    }
}

/// Compute all quality modifiers for a colony.
pub fn compute_colony_qualities(colony: &ColonyState, state: &State) -> ColonyQualities {
    let workforce = compute_colony_workforce(colony);
    let staffing_ratio = workforce.staffing_ratio;
    let bonuses = get_empire_tech_bonuses(state);
    let daily_drain = compute_supply_drain(colony.population, state.supply_multiplier, 1.0);
    let supply_penalty = compute_supply_penalty(colony.stockpile.supplies, daily_drain);

    ColonyQualities {
        construction: (BASE_SERVICE_QUALITY
            + colony.installations.construction_factory as f64 * 0.2)
            * staffing_ratio
            * bonuses.construction
            * supply_penalty,
        repair: (BASE_SERVICE_QUALITY + colony.installations.repair_yard as f64 * 0.25)
            * staffing_ratio
            * bonuses.repair
            * supply_penalty,
        refuel: (BASE_SERVICE_QUALITY + colony.installations.fuel_depot as f64 * 0.25)
            * staffing_ratio
            * bonuses.refuel
            * supply_penalty,
        research: (BASE_SERVICE_QUALITY + colony.installations.lab as f64 * 0.2)
            * staffing_ratio
            * bonuses.research
            * supply_penalty,
        training: (BASE_SERVICE_QUALITY + colony.installations.academy as f64 * 0.2)
            * staffing_ratio
            * supply_penalty,
        mining: (BASE_SERVICE_QUALITY + colony.installations.mine as f64 * 0.2)
            * staffing_ratio
            * bonuses.mining
            * supply_penalty,
        shipbuilding: (BASE_SERVICE_QUALITY + colony.installations.shipyard as f64 * 0.2)
            * staffing_ratio
            * supply_penalty,
        storage_capacity: BASE_STORAGE_CAPACITY
            + colony.installations.storage as f64 * STORAGE_CAPACITY_PER_INSTALLATION,
        staffing_ratio,
    }
}

// ---------------------------------------------------------------------------
// Colony existence checks
// ---------------------------------------------------------------------------

pub fn has_colony(body_name: &str, state: &State) -> bool {
    state.colonies.contains_key(body_name) || (state.colonies.is_empty() && body_name == "Earth")
}

// ---------------------------------------------------------------------------
// Affordability checks
// ---------------------------------------------------------------------------

pub fn can_afford_construction(
    colony: &ColonyState,
    installation_id: &ColonyInstallationId,
) -> bool {
    let def = match get_construction_def(installation_id) {
        Some(d) => d,
        None => return false,
    };
    for (resource_id, amount) in def.resource_cost {
        if colony
            .stockpile
            .resources
            .get(*resource_id)
            .copied()
            .unwrap_or(0.0)
            < *amount
        {
            return false;
        }
    }
    true
}

pub fn can_afford_production(colony: &ColonyState, item_id: &str) -> bool {
    let def = match get_production_def(item_id) {
        Some(d) => d,
        None => return true,
    };
    for (resource_id, amount) in def.resource_cost {
        if colony
            .stockpile
            .resources
            .get(*resource_id)
            .copied()
            .unwrap_or(0.0)
            < *amount
        {
            return false;
        }
    }
    true
}

fn deduct_construction_resources(colony: &mut ColonyState, def: &ConstructionDef) {
    for (resource_id, amount) in def.resource_cost {
        let entry = colony
            .stockpile
            .resources
            .entry(resource_id.to_string())
            .or_insert(0.0);
        *entry -= amount;
    }
}

// ---------------------------------------------------------------------------
// Body distance helper (mirrors bodyDistanceAU in TS)
// ---------------------------------------------------------------------------

fn body_distance_au(body: &BodyEntry, _state: &State) -> f64 {
    if body.data.distance > 0.0 && !body.is_moon {
        return body.data.distance;
    }
    let [x, y, z] = body.position;
    let world_r = (x as f64).hypot(y as f64).hypot(z as f64);
    (world_r / DIST_SCALE).powi(2)
}

// ---------------------------------------------------------------------------
// Service quality for ships
// ---------------------------------------------------------------------------

/// Get repair/overhaul service quality for a ship based on its orbit location.
pub fn get_service_quality_for_ship(ship: &crate::state::BodyEntry, state: &State) -> f64 {
    let host = ship.host_planet_name.as_deref().unwrap_or("");
    if let Some(colony) = state.colonies.get(host) {
        let q = compute_colony_qualities(colony, state);
        q.repair.max(0.1)
    } else {
        // Fall back to a baseline quality when no colony exists
        0.5_f64.max(0.1)
    }
}

/// Get refueling quality for a ship based on its orbit location.
pub fn get_refuel_quality_for_ship(ship: &crate::state::BodyEntry, state: &State) -> f64 {
    let host = ship.host_planet_name.as_deref().unwrap_or("");
    if let Some(colony) = state.colonies.get(host) {
        let q = compute_colony_qualities(colony, state);
        q.refuel.max(0.1)
    } else {
        0.5_f64.max(0.1)
    }
}

// ---------------------------------------------------------------------------
// Nearest colony for a ship
// ---------------------------------------------------------------------------

/// Find the nearest colony body entry for a ship BodyEntry.
pub fn get_nearest_colony_for_ship_entry<'a>(
    ship: &crate::state::BodyEntry,
    state: &'a State,
) -> Option<&'a BodyEntry> {
    let host_name = ship.host_planet_name.as_deref().unwrap_or("");

    // Resolve host AU
    let host_au = {
        let (body, found) = find_body(host_name, state);
        if found {
            body.map(|b| body_distance_au(b, state)).unwrap_or(-1.0)
        } else {
            let (ast, ast_found) = find_asteroid_entity(host_name, state);
            if ast_found {
                ast.map(|a| a.asteroid.au).unwrap_or(-1.0)
            } else {
                -1.0
            }
        }
    };

    if host_au < 0.0 {
        return None;
    }

    if state.colonies.is_empty() {
        // No colonies seeded yet — return Earth if it exists
        let (earth, found) = find_body("Earth", state);
        if found {
            return earth;
        }
        return None;
    }

    let mut best: Option<&BodyEntry> = None;
    let mut best_dist = f64::INFINITY;

    for body_name in state.colonies.keys() {
        let (body, found) = find_body(body_name, state);
        if !found {
            continue;
        }
        if let Some(b) = body {
            let dist = (body_distance_au(b, state) - host_au).abs();
            if dist < best_dist {
                best_dist = dist;
                best = Some(b);
            }
        }
    }

    best
}

// ---------------------------------------------------------------------------
// Fuel refinery output (pure calculation)
// ---------------------------------------------------------------------------

pub fn compute_fuel_refinery_output(
    refinery_count: u32,
    construction_quality: f64,
    fuel_burn_multiplier: f64,
    sim_dt_days: f64,
) -> f64 {
    (BASE_REFINERY_RATE * refinery_count as f64 * construction_quality * sim_dt_days)
        / fuel_burn_multiplier
}

// ---------------------------------------------------------------------------
// Research progress (pure calculation)
// ---------------------------------------------------------------------------

pub struct ResearchProgressResult {
    pub rp_gain: f64,
    pub experience_gain: f64,
    pub bonus_growth: f64,
}

pub fn compute_research_progress(
    effective_labs: f64,
    research_quality: f64,
    category_multiplier: f64,
    difficulty: f64,
    sim_dt_days: f64,
) -> ResearchProgressResult {
    let rp_gain =
        BASE_RESEARCH_RATE * effective_labs * research_quality * category_multiplier * sim_dt_days;
    let experience_gain = sim_dt_days * difficulty;
    let bonus_growth = sim_dt_days * difficulty * CATEGORY_GROWTH_RATE;
    ResearchProgressResult {
        rp_gain,
        experience_gain,
        bonus_growth,
    }
}

// ---------------------------------------------------------------------------
// Academy training output (pure calculation)
// ---------------------------------------------------------------------------

pub fn compute_academy_progress(
    academy_count: u32,
    training_quality: f64,
    sim_dt_days: f64,
) -> f64 {
    ACADEMY_BASE_RATE * academy_count as f64 * training_quality * sim_dt_days
}

// ---------------------------------------------------------------------------
// Stockpile helpers
// ---------------------------------------------------------------------------

pub fn add_colony_stock(body_name: &str, resource_id: &str, amount: f64, state: &mut State) {
    if amount <= 0.0 {
        return;
    }
    if let Some(colony) = state.colonies.get_mut(body_name) {
        let entry = colony
            .stockpile
            .resources
            .entry(resource_id.to_string())
            .or_insert(0.0);
        *entry += amount;
    }
}

pub fn consume_colony_fuel(body_name: &str, amount_kg: f64, state: &mut State) -> f64 {
    if amount_kg <= 0.0 {
        return 0.0;
    }
    if let Some(colony) = state.colonies.get_mut(body_name) {
        let consumed = colony.stockpile.fuel_kg.min(amount_kg);
        colony.stockpile.fuel_kg -= consumed;
        return consumed;
    }
    // No colony — if no colonies at all and this is Earth, unlimited supply (legacy)
    if state.colonies.is_empty() && body_name == "Earth" {
        return amount_kg;
    }
    0.0
}

pub fn consume_colony_supplies(body_name: &str, amount: f64, state: &mut State) -> f64 {
    if amount <= 0.0 {
        return 0.0;
    }
    if let Some(colony) = state.colonies.get_mut(body_name) {
        let consumed = colony.stockpile.supplies.min(amount);
        colony.stockpile.supplies -= consumed;
        return consumed;
    }
    if state.colonies.is_empty() && body_name == "Earth" {
        return amount;
    }
    0.0
}

pub fn get_colony_resource_stock(body_name: &str, resource_id: &str, state: &State) -> f64 {
    state
        .colonies
        .get(body_name)
        .and_then(|c| c.stockpile.resources.get(resource_id).copied())
        .unwrap_or(0.0)
}

// ---------------------------------------------------------------------------
// Public helper API (used by tests and external callers)
// ---------------------------------------------------------------------------

/// Return all scientists stationed at a colony body.
pub fn get_scientists_at_colony<'a>(
    state: &'a State,
    body_name: &str,
) -> Vec<&'a crate::state::ScientistEntry> {
    state
        .scientists
        .values()
        .filter(|s| s.colony_body_name == body_name)
        .collect()
}

/// Set the number of labs assigned to a scientist.
/// Returns `true` on success, `false` if scientist not found or labs > admin_cap.
pub fn set_scientist_labs(state: &mut State, scientist_id: &str, labs: u32) -> bool {
    if let Some(scientist) = state.scientists.get_mut(scientist_id) {
        if labs > scientist.admin_cap {
            return false;
        }
        scientist.assigned_labs = labs;
        return true;
    }
    false
}

/// Queue a research project for a scientist. Creates the project in
/// `state.research_projects` if it does not already exist, assigns the
/// scientist as lead, and activates it.
/// Returns `true` on success.
pub fn queue_research_project_for_scientist(
    state: &mut State,
    scientist_id: &str,
    tech_id: &str,
) -> bool {
    let colony_name = match state.scientists.get(scientist_id) {
        Some(s) => s.colony_body_name.clone(),
        None => return false,
    };

    // Ensure a project entry exists
    let project = state
        .research_projects
        .entry(tech_id.to_string())
        .or_insert_with(|| crate::state::ResearchProjectEntry {
            tech_id: tech_id.to_string(),
            colony_body_name: colony_name.clone(),
            lead_scientist_id: None,
            assigned_labs: 0,
            progress_rp: 0.0,
            paused: false,
            queued_at: state.sim_time_days,
            started_at: state.sim_time_days,
            difficulty: 1.0,
        });

    project.lead_scientist_id = Some(scientist_id.to_string());
    project.colony_body_name = colony_name.clone();
    project.paused = false;

    if let Some(scientist) = state.scientists.get_mut(scientist_id) {
        scientist.active_project_tech_id = Some(tech_id.to_string());
    }

    true
}

/// Add a construction project to a colony.
pub fn add_construction_project(
    state: &mut State,
    body_name: &str,
    installation_id: ColonyInstallationId,
    quantity: u32,
    allocation_pct: f64,
) {
    if let Some(colony) = state.colonies.get_mut(body_name) {
        let id = format!(
            "proj-{}-{}-{}",
            body_name,
            quantity,
            colony.construction_projects.len()
        );
        colony
            .construction_projects
            .push(drift_types::ColonyConstructionProject {
                id,
                installation_id,
                quantity_remaining: quantity as f64,
                total_quantity: quantity as f64,
                allocation_pct,
                progress_bp: 0.0,
                paused: false,
            });
    }
}

/// Add a production project to a colony.
pub fn add_production_project(
    colony: &mut ColonyState,
    item_id: &str,
    quantity: u32,
    allocation_pct: f64,
) {
    let id = format!(
        "prod-{}-{}-{}",
        item_id,
        quantity,
        colony.production_projects.len()
    );
    colony
        .production_projects
        .push(drift_types::ColonyProductionProject {
            id,
            item_id: item_id.to_string(),
            quantity_remaining: quantity as f64,
            total_quantity: quantity as f64,
            allocation_pct,
            progress_bp: 0.0,
            paused: false,
        });
}

/// Compute the BP needed to build a ship from its dry mass (1 BP per 50 kg).
fn ship_total_bp(dry_mass_kg: f64) -> f64 {
    (dry_mass_kg / 50.0).ceil()
}

/// Compute the resource cost HashMap for building a ship design.
pub fn compute_ship_resource_cost(design: &drift_types::ShipDesign) -> HashMap<String, f64> {
    let mass = design.dry_mass_kg;
    let mut cost = HashMap::new();
    cost.insert("iron".to_string(), (mass / 5.0).ceil());
    cost.insert("aluminum".to_string(), (mass / 20.0).ceil());
    cost.insert("copper".to_string(), (mass / 50.0).ceil());
    cost.insert("silicon".to_string(), (mass / 100.0).ceil());
    cost
}

/// Return the shipbuilding BP per day for a colony.
pub fn get_shipbuild_bp_per_day(colony: &ColonyState, state: &State) -> f64 {
    if colony.installations.shipyard == 0 {
        return 0.0;
    }
    let qualities = compute_colony_qualities(colony, state);
    BASE_SHIPBUILD_BP_RATE * colony.installations.shipyard as f64 * qualities.shipbuilding
}

/// Add a shipbuild project to a colony.
pub fn add_shipbuild_project(
    colony: &mut ColonyState,
    design_id: &str,
    ship_name: &str,
    designs: &HashMap<String, drift_types::ShipDesign>,
) {
    let design = match designs.get(design_id) {
        Some(d) => d,
        None => return,
    };
    let total_bp = ship_total_bp(design.dry_mass_kg);
    let resource_cost = compute_ship_resource_cost(design);
    let id = format!(
        "shipbuild-{}-{}",
        design_id,
        colony.shipbuild_projects.len()
    );
    colony
        .shipbuild_projects
        .push(drift_types::ColonyShipbuildProject {
            id,
            design_id: design_id.to_string(),
            ship_name: ship_name.to_string(),
            total_bp,
            progress_bp: 0.0,
            paused: false,
            resource_cost,
        });
}

/// Pause a shipbuild project by id.
pub fn pause_shipbuild_project(colony: &mut ColonyState, project_id: &str) {
    if let Some(proj) = colony
        .shipbuild_projects
        .iter_mut()
        .find(|p| p.id == project_id)
    {
        proj.paused = true;
    }
}

/// Cancel (remove) a shipbuild project by id.
pub fn cancel_shipbuild_project(colony: &mut ColonyState, project_id: &str) {
    colony.shipbuild_projects.retain(|p| p.id != project_id);
}

/// Drain all completed shipbuilds from the warning state queue and return them.
pub fn drain_completed_shipbuilds(state: &mut State) -> Vec<crate::state::CompletedShipbuild> {
    std::mem::take(&mut state.warning_state.completed_shipbuilds)
}

/// Find the nearest colony to a given body name. Returns the colony body name.
pub fn get_nearest_colony_for_ship<'a>(state: &'a State, body_name: &str) -> Option<&'a str> {
    use crate::entities::find_body;

    let host_au = {
        let (body, found) = find_body(body_name, state);
        if found {
            body.map(|b| body_distance_au(b, state)).unwrap_or(-1.0)
        } else {
            -1.0
        }
    };

    if host_au < 0.0 {
        return None;
    }

    if state.colonies.is_empty() {
        return None;
    }

    let mut best_name: Option<&str> = None;
    let mut best_dist = f64::INFINITY;

    for colony_body_name in state.colonies.keys() {
        let (body, found) = find_body(colony_body_name, state);
        if !found {
            continue;
        }
        if let Some(b) = body {
            let dist = (body_distance_au(b, state) - host_au).abs();
            if dist < best_dist {
                best_dist = dist;
                best_name = Some(colony_body_name.as_str());
            }
        }
    }

    best_name
}

/// Assemble one flat-packed item into an installation at the colony.
/// Returns `true` if successful, `false` if no flat-pack available.
pub fn assemble_flat_pack(colony: &mut ColonyState, item_id: &str) -> bool {
    let count = colony
        .stockpile
        .flat_packed
        .get(item_id)
        .copied()
        .unwrap_or(0);
    if count == 0 {
        return false;
    }
    *colony
        .stockpile
        .flat_packed
        .entry(item_id.to_string())
        .or_insert(0) -= 1;
    // Map flat-pack item id to installation
    match item_id {
        "flat-mine" => colony.installations.automated_mine += 1,
        "flat-mass-driver" => colony.installations.mass_driver += 1,
        "flat-fuel-depot" => colony.installations.fuel_depot += 1,
        _ => {}
    }
    true
}

// ---------------------------------------------------------------------------
// Starting colony seeding
// ---------------------------------------------------------------------------

/// Seed the Earth (and fallback) starting colony.
pub fn seed_starting_colonies(state: &mut State) {
    state.colonies.clear();

    // Find Earth
    let earth_idx = state
        .body_meshes
        .iter()
        .position(|b| b.data.name == "Earth" && !b.is_ship);

    if let Some(idx) = earth_idx {
        let body_name = state.body_meshes[idx].data.name.clone();
        let habitability = 1.0; // Earth is fully habitable
        let colony = ColonyState {
            body_name: body_name.clone(),
            name: "Earth Colony".to_string(),
            population: 5_000_000_000.0,
            habitability,
            installations: ColonyInstallations {
                construction_factory: 4,
                repair_yard: 4,
                fuel_depot: 4,
                mine: 2,
                lab: 4,
                academy: 1,
                storage: 6,
                shipyard: 1,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 1,
            },
            stockpile: ColonyStockpile {
                fuel_kg: 2_000_000.0,
                supplies: 500_000_000.0,
                resources: {
                    let mut r = HashMap::new();
                    r.insert("iron".to_string(), 15_000.0);
                    r.insert("aluminum".to_string(), 8_000.0);
                    r.insert("copper".to_string(), 4_000.0);
                    r.insert("silicon".to_string(), 3_000.0);
                    r.insert("methane".to_string(), 10_000.0);
                    r
                },
                flat_packed: HashMap::new(),
            },
            research_points: 0.0,
            construction_projects: vec![],
            production_projects: vec![],
            shipbuild_projects: vec![],
            transfer_queue: vec![],
            mass_driver_target: None,
            academy_progress: 0.0,
        };
        state.colonies.insert(body_name, colony);
        return;
    }

    // Fallback: use first non-star, non-gas planet
    let fallback_idx = state.body_meshes.iter().position(|b| {
        !b.is_ship
            && b.data.body_type != "Star"
            && b.data.body_type != "gasGiant"
            && b.data.body_type != "iceGiant"
    });

    if let Some(idx) = fallback_idx {
        let body_name = state.body_meshes[idx].data.name.clone();
        let colony = ColonyState {
            body_name: body_name.clone(),
            name: format!("{} Outpost", body_name),
            population: 250_000.0,
            habitability: 0.5,
            installations: ColonyInstallations {
                construction_factory: 1,
                repair_yard: 1,
                fuel_depot: 1,
                mine: 1,
                lab: 1,
                academy: 0,
                storage: 2,
                shipyard: 0,
                automated_mine: 0,
                mass_driver: 0,
                fuel_refinery: 0,
            },
            stockpile: ColonyStockpile {
                fuel_kg: 100_000.0,
                supplies: 2_000.0,
                resources: HashMap::new(),
                flat_packed: HashMap::new(),
            },
            research_points: 0.0,
            construction_projects: vec![],
            production_projects: vec![],
            shipbuild_projects: vec![],
            transfer_queue: vec![],
            mass_driver_target: None,
            academy_progress: 0.0,
        };
        state.colonies.insert(body_name, colony);
    }
}

// ---------------------------------------------------------------------------
// Per-colony tick helpers
// ---------------------------------------------------------------------------

fn tick_supply_consumption(colony: &mut ColonyState, supply_multiplier: f64, sim_dt_days: f64) {
    let drain = compute_supply_drain(colony.population, supply_multiplier, sim_dt_days);
    colony.stockpile.supplies = (colony.stockpile.supplies - drain).max(0.0);
}

fn tick_construction(colony: &mut ColonyState, sim_dt_days: f64, qualities: &ColonyQualities) {
    let active: Vec<usize> = colony
        .construction_projects
        .iter()
        .enumerate()
        .filter(|(_, p)| !p.paused)
        .map(|(i, _)| i)
        .collect();

    if active.is_empty() || colony.installations.construction_factory == 0 {
        return;
    }

    let total_allocation: f64 = active
        .iter()
        .map(|&i| colony.construction_projects[i].allocation_pct)
        .sum();

    if total_allocation <= 0.0 {
        return;
    }

    let total_bp = BASE_CONSTRUCTION_BP_RATE
        * colony.installations.construction_factory as f64
        * qualities.construction
        * sim_dt_days;

    for &proj_idx in &active {
        let alloc = colony.construction_projects[proj_idx].allocation_pct;
        let bp_share = total_bp * (alloc / total_allocation);
        colony.construction_projects[proj_idx].progress_bp += bp_share;

        loop {
            let project = &colony.construction_projects[proj_idx];
            if project.quantity_remaining <= 0.0 {
                break;
            }
            let def = match get_construction_def(&project.installation_id) {
                Some(d) => d,
                None => break,
            };
            if colony.construction_projects[proj_idx].progress_bp < def.bp_cost {
                break;
            }
            let inst_id = colony.construction_projects[proj_idx].installation_id;
            if !can_afford_construction(colony, &inst_id) {
                break;
            }
            colony.construction_projects[proj_idx].progress_bp -= def.bp_cost;
            // Deduct resources
            let resource_cost: Vec<(String, f64)> = def
                .resource_cost
                .iter()
                .map(|(r, a)| (r.to_string(), *a))
                .collect();
            for (resource_id, amount) in &resource_cost {
                let entry = colony
                    .stockpile
                    .resources
                    .entry(resource_id.clone())
                    .or_insert(0.0);
                *entry -= amount;
            }
            colony.construction_projects[proj_idx].quantity_remaining -= 1.0;
            // Increment installation count
            match inst_id {
                ColonyInstallationId::ConstructionFactory => {
                    colony.installations.construction_factory += 1
                }
                ColonyInstallationId::RepairYard => colony.installations.repair_yard += 1,
                ColonyInstallationId::FuelDepot => colony.installations.fuel_depot += 1,
                ColonyInstallationId::Mine => colony.installations.mine += 1,
                ColonyInstallationId::Lab => colony.installations.lab += 1,
                ColonyInstallationId::Academy => colony.installations.academy += 1,
                ColonyInstallationId::Storage => colony.installations.storage += 1,
                ColonyInstallationId::Shipyard => colony.installations.shipyard += 1,
                ColonyInstallationId::AutomatedMine => colony.installations.automated_mine += 1,
                ColonyInstallationId::MassDriver => colony.installations.mass_driver += 1,
                ColonyInstallationId::FuelRefinery => colony.installations.fuel_refinery += 1,
            }
        }
    }

    colony
        .construction_projects
        .retain(|p| p.quantity_remaining > 0.0);
}

fn tick_production(colony: &mut ColonyState, sim_dt_days: f64, qualities: &ColonyQualities) {
    let active_indices: Vec<usize> = colony
        .production_projects
        .iter()
        .enumerate()
        .filter(|(_, p)| !p.paused)
        .map(|(i, _)| i)
        .collect();

    if active_indices.is_empty() || colony.installations.construction_factory == 0 {
        return;
    }

    let total_allocation: f64 = active_indices
        .iter()
        .map(|&i| colony.production_projects[i].allocation_pct)
        .sum();

    if total_allocation <= 0.0 {
        return;
    }

    let total_bp = BASE_CONSTRUCTION_BP_RATE
        * colony.installations.construction_factory as f64
        * qualities.construction
        * sim_dt_days;

    for &proj_idx in &active_indices {
        let alloc = colony.production_projects[proj_idx].allocation_pct;
        let bp_share = total_bp * (alloc / total_allocation);
        colony.production_projects[proj_idx].progress_bp += bp_share;

        loop {
            let project = &colony.production_projects[proj_idx];
            if project.quantity_remaining <= 0.0 {
                break;
            }
            let item_id = project.item_id.clone();
            let def = match get_production_def(&item_id) {
                Some(d) => d,
                None => break,
            };
            if colony.production_projects[proj_idx].progress_bp < def.bp_cost {
                break;
            }
            if !can_afford_production(colony, &item_id) {
                break;
            }
            colony.production_projects[proj_idx].progress_bp -= def.bp_cost;
            // Deduct resources
            let resource_cost: Vec<(String, f64)> = def
                .resource_cost
                .iter()
                .map(|(r, a)| (r.to_string(), *a))
                .collect();
            for (resource_id, amount) in &resource_cost {
                let entry = colony
                    .stockpile
                    .resources
                    .entry(resource_id.clone())
                    .or_insert(0.0);
                *entry -= amount;
            }
            // Add to flat_packed
            let fp_entry = colony
                .stockpile
                .flat_packed
                .entry(item_id.clone())
                .or_insert(0);
            *fp_entry += 1;
            colony.production_projects[proj_idx].quantity_remaining -= 1.0;
        }
    }

    colony
        .production_projects
        .retain(|p| p.quantity_remaining > 0.0);
}

fn tick_shipbuilding(
    colony: &mut ColonyState,
    sim_dt_days: f64,
    qualities: &ColonyQualities,
    completed_shipbuilds: &mut Vec<CompletedShipbuild>,
) {
    if colony.shipbuild_projects.is_empty() || colony.installations.shipyard == 0 {
        return;
    }

    let proj_idx = match colony.shipbuild_projects.iter().position(|p| !p.paused) {
        Some(i) => i,
        None => return,
    };

    let bp_gain = BASE_SHIPBUILD_BP_RATE
        * colony.installations.shipyard as f64
        * qualities.shipbuilding
        * sim_dt_days;

    colony.shipbuild_projects[proj_idx].progress_bp += bp_gain;

    let total_bp = colony.shipbuild_projects[proj_idx].total_bp;
    if colony.shipbuild_projects[proj_idx].progress_bp >= total_bp {
        // Check resources
        let resource_cost: Vec<(String, f64)> = colony.shipbuild_projects[proj_idx]
            .resource_cost
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect();

        for (resource_id, amount) in &resource_cost {
            if colony
                .stockpile
                .resources
                .get(resource_id)
                .copied()
                .unwrap_or(0.0)
                < *amount
            {
                // Stall: cap progress at total_bp
                colony.shipbuild_projects[proj_idx].progress_bp = total_bp;
                return;
            }
        }

        // Deduct resources
        for (resource_id, amount) in &resource_cost {
            let entry = colony
                .stockpile
                .resources
                .entry(resource_id.clone())
                .or_insert(0.0);
            *entry -= amount;
        }

        let project = colony.shipbuild_projects.remove(proj_idx);
        completed_shipbuilds.push(CompletedShipbuild {
            name: project.ship_name.clone(),
            body_name: colony.body_name.clone(),
            design_id: project.design_id.clone(),
        });
    }
}

fn tick_mining(
    colony: &mut ColonyState,
    sim_dt_days: f64,
    qualities: &ColonyQualities,
    state: &mut State,
) {
    if colony.installations.mine == 0 {
        return;
    }

    let (body_opt, found) = find_body(&colony.body_name.clone(), state);
    if !found {
        return;
    }

    let body = match body_opt {
        Some(b) => b,
        None => return,
    };

    if body.survey.survey_level == 0 {
        return;
    }

    // Collect deposit updates to apply after borrow ends
    let deposits_info: Vec<(String, f64, f64, u32)> = body
        .survey
        .deposits
        .iter()
        .map(|d| {
            (
                d.resource_id.clone(),
                d.quantity as f64,
                d.mined,
                d.min_survey_level,
            )
        })
        .collect();

    let survey_level = body.survey.survey_level;
    let mine_count = colony.installations.mine;
    let body_name = colony.body_name.clone();
    drop(body_opt);

    // Find the body index to mutate deposits
    let body_idx = match state.entity_maps.bodies.get(&body_name).copied() {
        Some(i) => i,
        None => return,
    };

    for (i, (resource_id, quantity, mined, min_survey_level)) in deposits_info.iter().enumerate() {
        let remaining = (quantity - mined).max(0.0);
        if remaining <= 0.0 || *min_survey_level > survey_level {
            continue;
        }
        let accessibility = state.body_meshes[body_idx].survey.deposits[i].accessibility;
        let amount = remaining.min(
            BASE_MINING_RATE * mine_count as f64 * qualities.mining * accessibility * sim_dt_days,
        );
        if amount <= 0.0 {
            continue;
        }
        state.body_meshes[body_idx].survey.deposits[i].mined += amount;

        // Update colony stock
        if let Some(colony) = state.colonies.get_mut(&body_name) {
            let entry = colony
                .stockpile
                .resources
                .entry(resource_id.clone())
                .or_insert(0.0);
            *entry += amount;
        }
    }
}

fn tick_automated_mining(colony: &mut ColonyState, sim_dt_days: f64, state: &mut State) {
    let count = colony.installations.automated_mine;
    if count == 0 {
        return;
    }

    let body_name = colony.body_name.clone();
    let body_idx = match state.entity_maps.bodies.get(&body_name).copied() {
        Some(i) => i,
        None => return,
    };

    let deposit_count = state.body_meshes[body_idx].survey.deposits.len();

    for i in 0..deposit_count {
        let deposit = &state.body_meshes[body_idx].survey.deposits[i];
        let remaining = (deposit.quantity as f64 - deposit.mined).max(0.0);
        if remaining <= 0.0 {
            continue;
        }
        let accessibility = deposit.accessibility;
        let resource_id = deposit.resource_id.clone();
        let amount = remaining.min(BASE_MINING_RATE * count as f64 * accessibility * sim_dt_days);
        if amount <= 0.0 {
            continue;
        }
        state.body_meshes[body_idx].survey.deposits[i].mined += amount;

        if let Some(c) = state.colonies.get_mut(&body_name) {
            let entry = c.stockpile.resources.entry(resource_id).or_insert(0.0);
            *entry += amount;
        }
    }
}

fn tick_mass_driver(colony: &mut ColonyState, sim_dt_days: f64, state: &mut State) {
    if colony.installations.mass_driver == 0 || colony.mass_driver_target.is_none() {
        return;
    }

    let target_name = match &colony.mass_driver_target {
        Some(t) => t.clone(),
        None => return,
    };

    let target_has_driver = state
        .colonies
        .get(&target_name)
        .map(|c| c.installations.mass_driver > 0)
        .unwrap_or(false);

    if !target_has_driver {
        return;
    }

    let body_name = colony.body_name.clone();
    let driver_count = colony.installations.mass_driver;
    let mut remaining = MASS_DRIVER_RATE_PER_DAY * driver_count as f64 * sim_dt_days;

    let resource_ids: Vec<String> = colony.stockpile.resources.keys().cloned().collect();

    for resource_id in resource_ids {
        if remaining <= 0.0 {
            break;
        }
        let amount = colony
            .stockpile
            .resources
            .get(&resource_id)
            .copied()
            .unwrap_or(0.0);
        if amount <= 0.0 {
            continue;
        }
        let transfer = amount.min(remaining);
        *colony
            .stockpile
            .resources
            .entry(resource_id.clone())
            .or_insert(0.0) -= transfer;
        remaining -= transfer;

        if let Some(target_colony) = state.colonies.get_mut(&target_name) {
            *target_colony
                .stockpile
                .resources
                .entry(resource_id)
                .or_insert(0.0) += transfer;
        }
    }

    // Sync back the source colony (we mutated it but state.colonies holds it separately)
    // Note: the colony passed in is the same as state.colonies entry — re-sync
    if let Some(src) = state.colonies.get_mut(&body_name) {
        *src = colony.clone();
    }
}

fn tick_fuel_refinery(
    colony: &mut ColonyState,
    sim_dt_days: f64,
    qualities: &ColonyQualities,
    fuel_burn_multiplier: f64,
) {
    if colony.installations.fuel_refinery == 0 {
        return;
    }

    let fuel_output = compute_fuel_refinery_output(
        colony.installations.fuel_refinery,
        qualities.construction,
        fuel_burn_multiplier,
        sim_dt_days,
    );
    let methane_needed = fuel_output / METHANE_TO_FUEL_RATIO;
    let methane_available = colony
        .stockpile
        .resources
        .get("methane")
        .copied()
        .unwrap_or(0.0);
    let methane_used = methane_needed.min(methane_available);
    let actual_fuel = methane_used * METHANE_TO_FUEL_RATIO;

    colony
        .stockpile
        .resources
        .insert("methane".to_string(), methane_available - methane_used);
    colony.stockpile.fuel_kg += actual_fuel;
}

fn tick_research_project(project: &mut ResearchProjectEntry, state: &mut State, sim_dt_days: f64) {
    if project.paused || project.lead_scientist_id.is_none() {
        return;
    }

    let scientist_id = project.lead_scientist_id.clone().unwrap();
    let colony_name = project.colony_body_name.clone();
    let tech_id = project.tech_id.clone();

    // Check scientist is at this colony and has this as active project
    let (effective_labs, category_multiplier, difficulty, scientist_cat) = {
        let scientist = match state.scientists.get(&scientist_id) {
            Some(s) => s,
            None => return,
        };
        if scientist.colony_body_name != colony_name {
            return;
        }
        if scientist.active_project_tech_id.as_deref() != Some(&tech_id) {
            return;
        }
        let colony = match state.colonies.get(&colony_name) {
            Some(c) => c,
            None => return,
        };
        let labs = (scientist.assigned_labs as f64)
            .min(scientist.admin_cap as f64)
            .min(colony.installations.lab as f64);
        if labs <= 0.0 {
            return;
        }

        let cat = scientist.primary_category.clone();
        let bonus = scientist.category_bonuses.get(&cat).copied().unwrap_or(0.0);
        let cat_mult = 1.0 + bonus.clamp(0.0, 0.5);

        (labs, cat_mult, project.difficulty, cat)
    };

    let colony_qualities = {
        let colony = match state.colonies.get(&colony_name) {
            Some(c) => c,
            None => return,
        };
        compute_colony_qualities(colony, state)
    };

    let progress = compute_research_progress(
        effective_labs,
        colony_qualities.research,
        category_multiplier,
        difficulty,
        sim_dt_days,
    );

    project.progress_rp += progress.rp_gain;

    // Update colony RP and scientist experience
    if let Some(colony) = state.colonies.get_mut(&colony_name) {
        colony.research_points += progress.rp_gain;
    }

    if let Some(scientist) = state.scientists.get_mut(&scientist_id) {
        let exp = scientist
            .experience_by_category
            .entry(scientist_cat.clone())
            .or_insert(0.0);
        *exp += progress.experience_gain;

        let bonus = scientist
            .category_bonuses
            .entry(scientist_cat)
            .or_insert(0.0);
        *bonus = (*bonus + progress.bonus_growth).clamp(0.0, 0.5);
    }

    // Update assigned labs on project
    project.assigned_labs = effective_labs as u32;

    // Check completion — rpCost comes from RESEARCH_DEFS
    if let Some(rp_cost) = get_research_rp_cost(&project.tech_id) {
        if project.progress_rp >= rp_cost {
            complete_research_project_by_id(&tech_id, state);
        }
    }
}

fn get_research_rp_cost(tech_id: &str) -> Option<f64> {
    // Inline rp costs from RESEARCH_DEFS in the TS source
    match tech_id {
        "survey-automation" => Some(120.0),
        "advanced-telemetry" => Some(250.0),
        "predictive-analysis" => Some(500.0),
        "deep-scan-array" => Some(1000.0),
        "mining-drills" => Some(120.0),
        "fabrication-methods" => Some(160.0),
        "advanced-metallurgy" => Some(500.0),
        "nano-manufacturing" => Some(1000.0),
        "maintenance-doctrine" => Some(140.0),
        "supply-optimization" => Some(250.0),
        "fleet-logistics" => Some(500.0),
        "rapid-refit" => Some(1000.0),
        "lab-instrumentation" => Some(150.0),
        "sensor-theory" => Some(250.0),
        "applied-physics" => Some(500.0),
        "unified-field-theory" => Some(1000.0),
        "basic-hydroponics" => Some(120.0),
        "genetic-medicine" => Some(250.0),
        "closed-cycle-life-support" => Some(250.0),
        "xenobiology" => Some(500.0),
        "terraforming" => Some(1000.0),
        "nuclear-pulse-engine" => Some(200.0),
        "ion-drive" => Some(300.0),
        "magneto-drive" => Some(500.0),
        "icf-drive" => Some(500.0),
        "mcf-drive" => Some(800.0),
        "plasma-drive" => Some(1200.0),
        "am-solid-drive" => Some(2000.0),
        "am-gas-drive" => Some(3000.0),
        "am-plasma-drive" => Some(4000.0),
        "am-beam-drive" => Some(3500.0),
        "gravity-drive" => Some(5000.0),
        "photonic-drive" => Some(8000.0),
        _ => None,
    }
}

fn complete_research_project_by_id(tech_id: &str, state: &mut State) {
    let project = match state.research_projects.remove(tech_id) {
        Some(p) => p,
        None => return,
    };

    state.researched_techs.insert(tech_id.to_string());

    // Update scientist
    if let Some(scientist_id) = &project.lead_scientist_id.clone() {
        if let Some(scientist) = state.scientists.get_mut(scientist_id) {
            if scientist.active_project_tech_id.as_deref() == Some(tech_id) {
                scientist.active_project_tech_id = None;
            }
            scientist.completed_projects.push(tech_id.to_string());
        }
    }

    // Push game log
    let sim_time = state.sim_time_days;
    state.game_log.push(drift_types::GameLogEntry {
        id: state.game_log.len() as u64 + 1,
        category: drift_types::GameLogCategory::Research,
        sim_time,
        message: format!("Research completed: {}", tech_id),
        meta: None,
    });
}

fn tick_research_for_colony(colony_name: &str, sim_dt_days: f64, state: &mut State) {
    // Collect project tech_ids for this colony to avoid borrow issues
    let tech_ids: Vec<String> = state
        .research_projects
        .values()
        .filter(|p| p.colony_body_name == colony_name && !p.paused)
        .map(|p| p.tech_id.clone())
        .collect();

    for tech_id in tech_ids {
        // Re-borrow project as mutable for each iteration
        if let Some(project) = state.research_projects.get_mut(&tech_id) {
            // Inline the per-project tick to avoid re-borrowing state
            if project.paused || project.lead_scientist_id.is_none() {
                continue;
            }

            let scientist_id = project.lead_scientist_id.clone().unwrap();
            let colony_body_name = project.colony_body_name.clone();
            let t_id = project.tech_id.clone();
            let difficulty = project.difficulty;

            // Check scientist
            let (effective_labs, category_multiplier, scientist_cat) = {
                let scientist = match state.scientists.get(&scientist_id) {
                    Some(s) => s,
                    None => continue,
                };
                if scientist.colony_body_name != colony_body_name {
                    continue;
                }
                if scientist.active_project_tech_id.as_deref() != Some(&t_id) {
                    continue;
                }
                let colony = match state.colonies.get(&colony_body_name) {
                    Some(c) => c,
                    None => continue,
                };
                let labs = (scientist.assigned_labs as f64)
                    .min(scientist.admin_cap as f64)
                    .min(colony.installations.lab as f64);
                if labs <= 0.0 {
                    continue;
                }
                let cat = scientist.primary_category.clone();
                let bonus = scientist.category_bonuses.get(&cat).copied().unwrap_or(0.0);
                let cat_mult = 1.0 + bonus.clamp(0.0, 0.5);
                (labs, cat_mult, cat)
            };

            let research_quality = {
                let colony = match state.colonies.get(&colony_body_name) {
                    Some(c) => c,
                    None => continue,
                };
                compute_colony_qualities(colony, state).research
            };

            let rp_gain = BASE_RESEARCH_RATE
                * effective_labs
                * research_quality
                * category_multiplier
                * sim_dt_days;
            let experience_gain = sim_dt_days * difficulty;
            let bonus_growth = sim_dt_days * difficulty * CATEGORY_GROWTH_RATE;

            // Apply rp gain to project
            if let Some(proj) = state.research_projects.get_mut(&t_id) {
                proj.progress_rp += rp_gain;
                proj.assigned_labs = effective_labs as u32;
            }

            // Apply rp to colony
            if let Some(colony) = state.colonies.get_mut(&colony_body_name) {
                colony.research_points += rp_gain;
            }

            // Apply experience to scientist
            if let Some(scientist) = state.scientists.get_mut(&scientist_id) {
                *scientist
                    .experience_by_category
                    .entry(scientist_cat.clone())
                    .or_insert(0.0) += experience_gain;
                let bonus = scientist
                    .category_bonuses
                    .entry(scientist_cat)
                    .or_insert(0.0);
                *bonus = (*bonus + bonus_growth).clamp(0.0, 0.5);
            }

            // Check completion
            let should_complete = {
                let proj = match state.research_projects.get(&t_id) {
                    Some(p) => p,
                    None => continue,
                };
                let rp_cost = get_research_rp_cost(&t_id).unwrap_or(f64::INFINITY);
                proj.progress_rp >= rp_cost
            };

            if should_complete {
                complete_research_project_by_id(&t_id, state);
            }
        }
    }
}

fn tick_academy_training(
    colony: &mut ColonyState,
    sim_dt_days: f64,
    qualities: &ColonyQualities,
    sim_time_days: f64,
    scientist_count: usize,
    state_scientists: &mut HashMap<String, ScientistEntry>,
    notifications: &mut Vec<crate::state::Notification>,
    next_notification_id: &mut u64,
) {
    if colony.installations.academy == 0 {
        return;
    }

    colony.academy_progress += compute_academy_progress(
        colony.installations.academy,
        qualities.training,
        sim_dt_days,
    );

    let mut sci_idx = scientist_count;
    while colony.academy_progress >= 1.0 {
        colony.academy_progress -= 1.0;

        let categories = [
            "industry",
            "survey",
            "logistics",
            "research",
            "biology",
            "propulsion",
        ];
        let primary = categories[sci_idx % categories.len()].to_string();
        let secondary = categories[(sci_idx + 1) % categories.len()].to_string();
        let id = format!("sci-{}-{}", colony.body_name, sci_idx);

        let scientist = ScientistEntry {
            id: id.clone(),
            name: format!("Scientist {}", sci_idx),
            colony_body_name: colony.body_name.clone(),
            primary_category: primary.clone(),
            secondary_category: Some(secondary),
            active_project_tech_id: None,
            project_queue: vec![],
            assigned_labs: 0,
            admin_cap: 1,
            category_bonuses: {
                let mut m = HashMap::new();
                m.insert(primary, 0.1);
                m
            },
            completed_projects: vec![],
            experience_by_category: HashMap::new(),
        };

        state_scientists.insert(id, scientist);
        sci_idx += 1;

        // Add coalesced notification (pass dummy now_ms = 0 for determinism)
        // We push directly to avoid passing full State
        if notifications.len() >= 200 {
            if let Some(read_idx) = notifications.iter().position(|n| n.read) {
                notifications.remove(read_idx);
            } else {
                notifications.remove(0);
            }
        }
        *next_notification_id += 1;
        notifications.push(crate::state::Notification {
            id: *next_notification_id,
            notification_type: "scientist-graduated".to_string(),
            message: format!("New scientist graduated at {}", colony.name),
            sim_time: sim_time_days,
            body_name: Some(colony.body_name.clone()),
            read: false,
        });
    }
}

fn route_transfer_queue(colony: &mut ColonyState, sim_time_days: f64, ships_at_body: &[String]) {
    if colony.transfer_queue.is_empty() {
        return;
    }
    let request = &colony.transfer_queue[0];
    if request.status != TransferStatus::Queued {
        return;
    }

    // Find a ship with deadhead capacity (crew >= 10, capacity floor(crew * 0.1) capped at 20)
    let ship_name = ships_at_body.iter().find(|_| true).cloned(); // simplified: any ship at body
    if let Some(name) = ship_name {
        colony.transfer_queue[0].status = TransferStatus::InTransit;
        colony.transfer_queue[0].assigned_ship_name = Some(name);
        colony.transfer_queue[0].estimated_arrival_day = Some(sim_time_days + 3.0);
    }
}

fn settle_transfers(colony: &mut ColonyState, sim_time_days: f64, state: &mut State) {
    loop {
        if colony.transfer_queue.is_empty() {
            break;
        }
        let first = &colony.transfer_queue[0];
        if first.status != TransferStatus::InTransit {
            break;
        }
        let arrival = first.estimated_arrival_day.unwrap_or(f64::INFINITY);
        if arrival > sim_time_days {
            break;
        }
        let scientist_id = first.scientist_id.clone();
        let destination = first.destination_body_name.clone();
        colony.transfer_queue.remove(0);

        if let Some(scientist) = state.scientists.get_mut(&scientist_id) {
            scientist.colony_body_name = destination;
            if let Some(tech_id) = scientist.active_project_tech_id.clone() {
                if let Some(project) = state.research_projects.get_mut(&tech_id) {
                    project.paused = true;
                    project.lead_scientist_id = None;
                }
                scientist.active_project_tech_id = None;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Colony warning checks
// ---------------------------------------------------------------------------

pub fn check_colony_warnings(state: &mut State) {
    let colony_names: Vec<String> = state.colonies.keys().cloned().collect();
    let sim_time = state.sim_time_days;
    let supply_multiplier = state.supply_multiplier;

    for colony_name in colony_names {
        let qualities = {
            let colony = match state.colonies.get(&colony_name) {
                Some(c) => c,
                None => continue,
            };
            compute_colony_qualities(colony, state)
        };

        let (
            colony_display_name,
            installations_construction_factory,
            installations_lab,
            active_construction,
            has_active_research,
            blocked_project_name,
            population,
            supplies,
            staffing_ratio,
        ) = {
            let colony = match state.colonies.get(&colony_name) {
                Some(c) => c,
                None => continue,
            };

            let active_construction = colony.construction_projects.iter().any(|p| !p.paused);

            let has_active_research = state
                .research_projects
                .values()
                .any(|p| p.colony_body_name == colony_name && !p.paused);

            let blocked_project_name = colony.construction_projects.iter().find_map(|p| {
                if p.paused {
                    return None;
                }
                let def = get_construction_def(&p.installation_id)?;
                if p.progress_bp >= def.bp_cost
                    && !can_afford_construction(colony, &p.installation_id)
                {
                    Some(p.installation_id)
                } else {
                    None
                }
            });

            (
                colony.name.clone(),
                colony.installations.construction_factory,
                colony.installations.lab,
                active_construction,
                has_active_research,
                blocked_project_name,
                colony.population,
                colony.stockpile.supplies,
                qualities.staffing_ratio,
            )
        };

        // Understaffed warning
        let key_understaffed = format!("{}:understaffed", colony_name);
        if staffing_ratio < 0.5
            && should_warn_colony(
                &key_understaffed,
                sim_time,
                &mut state.warning_state.last_warned,
            )
        {
            let pct = (staffing_ratio * 100.0).round() as u32;
            add_coalesced_notification(
                "colony-understaffed",
                &format!("{}: severe understaffing ({}%)", colony_display_name, pct),
                Some(&colony_name),
                0,
                Some(5000),
                state,
            );
        }

        // Idle factory warning
        let key_idle_factory = format!("{}:idle-factory", colony_name);
        if installations_construction_factory > 0
            && !active_construction
            && should_warn_colony(
                &key_idle_factory,
                sim_time,
                &mut state.warning_state.last_warned,
            )
        {
            add_coalesced_notification(
                "colony-idle",
                &format!("{}: construction factories idle", colony_display_name),
                Some(&colony_name),
                0,
                Some(5000),
                state,
            );
        }

        // Idle lab warning
        let key_idle_lab = format!("{}:idle-lab", colony_name);
        if installations_lab > 0
            && !has_active_research
            && should_warn_colony(
                &key_idle_lab,
                sim_time,
                &mut state.warning_state.last_warned,
            )
        {
            add_coalesced_notification(
                "colony-idle",
                &format!("{}: research labs idle", colony_display_name),
                Some(&colony_name),
                0,
                Some(5000),
                state,
            );
        }

        // Blocked construction warning
        let key_blocked = format!("{}:blocked", colony_name);
        if let Some(blocked_id) = blocked_project_name {
            if should_warn_colony(&key_blocked, sim_time, &mut state.warning_state.last_warned) {
                let installation_name = installation_id_name(&blocked_id);
                add_coalesced_notification(
                    "colony-blocked",
                    &format!(
                        "{}: {} blocked — insufficient resources",
                        colony_display_name, installation_name
                    ),
                    Some(&colony_name),
                    0,
                    Some(5000),
                    state,
                );
            }
        }

        // Low supplies warning
        let daily_drain = compute_supply_drain(population, supply_multiplier, 1.0);
        let key_low_supplies = format!("{}:low-supplies", colony_name);
        if daily_drain > 0.0
            && supplies / daily_drain < 90.0
            && should_warn_colony(
                &key_low_supplies,
                sim_time,
                &mut state.warning_state.last_warned,
            )
        {
            let days_left = (supplies / daily_drain).floor() as i64;
            add_coalesced_notification(
                "colony-low-supplies",
                &format!(
                    "{}: low supplies ({} days remaining)",
                    colony_display_name, days_left
                ),
                Some(&colony_name),
                0,
                Some(5000),
                state,
            );
        }
    }
}

fn should_warn_colony(
    key: &str,
    sim_time: f64,
    last_warned: &mut HashMap<(String, String), f64>,
) -> bool {
    // Split key on ':' to get (body, type)
    let parts: Vec<&str> = key.splitn(2, ':').collect();
    let map_key = if parts.len() == 2 {
        (parts[0].to_string(), parts[1].to_string())
    } else {
        (key.to_string(), String::new())
    };

    let last = last_warned
        .get(&map_key)
        .copied()
        .unwrap_or(f64::NEG_INFINITY);
    if sim_time - last < WARNING_INTERVAL_DAYS {
        return false;
    }
    last_warned.insert(map_key, sim_time);
    true
}

fn installation_id_name(id: &ColonyInstallationId) -> &'static str {
    match id {
        ColonyInstallationId::ConstructionFactory => "Construction Factory",
        ColonyInstallationId::RepairYard => "Repair Yard",
        ColonyInstallationId::FuelDepot => "Fuel Depot",
        ColonyInstallationId::Mine => "Mine",
        ColonyInstallationId::Lab => "Research Lab",
        ColonyInstallationId::Academy => "Academy",
        ColonyInstallationId::Storage => "Storage",
        ColonyInstallationId::Shipyard => "Shipyard",
        ColonyInstallationId::AutomatedMine => "Automated Mine",
        ColonyInstallationId::MassDriver => "Mass Driver",
        ColonyInstallationId::FuelRefinery => "Fuel Refinery",
    }
}

// ---------------------------------------------------------------------------
// Main tick entry points
// ---------------------------------------------------------------------------

/// Tick a single colony for `sim_dt_days`.
///
/// Mining and some other sub-ticks need mutable access to `state` (for deposit
/// mutation), so this function takes `&mut State` directly rather than
/// `&mut ColonyState`.
pub fn tick_colony(colony_name: &str, sim_dt_days: f64, state: &mut State) {
    // Earth fuel safety net
    if colony_name == "Earth" {
        if let Some(colony) = state.colonies.get_mut(colony_name) {
            colony.stockpile.fuel_kg += EARTH_FUEL_RESTOCK_PER_DAY * sim_dt_days;
        }
    }

    let supply_multiplier = state.supply_multiplier;
    let fuel_burn_multiplier = state.fuel_burn_multiplier;
    let sim_time_days = state.sim_time_days;

    // Supply consumption
    if let Some(colony) = state.colonies.get_mut(colony_name) {
        tick_supply_consumption(colony, supply_multiplier, sim_dt_days);
    }

    // Compute qualities (immutable borrow)
    let qualities = {
        let colony = match state.colonies.get(colony_name) {
            Some(c) => c,
            None => return,
        };
        compute_colony_qualities(colony, state)
    };

    // Construction
    if let Some(colony) = state.colonies.get_mut(colony_name) {
        tick_construction(colony, sim_dt_days, &qualities);
    }

    // Production
    if let Some(colony) = state.colonies.get_mut(colony_name) {
        tick_production(colony, sim_dt_days, &qualities);
    }

    // Shipbuilding
    {
        let mut completed = vec![];
        if let Some(colony) = state.colonies.get_mut(colony_name) {
            tick_shipbuilding(colony, sim_dt_days, &qualities, &mut completed);
        }
        state.warning_state.completed_shipbuilds.extend(completed);
    }

    // Mining (needs mutable state for deposit mutation)
    {
        // Extract what we need to call tick_mining without double-borrow
        let mine_count = state
            .colonies
            .get(colony_name)
            .map(|c| c.installations.mine)
            .unwrap_or(0);
        if mine_count > 0 {
            let body_idx = state.entity_maps.bodies.get(colony_name).copied();
            if let Some(idx) = body_idx {
                let survey_level = state.body_meshes[idx].survey.survey_level;
                if survey_level > 0 {
                    let deposit_count = state.body_meshes[idx].survey.deposits.len();
                    let mining_quality = qualities.mining;

                    for i in 0..deposit_count {
                        let deposit = &state.body_meshes[idx].survey.deposits[i];
                        let remaining = (deposit.quantity as f64 - deposit.mined).max(0.0);
                        let min_survey_level = deposit.min_survey_level;
                        let accessibility = deposit.accessibility;
                        let resource_id = deposit.resource_id.clone();

                        if remaining <= 0.0 || min_survey_level > survey_level {
                            continue;
                        }
                        let amount = remaining.min(
                            BASE_MINING_RATE
                                * mine_count as f64
                                * mining_quality
                                * accessibility
                                * sim_dt_days,
                        );
                        if amount <= 0.0 {
                            continue;
                        }
                        state.body_meshes[idx].survey.deposits[i].mined += amount;
                        if let Some(colony) = state.colonies.get_mut(colony_name) {
                            *colony.stockpile.resources.entry(resource_id).or_insert(0.0) += amount;
                        }
                    }
                }
            }
        }
    }

    // Automated mining
    {
        let auto_mine_count = state
            .colonies
            .get(colony_name)
            .map(|c| c.installations.automated_mine)
            .unwrap_or(0);
        if auto_mine_count > 0 {
            let body_idx = state.entity_maps.bodies.get(colony_name).copied();
            if let Some(idx) = body_idx {
                let deposit_count = state.body_meshes[idx].survey.deposits.len();
                for i in 0..deposit_count {
                    let deposit = &state.body_meshes[idx].survey.deposits[i];
                    let remaining = (deposit.quantity as f64 - deposit.mined).max(0.0);
                    let accessibility = deposit.accessibility;
                    let resource_id = deposit.resource_id.clone();
                    if remaining <= 0.0 {
                        continue;
                    }
                    let amount = remaining.min(
                        BASE_MINING_RATE * auto_mine_count as f64 * accessibility * sim_dt_days,
                    );
                    if amount <= 0.0 {
                        continue;
                    }
                    state.body_meshes[idx].survey.deposits[i].mined += amount;
                    if let Some(colony) = state.colonies.get_mut(colony_name) {
                        *colony.stockpile.resources.entry(resource_id).or_insert(0.0) += amount;
                    }
                }
            }
        }
    }

    // Mass driver
    {
        let (has_driver, target_name) = state
            .colonies
            .get(colony_name)
            .map(|c| {
                (
                    c.installations.mass_driver > 0,
                    c.mass_driver_target.clone(),
                )
            })
            .unwrap_or((false, None));

        if has_driver {
            if let Some(target) = target_name {
                let target_has_driver = state
                    .colonies
                    .get(&target)
                    .map(|c| c.installations.mass_driver > 0)
                    .unwrap_or(false);

                if target_has_driver {
                    let driver_count = state
                        .colonies
                        .get(colony_name)
                        .map(|c| c.installations.mass_driver)
                        .unwrap_or(0);
                    let mut remaining =
                        MASS_DRIVER_RATE_PER_DAY * driver_count as f64 * sim_dt_days;

                    let resource_ids: Vec<String> = state
                        .colonies
                        .get(colony_name)
                        .map(|c| c.stockpile.resources.keys().cloned().collect())
                        .unwrap_or_default();

                    for resource_id in resource_ids {
                        if remaining <= 0.0 {
                            break;
                        }
                        let amount = state
                            .colonies
                            .get(colony_name)
                            .and_then(|c| c.stockpile.resources.get(&resource_id).copied())
                            .unwrap_or(0.0);
                        if amount <= 0.0 {
                            continue;
                        }
                        let transfer = amount.min(remaining);
                        if let Some(src) = state.colonies.get_mut(colony_name) {
                            *src.stockpile
                                .resources
                                .entry(resource_id.clone())
                                .or_insert(0.0) -= transfer;
                        }
                        if let Some(dst) = state.colonies.get_mut(&target) {
                            *dst.stockpile.resources.entry(resource_id).or_insert(0.0) += transfer;
                        }
                        remaining -= transfer;
                    }
                }
            }
        }
    }

    // Fuel refinery
    if let Some(colony) = state.colonies.get_mut(colony_name) {
        tick_fuel_refinery(colony, sim_dt_days, &qualities, fuel_burn_multiplier);
    }

    // Research
    tick_research_for_colony(colony_name, sim_dt_days, state);

    // Academy training
    {
        let scientist_count = state.scientists.len();
        let (mut notifications_tmp, mut next_id) = {
            (
                std::mem::take(&mut state.notifications),
                state.next_notification_id,
            )
        };

        if let Some(colony) = state.colonies.get_mut(colony_name) {
            tick_academy_training(
                colony,
                sim_dt_days,
                &qualities,
                sim_time_days,
                scientist_count,
                &mut state.scientists,
                &mut notifications_tmp,
                &mut next_id,
            );
        }

        state.notifications = notifications_tmp;
        state.next_notification_id = next_id;
    }

    // Transfer queue routing
    {
        let ship_names: Vec<String> = list_ships_at_body(colony_name, state)
            .iter()
            .map(|s| s.data.name.clone())
            .collect();

        if let Some(colony) = state.colonies.get_mut(colony_name) {
            route_transfer_queue(colony, sim_time_days, &ship_names);
        }
    }

    // Settle transfers
    {
        let (colony_transfer_queue, dest_map) = {
            let colony = match state.colonies.get(colony_name) {
                Some(c) => c,
                None => return,
            };
            let queue = colony.transfer_queue.clone();
            (queue, ())
        };
        let _ = dest_map;

        // Process in-transit transfers that have arrived
        let mut to_settle: Vec<(String, String)> = vec![];
        for req in &colony_transfer_queue {
            if req.status == TransferStatus::InTransit {
                if req.estimated_arrival_day.unwrap_or(f64::INFINITY) <= sim_time_days {
                    to_settle.push((req.scientist_id.clone(), req.destination_body_name.clone()));
                }
            }
        }

        for (scientist_id, destination) in to_settle {
            if let Some(scientist) = state.scientists.get_mut(&scientist_id) {
                scientist.colony_body_name = destination;
                if let Some(tech_id) = scientist.active_project_tech_id.clone() {
                    if let Some(project) = state.research_projects.get_mut(&tech_id) {
                        project.paused = true;
                        project.lead_scientist_id = None;
                    }
                    scientist.active_project_tech_id = None;
                }
            }
        }

        // Remove settled requests from colony queue
        if let Some(colony) = state.colonies.get_mut(colony_name) {
            colony.transfer_queue.retain(|req| {
                if req.status == TransferStatus::InTransit {
                    req.estimated_arrival_day.unwrap_or(f64::INFINITY) > sim_time_days
                } else {
                    true
                }
            });
        }
    }
}

/// Tick all colonies for `sim_dt_days`.
pub fn tick_colonies(sim_dt_days: f64, state: &mut State) {
    let colony_names: Vec<String> = state.colonies.keys().cloned().collect();
    for colony_name in colony_names {
        tick_colony(&colony_name, sim_dt_days, state);
    }
    check_colony_warnings(state);
}
