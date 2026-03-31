// Resource catalog and deposit generation — ported from src/data/resources.ts

use drift_math::utils::seeded_random;
use drift_types::ResourceDeposit;

// ---------------------------------------------------------------------------
// Resource definition
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
pub struct ResourceDef {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub symbol: &'static str,
    pub description: &'static str,
    pub minable: bool,
}

// ---------------------------------------------------------------------------
// Catalog (24 entries)
// ---------------------------------------------------------------------------

pub const RESOURCES: &[ResourceDef] = &[
    // Metals (5)
    ResourceDef {
        id: "iron",
        name: "Iron",
        category: "metal",
        symbol: "Fe",
        description: "Primary structural metal",
        minable: true,
    },
    ResourceDef {
        id: "copper",
        name: "Copper",
        category: "metal",
        symbol: "Cu",
        description: "Wiring, electronics",
        minable: true,
    },
    ResourceDef {
        id: "aluminum",
        name: "Aluminum",
        category: "metal",
        symbol: "Al",
        description: "Lightweight structures",
        minable: true,
    },
    ResourceDef {
        id: "titanium",
        name: "Titanium",
        category: "metal",
        symbol: "Ti",
        description: "High-strength alloys",
        minable: true,
    },
    ResourceDef {
        id: "palladium",
        name: "Palladium",
        category: "metal",
        symbol: "Pd",
        description: "Catalysts, hydrogen storage, precision electronics",
        minable: true,
    },
    // Industrial (4)
    ResourceDef {
        id: "silicon",
        name: "Silicon",
        category: "industrial",
        symbol: "Si",
        description: "Semiconductors, solar cells",
        minable: true,
    },
    ResourceDef {
        id: "carbon",
        name: "Carbon",
        category: "industrial",
        symbol: "C",
        description: "Composites, organic chemistry",
        minable: true,
    },
    ResourceDef {
        id: "rare-earth",
        name: "Lanthanides",
        category: "industrial",
        symbol: "Ln",
        description: "Magnets, advanced electronics",
        minable: true,
    },
    ResourceDef {
        id: "phosphorus",
        name: "Phosphorus",
        category: "industrial",
        symbol: "P",
        description: "Agriculture, chemical processes",
        minable: true,
    },
    // Volatiles (3)
    ResourceDef {
        id: "water",
        name: "Water",
        category: "volatile",
        symbol: "H2O",
        description: "Life support, propellant, industrial solvent",
        minable: true,
    },
    ResourceDef {
        id: "nitrogen",
        name: "Nitrogen",
        category: "volatile",
        symbol: "N",
        description: "Atmospherics, agriculture",
        minable: true,
    },
    ResourceDef {
        id: "methane",
        name: "Methane",
        category: "volatile",
        symbol: "CH4",
        description: "Plastics, chemical feedstock, propellant",
        minable: true,
    },
    // Radioactive (4)
    ResourceDef {
        id: "uranium",
        name: "Uranium",
        category: "radioactive",
        symbol: "U",
        description: "Natural fission fuel, baseline power",
        minable: true,
    },
    ResourceDef {
        id: "thorium",
        name: "Thorium",
        category: "radioactive",
        symbol: "Th",
        description: "Alternative fission cycle, safer reactors",
        minable: true,
    },
    ResourceDef {
        id: "plutonium",
        name: "Plutonium",
        category: "radioactive",
        symbol: "Pu",
        description: "Bred from uranium in breeder reactors",
        minable: false,
    },
    ResourceDef {
        id: "tritium",
        name: "Tritium",
        category: "radioactive",
        symbol: "T",
        description: "Bred from lithium/heavy water; fusion booster",
        minable: false,
    },
    // Umbral (8)
    ResourceDef {
        id: "ortheum",
        name: "Ortheum",
        category: "umbral",
        symbol: "Or",
        description: "Stable post-baryonic substrate; FTL navigation, gate alignment",
        minable: true,
    },
    ResourceDef {
        id: "cadrine",
        name: "Cadrine",
        category: "umbral",
        symbol: "Cr",
        description: "Curvature-responsive heavy material; gravitic drives, tractor systems",
        minable: true,
    },
    ResourceDef {
        id: "vantine",
        name: "Vantine",
        category: "umbral",
        symbol: "Vt",
        description: "Low-cross-section interaction medium; stealth, ECM",
        minable: true,
    },
    ResourceDef {
        id: "nemorin",
        name: "Nemorin",
        category: "umbral",
        symbol: "Nm",
        description: "Metastable condensate host; shields, capacitors",
        minable: true,
    },
    ResourceDef {
        id: "caritene",
        name: "Caritene",
        category: "umbral",
        symbol: "Ct",
        description: "Dense shear-resistant lattice; armor, structural reinforcement",
        minable: true,
    },
    ResourceDef {
        id: "heliate",
        name: "Heliate",
        category: "umbral",
        symbol: "Hl",
        description: "Energetic transfer medium; reactors, beam weapons",
        minable: true,
    },
    ResourceDef {
        id: "tessarene",
        name: "Tessarene",
        category: "umbral",
        symbol: "Ts",
        description: "Topological-active crystal; jump cores, phase weapons",
        minable: true,
    },
    ResourceDef {
        id: "istrium",
        name: "Istrium",
        category: "umbral",
        symbol: "Is",
        description: "Unstable transitory from collapse events; torpedoes, singularity weapons",
        minable: true,
    },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

pub fn get_resource_def(id: &str) -> Option<&'static ResourceDef> {
    RESOURCES.iter().find(|r| r.id == id)
}

