import * as THREE from 'three';
import type { BodyEntry, PlanetEntry, AsteroidBeltData, AsteroidInfo, FlyToState } from '../types';
import { isShipEntry, isCometEntry } from '../types';
import { state, MAX_CLICK_DIST } from '../core/state';
import { easeOutCubic } from '../math/visual';
import { camera, controls, ZOOM_BASE, renderer } from '../rendering/scene';
import { COMET_ORBIT_OPACITY, COMET_ORBIT_SELECTED_OPACITY, initiateTransfer } from '../rendering/rendering';
import { ENGINE_TYPES, brachistochroneDeltaV, brachistochroneTime, G_ACCEL, rocketDeltaV, exhaustVelocity } from '../math/ship-physics';

const ZOOM_DIST_RECENTER: number = ZOOM_BASE / 0.25;
const ZOOM_DIST_STAR: number = 75;
const ZOOM_DIST_PLANET: number = 38;
const ZOOM_DIST_MOON: number = 20;

const flyEndTarget: THREE.Vector3 = new THREE.Vector3();
const flyEndCam: THREE.Vector3 = new THREE.Vector3();
const clickVec: THREE.Vector3 = new THREE.Vector3();
const infoPositionEl: HTMLElement | null = document.getElementById('info-position');

const INITIAL_CAM_DIR: THREE.Vector3 = new THREE.Vector3(0, ZOOM_BASE, 80).normalize();

let lastInfoPosText = '';

function animateCameraTo(entry: BodyEntry, zoomDist: number, overrideOffset?: THREE.Vector3): void {
    const camOffset: THREE.Vector3 = overrideOffset || new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

    state.flyTo = {
        entry,
        camOffset,
        zoomDist,
        startCam: camera.position.clone(),
        startTarget: controls.target.clone(),
        startTime: performance.now() / 1000,
        duration: 0.6
    } as FlyToState;
}

export function updateFlyTo(): void {
    if (!state.flyTo) return;
    const now: number = performance.now() / 1000;
    let t: number = (now - state.flyTo.startTime) / state.flyTo.duration;
    if (t >= 1) t = 1;

    const ease: number = easeOutCubic(t);

    const pos: THREE.Vector3 = state.flyTo.entry.mesh.position;
    flyEndTarget.set(pos.x, 0, pos.z);
    flyEndCam.copy(flyEndTarget).addScaledVector(state.flyTo.camOffset, state.flyTo.zoomDist);

    camera.position.lerpVectors(state.flyTo.startCam, flyEndCam, ease);
    controls.target.lerpVectors(state.flyTo.startTarget, flyEndTarget, ease);

    if (t >= 1) {
        state.flyTo = null;
    }
}

