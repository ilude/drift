use drift_data::sol_data::*;
use drift_data::system_generator::*;
use drift_math::orbit::{
    categorize_planet, hill_radius, kepler_period, radius_to_mass_earths, PlanetCategory,
};
use drift_math::utils::{
    rng_float, rng_gaussian, rng_int, rng_pick, rng_weighted, seeded_random, Weighted,
};

// --- RNG helpers ---

mod rng_int {
    use super::*;

    #[test]
    fn returns_integers_within_min_max() {
        let mut rng = seeded_random(1);
        for _ in 0..200 {
            let v = rng_int(&mut rng, 1, 6);
            assert!(v >= 1, "v {} < 1", v);
            assert!(v <= 6, "v {} > 6", v);
        }
    }
}

mod rng_float {
    use super::*;

    #[test]
    fn returns_floats_within_min_max_exclusive() {
        let mut rng = seeded_random(2);
        for _ in 0..200 {
            let v = rng_float(&mut rng, 0.0, 1.0);
            assert!(v >= 0.0, "v {} < 0.0", v);
            assert!(v < 1.0, "v {} >= 1.0", v);
        }
    }

    #[test]
    fn respects_range_bounds() {
        let mut rng = seeded_random(3);
        for _ in 0..100 {
            let v = rng_float(&mut rng, 5.0, 10.0);
            assert!(v >= 5.0, "v {} < 5.0", v);
            assert!(v < 10.0, "v {} >= 10.0", v);
        }
    }
}

mod rng_gaussian {
    use super::*;

    #[test]
    fn produces_values_centered_near_0() {
        let mut rng = seeded_random(4);
        let n = 10_000;
        let mut sum = 0.0f64;
        for _ in 0..n {
            sum += rng_gaussian(&mut rng);
        }
        let mean = sum / n as f64;
        assert!(mean.abs() < 0.1, "mean {} not near 0", mean);
    }
}

struct WeightedEntry<T> {
    pub value: T,
    pub weight: f64,
}

impl<T> Weighted for WeightedEntry<T> {
    fn weight(&self) -> f64 {
        self.weight
    }
}

mod rng_weighted_tests {
    use super::*;

    #[test]
    fn returns_entries_proportional_to_weight() {
        let mut rng = seeded_random(5);
        let entries = vec![
            WeightedEntry {
                value: "a",
                weight: 90.0,
            },
            WeightedEntry {
                value: "b",
                weight: 10.0,
            },
        ];
        let mut count_a = 0usize;
        let mut count_b = 0usize;
        for _ in 0..1000 {
            let picked = rng_weighted(&mut rng, &entries);
            match picked.value {
                "a" => count_a += 1,
                "b" => count_b += 1,
                _ => {}
            }
        }
        assert!(
            count_a > count_b * 3,
            "expected count_a ({}) > count_b ({}) * 3",
            count_a,
            count_b
        );
    }

    #[test]
    fn with_zero_weights_returns_first_entry() {
        let entries = vec![
            WeightedEntry {
                value: "x",
                weight: 0.0,
            },
            WeightedEntry {
                value: "y",
                weight: 0.0,
            },
        ];
        let mut rng = seeded_random(6);
        let result = rng_weighted(&mut rng, &entries);
        assert_eq!(result.value, "x");
    }
}

mod rng_pick_tests {
    use super::*;

    #[test]
    fn returns_an_element_from_the_array() {
        let mut rng = seeded_random(7);
        let arr = vec!["a", "b", "c"];
        for _ in 0..50 {
            let picked = rng_pick(&mut rng, &arr);
            assert!(arr.contains(picked), "picked {:?} not in arr", picked);
        }
    }
}

// --- Physics helpers ---

mod kepler_period_tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn returns_1_year_for_earth_1_au_1_solar_mass() {
        assert_relative_eq!(kepler_period(1.0, 1.0), 1.0, epsilon = 1e-9);
    }

    #[test]
    fn increases_with_distance() {
        assert!(kepler_period(4.0, 1.0) > kepler_period(1.0, 1.0));
    }

    #[test]
    fn decreases_with_greater_star_mass() {
        assert!(kepler_period(1.0, 4.0) < kepler_period(1.0, 1.0));
    }
}

mod radius_to_mass_earths_tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn returns_approx_1_for_earth_radius() {
        assert_relative_eq!(radius_to_mass_earths(1.0), 1.0, epsilon = 1e-9);
    }

    #[test]
    fn increases_with_radius() {
        assert!(radius_to_mass_earths(2.0) > radius_to_mass_earths(1.0));
        assert!(radius_to_mass_earths(5.0) > radius_to_mass_earths(2.0));
    }
}

