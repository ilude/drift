// ---------------------------------------------------------------------------
// Procedural Star System Generator
// ---------------------------------------------------------------------------
import { seededRandom, rngInt, rngFloat, rngGaussian, rngWeighted, rngPick } from './utils.js';
import { keplerPeriod, categorizePlanet } from './orbit.js';

// --- Lookup Tables ---

const SPECTRAL_TYPES = [
    { type: 'M', weight: 0.50, massMin: 0.08, massMax: 0.45, radMin: 0.1, radMax: 0.6, tempMin: 2400, tempMax: 3700, color: '#ff6633', lumMin: 0.001, lumMax: 0.08 },
    { type: 'K', weight: 0.20, massMin: 0.45, massMax: 0.8, radMin: 0.6, radMax: 0.9, tempMin: 3700, tempMax: 5200, color: '#ff9944', lumMin: 0.08, lumMax: 0.6 },
    { type: 'G', weight: 0.12, massMin: 0.8, massMax: 1.04, radMin: 0.9, radMax: 1.15, tempMin: 5200, tempMax: 6000, color: '#ffdd44', lumMin: 0.6, lumMax: 1.5 },
    { type: 'F', weight: 0.08, massMin: 1.04, massMax: 1.4, radMin: 1.15, radMax: 1.6, tempMin: 6000, tempMax: 7500, color: '#ffffaa', lumMin: 1.5, lumMax: 5 },
    { type: 'A', weight: 0.05, massMin: 1.4, massMax: 2.1, radMin: 1.6, radMax: 2.4, tempMin: 7500, tempMax: 10000, color: '#ccddff', lumMin: 5, lumMax: 25 },
    { type: 'B', weight: 0.03, massMin: 2.1, massMax: 16, radMin: 2.4, radMax: 6.6, tempMin: 10000, tempMax: 30000, color: '#aabbff', lumMin: 25, lumMax: 30000 },
    { type: 'O', weight: 0.02, massMin: 16, massMax: 90, radMin: 6.6, radMax: 15, tempMin: 30000, tempMax: 50000, color: '#9999ff', lumMin: 30000, lumMax: 1000000 },
];

const SYSTEM_CLASSES = [
    { name: 'peas-in-a-pod', weight: 0.40 },
    { name: 'solar-like', weight: 0.15 },
    { name: 'hot-jupiter', weight: 0.10 },
    { name: 'warm-jupiter-mixed', weight: 0.15 },
    { name: 'compact-multi', weight: 0.10 },
    { name: 'giant-dominated', weight: 0.10 },
];

const PLANET_COLORS = {
    rocky: ['#aaaaaa', '#cc5533', '#ddaa66', '#4488cc', '#bb9977', '#ccaa88', '#998877', '#887766'],
    subNeptune: ['#88bbcc', '#aaccbb', '#99aacc', '#bbccdd', '#77aaaa', '#88aa99'],
    gasGiant: ['#ddaa77', '#ccbb77', '#cc9966', '#ddcc88', '#bbaa66', '#ddbb88'],
    iceGiant: ['#88bbcc', '#4466cc', '#6688aa', '#5577bb', '#77aacc'],
};

const MOON_COLORS = ['#999999', '#887766', '#aaaaaa', '#777788', '#aabbbb', '#99aaaa', '#888888', '#776655'];

const COMET_COLORS = ['#99ccff', '#aaddff', '#88bbaa', '#bbaaff', '#ccddff', '#ddeeff', '#aa9988', '#998877'];

