import { beforeEach, describe, expect, it } from "vitest";
import { state } from "../core/state";
import type { BodyEntry } from "../types";
import { collectResourceRows } from "../ui/resource-viewer";

function mockBody(
	name: string,
	type: string,
	distance: number,
	surveyLevel: number,
	deposits: Array<{
		resourceId: string;
		quantity: number;
		accessibility: number;
		minSurveyLevel: number;
	}>,
	isMoon = false,
): BodyEntry {
	return {
		data: { name, type, distance, color: "#fff", radius: 1, e: 0, period: 1, moons: [], mass: 1 },
		mesh: { position: { x: 0, y: 0, z: 0 } },
		selRing: { material: { opacity: 0 } },
		isMoon,
		survey: {
			surveyLevel,
			deposits: deposits.map((d) => ({ ...d, mined: 0 })),
		},
	} as unknown as BodyEntry;
}

describe("collectResourceRows", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
	});

	it("returns empty for no surveyed bodies", () => {
		state.bodyMeshes = [mockBody("Mars", "Planet", 1.52, 0, [])];
		expect(collectResourceRows()).toEqual([]);
	});

	it("returns rows for surveyed bodies with deposits", () => {
		state.bodyMeshes = [
			mockBody("Mars", "Planet", 1.52, 1, [
				{ resourceId: "iron", quantity: 5000, accessibility: 0.8, minSurveyLevel: 1 },
				{ resourceId: "copper", quantity: 2000, accessibility: 0.5, minSurveyLevel: 1 },
			]),
		];
		const rows = collectResourceRows();
		expect(rows).toHaveLength(2);
		expect(rows[0].bodyName).toBe("Mars");
		expect(rows[0].bodyType).toBe("Planet");
		expect(rows[0].distanceAU).toBe(1.52);
		expect(rows[0].resourceName).toBe("Iron");
		expect(rows[0].category).toBe("metal");
		expect(rows[0].quantity).toBe(5000);
		expect(rows[0].accessibility).toBe(0.8);
		expect(rows[0].miningValue).toBe(4000);
	});

	it("respects survey level visibility", () => {
		state.bodyMeshes = [
			mockBody("Ceres", "Dwarf Planet", 2.77, 1, [
				{ resourceId: "iron", quantity: 3000, accessibility: 0.7, minSurveyLevel: 1 },
				{ resourceId: "thorium", quantity: 500, accessibility: 0.3, minSurveyLevel: 2 },
				{ resourceId: "ortheum", quantity: 100, accessibility: 0.9, minSurveyLevel: 3 },
			]),
		];
		// Survey level 1: only see level-1 deposits
		const rows1 = collectResourceRows();
		expect(rows1).toHaveLength(1);
		expect(rows1[0].resourceName).toBe("Iron");

		// Upgrade to survey level 2
		(state.bodyMeshes[0] as unknown as { survey: { surveyLevel: number } }).survey.surveyLevel = 2;
		const rows2 = collectResourceRows();
		expect(rows2).toHaveLength(2);
	});

	it("excludes ships", () => {
		state.bodyMeshes = [
			{
				isShip: true,
				data: { name: "Ship", type: "Ship", distance: 0, color: "#fff" },
				mesh: { position: { x: 0, y: 0, z: 0 } },
			} as unknown as BodyEntry,
		];
		expect(collectResourceRows()).toEqual([]);
	});

	it("includes asteroid deposits", () => {
		state.asteroidBelts = [
			{
				asteroids: [
					{
						designation: "2003 AZ84",
						au: 3.5,
						period: 6.5,
						diameter: 200,
						mass: 1,
						survey: {
							surveyLevel: 1,
							deposits: [
								{
									resourceId: "water",
									quantity: 8000,
									accessibility: 0.9,
									mined: 0,
									minSurveyLevel: 1,
								},
							],
						},
					},
				],
			},
		] as unknown as typeof state.asteroidBelts;

		const rows = collectResourceRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].bodyName).toBe("2003 AZ84");
		expect(rows[0].bodyType).toBe("Asteroid");
		expect(rows[0].distanceAU).toBe(3.5);
		expect(rows[0].resourceName).toBe("Water");
		expect(rows[0].category).toBe("volatile");
	});

	it("computes miningValue as quantity * accessibility", () => {
		state.bodyMeshes = [
			mockBody("Europa", "Moon", 5.2, 1, [
				{ resourceId: "water", quantity: 10000, accessibility: 0.6, minSurveyLevel: 1 },
			]),
		];
		const rows = collectResourceRows();
		expect(rows[0].miningValue).toBe(6000);
	});

	it("maps moons correctly", () => {
		state.bodyMeshes = [
			mockBody(
				"Europa",
				"Planet",
				5.2,
				1,
				[{ resourceId: "iron", quantity: 1000, accessibility: 0.5, minSurveyLevel: 1 }],
				true,
			),
		];
		const rows = collectResourceRows();
		expect(rows[0].bodyType).toBe("Moon");
	});

	it("handles multiple bodies and asteroids together", () => {
		state.bodyMeshes = [
			mockBody("Mars", "Planet", 1.52, 1, [
				{ resourceId: "iron", quantity: 5000, accessibility: 0.8, minSurveyLevel: 1 },
			]),
			mockBody("Venus", "Planet", 0.72, 0, []),
		];
		state.asteroidBelts = [
			{
				asteroids: [
					{
						designation: "Ceres-1",
						au: 2.8,
						survey: {
							surveyLevel: 1,
							deposits: [
								{
									resourceId: "copper",
									quantity: 3000,
									accessibility: 0.7,
									mined: 0,
									minSurveyLevel: 1,
								},
							],
						},
					},
					{
						designation: "Ceres-2",
						au: 2.9,
						survey: { surveyLevel: 0, deposits: [] },
					},
				],
			},
		] as unknown as typeof state.asteroidBelts;

		const rows = collectResourceRows();
		expect(rows).toHaveLength(2);
		expect(rows[0].bodyName).toBe("Mars");
		expect(rows[1].bodyName).toBe("Ceres-1");
	});
});
