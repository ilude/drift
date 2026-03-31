// Ported from src/__tests__/core-transfers.test.ts
// RED phase — will not compile until drift_sim production code is implemented.

use drift_sim::transfers::compute_adjusted_fuel_budget;

mod compute_adjusted_fuel_budget {
    use super::*;

    #[test]
    fn proportionally_reduces_budget_for_partial_remaining_time() {
        assert_eq!(compute_adjusted_fuel_budget(100.0, 10.0, 5.0), 50.0);
    }

    #[test]
    fn returns_zero_when_total_days_is_zero() {
        assert_eq!(compute_adjusted_fuel_budget(100.0, 0.0, 5.0), 0.0);
    }

    #[test]
    fn returns_full_budget_when_remaining_equals_total() {
        assert_eq!(compute_adjusted_fuel_budget(100.0, 10.0, 10.0), 100.0);
    }

    #[test]
    fn returns_zero_budget_when_remaining_is_zero() {
        assert_eq!(compute_adjusted_fuel_budget(100.0, 10.0, 0.0), 0.0);
    }

    #[test]
    fn handles_fractional_days_correctly() {
        let result = compute_adjusted_fuel_budget(300.0, 15.0, 5.0);
        let diff = (result - 100.0).abs();
        assert!(diff < 1e-9, "expected ~100.0, got {result}");
    }
}
