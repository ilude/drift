import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Solar system data (distances in AU, periods in Earth years, radii in km)
// ---------------------------------------------------------------------------
const BODIES = [
    {
        name: 'Sol', type: 'Star', distance: 0, period: 0, radius: 695700,
        color: '#ffdd44', emissive: true, moons: []
    },
    {
        name: 'Mercury', type: 'Planet', distance: 0.387, period: 0.241, radius: 2440,
        color: '#aaaaaa', moons: []
    },
    {
        name: 'Venus', type: 'Planet', distance: 0.723, period: 0.615, radius: 6052,
        color: '#ddaa66', moons: []
    },
    {
        name: 'Earth', type: 'Planet', distance: 1.0, period: 1.0, radius: 6371,
        color: '#4488cc', moons: [
            { name: 'Luna', distance: 0.04, period: 0.0748, radius: 1737, color: '#999999' }
        ]
    },
    {
        name: 'Mars', type: 'Planet', distance: 1.524, period: 1.881, radius: 3390,
        color: '#cc5533', moons: [
            { name: 'Phobos', distance: 0.02, period: 0.0008, radius: 11, color: '#887766' },
            { name: 'Deimos', distance: 0.03, period: 0.003, radius: 6, color: '#887766' }
        ]
    },
    {
        name: 'Jupiter', type: 'Planet', distance: 5.203, period: 11.86, radius: 69911,
        color: '#ddaa77', moons: [
            { name: 'Io', distance: 0.06, period: 0.00484, radius: 1822, color: '#ddcc44' },
            { name: 'Europa', distance: 0.08, period: 0.00972, radius: 1561, color: '#ccccdd' },
            { name: 'Ganymede', distance: 0.10, period: 0.01959, radius: 2634, color: '#aaaaaa' },
            { name: 'Callisto', distance: 0.13, period: 0.04570, radius: 2410, color: '#777788' }
        ]
    },
    {
        name: 'Saturn', type: 'Planet', distance: 9.537, period: 29.46, radius: 58232,
        color: '#ccbb77', moons: [
            { name: 'Titan', distance: 0.10, period: 0.0437, radius: 2575, color: '#cc9944' },
            { name: 'Enceladus', distance: 0.04, period: 0.00375, radius: 252, color: '#ddddee' }
        ]
    },
    {
        name: 'Uranus', type: 'Planet', distance: 19.19, period: 84.01, radius: 25362,
        color: '#88bbcc', moons: [
            { name: 'Miranda', distance: 0.04, period: 0.00387, radius: 236, color: '#aabbbb' },
            { name: 'Titania', distance: 0.08, period: 0.02387, radius: 789, color: '#aaaaaa' }
        ]
    },
    {
        name: 'Neptune', type: 'Planet', distance: 30.07, period: 164.8, radius: 24622,
        color: '#4466cc', moons: [
            { name: 'Triton', distance: 0.06, period: 0.01610, radius: 1353, color: '#99aaaa' }
        ]
    }
];

// ---------------------------------------------------------------------------
// Scale helpers — we use a sqrt scale for distance to keep inner and outer
// planets visible simultaneously, similar to Aurora 4X's approach
// ---------------------------------------------------------------------------
const DIST_SCALE = 40;       // multiplier after sqrt
const BODY_MIN_SIZE = 0.3;   // minimum rendered size for any body
const BODY_MAX_SIZE = 2.0;   // max rendered size (star)
const MOON_DIST_SCALE = 25;  // moon orbit scaling

function scaleDist(au) {
    return Math.sqrt(au) * DIST_SCALE;
}

function bodySize(radius, isStar) {
    if (isStar) return BODY_MAX_SIZE;
    // Log scale so Jupiter isn't 10x Earth visually
    const s = 0.2 + Math.log10(radius / 1000 + 1) * 0.35;
    return Math.max(BODY_MIN_SIZE, Math.min(1.2, s));
}

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070d');

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 120, 80);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI * 0.85;
controls.enableZoom = false; // we handle zoom manually for zoom-to-cursor