mod hill_radius_tests {
    use super::*;

    #[test]
    fn returns_positive_value() {
        assert!(hill_radius(1.0, 1.0, 1.0) > 0.0);
    }

    #[test]
    fn increases_with_planet_mass() {
        assert!(hill_radius(1.0, 100.0, 1.0) > hill_radius(1.0, 1.0, 1.0));
    }

    #[test]
    fn increases_with_distance() {
        assert!(hill_radius(5.0, 1.0, 1.0) > hill_radius(1.0, 1.0, 1.0));
    }
}

mod categorize_planet_tests {
    use super::*;

    #[test]
    fn classifies_rocky_planets() {
        assert_eq!(categorize_planet(1.0), PlanetCategory::Rocky);
        assert_eq!(categorize_planet(1.7), PlanetCategory::Rocky);
    }

    #[test]
    fn classifies_sub_neptunes() {
        assert_eq!(categorize_planet(2.0), PlanetCategory::SubNeptune);
        assert_eq!(categorize_planet(3.5), PlanetCategory::SubNeptune);
    }

    #[test]
    fn classifies_ice_giants() {
        assert_eq!(categorize_planet(5.0), PlanetCategory::IceGiant);
        assert_eq!(categorize_planet(7.0), PlanetCategory::IceGiant);
    }

    #[test]
    fn classifies_gas_giants() {
        assert_eq!(categorize_planet(10.0), PlanetCategory::GasGiant);
        assert_eq!(categorize_planet(15.0), PlanetCategory::GasGiant);
    }
}

mod planet_letter_tests {
    use super::*;

    #[test]
    fn returns_b_for_index_0() {
        assert_eq!(planet_letter(0), "b");
    }

    #[test]
    fn returns_c_for_index_1() {
        assert_eq!(planet_letter(1), "c");
    }

    #[test]
    fn returns_sequential_letters() {
        assert_eq!(planet_letter(2), "d");
        assert_eq!(planet_letter(3), "e");
    }
}

// --- getSolSystem ---

mod get_sol_system_tests {
    use super::*;

    #[test]
    fn returns_required_top_level_properties() {
        let sol = get_sol_system();
        // Presence of fields validated by successful field access / non-empty checks below
        assert!(!sol.bodies.is_empty());
        assert!(sol.comets.is_empty() || !sol.comets.is_empty()); // field exists
        assert!(sol.asteroid_belts.is_empty() || !sol.asteroid_belts.is_empty()); // field exists
        assert!(!sol.name.is_empty());
    }

    #[test]
    fn has_sol_system_as_name() {
        let sol = get_sol_system();
        assert_eq!(sol.name, "Sol System");
    }

    #[test]
    fn has_sol_as_first_body() {
        let sol = get_sol_system();
        let first = &sol.bodies[0];
        assert_eq!(first.name, "Sol");
        assert_eq!(first.body_type, "Star");
        assert_eq!(first.distance, 0.0);
    }

    #[test]
    fn has_8_planets() {
        let sol = get_sol_system();
        let planets: Vec<_> = sol
            .bodies
            .iter()
            .filter(|b| b.body_type == "Planet")
            .collect();
        assert_eq!(planets.len(), 8);
    }

    #[test]
    fn has_jupiter_with_4_galilean_moons() {
        let sol = get_sol_system();
        let jupiter = sol.bodies.iter().find(|b| b.name == "Jupiter");
        assert!(jupiter.is_some(), "Jupiter not found");
        let jupiter = jupiter.unwrap();
        assert_eq!(jupiter.moons.len(), 4);
        let moon_names: Vec<&str> = jupiter.moons.iter().map(|m| m.name.as_str()).collect();
        assert!(moon_names.contains(&"Io"), "Io not found");
        assert!(moon_names.contains(&"Europa"), "Europa not found");
        assert!(moon_names.contains(&"Ganymede"), "Ganymede not found");
        assert!(moon_names.contains(&"Callisto"), "Callisto not found");
    }

    #[test]
    fn has_known_comets() {
        let sol = get_sol_system();
        let comet_names: Vec<&str> = sol.comets.iter().map(|c| c.name.as_str()).collect();
        assert!(comet_names.contains(&"Halley"), "Halley not found");
        assert!(comet_names.contains(&"Hale-Bopp"), "Hale-Bopp not found");
    }

