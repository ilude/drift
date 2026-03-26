import {
	cancelResearchProject,
	canResearchTech,
	queueResearchProjectForScientist,
	RESEARCH_DEFS,
	removeFromScientistQueue,
	reorderScientistQueue,
	setResearchPaused,
	setScientistLabs,
} from "../core/colonies";
import { addNotification } from "../core/notifications";
import { state } from "../core/state";
import type { ColonyResearchProject } from "../types";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

interface ColonyResearchInfo {
	bodyName: string;
	labCount: number;
	availableLabs: number;
}

interface ScientistSnapshot {
	id: string;
	name: string;
	colonyBodyName: string;
	primaryCategory: string;
	bonusPct: number;
	adminCap: number;
	assignedLabs: number;
	colonyLabs: number;
	colonyAvailableLabs: number;
	activeProjectTechId: string | null;
	projectQueue: string[];
	isIdle: boolean;
}

interface ProjectSnapshot {
	techId: string;
	techName: string;
	category: string;
	colonyBodyName: string;
	leadScientistId: string | null;
	leadScientistName: string;
	assignedLabs: number;
	progressRp: number;
	totalRp: number;
	progressPct: number;
	annualRp: number;
	etaDay: number | null;
	status: "active" | "paused" | "queued";
}

interface TechSnapshot {
	id: string;
	name: string;
	category: string;
	rpCost: number;
	effectText: string;
	description: string;
	prerequisites: string[];
	prereqNames: string[];
	state: "locked" | "available" | "in-progress" | "completed";
}

interface ResearchSnapshot {
	scientists: ScientistSnapshot[];
	projects: ProjectSnapshot[];
	techs: TechSnapshot[];
	colonies: ColonyResearchInfo[];
	simTimeDays: number;
}

// ---------------------------------------------------------------------------
// Popout state
// ---------------------------------------------------------------------------

let popoutWindow: Window | null = null;

// ---------------------------------------------------------------------------
// Snapshot builders
// ---------------------------------------------------------------------------

function getScientistName(id: string | null): string {
	if (!id) return "—";
	return state.scientists.get(id)?.name ?? "—";
}

function getColonyLabs(bodyName: string): number {
	return state.colonies.get(bodyName)?.installations.lab ?? 0;
}

function computeUsedLabsByColony(): Map<string, number> {
	const map = new Map<string, number>();
	for (const scientist of state.scientists.values()) {
		const prev = map.get(scientist.colonyBodyName) ?? 0;
		map.set(scientist.colonyBodyName, prev + scientist.assignedLabs);
	}
	return map;
}

function computeRpPerDay(project: ColonyResearchProject): number {
	if (project.paused || !project.leadScientistId) return 0;
	const def = RESEARCH_DEFS.find((d) => d.id === project.techId);
	if (!def) return 0;
	const scientist = state.scientists.get(project.leadScientistId);
	if (!scientist) return 0;
	const colony = state.colonies.get(project.colonyBodyName);
	if (!colony) return 0;
	const labs = Math.min(scientist.assignedLabs, scientist.adminCap, colony.installations.lab);
	if (labs <= 0) return 0;
	const bonus = scientist.categoryBonuses[scientist.primaryCategory] ?? 0;
	const inSpec = scientist.primaryCategory === def.category;
	const multiplier = inSpec ? 1 + bonus * 4 : 1 + bonus;
	return 5 * labs * multiplier;
}

function estimateEtaDay(project: ColonyResearchProject): number | null {
	const rpPerDay = computeRpPerDay(project);
	if (rpPerDay <= 0) return null;
	const def = RESEARCH_DEFS.find((d) => d.id === project.techId);
	if (!def) return null;
	return state.simTime.days + (def.rpCost - project.progressRp) / rpPerDay;
}

function buildScientistSnapshots(usedLabsByColony: Map<string, number>): ScientistSnapshot[] {
	return Array.from(state.scientists.values()).map((scientist) => {
		const totalLabs = getColonyLabs(scientist.colonyBodyName);
		const usedLabs = usedLabsByColony.get(scientist.colonyBodyName) ?? 0;
		const bonus = scientist.categoryBonuses[scientist.primaryCategory] ?? 0;
		return {
			id: scientist.id,
			name: scientist.name,
			colonyBodyName: scientist.colonyBodyName,
			primaryCategory: scientist.primaryCategory,
			bonusPct: Math.round(bonus * 100),
			adminCap: scientist.adminCap,
			assignedLabs: scientist.assignedLabs,
			colonyLabs: totalLabs,
			colonyAvailableLabs: Math.max(0, totalLabs - usedLabs),
			activeProjectTechId: scientist.activeProjectTechId,
			projectQueue: [...scientist.projectQueue],
			isIdle: scientist.activeProjectTechId === null && scientist.projectQueue.length === 0,
		};
	});
}

function projectSnapshotFromActive(project: ColonyResearchProject): ProjectSnapshot {
	const def = RESEARCH_DEFS.find((d) => d.id === project.techId);
	const totalRp = def?.rpCost ?? 0;
	const progressPct =
		totalRp > 0 ? Math.min(100, Math.round((project.progressRp / totalRp) * 100)) : 0;
	const rpPerDay = computeRpPerDay(project);
	return {
		techId: project.techId,
		techName: def?.name ?? project.techId,
		category: def?.category ?? "research",
		colonyBodyName: project.colonyBodyName,
		leadScientistId: project.leadScientistId,
		leadScientistName: getScientistName(project.leadScientistId),
		assignedLabs: project.assignedLabs,
		progressRp: project.progressRp,
		totalRp,
		progressPct,
		annualRp: Math.round(rpPerDay * 365),
		etaDay: estimateEtaDay(project),
		status: project.paused ? "paused" : project.leadScientistId ? "active" : "queued",
	};
}

