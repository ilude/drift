import * as THREE from "three";
import { getUnreadCount, markAllRead, markRead } from "../core/notifications";
import { formatDateTime, simTimeToDate, state, truncateDate } from "../core/state";
import { generateSystem } from "../data/system-generator";
import {
	bodyScaleFactor,
	screenRadius as calcScreenRadius,
	lodLevel,
	MOON_LOD_ZOOM,
} from "../math/visual";
import { camera, setAntialias, ZOOM_BASE } from "../rendering/scene";
import type { BodyEntry, CategoryKey, CategoryVisibility, SystemData } from "../types";
import { isShipEntry, isSurveyable } from "../types";
import { recenterOnStar, selectBody } from "./selection";

// --- Body list panel ---

const bodyListEl = document.getElementById("body-list") as HTMLElement;

export function buildBodyList(): void {
	bodyListEl.innerHTML = "";

	const groups: Record<string, BodyEntry[]> = {};
	const groupOrder = ["Star", "Planet", "Dwarf Planet", "Detached Object", "Comet", "Ship"];
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
						const collapsed = (moonList as HTMLElement).style.display === "none";
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

export function computeLabelPosition(
	cx: number,
	cy: number,
	screenRadius: number,
	viewW: number,
	viewH: number,
	margin: number,
): { x: number; y: number; visible: boolean } {
	if (cx < -margin || cx > viewW + margin || cy < -margin || cy > viewH + margin) {
		return { x: 0, y: 0, visible: false };
	}
	const gap = Math.max(6, screenRadius * 0.2);
	return { x: cx + screenRadius + gap, y: cy - 6, visible: true };
}

export function formatZoomText(camDist: number, zoomBase: number): string {
	return `Zoom: ${(zoomBase / camDist).toFixed(2)}x`;
}

const tempVec = new THREE.Vector3();
const edgeVec = new THREE.Vector3();

let lastScaleFactor = -1;
let lastLodCamDist = -1;
let labelFrameCounter = 0;

export function updateLabels(camDist: number): void {
	const cv = state.categoryVisibility;
	const zoomFactor = ZOOM_BASE / camDist;
	const moonsVisible = zoomFactor > MOON_LOD_ZOOM;
	const scaleFactor = bodyScaleFactor(zoomFactor);
	const fov = camera.fov;
	const screenH = window.innerHeight;
	const screenW = window.innerWidth;

	const shipEntry = state.bodyMeshes.find((e) => isShipEntry(e));
	const surveyTarget =
		shipEntry && isShipEntry(shipEntry) && shipEntry.action.type === "survey-nearest"
			? (shipEntry.action.target ?? null)
			: null;

	const needsScaleUpdate = scaleFactor !== lastScaleFactor;
	const needsLodUpdate =
		lastLodCamDist < 0 || Math.abs(camDist - lastLodCamDist) / lastLodCamDist > 0.05;

	// Throttle label transforms to every 2 frames (47 FPS, imperceptible for text)
	labelFrameCounter = (labelFrameCounter + 1) % 2;
	const shouldUpdateTransforms = labelFrameCounter === 0;

	state.bodyMeshes.forEach((entry) => {
		if (entry.isMoon && entry.parentMesh) {
			entry.mesh.visible = moonsVisible;
			if (entry.orbitLine) entry.orbitLine.visible = moonsVisible && cv.Moon.orbits;
			if (!moonsVisible) {
				const targetDisplay = "none";
				if (entry.labelDisplay !== targetDisplay) {
					entry.labelDiv.style.display = targetDisplay;
					entry.labelDisplay = targetDisplay;
				}
				return;
			}
		}

		if (!entry.isMoon && !entry.isComet && !entry.isShip && "baseSize" in entry) {
			if (needsScaleUpdate) {
				const scaledSize = entry.baseSize + scaleFactor * (entry.realisticSize - entry.baseSize);
				const s = scaledSize / entry.baseSize;
				entry.mesh.scale.set(s, s, s);
				entry.screenSize = scaledSize;
			}
		}

		tempVec.copy(entry.mesh.position);
		tempVec.project(camera);

		if (tempVec.z > 1) {
			const targetDisplay = "none";
			if (entry.labelDisplay !== targetDisplay) {
				entry.labelDiv.style.display = targetDisplay;
				entry.labelDisplay = targetDisplay;
			}
			return;
		}

		const cx = (tempVec.x * 0.5 + 0.5) * screenW;
		const cy = (-tempVec.y * 0.5 + 0.5) * screenH;

		const margin = 100;
		if (cx < -margin || cx > screenW + margin || cy < -margin || cy > screenH + margin) {
			const targetDisplay = "none";
			if (entry.labelDisplay !== targetDisplay) {
				entry.labelDiv.style.display = targetDisplay;
				entry.labelDisplay = targetDisplay;
			}
			return;
		}

		const catKey = (entry.isMoon ? "Moon" : entry.data.type) as CategoryKey;
		const showLabels = cv[catKey]?.labels ?? true;
		const targetDisplay = showLabels ? "" : "none";
		if (entry.labelDisplay !== targetDisplay) {
			entry.labelDiv.style.display = targetDisplay;
			entry.labelDisplay = targetDisplay;
		}

		// Survey suffix: ✓ if surveyed, * if currently being surveyed
		if (!entry.isShip) {
			let suffix = "";
			if (isSurveyable(entry) && entry.survey.surveyLevel > 0) suffix = " \u2713";
			else if (entry.data.name === surveyTarget) suffix = " *";
			const expectedText = entry.data.name + suffix;
			if (entry.labelDiv.textContent !== expectedText) {
				entry.labelDiv.textContent = expectedText;
			}
		}

		const radius = entry.screenSize || 0.3;
		const dist = edgeVec.copy(entry.mesh.position).sub(camera.position).length();
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

		// Only update label transforms every 2 frames
		if (shouldUpdateTransforms) {
			const pos = computeLabelPosition(cx, cy, sr, screenW, screenH, margin);
			const lx = pos.x;
			const ly = pos.y;
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
		}
	});

	if (needsScaleUpdate) lastScaleFactor = scaleFactor;
	if (needsLodUpdate) lastLodCamDist = camDist;
}

// --- HUD ---

const timeEl = document.getElementById("time-display") as HTMLElement;
const zoomEl = document.getElementById("zoom-display") as HTMLElement;
let lastTimeText = "";
let lastZoomText = "";
let lastHudSimTime = -1;
let lastHudTimeSpeed = -1;

export function updateHUD(camDist: number): void {
	if (state.simTime !== lastHudSimTime || state.timeSpeed !== lastHudTimeSpeed) {
		lastHudSimTime = state.simTime;
		lastHudTimeSpeed = state.timeSpeed;
		const d = truncateDate(simTimeToDate(state.simTime), state.timeSpeed);
		const timeText = formatDateTime(d);
		if (timeText !== lastTimeText) {
			timeEl.textContent = timeText;
			lastTimeText = timeText;
		}
	}

	const zoomText = formatZoomText(camDist, ZOOM_BASE);
	if (zoomText !== lastZoomText) {
		zoomEl.textContent = zoomText;
		lastZoomText = zoomText;
	}

	const badge = document.getElementById("notif-badge");
	if (badge) {
		const count = getUnreadCount();
		if (count > 0) {
			badge.textContent = String(count);
			badge.style.display = "";
		} else {
			badge.style.display = "none";
		}
	}

	const activityEl = document.getElementById("ship-activity");
	if (activityEl) {
		const ship = state.bodyMeshes.find((e) => isShipEntry(e));
		if (ship && isShipEntry(ship)) {
			if (ship.shipState === "transferring") {
				activityEl.textContent = `Ship: In transit to ${ship.transferTarget}`;
			} else if (ship.action.type === "survey-nearest" && ship.action.startTime > 0) {
				const elapsed = Math.floor(state.simTime - ship.action.startTime);
				const dur = Math.floor(ship.action.duration);
				activityEl.textContent = `Ship: Surveying ${ship.action.target ?? ship.hostPlanetName} (${elapsed}d/${dur}d)`;
			} else if (ship.action.type === "shore-leave" && ship.action.startTime > 0) {
				activityEl.textContent = "Ship: Shore Leave";
			} else if (ship.action.type === "overhaul" && ship.action.startTime > 0) {
				activityEl.textContent = "Ship: Overhaul";
			} else {
				activityEl.textContent = `Ship: Orbiting ${ship.hostPlanetName}`;
			}
		} else {
			activityEl.textContent = "";
		}
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
const perfAccum: PerfTimings = {
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
		perfAccum.positions = 0;
		perfAccum.asteroids = 0;
		perfAccum.labels = 0;
		perfAccum.hud = 0;
		perfAccum.render = 0;
		perfAccum.total = 0;
		perfFrames = 0;
		perfLastUpdate = now;
	}
}

// --- Setup all UI event listeners ---

export function setupUI(loadSystem: (systemData: SystemData) => void): void {
	_loadSystem = loadSystem;

	// System switcher
	document.getElementById("system-switcher-btn")?.addEventListener("click", () => {
		const dropdown = document.getElementById("system-switcher-dropdown") as HTMLElement;
		dropdown.classList.toggle("hidden");
		if (!dropdown.classList.contains("hidden")) rebuildSystemList();
	});

	document.getElementById("btn-discover")?.addEventListener("click", () => {
		const seedStr = (document.getElementById("seed-input") as HTMLInputElement).value.trim();
		if (!seedStr) return;
		discoverSystem(hashString(seedStr));
		(document.getElementById("seed-input") as HTMLInputElement).value = "";
		document.getElementById("system-switcher-dropdown")?.classList.add("hidden");
	});

	document.getElementById("btn-random")?.addEventListener("click", () => {
		const seed = Math.floor((state.masterRng?.() ?? 0) * 2147483646) + 1;
		state.randomClickCount++;
		discoverSystem(seed);
		document.getElementById("system-switcher-dropdown")?.classList.add("hidden");
	});

	document.getElementById("seed-input")?.addEventListener("keydown", (e: KeyboardEvent) => {
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

	const speedDropdown = document.getElementById("speed-selector-dropdown") as HTMLElement;
	const speedBtn = document.getElementById("speed-selector-btn") as HTMLElement;
	const speedListEl = document.getElementById("speed-list") as HTMLElement;
	const pauseBtn = document.getElementById("btn-pause") as HTMLElement;
	let activeScaleIndex = DEFAULT_SCALE_INDEX;
	let paused = false;

	function updateSpeedBtn(): void {
		speedBtn.textContent = paused ? "Paused ▾" : `${TIME_SCALES[activeScaleIndex].label} ▾`;
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
				state.renderNeeded = true;
				window.dispatchEvent(new Event("wake-render"));
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
		state.renderNeeded = true;
		window.dispatchEvent(new Event("wake-render"));
	}

	pauseBtn.addEventListener("click", togglePause);

	// Sync pause button when timeSpeed is changed externally (e.g., by notification system)
	window.addEventListener("wake-render", () => {
		const shouldBePaused = state.timeSpeed === 0;
		if (shouldBePaused !== paused) {
			paused = shouldBePaused;
			updateSpeedBtn();
		}
	});

	window.addEventListener("keydown", (e: KeyboardEvent) => {
		const onFormElement = ["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
		if (e.code === "Space" || e.key === " ") {
			if (onFormElement) return;
			e.preventDefault();
			togglePause();
		} else if (e.key === "n" || e.key === "N" || e.key === "b" || e.key === "B") {
			if (onFormElement) return;
			e.preventDefault();
			const backward = e.key === "b" || e.key === "B";
			const speed = TIME_SCALES[activeScaleIndex].speed * (backward ? -1 : 1);
			state.debugStepFrames = 15;
			state.timeSpeed = speed;
			paused = false;
			updateSpeedBtn();
			state.renderNeeded = true;
			window.dispatchEvent(new Event("wake-render"));
			const ship = state.bodyMeshes.find(isShipEntry);
			const elapsed = ship ? state.simTime - ship.transferStartTime : 0;
			const t = ship && ship.transferTimeDays > 0 ? elapsed / ship.transferTimeDays : 0;
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

	// Ctrl+R recenter shortcut
	window.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.ctrlKey && e.key === "r") {
			e.preventDefault();
			recenterOnStar();
		}
	});

	// View menu
	setupViewMenu();

	// Notifications
	setupNotifications();
}

// --- Notifications ---

const NOTIF_ICONS: Record<string, string> = {
	"survey-complete": "\u2713",
	malfunction: "\u26a0",
	"low-fuel": "F",
	"low-morale": "M",
	"maintenance-needed": "W",
	"mission-complete": "\u2605",
	"ship-destroyed": "X",
};

function renderNotifDropdown(dropdown: HTMLElement): void {
	dropdown.innerHTML = "";

	const markAll = document.createElement("div");
	markAll.className = "notif-mark-all";
	markAll.textContent = "Mark all read";
	markAll.addEventListener("click", () => {
		markAllRead();
		dropdown.classList.add("hidden");
	});
	dropdown.appendChild(markAll);

	const recent = [...state.notifications].reverse().slice(0, 10);
	for (const notif of recent) {
		const entry = document.createElement("div");
		entry.className = `notif-entry${notif.read ? " notif-entry-read" : ""}`;

		const date = simTimeToDate(notif.simTime);
		const y = date.getFullYear();
		const mo = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		const timeStr = `${y}-${mo}-${d}`;

		const icon = NOTIF_ICONS[notif.type] ?? "?";

		entry.innerHTML =
			`<span class="notif-time">${timeStr}</span>` +
			`<span class="notif-icon">${icon}</span>` +
			`${notif.message}`;

		entry.addEventListener("click", () => {
			markRead(notif.id);
			if (notif.bodyName) {
				const body = state.bodyMeshes.find((e) => e.data.name === notif.bodyName);
				if (body) selectBody(body);
			}
			dropdown.classList.add("hidden");
		});

		dropdown.appendChild(entry);
	}
}

function setupNotifications(): void {
	const badge = document.getElementById("notif-badge");
	const dropdown = document.getElementById("notif-dropdown") as HTMLElement | null;
	if (!badge || !dropdown) return;

	badge.addEventListener("click", (e) => {
		e.stopPropagation();
		const isHidden = dropdown.classList.contains("hidden");
		dropdown.classList.toggle("hidden");
		if (isHidden) {
			renderNotifDropdown(dropdown);
			const rect = badge.getBoundingClientRect();
			dropdown.style.top = `${rect.bottom + 2}px`;
			dropdown.style.right = `${window.innerWidth - rect.right}px`;
			dropdown.style.left = "";
		}
	});

	document.addEventListener("click", (e) => {
		if (
			!dropdown.classList.contains("hidden") &&
			!dropdown.contains(e.target as Node) &&
			e.target !== badge
		) {
			dropdown.classList.add("hidden");
		}
	});
}

// --- View menu ---

interface ViewCategory {
	key: CategoryKey;
	label: string;
	toggles: Array<{ prop: keyof CategoryVisibility; label: string }>;
}

const VIEW_CATEGORIES: ViewCategory[] = [
	{ key: "Star", label: "Stars", toggles: [{ prop: "labels", label: "Labels" }] },
	{
		key: "Planet",
		label: "Planets",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "orbits", label: "Orbits" },
			{ prop: "trails", label: "Trails" },
		],
	},
	{
		key: "Dwarf Planet",
		label: "Dwarf Planets",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "orbits", label: "Orbits" },
			{ prop: "trails", label: "Trails" },
		],
	},
	{
		key: "Detached Object",
		label: "Detached Objects",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "orbits", label: "Orbits" },
			{ prop: "trails", label: "Trails" },
		],
	},
	{
		key: "Moon",
		label: "Moons",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "orbits", label: "Orbits" },
		],
	},
	{
		key: "Comet",
		label: "Comets",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "orbits", label: "Orbits" },
			{ prop: "trails", label: "Trails" },
		],
	},
	{
		key: "Asteroid",
		label: "Asteroids",
		toggles: [{ prop: "labels", label: "Belts" }],
	},
	{
		key: "Ship",
		label: "Ship",
		toggles: [
			{ prop: "labels", label: "Labels" },
			{ prop: "trails", label: "Trail" },
		],
	},
];

