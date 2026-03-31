// Transfer prediction, Hermite knots, distance helpers — ported from src/math/transfer.ts

use crate::orbit::{
    kepler_period, kepler_radius, mean_to_true, orbit_speed, orbit_to_world, scale_dist,
    DAYS_PER_YEAR, MOON_DIST_SCALE,
};

// Re-export Vec3 from orbit so callers can import it from transfer.
pub use crate::orbit::Vec3;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Hermite spline control points for a ship transfer arc.
#[derive(Debug, Clone, PartialEq)]
pub struct HermiteKnots {
    pub p0x: f64,
    pub p0y: f64,
    pub p0z: f64,
    pub t0x: f64,
    pub t0y: f64,
    pub t0z: f64,
    pub p1x: f64,
    pub p1y: f64,
    pub p1z: f64,
    pub t1x: f64,
    pub t1y: f64,
    pub t1z: f64,
}

/// Comet 3D orbital elements.
#[derive(Debug, Clone, PartialEq)]
pub struct CometElements {
    pub a: f64,
    pub e: f64,
    pub inc_rad: f64,
    pub node_rad: f64,
    pub peri_rad: f64,
}

/// Moon orbital data relative to its parent body.
#[derive(Debug, Clone, PartialEq)]
pub struct MoonParams {
    pub parent_x: f64,
    pub parent_z: f64,
    pub parent_angle: f64,
    pub parent_speed: f64,
    pub parent_distance: f64,
    pub parent_e: f64,
}

/// Parameters for predicting an orbital body's future position in world space.
#[derive(Debug, Clone)]
pub struct OrbitalPredictionParams {
    /// Current world-space position.
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// Angular speed (rad/day).
    pub speed: f64,
    /// Current mean anomaly (rad).
    pub angle: f64,
    /// Days to propagate forward.
    pub days_from_now: f64,
    /// Eccentricity.
    pub e: f64,
    /// Semi-major axis (AU).
    pub distance: f64,
    /// Comet 3D orbital elements, if applicable.
    pub comet: Option<CometElements>,
    /// Moon orbital data, if applicable.
    pub moon: Option<MoonParams>,
}

/// Body data used for deriving star mass via Kepler's third law.
#[derive(Debug, Clone)]
pub struct BodyData {
    pub body_type: String,
    pub distance: f64,
    pub period: f64,
    pub name: Option<String>,
}

/// Result of a Hohmann transfer calculation.
#[derive(Debug, Clone, PartialEq)]
pub struct HohmannResult {
    pub a: f64,
    pub e: f64,
    pub period_years: f64,
    pub transfer_time_days: f64,
}

/// Reason a transfer was considered complete.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArrivalReason {
    Time,
    Distance,
    None,
}

/// Outcome of a transfer arrival check.
#[derive(Debug, Clone, PartialEq)]
pub struct ArrivalResult {
    pub arrived: bool,
    pub reason: ArrivalReason,
}

// ---------------------------------------------------------------------------
// Hohmann transfer
// ---------------------------------------------------------------------------

/// Compute Hohmann transfer parameters between two circular orbits of radii
/// `r1` and `r2` (AU). `star_mass` defaults to 1.0 solar mass.
pub fn hohmann_transfer(r1: f64, r2: f64, star_mass: Option<f64>) -> HohmannResult {
    let m = star_mass.unwrap_or(1.0);
    let a = (r1 + r2) / 2.0;
    let e = (r2 - r1).abs() / (r1 + r2);
    let period_years = kepler_period(a, m);
    let transfer_time_days = (period_years * DAYS_PER_YEAR) / 2.0;
    HohmannResult {
        a,
        e,
        period_years,
        transfer_time_days,
    }
}

// ---------------------------------------------------------------------------
// Simple transfer helpers
// ---------------------------------------------------------------------------

/// Angular velocity (rad/day) for an orbit with period `period_years`.
pub fn transfer_speed(period_years: f64) -> f64 {
    orbit_speed(period_years)
}

/// Starting true-anomaly for a transfer: 0 for outward, π for inward.
pub fn transfer_start_angle(r1: f64, r2: f64) -> f64 {
    if r2 >= r1 {
        0.0
    } else {
        std::f64::consts::PI
    }
}

/// Returns true when `elapsed_days >= transfer_time_days`.
pub fn is_transfer_complete(elapsed_days: f64, transfer_time_days: f64) -> bool {
    elapsed_days >= transfer_time_days
}

/// Game-time transfer duration in days (simplified model: 3 + 3 * |r2 - r1|).
pub fn game_transfer_days(r1: f64, r2: f64) -> f64 {
    3.0 + 3.0 * (r2 - r1).abs()
}

/// Angular speed (rad/day) that traverses π radians in `transfer_days`.
pub fn game_transfer_speed(transfer_days: f64) -> f64 {
    std::f64::consts::PI / transfer_days
}

