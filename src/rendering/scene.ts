import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { DIST_SCALE } from "../math/orbit";

// Scene
export const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color("#07070d");

// Lighting
const ambientLight: THREE.AmbientLight = new THREE.AmbientLight("#444444");
scene.add(ambientLight);
const sunLight: THREE.PointLight = new THREE.PointLight("#ffffff", 2, 0, 2.0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// Camera
export const ZOOM_BASE: number = 300;
export const camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	5000,
);
camera.position.set(0, ZOOM_BASE, 200);
camera.lookAt(0, 0, 0);

// Renderer
const container = document.getElementById("canvas-container");
if (!container) throw new Error("Canvas container not found");
export let renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
	antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Controls
export let controls: OrbitControls = new OrbitControls(camera, renderer.domElement);

function configureControls(ctrl: OrbitControls): void {
	ctrl.enableDamping = true;
	ctrl.dampingFactor = 0.08;
	ctrl.minDistance = 5;
	ctrl.maxDistance = 5000;
	ctrl.maxPolarAngle = Math.PI * 0.85;
	ctrl.enableZoom = false;
}
configureControls(controls);

// Zoom-to-cursor
const zoomRay: THREE.Raycaster = new THREE.Raycaster();
const zoomMouse: THREE.Vector2 = new THREE.Vector2();
const zoomIntersect: THREE.Vector3 = new THREE.Vector3();
const zoomPlane: THREE.Plane = new THREE.Plane();
const zoomOffset: THREE.Vector3 = new THREE.Vector3();

function attachZoomHandler(canvas: HTMLCanvasElement): void {
	canvas.addEventListener(
		"wheel",
		(e: WheelEvent) => {
			e.preventDefault();
			const zoomIn: boolean = e.deltaY < 0;
			const factor: number = zoomIn ? 0.15 : -0.12;
			const dist: number = camera.position.distanceTo(controls.target);
			const newDist: number = dist * (1 - factor);
			if (newDist < controls.minDistance || newDist > controls.maxDistance) return;

			zoomMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
			zoomMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
			zoomRay.setFromCamera(zoomMouse, camera);

			// Intersect cursor ray with horizontal plane at target's y
			zoomPlane.set(new THREE.Vector3(0, 1, 0), -controls.target.y);
			if (!zoomRay.ray.intersectPlane(zoomPlane, zoomIntersect)) return;

			// Pan target toward cursor on ecliptic (xz only)
			const panX = (zoomIntersect.x - controls.target.x) * factor;
			const panZ = (zoomIntersect.z - controls.target.z) * factor;
			controls.target.x += panX;
			controls.target.z += panZ;
			camera.position.x += panX;
			camera.position.z += panZ;

			// Zoom: scale camera-target offset uniformly (preserves viewing angle)
			zoomOffset.subVectors(camera.position, controls.target);
			zoomOffset.multiplyScalar(1 - factor);
			camera.position.copy(controls.target).add(zoomOffset);
		},
		{ passive: false },
	);
}
attachZoomHandler(renderer.domElement);

// Antialias toggle -- requires renderer recreation
export function setAntialias(enabled: boolean): void {
	const oldTarget = controls.target.clone();
	controls.dispose();
	container?.removeChild(renderer.domElement);
	renderer.dispose();

	renderer = new THREE.WebGLRenderer({ antialias: enabled });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	container?.appendChild(renderer.domElement);

	controls = new OrbitControls(camera, renderer.domElement);
	configureControls(controls);
	controls.target.copy(oldTarget);

	attachZoomHandler(renderer.domElement);

	// Re-attach click handler from selection module
	window.dispatchEvent(new CustomEvent("renderer-replaced"));
}

// Shared Three.js groups
export const labelContainer: HTMLDivElement = document.createElement("div");
labelContainer.style.cssText =
	"position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
document.body.appendChild(labelContainer);

export const trailGroups: THREE.Group = new THREE.Group();
scene.add(trailGroups);

export const cometGroup: THREE.Group = new THREE.Group();
scene.add(cometGroup);

// AU distance rings
const AU_RINGS = [1, 5, 10, 30];
const RING_SEGMENTS = 64;
const ringMat = new THREE.LineBasicMaterial({ color: 0x4488aa, transparent: true, opacity: 0.06 });

export const auRings: THREE.Line[] = [];
export const auRingLabels: HTMLDivElement[] = [];

for (const au of AU_RINGS) {
	const worldR = Math.sqrt(au) * DIST_SCALE;
	const pts = new Float32Array((RING_SEGMENTS + 1) * 3);
	for (let i = 0; i <= RING_SEGMENTS; i++) {
		const angle = (i / RING_SEGMENTS) * Math.PI * 2;
		pts[i * 3] = Math.cos(angle) * worldR;
		pts[i * 3 + 1] = 0;
		pts[i * 3 + 2] = Math.sin(angle) * worldR;
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
	const ring = new THREE.Line(geo, ringMat);
	scene.add(ring);
	auRings.push(ring);

	const label = document.createElement("div");
	label.style.cssText =
		"position:absolute;color:#4488aa;font-family:'Courier New',monospace;" +
		"font-size:9px;white-space:nowrap;opacity:0.5;pointer-events:none;";
	label.textContent = `${au} AU`;
	labelContainer.appendChild(label);
	auRingLabels.push(label);
}

// Resize handling
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