function buildProjectSnapshots(): ProjectSnapshot[] {
	const snaps: ProjectSnapshot[] = [];
	const includedTechIds = new Set<string>();

	for (const project of state.researchProjects.values()) {
		snaps.push(projectSnapshotFromActive(project));
		includedTechIds.add(project.techId);
	}

	// Include techs queued on scientists but not yet activated into researchProjects
	for (const scientist of state.scientists.values()) {
		for (const techId of scientist.projectQueue) {
			if (includedTechIds.has(techId)) continue;
			const def = RESEARCH_DEFS.find((d) => d.id === techId);
			if (!def) continue;
			snaps.push({
				techId,
				techName: def.name,
				category: def.category,
				colonyBodyName: scientist.colonyBodyName,
				leadScientistId: scientist.id,
				leadScientistName: scientist.name,
				assignedLabs: scientist.assignedLabs,
				progressRp: 0,
				totalRp: def.rpCost,
				progressPct: 0,
				annualRp: 0,
				etaDay: null,
				status: "queued",
			});
			includedTechIds.add(techId);
		}
	}

	return snaps;
}

function buildTechSnapshots(): TechSnapshot[] {
	return RESEARCH_DEFS.map((def) => {
		const completed = state.researchedTechs.has(def.id);
		const queued = [...state.scientists.values()].some((s) => s.projectQueue.includes(def.id));
		const inProgress = state.researchProjects.has(def.id) || queued;
		const available = !completed && canResearchTech(def.id);
		const techState = completed
			? "completed"
			: inProgress
				? "in-progress"
				: available
					? "available"
					: "locked";
		const prereqNames = def.prerequisites.map(
			(pid) => RESEARCH_DEFS.find((d) => d.id === pid)?.name ?? pid,
		);
		return {
			id: def.id,
			name: def.name,
			category: def.category,
			rpCost: def.rpCost,
			effectText: def.effectText,
			description: def.description,
			prerequisites: def.prerequisites,
			prereqNames,
			state: techState,
		};
	});
}

function buildColonyInfo(usedLabsByColony: Map<string, number>): ColonyResearchInfo[] {
	const result: ColonyResearchInfo[] = [];
	for (const colony of state.colonies.values()) {
		if (colony.installations.lab <= 0) continue;
		const used = usedLabsByColony.get(colony.bodyName) ?? 0;
		result.push({
			bodyName: colony.bodyName,
			labCount: colony.installations.lab,
			availableLabs: Math.max(0, colony.installations.lab - used),
		});
	}
	return result;
}

function buildSnapshot(): ResearchSnapshot {
	const usedLabsByColony = computeUsedLabsByColony();
	return {
		scientists: buildScientistSnapshots(usedLabsByColony),
		projects: buildProjectSnapshots(),
		techs: buildTechSnapshots(),
		colonies: buildColonyInfo(usedLabsByColony),
		simTimeDays: state.simTime.days,
	};
}

// ---------------------------------------------------------------------------
// Popout management
// ---------------------------------------------------------------------------

let _tickInterval: ReturnType<typeof setInterval> | null = null;

export function isResearchViewerOpen(): boolean {
	return popoutWindow !== null && !popoutWindow.closed;
}

export function openResearchViewer(): boolean {
	if (isResearchViewerOpen()) {
		popoutWindow?.focus();
		pushResearchUpdate();
		return true;
	}

	const html = generatePopoutHTML();
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	const pw = 1300,
		ph = 740;
	const pl = window.screenX + Math.round((window.outerWidth - pw) / 2);
	const pt = window.screenY + Math.round((window.outerHeight - ph) / 2);
	popoutWindow = window.open(
		url,
		"drift-research",
		`width=${pw},height=${ph},left=${pl},top=${pt},menubar=no,toolbar=no,location=no`,
	);
	URL.revokeObjectURL(url);

	if (!popoutWindow) {
		addNotification("info", "Research viewer blocked. Allow popups for this site, then try again.");
		return false;
	}

	window.addEventListener("message", handlePopoutMessage);
	window.addEventListener("beforeunload", cleanupPopout);
	window.addEventListener("research-state-changed", onResearchStateChanged);
	_tickInterval = setInterval(() => pushResearchUpdate(), 1000);
	setTimeout(() => pushResearchUpdate(), 300);
	return true;
}

export function closeResearchViewer(): void {
	if (popoutWindow && !popoutWindow.closed) popoutWindow.close();
	cleanupPopout();
}

function cleanupPopout(): void {
	popoutWindow = null;
	if (_tickInterval !== null) {
		clearInterval(_tickInterval);
		_tickInterval = null;
	}
	window.removeEventListener("message", handlePopoutMessage);
	window.removeEventListener("beforeunload", cleanupPopout);
	window.removeEventListener("research-state-changed", onResearchStateChanged);
}

export function pushResearchUpdate(): void {
	if (!isResearchViewerOpen()) return;
	popoutWindow?.postMessage({ type: "research-update", data: buildSnapshot() }, "*");
}

function onResearchStateChanged(): void {
	pushResearchUpdate();
}

