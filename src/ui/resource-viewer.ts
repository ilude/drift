import { addNotification } from "../core/notifications";
import { state } from "../core/state";
import { getResourceDef } from "../data/resources";
import type { AsteroidInfo } from "../types";
import { isShipEntry, isSurveyable } from "../types";

// ---------------------------------------------------------------------------
// Data types (serializable, no Three.js references)
// ---------------------------------------------------------------------------

interface ResourceRow {
	bodyName: string;
	bodyType: string;
	distanceAU: number;
	resourceName: string;
	category: string;
	quantity: number;
	accessibility: number;
	surveyLevel: number;
	minSurveyLevel: number;
	miningValue: number;
}

interface ResourceSnapshot {
	rows: ResourceRow[];
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

export function collectResourceRows(): ResourceRow[] {
	const rows: ResourceRow[] = [];

	// Bodies (planets, moons, comets)
	for (const entry of state.bodyMeshes) {
		if (isShipEntry(entry)) continue;
		if (!isSurveyable(entry) || entry.survey.surveyLevel === 0) continue;
		addDepositsFromBody(
			rows,
			entry,
			entry.data.name,
			entry.data.type,
			entry.data.distance,
			entry.survey.surveyLevel,
		);
	}

	// Asteroids (in belt entries)
	for (const beltEntry of state.asteroidBelts) {
		for (const asteroid of beltEntry.asteroids) {
			if (!isSurveyable(asteroid) || asteroid.survey.surveyLevel === 0) continue;
			addDepositsFromAsteroid(rows, asteroid);
		}
	}

	return rows;
}

function addDepositsFromBody(
	rows: ResourceRow[],
	entry: BodyEntry,
	name: string,
	bodyType: string,
	distance: number,
	surveyLevel: number,
): void {
	if (!isSurveyable(entry)) return;
	for (const d of entry.survey.deposits) {
		if (d.minSurveyLevel > surveyLevel) continue;
		const def = getResourceDef(d.resourceId);
		if (!def) continue;
		rows.push({
			bodyName: name,
			bodyType: entry.isMoon ? "Moon" : bodyType,
			distanceAU: distance,
			resourceName: def.name,
			category: def.category,
			quantity: d.quantity,
			accessibility: d.accessibility,
			surveyLevel,
			minSurveyLevel: d.minSurveyLevel,
			miningValue: Math.round(d.quantity * d.accessibility),
		});
	}
}

function addDepositsFromAsteroid(rows: ResourceRow[], asteroid: AsteroidInfo): void {
	for (const d of asteroid.survey.deposits) {
		if (d.minSurveyLevel > asteroid.survey.surveyLevel) continue;
		const def = getResourceDef(d.resourceId);
		if (!def) continue;
		rows.push({
			bodyName: asteroid.designation,
			bodyType: "Asteroid",
			distanceAU: asteroid.au,
			resourceName: def.name,
			category: def.category,
			quantity: d.quantity,
			accessibility: d.accessibility,
			surveyLevel: asteroid.survey.surveyLevel,
			minSurveyLevel: d.minSurveyLevel,
			miningValue: Math.round(d.quantity * d.accessibility),
		});
	}
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

	return {
		rows: collectResourceRows(),
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
	// Reuse existing window if still open
	if (isResourceViewerOpen()) {
		popoutWindow?.focus();
		pushResourceUpdate();
		return true;
	}

	const html = generatePopoutHTML();
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);

	popoutWindow = window.open(url, "drift-resources", "width=920,height=600,menubar=no,toolbar=no");
	URL.revokeObjectURL(url);

	if (!popoutWindow) {
		addNotification("info", "Resource viewer blocked. Allow popups for this site, then try again.");
		return false;
	}

	// Listen for messages from popout
	window.addEventListener("message", handlePopoutMessage);

	// Clean up on main window close
	window.addEventListener("beforeunload", cleanupPopout);

	return true;
}

export function closeResourceViewer(): void {
	if (popoutWindow && !popoutWindow.closed) {
		popoutWindow.close();
	}
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
		case "select-body": {
			// Dispatch custom event — handled by ui.ts to avoid circular import with selection.ts
			window.dispatchEvent(new CustomEvent("rv-select-body", { detail: event.data.name as string }));
			break;
		}
	}
}

// ---------------------------------------------------------------------------
// Popout HTML generation
// ---------------------------------------------------------------------------

