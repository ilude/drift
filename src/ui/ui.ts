import * as THREE from "three";
import {
	formatDateTime,
	simTimeToDate,
	state,
	truncateDate,
} from "../core/state";
import { generateSystem } from "../data/system-generator";
import {
	bodyScaleFactor,
	screenRadius as calcScreenRadius,
	lodLevel,
	MOON_LOD_ZOOM,
} from "../math/visual";
import { camera, gridGroup, ZOOM_BASE } from "../rendering/scene";
import type { BodyEntry, SystemData } from "../types";
import { isShipEntry } from "../types";
import { recenterOnStar, selectBody } from "./selection";

// --- Body list panel ---

const bodyListEl = document.getElementById("body-list") as HTMLElement;

export function buildBodyList(): void {
	bodyListEl.innerHTML = "";

	const groups: Record<string, BodyEntry[]> = {};
	const groupOrder = [
		"Star",
		"Planet",
		"Dwarf Planet",
		"Detached Object",
		"Comet",
		"Ship",
	];
	state.bodyMeshes.forEach((entry) => {
		if (entry.isMoon) return;
		const type = entry.data.type;
		if (!groups[type]) groups[type] = [];
		groups[type].push(entry);
	});

	const groupLabels: Record<string, string> = {
		Star: "Stars",
		Planet: "Planets",
		"Dwarf Planet": "Dwarf Planets",
		"Detached Object": "Detached Objects",
		Comet: "Comets",
		Ship: "Ships",
	};

	groupOrder.forEach((type) => {
		const entries = groups[type];
		if (!entries || entries.length === 0) return;

		const section = document.createElement("div");
		section.className = "body-group";

		const header = document.createElement("div");
		header.className = "body-group-header";
		header.innerHTML = `<span class="body-group-toggle">[-]</span> ${groupLabels[type] || type} <span class="body-group-count">(${entries.length})</span>`;
		section.appendChild(header);

		const list = document.createElement("div");
		list.className = "body-group-list";
		section.appendChild(list);

		header.addEventListener("click", () => {
			const collapsed = list.style.display === "none";
			list.style.display = collapsed ? "" : "none";
			const toggle = header.querySelector(".body-group-toggle");
			if (toggle) toggle.textContent = collapsed ? "[-]" : "[+]";
		});

		entries.forEach((entry) => {
			const hasMoons = entry.moons && entry.moons.length > 0;
			const item = document.createElement("div");
			item.className = "body-list-item";
			const toggleSpan = hasMoons ? `<span class="moon-toggle">[+]</span>` : "";
			item.innerHTML = `<span class="body-color-dot" style="background:${entry.data.color}"></span>
                <span class="body-list-name">${entry.data.name}</span>${toggleSpan}`;
			item.addEventListener("click", (e) => {
				if ((e.target as HTMLElement).classList.contains("moon-toggle")) {
					const moonList = item.nextElementSibling;
					if (moonList?.classList.contains("moon-sublist")) {
						const collapsed =
							(moonList as HTMLElement).style.display === "none";
						(moonList as HTMLElement).style.display = collapsed ? "" : "none";
						(e.target as HTMLElement).textContent = collapsed ? "[-]" : "[+]";
					}
					return;
				}
				selectBody(entry);
			});
			list.appendChild(item);

			if (hasMoons) {
				const moonList = document.createElement("div");
				moonList.className = "moon-sublist";
				moonList.style.display = "none";
				entry.moons.forEach((moon) => {
					const mItem = document.createElement("div");
					mItem.className = "body-list-item moon";
					mItem.innerHTML = `<span class="body-color-dot" style="background:${moon.data.color}"></span>
                        <span class="body-list-name">${moon.data.name}</span>`;
					mItem.addEventListener("click", () => selectBody(moon));
					moonList.appendChild(mItem);
				});
				list.appendChild(moonList);
			}
		});

		bodyListEl.appendChild(section);
	});
}

