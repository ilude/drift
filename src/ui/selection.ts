import * as THREE from "three";
import { computeColonyWorkforce, getColony } from "../core/colonies";
import { hullCeiling } from "../core/commands";
import { findShip, findStar } from "../core/entities";
import { MAX_CLICK_DIST, simTimeToDate, state } from "../core/state";
import { getResourceDef } from "../data/resources";
import { ENGINE_TYPES } from "../math/ship-physics";
import { easeOutCubic } from "../math/visual";
import { COMET_ORBIT_OPACITY, COMET_ORBIT_SELECTED_OPACITY } from "../rendering/rendering";
import { camera, controls, renderer, ZOOM_BASE } from "../rendering/scene";
import type {
	AsteroidBeltData,
	AsteroidInfo,
	BodyEntry,
	FlyToState,
	ResourceDeposit,
	ShipEntry,
} from "../types";
import { isCometEntry, isPlanetEntry, isShipEntry, isSurveyable } from "../types";
import { renderColonyPanel } from "./colony-panel";
import { renderCommandTree } from "./commands";
import { pushBodySelected } from "./resource-viewer";

/** Format a ship's orbiting action as display text. */
function formatOrbitingAction(action: import("../types").ShipAction): string {
	switch (action.type) {
		case "survey-nearest":
			return action.startTime > 0
				? `Surveying ${action.target ?? "?"}`
				: `En route to ${action.target ?? "?"}`;
		case "shore-leave":
			return "Shore Leave";
		case "overhaul":
			return "Overhaul";
		case "major-refit":
			return "Major Refit";
		case "refuel":
			return "Refueling";
		case "refuel-ship":
			return action.startTime > 0
				? `Refueling ${action.target ?? "ship"}`
				: `En route to refuel ${action.target ?? "ship"}`;
		default:
			return "Idle";
	}
}

/** Format a ship's current action as display text. Single source of truth for action display. */
export function formatShipAction(entry: import("../types").ShipEntry): string {
	if (entry.shipState === "transferring") {
		return `In transit to ${entry.transferTarget}`;
	}
	return formatOrbitingAction(entry.action);
}

function formatDays(d: number): string {
	return d < 1 ? `${d.toFixed(1)}d` : `${Math.floor(d)}d`;
}

/**
 * Format accessibility as a 5-character ASCII bar.
 * Converts a 0-1 accessibility value to a bar like [====.] or [.....]
 */
export function formatAccessibilityBar(accessibility: number): string {
	const filled = Math.round(accessibility * 5);
	return `[${"=".repeat(filled)}${".".repeat(5 - filled)}]`;
}

/**
 * Classify the mining value of a deposit list based on accessible quantity.
 * Returns score, label, and color for UI display.
 */
interface MiningValueScore {
	score: number;
	label: string;
	color: string;
}

export function classifyMiningValue(
	deposits: ResourceDeposit[],
	surveyLevel: number,
): MiningValueScore {
	const score = deposits
		.filter((d) => d.minSurveyLevel <= surveyLevel)
		.reduce((sum, d) => sum + d.quantity * d.accessibility, 0);

	let label: string;
	let color: string;

	if (score > 100000) {
		label = "High";
		color = "#4a6a4a";
	} else if (score > 10000) {
		label = "Medium";
		color = "#aaaa44";
	} else if (score > 0) {
		label = "Low";
		color = "#888888";
	} else {
		label = "None";
		color = "#666666";
	}

	return { score, label, color };
}

export function formatShipDuration(entry: import("../types").ShipEntry): string {
	if (entry.shipState === "transferring") {
		const elapsed = Math.max(0, state.simTime.days - entry.transferDisplayStart);
		const remaining = Math.max(0, entry.transferDisplayDays - elapsed);
		const total = entry.transferDisplayDays;
		return `${formatDays(remaining)} / ${formatDays(total)}`;
	}
	const action = entry.action;
	if (action.startTime > 0 && action.duration > 0) {
		const elapsed = action.progress * action.duration;
		const remaining = Math.max(0, action.duration - elapsed);
		return `${formatDays(remaining)} / ${formatDays(action.duration)}`;
	}
	return "";
}

