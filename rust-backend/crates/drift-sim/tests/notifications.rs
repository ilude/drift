// Ported from src/__tests__/notifications.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_math::game_clock::GameClock;
use drift_sim::notifications::{
    add_coalesced_notification, add_notification, clear_notifications, get_unread_count,
    mark_all_read, mark_read, set_pause_config, should_pause,
};
use drift_sim::state::State;

fn reset_state(state: &mut State) {
    state.notifications = vec![];
    state.sim_time = GameClock::from_days(100.0);
    state.time_speed = 1.0;
    state.notification_pause_config = drift_types::NotificationPauseConfig {
        info: false,
        survey_complete: false,
        low_fuel: false,
        low_morale: false,
        maintenance_needed: false,
        mission_complete: true,
        malfunction: true,
        ship_destroyed: true,
        transfer_complete: false,
        action_complete: false,
        colony_understaffed: false,
        colony_idle: false,
        colony_blocked: false,
        colony_low_supplies: false,
        ship_built: false,
        scientist_graduated: false,
    };
    clear_notifications(state);
}

// ─── notifications ────────────────────────────────────────────────────────────

mod notifications {
    use super::*;

    mod add_notification {
        use super::*;

        #[test]
        fn creates_a_notification_with_correct_fields() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "Fuel is low", None, &mut state);
            assert_eq!(state.notifications.len(), 1);
            let n = &state.notifications[0];
            assert_eq!(n.notification_type, "low-fuel");
            assert_eq!(n.message, "Fuel is low");
            assert_eq!(n.sim_time, 100.0);
            assert!(!n.read);
            assert!(n.id > 0);
        }

        #[test]
        fn stores_body_name_when_provided() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("survey-complete", "Surveyed Mars", Some("Mars"), &mut state);
            assert_eq!(state.notifications[0].body_name.as_deref(), Some("Mars"));
        }

        #[test]
        fn body_name_is_none_when_not_provided() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "Fuel is low", None, &mut state);
            assert!(state.notifications[0].body_name.is_none());
        }

        #[test]
        fn auto_increments_ids_across_multiple_notifications() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            add_notification("malfunction", "msg3", None, &mut state);
            let ids: Vec<u64> = state.notifications.iter().map(|n| n.id).collect();
            assert_eq!(ids[1], ids[0] + 1);
            assert_eq!(ids[2], ids[1] + 1);
        }

        #[test]
        fn does_not_pause_when_pause_config_is_false() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "Fuel is low", None, &mut state);
            assert_eq!(state.time_speed, 1.0);
        }

        #[test]
        fn pauses_when_pause_config_is_true_for_that_type() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("malfunction", "Engine failure", None, &mut state);
            assert_eq!(state.time_speed, 0.0);
        }

        #[test]
        fn does_not_pause_on_survey_complete_when_config_is_false() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!state.notification_pause_config.survey_complete);
            add_notification("survey-complete", "Surveyed Mars", None, &mut state);
            assert_eq!(state.time_speed, 1.0);
        }

        #[test]
        fn caps_at_200_notifications_by_evicting_oldest_read_notifications_first() {
            let mut state = State::default();
            reset_state(&mut state);
            for i in 0..200 {
                add_notification("low-fuel", &format!("msg{i}"), None, &mut state);
            }
            // Mark first 100 as read
            for i in 0..100 {
                state.notifications[i].read = true;
            }
            let id_before_201 = state.notifications[0].id;
            add_notification("low-fuel", "msg200", None, &mut state);
            assert_eq!(state.notifications.len(), 200);
            // The oldest read notification (index 0) should have been evicted
            assert_ne!(state.notifications[0].id, id_before_201);
        }

        #[test]
        fn caps_at_200_by_evicting_oldest_unread_when_all_are_unread() {
            let mut state = State::default();
            reset_state(&mut state);
            for i in 0..200 {
                add_notification("low-fuel", &format!("msg{i}"), None, &mut state);
            }
            let oldest_id = state.notifications[0].id;
            add_notification("low-fuel", "msg200", None, &mut state);
            assert_eq!(state.notifications.len(), 200);
            let ids: Vec<u64> = state.notifications.iter().map(|n| n.id).collect();
            assert!(!ids.contains(&oldest_id));
        }
    }

    mod get_unread_count {
        use super::*;

        #[test]
        fn returns_0_with_no_notifications() {
            let mut state = State::default();
            reset_state(&mut state);
            assert_eq!(get_unread_count(&state), 0);
        }

        #[test]
        fn returns_correct_unread_count() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            add_notification("malfunction", "msg3", None, &mut state);
            // malfunction pauses — reset speed for test clarity
            state.time_speed = 1.0;
            let id = state.notifications[0].id;
            mark_read(id, &mut state);
            assert_eq!(get_unread_count(&state), 2);
        }

        #[test]
        fn returns_0_after_mark_all_read() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            mark_all_read(&mut state);
            assert_eq!(get_unread_count(&state), 0);
        }
    }

    mod mark_read {
        use super::*;

        #[test]
        fn sets_read_to_true_on_the_correct_notification() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            let id = state.notifications[0].id;
            mark_read(id, &mut state);
            assert!(state.notifications[0].read);
            assert!(!state.notifications[1].read);
        }

        #[test]
        fn does_nothing_for_unknown_id() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            mark_read(99999, &mut state);
            assert!(!state.notifications[0].read);
        }
    }

    mod mark_all_read {
        use super::*;

        #[test]
        fn marks_all_notifications_as_read() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            mark_all_read(&mut state);
            assert!(state.notifications.iter().all(|n| n.read));
        }
    }

    mod should_pause {
        use super::*;

        #[test]
        fn returns_true_for_malfunction_default_config() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(should_pause("malfunction", &state));
        }

        #[test]
        fn returns_false_for_survey_complete_default_config() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!should_pause("survey-complete", &state));
        }

        #[test]
        fn returns_updated_value_after_set_pause_config() {
            let mut state = State::default();
            reset_state(&mut state);
            set_pause_config("low-fuel", true, &mut state);
            assert!(should_pause("low-fuel", &state));
            set_pause_config("low-fuel", false, &mut state);
            assert!(!should_pause("low-fuel", &state));
        }
    }

    mod set_pause_config {
        use super::*;

        #[test]
        fn changes_pause_behavior_for_the_type() {
            let mut state = State::default();
            reset_state(&mut state);
            set_pause_config("low-fuel", true, &mut state);
            add_notification("low-fuel", "Fuel low", None, &mut state);
            assert_eq!(state.time_speed, 0.0);
        }

        #[test]
        fn dispatches_wake_render_event_when_pausing() {
            // In Rust there is no DOM window — this test verifies that the pause
            // side effect (time_speed → 0) occurs; the wake-render dispatch is a
            // browser-only concern not present in the sim crate.
            let mut state = State::default();
            reset_state(&mut state);
            set_pause_config("low-fuel", true, &mut state);
            add_notification("low-fuel", "Fuel low", None, &mut state);
            assert_eq!(state.time_speed, 0.0);
        }
    }

    mod clear_notifications {
        use super::*;

        #[test]
        fn empties_the_notifications_array() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            add_notification("low-morale", "msg2", None, &mut state);
            clear_notifications(&mut state);
            assert_eq!(state.notifications.len(), 0);
        }

        #[test]
        fn resets_id_counter_so_next_id_starts_fresh() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification("low-fuel", "msg1", None, &mut state);
            clear_notifications(&mut state);
            add_notification("low-fuel", "msg2", None, &mut state);
            assert_eq!(state.notifications[0].id, 1);
        }
    }

    mod add_coalesced_notification {
        use super::*;

        #[test]
        fn coalesces_same_type_notification_within_the_default_window() {
            let mut state = State::default();
            reset_state(&mut state);
            // Provide explicit wall-clock timestamps so coalescing is deterministic
            let now_ms = 1_000_000u64;
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Mars",
                Some("Mars"),
                now_ms,
                None,
                &mut state,
            );
            // Same type, same window
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Ceres",
                Some("Ceres"),
                now_ms + 500,
                None,
                &mut state,
            );
            assert_eq!(state.notifications.len(), 1);
            assert!(state.notifications[0].message.contains("Ceres"));
        }

        #[test]
        fn coalesces_without_body_name_else_branch_by_replacing_message() {
            let mut state = State::default();
            reset_state(&mut state);
            let now_ms = 1_000_000u64;
            add_coalesced_notification(
                "low-fuel",
                "Fuel critical",
                Some("Ship1"),
                now_ms,
                None,
                &mut state,
            );
            // Same type, same window, but no body_name (triggers else branch)
            add_coalesced_notification(
                "low-fuel",
                "Fuel empty",
                None,
                now_ms + 500,
                None,
                &mut state,
            );
            assert_eq!(state.notifications.len(), 1);
            assert_eq!(state.notifications[0].message, "Fuel empty");
        }

        #[test]
        fn creates_a_new_entry_outside_the_coalescing_window() {
            let mut state = State::default();
            reset_state(&mut state);
            let now_ms = 1_000_000u64;
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Mars",
                Some("Mars"),
                now_ms,
                None,
                &mut state,
            );
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Ceres",
                Some("Ceres"),
                now_ms + 5000,
                None,
                &mut state,
            );
            assert_eq!(state.notifications.len(), 2);
        }

        #[test]
        fn creates_a_new_entry_for_a_different_type_even_within_the_window() {
            let mut state = State::default();
            reset_state(&mut state);
            let now_ms = 1_000_000u64;
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Mars",
                Some("Mars"),
                now_ms,
                None,
                &mut state,
            );
            add_coalesced_notification(
                "low-fuel",
                "Fuel low",
                None,
                now_ms + 500,
                None,
                &mut state,
            );
            assert_eq!(state.notifications.len(), 2);
        }

        #[test]
        fn respects_custom_coalescing_window() {
            let mut state = State::default();
            reset_state(&mut state);
            let now_ms = 1_000_000u64;
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Mars",
                Some("Mars"),
                now_ms,
                Some(500),
                &mut state,
            );
            add_coalesced_notification(
                "survey-complete",
                "Surveyed Ceres",
                Some("Ceres"),
                now_ms + 600,
                Some(500),
                &mut state,
            );
            assert_eq!(state.notifications.len(), 2);
        }
    }

    mod new_notification_types {
        use super::*;

        #[test]
        fn transfer_complete_does_not_pause_by_default() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!state.notification_pause_config.transfer_complete);
            add_notification(
                "transfer-complete",
                "Ship arrived at Mars",
                None,
                &mut state,
            );
            assert_eq!(state.time_speed, 1.0);
        }

        #[test]
        fn action_complete_does_not_pause_by_default() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!state.notification_pause_config.action_complete);
            add_notification("action-complete", "Refueling completed", None, &mut state);
            assert_eq!(state.time_speed, 1.0);
        }

        #[test]
        fn transfer_complete_is_a_valid_notification_type_accepted_by_add_notification() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification(
                "transfer-complete",
                "ISS Explorer arrived at Jupiter",
                Some("ISS Explorer"),
                &mut state,
            );
            assert_eq!(state.notifications.len(), 1);
            assert_eq!(
                state.notifications[0].notification_type,
                "transfer-complete"
            );
            assert_eq!(
                state.notifications[0].body_name.as_deref(),
                Some("ISS Explorer")
            );
        }

        #[test]
        fn action_complete_is_a_valid_notification_type_accepted_by_add_notification() {
            let mut state = State::default();
            reset_state(&mut state);
            add_notification(
                "action-complete",
                "ISS Explorer: Overhaul completed",
                Some("ISS Explorer"),
                &mut state,
            );
            assert_eq!(state.notifications.len(), 1);
            assert_eq!(state.notifications[0].notification_type, "action-complete");
        }

        #[test]
        fn should_pause_returns_false_for_transfer_complete_by_default() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!should_pause("transfer-complete", &state));
        }

        #[test]
        fn should_pause_returns_false_for_action_complete_by_default() {
            let mut state = State::default();
            reset_state(&mut state);
            assert!(!should_pause("action-complete", &state));
        }
    }
}