function applyVisibility(catKey: CategoryKey, prop: keyof CategoryVisibility): void {
	const val = state.categoryVisibility[catKey][prop];

	if (catKey === "Asteroid") {
		state.asteroidBelts.forEach((ab) => {
			ab.points.visible = val;
		});
		return;
	}

	state.bodyMeshes.forEach((entry) => {
		const entryKey = (entry.isMoon ? "Moon" : entry.data.type) as CategoryKey;
		if (entryKey !== catKey) return;

		if (prop === "labels") {
			entry.labelDiv.style.display = val ? "" : "none";
		} else if (prop === "orbits" && entry.orbitLine) {
			entry.orbitLine.visible = val;
		} else if (prop === "trails") {
			entry.trail.line.visible = val;
		}
	});

	state.renderNeeded = true;
	window.dispatchEvent(new Event("wake-render"));
}

function setupViewMenu(): void {
	const btn = document.getElementById("view-menu-btn");
	const dropdown = document.getElementById("view-menu-dropdown");
	if (!btn || !dropdown) return;

	// Build menu content
	const content = dropdown.querySelector(".view-menu-content") as HTMLElement;
	if (!content) return;

	// Recenter row
	const recenterRow = document.createElement("button");
	recenterRow.className = "view-menu-action";
	recenterRow.innerHTML = `Recenter <span class="view-shortcut">Ctrl+R</span>`;
	recenterRow.addEventListener("click", () => {
		recenterOnStar();
		dropdown.classList.add("hidden");
	});
	content.appendChild(recenterRow);

	// Antialias toggle
	const aaRow = document.createElement("div");
	aaRow.className = "view-cat-toggles";
	aaRow.style.padding = "5px 8px";
	const aaLabel = document.createElement("label");
	aaLabel.className = "view-toggle";
	const aaCb = document.createElement("input");
	aaCb.type = "checkbox";
	aaCb.checked = true;
	aaCb.addEventListener("change", () => {
		setAntialias(aaCb.checked);
		state.renderNeeded = true;
		window.dispatchEvent(new Event("wake-render"));
	});
	aaLabel.appendChild(aaCb);
	aaLabel.appendChild(document.createTextNode(" Antialiasing"));
	aaRow.appendChild(aaLabel);
	content.appendChild(aaRow);

	const sep = document.createElement("div");
	sep.className = "view-menu-sep";
	content.appendChild(sep);

	// Category sections
	VIEW_CATEGORIES.forEach((cat) => {
		const section = document.createElement("div");
		section.className = "view-cat";

		const header = document.createElement("div");
		header.className = "view-cat-header";
		header.textContent = cat.label;
		section.appendChild(header);

		const toggleRow = document.createElement("div");
		toggleRow.className = "view-cat-toggles";

		cat.toggles.forEach((toggle) => {
			const label = document.createElement("label");
			label.className = "view-toggle";
			const cb = document.createElement("input");
			cb.type = "checkbox";
			cb.checked = state.categoryVisibility[cat.key][toggle.prop];
			cb.addEventListener("change", () => {
				state.categoryVisibility[cat.key][toggle.prop] = cb.checked;
				applyVisibility(cat.key, toggle.prop);
			});
			label.appendChild(cb);
			label.appendChild(document.createTextNode(` ${toggle.label}`));
			toggleRow.appendChild(label);
		});

		section.appendChild(toggleRow);
		content.appendChild(section);
	});

	// Toggle dropdown
	btn.addEventListener("click", () => {
		dropdown.classList.toggle("hidden");
		if (!dropdown.classList.contains("hidden")) {
			dropdown.style.left = `${btn.getBoundingClientRect().left}px`;
		}
	});

	// Close on outside click
	document.addEventListener("click", (e) => {
		if (
			!dropdown.classList.contains("hidden") &&
			!dropdown.contains(e.target as Node) &&
			e.target !== btn
		) {
			dropdown.classList.add("hidden");
		}
	});
}
