import "./style.css";
import * as THREE from "three";
import { commanderDecide, incrementExperience, learnFromEmergencyReturn } from "./core/commander";
import {
	getUnsurvevedMoonsOfHost,
	HULL_REPAIR_PER_DAY,
	SUPPLY_RESTOCK_PER_DAY,
	selectNextRefuelTarget,
	selectNextSurveyTarget,
	tickShipSimulation,
	tickTankerTransfer,
} from "./core/commands";
import {
	findAsteroidEntity,
	findBody,
	findPlanet,
	findShip,
	findStar,
	rebuildEntityMaps,
	resolveEntity,
} from "./core/entities";
import { GameClock } from "./core/game-clock";
import { publishIntent } from "./core/intents";
import { addCoalescedNotification, addNotification } from "./core/notifications";
import { gameLog, gameWarn, MASTER_SEED, state } from "./core/state";
import { seededRandom } from "./core/utils";
import { generateDeposits, generateEarthDeposits } from "./data/resources";
import { getSolSystem } from "./data/sol-data";
import { DIST_SCALE } from "./math/orbit";
import { AU_TO_KM, checkTransferKm } from "./math/ship-physics";
import { SURVEYED_ASTEROID_COLOR } from "./rendering/bodies";
import {
	createAsteroidBelts,
	createBodies,
	createComets,
	createShip,
	sharedResources,
	updateAsteroids,
	updatePositions,
} from "./rendering/rendering";
import { camera, cometGroup, controls, renderer, scene, trailGroups } from "./rendering/scene";
import { asteroidProxy, initiateTransfer, setOnTransferComplete } from "./rendering/ship-transfer";
import type {
	BodyEntry,
	CommandResult,
	CommandTree,
	PlanetEntry,
	ShipEntry,
	SystemData,
} from "./types";
import { isCometEntry, isShipEntry, isSurveyable } from "./types";
import { pushResourceUpdate } from "./ui/resource-viewer";
import {
	selectBody,
	setupClickHandlers,
	updateFlyTo,
	updateFollow,
	updateSelectedBody,
} from "./ui/selection";
import type { PerfTimings } from "./ui/ui";
import { buildBodyList, setupUI, updateHUD, updateLabels, updatePerfDisplay } from "./ui/ui";

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
let starEntry: PlanetEntry | null = null;

function cacheStarEntry(): void {
	starEntry = findStar() ?? null;
}

state.masterRng = seededRandom(MASTER_SEED);

const sol: SystemData = getSolSystem();
state.discoveredSystems.set("sol", {
	name: "Sol System",
	seed: null,
	systemData: sol,
});

// Always start fresh — manual save via header menu
state.BODIES = sol.bodies;
state.COMETS = sol.comets;
state.ASTEROID_BELTS = sol.asteroidBelts;

createBodies();
createComets();
// Initial position tick so all bodies are placed before ship creation
updatePositions(1e-10, 300);
createShip({ name: "ISS Explorer", hostPlanetName: "Earth" });
createShip({ name: "ISS Magellan", hostPlanetName: "Mars" });
createShip({ name: "ISS Kepler", hostPlanetName: "Jupiter" });

const tankerCommandTree: CommandTree = {
	entries: [
		{
			id: "fuel-check",
			command: "refuel",
			condition: { type: "fuel-below", threshold: 30 },
			enabled: true,
			origin: "ship",
		},
		{
			id: "hull-check",
			command: "overhaul",
			condition: { type: "hull-below", threshold: 30 },
			enabled: true,
			origin: "ship",
		},
		{
			id: "morale-check",
			command: "shore-leave",
			condition: { type: "morale-below", threshold: 40 },
			enabled: true,
			origin: "ship",
		},
		{
			id: "refuel-fleet",
			command: "refuel-ship",
			condition: { type: "always" },
			enabled: true,
			origin: "ship",
		},
		{ id: "idle", command: "idle", condition: { type: "always" }, enabled: true, origin: "ship" },
	],
};
createShip({
	name: "ISS Sheetz",
	hostPlanetName: "Earth",
	color: "#ffaa33",
	fuelCapacityKg: 150_000,
	commandTree: tankerCommandTree,
});
state.asteroidBelts = createAsteroidBelts();
rebuildEntityMaps();

// Mark Earth as fully surveyed (home world — all resources available)
const earthEntry = findBody("Earth");
if (earthEntry && isSurveyable(earthEntry)) {
	earthEntry.survey = {
		surveyLevel: 3,
		deposits: generateEarthDeposits(),
	};
}

