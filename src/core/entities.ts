import { orbitSpeed } from "../math/orbit";
import type {
	AsteroidBeltEntry,
	AsteroidInfo,
	BodyEntry,
	PlanetEntry,
	ShipEntry,
	SurveyState,
} from "../types";
import { isPlanetEntry, isShipEntry } from "../types";
import { state } from "./state";

// --- Internal maps ---

const bodyMap = new Map<string, BodyEntry>();
const asteroidMap = new Map<string, { asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry }>();
let cachedStar: PlanetEntry | undefined;

// --- Exported interface ---

export interface ResolvedEntity {
	name: string;
	type: string;
	position: { x: number; y: number; z: number };
	distance: number;
	mass: number;
	speed: number;
	isMoon: boolean;
	survey?: SurveyState;
	bodyEntry?: BodyEntry;
	asteroidHit?: { asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry };
}

// --- Exported functions ---

export function rebuildEntityMaps(): void {
	bodyMap.clear();
	asteroidMap.clear();
	cachedStar = undefined;

	for (const entry of state.bodyMeshes) {
		bodyMap.set(entry.data.name, entry);
		if (isPlanetEntry(entry) && entry.data.type === "Star") {
			cachedStar = entry;
		}
	}

	for (const beltEntry of state.asteroidBelts) {
		for (const asteroid of beltEntry.asteroids) {
			asteroidMap.set(asteroid.designation, { asteroid, beltEntry });
		}
	}
}

export function resolveEntity(name: string): ResolvedEntity | null {
	const bodyEntry = bodyMap.get(name);
	if (bodyEntry) {
		const p = bodyEntry.mesh.position;
		return {
			name: bodyEntry.data.name,
			type: bodyEntry.data.type,
			position: { x: p.x, y: p.y, z: p.z },
			distance: bodyEntry.data.distance,
			mass: bodyEntry.data.mass,
			speed: bodyEntry.speed,
			isMoon: bodyEntry.isMoon,
			survey: (bodyEntry as { survey?: SurveyState }).survey,
			bodyEntry,
		};
	}

	const hit = asteroidMap.get(name);
	if (hit) {
		const { asteroid, beltEntry } = hit;
		const idx = asteroid.beltIndex ?? 0;
		const x = beltEntry.positions[idx * 3];
		const y = beltEntry.positions[idx * 3 + 1];
		const z = beltEntry.positions[idx * 3 + 2];
		return {
			name: asteroid.designation,
			type: "Asteroid",
			position: { x, y, z },
			distance: asteroid.au,
			mass: asteroid.mass,
			speed: orbitSpeed(asteroid.period),
			isMoon: false,
			survey: asteroid.survey,
			asteroidHit: hit,
		};
	}

	return null;
}

export function findBody(name: string): BodyEntry | undefined {
	return bodyMap.get(name);
}

export function findPlanet(name: string): PlanetEntry | undefined {
	const entry = bodyMap.get(name);
	if (!entry) return undefined;
	if (isPlanetEntry(entry)) return entry;
	return undefined;
}

export function findAsteroidEntity(
	name: string,
): { asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry } | undefined {
	return asteroidMap.get(name);
}

export function findShip(name?: string): ShipEntry | undefined {
	if (name !== undefined) {
		const entry = bodyMap.get(name);
		return entry && isShipEntry(entry) ? entry : undefined;
	}
	for (const entry of bodyMap.values()) {
		if (isShipEntry(entry)) return entry;
	}
	return undefined;
}

export function findStar(): PlanetEntry | undefined {
	return cachedStar;
}
