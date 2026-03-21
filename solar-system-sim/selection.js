import * as THREE from 'three';
import { state, MAX_CLICK_DIST } from './state.js';
import { camera, controls, renderer } from './scene.js';

function animateCameraTo(entry, zoomDist) {
    const camOffset = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

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

    const ease = 1 - Math.pow(1 - t, 3);

    const pos = state.flyTo.entry.mesh.position;
    const endTarget = new THREE.Vector3(pos.x, 0, pos.z);
    const endCam = new THREE.Vector3().copy(endTarget).addScaledVector(state.flyTo.camOffset, state.flyTo.zoomDist);

    camera.position.lerpVectors(state.flyTo.startCam, endCam, ease);
    controls.target.lerpVectors(state.flyTo.startTarget, endTarget, ease);

    if (t >= 1) {
        state.flyTo = null;
    }
}

export function selectBody(entry) {
    if (state.selectedBody) {
        state.selectedBody.selRing.material.opacity = 0;
        if (state.selectedBody.isComet && state.selectedBody.orbitLine) {
            state.selectedBody.orbitLine.material.opacity = 0.03;
        }
    }

    state.selectedBody = entry;
    if (entry.isComet && entry.orbitLine) {
        entry.orbitLine.material.opacity = 0.05;
    }
    const zoomDist = entry.data.type === 'Star' ? 30 :
                     entry.data.type === 'Moon' ? 8 : 15;
    animateCameraTo(entry, zoomDist);

    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');
    document.getElementById('info-title').textContent = entry.data.name;
    document.getElementById('info-type').textContent = entry.data.type;
    if (entry.isComet) {
        document.getElementById('info-distance').textContent =
            `Perihelion: ${entry.data.distance.toFixed(2)} AU | e: ${entry.data.e}`;
    } else {
        document.getElementById('info-distance').textContent = entry.data.distance > 0
            ? `${entry.data.distance} AU` : 'Center';
    }
    document.getElementById('info-period').textContent = entry.data.period > 0
        ? `${entry.data.period} years` : '-';
    document.getElementById('info-radius').textContent = `${entry.data.radius.toLocaleString()} km`;
    document.getElementById('info-moons').textContent = entry.data.moons
        ? entry.data.moons.length.toString() : '0';

    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));
    const items = document.querySelectorAll('.body-list-item');
    items.forEach(el => {
        if (el.querySelector('.body-list-name')?.textContent === entry.data.name) {
            el.classList.add('selected');
        }
    });
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
    document.getElementById('info-position').textContent = '-';
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
        document.getElementById('info-position').textContent =
            `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

const clickVec = new THREE.Vector3();

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

    document.getElementById('info-close').addEventListener('click', () => {
        document.getElementById('info-panel').classList.add('hidden');
        if (state.selectedBody) {
            state.selectedBody.selRing.material.opacity = 0;
            if (state.selectedBody.isComet && state.selectedBody.orbitLine) {
                state.selectedBody.orbitLine.material.opacity = 0.03;
            }
            state.selectedBody = null;
        }
    });
}
