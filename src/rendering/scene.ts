import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Scene
export const scene: THREE.Scene = new THREE.Scene();
scene.background = new THREE.Color("#07070d");

// Lighting
const ambientLight: THREE.AmbientLight = new THREE.AmbientLight("#333333");
scene.add(ambientLight);
const sunLight: THREE.PointLight = new THREE.PointLight("#ffffff", 2, 0, 0.5);
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
export const renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
	antialias: false,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

// Controls
export const controls: OrbitControls = new OrbitControls(
	camera,
	renderer.domElement,
);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 5000;
controls.maxPolarAngle = Math.PI * 0.85;
controls.enableZoom = false;

// Zoom-to-cursor
const zoomPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const zoomRay: THREE.Raycaster = new THREE.Raycaster();
const zoomMouse: THREE.Vector2 = new THREE.Vector2();
const zoomIntersect: THREE.Vector3 = new THREE.Vector3();

renderer.domElement.addEventListener(
	"wheel",
	(e: WheelEvent) => {
		e.preventDefault();
		const zoomIn: boolean = e.deltaY < 0;
		const factor: number = zoomIn ? 0.15 : -0.12;
		const dist: number = camera.position.distanceTo(controls.target);
		const newDist: number = dist * (1 - factor);
		if (newDist < controls.minDistance || newDist > controls.maxDistance)
			return;

		zoomMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
		zoomMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
		zoomRay.setFromCamera(zoomMouse, camera);

		const hit: THREE.Vector3 | null = zoomRay.ray.intersectPlane(
			zoomPlane,
			zoomIntersect,
		);
		if (!hit) return;

		camera.position.x += (zoomIntersect.x - camera.position.x) * factor;
		camera.position.y += (zoomIntersect.y - camera.position.y) * factor;
		camera.position.z += (zoomIntersect.z - camera.position.z) * factor;

		controls.target.x += (zoomIntersect.x - controls.target.x) * factor;
		controls.target.z += (zoomIntersect.z - controls.target.z) * factor;
	},
	{ passive: false },
);

// Shared Three.js groups
export const labelContainer: HTMLDivElement = document.createElement("div");
labelContainer.style.cssText =
	"position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;";
document.body.appendChild(labelContainer);

export const trailGroups: THREE.Group = new THREE.Group();
scene.add(trailGroups);

export const cometGroup: THREE.Group = new THREE.Group();
scene.add(cometGroup);

// Resize handling
window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
