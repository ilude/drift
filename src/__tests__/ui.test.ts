/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BodyEntry } from "../types";

// Set up required DOM elements before ui.js loads
beforeAll(() => {
	const ids = [
		"body-list",
		"fps-display",
		"time-display",
		"zoom-display",
		"toggle-labels",
		"toggle-orbits",
		"toggle-grid",
		"toggle-trails",
		"system-switcher-btn",
		"system-switcher-dropdown",
		"system-list",
		"btn-discover",
		"btn-random",
		"seed-input",
		"btn-pause",
		"btn-slow",
		"btn-normal",
		"btn-fast",
		"info-panel",
		"info-close",
		"info-position",
		"info-ship-engine",
		"ship-engine-value",
		"info-ship-fuel",
		"ship-fuel-value",
		"info-ship-deltav",
		"ship-deltav-value",
	];
	ids.forEach((id) => {
		if (!document.getElementById(id)) {
			const el = document.createElement("div");
			el.id = id;
			if (id.startsWith("toggle-")) {
				const input = document.createElement("input");
				input.type = "checkbox";
				input.id = id;
				(input as HTMLInputElement).checked = true;
				document.body.appendChild(input);
			} else {
				document.body.appendChild(el);
			}
		}
	});
});

// Mock scene.js and selection.js to avoid Three.js side effects
vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	camera: {
		position: {
			length: () => 120,
			clone: () => ({
				x: 0,
				y: 120,
				z: 80,
				subVectors: () => ({ normalize: () => ({ x: 0, y: 1, z: 0 }) }),
			}),
		},
		aspect: 1,
		updateProjectionMatrix: vi.fn(),
	},
	renderer: {
		setSize: vi.fn(),
		setPixelRatio: vi.fn(),
		domElement: { addEventListener: vi.fn() },
	},
	controls: {
		target: {
			x: 0,
			z: 0,
			clone: () => ({ x: 0, y: 0, z: 0 }),
		},
	},
	labelContainer: { appendChild: vi.fn(), style: {} },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
	gridGroup: { visible: true },
	ZOOM_BASE: 120,
}));

vi.mock("../rendering/rendering", () => ({
	COMET_ORBIT_OPACITY: 0.03,
	COMET_ORBIT_SELECTED_OPACITY: 0.05,
	initiateTransfer: vi.fn(),
}));

import { state } from "../core/state";
import { selectBody } from "../ui/selection";
import { hashString } from "../ui/ui";

describe("ship info panel", () => {
	it("shows engine, fuel, and delta-v elements for ships", () => {
		// Set up minimal DOM elements selectBody needs
		[
			"info-panel",
			"info-title",
			"info-type",
			"info-distance",
			"info-period",
			"info-radius",
			"info-moons",
			"info-transfer",
			"info-ship-engine",
			"ship-engine-value",
			"info-ship-fuel",
			"ship-fuel-value",
			"info-ship-deltav",
			"ship-deltav-value",
			"transfer-target",
		].forEach((id) => {
			if (!document.getElementById(id)) {
				const el = document.createElement(id === "transfer-target" ? "select" : "div");
				el.id = id;
				if (
					id === "info-panel" ||
					id === "info-transfer" ||
					id === "info-ship-engine" ||
					id === "info-ship-fuel" ||
					id === "info-ship-deltav"
				) {
					el.classList.add("hidden");
				}
				document.body.appendChild(el);
			}
		});

		state.BODIES = [
			{
				name: "Sun",
				type: "Star" as const,
				distance: 0,
				e: 0,
				period: 0,
				radius: 696340,
				mass: 1.989e30,
				color: "#ffdd44",
				moons: [],
			},
			{
				name: "Earth",
				type: "Planet" as const,
				distance: 1.0,
				e: 0,
				period: 1.0,
				radius: 6371,
				mass: 5.972e24,
				color: "#4488ff",
				moons: [],
			},
		];
		state.bodyMeshes = [];

		const shipEntry = {
			data: {
				name: "Ship",
				type: "Ship",
				distance: 1.0,
				period: 0,
				radius: 1,
				color: "#bbbbbb",
				moons: [],
			},
			mesh: { position: { x: 0, y: 0, z: 0 } },
			selRing: { material: { opacity: 0 } },
			isShip: true,
			isMoon: false,
			isComet: false,
			shipState: "orbiting",
			hostPlanetName: "Earth",
			screenSize: 0.02,
			orbitA: 1.0,
			engineId: "conventional",
			dryMassKg: 5000,
			fuelKg: 50000,
			fuelCapacityKg: 50000,
			crew: { count: 10, morale: 80, lastShoreLeave: 0, deploymentLimit: 180 },
			maintenance: {
				hullIntegrity: 100,
				age: 0,
				totalAge: 0,
				lastRefitAge: 0,
				supplies: 100,
				maxSupplies: 100,
			},
			action: { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 },
			commander: { judgment: 0.3, experience: 0 },
			commands: [],
			immediateCommand: null,
			stationTarget: null,
			transferStartTime: 0,
			transferTimeDays: 0,
			transferDisplayStart: 0,
		};
		state.bodyMeshes.push(shipEntry as unknown as BodyEntry);
		state.bodyMeshes.push({
			data: state.BODIES?.[1],
			mesh: { position: { x: 100, y: 0, z: 0 } },
			isShip: false,
			isMoon: false,
			isComet: false,
		} as unknown as BodyEntry);

		selectBody(shipEntry as unknown as BodyEntry);

		expect(document.getElementById("info-ship-engine")?.classList.contains("hidden")).toBe(false);
		expect(document.getElementById("info-ship-fuel")?.classList.contains("hidden")).toBe(false);
		expect(document.getElementById("ship-engine-value")?.textContent).toBe("Conventional TN");
		expect(document.getElementById("ship-fuel-value")?.textContent).toContain("50.00t");
	});
});

describe("hashString", () => {
	it("is deterministic", () => {
		expect(hashString("test")).toBe(hashString("test"));
	});

	it("different strings produce different hashes", () => {
		expect(hashString("hello")).not.toBe(hashString("world"));
		expect(hashString("abc")).not.toBe(hashString("xyz"));
		expect(hashString("foo")).not.toBe(hashString("bar"));
	});

	it("returns a positive integer", () => {
		const h = hashString("anything");
		expect(h).toBeGreaterThan(0);
		expect(Number.isInteger(h)).toBe(true);
	});

	it("handles empty string", () => {
		const h = hashString("");
		expect(h).toBeGreaterThan(0);
		expect(Number.isInteger(h)).toBe(true);
	});

	it("returns consistent results for same input", () => {
		const results = Array.from({ length: 10 }, () => hashString("consistent"));
		expect(new Set(results).size).toBe(1);
	});
});
