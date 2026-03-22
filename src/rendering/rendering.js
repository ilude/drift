import * as THREE from 'three';
import { state } from '../core/state.js';
import { scaleDist, MOON_DIST_SCALE, keplerRadius, orbitSpeed, meanToTrue, inclinedPosition } from '../math/orbit.js';
import { isTransferComplete, gameTransferDays } from '../math/transfer.js';
import { bodySize, BODY_MIN_SIZE, moonOrbitScale, realisticSize } from '../math/visual.js';
import { scene, ZOOM_BASE, labelContainer, trailGroups, cometGroup } from './scene.js';
import { seededRandom } from '../core/utils.js';
import { generateBodyTexture, generateCloudTextureForBody, createStarMaterial } from './textures.js';

function nameHash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
    }
    return h;
}

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

    // Cloud layer
    let cloudMesh = null;
    if (!isStar && !isMoon) {
        const cloudTex = generateCloudTextureForBody(data, false);
        if (cloudTex) {
            const cloudGeom = new THREE.SphereGeometry(size * 1.02, 48, 48);
            const cloudMat = new THREE.MeshStandardMaterial({
                map: cloudTex,
                transparent: true,
                depthWrite: false,
                roughness: 1,
                metalness: 0,
            });
            cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
            cloudMesh.visible = false;
            mesh.add(cloudMesh);
        }
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
        data, mesh, selRing, planetRing, cloudMesh, orbitLine, orbitRadius, labelDiv, trail,
        angle: seededRandom(nameHash(data.name))() * Math.PI * 2,
        speed: orbitSpeed(data.period),
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
            angle: seededRandom(nameHash(name))() * Math.PI * 2,
            speed: orbitSpeed(period),
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

const SHIP_SIZE = 0.02;
const SHIP_LOCAL_ORBIT = 1.5;       // world-space radius around host planet
const SHIP_LOCAL_SPEED = Math.PI * 2 / 7;  // ~7 day orbital period (visual clarity over realism)
const SHIP_TAIL_LENGTH = 20;
const shipTailMat = new THREE.LineBasicMaterial({ color: '#999999', transparent: true, opacity: 0.6 });

/**
 * Blend a position toward the target's local orbit over the full transfer.
 * Uses t⁴ so the blend is negligible early (<1% until t≈0.3) and ramps up smoothly.
 * Mutates p in place. Returns 'complete' if within orbit radius, else 'blending'.
 */
function applyCaptureBlend(p, tgtEntry, t) {
    if (!tgtEntry) return 'blending';
    const dist = Math.hypot(p.x - tgtEntry.mesh.position.x, p.z - tgtEntry.mesh.position.z);
    if (dist <= SHIP_LOCAL_ORBIT) return 'complete';
    const angle = Math.atan2(p.z - tgtEntry.mesh.position.z, p.x - tgtEntry.mesh.position.x);
    const orbitX = tgtEntry.mesh.position.x + Math.cos(angle) * SHIP_LOCAL_ORBIT;
    const orbitZ = tgtEntry.mesh.position.z + Math.sin(angle) * SHIP_LOCAL_ORBIT;
    const blend = t * t * t * t;
    p.x = p.x + (orbitX - p.x) * blend;
    p.z = p.z + (orbitZ - p.z) * blend;
    return 'blending';
}

function hermiteEval(p0x, p0z, t0x, t0z, p1x, p1z, t1x, t1z, t) {
    const h00 = (1 + 2 * t) * (1 - t) * (1 - t);
    const h10 = t * (1 - t) * (1 - t);
    const h01 = t * t * (3 - 2 * t);
    const h11 = t * t * (t - 1);
    return {
        x: h00 * p0x + h10 * t0x + h01 * p1x + h11 * t1x,
        z: h00 * p0z + h10 * t0z + h01 * p1z + h11 * t1z,
    };
}

function transferPosition(entry, t) {
    return hermiteEval(
        entry.p0x, entry.p0z, entry.t0x, entry.t0z,
        entry.p1x, entry.p1z, entry.t1x, entry.t1z, t
    );
}

function predictTargetWorld(targetEntry, daysFromNow) {
    const currentAngle = Math.atan2(targetEntry.mesh.position.z, targetEntry.mesh.position.x);
    const arrivalAngle = currentAngle + targetEntry.speed * daysFromNow;
    const targetR = scaleDist(targetEntry.data.distance);
    return {
        x: Math.cos(arrivalAngle) * targetR,
        z: Math.sin(arrivalAngle) * targetR,
    };
}

const SHIP_PATH_LOOKAHEAD = 0.25;  // show 25% of curve ahead
const SHIP_TRANSFER_PTS = 128;     // transfer curve sample points
const SHIP_MAX_ARC_PTS = 48;       // max orbit arc points
const SHIP_PATH_BUFFER = SHIP_TRANSFER_PTS + SHIP_MAX_ARC_PTS + 1; // total buffer capacity

function createTransferPath() {
    const positions = new Float32Array(SHIP_PATH_BUFFER * 3);
    const colors = new Float32Array(SHIP_PATH_BUFFER * 4);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    const mat = new THREE.LineBasicMaterial({
        transparent: true,
        vertexColors: true,
        opacity: 1.0,
    });
    const line = new THREE.Line(geom, mat);
    scene.add(line);
    return line;
}

function updateTransferPath(entry, elapsedDays) {
    if (!entry.transferPath) return;
    const positions = entry.transferPath.geometry.attributes.position.array;
    const colors = entry.transferPath.geometry.attributes.color.array;
    const isSelected = (state.selectedBody === entry);
    const baseAlpha = isSelected ? 0.5 : 0.2;

    const tCurrent = elapsedDays / entry.transferTimeDays;
    const tEnd = Math.min(tCurrent + SHIP_PATH_LOOKAHEAD, 1.0);
    const tRange = tEnd - tCurrent;

    const tgt = findPlanetEntry(entry.transferTarget);

    for (let i = 0; i <= SHIP_TRANSFER_PTS; i++) {
        const frac = i / SHIP_TRANSFER_PTS;
        const t = tCurrent + frac * tRange;
        const p = transferPosition(entry, t);
        applyCaptureBlend(p, tgt, t);
        const idx3 = i * 3;
        positions[idx3] = p.x;
        positions[idx3 + 1] = 0;
        positions[idx3 + 2] = p.z;
        const idx4 = i * 4;
        colors[idx4] = 0.33;
        colors[idx4 + 1] = 0.33;
        colors[idx4 + 2] = 0.33;
        colors[idx4 + 3] = baseAlpha * (1 - frac);
    }
    entry.transferPath.geometry.attributes.position.needsUpdate = true;
    entry.transferPath.geometry.attributes.color.needsUpdate = true;
    entry.transferPath.geometry.setDrawRange(0, SHIP_TRANSFER_PTS + 1);
}


function computeHermiteKnots(departX, departZ, departAngle, targetEntry, gameDays) {
    const targetWorld = predictTargetWorld(targetEntry, gameDays);
    const dist = Math.hypot(targetWorld.x - departX, targetWorld.z - departZ);
    const tangentDir = departAngle + Math.PI / 2;
    // Target orbit tangent (CCW): perpendicular to radial direction
    const targetAngle = Math.atan2(targetWorld.z, targetWorld.x);
    const targetTangentDir = targetAngle + Math.PI / 2;
    return {
        p0x: departX, p0z: departZ,
        t0x: Math.cos(tangentDir) * dist * 0.4,
        t0z: Math.sin(tangentDir) * dist * 0.4,
        p1x: targetWorld.x, p1z: targetWorld.z,
        t1x: Math.cos(targetTangentDir) * dist * 0.3,
        t1z: Math.sin(targetTangentDir) * dist * 0.3,
    };
}

function updateDepartureArc(entry) {
    if (!entry.transferPath || !entry.pendingTransfer) return;
    const host = findPlanetEntry(entry.hostPlanetName);
    if (!host) return;
    const positions = entry.transferPath.geometry.attributes.position.array;
    const colors = entry.transferPath.geometry.attributes.color.array;
    const isSelected = (state.selectedBody === entry);
    const baseAlpha = isSelected ? 0.5 : 0.2;
    const pt = entry.pendingTransfer;

    // Recompute departure angle every 15 frames as planets move
    entry.departFrameCount = (entry.departFrameCount || 0) + 1;
    if (entry.departFrameCount % 15 === 0) {
        const targetEntry = state.bodyMeshes.find(e => e.data.name === pt.targetName && !e.isMoon && !e.isShip);
        if (targetEntry) {
            const targetWorld = predictTargetWorld(targetEntry, pt.gameDays);
            const toTargetDir = Math.atan2(
                targetWorld.z - host.mesh.position.z,
                targetWorld.x - host.mesh.position.x
            );
            pt.optimalLocalAngle = toTargetDir - Math.PI / 2;
        }
    }

    const TWO_PI = Math.PI * 2;
    const curAngle = ((entry.angle % TWO_PI) + TWO_PI) % TWO_PI;
    const tgtAngle = ((pt.optimalLocalAngle % TWO_PI) + TWO_PI) % TWO_PI;

    let sweep = tgtAngle - curAngle;
    if (sweep < 0) sweep += TWO_PI;
    if (sweep > TWO_PI) sweep -= TWO_PI;

    const ARC_PTS = Math.max(4, Math.min(SHIP_MAX_ARC_PTS, Math.round(sweep * 8)));
    let idx = 0;

    // Part 1: orbit arc to departure point
    for (let i = 0; i <= ARC_PTS; i++) {
        const frac = i / ARC_PTS;
        const a = curAngle + frac * sweep;
        const idx3 = idx * 3;
        positions[idx3] = host.mesh.position.x + Math.cos(a) * SHIP_LOCAL_ORBIT;
        positions[idx3 + 1] = 0;
        positions[idx3 + 2] = host.mesh.position.z + Math.sin(a) * SHIP_LOCAL_ORBIT;
        const idx4 = idx * 4;
        colors[idx4] = 0.33;
        colors[idx4 + 1] = 0.33;
        colors[idx4 + 2] = 0.33;
        colors[idx4 + 3] = baseAlpha;
        idx++;
    }

    // Part 2: Hermite spline from departure to predicted target
    const targetEntry = state.bodyMeshes.find(e => e.data.name === pt.targetName && !e.isMoon && !e.isShip);
    if (targetEntry) {
        const departX = host.mesh.position.x + Math.cos(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
        const departZ = host.mesh.position.z + Math.sin(pt.optimalLocalAngle) * SHIP_LOCAL_ORBIT;
        const knots = computeHermiteKnots(departX, departZ, pt.optimalLocalAngle, targetEntry, pt.gameDays);

        for (let i = 1; i <= SHIP_TRANSFER_PTS; i++) {
            const frac = i / SHIP_TRANSFER_PTS;
            const p = hermiteEval(
                knots.p0x, knots.p0z, knots.t0x, knots.t0z,
                knots.p1x, knots.p1z, knots.t1x, knots.t1z, frac
            );
            const idx3 = idx * 3;
            positions[idx3] = p.x;
            positions[idx3 + 1] = 0;
            positions[idx3 + 2] = p.z;
            const idx4 = idx * 4;
            colors[idx4] = 0.33;
            colors[idx4 + 1] = 0.33;
            colors[idx4 + 2] = 0.33;
            colors[idx4 + 3] = baseAlpha * (1 - frac * 0.7);
            idx++;
        }
    }

    entry.transferPath.geometry.attributes.position.needsUpdate = true;
    entry.transferPath.geometry.attributes.color.needsUpdate = true;
    entry.transferPath.geometry.setDrawRange(0, idx);
}

function removeTransferPath(entry) {
    if (entry.transferPath) {
        scene.remove(entry.transferPath);
        entry.transferPath.geometry.dispose();
        entry.transferPath.material.dispose();
        entry.transferPath = null;
    }
}

function findPlanetEntry(name) {
    return state.bodyMeshes.find(e => e.data.name === name && !e.isMoon && !e.isShip);
}

export function createShip() {
    const planets = state.BODIES.filter(b => b.type === 'Planet');
    if (planets.length === 0) return;
    const homePlanet = planets.find(b => b.name === 'Earth')
        || planets.reduce((best, b) => Math.abs(b.distance - 1) < Math.abs(best.distance - 1) ? b : best);

    const geom = new THREE.SphereGeometry(SHIP_SIZE, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: '#bbbbbb', roughness: 0.6, metalness: 0.4 });
    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    const selGeom = new THREE.RingGeometry(SHIP_SIZE * SEL_RING_INNER, SHIP_SIZE * SEL_RING_OUTER, SEL_RING_SEGS);
    const selMat = new THREE.MeshBasicMaterial({
        color: '#44ff44', transparent: true, opacity: 0, side: THREE.DoubleSide
    });
    const selRing = new THREE.Mesh(selGeom, selMat);
    selRing.rotation.x = -Math.PI / 2;
    mesh.add(selRing);

    const labelDiv = createLabel('Ship', '#bbbbbb', false);
    const trail = createTrail('#bbbbbb', TRAIL_MAX_POINTS);

    const entry = {
        data: { name: 'Ship', type: 'Ship', distance: homePlanet.distance, period: 0, radius: 1, color: '#bbbbbb', moons: [] },
        mesh, selRing, planetRing: null, cloudMesh: null, orbitLine: null, orbitRadius: 0,
        labelDiv, trail,
        angle: 0,
        speed: SHIP_LOCAL_SPEED,
        parentMesh: null, moons: [], isMoon: false, isShip: true,
        screenSize: SHIP_SIZE, baseSize: SHIP_SIZE, realisticSize: SHIP_SIZE,
        geomLevels: null, lodLevel: 0,
        // Ship state
        shipState: 'orbiting',
        hostPlanetName: homePlanet.name,
        orbitA: homePlanet.distance,
        // Transfer fields (Hermite spline)
        transferTarget: null,
        transferStartTime: 0,
        transferTimeDays: 0,
        p0x: 0, p0z: 0, t0x: 0, t0z: 0, // Hermite departure point + tangent
        p1x: 0, p1z: 0, t1x: 0, t1z: 0, // Hermite arrival point + tangent
        pendingTransfer: null,
        transferRecalcCounter: 0,
        // Visual: transfer path line and velocity tail
        transferPath: null,
        tailPositions: new Float32Array(SHIP_TAIL_LENGTH * 3),
        tailIndex: 0,
        tailCount: 0,
    };

    // Velocity tail — always visible, short trail showing direction
    const tailGeom = new THREE.BufferGeometry();
    tailGeom.setAttribute('position', new THREE.BufferAttribute(entry.tailPositions, 3));
    tailGeom.setDrawRange(0, 0);
    entry.tailLine = new THREE.Line(tailGeom, shipTailMat);
    scene.add(entry.tailLine);

    state.bodyMeshes.push(entry);
    return entry;
}

function completeTransfer(entry) {
    removeTransferPath(entry);
    const target = findPlanetEntry(entry.transferTarget);

    entry.shipState = 'orbiting';
    entry.hostPlanetName = entry.transferTarget;
    entry.transferTarget = null;
    entry.pendingTransfer = null;
    entry.speed = SHIP_LOCAL_SPEED;

    if (target) {
        entry.data.distance = target.data.distance;
        entry.orbitA = entry.data.distance;

        if (entry.blendTarget) {
            entry.angle = entry.blendTarget.entryAngle;
        } else {
            const dx = entry.mesh.position.x - target.mesh.position.x;
            const dz = entry.mesh.position.z - target.mesh.position.z;
            entry.angle = Math.atan2(dz, dx);
        }
        entry.blendTarget = null;
        // Snap to orbit radius
        const preSnap = { x: entry.mesh.position.x, z: entry.mesh.position.z };
        entry.mesh.position.set(
            target.mesh.position.x + Math.cos(entry.angle) * SHIP_LOCAL_ORBIT,
            0,
            target.mesh.position.z + Math.sin(entry.angle) * SHIP_LOCAL_ORBIT
        );
        console.log('COMPLETE TRANSFER:', {
            to: entry.hostPlanetName,
            entryAngle: `${(entry.angle * 180 / Math.PI).toFixed(1)}°`,
            snapDist: Math.hypot(entry.mesh.position.x - preSnap.x, entry.mesh.position.z - preSnap.z).toFixed(3),
        });
    } else {
        entry.angle = 0;
    }
}

function beginTransfer(entry) {
    const p = entry.pendingTransfer;

    const tgt = findPlanetEntry(p.targetName);
    if (!tgt) return;

    // Compute Hermite spline control points in world space
    const knots = computeHermiteKnots(
        entry.mesh.position.x, entry.mesh.position.z,
        entry.angle, tgt, p.gameDays
    );
    entry.p0x = knots.p0x; entry.p0z = knots.p0z;
    entry.t0x = knots.t0x; entry.t0z = knots.t0z;
    entry.p1x = knots.p1x; entry.p1z = knots.p1z;
    entry.t1x = knots.t1x; entry.t1z = knots.t1z;

    entry.transferStartTime = state.simTime;
    entry.transferTimeDays = p.gameDays;
    entry.transferTarget = p.targetName;
    entry.shipState = 'transferring';
    entry.pendingTransfer = null;
    entry.blendTarget = null;
    entry.transferRecalcCounter = 0;

    removeTransferPath(entry);
    entry.transferPath = createTransferPath();

    // Pre-fill tail buffer with current position to avoid line-to-origin artifact
    for (let i = 0; i < SHIP_TAIL_LENGTH; i++) {
        entry.tailPositions[i * 3] = entry.mesh.position.x;
        entry.tailPositions[i * 3 + 1] = 0;
        entry.tailPositions[i * 3 + 2] = entry.mesh.position.z;
    }
    entry.tailCount = 0;

}

export function initiateTransfer(entry, targetEntry) {
    if (!entry.isShip || entry.shipState === 'transferring' || entry.shipState === 'departing') return;
    const host = findPlanetEntry(entry.hostPlanetName);
    if (!host) return;
    const r1 = host.data.distance;
    const r2 = targetEntry.data.distance;
    if (r1 === r2) return;

    const gameDays = gameTransferDays(r1, r2);

    entry.orbitA = (r1 + r2) / 2;

    // Departure angle: orbit tangent points toward predicted target position
    const targetWorld = predictTargetWorld(targetEntry, gameDays);
    const toTargetDir = Math.atan2(
        targetWorld.z - host.mesh.position.z,
        targetWorld.x - host.mesh.position.x
    );
    const optimalLocalAngle = toTargetDir - Math.PI / 2;

    entry.pendingTransfer = {
        gameDays,
        targetName: targetEntry.data.name,
        optimalLocalAngle,
    };
    entry.shipState = 'departing';

    removeTransferPath(entry);
    entry.transferPath = createTransferPath();
}


export function updateAsteroids(dt) {
    const simDt = dt * state.timeSpeed;
    if (simDt === 0) return;

    state.asteroidBelts.forEach(({ positions, angles, radii, speeds, cosInc, sinInc, cosNode, sinNode, count, points }) => {
        for (let i = 0; i < count; i++) {
            angles[i] += speeds[i] * simDt;
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

export function updatePositions(dt, camDist) {
    const simDt = dt * state.timeSpeed;
    state.simTime += simDt;
    if (simDt === 0) return;

    const zoomFactor = ZOOM_BASE / camDist;
    const moonScale = moonOrbitScale(zoomFactor);
    const recordTrails = state.showTrails;

    state.bodyMeshes.forEach(entry => {
        if (entry.data.distance === 0 && !entry.isComet && !entry.isShip) return;

        // Skip invisible moons
        if (entry.isMoon && !entry.mesh.visible) {
            entry.angle += entry.speed * simDt;
            return;
        }

        if (entry.isShip) {
            if (entry.shipState === 'orbiting' || entry.shipState === 'departing') {
                entry.lastAngle = entry.angle;
                entry.angle += entry.speed * simDt;

                // Local orbit around host planet
                const host = findPlanetEntry(entry.hostPlanetName);
                if (host) {
                    const lx = Math.cos(entry.angle) * SHIP_LOCAL_ORBIT;
                    const lz = Math.sin(entry.angle) * SHIP_LOCAL_ORBIT;
                    entry.mesh.position.set(
                        host.mesh.position.x + lx,
                        0,
                        host.mesh.position.z + lz
                    );

                    // Check if we've crossed the optimal departure angle (frame-safe crossing detector)
                    if (entry.shipState === 'departing' && entry.pendingTransfer) {
                        const TWO_PI = Math.PI * 2;
                        const tgt = ((entry.pendingTransfer.optimalLocalAngle % TWO_PI) + TWO_PI) % TWO_PI;
                        const prev = ((entry.lastAngle % TWO_PI) + TWO_PI) % TWO_PI;
                        const cur = ((entry.angle % TWO_PI) + TWO_PI) % TWO_PI;
                        const crossed = (prev <= tgt && cur >= tgt) ||
                                        (prev > cur && (prev <= tgt || cur >= tgt));
                        if (crossed) beginTransfer(entry);
                    }
                }
            } else if (entry.shipState === 'transferring') {
                const elapsed = state.simTime - entry.transferStartTime;
                if (isTransferComplete(elapsed, entry.transferTimeDays)) {
                    completeTransfer(entry);
                } else {
                    const t = elapsed / entry.transferTimeDays;

                    // Update target prediction every 15 frames (while blend is small)
                    if (t < 0.7) {
                        entry.transferRecalcCounter++;
                        if (entry.transferRecalcCounter >= 15) {
                            entry.transferRecalcCounter = 0;
                            const tgt = findPlanetEntry(entry.transferTarget);
                            if (tgt) {
                                const remainingDays = entry.transferTimeDays - elapsed;
                                const targetWorld = predictTargetWorld(tgt, remainingDays);
                                entry.p1x = targetWorld.x;
                                entry.p1z = targetWorld.z;
                                const dist = Math.hypot(entry.p1x - entry.p0x, entry.p1z - entry.p0z);
                                const targetAngle = Math.atan2(targetWorld.z, targetWorld.x);
                                const targetTangentDir = targetAngle + Math.PI / 2;
                                entry.t1x = Math.cos(targetTangentDir) * dist * 0.3;
                                entry.t1z = Math.sin(targetTangentDir) * dist * 0.3;
                            }
                        }
                    }

                    // Evaluate Hermite spline position
                    const p = transferPosition(entry, t);

                    // Blend toward target's local orbit over the full transfer
                    const tgt = findPlanetEntry(entry.transferTarget);
                    const captureResult = applyCaptureBlend(p, tgt, t);

                    if (captureResult === 'complete') {
                        const dx = p.x - tgt.mesh.position.x;
                        const dz = p.z - tgt.mesh.position.z;
                        entry.blendTarget = { entryAngle: Math.atan2(dz, dx) };
                        completeTransfer(entry);
                        return;
                    }

                    entry.mesh.position.set(p.x, 0, p.z);
                }
            }

            // Transfer path: update lookahead window each frame
            if (entry.transferPath) {
                if (entry.shipState === 'transferring') {
                    const elapsed = state.simTime - entry.transferStartTime;
                    updateTransferPath(entry, elapsed);
                    entry.transferPath.visible = true;
                } else if (entry.shipState === 'departing' && entry.pendingTransfer) {
                    // Show arc from ship to optimal departure point
                    updateDepartureArc(entry);
                    entry.transferPath.visible = true;
                } else {
                    entry.transferPath.visible = false;
                }
            }

            // Velocity tail: hidden during transfer (path preview covers it)
            if (entry.shipState === 'transferring') {
                entry.tailLine.visible = false;
                entry.tailCount = 0;
                entry.tailLine.geometry.setDrawRange(0, 0);
            } else {
                entry.tailLine.visible = false;
                entry.tailCount = 0;
                entry.tailLine.geometry.setDrawRange(0, 0);
            }
        } else if (entry.isComet) {
            const { a, e, incRad, nodeRad, periRad } = entry.data;
            entry.angle += entry.speed * simDt;

            const theta = meanToTrue(entry.angle, e);
            const r = keplerRadius(a, e, theta);
            const rScaled = scaleDist(r);

            const ox = rScaled * Math.cos(theta);
            const oz = rScaled * Math.sin(theta);
            const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);

            entry.mesh.position.set(w.x, w.y, w.z);
        } else {
            entry.angle += entry.speed * simDt;

            const ecc = entry.data.e || 0;
            const theta = meanToTrue(entry.angle, ecc);
            const kr = keplerRadius(entry.data.distance, ecc, theta);
            const r = entry.isMoon ? kr * MOON_DIST_SCALE * moonScale : scaleDist(kr);
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

        // Cloud rotation
        if (entry.cloudMesh && entry.cloudMesh.visible) {
            entry.cloudMesh.rotation.y += simDt * 0.002;
        }

        // Trail recording — skip entirely when trails are hidden
        if (!recordTrails) return;

        const t = entry.trail;
        t.sampleAccum += simDt;
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
