// Game clock — ported from src/core/game-clock.ts

const SECONDS_PER_DAY: f64 = 86_400.0;

/// Epoch: January 20, 2038 — expressed as days since the Unix epoch (1970-01-01).
/// Computed as: years 1970..=2037 in days + 19 days into January 2038.
/// 1970-01-01 to 2038-01-01 = 68 years.
/// Leap years in [1970, 2038): 1972,1976,1980,1984,1988,1992,1996,2000,2004,2008,2012,2016,2020,2024,2028,2032,2036 = 17 leap years.
/// 68 * 365 + 17 = 24820 + 17 = 24837 days to 2038-01-01, plus 19 days = 24856.
const SIM_EPOCH_UNIX_DAYS: i64 = 24_856;

/// Decomposed simulation date returned by [`GameClock::to_date`].
#[derive(Debug, Clone, PartialEq)]
pub struct SimDate {
    pub year: i32,
    pub month: u32,
    pub day: u32,
    pub hour: u32,
}

/// Simulation clock storing elapsed time as fractional days since the sim epoch.
#[derive(Debug, Clone)]
pub struct GameClock {
    days: f64,
}

impl GameClock {
    /// Create a clock at day 0 (sim epoch).
    pub fn new() -> Self {
        Self { days: 0.0 }
    }

    /// Create from fractional days since the sim epoch.
    pub fn from_days(days: f64) -> Self {
        Self { days }
    }

    /// Create from seconds since the sim epoch.
    pub fn from_seconds(seconds: f64) -> Self {
        Self {
            days: seconds / SECONDS_PER_DAY,
        }
    }

    // --- Accessors ---

    /// Fractional days since epoch.
    pub fn days(&self) -> f64 {
        self.days
    }

    /// Total seconds since epoch.
    pub fn total_seconds(&self) -> f64 {
        self.days * SECONDS_PER_DAY
    }

    /// Integer day number (floor of days).
    pub fn day_number(&self) -> i64 {
        self.days.floor() as i64
    }

    // --- Mutation ---

    /// Advance the clock by fractional days.
    pub fn advance_days(&mut self, delta: f64) {
        self.days += delta;
    }

    /// Overwrite the clock with a specific day value.
    pub fn set_days(&mut self, days: f64) {
        self.days = days;
    }

    // --- Conversion ---

    /// Convert to a [`SimDate`] (year, month, day, hour).
    ///
    /// The fractional-day sub-day portion is converted to hours (UTC-like,
    /// matching the TypeScript implementation which uses `new Date(...)`).
    pub fn to_date(&self) -> SimDate {
        // Split into whole days + fractional day.
        let whole_days = self.days.floor() as i64;
        let frac = self.days - whole_days as f64;
        let sub_seconds = frac * SECONDS_PER_DAY;

        // Hour within the day.
        let hour = (sub_seconds / 3_600.0).floor() as u32;

        // Convert absolute day number (days since Unix epoch) to a Gregorian date.
        let unix_days = SIM_EPOCH_UNIX_DAYS + whole_days;
        let (year, month, day) = unix_days_to_ymd(unix_days);

        SimDate {
            year,
            month,
            day,
            hour,
        }
    }

    // --- Formatting ---

    /// "YYYY-MM-DD HH:MM:SS"
    pub fn format_date_time(&self) -> String {
        let whole_days = self.days.floor() as i64;
        let frac = self.days - whole_days as f64;
        let sub_seconds = frac * SECONDS_PER_DAY;

        let hour = (sub_seconds / 3_600.0).floor() as u32;
        let remaining = sub_seconds - (hour as f64 * 3_600.0);
        let minute = (remaining / 60.0).floor() as u32;
        let second = (remaining - (minute as f64 * 60.0)).floor() as u32;

        let unix_days = SIM_EPOCH_UNIX_DAYS + whole_days;
        let (year, month, day) = unix_days_to_ymd(unix_days);

        format!(
            "{:04}-{:02}-{:02} {:02}:{:02}:{:02}",
            year, month, day, hour, minute, second
        )
    }

    /// "YYYY-MM-DD"
    pub fn format_date(&self) -> String {
        let d = self.to_date();
        format!("{:04}-{:02}-{:02}", d.year, d.month, d.day)
    }

    // --- Serialization ---

    /// Returns days for serialization (mirrors `toJSON` in TypeScript).
    pub fn to_json(&self) -> f64 {
        self.days
    }
}

impl Default for GameClock {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert a day count since the Unix epoch (1970-01-01) to (year, month, day).
///
/// Uses the proleptic Gregorian calendar algorithm that matches JavaScript's
/// `Date` UTC arithmetic.
fn unix_days_to_ymd(unix_days: i64) -> (i32, u32, u32) {
    // Algorithm: civil date from days since epoch.
    // Based on the public-domain algorithm by Howard Hinnant:
    // https://howardhinnant.github.io/date_algorithms.html#civil_from_days
    let z = unix_days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097; // day of era [0, 146096]
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365; // year of era [0, 399]
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // day of year [0, 365]
    let mp = (5 * doy + 2) / 153; // month of year [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1; // day [1, 31]
    let m = if mp < 10 { mp + 3 } else { mp - 9 }; // month [1, 12]
    let y = if m <= 2 { y + 1 } else { y };

    (y as i32, m as u32, d as u32)
}
