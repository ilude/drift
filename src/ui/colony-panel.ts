import {
	addConstructionProject,
	addProductionProject,
	addShipbuildProject,
	CONSTRUCTION_DEFS,
	canAffordShipbuild,
	cancelConstructionProject,
	cancelProductionProject,
	cancelShipbuildProject,
	computeColonyQualities,
	computeColonyWorkforce,
	computeShipResourceCost,
	getColony,
	getColonyBuildPointsPerDay,
	getConstructionProjectEtaDays,
	getProductionBpPerDay,
	getProductionDef,
	getProductionProjectEtaDays,
	getShipbuildBpPerDay,
	getSurveySpeedMultiplier,
	PRODUCTION_DEFS,
	pauseProductionProject,
	pauseShipbuildProject,
	toggleConstructionProjectPaused,
} from "../core/colonies";
import { state } from "../core/state";
import type {
	ColonyConstructionProject,
	ColonyProductionProject,
	ColonyShipbuildProject,
	PlanetEntry,
	ShipDesign,
} from "../types";

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

function renderProductionRow(
	project: ColonyProductionProject,
	bpPerDay: number,
	totalAllocationPct: number,
): string {
	const def = getProductionDef(project.itemId);
	const percentDone =
		project.totalQuantity <= 0
			? 0
			: Math.round(
					((project.totalQuantity - project.quantityRemaining) / project.totalQuantity) * 100,
				);
	const etaDays = project.paused
		? null
		: getProductionProjectEtaDays(project, bpPerDay, totalAllocationPct);
	const etaText = project.paused ? "Paused" : etaDays === null ? "—" : `${Math.ceil(etaDays)} days`;
	return `
		<div class="colony-project">
			<div>
				<div class="colony-project-title">${def?.name ?? project.itemId} × ${project.quantityRemaining}</div>
				<div class="colony-project-meta">${project.allocationPct}% industry • ${percentDone}% complete • ETA: ${etaText}</div>
			</div>
			<div class="colony-project-actions">
				<button type="button" class="ctrl-btn colony-prod-toggle" data-project-id="${project.id}">${project.paused ? "Resume" : "Pause"}</button>
				<button type="button" class="ctrl-btn colony-prod-cancel" data-project-id="${project.id}">Cancel</button>
			</div>
		</div>
	`;
}

