use drift_data::resources::*;

mod resources_catalog {
    use super::*;

    #[test]
    fn has_exactly_24_entries() {
        assert_eq!(RESOURCES.len(), 24);
    }

    #[test]
    fn all_ids_are_unique() {
        let ids: Vec<&str> = RESOURCES.iter().map(|r| r.id).collect();
        let unique: std::collections::HashSet<&str> = ids.iter().copied().collect();
        assert_eq!(unique.len(), 24);
    }

    #[test]
    fn all_entries_have_non_empty_name_symbol_description() {
        for r in RESOURCES.iter() {
            assert!(!r.name.is_empty(), "name empty for {}", r.id);
            assert!(!r.symbol.is_empty(), "symbol empty for {}", r.id);
            assert!(!r.description.is_empty(), "description empty for {}", r.id);
        }
    }
}

mod get_resource_def {
    use super::*;

    #[test]
    fn returns_iron_entry_for_iron() {
        let def = get_resource_def("iron");
        assert!(def.is_some());
        let def = def.unwrap();
        assert_eq!(def.id, "iron");
        assert_eq!(def.category, "metal");
        assert_eq!(def.symbol, "Fe");
    }

    #[test]
    fn returns_none_for_nonexistent_id() {
        assert!(get_resource_def("nonexistent").is_none());
    }
}

mod get_resources_by_category {
    use super::*;

    #[test]
    fn returns_exactly_8_umbral_resources() {
        assert_eq!(get_resources_by_category("umbral").len(), 8);
    }

    #[test]
    fn returns_exactly_4_radioactive_resources() {
        assert_eq!(get_resources_by_category("radioactive").len(), 4);
    }

    #[test]
    fn returns_exactly_5_metal_resources() {
        assert_eq!(get_resources_by_category("metal").len(), 5);
    }
}

mod get_minable_resources {
    use super::*;

    #[test]
    fn returns_exactly_22_entries_excludes_plutonium_tritium() {
        let minable = get_minable_resources();
        assert_eq!(minable.len(), 22);
        let ids: Vec<&str> = minable.iter().map(|r| r.id).collect();
        assert!(!ids.contains(&"plutonium"), "plutonium should be excluded");
        assert!(!ids.contains(&"tritium"), "tritium should be excluded");
    }
}

// Helper: count resource categories across multiple generated deposits.
fn count_deposit_categories(
    body_type: &str,
    radius: f64,
    name_prefix: &str,
    target_non_empty: usize,
) -> std::collections::HashMap<String, usize> {
    let mut category_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    let mut non_empty = 0usize;
    let mut i = 0usize;
    while i < 200 && non_empty < target_non_empty {
        let name = format!("{}{}", name_prefix, i);
        let deposits = generate_deposits(1, &name, body_type, radius);
        if deposits.is_empty() {
            i += 1;
            continue;
        }
        non_empty += 1;
        for d in &deposits {
            if let Some(def) = get_resource_def(&d.resource_id) {
                *category_counts.entry(def.category.to_string()).or_insert(0) += 1;
            }
        }
        i += 1;
    }
    category_counts
}

mod generate_deposits {
    use super::*;

    #[test]
    fn is_deterministic_for_same_seed_and_body() {
        let a = generate_deposits(42, "Mars", "Planet", 3389.0);
        let b = generate_deposits(42, "Mars", "Planet", 3389.0);
        assert_eq!(a, b);
    }

    #[test]
    fn returns_different_results_for_different_body_names() {
        let a = generate_deposits(42, "Mars", "Planet", 3389.0);
        let b = generate_deposits(42, "Venus", "Planet", 6051.0);
        assert_ne!(a, b);
    }

    #[test]
    fn returns_empty_array_for_approx_35_percent_of_bodies() {
        let mut empty_count = 0usize;
        let total = 100usize;
        for i in 0..total {
            let name = format!("Body{}", i);
            let deposits = generate_deposits(999, &name, "Planet", 5000.0);
            if deposits.is_empty() {
                empty_count += 1;
            }
        }
        assert!(
            empty_count >= 25,
            "expected >= 25 empty, got {}",
            empty_count
        );
        assert!(
            empty_count <= 45,
            "expected <= 45 empty, got {}",
            empty_count
        );
    }

