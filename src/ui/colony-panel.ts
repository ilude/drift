import {
	addConstructionProject,
	CONSTRUCTION_DEFS,
	cancelConstructionProject,
	computeColonyQualities,
	computeColonyWorkforce,
	getColony,
	getColonyBuildPointsPerDay,
	getConstructionProjectEtaDays,
	getSurveySpeedMultiplier,
	toggleConstructionProjectPaused,
} from "../core/colonies";
import type { ColonyConstructionProject, PlanetEntry } from "../types";

function getSection(): HTMLElement | null {
	return document.getElementById("info-colony-section");
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`;
}

function renderOverview(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return "";
	const workforce = computeColonyWorkforce(colony);
	const qualities = computeColonyQualities(colony);
	return `
		<div class="colony-grid">
			<div class="colony-card"><span class="colony-card-label">Population</span><span class="colony-card-value">${colony.population.toLocaleString()}</span></div>
			<div class="colony-card"><span class="colony-card-label">Workforce</span><span class="colony-card-value">${workforce.usedWorkers.toLocaleString()} / ${workforce.availableWorkers.toLocaleString()}</span></div>
			<div class="colony-card"><span class="colony-card-label">Staffing</span><span class="colony-card-value">${formatPercent(workforce.staffingRatio)}</span></div>
			<div class="colony-card"><span class="colony-card-label">Construction</span><span class="colony-card-value">${formatPercent(qualities.construction)}</span></div>
			<div class="colony-card"><span class="colony-card-label">Research</span><span class="colony-card-value">${formatPercent(qualities.research)}</span></div>
			<div class="colony-card"><span class="colony-card-label">Survey Speed</span><span class="colony-card-value">x${(1 / getSurveySpeedMultiplier()).toFixed(2)}</span></div>
		</div>
		<div class="colony-stockpile">
			<div class="colony-subheader">Stockpiles</div>
			<div class="info-row"><span class="info-label">Fuel</span><span>${Math.round(colony.stockpile.fuelKg).toLocaleString()} kg</span></div>
			<div class="info-row"><span class="info-label">Supplies</span><span>${Math.round(colony.stockpile.supplies).toLocaleString()} MSP</span></div>
			<div class="info-row"><span class="info-label">Research Generated</span><span>${Math.floor(colony.researchPoints).toLocaleString()} RP</span></div>
			<div class="info-row"><span class="info-label">Installations</span><span>CF ${colony.installations.constructionFactory} | Mines ${colony.installations.mine} | Labs ${colony.installations.lab} | Yards ${colony.installations.shipyard}</span></div>
		</div>
	`;
}

function renderProjectRow(
	project: ColonyConstructionProject,
	bpPerDay: number,
	totalAllocationPct: number,
): string {
	const def = CONSTRUCTION_DEFS.find((item) => item.id === project.installationId);
	const percentDone =
		project.totalQuantity <= 0
			? 0
			: Math.round(
					((project.totalQuantity - project.quantityRemaining) / project.totalQuantity) * 100,
				);
	const etaDays = project.paused
		? null
		: getConstructionProjectEtaDays(project, bpPerDay, totalAllocationPct);
	const etaText = project.paused ? "Paused" : etaDays === null ? "—" : `${Math.ceil(etaDays)} days`;
	return `
		<div class="colony-project">
			<div>
				<div class="colony-project-title">${def?.name ?? project.installationId} × ${project.quantityRemaining}</div>
				<div class="colony-project-meta">${project.allocationPct}% industry • ${percentDone}% complete • ETA: ${etaText}</div>
			</div>
			<div class="colony-project-actions">
				<button type="button" class="ctrl-btn colony-project-toggle" data-project-id="${project.id}">${project.paused ? "Resume" : "Pause"}</button>
				<button type="button" class="ctrl-btn colony-project-cancel" data-project-id="${project.id}">Cancel</button>
			</div>
		</div>
	`;
}

function renderConstruction(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return "";

	const bpPerDay = getColonyBuildPointsPerDay(colony);
	const totalAllocationPct = colony.constructionProjects.reduce(
		(sum, p) => sum + (p.paused ? 0 : p.allocationPct),
		0,
	);
	const allocatedBpPerDay = (bpPerDay * Math.min(totalAllocationPct, 100)) / 100;
	const freeBpPerDay = bpPerDay - allocatedBpPerDay;
	const barPct = Math.min(100, Math.round(totalAllocationPct));

	const overAllocWarning =
		totalAllocationPct > 100
			? `<div class="colony-warn">⚠ Total allocation ${Math.round(totalAllocationPct)}% — projects share capacity proportionally</div>`
			: "";

	const capacityBar = `
		<div class="colony-capacity">
			<div class="colony-capacity-stats">
				<span>Total: <b>${bpPerDay.toFixed(1)} BP/day</b></span>
				<span>Allocated: <b>${allocatedBpPerDay.toFixed(1)} BP/day</b></span>
				<span>Free: <b>${freeBpPerDay.toFixed(1)} BP/day</b></span>
			</div>
			<div class="colony-capacity-bar-track">
				<div class="colony-capacity-bar-fill" style="width:${barPct}%"></div>
			</div>
		</div>
		${overAllocWarning}
	`;

	const options = CONSTRUCTION_DEFS.map(
		(def) => `<option value="${def.id}">${def.name} (${def.bpCost} BP)</option>`,
	).join("");

	const projects =
		colony.constructionProjects.length === 0
			? `<div class="colony-empty">No construction projects queued.</div>`
			: colony.constructionProjects
					.map((p) => renderProjectRow(p, bpPerDay, totalAllocationPct))
					.join("");

	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Industry</div>
			${capacityBar}
			<div class="colony-form">
				<select id="colony-build-installation">${options}</select>
				<input id="colony-build-qty" type="number" min="1" max="99" value="1">
				<select id="colony-build-allocation">
					<option value="10">10%</option>
					<option value="20" selected>20%</option>
					<option value="30">30%</option>
					<option value="50">50%</option>
					<option value="100">100%</option>
				</select>
				<button type="button" class="ctrl-btn" id="colony-build-add">Add Project</button>
			</div>
			<div class="colony-help">Build points are shared across all active projects by allocation percent.</div>
			<div class="colony-project-list">${projects}</div>
		</div>
	`;
}