export function recenterOnStar(): void {
    const star: BodyEntry | undefined = state.bodyMeshes.find(e => e.data.type === 'Star');
    if (!star) return;
    if (state.selectedBody) {
        (state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
        state.selectedBody = null;
    }
    document.getElementById('info-panel')!.classList.add('hidden');
    animateCameraTo(star, ZOOM_DIST_RECENTER, INITIAL_CAM_DIR);
}

export function selectBody(entry: BodyEntry): void {
    if (state.selectedBody) {
        (state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
        if (isCometEntry(state.selectedBody) && state.selectedBody.orbitLine) {
            (state.selectedBody.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_OPACITY;
        }
    }

    state.selectedBody = entry;
    if (isCometEntry(entry) && entry.orbitLine) {
        (entry.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_SELECTED_OPACITY;
    }
    const zoomDist: number = entry.data.type === 'Star' ? ZOOM_DIST_STAR :
                     entry.data.type === 'Moon' ? ZOOM_DIST_MOON : ZOOM_DIST_PLANET;
    animateCameraTo(entry, zoomDist);

    const panel: HTMLElement = document.getElementById('info-panel')!;
    panel.classList.remove('hidden');
    document.getElementById('info-title')!.textContent = entry.data.name;
    document.getElementById('info-type')!.textContent = entry.data.type;
    if (isShipEntry(entry)) {
        document.getElementById('info-distance')!.textContent =
            entry.shipState === 'transferring' ? `${entry.orbitA.toFixed(2)} AU (transfer)` : `${entry.data.distance} AU`;
        const statusText: string = entry.shipState === 'transferring'
            ? `Transfer → ${entry.transferTarget}`
            : entry.shipState === 'departing'
            ? `Departing ${entry.hostPlanetName}...`
            : `Orbiting ${entry.hostPlanetName}`;
        document.getElementById('info-period')!.textContent = statusText;
        document.getElementById('info-radius')!.textContent = '-';
        document.getElementById('info-moons')!.textContent = '-';
    } else if (isCometEntry(entry)) {
        document.getElementById('info-distance')!.textContent =
            `Perihelion: ${entry.data.distance.toFixed(2)} AU | e: ${entry.data.e}`;
        document.getElementById('info-period')!.textContent = entry.data.period > 0
            ? `${entry.data.period} years` : '-';
        document.getElementById('info-radius')!.textContent = `${entry.data.radius.toLocaleString()} km`;
        document.getElementById('info-moons')!.textContent = entry.data.moons
            ? entry.data.moons.length.toString() : '0';
    } else {
        document.getElementById('info-distance')!.textContent = entry.data.distance > 0
            ? `${entry.data.distance} AU` : 'Center';
        document.getElementById('info-period')!.textContent = entry.data.period > 0
            ? `${entry.data.period} years` : '-';
        document.getElementById('info-radius')!.textContent = `${entry.data.radius.toLocaleString()} km`;
        document.getElementById('info-moons')!.textContent = entry.data.moons
            ? entry.data.moons.length.toString() : '0';
    }

    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));
    const items: NodeListOf<Element> = document.querySelectorAll('.body-list-item');
    items.forEach(el => {
        if (el.querySelector('.body-list-name')?.textContent === entry.data.name) {
            el.classList.add('selected');
        }
    });

    // Ship-specific UI
    const transferRow: HTMLElement = document.getElementById('info-transfer')!;
    const engineRow: HTMLElement = document.getElementById('info-ship-engine')!;
    const fuelRow: HTMLElement = document.getElementById('info-ship-fuel')!;
    const deltaVRow: HTMLElement = document.getElementById('info-ship-deltav')!;
    if (isShipEntry(entry)) {
        transferRow.classList.remove('hidden');
        engineRow.classList.remove('hidden');
        fuelRow.classList.remove('hidden');
        deltaVRow.classList.remove('hidden');

        // Engine info
        const engine = ENGINE_TYPES.find(e => e.id === entry.engineId);
        document.getElementById('ship-engine-value')!.textContent = engine ? engine.name : entry.engineId;

        // Fuel info
        const fuelPct: number = entry.fuelCapacityKg > 0 ? Math.round(entry.fuelKg / entry.fuelCapacityKg * 100) : 0;
        document.getElementById('ship-fuel-value')!.textContent =
            `${(entry.fuelKg / 1000).toFixed(2)}t / ${(entry.fuelCapacityKg / 1000).toFixed(2)}t (${fuelPct}%)`;

        // Delta-v budget
        const veKmS: number = engine ? exhaustVelocity(engine.ispS) / 1000 : 0;
        const dvBudget: number = rocketDeltaV(veKmS, entry.dryMassKg + entry.fuelKg, entry.dryMassKg);
        document.getElementById('ship-deltav-value')!.textContent = `${dvBudget.toFixed(2)} km/s`;

        // Transfer dropdown with delta-v costs
        const select: HTMLSelectElement = document.getElementById('transfer-target') as HTMLSelectElement;
        select.innerHTML = '';
        const hostEntry = state.bodyMeshes.find(e => e.data.name === entry.hostPlanetName && !e.isMoon && !isShipEntry(e));
        const r1: number = hostEntry ? hostEntry.data.distance : entry.data.distance;
        const accelMS2: number = engine ? engine.accelG * G_ACCEL : 0;
        state.bodyMeshes
            .filter(e => e.data.type === 'Planet' || e.data.type === 'Dwarf Planet')
            .forEach(e => {
                const opt: HTMLOptionElement = document.createElement('option');
                opt.value = e.data.name;
                if (e.data.distance !== r1 && accelMS2 > 0) {
                    const dv: number = brachistochroneDeltaV(r1, e.data.distance, accelMS2);
                    const days: number = brachistochroneTime(r1, e.data.distance, accelMS2);
                    const timeStr: string = days < 1 ? `${Math.round(days * 24)}h` : `${days.toFixed(1)}d`;
                    opt.textContent = `${e.data.name} (${Math.round(dv)} km/s, ${timeStr})`;
                } else {
                    opt.textContent = `${e.data.name} (here)`;
                }
                select.appendChild(opt);
            });
    } else {
        transferRow.classList.add('hidden');
        engineRow.classList.add('hidden');
        fuelRow.classList.add('hidden');
        deltaVRow.classList.add('hidden');
    }
}

export function selectAsteroid(hit: { belt: AsteroidBeltData; asteroid: AsteroidInfo; index: number }): void {
    if (state.selectedBody) {
        (state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
        state.selectedBody = null;
    }
    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));

    const { belt, asteroid } = hit;
    const panel: HTMLElement = document.getElementById('info-panel')!;
    panel.classList.remove('hidden');
    document.getElementById('info-title')!.textContent = asteroid.designation;
    document.getElementById('info-type')!.textContent = `Asteroid (${belt.name})`;
    document.getElementById('info-distance')!.textContent = `${asteroid.au} AU`;
    document.getElementById('info-period')!.textContent = `${asteroid.period} years`;
    document.getElementById('info-radius')!.textContent = `~${asteroid.diameter} km dia.`;
    document.getElementById('info-moons')!.textContent = '0';
    if (infoPositionEl) infoPositionEl.textContent = '-';
}

export function updateFollow(): void {
    if (!state.selectedBody || state.flyTo) return;
    const pos: THREE.Vector3 = state.selectedBody.mesh.position;
    const dx: number = pos.x - controls.target.x;
    const dz: number = pos.z - controls.target.z;
    controls.target.x += dx;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
}

export function updateInfoPosition(): void {
    if (state.selectedBody) {
        const pos: THREE.Vector3 = state.selectedBody.mesh.position;
        const text = `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
        if (infoPositionEl && text !== lastInfoPosText) {
            infoPositionEl.textContent = text;
            lastInfoPosText = text;
        }
    }
}

export function setupClickHandlers(): void {
    renderer.domElement.addEventListener('click', (event: MouseEvent) => {
        const mx: number = event.clientX;
        const my: number = event.clientY;

        let closest: BodyEntry | null = null;
        let closestDist: number = Infinity;
        let closestAsteroid: { belt: AsteroidBeltData; asteroid: AsteroidInfo; index: number } | null = null;

        state.bodyMeshes.forEach(entry => {
            clickVec.copy(entry.mesh.position);
            clickVec.project(camera);
            if (clickVec.z > 1) return;

            const sx: number = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
            const sy: number = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
            const dist: number = Math.hypot(mx - sx, my - sy);

            if (dist < closestDist) {
                closestDist = dist;
                closest = entry;
                closestAsteroid = null;
            }
        });

        const asteroidClickDist: number = 20;
        state.asteroidBelts.forEach(beltEntry => {
            const { positions, asteroids, count } = beltEntry;
            for (let i = 0; i < count; i++) {
                clickVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
                clickVec.project(camera);
                if (clickVec.z > 1) continue;

                const sx: number = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
                const sy: number = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
                const dist: number = Math.hypot(mx - sx, my - sy);

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

    document.getElementById('btn-transfer')!.addEventListener('click', () => {
        if (!state.selectedBody || !isShipEntry(state.selectedBody)) return;
        const targetName: string = (document.getElementById('transfer-target') as HTMLSelectElement).value;
        const targetEntry = state.bodyMeshes.find(e => e.data.name === targetName);
        if (targetEntry) initiateTransfer(state.selectedBody, targetEntry as PlanetEntry);
    });

    document.getElementById('info-close')!.addEventListener('click', () => {
        document.getElementById('info-panel')!.classList.add('hidden');
        if (state.selectedBody) {
            (state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
            if (isCometEntry(state.selectedBody) && state.selectedBody.orbitLine) {
                (state.selectedBody.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_OPACITY;
            }
            state.selectedBody = null;
        }
    });
}
