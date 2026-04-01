use drift_lua::evaluate_lua_commander;
use drift_sim::commands::CommandResult;
use serde_json::json;

fn base_ship() -> serde_json::Value {
    json!({
        "name": "Pioneer",
        "fuel_pct": 80.0,
        "morale": 90.0,
        "hull_integrity": 95.0,
        "supplies_pct": 75.0,
        "current_body": "Earth"
    })
}

// ---------------------------------------------------------------------------
// Happy-path: survey action
// ---------------------------------------------------------------------------

#[test]
fn returns_survey_action() {
    let script = r#"return { action = "survey" }"#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Survey);
}

// ---------------------------------------------------------------------------
// Conditional: refuel when fuel is low
// ---------------------------------------------------------------------------

#[test]
fn refuels_when_fuel_low() {
    let script = r#"
        if ship.fuel_pct < 30 then
            return { action = "refuel" }
        end
        return { action = "survey" }
    "#;

    let low_fuel = json!({
        "name": "Pioneer",
        "fuel_pct": 20.0,
        "morale": 90.0,
        "hull_integrity": 95.0,
        "supplies_pct": 75.0,
        "current_body": "Mars"
    });

    let result = evaluate_lua_commander(script, &low_fuel).unwrap();
    assert_eq!(result, CommandResult::Refuel);
}

#[test]
fn surveys_when_fuel_sufficient() {
    let script = r#"
        if ship.fuel_pct < 30 then
            return { action = "refuel" }
        end
        return { action = "survey" }
    "#;

    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Survey);
}

// ---------------------------------------------------------------------------
// Transfer with target
// ---------------------------------------------------------------------------

#[test]
fn returns_transfer_with_target() {
    let script = r#"return { action = "transfer", target = "Mars" }"#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(
        result,
        CommandResult::Transfer {
            target: Some("Mars".to_string())
        }
    );
}

// ---------------------------------------------------------------------------
// Nil / missing return defaults to Idle
// ---------------------------------------------------------------------------

#[test]
fn nil_return_defaults_to_idle() {
    let script = r#"return nil"#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Idle);
}

#[test]
fn missing_action_field_defaults_to_idle() {
    let script = r#"return {}"#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Idle);
}

// ---------------------------------------------------------------------------
// Sandboxing: os.execute is not accessible
// ---------------------------------------------------------------------------

#[test]
fn os_execute_is_sandboxed() {
    let script = r#"
        if os ~= nil then
            os.execute("echo bad")
        end
        return { action = "survey" }
    "#;
    // Script must either succeed (os was nil, branch skipped) or return an error —
    // either way it must NOT execute the system command.
    // The expected path: `os` is nil, branch is skipped, survey is returned.
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Survey);
}

#[test]
fn os_table_is_nil() {
    let script = r#"
        if os == nil then
            return { action = "survey" }
        end
        return { action = "idle" }
    "#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Survey);
}

#[test]
fn io_table_is_nil() {
    let script = r#"
        if io == nil then
            return { action = "survey" }
        end
        return { action = "idle" }
    "#;
    let result = evaluate_lua_commander(script, &base_ship()).unwrap();
    assert_eq!(result, CommandResult::Survey);
}

// ---------------------------------------------------------------------------
// Error handling: syntax error returns Err
// ---------------------------------------------------------------------------

#[test]
fn syntax_error_returns_err() {
    let script = r#"return { action = "#; // deliberately unclosed table
    let result = evaluate_lua_commander(script, &base_ship());
    assert!(
        result.is_err(),
        "expected Err for syntax error, got {result:?}"
    );
}

// ---------------------------------------------------------------------------
// Instruction limit: infinite loop returns Err
// ---------------------------------------------------------------------------

#[test]
fn infinite_loop_returns_err() {
    let script = r#"
        local i = 0
        while true do
            i = i + 1
        end
        return { action = "survey" }
    "#;
    let result = evaluate_lua_commander(script, &base_ship());
    assert!(
        result.is_err(),
        "expected Err for infinite loop, got {result:?}"
    );
}
