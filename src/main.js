import './style.css';
import * as THREE from 'three';
import { state, MASTER_SEED, saveState, loadSavedState, restoreShipState } from './core/state.js';
import { seededRandom } from './core/utils.js';
import { scene, camera, renderer, controls, trailGroups, cometGroup } from './rendering/scene.js';
import { createBodies, createComets, createShip, createAsteroidBelts, updateAsteroids, updatePositions, sharedResources } from './rendering/rendering.js';
import { setupClickHandlers, updateFlyTo, updateFollow, updateInfoPosition, selectBody } from './ui/selection.js';
import { buildBodyList, setupUI, updateLabels, updateHUD } from './ui/ui.js';
import { getSolSystem } from './data/sol-data.js';
import { generateSystem } from './data/system-generator.js';

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

function animate() {
    requestAnimationFrame(animate);
    timer.update();
    const dt = timer.getDelta();

    // Debug step-through: count down frames then pause
    if (state.debugStepFrames > 0) {
        state.debugStepFrames--;
        if (state.debugStepFrames === 0) {
            state.timeSpeed = 0;
            window.dispatchEvent(new Event('debug-step-done'));
            const ship = state.bodyMeshes.find(e => e.isShip);
            if (ship) {
                const elapsed = state.simTime - ship.transferStartTime;
                const t = ship.transferTimeDays > 0 ? elapsed / ship.transferTimeDays : 0;
                console.log('DEBUG STEP PAUSED:', {
                    simTime: state.simTime.toFixed(3),
                    shipState: ship.shipState,
                    t: t.toFixed(4),
                    shipPos: `(${ship.mesh.position.x.toFixed(2)}, ${ship.mesh.position.z.toFixed(2)})`,
                    hasBlend: !!ship.blendTarget,
                });
            }
        }
    }

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
