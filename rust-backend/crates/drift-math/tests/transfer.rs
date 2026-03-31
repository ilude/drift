use approx::{assert_abs_diff_eq, assert_relative_eq};
use drift_math::orbit::{scale_dist, DAYS_PER_YEAR};
use drift_math::transfer::{
    capture_blend_position, check_transfer_arrival, compute_mu, compute_respline_knots,
    compute_transfer_knots, derive_star_mass, game_transfer_days, game_transfer_speed,
    hohmann_transfer, is_transfer_complete, predict_orbital_position, should_respline,
    transfer_speed, transfer_start_angle, ArrivalReason, BodyData, CometElements, MoonParams,
    OrbitalPredictionParams, Vec3,
};

mod hohmann_transfer_tests {
    use super::*;

    #[test]
    fn computes_correct_semi_major_axis() {
        let result = hohmann_transfer(1.0, 1.524, None);
        assert_abs_diff_eq!(result.a, 1.262, epsilon = 0.0005);
    }

    #[test]
    fn computes_correct_eccentricity() {
        let result = hohmann_transfer(1.0, 1.524, None);
        assert_abs_diff_eq!(result.e, 0.2075, epsilon = 0.0005);
    }

    #[test]
    fn returns_positive_transfer_time() {
        let result = hohmann_transfer(1.0, 1.524, None);
        assert!(result.transfer_time_days > 0.0);
    }

    #[test]
    fn earth_to_mars_transfer_time_is_approx_259_days() {
        // toBeCloseTo(259, -1) → within 5*10^1 = 50 days
        let result = hohmann_transfer(1.0, 1.524, None);
        assert!((result.transfer_time_days - 259.0).abs() < 50.0);
    }

    #[test]
    fn has_symmetric_semi_major_axis() {
        let a1 = hohmann_transfer(1.0, 5.2, None).a;
        let a2 = hohmann_transfer(5.2, 1.0, None).a;
        assert_relative_eq!(a1, a2, epsilon = 1e-10);
    }

    #[test]
    fn uses_star_mass_in_period_calculation() {
        let t1 = hohmann_transfer(1.0, 2.0, Some(1.0)).transfer_time_days;
        let t2 = hohmann_transfer(1.0, 2.0, Some(4.0)).transfer_time_days;
        assert!(t2 < t1); // heavier star -> shorter period
    }
}

mod transfer_speed_tests {
    use super::*;

    #[test]
    fn returns_correct_angular_velocity() {
        let speed = transfer_speed(2.0);
        let expected = (std::f64::consts::PI * 2.0) / (2.0 * DAYS_PER_YEAR);
        assert_relative_eq!(speed, expected, epsilon = 1e-10);
    }

    #[test]
    fn returns_0_for_0_period() {
        assert_eq!(transfer_speed(0.0), 0.0);
    }
}

mod transfer_start_angle_tests {
    use super::*;

    #[test]
    fn returns_0_for_outward_transfer() {
        assert_eq!(transfer_start_angle(1.0, 5.2), 0.0);
    }

    #[test]
    fn returns_pi_for_inward_transfer() {
        assert_eq!(transfer_start_angle(5.2, 1.0), std::f64::consts::PI);
    }

    #[test]
    fn returns_0_for_equal_radii() {
        assert_eq!(transfer_start_angle(1.0, 1.0), 0.0);
    }
}

mod is_transfer_complete_tests {
    use super::*;

    #[test]
    fn returns_false_when_elapsed_less_than_transfer_time() {
        assert!(!is_transfer_complete(100.0, 259.0));
    }

    #[test]
    fn returns_true_when_elapsed_ge_transfer_time() {
        assert!(is_transfer_complete(260.0, 259.0));
    }

    #[test]
    fn returns_true_at_exact_boundary() {
        assert!(is_transfer_complete(259.0, 259.0));
    }
}

mod game_transfer_days_tests {
    use super::*;

    #[test]
    fn earth_to_mars_takes_approx_5_days() {
        let days = game_transfer_days(1.0, 1.524);
        assert_abs_diff_eq!(days, 4.57, epsilon = 0.1);
    }

    #[test]
    fn earth_to_saturn_takes_approx_29_days() {
        let days = game_transfer_days(1.0, 9.537);
        assert_abs_diff_eq!(days, 28.6, epsilon = 0.5);
    }

    #[test]
    fn is_symmetric() {
        assert_eq!(game_transfer_days(1.0, 5.0), game_transfer_days(5.0, 1.0));
    }
}

mod game_transfer_speed_tests {
    use super::*;

    #[test]
    fn traverses_pi_radians_in_the_given_days() {
        let days = 10.0_f64;
        let speed = game_transfer_speed(days);
        assert_abs_diff_eq!(speed * days, std::f64::consts::PI, epsilon = 1e-10);
    }
}

