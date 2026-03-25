import { beforeEach, describe, expect, it } from "vitest";
import { state } from "../core/state";
import type { BodyEntry } from "../types";
import { collectBodyRows } from "../ui/resource-viewer";

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

describe("collectBodyRows", () => {
	beforeEach(() => {
		state.bodyMeshes = [];
		state.asteroidBelts = [];
	});

	it("returns empty for no surveyed bodies", () => {
		state.bodyMeshes = [mockBody("Mars", "Planet", 1.52, 0, [])];
		expect(collectBodyRows()).toEqual([]);
	});

	it("returns one row per surveyed body with deposit map", () => {
		state.bodyMeshes = [
			mockBody("Mars", "Planet", 1.52, 1, [
				{ resourceId: "iron", quantity: 5000, accessibility: 0.8, minSurveyLevel: 1 },
				{ resourceId: "copper", quantity: 2000, accessibility: 0.5, minSurveyLevel: 1 },
			]),
		];
		const rows = collectBodyRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].bodyName).toBe("Mars");
		expect(rows[0].bodyType).toBe("Planet");
		expect(rows[0].deposits.iron.quantity).toBe(5000);
		expect(rows[0].deposits.iron.accessibility).toBe(0.8);
		expect(rows[0].deposits.iron.miningValue).toBe(4000);
		expect(rows[0].deposits.copper.quantity).toBe(2000);
		expect(rows[0].deposits.copper.miningValue).toBe(1000);
		expect(rows[0].totalValue).toBe(5000);
	});

	it("respects survey level visibility", () => {
		state.bodyMeshes = [
			mockBody("Ceres", "Dwarf Planet", 2.77, 1, [
				{ resourceId: "iron", quantity: 3000, accessibility: 0.7, minSurveyLevel: 1 },
				{ resourceId: "thorium", quantity: 500, accessibility: 0.3, minSurveyLevel: 2 },
			]),
		];
		const rows1 = collectBodyRows();
		expect(rows1).toHaveLength(1);
		expect(Object.keys(rows1[0].deposits)).toEqual(["iron"]);

		// Upgrade to survey level 2
		(state.bodyMeshes[0] as unknown as { survey: { surveyLevel: number } }).survey.surveyLevel = 2;
		const rows2 = collectBodyRows();
		expect(Object.keys(rows2[0].deposits)).toHaveLength(2);
		expect(rows2[0].deposits.thorium).toBeDefined();
	});

	it("excludes ships", () => {
		state.bodyMeshes = [
			{
				isShip: true,
				data: { name: "Ship", type: "Ship", distance: 0, color: "#fff" },
				mesh: { position: { x: 0, y: 0, z: 0 } },
			} as unknown as BodyEntry,
		];
		expect(collectBodyRows()).toEqual([]);
	});

	it("includes asteroid rows", () => {
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
								{ resourceId: "water", quantity: 8000, accessibility: 0.9, mined: 0, minSurveyLevel: 1 },
							],
						},
					},
				],
			},
		] as unknown as typeof state.asteroidBelts;

		const rows = collectBodyRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].bodyName).toBe("2003 AZ84");
		expect(rows[0].bodyType).toBe("Asteroid");
		expect(rows[0].deposits.water.quantity).toBe(8000);
		expect(rows[0].deposits.water.miningValue).toBe(7200);
	});

	it("computes totalValue as sum of all deposit miningValues", () => {
		state.bodyMeshes = [
			mockBody(
				"Europa",
				"Planet",
				5.2,
				1,
				[
					{ resourceId: "water", quantity: 10000, accessibility: 0.6, minSurveyLevel: 1 },
					{ resourceId: "iron", quantity: 4000, accessibility: 0.5, minSurveyLevel: 1 },
				],
				true,
			),
		];
		const rows = collectBodyRows();
		expect(rows[0].totalValue).toBe(6000 + 2000);
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
		const rows = collectBodyRows();
		expect(rows[0].bodyType).toBe("Moon");
	});

	it("skips bodies with deposits but no visible ones at current survey level", () => {
		state.bodyMeshes = [
			mockBody("Pluto", "Dwarf Planet", 39.5, 1, [
				{ resourceId: "ortheum", quantity: 100, accessibility: 0.9, minSurveyLevel: 3 },
			]),
		];
		const rows = collectBodyRows();
		expect(rows).toHaveLength(0);
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
								{ resourceId: "copper", quantity: 3000, accessibility: 0.7, mined: 0, minSurveyLevel: 1 },
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

		const rows = collectBodyRows();
		expect(rows).toHaveLength(2);
		expect(rows[0].bodyName).toBe("Mars");
		expect(rows[1].bodyName).toBe("Ceres-1");
	});
});