buildBodyList();
cacheStarEntry();

// Select ship by default
const shipEntry = findShip();
if (shipEntry) selectBody(shipEntry);

// Register transfer completion hook for command dispatch
setOnTransferComplete(onTransferComplete);

// Dismiss splash screen and reveal game UI
const splash = document.getElementById("splash-screen");
if (splash) {
	splash.querySelector(".splash-bar-fill")?.addEventListener("animationend", () => {
		const fill = splash.querySelector(".splash-bar-fill") as HTMLElement;
		if (fill) fill.style.width = "100%";
		splash.classList.add("fade-out");
		splash.addEventListener("transitionend", () => {
			document.body.classList.add("loaded");
		});
	});
}

// ---------------------------------------------------------------------------
// Teardown & load system
// ---------------------------------------------------------------------------
function safeDispose(resource: THREE.BufferGeometry | THREE.Material): void {
	if (!sharedResources.has(resource)) resource.dispose();
}

function teardownSystem(): void {
	state.bodyMeshes.forEach((entry: BodyEntry) => {
		scene.remove(entry.mesh);
		if (entry.geomLevels) {
			entry.geomLevels.forEach((g) => {
				safeDispose(g);
			});
		} else {
			safeDispose(entry.mesh.geometry);
		}
		if ((entry.mesh.material as THREE.MeshStandardMaterial).map)
			(entry.mesh.material as THREE.MeshStandardMaterial).map?.dispose();
		safeDispose(entry.mesh.material as THREE.Material);
		entry.mesh.children.forEach((child) => {
			if (child !== entry.selRing) {
				(child as THREE.Mesh).geometry.dispose();
				if (((child as THREE.Mesh).material as THREE.MeshStandardMaterial).map)
					((child as THREE.Mesh).material as THREE.MeshStandardMaterial).map?.dispose();
				((child as THREE.Mesh).material as THREE.Material).dispose();
			}
		});
		if (entry.selRing) {
			safeDispose(entry.selRing.geometry);
			safeDispose(entry.selRing.material as THREE.Material);
		}
		if (entry.orbitLine) {
			scene.remove(entry.orbitLine);
			safeDispose(entry.orbitLine.geometry);
			safeDispose(entry.orbitLine.material as THREE.Material);
		}
		if (entry.labelDiv) entry.labelDiv.remove();
		if (entry.trail) {
			trailGroups.remove(entry.trail.line);
			entry.trail.line.geometry.dispose();
			(entry.trail.line.material as THREE.Material).dispose();
		}
		if (isShipEntry(entry)) {
			if (entry.tailLine) {
				scene.remove(entry.tailLine);
				entry.tailLine.geometry.dispose();
			}
		}
	});
	state.bodyMeshes.length = 0;

	state.asteroidBelts.forEach((ab) => {
		scene.remove(ab.points);
		ab.points.geometry.dispose();
		(ab.points.material as THREE.Material).dispose();
	});
	state.asteroidBelts = [];

	while (cometGroup.children.length > 0) {
		const child = cometGroup.children[0] as THREE.Mesh;
		cometGroup.remove(child);
		safeDispose(child.geometry);
		safeDispose(child.material as THREE.Material);
	}

	state.selectedBody = null;
	state.flyTo = null;
	state.shipIntents.clear();
	document.getElementById("info-panel")?.classList.add("hidden");
}

function loadSystem(systemData: SystemData): void {
	teardownSystem();
	state.BODIES = systemData.bodies;
	state.COMETS = systemData.comets;
	state.ASTEROID_BELTS = systemData.asteroidBelts;
	createBodies();
	createComets();
	updatePositions(1e-10, 300);
	const firstPlanet =
		state.bodyMeshes.find((e) => !isShipEntry(e) && e.data.type === "Planet")?.data.name ?? "Earth";
	createShip({ name: "ISS Explorer", hostPlanetName: firstPlanet });
	createShip({
		name: "ISS Sheetz",
		hostPlanetName: firstPlanet,
		color: "#ffaa33",
		fuelCapacityKg: 150_000,
		commandTree: tankerCommandTree,
	});
	state.asteroidBelts = createAsteroidBelts();
	rebuildEntityMaps();

	buildBodyList();
	cacheStarEntry();
	(document.querySelector(".system-name") as HTMLElement).textContent = `${systemData.name} \u25be`;
	document.title = `Drift - ${systemData.name}`;
	state.simTime = new GameClock(0);
}