// ---------------------------------------------------------------------------
// Gravitational parameter and star mass
// ---------------------------------------------------------------------------

/// Gravitational parameter μ in AU³/day² from star mass in solar masses.
///
/// Uses Kepler's third law: T² = 4π²a³/(GM), converting to days.
pub fn compute_mu(star_mass: f64) -> f64 {
    (4.0 * std::f64::consts::PI * std::f64::consts::PI * star_mass)
        / (DAYS_PER_YEAR * DAYS_PER_YEAR)
}

/// Derive star mass from a planet's orbital data using Kepler's third law.
///
/// `starMass = distance³ / period²` (AU, years → solar masses).
/// Returns 1.0 if no suitable planet is found.
pub fn derive_star_mass(bodies: &[BodyData]) -> f64 {
    let planet = bodies.iter().find(|b| {
        (b.body_type == "Planet" || b.body_type == "Dwarf Planet")
            && b.period > 0.0
            && b.distance > 0.0
    });
    match planet {
        Some(p) => p.distance.powi(3) / p.period.powi(2),
        None => 1.0,
    }
}

// ---------------------------------------------------------------------------
// Orbital position prediction
// ---------------------------------------------------------------------------

/// Predict an orbital body's world-space position after `days_from_now`.
///
/// Handles three orbit types:
/// - Comet (3D inclined elements)
/// - Moon (parent + child)
/// - Planet (2D ecliptic)
pub fn predict_orbital_position(p: OrbitalPredictionParams) -> Vec3 {
    if let Some(comet) = &p.comet {
        let future_m = p.angle + p.speed * p.days_from_now;
        let theta = mean_to_true(future_m, comet.e);
        let r = kepler_radius(comet.a, comet.e, theta);
        let r_scaled = scale_dist(r);
        return orbit_to_world(
            r_scaled * theta.cos(),
            r_scaled * theta.sin(),
            comet.inc_rad,
            comet.node_rad,
            comet.peri_rad,
        );
    }

    if let Some(moon) = &p.moon {
        let future_parent_m = moon.parent_angle + moon.parent_speed * p.days_from_now;
        let parent_theta = mean_to_true(future_parent_m, moon.parent_e);
        let parent_kr = kepler_radius(moon.parent_distance, moon.parent_e, parent_theta);
        let parent_r = scale_dist(parent_kr);
        let parent_future_x = parent_theta.cos() * parent_r;
        let parent_future_z = parent_theta.sin() * parent_r;

        let future_moon_m = p.angle + p.speed * p.days_from_now;
        let moon_theta = mean_to_true(future_moon_m, p.e);
        let moon_kr = kepler_radius(p.distance, p.e, moon_theta);
        let moon_r = moon_kr * MOON_DIST_SCALE;
        return Vec3 {
            x: parent_future_x + moon_theta.cos() * moon_r,
            y: 0.0,
            z: parent_future_z + moon_theta.sin() * moon_r,
        };
    }

    // Regular planet: Kepler propagation in the ecliptic plane.
    let future_m = p.angle + p.speed * p.days_from_now;
    let theta = mean_to_true(future_m, p.e);
    let kr = kepler_radius(p.distance, p.e, theta);
    let r = scale_dist(kr);
    Vec3 {
        x: theta.cos() * r,
        y: 0.0,
        z: theta.sin() * r,
    }
}

// ---------------------------------------------------------------------------
// Hermite transfer knots
// ---------------------------------------------------------------------------

/// Compute Hermite spline knots for a transfer between two positions.
///
/// The tangent direction is the unit vector from departure to arrival,
/// scaled by 0.4 × distance. Both tangents are identical (symmetric arc).
pub fn compute_transfer_knots(depart: Vec3, target: Vec3) -> HermiteKnots {
    let dx = target.x - depart.x;
    let dy = target.y - depart.y;
    let dz = target.z - depart.z;
    let dist = (dx * dx + dy * dy + dz * dz).sqrt();
    let inv_dist = if dist > 0.0 { 1.0 / dist } else { 0.0 };
    let ux = dx * inv_dist;
    let uy = dy * inv_dist;
    let uz = dz * inv_dist;
    let tangent_mag = dist * 0.4;
    HermiteKnots {
        p0x: depart.x,
        p0y: depart.y,
        p0z: depart.z,
        t0x: ux * tangent_mag,
        t0y: uy * tangent_mag,
        t0z: uz * tangent_mag,
        p1x: target.x,
        p1y: target.y,
        p1z: target.z,
        t1x: ux * tangent_mag,
        t1y: uy * tangent_mag,
        t1z: uz * tangent_mag,
    }
}

// ---------------------------------------------------------------------------
// Respline
// ---------------------------------------------------------------------------