function generatePopoutHTML(): string {
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
	font-size: 12px;
	min-width: 680px;
	display: flex;
	flex-direction: column;
	height: 100vh;
}

/* Header */
.viewer-header {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 10px;
	background: #141420;
	border-bottom: 1px solid #2a3a2a;
	flex-shrink: 0;
}
.viewer-title { color: #aaddaa; font-weight: bold; font-size: 13px; }
.viewer-status { font-size: 10px; margin-left: auto; }
.status-live { color: #88cc88; }
.status-disconnected { color: #cc8844; }
.mode-toggle {
	background: #1a2a1a;
	border: 1px solid #2a3a2a;
	color: #88cc88;
	padding: 2px 8px;
	cursor: pointer;
	font-family: inherit;
	font-size: 11px;
}
.mode-toggle:hover { background: #2a3a2a; }
.mode-toggle.active { background: #2a4a2a; border-color: #4a6a4a; }

/* Filter bar */
.filter-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	padding: 6px 10px;
	background: #0d0d14;
	border-bottom: 1px solid #1a2a1a;
	flex-shrink: 0;
}
.filter-search {
	background: #141420;
	border: 1px solid #2a3a2a;
	color: #88cc88;
	padding: 3px 6px;
	font-family: inherit;
	font-size: 11px;
	width: 140px;
}
.filter-search:focus { border-color: #4a6a4a; outline: none; }
.filter-search::placeholder { color: #3a5a3a; }
.cat-chip {
	display: inline-block;
	padding: 2px 8px;
	border-radius: 3px;
	font-size: 10px;
	cursor: pointer;
	border: 1px solid;
	user-select: none;
	text-transform: uppercase;
	font-weight: bold;
	letter-spacing: 0.5px;
}
.cat-chip.active { opacity: 1; }
.cat-chip.inactive { opacity: 0.35; }
.filter-sep { color: #2a3a2a; margin: 0 2px; }
.filter-label { color: #6a9a6a; font-size: 10px; }
.filter-num {
	background: #141420;
	border: 1px solid #2a3a2a;
	color: #88cc88;
	padding: 2px 4px;
	font-family: inherit;
	font-size: 11px;
	width: 70px;
}
.filter-num:focus { border-color: #4a6a4a; outline: none; }
.reset-btn {
	background: #1a2a1a;
	border: 1px solid #2a3a2a;
	color: #88cc88;
	padding: 2px 8px;
	cursor: pointer;
	font-family: inherit;
	font-size: 10px;
}
.reset-btn:hover { background: #2a3a2a; }

/* Table container */
.table-wrap {
	flex: 1;
	overflow: auto;
	position: relative;
}

/* Table */
table {
	width: 100%;
	border-collapse: collapse;
	table-layout: fixed;
}
thead th {
	position: sticky;
	top: 0;
	z-index: 1;
	background: #141420;
	border-bottom: 2px solid #2a3a2a;
	padding: 5px 8px;
	text-align: left;
	color: #aaddaa;
	cursor: pointer;
	white-space: nowrap;
	font-size: 11px;
	user-select: none;
}
thead th:hover { background: #1a2a1a; }
thead th .sort-ind { color: #4a6a4a; font-size: 10px; margin-left: 3px; }
thead th.sorted .sort-ind { color: #88cc88; }
td {
	padding: 3px 8px;
	border-bottom: 1px solid #111118;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
tr:nth-child(even) { background: #10101a; }
tr:hover { background: #1a2a1a; }
tr.selected { background: #1a2a1a; border-left: 2px solid #88cc88; }
.col-num { text-align: right; }
.col-center { text-align: center; }
.body-link { color: #88cc88; cursor: pointer; text-decoration: none; }
.body-link:hover { text-decoration: underline; color: #aaddaa; }

/* Category colors */
.cat-metal { color: #aaccaa; }
.cat-volatile { color: #88aacc; }
.cat-industrial { color: #ccaa88; }
.cat-radioactive { color: #cc8888; }
.cat-umbral { color: #bb99dd; }

/* Column widths */
.cw-resource { width: 15%; }
.cw-body { width: 18%; }
.cw-type { width: 10%; }
.cw-qty { width: 12%; }
.cw-access { width: 14%; }
.cw-value { width: 12%; }
.cw-dist { width: 10%; }
.cw-lv { width: 5%; }
.compact .cw-type, .compact .cw-dist, .compact .cw-lv { display: none; }
.compact td:nth-child(3), .compact td:nth-child(7), .compact td:nth-child(8) { display: none; }

/* Summary footer */
.summary-bar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 6px 10px;
	background: #141420;
	border-top: 1px solid #2a3a2a;
	font-size: 11px;
	flex-shrink: 0;
}
.summary-stat { color: #6a9a6a; }
.summary-badge {
	display: inline-block;
	padding: 1px 6px;
	border-radius: 2px;
	font-size: 10px;
	font-weight: bold;
}

/* Scrollbar */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0d0d14; }
::-webkit-scrollbar-thumb { background: #2a3a2a; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #3a4a3a; }
</style>
</head>
<body>

<div class="viewer-header">
	<span class="viewer-title">Resource Survey</span>
	<button class="mode-toggle" id="compact-btn">Compact</button>
	<span class="viewer-status">
		<span id="status-ind" class="status-live">[LIVE]</span>
		<span id="update-time" style="color:#4a6a4a; margin-left:6px;"></span>
	</span>
</div>

<div class="filter-bar">
	<input type="text" class="filter-search" id="search-input" placeholder="Search...">
	<span class="filter-sep">|</span>
	<span class="cat-chip active" data-cat="metal" style="border-color:#aaccaa; background:#aaccaa22;">Metal</span>
	<span class="cat-chip active" data-cat="volatile" style="border-color:#88aacc; background:#88aacc22;">Volatile</span>
	<span class="cat-chip active" data-cat="industrial" style="border-color:#ccaa88; background:#ccaa8822;">Industrial</span>
	<span class="cat-chip active" data-cat="radioactive" style="border-color:#cc8888; background:#cc888822;">Radioactive</span>
	<span class="cat-chip active" data-cat="umbral" style="border-color:#bb99dd; background:#bb99dd22;">Umbral</span>
	<span class="filter-sep">|</span>
	<span class="filter-label">Min Qty:</span>
	<input type="number" class="filter-num" id="min-qty" min="0" placeholder="0">
	<span class="filter-label">Min Access:</span>
	<input type="number" class="filter-num" id="min-access" min="0" max="1" step="0.1" placeholder="0">
	<span class="filter-sep">|</span>
	<button class="reset-btn" id="reset-btn">Reset</button>
</div>

<div class="table-wrap" id="table-wrap">
<table id="data-table" role="grid">
<thead><tr>
	<th class="cw-resource" data-col="resourceName">Resource<span class="sort-ind"></span></th>
	<th class="cw-body" data-col="bodyName">Body<span class="sort-ind"></span></th>
	<th class="cw-type" data-col="bodyType">Type<span class="sort-ind"></span></th>
	<th class="cw-qty col-num" data-col="quantity">Qty<span class="sort-ind"></span></th>
	<th class="cw-access col-center" data-col="accessibility">Access<span class="sort-ind"></span></th>
	<th class="cw-value col-num sorted" data-col="miningValue">Value<span class="sort-ind">▼</span></th>
	<th class="cw-dist col-num" data-col="distanceAU">Dist<span class="sort-ind"></span></th>
	<th class="cw-lv col-center" data-col="minSurveyLevel">Lv<span class="sort-ind"></span></th>
</tr></thead>
<tbody id="tbody"></tbody>
</table>
</div>

<div class="summary-bar" id="summary-bar"></div>

<script>
"use strict";
const CAT_COLORS = { metal:"#aaccaa", volatile:"#88aacc", industrial:"#ccaa88", radioactive:"#cc8888", umbral:"#bb99dd" };
const CAT_BG = { metal:"#aaccaa22", volatile:"#88aacc22", industrial:"#ccaa8822", radioactive:"#cc888822", umbral:"#bb99dd22" };

let rows = [];
let selectedBody = null;
let sortCol = "miningValue";
let sortDir = -1; // -1 desc, 1 asc
let sortCols = [{ col: "miningValue", dir: -1 }];
let categories = new Set(["metal","volatile","industrial","radioactive","umbral"]);
let compact = false;

// Restore persisted state
try {
	const saved = JSON.parse(localStorage.getItem("drift-rv-state") || "{}");
	if (saved.sortCols) sortCols = saved.sortCols;
	if (saved.categories) categories = new Set(saved.categories);
	if (saved.compact) { compact = true; document.body.classList.add("compact"); document.getElementById("compact-btn").classList.add("active"); }
	if (saved.minQty) document.addEventListener("DOMContentLoaded", () => { document.getElementById("min-qty").value = saved.minQty; });
	if (saved.minAccess) document.addEventListener("DOMContentLoaded", () => { document.getElementById("min-access").value = saved.minAccess; });
	if (saved.search) document.addEventListener("DOMContentLoaded", () => { document.getElementById("search-input").value = saved.search; });
	// Restore chip visual state
	if (saved.categories) {
		document.querySelectorAll(".cat-chip").forEach(c => {
			c.classList.toggle("active", categories.has(c.dataset.cat));
			c.classList.toggle("inactive", !categories.has(c.dataset.cat));
		});
	}
} catch {}

function saveState() {
	try {
		localStorage.setItem("drift-rv-state", JSON.stringify({
			sortCols,
			categories: [...categories],
			compact,
			minQty: document.getElementById("min-qty").value,
			minAccess: document.getElementById("min-access").value,
			search: document.getElementById("search-input").value,
		}));
	} catch {}
}

function accessBar(v) {
	const f = Math.round(v * 5);
	return "[" + "=".repeat(f) + ".".repeat(5 - f) + "] " + Math.round(v * 100) + "%";
}

function fmtNum(n) { return n.toLocaleString(); }

function getFiltered() {
	const search = (document.getElementById("search-input").value || "").toLowerCase();
	const minQty = parseFloat(document.getElementById("min-qty").value) || 0;
	const minAccess = parseFloat(document.getElementById("min-access").value) || 0;
	return rows.filter(r =>
		categories.has(r.category) &&
		r.quantity >= minQty &&
		r.accessibility >= minAccess &&
		(search === "" || r.resourceName.toLowerCase().includes(search) || r.bodyName.toLowerCase().includes(search))
	);
}

function sortRows(arr) {
	const cols = sortCols.length ? sortCols : [{ col: "miningValue", dir: -1 }];
	return arr.slice().sort((a, b) => {
		for (const { col, dir } of cols) {
			const av = a[col], bv = b[col];
			if (av < bv) return -1 * dir;
			if (av > bv) return 1 * dir;
		}
		return 0;
	});
}

function render() {
	const filtered = getFiltered();
	const sorted = sortRows(filtered);
	const tbody = document.getElementById("tbody");
	const scrollTop = document.getElementById("table-wrap").scrollTop;

	const frags = [];
	for (const r of sorted) {
		const sel = r.bodyName === selectedBody ? " selected" : "";
		const catClass = "cat-" + r.category;
		frags.push("<tr class=\\"" + sel.trim() + "\\" data-body=\\"" + r.bodyName.replace(/"/g,"&quot;") + "\\">" +
			"<td class=\\"" + catClass + " cw-resource\\">" + r.resourceName + "</td>" +
			"<td class=\\"cw-body\\"><a class=\\"body-link\\" data-name=\\"" + r.bodyName.replace(/"/g,"&quot;") + "\\">" + r.bodyName + "</a></td>" +
			"<td class=\\"cw-type\\">" + r.bodyType + "</td>" +
			"<td class=\\"col-num cw-qty\\">" + fmtNum(r.quantity) + "</td>" +
			"<td class=\\"col-center cw-access\\" aria-label=\\"Accessibility: " + Math.round(r.accessibility * 100) + "%\\">" + accessBar(r.accessibility) + "</td>" +
			"<td class=\\"col-num cw-value\\">" + fmtNum(r.miningValue) + "</td>" +
			"<td class=\\"col-num cw-dist\\">" + r.distanceAU.toFixed(2) + "</td>" +
			"<td class=\\"col-center cw-lv\\">" + r.minSurveyLevel + "</td>" +
			"</tr>");
	}
	tbody.innerHTML = frags.join("");

	// Restore scroll
	document.getElementById("table-wrap").scrollTop = scrollTop;

	// Summary
	const catCounts = {};
	for (const r of filtered) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
	const badges = Object.entries(catCounts).map(([cat, n]) =>
		"<span class=\\"summary-badge\\" style=\\"background:" + (CAT_BG[cat]||"#222") + ";color:" + (CAT_COLORS[cat]||"#888") + ";border:1px solid " + (CAT_COLORS[cat]||"#444") + "\\">" + cat.charAt(0).toUpperCase() + cat.slice(1) + ": " + n + "</span>"
	).join(" ");
	document.getElementById("summary-bar").innerHTML =
		"<span class=\\"summary-stat\\">Deposits: " + filtered.length + " / " + rows.length + "</span>" +
		"<span class=\\"summary-stat\\">|</span>" +
		badges;

	// Update sort indicators
	document.querySelectorAll("thead th").forEach(th => {
		const col = th.dataset.col;
		const idx = sortCols.findIndex(s => s.col === col);
		const ind = th.querySelector(".sort-ind");
		if (idx >= 0) {
			th.classList.add("sorted");
			const arrow = sortCols[idx].dir === 1 ? "▲" : "▼";
			ind.textContent = sortCols.length > 1 ? arrow + (idx + 1) : arrow;
			th.setAttribute("aria-sort", sortCols[idx].dir === 1 ? "ascending" : "descending");
		} else {
			th.classList.remove("sorted");
			ind.textContent = "";
			th.removeAttribute("aria-sort");
		}
	});

	saveState();
}

// Event: sort headers
document.querySelector("thead").addEventListener("click", (e) => {
	const th = e.target.closest("th");
	if (!th) return;
	const col = th.dataset.col;
	if (!col) return;

	if (e.shiftKey) {
		// Multi-sort: add or toggle this column
		const idx = sortCols.findIndex(s => s.col === col);
		if (idx >= 0) {
			sortCols[idx].dir *= -1;
		} else {
			sortCols.push({ col, dir: -1 });
		}
	} else {
		// Single sort
		const existing = sortCols.length === 1 && sortCols[0].col === col;
		if (existing) {
			sortCols[0].dir *= -1;
		} else {
			sortCols = [{ col, dir: -1 }];
		}
	}
	render();
});

// Event: body name clicks
document.getElementById("tbody").addEventListener("click", (e) => {
	const link = e.target.closest(".body-link");
	if (link) {
		window.opener?.postMessage({ type: "select-body", name: link.dataset.name }, "*");
	}
});

// Event: category chips
document.querySelectorAll(".cat-chip").forEach(chip => {
	chip.addEventListener("click", () => {
		const cat = chip.dataset.cat;
		if (categories.has(cat)) {
			categories.delete(cat);
			chip.classList.remove("active");
			chip.classList.add("inactive");
		} else {
			categories.add(cat);
			chip.classList.add("active");
			chip.classList.remove("inactive");
		}
		render();
	});
});

// Event: filter inputs
document.getElementById("search-input").addEventListener("input", () => render());
document.getElementById("min-qty").addEventListener("input", () => render());
document.getElementById("min-access").addEventListener("input", () => render());

// Event: reset
document.getElementById("reset-btn").addEventListener("click", () => {
	document.getElementById("search-input").value = "";
	document.getElementById("min-qty").value = "";
	document.getElementById("min-access").value = "";
	categories = new Set(["metal","volatile","industrial","radioactive","umbral"]);
	document.querySelectorAll(".cat-chip").forEach(c => { c.classList.add("active"); c.classList.remove("inactive"); });
	sortCols = [{ col: "miningValue", dir: -1 }];
	render();
});

// Event: compact toggle
document.getElementById("compact-btn").addEventListener("click", () => {
	compact = !compact;
	document.body.classList.toggle("compact", compact);
	document.getElementById("compact-btn").classList.toggle("active", compact);
	saveState();
});

// Event: keyboard shortcuts
document.addEventListener("keydown", (e) => {
	if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
		e.preventDefault();
		document.getElementById("search-input").focus();
	}
	if (e.key === "Escape") {
		document.getElementById("search-input").value = "";
		document.getElementById("search-input").blur();
		render();
	}
});

// PostMessage handler
window.addEventListener("message", (e) => {
	if (!e.data || !e.data.type) return;
	if (e.data.type === "resource-update") {
		rows = e.data.data.rows || [];
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
let connInterval = setInterval(() => {
	const ind = document.getElementById("status-ind");
	if (!window.opener || window.opener.closed) {
		ind.textContent = "[DISCONNECTED]";
		ind.className = "status-disconnected";
	} else {
		ind.textContent = "[LIVE]";
		ind.className = "status-live";
	}
}, 3000);

// Signal ready
window.opener?.postMessage({ type: "ready" }, "*");

// Focus search on load
document.getElementById("search-input").focus();
</script>
</body>
</html>`;
}
