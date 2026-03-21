import * as THREE from 'three';
import { state } from './state.js';
import { scaleDist, MOON_DIST_SCALE, keplerRadius, orbitSpeed, meanToTrue, inclinedPosition } from './orbit.js';
import { bodySize, BODY_MIN_SIZE, moonOrbitScale, realisticSize } from './visual.js';
import { scene, camera, controls, ZOOM_BASE, labelContainer, trailGroups, cometGroup } from './scene.js';
import { seededRandom } from './utils.js';
import { generateBodyTexture, createStarMaterial } from './textures.js';

// Transform orbital plane coordinates to 3D world space using Ω, i, ω
const _orbitOut = { x: 0, y: 0, z: 0 };

export function orbitToWorld(x, z, incRad, nodeRad, periRad) {
    const cosW = Math.cos(periRad), sinW = Math.sin(periRad);
    const x1 = x * cosW - z * sinW;
    const z1 = x * sinW + z * cosW;

    const cosI = Math.cos(incRad), sinI = Math.sin(incRad);
    const x2 = x1;
    const y2 = z1 * sinI;
    const z2 = z1 * cosI;

    const cosN = Math.cos(nodeRad), sinN = Math.sin(nodeRad);
    _orbitOut.x = x2 * cosN - z2 * sinN;
    _orbitOut.y = y2;
    _orbitOut.z = x2 * sinN + z2 * cosN;

    return _orbitOut;
}

// Shared geometry/materials for identical bodies
// LOD tiers: [low, medium, high] segment counts
const LOD_SEGS = [8, 24, 48];
const STAR_LOD_SEGS = [32, 48, 64];
const MOON_SIZE = BODY_MIN_SIZE * 0.6;
const COMET_SIZE = BODY_MIN_SIZE * 0.7;
const SEL_RING_INNER = 1.3;
const SEL_RING_OUTER = 1.5;
const SEL_RING_SEGS = 24;
const TRAIL_MAX_POINTS = 400;
export const COMET_ORBIT_OPACITY = 0.03;
export const COMET_ORBIT_SELECTED_OPACITY = 0.05;

const sharedMoonGeoms = LOD_SEGS.map(s => new THREE.SphereGeometry(MOON_SIZE, s, s));
const sharedCometGeoms = LOD_SEGS.map(s => new THREE.SphereGeometry(COMET_SIZE, s, s));
const sharedMoonOrbitMat = new THREE.LineBasicMaterial({ color: '#1a2a1a', transparent: true, opacity: 0.3 });
const sharedPlanetOrbitMat = new THREE.LineBasicMaterial({ color: '#1a3a1a', transparent: true, opacity: 0.3 });

export const sharedResources = new Set([...sharedMoonGeoms, ...sharedCometGeoms, sharedMoonOrbitMat, sharedPlanetOrbitMat]);

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

function createOrbitRing(a, e, toScreen, mat) {
    const approxR = toScreen(a);
    const segments = Math.min(512, Math.max(128, Math.round(approxR * 4)));
    const positions = new Float32Array((segments + 1) * 3);
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const r = toScreen(keplerRadius(a, e, angle));
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
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

    const c = new THREE.Color(color);

    return {
        line, positions, colors, index: 0, maxPoints, count: 0,
        baseColor: c, sampleAccum: 0,
        tmpP: new Float32Array(maxPoints * 3),
        tmpC: new Float32Array(maxPoints * 3)
    };
}

