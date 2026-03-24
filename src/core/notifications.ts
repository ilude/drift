import type { GameNotification, NotificationType } from "../types";
import { state } from "./state";

const DEFAULT_COALESCE_WINDOW_MS = 2000;

let nextId = 1;
let lastNotificationRealTime = 0;
let lastNotificationType: NotificationType | null = null;

export function addNotification(type: NotificationType, message: string, bodyName?: string): void {
	const notification: GameNotification = {
		id: nextId++,
		type,
		message,
		simTime: state.simTime,
		bodyName,
		read: false,
	};

	// Cap at 200: evict oldest read first, then oldest unread
	if (state.notifications.length >= 200) {
		const readIdx = state.notifications.findIndex((n) => n.read);
		if (readIdx !== -1) {
			state.notifications.splice(readIdx, 1);
		} else {
			state.notifications.shift();
		}
	}

	state.notifications.push(notification);

	if (state.notificationPauseConfig[type]) {
		state.timeSpeed = 0;
		if (typeof window !== "undefined") {
			window.dispatchEvent(new Event("wake-render"));
		}
	}
}

export function addCoalescedNotification(
	type: NotificationType,
	message: string,
	bodyName?: string,
	coalescingWindowMs: number = DEFAULT_COALESCE_WINDOW_MS,
): void {
	const now = Date.now();
	const withinWindow = now - lastNotificationRealTime <= coalescingWindowMs;
	const last = state.notifications[state.notifications.length - 1];

	if (withinWindow && last && last.type === type && lastNotificationType === type) {
		if (bodyName) {
			last.message = `${last.message}, ${bodyName}`;
		} else {
			last.message = message;
		}
	} else {
		addNotification(type, message, bodyName);
		lastNotificationType = type;
	}

	lastNotificationRealTime = now;
}

export function getUnreadCount(): number {
	return state.notifications.filter((n) => !n.read).length;
}

export function markRead(id: number): void {
	const n = state.notifications.find((n) => n.id === id);
	if (n) n.read = true;
}

export function markAllRead(): void {
	for (const n of state.notifications) {
		n.read = true;
	}
}

export function shouldPause(type: NotificationType): boolean {
	return state.notificationPauseConfig[type];
}

export function setPauseConfig(type: NotificationType, enabled: boolean): void {
	state.notificationPauseConfig[type] = enabled;
}

export function clearNotifications(): void {
	state.notifications = [];
	nextId = 1;
	lastNotificationRealTime = 0;
	lastNotificationType = null;
}
