import { describe, expect, it } from "vitest";
import { rngFloat, rngGaussian, rngInt, rngPick, rngWeighted, seededRandom } from "../core/utils";
import { getSolSystem } from "../data/sol-data";
import { generateSystem, planetLetter } from "../data/system-generator";
import { categorizePlanet, hillRadius, keplerPeriod, radiusToMassEarths } from "../math/orbit";

// --- RNG helpers ---

describe("rngInt", () => {
	it("returns integers within [min, max]", () => {
		const rng = seededRandom(1);
		for (let i = 0; i < 200; i++) {
			const v = rngInt(rng, 1, 6);
			expect(v).toBeGreaterThanOrEqual(1);
			expect(v).toBeLessThanOrEqual(6);
			expect(Number.isInteger(v)).toBe(true);
		}
	});
});

describe("rngFloat", () => {
	it("returns floats within [min, max)", () => {
		const rng = seededRandom(2);
		for (let i = 0; i < 200; i++) {
			const v = rngFloat(rng, 0, 1);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it("respects range bounds", () => {
		const rng = seededRandom(3);
		for (let i = 0; i < 100; i++) {
			const v = rngFloat(rng, 5, 10);
			expect(v).toBeGreaterThanOrEqual(5);
			expect(v).toBeLessThan(10);
		}
	});
});

describe("rngGaussian", () => {
	it("produces values centered near 0", () => {
		const rng = seededRandom(4);
		let sum = 0;
		const n = 10000;
		for (let i = 0; i < n; i++) sum += rngGaussian(rng);
		const mean = sum / n;
		expect(Math.abs(mean)).toBeLessThan(0.1);
	});
});

describe("rngWeighted", () => {
	it("returns entries proportional to weight", () => {
		const rng = seededRandom(5);
		const entries = [
			{ value: "a", weight: 90 },
			{ value: "b", weight: 10 },
		];
		const counts: Record<string, number> = { a: 0, b: 0 };
		for (let i = 0; i < 1000; i++) {
			counts[rngWeighted(rng, entries).value]++;
		}
		expect(counts.a).toBeGreaterThan(counts.b * 3);
	});

	it("with zero weights, returns first entry (r=0 matches immediately)", () => {
		const entries = [
			{ value: "x", weight: 0 },
			{ value: "y", weight: 0 },
		];
		const rng = seededRandom(6);
		const result = rngWeighted(rng, entries);
		expect(result.value).toBe("x");
	});
});

describe("rngPick", () => {
	it("returns an element from the array", () => {
		const rng = seededRandom(7);
		const arr = ["a", "b", "c"];
		for (let i = 0; i < 50; i++) {
			expect(arr).toContain(rngPick(rng, arr));
		}
	});
});

// --- Physics helpers ---

describe("keplerPeriod", () => {
	it("returns 1 year for Earth (1 AU, 1 solar mass)", () => {
		expect(keplerPeriod(1, 1)).toBeCloseTo(1.0);
	});

	it("increases with distance", () => {
		expect(keplerPeriod(4, 1)).toBeGreaterThan(keplerPeriod(1, 1));
	});

	it("decreases with greater star mass", () => {
		expect(keplerPeriod(1, 4)).toBeLessThan(keplerPeriod(1, 1));
	});
});

describe("radiusToMassEarths", () => {
	it("returns ~1 for Earth radius", () => {
		expect(radiusToMassEarths(1)).toBeCloseTo(1.0);
	});

	it("increases with radius", () => {
		expect(radiusToMassEarths(2)).toBeGreaterThan(radiusToMassEarths(1));
		expect(radiusToMassEarths(5)).toBeGreaterThan(radiusToMassEarths(2));
	});
});

describe("hillRadius", () => {
	it("returns positive value", () => {
		expect(hillRadius(1, 1, 1)).toBeGreaterThan(0);
	});

	it("increases with planet mass", () => {
		expect(hillRadius(1, 100, 1)).toBeGreaterThan(hillRadius(1, 1, 1));
	});

	it("increases with distance", () => {
		expect(hillRadius(5, 1, 1)).toBeGreaterThan(hillRadius(1, 1, 1));
	});
});

describe("categorizePlanet", () => {
	it("classifies rocky planets", () => {
		expect(categorizePlanet(1.0)).toBe("rocky");
		expect(categorizePlanet(1.7)).toBe("rocky");
	});

	it("classifies sub-Neptunes", () => {
		expect(categorizePlanet(2.0)).toBe("subNeptune");
		expect(categorizePlanet(3.5)).toBe("subNeptune");
	});

	it("classifies ice giants", () => {
		expect(categorizePlanet(5.0)).toBe("iceGiant");
		expect(categorizePlanet(7.0)).toBe("iceGiant");
	});

	it("classifies gas giants", () => {
		expect(categorizePlanet(10.0)).toBe("gasGiant");
		expect(categorizePlanet(15.0)).toBe("gasGiant");
	});
});

describe("planetLetter", () => {
	it("returns b for index 0", () => {
		expect(planetLetter(0)).toBe("b");
	});

	it("returns c for index 1", () => {
		expect(planetLetter(1)).toBe("c");
	});

	it("returns sequential letters", () => {
		expect(planetLetter(2)).toBe("d");
		expect(planetLetter(3)).toBe("e");
	});
});

// --- getSolSystem ---

describe("getSolSystem", () => {
	const sol = getSolSystem();

	it("returns required top-level properties", () => {
		expect(sol).toHaveProperty("bodies");
		expect(sol).toHaveProperty("comets");
		expect(sol).toHaveProperty("asteroidBelts");
		expect(sol).toHaveProperty("name");
	});

	it("has Sol System as name", () => {
		expect(sol.name).toBe("Sol System");
	});

	it("has Sol as first body", () => {
		expect(sol.bodies[0].name).toBe("Sol");
		expect(sol.bodies[0].type).toBe("Star");
		expect(sol.bodies[0].distance).toBe(0);
	});

	it("has 8 planets", () => {
		const planets = sol.bodies.filter((b: { type: string }) => b.type === "Planet");
		expect(planets).toHaveLength(8);
	});

	it("has Jupiter with 4 Galilean moons", () => {
		const jupiter = sol.bodies.find((b: { name: string }) => b.name === "Jupiter");
		expect(jupiter).toBeDefined();
		if (!jupiter) return;
		expect(jupiter.moons).toHaveLength(4);
		const moonNames = jupiter.moons.map((m: { name: string }) => m.name);
		expect(moonNames).toContain("Io");
		expect(moonNames).toContain("Europa");
		expect(moonNames).toContain("Ganymede");
		expect(moonNames).toContain("Callisto");
	});

	it("has known comets", () => {
		const cometNames = sol.comets.map((c: { name: string }) => c.name);
		expect(cometNames).toContain("Halley");
		expect(cometNames).toContain("Hale-Bopp");
	});

	it("has asteroid belts including Main Belt", () => {
		const beltNames = sol.asteroidBelts.map((b: { name: string }) => b.name);
		expect(beltNames).toContain("Main Belt");
	});

	it("planet distances are monotonically increasing", () => {
		const planets = sol.bodies.filter((b: { type: string }) => b.type === "Planet");
		for (let i = 1; i < planets.length; i++) {
			expect(planets[i].distance).toBeGreaterThan(planets[i - 1].distance);
		}
	});
});

// --- generateSystem ---

describe("generateSystem", () => {
	it("is deterministic (same seed = same output)", () => {
		const sys1 = generateSystem(42);
		const sys2 = generateSystem(42);
		expect(sys1.name).toBe(sys2.name);
		expect(sys1.bodies.length).toBe(sys2.bodies.length);
		expect(sys1.bodies.map((b: { name: string }) => b.name)).toEqual(
			sys2.bodies.map((b: { name: string }) => b.name),
		);
	});

	it("different seeds produce different systems", () => {
		const sys1 = generateSystem(1);
		const sys2 = generateSystem(2);
		// Names or body counts should differ (extremely unlikely to match)
		const same = sys1.name === sys2.name && sys1.bodies.length === sys2.bodies.length;
		expect(same).toBe(false);
	});

	it("always has at least one star as first body", () => {
		for (const seed of [1, 100, 9999, 123456]) {
			const sys = generateSystem(seed);
			expect(sys.bodies.length).toBeGreaterThan(0);
			expect(sys.bodies[0].type).toBe("Star");
			expect(sys.bodies[0].distance).toBe(0);
		}
	});

	it("has a non-empty system name", () => {
		const sys = generateSystem(77);
		expect(sys.name).toBeTruthy();
		expect(typeof sys.name).toBe("string");
	});

	it("all planets have positive distance, period, and radius", () => {
		const sys = generateSystem(500);
		const planets = sys.bodies.filter((b: { type: string }) => b.type === "Planet");
		planets.forEach((p: { distance: number; period: number; radius: number }) => {
			expect(p.distance).toBeGreaterThan(0);
			expect(p.period).toBeGreaterThan(0);
			expect(p.radius).toBeGreaterThan(0);
		});
	});

	it("planet distances are sorted", () => {
		const sys = generateSystem(300);
		const planets = sys.bodies.filter((b: { type: string }) => b.type === "Planet");
		for (let i = 1; i < planets.length; i++) {
			expect(planets[i].distance).toBeGreaterThan(planets[i - 1].distance);
		}
	});

	it("comets have valid orbital elements", () => {
		const sys = generateSystem(200);
		sys.comets.forEach((c: { a: number; e: number; period: number }) => {
			expect(c.a).toBeGreaterThan(0);
			expect(c.e).toBeGreaterThan(0);
			expect(c.e).toBeLessThan(1);
			expect(c.period).toBeGreaterThan(0);
		});
	});

	it("asteroid belts have valid ranges", () => {
		const sys = generateSystem(400);
		sys.asteroidBelts.forEach((belt: { minAU: number; maxAU: number; count: number }) => {
			expect(belt.minAU).toBeLessThan(belt.maxAU);
			expect(belt.count).toBeGreaterThan(0);
		});
	});

	it("returns bodies, comets, and asteroidBelts arrays", () => {
		const sys = generateSystem(600);
		expect(Array.isArray(sys.bodies)).toBe(true);
		expect(Array.isArray(sys.comets)).toBe(true);
		expect(Array.isArray(sys.asteroidBelts)).toBe(true);
	});
});