// Zoom-to-cursor: on wheel, find the world point under the cursor on the
// y=0 plane, then move both camera and target toward/away from that point.
const zoomPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const zoomRay = new THREE.Raycaster();
const zoomMouse = new THREE.Vector2();
const zoomIntersect = new THREE.Vector3();

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();

    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 0.15 : -0.12;

    // Current distance for clamp check
    const dist = camera.position.distanceTo(controls.target);
    const newDist = dist * (1 - factor);
    if (newDist < controls.minDistance || newDist > controls.maxDistance) return;

    // Raycast to y=0 plane under cursor
    zoomMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    zoomMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    zoomRay.setFromCamera(zoomMouse, camera);

    const hit = zoomRay.ray.intersectPlane(zoomPlane, zoomIntersect);
    if (!hit) return;

    // Move camera and target toward the cursor world point by `factor`
    camera.position.x += (zoomIntersect.x - camera.position.x) * factor;
    camera.position.y += (zoomIntersect.y - camera.position.y) * factor;
    camera.position.z += (zoomIntersect.z - camera.position.z) * factor;

    controls.target.x += (zoomIntersect.x - controls.target.x) * factor;
    controls.target.z += (zoomIntersect.z - controls.target.z) * factor;
}, { passive: false });

// ---------------------------------------------------------------------------
// Star field background
// ---------------------------------------------------------------------------
function createStarField() {
    const count = 2000;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        const r = 800 + Math.random() * 1200;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({ color: '#334433', size: 0.8, sizeAttenuation: true });
    scene.add(new THREE.Points(geom, mat));
}
createStarField();

// ---------------------------------------------------------------------------
// Distance grid rings (concentric AU markers)
// ---------------------------------------------------------------------------
const gridGroup = new THREE.Group();
scene.add(gridGroup);

const auMarkers = [0.5, 1, 2, 5, 10, 20, 30];
auMarkers.forEach(au => {
    const r = scaleDist(au);
    const geom = new THREE.RingGeometry(r - 0.02, r + 0.02, 128);
    const mat = new THREE.MeshBasicMaterial({ color: '#111118', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = -Math.PI / 2;
    gridGroup.add(ring);
});

// ---------------------------------------------------------------------------
// Create celestial bodies
// ---------------------------------------------------------------------------
const bodyMeshes = [];    // { data, mesh, orbitLine, labelDiv, moons: [...] }
const labelContainer = document.createElement('div');
labelContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
document.body.appendChild(labelContainer);

const trailGroups = new THREE.Group();
scene.add(trailGroups);

function createLabel(name, color, isMoon) {
    const div = document.createElement('div');
    div.textContent = name;
    div.style.cssText = `
        position: absolute;
        color: ${color};
        font-family: 'Courier New', monospace;
        font-size: ${isMoon ? '9px' : '11px'};
        white-space: nowrap;
        text-shadow: 0 0 4px #000, 0 0 2px #000;
        opacity: ${isMoon ? 0.7 : 0.9};
    `;
    labelContainer.appendChild(div);
    return div;
}

function createOrbitRing(radius, color) {
    const segments = 128;
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 });
    return new THREE.Line(geom, mat);
}

function createTrail(color, maxPoints) {
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(maxPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.15 });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    trailGroups.add(line);
    return { line, positions, index: 0, maxPoints, count: 0 };
}

