import * as THREE from 'three';
import { state, simTimeToDate, speedLabel } from './state.js';
import { MOON_LOD_ZOOM, screenRadius as calcScreenRadius, lodLevel, bodyScaleFactor } from './visual.js';
import { camera, controls, gridGroup } from './scene.js';
import { selectBody } from './selection.js';
import { generateSystem } from './system-generator.js';

// --- Body list panel ---

const bodyListEl = document.getElementById('body-list');

export function buildBodyList() {
    bodyListEl.innerHTML = '';

    const groups = {};
    const groupOrder = ['Star', 'Planet', 'Dwarf Planet', 'Detached Object', 'Comet'];
    state.bodyMeshes.forEach(entry => {
        if (entry.isMoon) return;
        const type = entry.data.type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(entry);
    });

    const groupLabels = {
        'Star': 'Stars',
        'Planet': 'Planets',
        'Dwarf Planet': 'Dwarf Planets',
        'Detached Object': 'Detached Objects',
        'Comet': 'Comets'
    };

    groupOrder.forEach(type => {
        const entries = groups[type];
        if (!entries || entries.length === 0) return;

        const section = document.createElement('div');
        section.className = 'body-group';

        const header = document.createElement('div');
        header.className = 'body-group-header';
        header.innerHTML = `<span class="body-group-toggle">[-]</span> ${groupLabels[type] || type} <span class="body-group-count">(${entries.length})</span>`;
        section.appendChild(header);

        const list = document.createElement('div');
        list.className = 'body-group-list';
        section.appendChild(list);

        header.addEventListener('click', () => {
            const collapsed = list.style.display === 'none';
            list.style.display = collapsed ? '' : 'none';
            header.querySelector('.body-group-toggle').textContent = collapsed ? '[-]' : '[+]';
        });

        entries.forEach(entry => {
            const hasMoons = entry.moons && entry.moons.length > 0;
            const item = document.createElement('div');
            item.className = 'body-list-item';
            const toggleSpan = hasMoons ? `<span class="moon-toggle">[+]</span>` : '';
            item.innerHTML = `<span class="body-color-dot" style="background:${entry.data.color}"></span>
                <span class="body-list-name">${entry.data.name}</span>${toggleSpan}`;
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('moon-toggle')) {
                    const moonList = item.nextElementSibling;
                    if (moonList && moonList.classList.contains('moon-sublist')) {
                        const collapsed = moonList.style.display === 'none';
                        moonList.style.display = collapsed ? '' : 'none';
                        e.target.textContent = collapsed ? '[-]' : '[+]';
                    }
                    return;
                }
                selectBody(entry);
            });
            list.appendChild(item);

            if (hasMoons) {
                const moonList = document.createElement('div');
                moonList.className = 'moon-sublist';
                moonList.style.display = 'none';
                entry.moons.forEach(moon => {
                    const mItem = document.createElement('div');
                    mItem.className = 'body-list-item moon';
                    mItem.innerHTML = `<span class="body-color-dot" style="background:${moon.data.color}"></span>
                        <span class="body-list-name">${moon.data.name}</span>`;
                    mItem.addEventListener('click', () => selectBody(moon));
                    moonList.appendChild(mItem);
                });
                list.appendChild(moonList);
            }
        });

        bodyListEl.appendChild(section);
    });
}

// --- System switcher ---

export function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & 0x7fffffff;
    }
    return hash || 1;
}

function rebuildSystemList() {
    const list = document.getElementById('system-list');
    if (!list) return;
    list.innerHTML = '';
    state.discoveredSystems.forEach((sys, key) => {
        const item = document.createElement('div');
        item.className = 'system-list-item' + (key === state.currentSystemKey ? ' active' : '');
        item.textContent = sys.name;
        item.addEventListener('click', () => switchToSystem(key));
        list.appendChild(item);
    });
}

// loadSystem is passed in from main via setupUI
let _loadSystem = null;

function switchToSystem(key) {
    if (key === state.currentSystemKey) return;
    const sys = state.discoveredSystems.get(key);
    if (!sys) return;
    state.currentSystemKey = key;
    if (_loadSystem) _loadSystem(sys.systemData);
    rebuildSystemList();
}

function discoverSystem(seed) {
    const key = `seed-${seed}`;
    if (!state.discoveredSystems.has(key)) {
        const systemData = generateSystem(seed);
        state.discoveredSystems.set(key, { name: systemData.name, seed, systemData });
    }
    switchToSystem(key);
}

// --- Labels ---

const tempVec = new THREE.Vector3();
const edgeVec = new THREE.Vector3();

