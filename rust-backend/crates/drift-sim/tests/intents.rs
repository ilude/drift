// Ported from src/__tests__/intents.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_sim::intents::{
    clear_intent, get_claimed_targets, get_intent_for_ship, is_target_claimed, publish_intent,
};
use drift_sim::state::State;
use drift_types::ShipIntent;

// ─── publishIntent ────────────────────────────────────────────────────────────

mod publish_intent {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_intents.clear();
        state
    }

    #[test]
    fn adds_intent_to_the_pool() {
        let mut state = setup();
        publish_intent(
            "Explorer",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );
        assert_eq!(state.ship_intents.len(), 1);
        assert!(matches!(
            state.ship_intents.get("Explorer"),
            Some(ShipIntent::Surveying { .. })
        ));
    }

    #[test]
    fn overwrites_previous_intent_for_same_ship() {
        let mut state = setup();
        publish_intent(
            "Explorer",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );
        publish_intent(
            "Explorer",
            ShipIntent::Idle {
                location: "Mars".to_string(),
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );
        assert_eq!(state.ship_intents.len(), 1);
        assert!(matches!(
            state.ship_intents.get("Explorer"),
            Some(ShipIntent::Idle { .. })
        ));
    }
}

// ─── clearIntent ──────────────────────────────────────────────────────────────

mod clear_intent {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_intents.clear();
        state
    }

    #[test]
    fn removes_intent_from_the_pool() {
        let mut state = setup();
        publish_intent(
            "Explorer",
            ShipIntent::Idle {
                location: "Earth".to_string(),
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );
        clear_intent("Explorer", &mut state);
        assert_eq!(state.ship_intents.len(), 0);
    }

    #[test]
    fn no_op_for_non_existent_ship() {
        let mut state = setup();
        clear_intent("Ghost", &mut state);
        assert_eq!(state.ship_intents.len(), 0);
    }
}

// ─── getIntentForShip ─────────────────────────────────────────────────────────

mod get_intent_for_ship {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_intents.clear();
        state
    }

    #[test]
    fn returns_the_intent_for_a_known_ship() {
        let mut state = setup();
        publish_intent(
            "Explorer",
            ShipIntent::Refueling {
                location: "Earth".to_string(),
                ship_name: "Explorer".to_string(),
            },
            &mut state,
        );
        let intent = get_intent_for_ship("Explorer", &state);
        assert!(matches!(intent, Some(ShipIntent::Refueling { .. })));
    }

    #[test]
    fn returns_none_for_unknown_ship() {
        let state = setup();
        assert!(get_intent_for_ship("Nobody", &state).is_none());
    }
}

// ─── isTargetClaimed ──────────────────────────────────────────────────────────

mod is_target_claimed {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_intents.clear();
        state
    }

    #[test]
    fn returns_true_when_another_ship_is_surveying_the_target() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        assert!(is_target_claimed("Mars", "Ship-B", &state));
    }

    #[test]
    fn returns_true_when_another_ship_is_transferring_to_the_target() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Transferring {
                destination: "Mars".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        assert!(is_target_claimed("Mars", "Ship-B", &state));
    }

    #[test]
    fn returns_false_when_the_claiming_ship_is_the_excluded_ship() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        assert!(!is_target_claimed("Mars", "Ship-A", &state));
    }

    #[test]
    fn returns_false_when_target_is_unclaimed() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Surveying {
                target: "Venus".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        assert!(!is_target_claimed("Mars", "Ship-B", &state));
    }

    #[test]
    fn returns_false_on_empty_pool() {
        let state = setup();
        assert!(!is_target_claimed("Mars", "Ship-A", &state));
    }
}

// ─── getClaimedTargets ────────────────────────────────────────────────────────

mod get_claimed_targets {
    use super::*;

    fn setup() -> State {
        let mut state = State::default();
        state.ship_intents.clear();
        state
    }

    #[test]
    fn returns_set_of_targets_claimed_by_other_ships() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        publish_intent(
            "Ship-B",
            ShipIntent::Transferring {
                destination: "Venus".to_string(),
                ship_name: "Ship-B".to_string(),
            },
            &mut state,
        );
        let claimed = get_claimed_targets("Ship-C", &state);
        assert!(claimed.contains("Mars"));
        assert!(claimed.contains("Venus"));
        assert_eq!(claimed.len(), 2);
    }

    #[test]
    fn excludes_the_requesting_ships_own_claims() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Surveying {
                target: "Mars".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        let claimed = get_claimed_targets("Ship-A", &state);
        assert!(!claimed.contains("Mars"));
        assert_eq!(claimed.len(), 0);
    }

    #[test]
    fn ignores_non_target_intents_refueling_idle_etc() {
        let mut state = setup();
        publish_intent(
            "Ship-A",
            ShipIntent::Refueling {
                location: "Earth".to_string(),
                ship_name: "Ship-A".to_string(),
            },
            &mut state,
        );
        publish_intent(
            "Ship-B",
            ShipIntent::Idle {
                location: "Mars".to_string(),
                ship_name: "Ship-B".to_string(),
            },
            &mut state,
        );
        let claimed = get_claimed_targets("Ship-C", &state);
        assert_eq!(claimed.len(), 0);
    }
}