function attachEvents(entry: PlanetEntry): void {
	const buildAdd = document.getElementById("colony-build-add");
	buildAdd?.addEventListener("click", () => {
		const installationEl = document.getElementById(
			"colony-build-installation",
		) as HTMLSelectElement | null;
		const qtyEl = document.getElementById("colony-build-qty") as HTMLInputElement | null;
		const allocationEl = document.getElementById(
			"colony-build-allocation",
		) as HTMLSelectElement | null;
		if (!installationEl || !qtyEl || !allocationEl) return;
		addConstructionProject(
			entry.data.name,
			installationEl.value as Parameters<typeof addConstructionProject>[1],
			Math.max(1, Number(qtyEl.value) || 1),
			Math.max(1, Number(allocationEl.value) || 20),
		);
		renderColonyPanel(entry);
	});

	document.querySelectorAll(".colony-project-toggle").forEach((el) => {
		el.addEventListener("click", () => {
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			toggleConstructionProjectPaused(entry.data.name, projectId);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-project-cancel").forEach((el) => {
		el.addEventListener("click", () => {
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			cancelConstructionProject(entry.data.name, projectId);
			renderColonyPanel(entry);
		});
	});
}

export function renderColonyPanel(entry: PlanetEntry): void {
	const section = getSection();
	const [_colony, found] = getColony(entry.data.name);
	if (!section) return;
	if (!found) {
		section.classList.add("hidden");
		section.innerHTML = "";
		return;
	}
	section.classList.remove("hidden");
	section.innerHTML = `
		${renderOverview(entry)}
		${renderConstruction(entry)}
	`;
	attachEvents(entry);
}
