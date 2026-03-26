import { orbitSpeed } from "../math/orbit";
import type {
	AsteroidBeltEntry,
	AsteroidInfo,
	BodyEntry,
	PlanetEntry,
	Result,
	ShipEntry,
	SurveyState,
} from "../types";
import { isPlanetEntry, isShipEntry } from "../types";
import { err, ok } from "./result";
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

export function resolveEntity(name: string): Result<ResolvedEntity> {
	const bodyEntry = bodyMap.get(name);
	if (bodyEntry) {
		const p = bodyEntry.mesh.position;
		return ok({
			name: bodyEntry.data.name,
			type: bodyEntry.data.type,
			position: { x: p.x, y: p.y, z: p.z },
			distance: bodyEntry.data.distance,
			mass: (bodyEntry.data as { mass: number }).mass,
			speed: bodyEntry.speed,
			isMoon: bodyEntry.isMoon,
			survey: (bodyEntry as { survey?: SurveyState }).survey,
			bodyEntry,
		});
	}

	const hit = asteroidMap.get(name);
	if (hit) {
		const { asteroid, beltEntry } = hit;
		const idx = asteroid.beltIndex ?? 0;
		const x = beltEntry.positions[idx * 3];
		const y = beltEntry.positions[idx * 3 + 1];
		const z = beltEntry.positions[idx * 3 + 2];
		return ok({
			name: asteroid.designation,
			type: "Asteroid",
			position: { x, y, z },
			distance: asteroid.au,
			mass: asteroid.mass,
			speed: orbitSpeed(asteroid.period),
			isMoon: false,
			survey: asteroid.survey,
			asteroidHit: hit,
		});
	}

	return err();
}

export function findBody(name: string): Result<BodyEntry> {
	const entry = bodyMap.get(name);
	return entry ? ok(entry) : err();
}

export function findPlanet(name: string): Result<PlanetEntry> {
	const entry = bodyMap.get(name);
	if (entry && isPlanetEntry(entry)) return ok(entry);
	return err();
}

export function findAsteroidEntity(
	name: string,
): Result<{ asteroid: AsteroidInfo; beltEntry: AsteroidBeltEntry }> {
	const hit = asteroidMap.get(name);
	return hit ? ok(hit) : err();
}

export function findShip(name?: string): Result<ShipEntry> {
	if (name !== undefined) {
		const entry = bodyMap.get(name);
		if (entry && isShipEntry(entry)) return ok(entry);
		return err();
	}
	for (const entry of bodyMap.values()) {
		if (isShipEntry(entry)) return ok(entry);
	}
	return err();
}

export function findStar(): Result<PlanetEntry> {
	return cachedStar ? ok(cachedStar) : err();
}

export function listShips(): ShipEntry[] {
	const ships: ShipEntry[] = [];
	for (const entry of bodyMap.values()) {
		if (isShipEntry(entry)) ships.push(entry);
	}
	return ships;
}

export function listShipsAtBody(bodyName: string): ShipEntry[] {
	const ships: ShipEntry[] = [];
	for (const entry of bodyMap.values()) {
		if (isShipEntry(entry) && entry.hostPlanetName === bodyName && entry.shipState === "orbiting") {
			ships.push(entry);
		}
	}
	return ships;
}