const CATALOG_PREFIXES = [
    { prefix: 'HD', weight: 0.4, min: 100000, max: 399999 },
    { prefix: 'GJ', weight: 0.3, min: 1000, max: 9999 },
    { prefix: 'HIP', weight: 0.3, min: 10000, max: 99999 },
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const EARTH_RADIUS_KM = 6371;
const SOLAR_RADIUS_KM = 695700;

// --- Naming ---

function generateSystemName(rng) {
    const cat = rngWeighted(rng, CATALOG_PREFIXES);
    const num = rngInt(rng, cat.min, cat.max);
    return `${cat.prefix} ${num}`;
}

export function planetLetter(index) {
    return String.fromCharCode(98 + index); // b, c, d, ...
}

// --- Star Generation ---

function generateStar(rng, name) {
    const spec = rngWeighted(rng, SPECTRAL_TYPES);
    const t = rng(); // position within spectral range
    const mass = spec.massMin + t * (spec.massMax - spec.massMin);
    const radius = spec.radMin + t * (spec.radMax - spec.radMin);
    const luminosity = spec.lumMin + t * (spec.lumMax - spec.lumMin);

    return {
        body: {
            name,
            type: 'Star',
            distance: 0,
            e: 0,
            period: 0,
            radius: Math.round(radius * SOLAR_RADIUS_KM),
            color: spec.color,
            emissive: true,
            moons: []
        },
        mass,
        luminosity,
        spectralType: spec.type
    };
}

// --- Binary Configuration ---

function generateBinaryConfig(rng, primaryStar, systemName) {
    const roll = rng();
    if (roll < 0.65) return { type: 'single', secondary: null, separation: 0 };

    // Binary system
    const isP = roll >= 0.90;
    const separation = Math.exp(rngGaussian(rng) * 0.8 + Math.log(50));
    const clampedSep = Math.max(0.5, Math.min(5000, separation));
    const massRatio = rngFloat(rng, 0.1, 1.0);
    const secondaryMass = primaryStar.mass * massRatio;

    // Find spectral type for secondary
    let secSpec = SPECTRAL_TYPES[0];
    for (const s of SPECTRAL_TYPES) {
        if (secondaryMass >= s.massMin && secondaryMass <= s.massMax) {
            secSpec = s;
            break;
        }
    }
    const t = Math.max(0, Math.min(1, (secondaryMass - secSpec.massMin) / (secSpec.massMax - secSpec.massMin || 1)));
    const secRadius = secSpec.radMin + t * (secSpec.radMax - secSpec.radMin);
    const secPeriod = Math.sqrt(Math.pow(clampedSep, 3) / (primaryStar.mass + secondaryMass));

    const secondaryBody = {
        name: systemName + ' B',
        type: 'Star',
        distance: clampedSep,
        period: secPeriod,
        radius: Math.round(secRadius * SOLAR_RADIUS_KM),
        color: secSpec.color,
        emissive: true,
        moons: []
    };

    return {
        type: isP ? 'p-type' : 's-type',
        secondary: secondaryBody,
        separation: clampedSep,
        secondaryMass,
        // Planet constraints
        maxPlanetDist: isP ? Infinity : clampedSep / 5,
        minPlanetDist: isP ? clampedSep * rngFloat(rng, 2, 4) : 0,
    };
}

// --- Planet Generation ---


function generatePlanets(rng, systemClass, starMass, starLuminosity, binary) {
    const snowLine = Math.sqrt(starLuminosity) * 2.7;
    const planets = [];

    switch (systemClass) {
        case 'peas-in-a-pod':
            generatePeasInAPod(rng, planets, starMass, binary);
            break;
        case 'solar-like':
            generateSolarLike(rng, planets, starMass, starLuminosity, snowLine, binary);
            break;
        case 'hot-jupiter':
            generateHotJupiter(rng, planets, starMass, binary);
            break;
        case 'warm-jupiter-mixed':
            generateWarmJupiterMixed(rng, planets, starMass, binary);
            break;
        case 'compact-multi':
            generateCompactMulti(rng, planets, starMass, binary);
            break;
        case 'giant-dominated':
            generateGiantDominated(rng, planets, starMass, binary);
            break;
    }

    // Enforce minimum 2 planets
    while (planets.length < 2) {
        const dist = rngFloat(rng, 0.5, 3);
        planets.push(makePlanetEntry(rng, dist, rngFloat(rng, 0.8, 2.0), starMass));
    }

    // Add outer dwarf planets and detached objects to ALL system types
    const outermost = planets.reduce((max, p) => p.distance > max ? p.distance : max, 0);
    let dwarfDist = outermost * rngFloat(rng, 1.8, 3.0);
    const dwarfCount = rngInt(rng, 2, 5);
    for (let i = 0; i < dwarfCount; i++) {
        const p = makePlanetEntry(rng, dwarfDist, rngFloat(rng, 0.05, 0.35), starMass);
        p._isDwarf = true;
        planets.push(p);
        dwarfDist *= rngFloat(rng, 1.3, 2.0);
    }

    // Chance of a detached object (Sedna-like) far out
    if (rng() < 0.4) {
        const detachedDist = dwarfDist * rngFloat(rng, 3, 10);
        const p = makePlanetEntry(rng, detachedDist, rngFloat(rng, 0.03, 0.15), starMass);
        p._isDetached = true;
        planets.push(p);
    }

    // Sort by distance
    planets.sort((a, b) => a.distance - b.distance);

    return planets;
}

function makePlanetEntry(rng, distAU, radiusEarths, starMass) {
    const cat = categorizePlanet(radiusEarths);
    const color = rngPick(rng, PLANET_COLORS[cat]);
    const radiusKm = Math.round(radiusEarths * EARTH_RADIUS_KM);
    const period = keplerPeriod(distAU, starMass);

    const ecc = Math.round(rngFloat(rng, 0.001, 0.12) * 1000) / 1000;

    return {
        distance: Math.round(distAU * 1000) / 1000,
        e: ecc,
        period: Math.round(period * 1000) / 1000,
        radius: radiusKm,
        color,
        moons: [],
        _radiusEarths: radiusEarths,
        _category: cat,
    };
}

function applyBinaryConstraints(planets, binary) {
    if (binary.type === 'single') return planets;
    return planets.filter(p =>
        p.distance >= binary.minPlanetDist &&
        p.distance <= binary.maxPlanetDist
    );
}

// --- System Class Generators ---

function generatePeasInAPod(rng, planets, starMass, binary) {
    const count = rngInt(rng, 3, 7);
    const templateRadius = rngFloat(rng, 1.2, 3.5);
    let dist = rngFloat(rng, 0.05, 0.15);

    for (let i = 0; i < count; i++) {
        const radius = templateRadius * rngFloat(rng, 0.85, 1.15);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        const periodRatio = rngFloat(rng, 1.5, 2.5);
        dist = dist * Math.pow(periodRatio, 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

function generateSolarLike(rng, planets, starMass, luminosity, snowLine, binary) {
    // Inner rocky planets
    const rockyCount = rngInt(rng, 2, 4);
    let dist = rngFloat(rng, 0.3, 0.5);
    for (let i = 0; i < rockyCount; i++) {
        const radius = rngFloat(rng, 0.5, 1.8);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        dist *= Math.pow(rngFloat(rng, 1.5, 2.5), 2 / 3);
    }

    // Gas giants beyond snow line
    const giantCount = rngInt(rng, 1, 2);
    dist = Math.max(dist, snowLine * rngFloat(rng, 1.0, 1.5));
    for (let i = 0; i < giantCount; i++) {
        const radius = rngFloat(rng, 8, 12);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        dist *= Math.pow(rngFloat(rng, 2, 3.5), 2 / 3);
    }

    // Ice giants further out
    const iceCount = rngInt(rng, 0, 2);
    for (let i = 0; i < iceCount; i++) {
        const radius = rngFloat(rng, 3, 5);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        dist *= Math.pow(rngFloat(rng, 2, 3), 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

function generateHotJupiter(rng, planets, starMass, binary) {
    // Hot Jupiter
    const hjDist = rngFloat(rng, 0.02, 0.1);
    const hjRadius = rngFloat(rng, 10, 15);
    planets.push(makePlanetEntry(rng, hjDist, hjRadius, starMass));

    // 0-2 small companions
    const compCount = rngInt(rng, 1, 2);
    let dist = rngFloat(rng, 0.3, 1.0);
    for (let i = 0; i < compCount; i++) {
        planets.push(makePlanetEntry(rng, dist, rngFloat(rng, 0.8, 2.5), starMass));
        dist *= Math.pow(rngFloat(rng, 2, 3), 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

function generateWarmJupiterMixed(rng, planets, starMass, binary) {
    const gjDist = rngFloat(rng, 0.5, 3.0);
    const gjRadius = rngFloat(rng, 8, 12);
    planets.push(makePlanetEntry(rng, gjDist, gjRadius, starMass));

    // Inner small planets
    const innerCount = rngInt(rng, 1, 2);
    let dist = rngFloat(rng, 0.05, gjDist * 0.4);
    for (let i = 0; i < innerCount; i++) {
        planets.push(makePlanetEntry(rng, dist, rngFloat(rng, 0.8, 3.0), starMass));
        dist *= Math.pow(rngFloat(rng, 1.5, 2.5), 2 / 3);
    }

    // Outer small planets
    const outerCount = rngInt(rng, 1, 2);
    dist = gjDist * rngFloat(rng, 1.5, 2.5);
    for (let i = 0; i < outerCount; i++) {
        planets.push(makePlanetEntry(rng, dist, rngFloat(rng, 1.0, 4.0), starMass));
        dist *= Math.pow(rngFloat(rng, 1.5, 2.5), 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

function generateCompactMulti(rng, planets, starMass, binary) {
    const count = rngInt(rng, 4, 8);
    let dist = rngFloat(rng, 0.02, 0.06);

    for (let i = 0; i < count; i++) {
        const radius = rngFloat(rng, 0.8, 2.5);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        const periodRatio = rngFloat(rng, 1.3, 2.0);
        dist = dist * Math.pow(periodRatio, 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

function generateGiantDominated(rng, planets, starMass, binary) {
    const count = rngInt(rng, 2, 3);
    let dist = rngFloat(rng, 1.0, 3.0);

    for (let i = 0; i < count; i++) {
        const radius = rngFloat(rng, 6, 14);
        planets.push(makePlanetEntry(rng, dist, radius, starMass));
        const periodRatio = rngFloat(rng, 2, 4);
        dist = dist * Math.pow(periodRatio, 2 / 3);
    }

    const filtered = applyBinaryConstraints(planets, binary);
    planets.length = 0;
    planets.push(...filtered);
}

// --- Moon Generation ---

function generateMoons(rng, planetName, radiusEarths, category) {
    let maxMoons;
    if (category === 'rocky') maxMoons = 2;
    else if (category === 'gasGiant') maxMoons = 6;
    else maxMoons = 4; // subNeptune, iceGiant

    const count = rngInt(rng, 0, maxMoons);
    const moons = [];

    for (let i = 0; i < count; i++) {
        let moonRadiusKm;
        if (category === 'gasGiant') moonRadiusKm = rngInt(rng, 50, 2500);
        else if (category === 'rocky') moonRadiusKm = rngInt(rng, 10, 500);
        else moonRadiusKm = rngInt(rng, 30, 1000);

        const dist = 0.02 + i * 0.03 + rng() * 0.01;
        const period = 0.001 * (1 + i) * (0.5 + rng());

        moons.push({
            name: `${planetName} ${ROMAN[i]}`,
            distance: Math.round(dist * 1000) / 1000,
            e: Math.round(rngFloat(rng, 0.0, 0.05) * 1000) / 1000,
            period: Math.round(period * 100000) / 100000,
            radius: moonRadiusKm,
            color: rngPick(rng, MOON_COLORS)
        });
    }

    return moons;
}

// --- Asteroid Belt Generation ---

function generateAsteroidBelts(rng, planets, starMass, systemName) {
    const belts = [];
    const beltColors = ['#555544', '#333344', '#334455', '#443355', '#444433', '#335544'];

    // Find largest gas giant for resonance-based belt placement
    let largestGiant = null;
    let largestGiantRadius = 0;
    for (const p of planets) {
        if (p._radiusEarths > 6 && p._radiusEarths > largestGiantRadius) {
            largestGiant = p;
            largestGiantRadius = p._radiusEarths;
        }
    }

    // Inner belt (if giant exists, place at ~60% of giant's distance — near 2:1 resonance)
    if (largestGiant && largestGiant.distance > 1.5) {
        const innerEdge = largestGiant.distance * rngFloat(rng, 0.35, 0.45);
        const outerEdge = largestGiant.distance * rngFloat(rng, 0.55, 0.65);
        if (outerEdge - innerEdge > 0.3) {
            belts.push({
                name: `${systemName} Inner Belt`,
                minAU: Math.round(innerEdge * 100) / 100,
                maxAU: Math.round(outerEdge * 100) / 100,
                count: rngInt(rng, 800, 1800),
                color: rngPick(rng, beltColors),
                size: 0.25,
                minPeriod: Math.round(keplerPeriod(innerEdge, starMass) * 100) / 100,
                maxPeriod: Math.round(keplerPeriod(outerEdge, starMass) * 100) / 100,
                maxInc: rngInt(rng, 1, 3),
            });
        }
    }

    // Outer belt complex (Kuiper analog) — beyond outermost planet
    // Split into 2-3 sub-populations like Sol's Kuiper Belt
    const outermost = planets[planets.length - 1];
    if (outermost && outermost.distance > 3) {
        const baseInner = outermost.distance * rngFloat(rng, 1.2, 1.4);
        const baseOuter = outermost.distance * rngFloat(rng, 1.8, 2.5);

        // Cold population — narrow, flat, densest
        const coldInner = baseInner * rngFloat(rng, 1.0, 1.1);
        const coldOuter = baseInner * rngFloat(rng, 1.2, 1.4);
        belts.push({
            name: `${systemName} Outer Belt - Cold`,
            minAU: Math.round(coldInner * 100) / 100,
            maxAU: Math.round(coldOuter * 100) / 100,
            count: rngInt(rng, 800, 1600),
            color: rngPick(rng, beltColors),
            size: 0.3,
            minPeriod: Math.round(keplerPeriod(coldInner, starMass) * 100) / 100,
            maxPeriod: Math.round(keplerPeriod(coldOuter, starMass) * 100) / 100,
            maxInc: rngInt(rng, 1, 2),
        });

        // Hot population — wider, more inclined
        belts.push({
            name: `${systemName} Outer Belt - Hot`,
            minAU: Math.round(baseInner * 100) / 100,
            maxAU: Math.round(baseOuter * 100) / 100,
            count: rngInt(rng, 600, 1400),
            color: rngPick(rng, beltColors),
            size: 0.3,
            minPeriod: Math.round(keplerPeriod(baseInner, starMass) * 100) / 100,
            maxPeriod: Math.round(keplerPeriod(baseOuter, starMass) * 100) / 100,
            maxInc: rngInt(rng, 3, 5),
        });

        // Resonant population — overlapping region
        if (rng() < 0.7) {
            const resInner = coldInner * rngFloat(rng, 0.9, 1.0);
            const resOuter = coldOuter * rngFloat(rng, 1.0, 1.1);
            belts.push({
                name: `${systemName} Outer Belt - Resonant`,
                minAU: Math.round(resInner * 100) / 100,
                maxAU: Math.round(resOuter * 100) / 100,
                count: rngInt(rng, 300, 800),
                color: rngPick(rng, beltColors),
                size: 0.3,
                minPeriod: Math.round(keplerPeriod(resInner, starMass) * 100) / 100,
                maxPeriod: Math.round(keplerPeriod(resOuter, starMass) * 100) / 100,
                maxInc: rngInt(rng, 2, 4),
            });
        }
    } else if (!largestGiant) {
        // No giant and compact system — place a debris belt mid-system
        const midDist = outermost ? outermost.distance * 1.5 : 3;
        const inner = midDist * 0.8;
        const outer = midDist * 1.2;
        belts.push({
            name: `${systemName} Debris Belt`,
            minAU: Math.round(inner * 100) / 100,
            maxAU: Math.round(outer * 100) / 100,
            count: rngInt(rng, 500, 1000),
            color: rngPick(rng, beltColors),
            size: 0.25,
            minPeriod: Math.round(keplerPeriod(inner, starMass) * 100) / 100,
            maxPeriod: Math.round(keplerPeriod(outer, starMass) * 100) / 100,
            maxInc: rngInt(rng, 1, 5),
        });
    }

    return belts;
}

// --- Comet Generation ---

function generateComets(rng, outerEdgeAU, starMass, systemName) {
    const count = rngInt(rng, 3, 10);
    const comets = [];

    for (let i = 0; i < count; i++) {
        const a = rngFloat(rng, 10, Math.max(500, outerEdgeAU * 3));
        const e = rngFloat(rng, 0.8, 0.999);
        const period = Math.sqrt(Math.pow(a, 3) / starMass);

        comets.push({
            name: `${systemName}-C${i + 1}`,
            a,
            e,
            period: Math.round(period * 100) / 100,
            inc: rngFloat(rng, 1, 5),
            node: rngFloat(rng, 0, 360),
            peri: rngFloat(rng, 0, 360),
            color: rngPick(rng, COMET_COLORS),
        });
    }

    return comets;
}

// --- Main Generator ---

export function generateSystem(seed) {
    const rng = seededRandom(seed);
    const systemName = generateSystemName(rng);

    // Star
    const primary = generateStar(rng, systemName);

    // Binary
    const binary = generateBinaryConfig(rng, primary, systemName);

    // System class
    const systemClass = rngWeighted(rng, SYSTEM_CLASSES).name;

    // Planets
    const rawPlanets = generatePlanets(rng, systemClass, primary.mass, primary.luminosity, binary);

    // Assign names, types, moons
    const bodies = [primary.body];

    if (binary.secondary) {
        bodies.push(binary.secondary);
    }

    rawPlanets.forEach((p, i) => {
        const letter = planetLetter(i);
        const name = `${systemName} ${letter}`;
        const type = p._isDetached ? 'Detached Object' : p._isDwarf ? 'Dwarf Planet' : 'Planet';
        const moons = generateMoons(rng, name, p._radiusEarths, p._category);

        bodies.push({
            name,
            type,
            distance: p.distance,
            e: p.e,
            period: p.period,
            radius: p.radius,
            color: p.color,
            moons,
        });
    });

    // Asteroid belts
    const outerEdge = rawPlanets.length > 0 ? rawPlanets[rawPlanets.length - 1].distance : 5;
    const asteroidBelts = generateAsteroidBelts(rng, rawPlanets, primary.mass, systemName);

    // Comets
    const comets = generateComets(rng, outerEdge, primary.mass, systemName);

    return {
        name: `${systemName} System`,
        bodies,
        comets,
        asteroidBelts,
    };
}

