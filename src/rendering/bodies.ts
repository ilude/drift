import * as THREE from "three";
import { rebuildEntityMaps } from "../core/entities";
import { state } from "../core/state";
import { seededRandom } from "../core/utils";
import { estimateMass } from "../data/system-generator";
import {
	inclinedPosition,
	keplerRadius,
	MOON_DIST_SCALE,
	meanToTrue,
	orbitSpeed,
	scaleDist,
} from "../math/orbit";
import { BODY_MIN_SIZE, bodySize, realisticSize } from "../math/visual";
import type {
	AsteroidBeltEntry,
	AsteroidInfo,
	BodyData,
	BodyEntry,
	CometEntry,
	CometEntryData,
	MoonData,
	PlanetEntry,
	TrailState,
	Vector3Like,
} from "../types";
import { cometGroup, labelContainer, scene, trailGroups } from "./scene";
import { createStarMaterial, generateBodyTexture, generateCloudTextureForBody } from "./textures";

export function nameHash(str: string): number {
	let h = 5381;
	for (let i = 0; i < str.length; i++) {
		h = ((h << 5) + h + str.charCodeAt(i)) & 0x7fffffff;
	}
	return h;
}

export function isInKirkwoodGap(
	au: number,
	gaps: Array<{ center: number; width: number }>,
): boolean {
	for (const gap of gaps) {
		if (Math.abs(au - gap.center) < gap.width) return true;
	}
	return false;
}

export function orbitSegmentCount(approxRadius: number): number {
	return Math.min(512, Math.max(128, Math.round(approxRadius * 4)));
}

// Transform orbital plane coordinates to 3D world space using Ω, i, ω
const _orbitOut: Vector3Like = { x: 0, y: 0, z: 0 };

export function orbitToWorld(
	x: number,
	z: number,
	incRad: number,
	nodeRad: number,
	periRad: number,
): Vector3Like {
	const cosW = Math.cos(periRad),
		sinW = Math.sin(periRad);
	const x1 = x * cosW - z * sinW;
	const z1 = x * sinW + z * cosW;

	const cosI = Math.cos(incRad),
		sinI = Math.sin(incRad);
	const x2 = x1;
	const y2 = z1 * sinI;
	const z2 = z1 * cosI;

	const cosN = Math.cos(nodeRad),
		sinN = Math.sin(nodeRad);
	_orbitOut.x = x2 * cosN - z2 * sinN;
	_orbitOut.y = y2;
	_orbitOut.z = x2 * sinN + z2 * cosN;

	return _orbitOut;
}

// Shared geometry/materials for identical bodies
// LOD tiers: [low, medium, high] segment counts
const LOD_SEGS: number[] = [8, 24, 48];
const STAR_LOD_SEGS: number[] = [32, 48, 64];
const MOON_SIZE: number = BODY_MIN_SIZE * 0.6;
const COMET_SIZE: number = BODY_MIN_SIZE * 0.7;
export const SEL_RING_INNER: number = 1.3;
export const SEL_RING_OUTER: number = 1.5;
export const SEL_RING_SEGS: number = 24;
const TRAIL_MAX_POINTS: number = 400;
export const SHIP_TRAIL_MAX_POINTS: number = 80; // short tail, not full path
const COMET_TRAIL_MAX_POINTS: number = 1200;
// Fixed angular step per trail sample -- all comets share the same arc length (based on Tempel 1)
const TEMPEL1_PERIOD = 5.5;
export const COMET_TRAIL_STEP_ARC: number = orbitSpeed(TEMPEL1_PERIOD) * 0.02;
export const COMET_ORBIT_OPACITY: number = 0.03;
export const COMET_ORBIT_SELECTED_OPACITY: number = 0.05;

const UNSURVEYED_ASTEROID_COLOR = [0.545, 0.439, 0.439] as const; // #8B7070 red-grey
export const SURVEYED_ASTEROID_COLOR = [0.439, 0.439, 0.533] as const; // #707088 blue-grey

const sharedMoonGeoms: THREE.SphereGeometry[] = LOD_SEGS.map(
	(s) => new THREE.SphereGeometry(MOON_SIZE, s, s),
);
const sharedCometGeoms: THREE.SphereGeometry[] = LOD_SEGS.map(
	(s) => new THREE.SphereGeometry(COMET_SIZE, s, s),
);
const sharedMoonOrbitMat: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
	color: "#1a2a1a",
	transparent: true,
	opacity: 0.3,
});
const sharedPlanetOrbitMat: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
	color: "#1a3a1a",
	transparent: true,
	opacity: 0.3,
});
const sharedTrailMat: THREE.LineBasicMaterial = new THREE.LineBasicMaterial({
	vertexColors: true,
	transparent: true,
	opacity: 0.7,
});