mod compute_mu_tests {
    use super::*;

    #[test]
    fn returns_correct_mu_for_solar_mass() {
        let mu = compute_mu(1.0);
        let expected =
            (4.0 * std::f64::consts::PI * std::f64::consts::PI) / (DAYS_PER_YEAR * DAYS_PER_YEAR);
        assert_relative_eq!(mu, expected, epsilon = 1e-10);
    }

    #[test]
    fn scales_linearly_with_star_mass() {
        assert_relative_eq!(compute_mu(2.0), 2.0 * compute_mu(1.0), epsilon = 1e-10);
    }
}

mod derive_star_mass_tests {
    use super::*;

    #[test]
    fn returns_1_for_earth_orbit_1_au_1_year() {
        let bodies = vec![
            BodyData {
                body_type: "Star".to_string(),
                distance: 0.0,
                period: 0.0,
                name: None,
            },
            BodyData {
                body_type: "Planet".to_string(),
                distance: 1.0,
                period: 1.0,
                name: Some("Earth".to_string()),
            },
        ];
        let mass = derive_star_mass(&bodies);
        assert_abs_diff_eq!(mass, 1.0, epsilon = 1e-5);
    }

    #[test]
    fn derives_consistent_mass_from_jupiter() {
        let bodies = vec![
            BodyData {
                body_type: "Star".to_string(),
                distance: 0.0,
                period: 0.0,
                name: None,
            },
            BodyData {
                body_type: "Planet".to_string(),
                distance: 5.203,
                period: 11.86,
                name: Some("Jupiter".to_string()),
            },
        ];
        let mass = derive_star_mass(&bodies);
        assert_abs_diff_eq!(mass, 1.0, epsilon = 0.1);
    }

    #[test]
    fn returns_1_when_body_list_is_empty() {
        assert_eq!(derive_star_mass(&[]), 1.0);
    }

    #[test]
    fn returns_1_when_all_bodies_have_period_0() {
        let bodies = vec![BodyData {
            body_type: "Planet".to_string(),
            distance: 1.0,
            period: 0.0,
            name: None,
        }];
        assert_eq!(derive_star_mass(&bodies), 1.0);
    }
}

mod capture_blend_position_tests {
    use super::*;

    fn ship() -> Vec3 {
        Vec3 {
            x: 10.0,
            y: 0.0,
            z: 0.0,
        }
    }

    fn target() -> Vec3 {
        Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    const OFFSET: f64 = 2.0;

    #[test]
    fn returns_original_position_when_t_now_le_0_85() {
        let result = capture_blend_position(ship(), target(), OFFSET, 0.85);
        assert_abs_diff_eq!(result.x, 10.0, epsilon = 1e-6);
        assert_abs_diff_eq!(result.y, 0.0, epsilon = 1e-6);
        assert_abs_diff_eq!(result.z, 0.0, epsilon = 1e-6);
    }

    #[test]
    fn returns_original_position_at_t_now_0() {
        let result = capture_blend_position(ship(), target(), OFFSET, 0.0);
        assert_abs_diff_eq!(result.x, 10.0, epsilon = 1e-6);
        assert_abs_diff_eq!(result.z, 0.0, epsilon = 1e-6);
    }

    #[test]
    fn at_t_now_1_position_is_very_close_to_target_plus_offset_along_approach_angle() {
        // Ship at (10,0,0), target at origin — capAngle = atan2(0-0, 10-0) = 0
        // capX = 0 + cos(0) * 2 = 2, capZ = 0 + sin(0) * 2 = 0
        let result = capture_blend_position(ship(), target(), OFFSET, 1.0);
        assert_abs_diff_eq!(result.x, 2.0, epsilon = 1e-3);
        assert_abs_diff_eq!(result.z, 0.0, epsilon = 1e-3);
    }

    #[test]
    fn smoothstep_at_midpoint_t_now_0_925_is_approximately_50_percent_blend() {
        // tNow=0.925: blendRaw=(0.925-0.85)/0.15=0.5, smoothstep(0.5)=0.5
        // blended x = 10 + 0.5 * (2 - 10) = 6
        let result = capture_blend_position(ship(), target(), OFFSET, 0.925);
        assert_abs_diff_eq!(result.x, 6.0, epsilon = 1e-3);
    }

    #[test]
    fn offset_controls_approach_distance_from_target() {
        let large_offset = 5.0;
        let result = capture_blend_position(ship(), target(), large_offset, 1.0);
        // capX = cos(0) * 5 = 5
        assert_abs_diff_eq!(result.x, 5.0, epsilon = 1e-3);
    }

    #[test]
    fn y_axis_blends_toward_target_y() {
        let ship_above = Vec3 {
            x: 10.0,
            y: 5.0,
            z: 0.0,
        };
        let target_below = Vec3 {
            x: 0.0,
            y: -5.0,
            z: 0.0,
        };
        let result = capture_blend_position(ship_above, target_below, OFFSET, 1.0);
        // At t=1, blend=1, y = 5 + 1 * (-5 - 5) = -5
        assert_abs_diff_eq!(result.y, -5.0, epsilon = 1e-3);
    }
}

mod predict_orbital_position_tests {
    use super::*;

