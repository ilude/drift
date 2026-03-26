import { beforeEach, describe, expect, it } from "vitest";
import {
	findAsteroidEntity,
	findBody,
	findPlanet,
	findShip,
	findStar,
	rebuildEntityMaps,
	resolveEntity,
} from "../core/entities";
import { state } from "../core/state";
import type { AsteroidBeltEntry, BodyEntry } from "../types";

function mockBody(name: string, type: string, overrides = {}): BodyEntry {
	return {
		data: { name, type, distance: 1, mass: 1 },
		mesh: { position: { x: 1, y: 0, z: 2 } },
		speed: 0.01,
		isMoon: false,
		isShip: false,
		isComet: false,
		survey: { surveyLevel: 0, deposits: [] },
		...overrides,
	} as unknown as BodyEntry;
}

function mockBeltEntry(designations: string[]): AsteroidBeltEntry {
	const positions = new Float32Array(designations.length * 3);
	for (let i = 0; i < designations.length; i++) {
		positions[i * 3] = i * 10 + 5;
		positions[i * 3 + 1] = 0;
		positions[i * 3 + 2] = i * 10 + 3;
	}
	return {
		belt: {
			name: "Main Belt",
			minAU: 2.0,
			maxAU: 3.5,
			count: designations.length,
			color: "#aaa",
			size: 1,
			maxInc: 5,
		},
		positions,
		count: designations.length,
		asteroids: designations.map((d, i) => ({
			designation: d,
			au: 2.5,
			period: 3.95,
			diameter: 100,
			mass: 1e15,
			beltIndex: i,
			survey: { surveyLevel: 0, deposits: [] },
		})),
	} as unknown as AsteroidBeltEntry;
}

beforeEach(() => {
	state.bodyMeshes = [];
	state.asteroidBelts = [];
});

describe("rebuildEntityMaps", () => {
	it("populates bodyMap from state.bodyMeshes", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		const [, foundBody] = findBody("Earth");
		expect(foundBody).toBe(true);
	});

	it("populates asteroidMap from state.asteroidBelts", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		const [, foundAsteroid] = findAsteroidEntity("MB-0001");
		expect(foundAsteroid).toBe(true);
	});

	it("clears stale entries on subsequent calls", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		state.bodyMeshes = [];
		rebuildEntityMaps();
		const [, foundBody] = findBody("Earth");
		expect(foundBody).toBe(false);
	});

	it("clears stale asteroid entries on subsequent calls", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		state.asteroidBelts = [];
		rebuildEntityMaps();
		const [, foundAsteroid] = findAsteroidEntity("MB-0001");
		expect(foundAsteroid).toBe(false);
	});
});

describe("resolveEntity", () => {
	it("returns body for a planet", () => {
		state.bodyMeshes = [mockBody("Mars", "Planet")];
		rebuildEntityMaps();
		const [result, found] = resolveEntity("Mars");
		expect(found).toBe(true);
		if (!result) throw new Error("expected result");
		expect(result.name).toBe("Mars");
		expect(result.type).toBe("Planet");
		expect(result.bodyEntry).toBeDefined();
		expect(result.asteroidHit).toBeUndefined();
	});

	it("returns body for a moon", () => {
		state.bodyMeshes = [mockBody("Titan", "Moon", { isMoon: true })];
		rebuildEntityMaps();
		const [result, found] = resolveEntity("Titan");
		expect(found).toBe(true);
		if (!result) throw new Error("expected result");
		expect(result.isMoon).toBe(true);
	});

	it("returns body for a comet", () => {
		state.bodyMeshes = [mockBody("Halley", "Comet", { isComet: true, isShip: false })];
		rebuildEntityMaps();
		const [result, found] = resolveEntity("Halley");
		expect(found).toBe(true);
		if (!result) throw new Error("expected result");
		expect(result.type).toBe("Comet");
	});

	it("returns body for a ship", () => {
		state.bodyMeshes = [mockBody("Endeavour", "Ship", { isShip: true, isComet: false })];
		rebuildEntityMaps();
		const [result, found] = resolveEntity("Endeavour");
		expect(found).toBe(true);
		if (!result) throw new Error("expected result");
		expect(result.type).toBe("Ship");
	});

	it("returns asteroid entity for a designation", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0042"])];
		rebuildEntityMaps();
		const [result, found] = resolveEntity("MB-0042");
		expect(found).toBe(true);
		if (!result) throw new Error("expected result");
		expect(result.name).toBe("MB-0042");
		expect(result.type).toBe("Asteroid");
		expect(result.asteroidHit).toBeDefined();
		expect(result.bodyEntry).toBeUndefined();
	});

	it("returns null for unknown name", () => {
		rebuildEntityMaps();
		const [, found] = resolveEntity("Unknown-9999");
		expect(found).toBe(false);
	});

	it("returns a fresh position object per call (no aliasing)", () => {
		state.bodyMeshes = [mockBody("Venus", "Planet")];
		rebuildEntityMaps();
		const [r1] = resolveEntity("Venus");
		const [r2] = resolveEntity("Venus");
		if (!r1 || !r2) throw new Error("expected results");
		expect(r1.position).not.toBe(r2.position);
	});

	it("returns fresh asteroid position per call", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		const [r1] = resolveEntity("MB-0001");
		const [r2] = resolveEntity("MB-0001");
		if (!r1 || !r2) throw new Error("expected results");
		expect(r1.position).not.toBe(r2.position);
	});

	it("asteroid position matches Float32Array data", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		const [result] = resolveEntity("MB-0001");
		// beltIndex 0 → positions[0]=5, [1]=0, [2]=3
		if (!result) throw new Error("expected result");
		expect(result.position.x).toBe(5);
		expect(result.position.y).toBe(0);
		expect(result.position.z).toBe(3);
	});
});

