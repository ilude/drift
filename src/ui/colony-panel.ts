import {
	addConstructionProject,
	CONSTRUCTION_DEFS,
	cancelConstructionProject,
	computeColonyQualities,
	computeColonyWorkforce,
	getColony,
	getProjectCompletionDate,
	getResearchDashboardRows,
	getScientistsAtColony,
	getSurveySpeedMultiplier,
	queueResearchProjectForScientist,
	RESEARCH_DEFS,
	reorderScientistQueue,
	setResearchPaused,
	setScientistLabs,
	toggleConstructionProjectPaused,
} from "../core/colonies";
import { state } from "../core/state";
import type { PlanetEntry, ScientistDashboardRow, ScientistState } from "../types";

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

function renderConstruction(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return "";
	const options = CONSTRUCTION_DEFS.map(
		(def) => `<option value="${def.id}">${def.name} (${def.bpCost} BP)</option>`,
	).join("");
	const projects =
		colony.constructionProjects.length === 0
			? `<div class="colony-empty">No construction projects queued.</div>`
			: colony.constructionProjects
					.map((project) => {
						const def = CONSTRUCTION_DEFS.find((item) => item.id === project.installationId);
						const percentDone =
							project.totalQuantity <= 0
								? 0
								: Math.round(
										((project.totalQuantity - project.quantityRemaining) / project.totalQuantity) * 100,
									);
						return `
							<div class="colony-project">
								<div>
									<div class="colony-project-title">${def?.name ?? project.installationId}</div>
									<div class="colony-project-meta">${project.quantityRemaining} remaining • ${project.allocationPct}% industry • ${percentDone}% complete</div>
								</div>
								<div class="colony-project-actions">
									<button type="button" class="ctrl-btn colony-project-toggle" data-project-id="${project.id}">${project.paused ? "Resume" : "Pause"}</button>
									<button type="button" class="ctrl-btn colony-project-cancel" data-project-id="${project.id}">Cancel</button>
								</div>
							</div>
						`;
					})
					.join("");
	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Industry</div>
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

function renderScientistRows(scientists: ScientistState[]): string {
	if (scientists.length === 0)
		return `<div class="colony-empty">No scientists at this colony.</div>`;
	return scientists
		.map((scientist) => {
			const queue =
				scientist.projectQueue.length === 0 ? "Queue empty" : scientist.projectQueue.join(", ");
			return `<tr>
				<td>${scientist.name}</td>
				<td>${scientist.primaryCategory} / ${scientist.secondaryCategory}</td>
				<td>${scientist.adminCap}</td>
				<td>
					<input class="colony-scientist-labs" data-scientist-id="${scientist.id}" type="number" min="0" max="${scientist.adminCap}" value="${scientist.assignedLabs}">
				</td>
				<td>${scientist.activeProjectTechId ?? "Idle"}</td>
				<td>${queue}</td>
			</tr>`;
		})
		.join("");
}

function renderProjectGroup(title: string, rows: ScientistDashboardRow[]): string {
	if (rows.length === 0) {
		return `<div class="colony-subheader">${title}</div><div class="colony-empty">None.</div>`;
	}
	const body = rows
		.sort((a, b) => {
			const aEta = a.etaSimDay ?? Number.POSITIVE_INFINITY;
			const bEta = b.etaSimDay ?? Number.POSITIVE_INFINITY;
			return aEta - bEta;
		})
		.map((row) => {
			const def = RESEARCH_DEFS.find((entry) => entry.id === row.techId);
			const progressPct = def ? Math.min(100, Math.round((row.progressRp / def.rpCost) * 100)) : 0;
			const eta = row.status === "queued" ? "--" : getProjectCompletionDate(row.techId);
			return `<tr>
				<td>${row.techId}</td>
				<td>${row.leadScientistName}</td>
				<td>${progressPct}%</td>
				<td>${eta}</td>
				<td>${row.assignedLabs}</td>
			</tr>`;
		})
		.join("");
	return `
		<div class="colony-subheader">${title}</div>
		<table class="colony-table">
			<thead>
				<tr><th>Project</th><th>Lead Scientist</th><th>Progress %</th><th>ETA</th><th>Allocated Labs</th></tr>
			</thead>
			<tbody>${body}</tbody>
		</table>
	`;
}

function renderResearch(entry: PlanetEntry): string {
	const scientists = getScientistsAtColony(entry.data.name);
	const rows = getResearchDashboardRows(entry.data.name);
	const techOptions = RESEARCH_DEFS.filter((def) => !state.researchedTechs.has(def.id))
		.map((def) => `<option value="${def.id}">${def.name} (${def.rpCost} RP)</option>`)
		.join("");
	const scientistOptions = scientists
		.map((scientist) => `<option value="${scientist.id}">${scientist.name}</option>`)
		.join("");
	const active = rows.filter((row) => row.status === "active");
	const paused = rows.filter((row) => row.status === "paused");
	const queued = rows.filter((row) => row.status === "queued");

	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Scientists</div>
			<div class="colony-form">
				<select id="colony-research-scientist">${scientistOptions}</select>
				<select id="colony-research-tech">${techOptions}</select>
				<button type="button" class="ctrl-btn" id="colony-research-add">Assign</button>
			</div>
			<div class="colony-help">Jobs are assigned to scientists. Each scientist runs one active project and keeps a personal queue.</div>
			<table class="colony-table">
				<thead>
					<tr><th>Scientist</th><th>Specialty</th><th>Admin Cap</th><th>Labs</th><th>Active</th><th>Queue</th></tr>
				</thead>
				<tbody>
					${renderScientistRows(scientists)}
				</tbody>
			</table>
			${renderProjectGroup("Active", active)}
			${renderProjectGroup("Paused", paused)}
			${renderProjectGroup("Queued", queued)}
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

	const assignBtn = document.getElementById("colony-research-add");
	assignBtn?.addEventListener("click", () => {
		const scientistEl = document.getElementById(
			"colony-research-scientist",
		) as HTMLSelectElement | null;
		const techEl = document.getElementById("colony-research-tech") as HTMLSelectElement | null;
		if (!scientistEl || !techEl || !scientistEl.value || !techEl.value) return;
		queueResearchProjectForScientist(scientistEl.value, techEl.value);
		renderColonyPanel(entry);
	});

	document.querySelectorAll(".colony-scientist-labs").forEach((node) => {
		node.addEventListener("change", () => {
			const input = node as HTMLInputElement;
			const scientistId = input.dataset.scientistId;
			if (!scientistId) return;
			setScientistLabs(scientistId, Number(input.value) || 0);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-row-pause").forEach((node) => {
		node.addEventListener("click", () => {
			const techId = (node as HTMLElement).dataset.techId;
			if (!techId) return;
			setResearchPaused(techId, true);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-row-resume").forEach((node) => {
		node.addEventListener("click", () => {
			const techId = (node as HTMLElement).dataset.techId;
			if (!techId) return;
			setResearchPaused(techId, false);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-queue-up").forEach((node) => {
		node.addEventListener("click", () => {
			const scientistId = (node as HTMLElement).dataset.scientistId;
			const idx = Number((node as HTMLElement).dataset.idx);
			if (!scientistId || Number.isNaN(idx)) return;
			reorderScientistQueue(scientistId, idx, Math.max(0, idx - 1));
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
		${renderResearch(entry)}
	`;
	attachEvents(entry);
}