export function updateLabels() {
    const showLabels = state.showLabels;
    const showOrbits = state.showOrbits;
    const camDist = camera.position.distanceTo(controls.target);
    const zoomFactor = 120 / camDist;

    state.bodyMeshes.forEach(entry => {
        if (entry.isMoon && entry.parentMesh) {
            const visible = zoomFactor > MOON_LOD_ZOOM;
            entry.mesh.visible = visible;
            if (entry.orbitLine) entry.orbitLine.visible = visible && showOrbits;
            if (!visible) {
                entry.labelDiv.style.display = 'none';
                return;
            }
        }

        if (!entry.isMoon && !entry.isComet && entry.baseSize) {
            const t = bodyScaleFactor(zoomFactor);
            const scaledSize = entry.baseSize + t * (entry.realisticSize - entry.baseSize);
            const s = scaledSize / entry.baseSize;
            entry.mesh.scale.set(s, s, s);
            entry.screenSize = scaledSize;
        }

        tempVec.copy(entry.mesh.position);
        tempVec.project(camera);

        if (tempVec.z > 1) {
            entry.labelDiv.style.display = 'none';
            return;
        }

        const cx = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
        const cy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

        const radius = entry.screenSize || 0.3;
        const dist = edgeVec.copy(entry.mesh.position).sub(camera.position).length();
        const sr = calcScreenRadius(radius, dist, camera.fov, window.innerHeight);

        // LOD: swap sphere geometry based on screen size
        if (entry.geomLevels) {
            const level = lodLevel(sr);
            if (level !== entry.lodLevel) {
                entry.mesh.geometry = entry.geomLevels[level];
                entry.lodLevel = level;
            }
        }

        if (entry.planetRing) {
            entry.planetRing.visible = sr > 15;
        }

        const gap = 6;
        entry.labelDiv.style.transform = `translate(${cx + sr + gap}px, ${cy - 6}px)`;
        entry.labelDiv.style.display = showLabels ? '' : 'none';
    });
}

// --- HUD ---

const fpsEl = document.getElementById('fps-display');
const timeEl = document.getElementById('time-display');
const zoomEl = document.getElementById('zoom-display');
let fpsFrames = 0;
let fpsLastTime = performance.now();
let fpsValue = 0;
let lastTimeText = '';
let lastZoomText = '';

export function updateHUD() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 500) {
        fpsValue = Math.round(fpsFrames / ((now - fpsLastTime) / 1000));
        fpsFrames = 0;
        fpsLastTime = now;
        fpsEl.textContent = `FPS: ${fpsValue}`;
    }

    const d = simTimeToDate(state.simTime);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timeText = `${dateStr} | ${speedLabel(state.timeSpeed)}`;
    if (timeText !== lastTimeText) {
        timeEl.textContent = timeText;
        lastTimeText = timeText;
    }

    const dist = camera.position.distanceTo(controls.target);
    const zoomText = `Zoom: ${(120 / dist).toFixed(2)}x`;
    if (zoomText !== lastZoomText) {
        zoomEl.textContent = zoomText;
        lastZoomText = zoomText;
    }
}

// --- Setup all UI event listeners ---

export function setupUI(loadSystem) {
    _loadSystem = loadSystem;

    // System switcher
    document.getElementById('system-switcher-btn').addEventListener('click', () => {
        const dropdown = document.getElementById('system-switcher-dropdown');
        dropdown.classList.toggle('hidden');
        if (!dropdown.classList.contains('hidden')) rebuildSystemList();
    });

    document.getElementById('btn-discover').addEventListener('click', () => {
        const seedStr = document.getElementById('seed-input').value.trim();
        if (!seedStr) return;
        discoverSystem(hashString(seedStr));
        document.getElementById('seed-input').value = '';
        document.getElementById('system-switcher-dropdown').classList.add('hidden');
    });

    document.getElementById('btn-random').addEventListener('click', () => {
        const seed = Math.floor(Math.random() * 2147483646) + 1;
        discoverSystem(seed);
        document.getElementById('system-switcher-dropdown').classList.add('hidden');
    });

    document.getElementById('seed-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('btn-discover').click();
    });

    // Time controls
    const speedMap = { pause: 0, slow: 1, normal: 6, fast: 30 };
    ['pause', 'slow', 'normal', 'fast'].forEach(mode => {
        document.getElementById(`btn-${mode}`).addEventListener('click', () => {
            state.timeSpeed = speedMap[mode];
            document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`btn-${mode}`).classList.add('active');
        });
    });

    // Display toggles
    document.getElementById('toggle-orbits').addEventListener('change', (e) => {
        state.showOrbits = e.target.checked;
        state.bodyMeshes.forEach(b => { if (b.orbitLine) b.orbitLine.visible = e.target.checked; });
    });

    document.getElementById('toggle-labels').addEventListener('change', (e) => {
        state.showLabels = e.target.checked;
        state.bodyMeshes.forEach(b => { b.labelDiv.style.display = e.target.checked ? '' : 'none'; });
    });

    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        gridGroup.visible = e.target.checked;
    });

    document.getElementById('toggle-trails').addEventListener('change', (e) => {
        state.showTrails = e.target.checked;
        state.bodyMeshes.forEach(b => { b.trail.line.visible = e.target.checked; });
    });
}
