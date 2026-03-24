import "./style.css";
import * as THREE from "three";
import {
	evaluateCommandTree,
	getUnsurvevedMoonsOfHost,
	selectNextSurveyTarget,
	tickShipSimulation,
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
import {
	gameLog,
	gameWarn,
	loadSavedState,
	MASTER_SEED,
	restoreShipState,
	saveState,
	state,
} from "./core/state";
import { seededRandom } from "./core/utils";
import { generateDeposits } from "./data/resources";
import { getSolSystem } from "./data/sol-data";
import { generateSystem } from "./data/system-generator";
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
	PlanetEntry,
	SavedStateData,
	ShipEntry,
	SystemData,
} from "./types";
import { isCometEntry, isShipEntry, isSurveyable } from "./types";
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

// Restore saved state if available
const saved: SavedStateData | null = loadSavedState();
if (saved) {
	// Advance masterRng to match previous random discovery count
	for (let i = 0; i < saved.randomClickCount; i++) state.masterRng?.();
	state.randomClickCount = saved.randomClickCount;

	// Regenerate discovered systems from saved seeds
	saved.discoveredSystems.forEach(({ key, name, seed }) => {
		const systemData: SystemData = generateSystem(seed);
		state.discoveredSystems.set(key, { name, seed, systemData });
	});

	// Load the active system
	const active = state.discoveredSystems.get(saved.currentSystemKey);
	if (active) {
		state.currentSystemKey = saved.currentSystemKey;
		state.BODIES = active.systemData.bodies;
		state.COMETS = active.systemData.comets;
		state.ASTEROID_BELTS = active.systemData.asteroidBelts;
		state.simTime = new GameClock(saved.simTime);
		(document.querySelector(".system-name") as HTMLElement).textContent =
			`${active.systemData.name} \u25be`;
		document.title = `Drift - ${active.systemData.name}`;
	} else {
		state.BODIES = sol.bodies;
		state.COMETS = sol.comets;
		state.ASTEROID_BELTS = sol.asteroidBelts;
	}
} else {
	state.BODIES = sol.bodies;
	state.COMETS = sol.comets;
	state.ASTEROID_BELTS = sol.asteroidBelts;
}

createBodies();
createComets();
// Initial position tick so all bodies are placed before ship creation
updatePositions(1e-10, 300);
createShip({ name: "ISS Explorer", hostPlanetName: "Earth" });
createShip({ name: "ISS Magellan", hostPlanetName: "Mars" });
createShip({ name: "ISS Kepler", hostPlanetName: "Jupiter" });
if (saved) restoreShipState(saved);
state.asteroidBelts = createAsteroidBelts();
rebuildEntityMaps();

// Mark Earth as pre-surveyed (home world)
const earthEntry = findBody("Earth");
if (earthEntry && isSurveyable(earthEntry)) {
	earthEntry.survey = {
		surveyLevel: 1,
		deposits: generateDeposits(42, "Earth", "Planet", 6371),
	};
}

buildBodyList();
cacheStarEntry();

// Select ship by default
const shipEntry = findShip();
if (shipEntry) selectBody(shipEntry);

// Register transfer completion hook for command dispatch
setOnTransferComplete(onTransferComplete);