// --- System switcher ---

export function hashString(str: string): number {
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) + hash + str.charCodeAt(i);
		hash = hash & 0x7fffffff;
	}
	return hash || 1;
}

function rebuildSystemList(): void {
	const list = document.getElementById("system-list");
	if (!list) return;
	list.innerHTML = "";
	state.discoveredSystems.forEach((sys, key) => {
		const item = document.createElement("div");
		item.className = `system-list-item${key === state.currentSystemKey ? " active" : ""}`;
		item.textContent = sys.name;
		item.addEventListener("click", () => switchToSystem(key));
		list.appendChild(item);
	});
}

// loadSystem is passed in from main via setupUI
let _loadSystem: ((systemData: SystemData) => void) | null = null;

function switchToSystem(key: string): void {
	if (key === state.currentSystemKey) return;
	const sys = state.discoveredSystems.get(key);
	if (!sys) return;
	state.currentSystemKey = key;
	if (_loadSystem) _loadSystem(sys.systemData);
	rebuildSystemList();
}

function discoverSystem(seed: number): void {
	const key = `seed-${seed}`;
	if (!state.discoveredSystems.has(key)) {
		const systemData = generateSystem(seed);
		state.discoveredSystems.set(key, {
			name: systemData.name,
			seed,
			systemData,
		});
	}
	switchToSystem(key);
}

// --- Labels ---

const tempVec = new THREE.Vector3();
const edgeVec = new THREE.Vector3();

let lastScaleFactor = -1;
let lastLodCamDist = -1;

export function updateLabels(camDist: number): void {
	const showLabels = state.showLabels;
	const showOrbits = state.showOrbits;
	const zoomFactor = ZOOM_BASE / camDist;
	const moonsVisible = zoomFactor > MOON_LOD_ZOOM;
	const scaleFactor = bodyScaleFactor(zoomFactor);
	const fov = camera.fov;
	const screenH = window.innerHeight;
	const screenW = window.innerWidth;

	const needsScaleUpdate = scaleFactor !== lastScaleFactor;
	const needsLodUpdate =
		lastLodCamDist < 0 ||
		Math.abs(camDist - lastLodCamDist) / lastLodCamDist > 0.05;

	state.bodyMeshes.forEach((entry) => {
		if (entry.isMoon && entry.parentMesh) {
			entry.mesh.visible = moonsVisible;
			if (entry.orbitLine) entry.orbitLine.visible = moonsVisible && showOrbits;
			if (!moonsVisible) {
				entry.labelDiv.style.display = "none";
				return;
			}
		}

		if (
			!entry.isMoon &&
			!entry.isComet &&
			!entry.isShip &&
			"baseSize" in entry
		) {
			if (needsScaleUpdate) {
				const scaledSize =
					entry.baseSize + scaleFactor * (entry.realisticSize - entry.baseSize);
				const s = scaledSize / entry.baseSize;
				entry.mesh.scale.set(s, s, s);
				entry.screenSize = scaledSize;
			}
		}

		tempVec.copy(entry.mesh.position);
		tempVec.project(camera);

		if (tempVec.z > 1) {
			entry.labelDiv.style.display = "none";
			return;
		}

		const cx = (tempVec.x * 0.5 + 0.5) * screenW;
		const cy = (-tempVec.y * 0.5 + 0.5) * screenH;

		const margin = 100;
		if (
			cx < -margin ||
			cx > screenW + margin ||
			cy < -margin ||
			cy > screenH + margin
		) {
			entry.labelDiv.style.display = "none";
			return;
		}

		entry.labelDiv.style.display = showLabels ? "" : "none";

		const radius = entry.screenSize || 0.3;
		const dist = edgeVec
			.copy(entry.mesh.position)
			.sub(camera.position)
			.length();
		const sr = calcScreenRadius(radius, dist, fov, screenH);

		// LOD: swap sphere geometry based on screen size
		if (needsLodUpdate && entry.geomLevels) {
			const level = lodLevel(sr);
			if (level !== entry.lodLevel) {
				entry.mesh.geometry = entry.geomLevels[level];
				entry.lodLevel = level;
			}
		}

		if ("planetRing" in entry && entry.planetRing) {
			entry.planetRing.visible = sr > 15;
		}
		if ("cloudMesh" in entry && entry.cloudMesh) {
			entry.cloudMesh.visible = sr > 15;
		}

		const gap = Math.max(6, sr * 0.2);
		const lx = cx + sr + gap;
		const ly = cy - 6;
		if (
			entry.labelX === undefined ||
			entry.labelY === undefined ||
			Math.abs(lx - entry.labelX) > 0.5 ||
			Math.abs(ly - entry.labelY) > 0.5
		) {
			entry.labelDiv.style.transform = `translate(${lx}px, ${ly}px)`;
			entry.labelX = lx;
			entry.labelY = ly;
		}
	});

	if (needsScaleUpdate) lastScaleFactor = scaleFactor;
	if (needsLodUpdate) lastLodCamDist = camDist;
}

