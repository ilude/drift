/**
 * @vitest-environment jsdom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { computeAuWidth, computeLabelPosition, formatZoomText } from "../ui/ui";

vi.mock("../rendering/scene", () => ({
	scene: { add: vi.fn() },
	camera: {
		fov: 60,
		position: { length: () => 120, clone: () => ({ x: 0, y: 120, z: 80 }) },
		aspect: 1,
		updateProjectionMatrix: vi.fn(),
	},
	renderer: {
		setSize: vi.fn(),
		setPixelRatio: vi.fn(),
		domElement: { addEventListener: vi.fn() },
	},
	controls: { target: { x: 0, z: 0, clone: () => ({ x: 0, y: 0, z: 0 }) } },
	labelContainer: { appendChild: vi.fn(), style: {} },
	trailGroups: { add: vi.fn() },
	cometGroup: { add: vi.fn() },
	gridGroup: { visible: true },
	ZOOM_BASE: 120,
	setAntialias: vi.fn(),
}));

vi.mock("../rendering/rendering", () => ({
	COMET_ORBIT_OPACITY: 0.03,
	COMET_ORBIT_SELECTED_OPACITY: 0.05,
	initiateTransfer: vi.fn(),
}));

// Minimal DOM stubs required by ui.ts module-level code
beforeAll(() => {
	const ids = [
		"body-list",
		"time-display",
		"zoom-display",
		"perf-display",
		"system-switcher-btn",
		"system-switcher-dropdown",
		"system-list",
		"btn-discover",
		"btn-random",
		"seed-input",
		"btn-pause",
		"speed-selector-btn",
		"speed-selector-dropdown",
		"speed-list",
		"view-menu-btn",
		"view-menu-dropdown",
	];
	ids.forEach((id) => {
		if (!document.getElementById(id)) {
			const el = document.createElement("div");
			el.id = id;
			document.body.appendChild(el);
		}
	});
	// view-menu-dropdown needs a .view-menu-content child
	const vmd = document.getElementById("view-menu-dropdown");
	if (vmd && !vmd.querySelector(".view-menu-content")) {
		const c = document.createElement("div");
		c.className = "view-menu-content";
		vmd.appendChild(c);
	}
});

describe("computeLabelPosition", () => {
	const W = 1920;
	const H = 1080;
	const M = 100;

	it("positions label to the right of a centered object with minimum gap", () => {
		// sr=10 → gap = max(6, 10*0.2) = max(6,2) = 6
		const result = computeLabelPosition(960, 540, 10, W, H, M);
		expect(result.visible).toBe(true);
		expect(result.x).toBe(960 + 10 + 6); // cx + sr + gap
		expect(result.y).toBe(540 - 6); // cy - 6
	});

	it("gap scales with screen radius when sr*0.2 > 6", () => {
		// sr=50 → gap = max(6, 50*0.2) = max(6,10) = 10
		const result = computeLabelPosition(960, 540, 50, W, H, M);
		expect(result.visible).toBe(true);
		expect(result.x).toBe(960 + 50 + 10);
		expect(result.y).toBe(540 - 6);
	});

	it("uses minimum gap of 6 for very small screen radius", () => {
		// sr=1 → gap = max(6, 1*0.2) = 6
		const result = computeLabelPosition(100, 100, 1, W, H, M);
		expect(result.visible).toBe(true);
		expect(result.x).toBe(100 + 1 + 6);
	});

	it("returns visible=false when object is far left of viewport", () => {
		const result = computeLabelPosition(-200, 540, 5, W, H, M);
		expect(result.visible).toBe(false);
	});

	it("returns visible=false when object is far right of viewport", () => {
		const result = computeLabelPosition(W + 200, 540, 5, W, H, M);
		expect(result.visible).toBe(false);
	});

	it("returns visible=false when object is far above viewport", () => {
		const result = computeLabelPosition(960, -200, 5, W, H, M);
		expect(result.visible).toBe(false);
	});

	it("returns visible=false when object is far below viewport", () => {
		const result = computeLabelPosition(960, H + 200, 5, W, H, M);
		expect(result.visible).toBe(false);
	});

	it("is visible when object is within margin of viewport edge", () => {
		// cx = -50, margin = 100 → -50 > -100, so visible
		const result = computeLabelPosition(-50, 540, 5, W, H, M);
		expect(result.visible).toBe(true);
	});

	it("is not visible when object is exactly at -margin boundary", () => {
		// cx = -100, margin = 100 → -100 < -100 is false, -100 >= -100, so visible=true
		// cx = -101 → -101 < -100 → not visible
		const atBoundary = computeLabelPosition(-100, 540, 5, W, H, M);
		expect(atBoundary.visible).toBe(true);
		const justOutside = computeLabelPosition(-101, 540, 5, W, H, M);
		expect(justOutside.visible).toBe(false);
	});
});

describe("formatZoomText", () => {
	it("includes zoom ratio and AU estimate", () => {
		const result = formatZoomText(120, 120);
		expect(result).toMatch(/^Zoom: 1\.00x \| ~/);
	});

	it("zoom ratio is 2.00x when camDist is half of zoomBase", () => {
		expect(formatZoomText(60, 120)).toContain("Zoom: 2.00x");
	});

	it("zoom ratio is 0.10x when camDist is 10x zoomBase", () => {
		expect(formatZoomText(1200, 120)).toContain("Zoom: 0.10x");
	});

	it("formats zoom ratio to exactly 2 decimal places", () => {
		expect(formatZoomText(3, 10)).toContain("Zoom: 3.33x");
	});

	it("includes AU separator", () => {
		expect(formatZoomText(120, 120)).toContain(" | ");
	});

	it("shows sub-1 AU with 2 decimal places", () => {
		// camDist=100, DIST_SCALE=200: (100/200)^2 = 0.25 AU
		expect(formatZoomText(100, 120)).toContain("~0.25 AU");
	});

	it("shows AU >= 1 with 1 decimal place", () => {
		// camDist=400, DIST_SCALE=200: (400/200)^2 = 4.0 AU
		expect(formatZoomText(400, 120)).toContain("~4.0 AU");
	});

	it("shows AU >= 100 as integer", () => {
		// camDist=2200, DIST_SCALE=200: (2200/200)^2 = 121 AU
		expect(formatZoomText(2200, 120)).toContain("~121 AU");
	});
});

describe("computeAuWidth", () => {
	it("returns 1 AU at distScale camera distance", () => {
		expect(computeAuWidth(200, 200)).toBe(1);
	});

	it("returns 4 AU at 2x distScale", () => {
		expect(computeAuWidth(400, 200)).toBe(4);
	});

	it("returns 0.25 AU at 0.5x distScale", () => {
		expect(computeAuWidth(100, 200)).toBeCloseTo(0.25);
	});

	it("scales as square of ratio", () => {
		// (300/200)^2 = 2.25
		expect(computeAuWidth(300, 200)).toBeCloseTo(2.25);
	});

	it("uses distScale parameter, not hardcoded value", () => {
		// distScale=100: (200/100)^2 = 4
		expect(computeAuWidth(200, 100)).toBe(4);
	});
});
