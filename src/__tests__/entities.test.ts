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
		expect(findBody("Earth")).toBeDefined();
	});

	it("populates asteroidMap from state.asteroidBelts", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		expect(findAsteroidEntity("MB-0001")).toBeDefined();
	});

	it("clears stale entries on subsequent calls", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		state.bodyMeshes = [];
		rebuildEntityMaps();
		expect(findBody("Earth")).toBeUndefined();
	});

	it("clears stale asteroid entries on subsequent calls", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		state.asteroidBelts = [];
		rebuildEntityMaps();
		expect(findAsteroidEntity("MB-0001")).toBeUndefined();
	});
});

describe("resolveEntity", () => {
	it("returns body for a planet", () => {
		state.bodyMeshes = [mockBody("Mars", "Planet")];
		rebuildEntityMaps();
		const result = resolveEntity("Mars");
		expect(result).not.toBeNull();
		expect(result?.name).toBe("Mars");
		expect(result?.type).toBe("Planet");
		expect(result?.bodyEntry).toBeDefined();
		expect(result?.asteroidHit).toBeUndefined();
	});

	it("returns body for a moon", () => {
		state.bodyMeshes = [mockBody("Titan", "Moon", { isMoon: true })];
		rebuildEntityMaps();
		const result = resolveEntity("Titan");
		expect(result).not.toBeNull();
		expect(result?.isMoon).toBe(true);
	});

	it("returns body for a comet", () => {
		state.bodyMeshes = [mockBody("Halley", "Comet", { isComet: true, isShip: false })];
		rebuildEntityMaps();
		const result = resolveEntity("Halley");
		expect(result).not.toBeNull();
		expect(result?.type).toBe("Comet");
	});

	it("returns body for a ship", () => {
		state.bodyMeshes = [mockBody("Endeavour", "Ship", { isShip: true, isComet: false })];
		rebuildEntityMaps();
		const result = resolveEntity("Endeavour");
		expect(result).not.toBeNull();
		expect(result?.type).toBe("Ship");
	});

	it("returns asteroid entity for a designation", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0042"])];
		rebuildEntityMaps();
		const result = resolveEntity("MB-0042");
		expect(result).not.toBeNull();
		expect(result?.name).toBe("MB-0042");
		expect(result?.type).toBe("Asteroid");
		expect(result?.asteroidHit).toBeDefined();
		expect(result?.bodyEntry).toBeUndefined();
	});

	it("returns null for unknown name", () => {
		rebuildEntityMaps();
		expect(resolveEntity("Unknown-9999")).toBeNull();
	});

	it("returns a fresh position object per call (no aliasing)", () => {
		state.bodyMeshes = [mockBody("Venus", "Planet")];
		rebuildEntityMaps();
		const r1 = resolveEntity("Venus");
		const r2 = resolveEntity("Venus");
		expect(r1?.position).not.toBe(r2?.position);
	});

	it("returns fresh asteroid position per call", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		const r1 = resolveEntity("MB-0001");
		const r2 = resolveEntity("MB-0001");
		expect(r1?.position).not.toBe(r2?.position);
	});

	it("asteroid position matches Float32Array data", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0001"])];
		rebuildEntityMaps();
		const result = resolveEntity("MB-0001");
		// beltIndex 0 → positions[0]=5, [1]=0, [2]=3
		expect(result?.position.x).toBe(5);
		expect(result?.position.y).toBe(0);
		expect(result?.position.z).toBe(3);
	});
});

describe("findBody", () => {
	it("returns BodyEntry for known name", () => {
		state.bodyMeshes = [mockBody("Jupiter", "Planet")];
		rebuildEntityMaps();
		expect(findBody("Jupiter")).toBeDefined();
	});

	it("returns undefined for unknown name", () => {
		rebuildEntityMaps();
		expect(findBody("Nonexistent")).toBeUndefined();
	});

	it("returns ships too", () => {
		state.bodyMeshes = [mockBody("Pioneer", "Ship", { isShip: true })];
		rebuildEntityMaps();
		expect(findBody("Pioneer")).toBeDefined();
	});
});

describe("findPlanet", () => {
	it("returns PlanetEntry for a planet", () => {
		state.bodyMeshes = [mockBody("Saturn", "Planet")];
		rebuildEntityMaps();
		expect(findPlanet("Saturn")).toBeDefined();
	});

	it("rejects moons (isComet undefined, but isMoon true -- isPlanetEntry passes, so moon IS a PlanetEntry)", () => {
		// Moons are stored as PlanetEntry with isMoon=true -- findPlanet returns them
		// This matches the existing type structure (PlanetEntry covers moons)
		const moon = mockBody("Phobos", "Moon", { isMoon: true });
		state.bodyMeshes = [moon];
		rebuildEntityMaps();
		// isPlanetEntry(moon) is true since isShip and isComet are false
		expect(findPlanet("Phobos")).toBeDefined();
	});

	it("rejects ships", () => {
		state.bodyMeshes = [mockBody("Voyager", "Ship", { isShip: true, isComet: false })];
		rebuildEntityMaps();
		expect(findPlanet("Voyager")).toBeUndefined();
	});

	it("rejects comets", () => {
		state.bodyMeshes = [mockBody("Comet-X", "Comet", { isComet: true, isShip: false })];
		rebuildEntityMaps();
		expect(findPlanet("Comet-X")).toBeUndefined();
	});

	it("returns undefined for unknown name", () => {
		rebuildEntityMaps();
		expect(findPlanet("Unknown")).toBeUndefined();
	});
});

describe("findAsteroidEntity", () => {
	it("returns hit for known designation", () => {
		state.asteroidBelts = [mockBeltEntry(["MB-0007"])];
		rebuildEntityMaps();
		const hit = findAsteroidEntity("MB-0007");
		expect(hit).toBeDefined();
		expect(hit?.asteroid.designation).toBe("MB-0007");
	});

	it("returns undefined for unknown designation", () => {
		rebuildEntityMaps();
		expect(findAsteroidEntity("ZZ-9999")).toBeUndefined();
	});
});

describe("findShip", () => {
	it("returns ship by name", () => {
		state.bodyMeshes = [mockBody("Argo", "Ship", { isShip: true })];
		rebuildEntityMaps();
		const ship = findShip("Argo");
		expect(ship).toBeDefined();
		expect(ship?.data.name).toBe("Argo");
	});

	it("returns first ship when no name given", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet"), mockBody("Hermes", "Ship", { isShip: true })];
		rebuildEntityMaps();
		expect(findShip()).toBeDefined();
		expect(findShip()?.data.type).toBe("Ship");
	});

	it("returns undefined when no ships exist and no name given", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		expect(findShip()).toBeUndefined();
	});

	it("returns undefined when named ship does not exist", () => {
		rebuildEntityMaps();
		expect(findShip("Ghost")).toBeUndefined();
	});

	it("returns undefined when named entry exists but is not a ship", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		expect(findShip("Earth")).toBeUndefined();
	});
});

describe("findStar", () => {
	it("returns the star entry", () => {
		state.bodyMeshes = [mockBody("Sol", "Star")];
		rebuildEntityMaps();
		const star = findStar();
		expect(star).toBeDefined();
		expect(star?.data.type).toBe("Star");
	});

	it("returns undefined when no star exists", () => {
		state.bodyMeshes = [mockBody("Earth", "Planet")];
		rebuildEntityMaps();
		expect(findStar()).toBeUndefined();
	});
});