    #[test]
    fn planet_with_zero_eccentricity_at_t0_returns_position_on_circular_orbit() {
        let r = scale_dist(1.0); // 1 AU scaled
        let pos = predict_orbital_position(OrbitalPredictionParams {
            x: r,
            y: 0.0,
            z: 0.0,
            speed: 0.01,
            angle: 0.0,
            days_from_now: 0.0,
            e: 0.0,
            distance: 1.0,
            comet: None,
            moon: None,
        });
        assert_abs_diff_eq!(pos.x, r, epsilon = 1e-3);
        assert_eq!(pos.y, 0.0);
        assert_abs_diff_eq!(pos.z, 0.0, epsilon = 1e-3);
    }

    #[test]
    fn planet_propagates_forward_position_changes_with_time() {
        let p0 = predict_orbital_position(OrbitalPredictionParams {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            speed: 0.01,
            angle: 0.0,
            days_from_now: 0.0,
            e: 0.0,
            distance: 1.0,
            comet: None,
            moon: None,
        });
        let x0 = p0.x;
        let z0 = p0.z;

        let p1 = predict_orbital_position(OrbitalPredictionParams {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            speed: 0.01,
            angle: 0.0,
            days_from_now: 100.0,
            e: 0.0,
            distance: 1.0,
            comet: None,
            moon: None,
        });
        let dx = p1.x - x0;
        let dz = p1.z - z0;
        assert!(dx * dx + dz * dz > 0.0);
    }

    #[test]
    fn comet_uses_3d_inclined_orbit_y_nonzero_for_inclined_comet() {
        let pos = predict_orbital_position(OrbitalPredictionParams {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            speed: 0.005,
            angle: 1.0,
            days_from_now: 0.0,
            e: 0.9,
            distance: 10.0,
            comet: Some(CometElements {
                a: 10.0,
                e: 0.9,
                inc_rad: 0.5,
                node_rad: 0.3,
                peri_rad: 0.1,
            }),
            moon: None,
        });
        // Inclined orbit should produce non-zero y — not close to 0 within 0.1
        assert!((pos.y).abs() > 0.1);
    }

    #[test]
    fn moon_adds_parent_offset() {
        let pos = predict_orbital_position(OrbitalPredictionParams {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            speed: 0.1,
            angle: 0.0,
            days_from_now: 0.0,
            e: 0.0,
            distance: 0.003,
            comet: None,
            moon: Some(MoonParams {
                parent_x: 0.0,
                parent_z: 0.0,
                parent_angle: 0.0,
                parent_speed: 0.01,
                parent_distance: 1.0,
                parent_e: 0.0,
            }),
        });
        // Moon at angle=0 around parent at angle=0: parent at (scaleDist(1), 0)
        // Moon offset added on top of parent position
        let parent_r = scale_dist(1.0);
        assert!(pos.x > parent_r - 1.0);
        assert_eq!(pos.y, 0.0);
    }
}

mod compute_transfer_knots_tests {
    use super::*;

    fn depart() -> Vec3 {
        Vec3 {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }

    fn target() -> Vec3 {
        Vec3 {
            x: 10.0,
            y: 0.0,
            z: 0.0,
        }
    }

    #[test]
    fn produces_correct_distance() {
        let knots = compute_transfer_knots(depart(), target());
        let dx = knots.p1x - knots.p0x;
        let dy = knots.p1y - knots.p0y;
        let dz = knots.p1z - knots.p0z;
        assert_abs_diff_eq!((dx * dx + dy * dy + dz * dz).sqrt(), 10.0, epsilon = 1e-5);
    }

    #[test]
    fn tangent_magnitude_is_0_4_times_distance() {
        let knots = compute_transfer_knots(depart(), target());
        let t_mag = (knots.t0x.powi(2) + knots.t0y.powi(2) + knots.t0z.powi(2)).sqrt();
        assert_abs_diff_eq!(t_mag, 10.0 * 0.4, epsilon = 1e-5);
    }

    #[test]
    fn tangents_are_symmetric_same_direction() {
        let knots = compute_transfer_knots(depart(), target());
        assert_abs_diff_eq!(knots.t0x, knots.t1x, epsilon = 1e-10);
        assert_abs_diff_eq!(knots.t0y, knots.t1y, epsilon = 1e-10);
        assert_abs_diff_eq!(knots.t0z, knots.t1z, epsilon = 1e-10);
    }

    #[test]
    fn zero_distance_produces_zero_tangents() {
        let same = Vec3 {
            x: 5.0,
            y: 3.0,
            z: 1.0,
        };
        let knots = compute_transfer_knots(same, same);
        assert_eq!(knots.t0x, 0.0);
        assert_eq!(knots.t0y, 0.0);
        assert_eq!(knots.t0z, 0.0);
        assert_eq!(knots.t1x, 0.0);
        assert_eq!(knots.t1y, 0.0);
        assert_eq!(knots.t1z, 0.0);
    }
}

mod should_respline_tests {
    use super::*;