function renderProduction(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found) return "";
	if (colony.installations.constructionFactory <= 0) return "";

	const bpPerDay = getProductionBpPerDay(colony);
	const totalAllocationPct = (colony.productionProjects ?? []).reduce(
		(sum, p) => sum + (p.paused ? 0 : p.allocationPct),
		0,
	);

	const options = PRODUCTION_DEFS.map(
		(def) => `<option value="${def.id}">${def.name} (${def.bpCost} BP)</option>`,
	).join("");

	const projects =
		(colony.productionProjects ?? []).length === 0
			? `<div class="colony-empty">No production projects queued.</div>`
			: (colony.productionProjects ?? [])
					.map((p) => renderProductionRow(p, bpPerDay, totalAllocationPct))
					.join("");

	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Production</div>
			<div class="colony-capacity-stats" style="margin-bottom:6px">
				<span>Capacity: <b>${bpPerDay.toFixed(1)} BP/day</b></span>
			</div>
			<div class="colony-form">
				<select id="colony-prod-item">${options}</select>
				<input id="colony-prod-qty" type="number" min="1" max="99" value="1">
				<select id="colony-prod-allocation">
					<option value="10">10%</option>
					<option value="20" selected>20%</option>
					<option value="30">30%</option>
					<option value="50">50%</option>
					<option value="100">100%</option>
				</select>
				<button type="button" class="ctrl-btn" id="colony-prod-add">Add Project</button>
			</div>
			<div class="colony-project-list">${projects}</div>
		</div>
	`;
}

function formatResourceCost(cost: Record<string, number>, stock: Record<string, number>): string {
	return Object.entries(cost)
		.map(([id, amount]) => {
			const have = Math.floor(stock[id] ?? 0);
			const canAfford = have >= amount;
			const cls = canAfford ? "colony-cost-ok" : "colony-cost-short";
			return `<span class="${cls}">${id} ${amount.toLocaleString()} (${have.toLocaleString()})</span>`;
		})
		.join(" ");
}

function renderShipbuildRow(
	project: ColonyShipbuildProject,
	bpPerDay: number,
	designName: string,
): string {
	const pct = project.totalBp <= 0 ? 0 : Math.round((project.progressBp / project.totalBp) * 100);
	const remaining = Math.max(0, project.totalBp - project.progressBp);
	const etaText =
		project.paused || bpPerDay <= 0
			? project.paused
				? "Paused"
				: "—"
			: `${Math.ceil(remaining / bpPerDay)} days`;
	return `
		<div class="colony-project">
			<div style="flex:1">
				<div class="colony-project-title">${project.shipName} <span style="color:#6a8a6a">(${designName})</span></div>
				<div class="colony-project-meta">${pct}% complete • ETA: ${etaText}</div>
				<div class="colony-project-bar-track" style="height:4px;background:#1a2a1a;border-radius:2px;margin-top:4px">
					<div style="width:${pct}%;height:100%;background:#446644;border-radius:2px"></div>
				</div>
			</div>
			<div class="colony-project-actions">
				<button type="button" class="ctrl-btn colony-ship-toggle" data-project-id="${project.id}">${project.paused ? "Resume" : "Pause"}</button>
				<button type="button" class="ctrl-btn colony-ship-cancel" data-project-id="${project.id}">Cancel</button>
			</div>
		</div>
	`;
}

function getDesignDisplayName(design: ShipDesign): string {
	const massT = Math.round(design.dryMassKg / 1000);
	const accel = design.accelG.toFixed(3);
	const cargo =
		design.cargoCapacityKg > 0 ? ` · ${Math.round(design.cargoCapacityKg / 1000)}t cargo` : "";
	return `${design.name} (${massT}t · ${accel}G${cargo})`;
}

function generateShipName(designName: string, existingCount: number): string {
	const num = String(existingCount + 1).padStart(3, "0");
	return `ISS ${designName}-${num}`;
}

function renderShipyard(entry: PlanetEntry): string {
	const [colony, found] = getColony(entry.data.name);
	if (!found || colony.installations.shipyard <= 0) return "";

	const bpPerDay = getShipbuildBpPerDay(colony);
	const designs = Array.from(state.shipDesigns.values());

	const designOptions =
		designs.length === 0
			? `<option value="">No designs available</option>`
			: designs.map((d) => `<option value="${d.id}">${getDesignDisplayName(d)}</option>`).join("");

	const firstDesign = designs[0];
	let costPreview = "";
	let defaultShipName = "";
	if (firstDesign) {
		const cost = computeShipResourceCost(firstDesign);
		const affordable = canAffordShipbuild(colony, firstDesign);
		const costHtml = formatResourceCost(cost, colony.stockpile.resources);
		const totalBp = Math.ceil(firstDesign.dryMassKg / 50);
		const etaDays = bpPerDay > 0 ? Math.ceil(totalBp / bpPerDay) : null;
		const etaText = etaDays === null ? "—" : `${etaDays} days`;
		costPreview = `
			<div class="colony-cost-preview ${affordable ? "" : "colony-cost-unaffordable"}">
				<span style="color:#8a9a8a;font-size:10px">Cost: </span>${costHtml}
				<span style="color:#6a8a6a;font-size:10px;margin-left:6px">Build: ${totalBp} BP · ETA: ${etaText}</span>
			</div>
		`;
		const existingCount = colony.shipbuildProjects.filter(
			(p) => state.shipDesigns.get(p.designId)?.name === firstDesign.name,
		).length;
		defaultShipName = generateShipName(firstDesign.name, existingCount);
	}

	const projects =
		(colony.shipbuildProjects ?? []).length === 0
			? `<div class="colony-empty">No ships under construction.</div>`
			: (colony.shipbuildProjects ?? [])
					.map((p) => {
						const design = state.shipDesigns.get(p.designId);
						return renderShipbuildRow(p, bpPerDay, design?.name ?? p.designId);
					})
					.join("");

	return `
		<div class="colony-section-block">
			<div class="colony-subheader">Shipyard</div>
			<div class="colony-capacity-stats" style="margin-bottom:6px">
				<span>Capacity: <b>${bpPerDay.toFixed(1)} BP/day</b></span>
			</div>
			<div class="colony-form">
				<select id="colony-ship-design" style="flex:1">${designOptions}</select>
				<input id="colony-ship-name" type="text" placeholder="Ship name" style="width:140px" value="${defaultShipName}">
				<button type="button" class="ctrl-btn" id="colony-ship-build">Build Ship</button>
			</div>
			<div id="colony-ship-cost">${costPreview}</div>
			<div class="colony-project-list">${projects}</div>
		</div>
	`;
}

function onShipDesignChange(
	bodyName: string,
	designEl: HTMLSelectElement,
	nameEl: HTMLInputElement,
	costDiv: HTMLElement,
): void {
	const [colony, found] = getColony(bodyName);
	if (!found) return;
	const design = state.shipDesigns.get(designEl.value);
	if (!design) {
		costDiv.innerHTML = "";
		return;
	}
	const cost = computeShipResourceCost(design);
	const affordable = canAffordShipbuild(colony, design);
	const costHtml = formatResourceCost(cost, colony.stockpile.resources);
	const bpPerDay = getShipbuildBpPerDay(colony);
	const totalBp = Math.ceil(design.dryMassKg / 50);
	const etaDays = bpPerDay > 0 ? Math.ceil(totalBp / bpPerDay) : null;
	const etaText = etaDays === null ? "—" : `${etaDays} days`;
	costDiv.innerHTML = `
		<div class="colony-cost-preview ${affordable ? "" : "colony-cost-unaffordable"}">
			<span style="color:#8a9a8a;font-size:10px">Cost: </span>${costHtml}
			<span style="color:#6a8a6a;font-size:10px;margin-left:6px">Build: ${totalBp} BP · ETA: ${etaText}</span>
		</div>
	`;
	// Auto-fill name if empty or still matches the auto-generated pattern
	const existingCount = colony.shipbuildProjects.filter(
		(p) => state.shipDesigns.get(p.designId)?.name === design.name,
	).length;
	const autoName = generateShipName(design.name, existingCount);
	if (!nameEl.value || /^ISS .+-\d{3}$/.test(nameEl.value)) {
		nameEl.value = autoName;
	}
}

function attachEvents(entry: PlanetEntry): void {
	// Construction
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

	// Production
	const prodAdd = document.getElementById("colony-prod-add");
	prodAdd?.addEventListener("click", () => {
		const [colony, found] = getColony(entry.data.name);
		if (!found) return;
		const itemEl = document.getElementById("colony-prod-item") as HTMLSelectElement | null;
		const qtyEl = document.getElementById("colony-prod-qty") as HTMLInputElement | null;
		const allocationEl = document.getElementById(
			"colony-prod-allocation",
		) as HTMLSelectElement | null;
		if (!itemEl || !qtyEl || !allocationEl) return;
		addProductionProject(
			colony,
			itemEl.value,
			Math.max(1, Number(qtyEl.value) || 1),
			Math.max(1, Number(allocationEl.value) || 20),
		);
		renderColonyPanel(entry);
	});

	document.querySelectorAll(".colony-prod-toggle").forEach((el) => {
		el.addEventListener("click", () => {
			const [colony, found] = getColony(entry.data.name);
			if (!found) return;
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			pauseProductionProject(colony, projectId);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-prod-cancel").forEach((el) => {
		el.addEventListener("click", () => {
			const [colony, found] = getColony(entry.data.name);
			if (!found) return;
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			cancelProductionProject(colony, projectId);
			renderColonyPanel(entry);
		});
	});

	// Shipyard — update cost preview when design selection changes
	const designEl = document.getElementById("colony-ship-design") as HTMLSelectElement | null;
	const nameEl = document.getElementById("colony-ship-name") as HTMLInputElement | null;
	const costDiv = document.getElementById("colony-ship-cost");

	if (designEl && nameEl && costDiv) {
		designEl.addEventListener("change", () =>
			onShipDesignChange(entry.data.name, designEl, nameEl, costDiv),
		);
	}

	const buildBtn = document.getElementById("colony-ship-build");
	buildBtn?.addEventListener("click", () => {
		const [colony, found] = getColony(entry.data.name);
		if (!found) return;
		if (!designEl || !nameEl) return;
		const designId = designEl.value;
		const shipName = nameEl.value.trim();
		const design = state.shipDesigns.get(designId);
		if (!design || !shipName) return;
		if (!canAffordShipbuild(colony, design)) return;
		addShipbuildProject(colony, designId, shipName);
		renderColonyPanel(entry);
	});

	document.querySelectorAll(".colony-ship-toggle").forEach((el) => {
		el.addEventListener("click", () => {
			const [colony, found] = getColony(entry.data.name);
			if (!found) return;
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			pauseShipbuildProject(colony, projectId);
			renderColonyPanel(entry);
		});
	});

	document.querySelectorAll(".colony-ship-cancel").forEach((el) => {
		el.addEventListener("click", () => {
			const [colony, found] = getColony(entry.data.name);
			if (!found) return;
			const projectId = (el as HTMLElement).dataset.projectId;
			if (!projectId) return;
			cancelShipbuildProject(colony, projectId);
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
		${renderProduction(entry)}
		${renderShipyard(entry)}
	`;
	attachEvents(entry);
}