export const sharedResources: Set<THREE.BufferGeometry | THREE.Material> = new Set([
	...sharedMoonGeoms,
	...sharedCometGeoms,
	sharedMoonOrbitMat,
	sharedPlanetOrbitMat,
	sharedTrailMat,
]);

export function createLabel(name: string, color: string, isMoon: boolean): HTMLDivElement {
	const div = document.createElement("div");
	div.textContent = name;
	div.style.cssText = `
        position: absolute;
        color: ${color};
        font-family: 'Courier New', monospace;
        font-size: ${isMoon ? "9px" : "11px"};
        white-space: nowrap;
        text-shadow: 0 0 4px #000, 0 0 2px #000;
        opacity: ${isMoon ? 0.7 : 0.9};
    `;
	labelContainer.appendChild(div);
	return div;
}

function createOrbitRing(
	a: number,
	e: number,
	toScreen: (d: number) => number,
	mat: THREE.LineBasicMaterial,
): THREE.Line {
	const approxR = toScreen(a);
	const segments = orbitSegmentCount(approxR);
	const positions = new Float32Array((segments + 1) * 3);
	for (let i = 0; i <= segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		const r = toScreen(keplerRadius(a, e, angle));
		positions[i * 3] = Math.cos(angle) * r;
		positions[i * 3 + 1] = 0;
		positions[i * 3 + 2] = Math.sin(angle) * r;
	}
	const geom = new THREE.BufferGeometry();
	geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	return new THREE.Line(geom, mat);
}

export function createTrail(color: string, maxPoints: number): TrailState {
	const geom = new THREE.BufferGeometry();
	const positions = new Float32Array(maxPoints * 3);
	const colors = new Float32Array(maxPoints * 3);
	const indices = new Uint16Array(maxPoints);
	geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
	geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
	geom.setIndex(new THREE.BufferAttribute(indices, 1));
	geom.setDrawRange(0, 0);
	const line = new THREE.Line(geom, sharedTrailMat);
	line.frustumCulled = false;
	line.visible = false;
	trailGroups.add(line);

	const c = new THREE.Color(color);

	return {
		line,
		positions,
		colors,
		indices,
		maxPoints,
		count: 0,
		head: 0,
		baseColor: c,
		sampleAccum: 0,
	};
}

/** Pre-fill a body's trail buffer by computing past orbital positions backwards.
 *  Used for Dwarf Planets, Centaurs, and named Asteroids so they show trails
 *  instead of orbit rings (same visual treatment as comets, but 2D orbits). */
function prefillBodyTrail(entry: PlanetEntry): void {
	const t = entry.trail;
	const ecc = entry.data.e || 0;
	const stepAngle = Math.abs(entry.speed) * 0.02; // same sampling density as comets
	if (stepAngle === 0) return;

	for (let i = 0; i < t.maxPoints; i++) {
		const pastAngle = entry.angle - stepAngle * (t.maxPoints - i);
		const theta = meanToTrue(pastAngle, ecc);
		const kr = keplerRadius(entry.data.distance, ecc, theta);
		const r = scaleDist(kr);
		const i3 = i * 3;
		t.positions[i3] = Math.cos(theta) * r;
		t.positions[i3 + 1] = 0;
		t.positions[i3 + 2] = Math.sin(theta) * r;
		const fade = i / t.maxPoints;
		t.colors[i3] = t.baseColor.r * fade;
		t.colors[i3 + 1] = t.baseColor.g * fade;
		t.colors[i3 + 2] = t.baseColor.b * fade;
	}
	t.count = t.maxPoints;
	t.head = 0;
	for (let i = 0; i < t.maxPoints; i++) t.indices[i] = i;
	t.line.geometry.attributes.position.needsUpdate = true;
	t.line.geometry.attributes.color.needsUpdate = true;
	(t.line.geometry.index as THREE.BufferAttribute).needsUpdate = true;
	t.line.geometry.setDrawRange(0, t.count);
	t.line.visible = true;
}

