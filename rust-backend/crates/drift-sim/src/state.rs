// Core simulation state — mirrors AppState from src/core/state.ts

use std::collections::{HashMap, HashSet};

use std::sync::Mutex;

use drift_math::game_clock::GameClock;
use drift_math::ship_design_calc::EngineDesign;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::EntityMaps;

// ---------------------------------------------------------------------------
// Types referenced by State but not defined elsewhere in this module.
// Minimal stubs — will be fleshed out as sim modules are implemented.
// ---------------------------------------------------------------------------

/// Runtime body entry for the simulation (planet, moon, ship, comet).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BodyEntry {
    pub data: BodyEntryData,
    pub position: [f32; 3],
    pub speed: f64,
    pub angle: f64,
    pub is_moon: bool,
    pub is_ship: bool,
    pub is_comet: bool,
    // Ship-specific fields
    pub ship_state: Option<String>,
    pub host_planet_name: Option<String>,
    pub fuel_kg: f64,
    pub fuel_capacity_kg: f64,
    pub dry_mass_kg: f64,
    pub engine_id: Option<String>,
    pub design_id: Option<String>,
    pub commander: Commander,
    pub survey_plan: Option<SurveyPlan>,
    pub cargo_hold: CargoHold,
    pub mission_orders: Vec<MissionStep>,
    pub mission_order_index: usize,
    pub transfer_target: Option<String>,
    pub transfer_start_time: Option<f64>,
    pub transfer_time_days: Option<f64>,
    pub transfer_fuel_total: Option<f64>,
    // Hermite spline knots
    pub p0x: Option<f64>,
    pub p0y: Option<f64>,
    pub p0z: Option<f64>,
    pub t0x: Option<f64>,
    pub t0y: Option<f64>,
    pub t0z: Option<f64>,
    pub p1x: Option<f64>,
    pub p1y: Option<f64>,
    pub p1z: Option<f64>,
    pub t1x: Option<f64>,
    pub t1y: Option<f64>,
    pub t1z: Option<f64>,
    // Ship crew/maintenance
    pub keel_date: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BodyEntryData {
    pub name: String,
    pub body_type: String,
    pub distance: f64,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
}

/// Asteroid belt runtime entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AsteroidBeltEntry {
    pub name: String,
    pub min_au: f64,
    pub max_au: f64,
    pub positions: Vec<f32>,
    pub asteroids: Vec<AsteroidEntry>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AsteroidEntry {
    pub designation: String,
    pub au: f64,
    pub diameter: f64,
    pub mass: f64,
}

/// Colony state (used in State.colonies map).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyState {
    pub body_name: String,
    pub name: String,
    pub population: f64,
    pub habitability: f64,
    pub installations: ColonyInstallations,
    pub stockpile: ColonyStockpile,
    pub research_points: f64,
    pub construction_projects: Vec<ColonyConstructionProject>,
    pub production_projects: Vec<ColonyProductionProject>,
    pub shipbuild_projects: Vec<ColonyShipbuildProject>,
    pub transfer_queue: Vec<ScientistTransferRequest>,
    pub mass_driver_target: Option<String>,
    pub academy_progress: f64,
}

/// Scientist state entry.
pub type ScientistEntry = ScientistState;

/// Research project entry.
pub type ResearchProjectEntry = ColonyResearchProject;

/// Game log entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GameLogEntry {
    pub id: u64,
    pub category: String,
    pub sim_time: f64,
    pub message: String,
}

/// Ship intent — what a ship is currently doing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ShipIntent {
    Surveying {
        target: String,
        ship_name: String,
    },
    SurveyPlan {
        targets: Vec<String>,
        ship_name: String,
    },
    Transferring {
        destination: String,
        ship_name: String,
    },
    Refueling {
        location: String,
        ship_name: String,
    },
    Overhauling {
        location: String,
        ship_name: String,
    },
    ShoreLeave {
        location: String,
        ship_name: String,
    },
    Idle {
        location: String,
        ship_name: String,
    },
    Tanking {
        target: String,
        ship_name: String,
    },
    Refitting {
        location: String,
        ship_name: String,
    },
}

/// Notification entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Notification {
    pub id: u64,
    pub notification_type: String,
    pub message: String,
    pub sim_time: f64,
    pub body_name: Option<String>,
    pub read: bool,
}