function createBody(data, parentMesh) {
    const isPlanet = data.type === 'Planet';
    const isStar = data.type === 'Star';
    const isMoon = !!parentMesh;

    const size = isMoon ? BODY_MIN_SIZE * 0.6 : bodySize(data.radius, isStar);

    // Mesh
    const geom = new THREE.CircleGeometry(size, 24);
    const mat = new THREE.MeshBasicMaterial({ color: data.color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;

    // Glow ring for star
    if (isStar) {
        const glowGeom = new THREE.RingGeometry(size * 1.1, size * 1.6, 32);
        const glowMat = new THREE.MeshBasicMaterial({
            color: '#ffdd44', transparent: true, opacity: 0.15, side: THREE.DoubleSide
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.rotation.x = -Math.PI / 2;
        mesh.add(glow);
    }

    // Selection ring (hidden by default)
    const selGeom = new THREE.RingGeometry(size * 1.3, size * 1.5, 24);
    const selMat = new THREE.MeshBasicMaterial({
        color: '#44ff44', transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    const selRing = new THREE.Mesh(selGeom, selMat);
    selRing.rotation.x = -Math.PI / 2;
    mesh.add(selRing);

    scene.add(mesh);

    // Orbit ring
    let orbitLine = null;
    let orbitRadius = 0;
    if (data.distance > 0) {
        if (isMoon) {
            orbitRadius = data.distance * MOON_DIST_SCALE;
        } else {
            orbitRadius = scaleDist(data.distance);
        }
        const ringColor = isMoon ? '#1a2a1a' : '#1a3a1a';
        orbitLine = createOrbitRing(orbitRadius, ringColor);
        if (isMoon && parentMesh) {
            // Moon orbits follow parent — we'll update position each frame
        }
        scene.add(orbitLine);
    }

    // Label
    const labelDiv = createLabel(data.name, isMoon ? '#4a6a4a' : data.color, isMoon);

    // Trail
    const trail = createTrail(data.color, 400);

    const entry = {
        data,
        mesh,
        selRing,
        orbitLine,
        orbitRadius,
        labelDiv,
        trail,
        angle: Math.random() * Math.PI * 2,  // random starting position
        parentMesh,
        moons: [],
        isMoon
    };

    bodyMeshes.push(entry);

    // Create moons
    if (data.moons) {
        data.moons.forEach(moonData => {
            const moonEntry = createBody(
                { ...moonData, type: 'Moon' },
                mesh
            );
            entry.moons.push(moonEntry);
        });
    }

    return entry;
}

BODIES.forEach(b => {
    if (!b.type || b.type !== 'Moon') createBody(b, null);
});

// ---------------------------------------------------------------------------
// Body list panel
// ---------------------------------------------------------------------------
const bodyListEl = document.getElementById('body-list');

function buildBodyList() {
    bodyListEl.innerHTML = '';
    bodyMeshes.forEach(entry => {
        if (entry.isMoon) return; // moons added under parent
        const item = document.createElement('div');
        item.className = 'body-list-item';
        item.innerHTML = `<span class="body-color-dot" style="background:${entry.data.color}"></span>
            <span class="body-list-name">${entry.data.name}</span>`;
        item.addEventListener('click', () => selectBody(entry));
        bodyListEl.appendChild(item);

        entry.moons.forEach(moon => {
            const mItem = document.createElement('div');
            mItem.className = 'body-list-item moon';
            mItem.innerHTML = `<span class="body-color-dot" style="background:${moon.data.color}"></span>
                <span class="body-list-name">${moon.data.name}</span>`;
            mItem.addEventListener('click', () => selectBody(moon));
            bodyListEl.appendChild(mItem);
        });
    });
}
buildBodyList();

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------
let selectedBody = null;

// Smooth camera animation state
let flyTo = null;

function animateCameraTo(entry, zoomDist) {
    const camOffset = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

    flyTo = {
        entry,
        camOffset,
        zoomDist,
        startCam: camera.position.clone(),
        startTarget: controls.target.clone(),
        startTime: performance.now() / 1000,
        duration: 0.6
    };
}

function updateFlyTo() {
    if (!flyTo) return;
    const now = performance.now() / 1000;
    let t = (now - flyTo.startTime) / flyTo.duration;
    if (t >= 1) {
        t = 1;
    }
    // Ease out cubic
    const ease = 1 - Math.pow(1 - t, 3);

    // Recompute end positions from the body's CURRENT position each frame
    const pos = flyTo.entry.mesh.position;
    const endTarget = new THREE.Vector3(pos.x, 0, pos.z);
    const endCam = new THREE.Vector3().copy(endTarget).addScaledVector(flyTo.camOffset, flyTo.zoomDist);

    camera.position.lerpVectors(flyTo.startCam, endCam, ease);
    controls.target.lerpVectors(flyTo.startTarget, endTarget, ease);

    if (t >= 1) {
        flyTo = null;
    }
}

function selectBody(entry) {
    // Deselect previous
    if (selectedBody) {
        selectedBody.selRing.material.opacity = 0;
    }

    selectedBody = entry;
    // Fly camera to the selected body
    const zoomDist = entry.data.type === 'Star' ? 30 :
                     entry.data.type === 'Moon' ? 8 : 15;
    animateCameraTo(entry, zoomDist);

    // Update info panel
    const panel = document.getElementById('info-panel');
    panel.classList.remove('hidden');
    document.getElementById('info-title').textContent = entry.data.name;
    document.getElementById('info-type').textContent = entry.data.type;
    document.getElementById('info-distance').textContent = entry.data.distance > 0
        ? `${entry.data.distance} AU` : 'Center';
    document.getElementById('info-period').textContent = entry.data.period > 0
        ? `${entry.data.period} years` : '-';
    document.getElementById('info-radius').textContent = `${entry.data.radius.toLocaleString()} km`;
    document.getElementById('info-moons').textContent = entry.data.moons
        ? entry.data.moons.length.toString() : '0';

    // Highlight in body list
    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));
    const items = document.querySelectorAll('.body-list-item');
    items.forEach(el => {
        if (el.querySelector('.body-list-name')?.textContent === entry.data.name) {
            el.classList.add('selected');
        }
    });
}

document.getElementById('info-close').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
    if (selectedBody) {
        selectedBody.selRing.material.opacity = 0;
        selectedBody = null;
    }
});

// ---------------------------------------------------------------------------
// Raycaster for click selection
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
raycaster.params.Mesh = { threshold: 1 };
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = bodyMeshes.map(b => b.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
        const hit = bodyMeshes.find(b => b.mesh === intersects[0].object);
        if (hit) selectBody(hit);
    }
});

