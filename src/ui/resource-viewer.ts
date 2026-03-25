import { addNotification } from "../core/notifications";
import { state } from "../core/state";
import { RESOURCES } from "../data/resources";
import type { AsteroidInfo } from "../types";
import { isShipEntry, isSurveyable } from "../types";

// ---------------------------------------------------------------------------
// Data types (serializable, no Three.js references)
// ---------------------------------------------------------------------------

interface DepositCell {
	quantity: number;
	accessibility: number;
	miningValue: number;
}

interface BodyRow {
	bodyName: string;
	bodyType: string;
	totalValue: number;
	deposits: Record<string, DepositCell>; // keyed by resourceId
}

interface ResourceColumn {
	id: string;
	name: string;
	symbol: string;
	category: string;
}

interface ResourceSnapshot {
	bodyRows: BodyRow[];
	resourceColumns: ResourceColumn[];
	totalBodies: number;
	surveyedBodies: number;
	simTimeDays: number;
	selectedBodyName: string | null;
}

// ---------------------------------------------------------------------------
// Popout window state
// ---------------------------------------------------------------------------

let popoutWindow: Window | null = null;

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function buildDeposits(
	deposits: {
		resourceId: string;
		quantity: number;
		accessibility: number;
		minSurveyLevel: number;
	}[],
	surveyLevel: number,
): { cells: Record<string, DepositCell>; totalValue: number } {
	const cells: Record<string, DepositCell> = {};
	let totalValue = 0;
	for (const d of deposits) {
		if (d.minSurveyLevel > surveyLevel) continue;
		const val = Math.round(d.quantity * d.accessibility);
		cells[d.resourceId] = { quantity: d.quantity, accessibility: d.accessibility, miningValue: val };
		totalValue += val;
	}
	return { cells, totalValue };
}

export function collectBodyRows(): BodyRow[] {
	const rows: BodyRow[] = [];

	// Bodies (planets, moons, comets)
	for (const entry of state.bodyMeshes) {
		if (isShipEntry(entry)) continue;
		if (!isSurveyable(entry) || entry.survey.surveyLevel === 0) continue;

		const { cells: deposits, totalValue } = buildDeposits(
			entry.survey.deposits,
			entry.survey.surveyLevel,
		);
		if (Object.keys(deposits).length === 0) continue;

		rows.push({
			bodyName: entry.data.name,
			bodyType: entry.isMoon ? "Moon" : entry.data.type,
			totalValue,
			deposits,
		});
	}

	// Asteroids
	for (const beltEntry of state.asteroidBelts) {
		addBeltRows(rows, beltEntry.asteroids);
	}

	return rows;
}

function addBeltRows(rows: BodyRow[], asteroids: AsteroidInfo[]): void {
	for (const asteroid of asteroids) {
		if (!isSurveyable(asteroid) || asteroid.survey.surveyLevel === 0) continue;
		addAsteroidRow(rows, asteroid);
	}
}

function addAsteroidRow(rows: BodyRow[], asteroid: AsteroidInfo): void {
	const { cells: deposits, totalValue } = buildDeposits(
		asteroid.survey.deposits,
		asteroid.survey.surveyLevel,
	);
	if (Object.keys(deposits).length === 0) return;

	rows.push({
		bodyName: asteroid.designation,
		bodyType: "Asteroid",
		totalValue,
		deposits,
	});
}

function collectResourceColumns(bodyRows: BodyRow[]): ResourceColumn[] {
	const seen = new Set<string>();
	for (const row of bodyRows) {
		for (const id of Object.keys(row.deposits)) seen.add(id);
	}
	// Order by RESOURCES catalog order (metals first, then volatiles, etc.)
	return RESOURCES.filter((r) => seen.has(r.id)).map((r) => ({
		id: r.id,
		name: r.name,
		symbol: r.symbol,
		category: r.category,
	}));
}

function buildSnapshot(): ResourceSnapshot {
	let totalBodies = 0;
	let surveyedBodies = 0;

	for (const entry of state.bodyMeshes) {
		if (isShipEntry(entry)) continue;
		totalBodies++;
		if (isSurveyable(entry) && entry.survey.surveyLevel > 0) surveyedBodies++;
	}
	for (const belt of state.asteroidBelts) {
		for (const a of belt.asteroids) {
			totalBodies++;
			if (isSurveyable(a) && a.survey.surveyLevel > 0) surveyedBodies++;
		}
	}

	const bodyRows = collectBodyRows();
	return {
		bodyRows,
		resourceColumns: collectResourceColumns(bodyRows),
		totalBodies,
		surveyedBodies,
		simTimeDays: state.simTime.days,
		selectedBodyName: state.selectedBody?.data.name ?? null,
	};
}