/// Notification pause configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NotificationPauseConfig {
    pub info: bool,
    pub survey_complete: bool,
    pub low_fuel: bool,
    pub malfunction: bool,
    pub ship_built: bool,
}

/// Discovered system.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiscoveredSystem {
    pub name: String,
    pub seed: Option<u64>,
}

/// Saved state data (for save/load).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SavedStateData {
    pub version: u32,
    pub sim_time: f64,
    pub current_system_key: String,
    pub random_click_count: u32,
    pub ships: Vec<SavedShip>,
    pub colonies: Vec<ColonyState>,
    pub discovered_systems: Vec<DiscoveredSystemEntry>,
    pub scientists: Vec<ScientistState>,
    pub research_projects: Vec<ColonyResearchProject>,
    pub game_log: Vec<GameLogEntry>,
    pub researched_techs: Vec<String>,
    pub engine_designs: Vec<serde_json::Value>,
    pub ship_designs: Vec<serde_json::Value>,
    pub design_counter: u32,
}

/// Saved ship data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SavedShip {
    pub name: String,
    pub host_planet_name: String,
    pub fuel_kg: f64,
    pub engine_id: String,
    pub design_id: Option<String>,
    pub ship_state: Option<String>,
    pub transfer_target: Option<String>,
    pub transfer_start_time: Option<f64>,
    pub transfer_time_days: Option<f64>,
    pub transfer_fuel_total: Option<f64>,
    pub keel_date: Option<f64>,
    pub cargo_hold: Option<CargoHold>,
    pub mission_orders: Option<Vec<MissionStep>>,
    pub mission_order_index: Option<usize>,
    pub survey_plan: Option<SurveyPlan>,
    // Hermite spline knots
    pub p0x: Option<f64>,
    pub p0y: Option<f64>,
    pub p0z: Option<f64>,
    pub t0x: Option<f64>,
    pub t0y: Option<f64>,
    pub t0z: Option<f64>,
    pub p1x: Option<f64>,
    pub p1y: Option<f64>,
    pub p1z: Option<f64>,
    pub t1x: Option<f64>,
    pub t1y: Option<f64>,
    pub t1z: Option<f64>,
}

// ---------------------------------------------------------------------------
// Sim-local types not in drift-types (needed by colonies, cargo, commands)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SurveyPlan {
    pub targets: Vec<String>,
    pub accel_g: f64,
    pub return_fuel_kg: f64,
}

