import type * as THREE from "three";
import type { GameClock } from "./core/game-clock";

// --- Scratch object return types ---

export interface Vector2Like {
	x: number;
	z: number;
}

export interface Vector3Like {
	x: number;
	y: number;
	z: number;
}

// --- Resource types ---

export type ResourceCategory = "metal" | "volatile" | "industrial" | "radioactive" | "umbral";

export interface ResourceDeposit {
	resourceId: string;
	quantity: number;
	accessibility: number;
	mined: number;
	minSurveyLevel: number;
}

export interface SystemResourceBudget {
	richness: number;
}

// --- Survey / resource state ---

export interface SurveyState {
	surveyLevel: number;
	deposits: ResourceDeposit[];
}

export interface Surveyable {
	survey: SurveyState;
}

// --- Body data types (input data from sol-data / system-generator) ---

export interface MoonData {
	name: string;
	distance: number;
	e: number;
	period: number;
	radius: number;
	mass: number;
	color: string;
}

export interface RingData {
	inner: number;
	outer: number;
	color?: string;
	opacity?: number;
	tilt?: number;
}

export interface BodyData {
	name: string;
	type: "Star" | "Planet" | "Dwarf Planet" | "Detached Object" | "Moon";
	distance: number;
	e: number;
	period: number;
	radius: number;
	mass: number;
	color: string;
	emissive?: boolean;
	moons: MoonData[];
	rings?: RingData;
	// Internal fields from system-generator
	_radiusEarths?: number;
	_category?: PlanetCategory;
	_isDwarf?: boolean;
	_isDetached?: boolean;
}

export interface CometData {
	name: string;
	a: number;
	e: number;
	period: number;
	inc: number;
	node: number;
	peri: number;
	color: string;
	mass: number;
}

export interface CometEntryData {
	name: string;
	type: "Comet";
	distance: number;
	period: number;
	radius: number;
	color: string;
	moons: MoonData[];
	a: number;
	e: number;
	inc: number;
	incRad: number;
	nodeRad: number;
	periRad: number;
	mass: number;
}

export interface ShipEntryData {
	name: string;
	type: "Ship";
	distance: number;
	period: number;
	radius: number;
	color: string;
	moons: MoonData[];
}

export type PlanetCategory = "rocky" | "subNeptune" | "iceGiant" | "gasGiant";
export type ShipState = "orbiting" | "transferring";

// --- Command priority tree ---

export type CommandType =
	| "survey-nearest"
	| "transfer-to"
	| "refuel"
	| "shore-leave"
	| "overhaul"
	| "return-to-base"
	| "idle";

export type CommandCondition =
	| { type: "always" }
	| { type: "fuel-below"; threshold: number }
	| { type: "morale-below"; threshold: number }
	| { type: "hull-below"; threshold: number }
	| { type: "supplies-below"; threshold: number };

export interface CommandEntry {
	id: string;
	command: CommandType;
	condition: CommandCondition;
	target?: string;
	enabled: boolean;
	origin: "class" | "fleet" | "ship";
}

export interface CommandTree {
	entries: CommandEntry[];
}

export interface CommandResult {
	action: "transfer" | "survey" | "refuel" | "overhaul" | "shore-leave" | "idle";
	target?: string;
}

// --- Ship intent types ---

export type ShipIntent =
	| { type: "surveying"; target: string; shipName: string }
	| { type: "transferring"; destination: string; shipName: string }
	| { type: "refueling"; location: string; shipName: string }
	| { type: "overhauling"; location: string; shipName: string }
	| { type: "shore-leave"; location: string; shipName: string }
	| { type: "idle"; location: string; shipName: string };

// --- Ship sub-interfaces ---

export interface ShipCrew {
	count: number;
	morale: number;
	lastShoreLeave: number;
	deploymentLimit: number;
}

export interface ShipMaintenance {
	age: number;
	supplies: number;
	maxSupplies: number;
	hullIntegrity: number;
}

export interface ShipAction {
	type: CommandType | null;
	commandId: string | null;
	target?: string;
	startTime: number;
	duration: number;
	progress: number;
}

// --- Notification types ---

export type NotificationType =
	| "survey-complete"
	| "low-fuel"
	| "low-morale"
	| "maintenance-needed"
	| "mission-complete"
	| "malfunction"
	| "ship-destroyed"
	| "transfer-complete"
	| "action-complete";

export interface GameNotification {
	id: number;
	type: NotificationType;
	message: string;
	simTime: number;
	bodyName?: string;
	read: boolean;
}

// --- Trail state ---

