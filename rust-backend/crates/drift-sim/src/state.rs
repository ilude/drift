// Core simulation state — mirrors AppState from src/core/state.ts

use std::collections::{HashMap, HashSet};

use std::sync::Mutex;

use drift_math::game_clock::GameClock;
use drift_math::ship_design_calc::EngineDesign;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::entities::EntityMaps;

// Re-export drift_types colony/state types so downstream callers can import via drift_sim::state.
pub use drift_types::{
    ColonyConstructionProject, ColonyInstallationId, ColonyInstallations, ColonyProductionProject,
    ColonyResearchProject, ColonyShipbuildProject, ColonyState, ColonyStockpile, DiscoveredSystem,
    ScientistState, ScientistTransferRequest, SurveyState, TransferStatus,
};

// ---------------------------------------------------------------------------
// Types referenced by State but not defined elsewhere in this module.
// ---------------------------------------------------------------------------

/// Minimal runtime body data descriptor stored inside a BodyEntry.
/// Uses body_type as a plain string ("Planet", "Star", "Ship", "Comet", etc.)
/// to match the runtime mesh representation from the TypeScript frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BodyEntryData {
    pub name: String,
    pub body_type: String,
    pub distance: f64,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
}

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
    pub moons: Vec<String>,
    pub survey: SurveyState,
    // Ship-specific fields
    pub name: String,
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

impl BodyEntry {
    /// Convert a ShipEntry into a BodyEntry for use in body_meshes.
    pub fn from_ship(ship: ShipEntry) -> Self {
        BodyEntry {
            data: BodyEntryData {
                name: ship.name.clone(),
                body_type: "Ship".to_string(),
                distance: 0.0,
                mass: ship.dry_mass_kg,
                radius: 0.0,
                color: "#fff".to_string(),
            },
            position: ship.position,
            is_ship: true,
            name: ship.name,
            fuel_kg: ship.fuel_kg,
            fuel_capacity_kg: ship.fuel_capacity_kg,
            dry_mass_kg: ship.dry_mass_kg,
            engine_id: ship.engine_id,
            design_id: ship.design_id,
            ship_state: Some(ship.ship_state),
            host_planet_name: Some(ship.host_planet_name),
            commander: ship.commander,
            survey_plan: ship.survey_plan,
            cargo_hold: ship.cargo_hold,
            mission_orders: ship.mission_orders,
            mission_order_index: ship.mission_order_index,
            ..Default::default()
        }
    }
}

/// Belt definition for asteroid belts.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BeltDef {
    pub name: String,
    pub min_au: f64,
    pub max_au: f64,
    pub count: usize,
    pub color: String,
    pub size: f64,
    pub max_inc: f64,
}

/// A single asteroid within a belt.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AsteroidEntry {
    pub designation: String,
    pub au: f64,
    pub period: f64,
    pub diameter: f64,
    pub mass: f64,
    pub belt_index: usize,
    pub survey: SurveyState,
}

/// Asteroid belt runtime entry: belt descriptor + flat position buffer + asteroid list.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AsteroidBeltEntry {
    pub belt: BeltDef,
    /// Flat [x, y, z, x, y, z, …] position buffer (f32).
    pub positions: Vec<f32>,
    pub count: usize,
    pub asteroids: Vec<AsteroidEntry>,
}

/// Cargo hold: maps item_id → quantity (resources in kg, flat-packed as count f64).
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

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SurveyPlan {
    pub targets: Vec<String>,
    pub accel_g: f64,
    pub return_fuel_kg: f64,
}

/// Ship entry as used by cargo / survey planner modules.
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: u64,
    pub notification_type: String,
    pub message: String,
    pub sim_time: f64,
    pub body_name: Option<String>,
    pub read: bool,
}

impl Default for Notification {
    fn default() -> Self {
        Notification {
            id: 0,
            notification_type: "info".to_string(),
            message: String::new(),
            sim_time: 0.0,
            body_name: None,
            read: false,
        }
    }
}

/// Notification pause configuration.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NotificationPauseConfig {
    pub info: bool,
    pub survey_complete: bool,
    pub low_fuel: bool,
    pub low_morale: bool,
    pub maintenance_needed: bool,
    pub mission_complete: bool,
    pub malfunction: bool,
    pub ship_destroyed: bool,
    pub transfer_complete: bool,
    pub action_complete: bool,
    pub colony_understaffed: bool,
    pub colony_idle: bool,
    pub colony_blocked: bool,
    pub colony_low_supplies: bool,
    pub ship_built: bool,
    pub scientist_graduated: bool,
}

// DiscoveredSystem is re-exported from drift_types above.