/** Create geometry levels and material for a body. */
function createGeometryAndMaterial(
	data: BodyData,
	size: number,
	isStar: boolean,
	isMoon: boolean,
): { geomLevels: THREE.SphereGeometry[]; mat: THREE.Material } {
	const segs = isStar ? STAR_LOD_SEGS : LOD_SEGS;
	const geomLevels = isMoon
		? sharedMoonGeoms
		: segs.map((s) => new THREE.SphereGeometry(size, s, s));
	let mat: THREE.Material;
	if (isStar) {
		mat = createStarMaterial(data.color);
	} else {
		const texture = generateBodyTexture(data, isMoon);
		mat = new THREE.MeshStandardMaterial({
			map: texture,
			roughness: 0.8,
			metalness: 0.1,
		});
	}
	return { geomLevels, mat };
}

/** Create planetary rings if the body has ring data. */
function createPlanetRings(data: BodyData, size: number, mesh: THREE.Mesh): THREE.Mesh | null {
	if (!data.rings) return null;

	const innerR = size * data.rings.inner;
	const outerR = size * data.rings.outer;
	const opacity = data.rings.opacity || 1;
	const ringGeom = new THREE.RingGeometry(innerR, outerR, 64);
	const canvas = document.createElement("canvas");
	canvas.width = 256;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Failed to get 2D context");
	const grad = ctx.createLinearGradient(0, 0, 256, 0);
	const a = (v: number): number => Math.round(v * opacity * 255);
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
	const uvAttr = ringGeom.attributes.uv as THREE.BufferAttribute;
	const posAttr = ringGeom.attributes.position as THREE.BufferAttribute;
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
	const planetRing = new THREE.Mesh(ringGeom, ringMat);
	const tiltRad = ((data.rings.tilt || 0) * Math.PI) / 180;
	planetRing.rotation.x = -Math.PI / 2 + tiltRad;
	planetRing.visible = false;
	mesh.add(planetRing);
	return planetRing;
}

/** Create cloud layer if applicable. */
function createCloudLayer(
	data: BodyData,
	size: number,
	isStar: boolean,
	isMoon: boolean,
	mesh: THREE.Mesh,
): THREE.Mesh | null {
	if (isStar || isMoon) return null;

	const cloudTex = generateCloudTextureForBody(data, false);
	if (!cloudTex) return null;

	const cloudGeom = new THREE.SphereGeometry(size * 1.02, 48, 48);
	const cloudMat = new THREE.MeshStandardMaterial({
		map: cloudTex,
		transparent: true,
		depthWrite: false,
		roughness: 1,
		metalness: 0,
	});
	const cloudMesh = new THREE.Mesh(cloudGeom, cloudMat);
	cloudMesh.visible = false;
	mesh.add(cloudMesh);
	return cloudMesh;
}

/** Create orbit ring for the body. */
function createOrbitRingIfNeeded(
	data: BodyData,
	isMoon: boolean,
): { orbitLine: THREE.Line | null; orbitRadius: number } {
	if (data.distance <= 0) return { orbitLine: null, orbitRadius: 0 };

	const ecc = data.e || 0;
	const toScreen = isMoon ? (d: number) => d * MOON_DIST_SCALE : scaleDist;
	const orbitRadius = toScreen(data.distance);
	const orbitLine = createOrbitRing(
		data.distance,
		ecc,
		toScreen,
		isMoon ? sharedMoonOrbitMat : sharedPlanetOrbitMat,
	);
	if (isMoon) orbitLine.visible = false;
	scene.add(orbitLine);
	return { orbitLine, orbitRadius };
}

