import * as THREE from 'three';
import { state, MAX_CLICK_DIST } from '../core/state.js';
import { easeOutCubic } from '../math/visual.js';
import { camera, controls, ZOOM_BASE, renderer } from '../rendering/scene.js';
import { COMET_ORBIT_OPACITY, COMET_ORBIT_SELECTED_OPACITY, initiateTransfer } from '../rendering/rendering.js';

const ZOOM_DIST_RECENTER = ZOOM_BASE / 0.25;
const ZOOM_DIST_STAR = 75;
const ZOOM_DIST_PLANET = 38;
const ZOOM_DIST_MOON = 20;

const flyEndTarget = new THREE.Vector3();
const flyEndCam = new THREE.Vector3();
const clickVec = new THREE.Vector3();
const infoPositionEl = document.getElementById('info-position');

const INITIAL_CAM_DIR = new THREE.Vector3(0, ZOOM_BASE, 80).normalize();

function animateCameraTo(entry, zoomDist, overrideOffset) {
    const camOffset = overrideOffset || new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

    state.flyTo = {
        entry,
        camOffset,
        zoomDist,
        startCam: camera.position.clone(),
        startTarget: controls.target.clone(),
        startTime: performance.now() / 1000,
        duration: 0.6
    };
}

export function updateFlyTo() {
    if (!state.flyTo) return;
    const now = performance.now() / 1000;
    let t = (now - state.flyTo.startTime) / state.flyTo.duration;
    if (t >= 1) t = 1;

    const ease = easeOutCubic(t);

    const pos = state.flyTo.entry.mesh.position;
    flyEndTarget.set(pos.x, 0, pos.z);
    flyEndCam.copy(flyEndTarget).addScaledVector(state.flyTo.camOffset, state.flyTo.zoomDist);

    camera.position.lerpVectors(state.flyTo.startCam, flyEndCam, ease);
    controls.target.lerpVectors(state.flyTo.startTarget, flyEndTarget, ease);

    if (t >= 1) {
        state.flyTo = null;
    }
}

export function recenterOnStar() {
    const star = state.bodyMeshes.find(e => e.data.type === 'Star');
    if (!star) return;
    if (state.selectedBody) {
        state.selectedBody.selRing.material.opacity = 0;
        state.selectedBody = null;
    }
    document.getElementById('info-panel').classList.add('hidden');
    animateCameraTo(star, ZOOM_DIST_RECENTER, INITIAL_CAM_DIR);
}

export function selectBody(entry) {
    if (state.selectedBody) {
        state.selectedBody.selRing.material.opacity = 0;
        if (state.selectedBody.isComet && state.selectedBody.orbitLine) {
            state.selectedBody.orbitLine.material.opacity = COMET_ORBIT_OPACITY;
        }
    }

    state.selectedBody = entry;
    if (entry.isComet && entry.orbitLine) {
        entry.orbitLine.material.opacity = COMET_ORBIT_SELECTED_OPACITY;
    }
    const zoomDist = entry.data.type === 'Star' ? ZOOM_DIST_STAR :
                     entry.data.type === 'Moon' ? ZOOM_DIST_MOON : ZOOM_DIST_PLANET;
    animateCameraTo(entry, zoomDist);

    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');
    document.getElementById('info-title').textContent = entry.data.name;
    document.getElementById('info-type').textContent = entry.data.type;
    if (entry.isShip) {
        document.getElementById('info-distance').textContent =
            entry.shipState === 'transferring' ? `${entry.orbitA.toFixed(2)} AU (transfer)` : `${entry.data.distance} AU`;
        const statusText = entry.shipState === 'transferring'
            ? `Transfer → ${entry.transferTarget}`
            : entry.shipState === 'departing'
            ? `Departing ${entry.hostPlanetName}...`
            : `Orbiting ${entry.hostPlanetName}`;
        document.getElementById('info-period').textContent = statusText;
        document.getElementById('info-radius').textContent = '-';
        document.getElementById('info-moons').textContent = '-';
    } else if (entry.isComet) {
        document.getElementById('info-distance').textContent =
            `Perihelion: ${entry.data.distance.toFixed(2)} AU | e: ${entry.data.e}`;
        document.getElementById('info-period').textContent = entry.data.period > 0
            ? `${entry.data.period} years` : '-';
        document.getElementById('info-radius').textContent = `${entry.data.radius.toLocaleString()} km`;
        document.getElementById('info-moons').textContent = entry.data.moons
            ? entry.data.moons.length.toString() : '0';
    } else {
        document.getElementById('info-distance').textContent = entry.data.distance > 0
            ? `${entry.data.distance} AU` : 'Center';
        document.getElementById('info-period').textContent = entry.data.period > 0
            ? `${entry.data.period} years` : '-';
        document.getElementById('info-radius').textContent = `${entry.data.radius.toLocaleString()} km`;
        document.getElementById('info-moons').textContent = entry.data.moons
            ? entry.data.moons.length.toString() : '0';
    }

    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));
    const items = document.querySelectorAll('.body-list-item');
    items.forEach(el => {
        if (el.querySelector('.body-list-name')?.textContent === entry.data.name) {
            el.classList.add('selected');
        }
    });

    // Ship-specific UI
    const transferRow = document.getElementById('info-transfer');
    const sizeRow = document.getElementById('info-ship-size');
    if (entry.isShip) {
        transferRow.classList.remove('hidden');
        sizeRow.classList.remove('hidden');
        document.getElementById('ship-size-input').value = entry.screenSize;
        const select = document.getElementById('transfer-target');
        select.innerHTML = '';
        state.bodyMeshes
            .filter(e => e.data.type === 'Planet' || e.data.type === 'Dwarf Planet')
            .forEach(e => {
                const opt = document.createElement('option');
                opt.value = e.data.name;
                opt.textContent = e.data.name;
                select.appendChild(opt);
            });
    } else {
        transferRow.classList.add('hidden');
        sizeRow.classList.add('hidden');
    }
}

