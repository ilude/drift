// Rocket equation, brachistochrone, fuel costs — ported from src/math/ship-physics.ts

// --- Constants ---

pub const AU_TO_KM: f64 = 149_597_870.7;
pub const G_ACCEL: f64 = 9.80665; // m/s², standard gravity
pub const MU_SUN_KM3_S2: f64 = 1.327_124_400_18e11;
pub const OP_BURN_RATE: f64 = 0.001; // 0.1%/day

// --- Types ---

#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct ShipPhysicsState {
    pub fuel_kg: f64,
    pub dry_mass_kg: f64,
    pub accel_g: f64,
    pub isp_s: f64,
    pub fuel_mod: f64,
}

#[derive(Debug, Clone)]
pub struct EngineType {
    pub id: &'static str,
    pub name: &'static str,
    pub accel_g: f64,
    pub isp_s: f64,
    pub dry_mass_kg: f64,
}

#[derive(Debug, Clone)]
pub struct HohmannDeltaVResult {
    pub dv_depart: f64,
    pub dv_arrive: f64,
    pub dv_total: f64,
}

#[derive(Debug, Clone)]
pub struct FuelCostResult {
    pub rocket_fuel_kg: f64,
    pub op_burn_kg: f64,
    pub total_fuel_kg: f64,
    pub transfer_days: f64,
}

#[derive(Debug, Clone)]
pub struct ThrottleResult {
    pub accel_g: f64,
    pub total_fuel_kg: f64,
    pub transfer_days: f64,
}

#[derive(Debug, Clone)]
pub struct TransferResult {
    pub feasible: bool,
    pub delta_v_required: f64,
    pub delta_v_available: f64,
    pub fuel_used_kg: f64,
    pub transfer_days: f64,
}

// --- Conversions ---

/// Gravitational parameter in km³/s² for a star of given solar masses.
pub fn mu_km_s(solar_masses: f64) -> f64 {
    MU_SUN_KM3_S2 * solar_masses
}

/// Exhaust velocity (m/s) from specific impulse (seconds). ve = Isp * g0
pub fn exhaust_velocity(isp_s: f64) -> f64 {
    isp_s * G_ACCEL
}

// --- Tsiolkovsky rocket equation ---

/// Delta-v from the rocket equation (km/s).
pub fn rocket_delta_v(ve_km_s: f64, wet_mass_kg: f64, dry_mass_kg: f64) -> f64 {
    if wet_mass_kg <= dry_mass_kg || dry_mass_kg <= 0.0 {
        return 0.0;
    }
    ve_km_s * (wet_mass_kg / dry_mass_kg).ln()
}

/// Fuel required (kg) to achieve a given delta-v.
/// Inverse of rocket_delta_v: fuel_kg = dry_mass * (e^(dv/ve) - 1)
pub fn fuel_required(ve_km_s: f64, dry_mass_kg: f64, dv_km_s: f64) -> f64 {
    if ve_km_s <= 0.0 || dry_mass_kg <= 0.0 || dv_km_s <= 0.0 {
        return 0.0;
    }
    dry_mass_kg * ((dv_km_s / ve_km_s).exp() - 1.0)
}

// --- Hohmann transfer math ---

/// Hohmann transfer delta-v between two circular orbits.
pub fn hohmann_delta_v(r1_au: f64, r2_au: f64, star_mass_solar: f64) -> HohmannDeltaVResult {
    let mu = mu_km_s(star_mass_solar);
    let r1 = r1_au * AU_TO_KM;
    let r2 = r2_au * AU_TO_KM;

    let v1_circ = (mu / r1).sqrt();
    let v2_circ = (mu / r2).sqrt();

    let a_transfer = (r1 + r2) / 2.0;

    let v1_transfer = (mu * (2.0 / r1 - 1.0 / a_transfer)).sqrt();
    let v2_transfer = (mu * (2.0 / r2 - 1.0 / a_transfer)).sqrt();

    let dv_depart = (v1_transfer - v1_circ).abs();
    let dv_arrive = (v2_circ - v2_transfer).abs();
    let dv_total = dv_depart + dv_arrive;

    HohmannDeltaVResult {
        dv_depart,
        dv_arrive,
        dv_total,
    }
}

