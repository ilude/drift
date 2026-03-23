import "./style.css";
import * as THREE from "three";
import { evaluateCommandTree, selectNextSurveyTarget, tickShipSimulation } from "./core/commands";
import { addCoalescedNotification, addNotification } from "./core/notifications";
import { loadSavedState, MASTER_SEED, restoreShipState, saveState, state } from "./core/state";
import { seededRandom } from "./core/utils";
import { generateDeposits } from "./data/resources";
import { getSolSystem } from "./data/sol-data";
import { generateSystem } from "./data/system-generator";
import { findPlanetEntry } from "./rendering/bodies";
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
import { initiateTransfer, setOnTransferComplete } from "./rendering/ship-transfer";
import type {
	BodyEntry,
	CommandResult,
	PlanetEntry,
	SavedStateData,
	ShipEntry,
	SystemData,
} from "./types";
import { isShipEntry, isSurveyable } from "./types";
import {
	selectBody,
	setupClickHandlers,
	updateFlyTo,
	updateFollow,
	updateInfoPosition,
} from "./ui/selection";
import type { PerfTimings } from "./ui/ui";
import { buildBodyList, setupUI, updateHUD, updateLabels, updatePerfDisplay } from "./ui/ui";

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
let starEntry: PlanetEntry | null = null;

function cacheStarEntry(): void {
	starEntry = (state.bodyMeshes.find((e) => e.data.type === "Star") as PlanetEntry) || null;
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
		state.simTime = saved.simTime;
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
createShip();
if (saved) restoreShipState(saved);
state.asteroidBelts = createAsteroidBelts();

buildBodyList();
cacheStarEntry();

// Select ship by default
const shipEntry: BodyEntry | undefined = state.bodyMeshes.find((e) => e.isShip);
if (shipEntry) selectBody(shipEntry);

// Register transfer completion hook for command dispatch
setOnTransferComplete(onTransferComplete);

// Auto-save on page unload
window.addEventListener("beforeunload", saveState);

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
			if (entry.transferPath) {
				scene.remove(entry.transferPath);
				entry.transferPath.geometry.dispose();
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
	document.getElementById("info-panel")?.classList.add("hidden");
}

function loadSystem(systemData: SystemData): void {
	teardownSystem();
	state.BODIES = systemData.bodies;
	state.COMETS = systemData.comets;
	state.ASTEROID_BELTS = systemData.asteroidBelts;
	createBodies();
	createComets();
	createShip();
	state.asteroidBelts = createAsteroidBelts();

	buildBodyList();
	cacheStarEntry();
	(document.querySelector(".system-name") as HTMLElement).textContent = `${systemData.name} \u25be`;
	document.title = `Drift - ${systemData.name}`;
	state.simTime = 0;
}

// ---------------------------------------------------------------------------
// Setup UI and interaction
// ---------------------------------------------------------------------------
setupUI(loadSystem);
setupClickHandlers();

// ---------------------------------------------------------------------------
// Ship command dispatch
// ---------------------------------------------------------------------------
const SURVEY_DURATIONS: Record<string, number> = {
	Planet: 10,
	"Dwarf Planet": 10,
	"Detached Object": 10,
	Moon: 4,
	Comet: 3,
};
const DEFAULT_SURVEY_DURATION = 2; // asteroids, unknown

function getSurveyDuration(bodyType: string): number {
	return SURVEY_DURATIONS[bodyType] ?? DEFAULT_SURVEY_DURATION;
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
	const body = state.bodyMeshes.find((e) => e.data.name === bodyName);
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
			`Surveyed ${body.data.name} — ${summary}`,
			body.data.name,
		);
	}
	ship.action = noAction();
}

function findColony(): PlanetEntry | undefined {
	return findPlanetEntry("Earth") ?? findPlanetEntry(state.bodyMeshes[0]?.data.name ?? "");
}

function dispatchCommand(ship: ShipEntry, result: CommandResult): void {
	switch (result.action) {
		case "survey": {
			const target = selectNextSurveyTarget(ship);
			if (target) {
				const te = findPlanetEntry(target);
				if (te && target !== ship.hostPlanetName) {
					ship.action = mkAction("survey-nearest", "survey", 0, 0, target);
					initiateTransfer(ship, te);
				} else if (te) {
					const dur = getSurveyDuration(te.data.type);
					ship.action = mkAction("survey-nearest", "survey", state.simTime, dur, target);
				}
			} else {
				addNotification("mission-complete", "System survey complete — all bodies surveyed");
				ship.action = noAction();
			}
			break;
		}
		case "transfer": {
			if (result.target) {
				const te = findPlanetEntry(result.target);
				if (te) initiateTransfer(ship, te);
			}
			ship.immediateCommand = null;
			break;
		}
		case "refuel": {
			const earth = findColony();
			if (earth && earth.data.name !== ship.hostPlanetName) {
				ship.action = mkAction("refuel", "refuel");
				initiateTransfer(ship, earth);
			} else {
				ship.fuelKg = ship.fuelCapacityKg;
				ship.action = noAction();
			}
			break;
		}
		case "shore-leave": {
			const colony = findColony();
			if (colony && colony.data.name !== ship.hostPlanetName) {
				ship.action = mkAction("shore-leave", "shore-leave");
				initiateTransfer(ship, colony);
			} else {
				ship.action = mkAction("shore-leave", "shore-leave", state.simTime, 30);
			}
			break;
		}
		case "overhaul": {
			const yard = findColony();
			if (yard && yard.data.name !== ship.hostPlanetName) {
				ship.action = mkAction("overhaul", "overhaul");
				initiateTransfer(ship, yard);
			} else {
				const dur = Math.max(10, ship.maintenance.age / 3);
				ship.action = mkAction("overhaul", "overhaul", state.simTime, dur);
			}
			break;
		}
		case "idle":
			ship.action = noAction();
			break;
	}
}

