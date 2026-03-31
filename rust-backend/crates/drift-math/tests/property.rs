use drift_math::ship_design_calc::*;
use drift_math::utils::*;

mod compute_engine_stats {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn all_outputs_finite_and_positive_for_positive_power_pct(
            power_pct in 1.0_f64..=150.0_f64,
            size_hs in 1.0_f64..=90.0_f64,
        ) {
            let tier = conventional_tier();
            let result = compute_engine_stats(&tier, power_pct, size_hs);
            prop_assert!(result.accel_g.is_finite() && result.accel_g > 0.0);
            prop_assert!(result.isp_s.is_finite() && result.isp_s > 0.0);
            prop_assert!(result.mass_kg.is_finite() && result.mass_kg > 0.0);
            prop_assert!(result.fuel_mod.is_finite() && result.fuel_mod > 0.0);
        }

        #[test]
        fn accel_g_scales_linearly_with_power_pct(
            pct1 in 1.0_f64..=150.0_f64,
            pct2 in 1.0_f64..=150.0_f64,
        ) {
            let tier = conventional_tier();
            let size_hs = 10.0;
            let r1 = compute_engine_stats(&tier, pct1, size_hs);
            let r2 = compute_engine_stats(&tier, pct2, size_hs);
            let accel_ratio = r1.accel_g / r2.accel_g;
            let pct_ratio = pct1 / pct2;
            prop_assert!((accel_ratio - pct_ratio).abs() < 1e-9);
        }

        #[test]
        fn higher_power_pct_means_higher_fuel_mod(
            base_pct in 1.0_f64..99.0_f64,
        ) {
            let tier = conventional_tier();
            let size_hs = 10.0;
            let low = compute_engine_stats(&tier, base_pct, size_hs);
            let high = compute_engine_stats(&tier, base_pct + 1.0, size_hs);
            prop_assert!(high.fuel_mod >= low.fuel_mod);
        }

        #[test]
        fn isp_s_is_constant_per_tier_regardless_of_power_pct_or_size(
            power_pct in 1.0_f64..=150.0_f64,
            size_hs in 1.0_f64..=90.0_f64,
        ) {
            let tier = conventional_tier();
            let result = compute_engine_stats(&tier, power_pct, size_hs);
            prop_assert_eq!(result.isp_s, tier.base_isp_s);
        }
    }
}

mod pick_weighted {
    use super::*;
    use proptest::prelude::*;

    #[derive(Debug, Clone)]
    struct WeightedEntry {
        id: String,
        weight: f64,
    }

    impl Weighted for WeightedEntry {
        fn weight(&self) -> f64 {
            self.weight
        }
    }

    proptest! {
        #[test]
        fn returns_valid_entry_from_nonempty_pool(
            weights in proptest::collection::vec(0.01_f64..=100.0_f64, 1..=20),
        ) {
            let pool: Vec<WeightedEntry> = weights
                .iter()
                .enumerate()
                .map(|(i, &w)| WeightedEntry {
                    id: format!("item_{i}"),
                    weight: w,
                })
                .collect();

            let mut rng = drift_math::utils::seeded_random(42);
            let result = rng_weighted(&mut rng, &pool);
            prop_assert!(pool.iter().any(|e| e.id == result.id));
        }
    }

    #[test]
    fn distribution_is_approximately_proportional_to_weights() {
        let pool = vec![
            WeightedEntry {
                id: "rare".to_string(),
                weight: 1.0,
            },
            WeightedEntry {
                id: "common".to_string(),
                weight: 9.0,
            },
        ];

        let mut rng = drift_math::utils::seeded_random(12345);

        let trials = 1000;
        let rare_count = (0..trials)
            .filter(|_| rng_weighted(&mut rng, &pool).id == "rare")
            .count();

        let rate = rare_count as f64 / trials as f64;
        // rare should be picked ~10% of the time ± 5%
        assert!(rate > 0.05, "rare rate {rate:.3} too low");
        assert!(rate < 0.20, "rare rate {rate:.3} too high");
    }
}

// NOTE: hull_ceiling, bathtub_fail_rate, compute_morale, and generate_system
// property tests are deferred to Phase 3 (drift-sim) and Phase 2 (drift-data)
// respectively, as those functions don't belong in drift-math.