export interface TrailState {
	line: THREE.Line;
	positions: Float32Array;
	colors: Float32Array;
	indices: Uint16Array;
	maxPoints: number;
	count: number;
	head: number;
	baseColor: THREE.Color;
	sampleAccum: number;
}

// --- Pending transfer ---

export interface PendingTransfer {
	gameDays: number;
	targetName: string;
	optimalLocalAngle: number;
}

// --- Body entry discriminated union ---

interface BaseEntry {
	mesh: THREE.Mesh;
	selRing: THREE.Mesh;
	orbitLine: THREE.Line | null;
	orbitRadius: number;
	labelDiv: HTMLDivElement;
	labelX?: number;
	labelY?: number;
	labelDisplay?: string;
	labelUpdateFrame?: number;
	trail: TrailState;
	angle: number;
	speed: number;
	parentMesh: THREE.Mesh | null;
	moons: BodyEntry[];
	isMoon: boolean;
	screenSize: number;
	geomLevels: THREE.SphereGeometry[] | null;
	lodLevel: number;
}

export interface PlanetEntry extends BaseEntry {
	data: BodyData;
	isShip?: false;
	isComet?: false;
	survey?: SurveyState;
	planetRing: THREE.Mesh | null;
	cloudMesh: THREE.Mesh | null;
	baseSize: number;
	realisticSize: number;
}

export interface CometEntry extends BaseEntry, Surveyable {
	data: CometEntryData;
	isShip?: false;
	isComet: true;
}

export interface ShipEntry extends BaseEntry {
	data: ShipEntryData;
	isShip: true;
	isComet?: false;
	// Ship physics
	engineId: string;
	dryMassKg: number;
	fuelKg: number;
	fuelCapacityKg: number;
	// Ship state machine
	shipState: ShipState;
	hostPlanetName: string;
	orbitA: number;
	// Transfer fields (Hermite spline)
	transferTarget: string | null;
	transferStartTime: number;
	transferTimeDays: number;
	// Original transfer timing (not reset by re-spline, used for UI display)
	transferDisplayStart: number;
	transferDisplayDays: number;
	transferFuelTotal: number;
	p0x: number;
	p0z: number;
	t0x: number;
	t0z: number;
	p1x: number;
	p1z: number;
	t1x: number;
	t1z: number;
	pendingTransfer: PendingTransfer | null;
	// Visual
	tailPositions: Float32Array;
	tailIndex: number;
	tailCount: number;
	tailLine: THREE.Line | null;
	// Frame counters
	lastAngle?: number;
	departFrameCount?: number;
	baseSize: number;
	realisticSize: number;
	// Command & autonomy
	commandTree: CommandTree;
	immediateCommand: CommandEntry | null;
	crew: ShipCrew;
	maintenance: ShipMaintenance;
	action: ShipAction;
	// Station-keeping: track a non-planet body (comet, moon) instead of orbiting host
	stationTarget: string | null;
}

export type BodyEntry = PlanetEntry | CometEntry | ShipEntry;

// --- Type guards ---

export function isShipEntry(entry: BodyEntry): entry is ShipEntry {
	return (entry as ShipEntry).isShip === true;
}

export function isCometEntry(entry: BodyEntry): entry is CometEntry {
	return (entry as CometEntry).isComet === true;
}

export function isPlanetEntry(entry: BodyEntry): entry is PlanetEntry {
	return !isShipEntry(entry) && !isCometEntry(entry);
}

export function isSurveyable(obj: unknown): obj is Surveyable {
	return obj != null && typeof (obj as Surveyable).survey === "object";
}

// --- Engine type ---

export interface EngineType {
	id: string;
	name: string;
	accelG: number;
	ispS: number;
	dryMassKg: number;
}

// --- Transfer check result ---

export interface TransferResult {
	feasible: boolean;
	fuelUsedKg?: number;
	deltaVRequired?: number;
	deltaVAvailable?: number;
	transferDays?: number;
}

// --- Ship state for transfer check ---

export interface ShipPhysicsState {
	fuelKg: number;
	dryMassKg: number;
	engineId: string;
}

// --- Asteroid belt ---

export interface AsteroidBeltData {
	name: string;
	minAU: number;
	maxAU: number;
	count: number;
	color: string;
	size: number;
	maxInc: number;
}

export interface AsteroidInfo extends Surveyable {
	designation: string;
	au: number;
	period: number;
	diameter: number;
	mass: number;
	beltIndex?: number;
}

export interface AsteroidBeltEntry {
	belt: AsteroidBeltData;
	points: THREE.Points;
	positions: Float32Array;
	angles: Float32Array;
	radii: Float32Array;
	speeds: Float32Array;
	inclinations: Float32Array;
	nodeAngles: Float32Array;
	cosInc: Float32Array;
	sinInc: Float32Array;
	cosNode: Float32Array;
	sinNode: Float32Array;
	yOffsets: Float32Array;
	count: number;
	asteroids: AsteroidInfo[];
	colors: Float32Array;
}