// ---------------------------------------------------------------------------
// Setup UI and interaction
// ---------------------------------------------------------------------------
setupUI(loadSystem);
setupClickHandlers();

// ---------------------------------------------------------------------------
// Ship command dispatch
// ---------------------------------------------------------------------------
// Reference: Earth mass = 5.972e24 kg, base survey = 10 days
const EARTH_MASS_KG = 5.972e24;

/**
 * Compute survey duration based on body mass.
 * Log scale gives 1 day (small asteroid) to ~40 days (Jupiter).
 * Adjusted by crew morale and hull condition.
 */
function getSurveyDuration(mass: number, ship: ShipEntry): number {
	const minMass = 1e10; // small asteroid floor
	const logRatio = Math.log10(Math.max(mass, minMass) / minMass);
	const maxLog = Math.log10(EARTH_MASS_KG / minMass); // ~14.8
	const base = Math.max(1, Math.round(1 + (logRatio / maxLog) * 39)); // 1–40 days
	const morale = Math.max(10, ship.crew.morale) / 100;
	const hull = Math.max(10, ship.maintenance.hullIntegrity) / 100;
	return Math.max(1, Math.ceil((base / (morale * hull)) * state.surveyMultiplier));
}

function getSystemSeed(): number {
	const sys = state.discoveredSystems.get(state.currentSystemKey);
	return sys?.seed ?? 42;
}

function noAction(): ShipEntry["action"] {
	return { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 };
}

function mkAction(
	type: ShipEntry["action"]["type"],
	commandId: string,
	startTime = 0,
	duration = 0,
	target?: string,
): ShipEntry["action"] {
	return { type, commandId, target, startTime, duration, progress: 0 };
}

function completeSurvey(ship: ShipEntry): void {
	const bodyName = ship.action.target ?? ship.hostPlanetName;

	// Try body first, then asteroid
	const body = findBody(bodyName);
	if (body && isSurveyable(body)) {
		const deposits = generateDeposits(
			getSystemSeed(),
			body.data.name,
			body.data.type,
			body.data.radius,
		);
		body.survey = { surveyLevel: 1, deposits };

		const names = deposits
			.map((d) => d.resourceId)
			.slice(0, 3)
			.join(", ");
		const summary = deposits.length > 0 ? `${deposits.length} deposits (${names})` : "no deposits";
		addCoalescedNotification(
			"survey-complete",
			`Surveyed ${body.data.name} -- ${summary}`,
			body.data.name,
		);
	} else {
		const hit = findAsteroidEntity(bodyName);
		if (hit) {
			const deposits = generateDeposits(
				getSystemSeed(),
				hit.asteroid.designation,
				"Asteroid",
				hit.asteroid.diameter / 2,
			);
			hit.asteroid.survey = { surveyLevel: 1, deposits };

			const idx = hit.asteroid.beltIndex ?? 0;
			const c = hit.beltEntry.colors;
			c[idx * 3] = SURVEYED_ASTEROID_COLOR[0];
			c[idx * 3 + 1] = SURVEYED_ASTEROID_COLOR[1];
			c[idx * 3 + 2] = SURVEYED_ASTEROID_COLOR[2];
			hit.beltEntry.points.geometry.attributes.color.needsUpdate = true;

			const names = deposits
				.map((d) => d.resourceId)
				.slice(0, 3)
				.join(", ");
			const summary = deposits.length > 0 ? `${deposits.length} deposits (${names})` : "no deposits";
			addCoalescedNotification(
				"survey-complete",
				`Surveyed ${hit.asteroid.designation} -- ${summary}`,
				hit.asteroid.designation,
			);
		}
	}
	ship.action = noAction();
	ship.stationTarget = null;
	pushResourceUpdate();
}

function findColony(): PlanetEntry | undefined {
	return findPlanet("Earth") ?? findPlanet(state.bodyMeshes[0]?.data.name ?? "");
}

/** Compute AU of a body from its world position or data.distance. */
function bodyAU(body: BodyEntry): number {
	if (body.data.distance > 0 && !body.isMoon) return body.data.distance;
	const { x, y, z } = body.mesh.position;
	return (Math.hypot(x, y, z) / DIST_SCALE) ** 2;
}

/** Compute distance in km between two bodies. */
function bodyDistanceKm(a: BodyEntry, b: BodyEntry): number {
	return Math.abs(bodyAU(b) - bodyAU(a)) * AU_TO_KM;
}

