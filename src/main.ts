import "./style.css";
import * as THREE from "three";
import { loadSavedState, MASTER_SEED, restoreShipState, saveState, state } from "./core/state";
import { seededRandom } from "./core/utils";
import { getSolSystem } from "./data/sol-data";
import { generateSystem } from "./data/system-generator";
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
import type { BodyEntry, PlanetEntry, SavedStateData, ShipEntry, SystemData } from "./types";
import { isShipEntry } from "./types";
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