// ---------------------------------------------------------------------------
// Time controls
// ---------------------------------------------------------------------------
let timeSpeed = 1;
let simTime = 0;
const speedMap = { pause: 0, slow: 0.25, normal: 1, fast: 5 };

['pause', 'slow', 'normal', 'fast'].forEach(mode => {
    document.getElementById(`btn-${mode}`).addEventListener('click', () => {
        timeSpeed = speedMap[mode];
        document.querySelectorAll('.ctrl-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${mode}`).classList.add('active');
    });
});

// Display toggles
document.getElementById('toggle-orbits').addEventListener('change', (e) => {
    bodyMeshes.forEach(b => { if (b.orbitLine) b.orbitLine.visible = e.target.checked; });
});

document.getElementById('toggle-labels').addEventListener('change', (e) => {
    bodyMeshes.forEach(b => { b.labelDiv.style.display = e.target.checked ? '' : 'none'; });
});

document.getElementById('toggle-grid').addEventListener('change', (e) => {
    gridGroup.visible = e.target.checked;
});

document.getElementById('toggle-trails').addEventListener('change', (e) => {
    bodyMeshes.forEach(b => { b.trail.line.visible = e.target.checked; });
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const tempVec = new THREE.Vector3();

function updatePositions(dt) {
    simTime += dt * timeSpeed;

    bodyMeshes.forEach(entry => {
        if (entry.data.distance === 0) return; // star at origin

        const speed = entry.data.period > 0 ? (Math.PI * 2) / (entry.data.period * 60) : 0;
        entry.angle += speed * dt * timeSpeed;

        const r = entry.orbitRadius;
        const x = Math.cos(entry.angle) * r;
        const z = Math.sin(entry.angle) * r;

        if (entry.parentMesh) {
            // Moon: offset from parent
            const px = entry.parentMesh.position.x;
            const pz = entry.parentMesh.position.z;
            entry.mesh.position.set(px + x, 0, pz + z);

            // Update moon orbit ring position
            if (entry.orbitLine) {
                entry.orbitLine.position.set(px, 0, pz);
            }
        } else {
            entry.mesh.position.set(x, 0, z);
        }

        // Trail
        if (entry.trail.line.visible) {
            const t = entry.trail;
            const i = t.index * 3;
            t.positions[i] = entry.mesh.position.x;
            t.positions[i + 1] = 0;
            t.positions[i + 2] = entry.mesh.position.z;
            t.index = (t.index + 1) % t.maxPoints;
            t.count = Math.min(t.count + 1, t.maxPoints);
            t.line.geometry.attributes.position.needsUpdate = true;
            t.line.geometry.setDrawRange(0, t.count);
        }
    });
}

function updateLabels() {
    bodyMeshes.forEach(entry => {
        tempVec.copy(entry.mesh.position);
        tempVec.project(camera);

        if (tempVec.z > 1) {
            entry.labelDiv.style.display = 'none';
            return;
        }

        const x = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;

        entry.labelDiv.style.transform = `translate(${x + 10}px, ${y - 6}px)`;
        entry.labelDiv.style.display = document.getElementById('toggle-labels').checked ? '' : 'none';
    });
}

function updateFollow() {
    if (!selectedBody || flyTo) return;
    const pos = selectedBody.mesh.position;
    // Offset between camera and target stays the same — just shift both
    const dx = pos.x - controls.target.x;
    const dz = pos.z - controls.target.z;
    controls.target.x += dx;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
}

function updateInfoPosition() {
    if (selectedBody) {
        const pos = selectedBody.mesh.position;
        document.getElementById('info-position').textContent =
            `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
    }
}

function updateHUD() {
    const day = Math.floor(simTime * 365.25);
    const speedLabel = timeSpeed === 0 ? 'Paused' :
        timeSpeed === 0.25 ? '5-Second Increment' :
        timeSpeed === 1 ? '1-Day Increment' : '30-Day Increment';
    document.getElementById('time-display').textContent = `Day ${day} | ${speedLabel}`;

    const dist = camera.position.length();
    const zoom = (120 / dist).toFixed(2);
    document.getElementById('zoom-display').textContent = `Zoom: ${zoom}x`;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    controls.update();
    updateFlyTo();
    updatePositions(dt);
    updateFollow();
    updateLabels();
    updateInfoPosition();
    updateHUD();

    renderer.render(scene, camera);
}

animate();

// ---------------------------------------------------------------------------
// Resize handling
// ---------------------------------------------------------------------------
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