pub fn get_resources_by_category(category: &str) -> Vec<&'static ResourceDef> {
    RESOURCES
        .iter()
        .filter(|r| r.category == category)
        .collect()
}

pub fn get_minable_resources() -> Vec<&'static ResourceDef> {
    RESOURCES.iter().filter(|r| r.minable).collect()
}

// ---------------------------------------------------------------------------
// Deposit generation
// ---------------------------------------------------------------------------

struct WeightedResource {
    id: &'static str,
    weight: f64,
}

fn name_hash(s: &str) -> i64 {
    let mut h: i64 = 5381;
    for c in s.bytes() {
        h = ((h << 5).wrapping_add(h).wrapping_add(c as i64)) & 0x7fff_ffff;
    }
    h
}

fn survey_level_from_access(accessibility: f64) -> u32 {
    if accessibility >= 0.5 {
        1
    } else if accessibility >= 0.2 {
        2
    } else {
        3
    }
}

fn pick_weighted(rng: &mut impl FnMut() -> f64, pool: &[WeightedResource]) -> &'static str {
    let total: f64 = pool.iter().map(|e| e.weight).sum();
    let mut r = rng() * total;
    for entry in pool {
        r -= entry.weight;
        if r <= 0.0 {
            return entry.id;
        }
    }
    pool.last().expect("pool must not be empty").id
}

const FROST_LINE_AU: f64 = 2.7;

fn planet_pool(radius: f64, dist: f64) -> &'static [WeightedResource] {
    if radius > 30_000.0 {
        // Gas giant
        return &[
            WeightedResource {
                id: "heliate",
                weight: 35.0,
            },
            WeightedResource {
                id: "methane",
                weight: 15.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 10.0,
            },
            WeightedResource {
                id: "water",
                weight: 5.0,
            },
            WeightedResource {
                id: "iron",
                weight: 3.0,
            },
            WeightedResource {
                id: "ortheum",
                weight: 6.0,
            },
            WeightedResource {
                id: "cadrine",
                weight: 5.0,
            },
            WeightedResource {
                id: "nemorin",
                weight: 2.0,
            },
        ];
    }
    if radius > 15_000.0 {
        // Ice giant
        return &[
            WeightedResource {
                id: "water",
                weight: 25.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 15.0,
            },
            WeightedResource {
                id: "methane",
                weight: 15.0,
            },
            WeightedResource {
                id: "heliate",
                weight: 18.0,
            },
            WeightedResource {
                id: "carbon",
                weight: 5.0,
            },
            WeightedResource {
                id: "iron",
                weight: 5.0,
            },
            WeightedResource {
                id: "ortheum",
                weight: 5.0,
            },
            WeightedResource {
                id: "nemorin",
                weight: 4.0,
            },
            WeightedResource {
                id: "cadrine",
                weight: 3.0,
            },
            WeightedResource {
                id: "tessarene",
                weight: 3.0,
            },
            WeightedResource {
                id: "vantine",
                weight: 2.0,
            },
        ];
    }
    if dist > FROST_LINE_AU {
        // Cold rocky
        return &[
            WeightedResource {
                id: "iron",
                weight: 18.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 10.0,
            },
            WeightedResource {
                id: "aluminum",
                weight: 8.0,
            },
            WeightedResource {
                id: "copper",
                weight: 6.0,
            },
            WeightedResource {
                id: "titanium",
                weight: 5.0,
            },
            WeightedResource {
                id: "water",
                weight: 15.0,
            },
            WeightedResource {
                id: "carbon",
                weight: 8.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 5.0,
            },
            WeightedResource {
                id: "rare-earth",
                weight: 3.0,
            },
            WeightedResource {
                id: "phosphorus",
                weight: 3.0,
            },
            WeightedResource {
                id: "uranium",
                weight: 4.0,
            },
            WeightedResource {
                id: "thorium",
                weight: 3.0,
            },
            WeightedResource {
                id: "caritene",
                weight: 2.0,
            },
        ];
    }
    // Warm rocky
    &[
        WeightedResource {
            id: "iron",
            weight: 22.0,
        },
        WeightedResource {
            id: "copper",
            weight: 12.0,
        },
        WeightedResource {
            id: "aluminum",
            weight: 10.0,
        },
        WeightedResource {
            id: "titanium",
            weight: 8.0,
        },
        WeightedResource {
            id: "palladium",
            weight: 5.0,
        },
        WeightedResource {
            id: "silicon",
            weight: 10.0,
        },
        WeightedResource {
            id: "rare-earth",
            weight: 5.0,
        },
        WeightedResource {
            id: "phosphorus",
            weight: 5.0,
        },
        WeightedResource {
            id: "water",
            weight: 4.0,
        },
        WeightedResource {
            id: "nitrogen",
            weight: 3.0,
        },
        WeightedResource {
            id: "uranium",
            weight: 5.0,
        },
        WeightedResource {
            id: "thorium",
            weight: 4.0,
        },
        WeightedResource {
            id: "carbon",
            weight: 3.0,
        },
        WeightedResource {
            id: "heliate",
            weight: 2.0,
        },
        WeightedResource {
            id: "caritene",
            weight: 2.0,
        },
    ]
}

