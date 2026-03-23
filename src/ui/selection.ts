import * as THREE from "three";
import { MAX_CLICK_DIST, state } from "../core/state";
import {
	brachistochroneDeltaV,
	brachistochroneTime,
	ENGINE_TYPES,
	exhaustVelocity,
	G_ACCEL,
	rocketDeltaV,
} from "../math/ship-physics";
import { easeOutCubic } from "../math/visual";
import {
	COMET_ORBIT_OPACITY,
	COMET_ORBIT_SELECTED_OPACITY,
	initiateTransfer,
} from "../rendering/rendering";
import { camera, controls, renderer, ZOOM_BASE } from "../rendering/scene";
import type { AsteroidBeltData, AsteroidInfo, BodyEntry, FlyToState, PlanetEntry } from "../types";
import { isCometEntry, isShipEntry } from "../types";

const ZOOM_DIST_RECENTER: number = ZOOM_BASE / 0.25;
const ZOOM_DIST_STAR: number = 75;
const ZOOM_DIST_PLANET: number = 38;
const ZOOM_DIST_MOON: number = 20;

const flyEndTarget: THREE.Vector3 = new THREE.Vector3();
const flyEndCam: THREE.Vector3 = new THREE.Vector3();
const clickVec: THREE.Vector3 = new THREE.Vector3();
const infoPositionEl: HTMLElement | null = document.getElementById("info-position");

const INITIAL_CAM_DIR: THREE.Vector3 = new THREE.Vector3(0, ZOOM_BASE, 80).normalize();

let lastInfoPosText = "";

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
	flyEndTarget.set(pos.x, 0, pos.z);
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
	const zoomDist: number =
		entry.data.type === "Star"
			? ZOOM_DIST_STAR
			: entry.data.type === "Moon"
				? ZOOM_DIST_MOON
				: ZOOM_DIST_PLANET;
	animateCameraTo(entry, zoomDist);

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
	if (isShipEntry(entry)) {
		const distanceEl = document.getElementById("info-distance");
		if (distanceEl) {
			distanceEl.textContent =
				entry.shipState === "transferring"
					? `${entry.orbitA.toFixed(2)} AU (transfer)`
					: `${entry.data.distance} AU`;
		}
		const statusText: string =
			entry.shipState === "transferring"
				? `Transfer → ${entry.transferTarget}`
				: entry.shipState === "departing"
					? `Departing ${entry.hostPlanetName}...`
					: `Orbiting ${entry.hostPlanetName}`;
		const periodEl = document.getElementById("info-period");
		if (periodEl) {
			periodEl.textContent = statusText;
		}
		const radiusEl = document.getElementById("info-radius");
		if (radiusEl) {
			radiusEl.textContent = "-";
		}
		const moonsEl = document.getElementById("info-moons");
		if (moonsEl) {
			moonsEl.textContent = "-";
		}
	} else if (isCometEntry(entry)) {
		const distanceEl = document.getElementById("info-distance");
		if (distanceEl) {
			distanceEl.textContent = `Perihelion: ${entry.data.distance.toFixed(2)} AU | e: ${entry.data.e}`;
		}
		const periodEl = document.getElementById("info-period");
		if (periodEl) {
			periodEl.textContent = entry.data.period > 0 ? `${entry.data.period} years` : "-";
		}
		const radiusEl = document.getElementById("info-radius");
		if (radiusEl) {
			radiusEl.textContent = `${entry.data.radius.toLocaleString()} km`;
		}
		const moonsEl = document.getElementById("info-moons");
		if (moonsEl) {
			moonsEl.textContent = entry.data.moons ? entry.data.moons.length.toString() : "0";
		}
	} else {
		const distanceEl = document.getElementById("info-distance");
		if (distanceEl) {
			distanceEl.textContent = entry.data.distance > 0 ? `${entry.data.distance} AU` : "Center";
		}
		const periodEl = document.getElementById("info-period");
		if (periodEl) {
			periodEl.textContent = entry.data.period > 0 ? `${entry.data.period} years` : "-";
		}
		const radiusEl = document.getElementById("info-radius");
		if (radiusEl) {
			radiusEl.textContent = `${entry.data.radius.toLocaleString()} km`;
		}
		const moonsEl = document.getElementById("info-moons");
		if (moonsEl) {
			moonsEl.textContent = entry.data.moons ? entry.data.moons.length.toString() : "0";
		}
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
	const deltaVRow: HTMLElement | null = document.getElementById("info-ship-deltav");
	if (isShipEntry(entry)) {
		transferRow?.classList.remove("hidden");
		engineRow?.classList.remove("hidden");
		fuelRow?.classList.remove("hidden");
		deltaVRow?.classList.remove("hidden");

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

		// Delta-v budget
		const veKmS: number = engine ? exhaustVelocity(engine.ispS) / 1000 : 0;
		const dvBudget: number = rocketDeltaV(veKmS, entry.dryMassKg + entry.fuelKg, entry.dryMassKg);
		const deltaVValueEl = document.getElementById("ship-deltav-value");
		if (deltaVValueEl) {
			deltaVValueEl.textContent = `${dvBudget.toFixed(2)} km/s`;
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
	} else {
		transferRow?.classList.add("hidden");
		engineRow?.classList.add("hidden");
		fuelRow?.classList.add("hidden");
		deltaVRow?.classList.add("hidden");
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
	const distanceEl = document.getElementById("info-distance");
	if (distanceEl) {
		distanceEl.textContent = `${asteroid.au} AU`;
	}
	const periodEl = document.getElementById("info-period");
	if (periodEl) {
		periodEl.textContent = `${asteroid.period} years`;
	}
	const radiusEl = document.getElementById("info-radius");
	if (radiusEl) {
		radiusEl.textContent = `~${asteroid.diameter} km dia.`;
	}
	const moonsEl = document.getElementById("info-moons");
	if (moonsEl) {
		moonsEl.textContent = "0";
	}
	if (infoPositionEl) infoPositionEl.textContent = "-";
}

export function updateFollow(): void {
	if (!state.selectedBody || state.flyTo) return;
	const pos: THREE.Vector3 = state.selectedBody.mesh.position;
	const dx: number = pos.x - controls.target.x;
	const dz: number = pos.z - controls.target.z;
	controls.target.x += dx;
	controls.target.z += dz;
	camera.position.x += dx;
	camera.position.z += dz;
}

export function updateInfoPosition(): void {
	if (state.selectedBody) {
		const pos: THREE.Vector3 = state.selectedBody.mesh.position;
		const text = `${pos.x.toFixed(1)}, ${pos.z.toFixed(1)}`;
		if (infoPositionEl && text !== lastInfoPosText) {
			infoPositionEl.textContent = text;
			lastInfoPosText = text;
		}
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