/** Check if ship has enough fuel for a hop to target AND return to nearest colony. */
function canAffordRoundTrip(ship: ShipEntry, target: BodyEntry): boolean {
	const hostResolved = resolveEntity(ship.hostPlanetName);
	if (!hostResolved) return false;
	const colony = findColony();
	if (!colony) return false;

	// Fuel cost: host → target
	const distToTarget = Math.abs(bodyAU(target) - hostResolved.distance) * AU_TO_KM;
	const leg1 = checkTransferKm(distToTarget, {
		fuelKg: ship.fuelKg,
		dryMassKg: ship.dryMassKg,
		engineId: ship.engineId,
	});
	if (!leg1.feasible) return false;

	// Fuel cost: target → colony (with remaining fuel after leg 1)
	const fuelAfterLeg1 = ship.fuelKg - (leg1.fuelUsedKg ?? 0);
	const distToColony = bodyDistanceKm(target, colony);
	const leg2 = checkTransferKm(distToColony, {
		fuelKg: fuelAfterLeg1,
		dryMassKg: ship.dryMassKg,
		engineId: ship.engineId,
	});
	return leg2.feasible;
}

/** Route a ship to its colony, set the given action, or handle already-at-colony. */
function routeToColony(
	ship: ShipEntry,
	actionId: ShipEntry["action"]["type"],
	strandedMsg: string,
	atColonyOverride?: () => void,
): void {
	const colony = findColony();
	if (colony && colony.data.name !== ship.hostPlanetName) {
		if (initiateTransfer(ship, colony)) {
			ship.action = mkAction(actionId, actionId as string);
			learnFromEmergencyReturn(ship);
		} else {
			addNotification("low-fuel", strandedMsg);
			ship.action = noAction();
		}
	} else if (atColonyOverride) {
		atColonyOverride();
	} else {
		ship.action = noAction();
	}
}

function handleSurveyMoonFirst(ship: ShipEntry): boolean {
	const hostEntry = findBody(ship.hostPlanetName);
	const hostSurveyed = hostEntry && isSurveyable(hostEntry) && hostEntry.survey.surveyLevel > 0;
	if (!hostSurveyed) return false;
	const unsurvevedMoons = getUnsurvevedMoonsOfHost(ship);
	if (unsurvevedMoons.length === 0) return false;
	const moon = unsurvevedMoons[0];
	const dur = getSurveyDuration((moon.data as { mass: number }).mass, ship);
	ship.action = mkAction("survey-nearest", "survey", state.simTime.days, dur, moon.data.name);
	publishIntent(ship.data.name, {
		type: "surveying",
		target: moon.data.name,
		shipName: ship.data.name,
	});
	return true;
}

function handleSurveyAtLocation(ship: ShipEntry, target: string, targetMass: number): void {
	const dur = getSurveyDuration(targetMass, ship);
	ship.action = mkAction("survey-nearest", "survey", state.simTime.days, dur, target);
	ship.stationTarget = null;
	publishIntent(ship.data.name, { type: "surveying", target, shipName: ship.data.name });
}

function handleSurveyLowFuel(ship: ShipEntry): void {
	const colony = findColony();
	if (colony && colony.data.name !== ship.hostPlanetName) {
		if (initiateTransfer(ship, colony)) {
			ship.action = mkAction("refuel", "refuel");
		} else {
			addNotification("low-fuel", `Ship stranded at ${ship.hostPlanetName}`);
			ship.action = noAction();
		}
	} else {
		ship.fuelKg = ship.fuelCapacityKg;
		ship.action = noAction();
	}
}

function handleSurveyTransfer(ship: ShipEntry, target: string, targetBody: BodyEntry): void {
	gameLog(`[dispatch] ${ship.data.name}: initiating transfer to ${target}`);
	if (initiateTransfer(ship, targetBody)) {
		ship.action = mkAction("survey-nearest", "survey", 0, 0, target);
		ship.stationTarget = null;
		publishIntent(ship.data.name, {
			type: "transferring",
			destination: target,
			shipName: ship.data.name,
		});
	} else {
		ship.action = noAction();
	}
}

