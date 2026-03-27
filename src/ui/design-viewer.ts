import { addNotification } from "../core/notifications";
import { state } from "../core/state";
import { findEngineTier, getUnlockedComponents, getUnlockedEngineTiers } from "../data/components";
import type { EngineDesign, ShipDesign, ShipDesignComponent } from "../data/ship-designs";
import { computeEngineStats, computeShipStats, validateShipDesign } from "../math/ship-design-calc";
import { createShip } from "../rendering/ship-transfer";
import type { MissileDesign, SensorDesign, ShipEntry, TurretDesign } from "../types";

// ---------------------------------------------------------------------------
// Snapshot types
// ---------------------------------------------------------------------------

interface EngineDesignSnapshot {
	id: string;
	name: string;
	tierId: string;
	tierName: string;
	powerPct: number;
	sizeHS: number;
	fuelMod: number;
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

interface EnginePowerOptionSnapshot {
	label: string;
	powerPct: number;
	fuelMod: number;
}

interface EngineSizeOptionSnapshot {
	sizeHS: number;
	label: string;
	fuelReductionPct: number;
}

interface UnlockedTierSnapshot {
	id: string;
	name: string;
	baseAccelG: number;
	baseIspS: number;
	baseMassPerHS: number;
	powerOptions: EnginePowerOptionSnapshot[];
	sizeOptions: EngineSizeOptionSnapshot[];
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

interface MissileDesignSnapshot {
	id: string;
	name: string;
	sizeHS: number;
	warheadStrength: number;
	speed: number;
	range: number;
	damage: number;
}

interface TurretDesignSnapshot {
	id: string;
	name: string;
	weaponType: string;
	damage: number;
	range: number;
	rateOfFire: number;
	sizeHS: number;
}

interface SensorDesignSnapshot {
	id: string;
	name: string;
	sensorType: string;
	resolution: number;
	range: number;
	sizeHS: number;
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
	missileDesigns: MissileDesignSnapshot[];
	turretDesigns: TurretDesignSnapshot[];
	sensorDesigns: SensorDesignSnapshot[];
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
				powerPct: ed.powerPct,
				sizeHS: ed.sizeHS,
				fuelMod: ed.fuelMod,
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
		baseMassPerHS: t.baseMassPerHS,
		powerOptions: [...t.powerOptions],
		sizeOptions: [...t.sizeOptions],
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

	const missileDesigns: MissileDesignSnapshot[] = Array.from(state.missileDesigns.values()).map(
		(md) => ({
			id: md.id,
			name: md.name,
			sizeHS: md.sizeHS,
			warheadStrength: md.warheadStrength,
			speed: md.speed,
			range: md.range,
			damage: md.damage,
		}),
	);

	const turretDesigns: TurretDesignSnapshot[] = Array.from(state.turretDesigns.values()).map(
		(td) => ({
			id: td.id,
			name: td.name,
			weaponType: td.weaponType,
			damage: td.damage,
			range: td.range,
			rateOfFire: td.rateOfFire,
			sizeHS: td.sizeHS,
		}),
	);

	const sensorDesigns: SensorDesignSnapshot[] = Array.from(state.sensorDesigns.values()).map(
		(sd) => ({
			id: sd.id,
			name: sd.name,
			sensorType: sd.sensorType,
			resolution: sd.resolution,
			range: sd.range,
			sizeHS: sd.sizeHS,
		}),
	);

