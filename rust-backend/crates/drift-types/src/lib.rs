// Shared simulation type definitions — ported from src/types.ts
//
// Three.js / DOM / frontend-only types are intentionally omitted.
// Types already defined in drift-math are re-exported from there.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Re-exports from drift-math
// ---------------------------------------------------------------------------

pub use drift_math::orbit::PlanetCategory;
pub use drift_math::ship_design_calc::{EngineDesign, ShipDesignComponent};
pub use drift_math::ship_physics::ShipPhysicsState;

// ---------------------------------------------------------------------------
// Resource types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResourceCategory {
    Metal,
    Volatile,
    Industrial,
    Radioactive,
    Umbral,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceDeposit {
    pub resource_id: String,
    pub quantity: u64,
    pub accessibility: f64,
    pub mined: f64,
    pub min_survey_level: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemResourceBudget {
    pub richness: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyState {
    pub survey_level: u32,
    pub deposits: Vec<ResourceDeposit>,
    #[serde(default)]
    pub survey_duration: f64,
    #[serde(default)]
    pub survey_progress: f64,
}

// ---------------------------------------------------------------------------
// Static body config types (input data from sol-data / system-generator)
// These use typed enums and full metadata fields.
// ---------------------------------------------------------------------------

/// Body type discriminant matching the TypeScript string literals.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum BodyType {
    #[default]
    Star,
    Planet,
    #[serde(rename = "Dwarf Planet")]
    DwarfPlanet,
    Centaur,
    Asteroid,
    Moon,
    Comet,
    Ship,
}

impl BodyType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BodyType::Star => "Star",
            BodyType::Planet => "Planet",
            BodyType::DwarfPlanet => "Dwarf Planet",
            BodyType::Centaur => "Centaur",
            BodyType::Asteroid => "Asteroid",
            BodyType::Moon => "Moon",
            BodyType::Comet => "Comet",
            BodyType::Ship => "Ship",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoonData {
    pub name: String,
    pub distance: f64,
    pub e: f64,
    pub period: f64,
    pub radius: f64,
    pub mass: f64,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RingData {
    pub inner: f64,
    pub outer: f64,
    pub color: Option<String>,
    pub opacity: Option<f64>,
    pub tilt: Option<f64>,
}

/// Full static body configuration from sol-data / system-generator.
/// Used when adding bodies to the simulation via `State::add_body`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct BodyDataConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub body_type: BodyType,
    pub distance: f64,
    pub e: f64,
    pub period: f64,
    pub radius: f64,
    pub mass: f64,
    pub color: String,
    pub emissive: Option<bool>,
    pub moons: Vec<MoonData>,
    pub rings: Option<RingData>,
    #[serde(rename = "_radiusEarths")]
    pub radius_earths: Option<f64>,
    #[serde(rename = "_category")]
    pub category: Option<PlanetCategory>,
    #[serde(rename = "_isDwarf")]
    pub is_dwarf: Option<bool>,
    #[serde(rename = "_isDetached")]
    pub is_detached: Option<bool>,
}

// ---------------------------------------------------------------------------
// Runtime body / mesh types (used by sim engine at runtime)
// ---------------------------------------------------------------------------

/// Simplified runtime body descriptor stored inside a BodyEntry.
/// Uses `body_type` as a plain string ("Planet", "Star", "Ship", "Comet", etc.)
/// to match the runtime mesh representation from the TypeScript frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeBodyData {
    pub name: String,
    pub body_type: String,
    pub distance: f64,
    pub mass: f64,
    pub radius: f64,
    pub color: String,
}

/// Full static body configuration — used when adding bodies to `State` (colonies, survey).
/// Mirrors the TypeScript `BodyData` type from sol-data / system-generator.
/// Type alias for `BodyDataConfig` so tests can use `BodyData` directly.
pub type BodyData = BodyDataConfig;

/// Cargo hold: maps item_id → quantity (resources in kg, flat-packed as count f64).
pub type CargoHold = HashMap<String, f64>;

