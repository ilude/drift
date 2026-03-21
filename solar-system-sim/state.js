export const MAX_CLICK_DIST = 50;

export function simTimeToDay(simTime) {
    return Math.floor(simTime * 365.25);
}

export function speedLabel(timeSpeed) {
    if (timeSpeed === 0) return 'Paused';
    if (timeSpeed === 0.25) return '5-Second Increment';
    if (timeSpeed === 1) return '1-Day Increment';
    return '30-Day Increment';
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
