// WebSocket server exposing the drift-sim engine to an Electron frontend.
// Binds to localhost:9742 (override with DRIFT_PORT env var).
// Accepts one client connection at a time.

use std::env;

use drift_sim::state::{SavedStateData, State};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{accept_async, tungstenite::Message};

// ---------------------------------------------------------------------------
// Protocol types
// ---------------------------------------------------------------------------

/// Messages received from the frontend.
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum IncomingMessage {
    Tick { dt: f64, time_speed: f64 },
    SetImmediateCommand { ship: String, command: String },
    InitiateTransfer { ship: String, target: String },
    Save,
    Load { data: Value },
    Ping,
}

/// Messages sent to the frontend.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OutgoingMessage<'a> {
    StateUpdate {
        sim_time: f64,
        ships: Vec<ShipSnapshot>,
        body_positions: Vec<BodyPositionSnapshot>,
        notifications: &'a [drift_sim::state::Notification],
    },
    SaveData {
        data: SavedStateData,
    },
    Pong,
    Error {
        message: String,
    },
}

#[derive(Debug, Serialize)]
struct ShipSnapshot {
    name: String,
    ship_state: String,
    host_planet_name: Option<String>,
    fuel_kg: f64,
    fuel_capacity_kg: f64,
    position: [f32; 3],
}

#[derive(Debug, Serialize)]
struct BodyPositionSnapshot {
    name: String,
    position: [f32; 3],
}

// ---------------------------------------------------------------------------
// State extraction helpers
// ---------------------------------------------------------------------------

fn collect_ships(state: &State) -> Vec<ShipSnapshot> {
    state
        .body_meshes
        .iter()
        .filter(|e| e.is_ship)
        .map(|e| ShipSnapshot {
            name: e.data.name.clone(),
            ship_state: e.ship_state.clone().unwrap_or_default(),
            host_planet_name: e.host_planet_name.clone(),
            fuel_kg: e.fuel_kg,
            fuel_capacity_kg: e.fuel_capacity_kg,
            position: e.position,
        })
        .collect()
}

fn collect_body_positions(state: &State) -> Vec<BodyPositionSnapshot> {
    state
        .body_meshes
        .iter()
        .filter(|e| !e.is_ship)
        .map(|e| BodyPositionSnapshot {
            name: e.data.name.clone(),
            position: e.position,
        })
        .collect()
}

fn build_state_update(state: &State) -> OutgoingMessage<'_> {
    OutgoingMessage::StateUpdate {
        sim_time: state.sim_time_days,
        ships: collect_ships(state),
        body_positions: collect_body_positions(state),
        notifications: &state.notifications,
    }
}

fn state_to_save(state: &State) -> SavedStateData {
    SavedStateData {
        sim_time: state.sim_time_days,
        current_system_key: state.current_system_key.clone(),
        random_click_count: state.random_click_count,
        ..Default::default()
    }
}

fn load_state(state: &mut State, data: Value) {
    if let Ok(saved) = serde_json::from_value::<SavedStateData>(data) {
        state.sim_time_days = saved.sim_time;
        state.current_system_key = saved.current_system_key;
        state.random_click_count = saved.random_click_count;
    }
}

// ---------------------------------------------------------------------------
// Connection handler
// ---------------------------------------------------------------------------

async fn handle_connection(stream: TcpStream) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("WebSocket handshake failed: {e}");
            return;
        }
    };

    println!("Client connected");

    let (mut sink, mut source) = ws_stream.split();
    let mut state = State::new();

    while let Some(msg) = source.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                eprintln!("WebSocket receive error: {e}");
                break;
            }
        };

        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            // Binary / ping / pong frames — ignore
            _ => continue,
        };

        let response = dispatch(&mut state, &text);
        let payload = match serde_json::to_string(&response) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Serialization error: {e}");
                continue;
            }
        };

        if let Err(e) = sink.send(Message::Text(payload)).await {
            eprintln!("WebSocket send error: {e}");
            break;
        }
    }

    println!("Client disconnected");
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

fn dispatch<'a>(state: &'a mut State, text: &str) -> OutgoingMessage<'a> {
    let incoming: IncomingMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => {
            return OutgoingMessage::Error {
                message: format!("Unknown or malformed message: {text}"),
            };
        }
    };

    match incoming {
        IncomingMessage::Tick { dt, time_speed } => {
            state.sim_time_days += dt * time_speed;
            build_state_update(state)
        }

        IncomingMessage::SetImmediateCommand { ship, command } => {
            // Best-effort: log the intent; full command-tree wiring is post-MVP.
            println!("set_immediate_command: ship={ship} command={command}");
            build_state_update(state)
        }

        IncomingMessage::InitiateTransfer { ship, target } => {
            println!("initiate_transfer: ship={ship} target={target}");
            build_state_update(state)
        }

        IncomingMessage::Save => OutgoingMessage::SaveData {
            data: state_to_save(state),
        },

        IncomingMessage::Load { data } => {
            load_state(state, data);
            build_state_update(state)
        }

        IncomingMessage::Ping => OutgoingMessage::Pong,
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() {
    let port = env::var("DRIFT_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(9742);

    let addr = format!("127.0.0.1:{port}");
    let listener = TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("Failed to bind to {addr}: {e}"));

    println!("drift-server listening on ws://{addr}");

    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                println!("Incoming connection from {peer}");
                // One client at a time: await the connection fully before
                // accepting the next one.
                handle_connection(stream).await;
            }
            Err(e) => {
                eprintln!("Accept error: {e}");
            }
        }
    }
}