	return {
		engineDesigns,
		shipDesigns,
		unlockedTiers,
		unlockedComponents,
		colonies,
		ships,
		missileDesigns,
		turretDesigns,
		sensorDesigns,
	};
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
	const powerPct = msg.powerPct as number;
	const sizeHS = msg.sizeHS as number;
	const stats = computeEngineStats(tier, powerPct, sizeHS);
	const id = `eng-${++state.designCounter}`;
	const design: EngineDesign = {
		id,
		name: msg.name as string,
		tierId: msg.tierId as string,
		powerPct,
		sizeHS,
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

function handleCreateMissile(msg: ActionMsg): void {
	const id = `msl-${++state.designCounter}`;
	const design: MissileDesign = {
		id,
		name: msg.name as string,
		sizeHS: msg.sizeHS as number,
		warheadStrength: msg.warheadStrength as number,
		enginePower: msg.enginePower as number,
		agility: msg.agility as number,
		fuelCapacity: 0,
		sensorStrength: 0,
		speed: msg.speed as number,
		range: msg.range as number,
		damage: msg.damage as number,
	};
	state.missileDesigns.set(id, design);
}

function handleDeleteMissile(msg: ActionMsg): void {
	state.missileDesigns.delete(msg.missileId as string);
}

function handleCreateTurret(msg: ActionMsg): void {
	const id = `trt-${++state.designCounter}`;
	const design: TurretDesign = {
		id,
		name: msg.name as string,
		weaponType: msg.weaponType as TurretDesign["weaponType"],
		caliber: msg.caliber as number,
		trackingSpeed: msg.trackingSpeed as number,
		damage: msg.damage as number,
		range: msg.range as number,
		rateOfFire: msg.rateOfFire as number,
		sizeHS: msg.sizeHS as number,
	};
	state.turretDesigns.set(id, design);
}

function handleDeleteTurret(msg: ActionMsg): void {
	state.turretDesigns.delete(msg.turretId as string);
}

function handleCreateSensor(msg: ActionMsg): void {
	const id = `sns-${++state.designCounter}`;
	const design: SensorDesign = {
		id,
		name: msg.name as string,
		sensorType: msg.sensorType as SensorDesign["sensorType"],
		resolution: msg.resolution as number,
		sizeHS: msg.sizeHS as number,
		range: msg.range as number,
		strength: msg.strength as number,
	};
	state.sensorDesigns.set(id, design);
}

function handleDeleteSensor(msg: ActionMsg): void {
	state.sensorDesigns.delete(msg.sensorId as string);
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
		case "create-missile":
			handleCreateMissile(msg);
			break;
		case "delete-missile":
			handleDeleteMissile(msg);
			break;
		case "create-turret":
			handleCreateTurret(msg);
			break;
		case "delete-turret":
			handleDeleteTurret(msg);
			break;
		case "create-sensor":
			handleCreateSensor(msg);
			break;
		case "delete-sensor":
			handleDeleteSensor(msg);
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

/* ---- Errors pane ---- */
.errors-pane {
  margin-top: 8px;
  padding: 6px;
  border: 1px solid #3a2020;
  background: #1a0d0d;
  font-size: 10px;
  display: none;
}
.errors-pane.has-errors {
  display: block;
}
.error-item {
  color: #cc4444;
  padding: 1px 0;
}
.error-item::before {
  content: '✗ ';
}
.valid-item {
  color: #4a8a4a;
  padding: 1px 0;
}
.valid-item::before {
  content: '✓ ';
}

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

.btn-small {
  background: #1a2a1a;
  border: 1px solid #2a3a2a;
  color: #88cc88;
  font-family: 'Exo 2', sans-serif;
  font-size: 10px;
  padding: 3px 8px;
  cursor: pointer;
}
.btn-small:hover {
  border-color: #4a6a4a;
  color: #aaffaa;
}

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
  <button class="tab-btn" data-tab="missiles">Missiles</button>
  <button class="tab-btn" data-tab="turrets">Turrets</button>
  <button class="tab-btn" data-tab="sensors">Sensors</button>
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
        <span class="form-label">Engine Power</span>
        <select class="form-select" id="eng-power"></select>
      </div>

      <div class="form-row">
        <span class="form-label">Engine Size</span>
        <select class="form-select" id="eng-size"></select>
      </div>

      <div class="stats-panel" id="eng-stats">
        <div class="stats-panel-title">Estimated Performance</div>
        <div class="stat-row"><span class="stat-label">Acceleration</span><span class="stat-val" id="est-accel">—</span></div>
        <div class="stat-row"><span class="stat-label">Specific Impulse</span><span class="stat-val" id="est-isp">—</span></div>
        <div class="stat-row"><span class="stat-label">Engine Mass</span><span class="stat-val" id="est-mass">—</span></div>
        <div class="stat-row"><span class="stat-label">Fuel Modifier</span><span class="stat-val" id="est-fuel">—</span></div>
      </div>

      <div class="create-row" style="display:block;border-top:1px solid #1e2e1e;padding-top:12px;margin-top:4px;">
        <div style="display:flex;gap:4px;align-items:center;margin-bottom:6px;">
          <input type="text" class="form-input" id="eng-company" placeholder="Company name…" style="flex:1">
          <button class="btn-small" id="btn-random-company">Random</button>
        </div>
        <div style="display:flex;gap:4px;align-items:center;">
          <input type="text" class="form-input" id="eng-name" placeholder="Engine designation…" style="flex:1">
          <button class="btn-create" id="btn-create-engine" style="border-radius:3px;">Create</button>
        </div>
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

      <div class="errors-pane" id="ship-validation"></div>

      <div class="create-row">
        <input type="text" class="form-input" id="ship-name" placeholder="Ship design name…">
        <button class="btn-create" id="btn-create-ship" disabled>Create Ship Design</button>
      </div>
    </div>
  </div>
</div>

<!-- Missile Design Tab -->
<div class="tab-panel" id="tab-missiles">
  <div class="split-left">
    <div class="list-header">Missile Designs</div>
    <div class="design-list" id="missile-list"></div>
  </div>
  <div class="split-right">
    <div class="form-section">
      <div class="form-section-title">New Missile Design</div>
      <div class="form-row">
        <span class="form-label">Missile Size</span>
        <select class="form-select" id="msl-size">
          <option value="1">1 HS (50 tons)</option>
          <option value="2">2 HS (100 tons)</option>
          <option value="3">3 HS (150 tons)</option>
          <option value="4" selected>4 HS (200 tons)</option>
          <option value="5">5 HS (250 tons)</option>
          <option value="6">6 HS (300 tons)</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Warhead</span>
        <select class="form-select" id="msl-warhead">
          <option value="1">Strength 1 (Anti-Missile)</option>
          <option value="4">Strength 4 (Light)</option>
          <option value="9" selected>Strength 9 (Standard)</option>
          <option value="16">Strength 16 (Heavy)</option>
          <option value="25">Strength 25 (Capital)</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Engine Power</span>
        <select class="form-select" id="msl-engine">
          <option value="5">5 EP (Slow, Long Range)</option>
          <option value="10" selected>10 EP (Standard)</option>
          <option value="20">20 EP (Fast)</option>
          <option value="40">40 EP (Sprint)</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Agility</span>
        <select class="form-select" id="msl-agility">
          <option value="10">10 (Minimal)</option>
          <option value="20" selected>20 (Standard)</option>
          <option value="32">32 (High)</option>
          <option value="48">48 (Maximum)</option>
        </select>
      </div>
      <div class="stats-panel" id="msl-stats">
        <div class="stats-panel-title">Estimated Performance</div>
        <div class="stat-row"><span class="stat-label">Speed</span><span class="stat-val" id="msl-speed-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Range</span><span class="stat-val" id="msl-range-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-val" id="msl-dmg-val">—</span></div>
      </div>
      <div class="create-row">
        <input type="text" class="form-input" id="msl-name" placeholder="Missile designation…">
        <button class="btn-create" id="btn-create-missile">Create Missile Design</button>
      </div>
    </div>
  </div>
</div>

<!-- Turret Design Tab -->
<div class="tab-panel" id="tab-turrets">
  <div class="split-left">
    <div class="list-header">Turret Designs</div>
    <div class="design-list" id="turret-list"></div>
  </div>
  <div class="split-right">
    <div class="form-section">
      <div class="form-section-title">New Turret Design</div>
      <div class="form-row">
        <span class="form-label">Weapon Type</span>
        <select class="form-select" id="trt-weapon">
          <option value="laser">Laser</option>
          <option value="railgun" selected>Railgun</option>
          <option value="particle-beam">Particle Beam</option>
          <option value="gauss">Gauss Cannon</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Caliber</span>
        <select class="form-select" id="trt-caliber">
          <option value="10">10cm (Point Defense)</option>
          <option value="15" selected>15cm (Standard)</option>
          <option value="20">20cm (Heavy)</option>
          <option value="25">25cm (Capital)</option>
          <option value="30">30cm (Spinal)</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Tracking Speed</span>
        <select class="form-select" id="trt-tracking">
          <option value="2000">2,000 km/s (Slow)</option>
          <option value="5000" selected>5,000 km/s (Standard)</option>
          <option value="10000">10,000 km/s (Fast)</option>
          <option value="20000">20,000 km/s (Rapid)</option>
        </select>
      </div>
      <div class="stats-panel" id="trt-stats">
        <div class="stats-panel-title">Estimated Performance</div>
        <div class="stat-row"><span class="stat-label">Damage</span><span class="stat-val" id="trt-dmg-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Range</span><span class="stat-val" id="trt-range-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Rate of Fire</span><span class="stat-val" id="trt-rof-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Size</span><span class="stat-val" id="trt-size-val">—</span></div>
      </div>
      <div class="create-row">
        <input type="text" class="form-input" id="trt-name" placeholder="Turret designation…">
        <button class="btn-create" id="btn-create-turret">Create Turret Design</button>
      </div>
    </div>
  </div>
</div>

<!-- Sensor Design Tab -->
<div class="tab-panel" id="tab-sensors">
  <div class="split-left">
    <div class="list-header">Sensor Designs</div>
    <div class="design-list" id="sensor-list"></div>
  </div>
  <div class="split-right">
    <div class="form-section">
      <div class="form-section-title">New Sensor Design</div>
      <div class="form-row">
        <span class="form-label">Sensor Type</span>
        <select class="form-select" id="sns-type">
          <option value="geological" selected>Geological Survey</option>
          <option value="gravitational">Gravitational Survey</option>
          <option value="active">Active Sensor</option>
          <option value="passive-thermal">Passive Thermal</option>
          <option value="passive-em">Passive EM</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Resolution</span>
        <select class="form-select" id="sns-resolution">
          <option value="1">1 (Maximum Range)</option>
          <option value="5">5 (Long Range)</option>
          <option value="10" selected>10 (Standard)</option>
          <option value="20">20 (High Detail)</option>
          <option value="50">50 (Ultra Detail)</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label">Sensor Size</span>
        <select class="form-select" id="sns-size">
          <option value="1">1 HS (50 tons)</option>
          <option value="3" selected>3 HS (150 tons)</option>
          <option value="5">5 HS (250 tons)</option>
          <option value="10">10 HS (500 tons)</option>
          <option value="20">20 HS (1,000 tons)</option>
        </select>
      </div>
      <div class="stats-panel" id="sns-stats">
        <div class="stats-panel-title">Estimated Performance</div>
        <div class="stat-row"><span class="stat-label">Range</span><span class="stat-val" id="sns-range-val">—</span></div>
        <div class="stat-row"><span class="stat-label">Strength</span><span class="stat-val" id="sns-str-val">—</span></div>
      </div>
      <div class="create-row">
        <input type="text" class="form-input" id="sns-name" placeholder="Sensor designation…">
        <button class="btn-create" id="btn-create-sensor">Create Sensor Design</button>
      </div>
    </div>
  </div>
</div>

<script>
// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let snap = { engineDesigns: [], shipDesigns: [], unlockedTiers: [], unlockedComponents: [], colonies: [], ships: [], missileDesigns: [], turretDesigns: [], sensorDesigns: [] };
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

const COMPANY_NAMES = [
  'Apex Propulsion', 'Stellaris Drive Systems', 'Nova Dynamics', 'Kepler Engines',
  'Horizon Thrust Co.', 'Pulsar Engineering', 'Meridian Motors', 'Vanguard Propulsion',
  'Eclipse Drive Works', 'Zenith Systems', 'Atlas Propulsion', 'Frontier Dynamics',
  'Orion Drive Labs', 'Quantum Thrust Inc.', 'Helios Engineering',
];

function populateEngineDropdowns() {
  const tierSel = document.getElementById('eng-tier');
  const powerSel = document.getElementById('eng-power');
  const sizeSel = document.getElementById('eng-size');
  const tier = snap.unlockedTiers.find(t => t.id === tierSel.value);
  if (!tier) return;

  powerSel.innerHTML = '';
  tier.powerOptions.forEach(opt => {
    const o = document.createElement('option');
    o.value = String(opt.powerPct);
    o.textContent = opt.label;
    if (opt.powerPct === 100) o.selected = true;
    powerSel.appendChild(o);
  });

  sizeSel.innerHTML = '';
  tier.sizeOptions.forEach(opt => {
    const o = document.createElement('option');
    o.value = String(opt.sizeHS);
    o.textContent = opt.label;
    if (opt.sizeHS === 10) o.selected = true;
    sizeSel.appendChild(o);
  });

  updateEnginePreview();
}

function updateEngineTierDropdown() {
  const sel = document.getElementById('eng-tier');
  sel.innerHTML = snap.unlockedTiers.map(t =>
    \`<option value="\${t.id}">\${t.name}</option>\`
  ).join('');
  populateEngineDropdowns();
}

function updateEnginePreview() {
  const tierSel = document.getElementById('eng-tier');
  const powerSel = document.getElementById('eng-power');
  const sizeSel = document.getElementById('eng-size');
  const tier = snap.unlockedTiers.find(t => t.id === tierSel.value);
  if (!tier || !powerSel.value || !sizeSel.value) {
    ['est-accel','est-isp','est-mass','est-fuel'].forEach(id => { document.getElementById(id).textContent = '—'; });
    return;
  }
  const powerPct = Number(powerSel.value);
  const sizeHS = Number(sizeSel.value);
  const accelG = tier.baseAccelG * (powerPct / 100);
  const ispS = tier.baseIspS;
  const massKg = sizeHS * tier.baseMassPerHS;
  const fuelMod = Math.max(0.01, Math.pow(powerPct / 100, 2.5) * (1 - sizeHS / 100));
  document.getElementById('est-accel').textContent = accelG < 1 ? fmt(accelG, 3) + ' G' : fmt(accelG, 1) + ' G';
  document.getElementById('est-isp').textContent = ispS.toLocaleString() + ' s';
  document.getElementById('est-mass').textContent = fmtMass(massKg);
  document.getElementById('est-fuel').textContent = fuelMod.toFixed(3);
}

document.getElementById('eng-tier').addEventListener('change', populateEngineDropdowns);
document.getElementById('eng-power').addEventListener('change', updateEnginePreview);
document.getElementById('eng-size').addEventListener('change', updateEnginePreview);

document.getElementById('btn-random-company').addEventListener('click', () => {
  const name = COMPANY_NAMES[Math.floor(Math.random() * COMPANY_NAMES.length)];
  document.getElementById('eng-company').value = name;
});

document.getElementById('btn-create-engine').addEventListener('click', () => {
  const tierId = document.getElementById('eng-tier').value;
  const powerPct = Number(document.getElementById('eng-power').value);
  const sizeHS = Number(document.getElementById('eng-size').value);
  const company = document.getElementById('eng-company').value.trim();
  const designation = document.getElementById('eng-name').value.trim();
  const name = company && designation ? company + ' ' + designation : company || designation || 'Unnamed Engine';
  if (!tierId) return;
  window.opener?.postMessage({ type: 'design-action', action: 'create-engine', tierId, powerPct, sizeHS, name }, '*');
  document.getElementById('eng-company').value = '';
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

const CATEGORY_LABELS = {
  'bridge': 'Bridge',
  'crew-quarters': 'Crew Quarters',
  'fuel-tank': 'Fuel Tanks',
  'cargo-bay': 'Cargo Bays',
  'maintenance-bay': 'Maintenance',
  'sensor-suite': 'Sensors',
  'armor': 'Armor',
};

function buildComponentOptionsHTML() {
  const byCategory = {};
  for (const c of snap.unlockedComponents) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }
  let html = '<option value="">— select —</option>';
  for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
    const comps = byCategory[cat];
    if (!comps || comps.length === 0) continue;
    html += \`<optgroup label="\${label}">\`;
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
    validation.className = 'errors-pane';
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
    validation.innerHTML = errors.map(e => \`<div class="error-item">\${e}</div>\`).join('');
    validation.className = 'errors-pane has-errors';
    createBtn.disabled = true;
  } else {
    validation.innerHTML = '<div class="valid-item">Design is valid</div>';
    validation.className = 'errors-pane has-errors';
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
// Missile Tab
// ---------------------------------------------------------------------------

function calcMissileStats() {
  const sizeHS = Number(document.getElementById('msl-size').value);
  const warhead = Number(document.getElementById('msl-warhead').value);
  const enginePower = Number(document.getElementById('msl-engine').value);
  const speed = enginePower * 1000;
  const range = (sizeHS - warhead / 10) * enginePower * 1000000;
  const damage = warhead;
  return { sizeHS, warhead, enginePower, speed, range, damage };
}

function updateMissileStats() {
  const { speed, range, damage } = calcMissileStats();
  document.getElementById('msl-speed-val').textContent = speed.toLocaleString() + ' km/s';
  document.getElementById('msl-range-val').textContent = (range / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' Mkm';
  document.getElementById('msl-dmg-val').textContent = String(damage);
}

function renderMissileList() {
  const el = document.getElementById('missile-list');
  if (snap.missileDesigns.length === 0) {
    el.innerHTML = '<div class="empty-note">No missile designs yet.</div>';
    return;
  }
  let html = '';
  for (const md of snap.missileDesigns) {
    html += \`<div class="design-item" data-id="\${md.id}">
      <button class="design-item-del" data-id="\${md.id}">×</button>
      <div class="design-item-name">\${md.name}</div>
      <div class="design-item-meta">\${md.sizeHS} HS · DMG \${md.damage} · \${md.speed.toLocaleString()} km/s</div>
    </div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.design-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.opener?.postMessage({ type: 'design-action', action: 'delete-missile', missileId: btn.dataset.id }, '*');
    });
  });
}

document.getElementById('msl-size').addEventListener('change', updateMissileStats);
document.getElementById('msl-warhead').addEventListener('change', updateMissileStats);
document.getElementById('msl-engine').addEventListener('change', updateMissileStats);
document.getElementById('msl-agility').addEventListener('change', updateMissileStats);

document.getElementById('btn-create-missile').addEventListener('click', () => {
  const name = document.getElementById('msl-name').value.trim();
  if (!name) { document.getElementById('msl-name').focus(); return; }
  const agility = Number(document.getElementById('msl-agility').value);
  const { sizeHS, warhead, enginePower, speed, range, damage } = calcMissileStats();
  window.opener?.postMessage({ type: 'design-action', action: 'create-missile', name, sizeHS, warheadStrength: warhead, enginePower, agility, speed, range, damage }, '*');
  document.getElementById('msl-name').value = '';
});

// ---------------------------------------------------------------------------
// Turret Tab
// ---------------------------------------------------------------------------

const WEAPON_MULT = { laser: 1.0, railgun: 1.2, 'particle-beam': 0.8, gauss: 0.5 };
const RANGE_MULT  = { laser: 2.0, railgun: 1.0, 'particle-beam': 0.5, gauss: 0.3 };
const ROF_MULT    = { laser: 1.0, railgun: 1.0, 'particle-beam': 1.0, gauss: 3.0 };

function calcTurretStats() {
  const weaponType = document.getElementById('trt-weapon').value;
  const caliber = Number(document.getElementById('trt-caliber').value);
  const trackingSpeed = Number(document.getElementById('trt-tracking').value);
  const damage = Math.round(caliber * (WEAPON_MULT[weaponType] || 1.0));
  const range = Math.round(caliber * 10000 * (RANGE_MULT[weaponType] || 1.0));
  const rateOfFire = Math.round((30 / caliber) * (ROF_MULT[weaponType] || 1.0) * 10) / 10;
  const sizeHS = Math.ceil(caliber / 5);
  return { weaponType, caliber, trackingSpeed, damage, range, rateOfFire, sizeHS };
}

function updateTurretStats() {
  const { damage, range, rateOfFire, sizeHS } = calcTurretStats();
  document.getElementById('trt-dmg-val').textContent = String(damage);
  document.getElementById('trt-range-val').textContent = (range / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' kkm';
  document.getElementById('trt-rof-val').textContent = rateOfFire.toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' rds/min';
  document.getElementById('trt-size-val').textContent = sizeHS + ' HS';
}

function renderTurretList() {
  const el = document.getElementById('turret-list');
  if (snap.turretDesigns.length === 0) {
    el.innerHTML = '<div class="empty-note">No turret designs yet.</div>';
    return;
  }
  let html = '';
  for (const td of snap.turretDesigns) {
    html += \`<div class="design-item" data-id="\${td.id}">
      <button class="design-item-del" data-id="\${td.id}">×</button>
      <div class="design-item-name">\${td.name}</div>
      <div class="design-item-meta">\${td.weaponType} · DMG \${td.damage} · \${(td.range / 1000).toLocaleString()} kkm</div>
    </div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.design-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.opener?.postMessage({ type: 'design-action', action: 'delete-turret', turretId: btn.dataset.id }, '*');
    });
  });
}

document.getElementById('trt-weapon').addEventListener('change', updateTurretStats);
document.getElementById('trt-caliber').addEventListener('change', updateTurretStats);
document.getElementById('trt-tracking').addEventListener('change', updateTurretStats);

document.getElementById('btn-create-turret').addEventListener('click', () => {
  const name = document.getElementById('trt-name').value.trim();
  if (!name) { document.getElementById('trt-name').focus(); return; }
  const { weaponType, caliber, trackingSpeed, damage, range, rateOfFire, sizeHS } = calcTurretStats();
  window.opener?.postMessage({ type: 'design-action', action: 'create-turret', name, weaponType, caliber, trackingSpeed, damage, range, rateOfFire, sizeHS }, '*');
  document.getElementById('trt-name').value = '';
});

// ---------------------------------------------------------------------------
// Sensor Tab
// ---------------------------------------------------------------------------

function calcSensorStats() {
  const sensorType = document.getElementById('sns-type').value;
  const resolution = Number(document.getElementById('sns-resolution').value);
  const sizeHS = Number(document.getElementById('sns-size').value);
  const strength = sizeHS * resolution;
  const range = Math.round(sizeHS * Math.sqrt(resolution) * 10000);
  return { sensorType, resolution, sizeHS, strength, range };
}

function updateSensorStats() {
  const { range, strength } = calcSensorStats();
  document.getElementById('sns-range-val').textContent = (range / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + ' kkm';
  document.getElementById('sns-str-val').textContent = String(strength);
}

function renderSensorList() {
  const el = document.getElementById('sensor-list');
  if (snap.sensorDesigns.length === 0) {
    el.innerHTML = '<div class="empty-note">No sensor designs yet.</div>';
    return;
  }
  let html = '';
  for (const sd of snap.sensorDesigns) {
    html += \`<div class="design-item" data-id="\${sd.id}">
      <button class="design-item-del" data-id="\${sd.id}">×</button>
      <div class="design-item-name">\${sd.name}</div>
      <div class="design-item-meta">\${sd.sensorType} · \${sd.sizeHS} HS · \${(sd.range / 1000).toLocaleString()} kkm</div>
    </div>\`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.design-item-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.opener?.postMessage({ type: 'design-action', action: 'delete-sensor', sensorId: btn.dataset.id }, '*');
    });
  });
}

document.getElementById('sns-type').addEventListener('change', updateSensorStats);
document.getElementById('sns-resolution').addEventListener('change', updateSensorStats);
document.getElementById('sns-size').addEventListener('change', updateSensorStats);

document.getElementById('btn-create-sensor').addEventListener('click', () => {
  const name = document.getElementById('sns-name').value.trim();
  if (!name) { document.getElementById('sns-name').focus(); return; }
  const { sensorType, resolution, sizeHS, strength, range } = calcSensorStats();
  window.opener?.postMessage({ type: 'design-action', action: 'create-sensor', name, sensorType, resolution, sizeHS, strength, range }, '*');
  document.getElementById('sns-name').value = '';
});

// ---------------------------------------------------------------------------
// Full render
// ---------------------------------------------------------------------------

function render() {
  renderEngineList();
  updateEngineTierDropdown();
  renderShipList();
  updateShipEngineDropdown();
  renderMissileList();
  updateMissileStats();
  renderTurretList();
  updateTurretStats();
  renderSensorList();
  updateSensorStats();
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