/// Runtime mesh entry for a body or ship in the simulation.
/// Mirrors the TypeScript BodyEntry / ShipEntry objects.
/// Uses RuntimeBodyData for the inner `data` field (String-based body_type).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyEntry {
    pub data: RuntimeBodyData,
    pub position: [f32; 3],
    pub speed: f32,
    pub is_moon: bool,
    pub is_ship: bool,
    pub is_comet: bool,
    pub survey: SurveyState,
    pub moons: Vec<String>,
    // Ship-specific fields (only populated when is_ship = true)
    pub name: String,
    pub fuel_kg: f64,
    pub fuel_capacity_kg: f64,
    pub dry_mass_kg: f64,
    pub engine_id: Option<String>,
    pub design_id: Option<String>,
    pub ship_state: Option<String>,
    pub host_planet_name: Option<String>,
    pub commander: Commander,
    pub survey_plan: Option<SurveyPlan>,
    pub cargo_hold: CargoHold,
    pub mission_orders: Vec<MissionStep>,
    pub mission_order_index: usize,
    // Transfer / Hermite spline state
    pub transfer_target: Option<String>,
    pub transfer_start_time: Option<f64>,
    pub transfer_time_days: Option<f64>,
    pub transfer_fuel_total: Option<f64>,
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

impl BodyEntry {
    /// Convert a ShipEntry into a BodyEntry for use in body_meshes.
    pub fn from_ship(ship: ShipEntry) -> Self {
        BodyEntry {
            data: RuntimeBodyData {
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

// ---------------------------------------------------------------------------
// Asteroid belt runtime types
// ---------------------------------------------------------------------------

/// Asteroid belt descriptor used in runtime state.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct AsteroidEntry {
    pub designation: String,
    pub au: f64,
    pub period: f64,
    pub diameter: f64,
    pub mass: f64,
    pub belt_index: usize,
    pub survey: SurveyState,
}

/// Runtime belt entry: belt descriptor + flat position buffer + asteroid list.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsteroidBeltEntry {
    pub belt: BeltDef,
    /// Flat [x, y, z, x, y, z, …] position buffer (f32).
    pub positions: Vec<f32>,
    pub count: usize,
    pub asteroids: Vec<AsteroidEntry>,
}

// ---------------------------------------------------------------------------
// Resolved entity (result of entity lookup)
// ---------------------------------------------------------------------------

/// Result of an asteroid belt lookup.
#[derive(Debug, Clone)]
pub struct AsteroidHit {
    pub belt_index: usize,
    pub asteroid_index: usize,
    pub asteroid: AsteroidEntry,
}

/// Resolved entity returned by `resolve_entity`.
#[derive(Debug, Clone)]
pub struct ResolvedEntity {
    pub name: String,
    pub body_type: String,
    pub position: [f32; 3],
    pub is_moon: bool,
    pub body_entry: Option<BodyEntry>,
    pub asteroid_hit: Option<AsteroidHit>,
}

// ---------------------------------------------------------------------------
// Static body config types (from system-generator / sol-data output)
// These remain separate from the runtime BodyData / BodyEntry types above.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CometData {
    pub name: String,
    pub a: f64,
    pub e: f64,
    pub period: f64,
    pub inc: f64,
    pub node: f64,
    pub peri: f64,
    pub color: String,
    pub mass: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsteroidBeltData {
    pub name: String,
    pub min_au: f64,
    pub max_au: f64,
    pub count: u32,
    pub color: String,
    pub size: f64,
    pub max_inc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AsteroidInfo {
    pub designation: String,
    pub au: f64,
    pub period: f64,
    pub diameter: f64,
    pub mass: f64,
    pub belt_index: Option<u32>,
    pub survey: SurveyState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemData {
    pub name: String,
    pub resource_budget: Option<SystemResourceBudget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredSystem {
    pub name: String,
    pub seed: u64,
    pub system_data: Option<SystemData>,
}

// ---------------------------------------------------------------------------
// Ship state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ShipState {
    Orbiting,
    Transferring,
}

// ---------------------------------------------------------------------------
// Command tree
// ---------------------------------------------------------------------------

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum CommandCondition {
    Always,
    FuelBelow { threshold: f64 },
    MoraleBelow { threshold: f64 },
    HullBelow { threshold: f64 },
    SuppliesBelow { threshold: f64 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandOrigin {
    Class,
    Fleet,
    Ship,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandEntry {
    pub id: String,
    pub command: CommandType,
    pub condition: CommandCondition,
    pub target: Option<String>,
    pub enabled: bool,
    pub origin: CommandOrigin,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandTree {
    pub entries: Vec<CommandEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandResultAction {
    Transfer,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub action: CommandResultAction,
    pub target: Option<String>,
}

// ---------------------------------------------------------------------------
// Mission orders
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MissionStepType {
    LoadCargo,
    UnloadCargo,
    TransferTo,
    Repeat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissionStep {
    pub id: String,
    #[serde(rename = "type")]
    pub step_type: MissionStepType,
    pub target: Option<String>,
    pub item_id: Option<String>,
    pub quantity: Option<f64>,
}

// ---------------------------------------------------------------------------
// Ship intents
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum ShipIntent {
    Surveying {
        target: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    #[serde(rename = "survey-plan")]
    SurveyPlan {
        targets: Vec<String>,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Transferring {
        destination: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Refueling {
        location: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Overhauling {
        location: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    #[serde(rename = "shore-leave")]
    ShoreLeave {
        location: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Idle {
        location: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Tanking {
        target: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
    Refitting {
        location: String,
        #[serde(rename = "shipName")]
        ship_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyPlan {
    pub targets: Vec<String>,
    pub accel_g: f64,
    pub return_fuel_kg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyCandidate {
    pub name: String,
    pub dist_sq: f64,
    pub x: f64,
    pub z: f64,
}

// ---------------------------------------------------------------------------
// Ship sub-structs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShipCrew {
    pub count: u32,
    pub morale: f64,
    pub last_shore_leave: f64,
    pub deployment_limit: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Commander {
    pub caution: f64,
    pub initiative: f64,
    pub experience: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShipAction {
    #[serde(rename = "type")]
    pub action_type: Option<CommandType>,
    pub command_id: Option<String>,
    pub target: Option<String>,
    pub start_time: f64,
    pub duration: f64,
    pub progress: f64,
}

// ---------------------------------------------------------------------------
// Colony types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ColonyInstallationId {
    ConstructionFactory,
    RepairYard,
    FuelDepot,
    Mine,
    Lab,
    Academy,
    Storage,
    Shipyard,
    AutomatedMine,
    MassDriver,
    FuelRefinery,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct ColonyStockpile {
    pub fuel_kg: f64,
    pub supplies: f64,
    pub resources: HashMap<String, f64>,
    pub flat_packed: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyProductionProject {
    pub id: String,
    pub item_id: String,
    pub quantity_remaining: f64,
    pub total_quantity: f64,
    pub allocation_pct: f64,
    pub progress_bp: f64,
    pub paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyShipbuildProject {
    pub id: String,
    pub design_id: String,
    pub ship_name: String,
    pub total_bp: f64,
    pub progress_bp: f64,
    pub paused: bool,
    pub resource_cost: HashMap<String, f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyWorkforce {
    pub total_population: f64,
    pub workforce_ratio: f64,
    pub habitability: f64,
    pub available_workers: f64,
    pub used_workers: f64,
    pub staffing_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColonyQualities {
    pub construction: f64,
    pub repair: f64,
    pub refuel: f64,
    pub research: f64,
    pub training: f64,
    pub mining: f64,
    pub shipbuilding: f64,
    pub storage_capacity: f64,
    pub staffing_ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

/// Serializable scientist entry used in save data (secondary_category is optional).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScientistEntry {
    pub id: String,
    pub name: String,
    pub colony_body_name: String,
    pub primary_category: String,
    pub secondary_category: Option<String>,
    pub active_project_tech_id: Option<String>,
    pub project_queue: Vec<String>,
    pub assigned_labs: u32,
    pub admin_cap: u32,
    pub category_bonuses: HashMap<String, f64>,
    pub completed_projects: Vec<String>,
    pub experience_by_category: HashMap<String, f64>,
}

/// Serializable research project entry used in save data.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResearchProjectEntry {
    pub tech_id: String,
    pub colony_body_name: String,
    pub lead_scientist_id: Option<String>,
    pub assigned_labs: u32,
    pub progress_rp: f64,
    pub paused: bool,
    pub queued_at: f64,
    pub started_at: f64,
    pub difficulty: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TransferStatus {
    Queued,
    InTransit,
    Complete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScientistTransferRequest {
    pub id: String,
    pub scientist_id: String,
    pub origin_body_name: String,
    pub destination_body_name: String,
    pub requested_at: f64,
    pub status: TransferStatus,
    pub estimated_arrival_day: Option<f64>,
    pub assigned_ship_name: Option<String>,
}

// ---------------------------------------------------------------------------
// Notification types
// ---------------------------------------------------------------------------

/// Pause configuration: which notification types trigger sim pause.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

/// Runtime notification stored in State.notifications.
/// Uses String for notification_type to avoid enum dependency in hot paths.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Notification {
    pub id: u64,
    pub notification_type: String,
    pub message: String,
    pub sim_time: f64,
    pub body_name: Option<String>,
    pub read: bool,
    /// Wall-clock ms at time of creation (for coalescing).
    pub created_at_ms: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum NotificationType {
    Info,
    SurveyComplete,
    LowFuel,
    LowMorale,
    MaintenanceNeeded,
    MissionComplete,
    Malfunction,
    ShipDestroyed,
    TransferComplete,
    ActionComplete,
    ColonyUnderstaffed,
    ColonyIdle,
    ColonyBlocked,
    ColonyLowSupplies,
    ShipBuilt,
    ScientistGraduated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameNotification {
    pub id: u64,
    #[serde(rename = "type")]
    pub notification_type: NotificationType,
    pub message: String,
    pub sim_time: f64,
    pub body_name: Option<String>,
    pub read: bool,
}

// ---------------------------------------------------------------------------
// Game log
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GameLogCategory {
    Research,
    Colony,
    Logistics,
    Ship,
    System,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameLogEntry {
    pub id: u64,
    pub category: GameLogCategory,
    pub sim_time: f64,
    pub message: String,
    pub meta: Option<HashMap<String, serde_json::Value>>,
}

// ---------------------------------------------------------------------------
// Design types (weapon / sensor designs not in drift-math)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WeaponType {
    Laser,
    Railgun,
    ParticleBeam,
    Gauss,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissileDesign {
    pub id: String,
    pub name: String,
    pub size_hs: f64,
    pub warhead_strength: f64,
    pub engine_power: f64,
    pub agility: f64,
    pub fuel_capacity: f64,
    pub sensor_strength: f64,
    pub speed: f64,
    pub range: f64,
    pub damage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurretDesign {
    pub id: String,
    pub name: String,
    pub weapon_type: WeaponType,
    pub caliber: f64,
    pub tracking_speed: f64,
    pub damage: f64,
    pub range: f64,
    pub rate_of_fire: f64,
    pub size_hs: f64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SensorType {
    Geological,
    Gravitational,
    Active,
    PassiveThermal,
    PassiveEm,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SensorDesign {
    pub id: String,
    pub name: String,
    pub sensor_type: SensorType,
    pub resolution: f64,
    pub size_hs: f64,
    pub range: f64,
    pub strength: f64,
}

/// Full ship design (mirrors ShipDesign in TS, extends EngineDesign from drift-math).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShipDesign {
    pub id: String,
    pub name: String,
    pub engine_design_id: String,
    pub engine_count: u32,
    pub components: Vec<ShipDesignComponent>,
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
// Save data
// ---------------------------------------------------------------------------

/// Per-ship save record used in SavedStateData.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedShip {
    pub name: String,
    pub host_planet_name: String,
    pub fuel_kg: f64,
    pub engine_id: Option<String>,
    pub design_id: Option<String>,
    pub crew: Option<ShipCrew>,
    pub commander: Option<Commander>,
    pub maintenance: Option<ShipMaintenance>,
    pub command_tree: Option<CommandTree>,
    pub keel_date: Option<f64>,
    // Transfer state — only present if ship was transferring
    pub ship_state: Option<String>,
    pub transfer_target: Option<String>,
    pub transfer_start_time: Option<f64>,
    pub transfer_time_days: Option<f64>,
    pub transfer_fuel_total: Option<f64>,
    // Cargo logistics
    pub cargo_hold: Option<HashMap<String, f64>>,
    pub mission_orders: Option<Vec<MissionStep>>,
    pub mission_order_index: Option<u32>,
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
    pub survey_plan: Option<SurveyPlan>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredSystemEntry {
    pub key: String,
    pub name: String,
    pub seed: u64,
}

/// Top-level save data structure.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedStateData {
    pub version: u32,
    pub sim_time: f64,
    pub current_system_key: String,
    pub random_click_count: u32,
    pub discovered_systems: Vec<DiscoveredSystemEntry>,
    pub ships: Vec<SavedShip>,
    pub colonies: Vec<ColonyState>,
    pub scientists: Vec<ScientistEntry>,
    pub research_projects: Vec<ResearchProjectEntry>,
    pub game_log: Vec<GameLogEntry>,
    pub researched_techs: Vec<String>,
    pub engine_designs: Vec<EngineDesign>,
    pub ship_designs: Vec<ShipDesign>,
    pub missile_designs: Vec<MissileDesign>,
    pub turret_designs: Vec<TurretDesign>,
    pub sensor_designs: Vec<SensorDesign>,
    pub design_counter: u32,
}
