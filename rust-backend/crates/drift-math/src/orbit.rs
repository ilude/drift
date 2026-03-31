// Kepler solver, orbital mechanics — ported from src/math/orbit.ts

pub const DIST_SCALE: f64 = 200.0;
pub const MOON_DIST_SCALE: f64 = 25.0;
pub const DAYS_PER_YEAR: f64 = 365.25;

/// World-space 3D position.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// Maps an AU distance to world-space using sqrt compression.
pub fn scale_dist(au: f64) -> f64 {
    au.sqrt() * DIST_SCALE
}

/// Conic-section radius for a Keplerian orbit at true anomaly `theta`.
pub fn kepler_radius(a: f64, e: f64, theta: f64) -> f64 {
    (a * (1.0 - e * e)) / (1.0 + e * theta.cos())
}

/// Angular speed in radians per day for an orbit with the given period in years.
pub fn orbit_speed(period: f64) -> f64 {
    if period <= 0.0 {
        return 0.0;
    }
    std::f64::consts::TAU / (period * DAYS_PER_YEAR)
}

/// Converts mean anomaly `M` (radians) to true anomaly using Newton–Raphson
/// on Kepler's equation.
pub fn mean_to_true(mut m: f64, e: f64) -> f64 {
    // Normalize M to [0, 2π]
    let tau = std::f64::consts::TAU;
    m %= tau;
    if m < 0.0 {
        m += tau;
    }

    // Initial guess: standard for low-e, π for high-e
    let mut eccentric = if e < 0.8 {
        m + e * m.sin()
    } else {
        std::f64::consts::PI
    };

    for _ in 0..20 {
        let denom = 1.0 - e * eccentric.cos();
        if denom.abs() < 1e-12 {
            break;
        }
        let d_e = (eccentric - e * eccentric.sin() - m) / denom;
        eccentric -= d_e;
        if d_e.abs() < 1e-12 {
            break;
        }
    }

    let half_e = eccentric / 2.0;
    2.0 * f64::atan2(
        (1.0 + e).sqrt() * half_e.sin(),
        (1.0 - e).sqrt() * half_e.cos(),
    )
}

/// Orbital period in years for a given semi-major axis in AU and star mass in solar masses.
pub fn kepler_period(dist_au: f64, star_mass: f64) -> f64 {
    (dist_au.powi(3) / star_mass).sqrt()
}

/// Transform orbital-plane (x, z) coordinates to 3D world space.
/// Applies argument of periapsis (peri_rad / ω), inclination (inc_rad / i),
/// and longitude of ascending node (node_rad / Ω) in that order.
pub fn orbit_to_world(x: f64, z: f64, inc_rad: f64, node_rad: f64, peri_rad: f64) -> Vec3 {
    let cos_w = peri_rad.cos();
    let sin_w = peri_rad.sin();
    let x1 = x * cos_w - z * sin_w;
    let z1 = x * sin_w + z * cos_w;

    let cos_i = inc_rad.cos();
    let sin_i = inc_rad.sin();
    let x2 = x1;
    let y2 = z1 * sin_i;
    let z2 = z1 * cos_i;

    let cos_n = node_rad.cos();
    let sin_n = node_rad.sin();
    Vec3 {
        x: x2 * cos_n - z2 * sin_n,
        y: y2,
        z: x2 * sin_n + z2 * cos_n,
    }
}

/// Applies inclination and ascending-node rotation to a planar (x, z) position.
///
/// Arguments are the pre-computed trig values to avoid repeated `cos`/`sin` calls
/// in hot loops.
pub fn inclined_position(x: f64, z: f64, cos_n: f64, sin_n: f64, cos_i: f64, sin_i: f64) -> Vec3 {
    let xn = x * cos_n + z * sin_n;
    let zn = -x * sin_n + z * cos_n;
    let yn = zn * sin_i;
    let zn_tilt = zn * cos_i;
    Vec3 {
        x: xn * cos_n - zn_tilt * sin_n,
        y: yn,
        z: xn * sin_n + zn_tilt * cos_n,
    }
}

/// Planet category based on radius in Earth radii.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlanetCategory {
    Rocky,
    SubNeptune,
    IceGiant,
    GasGiant,
}

/// Estimate planet mass in Earth masses from radius in Earth radii.
/// Log-linear model: rocky (r^3.7), sub-Neptune (2.7*r^1.3), giant (scaled by Jupiter mass).
pub fn radius_to_mass_earths(radius_earths: f64) -> f64 {
    if radius_earths < 1.5 {
        radius_earths.powf(3.7)
    } else if radius_earths < 4.0 {
        2.7 * radius_earths.powf(1.3)
    } else {
        10.0 * (radius_earths / 4.0).powi(2) * 317.8
    }
}

/// Hill sphere radius in AU.
pub fn hill_radius(dist_au: f64, planet_mass_earths: f64, star_mass_solar: f64) -> f64 {
    let mass_ratio = (planet_mass_earths * 3e-6) / star_mass_solar;
    dist_au * (mass_ratio / 3.0).cbrt()
}

/// Categorize a planet by its radius in Earth radii.
pub fn categorize_planet(radius_earths: f64) -> PlanetCategory {
    if radius_earths < 1.8 {
        PlanetCategory::Rocky
    } else if radius_earths < 4.0 {
        PlanetCategory::SubNeptune
    } else if radius_earths < 8.0 {
        PlanetCategory::IceGiant
    } else {
        PlanetCategory::GasGiant
    }
}

/// Generates trail positions by computing orbital positions backwards through time.
///
/// Returns a flat `Vec<f32>` of `[x, y, z, x, y, z, …]` in world space.
/// All positions are planar (`y = 0`). Length is always `max_points * 3`.
pub fn generate_trail_positions(
    base_angle: f64,
    angular_speed: f64,
    eccentricity: f64,
    distance: f64,
    max_points: usize,
) -> Vec<f32> {
    let mut positions = vec![0.0_f32; max_points * 3];

    let step_angle = angular_speed.abs() * 0.02;
    if step_angle == 0.0 {
        return positions;
    }

    for i in 0..max_points {
        let past_angle = base_angle - step_angle * (max_points - i) as f64;
        let theta = mean_to_true(past_angle, eccentricity);
        let kr = kepler_radius(distance, eccentricity, theta);
        let r = scale_dist(kr);
        let i3 = i * 3;
        positions[i3] = (theta.cos() * r) as f32;
        positions[i3 + 1] = 0.0;
        positions[i3 + 2] = (theta.sin() * r) as f32;
    }

    positions
}