function completeAction(ship: ShipEntry): void {
	const actionType = ship.action.type;
	if (actionType === "survey-nearest") {
		completeSurvey(ship);
	} else if (actionType === "shore-leave") {
		ship.crew.lastShoreLeave = state.simTime;
		ship.crew.morale = 100;
		ship.action = noAction();
	} else if (actionType === "overhaul") {
		ship.maintenance.age = 0;
		ship.maintenance.hullIntegrity = 100;
		ship.maintenance.supplies = ship.maintenance.maxSupplies;
		ship.action = noAction();
	} else if (actionType === "refuel") {
		ship.fuelKg = ship.fuelCapacityKg;
		ship.action = noAction();
	}

	// Re-evaluate command tree for next action
	const result = evaluateCommandTree(ship);
	if (result) dispatchCommand(ship, result);
}

/** Called each frame for every ship. Handles simulation + action timers. */
function tickShip(ship: ShipEntry, simDt: number): void {
	tickShipSimulation(ship, simDt, state.simTime);

	// Check action timer (only while orbiting with active timed action)
	const hasActiveAction =
		ship.shipState === "orbiting" &&
		ship.action.type &&
		ship.action.startTime > 0 &&
		ship.action.duration > 0;
	if (hasActiveAction) {
		const elapsed = state.simTime - ship.action.startTime;
		// Apply morale + hull multiplier to effective speed
		const efficiency = (ship.crew.morale / 100) * (ship.maintenance.hullIntegrity / 100);
		const effectiveRate = Math.max(0.01, efficiency);
		ship.action.progress = Math.min(1, (elapsed * effectiveRate) / ship.action.duration);

		if (ship.action.progress >= 1) {
			completeAction(ship);
		}
	}
}

/** Called when a ship arrives at a planet after transfer. */
export function onTransferComplete(ship: ShipEntry): void {
	// If ship was en route for a specific action, start it at the destination
	const actionType = ship.action.type;
	if (actionType === "survey-nearest") {
		const hostBody = state.bodyMeshes.find((e) => e.data.name === ship.hostPlanetName);
		const bodyType = hostBody?.data.type ?? "Planet";
		const dur = getSurveyDuration(bodyType);
		ship.action.startTime = state.simTime;
		ship.action.duration = dur;
		ship.action.progress = 0;
	} else if (actionType === "refuel") {
		ship.fuelKg = ship.fuelCapacityKg;
		ship.action = { type: null, commandId: null, startTime: 0, duration: 0, progress: 0 };
		const result = evaluateCommandTree(ship);
		if (result) dispatchCommand(ship, result);
	} else if (actionType === "shore-leave") {
		ship.action.startTime = state.simTime;
		ship.action.duration = 30;
		ship.action.progress = 0;
	} else if (actionType === "overhaul") {
		const duration = Math.max(10, ship.maintenance.age / 3);
		ship.action.startTime = state.simTime;
		ship.action.duration = duration;
		ship.action.progress = 0;
	} else {
		// No pending action — evaluate command tree
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
			const ship = state.bodyMeshes.find((e) => e.isShip) as ShipEntry | undefined;
			if (ship) {
				const elapsed: number = state.simTime - ship.transferStartTime;
				const t: number = ship.transferTimeDays > 0 ? elapsed / ship.transferTimeDays : 0;
				console.log("DEBUG STEP PAUSED:", {
					simTime: state.simTime.toFixed(3),
					shipState: ship.shipState,
					t: t.toFixed(4),
					shipPos: `(${ship.mesh.position.x.toFixed(2)}, ${ship.mesh.position.z.toFixed(2)})`,
					hasBlend: !!ship.blendTarget,
				});
			}
		}
	}

	const _t0 = performance.now();
	// Tick ship simulation BEFORE position updates (morale, maintenance, action timers)
	if (simActive) {
		const simDt = dt * state.timeSpeed;
		for (const entry of state.bodyMeshes) {
			if (isShipEntry(entry)) tickShip(entry, simDt);
		}
	}
	if (simActive) updatePositions(dt, cachedCamDist);
	const _t1 = performance.now();
	if (simActive) updateAsteroids(dt);
	const _t2 = performance.now();
	updateFlyTo();
	updateFollow();
	controls.update();

	cachedCamDist = camera.position.distanceTo(controls.target);
	updateLabels(cachedCamDist);
	const _t3 = performance.now();
	if (state.selectedBody) updateInfoPosition();
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
	updatePerfDisplay(_perfTimings);

	// When paused with no camera animation, consume the dirty flag and stop
	state.renderNeeded = false;
	if (!simActive && !hasActiveCamera) {
		stopLoop();
	}
}

startLoop();
