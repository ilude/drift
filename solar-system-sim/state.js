export const MAX_CLICK_DIST = 50;

// Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow)
export const SIM_EPOCH = new Date(2038, 0, 20);

export function simTimeToDate(simTime) {
    const ms = simTime * 86400000;
    return new Date(SIM_EPOCH.getTime() + ms);
}

export function simTimeToDay(simTime) {
    return Math.floor(simTime);
}

export function truncateDate(date, speed) {
    if (speed >= 30) { date.setDate(1); date.setHours(0, 0, 0, 0); }
    else if (speed >= 8 / 24) { date.setHours(0, 0, 0, 0); }
    else if (speed >= 1 / 24) { date.setMinutes(0, 0, 0); }
    else if (speed >= 2 / 1440) { date.setSeconds(0, 0); }
    return date;
}

export function formatDateTime(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

export function speedLabel(timeSpeed) {
    if (timeSpeed === 0) return 'Paused';
    if (timeSpeed < 1) return `${Math.round(timeSpeed * 24)} hrs / sec`;
    if (timeSpeed < 30) return `${timeSpeed} day${timeSpeed === 1 ? '' : 's'} / sec`;
    return `${Math.round(timeSpeed / 30)} month${timeSpeed < 60 ? '' : 's'} / sec`;
}

export const MASTER_SEED = 42;

export const state = {
    bodyMeshes: [],
    asteroidBelts: [],
    selectedBody: null,
    flyTo: null,
    simTime: 0,
    timeSpeed: 1,
    currentSystemKey: 'sol',
    discoveredSystems: new Map(),
    masterRng: null,
    BODIES: null,
    COMETS: null,
    ASTEROID_BELTS: null,
    showLabels: true,
    showOrbits: true,
    showTrails: false,
};