function handleSurveyCommand(ship: ShipEntry): void {
	if (handleSurveyMoonFirst(ship)) return;

	const target = selectNextSurveyTarget(ship);
	if (!target) {
		addCoalescedNotification("mission-complete", "System survey complete -- all bodies surveyed");
		ship.action = mkAction("idle", "idle");
		publishIntent(ship.data.name, {
			type: "idle",
			location: ship.hostPlanetName,
			shipName: ship.data.name,
		});
		return;
	}

	const resolved = resolveEntity(target);
	if (!resolved) return;
	const targetBody =
		resolved.bodyEntry ??
		(resolved.asteroidHit
			? asteroidProxy(resolved.asteroidHit.asteroid, resolved.asteroidHit.beltEntry)
			: null);
	if (!targetBody) return;

	const isAtTarget = target === ship.hostPlanetName;
	const isMoonOfHost =
		targetBody.isMoon &&
		targetBody.parentMesh &&
		state.bodyMeshes.find((e) => e.mesh === targetBody?.parentMesh)?.data.name ===
			ship.hostPlanetName;

	if (isAtTarget || isMoonOfHost) {
		handleSurveyAtLocation(ship, target, resolved.mass);
	} else if (!canAffordRoundTrip(ship, targetBody)) {
		handleSurveyLowFuel(ship);
	} else {
		handleSurveyTransfer(ship, target, targetBody);
	}
}

function handleTransferCommand(ship: ShipEntry, result: CommandResult): void {
	if (!result.target) return;
	const te = findPlanet(result.target);
	if (te) initiateTransfer(ship, te);
	publishIntent(ship.data.name, {
		type: "transferring",
		destination: result.target,
		shipName: ship.data.name,
	});
}

function handleRefuelCommand(ship: ShipEntry): void {
	const earth = findColony();
	if (earth && earth.data.name !== ship.hostPlanetName) {
		if (initiateTransfer(ship, earth)) {
			ship.action = mkAction("refuel", "refuel");
			learnFromEmergencyReturn(ship);
		} else {
			addNotification("low-fuel", `Ship stranded at ${ship.hostPlanetName} -- insufficient fuel`);
			ship.action = noAction();
		}
	} else {
		ship.fuelKg = ship.fuelCapacityKg;
		ship.action = noAction();
	}
	publishIntent(ship.data.name, {
		type: "refueling",
		location: earth?.data.name ?? ship.hostPlanetName,
		shipName: ship.data.name,
	});
}

function handleShoreLeaveCommand(ship: ShipEntry): void {
	const colony = findColony();
	routeToColony(
		ship,
		"shore-leave",
		`Ship stranded at ${ship.hostPlanetName} -- insufficient fuel for shore leave`,
		() => {
			ship.action = mkAction("shore-leave", "shore-leave", state.simTime.days, 30);
		},
	);
	publishIntent(ship.data.name, {
		type: "shore-leave",
		location: colony?.data.name ?? ship.hostPlanetName,
		shipName: ship.data.name,
	});
}

function handleOverhaulCommand(ship: ShipEntry): void {
	const yard = findColony();
	routeToColony(
		ship,
		"overhaul",
		`Ship stranded at ${ship.hostPlanetName} -- insufficient fuel for overhaul`,
		() => {
			ship.action = mkAction(
				"overhaul",
				"overhaul",
				state.simTime.days,
				computeOverhaulDuration(ship),
			);
		},
	);
	publishIntent(ship.data.name, {
		type: "overhauling",
		location: yard?.data.name ?? ship.hostPlanetName,
		shipName: ship.data.name,
	});
}

function computeRefuelShipDuration(target: ShipEntry): number {
	const deficit = target.fuelCapacityKg - target.fuelKg;
	return Math.max(1, Math.ceil(deficit / 10_000)); // 10,000 kg/day transfer rate
}

function handleRefuelShipCommand(ship: ShipEntry): void {
	const targetName = selectNextRefuelTarget(ship);
	if (!targetName) {
		// No ships need fuel -- idle (will re-evaluate next frame)
		ship.action = noAction();
		publishIntent(ship.data.name, {
			type: "idle",
			location: ship.hostPlanetName,
			shipName: ship.data.name,
		});
		return;
	}

	const targetShip = findShip(targetName);
	if (!targetShip) return;

	publishIntent(ship.data.name, {
		type: "tanking",
		target: targetName,
		shipName: ship.data.name,
	});

	if (targetShip.hostPlanetName === ship.hostPlanetName) {
		// Already at the same body -- start refueling immediately
		const duration = computeRefuelShipDuration(targetShip);
		ship.action = mkAction("refuel-ship", "refuel-fleet", state.simTime.days, duration, targetName);
	} else {
		// Need to travel to the target ship's host body
		const hostBody = findBody(targetShip.hostPlanetName);
		if (hostBody && initiateTransfer(ship, hostBody)) {
			ship.action = mkAction("refuel-ship", "refuel-fleet", 0, 0, targetName);
		} else {
			ship.action = noAction();
			publishIntent(ship.data.name, {
				type: "idle",
				location: ship.hostPlanetName,
				shipName: ship.data.name,
			});
		}
	}
}