/// Cargo hold: maps item_id → quantity (resources: kg, flat-packed: count).
pub type CargoHold = HashMap<String, f64>;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MissionStep {
    pub id: String,
    pub step_type: String,
    pub item_id: Option<String>,
    pub quantity: Option<f64>,
    pub target: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Commander {
    pub caution: f64,
    pub initiative: f64,
    pub experience: f64,
}

// ---------------------------------------------------------------------------
// Colony types (sim-local, flat_packed uses u32 counts in cargo tests)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyInstallations {
    pub construction_factory: u32,
    pub repair_yard: u32,
    pub fuel_depot: u32,
    pub mine: u32,
    pub lab: u32,
    pub academy: u32,
    pub storage: u32,
    pub shipyard: u32,
    pub automated_mine: u32,
    pub mass_driver: u32,
    pub fuel_refinery: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyStockpile {
    pub fuel_kg: f64,
    pub supplies: f64,
    pub resources: HashMap<String, f64>,
    pub flat_packed: HashMap<String, u32>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyConstructionProject {
    pub id: String,
    pub installation_id: ColonyInstallationId,
    pub quantity_remaining: f64,
    pub total_quantity: f64,
    pub allocation_pct: f64,
    pub progress_bp: f64,
    pub paused: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyProductionProject {
    pub id: String,
    pub item_id: String,
    pub quantity_remaining: f64,
    pub total_quantity: f64,
    pub allocation_pct: f64,
    pub progress_bp: f64,
    pub paused: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyShipbuildProject {
    pub id: String,
    pub design_id: String,
    pub ship_name: String,
    pub total_bp: f64,
    pub progress_bp: f64,
    pub paused: bool,
    pub resource_cost: HashMap<String, f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ColonyInstallationId {
    #[default]
    Mine,
    ConstructionFactory,
    RepairYard,
    FuelDepot,
    Lab,
    Academy,
    Storage,
    Shipyard,
    AutomatedMine,
    MassDriver,
    FuelRefinery,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScientistTransferRequest {
    pub id: String,
    pub scientist_id: String,
    pub origin_body_name: String,
    pub destination_body_name: String,
    pub requested_at: f64,
    pub status: String,
    pub estimated_arrival_day: Option<f64>,
    pub assigned_ship_name: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ScientistState {
    pub id: String,
    pub name: String,
    pub colony_body_name: String,
    pub primary_category: String,
    pub secondary_category: String,
    pub active_project_tech_id: Option<String>,
    pub project_queue: Vec<String>,
    pub assigned_labs: u32,
    pub admin_cap: f64,
    pub category_bonuses: HashMap<String, f64>,
    pub completed_projects: Vec<String>,
    pub experience_by_category: HashMap<String, f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ColonyResearchProject {
    pub tech_id: String,
    pub colony_body_name: String,
    pub lead_scientist_id: Option<String>,
    pub assigned_labs: u32,
    pub progress_rp: f64,
    pub paused: bool,
    pub queued_at: f64,
    pub started_at: Option<f64>,
    pub difficulty: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CompletedShipbuild {
    pub name: String,
    pub body_name: String,
    pub design_id: String,
}

#[derive(Debug, Clone, Default)]
pub struct ColonyWarningState {
    pub last_warned: HashMap<(String, String), f64>,
    pub completed_shipbuilds: Vec<CompletedShipbuild>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DiscoveredSystemEntry {
    pub name: String,
    pub seed: u64,
}

// ---------------------------------------------------------------------------
// SimDateTime
// ---------------------------------------------------------------------------

/// Full date/time decomposition (year, month, day, hour, minute, second).
#[derive(Debug, Clone, Default)]
pub struct SimDateTime {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub second: u32,
}

// ---------------------------------------------------------------------------
// ShipEntry (used by cargo/commands tests)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShipEntry {
    pub name: String,
    pub position: [f32; 3],
    pub is_ship: bool,
    pub ship_state: String,
    pub host_planet_name: String,
    pub fuel_kg: f64,
    pub fuel_capacity_kg: f64,
    pub dry_mass_kg: f64,
    pub engine_id: Option<String>,
    pub design_id: Option<String>,
    pub commander: Commander,
    pub survey_plan: Option<SurveyPlan>,
    pub cargo_hold: CargoHold,
    pub mission_orders: Vec<MissionStep>,
    pub mission_order_index: usize,
}

impl Default for ShipEntry {
    fn default() -> Self {
        ShipEntry {
            name: String::new(),
            position: [0.0, 0.0, 0.0],
            is_ship: true,
            ship_state: "orbiting".to_string(),
            host_planet_name: String::new(),
            fuel_kg: 0.0,
            fuel_capacity_kg: 0.0,
            dry_mass_kg: 0.0,
            engine_id: None,
            design_id: None,
            commander: Commander::default(),
            survey_plan: None,
            cargo_hold: CargoHold::new(),
            mission_orders: vec![],
            mission_order_index: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// SimShipDesign (sim-local)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SimShipDesign {
    pub id: String,
    pub name: String,
    pub engine_design_id: String,
    pub engine_count: u32,
    pub dry_mass_kg: f64,
    pub fuel_capacity_kg: f64,
    pub cargo_capacity_kg: f64,
    pub crew_capacity: u32,
    pub max_supplies: u32,
    pub sensor_multiplier: f64,
    pub accel_g: f64,
    pub isp_s: f64,
    pub armor_hp: u32,
}

// ---------------------------------------------------------------------------
// Main simulation state
// ---------------------------------------------------------------------------

/// Central game state. Uses drift-types for body/belt/notification types so
/// that test helpers constructing `drift_types::BodyEntry` etc. work directly.
#[derive(Debug, Default)]
pub struct State {
    // Bodies (planets, moons, ships, comets) — uses drift_types::BodyEntry
    pub body_meshes: Vec<BodyEntry>,
    pub asteroid_belts: Vec<AsteroidBeltEntry>,

    // Entity lookup maps (rebuilt via rebuild_entity_maps)
    pub(crate) entity_maps: EntityMaps,

    // Colony data (uses drift_types::ColonyState for save/restore round-trips)
    pub colonies: HashMap<String, ColonyState>,
    pub scientists: HashMap<String, ScientistEntry>,
    pub research_projects: HashMap<String, ResearchProjectEntry>,
    pub researched_techs: HashSet<String>,
    pub game_log: Vec<GameLogEntry>,

    // Ship / engine designs
    pub ship_designs: HashMap<String, SimShipDesign>,
    pub engine_designs: HashMap<String, EngineDesign>,

    // Intents — uses drift_types::ShipIntent
    pub ship_intents: HashMap<String, ShipIntent>,

    // Time
    pub sim_time: GameClock,

    // Game settings
    pub time_speed: f64,
    pub survey_multiplier: f64,
    pub repair_multiplier: f64,
    pub refuel_multiplier: f64,
    pub morale_multiplier: f64,
    pub supply_multiplier: f64,
    pub fuel_burn_multiplier: f64,

    // System
    pub current_system_key: String,
    pub random_click_count: u32,
    pub discovered_systems: HashMap<String, DiscoveredSystem>,

    // Notifications — uses drift_types::Notification and NotificationPauseConfig
    pub notifications: Vec<Notification>,
    pub notification_pause_config: NotificationPauseConfig,
    pub next_notification_id: u64,

    // Warning state (per-colony rate-limiting)
    #[allow(dead_code)]
    pub(crate) warning_state: ColonyWarningState,
}

pub type SimState = State;

impl State {
    pub fn new() -> Self {
        State::default()
    }

    pub fn rebuild_entity_maps(&mut self) {
        crate::entities::rebuild_entity_maps(self);
    }

    pub fn find_ship_mut(&mut self, name: &str) -> Option<&mut BodyEntry> {
        self.body_meshes
            .iter_mut()
            .find(|e| e.is_ship && e.data.name == name)
    }
}

// ---------------------------------------------------------------------------
// simTimeToDate
// ---------------------------------------------------------------------------

pub fn sim_time_to_date(sim_time: f64) -> SimDateTime {
    const SECONDS_PER_DAY: f64 = 86_400.0;
    const SIM_EPOCH_UNIX_DAYS: i64 = 24_856;

    let whole_days = sim_time.floor() as i64;
    let frac = sim_time - whole_days as f64;
    let sub_seconds = frac * SECONDS_PER_DAY;

    let hour = (sub_seconds / 3_600.0).floor() as u32;
    let remaining = sub_seconds - (hour as f64 * 3_600.0);
    let minute = (remaining / 60.0).floor() as u32;
    let second = (remaining - (minute as f64 * 60.0)).floor() as u32;

    let unix_days = SIM_EPOCH_UNIX_DAYS + whole_days;
    let (year, month, day) = unix_days_to_ymd(unix_days);

    SimDateTime {
        year,
        month,
        day,
        hour,
        minute,
        second,
    }
}

fn unix_days_to_ymd(unix_days: i64) -> (i32, u32, u32) {
    let z = unix_days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m as u32, d as u32)
}

// ---------------------------------------------------------------------------
// truncateDate
// ---------------------------------------------------------------------------

pub fn truncate_date(d: &mut SimDateTime, speed_days_per_second: f64) {
    let speed = speed_days_per_second;
    if speed >= 30.0 {
        d.day = 1;
        d.hour = 0;
        d.minute = 0;
        d.second = 0;
    } else if speed >= 8.0 / 24.0 {
        // >= 8 hours/sec → day level: zero h/m/s
        d.hour = 0;
        d.minute = 0;
        d.second = 0;
    } else if speed >= 1.0 / 24.0 {
        // >= 1 hour/sec → hour level: zero m/s
        d.minute = 0;
        d.second = 0;
    } else if speed >= 1.0 / 1440.0 {
        // >= 1 minute/sec → minute level: zero seconds
        d.second = 0;
    }
    // else: full precision
}

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

pub fn format_date_time(d: &SimDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
        d.year, d.month, d.day, d.hour, d.minute, d.second
    )
}

// ---------------------------------------------------------------------------
// speedLabel
// ---------------------------------------------------------------------------

pub fn speed_label(speed: f64) -> String {
    if speed == 0.0 {
        return "Paused".to_string();
    }
    if speed < 1.0 {
        let hours = (speed * 24.0).round() as u32;
        return format!("{} hrs / sec", hours);
    }
    if speed < 30.0 {
        let days = speed.round() as u32;
        if days == 1 {
            return "1 day / sec".to_string();
        }
        return format!("{} days / sec", days);
    }
    let months = (speed / 30.0).round() as u32;
    if months == 1 {
        return "1 month / sec".to_string();
    }
    format!("{} months / sec", months)
}

// ---------------------------------------------------------------------------
// Save / load (in-memory, no localStorage)
// ---------------------------------------------------------------------------

static SAVE_SLOT: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StateSave {
    version: u32,
    sim_time: f64,
    current_system_key: String,
    random_click_count: u32,
    discovered_systems: Vec<DiscoveredSystemSaveEntry>,
    ships: Vec<SavedShip>,
    colonies: Vec<ColonyState>,
    scientists: Vec<ScientistEntry>,
    research_projects: Vec<ResearchProjectEntry>,
    game_log: Vec<GameLogEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DiscoveredSystemSaveEntry {
    key: String,
    name: String,
    seed: u64,
}

const SAVE_VERSION: u32 = 10;

pub fn save_state(state: &State) {
    let ships: Vec<SavedShip> = state
        .body_meshes
        .iter()
        .filter(|b| b.is_ship)
        .map(body_entry_to_saved_ship)
        .collect();

    let discovered: Vec<DiscoveredSystemSaveEntry> = state
        .discovered_systems
        .iter()
        .filter(|(k, _)| k.as_str() != "sol")
        .map(|(k, v)| DiscoveredSystemSaveEntry {
            key: k.clone(),
            name: v.name.clone(),
            seed: v.seed.unwrap_or(0),
        })
        .collect();

    let colonies: Vec<ColonyState> = state.colonies.values().cloned().collect();
    let scientists: Vec<ScientistEntry> = state.scientists.values().cloned().collect();
    let research_projects: Vec<ResearchProjectEntry> =
        state.research_projects.values().cloned().collect();

    let snap = StateSave {
        version: SAVE_VERSION,
        sim_time: state.sim_time.days(),
        current_system_key: state.current_system_key.clone(),
        random_click_count: state.random_click_count,
        discovered_systems: discovered,
        ships,
        colonies,
        scientists,
        research_projects,
        game_log: state.game_log.clone(),
    };

    if let Ok(json) = serde_json::to_string(&snap) {
        if let Ok(mut slot) = SAVE_SLOT.lock() {
            *slot = Some(json);
        }
    }
}

fn body_entry_to_saved_ship(b: &BodyEntry) -> SavedShip {
    let is_transferring = b.ship_state.as_deref() == Some("transferring");
    SavedShip {
        name: b.data.name.clone(),
        host_planet_name: b.host_planet_name.clone().unwrap_or_default(),
        fuel_kg: b.fuel_kg,
        engine_id: b.engine_id.clone().unwrap_or_default(),
        design_id: b.design_id.clone(),
        ship_state: if is_transferring {
            b.ship_state.clone()
        } else {
            None
        },
        transfer_target: if is_transferring {
            b.transfer_target.clone()
        } else {
            None
        },
        transfer_start_time: if is_transferring {
            b.transfer_start_time
        } else {
            None
        },
        transfer_time_days: if is_transferring {
            b.transfer_time_days
        } else {
            None
        },
        transfer_fuel_total: if is_transferring {
            b.transfer_fuel_total
        } else {
            None
        },
        p0x: if is_transferring { b.p0x } else { None },
        p0y: if is_transferring { b.p0y } else { None },
        p0z: if is_transferring { b.p0z } else { None },
        t0x: if is_transferring { b.t0x } else { None },
        t0y: if is_transferring { b.t0y } else { None },
        t0z: if is_transferring { b.t0z } else { None },
        p1x: if is_transferring { b.p1x } else { None },
        p1y: if is_transferring { b.p1y } else { None },
        p1z: if is_transferring { b.p1z } else { None },
        t1x: if is_transferring { b.t1x } else { None },
        t1y: if is_transferring { b.t1y } else { None },
        t1z: if is_transferring { b.t1z } else { None },
        ..Default::default()
    }
}

pub fn load_saved_state() -> Option<SavedStateData> {
    let slot = SAVE_SLOT.lock().ok()?;
    let json = slot.as_deref()?;
    load_saved_state_from_json(json)
}

pub fn load_saved_state_from_json(json: &str) -> Option<SavedStateData> {
    let v: Value = serde_json::from_str(json).ok()?;
    let version = v.get("version").and_then(|x| x.as_u64()).unwrap_or(0) as u32;

    if version <= 3 {
        return migrate_v3(&v);
    }

    let snap: StateSave = serde_json::from_value(v).ok()?;
    Some(state_save_to_saved_state_data(snap))
}

fn state_save_to_saved_state_data(snap: StateSave) -> SavedStateData {
    let discovered: Vec<DiscoveredSystemEntry> = snap
        .discovered_systems
        .into_iter()
        .map(|d| DiscoveredSystemEntry {
            name: d.name,
            seed: d.seed,
        })
        .collect();

    SavedStateData {
        version: snap.version,
        sim_time: snap.sim_time,
        current_system_key: snap.current_system_key,
        random_click_count: snap.random_click_count,
        discovered_systems: discovered,
        ships: snap.ships,
        colonies: snap.colonies,
        scientists: snap.scientists,
        research_projects: snap.research_projects,
        game_log: snap.game_log,
        ..Default::default()
    }
}

fn migrate_v3(v: &Value) -> Option<SavedStateData> {
    let ship_val = v.get("ship")?;
    let fuel_kg = ship_val
        .get("fuelKg")
        .and_then(|x| x.as_f64())
        .unwrap_or(0.0);
    let engine_id = ship_val
        .get("engineId")
        .and_then(|x| x.as_str())
        .unwrap_or("conventional")
        .to_string();

    let ship = SavedShip {
        name: "ISS Explorer".to_string(),
        host_planet_name: "Earth".to_string(),
        fuel_kg,
        engine_id,
        ..Default::default()
    };

    Some(SavedStateData {
        version: SAVE_VERSION,
        sim_time: v.get("simTime").and_then(|x| x.as_f64()).unwrap_or(0.0),
        current_system_key: v
            .get("currentSystemKey")
            .and_then(|x| x.as_str())
            .unwrap_or("sol")
            .to_string(),
        ships: vec![ship],
        ..Default::default()
    })
}

// ---------------------------------------------------------------------------
// restore_ship_state
// ---------------------------------------------------------------------------

pub fn restore_ship_state(saved: &SavedStateData, state: &mut State) {
    for saved_ship in &saved.ships {
        if let Some(body) = state
            .body_meshes
            .iter_mut()
            .find(|b| b.is_ship && b.data.name == saved_ship.name)
        {
            body.fuel_kg = saved_ship.fuel_kg;
            body.engine_id = Some(saved_ship.engine_id.clone());
            body.design_id = saved_ship.design_id.clone();
            body.host_planet_name = Some(saved_ship.host_planet_name.clone());
            body.ship_state = saved_ship.ship_state.clone();
            body.transfer_target = saved_ship.transfer_target.clone();
            body.transfer_start_time = saved_ship.transfer_start_time;
            body.transfer_time_days = saved_ship.transfer_time_days;
            body.transfer_fuel_total = saved_ship.transfer_fuel_total;
            body.p0x = saved_ship.p0x;
            body.p0y = saved_ship.p0y;
            body.p0z = saved_ship.p0z;
            body.t0x = saved_ship.t0x;
            body.t0y = saved_ship.t0y;
            body.t0z = saved_ship.t0z;
            body.p1x = saved_ship.p1x;
            body.p1y = saved_ship.p1y;
            body.p1z = saved_ship.p1z;
            body.t1x = saved_ship.t1x;
            body.t1y = saved_ship.t1y;
            body.t1z = saved_ship.t1z;
        }
    }
}

// ---------------------------------------------------------------------------
// restore_colony_state
// ---------------------------------------------------------------------------

pub fn restore_colony_state(saved: &SavedStateData, state: &mut State) {
    state.colonies.clear();
    for colony in &saved.colonies {
        state
            .colonies
            .insert(colony.body_name.clone(), colony.clone());
    }

    state.scientists.clear();
    for sci in &saved.scientists {
        state.scientists.insert(sci.id.clone(), sci.clone());
    }

    state.research_projects.clear();
    for proj in &saved.research_projects {
        state
            .research_projects
            .insert(proj.tech_id.clone(), proj.clone());
    }
}