function handlePopoutMessage(event: MessageEvent): void {
	if (!event.data || typeof event.data.type !== "string") return;
	if (event.data.type === "ready") {
		pushResearchUpdate();
		return;
	}
	if (event.data.type !== "research-action") return;

	const { action } = event.data as { action: string; [key: string]: unknown };
	switch (action) {
		case "assign-project":
			queueResearchProjectForScientist(event.data.scientistId as string, event.data.techId as string);
			if (typeof event.data.labs === "number") {
				setScientistLabs(event.data.scientistId as string, event.data.labs as number);
			}
			break;
		case "cancel-project":
			cancelResearchProject(event.data.techId as string);
			break;
		case "set-labs":
			setScientistLabs(event.data.scientistId as string, event.data.labs as number);
			break;
		case "set-paused":
			setResearchPaused(event.data.techId as string, event.data.paused as boolean);
			break;
		case "reorder-queue":
			reorderScientistQueue(
				event.data.scientistId as string,
				event.data.fromIdx as number,
				event.data.toIdx as number,
			);
			break;
		case "remove-from-queue":
			removeFromScientistQueue(event.data.scientistId as string, event.data.techId as string);
			break;
	}
	pushResearchUpdate();
}

// ---------------------------------------------------------------------------
// Popout HTML
// ---------------------------------------------------------------------------

function generatePopoutHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Drift — Research</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0d0d14; color: #88cc88;
  font-family: ui-monospace, monospace; font-size: 11px;
  display: flex; height: 100vh; overflow: hidden;
}