function createBody(data: BodyData, parentMesh: THREE.Mesh | null): PlanetEntry {
	const isStar = data.type === "Star";
	const isMoon = !!parentMesh;

	const size = isMoon ? MOON_SIZE : bodySize(data.radius, isStar);

	const { geomLevels, mat } = createGeometryAndMaterial(data, size, isStar, isMoon);
	const mesh = new THREE.Mesh(geomLevels[0], mat);
	mesh.userData.baseSize = size;

	const planetRing = createPlanetRings(data, size, mesh);
	const cloudMesh = createCloudLayer(data, size, isStar, isMoon, mesh);

	const selGeom = new THREE.RingGeometry(
		size * SEL_RING_INNER,
		size * SEL_RING_OUTER,
		SEL_RING_SEGS,
	);
	const selMat = new THREE.MeshBasicMaterial({
		color: "#44ff44",
		transparent: true,
		opacity: 0,
		side: THREE.DoubleSide,
	});
	const selRing = new THREE.Mesh(selGeom, selMat);
	selRing.rotation.x = -Math.PI / 2;
	mesh.add(selRing);

	scene.add(mesh);

	const { orbitLine, orbitRadius } = createOrbitRingIfNeeded(data, isMoon);

	const labelDiv = createLabel(data.name, isMoon ? "#4a6a4a" : data.color, isMoon);
	const trail = createTrail(data.color, TRAIL_MAX_POINTS);

	const entry: PlanetEntry = {
		data,
		mesh,
		selRing,
		planetRing,
		cloudMesh,
		orbitLine,
		orbitRadius,
		labelDiv,
		trail,
		angle: seededRandom(nameHash(data.name))() * Math.PI * 2,
		speed: orbitSpeed(data.period),
		parentMesh,
		moons: [],
		isMoon,
		...(isStar ? {} : { survey: { surveyLevel: 0, deposits: [] } }),
		screenSize: size,
		baseSize: size,
		realisticSize: isMoon || !data.radius ? size : realisticSize(data.radius),
		geomLevels,
		lodLevel: 0,
	};

	state.bodyMeshes.push(entry);

	// Pre-fill trails for minor body types (like comets, but 2D orbits)
	if (data.type === "Dwarf Planet" || data.type === "Centaur" || data.type === "Asteroid") {
		prefillBodyTrail(entry);
		if (entry.orbitLine) entry.orbitLine.visible = false;
	}

	if (data.moons) {
		data.moons.forEach((moonData) => {
			const moonEntry = createBody(
				{ ...moonData, type: "Moon" as const, moons: [] } as BodyData,
				mesh,
			);
			entry.moons.push(moonEntry);
		});
	}

	return entry;
}

export function createBodies(): void {
	state.BODIES?.forEach((b) => {
		if (!b.type || b.type !== "Moon") createBody(b, null);
	});
	rebuildEntityMaps();
}

export function createComets(): void {
	state.COMETS?.forEach((comet) => {
		const { a, e, inc, node, peri, color, name, period } = comet;
		const incRad = (inc * Math.PI) / 180;
		const nodeRad = (node * Math.PI) / 180;
		const periRad = (peri * Math.PI) / 180;
		const perihelionAU = a * (1 - e);

		const segments = e > 0.9 ? 2048 : 512;
		const orbitPoints: THREE.Vector3[] = [];
		for (let i = 0; i <= segments; i++) {
			const E = (i / segments) * Math.PI * 2;
			const theta =
				2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
			const r = (a * (1 - e * e)) / (1 + e * Math.cos(theta));
			const rScaled = scaleDist(r);
			const ox = rScaled * Math.cos(theta);
			const oz = rScaled * Math.sin(theta);
			const w = orbitToWorld(ox, oz, incRad, nodeRad, periRad);
			orbitPoints.push(new THREE.Vector3(w.x, w.y, w.z));
		}
		const orbitGeom = new THREE.BufferGeometry().setFromPoints(orbitPoints);
		const orbitMat = new THREE.LineBasicMaterial({
			color,
			transparent: true,
			opacity: COMET_ORBIT_OPACITY,
		});
		const orbitLine = new THREE.Line(orbitGeom, orbitMat);
		cometGroup.add(orbitLine);

		const size = COMET_SIZE;
		const mat = new THREE.MeshStandardMaterial({
			color,
			roughness: 0.9,
			metalness: 0,
		});
		const mesh = new THREE.Mesh(sharedCometGeoms[0], mat);

		const selGeom = new THREE.RingGeometry(
			size * SEL_RING_INNER,
			size * SEL_RING_OUTER,
			SEL_RING_SEGS,
		);
		const selMat = new THREE.MeshBasicMaterial({
			color: "#44ff44",
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
		});
		const selRing = new THREE.Mesh(selGeom, selMat);
		selRing.rotation.x = -Math.PI / 2;
		mesh.add(selRing);
		scene.add(mesh);

		const labelDiv = createLabel(name, color, false);
		const trail = createTrail(color, COMET_TRAIL_MAX_POINTS);

		const entry = {
			data: {
				name,
				type: "Comet" as const,
				distance: perihelionAU,
				period,
				radius: 5,
				color,
				moons: [] as MoonData[],
				a,
				e,
				inc,
				incRad,
				nodeRad,
				periRad,
				mass: comet.mass,
			} as CometEntryData,
			mesh,
			selRing,
			orbitLine,
			orbitRadius: 0,
			labelDiv,
			trail,
			angle: seededRandom(nameHash(name))() * Math.PI * 2,
			speed: orbitSpeed(period),
			parentMesh: null,
			moons: [] as BodyEntry[],
			isMoon: false,
			isComet: true as const,
			survey: { surveyLevel: 0, deposits: [] },
			screenSize: size,
			geomLevels: sharedCometGeoms,
			lodLevel: 0,
		} as CometEntry;

		// Pre-fill trail by computing past orbital positions.
		// All comets use the same angular step so trails have consistent arc length.
		const t = entry.trail;
		const stepAngle = COMET_TRAIL_STEP_ARC;
		for (let i = 0; i < t.maxPoints; i++) {
			const pastAngle = entry.angle - stepAngle * (t.maxPoints - i);
			const pastTheta = meanToTrue(pastAngle, e);
			const pastR = keplerRadius(a, e, pastTheta);
			const pastRScaled = scaleDist(pastR);
			const pastOx = pastRScaled * Math.cos(pastTheta);
			const pastOz = pastRScaled * Math.sin(pastTheta);
			const pastW = orbitToWorld(pastOx, pastOz, incRad, nodeRad, periRad);
			const i3 = i * 3;
			t.positions[i3] = pastW.x;
			t.positions[i3 + 1] = pastW.y;
			t.positions[i3 + 2] = pastW.z;
			const fade = i / t.maxPoints;
			t.colors[i3] = t.baseColor.r * fade;
			t.colors[i3 + 1] = t.baseColor.g * fade;
			t.colors[i3 + 2] = t.baseColor.b * fade;
		}
		t.count = t.maxPoints;
		t.head = 0; // Buffer full, next write wraps to index 0
		// Initialize index: linear order since pre-fill wrote 0..maxPoints-1
		for (let i = 0; i < t.maxPoints; i++) t.indices[i] = i;
		t.line.geometry.attributes.position.needsUpdate = true;
		t.line.geometry.attributes.color.needsUpdate = true;
		(t.line.geometry.index as THREE.BufferAttribute).needsUpdate = true;
		t.line.geometry.setDrawRange(0, t.count);
		t.line.visible = true;

		// Hide orbit line since comets default to trails
		if (entry.orbitLine) entry.orbitLine.visible = false;

		state.bodyMeshes.push(entry);
	});
}

