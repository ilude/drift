export const DIST_SCALE = 40;
export const BODY_MIN_SIZE = 0.3;
export const BODY_MAX_SIZE = 2.0;
export const MOON_DIST_SCALE = 25;
export const MOON_LOD_ZOOM = 1.1;
export const MAX_CLICK_DIST = 50;

export function scaleDist(au) {
    return Math.sqrt(au) * DIST_SCALE;
}

export function bodySize(radius, isStar) {
    if (isStar) return BODY_MAX_SIZE;
    const s = 0.2 + Math.log10(radius / 1000 + 1) * 0.35;
    return Math.max(BODY_MIN_SIZE, Math.min(1.2, s));
}

export const state = {
    bodyMeshes: [],
    asteroidBelts: [],
    selectedBody: null,
    flyTo: null,
    simTime: 0,
    timeSpeed: 1,
    currentSystemKey: 'sol',
    discoveredSystems: new Map(),
    BODIES: null,
    COMETS: null,
    ASTEROID_BELTS: null,
};
