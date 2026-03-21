export const DIST_SCALE = 40;
export const MOON_DIST_SCALE = 25;

export function scaleDist(au) {
    return Math.sqrt(au) * DIST_SCALE;
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