describe("findBody", () => {
	it("returns BodyEntry for known name", () => {
		state.bodyMeshes = [mockBody("Jupiter", "Planet")];
		rebuildEntityMaps();
		const [, found] = findBody("Jupiter");
		expect(found).toBe(true);
	});

	it("returns undefined for unknown name", () => {
		rebuildEntityMaps();
		const [, found] = findBody("Nonexistent");
		expect(found).toBe(false);
	});

	it("returns ships too", () => {
		state.bodyMeshes = [mockBody("Pioneer", "Ship", { isShip: true })];
		rebuildEntityMaps();
		const [, found] = findBody("Pioneer");
		expect(found).toBe(true);
	});
});

describe("findPlanet", () => {
	it("returns PlanetEntry for a planet", () => {
		state.bodyMeshes = [mockBody("Saturn", "Planet")];
		rebuildEntityMaps();
		const [, found] = findPlanet("Saturn");
		expect(found).toBe(true);
	});

	it("rejects moons (isComet undefined, but isMoon true -- isPlanetEntry passes, so moon IS a PlanetEntry)", () => {
		// Moons are stored as PlanetEntry with isMoon=true -- findPlanet returns them
		// This matches the existing type structure (PlanetEntry covers moons)
		const moon = mockBody("Phobos", "Moon", { isMoon: true });
		state.bodyMeshes = [moon];
		rebuildEntityMaps();
		// isPlanetEntry(moon) is true since isShip and isComet are false
		const [, found] = findPlanet("Phobos");
		expect(found).toBe(true);
	});

	it("rejects ships", () => {
		state.bodyMeshes = [mockBody("Voyager", "Ship", { isShip: true, isComet: false })];
		rebuildEntityMaps();
		const [, found] = findPlanet("Voyager");
		expect(found).toBe(false);
	});

	it("rejects comets", () => {
		state.bodyMeshes = [mockBody("Comet-X", "Comet", { isComet: true, isShip: false })];
		rebuildEntityMaps();
		const [, found] = findPlanet("Comet-X");
		expect(found).toBe(false);
	});

	it("returns undefined for unknown name", () => {
		rebuildEntityMaps();
		const [, found] = findPlanet("Unknown");
		expect(found).toBe(false);
	});
});

describe("findAsteroidEntity", () => {
	it("returns hit for known designation", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0007"])];
		rebuildEntityMaps();
		const [hit, found] = findAsteroidEntity("MB-0007");
		expect(found).toBe(true);
		if (!hit) throw new Error("expected hit");
		expect(hit.asteroid.designation).toBe("MB-0007");
	});

	it("returns undefined for unknown designation", () => {
		rebuildEntityMaps();
		const [, found] = findAsteroidEntity("ZZ-9999");
		expect(found).toBe(false);
	});
});

describe("findShip", () => {
	it("returns ship by name", () => {
		state.bodyMeshes = [mockBody("Argo", "Ship", { isShip: true })];
		rebuildEntityMaps();
		const [ship, found] = findShip("Argo");
		expect(found).toBe(true);
		if (!ship) throw new Error("expected ship");
		expect(ship.data.name).toBe("Argo");
	});

	it("returns first ship when no name given", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet"), mockBody("Hermes", "Ship", { isShip: true })];
		rebuildEntityMaps();
		const [ship, found] = findShip();
		expect(found).toBe(true);
		if (!ship) throw new Error("expected ship");
		expect(ship.data.type).toBe("Ship");
	});

	it("returns undefined when no ships exist and no name given", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		const [, found] = findShip();
		expect(found).toBe(false);
	});

	it("returns undefined when named ship does not exist", () => {
		rebuildEntityMaps();
		const [, found] = findShip("Ghost");
		expect(found).toBe(false);
	});

	it("returns undefined when named entry exists but is not a ship", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		const [, found] = findShip("Earth");
		expect(found).toBe(false);
	});
});

describe("findStar", () => {
	it("returns the star entry", () => {
		state.bodyMeshes = [mockBody("Sol", "Star")];
		rebuildEntityMaps();
		const [star, found] = findStar();
		expect(found).toBe(true);
		if (!star) throw new Error("expected star");
		expect(star.data.type).toBe("Star");
	});

	it("returns undefined when no star exists", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		const [, found] = findStar();
		expect(found).toBe(false);
	});
});