/// Hohmann transfer time in days.
pub fn hohmann_transfer_days(r1_au: f64, r2_au: f64, star_mass_solar: f64) -> f64 {
    let mu = mu_km_s(star_mass_solar);
    let r1 = r1_au * AU_TO_KM;
    let r2 = r2_au * AU_TO_KM;
    let a_transfer = (r1 + r2) / 2.0;

    let t = std::f64::consts::PI * (a_transfer.powi(3) / mu).sqrt();
    t / 86400.0
}

// --- Brachistochrone transfer math ---

/// Brachistochrone transfer time from straight-line distance in km.
pub fn brachistochrone_time_km(dist_km: f64, accel_ms2: f64) -> f64 {
    let d = dist_km * 1000.0; // meters
    let t = 2.0 * (d / accel_ms2).sqrt(); // seconds
    t / 86400.0 // days
}

/// Brachistochrone delta-v from straight-line distance in km.
pub fn brachistochrone_delta_v_km(dist_km: f64, accel_ms2: f64) -> f64 {
    let d = dist_km * 1000.0; // meters
    let dv = 2.0 * (d * accel_ms2).sqrt(); // m/s
    dv / 1000.0 // km/s
}

/// AU-based wrapper: brachistochrone transfer time between two orbital radii.
pub fn brachistochrone_time(r1_au: f64, r2_au: f64, accel_ms2: f64) -> f64 {
    brachistochrone_time_km((r2_au - r1_au).abs() * AU_TO_KM, accel_ms2)
}

/// AU-based wrapper: brachistochrone delta-v between two orbital radii.
pub fn brachistochrone_delta_v(r1_au: f64, r2_au: f64, accel_ms2: f64) -> f64 {
    brachistochrone_delta_v_km((r2_au - r1_au).abs() * AU_TO_KM, accel_ms2)
}

// --- Total fuel cost model ---

/// Compute total fuel cost for a brachistochrone transfer (additive model).
/// Returns rocket-equation fuel + operational burn as separate and combined values.
pub fn compute_total_fuel_cost(
    dist_km: f64,
    accel_g: f64,
    isp_s: f64,
    dry_mass_kg: f64,
    fuel_capacity_kg: f64,
    op_burn_multiplier: f64,
    fuel_mod: f64,
) -> FuelCostResult {
    let accel_ms2 = accel_g * G_ACCEL;
    let dv_km_s = brachistochrone_delta_v_km(dist_km, accel_ms2);
    let ve_km_s = exhaust_velocity(isp_s) / 1000.0;
    let rocket_fuel_kg = fuel_required(ve_km_s, dry_mass_kg, dv_km_s) * fuel_mod;
    let transfer_days = brachistochrone_time_km(dist_km, accel_ms2);
    let accel_stress = 1.0 + accel_g.log10().max(0.0) * 0.15;
    let op_burn_kg = (OP_BURN_RATE * fuel_capacity_kg * transfer_days * accel_stress)
        / op_burn_multiplier.max(0.01);

    FuelCostResult {
        rocket_fuel_kg,
        op_burn_kg,
        total_fuel_kg: rocket_fuel_kg + op_burn_kg,
        transfer_days,
    }
}

