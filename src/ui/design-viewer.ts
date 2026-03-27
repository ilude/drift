import { addNotification } from "../core/notifications";
import { state } from "../core/state";
import { findEngineTier, getUnlockedComponents, getUnlockedEngineTiers } from "../data/components";
import type { EngineDesign, ShipDesign, ShipDesignComponent } from "../data/ship-designs";
import { computeEngineStats, computeShipStats, validateShipDesign } from "../math/ship-design-calc";
import { createShip } from "../rendering/ship-transfer";
import type { ShipEntry } from "../types";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

interface EngineDesignSnapshot {
	id: string;
	name: string;
	tierId: string;
	tierName: string;
	powerMod: number;
	accelG: number;
	ispS: number;
	massKg: number;
}

interface ShipDesignSnapshot {
	id: string;
	name: string;
	engineDesignId: string;
	engineDesignName: string;
	engineCount: number;
	components: ShipDesignComponent[];
	dryMassKg: number;
	fuelCapacityKg: number;
	cargoCapacityKg: number;
	crewCapacity: number;
	maxSupplies: number;
	sensorMultiplier: number;
	accelG: number;
	ispS: number;
	armorHp: number;
}

interface UnlockedTierSnapshot {
	id: string;
	name: string;
	baseAccelG: number;
	baseIspS: number;
	baseMassKg: number;
	minPowerMod: number;
	maxPowerMod: number;
}

interface UnlockedComponentSnapshot {
	id: string;
	name: string;
	category: string;
	massKg: number;
	description: string;
	fuelCapacityKg?: number;
	cargoCapacityKg?: number;
	crewCapacity?: number;
	suppliesCapacity?: number;
	sensorBonus?: number;
	armorHp?: number;
}

interface ColonySnapshot {
	name: string;
	population: number;
}

interface ShipSnapshot {
	name: string;
	designId: string | null;
}

interface DesignSnapshot {
	engineDesigns: EngineDesignSnapshot[];
	shipDesigns: ShipDesignSnapshot[];
	unlockedTiers: UnlockedTierSnapshot[];
	unlockedComponents: UnlockedComponentSnapshot[];
	colonies: ColonySnapshot[];
	ships: ShipSnapshot[];
}

// ---------------------------------------------------------------------------
// Popout state
// ---------------------------------------------------------------------------

let popoutWindow: Window | null = null;
let _tickInterval: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

function buildSnapshot(): DesignSnapshot {
	const tiers = getUnlockedEngineTiers(state.researchedTechs);
	const components = getUnlockedComponents(state.researchedTechs);

	const engineDesigns: EngineDesignSnapshot[] = Array.from(state.engineDesigns.values()).map(
		(ed) => {
			const tier = tiers.find((t) => t.id === ed.tierId);
			return {
				id: ed.id,
				name: ed.name,
				tierId: ed.tierId,
				tierName: tier?.name ?? ed.tierId,
				powerMod: ed.powerMod,
				accelG: ed.accelG,
				ispS: ed.ispS,
				massKg: ed.massKg,
			};
		},
	);

	const shipDesigns: ShipDesignSnapshot[] = Array.from(state.shipDesigns.values()).map((sd) => {
		const engineDesign = state.engineDesigns.get(sd.engineDesignId);
		return {
			id: sd.id,
			name: sd.name,
			engineDesignId: sd.engineDesignId,
			engineDesignName: engineDesign?.name ?? sd.engineDesignId,
			engineCount: sd.engineCount,
			components: [...sd.components],
			dryMassKg: sd.dryMassKg,
			fuelCapacityKg: sd.fuelCapacityKg,
			cargoCapacityKg: sd.cargoCapacityKg,
			crewCapacity: sd.crewCapacity,
			maxSupplies: sd.maxSupplies,
			sensorMultiplier: sd.sensorMultiplier,
			accelG: sd.accelG,
			ispS: sd.ispS,
			armorHp: sd.armorHp,
		};
	});

	const unlockedTiers: UnlockedTierSnapshot[] = tiers.map((t) => ({
		id: t.id,
		name: t.name,
		baseAccelG: t.baseAccelG,
		baseIspS: t.baseIspS,
		baseMassKg: t.baseMassKg,
		minPowerMod: t.minPowerMod,
		maxPowerMod: t.maxPowerMod,
	}));

	const unlockedComponents: UnlockedComponentSnapshot[] = components.map((c) => ({
		id: c.id,
		name: c.name,
		category: c.category,
		massKg: c.massKg,
		description: c.description,
		fuelCapacityKg: c.fuelCapacityKg,
		cargoCapacityKg: c.cargoCapacityKg,
		crewCapacity: c.crewCapacity,
		suppliesCapacity: c.suppliesCapacity,
		sensorBonus: c.sensorBonus,
		armorHp: c.armorHp,
	}));

	const colonies: ColonySnapshot[] = Array.from(state.colonies.values())
		.filter((c) => c.population > 0)
		.map((c) => ({ name: c.bodyName, population: c.population }));

	const ships: ShipSnapshot[] = state.bodyMeshes
		.filter((e) => e.isShip)
		.map((e) => ({ name: e.data.name, designId: (e as import("../types").ShipEntry).designId }));

	return { engineDesigns, shipDesigns, unlockedTiers, unlockedComponents, colonies, ships };
}