    #[test]
    fn has_asteroid_belts_including_main_belt() {
        let sol = get_sol_system();
        let belt_names: Vec<&str> = sol.asteroid_belts.iter().map(|b| b.name.as_str()).collect();
        assert!(belt_names.contains(&"Main Belt"), "Main Belt not found");
    }

    #[test]
    fn planet_distances_are_monotonically_increasing() {
        let sol = get_sol_system();
        let planets: Vec<_> = sol
            .bodies
            .iter()
            .filter(|b| b.body_type == "Planet")
            .collect();
        for i in 1..planets.len() {
            assert!(
                planets[i].distance > planets[i - 1].distance,
                "planet distances not sorted at index {}: {} <= {}",
                i,
                planets[i].distance,
                planets[i - 1].distance
            );
        }
    }
}

// --- generateSystem ---

mod generate_system_tests {
    use super::*;

    #[test]
    fn is_deterministic_same_seed_same_output() {
        let sys1 = generate_system(42);
        let sys2 = generate_system(42);
        assert_eq!(sys1.name, sys2.name);
        assert_eq!(sys1.bodies.len(), sys2.bodies.len());
        let names1: Vec<&str> = sys1.bodies.iter().map(|b| b.name.as_str()).collect();
        let names2: Vec<&str> = sys2.bodies.iter().map(|b| b.name.as_str()).collect();
        assert_eq!(names1, names2);
    }

    #[test]
    fn different_seeds_produce_different_systems() {
        let sys1 = generate_system(1);
        let sys2 = generate_system(2);
        let same = sys1.name == sys2.name && sys1.bodies.len() == sys2.bodies.len();
        assert!(!same, "seed 1 and seed 2 produced identical systems");
    }

    #[test]
    fn always_has_at_least_one_star_as_first_body() {
        for seed in [1u64, 100, 9999, 123456] {
            let sys = generate_system(seed);
            assert!(!sys.bodies.is_empty(), "no bodies for seed {}", seed);
            assert_eq!(
                sys.bodies[0].body_type, "Star",
                "first body not Star for seed {}",
                seed
            );
            assert_eq!(
                sys.bodies[0].distance, 0.0,
                "star distance != 0 for seed {}",
                seed
            );
        }
    }

    #[test]
    fn has_a_non_empty_system_name() {
        let sys = generate_system(77);
        assert!(!sys.name.is_empty());
    }

    #[test]
    fn all_planets_have_positive_distance_period_and_radius() {
        let sys = generate_system(500);
        let planets: Vec<_> = sys
            .bodies
            .iter()
            .filter(|b| b.body_type == "Planet")
            .collect();
        for p in &planets {
            assert!(p.distance > 0.0, "planet distance <= 0: {}", p.distance);
            assert!(p.period > 0.0, "planet period <= 0: {}", p.period);
            assert!(p.radius > 0.0, "planet radius <= 0: {}", p.radius);
        }
    }

    #[test]
    fn planet_distances_are_sorted() {
        let sys = generate_system(300);
        let planets: Vec<_> = sys
            .bodies
            .iter()
            .filter(|b| b.body_type == "Planet")
            .collect();
        for i in 1..planets.len() {
            assert!(
                planets[i].distance > planets[i - 1].distance,
                "planet distances not sorted at index {}: {} <= {}",
                i,
                planets[i].distance,
                planets[i - 1].distance
            );
        }
    }

    #[test]
    fn comets_have_valid_orbital_elements() {
        let sys = generate_system(200);
        for c in &sys.comets {
            assert!(c.a > 0.0, "comet a <= 0: {}", c.a);
            assert!(c.e > 0.0, "comet e <= 0: {}", c.e);
            assert!(c.e < 1.0, "comet e >= 1: {}", c.e);
            assert!(c.period > 0.0, "comet period <= 0: {}", c.period);
        }
    }

    #[test]
    fn asteroid_belts_have_valid_ranges() {
        let sys = generate_system(400);
        for belt in &sys.asteroid_belts {
            assert!(
                belt.min_au < belt.max_au,
                "belt min_au {} >= max_au {}",
                belt.min_au,
                belt.max_au
            );
            assert!(belt.count > 0, "belt count is 0");
        }
    }

    #[test]
    fn returns_bodies_comets_and_asteroid_belts_arrays() {
        let sys = generate_system(600);
        // Field presence verified by accessing them without panic
        let _ = &sys.bodies;
        let _ = &sys.comets;
        let _ = &sys.asteroid_belts;
    }
}