// ---------------------------------------------------------------------------
// Popout management
// ---------------------------------------------------------------------------

export function isResourceViewerOpen(): boolean {
	return popoutWindow !== null && !popoutWindow.closed;
}

export function openResourceViewer(): boolean {
	if (isResourceViewerOpen()) {
		popoutWindow?.focus();
		pushResourceUpdate();
		return true;
	}

	const html = generatePopoutHTML();
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);

	popoutWindow = window.open(url, "drift-resources", "width=1100,height=600,menubar=no,toolbar=no");
	URL.revokeObjectURL(url);

	if (!popoutWindow) {
		addNotification("info", "Resource viewer blocked. Allow popups for this site, then try again.");
		return false;
	}

	window.addEventListener("message", handlePopoutMessage);
	window.addEventListener("beforeunload", cleanupPopout);
	return true;
}

export function closeResourceViewer(): void {
	if (popoutWindow && !popoutWindow.closed) popoutWindow.close();
	cleanupPopout();
}

function cleanupPopout(): void {
	popoutWindow = null;
	window.removeEventListener("message", handlePopoutMessage);
	window.removeEventListener("beforeunload", cleanupPopout);
}

export function pushResourceUpdate(): void {
	if (!isResourceViewerOpen()) return;
	popoutWindow?.postMessage({ type: "resource-update", data: buildSnapshot() }, "*");
}

export function pushBodySelected(name: string | null): void {
	if (!isResourceViewerOpen()) return;
	popoutWindow?.postMessage({ type: "body-selected", name }, "*");
}

function handlePopoutMessage(event: MessageEvent): void {
	if (!event.data || typeof event.data.type !== "string") return;
	switch (event.data.type) {
		case "ready":
			pushResourceUpdate();
			break;
		case "select-body":
			window.dispatchEvent(new CustomEvent("rv-select-body", { detail: event.data.name as string }));
			break;
	}
}

// ---------------------------------------------------------------------------
// Popout HTML generation
// ---------------------------------------------------------------------------

function generatePopoutHTML(): string {
	// Get resource metadata for column headers (sent statically in HTML)
	const allRes = RESOURCES.map((r) => ({
		id: r.id,
		name: r.name,
		symbol: r.symbol,
		category: r.category,
	}));

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Drift — Resource Survey</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='6' fill='%2388cc88'/></svg>">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
	background: #0d0d14;
	color: #88cc88;
	font-family: "Courier New", monospace;
	font-size: 11px;
	display: flex;
	flex-direction: column;
	height: 100vh;
}

