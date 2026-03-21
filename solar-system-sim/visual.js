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
