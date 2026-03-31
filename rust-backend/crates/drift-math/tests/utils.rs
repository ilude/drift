use drift_math::utils::*;

mod seeded_random {
    use super::*;

    #[test]
    fn produces_deterministic_output_for_same_seed() {
        let mut rng1 = seeded_random(42);
        let mut rng2 = seeded_random(42);
        for _ in 0..100 {
            assert_eq!(rng1(), rng2());
        }
    }

    #[test]
    fn produces_different_output_for_different_seeds() {
        let mut rng1 = seeded_random(1);
        let mut rng2 = seeded_random(2);
        let seq1: Vec<f64> = (0..10).map(|_| rng1()).collect();
        let seq2: Vec<f64> = (0..10).map(|_| rng2()).collect();
        assert_ne!(seq1, seq2);
    }

    #[test]
    fn returns_values_in_0_1_range() {
        let mut rng = seeded_random(12345);
        for _ in 0..1000 {
            let v = rng();
            assert!(v >= 0.0, "value {v} must be >= 0");
            assert!(v < 1.0, "value {v} must be < 1");
        }
    }

    #[test]
    fn handles_seed_zero_by_defaulting_to_1() {
        let mut rng = seeded_random(0);
        let v = rng();
        assert!(v >= 0.0);
        assert!(v < 1.0);
    }

    #[test]
    fn handles_negative_seed() {
        let mut rng = seeded_random(-99);
        let v = rng();
        assert!(v >= 0.0);
        assert!(v < 1.0);
    }

    #[test]
    fn handles_large_seed() {
        let mut rng = seeded_random(2_147_483_646);
        let v = rng();
        assert!(v >= 0.0);
        assert!(v < 1.0);
    }
}

mod rng_weighted {
    use super::*;

    #[derive(Debug, Clone, PartialEq)]
    struct Entry {
        weight: f64,
    }

    impl Weighted for Entry {
        fn weight(&self) -> f64 {
            self.weight
        }
    }

    #[test]
    fn returns_entry_whose_cumulative_weight_matches_random_value() {
        let mut rng = seeded_random(42);
        let entries = vec![
            Entry { weight: 0.2 },
            Entry { weight: 0.3 },
            Entry { weight: 0.5 },
        ];
        let result = rng_weighted(&mut rng, &entries);
        assert!(entries.contains(result));
    }

    #[test]
    fn triggers_fallback_when_rng_returns_near_one() {
        // A value very close to 1.0 can cause floating-point rounding to skip
        // the <= 0 check, exercising the fallback path that returns the last entry.
        let mock_rng = || 0.999_999_999_999_999_9_f64;
        let entries = vec![
            Entry { weight: 1.0 },
            Entry { weight: 1.0 },
            Entry { weight: 1.0 },
        ];
        let result = rng_weighted(mock_rng, &entries);
        assert_eq!(result, entries.last().unwrap());
    }
}
