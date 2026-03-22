import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { scaleDist } from './orbit.js';

// Scene
export const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070d');

// Lighting
const ambientLight = new THREE.AmbientLight('#333333');
scene.add(ambientLight);
const sunLight = new THREE.PointLight('#ffffff', 2, 0, 0.5);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// Camera
export const ZOOM_BASE = 120;
export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, ZOOM_BASE, 80);
camera.lookAt(0, 0, 0);

// Renderer
export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Controls
export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 5000;
controls.maxPolarAngle = Math.PI * 0.85;
controls.enableZoom = false;

// Zoom-to-cursor
const zoomPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const zoomRay = new THREE.Raycaster();
const zoomMouse = new THREE.Vector2();
const zoomIntersect = new THREE.Vector3();

renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIn = e.deltaY < 0;
    const factor = zoomIn ? 0.15 : -0.12;
    const dist = camera.position.distanceTo(controls.target);
    const newDist = dist * (1 - factor);
    if (newDist < controls.minDistance || newDist > controls.maxDistance) return;

    zoomMouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    zoomMouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    zoomRay.setFromCamera(zoomMouse, camera);

    const hit = zoomRay.ray.intersectPlane(zoomPlane, zoomIntersect);
    if (!hit) return;

    camera.position.x += (zoomIntersect.x - camera.position.x) * factor;
    camera.position.y += (zoomIntersect.y - camera.position.y) * factor;
    camera.position.z += (zoomIntersect.z - camera.position.z) * factor;

    controls.target.x += (zoomIntersect.x - controls.target.x) * factor;
    controls.target.z += (zoomIntersect.z - controls.target.z) * factor;
}, { passive: false });

// Shared Three.js groups
export const labelContainer = document.createElement('div');
labelContainer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;';
document.body.appendChild(labelContainer);

export const trailGroups = new THREE.Group();
scene.add(trailGroups);

export const cometGroup = new THREE.Group();
scene.add(cometGroup);

export const gridGroup = new THREE.Group();
gridGroup.visible = false;
scene.add(gridGroup);

// Distance grid rings
const auMarkers = [0.5, 1, 2, 5, 10, 20, 30];
auMarkers.forEach(au => {
    const r = scaleDist(au);
    const geom = new THREE.RingGeometry(r - 0.02, r + 0.02, 128);
    const mat = new THREE.MeshBasicMaterial({ color: '#111118', side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geom, mat);
    ring.rotation.x = -Math.PI / 2;
    gridGroup.add(ring);
});

// Resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