let _dispatchDepth = 0;
function dispatchCommand(ship: ShipEntry, result: CommandResult): void {
	_dispatchDepth++;
	if (_dispatchDepth > 5) {
		console.error(
			"dispatchCommand recursion detected",
			ship.data.name,
			result.action,
			_dispatchDepth,
		);
		_dispatchDepth = 0;
		return;
	}
	gameLog(
		`[dispatch] ${ship.data.name}: ${result.action}${result.target ? ` → ${result.target}` : ""}`,
	);

	// Clear one-shot immediate command on ANY dispatch (not just transfer)
	ship.immediateCommand = null;

	switch (result.action) {
		case "survey":
			handleSurveyCommand(ship);
			break;
		case "transfer":
			handleTransferCommand(ship, result);
			break;
		case "refuel":
			handleRefuelCommand(ship);
			break;
		case "shore-leave":
			handleShoreLeaveCommand(ship);
			break;
		case "overhaul":
			handleOverhaulCommand(ship);
			break;
		case "refuel-ship":
			handleRefuelShipCommand(ship);
			break;
		case "idle":
			ship.action = noAction();
			publishIntent(ship.data.name, {
				type: "idle",
				location: ship.hostPlanetName,
				shipName: ship.data.name,
			});
			break;
	}
	_dispatchDepth = 0;
}

function completeAction(ship: ShipEntry): void {
	gameLog(`[completeAction] ${ship.data.name}: ${ship.action.type} completed`);
	incrementExperience(ship);
	const actionType = ship.action.type;
	if (actionType === "survey-nearest") {
		completeSurvey(ship);
	} else if (actionType === "shore-leave") {
		ship.crew.lastShoreLeave = state.simTime.days;
		ship.action = noAction();
		addCoalescedNotification(
			"action-complete",
			`${ship.data.name}: Shore leave completed`,
			ship.data.name,
		);
	} else if (actionType === "overhaul") {
		ship.maintenance.age = 0;
		ship.action = noAction();
		addCoalescedNotification(
			"action-complete",
			`${ship.data.name}: Overhaul completed`,
			ship.data.name,
		);
	} else if (actionType === "refuel") {
		ship.action = noAction();
		addCoalescedNotification(
			"action-complete",
			`${ship.data.name}: Refueling completed`,
			ship.data.name,
		);
	} else if (actionType === "refuel-ship") {
		ship.action = noAction();
		addCoalescedNotification(
			"action-complete",
			`${ship.data.name}: Fleet refueling completed`,
			ship.data.name,
		);
	}

	// Commander evaluates standing orders + applies judgment for next action
	const decision = commanderDecide(ship);
	if (decision) dispatchCommand(ship, decision);
}

/** Called each frame for every ship. Handles simulation + action timers. */
function tickShip(ship: ShipEntry, simDt: number): void {
	tickShipSimulation(ship, simDt, state.simTime.days);

	// Check action timer (only while orbiting with active timed action)
	const hasActiveAction =
		ship.shipState === "orbiting" &&
		ship.action.type &&
		ship.action.startTime > 0 &&
		ship.action.duration > 0;
	if (hasActiveAction) {
		// Ship-to-ship fuel transfer: pump fuel each frame, abort if target moved
		if (ship.action.type === "refuel-ship") {
			const done = tickTankerTransfer(ship, simDt);
			if (done) {
				completeAction(ship);
				return;
			}
		}

		const elapsed = state.simTime.days - ship.action.startTime;
		ship.action.progress = Math.min(1, elapsed / ship.action.duration);

		if (ship.action.progress >= 1) {
			completeAction(ship);
		}
	}

	// Auto-evaluate command tree when idle and orbiting (kicks off autonomous behavior)
	// Skip until positions have been computed (simTime > 0.1 ensures at least a few frames)
	if (ship.shipState === "orbiting" && !ship.action.type && state.simTime.days > 0.1) {
		gameLog(`[tickShip] ${ship.data.name}: idle, commander deciding`);
		const decision = commanderDecide(ship);
		if (decision) dispatchCommand(ship, decision);
	}
}