    #[test]
    fn rocky_planet_deposits_skew_toward_metals() {
        let category_counts = count_deposit_categories("Planet", 6000.0, "RockyBody", 20);
        let metal_count = *category_counts.get("metal").unwrap_or(&0);
        let volatile_count = *category_counts.get("volatile").unwrap_or(&0);
        assert!(
            metal_count > volatile_count,
            "expected metals ({}) > volatiles ({})",
            metal_count,
            volatile_count
        );
    }

    #[test]
    fn gas_giant_deposits_skew_toward_volatiles() {
        let category_counts = count_deposit_categories("Planet", 70000.0, "GasBody", 20);
        let volatile_count = *category_counts.get("volatile").unwrap_or(&0);
        let metal_count = *category_counts.get("metal").unwrap_or(&0);
        assert!(
            volatile_count > metal_count,
            "expected volatiles ({}) > metals ({})",
            volatile_count,
            metal_count
        );
    }

    #[test]
    fn comet_deposits_have_high_accessibility_all_ge_0_6() {
        let mut tested = 0usize;
        let mut i = 0usize;
        while i < 200 && tested < 10 {
            let deposits = generate_deposits(7, &format!("Comet{}", i), "Comet", 5.0);
            if deposits.is_empty() {
                i += 1;
                continue;
            }
            tested += 1;
            for d in &deposits {
                assert!(
                    d.accessibility >= 0.6,
                    "comet deposit accessibility {} < 0.6",
                    d.accessibility
                );
            }
            i += 1;
        }
    }

    #[test]
    fn all_deposits_have_min_survey_level_1_to_3() {
        for i in 0..50usize {
            let deposits = generate_deposits(5, &format!("Body{}", i), "Planet", 5000.0);
            for d in &deposits {
                assert!(
                    d.min_survey_level >= 1 && d.min_survey_level <= 3,
                    "min_survey_level {} out of range 1-3",
                    d.min_survey_level
                );
            }
        }
    }

    #[test]
    fn all_deposits_have_accessibility_between_0_1_and_1_0() {
        for i in 0..50usize {
            let deposits = generate_deposits(5, &format!("Body{}", i), "Planet", 5000.0);
            for d in &deposits {
                assert!(
                    d.accessibility >= 0.1 && d.accessibility <= 1.0,
                    "accessibility {} out of range [0.1, 1.0]",
                    d.accessibility
                );
            }
        }
    }

    #[test]
    fn all_deposits_have_quantity_greater_than_0() {
        for i in 0..50usize {
            let deposits = generate_deposits(5, &format!("Body{}", i), "Planet", 5000.0);
            for d in &deposits {
                assert!(d.quantity > 0, "quantity {} is not > 0", d.quantity);
            }
        }
    }

    #[test]
    fn centaur_body_type_uses_centaur_pool() {
        let unique_resources: std::collections::HashSet<&str> =
            ["methane", "heliate"].iter().copied().collect();
        let mut found_unique = false;
        for seed in 1i64..100 {
            if found_unique {
                break;
            }
            let deposits = generate_deposits(seed, &format!("Centaur{}", seed), "Centaur", 500.0);
            for d in &deposits {
                if unique_resources.contains(d.resource_id.as_str()) {
                    found_unique = true;
                    break;
                }
            }
        }
        assert!(
            found_unique,
            "expected at least one unique centaur resource (methane or heliate)"
        );
    }

    #[test]
    fn asteroid_deposits_have_valid_resource_ids_from_asteroid_pool() {
        let valid_asteroid_ids: std::collections::HashSet<&str> = [
            "iron",
            "platinum",
            "titanium",
            "copper",
            "aluminum",
            "silicon",
            "carbon",
            "rare-earth",
            "phosphorus",
            "water",
            "uranium",
            "thorium",
        ]
        .iter()
        .copied()
        .collect();

        let mut tested_count = 0usize;
        let mut seed = 1i64;
        while seed < 100 && tested_count < 10 {
            let deposits = generate_deposits(seed, &format!("Asteroid{}", seed), "Asteroid", 500.0);
            if deposits.is_empty() {
                seed += 1;
                continue;
            }
            tested_count += 1;
            for d in &deposits {
                assert!(
                    valid_asteroid_ids.contains(d.resource_id.as_str()),
                    "unexpected asteroid resource id: {}",
                    d.resource_id
                );
            }
            seed += 1;
        }
        assert!(
            tested_count > 0,
            "expected at least one non-empty asteroid deposit set"
        );
    }
}
