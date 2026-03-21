import * as THREE from 'three';
import { state, MOON_LOD_ZOOM } from './state.js';
import { camera, gridGroup } from './scene.js';
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

function hashString(str) {
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
const labelsVisible = () => document.getElementById('toggle-labels').checked;

export function updateLabels() {
    const showLabels = labelsVisible();
    state.bodyMeshes.forEach(entry => {
        if (entry.isMoon && entry.parentMesh) {
            const zoomFactor = 120 / camera.position.length();
            const visible = zoomFactor > MOON_LOD_ZOOM;
            entry.mesh.visible = visible;
            if (entry.orbitLine) entry.orbitLine.visible = visible && document.getElementById('toggle-orbits').checked;
            if (!visible) {
                entry.labelDiv.style.display = 'none';
                return;
            }
        }

        tempVec.copy(entry.mesh.position);
        tempVec.project(camera);

        if (tempVec.z > 1) {
            entry.labelDiv.style.display = 'none';
            return;
        }

        const cx = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
        const cy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

        const geom = entry.mesh.geometry;
        const radius = geom.parameters?.radius ?? geom.parameters?.outerRadius ?? 0.3;
        edgeVec.copy(entry.mesh.position);
        edgeVec.x += radius;
        edgeVec.project(camera);
        const ex = (edgeVec.x * 0.5 + 0.5) * window.innerWidth;
        const screenRadius = Math.abs(ex - cx);

        const gap = 6;
        entry.labelDiv.style.transform = `translate(${cx + screenRadius + gap}px, ${cy - 6}px)`;
        entry.labelDiv.style.display = showLabels ? '' : 'none';
    });
}

// --- HUD ---

let fpsFrames = 0;
let fpsLastTime = performance.now();
let fpsValue = 0;

export function updateHUD() {
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 500) {
        fpsValue = Math.round(fpsFrames / ((now - fpsLastTime) / 1000));
        fpsFrames = 0;
        fpsLastTime = now;
        document.getElementById('fps-display').textContent = `FPS: ${fpsValue}`;
    }

    const day = Math.floor(state.simTime * 365.25);
    const speedLabel = state.timeSpeed === 0 ? 'Paused' :
        state.timeSpeed === 0.25 ? '5-Second Increment' :
        state.timeSpeed === 1 ? '1-Day Increment' : '30-Day Increment';
    document.getElementById('time-display').textContent = `Day ${day} | ${speedLabel}`;

    const dist = camera.position.length();
    const zoom = (120 / dist).toFixed(2);
    document.getElementById('zoom-display').textContent = `Zoom: ${zoom}x`;
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
    const speedMap = { pause: 0, slow: 0.25, normal: 1, fast: 5 };
    ['pause', 'slow', 'normal', 'fast'].forEach(mode => {
        document.getElementById(`btn-${mode}`).addEventListener('click', () => {
            state.timeSpeed = speedMap[mode];
            document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(`btn-${mode}`).classList.add('active');
        });
    });

    // Display toggles
    document.getElementById('toggle-orbits').addEventListener('change', (e) => {
        state.bodyMeshes.forEach(b => { if (b.orbitLine) b.orbitLine.visible = e.target.checked; });
    });

    document.getElementById('toggle-labels').addEventListener('change', (e) => {
        state.bodyMeshes.forEach(b => { b.labelDiv.style.display = e.target.checked ? '' : 'none'; });
    });

    document.getElementById('toggle-grid').addEventListener('change', (e) => {
        gridGroup.visible = e.target.checked;
    });

    document.getElementById('toggle-trails').addEventListener('change', (e) => {
        state.bodyMeshes.forEach(b => { b.trail.line.visible = e.target.checked; });
    });
}
