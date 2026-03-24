import * as THREE from "three";
import { MAX_CLICK_DIST, state } from "../core/state";
import { getResourceDef } from "../data/resources";
import {
	brachistochroneDeltaV,
	brachistochroneTime,
	ENGINE_TYPES,
	G_ACCEL,
} from "../math/ship-physics";
import { easeOutCubic } from "../math/visual";
import {
	COMET_ORBIT_OPACITY,
	COMET_ORBIT_SELECTED_OPACITY,
	initiateTransfer,
} from "../rendering/rendering";
import { camera, controls, renderer, ZOOM_BASE } from "../rendering/scene";
import type { AsteroidBeltData, AsteroidInfo, BodyEntry, FlyToState, PlanetEntry } from "../types";
import { isCometEntry, isShipEntry, isSurveyable } from "../types";
import { renderCommandTree } from "./commands";

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
	const star: BodyEntry | undefined = state.bodyMeshes.find((e) => e.data.type === "Star");
	if (!star) return;
	if (state.selectedBody) {
		(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
		state.selectedBody = null;
	}
	document.getElementById("info-panel")?.classList.add("hidden");
	animateCameraTo(star, ZOOM_DIST_RECENTER, INITIAL_CAM_DIR);
}

export function selectBody(entry: BodyEntry): void {
	if (state.selectedBody) {
		(state.selectedBody.selRing.material as THREE.MeshBasicMaterial).opacity = 0;
		if (isCometEntry(state.selectedBody) && state.selectedBody.orbitLine) {
			(state.selectedBody.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_OPACITY;
		}
	}

	state.selectedBody = entry;
	if (isCometEntry(entry) && entry.orbitLine) {
		(entry.orbitLine.material as THREE.LineBasicMaterial).opacity = COMET_ORBIT_SELECTED_OPACITY;
	}
	animateCameraTo(entry, getZoomDistance(entry.data.type, entry.isMoon));

	const panel: HTMLElement | null = document.getElementById("info-panel");
	if (panel) {
		panel.classList.remove("hidden");
	}
	const titleEl = document.getElementById("info-title");
	if (titleEl) {
		titleEl.textContent = entry.data.name;
	}
	const typeEl = document.getElementById("info-type");
	if (typeEl) {
		typeEl.textContent = entry.data.type;
	}

	document.querySelectorAll(".body-list-item").forEach((el) => {
		el.classList.remove("selected");
	});
	const items: NodeListOf<Element> = document.querySelectorAll(".body-list-item");
	items.forEach((el) => {
		if (el.querySelector(".body-list-name")?.textContent === entry.data.name) {
			el.classList.add("selected");
		}
	});

	// Ship-specific UI
	const transferRow: HTMLElement | null = document.getElementById("info-transfer");
	const engineRow: HTMLElement | null = document.getElementById("info-ship-engine");
	const fuelRow: HTMLElement | null = document.getElementById("info-ship-fuel");
	const crewRow: HTMLElement | null = document.getElementById("info-crew-row");
	const moraleRow: HTMLElement | null = document.getElementById("info-morale-row");
	const leaveRow: HTMLElement | null = document.getElementById("info-leave-row");
	const hullRow: HTMLElement | null = document.getElementById("info-hull-row");
	const suppliesRow: HTMLElement | null = document.getElementById("info-supplies-row");
	const actionRow: HTMLElement | null = document.getElementById("info-action-row");
	const resourcesSection: HTMLElement | null = document.getElementById("info-resources-section");
	const cmdContainer: HTMLElement | null = document.getElementById("command-tree-container");

	if (isShipEntry(entry)) {
		transferRow?.classList.remove("hidden");
		engineRow?.classList.remove("hidden");
		fuelRow?.classList.remove("hidden");
		crewRow?.classList.remove("hidden");
		moraleRow?.classList.remove("hidden");
		leaveRow?.classList.remove("hidden");
		hullRow?.classList.remove("hidden");
		suppliesRow?.classList.remove("hidden");
		actionRow?.classList.remove("hidden");
		resourcesSection?.classList.add("hidden");

		// Render command tree editor
		if (cmdContainer) {
			cmdContainer.classList.remove("hidden");
			renderCommandTree(entry, cmdContainer);
		}

		// Engine info
		const engine = ENGINE_TYPES.find((e) => e.id === entry.engineId);
		const engineValueEl = document.getElementById("ship-engine-value");
		if (engineValueEl) {
			engineValueEl.textContent = engine ? engine.name : entry.engineId;
		}

		// Fuel info
		const fuelPct: number =
			entry.fuelCapacityKg > 0 ? Math.round((entry.fuelKg / entry.fuelCapacityKg) * 100) : 0;
		const fuelValueEl = document.getElementById("ship-fuel-value");
		if (fuelValueEl) {
			fuelValueEl.textContent = `${(entry.fuelKg / 1000).toFixed(2)}t / ${(entry.fuelCapacityKg / 1000).toFixed(2)}t (${fuelPct}%)`;
		}

		// Transfer dropdown with delta-v costs
		const select: HTMLSelectElement | null = document.getElementById(
			"transfer-target",
		) as HTMLSelectElement | null;
		if (select) {
			select.innerHTML = "";
			const hostEntry = state.bodyMeshes.find(
				(e) => e.data.name === entry.hostPlanetName && !e.isMoon && !isShipEntry(e),
			);
			const r1: number = hostEntry ? hostEntry.data.distance : entry.data.distance;
			const accelMS2: number = engine ? engine.accelG * G_ACCEL : 0;
			state.bodyMeshes
				.filter((e) => e.data.type === "Planet" || e.data.type === "Dwarf Planet")
				.forEach((e) => {
					const opt: HTMLOptionElement = document.createElement("option");
					opt.value = e.data.name;
					if (e.data.distance !== r1 && accelMS2 > 0) {
						const dv: number = brachistochroneDeltaV(r1, e.data.distance, accelMS2);
						const days: number = brachistochroneTime(r1, e.data.distance, accelMS2);
						const timeStr: string = days < 1 ? `${Math.round(days * 24)}h` : `${days.toFixed(1)}d`;
						opt.textContent = `${e.data.name} (${Math.round(dv)} km/s, ${timeStr})`;
					} else {
						opt.textContent = `${e.data.name} (here)`;
					}
					select.appendChild(opt);
				});
		}

		// Crew
		const crewValueEl = document.getElementById("info-crew-value");
		if (crewValueEl) {
			crewValueEl.textContent = `${entry.crew.count} crew`;
		}

		// Morale
		const moraleValueEl = document.getElementById("info-morale-value");
		if (moraleValueEl) {
			const moralePct = Math.round(entry.crew.morale);
			moraleValueEl.textContent = `${moralePct}%`;
			moraleValueEl.style.color = moralePct > 70 ? "#4a6a4a" : moralePct > 40 ? "#aaaa44" : "#aa4444";
		}

		// Days since leave
		const leaveValueEl = document.getElementById("info-leave-value");
		if (leaveValueEl) {
			const daysSinceLeave = Math.round(state.simTime - entry.crew.lastShoreLeave);
			leaveValueEl.textContent = `${daysSinceLeave}d`;
		}

		// Hull integrity
		const hullValueEl = document.getElementById("info-hull-value");
		if (hullValueEl) {
			const hullPct = Math.round(entry.maintenance.hullIntegrity);
			hullValueEl.textContent = `${hullPct}%`;
			hullValueEl.style.color = hullPct > 70 ? "#4a6a4a" : hullPct > 40 ? "#aaaa44" : "#aa4444";
		}

		// Supplies
		const suppliesValueEl = document.getElementById("info-supplies-value");
		if (suppliesValueEl) {
			suppliesValueEl.textContent = `${entry.maintenance.supplies} / ${entry.maintenance.maxSupplies} MSP`;
		}

		// Action
		const actionValueEl = document.getElementById("info-action-value");
		if (actionValueEl) {
			let actionText = "Idle";
			const action = entry.action;
			if (entry.shipState === "transferring") {
				actionText = `In transit to ${entry.transferTarget}`;
			} else if (action.type === "survey-nearest") {
				const elapsed = Math.floor(action.progress * action.duration);
				actionText = `Surveying ${action.target ?? "?"} (${elapsed}d/${action.duration}d)`;
			} else if (action.type === "shore-leave") {
				const elapsed = Math.floor(action.progress * action.duration);
				actionText = `Shore Leave (${elapsed}d/${action.duration}d)`;
			} else if (action.type === "overhaul") {
				const elapsed = Math.floor(action.progress * action.duration);
				actionText = `Overhaul (${elapsed}d/${action.duration}d)`;
			} else if (action.type === "refuel") {
				actionText = "Refueling...";
			}
			actionValueEl.textContent = actionText;
		}
	} else {
		transferRow?.classList.add("hidden");
		engineRow?.classList.add("hidden");
		fuelRow?.classList.add("hidden");
		crewRow?.classList.add("hidden");
		moraleRow?.classList.add("hidden");
		leaveRow?.classList.add("hidden");
		hullRow?.classList.add("hidden");
		suppliesRow?.classList.add("hidden");
		actionRow?.classList.add("hidden");
		cmdContainer?.classList.add("hidden");

		// Resource viewer for surveyed bodies
		if (isSurveyable(entry) && entry.survey.surveyLevel > 0) {
			resourcesSection?.classList.remove("hidden");

			const surveyStatusEl = document.getElementById("info-survey-status");
			if (surveyStatusEl) {
				surveyStatusEl.textContent = `Surveyed (Lv.${entry.survey.surveyLevel})`;
			}

			const resourcesList = document.getElementById("info-resources-list");
			if (resourcesList) {
				resourcesList.innerHTML = "";

				const categoryColors: Record<string, string> = {
					metal: "#aaccaa",
					volatile: "#88aacc",
					industrial: "#ccaa88",
					radioactive: "#cc8888",
					umbral: "#aa88cc",
				};

				const visibleDeposits = entry.survey.deposits
					.filter((d) => d.minSurveyLevel <= entry.survey.surveyLevel)
					.slice()
					.sort((a, b) => b.quantity - a.quantity);

				for (const deposit of visibleDeposits) {
					const def = getResourceDef(deposit.resourceId);
					if (!def) continue;

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

					// ASCII accessibility bar: 5 chars, e.g. [====.]
					const filled = Math.round(deposit.accessibility * 5);
					const bar = `[${"=".repeat(filled)}${".".repeat(5 - filled)}]`;
					const barEl = document.createElement("span");
					barEl.textContent = bar;
					barEl.style.cssText = "color:#888888;font-family:monospace;white-space:nowrap;";

					row.appendChild(symbolEl);
					row.appendChild(nameEl);
					row.appendChild(qtyEl);
					row.appendChild(barEl);
					resourcesList.appendChild(row);
				}

				// Mining value score
				const score = entry.survey.deposits
					.filter((d) => d.minSurveyLevel <= entry.survey.surveyLevel)
					.reduce((sum, d) => sum + d.quantity * d.accessibility, 0);
				const scoreLabel =
					score > 100000 ? "High" : score > 10000 ? "Medium" : score > 0 ? "Low" : "None";
				const scoreColor =
					score > 100000 ? "#4a6a4a" : score > 10000 ? "#aaaa44" : score > 0 ? "#888888" : "#666666";

				const scoreRow = document.createElement("div");
				scoreRow.style.cssText =
					"padding:4px 0 2px;font-size:11px;border-top:1px solid #333;margin-top:2px;";
				scoreRow.innerHTML = `Mining Value: <span style="color:${scoreColor}">${scoreLabel}</span>`;
				resourcesList.appendChild(scoreRow);
			}
		} else {
			resourcesSection?.classList.add("hidden");
		}
	}
}

export function selectAsteroid(hit: {
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

export function updateFollow(): void {
	if (!state.selectedBody || state.flyTo) return;
	const pos: THREE.Vector3 = state.selectedBody.mesh.position;
	const dx: number = pos.x - controls.target.x;
	const dy: number = pos.y - controls.target.y;
	const dz: number = pos.z - controls.target.z;
	controls.target.x += dx;
	controls.target.y += dy;
	controls.target.z += dz;
	camera.position.x += dx;
	camera.position.y += dy;
	camera.position.z += dz;
}

function updateShipStatus(entry: ShipEntry): void {
	// Morale (live)
	const moraleEl = document.getElementById("info-morale-value");
	if (moraleEl) {
		const m = Math.round(entry.crew.morale);
		moraleEl.textContent = `${m}%`;
		moraleEl.style.color = m > 70 ? "#4a6a4a" : m > 40 ? "#aaaa44" : "#aa4444";
	}

	// Hull (live)
	const hullEl = document.getElementById("info-hull-value");
	if (hullEl) {
		const h = Math.round(entry.maintenance.hullIntegrity);
		hullEl.textContent = `${h}%`;
		hullEl.style.color = h > 70 ? "#4a6a4a" : h > 40 ? "#aaaa44" : "#aa4444";
	}

	// Supplies (live)
	const suppliesEl = document.getElementById("info-supplies-value");
	if (suppliesEl) {
		suppliesEl.textContent = `${entry.maintenance.supplies} / ${entry.maintenance.maxSupplies} MSP`;
	}

	// Fuel (live)
	const fuelEl = document.getElementById("ship-fuel-value");
	if (fuelEl) {
		const pct =
			entry.fuelCapacityKg > 0 ? Math.round((entry.fuelKg / entry.fuelCapacityKg) * 100) : 0;
		fuelEl.textContent = `${(entry.fuelKg / 1000).toFixed(2)}t / ${(entry.fuelCapacityKg / 1000).toFixed(2)}t (${pct}%)`;
	}

	// Action (live)
	const actionEl = document.getElementById("info-action-value");
	if (actionEl) {
		let text = "Idle";
		const action = entry.action;
		if (entry.shipState === "transferring") {
			text = `In transit to ${entry.transferTarget}`;
		} else if (action.type === "survey-nearest" && action.startTime > 0) {
			const elapsed = Math.floor(action.progress * action.duration);
			text = `Surveying ${action.target ?? "?"} (${elapsed}d/${action.duration}d)`;
		} else if (action.type === "shore-leave" && action.startTime > 0) {
			const elapsed = Math.floor(action.progress * action.duration);
			text = `Shore Leave (${elapsed}d/${action.duration}d)`;
		} else if (action.type === "overhaul" && action.startTime > 0) {
			const elapsed = Math.floor(action.progress * action.duration);
			text = `Overhaul (${elapsed}d/${action.duration}d)`;
		} else if (action.type === "refuel") {
			text = "Refueling...";
		} else if (action.type === "survey-nearest") {
			text = `En route to ${action.target ?? "?"}`;
		}
		actionEl.textContent = text;
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

	const transferBtn = document.getElementById("btn-transfer");
	if (transferBtn) {
		transferBtn.addEventListener("click", () => {
			if (!state.selectedBody || !isShipEntry(state.selectedBody)) return;
			const targetName: string =
				(document.getElementById("transfer-target") as HTMLSelectElement | null)?.value ?? "";
			const targetEntry = state.bodyMeshes.find((e) => e.data.name === targetName);
			if (targetEntry) initiateTransfer(state.selectedBody, targetEntry as PlanetEntry);
		});
	}

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