// Auto-save on page unload
window.addEventListener("beforeunload", saveState);

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
		case "survey": {
			// Survey unsurveyed moons of the current host before moving to the next planet
			const hostEntry = findBody(ship.hostPlanetName);
			const hostSurveyed = hostEntry && isSurveyable(hostEntry) && hostEntry.survey.surveyLevel > 0;
			if (hostSurveyed) {
				const unsurvevedMoons = getUnsurvevedMoonsOfHost(ship);
				if (unsurvevedMoons.length > 0) {
					const moon = unsurvevedMoons[0];
					const dur = getSurveyDuration(moon.data.mass, ship);
					ship.action = mkAction("survey-nearest", "survey", state.simTime.days, dur, moon.data.name);
					publishIntent(ship.data.name, {
						type: "surveying",
						target: moon.data.name,
						shipName: ship.data.name,
					});
					break;
				}
			}

			const target = selectNextSurveyTarget(ship);
			if (target) {
				// Resolve target -- could be a body or an asteroid
				const resolved = resolveEntity(target);
				if (!resolved) break;
				// Get a BodyEntry for transfer: use bodyEntry if available, else build asteroid proxy
				const targetBody =
					resolved.bodyEntry ??
					(resolved.asteroidHit
						? asteroidProxy(resolved.asteroidHit.asteroid, resolved.asteroidHit.beltEntry)
						: null);
				if (!targetBody) break;
				const targetMass = resolved.mass;

				// Check if already at the target or its parent planet (for moons)
				const isAtTarget = target === ship.hostPlanetName;
				const isMoonOfHost =
					targetBody.isMoon &&
					targetBody.parentMesh &&
					state.bodyMeshes.find((e) => e.mesh === targetBody?.parentMesh)?.data.name ===
						ship.hostPlanetName;
				const alreadyThere = isAtTarget || isMoonOfHost;

				if (alreadyThere) {
					const dur = getSurveyDuration(targetMass, ship);
					ship.action = mkAction("survey-nearest", "survey", state.simTime.days, dur, target);
					ship.stationTarget = null;
					publishIntent(ship.data.name, { type: "surveying", target, shipName: ship.data.name });
				} else if (!canAffordRoundTrip(ship, targetBody)) {
					// Not enough fuel for hop + return -- head home to refuel first
					const colony = findColony();
					if (colony && colony.data.name !== ship.hostPlanetName) {
						if (initiateTransfer(ship, colony)) {
							ship.action = mkAction("refuel", "refuel");
						} else {
							addNotification("low-fuel", `Ship stranded at ${ship.hostPlanetName}`);
							ship.action = noAction();
						}
					} else {
						// Already at colony -- refuel and retry
						ship.fuelKg = ship.fuelCapacityKg;
						ship.action = noAction();
					}
				} else {
					// Transfer directly to the body
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
			} else {
				addCoalescedNotification("mission-complete", "System survey complete -- all bodies surveyed");
				ship.action = mkAction("idle", "idle");
				publishIntent(ship.data.name, {
					type: "idle",
					location: ship.hostPlanetName,
					shipName: ship.data.name,
				});
			}
			break;
		}
		case "transfer": {
			if (result.target) {
				const te = findPlanet(result.target);
				if (te) initiateTransfer(ship, te);
				publishIntent(ship.data.name, {
					type: "transferring",
					destination: result.target,
					shipName: ship.data.name,
				});
			}
			break;
		}
		case "refuel": {
			const earth = findColony();
			if (earth && earth.data.name !== ship.hostPlanetName) {
				if (initiateTransfer(ship, earth)) {
					ship.action = mkAction("refuel", "refuel");
				} else {
					// Can't reach colony -- stranded, clear action to avoid stuck state
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
			break;
		}
		case "shore-leave": {
			const colony = findColony();
			if (colony && colony.data.name !== ship.hostPlanetName) {
				if (initiateTransfer(ship, colony)) {
					ship.action = mkAction("shore-leave", "shore-leave");
				} else {
					addNotification(
						"low-fuel",
						`Ship stranded at ${ship.hostPlanetName} -- insufficient fuel for shore leave`,
					);
					ship.action = noAction();
				}
			} else {
				ship.action = mkAction("shore-leave", "shore-leave", state.simTime.days, 30);
			}
			publishIntent(ship.data.name, {
				type: "shore-leave",
				location: colony?.data.name ?? ship.hostPlanetName,
				shipName: ship.data.name,
			});
			break;
		}
		case "overhaul": {
			const yard = findColony();
			if (yard && yard.data.name !== ship.hostPlanetName) {
				if (initiateTransfer(ship, yard)) {
					ship.action = mkAction("overhaul", "overhaul");
				} else {
					addNotification(
						"low-fuel",
						`Ship stranded at ${ship.hostPlanetName} -- insufficient fuel for overhaul`,
					);
					ship.action = noAction();
				}
			} else {
				const dur = 5;
				ship.action = mkAction("overhaul", "overhaul", state.simTime.days, dur);
			}
			publishIntent(ship.data.name, {
				type: "overhauling",
				location: yard?.data.name ?? ship.hostPlanetName,
				shipName: ship.data.name,
			});
			break;
		}
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
	}

	// Re-evaluate command tree for next action
	const result = evaluateCommandTree(ship);
	if (result) dispatchCommand(ship, result);
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
		const elapsed = state.simTime.days - ship.action.startTime;
		ship.action.progress = Math.min(1, elapsed / ship.action.duration);

		if (ship.action.progress >= 1) {
			completeAction(ship);
		}
	}

	// Auto-evaluate command tree when idle and orbiting (kicks off autonomous behavior)
	// Skip until positions have been computed (simTime > 0.1 ensures at least a few frames)
	if (ship.shipState === "orbiting" && !ship.action.type && state.simTime.days > 0.1) {
		gameLog(`[tickShip] ${ship.data.name}: idle, re-evaluating command tree`);
		const result = evaluateCommandTree(ship);
		if (result) dispatchCommand(ship, result);
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
	// If ship was en route for a specific action, start it at the destination
	const actionType = ship.action.type;
	if (actionType === "survey-nearest") {
		const surveyTarget = ship.action.target;
		const resolved = surveyTarget ? resolveEntity(surveyTarget) : null;
		const targetBody = resolved?.bodyEntry ?? null;

		// Guard: skip survey if target was already surveyed (e.g., by another ship mid-transfer)
		const alreadySurveyed =
			(targetBody && isSurveyable(targetBody) && targetBody.survey.surveyLevel > 0) ||
			(resolved?.asteroidHit && resolved.asteroidHit.asteroid.survey.surveyLevel > 0);
		if (alreadySurveyed) {
			ship.action = noAction();
			const result = evaluateCommandTree(ship);
			if (result) dispatchCommand(ship, result);
			return;
		}

		const mass = resolved?.mass ?? EARTH_MASS_KG;
		const dur = getSurveyDuration(mass, ship);
		ship.action.startTime = state.simTime.days;
		ship.action.duration = dur;
		ship.action.progress = 0;
		publishIntent(ship.data.name, {
			type: "surveying",
			target: surveyTarget ?? ship.hostPlanetName,
			shipName: ship.data.name,
		});
		// Station-keeping only for comets (moons orbit parent planet normally)
		if (targetBody && isCometEntry(targetBody)) {
			ship.stationTarget = surveyTarget ?? null;
		}
	} else if (actionType === "refuel") {
		ship.action.startTime = state.simTime.days;
		ship.action.duration = 5;
		ship.action.progress = 0;
	} else if (actionType === "shore-leave") {
		ship.action.startTime = state.simTime.days;
		ship.action.duration = 30;
		ship.action.progress = 0;
	} else if (actionType === "overhaul") {
		ship.action.startTime = state.simTime.days;
		ship.action.duration = 5;
		ship.action.progress = 0;
	} else {
		// No pending action -- evaluate command tree
		const result = evaluateCommandTree(ship);
		if (result) dispatchCommand(ship, result);
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

	// Debug step-through: count down frames then pause
	if (state.debugStepFrames > 0) {
		state.debugStepFrames--;
		if (state.debugStepFrames === 0) {
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
					elapsed: (state.simTime.days - ship.transferStartTime).toFixed(3),
				});
			}
		}
	}

	const _t0 = performance.now();
	// Tick ship simulation BEFORE position updates (morale, maintenance, action timers)
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
	}
	if (simActive) updatePositions(dt, cachedCamDist);
	const _t1 = performance.now();
	if (simActive) updateAsteroids(dt);
	const _t2 = performance.now();

	// NaN guard: detect corrupted camera/controls state
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
	const _t3 = performance.now();
	if (state.selectedBody) updateSelectedBody();
	updateHUD(cachedCamDist);
	const _t4 = performance.now();

	if (starEntry && (starEntry.mesh.material as THREE.ShaderMaterial).uniforms) {
		(starEntry.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = timer.getElapsed();
	}

	renderer.render(scene, camera);
	const _t5 = performance.now();

	_perfTimings.positions = _t1 - _t0;
	_perfTimings.asteroids = _t2 - _t1;
	_perfTimings.labels = _t3 - _t2;
	_perfTimings.hud = _t4 - _t3;
	_perfTimings.render = _t5 - _t4;
	_perfTimings.total = _t5 - _t0;
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

	// When paused with no camera animation, consume the dirty flag and stop
	state.renderNeeded = false;
	if (!simActive && !hasActiveCamera) {
		stopLoop();
	}
}

startLoop();
