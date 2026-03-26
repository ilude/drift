import {
	addConstructionProject,
	CONSTRUCTION_DEFS,
	cancelConstructionProject,
	computeColonyQualities,
	computeColonyWorkforce,
	getColony,
	getResearchDef,
	RESEARCH_DEFS,
	setResearchLabs,
	startResearchProject,
	toggleConstructionProjectPaused,
} from "../core/colonies";
import { state } from "../core/state";
import type { PlanetEntry } from "../types";

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
			<div class="colony-card"><span class="colony-card-label">Repair</span><span class="colony-card-value">${formatPercent(qualities.repair)}</span></div>
			<div class="colony-card"><span class="colony-card-label">Refuel</span><span class="colony-card-value">${formatPercent(qualities.refuel)}</span></div>
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
			<div class="colony-help">Aurora-style model: construction factories produce build points, and projects consume a share of colony industry over time.</div>
			<div class="colony-project-list">${projects}</div>
		</div>
	`;
}

function renderResearch(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return "";
	const availableLabs = Math.max(1, colony.installations.lab);
	const techOptions = RESEARCH_DEFS.filter(
		(def) => !colony.currentResearch || def.id !== colony.currentResearch.techId,
	)
		.filter((def) => !colony.researchQueue.some((project) => project.techId === def.id))
		.filter((def) => !state.researchedTechs.has(def.id))
		.map((def) => `<option value="${def.id}">${def.name} (${def.rpCost} RP)</option>`)
		.join("");
	const labOptions = Array.from({ length: availableLabs }, (_, index) => {
		const value = index + 1;
		return `<option value="${value}" ${value === availableLabs ? "selected" : ""}>${value} lab${value === 1 ? "" : "s"}</option>`;
	}).join("");
	const currentProject = colony.currentResearch
		? (() => {
				const [def, defFound] = getResearchDef(colony.currentResearch.techId);
				const progress = defFound
					? Math.min(100, Math.round((colony.currentResearch.progressRp / def?.rpCost) * 100))
					: 0;
				return `
					<div class="colony-project">
						<div>
							<div class="colony-project-title">${def?.name ?? colony.currentResearch.techId}</div>
							<div class="colony-project-meta">${Math.floor(colony.currentResearch.progressRp)} / ${def?.rpCost ?? 0} RP • ${colony.currentResearch.assignedLabs} labs • ${progress}%</div>
							<div class="colony-help">${def?.effectText ?? ""}</div>
						</div>
					</div>
				`;
			})()
		: `<div class="colony-empty">No active research project.</div>`;
	const queue =
		colony.researchQueue.length === 0
			? `<div class="colony-empty">Queue empty.</div>`
			: colony.researchQueue
					.map((project) => {
						const [def] = getResearchDef(project.techId);
						return `<div class="colony-queue-item">${def?.name ?? project.techId} • ${project.assignedLabs} labs</div>`;
					})
					.join("");
	const completed = RESEARCH_DEFS.filter((def) => state.researchedTechs.has(def.id))
		.map((def) => `<div class="colony-queue-item">${def.name} • ${def.effectText}</div>`)
		.join("");
	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Research</div>
			<div class="colony-form">
				<select id="colony-research-tech">${techOptions}</select>
				<select id="colony-research-labs">${labOptions}</select>
				<button type="button" class="ctrl-btn" id="colony-research-start">Start</button>
				<button type="button" class="ctrl-btn" id="colony-research-queue">Queue</button>
			</div>
			<div class="colony-help">Aurora-like start: research is colony-local, uses assigned labs, and runs one active project with a queue.</div>
			${currentProject}
			<div class="colony-subheader">Queue</div>
			<div class="colony-project-list">${queue}</div>
			<div class="colony-subheader">Completed</div>
			<div class="colony-project-list">${completed || `<div class="colony-empty">No completed technologies.</div>`}</div>
		</div>
	`;
}

function attachEvents(entry: PlanetEntry): void {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return;

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

	const startBtn = document.getElementById("colony-research-start");
	const queueBtn = document.getElementById("colony-research-queue");
	const handleResearch = (queue: boolean) => {
		const techEl = document.getElementById("colony-research-tech") as HTMLSelectElement | null;
		const labsEl = document.getElementById("colony-research-labs") as HTMLSelectElement | null;
		if (!techEl || !labsEl || !techEl.value) return;
		if (!colony.currentResearch) {
			startResearchProject(
				entry.data.name,
				techEl.value,
				Math.max(1, Number(labsEl.value) || 1),
				false,
			);
		} else {
			startResearchProject(
				entry.data.name,
				techEl.value,
				Math.max(1, Number(labsEl.value) || 1),
				queue,
			);
		}
		renderColonyPanel(entry);
	};
	startBtn?.addEventListener("click", () => {
		handleResearch(false);
	});
	queueBtn?.addEventListener("click", () => {
		handleResearch(true);
	});

	const labsEl = document.getElementById("colony-research-labs");
	labsEl?.addEventListener("change", () => {
		const select = labsEl as HTMLSelectElement;
		setResearchLabs(entry.data.name, Math.max(1, Number(select.value) || 1));
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
