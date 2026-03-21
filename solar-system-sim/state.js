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

export function screenRadius(worldRadius, distance, fovDeg, screenHeight) {
    if (distance <= 0) return screenHeight;
    const halfTan = Math.tan((fovDeg * Math.PI / 180) / 2);
    return (worldRadius / distance) / halfTan * (screenHeight / 2);
}

export function keplerRadius(a, e, theta) {
    return a * (1 - e * e) / (1 + e * Math.cos(theta));
}

export function orbitSpeed(period) {
    return period > 0 ? (Math.PI * 2) / (period * 60) : 0;
}

export function inclinedPosition(x, z, cosN, sinN, cosI, sinI) {
    const xn = x * cosN + z * sinN;
    const zn = -x * sinN + z * cosN;
    const yn = zn * sinI;
    const znTilt = zn * cosI;
    return {
        x: xn * cosN - znTilt * sinN,
        y: yn,
        z: xn * sinN + znTilt * cosN
    };
}

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export function simTimeToDay(simTime) {
    return Math.floor(simTime * 365.25);
}

export function speedLabel(timeSpeed) {
    if (timeSpeed === 0) return 'Paused';
    if (timeSpeed === 0.25) return '5-Second Increment';
    if (timeSpeed === 1) return '1-Day Increment';
    return '30-Day Increment';
}

export function lodLevel(screenRadius) {
    return screenRadius > 50 ? 2 : screenRadius > 15 ? 1 : 0;
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
    showLabels: true,
    showOrbits: true,
    showTrails: false,
};
