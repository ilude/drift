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
    },
    // Dwarf planets & notable small bodies
    {
        name: 'Ceres', type: 'Dwarf Planet', distance: 2.77, period: 4.60, radius: 473,
        color: '#888877', moons: []
    },
    {
        name: 'Pluto', type: 'Dwarf Planet', distance: 39.48, period: 248.0, radius: 1188,
        color: '#ccaa88', moons: [
            { name: 'Charon', distance: 0.05, period: 0.01745, radius: 606, color: '#999988' }
        ]
    },
    {
        name: 'Haumea', type: 'Dwarf Planet', distance: 43.22, period: 284.1, radius: 816,
        color: '#aaaaaa', moons: [
            { name: "Hi'iaka", distance: 0.06, period: 0.1345, radius: 160, color: '#888888' }
        ]
    },
    {
        name: 'Makemake', type: 'Dwarf Planet', distance: 45.79, period: 309.9, radius: 715,
        color: '#bb9977', moons: []
    },
    {
        name: 'Eris', type: 'Dwarf Planet', distance: 67.78, period: 559.0, radius: 1163,
        color: '#bbbbbb', moons: [
            { name: 'Dysnomia', distance: 0.05, period: 0.04384, radius: 350, color: '#777777' }
        ]
    },
    {
        name: 'Sedna', type: 'Detached Object', distance: 506, period: 11400, radius: 498,
        color: '#cc6644', moons: []
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

// Lighting for 3D spheres
const ambientLight = new THREE.AmbientLight('#333333');
scene.add(ambientLight);
const sunLight = new THREE.PointLight('#ffffff', 2, 0, 0.5);
sunLight.position.set(0, 0, 0); // at the sun
scene.add(sunLight);

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
controls.maxDistance = 5000;
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
// Procedural asteroid belts
// ---------------------------------------------------------------------------
const ASTEROID_BELTS = [
    {
        name: 'Main Belt',
        minAU: 2.1, maxAU: 3.3,       // between Mars and Jupiter
        count: 600,
        color: '#555544',
        size: 0.25,
        minPeriod: 3.2, maxPeriod: 5.9  // years (Kepler-ish)
    },
    {
        name: 'Kuiper Belt',
        minAU: 30, maxAU: 50,
        count: 400,
        color: '#333344',
        size: 0.3,
        minPeriod: 164, maxPeriod: 354
    }
];

// Seeded random for reproducibility
function seededRandom(seed) {
    let s = seed;
    return () => {
        s = (s * 16807 + 0) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const asteroidBelts = ASTEROID_BELTS.map(belt => {
    const rng = seededRandom(belt.name.length * 7919);
    const prefix = belt.name === 'Main Belt' ? 'MB' : 'KB';
    const count = belt.count;
    const positions = new Float32Array(count * 3);
    const angles = new Float32Array(count);
    const radii = new Float32Array(count);
    const speeds = new Float32Array(count);
    const yOffsets = new Float32Array(count);
    const asteroids = []; // per-asteroid data

    // Kirkwood gaps — Jupiter resonance distances (AU) with half-widths
    const kirkwoodGaps = belt.name === 'Main Belt' ? [
        { center: 2.06, width: 0.03 },  // 4:1
        { center: 2.50, width: 0.04 },  // 3:1
        { center: 2.82, width: 0.03 },  // 5:2
        { center: 2.96, width: 0.03 },  // 7:3
        { center: 3.28, width: 0.04 },  // 2:1
    ] : [];

    function isInGap(au) {
        for (const gap of kirkwoodGaps) {
            if (Math.abs(au - gap.center) < gap.width) return true;
        }
        return false;
    }

    for (let i = 0; i < count; i++) {
        // Rejection sampling: re-roll if landing in a Kirkwood gap
        let au;
        do {
            au = belt.minAU + rng() * (belt.maxAU - belt.minAU);
        } while (isInGap(au));
        const angle = rng() * Math.PI * 2;
        const period = belt.minPeriod + (au - belt.minAU) / (belt.maxAU - belt.minAU) * (belt.maxPeriod - belt.minPeriod);
        const r = scaleDist(au);
        const diameter = Math.round(1 + rng() * 400); // km, procedural

        angles[i] = angle;
        radii[i] = r;
        speeds[i] = (Math.PI * 2) / (period * 60);
        yOffsets[i] = 0;

        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = yOffsets[i];
        positions[i * 3 + 2] = Math.sin(angle) * r;

        asteroids.push({
            designation: `${prefix}-${String(i + 1).padStart(4, '0')}`,
            au: Math.round(au * 1000) / 1000,
            period: Math.round(period * 100) / 100,
            diameter
        });
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: belt.color,
        size: belt.size,
        sizeAttenuation: true
    });
    const points = new THREE.Points(geom, mat);
    scene.add(points);

    return { belt, points, positions, angles, radii, speeds, yOffsets, count, asteroids };
});

function updateAsteroids(dt) {
    asteroidBelts.forEach(({ positions, angles, radii, speeds, yOffsets, count, points }) => {
        for (let i = 0; i < count; i++) {
            angles[i] += speeds[i] * dt * timeSpeed;
            positions[i * 3] = Math.cos(angles[i]) * radii[i];
            positions[i * 3 + 2] = Math.sin(angles[i]) * radii[i];
        }
        points.geometry.attributes.position.needsUpdate = true;
    });
}

// ---------------------------------------------------------------------------
// Shared containers (needed by comets and bodies)
// ---------------------------------------------------------------------------
const bodyMeshes = [];    // { data, mesh, orbitLine, labelDiv, moons: [...] }
const labelContainer = document.createElement('div');
labelContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
document.body.appendChild(labelContainer);

const trailGroups = new THREE.Group();
scene.add(trailGroups);

// ---------------------------------------------------------------------------
// Comets — famous Sol system comets with real orbital elements
// ---------------------------------------------------------------------------
const COMETS = [
    // Real orbital elements: a (AU), e, period (yr), inc (deg), Ω (long. asc. node), ω (arg. perihelion)
    { name: 'Halley',          a: 17.83,  e: 0.967,  period: 75.3,   inc: 162.26, node: 58.42,  peri: 111.33, color: '#99ccff' },
    { name: 'Hale-Bopp',       a: 186,    e: 0.995,  period: 2533,   inc: 89.43,  node: 282.47, peri: 130.59, color: '#aaddff' },
    { name: 'Encke',           a: 2.22,   e: 0.848,  period: 3.3,    inc: 11.78,  node: 334.57, peri: 186.55, color: '#88bbaa' },
    { name: 'Swift-Tuttle',    a: 26.09,  e: 0.963,  period: 133.3,  inc: 113.45, node: 139.38, peri: 152.98, color: '#bbaaff' },
    { name: 'Tempel 1',        a: 3.12,   e: 0.510,  period: 5.5,    inc: 10.47,  node: 68.76,  peri: 179.19, color: '#aa9988' },
    { name: 'Churyumov-Ger.',  a: 3.46,   e: 0.678,  period: 6.4,    inc: 5.30,   node: 45.93,  peri: 14.52,  color: '#998877' },
    { name: 'Hyakutake',       a: 1700,   e: 0.9998, period: 70000,  inc: 124.92, node: 188.05, peri: 130.17, color: '#ccddff' },
    { name: 'Neowise',         a: 358.5,  e: 0.999,  period: 6800,   inc: 128.94, node: 61.01,  peri: 37.28,  color: '#ddeeff' },
];

// Transform a point in the orbital plane to 3D space using Ω, i, ω
// Input: (x, y) in orbital plane (y=0 plane, x toward perihelion)
// Applies: rotate by ω in orbital plane, tilt by i, rotate by Ω around ecliptic pole
function orbitToWorld(x, z, incRad, nodeRad, periRad) {
    // Rotate by argument of perihelion in orbital plane
    const cosW = Math.cos(periRad), sinW = Math.sin(periRad);
    const x1 = x * cosW - z * sinW;
    const z1 = x * sinW + z * cosW;

    // Tilt by inclination (rotate around x-axis)
    const cosI = Math.cos(incRad), sinI = Math.sin(incRad);
    const x2 = x1;
    const y2 = z1 * sinI;
    const z2 = z1 * cosI;

    // Rotate by longitude of ascending node (around y-axis)
    const cosN = Math.cos(nodeRad), sinN = Math.sin(nodeRad);
    const x3 = x2 * cosN - z2 * sinN;
    const z3 = x2 * sinN + z2 * cosN;

    return { x: x3, y: y2, z: z3 };
}

const cometGroup = new THREE.Group();
scene.add(cometGroup);

// ---------------------------------------------------------------------------
// Create celestial bodies
// ---------------------------------------------------------------------------

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
    const colors = new Float32Array(maxPoints * 3);
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 });
    const line = new THREE.Line(geom, mat);
    line.visible = false;
    trailGroups.add(line);

    // Parse the base color for fading
    const c = new THREE.Color(color);

    return {
        line, positions, colors, index: 0, maxPoints, count: 0,
        baseColor: c, sampleAccum: 0
    };
}

