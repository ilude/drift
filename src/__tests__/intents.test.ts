import { beforeEach, describe, expect, it } from "vitest";
import {
	clearIntent,
	getClaimedTargets,
	getIntentForShip,
	isTargetClaimed,
	publishIntent,
} from "../core/intents";
import { state } from "../core/state";

describe("publishIntent", () => {
	beforeEach(() => {
		state.shipIntents.clear();
	});

	it("adds intent to the pool", () => {
		publishIntent("Explorer", { type: "surveying", target: "Mars", shipName: "Explorer" });
		expect(state.shipIntents.size).toBe(1);
		expect(state.shipIntents.get("Explorer")?.type).toBe("surveying");
	});

	it("overwrites previous intent for same ship", () => {
		publishIntent("Explorer", { type: "surveying", target: "Mars", shipName: "Explorer" });
		publishIntent("Explorer", { type: "idle", location: "Mars", shipName: "Explorer" });
		expect(state.shipIntents.size).toBe(1);
		expect(state.shipIntents.get("Explorer")?.type).toBe("idle");
	});
});

describe("clearIntent", () => {
	beforeEach(() => {
		state.shipIntents.clear();
	});

	it("removes intent from the pool", () => {
		publishIntent("Explorer", { type: "idle", location: "Earth", shipName: "Explorer" });
		clearIntent("Explorer");
		expect(state.shipIntents.size).toBe(0);
	});

	it("no-op for non-existent ship", () => {
		clearIntent("Ghost");
		expect(state.shipIntents.size).toBe(0);
	});
});

describe("getIntentForShip", () => {
	beforeEach(() => {
		state.shipIntents.clear();
	});

	it("returns the intent for a known ship", () => {
		publishIntent("Explorer", { type: "refueling", location: "Earth", shipName: "Explorer" });
		expect(getIntentForShip("Explorer")?.type).toBe("refueling");
	});

	it("returns undefined for unknown ship", () => {
		expect(getIntentForShip("Nobody")).toBeUndefined();
	});
});

describe("isTargetClaimed", () => {
	beforeEach(() => {
		state.shipIntents.clear();
	});

	it("returns true when another ship is surveying the target", () => {
		publishIntent("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		expect(isTargetClaimed("Mars", "Ship-B")).toBe(true);
	});

	it("returns true when another ship is transferring to the target", () => {
		publishIntent("Ship-A", { type: "transferring", destination: "Mars", shipName: "Ship-A" });
		expect(isTargetClaimed("Mars", "Ship-B")).toBe(true);
	});

	it("returns false when the claiming ship IS the excluded ship", () => {
		publishIntent("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		expect(isTargetClaimed("Mars", "Ship-A")).toBe(false);
	});

	it("returns false when target is unclaimed", () => {
		publishIntent("Ship-A", { type: "surveying", target: "Venus", shipName: "Ship-A" });
		expect(isTargetClaimed("Mars", "Ship-B")).toBe(false);
	});

	it("returns false on empty pool", () => {
		expect(isTargetClaimed("Mars", "Ship-A")).toBe(false);
	});
});

describe("getClaimedTargets", () => {
	beforeEach(() => {
		state.shipIntents.clear();
	});

	it("returns set of targets claimed by other ships", () => {
		publishIntent("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		publishIntent("Ship-B", { type: "transferring", destination: "Venus", shipName: "Ship-B" });
		const claimed = getClaimedTargets("Ship-C");
		expect(claimed.has("Mars")).toBe(true);
		expect(claimed.has("Venus")).toBe(true);
		expect(claimed.size).toBe(2);
	});

	it("excludes the requesting ship's own claims", () => {
		publishIntent("Ship-A", { type: "surveying", target: "Mars", shipName: "Ship-A" });
		const claimed = getClaimedTargets("Ship-A");
		expect(claimed.has("Mars")).toBe(false);
		expect(claimed.size).toBe(0);
	});

	it("ignores non-target intents (refueling, idle, etc.)", () => {
		publishIntent("Ship-A", { type: "refueling", location: "Earth", shipName: "Ship-A" });
		publishIntent("Ship-B", { type: "idle", location: "Mars", shipName: "Ship-B" });
		const claimed = getClaimedTargets("Ship-C");
		expect(claimed.size).toBe(0);
	});
});