interface PinnedPanel {
	shipName: string;
	el: HTMLElement;
	offsetX: number;
	offsetY: number;
}

const pinnedPanels = new Map<string, PinnedPanel>();

function buildPinnedBodyHTML(entry: ShipEntry): string {
	const ceiling = hullCeiling(entry.maintenance.totalAge, entry.maintenance.lastRefitAge);
	const hullCurrent = Math.round(entry.maintenance.hullIntegrity);
	const hullCap = Math.round(ceiling);
	const hullText = hullCap < 100 ? `${hullCurrent}% / ${hullCap}%` : `${hullCurrent}%`;
	const fuelPct =
		entry.fuelCapacityKg > 0 ? Math.round((entry.fuelKg / entry.fuelCapacityKg) * 100) : 0;
	const morale = Math.round(entry.crew.morale);
	const moraleColor = morale > 70 ? "#4a6a4a" : morale > 40 ? "#aaaa44" : "#aa4444";
	const hullColor = hullCurrent > 70 ? "#4a6a4a" : hullCurrent > 40 ? "#aaaa44" : "#aa4444";
	const duration = formatShipDuration(entry);
	const rows: [string, string][] = [
		["Action", formatShipAction(entry)],
		...(duration ? ([["Duration", duration]] as [string, string][]) : []),
		["Fuel", `${fuelPct}%`],
		["Hull", `<span style="color:${hullColor}">${hullText}</span>`],
		["Morale", `<span style="color:${moraleColor}">${morale}%</span>`],
		["Supplies", `${Math.round(entry.maintenance.supplies)}/${entry.maintenance.maxSupplies}`],
	];
	return rows
		.map(
			([label, value]) =>
				`<div class="info-row"><span class="info-label">${label}</span><span>${value}</span></div>`,
		)
		.join("");
}

function buildPinnedPanelHTML(entry: ShipEntry): string {
	return (
		`<div class="panel-header">` +
		`<span>${entry.data.name}</span>` +
		`<button class="info-pin-btn pinned-close-btn" type="button">[X]</button>` +
		`</div>` +
		`<div class="pinned-body" style="padding:6px 8px;background:#0d0d14">` +
		buildPinnedBodyHTML(entry) +
		`</div>`
	);
}

function removePinnedPanel(shipName: string): void {
	const pinned = pinnedPanels.get(shipName);
	if (!pinned) return;
	pinned.el.remove();
	pinnedPanels.delete(shipName);
}

function attachPanelDrag(el: HTMLElement, onMove?: (x: number, y: number) => void): void {
	const header = el.querySelector(".panel-header") as HTMLElement | null;
	if (!header) return;
	let startX = 0;
	let startY = 0;
	let startLeft = 0;
	let startTop = 0;

	function onMouseMove(e: MouseEvent): void {
		const left = startLeft + (e.clientX - startX);
		const top = startTop + (e.clientY - startY);
		el.style.left = `${left}px`;
		el.style.top = `${top}px`;
		onMove?.(left, top);
	}

	function onMouseUp(): void {
		document.removeEventListener("mousemove", onMouseMove);
		document.removeEventListener("mouseup", onMouseUp);
	}

	header.addEventListener("mousedown", (e: MouseEvent) => {
		if ((e.target as HTMLElement).tagName === "BUTTON") return;
		if (!el.style.left) {
			const rect = el.getBoundingClientRect();
			el.style.left = `${rect.left}px`;
			el.style.top = `${rect.top}px`;
			el.style.right = "auto";
		}
		startX = e.clientX;
		startY = e.clientY;
		startLeft = Number.parseFloat(el.style.left) || 0;
		startTop = Number.parseFloat(el.style.top) || 0;
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		e.preventDefault();
	});
}