function startActionTimer(ship: ShipEntry, duration: number): void {
	ship.action.startTime = state.simTime.days;
	ship.action.duration = duration;
	ship.action.progress = 0;
}

function computeOverhaulDuration(ship: ShipEntry): number {
	const hullDeficit = 100 - ship.maintenance.hullIntegrity;
	const supplyDeficit = ship.maintenance.maxSupplies - ship.maintenance.supplies;
	const dq = state.depotQuality;
	const hullDays = hullDeficit / ((HULL_REPAIR_PER_DAY * dq) / state.repairMultiplier);
	const supplyDays = supplyDeficit / ((SUPPLY_RESTOCK_PER_DAY * dq) / state.supplyMultiplier);
	return Math.max(1, Math.ceil(Math.max(hullDays, supplyDays)));
}

function startSurveyOnArrival(ship: ShipEntry): void {
	const surveyTarget = ship.action.target;
	const resolved = surveyTarget ? resolveEntity(surveyTarget) : null;
	const targetBody = resolved?.bodyEntry ?? null;

	// Guard: skip survey if target was already surveyed (e.g., by another ship mid-transfer)
	const alreadySurveyed =
		(targetBody && isSurveyable(targetBody) && targetBody.survey.surveyLevel > 0) ||
		(resolved?.asteroidHit && resolved.asteroidHit.asteroid.survey.surveyLevel > 0);
	if (alreadySurveyed) {
		ship.action = noAction();
		const decision = commanderDecide(ship);
		if (decision) dispatchCommand(ship, decision);
		return;
	}

	const mass = resolved?.mass ?? EARTH_MASS_KG;
	startActionTimer(ship, getSurveyDuration(mass, ship));
	publishIntent(ship.data.name, {
		type: "surveying",
		target: surveyTarget ?? ship.hostPlanetName,
		shipName: ship.data.name,
	});
	// Station-keeping only for comets (moons orbit parent planet normally)
	if (targetBody && isCometEntry(targetBody)) {
		ship.stationTarget = surveyTarget ?? null;
	}
}

