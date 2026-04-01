// Lua scripting bindings — Phase 4

use mlua::{Lua, Table, Value};
use thiserror::Error;

use drift_sim::commands::CommandResult;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

#[derive(Debug, Error)]
pub enum LuaError {
    #[error("Lua runtime error: {0}")]
    Runtime(#[from] mlua::Error),
    #[error("Script returned invalid action: {0}")]
    InvalidAction(String),
    #[error("Script did not return a table")]
    NoReturnTable,
}

pub type Result<T> = std::result::Result<T, LuaError>;

// ---------------------------------------------------------------------------
// Sandboxed Lua VM creation
// ---------------------------------------------------------------------------

/// Create a sandboxed Lua 5.4 VM.
///
/// Removes `os`, `io`, `debug`, `dofile`, and `loadfile` from globals so
/// scripts cannot perform filesystem access, process execution, or
/// introspection of the Lua internals.
fn make_sandboxed_lua() -> Result<Lua> {
    let lua = Lua::new();

    lua.globals().set("os", Value::Nil)?;
    lua.globals().set("io", Value::Nil)?;
    lua.globals().set("debug", Value::Nil)?;
    lua.globals().set("dofile", Value::Nil)?;
    lua.globals().set("loadfile", Value::Nil)?;

    Ok(lua)
}

// ---------------------------------------------------------------------------
// Ship state table builder
// ---------------------------------------------------------------------------

/// Populate a Lua table with the scalar fields from `ship_state`.
///
/// Only the keys a commander script needs are exposed; the full JSON blob is
/// not forwarded, keeping the sandbox surface minimal.
fn build_ship_table(lua: &Lua, ship_state: &serde_json::Value) -> Result<Table> {
    let t = lua.create_table()?;

    // Helper: pull an f64 field out of the JSON object (default 0.0).
    let get_f64 = |key: &str| -> f64 {
        ship_state
            .get(key)
            .and_then(serde_json::Value::as_f64)
            .unwrap_or(0.0)
    };

    // Helper: pull a string field (default empty string).
    let get_str = |key: &str| -> &str {
        ship_state
            .get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or("")
    };

    t.set("fuel_pct", get_f64("fuel_pct"))?;
    t.set("morale", get_f64("morale"))?;
    t.set("hull_integrity", get_f64("hull_integrity"))?;
    t.set("supplies_pct", get_f64("supplies_pct"))?;
    t.set("name", get_str("name"))?;
    t.set("current_body", get_str("current_body"))?;

    Ok(t)
}

// ---------------------------------------------------------------------------
// Return-value parser
// ---------------------------------------------------------------------------

/// Parse the table returned by a Lua commander script into a `CommandResult`.
///
/// Expected shape: `{ action = "survey" }` or `{ action = "transfer", target = "Mars" }`.
/// Unknown or missing actions default to `CommandResult::Idle`.
fn parse_result(ret: Value) -> Result<CommandResult> {
    let table = match ret {
        Value::Table(t) => t,
        Value::Nil => return Ok(CommandResult::Idle),
        _ => return Err(LuaError::NoReturnTable),
    };

    let action: String = match table.get::<Value>("action")? {
        Value::String(s) => s.to_str()?.to_string(),
        Value::Nil => return Ok(CommandResult::Idle),
        other => return Err(LuaError::InvalidAction(format!("{other:?}"))),
    };

    let result = match action.as_str() {
        "survey" => CommandResult::Survey,
        "transfer" => {
            let target: Option<String> = match table.get::<Value>("target")? {
                Value::String(s) => Some(s.to_str()?.to_string()),
                _ => None,
            };
            CommandResult::Transfer { target }
        }
        "refuel" => CommandResult::Refuel,
        "refuel-ship" => CommandResult::RefuelShip,
        "overhaul" => CommandResult::Overhaul,
        "major-refit" => CommandResult::MajorRefit,
        "shore-leave" => CommandResult::ShoreLeave,
        "load-cargo" => CommandResult::LoadCargo,
        "unload-cargo" => CommandResult::UnloadCargo,
        "idle" | "" => CommandResult::Idle,
        other => return Err(LuaError::InvalidAction(other.to_string())),
    };

    Ok(result)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Evaluate a Lua commander script and return a `CommandResult`.
///
/// The script is executed inside a fresh sandboxed Lua VM. It receives a
/// global `ship` table populated from `ship_state` and must return a table
/// `{ action = "..." }`. Missing or nil returns default to `CommandResult::Idle`.
///
/// Memory is limited to 1 MB. An instruction-count hook fires after 10 000
/// instructions and aborts the script, preventing infinite loops.
pub fn evaluate_lua_commander(
    script: &str,
    ship_state: &serde_json::Value,
) -> Result<CommandResult> {
    let lua = make_sandboxed_lua()?;

    // Memory limit: 1 MB.
    let _ = lua.set_memory_limit(1024 * 1024);

    // Instruction-count hook: abort after 10 000 VM instructions.
    lua.set_hook(
        mlua::HookTriggers::new().every_nth_instruction(10_000),
        |_lua, _debug| {
            Err(mlua::Error::RuntimeError(
                "instruction limit exceeded".into(),
            ))
        },
    );

    // Expose the ship state as a global `ship` table.
    let ship_table = build_ship_table(&lua, ship_state)?;
    lua.globals().set("ship", ship_table)?;

    // Execute the script and capture the return value.
    let ret: Value = lua.load(script).eval()?;

    parse_result(ret)
}