/* ---- Colony sidebar (area 1) ---- */
#colony-sidebar {
  width: 160px; flex-shrink: 0;
  display: flex; flex-direction: column;
  border-right: 2px solid #3a3a3a;
  background: #0a0a12;
  transition: width 0.15s ease;
}
#colony-sidebar.collapsed { width: 28px; }
.sidebar-header {
  padding: 6px 8px; font-size: 10px; color: #556655;
  text-transform: uppercase; letter-spacing: 0.05em;
  background: #0f0f1c; border-bottom: 1px solid #1e1e1e;
  flex-shrink: 0; cursor: pointer; display: flex;
  align-items: center; gap: 4px; user-select: none;
  white-space: nowrap; overflow: hidden;
}
.sidebar-header:hover { color: #88cc88; }
.sidebar-toggle { color: #446644; font-size: 10px; flex-shrink: 0; }
.sidebar-title { overflow: hidden; }
#colony-sidebar.collapsed .sidebar-title { display: none; }
#colony-list { overflow-y: auto; flex: 1; padding: 4px 0; }
#colony-sidebar.collapsed #colony-list { display: none; }
.colony-item {
  padding: 5px 10px; cursor: pointer; font-size: 11px;
  border-left: 2px solid transparent;
}
.colony-item:hover { background: #111120; }
.colony-item.selected { background: #111a11; border-left-color: #55aa55; color: #aaffaa; }
.colony-name { font-weight: 500; }
.colony-labs { font-size: 10px; color: #556655; margin-top: 1px; }
.colony-labs .avail { color: #88aa88; }
.system-label {
  padding: 6px 8px 3px; font-size: 10px; color: #3a3a3a;
  text-transform: uppercase; letter-spacing: 0.05em;
}

/* ---- Right content ---- */
#right-content {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
}

/* ---- Colony tabs ---- */
#colony-tabs {
  display: flex; border-bottom: 2px solid #3a3a3a;
  background: #0a0a12; flex-shrink: 0; overflow-x: auto;
}
.colony-tab {
  padding: 7px 16px; font-size: 10px; cursor: pointer;
  border-right: 1px solid #1e1e1e; color: #556655;
  text-transform: uppercase; letter-spacing: 0.06em;
  white-space: nowrap; border-bottom: 2px solid transparent;
  margin-bottom: -2px; user-select: none;
}
.colony-tab:hover { color: #88cc88; background: #111120; }
.colony-tab.active { color: #aaddaa; border-bottom-color: #55aa55; background: #0d1a0d; }

/* ---- Area 2: Projects ---- */
#projects-section {
  flex-shrink: 0; height: 220px; display: flex; flex-direction: column;
}
.section-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 4px 10px; background: #111120;
  border-bottom: 1px solid #282828; flex-shrink: 0;
  font-size: 10px; color: #556655;
}
.section-bar .title { color: #aaddaa; font-weight: 600; font-size: 11px; }
.projects-scroll { overflow-y: auto; flex: 1; }
.proj-table { width: 100%; border-collapse: collapse; }
.proj-table th {
  text-align: left; padding: 4px 8px; font-size: 10px; color: #556655;
  text-transform: uppercase; letter-spacing: 0.04em;
  background: #0f0f1c; border-bottom: 1px solid #1e1e1e;
  position: sticky; top: 0; white-space: nowrap;
}
.proj-table th.sortable { cursor: pointer; user-select: none; }
.proj-table th.sortable:hover { color: #88cc88; }
.proj-table th.sort-asc .sort-ind::after { content: " ▲"; color: #55aa55; font-size: 9px; }
.proj-table th.sort-desc .sort-ind::after { content: " ▼"; color: #55aa55; font-size: 9px; }
.sort-ind { display: inline; }
.proj-table td { padding: 4px 8px; border-bottom: 1px solid #0f0f1c; font-size: 10px; }
.proj-table tr:hover td { background: #111120; }
.col-tech { font-weight: 500; color: #aaffaa; }
.col-field { color: #778877; }
.col-sci { color: #88aacc; }
.col-num { color: #aaaacc; text-align: right; }
.col-eta { color: #778877; white-space: nowrap; }
.col-actions { white-space: nowrap; }
.status-paused td { opacity: 0.65; }
.status-queued td { opacity: 0.5; }
.status-tag { font-size: 9px; padding: 1px 4px; border-radius: 2px; margin-left: 4px; }
.tag-active { background: #1a3a1a; color: #55aa55; }
.tag-paused { background: #2a2a1a; color: #aaaa55; }
.tag-queued { background: #1a1a2e; color: #7788aa; }
.btn-sm {
  background: #1a1a2e; border: 1px solid #3a3a3a; color: #88cc88;
  padding: 2px 7px; border-radius: 2px; cursor: pointer; font-size: 9px;
  font-family: inherit; margin-left: 3px;
}
.btn-sm:hover { border-color: #55aa55; }
.btn-paused { background: #2a2a10; border-color: #aaaa44; color: #dddd66; }
.btn-paused:hover { border-color: #dddd44; color: #ffff88; }
.btn-del { border-color: #553333; color: #cc7777; }
.btn-del:hover { border-color: #cc4444; color: #ffaaaa; background: #2a1a1a; }
.empty-cell { color: #3a3a3a; font-style: italic; text-align: center; padding: 14px 8px; }

/* ---- Area 3: Browser ---- */
#browser-section { display: flex; flex: 1; overflow: hidden; }

/* Tech browser */
#tech-browser {
  width: 42%; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 1px solid #282828;
}
.browser-toolbar {
  display: flex; align-items: center; gap: 8px; padding: 5px 8px;
  background: #111120; border-bottom: 1px solid #1e1e1e; flex-shrink: 0;
}
.cat-select {
  background: #1a1a2e; border: 1px solid #3a3a3a; color: #88cc88;
  padding: 3px 6px; border-radius: 3px; font-size: 10px; font-family: inherit;
  flex: 1; cursor: pointer;
}
input[type=checkbox] { accent-color: #88cc88; color-scheme: dark; }
.match-label { font-size: 10px; color: #88aa88; cursor: pointer; white-space: nowrap; }
.match-label input { margin-right: 3px; }
.tech-scroll { overflow-y: auto; flex: 1; }
.tech-table { width: 100%; border-collapse: collapse; }
.tech-table th {
  text-align: left; padding: 4px 8px; font-size: 10px; color: #556655;
  text-transform: uppercase; letter-spacing: 0.04em;
  background: #0f0f1c; border-bottom: 1px solid #1e1e1e; position: sticky; top: 0;
}
.tech-table td { padding: 5px 8px; border-bottom: 1px solid #0f0f1c; cursor: pointer; }
.tech-table tr:hover td { background: #141424; }
.tech-table tr.selected td { background: #1a2a1a; }
.tech-table tr.selected td:first-child { border-left: 2px solid #55aa55; }
.tech-table tr.state-locked { opacity: 0.35; cursor: default; }
.tech-table tr.state-completed { opacity: 0.4; cursor: default; }
.tech-name-col { font-weight: 500; }
.state-available .tech-name-col { color: #aaffaa; }
.state-in-progress .tech-name-col { color: #ffdd88; }
.state-locked .tech-name-col { color: #667766; }
.state-completed .tech-name-col { color: #7799bb; }
.tech-cost-col { color: #88aaff; text-align: right; white-space: nowrap; }
.tech-detail {
  padding: 6px 8px; background: #0c0c18; border-top: 1px solid #1e1e1e;
  font-size: 10px; color: #778877; flex-shrink: 0; min-height: 46px;
}
.det-name { color: #aaffaa; font-weight: 600; margin-bottom: 3px; font-size: 11px; }
.det-effect { color: #aaddff; margin-bottom: 2px; }
.prereq-met { color: #55aa55; }
.prereq-unmet { color: #aa6633; }
/* Scientist browser */
#scientist-browser { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.sci-avail-bar {
  display: flex; align-items: center; gap: 8px; padding: 5px 10px;
  background: #111120; border-bottom: 1px solid #1e1e1e;
  flex-shrink: 0; font-size: 10px;
}
.sci-avail-bar .fac-label { color: #aaddaa; }
.avail-count { color: #aaffaa; font-weight: 600; font-size: 12px; }
.sci-scroll { overflow-y: auto; flex: 1; }
.sci-table { width: 100%; border-collapse: collapse; }
.sci-table th {
  text-align: left; padding: 4px 8px; font-size: 10px; color: #556655;
  text-transform: uppercase; letter-spacing: 0.04em;
  background: #0f0f1c; border-bottom: 1px solid #1e1e1e; position: sticky; top: 0;
}
.sci-table td { padding: 5px 8px; border-bottom: 1px solid #0f0f1c; cursor: pointer; font-size: 10px; }
.sci-table tr:hover td { background: #111120; }
.sci-table tr.selected td { background: #1a2a1a; }
.sci-table tr.selected td:first-child { border-left: 2px solid #55aa55; }
/* Busy = has active project */
.sci-table tr.sci-busy td { color: #ddaa44; }
.sci-table tr.sci-busy td:first-child::before { content: "● "; font-size: 8px; }
/* Idle = no active project, no queue */
.sci-table tr.sci-idle td { color: #cc8844; }
.sci-table tr.sci-idle td:first-child::before { content: "⚠ "; }
.sci-match { font-weight: 600 !important; }

/* ---- Confirm row (single bar below browser section) ---- */
#confirm-row {
  display: flex; align-items: stretch; flex-shrink: 0;
  background: #0a0a12; border-top: 2px solid #3a3a3a; min-height: 46px;
}
.cf-slot {
  display: flex; flex-direction: column; justify-content: center;
  padding: 4px 10px; min-width: 0;
}
.cf-tech-slot { flex: 0 0 42%; border-right: 1px solid #282828; overflow: hidden; }
.cf-sci-slot { flex: 1; }
.cf-labs-slot { flex-shrink: 0; border-left: 1px solid #282828; }
.cf-label {
  font-size: 9px; color: #446644; text-transform: uppercase;
  letter-spacing: 0.07em; margin-bottom: 3px;
}
.cf-value {
  font-size: 12px; font-weight: 500; color: #aaffaa;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;
}
.cf-value.placeholder { color: #2a2a2a; font-style: italic; font-weight: 400; }
.labs-input {
  width: 52px; background: #111a11; border: 1px solid #3a5a3a; color: #aaffaa;
  padding: 3px 6px; border-radius: 3px; font-size: 13px; font-family: inherit;
  text-align: center;
}
.labs-input:focus { outline: none; border-color: #55aa55; }
.create-btn {
  align-self: stretch;
  background: #152515; border: none; border-left: 2px solid #3a6a3a;
  color: #88cc88; padding: 0 28px; cursor: pointer;
  font-size: 12px; font-family: inherit; letter-spacing: 0.03em;
  transition: background 0.1s, color 0.1s;
}
.create-btn:hover { background: #1e3a1e; color: #aaffaa; border-left-color: #55aa55; }
.create-btn:disabled { opacity: 0.3; cursor: default; }

/* ---- Resize handles ---- */
.resize-handle {
  flex-shrink: 0; background: #1a1a2a; transition: background 0.1s; z-index: 1;
}
.resize-handle.rh { width: 4px; cursor: col-resize; }
.resize-handle.rv { height: 4px; width: 100%; cursor: row-resize; }
.resize-handle:hover, .resize-handle.dragging { background: #446644; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0d0d14; }
::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
</style>
</head>
<body>

<!-- Area 1: Colony sidebar -->
<div id="colony-sidebar">
  <div class="sidebar-header" id="sidebar-header">
    <span class="sidebar-toggle" id="sidebar-toggle">[-]</span>
    <span class="sidebar-title">Colonies</span>
  </div>
  <div id="colony-list"></div>
</div>

<div class="resize-handle rh" id="sidebar-handle"></div>

<!-- Right content -->
<div id="right-content">

  <!-- Colony tabs -->
  <div id="colony-tabs"></div>

  <!-- Area 2: Active projects -->
  <div id="projects-section">
    <div class="section-bar">
      <span class="title">Research Projects</span>
    </div>
    <div class="projects-scroll">
      <table class="proj-table">
        <thead><tr>
          <th class="sortable" data-key="field">Field<span class="sort-ind"></span></th>
          <th class="sortable" data-key="tech">Research Project<span class="sort-ind"></span></th>
          <th class="sortable" data-key="colony">Colony<span class="sort-ind"></span></th>
          <th class="sortable" data-key="leader">Project Leader<span class="sort-ind"></span></th>
          <th class="sortable" data-key="bonus" style="text-align:right">Bonus%<span class="sort-ind"></span></th>
          <th class="sortable" data-key="labs" style="text-align:right">Labs<span class="sort-ind"></span></th>
          <th class="sortable" data-key="annrp" style="text-align:right">Ann. RP<span class="sort-ind"></span></th>
          <th class="sortable" data-key="remaining" style="text-align:right">RP Remaining<span class="sort-ind"></span></th>
          <th class="sortable" data-key="days" style="text-align:right">Days Remaining<span class="sort-ind"></span></th>
          <th class="sortable" data-key="eta">Completion Date<span class="sort-ind"></span></th>
          <th></th>
        </tr></thead>
        <tbody id="proj-tbody"></tbody>
      </table>
    </div>
  </div>

  <div class="resize-handle rv" id="proj-browser-handle"></div>

  <!-- Area 3: Browser section -->
  <div id="browser-section">

    <!-- Left: Tech list -->
    <div id="tech-browser">
      <div class="browser-toolbar">
        <select class="cat-select" id="cat-select">
          <option value="all">All Fields</option>
          <option value="survey">Survey</option>
          <option value="industry">Industry</option>
          <option value="logistics">Logistics</option>
          <option value="research">Research</option>
          <option value="biology">Biology / Genetics</option>
        </select>
        <label class="match-label">
          <input type="checkbox" id="show-completed"> Completed
        </label>
      </div>
      <div class="tech-scroll">
        <table class="tech-table">
          <thead><tr>
            <th>Technology</th>
            <th style="text-align:right">Research Cost</th>
          </tr></thead>
          <tbody id="tech-tbody"></tbody>
        </table>
      </div>
      <div id="tech-detail" class="tech-detail">
        <div style="color:#3a3a3a;font-style:italic;">Select a technology to see details.</div>
      </div>
    </div>

    <!-- Right: Scientist list -->
    <div id="scientist-browser">
      <div class="sci-avail-bar">
        <span class="fac-label">Research Facilities Available</span>
        <span class="avail-count" id="avail-count">—</span>
        <label class="match-label" style="margin-left:auto">
          <input type="checkbox" id="matching-only"> Matching Scientists Only
        </label>
      </div>
      <div class="sci-scroll">
        <table class="sci-table">
          <thead><tr>
            <th>Scientist</th><th>Colony</th><th>Specialization</th>
            <th style="text-align:right">Bonus</th><th style="text-align:right">Max Labs</th>
          </tr></thead>
          <tbody id="sci-tbody"></tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Confirm row: single bar spanning full width -->
  <div id="confirm-row">
    <div class="cf-slot cf-tech-slot">
      <div class="cf-label">Selected Technology</div>
      <div id="confirm-tech" class="cf-value placeholder">—</div>
    </div>
    <div class="cf-slot cf-sci-slot">
      <div class="cf-label">Project Leader</div>
      <div id="confirm-sci" class="cf-value placeholder">—</div>
    </div>
    <div class="cf-slot cf-labs-slot">
      <div class="cf-label">Assign Labs</div>
      <input class="labs-input" type="number" id="assign-input" min="0" value="0">
    </div>
    <button class="create-btn" id="btn-create" disabled>Create Project</button>
  </div>

</div><!-- end right-content -->

<script>
let snap = { scientists: [], projects: [], techs: [], colonies: [], simTimeDays: 0 };
let selectedTechId = null;
let selectedSciId = null;
let selectedColony = null;
let sortKey = 'eta';
let sortDir = 1;
let showCompleted = false;
let activeCat = 'all';
let matchingOnly = false;

const SIM_EPOCH_MS = new Date(2038, 0, 20).getTime();
function formatDay(day) {
  if (day == null) return '—';
  const date = new Date(SIM_EPOCH_MS + Math.floor(day) * 86400000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return \`\${months[date.getMonth()]} \${date.getDate()}, \${date.getFullYear()}\`;
}

function setColony(bodyName) {
  selectedColony = bodyName;
  renderTabs();
  renderColonies();
  renderProjects();
  renderScientists();
  updateAvailCount();
}

function renderTabs() {
  const el = document.getElementById('colony-tabs');
  let html = \`<div class="colony-tab\${!selectedColony ? ' active' : ''}" data-colony="">All</div>\`;
  for (const c of snap.colonies) {
    const active = c.bodyName === selectedColony ? ' active' : '';
    html += \`<div class="colony-tab\${active}" data-colony="\${c.bodyName}">\${c.bodyName}</div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.colony-tab').forEach(tab => {
    tab.addEventListener('click', () => setColony(tab.dataset.colony || null));
  });
}

function renderColonies() {
  const list = document.getElementById('colony-list');
  if (snap.colonies.length === 0) {
    list.innerHTML = '<div style="padding:8px;color:#3a3a3a;font-style:italic;font-size:10px;">No research labs built.</div>';
    return;
  }
  let html = '<div class="system-label">Sol System</div>';
  for (const c of snap.colonies) {
    const sel = c.bodyName === selectedColony ? ' selected' : '';
    html += \`<div class="colony-item\${sel}" data-colony="\${c.bodyName}">
      <div class="colony-name">\${c.bodyName}</div>
    </div>\`;
  }
  list.innerHTML = html;
  list.querySelectorAll('.colony-item').forEach(el => {
    el.addEventListener('click', () => setColony(selectedColony === el.dataset.colony ? null : el.dataset.colony));
  });
}

function getSortVal(p, key) {
  const sci = snap.scientists.find(s => s.id === p.leadScientistId);
  switch (key) {
    case 'field': return p.category;
    case 'tech': return p.techName;
    case 'colony': return p.colonyBodyName;
    case 'leader': return p.leadScientistName;
    case 'bonus': return sci ? sci.bonusPct : 0;
    case 'labs': return p.assignedLabs;
    case 'annrp': return p.annualRp;
    case 'remaining': return p.totalRp - p.progressRp;
    case 'days': return p.etaDay == null ? Infinity : p.etaDay - snap.simTimeDays;
    case 'eta': return p.etaDay ?? Infinity;
    default: return 0;
  }
}

function renderProjects() {
  const tbody = document.getElementById('proj-tbody');
  const filtered = snap.projects.filter(p => !selectedColony || p.colonyBodyName === selectedColony);
  const sorted = [...filtered].sort((a, b) => {
    const av = getSortVal(a, sortKey), bv = getSortVal(b, sortKey);
    if (typeof av === 'string') return sortDir * av.localeCompare(bv);
    return sortDir * (av - bv);
  });
  // Update sort indicators on headers
  document.querySelectorAll('.proj-table th[data-key]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.key === sortKey) th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
  });
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-cell">No active research projects. Select a technology and scientist below, then click Create Project.</td></tr>';
    return;
  }
  let html = '';
  for (const p of sorted) {
    const sci = snap.scientists.find(s => s.id === p.leadScientistId);
    const bonusPct = sci ? sci.bonusPct : 0;
    const rpRemaining = Math.round(p.totalRp - p.progressRp);
    const daysRemaining = p.etaDay == null ? '—' : Math.max(0, Math.round(p.etaDay - snap.simTimeDays)).toLocaleString();
    const tag = \`<span class="status-tag tag-\${p.status}">\${p.status}</span>\`;
    const isPaused = p.status === 'paused';
    const pauseCls = isPaused ? ' btn-paused' : '';
    const pauseLabel = isPaused ? 'Resume' : 'Pause';
    html += \`<tr class="status-\${p.status}">
      <td class="col-field">\${p.category}</td>
      <td class="col-tech">\${p.techName}\${tag}</td>
      <td>\${p.colonyBodyName}</td>
      <td class="col-sci">\${p.leadScientistName}</td>
      <td class="col-num">\${bonusPct}%</td>
      <td class="col-num">\${p.assignedLabs}</td>
      <td class="col-num">\${p.annualRp.toLocaleString()}</td>
      <td class="col-num">\${rpRemaining.toLocaleString()}</td>
      <td class="col-num">\${daysRemaining}</td>
      <td class="col-eta">\${formatDay(p.etaDay)}</td>
      <td class="col-actions">
        <button class="btn-sm btn-pause\${pauseCls}" data-tid="\${p.techId}" data-paused="\${isPaused ? '1' : '0'}">\${pauseLabel}</button>
        <button class="btn-sm btn-del btn-cancel" data-tid="\${p.techId}">×</button>
      </td>
    </tr>\`;
  }
  tbody.innerHTML = html;
  tbody.querySelectorAll('.btn-pause').forEach(btn => {
    btn.addEventListener('click', () => {
      window.opener?.postMessage({ type: 'research-action', action: 'set-paused', techId: btn.dataset.tid, paused: btn.dataset.paused !== '1' }, '*');
    });
  });
  tbody.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      window.opener?.postMessage({ type: 'research-action', action: 'cancel-project', techId: btn.dataset.tid }, '*');
    });
  });
}

function getTechVisible(t) {
  const stateOk = t.state === 'available' || (showCompleted && t.state === 'completed');
  const catOk = activeCat === 'all' || t.category === activeCat;
  const matchOk = !matchingOnly || !selectedSciId || (() => {
    const sci = snap.scientists.find(s => s.id === selectedSciId);
    return sci ? sci.primaryCategory === t.category : true;
  })();
  return stateOk && catOk && matchOk;
}

function renderTechs() {
  const tbody = document.getElementById('tech-tbody');
  const visible = snap.techs.filter(getTechVisible);
  if (visible.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" class="empty-cell">No technologies match the current filter.</td></tr>';
    return;
  }
  let html = '';
  for (const t of visible) {
    const sel = t.id === selectedTechId ? ' selected' : '';
    const cost = t.state === 'completed' ? 'Completed' : t.rpCost.toLocaleString() + ' RP';
    html += \`<tr class="state-\${t.state}\${sel}" data-tid="\${t.id}">
      <td class="tech-name-col">\${t.name}</td>
      <td class="tech-cost-col">\${cost}</td>
    </tr>\`;
  }
  tbody.innerHTML = html;
  tbody.querySelectorAll('tr:not(.state-locked):not(.state-completed)').forEach(row => {
    row.addEventListener('click', () => selectTech(row.dataset.tid));
  });
}

function renderTechDetail() {
  const panel = document.getElementById('tech-detail');
  if (!selectedTechId) {
    panel.innerHTML = '<div style="color:#3a3a3a;font-style:italic;">Select a technology to see details.</div>';
    return;
  }
  const t = snap.techs.find(x => x.id === selectedTechId);
  if (!t) { panel.innerHTML = ''; return; }
  let prereqHtml = '';
  if (t.prerequisites.length > 0) {
    const parts = t.prereqNames.map((n, i) => {
      const met = snap.techs.find(x => x.id === t.prerequisites[i])?.state === 'completed';
      return \`<span class="\${met ? 'prereq-met' : 'prereq-unmet'}">\${met ? '✓' : '✗'} \${n}</span>\`;
    });
    prereqHtml = \`<div style="margin-top:2px;">Requires: \${parts.join(', ')}</div>\`;
  }
  panel.innerHTML = \`<div class="det-name">\${t.name}</div><div class="det-effect">\${t.effectText}</div>\${prereqHtml}\`;
}

function renderScientists() {
  const tbody = document.getElementById('sci-tbody');
  const visible = snap.scientists.filter(s => {
    const colonyOk = !selectedColony || s.colonyBodyName === selectedColony;
    let matchOk = true;
    if (matchingOnly) {
      if (selectedTechId) {
        const tech = snap.techs.find(t => t.id === selectedTechId);
        matchOk = tech ? s.primaryCategory === tech.category : true;
      } else if (activeCat !== 'all') {
        matchOk = s.primaryCategory === activeCat;
      }
    }
    return colonyOk && matchOk;
  });
  if (visible.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-cell">No scientists available.</td></tr>';
    return;
  }
  let html = '';
  for (const s of visible) {
    const isBusy = s.activeProjectTechId !== null;
    const stateClass = s.isIdle ? ' sci-idle' : isBusy ? ' sci-busy' : '';
    const sel = s.id === selectedSciId ? ' selected' : '';
    const tech = selectedTechId ? snap.techs.find(t => t.id === selectedTechId) : null;
    const isMatch = tech && s.primaryCategory === tech.category;
    const nameClass = isMatch ? ' sci-match' : '';
    const activeNote = s.activeProjectTechId
      ? snap.techs.find(t => t.id === s.activeProjectTechId)?.name ?? s.activeProjectTechId
      : '';
    const activePart = activeNote ? \` <span style="color:#888855;font-size:9px;">[\${activeNote}]</span>\` : '';
    html += \`<tr class="\${(stateClass + sel).trim()}" data-sid="\${s.id}">
      <td class="\${nameClass.trim()}">\${s.name}\${activePart}</td>
      <td>\${s.colonyBodyName}</td>
      <td>\${s.primaryCategory}</td>
      <td style="text-align:right">\${s.bonusPct}%</td>
      <td style="text-align:right">\${s.adminCap}</td>
    </tr>\`;
  }
  tbody.innerHTML = html;
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', () => selectScientist(row.dataset.sid));
  });
}

function updateAvailCount() {
  const countEl = document.getElementById('avail-count');
  if (selectedColony) {
    const c = snap.colonies.find(x => x.bodyName === selectedColony);
    countEl.textContent = c ? String(c.availableLabs) : '—';
  } else if (selectedSciId) {
    const sci = snap.scientists.find(s => s.id === selectedSciId);
    countEl.textContent = sci ? String(sci.colonyAvailableLabs) : '—';
  } else {
    const total = snap.colonies.reduce((sum, c) => sum + c.availableLabs, 0);
    countEl.textContent = snap.colonies.length ? String(total) : '—';
  }
}

function updateConfirmStrip() {
  const techEl = document.getElementById('confirm-tech');
  const sciEl = document.getElementById('confirm-sci');
  const input = document.getElementById('assign-input');
  const btn = document.getElementById('btn-create');
  const tech = selectedTechId ? snap.techs.find(t => t.id === selectedTechId) : null;
  const sci = selectedSciId ? snap.scientists.find(s => s.id === selectedSciId) : null;
  if (tech) { techEl.textContent = tech.name; techEl.classList.remove('placeholder'); }
  else { techEl.textContent = '—'; techEl.classList.add('placeholder'); }
  if (sci) { sciEl.textContent = sci.name; sciEl.classList.remove('placeholder'); }
  else { sciEl.textContent = '—'; sciEl.classList.add('placeholder'); }
  if (sci) {
    const suggested = sci.assignedLabs > 0 ? sci.assignedLabs : Math.min(1, sci.colonyAvailableLabs);
    input.value = String(Math.min(suggested, sci.adminCap));
    input.max = String(Math.min(sci.adminCap, sci.colonyLabs));
  } else {
    input.value = '0';
  }
  btn.disabled = !(tech && sci);
}

function render() {
  renderTabs();
  renderColonies();
  renderProjects();
  renderTechs();
  renderTechDetail();
  renderScientists();
  updateAvailCount();
  updateConfirmStrip();
}

function selectTech(id) {
  selectedTechId = id;
  renderTechs();
  renderTechDetail();
  renderScientists();
  updateConfirmStrip();
}

function selectScientist(id) {
  selectedSciId = id;
  renderScientists();
  updateAvailCount();
  updateConfirmStrip();
}

// Resize handles
function initResize(handleId, getEl, minPx, axis) {
  const handle = document.getElementById(handleId);
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('dragging');
    const startPos = axis === 'y' ? e.clientY : e.clientX;
    const startSize = axis === 'y' ? getEl().offsetHeight : getEl().offsetWidth;
    function onMove(e) {
      const delta = (axis === 'y' ? e.clientY : e.clientX) - startPos;
      const size = Math.max(minPx, startSize + delta);
      if (axis === 'y') getEl().style.height = size + 'px';
      else getEl().style.width = size + 'px';
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// Sidebar resize — also manages collapsed state
(function() {
  const handle = document.getElementById('sidebar-handle');
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    handle.classList.add('dragging');
    const sidebar = document.getElementById('colony-sidebar');
    const startX = e.clientX;
    const startW = sidebar.offsetWidth;
    function onMove(e) {
      const w = Math.max(120, startW + (e.clientX - startX));
      sidebar.style.width = w + 'px';
      if (w > 60) {
        sidebar.classList.remove('collapsed');
        document.getElementById('sidebar-toggle').textContent = '[-]';
      }
    }
    function onUp() {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
})();

initResize('proj-browser-handle', () => document.getElementById('projects-section'), 80, 'y');

// Sidebar collapse toggle
document.getElementById('sidebar-header').addEventListener('click', () => {
  const sidebar = document.getElementById('colony-sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const collapsed = sidebar.classList.toggle('collapsed');
  toggle.textContent = collapsed ? '[+]' : '[-]';
  sidebar.style.width = '';
});

// Wire project column header sort
document.querySelectorAll('.proj-table th[data-key]').forEach(th => {
  th.addEventListener('click', () => {
    if (sortKey === th.dataset.key) { sortDir = -sortDir; }
    else { sortKey = th.dataset.key; sortDir = -1; }
    renderProjects();
  });
});

document.getElementById('show-completed').addEventListener('change', e => {
  showCompleted = e.target.checked; renderTechs();
});
document.getElementById('cat-select').addEventListener('change', e => {
  activeCat = e.target.value; renderTechs(); renderScientists();
});
document.getElementById('matching-only').addEventListener('change', e => {
  matchingOnly = e.target.checked; renderTechs(); renderScientists();
});

document.getElementById('btn-create').addEventListener('click', () => {
  if (!selectedTechId || !selectedSciId) return;
  const labs = Number(document.getElementById('assign-input').value) || 0;
  window.opener?.postMessage({ type: 'research-action', action: 'assign-project', scientistId: selectedSciId, techId: selectedTechId, labs }, '*');
  selectedTechId = null;
  selectedSciId = null;
  render();
});

window.addEventListener('message', e => {
  if (e.data?.type === 'research-update') { snap = e.data.data; render(); }
});

render();
window.opener?.postMessage({ type: 'ready' }, '*');
</script>
</body>
</html>`;
}