function createPinnedPanel(entry: ShipEntry): void {
	if (pinnedPanels.has(entry.data.name)) return;

	// Spawn at info-panel's current screen position so it appears to "stay in place"
	const infoEl = document.getElementById("info-panel");
	let left: number;
	let top: number;
	if (infoEl) {
		const rect = infoEl.getBoundingClientRect();
		left = rect.left;
		top = rect.top;
	} else {
		left = 20 + pinnedPanels.size * 20;
		top = 60 + pinnedPanels.size * 20;
	}

	const el = document.createElement("div");
	el.className = "panel pinned-ship-panel";
	el.innerHTML = buildPinnedPanelHTML(entry);
	el.style.left = `${left}px`;
	el.style.top = `${top}px`;
	document.body.appendChild(el);

	// Hide the main info panel so the next ship click opens it fresh
	infoEl?.classList.add("hidden");
	state.selectedBody = null;

	const panel: PinnedPanel = { shipName: entry.data.name, el, offsetX: left, offsetY: top };
	pinnedPanels.set(entry.data.name, panel);
	attachPanelDrag(el, (x, y) => {
		panel.offsetX = x;
		panel.offsetY = y;
	});
	el
		.querySelector(".pinned-close-btn")
		?.addEventListener("click", () => removePinnedPanel(entry.data.name));
}

function updatePinnedPanel(entry: ShipEntry): void {
	const pinned = pinnedPanels.get(entry.data.name);
	if (!pinned) return;
	const body = pinned.el.querySelector(".pinned-body");
	if (body) body.innerHTML = buildPinnedBodyHTML(entry);
}

export function updateAllPinnedPanels(): void {
	for (const [shipName] of pinnedPanels) {
		const [entry, found] = findShip(shipName);
		if (found && entry) updatePinnedPanel(entry);
	}
}

const ZOOM_DIST_RECENTER: number = ZOOM_BASE / 0.25;
const ZOOM_DIST_STAR: number = 75;
const ZOOM_DIST_PLANET: number = 38;
const ZOOM_DIST_MOON: number = 20;

export function getZoomDistance(bodyType: string, isMoon: boolean): number {
	if (isMoon) return ZOOM_DIST_MOON;
	if (bodyType === "Star") return ZOOM_DIST_STAR;
	if (bodyType === "Moon") return ZOOM_DIST_MOON;
	return ZOOM_DIST_PLANET;
}

const flyEndTarget: THREE.Vector3 = new THREE.Vector3();
const flyEndCam: THREE.Vector3 = new THREE.Vector3();
const clickVec: THREE.Vector3 = new THREE.Vector3();
const INITIAL_CAM_DIR: THREE.Vector3 = new THREE.Vector3(0, ZOOM_BASE, 80).normalize();

function animateCameraTo(entry: BodyEntry, zoomDist: number, overrideOffset?: THREE.Vector3): void {
	const camOffset: THREE.Vector3 =
		overrideOffset || new THREE.Vector3().subVectors(camera.position, controls.target).normalize();

	state.flyTo = {
		entry,
		camOffset,
		zoomDist,
		startCam: camera.position.clone(),
		startTarget: controls.target.clone(),
		startTime: performance.now() / 1000,
		duration: 0.6,
	} as FlyToState;
	state.renderNeeded = true;
	window.dispatchEvent(new Event("wake-render"));
}

export function updateFlyTo(): void {
	if (!state.flyTo) return;
	const now: number = performance.now() / 1000;
	let t: number = (now - state.flyTo.startTime) / state.flyTo.duration;
	if (t >= 1) t = 1;

	const ease: number = easeOutCubic(t);

	const pos: THREE.Vector3 = state.flyTo.entry.mesh.position;
	flyEndTarget.set(pos.x, pos.y, pos.z);
	flyEndCam.copy(flyEndTarget).addScaledVector(state.flyTo.camOffset, state.flyTo.zoomDist);

	camera.position.lerpVectors(state.flyTo.startCam, flyEndCam, ease);
	controls.target.lerpVectors(state.flyTo.startTarget, flyEndTarget, ease);

	if (t >= 1) {
		state.flyTo = null;
	}
}