fn moon_pool(parent_dist: f64) -> &'static [WeightedResource] {
    if parent_dist > 5.0 {
        // Icy outer moon
        return &[
            WeightedResource {
                id: "water",
                weight: 30.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 12.0,
            },
            WeightedResource {
                id: "methane",
                weight: 12.0,
            },
            WeightedResource {
                id: "carbon",
                weight: 8.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 5.0,
            },
            WeightedResource {
                id: "iron",
                weight: 5.0,
            },
            WeightedResource {
                id: "heliate",
                weight: 5.0,
            },
            WeightedResource {
                id: "phosphorus",
                weight: 3.0,
            },
            WeightedResource {
                id: "ortheum",
                weight: 4.0,
            },
            WeightedResource {
                id: "nemorin",
                weight: 3.0,
            },
            WeightedResource {
                id: "vantine",
                weight: 3.0,
            },
        ];
    }
    if parent_dist > FROST_LINE_AU {
        // Mid-system moon
        return &[
            WeightedResource {
                id: "iron",
                weight: 15.0,
            },
            WeightedResource {
                id: "water",
                weight: 15.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 10.0,
            },
            WeightedResource {
                id: "carbon",
                weight: 8.0,
            },
            WeightedResource {
                id: "aluminum",
                weight: 7.0,
            },
            WeightedResource {
                id: "copper",
                weight: 5.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 5.0,
            },
            WeightedResource {
                id: "rare-earth",
                weight: 3.0,
            },
            WeightedResource {
                id: "uranium",
                weight: 3.0,
            },
            WeightedResource {
                id: "thorium",
                weight: 2.0,
            },
            WeightedResource {
                id: "caritene",
                weight: 2.0,
            },
        ];
    }
    // Inner system moon
    &[
        WeightedResource {
            id: "iron",
            weight: 22.0,
        },
        WeightedResource {
            id: "aluminum",
            weight: 12.0,
        },
        WeightedResource {
            id: "silicon",
            weight: 12.0,
        },
        WeightedResource {
            id: "titanium",
            weight: 8.0,
        },
        WeightedResource {
            id: "copper",
            weight: 6.0,
        },
        WeightedResource {
            id: "palladium",
            weight: 4.0,
        },
        WeightedResource {
            id: "rare-earth",
            weight: 4.0,
        },
        WeightedResource {
            id: "water",
            weight: 2.0,
        },
        WeightedResource {
            id: "uranium",
            weight: 3.0,
        },
        WeightedResource {
            id: "thorium",
            weight: 3.0,
        },
        WeightedResource {
            id: "heliate",
            weight: 2.0,
        },
    ]
}