/** Called when a ship arrives at a planet after transfer. */
export function onTransferComplete(ship: ShipEntry): void {
	gameLog(
		`[transferComplete] ${ship.data.name}: arrived at ${ship.hostPlanetName}`,
		`action=${ship.action.type} target=${ship.action.target}`,
	);
	addCoalescedNotification(
		"transfer-complete",
		`${ship.data.name} arrived at ${ship.hostPlanetName}`,
		ship.data.name,
	);
	const actionType = ship.action.type;
	if (actionType === "survey-nearest") {
		startSurveyOnArrival(ship);
	} else if (actionType === "refuel") {
		startActionTimer(ship, 5);
	} else if (actionType === "shore-leave") {
		startActionTimer(ship, 30);
	} else if (actionType === "overhaul") {
		startActionTimer(ship, computeOverhaulDuration(ship));
	} else if (actionType === "refuel-ship") {
		const targetShip = findShip(ship.action.target ?? undefined);
		if (targetShip) {
			startActionTimer(ship, computeRefuelShipDuration(targetShip));
		} else {
			ship.action = noAction();
			const decision = commanderDecide(ship);
			if (decision) dispatchCommand(ship, decision);
		}
	} else {
		// No pending action -- commander decides
		const decision = commanderDecide(ship);
		if (decision) dispatchCommand(ship, decision);
	}
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
let cachedCamDist = 300;
const _perfTimings: PerfTimings = {
	positions: 0,
	asteroids: 0,
	labels: 0,
	hud: 0,
	render: 0,
	total: 0,
};

const FRAME_INTERVAL = 1000 / 30; // 30fps cap
let lastFrameTime = 0;
let rafId = 0;
let loopRunning = false;

// Mark scene dirty so next frame renders (used when paused)
function markDirty(): void {
	state.renderNeeded = true;
	if (!loopRunning) startLoop();
}

// Inputs that dirty the scene while paused
controls.addEventListener("change", markDirty);
window.addEventListener("resize", markDirty);
window.addEventListener("wake-render", markDirty);

function startLoop(): void {
	if (loopRunning) return;
	loopRunning = true;
	lastFrameTime = performance.now();
	rafId = requestAnimationFrame(animate);
}

function stopLoop(): void {
	if (!loopRunning) return;
	loopRunning = false;
	cancelAnimationFrame(rafId);
}

function tickDebugStep(): void {
	if (state.debugStepFrames <= 0) return;
	state.debugStepFrames--;
	if (state.debugStepFrames !== 0) return;
	state.timeSpeed = 0;
	window.dispatchEvent(new Event("debug-step-done"));
	const ship = findShip();
	if (ship) {
		const elapsed: number = state.simTime.days - ship.transferStartTime;
		const t: number = ship.transferTimeDays > 0 ? elapsed / ship.transferTimeDays : 0;
		gameLog("DEBUG STEP PAUSED:", {
			simTime: state.simTime.days.toFixed(3),
			shipState: ship.shipState,
			t: t.toFixed(4),
			shipPos: `(${ship.mesh.position.x.toFixed(2)}, ${ship.mesh.position.z.toFixed(2)})`,
			elapsed: elapsed.toFixed(3),
		});
	}
}

/** Returns [t0, t1, t2] perf timestamps after ticking sim + positions + asteroids. */
function tickSimulation(dt: number, simActive: boolean): [number, number, number] {
	const t0 = performance.now();
	if (simActive) {
		const simDt = dt * state.timeSpeed;
		for (const entry of state.bodyMeshes) {
			if (isShipEntry(entry)) {
				tickShip(entry, simDt);
				if (Number.isNaN(entry.mesh.position.x)) {
					console.error("[SHIP NaN]", entry.data.name, {
						state: entry.shipState,
						host: entry.hostPlanetName,
						action: entry.action.type,
						fuel: entry.fuelKg,
					});
				}
			}
		}
		updatePositions(dt, cachedCamDist);
	}
	const t1 = performance.now();
	if (simActive) updateAsteroids(dt);
	const t2 = performance.now();
	return [t0, t1, t2];
}

function tickCameraAndLabels(dt: number): [number, number] {
	if (Number.isNaN(camera.position.x) || Number.isNaN(controls.target.x)) {
		console.error("[CAMERA NaN]", {
			camPos: `${camera.position.x},${camera.position.y},${camera.position.z}`,
			target: `${controls.target.x},${controls.target.y},${controls.target.z}`,
			flyTo: state.flyTo?.entry.data.name,
			selectedBody: state.selectedBody?.data.name,
		});
	}
	updateFlyTo();
	updateFollow(dt);
	controls.update();
	cachedCamDist = camera.position.distanceTo(controls.target);
	updateLabels(cachedCamDist);
	const t3 = performance.now();
	if (state.selectedBody) updateSelectedBody();
	updateHUD(cachedCamDist);
	const t4 = performance.now();
	return [t3, t4];
}

function tickRenderAndPerf(t0: number, t1: number, t2: number, t3: number, t4: number): void {
	if (starEntry && (starEntry.mesh.material as THREE.ShaderMaterial).uniforms) {
		(starEntry.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = timer.getElapsed();
	}
	renderer.render(scene, camera);
	const t5 = performance.now();

	_perfTimings.positions = t1 - t0;
	_perfTimings.asteroids = t2 - t1;
	_perfTimings.labels = t3 - t2;
	_perfTimings.hud = t4 - t3;
	_perfTimings.render = t5 - t4;
	_perfTimings.total = t5 - t0;
	if (_perfTimings.total > 100) {
		gameWarn("[SLOW FRAME]", {
			total: `${_perfTimings.total.toFixed(1)}ms`,
			positions: `${_perfTimings.positions.toFixed(1)}ms`,
			asteroids: `${_perfTimings.asteroids.toFixed(1)}ms`,
			labels: `${_perfTimings.labels.toFixed(1)}ms`,
			render: `${_perfTimings.render.toFixed(1)}ms`,
		});
	}
	updatePerfDisplay(_perfTimings);
}

function animate(now: number): void {
	rafId = requestAnimationFrame(animate);

	// 30fps throttle
	const elapsed = now - lastFrameTime;
	if (elapsed < FRAME_INTERVAL) return;
	lastFrameTime = now - (elapsed % FRAME_INTERVAL);

	timer.update();
	const dt: number = timer.getDelta();
	const simActive = state.timeSpeed !== 0;
	const hasActiveCamera = !!state.flyTo;

	tickDebugStep();
	const [t0, t1, t2] = tickSimulation(dt, simActive);
	const [t3, t4] = tickCameraAndLabels(dt);
	tickRenderAndPerf(t0, t1, t2, t3, t4);

	// When paused with no camera animation, consume the dirty flag and stop
	state.renderNeeded = false;
	if (!simActive && !hasActiveCamera) stopLoop();
}

startLoop();