export function selectAsteroid(hit) {
    if (state.selectedBody) {
        state.selectedBody.selRing.material.opacity = 0;
        state.selectedBody = null;
    }
    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));

    const { belt, asteroid } = hit;
    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');
    document.getElementById('info-title').textContent = asteroid.designation;
    document.getElementById('info-type').textContent = `Asteroid (${belt.name})`;
    document.getElementById('info-distance').textContent = `${asteroid.au} AU`;
    document.getElementById('info-period').textContent = `${asteroid.period} years`;
    document.getElementById('info-radius').textContent = `~${asteroid.diameter} km dia.`;
    document.getElementById('info-moons').textContent = '0';
    infoPositionEl.textContent = '-';
}

export function updateFollow() {
    if (!state.selectedBody || state.flyTo) return;
    const pos = state.selectedBody.mesh.position;
    const dx = pos.x - controls.target.x;
    const dz = pos.z - controls.target.z;
    controls.target.x += dx;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
}

export function updateInfoPosition() {
    if (state.selectedBody) {
        const pos = state.selectedBody.mesh.position;
        infoPositionEl.textContent = `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

export function setupClickHandlers() {
    renderer.domElement.addEventListener('click', (event) => {
        const mx = event.clientX;
        const my = event.clientY;

        let closest = null;
        let closestDist = Infinity;
        let closestAsteroid = null;

        state.bodyMeshes.forEach(entry => {
            clickVec.copy(entry.mesh.position);
            clickVec.project(camera);
            if (clickVec.z > 1) return;

            const sx = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
            const sy = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
            const dist = Math.hypot(mx - sx, my - sy);

            if (dist < closestDist) {
                closestDist = dist;
                closest = entry;
                closestAsteroid = null;
            }
        });

        const asteroidClickDist = 20;
        state.asteroidBelts.forEach(beltEntry => {
            const { positions, asteroids, count } = beltEntry;
            for (let i = 0; i < count; i++) {
                clickVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                clickVec.project(camera);
                if (clickVec.z > 1) continue;

                const sx = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
                const sy = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
                const dist = Math.hypot(mx - sx, my - sy);

                if (dist < closestDist && dist < asteroidClickDist) {
                    closestDist = dist;
                    closest = null;
                    closestAsteroid = { belt: beltEntry.belt, asteroid: asteroids[i], index: i };
                }
            }
        });

        if (closestAsteroid && closestDist < asteroidClickDist) {
            selectAsteroid(closestAsteroid);
        } else if (closest && closestDist < MAX_CLICK_DIST) {
            selectBody(closest);
        }
    });

    document.getElementById('ship-size-input').addEventListener('input', (e) => {
        if (!state.selectedBody || !state.selectedBody.isShip) return;
        const size = parseFloat(e.target.value);
        if (!size || size <= 0) return;
        const s = size / state.selectedBody.baseSize;
        state.selectedBody.mesh.scale.set(s, s, s);
        state.selectedBody.screenSize = size;
    });

    document.getElementById('btn-transfer').addEventListener('click', () => {
        if (!state.selectedBody || !state.selectedBody.isShip) return;
        const targetName = document.getElementById('transfer-target').value;
        const targetEntry = state.bodyMeshes.find(e => e.data.name === targetName);
        if (targetEntry) initiateTransfer(state.selectedBody, targetEntry);
    });

    document.getElementById('info-close').addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
        if (state.selectedBody) {
            state.selectedBody.selRing.material.opacity = 0;
            if (state.selectedBody.isComet && state.selectedBody.orbitLine) {
                state.selectedBody.orbitLine.material.opacity = COMET_ORBIT_OPACITY;
            }
            state.selectedBody = null;
        }
    });
}
