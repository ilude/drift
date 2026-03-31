// Notification system — ported from src/core/notifications.ts

use std::cell::Cell;

use crate::state::{Notification, NotificationPauseConfig, State};

const DEFAULT_COALESCE_WINDOW_MS: u64 = 2000;

// Per-thread coalescing state (mirrors the module-level variables in the TS source).
// Thread-local gives test isolation without requiring fields on State.
thread_local! {
    static LAST_COALESCE_TIME_MS: Cell<u64> = const { Cell::new(0) };
    static LAST_COALESCE_TYPE: Cell<Option<u64>> = const { Cell::new(None) };
    // We store the notification_type as a hash to avoid heap allocation in the hot path.
    // Actually store as a raw u64 hash of the type string.
}

// Simple FNV-1a hash to turn a &str into a u64 key.
fn type_hash(s: &str) -> u64 {
    let mut h: u64 = 14_695_981_039_346_656_037;
    for b in s.bytes() {
        h ^= b as u64;
        h = h.wrapping_mul(1_099_511_628_211);
    }
    h
}

/// Add a notification, evicting the oldest read entry (or oldest unread if all
/// are unread) when the queue is at capacity (200). Pauses sim time if the
/// pause config for this type is enabled.
pub fn add_notification(
    notification_type: &str,
    message: &str,
    body_name: Option<&str>,
    state: &mut State,
) {
    // Evict before inserting so the cap is enforced at 200.
    if state.notifications.len() >= 200 {
        if let Some(read_idx) = state.notifications.iter().position(|n| n.read) {
            state.notifications.remove(read_idx);
        } else {
            state.notifications.remove(0);
        }
    }

    state.next_notification_id += 1;
    let id = state.next_notification_id;

    let notification = Notification {
        id,
        notification_type: notification_type.to_string(),
        message: message.to_string(),
        sim_time: state.sim_time.days(),
        body_name: body_name.map(|s| s.to_string()),
        read: false,
    };

    state.notifications.push(notification);

    if should_pause(notification_type, state) {
        state.time_speed = 0.0;
    }
}

/// Add a notification, coalescing with the most recent notification of the
/// same type if it falls within `window_ms` milliseconds (default 2000 ms).
/// `now_ms` is the caller-supplied wall-clock time (used instead of `Date.now()`
/// so behaviour is deterministic in tests).
pub fn add_coalesced_notification(
    notification_type: &str,
    message: &str,
    body_name: Option<&str>,
    now_ms: u64,
    window_ms: Option<u64>,
    state: &mut State,
) {
    let window = window_ms.unwrap_or(DEFAULT_COALESCE_WINDOW_MS);

    let last_time = LAST_COALESCE_TIME_MS.with(|c| c.get());
    let last_type = LAST_COALESCE_TYPE.with(|c| c.get());
    let this_hash = type_hash(notification_type);

    let within_window = now_ms.saturating_sub(last_time) <= window;
    let same_type = last_type == Some(this_hash);
    let last_is_same_type = state
        .notifications
        .last()
        .map(|n| n.notification_type == notification_type)
        .unwrap_or(false);

    if within_window && same_type && last_is_same_type {
        // Coalesce into the existing tail entry.
        if let Some(last) = state.notifications.last_mut() {
            if let Some(name) = body_name {
                last.message = format!("{}, {}", last.message, name);
            } else {
                last.message = message.to_string();
            }
        }
    } else {
        add_notification(notification_type, message, body_name, state);
        LAST_COALESCE_TYPE.with(|c| c.set(Some(this_hash)));
    }

    LAST_COALESCE_TIME_MS.with(|c| c.set(now_ms));
}

/// Return the number of unread notifications.
pub fn get_unread_count(state: &State) -> usize {
    state.notifications.iter().filter(|n| !n.read).count()
}

/// Mark a single notification as read by id.
pub fn mark_read(id: u64, state: &mut State) {
    if let Some(n) = state.notifications.iter_mut().find(|n| n.id == id) {
        n.read = true;
    }
}

/// Mark all notifications as read.
pub fn mark_all_read(state: &mut State) {
    for n in &mut state.notifications {
        n.read = true;
    }
}

/// Return whether the sim should pause when a notification of `notification_type`
/// is added.
pub fn should_pause(notification_type: &str, state: &State) -> bool {
    pause_flag(notification_type, &state.notification_pause_config)
}

/// Update the pause config for a given notification type.
pub fn set_pause_config(notification_type: &str, enabled: bool, state: &mut State) {
    set_pause_flag(
        notification_type,
        enabled,
        &mut state.notification_pause_config,
    );
}

/// Clear all notifications and reset the ID counter and coalescing state.
pub fn clear_notifications(state: &mut State) {
    state.notifications.clear();
    state.next_notification_id = 0;
    LAST_COALESCE_TIME_MS.with(|c| c.set(0));
    LAST_COALESCE_TYPE.with(|c| c.set(None));
}

// ---------------------------------------------------------------------------
// Helpers: map notification type string → pause config bool field
// ---------------------------------------------------------------------------

fn pause_flag(notification_type: &str, cfg: &NotificationPauseConfig) -> bool {
    match notification_type {
        "info" => cfg.info,
        "survey-complete" => cfg.survey_complete,
        "low-fuel" => cfg.low_fuel,
        "low-morale" => cfg.low_morale,
        "maintenance-needed" => cfg.maintenance_needed,
        "mission-complete" => cfg.mission_complete,
        "malfunction" => cfg.malfunction,
        "ship-destroyed" => cfg.ship_destroyed,
        "transfer-complete" => cfg.transfer_complete,
        "action-complete" => cfg.action_complete,
        "colony-understaffed" => cfg.colony_understaffed,
        "colony-idle" => cfg.colony_idle,
        "colony-blocked" => cfg.colony_blocked,
        "colony-low-supplies" => cfg.colony_low_supplies,
        "ship-built" => cfg.ship_built,
        "scientist-graduated" => cfg.scientist_graduated,
        _ => false,
    }
}

fn set_pause_flag(notification_type: &str, enabled: bool, cfg: &mut NotificationPauseConfig) {
    match notification_type {
        "info" => cfg.info = enabled,
        "survey-complete" => cfg.survey_complete = enabled,
        "low-fuel" => cfg.low_fuel = enabled,
        "low-morale" => cfg.low_morale = enabled,
        "maintenance-needed" => cfg.maintenance_needed = enabled,
        "mission-complete" => cfg.mission_complete = enabled,
        "malfunction" => cfg.malfunction = enabled,
        "ship-destroyed" => cfg.ship_destroyed = enabled,
        "transfer-complete" => cfg.transfer_complete = enabled,
        "action-complete" => cfg.action_complete = enabled,
        "colony-understaffed" => cfg.colony_understaffed = enabled,
        "colony-idle" => cfg.colony_idle = enabled,
        "colony-blocked" => cfg.colony_blocked = enabled,
        "colony-low-supplies" => cfg.colony_low_supplies = enabled,
        "ship-built" => cfg.ship_built = enabled,
        "scientist-graduated" => cfg.scientist_graduated = enabled,
        _ => {}
    }
}