function createBody(data, parentMesh) {
    const isPlanet = data.type === 'Planet';
    const isStar = data.type === 'Star';
    const isMoon = !!parentMesh;

    const size = isMoon ? BODY_MIN_SIZE * 0.6 : bodySize(data.radius, isStar);

    // Mesh — 3D sphere
    const segments = isStar ? 16 : (isMoon ? 8 : 12);
    const geom = new THREE.SphereGeometry(size, segments, segments);
    const mat = isStar
        ? new THREE.MeshBasicMaterial({ color: data.color }) // star self-lit
        : new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geom, mat);

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

// Create comets as regular bodies with Keplerian orbit data
COMETS.forEach(comet => {
    const { a, e, inc, node, peri, color, name, period } = comet;
    const incRad = (inc * Math.PI) / 180;
    const nodeRad = (node * Math.PI) / 180;
    const periRad = (peri * Math.PI) / 180;
    const perihelionAU = a * (1 - e);

    // Build elliptical orbit line using full 3D orientation
    // More segments for high eccentricity to keep curves smooth
    const segments = e > 0.9 ? 2048 : 512;
    const orbitPoints = [];
    for (let i = 0; i <= segments; i++) {
        // Use eccentric anomaly for even arc-length distribution
        const E = (i / segments) * Math.PI * 2;
        const theta = 2 * Math.atan2(
            Math.sqrt(1 + e) * Math.sin(E / 2),
            Math.sqrt(1 - e) * Math.cos(E / 2)
        );
        const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
        const rScaled = scaleDist(r);
        // Position in orbital plane
        const ox = rScaled * Math.cos(theta);
        const oz = rScaled * Math.sin(theta);
        // Transform to world using Ω, i, ω
        const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);
        orbitPoints.push(new THREE.Vector3(w.x, w.y, w.z));
    }
    const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 });
    const orbitLine = new THREE.Line(orbitGeom, orbitMat);
    cometGroup.add(orbitLine);

    // Comet sphere + selection ring
    const size = BODY_MIN_SIZE * 0.7;
    const geom = new THREE.SphereGeometry(size, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
    const mesh = new THREE.Mesh(geom, mat);

    const selGeom = new THREE.RingGeometry(size * 1.3, size * 1.5, 24);
    const selMat = new THREE.MeshBasicMaterial({
        color: '#44ff44', transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    const selRing = new THREE.Mesh(selGeom, selMat);
    selRing.rotation.x = -Math.PI / 2;
    mesh.add(selRing);
    scene.add(mesh);

    const labelDiv = createLabel(name, color, false);
    const trail = createTrail(color, 400);

    const entry = {
        data: {
            name, type: 'Comet', distance: perihelionAU, period, radius: 5,
            color, moons: [], a, e, inc, incRad, nodeRad, periRad
        },
        mesh, selRing, orbitLine, orbitRadius: 0,
        labelDiv, trail,
        angle: Math.random() * Math.PI * 2,
        parentMesh: null, moons: [], isMoon: false, isComet: true
    };
    bodyMeshes.push(entry);
});

// ---------------------------------------------------------------------------
// Body list panel
// ---------------------------------------------------------------------------
const bodyListEl = document.getElementById('body-list');

function buildBodyList() {
    bodyListEl.innerHTML = '';

    // Group bodies by type
    const groups = {};
    const groupOrder = ['Star', 'Planet', 'Dwarf Planet', 'Detached Object', 'Comet'];
    bodyMeshes.forEach(entry => {
        if (entry.isMoon) return;
        const type = entry.data.type;
        if (!groups[type]) groups[type] = [];
        groups[type].push(entry);
    });

    // Pluralize group names
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
                // If clicking the toggle, expand/collapse moons instead of selecting
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
                moonList.style.display = 'none'; // collapsed by default
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

    // Highlight in body list
    document.querySelectorAll('.body-list-item').forEach(el => el.classList.remove('selected'));
    const items = document.querySelectorAll('.body-list-item');
    items.forEach(el => {
        if (el.querySelector('.body-list-name')?.textContent === entry.data.name) {
            el.classList.add('selected');
        }
    });
}

function selectAsteroid(hit) {
    // Clear any body selection
    if (selectedBody) {
        selectedBody.selRing.material.opacity = 0;
        selectedBody = null;
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
const clickVec = new THREE.Vector3();
const MAX_CLICK_DIST = 50; // pixels — generous hit area out to label

renderer.domElement.addEventListener('click', (event) => {
    const mx = event.clientX;
    const my = event.clientY;

    let closest = null;
    let closestDist = Infinity;
    let closestAsteroid = null;

    // Check celestial bodies
    bodyMeshes.forEach(entry => {
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

    // Check asteroids (screen-space hit detection on point cloud data)
    const asteroidClickDist = 20; // tighter hit area for asteroids
    asteroidBelts.forEach(beltEntry => {
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
        if (entry.data.distance === 0 && !entry.isComet) return; // star at origin

        // Comet: Keplerian elliptical orbit with full 3D orientation
        if (entry.isComet) {
            const { a, e, incRad, nodeRad, periRad } = entry.data;
            const n = (Math.PI * 2) / (entry.data.period * 60);
            entry.angle += n * dt * timeSpeed;

            const theta = entry.angle;
            const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
            const rScaled = scaleDist(r);

            // Position in orbital plane
            const ox = rScaled * Math.cos(theta);
            const oz = rScaled * Math.sin(theta);
            // Transform to world
            const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);

            entry.mesh.position.set(w.x, w.y, w.z);
        } else {
            // Circular orbit
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
        }

        // Trail — always record, sample every ~0.02 sim-time units
        const t = entry.trail;
        t.sampleAccum += dt * timeSpeed;
        if (t.sampleAccum > 0.02) {
            t.sampleAccum = 0;
            const i3 = t.index * 3;
            t.positions[i3] = entry.mesh.position.x;
            t.positions[i3 + 1] = 0;
            t.positions[i3 + 2] = entry.mesh.position.z;
            t.index = (t.index + 1) % t.maxPoints;
            t.count = Math.min(t.count + 1, t.maxPoints);

            // Rebuild colors: oldest = transparent, newest = full color
            const total = t.count;
            for (let j = 0; j < total; j++) {
                // Map j to the actual buffer index (ring buffer order)
                const bufIdx = (t.count >= t.maxPoints)
                    ? (t.index + j) % t.maxPoints
                    : j;
                const fade = j / total; // 0=oldest, 1=newest
                t.colors[bufIdx * 3] = t.baseColor.r * fade;
                t.colors[bufIdx * 3 + 1] = t.baseColor.g * fade;
                t.colors[bufIdx * 3 + 2] = t.baseColor.b * fade;
            }

            // Draw in ring-buffer order so the line connects properly
            if (t.count >= t.maxPoints) {
                // Reorder into a contiguous draw buffer
                const pa = t.positions;
                const ca = t.colors;
                const tmpP = new Float32Array(t.maxPoints * 3);
                const tmpC = new Float32Array(t.maxPoints * 3);
                for (let j = 0; j < t.maxPoints; j++) {
                    const src = ((t.index + j) % t.maxPoints) * 3;
                    const dst = j * 3;
                    tmpP[dst] = pa[src]; tmpP[dst + 1] = pa[src + 1]; tmpP[dst + 2] = pa[src + 2];
                    tmpC[dst] = ca[src]; tmpC[dst + 1] = ca[src + 1]; tmpC[dst + 2] = ca[src + 2];
                }
                t.positions.set(tmpP);
                t.colors.set(tmpC);
                t.index = 0;
                t.count = t.maxPoints;
            }

            t.line.geometry.attributes.position.needsUpdate = true;
            t.line.geometry.attributes.color.needsUpdate = true;
            t.line.geometry.setDrawRange(0, t.count);
        }
    });
}

const edgeVec = new THREE.Vector3();
const labelsVisible = () => document.getElementById('toggle-labels').checked;

// LOD thresholds — camera distance to parent body below which moons become visible
const MOON_LOD_DIST = 25;

function updateLabels() {
    const showLabels = labelsVisible();
    bodyMeshes.forEach(entry => {
        // LOD: hide moons when camera is far from their parent
        if (entry.isMoon && entry.parentMesh) {
            const camDist = camera.position.distanceTo(entry.parentMesh.position);
            const visible = camDist < MOON_LOD_DIST;
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

        // Project a point at the edge of the body to get screen-space radius
        const geom = entry.mesh.geometry;
        const radius = geom.parameters?.radius ?? geom.parameters?.outerRadius ?? 0.3;
        edgeVec.copy(entry.mesh.position);
        edgeVec.x += radius;
        edgeVec.project(camera);
        const ex = (edgeVec.x * 0.5 + 0.5) * window.innerWidth;
        const screenRadius = Math.abs(ex - cx);

        const gap = 6; // fixed pixel gap outside the body
        entry.labelDiv.style.transform = `translate(${cx + screenRadius + gap}px, ${cy - 6}px)`;
        entry.labelDiv.style.display = showLabels ? '' : 'none';
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

let fpsFrames = 0;
let fpsLastTime = performance.now();
let fpsValue = 0;

function updateHUD() {
    // FPS counter — update every 500ms
    fpsFrames++;
    const now = performance.now();
    if (now - fpsLastTime >= 500) {
        fpsValue = Math.round(fpsFrames / ((now - fpsLastTime) / 1000));
        fpsFrames = 0;
        fpsLastTime = now;
        document.getElementById('fps-display').textContent = `FPS: ${fpsValue}`;
    }

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
    updateAsteroids(dt);
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