// --- HUD ---

const fpsEl = document.getElementById("fps-display") as HTMLElement;
const timeEl = document.getElementById("time-display") as HTMLElement;
const zoomEl = document.getElementById("zoom-display") as HTMLElement;
let fpsFrames = 0;
let fpsLastTime = performance.now();
let fpsValue = 0;
let lastTimeText = "";
let lastZoomText = "";
let lastHudSimTime = -1;
let lastHudTimeSpeed = -1;

export function updateHUD(camDist: number): void {
	fpsFrames++;
	const now = performance.now();
	if (now - fpsLastTime >= 500) {
		fpsValue = Math.round(fpsFrames / ((now - fpsLastTime) / 1000));
		fpsFrames = 0;
		fpsLastTime = now;
		fpsEl.textContent = `FPS: ${fpsValue}`;
	}

	if (
		state.simTime !== lastHudSimTime ||
		state.timeSpeed !== lastHudTimeSpeed
	) {
		lastHudSimTime = state.simTime;
		lastHudTimeSpeed = state.timeSpeed;
		const d = truncateDate(simTimeToDate(state.simTime), state.timeSpeed);
		const timeText = formatDateTime(d);
		if (timeText !== lastTimeText) {
			timeEl.textContent = timeText;
			lastTimeText = timeText;
		}
	}

	const zoomText = `Zoom: ${(ZOOM_BASE / camDist).toFixed(2)}x`;
	if (zoomText !== lastZoomText) {
		zoomEl.textContent = zoomText;
		lastZoomText = zoomText;
	}
}

// --- Perf timing overlay ---

export interface PerfTimings {
	positions: number;
	asteroids: number;
	labels: number;
	hud: number;
	render: number;
	total: number;
}

const perfEl = document.getElementById("perf-display") as HTMLElement | null;
let perfVisible = false;
let perfFrames = 0;
let perfAccum: PerfTimings = {
	positions: 0,
	asteroids: 0,
	labels: 0,
	hud: 0,
	render: 0,
	total: 0,
};
let perfLastUpdate = performance.now();

document.addEventListener("keydown", (e) => {
	if (e.key === "F4") {
		e.preventDefault();
		perfVisible = !perfVisible;
		if (perfEl) {
			perfEl.classList.toggle("hidden", !perfVisible);
			if (!perfVisible) perfEl.textContent = "";
		}
	}
});