.viewer-header {
	display: flex; align-items: center; gap: 10px;
	padding: 6px 10px; background: #141420; border-bottom: 1px solid #2a3a2a; flex-shrink: 0;
}
.viewer-title { color: #aaddaa; font-weight: bold; font-size: 13px; }
.viewer-status { font-size: 10px; margin-left: auto; }
.status-live { color: #88cc88; }
.status-disconnected { color: #cc8844; }
.mode-toggle {
	background: #1a2a1a; border: 1px solid #2a3a2a; color: #88cc88;
	padding: 2px 8px; cursor: pointer; font-family: inherit; font-size: 11px;
}
.mode-toggle:hover { background: #2a3a2a; }
.mode-toggle.active { background: #2a4a2a; border-color: #4a6a4a; }
.cell-mode-btn { font-size: 10px; padding: 1px 6px; }

.filter-bar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
	padding: 5px 10px; background: #0d0d14; border-bottom: 1px solid #1a2a1a; flex-shrink: 0;
}
.filter-search {
	background: #141420; border: 1px solid #2a3a2a; color: #88cc88;
	padding: 3px 6px; font-family: inherit; font-size: 11px; width: 130px;
}
.filter-search:focus { border-color: #4a6a4a; outline: none; }
.filter-search::placeholder { color: #3a5a3a; }
.cat-tab {
	display: inline-block; padding: 4px 10px; font-size: 10px;
	cursor: pointer; border: 1px solid #2a3a2a; border-bottom: none;
	user-select: none; text-transform: uppercase; font-weight: bold;
	letter-spacing: 0.5px; background: #0d0d14; color: #4a6a4a;
	border-radius: 3px 3px 0 0; margin-bottom: -1px; position: relative;
}
.cat-tab:hover { background: #1a2a1a; color: #88cc88; }
.cat-tab.active { background: #141420; border-bottom: 1px solid #141420; z-index: 1; }
.filter-sep { color: #2a3a2a; }
.reset-btn {
	background: #1a2a1a; border: 1px solid #2a3a2a; color: #88cc88;
	padding: 2px 8px; cursor: pointer; font-family: inherit; font-size: 10px;
}
.reset-btn:hover { background: #2a3a2a; }

.table-wrap { flex: 1; overflow: auto; }

table { border-collapse: collapse; }
thead th {
	position: sticky; top: 0; z-index: 2;
	background: #141420; border-bottom: 2px solid #2a3a2a;
	padding: 4px 6px; text-align: center; color: #aaddaa;
	cursor: pointer; white-space: nowrap; font-size: 10px; user-select: none;
}
thead th:hover { background: #1a2a1a; }
thead th.sorted { color: #ccffcc; }
thead th .sort-ind { color: #4a6a4a; font-size: 9px; margin-left: 2px; }
thead th.sorted .sort-ind { color: #88cc88; }
th.col-body { text-align: left; min-width: 120px; position: sticky; left: 0; z-index: 3; }
th.col-type { text-align: left; min-width: 65px; }
th.col-total { text-align: right; min-width: 70px; }
th.col-res { min-width: 80px; padding: 4px 8px; font-size: 10px; text-align: right; }

td { padding: 3px 6px; border-bottom: 1px solid #111118; white-space: nowrap; }
td.cell-body {
	position: sticky; left: 0; z-index: 1; background: inherit;
	text-align: left; max-width: 150px; overflow: hidden; text-overflow: ellipsis;
}
td.cell-type { text-align: left; color: #6a9a6a; }
td.cell-total { text-align: right; font-weight: bold; }
td.cell-dep { text-align: right; font-size: 10px; }
td.cell-dep.empty { color: #222; }

tr:nth-child(odd) { background: #0d0d14; }
tr:nth-child(even) { background: #10101a; }
tr:hover td { background: #1a2a1a; }
tr.selected td { background: #1a2a1a; }
tr.selected td.cell-body { border-left: 2px solid #88cc88; }

.body-link { color: #88cc88; cursor: pointer; text-decoration: none; }
.body-link:hover { text-decoration: underline; color: #aaddaa; }

.cat-metal { color: #aaccaa; }
.cat-volatile { color: #88aacc; }
.cat-industrial { color: #ccaa88; }
.cat-radioactive { color: #cc8888; }
.cat-umbral { color: #bb99dd; }
.cat-metal-bg { border-color: #aaccaa; }
.cat-volatile-bg { border-color: #88aacc; }
.cat-industrial-bg { border-color: #ccaa88; }
.cat-radioactive-bg { border-color: #cc8888; }
.cat-umbral-bg { border-color: #bb99dd; }

.summary-bar {
	display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
	padding: 5px 10px; background: #141420; border-top: 1px solid #2a3a2a;
	font-size: 11px; flex-shrink: 0;
}
.summary-stat { color: #6a9a6a; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0d0d14; }
::-webkit-scrollbar-thumb { background: #2a3a2a; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #3a4a3a; }
</style>
</head>
<body>

<div class="viewer-header">
	<span class="viewer-title">Resource Survey</span>
	<button class="mode-toggle cell-mode-btn" id="cell-mode-btn">Qty</button>
	<button class="mode-toggle" id="show-empty-btn">Show Empty</button>
	<span class="viewer-status">
		<span id="status-ind" class="status-live">[LIVE]</span>
		<span id="update-time" style="color:#4a6a4a; margin-left:6px;"></span>
	</span>
</div>

<div class="filter-bar">
	<span class="cat-tab active" data-cat="all" style="color:#88cc88;">All</span>
	<span class="cat-tab" data-cat="metal" style="border-color:#aaccaa55;">Metal</span>
	<span class="cat-tab" data-cat="volatile" style="border-color:#88aacc55;">Volatile</span>
	<span class="cat-tab" data-cat="industrial" style="border-color:#ccaa8855;">Industrial</span>
	<span class="cat-tab" data-cat="radioactive" style="border-color:#cc888855;">Radioactive</span>
	<span class="cat-tab" data-cat="umbral" style="border-color:#bb99dd55;">Umbral</span>
	<span class="filter-sep">|</span>
	<input type="text" class="filter-search" id="search-input" placeholder="Search body...">
</div>

<div class="table-wrap" id="table-wrap">
<table id="data-table" role="grid">
<thead id="thead"><tr></tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>

<div class="summary-bar" id="summary-bar"></div>

<script>
"use strict";
const ALL_RES = ${JSON.stringify(allRes)};
const CAT_COLORS = { metal:"#aaccaa", volatile:"#88aacc", industrial:"#ccaa88", radioactive:"#cc8888", umbral:"#bb99dd" };

let bodyRows = [];
let resCols = [];
let selectedBody = null;
let sortCol = "totalValue";
let sortDir = -1;
let activeTab = "all";
let cellMode = "value"; // "value" | "qty" | "access"
let showEmpty = false;

try {
	const s = JSON.parse(localStorage.getItem("drift-rv2") || "{}");
	if (s.sortCol) sortCol = s.sortCol;
	if (s.sortDir) sortDir = s.sortDir;
	if (s.activeTab) activeTab = s.activeTab;
	if (s.cellMode) cellMode = s.cellMode;
	if (s.showEmpty) showEmpty = true;
	if (s.search) document.addEventListener("DOMContentLoaded", () => { document.getElementById("search-input").value = s.search; });
} catch {}

function saveState() {
	try {
		localStorage.setItem("drift-rv2", JSON.stringify({
			sortCol, sortDir, activeTab,
			cellMode, showEmpty,
			search: document.getElementById("search-input").value,
		}));
	} catch {}
}

function visibleResCols() {
	if (activeTab === "all") return resCols;
	return resCols.filter(rc => rc.category === activeTab);
}

function fmtK(n) {
	if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
	if (n >= 1000) return (n / 1000).toFixed(1) + "k";
	return String(n);
}

function fmtCell(dep) {
	if (!dep) return "";
	if (cellMode === "qty") return fmtK(dep.quantity);
	if (cellMode === "access") return Math.round(dep.accessibility * 100) + "%";
	return fmtK(dep.miningValue);
}

function cellTitle(dep, resName) {
	if (!dep) return "";
	return resName + ": " + dep.quantity.toLocaleString() + "t, " + Math.round(dep.accessibility * 100) + "% access, value " + dep.miningValue.toLocaleString();
}

function getFiltered() {
	const search = (document.getElementById("search-input").value || "").toLowerCase();
	let filtered = bodyRows;
	if (search) filtered = filtered.filter(r => r.bodyName.toLowerCase().includes(search));
	if (!showEmpty && activeTab !== "all") {
		filtered = filtered.filter(r => {
			for (const [id, _] of Object.entries(r.deposits)) {
				const rc = ALL_RES.find(x => x.id === id);
				if (rc && rc.category === activeTab) return true;
			}
			return false;
		});
	}
	return filtered;
}

function sortBodies(arr) {
	return arr.slice().sort((a, b) => {
		let av, bv;
		if (sortCol === "bodyName") { av = a.bodyName; bv = b.bodyName; }
		else if (sortCol === "bodyType") { av = a.bodyType; bv = b.bodyType; }
		else if (sortCol === "totalValue") { av = a.totalValue; bv = b.totalValue; }
		else {
			// Sort by a resource column
			const da = a.deposits[sortCol], db = b.deposits[sortCol];
			av = da ? da.miningValue : 0;
			bv = db ? db.miningValue : 0;
		}
		if (av < bv) return -1 * sortDir;
		if (av > bv) return 1 * sortDir;
		return 0;
	});
}

function buildHeader() {
	const vrc = visibleResCols();
	const tr = document.querySelector("#thead tr");
	let h = "";
	h += '<th class="col-body" data-col="bodyName">Body<span class="sort-ind"></span></th>';
	h += '<th class="col-type" data-col="bodyType">Type<span class="sort-ind"></span></th>';
	h += '<th class="col-total" data-col="totalValue">Total<span class="sort-ind"></span></th>';
	for (const rc of vrc) {
		h += '<th class="col-res cat-' + rc.category + '" data-col="' + rc.id + '" title="' + rc.symbol + ' — ' + rc.category + '">' + rc.name + '<span class="sort-ind"></span></th>';
	}
	tr.innerHTML = h;
	updateSortIndicators();
}

function updateSortIndicators() {
	document.querySelectorAll("#thead th").forEach(th => {
		const col = th.dataset.col;
		const ind = th.querySelector(".sort-ind");
		if (col === sortCol) {
			th.classList.add("sorted");
			ind.textContent = sortDir === 1 ? " ▲" : " ▼";
		} else {
			th.classList.remove("sorted");
			ind.textContent = "";
		}
	});
}

function render() {
	const vrc = visibleResCols();
	buildHeader();

	const filtered = getFiltered();
	const sorted = sortBodies(filtered);
	const scrollTop = document.getElementById("table-wrap").scrollTop;
	const scrollLeft = document.getElementById("table-wrap").scrollLeft;

	const frags = [];
	for (const r of sorted) {
		const sel = r.bodyName === selectedBody ? " selected" : "";
		let row = '<tr class="' + sel.trim() + '">';
		row += '<td class="cell-body"><a class="body-link" data-name="' + r.bodyName.replace(/"/g,"&quot;") + '">' + r.bodyName + '</a></td>';
		row += '<td class="cell-type">' + r.bodyType + '</td>';
		row += '<td class="cell-total">' + fmtK(r.totalValue) + '</td>';
		for (const rc of vrc) {
			const dep = r.deposits[rc.id];
			if (dep) {
				row += '<td class="cell-dep cat-' + rc.category + '" title="' + cellTitle(dep, rc.name) + '">' + fmtCell(dep) + '</td>';
			} else {
				row += '<td class="cell-dep empty">·</td>';
			}
		}
		row += '</tr>';
		frags.push(row);
	}
	document.getElementById("tbody").innerHTML = frags.join("");

	document.getElementById("table-wrap").scrollTop = scrollTop;
	document.getElementById("table-wrap").scrollLeft = scrollLeft;

	// Summary
	document.getElementById("summary-bar").innerHTML =
		'<span class="summary-stat">Bodies: ' + sorted.length + ' / ' + bodyRows.length + '</span>' +
		'<span class="summary-stat">|</span>' +
		'<span class="summary-stat">Resources: ' + vrc.length + ' shown / ' + resCols.length + ' total</span>';

	saveState();
}

// Events: sort
document.getElementById("thead").addEventListener("click", (e) => {
	const th = e.target.closest("th");
	if (!th || !th.dataset.col) return;
	const col = th.dataset.col;
	if (sortCol === col) sortDir *= -1;
	else { sortCol = col; sortDir = -1; }
	render();
});

// Events: body clicks
document.getElementById("tbody").addEventListener("click", (e) => {
	const link = e.target.closest(".body-link");
	if (link) window.opener?.postMessage({ type: "select-body", name: link.dataset.name }, "*");
});

// Events: category tabs
function activateTab(cat) {
	activeTab = cat;
	document.querySelectorAll(".cat-tab").forEach(t => {
		t.classList.toggle("active", t.dataset.cat === cat);
		if (t.dataset.cat === cat) t.style.color = CAT_COLORS[cat] || "#88cc88";
		else t.style.color = "#4a6a4a";
	});
	render();
}
document.querySelectorAll(".cat-tab").forEach(tab => {
	tab.addEventListener("click", () => activateTab(tab.dataset.cat));
});
// Restore active tab visual
activateTab(activeTab);

// Events: search
document.getElementById("search-input").addEventListener("input", () => render());

// Events: cell mode toggle (cycles value -> qty -> access)
const modes = ["value", "qty", "access"];
const modeLabels = { value: "Value", qty: "Qty", access: "Access" };
document.getElementById("cell-mode-btn").addEventListener("click", () => {
	const idx = (modes.indexOf(cellMode) + 1) % modes.length;
	cellMode = modes[idx];
	document.getElementById("cell-mode-btn").textContent = modeLabels[cellMode];
	render();
});
// Init button label
document.getElementById("cell-mode-btn").textContent = modeLabels[cellMode];

// Events: show empty toggle
document.getElementById("show-empty-btn").addEventListener("click", () => {
	showEmpty = !showEmpty;
	document.getElementById("show-empty-btn").classList.toggle("active", showEmpty);
	render();
});
if (showEmpty) document.getElementById("show-empty-btn").classList.add("active");

// Events: keyboard
document.addEventListener("keydown", (e) => {
	if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
		e.preventDefault(); document.getElementById("search-input").focus();
	}
	if (e.key === "Escape") {
		document.getElementById("search-input").value = "";
		document.getElementById("search-input").blur(); render();
	}
});

// PostMessage
window.addEventListener("message", (e) => {
	if (!e.data || !e.data.type) return;
	if (e.data.type === "resource-update") {
		bodyRows = e.data.data.bodyRows || [];
		resCols = e.data.data.resourceColumns || [];
		selectedBody = e.data.data.selectedBodyName || null;
		const t = e.data.data.simTimeDays || 0;
		document.getElementById("update-time").textContent = "Day " + Math.floor(t);
		render();
	} else if (e.data.type === "body-selected") {
		selectedBody = e.data.name || null;
		render();
	}
});

// Connection check
setInterval(() => {
	const ind = document.getElementById("status-ind");
	if (!window.opener || window.opener.closed) { ind.textContent = "[DISCONNECTED]"; ind.className = "status-disconnected"; }
	else { ind.textContent = "[LIVE]"; ind.className = "status-live"; }
}, 3000);

window.opener?.postMessage({ type: "ready" }, "*");
document.getElementById("search-input").focus();
</script>
</body>
</html>`;
}
