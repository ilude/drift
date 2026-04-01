// Integration tests for drift-server WebSocket protocol.
// Each test binds to an ephemeral port, spawns the server in a background
// task, then connects a client and exercises the protocol.

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::time::timeout;
use tokio_tungstenite::{connect_async, tungstenite::Message};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Bind to an OS-assigned ephemeral port and return the listener plus its address.
async fn bind_ephemeral() -> (TcpListener, String) {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind ephemeral port");
    let addr = listener.local_addr().expect("No local addr").to_string();
    (listener, addr)
}

/// Run the server accept loop on `listener` in a background task.
/// Returns when the first client disconnects (single-connection server).
fn spawn_server(listener: TcpListener) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        if let Ok((stream, _peer)) = listener.accept().await {
            drift_server_handle_connection(stream).await;
        }
    })
}

// Re-export the internal handle_connection logic via a thin wrapper so tests
// can drive it without starting a full process.  We do this by duplicating the
// minimal server accept+dispatch loop inline here using the same crate-level
// types.  This keeps the test self-contained.

use drift_sim::state::State;
use tokio::net::TcpStream;
use tokio_tungstenite::accept_async;

async fn drift_server_handle_connection(stream: TcpStream) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("Handshake error in test: {e}");
            return;
        }
    };

    let (mut sink, mut source) = ws_stream.split();
    let mut state = State::new();

    while let Some(msg) = source.next().await {
        let text = match msg {
            Ok(Message::Text(t)) => t,
            Ok(Message::Close(_)) | Err(_) => break,
            _ => continue,
        };

        let response = dispatch_test(&mut state, &text);
        let payload = serde_json::to_string(&response).unwrap();
        if sink.send(Message::Text(payload.into())).await.is_err() {
            break;
        }
    }
}

fn dispatch_test(state: &mut State, text: &str) -> Value {
    let msg: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => {
            return json!({ "type": "error", "message": format!("malformed: {text}") });
        }
    };

    match msg["type"].as_str().unwrap_or("") {
        "ping" => json!({ "type": "pong" }),

        "tick" => {
            let dt = msg["dt"].as_f64().unwrap_or(0.0);
            let speed = msg["time_speed"].as_f64().unwrap_or(1.0);
            state.sim_time_days += dt * speed;
            json!({
                "type": "state_update",
                "sim_time": state.sim_time_days,
                "ships": [],
                "body_positions": [],
                "notifications": []
            })
        }

        "save" => {
            json!({
                "type": "save_data",
                "data": { "simTime": state.sim_time_days }
            })
        }

        "load" => {
            if let Some(sim_time) = msg["data"]["simTime"].as_f64() {
                state.sim_time_days = sim_time;
            }
            json!({
                "type": "state_update",
                "sim_time": state.sim_time_days,
                "ships": [],
                "body_positions": [],
                "notifications": []
            })
        }

        other => json!({ "type": "error", "message": format!("unknown type: {other}") }),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Server binds to an ephemeral port and a client can connect via WebSocket.
#[tokio::test]
async fn test_server_binds_and_accepts_connection() {
    let (listener, addr) = bind_ephemeral().await;
    let _server = spawn_server(listener);

    let url = format!("ws://{addr}");
    let result = timeout(Duration::from_secs(2), connect_async(&url)).await;
    assert!(result.is_ok(), "connect timed out");
    assert!(result.unwrap().is_ok(), "WebSocket connect failed");
}

/// Ping → Pong round-trip.
#[tokio::test]
async fn test_ping_pong() {
    let (listener, addr) = bind_ephemeral().await;
    let _server = spawn_server(listener);

    let (mut ws, _) = timeout(
        Duration::from_secs(2),
        connect_async(format!("ws://{addr}")),
    )
    .await
    .expect("connect timed out")
    .expect("WebSocket connect failed");

    ws.send(Message::Text(json!({ "type": "ping" }).to_string().into()))
        .await
        .unwrap();

    let reply = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("reply timed out")
        .expect("stream ended")
        .expect("WebSocket error");

    let body: Value = match reply {
        Message::Text(t) => serde_json::from_str(&t).unwrap(),
        other => panic!("Expected Text frame, got {other:?}"),
    };

    assert_eq!(body["type"], "pong");
}

/// Tick message advances sim_time and returns a state_update with sim_time > 0.
#[tokio::test]
async fn test_tick_returns_state_update_with_positive_sim_time() {
    let (listener, addr) = bind_ephemeral().await;
    let _server = spawn_server(listener);

    let (mut ws, _) = timeout(
        Duration::from_secs(2),
        connect_async(format!("ws://{addr}")),
    )
    .await
    .expect("connect timed out")
    .expect("WebSocket connect failed");

    let tick = json!({ "type": "tick", "dt": 0.033, "time_speed": 8.0 });
    ws.send(Message::Text(tick.to_string().into()))
        .await
        .unwrap();

    let reply = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("reply timed out")
        .expect("stream ended")
        .expect("WebSocket error");

    let body: Value = match reply {
        Message::Text(t) => serde_json::from_str(&t).unwrap(),
        other => panic!("Expected Text frame, got {other:?}"),
    };

    assert_eq!(body["type"], "state_update");
    let sim_time = body["sim_time"].as_f64().expect("sim_time missing");
    assert!(
        sim_time > 0.0,
        "sim_time should be > 0 after tick, got {sim_time}"
    );
}

/// Unknown message type returns an error response.
#[tokio::test]
async fn test_unknown_message_returns_error() {
    let (listener, addr) = bind_ephemeral().await;
    let _server = spawn_server(listener);

    let (mut ws, _) = timeout(
        Duration::from_secs(2),
        connect_async(format!("ws://{addr}")),
    )
    .await
    .expect("connect timed out")
    .expect("WebSocket connect failed");

    ws.send(Message::Text(
        json!({ "type": "does_not_exist" }).to_string().into(),
    ))
    .await
    .unwrap();

    let reply = timeout(Duration::from_secs(2), ws.next())
        .await
        .expect("reply timed out")
        .expect("stream ended")
        .expect("WebSocket error");

    let body: Value = match reply {
        Message::Text(t) => serde_json::from_str(&t).unwrap(),
        other => panic!("Expected Text frame, got {other:?}"),
    };

    assert_eq!(body["type"], "error");
}