// ---------------------------------------------------------------------------
// Popout management
// ---------------------------------------------------------------------------

export function isDesignViewerOpen(): boolean {
	return popoutWindow !== null && !popoutWindow.closed;
}

export function openDesignViewer(): boolean {
	if (isDesignViewerOpen()) {
		popoutWindow?.focus();
		pushDesignUpdate();
		return true;
	}

	const html = generatePopoutHTML();
	const blob = new Blob([html], { type: "text/html" });
	const url = URL.createObjectURL(blob);
	const pw = 1200,
		ph = 700;
	const pl = window.screenX + Math.round((window.outerWidth - pw) / 2);
	const pt = window.screenY + Math.round((window.outerHeight - ph) / 2);
	popoutWindow = window.open(
		url,
		"drift-designs",
		`width=${pw},height=${ph},left=${pl},top=${pt},menubar=no,toolbar=no,location=no`,
	);
	URL.revokeObjectURL(url);

	if (!popoutWindow) {
		addNotification("info", "Design viewer blocked. Allow popups for this site, then try again.");
		return false;
	}

	window.addEventListener("message", handlePopoutMessage);
	window.addEventListener("beforeunload", cleanupPopout);
	_tickInterval = setInterval(() => pushDesignUpdate(), 2000);
	setTimeout(() => pushDesignUpdate(), 300);
	return true;
}

export function closeDesignViewer(): void {
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
}

export function pushDesignUpdate(): void {
	if (!isDesignViewerOpen()) return;
	popoutWindow?.postMessage({ type: "design-update", data: buildSnapshot() }, "*");
}

// ---------------------------------------------------------------------------
// Message handler — action helpers
// ---------------------------------------------------------------------------

type ActionMsg = { action: string; [key: string]: unknown };

function handleCreateEngine(msg: ActionMsg): void {
	const tier = findEngineTier(msg.tierId as string);
	if (!tier) return;
	const powerMod = msg.powerMod as number;
	const stats = computeEngineStats(tier, powerMod);
	const id = `eng-${++state.designCounter}`;
	const design: EngineDesign = {
		id,
		name: msg.name as string,
		tierId: msg.tierId as string,
		powerMod,
		...stats,
	};
	state.engineDesigns.set(id, design);
}

function handleDeleteEngine(msg: ActionMsg): void {
	const engineId = msg.engineId as string;
	const inUse = Array.from(state.shipDesigns.values()).some((sd) => sd.engineDesignId === engineId);
	if (!inUse) state.engineDesigns.delete(engineId);
}

function handleCreateShipDesign(msg: ActionMsg): void {
	const engineDesignId = msg.engineDesignId as string;
	const engineDesign = state.engineDesigns.get(engineDesignId);
	if (!engineDesign) return;
	const engineCount = msg.engineCount as number;
	const components = msg.components as ShipDesignComponent[];
	if (!validateShipDesign(engineCount, components).valid) return;
	const stats = computeShipStats(engineDesign, engineCount, components);
	const id = `ship-${++state.designCounter}`;
	const design: ShipDesign = {
		id,
		name: msg.name as string,
		engineDesignId,
		engineCount,
		components: [...components],
		...stats,
	};
	state.shipDesigns.set(id, design);
}

function handleDeleteShipDesign(msg: ActionMsg): void {
	const shipDesignId = msg.shipDesignId as string;
	const inUse = state.bodyMeshes
		.filter((e) => e.isShip)
		.some((e) => (e as ShipEntry).designId === shipDesignId);
	if (!inUse) state.shipDesigns.delete(shipDesignId);
}