export function createAsteroidBelts(): AsteroidBeltEntry[] {
	return (state.ASTEROID_BELTS ?? []).map((belt) => {
		const rng = seededRandom(belt.name.length * 7919);
		const prefix = belt.name.includes("Belt")
			? belt.name.split(" ")[0].substring(0, 2).toUpperCase()
			: "AB";
		const maxIncRad = ((belt.maxInc || 0) * Math.PI) / 180;
		const count = belt.count;
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
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
		const asteroids: AsteroidInfo[] = [];

		const kirkwoodGaps =
			belt.name === "Main Belt"
				? [
						{ center: 2.06, width: 0.03 },
						{ center: 2.5, width: 0.04 },
						{ center: 2.82, width: 0.03 },
						{ center: 2.96, width: 0.03 },
						{ center: 3.28, width: 0.04 },
					]
				: [];

		for (let i = 0; i < count; i++) {
			let au: number;
			do {
				au = belt.minAU + rng() * (belt.maxAU - belt.minAU);
			} while (isInKirkwoodGap(au, kirkwoodGaps));
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
			const cosI = Math.cos(inc),
				sinI = Math.sin(inc);
			const cosN = Math.cos(nodeAngle),
				sinN = Math.sin(nodeAngle);
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
			colors[i * 3] = UNSURVEYED_ASTEROID_COLOR[0];
			colors[i * 3 + 1] = UNSURVEYED_ASTEROID_COLOR[1];
			colors[i * 3 + 2] = UNSURVEYED_ASTEROID_COLOR[2];

			asteroids.push({
				designation: `${prefix}-${String(i + 1).padStart(4, "0")}`,
				au: Math.round(au * 1000) / 1000,
				period: Math.round(period * 100) / 100,
				diameter,
				mass: estimateMass(diameter / 2, 3000),
				survey: { surveyLevel: 0, deposits: [] },
				beltIndex: i,
			});
		}

		const geom = new THREE.BufferGeometry();
		geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
		geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
		const mat = new THREE.PointsMaterial({
			vertexColors: true,
			size: belt.size,
			sizeAttenuation: true,
		});
		const points = new THREE.Points(geom, mat);
		scene.add(points);

		return {
			belt,
			points,
			positions,
			colors,
			angles,
			radii,
			speeds,
			inclinations,
			nodeAngles,
			cosInc,
			sinInc,
			cosNode,
			sinNode,
			yOffsets,
			count,
			asteroids,
		};
	});
}