export function recenterOnStar(): void {
	const [star, starFound] = findStar();
	if (!starFound) return;
	if (state.selectedBody) {
		(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
		state.selectedBody = null;
	}
	document.getElementById("info-panel")?.classList.add("hidden");
	animateCameraTo(star, ZOOM_DIST_RECENTER, INITIAL_CAM_DIR);
}

const SHIP_ROW_IDS = [
	"info-ship-engine",
	"info-ship-fuel",
	"info-crew-row",
	"info-morale-row",
	"info-leave-row",
	"info-hull-row",
	"info-age-row",
	"info-keel-row",
	"info-supplies-row",
	"info-action-row",
	"info-duration-row",
];

/** Set text and traffic-light color (green/yellow/red) on a DOM element by percentage value. */
function setColoredPct(id: string, pct: number): void {
	const el = document.getElementById(id);
	if (!el) return;
	el.textContent = `${pct}%`;
	el.style.color = pct > 70 ? "#4a6a4a" : pct > 40 ? "#aaaa44" : "#aa4444";
}

function setFuelText(entry: ShipEntry): void {
	const pct = entry.fuelCapacityKg > 0 ? Math.round((entry.fuelKg / entry.fuelCapacityKg) * 100) : 0;
	const el = document.getElementById("ship-fuel-value");
	if (el)
		el.textContent = `${(entry.fuelKg / 1000).toFixed(2)}t / ${(entry.fuelCapacityKg / 1000).toFixed(2)}t (${pct}%)`;
}

function deselectCurrentBody(): void {
	if (!state.selectedBody) return;
	(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
	if (isCometEntry(state.selectedBody) && state.selectedBody.orbitLine) {
		(state.selectedBody.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_OPACITY;
	}
}

function updateBodyInfoTitle(entry: BodyEntry): void {
	document.getElementById("info-panel")?.classList.remove("hidden");

	const titleEl = document.getElementById("info-title");
	if (titleEl) titleEl.textContent = entry.data.name;

	const typeEl = document.getElementById("info-type");
	if (typeEl) {
		let text = entry.data.type;
		if (!isShipEntry(entry)) {
			const [colony, found] = getColony(entry.data.name);
			if (found && colony) {
				const workforce = computeColonyWorkforce(colony);
				text += ` — Colony • Pop ${colony.population.toLocaleString()} • Workforce ${workforce.usedWorkers.toLocaleString()}/${workforce.availableWorkers.toLocaleString()}`;
			}
		}
		typeEl.textContent = text;
	}

	document.querySelectorAll(".body-list-item").forEach((el) => {
		el.classList.toggle(
			"selected",
			el.querySelector(".body-list-name")?.textContent === entry.data.name,
		);
	});
}

function updateHullAndAge(entry: ShipEntry): void {
	const ceiling = hullCeiling(entry.maintenance.totalAge, entry.maintenance.lastRefitAge);
	const hullEl = document.getElementById("info-hull-value");
	if (hullEl) {
		const current = Math.round(entry.maintenance.hullIntegrity);
		const cap = Math.round(ceiling);
		hullEl.textContent = cap < 100 ? `${current}% / ${cap}%` : `${current}%`;
		hullEl.className = current < 30 ? "critical" : current < 60 ? "warning" : "";
	}

	const ageEl = document.getElementById("info-age-value");
	if (ageEl) {
		const ageYears = (state.simTime.days - entry.keelDate) / 365;
		ageEl.textContent = `${ageYears.toFixed(2)}y`;
	}

	const keelEl = document.getElementById("info-keel-value");
	if (keelEl) {
		const d = simTimeToDate(entry.keelDate);
		const y = d.getFullYear();
		const mo = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		keelEl.textContent = `${y}-${mo}-${day}`;
	}
}

function showShipPanel(entry: ShipEntry): void {
	for (const id of SHIP_ROW_IDS) {
		document.getElementById(id)?.classList.remove("hidden");
	}
	document.getElementById("info-pin-btn")?.classList.remove("hidden");
	document.getElementById("info-resources-section")?.classList.add("hidden");

	const cmdContainer = document.getElementById("command-tree-container");
	if (cmdContainer) {
		cmdContainer.classList.remove("hidden");
		renderCommandTree(entry, cmdContainer);
	}

	const engine = ENGINE_TYPES.find((e) => e.id === entry.engineId);
	const engineValueEl = document.getElementById("ship-engine-value");
	if (engineValueEl) engineValueEl.textContent = engine ? engine.name : entry.engineId;

	setFuelText(entry);

	const crewValueEl = document.getElementById("info-crew-value");
	if (crewValueEl) crewValueEl.textContent = `${entry.crew.count} crew`;

	setColoredPct("info-morale-value", Math.round(entry.crew.morale));

	const leaveValueEl = document.getElementById("info-leave-value");
	if (leaveValueEl)
		leaveValueEl.textContent = `${Math.round(state.simTime.days - entry.crew.lastShoreLeave)}d`;

	updateHullAndAge(entry);

	const suppliesValueEl = document.getElementById("info-supplies-value");
	if (suppliesValueEl) {
		suppliesValueEl.textContent = `${Math.round(entry.maintenance.supplies)} / ${entry.maintenance.maxSupplies} MSP`;
	}

	const actionValueEl = document.getElementById("info-action-value");
	if (actionValueEl) actionValueEl.textContent = formatShipAction(entry);

	const durationValueEl = document.getElementById("info-duration-value");
	if (durationValueEl) durationValueEl.textContent = formatShipDuration(entry);
}

function hideShipPanel(): void {
	for (const id of SHIP_ROW_IDS) {
		document.getElementById(id)?.classList.add("hidden");
	}
	document.getElementById("info-pin-btn")?.classList.add("hidden");
	document.getElementById("command-tree-container")?.classList.add("hidden");
}

function buildDepositRow(deposit: ResourceDeposit): HTMLElement | null {
	const def = getResourceDef(deposit.resourceId);
	if (!def) return null;

	const categoryColors: Record<string, string> = {
		metal: "#aaccaa",
		volatile: "#88aacc",
		industrial: "#ccaa88",
		radioactive: "#cc8888",
		umbral: "#aa88cc",
	};

	const row = document.createElement("div");
	row.style.cssText = "display:flex;gap:6px;align-items:baseline;font-size:11px;padding:1px 0;";

	const symbolEl = document.createElement("span");
	symbolEl.textContent = def.symbol;
	symbolEl.style.cssText = `color:${categoryColors[def.category] ?? "#aaaaaa"};font-weight:bold;min-width:28px;`;

	const nameEl = document.createElement("span");
	nameEl.textContent = def.name;
	nameEl.style.cssText =
		"flex:1;color:#cccccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;";

	const qtyEl = document.createElement("span");
	qtyEl.textContent = `${deposit.quantity.toLocaleString()}t`;
	qtyEl.style.cssText = "color:#aaaaaa;white-space:nowrap;";

	const barEl = document.createElement("span");
	barEl.textContent = formatAccessibilityBar(deposit.accessibility);
	barEl.style.cssText = "color:#888888;font-family:monospace;white-space:nowrap;";

	row.appendChild(symbolEl);
	row.appendChild(nameEl);
	row.appendChild(qtyEl);
	row.appendChild(barEl);
	return row;
}

function updateResourcePanel(entry: BodyEntry): void {
	const resourcesSection = document.getElementById("info-resources-section");
	if (!isSurveyable(entry)) {
		resourcesSection?.classList.add("hidden");
		return;
	}
	if (entry.survey.surveyLevel === 0) {
		resourcesSection?.classList.remove("hidden");
		const surveyStatusEl = document.getElementById("info-survey-status");
		if (surveyStatusEl) surveyStatusEl.textContent = "Unsurveyed";
		const resourcesList = document.getElementById("info-resources-list");
		if (resourcesList) resourcesList.innerHTML = "";
		return;
	}

	resourcesSection?.classList.remove("hidden");

	const surveyStatusEl = document.getElementById("info-survey-status");
	if (surveyStatusEl) surveyStatusEl.textContent = `Surveyed (Lv.${entry.survey.surveyLevel})`;

	const resourcesList = document.getElementById("info-resources-list");
	if (!resourcesList) return;

	resourcesList.innerHTML = "";

	const visibleDeposits = entry.survey.deposits.slice().sort((a, b) => b.quantity - a.quantity);

	for (const deposit of visibleDeposits) {
		const row = buildDepositRow(deposit);
		if (row) resourcesList.appendChild(row);
	}

	const miningValue = classifyMiningValue(entry.survey.deposits, 3);
	const scoreRow = document.createElement("div");
	scoreRow.style.cssText =
		"padding:4px 0 2px;font-size:11px;border-top:1px solid #333;margin-top:2px;";
	scoreRow.innerHTML = `Mining Value: <span style="color:${miningValue.color}">${miningValue.label}</span>`;
	resourcesList.appendChild(scoreRow);
}

export function selectBody(entry: BodyEntry): void {
	deselectCurrentBody();

	state.selectedBody = entry;
	pushBodySelected(entry.data.name);
	if (isCometEntry(entry) && entry.orbitLine) {
		(entry.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_SELECTED_OPACITY;
	}
	animateCameraTo(entry, getZoomDistance(entry.data.type, entry.isMoon));

	updateBodyInfoTitle(entry);

	if (isShipEntry(entry)) {
		showShipPanel(entry);
		document.getElementById("info-colony-section")?.classList.add("hidden");
	} else {
		hideShipPanel();
		updateResourcePanel(entry);
		if (isPlanetEntry(entry)) {
			renderColonyPanel(entry);
		}
	}
}

function selectAsteroid(hit: {
	belt: AsteroidBeltData;
	asteroid: AsteroidInfo;
	index: number;
}): void {
	if (state.selectedBody) {
		(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
		state.selectedBody = null;
	}
	document.querySelectorAll(".body-list-item").forEach((el) => {
		el.classList.remove("selected");
	});

	const { belt, asteroid } = hit;
	const panel: HTMLElement | null = document.getElementById("info-panel");
	panel?.classList.remove("hidden");
	const titleEl = document.getElementById("info-title");
	if (titleEl) {
		titleEl.textContent = asteroid.designation;
	}
	const typeEl = document.getElementById("info-type");
	if (typeEl) {
		typeEl.textContent = `Asteroid (${belt.name})`;
	}
}

export function updateFollow(dt = 0.033): void {
	if (!state.selectedBody || state.flyTo) return;
	const pos: THREE.Vector3 = state.selectedBody.mesh.position;
	const dx: number = pos.x - controls.target.x;
	const dy: number = pos.y - controls.target.y;
	const dz: number = pos.z - controls.target.z;
	const damping = 12;
	const factor = 1 - Math.exp(-damping * dt);
	// Snap when factor is effectively 1 to avoid floating point drift
	if (factor >= 0.99) {
		controls.target.x += dx;
		controls.target.y += dy;
		controls.target.z += dz;
		camera.position.x += dx;
		camera.position.y += dy;
		camera.position.z += dz;
	} else {
		controls.target.x += dx * factor;
		controls.target.y += dy * factor;
		controls.target.z += dz * factor;
		camera.position.x += dx * factor;
		camera.position.y += dy * factor;
		camera.position.z += dz * factor;
	}
}

function updateShipStatus(entry: ShipEntry): void {
	setColoredPct("info-morale-value", Math.round(entry.crew.morale));

	const leaveEl = document.getElementById("info-leave-value");
	if (leaveEl)
		leaveEl.textContent = `${Math.round(state.simTime.days - entry.crew.lastShoreLeave)}d`;

	updateHullAndAge(entry);

	const suppliesEl = document.getElementById("info-supplies-value");
	if (suppliesEl) {
		suppliesEl.textContent = `${Math.round(entry.maintenance.supplies)} / ${entry.maintenance.maxSupplies} MSP`;
	}

	setFuelText(entry);

	const actionEl = document.getElementById("info-action-value");
	if (actionEl) actionEl.textContent = formatShipAction(entry);

	const durationEl = document.getElementById("info-duration-value");
	if (durationEl) durationEl.textContent = formatShipDuration(entry);

	// Hide transfer status row during normal operation (only used for error flashes)
	const transferStatusRow = document.getElementById("info-transfer-status");
	if (transferStatusRow && entry.shipState === "transferring") {
		transferStatusRow.classList.add("hidden");
	}
}

export function updateSelectedBody(): void {
	if (state.selectedBody && isShipEntry(state.selectedBody)) {
		updateShipStatus(state.selectedBody);
	}
}

function onCanvasClick(event: MouseEvent): void {
	const mx: number = event.clientX;
	const my: number = event.clientY;

	let closest: BodyEntry | null = null;
	let closestDist: number = Infinity;
	let closestAsteroid: {
		belt: AsteroidBeltData;
		asteroid: AsteroidInfo;
		index: number;
	} | null = null;

	state.bodyMeshes.forEach((entry) => {
		clickVec.copy(entry.mesh.position);
		clickVec.project(camera);
		if (clickVec.z > 1) return;

		const sx: number = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
		const sy: number = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
		const dist: number = Math.hypot(mx - sx, my - sy);

		if (dist < closestDist) {
			closestDist = dist;
			closest = entry;
			closestAsteroid = null;
		}
	});

	const asteroidClickDist: number = 20;
	state.asteroidBelts.forEach((beltEntry) => {
		const { positions, asteroids, count } = beltEntry;
		for (let i = 0; i < count; i++) {
			clickVec.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
			clickVec.project(camera);
			if (clickVec.z > 1) continue;

			const sx: number = (clickVec.x * 0.5 + 0.5) * window.innerWidth;
			const sy: number = (-clickVec.y * 0.5 + 0.5) * window.innerHeight;
			const dist: number = Math.hypot(mx - sx, my - sy);

			if (dist < closestDist && dist < asteroidClickDist) {
				closestDist = dist;
				closest = null;
				closestAsteroid = {
					belt: beltEntry.belt,
					asteroid: asteroids[i],
					index: i,
				};
			}
		}
	});

	if (closestAsteroid && closestDist < asteroidClickDist) {
		selectAsteroid(closestAsteroid);
	} else if (closest && closestDist < MAX_CLICK_DIST) {
		selectBody(closest);
	}
}

export function setupClickHandlers(): void {
	renderer.domElement.addEventListener("click", onCanvasClick);

	// Re-attach click handler when renderer is recreated (antialias toggle)
	window.addEventListener("renderer-replaced", () => {
		renderer.domElement.addEventListener("click", onCanvasClick);
	});

	const infoPanel = document.getElementById("info-panel");
	if (infoPanel) attachPanelDrag(infoPanel);

	document.getElementById("info-pin-btn")?.addEventListener("click", () => {
		if (state.selectedBody && isShipEntry(state.selectedBody)) {
			createPinnedPanel(state.selectedBody);
		}
	});

	const closeBtn = document.getElementById("info-close");
	if (closeBtn) {
		closeBtn.addEventListener("click", () => {
			const infoPanel = document.getElementById("info-panel");
			if (infoPanel) {
				infoPanel.classList.add("hidden");
			}
			if (state.selectedBody) {
				(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
				if (isCometEntry(state.selectedBody) && state.selectedBody.orbitLine) {
					(state.selectedBody.orbitLine.material as THREE.LineBasicMaterial).opacity =
						COMET_ORBIT_OPACITY;
				}
				state.selectedBody = null;
			}
		});
	}
}
