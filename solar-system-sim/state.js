export const MAX_CLICK_DIST = 50;

// Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow)
export const SIM_EPOCH = new Date(2038, 0, 20);

export function simTimeToDate(simTime) {
    const d = new Date(SIM_EPOCH);
    d.setDate(d.getDate() + Math.floor(simTime));
    return d;
}

export function simTimeToDay(simTime) {
    return Math.floor(simTime);
}

export function speedLabel(timeSpeed) {
    if (timeSpeed === 0) return 'Paused';
    if (timeSpeed < 1) return `${Math.round(timeSpeed * 24)} hrs / sec`;
    if (timeSpeed < 30) return `${timeSpeed} day${timeSpeed === 1 ? '' : 's'} / sec`;
    return `${Math.round(timeSpeed / 30)} month${timeSpeed < 60 ? '' : 's'} / sec`;
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