// --- FlyTo state ---

export interface FlyToState {
	entry: BodyEntry;
	camOffset: THREE.Vector3;
	zoomDist: number;
	startCam: THREE.Vector3;
	startTarget: THREE.Vector3;
	startTime: number;
	duration: number;
}

// --- Category visibility ---

export interface CategoryVisibility {
	labels: boolean;
	orbits: boolean;
	trails: boolean;
}

export type CategoryKey =
	| "Star"
	| "Planet"
	| "Dwarf Planet"
	| "Detached Object"
	| "Moon"
	| "Comet"
	| "Asteroid"
	| "Ship";

// --- App state ---

export interface NotificationPauseConfig {
	"survey-complete": boolean;
	"low-fuel": boolean;
	"low-morale": boolean;
	"maintenance-needed": boolean;
	"mission-complete": boolean;
	malfunction: boolean;
	"ship-destroyed": boolean;
	"transfer-complete": boolean;
	"action-complete": boolean;
}

export interface AppState {
	bodyMeshes: BodyEntry[];
	asteroidBelts: AsteroidBeltEntry[];
	selectedBody: BodyEntry | null;
	flyTo: FlyToState | null;
	simTime: GameClock;
	timeSpeed: number;
	currentSystemKey: string;
	discoveredSystems: Map<string, DiscoveredSystem>;
	masterRng: (() => number) | null;
	randomClickCount: number;
	BODIES: BodyData[] | null;
	COMETS: CometData[] | null;
	ASTEROID_BELTS: AsteroidBeltData[] | null;
	categoryVisibility: Record<CategoryKey, CategoryVisibility>;
	debugStepFrames: number;
	debugStepSpeed: number;
	renderNeeded: boolean;
	// Notifications
	notifications: GameNotification[];
	notificationPauseConfig: NotificationPauseConfig;
	firstSurveyCompleted: boolean;
	// Game hardness multipliers (1.0 = 100% = default, higher = slower/harder)
	surveyMultiplier: number;
	repairMultiplier: number;
	refuelMultiplier: number;
	moraleMultiplier: number;
	supplyMultiplier: number;
	// Depot quality (1.0 = 100% = standard facilities, eventually per-location)
	depotQuality: number;
	shipIntents: Map<string, ShipIntent>;
}

// --- System data ---

export interface SystemData {
	name: string;
	bodies: BodyData[];
	comets: CometData[];
	asteroidBelts: AsteroidBeltData[];
	resourceBudget?: SystemResourceBudget;
}

export interface DiscoveredSystem {
	name: string;
	seed: number | null;
	systemData: SystemData;
}

// --- Saved state ---

export interface SavedShipData {
	name: string;
	hostPlanetName: string;
	fuelKg: number;
	engineId: string;
	crew: ShipCrew;
	maintenance: ShipMaintenance;
	commandTree: CommandTree;
	// Transfer state (optional — only present if ship was transferring)
	shipState?: ShipState;
	transferTarget?: string;
	transferStartTime?: number;
	transferTimeDays?: number;
	transferFuelTotal?: number;
	// Hermite spline knots
	p0x?: number;
	p0z?: number;
	t0x?: number;
	t0z?: number;
	p1x?: number;
	p1z?: number;
	t1x?: number;
	t1z?: number;
}

export interface SavedStateData {
	version: number;
	simTime: number;
	currentSystemKey: string;
	randomClickCount: number;
	discoveredSystems: Array<{ key: string; name: string; seed: number }>;
	ships: SavedShipData[];
}

// --- Lambert solver result ---

export interface LambertResult {
	v1x: number;
	v1z: number;
	v2x: number;
	v2z: number;
}

// --- Hohmann transfer result ---

export interface HohmannResult {
	a: number;
	e: number;
	periodYears: number;
	transferTimeDays: number;
}

// --- Hohmann delta-v result ---

export interface HohmannDeltaVResult {
	dvDepart: number;
	dvArrive: number;
	dvTotal: number;
}

// --- Spectral type ---

export interface SpectralType {
	type: string;
	weight: number;
	massMin: number;
	massMax: number;
	radMin: number;
	radMax: number;
	tempMin: number;
	tempMax: number;
	color: string;
	lumMin: number;
	lumMax: number;
}

// --- Weighted entry ---

export interface WeightedEntry<T = unknown> {
	weight: number;
	[key: string]: T | number;
}

// --- RNG type ---

export type RngFn = () => number;
