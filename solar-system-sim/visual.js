export const BODY_MIN_SIZE = 0.3;
export const BODY_MAX_SIZE = 2.0;
export const MOON_LOD_ZOOM = 1.8;

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

export function lodLevel(screenRadius) {
    return screenRadius > 50 ? 2 : screenRadius > 15 ? 1 : 0;
}

export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

export const MOON_REALISTIC_SCALE = 4;
export const MOON_ZOOM_MAX = 8;

export function moonOrbitScale(zoomFactor) {
    if (zoomFactor <= MOON_LOD_ZOOM) return 1;
    const t = Math.min((zoomFactor - MOON_LOD_ZOOM) / (MOON_ZOOM_MAX - MOON_LOD_ZOOM), 1);
    return 1 + (MOON_REALISTIC_SCALE - 1) * t;
}

export const BODY_SCALE_ZOOM_MIN = 2.0;
export const BODY_SCALE_ZOOM_MAX = 10.0;

export function realisticSize(radiusKm) {
    const cbrtR = Math.cbrt(radiusKm);
    const t = Math.max(0, Math.min(1, (cbrtR - 7) / (90 - 7)));
    return BODY_MIN_SIZE + t * (BODY_MAX_SIZE - BODY_MIN_SIZE);
}

export function bodyScaleFactor(zoomFactor) {
    if (zoomFactor <= BODY_SCALE_ZOOM_MIN) return 0;
    return Math.min((zoomFactor - BODY_SCALE_ZOOM_MIN) / (BODY_SCALE_ZOOM_MAX - BODY_SCALE_ZOOM_MIN), 1);
}