/// Saved state data (for save/load).
/// Uses drift_types::ScientistEntry and ResearchProjectEntry for the serializable save formats.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedStateData {
    #[serde(default)]
    pub version: u32,
    #[serde(default)]
    pub sim_time: f64,
    #[serde(default)]
    pub current_system_key: String,
    #[serde(default)]
    pub random_click_count: u32,
    #[serde(default)]
    pub ships: Vec<SavedShip>,
    #[serde(default)]
    pub colonies: Vec<ColonyState>,
    #[serde(default)]
    pub discovered_systems: Vec<DiscoveredSystemEntry>,
    #[serde(default)]
    pub scientists: Vec<drift_types::ScientistEntry>,
    #[serde(default)]
    pub research_projects: Vec<drift_types::ResearchProjectEntry>,
    #[serde(default)]
    pub game_log: Vec<GameLogEntry>,
    #[serde(default)]
    pub researched_techs: Vec<String>,
    #[serde(default)]
    pub engine_designs: Vec<serde_json::Value>,
    #[serde(default)]
    pub ship_designs: Vec<serde_json::Value>,
    #[serde(default)]
    pub design_counter: u32,
}

/// Saved ship data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedShip {
    pub name: String,
    pub host_planet_name: String,
    pub fuel_kg: f64,
    pub engine_id: Option<String>,
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

/// Game log entry — re-exported from drift_types so colony code can push typed entries.
pub use drift_types::GameLogEntry;

// ---------------------------------------------------------------------------
// Type aliases for drift_types types used by State
// ---------------------------------------------------------------------------

// Save-data scientist and research-project types (serializable forms from drift_types).
pub use drift_types::ResearchProjectEntry;
pub use drift_types::ScientistEntry;

// ---------------------------------------------------------------------------
// Sim-internal types
// ---------------------------------------------------------------------------

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
    pub key: String,
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

/// Central game state.
#[derive(Debug, Default)]
pub struct State {
    pub body_meshes: Vec<BodyEntry>,
    pub asteroid_belts: Vec<AsteroidBeltEntry>,

    pub(crate) entity_maps: EntityMaps,

    pub colonies: HashMap<String, ColonyState>,
    pub scientists: HashMap<String, ScientistEntry>,
    pub research_projects: HashMap<String, ResearchProjectEntry>,
    pub researched_techs: HashSet<String>,
    pub game_log: Vec<GameLogEntry>,

    pub ship_designs: HashMap<String, drift_types::ShipDesign>,
    pub engine_designs: HashMap<String, EngineDesign>,

    pub ship_intents: HashMap<String, ShipIntent>,

    pub sim_time: GameClock,
    /// Sim time in fractional days — kept in sync with `sim_time` and directly
    /// writable so colony warning rate-limiting can advance it in tests.
    pub sim_time_days: f64,

    pub time_speed: f64,
    pub survey_multiplier: f64,
    pub repair_multiplier: f64,
    pub refuel_multiplier: f64,
    pub morale_multiplier: f64,
    pub supply_multiplier: f64,
    pub fuel_burn_multiplier: f64,

    pub current_system_key: String,
    pub random_click_count: u32,
    pub discovered_systems: HashMap<String, DiscoveredSystem>,

    pub notifications: Vec<Notification>,
    pub notification_pause_config: NotificationPauseConfig,
    pub next_notification_id: u64,

    pub warning_state: ColonyWarningState,
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

    /// Add a body (planet/star/moon/comet) to the simulation with an optional
    /// survey state. The body is appended to `body_meshes`. Call
    /// `rebuild_entity_maps()` after all bodies are added.
    pub fn add_body(
        &mut self,
        data: drift_types::BodyData,
        survey: Option<drift_types::SurveyState>,
    ) {
        use crate::state::{BodyEntry, BodyEntryData};
        let survey = survey.unwrap_or_default();
        let body_type = data.body_type.as_str().to_string();
        let entry = BodyEntry {
            data: BodyEntryData {
                name: data.name.clone(),
                body_type,
                distance: data.distance,
                mass: data.mass,
                radius: data.radius,
                color: data.color.clone(),
            },
            survey,
            ..Default::default()
        };
        self.body_meshes.push(entry);
    }

    /// Return a mutable slice of deposits for the named body's survey state.
    /// Returns an empty slice if the body is not found.
    pub fn get_body_deposits(&self, body_name: &str) -> &[drift_types::ResourceDeposit] {
        self.body_meshes
            .iter()
            .find(|b| b.data.name == body_name)
            .map(|b| b.survey.deposits.as_slice())
            .unwrap_or(&[])
    }

    /// Reset the colony warning rate-limiter so warnings can fire again
    /// immediately.  Called by tests after advancing `sim_time_days`.
    pub fn reset_colony_warning_state(&mut self) {
        self.warning_state.last_warned.clear();
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
        d.hour = 0;
        d.minute = 0;
        d.second = 0;
    } else if speed >= 1.0 / 24.0 {
        d.minute = 0;
        d.second = 0;
    } else if speed >= 1.0 / 1440.0 {
        d.second = 0;
    }
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
    #[serde(default)]
    discovered_systems: Vec<DiscoveredSystemSaveEntry>,
    #[serde(default)]
    ships: Vec<SavedShip>,
    #[serde(default)]
    colonies: Vec<ColonyState>,
    #[serde(default)]
    scientists: Vec<ScientistEntry>,
    #[serde(default)]
    research_projects: Vec<ResearchProjectEntry>,
    #[serde(default)]
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
            seed: v.seed,
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
        engine_id: b.engine_id.clone(),
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
            key: d.key,
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
        engine_id: Some(engine_id),
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
            body.engine_id = saved_ship.engine_id.clone();
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
