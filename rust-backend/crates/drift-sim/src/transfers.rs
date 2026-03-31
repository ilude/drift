// Transfer initiation — ported from src/core/transfers.ts

/// Pure calculation: proportionally adjust fuel budget for remaining transfer time.
///
/// If `total_days` is zero, returns 0 to avoid division by zero.
pub fn compute_adjusted_fuel_budget(
    current_budget: f64,
    total_days: f64,
    remaining_days: f64,
) -> f64 {
    if total_days <= 0.0 {
        return 0.0;
    }
    current_budget * (remaining_days / total_days)
}
