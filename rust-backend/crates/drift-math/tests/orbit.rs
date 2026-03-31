use approx::{assert_abs_diff_eq, assert_relative_eq};
use drift_math::orbit::*;

mod scale_dist {
    use super::*;

    #[test]
    fn returns_0_for_0_au() {
        assert_eq!(scale_dist(0.0), 0.0);
    }

    #[test]
    fn returns_dist_scale_for_1_au() {
        assert_eq!(scale_dist(1.0), DIST_SCALE);
    }

    #[test]
    fn computes_sqrt_au_times_dist_scale() {
        assert_relative_eq!(scale_dist(4.0), 2.0 * DIST_SCALE, epsilon = 1e-10);
        assert_relative_eq!(scale_dist(9.0), 3.0 * DIST_SCALE, epsilon = 1e-10);
    }

    #[test]
    fn scales_sub_linearly_outer_planets_not_absurdly_far() {
        let inner = scale_dist(1.0);
        let outer = scale_dist(30.0);
        assert!(outer / inner < 30.0);
    }
}

mod kepler_radius {
    use super::*;

    #[test]
    fn returns_semi_major_axis_for_circular_orbit_e0() {
        assert_relative_eq!(kepler_radius(10.0, 0.0, 0.0), 10.0, epsilon = 1e-10);
        assert_relative_eq!(
            kepler_radius(10.0, 0.0, std::f64::consts::PI),
            10.0,
            epsilon = 1e-10
        );
    }

    #[test]
    fn returns_perihelion_at_theta_0() {
        // perihelion = a * (1 - e)
        assert_relative_eq!(
            kepler_radius(10.0, 0.5, 0.0),
            10.0 * (1.0 - 0.5),
            epsilon = 1e-10
        );
    }

    #[test]
    fn returns_aphelion_at_theta_pi() {
        // aphelion = a * (1 + e)
        assert_relative_eq!(
            kepler_radius(10.0, 0.5, std::f64::consts::PI),
            10.0 * (1.0 + 0.5),
            epsilon = 1e-10
        );
    }

    #[test]
    fn perihelion_less_than_aphelion_for_eccentric_orbit() {
        let peri = kepler_radius(10.0, 0.9, 0.0);
        let aph = kepler_radius(10.0, 0.9, std::f64::consts::PI);
        assert!(peri < aph);
    }

    #[test]
    fn is_always_positive_for_valid_orbital_elements() {
        let mut theta = 0.0_f64;
        while theta < std::f64::consts::TAU {
            assert!(kepler_radius(5.0, 0.8, theta) > 0.0);
            theta += 0.1;
        }
    }
}

mod orbit_speed {
    use super::*;

    #[test]
    fn returns_0_for_period_0() {
        assert_eq!(orbit_speed(0.0), 0.0);
    }

    #[test]
    fn returns_positive_for_positive_period() {
        assert!(orbit_speed(1.0) > 0.0);
    }

    #[test]
    fn shorter_period_equals_faster_speed() {
        assert!(orbit_speed(1.0) > orbit_speed(10.0));
    }

    #[test]
    fn computes_two_pi_over_period_times_days_per_year() {
        assert_relative_eq!(
            orbit_speed(1.0),
            std::f64::consts::TAU / DAYS_PER_YEAR,
            epsilon = 1e-10
        );
    }
}

mod mean_to_true {
    use super::*;

