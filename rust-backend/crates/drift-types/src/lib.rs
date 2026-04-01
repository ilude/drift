// Shared simulation type definitions — ported from src/types.ts
//
// Three.js / DOM / frontend-only types are intentionally omitted.
// Types already defined in drift-math are re-exported from there.
//
// This crate contains data/config types and colony/save types only.
// Runtime mesh types (BodyEntry, ShipEntry, etc.) live in drift_sim::state.

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

/// Full static body configuration — used when adding bodies to `State` (colonies, survey).
/// Mirrors the TypeScript `BodyData` type from sol-data / system-generator.
/// Type alias for `BodyDataConfig` so tests can use `BodyData` directly.
pub type BodyData = BodyDataConfig;

// ---------------------------------------------------------------------------
// Static body config types (from system-generator / sol-data output)
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
// Colony types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default, Serialize, Deserialize)]
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
    pub flat_packed: HashMap<String, u32>,
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

impl Default for ColonyConstructionProject {
    fn default() -> Self {
        ColonyConstructionProject {
            id: String::new(),
            installation_id: ColonyInstallationId::Mine,
            quantity_remaining: 0.0,
            total_quantity: 0.0,
            allocation_pct: 0.0,
            progress_bp: 0.0,
            paused: false,
        }
    }
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

impl Default for ColonyResearchProject {
    fn default() -> Self {
        ColonyResearchProject {
            tech_id: String::new(),
            colony_body_name: String::new(),
            lead_scientist_id: None,
            assigned_labs: 0,
            progress_rp: 0.0,
            paused: false,
            queued_at: 0.0,
            started_at: None,
            difficulty: 1.0,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
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

// ---------------------------------------------------------------------------
// Notification types (enum variants only — runtime Notification lives in drift_sim)
// ---------------------------------------------------------------------------

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

impl Default for ShipDesign {
    fn default() -> Self {
        ShipDesign {
            id: String::new(),
            name: String::new(),
            engine_design_id: String::new(),
            engine_count: 1,
            components: vec![],
            dry_mass_kg: 0.0,
            fuel_capacity_kg: 0.0,
            cargo_capacity_kg: 0.0,
            crew_capacity: 0,
            max_supplies: 0,
            sensor_multiplier: 1.0,
            accel_g: 0.0,
            isp_s: 0.0,
            armor_hp: 0,
        }
    }
}

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------
// SavedShip, SavedStateData, and DiscoveredSystemEntry are defined in drift_sim::state
// (they are runtime sim types, not data/config types). Use drift_sim for those.

// ---------------------------------------------------------------------------
// Ship sub-structs (used in SavedShip and drift-data)
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
// Mission orders (used in SavedShip)
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
// Survey plan (used in SavedShip)
// ---------------------------------------------------------------------------

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
// Scientist transfer (used in ColonyState)
// ---------------------------------------------------------------------------

// (ScientistTransferRequest is already defined above with TransferStatus)
