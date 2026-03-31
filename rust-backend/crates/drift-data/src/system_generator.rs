// Procedural star system generation — ported from src/data/system-generator.ts

use drift_math::orbit::{categorize_planet, kepler_period, PlanetCategory};
use drift_math::utils::{
    rng_float, rng_gaussian, rng_int, rng_pick, rng_weighted, seeded_random, Weighted,
};

// ---------------------------------------------------------------------------
// Public data types used by tests (body_type as String, not enum)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct MoonData {
    pub name: String,
    pub distance: f64,
    pub e: f64,
    pub period: f64,
    pub radius: f64,
    pub mass: f64,
    pub color: String,
}

#[derive(Debug, Clone)]
pub struct RingData {
    pub inner: f64,
    pub outer: f64,
    pub color: Option<String>,
    pub opacity: Option<f64>,
    pub tilt: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct BodyData {
    pub name: String,
    pub body_type: String,
    pub distance: f64,
    pub e: f64,
    pub period: f64,
    pub radius: f64,
    pub mass: f64,
    pub color: String,
    pub emissive: Option<bool>,
    pub moons: Vec<MoonData>,
    pub rings: Option<RingData>,
}

#[derive(Debug, Clone)]
pub struct CometData {
    pub name: String,
    pub a: f64,
    pub e: f64,
    pub period: f64,
    pub inc: f64,
    pub node: f64,
    pub peri: f64,
    pub color: String,
    pub mass: f64,
}

#[derive(Debug, Clone)]
pub struct AsteroidBeltData {
    pub name: String,
    pub min_au: f64,
    pub max_au: f64,
    pub count: u32,
    pub color: String,
    pub size: f64,
    pub max_inc: u32,
}

#[derive(Debug, Clone)]
pub struct SystemData {
    pub name: String,
    pub bodies: Vec<BodyData>,
    pub comets: Vec<CometData>,
    pub asteroid_belts: Vec<AsteroidBeltData>,
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

struct BinaryConfig {
    binary_type: &'static str, // "single", "p-type", "s-type"
    secondary: Option<BodyData>,
    #[allow(dead_code)]
    separation: f64,
    max_planet_dist: f64,
    min_planet_dist: f64,
}

struct RawPlanetEntry {
    distance: f64,
    e: f64,
    period: f64,
    radius: f64,
    mass: f64,
    color: String,
    moons: Vec<MoonData>,
    radius_earths: f64,
    category: PlanetCategory,
    assigned_type: &'static str,
}

struct StarResult {
    body: BodyData,
    mass: f64,
    luminosity: f64,
}

struct SpectralType {
    weight: f64,
    mass_min: f64,
    mass_max: f64,
    rad_min: f64,
    rad_max: f64,
    lum_min: f64,
    lum_max: f64,
    color: &'static str,
}

impl Weighted for SpectralType {
    fn weight(&self) -> f64 {
        self.weight
    }
}

struct SystemClass {
    name: &'static str,
    weight: f64,
}

impl Weighted for SystemClass {
    fn weight(&self) -> f64 {
        self.weight
    }
}

struct CatalogPrefix {
    prefix: &'static str,
    weight: f64,
    min: i64,
    max: i64,
}

impl Weighted for CatalogPrefix {
    fn weight(&self) -> f64 {
        self.weight
    }
}

// ---------------------------------------------------------------------------
// Lookup tables
// ---------------------------------------------------------------------------

static SPECTRAL_TYPES: &[SpectralType] = &[
    SpectralType {
        weight: 0.5,
        mass_min: 0.08,
        mass_max: 0.45,
        rad_min: 0.1,
        rad_max: 0.6,
        lum_min: 0.001,
        lum_max: 0.08,
        color: "#ff6633",
    },
    SpectralType {
        weight: 0.2,
        mass_min: 0.45,
        mass_max: 0.8,
        rad_min: 0.6,
        rad_max: 0.9,
        lum_min: 0.08,
        lum_max: 0.6,
        color: "#ff9944",
    },
    SpectralType {
        weight: 0.12,
        mass_min: 0.8,
        mass_max: 1.04,
        rad_min: 0.9,
        rad_max: 1.15,
        lum_min: 0.6,
        lum_max: 1.5,
        color: "#ffdd44",
    },
    SpectralType {
        weight: 0.08,
        mass_min: 1.04,
        mass_max: 1.4,
        rad_min: 1.15,
        rad_max: 1.6,
        lum_min: 1.5,
        lum_max: 5.0,
        color: "#ffffaa",
    },
    SpectralType {
        weight: 0.05,
        mass_min: 1.4,
        mass_max: 2.1,
        rad_min: 1.6,
        rad_max: 2.4,
        lum_min: 5.0,
        lum_max: 25.0,
        color: "#ccddff",
    },
    SpectralType {
        weight: 0.03,
        mass_min: 2.1,
        mass_max: 16.0,
        rad_min: 2.4,
        rad_max: 6.6,
        lum_min: 25.0,
        lum_max: 30000.0,
        color: "#aabbff",
    },
    SpectralType {
        weight: 0.02,
        mass_min: 16.0,
        mass_max: 90.0,
        rad_min: 6.6,
        rad_max: 15.0,
        lum_min: 30000.0,
        lum_max: 1_000_000.0,
        color: "#9999ff",
    },
];

static SYSTEM_CLASSES: &[SystemClass] = &[
    SystemClass {
        name: "peas-in-a-pod",
        weight: 0.4,
    },
    SystemClass {
        name: "solar-like",
        weight: 0.15,
    },
    SystemClass {
        name: "hot-jupiter",
        weight: 0.1,
    },
    SystemClass {
        name: "warm-jupiter-mixed",
        weight: 0.15,
    },
    SystemClass {
        name: "compact-multi",
        weight: 0.1,
    },
    SystemClass {
        name: "giant-dominated",
        weight: 0.1,
    },
];

static CATALOG_PREFIXES: &[CatalogPrefix] = &[
    CatalogPrefix {
        prefix: "HD",
        weight: 0.4,
        min: 100_000,
        max: 399_999,
    },
    CatalogPrefix {
        prefix: "GJ",
        weight: 0.3,
        min: 1_000,
        max: 9_999,
    },
    CatalogPrefix {
        prefix: "HIP",
        weight: 0.3,
        min: 10_000,
        max: 99_999,
    },
];

static PLANET_COLORS_ROCKY: &[&str] = &[
    "#aaaaaa", "#cc5533", "#ddaa66", "#4488cc", "#bb9977", "#ccaa88", "#998877", "#887766",
];
static PLANET_COLORS_SUB_NEPTUNE: &[&str] = &[
    "#88bbcc", "#aaccbb", "#99aacc", "#bbccdd", "#77aaaa", "#88aa99",
];
static PLANET_COLORS_GAS_GIANT: &[&str] = &[
    "#ddaa77", "#ccbb77", "#cc9966", "#ddcc88", "#bbaa66", "#ddbb88",
];
static PLANET_COLORS_ICE_GIANT: &[&str] = &["#88bbcc", "#4466cc", "#6688aa", "#5577bb", "#77aacc"];

static MOON_COLORS: &[&str] = &[
    "#999999", "#887766", "#aaaaaa", "#777788", "#aabbbb", "#99aaaa", "#888888", "#776655",
];

static COMET_COLORS: &[&str] = &[
    "#99ccff", "#aaddff", "#88bbaa", "#bbaaff", "#ccddff", "#ddeeff", "#aa9988", "#998877",
];

static CENTAUR_COLORS: &[&str] = &[
    "#887766", "#776655", "#998877", "#aa6644", "#777788", "#666666", "#885544",
];

static ASTEROID_COLORS: &[&str] = &[
    "#aaaaaa", "#888888", "#777766", "#999988", "#666655", "#bbaa99", "#998888",
];

static BELT_COLORS: &[&str] = &[
    "#555544", "#333344", "#334455", "#443355", "#444433", "#335544",
];

static ROMAN: &[&str] = &["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const EARTH_RADIUS_KM: f64 = 6371.0;
const SOLAR_RADIUS_KM: f64 = 695_700.0;
const SOLAR_MASS_KG: f64 = 1.989e30;

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/// Returns the planet letter for a given 0-based index. Index 0 → "b".
pub fn planet_letter(index: usize) -> String {
    String::from(char::from_u32(98 + index as u32).unwrap_or('?'))
}

/// Estimate mass in kg given radius in km and density in kg/m³.
pub fn estimate_mass(radius_km: f64, density_kg_m3: f64) -> f64 {
    let radius_m = radius_km * 1000.0;
    (4.0 / 3.0) * std::f64::consts::PI * radius_m.powi(3) * density_kg_m3
}

fn planet_color(cat: PlanetCategory, rng: &mut impl FnMut() -> f64) -> String {
    let arr: &[&str] = match cat {
        PlanetCategory::Rocky => PLANET_COLORS_ROCKY,
        PlanetCategory::SubNeptune => PLANET_COLORS_SUB_NEPTUNE,
        PlanetCategory::GasGiant => PLANET_COLORS_GAS_GIANT,
        PlanetCategory::IceGiant => PLANET_COLORS_ICE_GIANT,
    };
    rng_pick(rng, arr).to_string()
}

fn planet_density(cat: PlanetCategory) -> f64 {
    match cat {
        PlanetCategory::Rocky => 5000.0,
        PlanetCategory::SubNeptune => 3000.0,
        PlanetCategory::IceGiant => 1600.0,
        PlanetCategory::GasGiant => 1300.0,
    }
}

// ---------------------------------------------------------------------------
// Internal generators
// ---------------------------------------------------------------------------

fn generate_system_name(rng: &mut impl FnMut() -> f64) -> String {
    let cat = rng_weighted(&mut *rng, CATALOG_PREFIXES);
    let num = rng_int(rng, cat.min, cat.max);
    format!("{} {}", cat.prefix, num)
}

fn generate_star(rng: &mut impl FnMut() -> f64, name: &str) -> StarResult {
    let spec = rng_weighted(&mut *rng, SPECTRAL_TYPES);
    let t = rng();
    let mass = spec.mass_min + t * (spec.mass_max - spec.mass_min);
    let radius = spec.rad_min + t * (spec.rad_max - spec.rad_min);
    let luminosity = spec.lum_min + t * (spec.lum_max - spec.lum_min);

    StarResult {
        body: BodyData {
            name: name.to_string(),
            body_type: "Star".to_string(),
            distance: 0.0,
            e: 0.0,
            period: 0.0,
            radius: (radius * SOLAR_RADIUS_KM).round(),
            mass: mass * SOLAR_MASS_KG,
            color: spec.color.to_string(),
            emissive: Some(true),
            moons: vec![],
            rings: None,
        },
        mass,
        luminosity,
    }
}

fn generate_binary_config(
    rng: &mut impl FnMut() -> f64,
    primary: &StarResult,
    system_name: &str,
) -> BinaryConfig {
    let roll = rng();
    if roll < 0.65 {
        return BinaryConfig {
            binary_type: "single",
            secondary: None,
            separation: 0.0,
            max_planet_dist: f64::INFINITY,
            min_planet_dist: 0.0,
        };
    }

    let is_p = roll >= 0.9;
    let separation = (rng_gaussian(rng) * 0.8 + 50_f64.ln()).exp();
    let clamped_sep = separation.clamp(0.5, 5000.0);
    let mass_ratio = rng_float(rng, 0.1, 1.0);
    let secondary_mass = primary.mass * mass_ratio;

    // Find spectral type for secondary
    let mut sec_spec = &SPECTRAL_TYPES[0];
    for s in SPECTRAL_TYPES {
        if secondary_mass >= s.mass_min && secondary_mass <= s.mass_max {
            sec_spec = s;
            break;
        }
    }
    let t = ((secondary_mass - sec_spec.mass_min)
        / (sec_spec.mass_max - sec_spec.mass_min).max(1e-10))
    .clamp(0.0, 1.0);
    let sec_radius = sec_spec.rad_min + t * (sec_spec.rad_max - sec_spec.rad_min);
    let sec_period = ((clamped_sep.powi(3) / (primary.mass + secondary_mass)).sqrt()).max(0.0);

    let secondary_body = BodyData {
        name: format!("{} B", system_name),
        body_type: "Star".to_string(),
        distance: clamped_sep,
        e: 0.0,
        period: sec_period,
        radius: (sec_radius * SOLAR_RADIUS_KM).round(),
        mass: secondary_mass * SOLAR_MASS_KG,
        color: sec_spec.color.to_string(),
        emissive: Some(true),
        moons: vec![],
        rings: None,
    };

    let max_planet_dist = if is_p {
        f64::INFINITY
    } else {
        clamped_sep / 5.0
    };
    let min_planet_dist = if is_p {
        clamped_sep * rng_float(rng, 2.0, 4.0)
    } else {
        0.0
    };

    BinaryConfig {
        binary_type: if is_p { "p-type" } else { "s-type" },
        secondary: Some(secondary_body),
        separation: clamped_sep,
        max_planet_dist,
        min_planet_dist,
    }
}

fn make_planet_entry(
    rng: &mut impl FnMut() -> f64,
    dist_au: f64,
    radius_earths: f64,
    star_mass: f64,
    assigned_type: &'static str,
) -> RawPlanetEntry {
    let cat = categorize_planet(radius_earths);
    let color = planet_color(cat, rng);
    let radius_km = (radius_earths * EARTH_RADIUS_KM).round();
    let period = kepler_period(dist_au, star_mass);
    let ecc = (rng_float(rng, 0.001, 0.12) * 1000.0).round() / 1000.0;

    RawPlanetEntry {
        distance: (dist_au * 1000.0).round() / 1000.0,
        e: ecc,
        period: (period * 1000.0).round() / 1000.0,
        radius: radius_km,
        mass: estimate_mass(radius_km, planet_density(cat)),
        color,
        moons: vec![],
        radius_earths,
        category: cat,
        assigned_type,
    }
}

fn dwarf_eccentricity(rng: &mut impl FnMut() -> f64, dist_au: f64, outer_planet_dist: f64) -> f64 {
    let ratio = dist_au / outer_planet_dist.max(1e-10);
    if ratio < 2.0 {
        (rng_float(rng, 0.01, 0.15) * 1000.0).round() / 1000.0
    } else if ratio < 5.0 {
        (rng_float(rng, 0.05, 0.3) * 1000.0).round() / 1000.0
    } else {
        (rng_float(rng, 0.2, 0.85) * 1000.0).round() / 1000.0
    }
}

fn apply_binary_constraints(
    planets: Vec<RawPlanetEntry>,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    if binary.binary_type == "single" {
        return planets;
    }
    planets
        .into_iter()
        .filter(|p| p.distance >= binary.min_planet_dist && p.distance <= binary.max_planet_dist)
        .collect()
}

fn generate_peas_in_a_pod(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let count = rng_int(rng, 3, 7) as usize;
    let template_radius = rng_float(rng, 1.2, 3.5);
    let mut dist = rng_float(rng, 0.05, 0.15);
    let mut planets = Vec::new();

    for _ in 0..count {
        let radius = template_radius * rng_float(rng, 0.85, 1.15);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        let period_ratio = rng_float(rng, 1.5, 2.5);
        dist *= period_ratio.powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_solar_like(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    luminosity: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let snow_line = luminosity.sqrt() * 2.7;
    let rocky_count = rng_int(rng, 2, 4) as usize;
    let mut dist = rng_float(rng, 0.3, 0.5);
    let mut planets = Vec::new();

    for _ in 0..rocky_count {
        let radius = rng_float(rng, 0.5, 1.8);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 1.5, 2.5).powf(2.0 / 3.0);
    }

    let giant_count = rng_int(rng, 1, 2) as usize;
    dist = dist.max(snow_line * rng_float(rng, 1.0, 1.5));
    for _ in 0..giant_count {
        let radius = rng_float(rng, 8.0, 12.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 2.0, 3.5).powf(2.0 / 3.0);
    }

    let ice_count = rng_int(rng, 0, 2) as usize;
    for _ in 0..ice_count {
        let radius = rng_float(rng, 3.0, 5.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 2.0, 3.0).powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_hot_jupiter(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let hj_dist = rng_float(rng, 0.02, 0.1);
    let hj_radius = rng_float(rng, 10.0, 15.0);
    let mut planets = vec![make_planet_entry(
        rng, hj_dist, hj_radius, star_mass, "Planet",
    )];

    let comp_count = rng_int(rng, 1, 2) as usize;
    let mut dist = rng_float(rng, 0.3, 1.0);
    for _ in 0..comp_count {
        let radius = rng_float(rng, 0.8, 2.5);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 2.0, 3.0).powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_warm_jupiter_mixed(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let gj_dist = rng_float(rng, 0.5, 3.0);
    let gj_radius = rng_float(rng, 8.0, 12.0);
    let mut planets = vec![make_planet_entry(
        rng, gj_dist, gj_radius, star_mass, "Planet",
    )];

    let inner_count = rng_int(rng, 1, 2) as usize;
    let mut dist = rng_float(rng, 0.05, gj_dist * 0.4);
    for _ in 0..inner_count {
        let radius = rng_float(rng, 0.8, 3.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 1.5, 2.5).powf(2.0 / 3.0);
    }

    let outer_count = rng_int(rng, 1, 2) as usize;
    dist = gj_dist * rng_float(rng, 1.5, 2.5);
    for _ in 0..outer_count {
        let radius = rng_float(rng, 1.0, 4.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 1.5, 2.5).powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_compact_multi(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let count = rng_int(rng, 4, 8) as usize;
    let mut dist = rng_float(rng, 0.02, 0.06);
    let mut planets = Vec::new();

    for _ in 0..count {
        let radius = rng_float(rng, 0.8, 2.5);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 1.3, 2.0).powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_giant_dominated(
    rng: &mut impl FnMut() -> f64,
    star_mass: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let count = rng_int(rng, 2, 3) as usize;
    let mut dist = rng_float(rng, 1.0, 3.0);
    let mut planets = Vec::new();

    for _ in 0..count {
        let radius = rng_float(rng, 6.0, 14.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
        dist *= rng_float(rng, 2.0, 4.0).powf(2.0 / 3.0);
    }

    apply_binary_constraints(planets, binary)
}

fn generate_planets(
    rng: &mut impl FnMut() -> f64,
    system_class: &str,
    star_mass: f64,
    luminosity: f64,
    binary: &BinaryConfig,
) -> Vec<RawPlanetEntry> {
    let mut planets = match system_class {
        "peas-in-a-pod" => generate_peas_in_a_pod(rng, star_mass, binary),
        "solar-like" => generate_solar_like(rng, star_mass, luminosity, binary),
        "hot-jupiter" => generate_hot_jupiter(rng, star_mass, binary),
        "warm-jupiter-mixed" => generate_warm_jupiter_mixed(rng, star_mass, binary),
        "compact-multi" => generate_compact_multi(rng, star_mass, binary),
        "giant-dominated" => generate_giant_dominated(rng, star_mass, binary),
        _ => Vec::new(),
    };

    // Enforce minimum 2 planets
    while planets.len() < 2 {
        let dist = rng_float(rng, 0.5, 3.0);
        let radius = rng_float(rng, 0.8, 2.0);
        planets.push(make_planet_entry(rng, dist, radius, star_mass, "Planet"));
    }

    // Add outer dwarf planets
    let outermost = planets.iter().map(|p| p.distance).fold(0.0_f64, f64::max);
    let mut dwarf_dist = outermost * rng_float(rng, 1.8, 3.0);
    let dwarf_count = rng_int(rng, 2, 5) as usize;
    for _ in 0..dwarf_count {
        let radius = rng_float(rng, 0.05, 0.35);
        let mut p = make_planet_entry(rng, dwarf_dist, radius, star_mass, "Dwarf Planet");
        p.e = dwarf_eccentricity(rng, dwarf_dist, outermost);
        planets.push(p);
        dwarf_dist *= rng_float(rng, 1.3, 2.0);
    }

    // Chance of detached (Sedna-like) object
    if rng() < 0.4 {
        let detached_dist = dwarf_dist * rng_float(rng, 3.0, 10.0);
        let radius = rng_float(rng, 0.03, 0.15);
        let mut p = make_planet_entry(rng, detached_dist, radius, star_mass, "Dwarf Planet");
        p.e = dwarf_eccentricity(rng, detached_dist, outermost);
        planets.push(p);
    }

    planets.sort_by(|a, b| a.distance.partial_cmp(&b.distance).unwrap());
    planets
}

fn generate_moons(
    rng: &mut impl FnMut() -> f64,
    planet_name: &str,
    category: PlanetCategory,
) -> Vec<MoonData> {
    let max_moons = match category {
        PlanetCategory::Rocky => 2,
        PlanetCategory::GasGiant => 6,
        _ => 4,
    };
    let count = rng_int(rng, 0, max_moons) as usize;
    let mut moons = Vec::new();

    for i in 0..count {
        let moon_radius_km = match category {
            PlanetCategory::GasGiant => rng_int(rng, 50, 2500),
            PlanetCategory::Rocky => rng_int(rng, 10, 500),
            _ => rng_int(rng, 30, 1000),
        } as f64;

        let dist = 0.02 + i as f64 * 0.03 + rng() * 0.01;
        let period = 0.001 * (1 + i) as f64 * (0.5 + rng());

        moons.push(MoonData {
            name: format!("{} {}", planet_name, ROMAN[i.min(ROMAN.len() - 1)]),
            distance: (dist * 1000.0).round() / 1000.0,
            e: (rng_float(rng, 0.0, 0.05) * 1000.0).round() / 1000.0,
            period: (period * 100_000.0).round() / 100_000.0,
            radius: moon_radius_km,
            mass: estimate_mass(moon_radius_km, 3000.0),
            color: rng_pick(rng, MOON_COLORS).to_string(),
        });
    }

    moons
}

fn generate_centaurs(
    rng: &mut impl FnMut() -> f64,
    planets: &[RawPlanetEntry],
    star_mass: f64,
) -> Vec<RawPlanetEntry> {
    let giants: Vec<&RawPlanetEntry> = planets
        .iter()
        .filter(|p| p.radius_earths > 4.0 && p.assigned_type == "Planet")
        .collect();

    if giants.is_empty() {
        return vec![];
    }

    let inner_giant = giants
        .iter()
        .map(|g| g.distance)
        .fold(f64::INFINITY, f64::min);
    let outer_giant = giants.iter().map(|g| g.distance).fold(0.0_f64, f64::max);
    let min_dist = inner_giant * 0.8;
    let max_dist = outer_giant * 1.2;

    if max_dist - min_dist < 1.0 {
        return vec![];
    }

    let count = rng_int(rng, 1, 5) as usize;
    let mut centaurs = Vec::new();

    for _ in 0..count {
        let dist = rng_float(rng, min_dist, max_dist);
        let radius_km = rng_int(rng, 10, 130) as f64;
        centaurs.push(RawPlanetEntry {
            distance: (dist * 1000.0).round() / 1000.0,
            e: (rng_float(rng, 0.1, 0.6) * 1000.0).round() / 1000.0,
            period: (kepler_period(dist, star_mass) * 1000.0).round() / 1000.0,
            radius: radius_km,
            mass: estimate_mass(radius_km, 1000.0),
            color: rng_pick(rng, CENTAUR_COLORS).to_string(),
            moons: vec![],
            radius_earths: radius_km / EARTH_RADIUS_KM,
            category: PlanetCategory::Rocky,
            assigned_type: "Centaur",
        });
    }

    centaurs
}

fn generate_named_asteroids(
    rng: &mut impl FnMut() -> f64,
    belts: &[AsteroidBeltData],
    star_mass: f64,
) -> Vec<RawPlanetEntry> {
    if belts.is_empty() {
        return vec![];
    }
    let mut asteroids = Vec::new();

    for belt in belts {
        let count = rng_int(rng, 2, 4) as usize;
        for i in 0..count {
            let dist = rng_float(rng, belt.min_au, belt.max_au);
            let max_r = if i == 0 {
                300
            } else if i == 1 {
                200
            } else {
                100
            };
            let radius_km = rng_int(rng, 5, max_r) as f64;
            let mut moons = Vec::new();
            if rng() < 0.15 {
                let moon_r = rng_int(rng, 1, 1.max((radius_km * 0.1).round() as i64)) as f64;
                moons.push(MoonData {
                    name: String::new(),
                    distance: 0.02,
                    e: (rng_float(rng, 0.0, 0.05) * 1000.0).round() / 1000.0,
                    period: (0.001 * (0.5 + rng()) * 100_000.0).round() / 100_000.0,
                    radius: moon_r,
                    mass: estimate_mass(moon_r, 3000.0),
                    color: rng_pick(rng, MOON_COLORS).to_string(),
                });
            }
            asteroids.push(RawPlanetEntry {
                distance: (dist * 1000.0).round() / 1000.0,
                e: (rng_float(rng, 0.01, 0.35) * 1000.0).round() / 1000.0,
                period: (kepler_period(dist, star_mass) * 1000.0).round() / 1000.0,
                radius: radius_km,
                mass: estimate_mass(radius_km, 4000.0),
                color: rng_pick(rng, ASTEROID_COLORS).to_string(),
                moons,
                radius_earths: radius_km / EARTH_RADIUS_KM,
                category: PlanetCategory::Rocky,
                assigned_type: "Asteroid",
            });
        }
    }

    asteroids
}

fn generate_asteroid_belts(
    rng: &mut impl FnMut() -> f64,
    planets: &[RawPlanetEntry],
    system_name: &str,
) -> Vec<AsteroidBeltData> {
    let mut belts = Vec::new();

    // Find largest gas giant
    let largest_giant = planets
        .iter()
        .filter(|p| p.radius_earths > 6.0)
        .max_by(|a, b| a.radius_earths.partial_cmp(&b.radius_earths).unwrap());

    // Inner belt if giant exists beyond 1.5 AU
    if let Some(giant) = largest_giant {
        if giant.distance > 1.5 {
            let inner_edge = giant.distance * rng_float(rng, 0.35, 0.45);
            let outer_edge = giant.distance * rng_float(rng, 0.55, 0.65);
            if outer_edge - inner_edge > 0.3 {
                belts.push(AsteroidBeltData {
                    name: format!("{} Inner Belt", system_name),
                    min_au: (inner_edge * 100.0).round() / 100.0,
                    max_au: (outer_edge * 100.0).round() / 100.0,
                    count: rng_int(rng, 800, 1800) as u32,
                    color: rng_pick(rng, BELT_COLORS).to_string(),
                    size: 0.25,
                    max_inc: rng_int(rng, 1, 3) as u32,
                });
            }
        }
    }

    // Outer belt complex (Kuiper analog)
    let outermost = planets.last();
    if let Some(outer) = outermost {
        if outer.distance > 3.0 {
            let base_inner = outer.distance * rng_float(rng, 1.2, 1.4);
            let base_outer = outer.distance * rng_float(rng, 1.8, 2.5);

            let cold_inner = base_inner * rng_float(rng, 1.0, 1.1);
            let cold_outer = base_inner * rng_float(rng, 1.2, 1.4);
            belts.push(AsteroidBeltData {
                name: format!("{} Outer Belt - Cold", system_name),
                min_au: (cold_inner * 100.0).round() / 100.0,
                max_au: (cold_outer * 100.0).round() / 100.0,
                count: rng_int(rng, 800, 1600) as u32,
                color: rng_pick(rng, BELT_COLORS).to_string(),
                size: 0.3,
                max_inc: rng_int(rng, 1, 2) as u32,
            });

            belts.push(AsteroidBeltData {
                name: format!("{} Outer Belt - Hot", system_name),
                min_au: (base_inner * 100.0).round() / 100.0,
                max_au: (base_outer * 100.0).round() / 100.0,
                count: rng_int(rng, 600, 1400) as u32,
                color: rng_pick(rng, BELT_COLORS).to_string(),
                size: 0.3,
                max_inc: rng_int(rng, 3, 5) as u32,
            });

            if rng() < 0.7 {
                let res_inner = cold_inner * rng_float(rng, 0.9, 1.0);
                let res_outer = cold_outer * rng_float(rng, 1.0, 1.1);
                belts.push(AsteroidBeltData {
                    name: format!("{} Outer Belt - Resonant", system_name),
                    min_au: (res_inner * 100.0).round() / 100.0,
                    max_au: (res_outer * 100.0).round() / 100.0,
                    count: rng_int(rng, 300, 800) as u32,
                    color: rng_pick(rng, BELT_COLORS).to_string(),
                    size: 0.3,
                    max_inc: rng_int(rng, 2, 4) as u32,
                });
            }
        } else if largest_giant.is_none() {
            let mid_dist = outer.distance * 1.5;
            let inner = mid_dist * 0.8;
            let outer_belt = mid_dist * 1.2;
            belts.push(AsteroidBeltData {
                name: format!("{} Debris Belt", system_name),
                min_au: (inner * 100.0).round() / 100.0,
                max_au: (outer_belt * 100.0).round() / 100.0,
                count: rng_int(rng, 500, 1000) as u32,
                color: rng_pick(rng, BELT_COLORS).to_string(),
                size: 0.25,
                max_inc: rng_int(rng, 1, 5) as u32,
            });
        }
    } else if largest_giant.is_none() {
        let mid_dist = 3.0_f64;
        let inner = mid_dist * 0.8;
        let outer_belt = mid_dist * 1.2;
        belts.push(AsteroidBeltData {
            name: format!("{} Debris Belt", system_name),
            min_au: (inner * 100.0).round() / 100.0,
            max_au: (outer_belt * 100.0).round() / 100.0,
            count: rng_int(rng, 500, 1000) as u32,
            color: rng_pick(rng, BELT_COLORS).to_string(),
            size: 0.25,
            max_inc: rng_int(rng, 1, 5) as u32,
        });
    }

    belts
}

fn generate_comets(
    rng: &mut impl FnMut() -> f64,
    outer_edge_au: f64,
    star_mass: f64,
    system_name: &str,
) -> Vec<CometData> {
    let count = rng_int(rng, 3, 10) as usize;
    let mut comets = Vec::new();

    for i in 0..count {
        let a = rng_float(rng, 10.0, (500.0_f64).max(outer_edge_au * 3.0));
        let e = rng_float(rng, 0.8, 0.999);
        let period = (a.powi(3) / star_mass).sqrt();

        comets.push(CometData {
            name: format!("{}-C{}", system_name, i + 1),
            a,
            e,
            period: (period * 100.0).round() / 100.0,
            inc: rng_float(rng, 1.0, 5.0),
            node: rng_float(rng, 0.0, 360.0),
            peri: rng_float(rng, 0.0, 360.0),
            color: rng_pick(rng, COMET_COLORS).to_string(),
            mass: estimate_mass(rng() * 5.0 + 1.0, 500.0),
        });
    }

    comets
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/// Generate a procedural star system from a seed.
pub fn generate_system(seed: u64) -> SystemData {
    let mut rng = seeded_random(seed as i64);
    let system_name = generate_system_name(&mut rng);

    let primary = generate_star(&mut rng, &system_name);
    let star_mass = primary.mass;
    let luminosity = primary.luminosity;

    let binary = generate_binary_config(&mut rng, &primary, &system_name);
    let system_class = rng_weighted(&mut rng, SYSTEM_CLASSES).name;

    let raw_planets = generate_planets(&mut rng, system_class, star_mass, luminosity, &binary);

    // Build bodies list
    let mut bodies: Vec<BodyData> = vec![primary.body];

    if let Some(sec) = binary.secondary {
        bodies.push(sec);
    }

    // Named planets, dwarf planets, centaurs in rawPlanets
    for (i, p) in raw_planets.iter().enumerate() {
        let letter = planet_letter(i);
        let name = format!("{} {}", system_name, letter);
        let body_type = p.assigned_type.to_string();

        let mass = match p.assigned_type {
            "Dwarf Planet" => estimate_mass(p.radius, 2000.0),
            "Centaur" => estimate_mass(p.radius, 1000.0),
            "Asteroid" => estimate_mass(p.radius, 4000.0),
            _ => p.mass,
        };

        let moons = generate_moons(&mut rng, &name, p.category);

        bodies.push(BodyData {
            name,
            body_type,
            distance: p.distance,
            e: p.e,
            period: p.period,
            radius: p.radius,
            mass,
            color: p.color.clone(),
            emissive: None,
            moons,
            rings: None,
        });
    }

    let outer_edge = raw_planets.last().map(|p| p.distance).unwrap_or(5.0);
    let asteroid_belts = generate_asteroid_belts(&mut rng, &raw_planets, &system_name);

    // Centaurs
    let centaurs = generate_centaurs(&mut rng, &raw_planets, star_mass);
    for (i, c) in centaurs.iter().enumerate() {
        bodies.push(BodyData {
            name: format!("{}-Cn{}", system_name, i + 1),
            body_type: "Centaur".to_string(),
            distance: c.distance,
            e: c.e,
            period: c.period,
            radius: c.radius,
            mass: c.mass,
            color: c.color.clone(),
            emissive: None,
            moons: vec![],
            rings: None,
        });
    }

    // Named asteroids
    let named_asteroids = generate_named_asteroids(&mut rng, &asteroid_belts, star_mass);
    for (i, a) in named_asteroids.iter().enumerate() {
        let name = format!("{}-A{}", system_name, i + 1);
        let moons = a
            .moons
            .iter()
            .enumerate()
            .map(|(mi, m)| MoonData {
                name: format!("{} {}", name, ROMAN[mi.min(ROMAN.len() - 1)]),
                ..m.clone()
            })
            .collect();
        bodies.push(BodyData {
            name,
            body_type: "Asteroid".to_string(),
            distance: a.distance,
            e: a.e,
            period: a.period,
            radius: a.radius,
            mass: a.mass,
            color: a.color.clone(),
            emissive: None,
            moons,
            rings: None,
        });
    }

    let comets = generate_comets(&mut rng, outer_edge, star_mass, &system_name);

    SystemData {
        name: format!("{} System", system_name),
        bodies,
        comets,
        asteroid_belts,
    }
}
