import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameClock } from "../core/game-clock";
import {
	addCoalescedNotification,
	addNotification,
	clearNotifications,
	getUnreadCount,
	markAllRead,
	markRead,
	setPauseConfig,
	shouldPause,
} from "../core/notifications";
import { state } from "../core/state";

function resetState() {
	state.notifications = [];
	state.simTime = new GameClock(100);
	state.timeSpeed = 1;
	state.notificationPauseConfig = {
		"survey-complete": false,
		"low-fuel": false,
		"low-morale": false,
		"maintenance-needed": false,
		"mission-complete": true,
		malfunction: true,
		"ship-destroyed": true,
	};
	clearNotifications();
}

describe("notifications", () => {
	beforeEach(() => {
		resetState();
	});

	describe("addNotification", () => {
		it("creates a notification with correct fields", () => {
			addNotification("low-fuel", "Fuel is low");
			expect(state.notifications).toHaveLength(1);
			const n = state.notifications[0];
			expect(n.type).toBe("low-fuel");
			expect(n.message).toBe("Fuel is low");
			expect(n.simTime).toBe(100);
			expect(n.read).toBe(false);
			expect(typeof n.id).toBe("number");
		});

		it("stores bodyName when provided", () => {
			addNotification("survey-complete", "Surveyed Mars", "Mars");
			expect(state.notifications[0].bodyName).toBe("Mars");
		});

		it("bodyName is undefined when not provided", () => {
			addNotification("low-fuel", "Fuel is low");
			expect(state.notifications[0].bodyName).toBeUndefined();
		});

		it("auto-increments ids across multiple notifications", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			addNotification("malfunction", "msg3");
			const ids = state.notifications.map((n) => n.id);
			expect(ids[1]).toBe(ids[0] + 1);
			expect(ids[2]).toBe(ids[1] + 1);
		});

		it("does not pause when pause config is false", () => {
			addNotification("low-fuel", "Fuel is low");
			expect(state.timeSpeed).toBe(1);
		});

		it("pauses when pause config is true for that type", () => {
			addNotification("malfunction", "Engine failure");
			expect(state.timeSpeed).toBe(0);
		});

		it("does not pause on survey-complete when config is false", () => {
			expect(state.notificationPauseConfig["survey-complete"]).toBe(false);
			addNotification("survey-complete", "Surveyed Mars");
			expect(state.timeSpeed).toBe(1);
		});

		it("caps at 200 notifications by evicting oldest read notifications first", () => {
			// Add 200 notifications, mark all but last 10 as read
			for (let i = 0; i < 200; i++) {
				addNotification("low-fuel", `msg${i}`);
			}
			// Mark first 100 as read
			for (let i = 0; i < 100; i++) {
				state.notifications[i].read = true;
			}
			const idBefore201 = state.notifications[0].id;
			addNotification("low-fuel", "msg200");
			expect(state.notifications).toHaveLength(200);
			// The oldest read notification (index 0) should have been evicted
			expect(state.notifications[0].id).not.toBe(idBefore201);
		});

		it("caps at 200 by evicting oldest unread when all are unread", () => {
			for (let i = 0; i < 200; i++) {
				addNotification("low-fuel", `msg${i}`);
			}
			const oldestId = state.notifications[0].id;
			addNotification("low-fuel", "msg200");
			expect(state.notifications).toHaveLength(200);
			// Oldest notification evicted
			const ids = state.notifications.map((n) => n.id);
			expect(ids).not.toContain(oldestId);
		});
	});

	describe("getUnreadCount", () => {
		it("returns 0 with no notifications", () => {
			expect(getUnreadCount()).toBe(0);
		});

		it("returns correct unread count", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			addNotification("malfunction", "msg3");
			// malfunction pauses, reset speed for test clarity
			state.timeSpeed = 1;
			markRead(state.notifications[0].id);
			expect(getUnreadCount()).toBe(2);
		});

		it("returns 0 after markAllRead", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			markAllRead();
			expect(getUnreadCount()).toBe(0);
		});
	});

	describe("markRead", () => {
		it("sets read to true on the correct notification", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			const id = state.notifications[0].id;
			markRead(id);
			expect(state.notifications[0].read).toBe(true);
			expect(state.notifications[1].read).toBe(false);
		});

		it("does nothing for unknown id", () => {
			addNotification("low-fuel", "msg1");
			markRead(99999);
			expect(state.notifications[0].read).toBe(false);
		});
	});

	describe("markAllRead", () => {
		it("marks all notifications as read", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			markAllRead();
			expect(state.notifications.every((n) => n.read)).toBe(true);
		});
	});

	describe("shouldPause", () => {
		it("returns true for malfunction (default config)", () => {
			expect(shouldPause("malfunction")).toBe(true);
		});

		it("returns false for survey-complete (default config)", () => {
			expect(shouldPause("survey-complete")).toBe(false);
		});

		it("returns updated value after setPauseConfig", () => {
			setPauseConfig("low-fuel", true);
			expect(shouldPause("low-fuel")).toBe(true);
			setPauseConfig("low-fuel", false);
			expect(shouldPause("low-fuel")).toBe(false);
		});
	});

	describe("setPauseConfig", () => {
		it("changes pause behavior for the type", () => {
			setPauseConfig("low-fuel", true);
			addNotification("low-fuel", "Fuel low");
			expect(state.timeSpeed).toBe(0);
		});
	});

	describe("clearNotifications", () => {
		it("empties the notifications array", () => {
			addNotification("low-fuel", "msg1");
			addNotification("low-morale", "msg2");
			clearNotifications();
			expect(state.notifications).toHaveLength(0);
		});

		it("resets id counter so next id starts fresh", () => {
			addNotification("low-fuel", "msg1");
			clearNotifications();
			addNotification("low-fuel", "msg2");
			expect(state.notifications[0].id).toBe(1);
		});
	});

	describe("addCoalescedNotification", () => {
		it("coalesces same-type notification within the default window", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);
			addCoalescedNotification("survey-complete", "Surveyed Mars", "Mars");
			// Same type, same window
			vi.spyOn(Date, "now").mockReturnValue(now + 500);
			addCoalescedNotification("survey-complete", "Surveyed Ceres", "Ceres");
			expect(state.notifications).toHaveLength(1);
			expect(state.notifications[0].message).toContain("Ceres");
			vi.restoreAllMocks();
		});

		it("creates a new entry outside the coalescing window", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);
			addCoalescedNotification("survey-complete", "Surveyed Mars", "Mars");
			vi.spyOn(Date, "now").mockReturnValue(now + 5000);
			addCoalescedNotification("survey-complete", "Surveyed Ceres", "Ceres");
			expect(state.notifications).toHaveLength(2);
			vi.restoreAllMocks();
		});

		it("creates a new entry for a different type even within the window", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);
			addCoalescedNotification("survey-complete", "Surveyed Mars", "Mars");
			vi.spyOn(Date, "now").mockReturnValue(now + 500);
			addCoalescedNotification("low-fuel", "Fuel low");
			expect(state.notifications).toHaveLength(2);
			vi.restoreAllMocks();
		});

		it("respects custom coalescing window", () => {
			const now = Date.now();
			vi.spyOn(Date, "now").mockReturnValue(now);
			addCoalescedNotification("survey-complete", "Surveyed Mars", "Mars", 500);
			vi.spyOn(Date, "now").mockReturnValue(now + 600);
			addCoalescedNotification("survey-complete", "Surveyed Ceres", "Ceres", 500);
			expect(state.notifications).toHaveLength(2);
			vi.restoreAllMocks();
		});
	});
});