    #[test]
    fn returns_false_when_delta_is_small() {
        assert!(!should_respline(0.01, 100.0));
    }

    #[test]
    fn returns_true_when_delta_exceeds_threshold() {
        assert!(should_respline(5.0, 100.0));
    }

    #[test]
    fn threshold_scales_with_remaining_distance() {
        // At small remaining distance, threshold is 0.25 (absolute floor)
        assert!(should_respline(0.3, 10.0)); // 0.3 > max(0.25, 0.1) = 0.25
                                             // At large remaining distance, threshold is remainingDistSq * 0.01
        assert!(!should_respline(0.3, 1000.0)); // 0.3 < max(0.25, 10.0) = 10.0
    }
}

mod compute_respline_knots_tests {
    use super::*;

    fn cur_pos() -> Vec3 {
        Vec3 {
            x: 5.0,
            y: 0.0,
            z: 0.0,
        }
    }

    fn cur_deriv() -> Vec3 {
        Vec3 {
            x: 10.0,
            y: 0.0,
            z: 0.0,
        }
    }

    fn new_target() -> Vec3 {
        Vec3 {
            x: 15.0,
            y: 0.0,
            z: 0.0,
        }
    }

    #[test]
    fn preserves_departure_position() {
        let knots = compute_respline_knots(cur_pos(), cur_deriv(), new_target(), 50.0, 100.0);
        assert_eq!(knots.p0x, 5.0);
        assert_eq!(knots.p0y, 0.0);
        assert_eq!(knots.p0z, 0.0);
    }

    #[test]
    fn scales_departure_tangent_by_time_ratio() {
        let knots = compute_respline_knots(cur_pos(), cur_deriv(), new_target(), 50.0, 100.0);
        // scale = 50 / 100 = 0.5
        assert_abs_diff_eq!(knots.t0x, 10.0 * 0.5, epsilon = 1e-5);
        assert_abs_diff_eq!(knots.t0y, 0.0 * 0.5, epsilon = 1e-5);
        assert_abs_diff_eq!(knots.t0z, 0.0 * 0.5, epsilon = 1e-5);
    }

    #[test]
    fn arrival_tangent_points_toward_target() {
        let knots = compute_respline_knots(cur_pos(), cur_deriv(), new_target(), 50.0, 100.0);
        // newTarget at (15,0,0), curPos at (5,0,0) -> direction is +x
        assert!(knots.t1x > 0.0);
        assert_abs_diff_eq!(knots.t1y, 0.0, epsilon = 1e-10);
        assert_abs_diff_eq!(knots.t1z, 0.0, epsilon = 1e-10);
    }
}

mod check_transfer_arrival_tests {
    use super::*;

    #[test]
    fn returns_time_arrived_when_elapsed_ge_total() {
        let result = check_transfer_arrival(100.0, 90.0, 5.0, 1.5);
        assert!(result.arrived);
        assert_eq!(result.reason, ArrivalReason::Time);
    }

    #[test]
    fn returns_distance_arrived_when_close_enough() {
        let result = check_transfer_arrival(50.0, 100.0, 1.0, 1.5);
        assert!(result.arrived);
        assert_eq!(result.reason, ArrivalReason::Distance);
    }

    #[test]
    fn returns_not_arrived_when_both_conditions_fail() {
        let result = check_transfer_arrival(50.0, 100.0, 5.0, 1.5);
        assert!(!result.arrived);
        assert_eq!(result.reason, ArrivalReason::None);
    }

    #[test]
    fn time_takes_priority_over_distance_when_both_true() {
        let result = check_transfer_arrival(100.0, 90.0, 1.0, 1.5);
        assert!(result.arrived);
        assert_eq!(result.reason, ArrivalReason::Time);
    }
}