export function createBody(data, parentMesh) {
    const isStar = data.type === 'Star';
    const isMoon = !!parentMesh;

    const size = isMoon ? MOON_SIZE : bodySize(data.radius, isStar);

    const segs = isStar ? STAR_LOD_SEGS : LOD_SEGS;
    const geomLevels = isMoon ? sharedMoonGeoms :
        segs.map(s => new THREE.SphereGeometry(size, s, s));
    let mat;
    if (isStar) {
        mat = createStarMaterial(data.color);
    } else {
        const texture = generateBodyTexture(data, isMoon);
        mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0.1 });
    }
    const mesh = new THREE.Mesh(geomLevels[0], mat);

    // Planetary rings (e.g., Saturn, Jupiter, Uranus, Neptune)
    let planetRing = null;
    if (data.rings) {
        const innerR = size * data.rings.inner;
        const outerR = size * data.rings.outer;
        const opacity = data.rings.opacity || 1;
        const ringGeom = new THREE.RingGeometry(innerR, outerR, 64);
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 256, 0);
        const a = (v) => Math.round(v * opacity * 255);
        grad.addColorStop(0.0, `rgba(180,160,120,${a(0.1) / 255})`);
        grad.addColorStop(0.15, `rgba(200,180,140,${a(0.5) / 255})`);
        grad.addColorStop(0.3, `rgba(160,140,100,${a(0.15) / 255})`);
        grad.addColorStop(0.45, `rgba(210,190,150,${a(0.6) / 255})`);
        grad.addColorStop(0.65, `rgba(190,170,130,${a(0.4) / 255})`);
        grad.addColorStop(0.85, `rgba(170,150,110,${a(0.3) / 255})`);
        grad.addColorStop(1.0, `rgba(150,130,100,${a(0.05) / 255})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 1);
        const ringTex = new THREE.CanvasTexture(canvas);
        const uvAttr = ringGeom.attributes.uv;
        const posAttr = ringGeom.attributes.position;
        for (let i = 0; i < uvAttr.count; i++) {
            const x = posAttr.getX(i);
            const z = posAttr.getY(i);
            const dist = Math.sqrt(x * x + z * z);
            uvAttr.setXY(i, (dist - innerR) / (outerR - innerR), 0.5);
        }
        const ringMat = new THREE.MeshBasicMaterial({
            map: ringTex,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
        });
        planetRing = new THREE.Mesh(ringGeom, ringMat);
        const tiltRad = (data.rings.tilt || 0) * Math.PI / 180;
        planetRing.rotation.x = -Math.PI / 2 + tiltRad;
        planetRing.visible = false;
        mesh.add(planetRing);
    }

    const selGeom = new THREE.RingGeometry(size * SEL_RING_INNER, size * SEL_RING_OUTER, SEL_RING_SEGS);
    const selMat = new THREE.MeshBasicMaterial({
        color: '#44ff44', transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    const selRing = new THREE.Mesh(selGeom, selMat);
    selRing.rotation.x = -Math.PI / 2;
    mesh.add(selRing);

    scene.add(mesh);

    let orbitLine = null;
    let orbitRadius = 0;
    const ecc = data.e || 0;
    if (data.distance > 0) {
        const toScreen = isMoon ? d => d * MOON_DIST_SCALE : scaleDist;
        orbitRadius = toScreen(data.distance);
        orbitLine = createOrbitRing(data.distance, ecc, toScreen, isMoon ? sharedMoonOrbitMat : sharedPlanetOrbitMat);
        if (isMoon) orbitLine.visible = false;
        scene.add(orbitLine);
    }

    const labelDiv = createLabel(data.name, isMoon ? '#4a6a4a' : data.color, isMoon);
    const trail = createTrail(data.color, TRAIL_MAX_POINTS);

    const entry = {
        data, mesh, selRing, planetRing, orbitLine, orbitRadius, labelDiv, trail,
        angle: Math.random() * Math.PI * 2,
        parentMesh, moons: [], isMoon, screenSize: size,
        baseSize: size,
        realisticSize: (isMoon || !data.radius) ? size : realisticSize(data.radius),
        geomLevels, lodLevel: 0
    };

    state.bodyMeshes.push(entry);

    if (data.moons) {
        data.moons.forEach(moonData => {
            const moonEntry = createBody({ ...moonData, type: 'Moon' }, mesh);
            entry.moons.push(moonEntry);
        });
    }

    return entry;
}

export function createBodies() {
    state.BODIES.forEach(b => {
        if (!b.type || b.type !== 'Moon') createBody(b, null);
    });
}

export function createComets() {
    state.COMETS.forEach(comet => {
        const { a, e, inc, node, peri, color, name, period } = comet;
        const incRad = (inc * Math.PI) / 180;
        const nodeRad = (node * Math.PI) / 180;
        const periRad = (peri * Math.PI) / 180;
        const perihelionAU = a * (1 - e);

        const segments = e > 0.9 ? 2048 : 512;
        const orbitPoints = [];
        for (let i = 0; i <= segments; i++) {
            const E = (i / segments) * Math.PI * 2;
            const theta = 2 * Math.atan2(
                Math.sqrt(1 + e) * Math.sin(E / 2),
                Math.sqrt(1 - e) * Math.cos(E / 2)
            );
            const r = a * (1 - e * e) / (1 + e * Math.cos(theta));
            const rScaled = scaleDist(r);
            const ox = rScaled * Math.cos(theta);
            const oz = rScaled * Math.sin(theta);
            const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);
            orbitPoints.push(new THREE.Vector3(w.x, w.y, w.z));
        }
        const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
        const orbitMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: COMET_ORBIT_OPACITY });
        const orbitLine = new THREE.Line(orbitGeom, orbitMat);
        cometGroup.add(orbitLine);

        const size = COMET_SIZE;
        const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
        const mesh = new THREE.Mesh(sharedCometGeoms[0], mat);

        const selGeom = new THREE.RingGeometry(size * SEL_RING_INNER, size * SEL_RING_OUTER, SEL_RING_SEGS);
        const selMat = new THREE.MeshBasicMaterial({
            color: '#44ff44', transparent: true, opacity: 0, side: THREE.DoubleSide
        });
        const selRing = new THREE.Mesh(selGeom, selMat);
        selRing.rotation.x = -Math.PI / 2;
        mesh.add(selRing);
        scene.add(mesh);

        const labelDiv = createLabel(name, color, false);
        const trail = createTrail(color, TRAIL_MAX_POINTS);

        const entry = {
            data: {
                name, type: 'Comet', distance: perihelionAU, period, radius: 5,
                color, moons: [], a, e, inc, incRad, nodeRad, periRad
            },
            mesh, selRing, orbitLine, orbitRadius: 0,
            labelDiv, trail,
            angle: Math.random() * Math.PI * 2,
            parentMesh: null, moons: [], isMoon: false, isComet: true,
            screenSize: size, geomLevels: sharedCometGeoms, lodLevel: 0
        };
        state.bodyMeshes.push(entry);
    });
}

export function createAsteroidBelts() {
    return state.ASTEROID_BELTS.map(belt => {
        const rng = seededRandom(belt.name.length * 7919);
        const prefix = belt.name.includes('Belt') ? belt.name.split(' ')[0].substring(0, 2).toUpperCase() : 'AB';
        const maxIncRad = (belt.maxInc || 0) * Math.PI / 180;
        const count = belt.count;
        const positions = new Float32Array(count * 3);
        const angles = new Float32Array(count);
        const radii = new Float32Array(count);
        const speeds = new Float32Array(count);
        const inclinations = new Float32Array(count);
        const nodeAngles = new Float32Array(count);
        const cosInc = new Float32Array(count);
        const sinInc = new Float32Array(count);
        const cosNode = new Float32Array(count);
        const sinNode = new Float32Array(count);
        const yOffsets = new Float32Array(count);
        const asteroids = [];

        const kirkwoodGaps = belt.name === 'Main Belt' ? [
            { center: 2.06, width: 0.03 },
            { center: 2.50, width: 0.04 },
            { center: 2.82, width: 0.03 },
            { center: 2.96, width: 0.03 },
            { center: 3.28, width: 0.04 },
        ] : [];

        function isInGap(au) {
            for (const gap of kirkwoodGaps) {
                if (Math.abs(au - gap.center) < gap.width) return true;
            }
            return false;
        }

        for (let i = 0; i < count; i++) {
            let au;
            do {
                au = belt.minAU + rng() * (belt.maxAU - belt.minAU);
            } while (isInGap(au));
            const angle = rng() * Math.PI * 2;
            const period = Math.sqrt(au * au * au);
            const r = scaleDist(au);
            const diameter = Math.round(1 + rng() * 400);

            const inc = Math.acos(1 - rng() * (1 - Math.cos(maxIncRad)));
            const nodeAngle = rng() * Math.PI * 2;

            angles[i] = angle;
            radii[i] = r;
            speeds[i] = orbitSpeed(period);
            inclinations[i] = inc;
            nodeAngles[i] = nodeAngle;
            const cosI = Math.cos(inc), sinI = Math.sin(inc);
            const cosN = Math.cos(nodeAngle), sinN = Math.sin(nodeAngle);
            cosInc[i] = cosI;
            sinInc[i] = sinI;
            cosNode[i] = cosN;
            sinNode[i] = sinN;
            yOffsets[i] = 0;

            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const p = inclinedPosition(x, z, cosN, sinN, cosI, sinI);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

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

        return { belt, points, positions, angles, radii, speeds, inclinations, nodeAngles, cosInc, sinInc, cosNode, sinNode, yOffsets, count, asteroids };
    });
}

export function updateAsteroids(dt) {
    state.asteroidBelts.forEach(({ positions, angles, radii, speeds, cosInc, sinInc, cosNode, sinNode, count, points }) => {
        for (let i = 0; i < count; i++) {
            angles[i] += speeds[i] * dt * state.timeSpeed;
            const r = radii[i];
            const x = Math.cos(angles[i]) * r;
            const z = Math.sin(angles[i]) * r;

            const p = inclinedPosition(x, z, cosNode[i], sinNode[i], cosInc[i], sinInc[i]);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        }
        points.geometry.attributes.position.needsUpdate = true;
    });
}

export function updatePositions(dt) {
    state.simTime += dt * state.timeSpeed;
    const zoomFactor = ZOOM_BASE / camera.position.distanceTo(controls.target);
    const moonScale = moonOrbitScale(zoomFactor);

    state.bodyMeshes.forEach(entry => {
        if (entry.data.distance === 0 && !entry.isComet) return;

        if (entry.isComet) {
            const { a, e, incRad, nodeRad, periRad } = entry.data;
            entry.angle += orbitSpeed(entry.data.period) * dt * state.timeSpeed;

            const theta = meanToTrue(entry.angle, e);
            const r = keplerRadius(a, e, theta);
            const rScaled = scaleDist(r);

            const ox = rScaled * Math.cos(theta);
            const oz = rScaled * Math.sin(theta);
            const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);

            entry.mesh.position.set(w.x, w.y, w.z);
        } else {
            entry.angle += orbitSpeed(entry.data.period) * dt * state.timeSpeed;

            const ecc = entry.data.e || 0;
            const theta = meanToTrue(entry.angle, ecc);
            const isMoon = !!entry.parentMesh;
            const kr = keplerRadius(entry.data.distance, ecc, theta);
            const r = isMoon ? kr * MOON_DIST_SCALE * moonScale : scaleDist(kr);
            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;

            if (entry.parentMesh) {
                const px = entry.parentMesh.position.x;
                const pz = entry.parentMesh.position.z;
                entry.mesh.position.set(px + x, 0, pz + z);
                if (entry.orbitLine) {
                    entry.orbitLine.position.set(px, 0, pz);
                    entry.orbitLine.scale.set(moonScale, 1, moonScale);
                }
            } else {
                entry.mesh.position.set(x, 0, z);
            }
        }

        // Trail recording
        const t = entry.trail;
        t.sampleAccum += dt * state.timeSpeed;
        if (t.sampleAccum > 0.02) {
            t.sampleAccum = 0;
            const i3 = t.index * 3;
            t.positions[i3] = entry.mesh.position.x;
            t.positions[i3 + 1] = 0;
            t.positions[i3 + 2] = entry.mesh.position.z;
            t.index = (t.index + 1) % t.maxPoints;
            t.count = Math.min(t.count + 1, t.maxPoints);

            const total = t.count;
            for (let j = 0; j < total; j++) {
                const bufIdx = (t.count >= t.maxPoints)
                    ? (t.index + j) % t.maxPoints
                    : j;
                const fade = j / total;
                t.colors[bufIdx * 3] = t.baseColor.r * fade;
                t.colors[bufIdx * 3 + 1] = t.baseColor.g * fade;
                t.colors[bufIdx * 3 + 2] = t.baseColor.b * fade;
            }

            if (t.count >= t.maxPoints) {
                const pa = t.positions;
                const ca = t.colors;
                const tmpP = t.tmpP;
                const tmpC = t.tmpC;
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
