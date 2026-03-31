use drift_math::game_clock::*;

mod game_clock {
    use super::*;

    #[test]
    fn starts_at_zero() {
        let clock = GameClock::new();
        assert_eq!(clock.days(), 0.0);
        assert_eq!(clock.total_seconds(), 0.0);
    }

    #[test]
    fn constructs_from_days() {
        let clock = GameClock::from_days(1.0);
        assert_eq!(clock.days(), 1.0);
        assert_eq!(clock.total_seconds(), 86_400.0);
    }

    #[test]
    fn advance_days_adds_fractional_days() {
        let mut clock = GameClock::from_days(0.0);
        clock.advance_days(0.5);
        assert_eq!(clock.days(), 0.5);
        assert_eq!(clock.total_seconds(), 43_200.0);
    }

    #[test]
    fn advance_days_accumulates_without_drift() {
        let mut clock = GameClock::from_days(0.0);
        for _ in 0..1000 {
            clock.advance_days(0.001);
        }
        // Same precision as TS test: toBeCloseTo(1, 10) → within 5e-11
        let diff = (clock.days() - 1.0).abs();
        assert!(
            diff < 1e-10,
            "accumulated days {:.15} too far from 1.0",
            clock.days()
        );
    }

    #[test]
    fn set_days_overwrites_current_time() {
        let mut clock = GameClock::from_days(100.0);
        clock.set_days(365.5);
        assert_eq!(clock.days(), 365.5);
    }

    #[test]
    fn to_date_returns_epoch_at_day_0() {
        let clock = GameClock::from_days(0.0);
        let d = clock.to_date();
        assert_eq!(d.year, 2038);
        assert_eq!(d.month, 1);
        assert_eq!(d.day, 20);
    }

    #[test]
    fn to_date_returns_next_day_at_day_1() {
        let clock = GameClock::from_days(1.0);
        let d = clock.to_date();
        assert_eq!(d.day, 21);
    }

    #[test]
    fn to_date_returns_noon_at_day_0_5() {
        let clock = GameClock::from_days(0.5);
        let d = clock.to_date();
        assert_eq!(d.hour, 12);
    }

    #[test]
    fn day_number_floors_fractional_days() {
        assert_eq!(GameClock::from_days(0.5).day_number(), 0);
        assert_eq!(GameClock::from_days(1.9).day_number(), 1);
        assert_eq!(GameClock::from_days(3.0).day_number(), 3);
    }

    #[test]
    fn format_date_time_produces_correct_format_at_epoch() {
        let clock = GameClock::from_days(0.0);
        assert!(
            clock.format_date_time().contains("2038-01-20 00:00:00"),
            "got: {}",
            clock.format_date_time()
        );
    }

    #[test]
    fn format_date_time_shows_hours_for_fractional_days() {
        let clock = GameClock::from_days(0.5);
        assert!(
            clock.format_date_time().contains("2038-01-20 12:00:00"),
            "got: {}",
            clock.format_date_time()
        );
    }

    #[test]
    fn format_date_produces_date_only_format() {
        let clock = GameClock::from_days(0.5);
        assert_eq!(clock.format_date(), "2038-01-20");
    }

    #[test]
    fn to_json_returns_days_for_serialization() {
        let clock = GameClock::from_days(365.5);
        assert_eq!(clock.to_json(), 365.5);
    }

    #[test]
    fn from_seconds_creates_correct_clock() {
        let clock = GameClock::from_seconds(86_400.0);
        assert_eq!(clock.days(), 1.0);
    }

    #[test]
    fn total_seconds_is_consistent_with_days() {
        let clock = GameClock::from_days(2.5);
        assert_eq!(clock.total_seconds(), 2.5 * 86_400.0);
    }

    #[test]
    fn handles_large_time_values_100_years() {
        let mut clock = GameClock::from_days(36_525.0);
        assert_eq!(clock.days(), 36_525.0);
        // Add 1 second (1/86400 days)
        clock.advance_days(1.0 / 86_400.0);
        assert!(clock.days() > 36_525.0);
        let diff = (clock.total_seconds() - (36_525.0 * 86_400.0 + 1.0)).abs();
        // toBeCloseTo(_, 5) → within 5e-6
        assert!(diff < 5e-6, "total_seconds off by {diff}");
    }
}
