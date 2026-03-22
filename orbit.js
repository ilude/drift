export const DIST_SCALE = 100;
export const MOON_DIST_SCALE = 25;

export function scaleDist(au) {
    return Math.sqrt(au) * DIST_SCALE;
}

export function keplerRadius(a, e, theta) {
    return a * (1 - e * e) / (1 + e * Math.cos(theta));
}

export const DAYS_PER_YEAR = 365.25;

export function orbitSpeed(period) {
    return period > 0 ? (Math.PI * 2) / (period * DAYS_PER_YEAR) : 0;
}

export function meanToTrue(M, e) {
    // Normalize M to [0, 2π]
    M = M % (Math.PI * 2);
    if (M < 0) M += Math.PI * 2;

    // Solve Kepler's equation: M = E - e*sin(E)
    // Better initial guess for high eccentricity
    let E = e < 0.8 ? M + e * Math.sin(M) : Math.PI;

    for (let i = 0; i < 20; i++) {
        const denom = 1 - e * Math.cos(E);
        if (Math.abs(denom) < 1e-12) break;
        const dE = (E - e * Math.sin(E) - M) / denom;
        E -= dE;
        if (Math.abs(dE) < 1e-12) break;
    }

    // Eccentric anomaly E → true anomaly θ
    const halfE = E / 2;
    return 2 * Math.atan2(
        Math.sqrt(1 + e) * Math.sin(halfE),
        Math.sqrt(1 - e) * Math.cos(halfE)
    );
}

const _incOut = { x: 0, y: 0, z: 0 };

export function inclinedPosition(x, z, cosN, sinN, cosI, sinI) {
    const xn = x * cosN + z * sinN;
    const zn = -x * sinN + z * cosN;
    const yn = zn * sinI;
    const znTilt = zn * cosI;
    _incOut.x = xn * cosN - znTilt * sinN;
    _incOut.y = yn;
    _incOut.z = xn * sinN + znTilt * cosN;
    return _incOut;
}

export function keplerPeriod(distAU, starMass) {
    return Math.sqrt(Math.pow(distAU, 3) / starMass);
}

export function radiusToMassEarths(radiusEarths) {
    if (radiusEarths < 1.5) return Math.pow(radiusEarths, 3.7);
    if (radiusEarths < 4) return 2.7 * Math.pow(radiusEarths, 1.3);
    return 10 * Math.pow(radiusEarths / 4, 2) * 317.8;
}

export function hillRadius(distAU, planetMassEarths, starMassSolar) {
    const massRatio = (planetMassEarths * 3e-6) / starMassSolar;
    return distAU * Math.pow(massRatio / 3, 1 / 3);
}

export function categorizePlanet(radiusEarths) {
    if (radiusEarths < 1.8) return 'rocky';
    if (radiusEarths < 4) return 'subNeptune';
    if (radiusEarths < 8) return 'iceGiant';
    return 'gasGiant';
}
