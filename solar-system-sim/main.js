import * as THREE from 'three';
import { state } from './state.js';
import { scene, camera, renderer, controls, trailGroups, cometGroup } from './scene.js';
import { createBodies, createComets, createAsteroidBelts, updateAsteroids, updatePositions, sharedResources } from './rendering.js';
import { setupClickHandlers, updateFlyTo, updateFollow, updateInfoPosition } from './selection.js';
import { buildBodyList, setupUI, updateLabels, updateHUD } from './ui.js';
import { getSolSystem } from './sol-data.js';

// ---------------------------------------------------------------------------
// Initialize with Sol
// ---------------------------------------------------------------------------
const sol = getSolSystem();
state.discoveredSystems.set('sol', { name: 'Sol System', seed: null, systemData: sol });
state.BODIES = sol.bodies;
state.COMETS = sol.comets;
state.ASTEROID_BELTS = sol.asteroidBelts;

createBodies();
createComets();
state.asteroidBelts = createAsteroidBelts();
buildBodyList();

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
        safeDispose(entry.mesh.material);
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
    state.asteroidBelts = createAsteroidBelts();
    buildBodyList();
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
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    controls.update();
    updateFlyTo();
    updatePositions(dt);
    updateAsteroids(dt);
    updateFollow();
    updateLabels();
    updateInfoPosition();
    updateHUD();

    renderer.render(scene, camera);
}

animate();
