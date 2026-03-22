import * as THREE from 'three';
import { state, MASTER_SEED, saveState, loadSavedState } from './state.js';
import { seededRandom } from './utils.js';
import { scene, camera, renderer, controls, trailGroups, cometGroup } from './scene.js';
import { createBodies, createComets, createShip, createAsteroidBelts, updateAsteroids, updatePositions, sharedResources } from './rendering.js';
import { setupClickHandlers, updateFlyTo, updateFollow, updateInfoPosition, selectBody } from './selection.js';
import { buildBodyList, setupUI, updateLabels, updateHUD } from './ui.js';
import { getSolSystem } from './sol-data.js';
import { generateSystem } from './system-generator.js';

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------
let starEntry = null;

function cacheStarEntry() {
    starEntry = state.bodyMeshes.find(e => e.data.type === 'Star') || null;
}

state.masterRng = seededRandom(MASTER_SEED);

const sol = getSolSystem();
state.discoveredSystems.set('sol', { name: 'Sol System', seed: null, systemData: sol });

// Restore saved state if available
const saved = loadSavedState();
if (saved) {
    // Advance masterRng to match previous random discovery count
    for (let i = 0; i < saved.randomClickCount; i++) state.masterRng();
    state.randomClickCount = saved.randomClickCount;

    // Regenerate discovered systems from saved seeds
    saved.discoveredSystems.forEach(({ key, name, seed }) => {
        const systemData = generateSystem(seed);
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
        document.querySelector('.system-name').textContent = active.systemData.name + ' \u25be';
        document.title = `System Map - ${active.systemData.name}`;
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
state.asteroidBelts = createAsteroidBelts();
buildBodyList();
cacheStarEntry();

// Select ship by default
const shipEntry = state.bodyMeshes.find(e => e.isShip);
if (shipEntry) selectBody(shipEntry);

// Auto-save on page unload
window.addEventListener('beforeunload', saveState);

// ---------------------------------------------------------------------------
// Teardown & load system
// ---------------------------------------------------------------------------
function safeDispose(resource) {
    if (!sharedResources.has(resource)) resource.dispose();
}

function teardownSystem() {
    state.bodyMeshes.forEach(entry => {
        scene.remove(entry.mesh);
        if (entry.geomLevels) {
            entry.geomLevels.forEach(g => safeDispose(g));
        } else {
            safeDispose(entry.mesh.geometry);
        }
        if (entry.mesh.material.map) entry.mesh.material.map.dispose();
        safeDispose(entry.mesh.material);
        entry.mesh.children.forEach(child => {
            if (child !== entry.selRing) {
                child.geometry.dispose();
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        if (entry.selRing) {
            safeDispose(entry.selRing.geometry);
            safeDispose(entry.selRing.material);
        }
        if (entry.orbitLine) {
            scene.remove(entry.orbitLine);
            safeDispose(entry.orbitLine.geometry);
            safeDispose(entry.orbitLine.material);
        }
        if (entry.labelDiv) entry.labelDiv.remove();
        if (entry.trail) {
            trailGroups.remove(entry.trail.line);
            entry.trail.line.geometry.dispose();
            entry.trail.line.material.dispose();
        }
        if (entry.tailLine) {
            scene.remove(entry.tailLine);
            entry.tailLine.geometry.dispose();
        }
        if (entry.transferPath) {
            scene.remove(entry.transferPath);
            entry.transferPath.geometry.dispose();
        }
    });
    state.bodyMeshes.length = 0;

    state.asteroidBelts.forEach(ab => {
        scene.remove(ab.points);
        ab.points.geometry.dispose();
        ab.points.material.dispose();
    });
    state.asteroidBelts = [];

    while (cometGroup.children.length > 0) {
        const child = cometGroup.children[0];
        cometGroup.remove(child);
        safeDispose(child.geometry);
        safeDispose(child.material);
    }

    state.selectedBody = null;
    state.flyTo = null;
    document.getElementById('info-panel').classList.add('hidden');
}

function loadSystem(systemData) {
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
    document.querySelector('.system-name').textContent = systemData.name + ' ▾';
    document.title = `System Map - ${systemData.name}`;
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

function animate() {
    requestAnimationFrame(animate);
    timer.update();
    const dt = timer.getDelta();

    updatePositions(dt, camera.position.distanceTo(controls.target));
    updateAsteroids(dt);
    updateFlyTo();
    updateFollow();
    controls.update();

    const camDist = camera.position.distanceTo(controls.target);
    updateLabels(camDist);
    if (state.selectedBody) updateInfoPosition();
    updateHUD(camDist);

    if (starEntry && starEntry.mesh.material.uniforms) {
        starEntry.mesh.material.uniforms.uTime.value = timer.getElapsed();
    }

    renderer.render(scene, camera);
}

animate();
