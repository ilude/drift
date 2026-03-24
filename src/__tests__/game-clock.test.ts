import { describe, expect, it } from "vitest";
import { GameClock } from "../core/game-clock";

describe("GameClock", () => {
	it("starts at zero", () => {
		const clock = new GameClock();
		expect(clock.days).toBe(0);
		expect(clock.totalSeconds).toBe(0);
	});

	it("constructs from days", () => {
		const clock = new GameClock(1);
		expect(clock.days).toBe(1);
		expect(clock.totalSeconds).toBe(86400);
	});

	it("advanceDays adds fractional days", () => {
		const clock = new GameClock(0);
		clock.advanceDays(0.5);
		expect(clock.days).toBe(0.5);
		expect(clock.totalSeconds).toBe(43200);
	});

	it("advanceDays accumulates without drift", () => {
		const clock = new GameClock(0);
		for (let i = 0; i < 1000; i++) {
			clock.advanceDays(0.001);
		}
		expect(clock.days).toBeCloseTo(1, 10);
	});

	it("setDays overwrites current time", () => {
		const clock = new GameClock(100);
		clock.setDays(365.5);
		expect(clock.days).toBe(365.5);
	});

	it("toDate returns epoch at day 0", () => {
		const clock = new GameClock(0);
		const d = clock.toDate();
		expect(d.getFullYear()).toBe(2038);
		expect(d.getMonth()).toBe(0);
		expect(d.getDate()).toBe(20);
	});

	it("toDate returns next day at day 1", () => {
		const clock = new GameClock(1);
		const d = clock.toDate();
		expect(d.getDate()).toBe(21);
	});

	it("toDate returns noon at day 0.5", () => {
		const clock = new GameClock(0.5);
		const d = clock.toDate();
		expect(d.getHours()).toBe(12);
	});

	it("dayNumber floors fractional days", () => {
		expect(new GameClock(0.5).dayNumber()).toBe(0);
		expect(new GameClock(1.9).dayNumber()).toBe(1);
		expect(new GameClock(3).dayNumber()).toBe(3);
	});

	it("formatDateTime produces correct format", () => {
		const clock = new GameClock(0);
		expect(clock.formatDateTime()).toMatch(/2038-01-20 00:00:00/);
	});

	it("formatDateTime shows hours for fractional days", () => {
		const clock = new GameClock(0.5);
		expect(clock.formatDateTime()).toMatch(/2038-01-20 12:00:00/);
	});

	it("formatDate produces date-only format", () => {
		const clock = new GameClock(0.5);
		expect(clock.formatDate()).toBe("2038-01-20");
	});

	it("toJSON returns days for serialization", () => {
		const clock = new GameClock(365.5);
		expect(clock.toJSON()).toBe(365.5);
		expect(JSON.stringify({ simTime: clock })).toBe('{"simTime":365.5}');
	});

	it("fromDays creates correct clock", () => {
		const clock = GameClock.fromDays(10);
		expect(clock.days).toBe(10);
	});

	it("fromSeconds creates correct clock", () => {
		const clock = GameClock.fromSeconds(86400);
		expect(clock.days).toBe(1);
	});

	it("totalSeconds is consistent with days", () => {
		const clock = new GameClock(2.5);
		expect(clock.totalSeconds).toBe(2.5 * 86400);
	});

	it("handles large time values (100 years)", () => {
		const clock = new GameClock(36525);
		expect(clock.days).toBe(36525);
		clock.advanceDays(1 / 86400); // add 1 second
		expect(clock.days).toBeGreaterThan(36525);
		expect(clock.totalSeconds).toBeCloseTo(36525 * 86400 + 1, 5);
	});
});