    #[test]
    fn returns_0_for_m_0_at_any_eccentricity() {
        assert_abs_diff_eq!(mean_to_true(0.0, 0.0), 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(mean_to_true(0.0, 0.5), 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(mean_to_true(0.0, 0.99), 0.0, epsilon = 1e-10);
    }

    #[test]
    fn returns_pi_for_m_pi_at_any_eccentricity() {
        assert_abs_diff_eq!(
            mean_to_true(std::f64::consts::PI, 0.0),
            std::f64::consts::PI,
            epsilon = 1e-10
        );
        assert_abs_diff_eq!(
            mean_to_true(std::f64::consts::PI, 0.5),
            std::f64::consts::PI,
            epsilon = 1e-10
        );
        assert_abs_diff_eq!(
            mean_to_true(std::f64::consts::PI, 0.96),
            std::f64::consts::PI,
            epsilon = 1e-10
        );
    }

    #[test]
    fn equals_m_for_circular_orbit_e0() {
        assert_abs_diff_eq!(mean_to_true(1.0, 0.0), 1.0, epsilon = 1e-10);
        assert_abs_diff_eq!(mean_to_true(2.5, 0.0), 2.5, epsilon = 1e-10);
    }

    #[test]
    fn true_anomaly_leads_mean_anomaly_for_0_less_than_m_less_than_pi() {
        // Kepler's law: body moves faster at perihelion
        let theta = mean_to_true(1.0, 0.5);
        assert!(theta > 1.0);
    }

    #[test]
    fn high_eccentricity_produces_large_lead_near_perihelion() {
        // Halley-like e=0.967, small M → theta should be much larger
        let theta = mean_to_true(0.1, 0.967);
        assert!(theta > 0.5);
    }

    #[test]
    fn normalizes_negative_m_by_wrapping_to_positive_range() {
        let pos = mean_to_true(std::f64::consts::FRAC_PI_4, 0.1);
        let neg = mean_to_true(std::f64::consts::FRAC_PI_4 - std::f64::consts::TAU, 0.1);
        assert_abs_diff_eq!(neg, pos, epsilon = 1e-8);
    }

    #[test]
    fn converges_for_high_eccentricity_orbit_e0967_halley_comet() {
        // At M=π the true anomaly is also π regardless of eccentricity
        let nu = mean_to_true(std::f64::consts::PI, 0.967);
        assert_abs_diff_eq!(nu, std::f64::consts::PI, epsilon = 1e-4);
    }
}

mod generate_trail_positions {
    use super::*;

    #[test]
    fn returns_vec_with_length_max_points_times_3() {
        let positions = generate_trail_positions(0.0, 0.001, 0.0, 1.0, 50);
        assert_eq!(positions.len(), 50 * 3);
    }

    #[test]
    fn circular_orbit_e0_produces_constant_radius_for_all_points() {
        let distance = 1.0_f64;
        let angular_speed = 0.001_f64;
        let positions = generate_trail_positions(0.0, angular_speed, 0.0, distance, 20);
        let expected_r = scale_dist(distance);
        for i in 0..20_usize {
            let x = positions[i * 3] as f64;
            let z = positions[i * 3 + 2] as f64;
            let r = (x * x + z * z).sqrt();
            assert_abs_diff_eq!(r, expected_r, epsilon = 1e-3);
        }
    }

    #[test]
    fn all_y_values_are_zero_planar_orbit() {
        let positions = generate_trail_positions(1.0, 0.002, 0.3, 2.0, 30);
        for i in 0..30_usize {
            assert_eq!(positions[i * 3 + 1], 0.0_f32);
        }
    }

    #[test]
    fn returns_zeroed_array_when_angular_speed_is_0() {
        let positions = generate_trail_positions(0.0, 0.0, 0.5, 1.0, 10);
        for &v in &positions {
            assert_eq!(v, 0.0_f32);
        }
    }

    #[test]
    fn first_point_is_further_back_in_time_than_last_point() {
        // With positive angular_speed, first point is at the oldest (smallest) angle.
        // For a circular orbit, the first x,z and last x,z should differ.
        let positions = generate_trail_positions(std::f64::consts::PI, 0.01, 0.0, 1.0, 100);
        let x0 = positions[0] as f64;
        let z0 = positions[2] as f64;
        let x_last = positions[(100 - 1) * 3] as f64;
        let z_last = positions[(100 - 1) * 3 + 2] as f64;
        // They should not be the same point (100 steps of 0.01 * 0.02 rad apart)
        let dx = x_last - x0;
        let dz = z_last - z0;
        assert!((dx * dx + dz * dz).sqrt() > 0.0);
    }
}

mod inclined_position {
    use super::*;

    #[test]
    fn returns_identity_for_zero_inclination_and_zero_node() {
        // cos(0)=1, sin(0)=0
        let p = inclined_position(10.0, 5.0, 1.0, 0.0, 1.0, 0.0);
        assert_abs_diff_eq!(p.x, 10.0, epsilon = 1e-10);
        assert_abs_diff_eq!(p.y, 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(p.z, 5.0, epsilon = 1e-10);
    }

    #[test]
    fn y_is_non_zero_for_non_zero_inclination() {
        let cos_i = (0.3_f64).cos();
        let sin_i = (0.3_f64).sin();
        let p = inclined_position(10.0, 5.0, 1.0, 0.0, cos_i, sin_i);
        assert!(p.y.abs() > 1e-10);
    }

    #[test]
    fn node_rotation_180_degrees_preserves_x_and_z() {
        let cos_n = std::f64::consts::PI.cos();
        let sin_n = std::f64::consts::PI.sin();
        let p = inclined_position(10.0, 5.0, cos_n, sin_n, 1.0, 0.0);
        assert_abs_diff_eq!(p.x, 10.0, epsilon = 1e-10);
        assert_abs_diff_eq!(p.y, 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(p.z, 5.0, epsilon = 1e-10);
    }

    #[test]
    fn preserves_distance_from_origin_no_inclination() {
        let x = 3.0_f64;
        let z = 4.0_f64;
        let p = inclined_position(x, z, 1.0, 0.0, 1.0, 0.0);
        let dist = (p.x * p.x + p.y * p.y + p.z * p.z).sqrt();
        assert_abs_diff_eq!(dist, 5.0, epsilon = 1e-10);
    }
}
