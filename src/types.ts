import type * as THREE from 'three';

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

// --- Body data types (input data from sol-data / system-generator) ---

export interface MoonData {
    name: string;
    distance: number;
    e: number;
    period: number;
    radius: number;
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
    type: 'Star' | 'Planet' | 'Dwarf Planet' | 'Detached Object' | 'Moon';
    distance: number;
    e: number;
    period: number;
    radius: number;
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
}

export interface CometEntryData {
    name: string;
    type: 'Comet';
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
}

export interface ShipEntryData {
    name: string;
    type: 'Ship';
    distance: number;
    period: number;
    radius: number;
    color: string;
    moons: MoonData[];
}

export type PlanetCategory = 'rocky' | 'subNeptune' | 'iceGiant' | 'gasGiant';
export type ShipState = 'orbiting' | 'departing' | 'transferring';

// --- Trail state ---

export interface TrailState {
    line: THREE.Line;
    positions: Float32Array;
    colors: Float32Array;
    index: number;
    maxPoints: number;
    count: number;
    baseColor: THREE.Color;
    sampleAccum: number;
    tmpP: Float32Array;
    tmpC: Float32Array;
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
    planetRing: THREE.Mesh | null;
    cloudMesh: THREE.Mesh | null;
    baseSize: number;
    realisticSize: number;
}

export interface CometEntry extends BaseEntry {
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
    p0x: number; p0z: number; t0x: number; t0z: number;
    p1x: number; p1z: number; t1x: number; t1z: number;
    pendingTransfer: PendingTransfer | null;
    transferRecalcCounter: number;
    // Visual
    transferPath: THREE.Line | null;
    tailPositions: Float32Array;
    tailIndex: number;
    tailCount: number;
    tailLine: THREE.Line;
    // Frame counters
    lastAngle?: number;
    transferPathFrameCount?: number;
    departFrameCount?: number;
    blendTarget?: { entryAngle: number } | null;
    baseSize: number;
    realisticSize: number;
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

export interface AsteroidInfo {
    designation: string;
    au: number;
    period: number;
    diameter: number;
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

// --- App state ---

export interface AppState {
    bodyMeshes: BodyEntry[];
    asteroidBelts: AsteroidBeltEntry[];
    selectedBody: BodyEntry | null;
    flyTo: FlyToState | null;
    simTime: number;
    timeSpeed: number;
    currentSystemKey: string;
    discoveredSystems: Map<string, DiscoveredSystem>;
    masterRng: (() => number) | null;
    randomClickCount: number;
    BODIES: BodyData[] | null;
    COMETS: CometData[] | null;
    ASTEROID_BELTS: AsteroidBeltData[] | null;
    showLabels: boolean;
    showOrbits: boolean;
    showTrails: boolean;
    debugStepFrames: number;
    debugStepSpeed: number;
}

// --- System data ---

export interface SystemData {
    name: string;
    bodies: BodyData[];
    comets: CometData[];
    asteroidBelts: AsteroidBeltData[];
}

export interface DiscoveredSystem {
    name: string;
    seed: number | null;
    systemData: SystemData;
}

// --- Saved state ---

export interface SavedStateData {
    version: number;
    simTime: number;
    currentSystemKey: string;
    randomClickCount: number;
    discoveredSystems: Array<{ key: string; name: string; seed: number }>;
    ship: { fuelKg: number; engineId: string } | null;
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