fn asteroid_pool(dist: f64) -> &'static [WeightedResource] {
    // Without belt bounds, use distance relative to frost line midpoint
    let belt_mid = FROST_LINE_AU;
    let rel_pos = if belt_mid > 0.0 { dist / belt_mid } else { 0.5 };

    if rel_pos > 1.1 || dist > FROST_LINE_AU * 1.5 {
        // C-type carbonaceous — outer belt
        return &[
            WeightedResource {
                id: "carbon",
                weight: 20.0,
            },
            WeightedResource {
                id: "water",
                weight: 20.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 10.0,
            },
            WeightedResource {
                id: "phosphorus",
                weight: 8.0,
            },
            WeightedResource {
                id: "nitrogen",
                weight: 8.0,
            },
            WeightedResource {
                id: "iron",
                weight: 8.0,
            },
            WeightedResource {
                id: "methane",
                weight: 6.0,
            },
            WeightedResource {
                id: "rare-earth",
                weight: 3.0,
            },
            WeightedResource {
                id: "ortheum",
                weight: 3.0,
            },
        ];
    }
    if rel_pos < 0.9 || dist < FROST_LINE_AU * 0.7 {
        // S-type silicate — inner belt
        return &[
            WeightedResource {
                id: "iron",
                weight: 20.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 18.0,
            },
            WeightedResource {
                id: "aluminum",
                weight: 10.0,
            },
            WeightedResource {
                id: "titanium",
                weight: 8.0,
            },
            WeightedResource {
                id: "copper",
                weight: 8.0,
            },
            WeightedResource {
                id: "rare-earth",
                weight: 5.0,
            },
            WeightedResource {
                id: "palladium",
                weight: 5.0,
            },
            WeightedResource {
                id: "phosphorus",
                weight: 3.0,
            },
            WeightedResource {
                id: "uranium",
                weight: 2.0,
            },
        ];
    }
    // M-type metallic — mid belt
    &[
        WeightedResource {
            id: "iron",
            weight: 30.0,
        },
        WeightedResource {
            id: "palladium",
            weight: 15.0,
        },
        WeightedResource {
            id: "copper",
            weight: 10.0,
        },
        WeightedResource {
            id: "titanium",
            weight: 10.0,
        },
        WeightedResource {
            id: "aluminum",
            weight: 8.0,
        },
        WeightedResource {
            id: "rare-earth",
            weight: 8.0,
        },
        WeightedResource {
            id: "uranium",
            weight: 3.0,
        },
        WeightedResource {
            id: "thorium",
            weight: 3.0,
        },
        WeightedResource {
            id: "caritene",
            weight: 3.0,
        },
    ]
}

fn dwarf_planet_pool(dist: f64) -> &'static [WeightedResource] {
    if dist > 10.0 {
        // Outer dwarf (Pluto/Eris)
        return &[
            WeightedResource {
                id: "nitrogen",
                weight: 25.0,
            },
            WeightedResource {
                id: "water",
                weight: 15.0,
            },
            WeightedResource {
                id: "methane",
                weight: 12.0,
            },
            WeightedResource {
                id: "carbon",
                weight: 10.0,
            },
            WeightedResource {
                id: "iron",
                weight: 5.0,
            },
            WeightedResource {
                id: "silicon",
                weight: 5.0,
            },
            WeightedResource {
                id: "heliate",
                weight: 5.0,
            },
            WeightedResource {
                id: "ortheum",
                weight: 6.0,
            },
            WeightedResource {
                id: "caritene",
                weight: 4.0,
            },
            WeightedResource {
                id: "tessarene",
                weight: 3.0,
            },
            WeightedResource {
                id: "istrium",
                weight: 3.0,
            },
            WeightedResource {
                id: "vantine",
                weight: 2.0,
            },
        ];
    }
    // Inner dwarf (Ceres)
    &[
        WeightedResource {
            id: "water",
            weight: 22.0,
        },
        WeightedResource {
            id: "silicon",
            weight: 12.0,
        },
        WeightedResource {
            id: "iron",
            weight: 10.0,
        },
        WeightedResource {
            id: "carbon",
            weight: 10.0,
        },
        WeightedResource {
            id: "aluminum",
            weight: 6.0,
        },
        WeightedResource {
            id: "rare-earth",
            weight: 5.0,
        },
        WeightedResource {
            id: "phosphorus",
            weight: 5.0,
        },
        WeightedResource {
            id: "nitrogen",
            weight: 5.0,
        },
        WeightedResource {
            id: "uranium",
            weight: 3.0,
        },
        WeightedResource {
            id: "thorium",
            weight: 3.0,
        },
        WeightedResource {
            id: "ortheum",
            weight: 4.0,
        },
        WeightedResource {
            id: "caritene",
            weight: 3.0,
        },
    ]
}