function handleBuildShip(msg: ActionMsg): void {
	const designId = msg.designId as string;
	const design = state.shipDesigns.get(designId);
	if (!design) return;
	if (!state.engineDesigns.has(design.engineDesignId)) return;
	createShip({
		name: msg.shipName as string,
		hostPlanetName: msg.colonyName as string,
		designId,
	});
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

function handlePopoutMessage(event: MessageEvent): void {
	if (!event.data || typeof event.data.type !== "string") return;
	if (event.data.type === "ready") {
		pushDesignUpdate();
		return;
	}
	if (event.data.type !== "design-action") return;

	const msg = event.data as ActionMsg;
	switch (msg.action) {
		case "create-engine":
			handleCreateEngine(msg);
			break;
		case "delete-engine":
			handleDeleteEngine(msg);
			break;
		case "create-ship-design":
			handleCreateShipDesign(msg);
			break;
		case "delete-ship-design":
			handleDeleteShipDesign(msg);
			break;
		case "build-ship":
			handleBuildShip(msg);
			break;
	}
	pushDesignUpdate();
}

// ---------------------------------------------------------------------------
// Popout HTML
// ---------------------------------------------------------------------------

function generatePopoutHTML(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Drift — Designs</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  background: #0d0d14; color: #88cc88;
  font-family: 'Exo 2', ui-sans-serif, sans-serif; font-size: 11px;
  display: flex; flex-direction: column; height: 100vh; overflow: hidden;
}

/* ---- Tabs ---- */
#tab-bar {
  display: flex; background: #0a0a12; border-bottom: 2px solid #2a3a2a;
  flex-shrink: 0;
}
.tab-btn {
  padding: 8px 20px; font-size: 11px; cursor: pointer;
  color: #556655; border-bottom: 2px solid transparent;
  margin-bottom: -2px; user-select: none; font-family: inherit;
  background: none; border-top: none; border-left: none; border-right: none;
  letter-spacing: 0.04em;
}
.tab-btn:hover { color: #88cc88; background: #111120; }
.tab-btn.active { color: #aaddaa; border-bottom-color: #88cc88; background: #0d1a0d; }

/* ---- Tab content ---- */
.tab-panel { display: none; flex: 1; overflow: hidden; }
.tab-panel.active { display: flex; }

/* ---- Split layout ---- */
.split-left {
  width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
  border-right: 1px solid #2a3a2a; background: #0a0a12;
}
.split-right {
  flex: 1; display: flex; flex-direction: column; overflow: hidden;
  padding: 12px 16px; overflow-y: auto;
}

/* ---- List section ---- */
.list-header {
  padding: 6px 10px; font-size: 10px; color: #556655;
  text-transform: uppercase; letter-spacing: 0.05em;
  background: #0f0f1c; border-bottom: 1px solid #1e1e1e; flex-shrink: 0;
}
.design-list { flex: 1; overflow-y: auto; }
.design-item {
  padding: 7px 10px; cursor: pointer; border-left: 2px solid transparent;
  border-bottom: 1px solid #0f0f1a;
}
.design-item:hover { background: #111a11; }
.design-item.selected { background: #111a11; border-left-color: #55aa55; }
.design-item-name { color: #aaffaa; font-weight: 500; margin-bottom: 2px; }
.design-item-meta { color: #556655; font-size: 10px; }
.design-item-del {
  float: right; background: none; border: 1px solid #553333; color: #cc7777;
  padding: 1px 5px; border-radius: 2px; cursor: pointer; font-size: 9px;
  font-family: inherit; margin-top: 1px;
}
.design-item-del:hover { border-color: #cc4444; color: #ffaaaa; background: #2a1a1a; }
.design-item-del:disabled { opacity: 0.3; cursor: default; }

/* ---- Form section ---- */
.form-section { margin-bottom: 16px; }
.form-section-title {
  font-size: 10px; color: #aaddaa; text-transform: uppercase;
  letter-spacing: 0.06em; margin-bottom: 8px; padding-bottom: 4px;
  border-bottom: 1px solid #1e2e1e;
}
.form-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
.form-label { font-size: 10px; color: #6a9a6a; width: 120px; flex-shrink: 0; }
.form-input, .form-select {
  background: #111a11; border: 1px solid #2a3a2a; color: #aaffaa;
  padding: 4px 8px; border-radius: 3px; font-size: 11px; font-family: inherit;
  flex: 1;
}
.form-input:focus, .form-select:focus { outline: none; border-color: #55aa55; }
input[type=range].form-range {
  flex: 1; accent-color: #55aa55; background: transparent;
  appearance: auto; height: 4px;
}
.range-val { color: #aaffaa; font-size: 11px; width: 36px; text-align: right; flex-shrink: 0; }

/* ---- Stats panel ---- */
.stats-panel {
  background: #0a120a; border: 1px solid #1e2e1e; border-radius: 3px;
  padding: 8px 10px; margin-bottom: 12px;
}
.stats-panel-title {
  font-size: 10px; color: #556655; text-transform: uppercase;
  letter-spacing: 0.05em; margin-bottom: 6px;
}
.stat-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
.stat-label { color: #6a9a6a; font-size: 10px; }
.stat-val { color: #aaffaa; font-size: 10px; font-weight: 500; }

/* ---- Validation messages ---- */
.validation-msg { color: #cc7777; font-size: 10px; margin-bottom: 6px; }

/* ---- Component rows ---- */
.component-rows { margin-bottom: 8px; }
.component-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.component-row .form-select { flex: 1; }
.component-count { width: 48px; flex-shrink: 0; }
.btn-remove-comp {
  background: none; border: 1px solid #553333; color: #cc7777;
  padding: 2px 6px; border-radius: 2px; cursor: pointer; font-size: 9px;
  font-family: inherit; flex-shrink: 0;
}
.btn-remove-comp:hover { border-color: #cc4444; color: #ffaaaa; background: #2a1a1a; }
.btn-add-comp {
  background: #0f1a0f; border: 1px solid #2a4a2a; color: #88cc88;
  padding: 4px 10px; border-radius: 3px; cursor: pointer; font-size: 10px;
  font-family: inherit; margin-bottom: 10px;
}
.btn-add-comp:hover { background: #1a2a1a; border-color: #55aa55; }

/* ---- Name row + create button ---- */
.create-row {
  display: flex; align-items: stretch; gap: 0;
  border-top: 1px solid #1e2e1e; padding-top: 12px; margin-top: 4px;
}
.create-row .form-input { border-radius: 3px 0 0 3px; border-right: none; }
.btn-create {
  background: #152515; border: 1px solid #3a6a3a; color: #88cc88;
  padding: 0 18px; cursor: pointer; font-size: 11px; font-family: inherit;
  border-radius: 0 3px 3px 0; white-space: nowrap;
}
.btn-create:hover { background: #1e3a1e; color: #aaffaa; border-color: #55aa55; }
.btn-create:disabled { opacity: 0.3; cursor: default; }

/* ---- Build ship section ---- */
.build-section {
  margin-top: 8px; padding: 8px 10px; background: #0a120a;
  border: 1px solid #1e2e1e; border-radius: 3px;
}
.build-section-title {
  font-size: 10px; color: #aaddaa; text-transform: uppercase;
  letter-spacing: 0.06em; margin-bottom: 7px;
}
.build-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.build-row .form-input, .build-row .form-select { flex: 1; }
.btn-commission {
  background: #152515; border: 1px solid #3a6a3a; color: #88cc88;
  padding: 5px 14px; cursor: pointer; font-size: 11px; font-family: inherit;
  border-radius: 3px; width: 100%; margin-top: 4px;
}
.btn-commission:hover { background: #1e3a1e; color: #aaffaa; border-color: #55aa55; }
.btn-commission:disabled { opacity: 0.3; cursor: default; }

.empty-note { color: #3a3a3a; font-style: italic; padding: 14px 10px; font-size: 10px; }

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #0d0d14; }
::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 3px; }
</style>
</head>
<body>

<div id="tab-bar">
  <button class="tab-btn active" data-tab="engines">Engine Designs</button>
  <button class="tab-btn" data-tab="ships">Ship Designs</button>
</div>

<!-- Engine Designs Tab -->
<div class="tab-panel active" id="tab-engines">
  <div class="split-left">
    <div class="list-header">Engine Designs</div>
    <div class="design-list" id="engine-list"></div>
  </div>
  <div class="split-right">
    <div class="form-section">
      <div class="form-section-title">New Engine Design</div>

      <div class="form-row">
        <span class="form-label">Engine Tier</span>
        <select class="form-select" id="eng-tier"></select>
      </div>

      <div class="form-row">
        <span class="form-label">Power Modifier</span>
        <input type="range" class="form-range" id="eng-power" min="0.5" max="3.0" step="0.1" value="1.0">
        <span class="range-val" id="eng-power-val">1.0</span>
      </div>

      <div class="stats-panel" id="eng-stats">
        <div class="stats-panel-title">Estimated Stats</div>
        <div class="stat-row"><span class="stat-label">Acceleration</span><span class="stat-val" id="est-accel">—</span></div>
        <div class="stat-row"><span class="stat-label">Specific Impulse</span><span class="stat-val" id="est-isp">—</span></div>
        <div class="stat-row"><span class="stat-label">Engine Mass</span><span class="stat-val" id="est-mass">—</span></div>
      </div>

      <div class="create-row">
        <input type="text" class="form-input" id="eng-name" placeholder="Engine design name…">
        <button class="btn-create" id="btn-create-engine">Create Engine Design</button>
      </div>
    </div>
  </div>
</div>

<!-- Ship Designs Tab -->
<div class="tab-panel" id="tab-ships">
  <div class="split-left">
    <div class="list-header">Ship Designs</div>
    <div class="design-list" id="ship-list"></div>
    <div id="build-panel"></div>
  </div>
  <div class="split-right">
    <div class="form-section">
      <div class="form-section-title">New Ship Design</div>

      <div class="form-row">
        <span class="form-label">Engine Design</span>
        <select class="form-select" id="ship-engine-sel"></select>
      </div>
      <div class="form-row">
        <span class="form-label">Engine Count</span>
        <input type="number" class="form-input" id="ship-engine-count" min="1" max="4" value="1">
      </div>

      <div class="form-section-title" style="margin-top:10px;">Components</div>
      <div class="component-rows" id="component-rows"></div>
      <button class="btn-add-comp" id="btn-add-comp">+ Add Component</button>

      <div class="stats-panel" id="ship-stats">
        <div class="stats-panel-title">Estimated Stats</div>
        <div class="stat-row"><span class="stat-label">Dry Mass</span><span class="stat-val" id="ss-dry-mass">—</span></div>
        <div class="stat-row"><span class="stat-label">Fuel Capacity</span><span class="stat-val" id="ss-fuel">—</span></div>
        <div class="stat-row"><span class="stat-label">Cargo</span><span class="stat-val" id="ss-cargo">—</span></div>
        <div class="stat-row"><span class="stat-label">Acceleration</span><span class="stat-val" id="ss-accel">—</span></div>
        <div class="stat-row"><span class="stat-label">Delta-V</span><span class="stat-val" id="ss-deltav">—</span></div>
        <div class="stat-row"><span class="stat-label">Crew</span><span class="stat-val" id="ss-crew">—</span></div>
        <div class="stat-row"><span class="stat-label">Supplies</span><span class="stat-val" id="ss-supplies">—</span></div>
        <div class="stat-row"><span class="stat-label">Sensor Multiplier</span><span class="stat-val" id="ss-sensor">—</span></div>
        <div class="stat-row"><span class="stat-label">Armor</span><span class="stat-val" id="ss-armor">—</span></div>
      </div>

      <div id="ship-validation"></div>

      <div class="create-row">
        <input type="text" class="form-input" id="ship-name" placeholder="Ship design name…">
        <button class="btn-create" id="btn-create-ship" disabled>Create Ship Design</button>
      </div>
    </div>
  </div>
</div>

<script>
// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let snap = { engineDesigns: [], shipDesigns: [], unlockedTiers: [], unlockedComponents: [], colonies: [], ships: [] };
let selectedEngineId = null;
let selectedShipDesignId = null;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function fmt(n, decimals) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtMass(kg) {
  if (kg == null) return '—';
  return kg.toLocaleString() + ' kg';
}

function engineInUse(engineId) {
  return snap.shipDesigns.some(sd => sd.engineDesignId === engineId);
}

function shipDesignInUse(designId) {
  return snap.ships.some(s => s.designId === designId);
}

// ---------------------------------------------------------------------------
// Tab switching
// ---------------------------------------------------------------------------

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Engine Tab
// ---------------------------------------------------------------------------

function renderEngineList() {
  const el = document.getElementById('engine-list');
  if (snap.engineDesigns.length === 0) {
    el.innerHTML = '<div class="empty-note">No engine designs yet.</div>';
    return;
  }
  let html = '';
  for (const ed of snap.engineDesigns) {
    const sel = ed.id === selectedEngineId ? ' selected' : '';
    const inUse = engineInUse(ed.id);
    html += \`<div class="design-item\${sel}" data-id="\${ed.id}">
      <button class="design-item-del"\${inUse ? ' disabled title="In use by ship design"' : ''} data-id="\${ed.id}">×</button>
      <div class="design-item-name">\${ed.name}</div>
      <div class="design-item-meta">\${ed.tierName} · \${fmt(ed.accelG, 2)} G · ISP \${ed.ispS.toLocaleString()} s · \${fmtMass(ed.massKg)}</div>
    </div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.design-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('design-item-del')) return;
      selectedEngineId = item.dataset.id;
      renderEngineList();
    });
  });
  el.querySelectorAll('.design-item-del:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.opener?.postMessage({ type: 'design-action', action: 'delete-engine', engineId: btn.dataset.id }, '*');
    });
  });
}

function updateEngineTierDropdown() {
  const sel = document.getElementById('eng-tier');
  sel.innerHTML = snap.unlockedTiers.map(t =>
    \`<option value="\${t.id}">\${t.name}</option>\`
  ).join('');
  updateEngineStats();
}

function getSelectedTier() {
  const tierId = document.getElementById('eng-tier').value;
  return snap.unlockedTiers.find(t => t.id === tierId) || null;
}

function updateEngineStats() {
  const tier = getSelectedTier();
  const powerMod = parseFloat(document.getElementById('eng-power').value);
  document.getElementById('eng-power-val').textContent = powerMod.toFixed(1);
  if (!tier) {
    document.getElementById('est-accel').textContent = '—';
    document.getElementById('est-isp').textContent = '—';
    document.getElementById('est-mass').textContent = '—';
    return;
  }
  const accelG = tier.baseAccelG * powerMod;
  const ispS = tier.baseIspS / Math.sqrt(powerMod);
  const massKg = tier.baseMassKg * powerMod;
  document.getElementById('est-accel').textContent = fmt(accelG, 2) + ' G';
  document.getElementById('est-isp').textContent = ispS.toLocaleString(undefined, {maximumFractionDigits: 0}) + ' s';
  document.getElementById('est-mass').textContent = fmtMass(massKg);
  // Also update range min/max from tier
  const rangeEl = document.getElementById('eng-power');
  rangeEl.min = String(tier.minPowerMod);
  rangeEl.max = String(tier.maxPowerMod);
}

document.getElementById('eng-tier').addEventListener('change', updateEngineStats);
document.getElementById('eng-power').addEventListener('input', updateEngineStats);

document.getElementById('btn-create-engine').addEventListener('click', () => {
  const name = document.getElementById('eng-name').value.trim();
  if (!name) { document.getElementById('eng-name').focus(); return; }
  const tierId = document.getElementById('eng-tier').value;
  const powerMod = parseFloat(document.getElementById('eng-power').value);
  window.opener?.postMessage({ type: 'design-action', action: 'create-engine', tierId, powerMod, name }, '*');
  document.getElementById('eng-name').value = '';
});

// ---------------------------------------------------------------------------
// Ship Tab
// ---------------------------------------------------------------------------

function renderShipList() {
  const el = document.getElementById('ship-list');
  if (snap.shipDesigns.length === 0) {
    el.innerHTML = '<div class="empty-note">No ship designs yet.</div>';
    renderBuildPanel(null);
    return;
  }
  let html = '';
  for (const sd of snap.shipDesigns) {
    const sel = sd.id === selectedShipDesignId ? ' selected' : '';
    const inUse = shipDesignInUse(sd.id);
    html += \`<div class="design-item\${sel}" data-id="\${sd.id}">
      <button class="design-item-del"\${inUse ? ' disabled title="In use by active ship"' : ''} data-id="\${sd.id}">×</button>
      <div class="design-item-name">\${sd.name}</div>
      <div class="design-item-meta">\${sd.engineDesignName} × \${sd.engineCount} · \${fmt(sd.accelG, 3)} G · \${fmtMass(sd.dryMassKg)}</div>
    </div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.design-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('design-item-del')) return;
      selectedShipDesignId = item.dataset.id;
      renderShipList();
      renderBuildPanel(snap.shipDesigns.find(sd => sd.id === selectedShipDesignId));
    });
  });
  el.querySelectorAll('.design-item-del:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (selectedShipDesignId === btn.dataset.id) { selectedShipDesignId = null; renderBuildPanel(null); }
      window.opener?.postMessage({ type: 'design-action', action: 'delete-ship-design', shipDesignId: btn.dataset.id }, '*');
    });
  });
  renderBuildPanel(snap.shipDesigns.find(sd => sd.id === selectedShipDesignId) || null);
}

function renderBuildPanel(design) {
  const el = document.getElementById('build-panel');
  if (!design) { el.innerHTML = ''; return; }
  const colonyOptions = snap.colonies.map(c =>
    \`<option value="\${c.name}">\${c.name} (\${c.population.toLocaleString()} pop)</option>\`
  ).join('');
  el.innerHTML = \`<div class="build-section">
    <div class="build-section-title">Commission Ship</div>
    <div class="build-row">
      <input type="text" class="form-input" id="build-ship-name" placeholder="Ship name…">
    </div>
    <div class="build-row">
      <select class="form-select" id="build-colony">\${colonyOptions || '<option value="">— no colonies —</option>'}</select>
    </div>
    <button class="btn-commission" id="btn-commission"\${snap.colonies.length === 0 ? ' disabled' : ''}>Commission Ship</button>
  </div>\`;
  document.getElementById('btn-commission').addEventListener('click', () => {
    const shipName = document.getElementById('build-ship-name').value.trim();
    const colonyName = document.getElementById('build-colony').value;
    if (!shipName || !colonyName) return;
    window.opener?.postMessage({ type: 'design-action', action: 'build-ship', designId: design.id, shipName, colonyName }, '*');
    document.getElementById('build-ship-name').value = '';
  });
}

function updateShipEngineDropdown() {
  const sel = document.getElementById('ship-engine-sel');
  if (snap.engineDesigns.length === 0) {
    sel.innerHTML = '<option value="">— no engine designs —</option>';
  } else {
    sel.innerHTML = snap.engineDesigns.map(ed =>
      \`<option value="\${ed.id}">\${ed.name}</option>\`
    ).join('');
  }
  updateShipStats();
}

function getComponentRows() {
  const rows = [];
  document.querySelectorAll('.component-row').forEach(row => {
    const compId = row.querySelector('.comp-sel').value;
    const count = parseInt(row.querySelector('.component-count').value, 10) || 1;
    if (compId) rows.push({ componentId: compId, count });
  });
  return rows;
}

function buildComponentOptionsHTML() {
  const byCategory = {};
  for (const c of snap.unlockedComponents) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }
  let html = '<option value="">— select —</option>';
  for (const [cat, comps] of Object.entries(byCategory)) {
    html += \`<optgroup label="\${cat}">\`;
    for (const c of comps) {
      html += \`<option value="\${c.id}">\${c.name} (\${c.massKg.toLocaleString()} kg)</option>\`;
    }
    html += '</optgroup>';
  }
  return html;
}

function addComponentRow(componentId, count) {
  const container = document.getElementById('component-rows');
  const row = document.createElement('div');
  row.className = 'component-row';
  row.innerHTML = \`<select class="form-select comp-sel">\${buildComponentOptionsHTML()}</select>
    <input type="number" class="form-input component-count" min="1" max="10" value="1">
    <button class="btn-remove-comp">×</button>\`;
  if (componentId) row.querySelector('.comp-sel').value = componentId;
  if (count) row.querySelector('.component-count').value = String(count);
  row.querySelector('.btn-remove-comp').addEventListener('click', () => {
    row.remove();
    updateShipStats();
  });
  row.querySelector('.comp-sel').addEventListener('change', updateShipStats);
  row.querySelector('.component-count').addEventListener('input', updateShipStats);
  container.appendChild(row);
  updateShipStats();
}

document.getElementById('btn-add-comp').addEventListener('click', () => addComponentRow('', 1));

function updateShipStats() {
  const engineId = document.getElementById('ship-engine-sel').value;
  const engineCount = parseInt(document.getElementById('ship-engine-count').value, 10) || 1;
  const components = getComponentRows();
  const validation = document.getElementById('ship-validation');
  const createBtn = document.getElementById('btn-create-ship');

  const engineDesign = snap.engineDesigns.find(ed => ed.id === engineId);
  if (!engineDesign) {
    setShipStatsBlank();
    validation.innerHTML = '';
    createBtn.disabled = true;
    return;
  }

  // Compute dry mass and stats from snapshot data (mirrors computeShipStats)
  let compMassKg = 0, fuelCap = 0, cargoCap = 0, crew = 0, supplies = 0, armor = 0, bestSensor = 0;
  for (const slot of components) {
    const def = snap.unlockedComponents.find(c => c.id === slot.componentId);
    if (!def) continue;
    compMassKg += def.massKg * slot.count;
    fuelCap += (def.fuelCapacityKg || 0) * slot.count;
    cargoCap += (def.cargoCapacityKg || 0) * slot.count;
    crew += (def.crewCapacity || 0) * slot.count;
    supplies += (def.suppliesCapacity || 0) * slot.count;
    armor += (def.armorHp || 0) * slot.count;
    if ((def.sensorBonus || 0) > bestSensor) bestSensor = def.sensorBonus || 0;
  }
  const dryMass = compMassKg + engineDesign.massKg * engineCount;
  const accelG = dryMass > 0 ? (engineDesign.accelG * engineDesign.massKg * engineCount) / dryMass : 0;
  const G_ACCEL = 9.80665;
  const exhaustV = engineDesign.ispS * G_ACCEL;
  const deltaVKmS = fuelCap > 0 ? exhaustV * Math.log((dryMass + fuelCap) / dryMass) / 1000 : 0;

  document.getElementById('ss-dry-mass').textContent = fmtMass(dryMass);
  document.getElementById('ss-fuel').textContent = fmtMass(fuelCap);
  document.getElementById('ss-cargo').textContent = fmtMass(cargoCap);
  document.getElementById('ss-accel').textContent = fmt(accelG, 3) + ' G';
  document.getElementById('ss-deltav').textContent = fuelCap > 0 ? fmt(deltaVKmS, 1) + ' km/s' : '—';
  document.getElementById('ss-crew').textContent = String(crew);
  document.getElementById('ss-supplies').textContent = String(supplies);
  document.getElementById('ss-sensor').textContent = bestSensor > 0 ? fmt(bestSensor, 1) + 'x' : '—';
  document.getElementById('ss-armor').textContent = armor > 0 ? armor + ' HP' : '—';

  // Validate
  const errors = validateDesign(engineCount, components);
  if (errors.length > 0) {
    validation.innerHTML = errors.map(e => \`<div class="validation-msg">⚠ \${e}</div>\`).join('');
    createBtn.disabled = true;
  } else {
    validation.innerHTML = '';
    createBtn.disabled = false;
  }
}

function validateDesign(engineCount, components) {
  const errors = [];
  if (engineCount < 1) errors.push('Ship must have at least one engine.');
  let bridgeCount = 0, hasCrewQ = false, hasFuel = false;
  for (const slot of components) {
    const def = snap.unlockedComponents.find(c => c.id === slot.componentId);
    if (!def) continue;
    if (def.category === 'bridge') bridgeCount += slot.count;
    if (def.category === 'crew-quarters') hasCrewQ = true;
    if (def.category === 'fuel-tank') hasFuel = true;
  }
  if (bridgeCount !== 1) errors.push(\`Ship must have exactly 1 bridge (found \${bridgeCount}).\`);
  if (!hasCrewQ) errors.push('Ship must have at least one crew quarters component.');
  if (!hasFuel) errors.push('Ship must have at least one fuel tank component.');
  return errors;
}

function setShipStatsBlank() {
  ['ss-dry-mass','ss-fuel','ss-cargo','ss-accel','ss-deltav','ss-crew','ss-supplies','ss-sensor','ss-armor']
    .forEach(id => { document.getElementById(id).textContent = '—'; });
}

document.getElementById('ship-engine-sel').addEventListener('change', updateShipStats);
document.getElementById('ship-engine-count').addEventListener('input', updateShipStats);

document.getElementById('btn-create-ship').addEventListener('click', () => {
  const name = document.getElementById('ship-name').value.trim();
  if (!name) { document.getElementById('ship-name').focus(); return; }
  const engineDesignId = document.getElementById('ship-engine-sel').value;
  const engineCount = parseInt(document.getElementById('ship-engine-count').value, 10) || 1;
  const components = getComponentRows();
  if (validateDesign(engineCount, components).length > 0) return;
  window.opener?.postMessage({ type: 'design-action', action: 'create-ship-design', engineDesignId, engineCount, components, name }, '*');
  document.getElementById('ship-name').value = '';
  document.getElementById('component-rows').innerHTML = '';
  document.getElementById('ship-engine-count').value = '1';
  updateShipStats();
});

// ---------------------------------------------------------------------------
// Full render
// ---------------------------------------------------------------------------

function render() {
  renderEngineList();
  updateEngineTierDropdown();
  renderShipList();
  updateShipEngineDropdown();
}

window.addEventListener('message', e => {
  if (e.data?.type === 'design-update') {
    snap = e.data.data;
    render();
  }
});

render();
window.opener?.postMessage({ type: 'ready' }, '*');
</script>
</body>
</html>`;
}