/// Determine whether a transfer arc needs re-splining based on endpoint drift.
///
/// Returns `true` when `endpoint_delta_sq` exceeds `max(0.25, remaining_dist_sq * 0.01)`.
pub fn should_respline(endpoint_delta_sq: f64, remaining_dist_sq: f64) -> bool {
    endpoint_delta_sq > f64::max(0.25, remaining_dist_sq * 0.01)
}

/// Compute new Hermite knots for a mid-transfer re-spline.
///
/// Preserves the current velocity direction (from derivative) and adjusts
/// the departure tangent scale by `remaining_days / total_days`.
pub fn compute_respline_knots(
    cur_pos: Vec3,
    cur_deriv: Vec3,
    new_target: Vec3,
    remaining_days: f64,
    total_days: f64,
) -> HermiteKnots {
    let dx = new_target.x - cur_pos.x;
    let dy = new_target.y - cur_pos.y;
    let dz = new_target.z - cur_pos.z;
    let dist = (dx * dx + dy * dy + dz * dz).sqrt();
    let inv_dist = if dist > 0.0 { 1.0 / dist } else { 0.0 };
    let tangent_mag = dist * 0.4;
    let scale = remaining_days / f64::max(total_days, 0.01);
    HermiteKnots {
        p0x: cur_pos.x,
        p0y: cur_pos.y,
        p0z: cur_pos.z,
        t0x: cur_deriv.x * scale,
        t0y: cur_deriv.y * scale,
        t0z: cur_deriv.z * scale,
        p1x: new_target.x,
        p1y: new_target.y,
        p1z: new_target.z,
        t1x: dx * inv_dist * tangent_mag,
        t1y: dy * inv_dist * tangent_mag,
        t1z: dz * inv_dist * tangent_mag,
    }
}

// ---------------------------------------------------------------------------
// Capture blend
// ---------------------------------------------------------------------------

/// Apply capture-blend smoothing in the final 15% of a transfer.
///
/// Returns the blended position between the spline point and the
/// station-keeping orbit around the target.
pub fn capture_blend_position(p: Vec3, target_pos: Vec3, station_offset: f64, t_now: f64) -> Vec3 {
    if t_now <= 0.85 {
        return p;
    }
    let blend_raw = (t_now - 0.85) / 0.15;
    let blend = blend_raw * blend_raw * (3.0 - 2.0 * blend_raw); // smoothstep
    let cap_angle = f64::atan2(p.z - target_pos.z, p.x - target_pos.x);
    let cap_x = target_pos.x + cap_angle.cos() * station_offset;
    let cap_z = target_pos.z + cap_angle.sin() * station_offset;
    Vec3 {
        x: p.x + blend * (cap_x - p.x),
        y: p.y + blend * (target_pos.y - p.y),
        z: p.z + blend * (cap_z - p.z),
    }
}

// ---------------------------------------------------------------------------
// Transfer arrival check
// ---------------------------------------------------------------------------

/// Check whether a transfer has arrived at its destination.
///
/// Arrival occurs when elapsed time exceeds the transfer duration
/// (checked first) OR distance is within the station orbit radius.
pub fn check_transfer_arrival(
    elapsed_days: f64,
    transfer_time_days: f64,
    dist_to_target: f64,
    station_orbit: f64,
) -> ArrivalResult {
    if is_transfer_complete(elapsed_days, transfer_time_days) {
        return ArrivalResult {
            arrived: true,
            reason: ArrivalReason::Time,
        };
    }
    if dist_to_target <= station_orbit {
        return ArrivalResult {
            arrived: true,
            reason: ArrivalReason::Distance,
        };
    }
    ArrivalResult {
        arrived: false,
        reason: ArrivalReason::None,
    }
}

// ---------------------------------------------------------------------------
// Distance helpers
// ---------------------------------------------------------------------------

/// Compute real AU distance from world-space position.
/// Reverses the sqrt compression: `au = (worldR / DIST_SCALE)²`.
pub fn body_au_from_position(wx: f64, wy: f64, wz: f64) -> f64 {
    let world_r = (wx * wx + wy * wy + wz * wz).sqrt();
    (world_r / crate::orbit::DIST_SCALE).powi(2)
}

/// Straight-line distance in km between two bodies given their AU distances and
/// world-space positions (used to derive angles).
pub fn distance_km_between(au_a: f64, pos_a: &Vec3, au_b: f64, pos_b: &Vec3) -> f64 {
    let angle_a = pos_a.z.atan2(pos_a.x);
    let angle_b = pos_b.z.atan2(pos_b.x);
    let ax = angle_a.cos() * au_a;
    let az = angle_a.sin() * au_a;
    let bx = angle_b.cos() * au_b;
    let bz = angle_b.sin() * au_b;
    ((bx - ax).powi(2) + (bz - az).powi(2)).sqrt() * crate::ship_physics::AU_TO_KM
}