const COMET_POOL: &[WeightedResource] = &[
    WeightedResource {
        id: "water",
        weight: 40.0,
    },
    WeightedResource {
        id: "nitrogen",
        weight: 15.0,
    },
    WeightedResource {
        id: "methane",
        weight: 15.0,
    },
    WeightedResource {
        id: "carbon",
        weight: 10.0,
    },
    WeightedResource {
        id: "silicon",
        weight: 5.0,
    },
    WeightedResource {
        id: "iron",
        weight: 5.0,
    },
    WeightedResource {
        id: "phosphorus",
        weight: 3.0,
    },
    WeightedResource {
        id: "vantine",
        weight: 2.0,
    },
];

const CENTAUR_POOL: &[WeightedResource] = &[
    WeightedResource {
        id: "water",
        weight: 25.0,
    },
    WeightedResource {
        id: "nitrogen",
        weight: 15.0,
    },
    WeightedResource {
        id: "methane",
        weight: 12.0,
    },
    WeightedResource {
        id: "carbon",
        weight: 10.0,
    },
    WeightedResource {
        id: "heliate",
        weight: 13.0,
    },
    WeightedResource {
        id: "iron",
        weight: 5.0,
    },
    WeightedResource {
        id: "silicon",
        weight: 5.0,
    },
    WeightedResource {
        id: "ortheum",
        weight: 6.0,
    },
    WeightedResource {
        id: "nemorin",
        weight: 4.0,
    },
    WeightedResource {
        id: "vantine",
        weight: 3.0,
    },
    WeightedResource {
        id: "tessarene",
        weight: 2.0,
    },
];

const FALLBACK_POOL: &[WeightedResource] = &[
    WeightedResource {
        id: "iron",
        weight: 20.0,
    },
    WeightedResource {
        id: "silicon",
        weight: 12.0,
    },
    WeightedResource {
        id: "aluminum",
        weight: 10.0,
    },
    WeightedResource {
        id: "copper",
        weight: 8.0,
    },
    WeightedResource {
        id: "titanium",
        weight: 6.0,
    },
    WeightedResource {
        id: "water",
        weight: 6.0,
    },
    WeightedResource {
        id: "carbon",
        weight: 5.0,
    },
    WeightedResource {
        id: "rare-earth",
        weight: 4.0,
    },
    WeightedResource {
        id: "uranium",
        weight: 3.0,
    },
    WeightedResource {
        id: "thorium",
        weight: 3.0,
    },
];

fn build_pool(body_type: &str, radius: f64, dist_au: f64) -> &'static [WeightedResource] {
    match body_type {
        "Planet" => planet_pool(radius, dist_au),
        "Moon" => moon_pool(dist_au),
        "Asteroid" => asteroid_pool(dist_au),
        "Dwarf Planet" => dwarf_planet_pool(dist_au),
        "Comet" => COMET_POOL,
        "Centaur" => CENTAUR_POOL,
        _ => FALLBACK_POOL,
    }
}

/// Generate resource deposits for a body.
///
/// `system_seed` — the parent system's master seed
/// `body_name`   — unique body name used to derive per-body entropy
/// `body_type`   — one of "Planet", "Moon", "Asteroid", "Dwarf Planet", "Comet", "Centaur"
/// `radius`      — body radius in km
pub fn generate_deposits(
    system_seed: i64,
    body_name: &str,
    body_type: &str,
    radius: f64,
) -> Vec<ResourceDeposit> {
    let combined = system_seed ^ name_hash(body_name);
    let mut rng = seeded_random(combined);

    // Advance past the seed's initial LCG position (mirrors TS implementation)
    rng();

    // 30-40% chance of no deposits
    if rng() < 0.35 {
        return Vec::new();
    }

    let pool = build_pool(body_type, radius, 1.0);
    let is_comet = body_type == "Comet";
    let base_quantity = if is_comet {
        500.0
    } else {
        (radius * 0.5).max(1000.0)
    };

    let count = 2 + (rng() * 7.0).floor() as usize; // 2-8
    let mut deposits = Vec::with_capacity(count);

    for _ in 0..count {
        let resource_id = pick_weighted(&mut rng, pool).to_string();
        let quantity = ((rng() * base_quantity).floor() as u64).max(1);
        let accessibility = if is_comet {
            0.6 + rng() * 0.4
        } else {
            0.1 + rng() * 0.9
        };

        deposits.push(ResourceDeposit {
            resource_id,
            quantity,
            accessibility,
            mined: 0.0,
            min_survey_level: survey_level_from_access(accessibility),
        });
    }

    deposits
}
