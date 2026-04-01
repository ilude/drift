// Simulation engine — ported from src/core/
pub mod cargo;
#[allow(
    dead_code,
    clippy::too_many_arguments,
    clippy::collapsible_if,
    dropping_copy_types,
    clippy::let_unit_value
)]
pub mod colonies;
pub mod commander;
pub mod commands;
pub mod entities;
pub mod intents;
pub mod notifications;
pub mod ship_utils;
pub mod state;
pub mod survey_planner;
pub mod tick;
pub mod transfers;

// Re-export runtime types so tests can import them from drift_sim directly.
pub use state::{
    AsteroidBeltEntry, AsteroidEntry, BeltDef, BodyEntry, BodyEntryData, CargoHold, Commander,
    DiscoveredSystemEntry, GameLogEntry, MissionStep, Notification, NotificationPauseConfig,
    SavedShip, SavedStateData, ShipEntry, ShipIntent, SimShipDesign, SimState, State, SurveyPlan,
};
// DiscoveredSystem is re-exported via state, also expose it at the crate root.
pub use drift_types::DiscoveredSystem;
// Colony/scientist types are re-exported through state, also expose them from the crate root.
pub use drift_types::{
    ColonyConstructionProject, ColonyInstallationId, ColonyInstallations, ColonyProductionProject,
    ColonyResearchProject, ColonyShipbuildProject, ColonyState, ColonyStockpile, ScientistState,
    ScientistTransferRequest, SurveyState, TransferStatus,
};