/// Binary-search for the highest acceleration a ship can afford for a transfer.
/// Returns None if even minimum acceleration exceeds the fuel budget.
#[allow(clippy::too_many_arguments)]
pub fn find_affordable_accel_g(
    dist_km: f64,
    isp_s: f64,
    dry_mass_kg: f64,
    fuel_capacity_kg: f64,
    max_accel_g: f64,
    fuel_budget_kg: f64,
    op_burn_multiplier: f64,
    fuel_mod: f64,
    min_accel_g: f64,
) -> Option<ThrottleResult> {
    let fc = |accel: f64| {
        compute_total_fuel_cost(
            dist_km,
            accel,
            isp_s,
            dry_mass_kg,
            fuel_capacity_kg,
            op_burn_multiplier,
            fuel_mod,
        )
    };

    let max_cost = fc(max_accel_g);
    if max_cost.total_fuel_kg <= fuel_budget_kg {
        return Some(ThrottleResult {
            accel_g: max_accel_g,
            total_fuel_kg: max_cost.total_fuel_kg,
            transfer_days: max_cost.transfer_days,
        });
    }

    if fc(min_accel_g).total_fuel_kg > fuel_budget_kg {
        return None;
    }

    let mut lo = min_accel_g;
    let mut hi = max_accel_g;
    for _ in 0..20 {
        let mid = (lo + hi) / 2.0;
        if fc(mid).total_fuel_kg <= fuel_budget_kg {
            lo = mid;
        } else {
            hi = mid;
        }
    }
    let final_cost = fc(lo);
    Some(ThrottleResult {
        accel_g: lo,
        total_fuel_kg: final_cost.total_fuel_kg,
        transfer_days: final_cost.transfer_days,
    })
}

// --- Engine presets (Trans-Newtonian) ---

pub const ENGINE_TYPES: &[EngineType] = &[
    EngineType {
        id: "conventional",
        name: "Nuclear Thermal Engine",
        accel_g: 0.1,
        isp_s: 1_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "nuclear-pulse",
        name: "Nuclear Pulse Engine",
        accel_g: 0.3,
        isp_s: 800_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "ion-drive",
        name: "Ion Drive",
        accel_g: 0.02,
        isp_s: 5_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "magneto-drive",
        name: "Magnetospheric Drive",
        accel_g: 0.08,
        isp_s: 100_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "icf-drive",
        name: "ICF Drive",
        accel_g: 1.0,
        isp_s: 3_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "mcf-drive",
        name: "MCF Drive",
        accel_g: 2.0,
        isp_s: 4_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "plasma-drive",
        name: "Plasma Drive",
        accel_g: 5.0,
        isp_s: 6_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "am-solid",
        name: "AM Solid-Core Drive",
        accel_g: 10.0,
        isp_s: 8_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "am-gas",
        name: "AM Gas-Core Drive",
        accel_g: 20.0,
        isp_s: 9_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "am-plasma",
        name: "AM Plasma-Core Drive",
        accel_g: 40.0,
        isp_s: 10_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "am-beam",
        name: "AM Beam-Core Drive",
        accel_g: 15.0,
        isp_s: 15_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "gravity-drive",
        name: "Gravity Drive",
        accel_g: 5.0,
        isp_s: 100_000_000.0,
        dry_mass_kg: 5_000.0,
    },
    EngineType {
        id: "photonic-drive",
        name: "Photonic Drive",
        accel_g: 0.5,
        isp_s: 100_000_000.0,
        dry_mass_kg: 5_000.0,
    },
];

// --- Transfer feasibility check ---

/// AU-based wrapper: check transfer feasibility between two orbital radii.
pub fn check_transfer(
    r1_au: f64,
    r2_au: f64,
    _star_mass_solar: f64,
    ship_state: &ShipPhysicsState,
) -> TransferResult {
    check_transfer_km((r2_au - r1_au).abs() * AU_TO_KM, ship_state)
}

/// Check transfer feasibility using straight-line distance in km.
pub fn check_transfer_km(dist_km: f64, ship_state: &ShipPhysicsState) -> TransferResult {
    let accel_ms2 = ship_state.accel_g * G_ACCEL;
    let dv_total = brachistochrone_delta_v_km(dist_km, accel_ms2);
    let ve_km_s = exhaust_velocity(ship_state.isp_s) / 1000.0;
    let wet_mass = ship_state.dry_mass_kg + ship_state.fuel_kg;
    let delta_v_available = rocket_delta_v(ve_km_s, wet_mass, ship_state.dry_mass_kg);
    let fuel_used_kg = fuel_required(ve_km_s, ship_state.dry_mass_kg, dv_total);
    let transfer_days = brachistochrone_time_km(dist_km, accel_ms2);

    let feasible = dv_total <= delta_v_available && fuel_used_kg <= ship_state.fuel_kg;

    TransferResult {
        feasible,
        delta_v_required: dv_total,
        delta_v_available,
        fuel_used_kg,
        transfer_days,
    }
}