export function updatePerfDisplay(timings: PerfTimings): void {
	if (!perfVisible || !perfEl) return;
	perfFrames++;
	perfAccum.positions += timings.positions;
	perfAccum.asteroids += timings.asteroids;
	perfAccum.labels += timings.labels;
	perfAccum.hud += timings.hud;
	perfAccum.render += timings.render;
	perfAccum.total += timings.total;

	const now = performance.now();
	if (now - perfLastUpdate >= 500) {
		const n = perfFrames;
		perfEl.textContent =
			`pos:${(perfAccum.positions / n).toFixed(2)} ` +
			`ast:${(perfAccum.asteroids / n).toFixed(2)} ` +
			`lbl:${(perfAccum.labels / n).toFixed(2)} ` +
			`hud:${(perfAccum.hud / n).toFixed(2)} ` +
			`gpu:${(perfAccum.render / n).toFixed(2)} ` +
			`tot:${(perfAccum.total / n).toFixed(2)}ms`;
		perfAccum = {
			positions: 0,
			asteroids: 0,
			labels: 0,
			hud: 0,
			render: 0,
			total: 0,
		};
		perfFrames = 0;
		perfLastUpdate = now;
	}
}

// --- Setup all UI event listeners ---

export function setupUI(loadSystem: (systemData: SystemData) => void): void {
	_loadSystem = loadSystem;

	// System switcher
	document
		.getElementById("system-switcher-btn")
		?.addEventListener("click", () => {
			const dropdown = document.getElementById(
				"system-switcher-dropdown",
			) as HTMLElement;
			dropdown.classList.toggle("hidden");
			if (!dropdown.classList.contains("hidden")) rebuildSystemList();
		});

	document.getElementById("btn-discover")?.addEventListener("click", () => {
		const seedStr = (
			document.getElementById("seed-input") as HTMLInputElement
		).value.trim();
		if (!seedStr) return;
		discoverSystem(hashString(seedStr));
		(document.getElementById("seed-input") as HTMLInputElement).value = "";
		document
			.getElementById("system-switcher-dropdown")
			?.classList.add("hidden");
	});

	document.getElementById("btn-random")?.addEventListener("click", () => {
		const seed = Math.floor((state.masterRng?.() ?? 0) * 2147483646) + 1;
		state.randomClickCount++;
		discoverSystem(seed);
		document
			.getElementById("system-switcher-dropdown")
			?.classList.add("hidden");
	});

	document
		.getElementById("seed-input")
		?.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") document.getElementById("btn-discover")?.click();
		});

	// Time controls — speed selector dropdown
	const TIME_SCALES: Array<{ label: string; speed: number }> = [
		{ label: "5 Seconds", speed: 5 / 86400 },
		{ label: "30 Seconds", speed: 30 / 86400 },
		{ label: "2 Minutes", speed: 120 / 86400 },
		{ label: "5 Minutes", speed: 300 / 86400 },
		{ label: "20 Minutes", speed: 1200 / 86400 },
		{ label: "1 Hour", speed: 1 / 24 },
		{ label: "3 Hours", speed: 3 / 24 },
		{ label: "8 Hours", speed: 8 / 24 },
		{ label: "1 Day", speed: 1 },
		{ label: "5 Days", speed: 5 },
		{ label: "30 Days", speed: 30 },
	];
	const DEFAULT_SCALE_INDEX = 8; // 1 Day

	const speedDropdown = document.getElementById(
		"speed-selector-dropdown",
	) as HTMLElement;
	const speedBtn = document.getElementById("speed-selector-btn") as HTMLElement;
	const speedListEl = document.getElementById("speed-list") as HTMLElement;
	const pauseBtn = document.getElementById("btn-pause") as HTMLElement;
	let activeScaleIndex = DEFAULT_SCALE_INDEX;
	let paused = false;

	function updateSpeedBtn(): void {
		speedBtn.textContent = paused
			? "Paused ▾"
			: `${TIME_SCALES[activeScaleIndex].label} ▾`;
		pauseBtn.textContent = paused ? "|>" : "||";
		pauseBtn.classList.toggle("active", paused);
	}

	function buildSpeedList(): void {
		speedListEl.innerHTML = "";
		TIME_SCALES.forEach((scale, i) => {
			const item = document.createElement("button");
			item.className = `speed-list-item${i === activeScaleIndex ? " active" : ""}`;
			const spaceIdx = scale.label.indexOf(" ");
			const num = scale.label.slice(0, spaceIdx);
			const unit = scale.label.slice(spaceIdx + 1);
			item.innerHTML = `<span class="speed-num">${num}</span> ${unit}`;
			item.addEventListener("click", () => {
				activeScaleIndex = i;
				state.timeSpeed = scale.speed;
				paused = false;
				updateSpeedBtn();
				buildSpeedList();
				speedDropdown.classList.add("hidden");
			});
			speedListEl.appendChild(item);
		});
	}

	speedBtn.addEventListener("click", () => {
		speedDropdown.classList.toggle("hidden");
		if (!speedDropdown.classList.contains("hidden")) {
			// Position dropdown near the speed button
			const rect = speedBtn.getBoundingClientRect();
			speedDropdown.style.left = `${rect.left}px`;
			buildSpeedList();
		}
	});

	function togglePause(): void {
		paused = !paused;
		state.timeSpeed = paused ? 0 : TIME_SCALES[activeScaleIndex].speed;
		updateSpeedBtn();
	}

	pauseBtn.addEventListener("click", togglePause);

	window.addEventListener("keydown", (e: KeyboardEvent) => {
		const onFormElement = ["INPUT", "SELECT", "TEXTAREA"].includes(
			(e.target as HTMLElement).tagName,
		);
		if (e.code === "Space" || e.key === " ") {
			if (onFormElement) return;
			e.preventDefault();
			togglePause();
		} else if (
			e.key === "n" ||
			e.key === "N" ||
			e.key === "b" ||
			e.key === "B"
		) {
			if (onFormElement) return;
			e.preventDefault();
			const backward = e.key === "b" || e.key === "B";
			const speed = TIME_SCALES[activeScaleIndex].speed * (backward ? -1 : 1);
			state.debugStepFrames = 15;
			state.timeSpeed = speed;
			paused = false;
			updateSpeedBtn();
			const ship = state.bodyMeshes.find(isShipEntry);
			const elapsed = ship ? state.simTime - ship.transferStartTime : 0;
			const t =
				ship && ship.transferTimeDays > 0 ? elapsed / ship.transferTimeDays : 0;
			console.log(`DEBUG STEP [${backward ? "B" : "N"}]:`, {
				speed,
				simTime: state.simTime.toFixed(3),
				shipState: ship?.shipState,
				t: t.toFixed(4),
			});
		}
	});

	// Sync UI when something externally sets timeSpeed=0 (debug step, blend-start)
	window.addEventListener("debug-step-done", () => {
		paused = true;
		updateSpeedBtn();
	});

	updateSpeedBtn();

	// Recenter
	document
		.getElementById("btn-recenter")
		?.addEventListener("click", recenterOnStar);

	// Display toggles
	document.getElementById("toggle-orbits")?.addEventListener("change", (e) => {
		state.showOrbits = (e.target as HTMLInputElement).checked;
		state.bodyMeshes.forEach((b) => {
			if (b.orbitLine)
				b.orbitLine.visible = (e.target as HTMLInputElement).checked;
		});
	});

	document.getElementById("toggle-labels")?.addEventListener("change", (e) => {
		state.showLabels = (e.target as HTMLInputElement).checked;
		state.bodyMeshes.forEach((b) => {
			b.labelDiv.style.display = (e.target as HTMLInputElement).checked
				? ""
				: "none";
		});
	});

	document.getElementById("toggle-grid")?.addEventListener("change", (e) => {
		gridGroup.visible = (e.target as HTMLInputElement).checked;
	});

	document.getElementById("toggle-trails")?.addEventListener("change", (e) => {
		state.showTrails = (e.target as HTMLInputElement).checked;
		state.bodyMeshes.forEach((b) => {
			b.trail.line.visible = (e.target as HTMLInputElement).checked;
		});
	});
}
