// Seeded RNG — ported from src/core/utils.ts

/// Trait for entries that carry a selection weight.
pub trait Weighted {
    fn weight(&self) -> f64;
}

/// Returns a closure that produces deterministic f64 values in [0, 1).
///
/// Uses the Park-Miller LCG (multiplier 16807, modulus 2^31-1), identical to
/// the TypeScript implementation in `src/core/utils.ts`.  Seed 0 is mapped to
/// 1; negative seeds are treated as their absolute value.
pub fn seeded_random(seed: i64) -> impl FnMut() -> f64 {
    let mut s = seed.unsigned_abs();
    if s == 0 {
        s = 1;
    }
    // Keep s in [1, 2147483646] by clamping large seeds into the LCG range.
    s %= 2_147_483_647;
    if s == 0 {
        s = 1;
    }
    move || {
        s = (s * 16_807) % 2_147_483_647;
        (s - 1) as f64 / 2_147_483_646.0
    }
}

/// Random integer in [min, max] (inclusive).
pub fn rng_int(rng: &mut impl FnMut() -> f64, min: i64, max: i64) -> i64 {
    min + (rng() * (max - min + 1) as f64).floor() as i64
}

/// Random float in [min, max).
pub fn rng_float(rng: &mut impl FnMut() -> f64, min: f64, max: f64) -> f64 {
    min + rng() * (max - min)
}

/// Gaussian (normal distribution) random number via Box-Muller transform.
pub fn rng_gaussian(rng: &mut impl FnMut() -> f64) -> f64 {
    let u1 = rng();
    let u2 = rng();
    let clamped = if u1 == 0.0 { 1e-10 } else { u1 };
    (-2.0 * clamped.ln()).sqrt() * (std::f64::consts::TAU * u2).cos()
}

/// Pick a random element from a slice.
pub fn rng_pick<'a, T>(rng: &mut impl FnMut() -> f64, arr: &'a [T]) -> &'a T {
    let idx = (rng() * arr.len() as f64).floor() as usize;
    &arr[idx.min(arr.len() - 1)]
}

/// Selects an entry from `entries` by weighted random sampling.
///
/// Mirrors `rngWeighted` in `src/core/utils.ts`.  Falls back to the last entry
/// when floating-point rounding prevents `r` from reaching zero.
pub fn rng_weighted<T: Weighted>(mut rng: impl FnMut() -> f64, entries: &[T]) -> &T {
    let total: f64 = entries.iter().map(|e| e.weight()).sum();
    let mut r = rng() * total;
    for entry in entries {
        r -= entry.weight();
        if r <= 0.0 {
            return entry;
        }
    }
    entries
        .last()
        .expect("rng_weighted called with empty slice")
}
