import * as THREE from 'three';
import { seededRandom } from './utils.js';
import { categorizePlanet } from './orbit.js';

function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & 0x7fffffff;
    }
    return hash || 1;
}

// --- Simplex Noise (seeded) ---

const GRAD3 = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
    [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
    [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
];
const F3 = 1 / 3, G3 = 1 / 6;

function buildPerm(rng) {
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [p[i], p[j]] = [p[j], p[i]];
    }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    return perm;
}

function createNoise3D(rng) {
    const perm = buildPerm(rng);
    return function noise3D(x, y, z) {
        const s = (x + y + z) * F3;
        const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
        const t = (i + j + k) * G3;
        const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);

        let i1, j1, k1, i2, j2, k2;
        if (x0 >= y0) {
            if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
            else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
            else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
        } else {
            if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
            else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
            else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
        }

        const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
        const x2 = x0 - i2 + 2*G3, y2 = y0 - j2 + 2*G3, z2 = z0 - k2 + 2*G3;
        const x3 = x0 - 1 + 3*G3, y3 = y0 - 1 + 3*G3, z3 = z0 - 1 + 3*G3;

        const ii = i & 255, jj = j & 255, kk = k & 255;

        function contrib(gx, gy, gz, dx, dy, dz) {
            const t = 0.6 - dx*dx - dy*dy - dz*dz;
            if (t < 0) return 0;
            const g = GRAD3[(perm[ii+gx + perm[jj+gy + perm[kk+gz]]] % 12)];
            return t * t * t * t * (g[0]*dx + g[1]*dy + g[2]*dz);
        }

        return 32 * (
            contrib(0, 0, 0, x0, y0, z0) +
            contrib(i1, j1, k1, x1, y1, z1) +
            contrib(i2, j2, k2, x2, y2, z2) +
            contrib(1, 1, 1, x3, y3, z3)
        );
    };
}

function fbm(noise, x, y, z, octaves, lacunarity = 2.0, gain = 0.5) {
    let value = 0, amplitude = 1, frequency = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
        value += noise(x * frequency, y * frequency, z * frequency) * amplitude;
        maxAmp += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return value / maxAmp;
}

// --- Color helpers ---

function parseColor(hex) {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
}

function lerpColor(a, b, t) {
    return [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t, a[2] + (b[2]-a[2])*t];
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

// --- Spherical mapping ---

function uvToSphere(u, v) {
    const theta = u * Math.PI * 2;
    const phi = v * Math.PI;
    return [
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
    ];
}

// --- Texture generators ---

function generateRockyTexture(rng, color, w = 512, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    const base = parseColor(color);
    const dark = base.map(c => c * 0.6);
    const light = base.map(c => Math.min(1, c * 1.3));

    const craterCount = 4 + Math.floor(rng() * 5);
    const craters = [];
    for (let c = 0; c < craterCount; c++) {
        craters.push({
            cx: rng(), cy: rng(),
            r: 0.02 + rng() * 0.06,
            depth: 0.15 + rng() * 0.2
        });
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const [sx, sy, sz] = uvToSphere(u, v);

            let n = fbm(noise, sx * 2, sy * 2, sz * 2, 6) * 0.5 + 0.5;

            for (const cr of craters) {
                const du = u - cr.cx, dv = v - cr.cy;
                const d = Math.sqrt(du*du + dv*dv);
                if (d < cr.r) {
                    n -= cr.depth * (1 - d / cr.r);
                }
            }

            n = clamp01(n);
            const rgb = n < 0.5
                ? lerpColor(dark, base, n * 2)
                : lerpColor(base, light, (n - 0.5) * 2);

            const idx = (y * w + x) * 4;
            img.data[idx] = rgb[0] * 255;
            img.data[idx+1] = rgb[1] * 255;
            img.data[idx+2] = rgb[2] * 255;
            img.data[idx+3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function generateGasGiantTexture(rng, color, w = 512, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    const base = parseColor(color);
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(color).getHSL(hsl);
    const color2 = parseColor(new THREE.Color().setHSL((hsl.h + 0.05) % 1, hsl.s, Math.min(1, hsl.l * 1.2)).getHexString());
    const color3 = parseColor(new THREE.Color().setHSL((hsl.h - 0.03 + 1) % 1, hsl.s, hsl.l * 0.8).getHexString());

    const bandCount = 8 + Math.floor(rng() * 7);
    const bandOffset = rng() * 10;

    const hasStorm = rng() < 0.3;
    const stormU = rng(), stormV = 0.3 + rng() * 0.4;
    const stormW = 0.08 + rng() * 0.06;
    const stormH = 0.03 + rng() * 0.03;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const lat = (v - 0.5) * Math.PI;
            const [sx, sy, sz] = uvToSphere(u, v);

            const warp = noise(sx * 4, sy * 4, sz * 4) * 0.15;
            const band = Math.sin((lat + warp) * bandCount + bandOffset);
            const turb = noise(sx * 8 + 10, sy * 8, sz * 8) * 0.1;

            const t = clamp01((band + turb) * 0.5 + 0.5);
            let rgb;
            if (t < 0.5) {
                rgb = lerpColor(color3, base, t * 2);
            } else {
                rgb = lerpColor(base, color2, (t - 0.5) * 2);
            }

            if (hasStorm) {
                const du = (u - stormU) / stormW;
                const dv = (v - stormV) / stormH;
                const sd = du*du + dv*dv;
                if (sd < 1) {
                    const swirl = noise(sx * 12 + 20, sy * 12, sz * 12) * 0.2;
                    const blend = (1 - sd) * 0.6;
                    rgb = lerpColor(rgb, [rgb[0] + swirl, rgb[1] - 0.05, rgb[2] - 0.05], blend);
                }
            }

            const idx = (y * w + x) * 4;
            img.data[idx] = clamp01(rgb[0]) * 255;
            img.data[idx+1] = clamp01(rgb[1]) * 255;
            img.data[idx+2] = clamp01(rgb[2]) * 255;
            img.data[idx+3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function generateIceGiantTexture(rng, color, w = 512, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    const base = parseColor(color);
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(color).getHSL(hsl);
    const pole = parseColor(new THREE.Color().setHSL(hsl.h, hsl.s * 0.7, Math.min(1, hsl.l * 1.15)).getHexString());

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const lat = (v - 0.5) * Math.PI;
            const [sx, sy, sz] = uvToSphere(u, v);

            const grad = Math.abs(lat) / (Math.PI / 2);
            const band = Math.sin(lat * 4) * 0.05;
            const n = noise(sx * 2, sy * 2, sz * 2) * 0.08;

            const t = clamp01(grad + band + n);
            const rgb = lerpColor(base, pole, t);

            const idx = (y * w + x) * 4;
            img.data[idx] = clamp01(rgb[0]) * 255;
            img.data[idx+1] = clamp01(rgb[1]) * 255;
            img.data[idx+2] = clamp01(rgb[2]) * 255;
            img.data[idx+3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function generateSubNeptuneTexture(rng, color, w = 512, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    const base = parseColor(color);
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(color).getHSL(hsl);
    const haze = parseColor(new THREE.Color().setHSL(hsl.h, hsl.s * 0.5, Math.min(1, hsl.l * 1.1)).getHexString());

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const lat = (v - 0.5) * Math.PI;
            const [sx, sy, sz] = uvToSphere(u, v);

            const n = fbm(noise, sx * 2, sy * 2, sz * 2, 3) * 0.3;
            const band = Math.sin(lat * 3) * 0.08;
            const limb = Math.abs(Math.cos(lat));

            const t = clamp01(0.5 + n + band);
            let rgb = lerpColor(base, haze, t);
            rgb = lerpColor(rgb, haze, (1 - limb) * 0.3);

            const idx = (y * w + x) * 4;
            img.data[idx] = clamp01(rgb[0]) * 255;
            img.data[idx+1] = clamp01(rgb[1]) * 255;
            img.data[idx+2] = clamp01(rgb[2]) * 255;
            img.data[idx+3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

function generateMoonTexture(rng, color, w = 256, h = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    const base = parseColor(color);

    const craterCount = 5 + Math.floor(rng() * 11);
    const craters = [];
    for (let c = 0; c < craterCount; c++) {
        craters.push({ cx: rng(), cy: rng(), r: 0.02 + rng() * 0.05, depth: 0.1 + rng() * 0.15 });
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const [sx, sy, sz] = uvToSphere(u, v);

            let n = fbm(noise, sx * 3, sy * 3, sz * 3, 4) * 0.3 + 0.5;

            for (const cr of craters) {
                const du = u - cr.cx, dv = v - cr.cy;
                const d = Math.sqrt(du*du + dv*dv);
                if (d < cr.r) n -= cr.depth * (1 - d / cr.r);
            }

            n = clamp01(n);
            const rgb = base.map(c => clamp01(c * (0.6 + n * 0.8)));

            const idx = (y * w + x) * 4;
            img.data[idx] = rgb[0] * 255;
            img.data[idx+1] = rgb[1] * 255;
            img.data[idx+2] = rgb[2] * 255;
            img.data[idx+3] = 255;
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

// --- Star shader ---

const STAR_VERT = `
varying vec3 vPos;
varying vec3 vNormal;
void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SIMPLEX_GLSL = `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

const STAR_FRAG = `
uniform float uTime;
uniform vec3 uBaseColor;

varying vec3 vPos;
varying vec3 vNormal;

${SIMPLEX_GLSL}

void main() {
    vec3 p = vPos * 4.0;

    float granulation = snoise(p * 8.0 + uTime * 0.3) * 0.15;

    float spots = snoise(p * 2.0 + uTime * 0.05);
    spots = smoothstep(0.4, 0.6, spots) * -0.3;

    vec3 col = uBaseColor + uBaseColor * granulation + vec3(spots);

    float limb = dot(normalize(vNormal), vec3(0.0, 0.0, 1.0));
    limb = pow(max(limb, 0.0), 0.4);
    col *= mix(0.3, 1.0, limb);

    gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export function createStarMaterial(color) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uBaseColor: { value: new THREE.Color(color) },
        },
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
    });
}

// --- Cloud texture generator ---

function generateCloudTexture(rng, category, w = 512, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const noise = createNoise3D(rng);

    // Cloud parameters by category
    let coverage, sharpness, octaves, scale;
    switch (category) {
        case 'gasGiant':
            coverage = 0.35; sharpness = 2.5; octaves = 5; scale = 3; break;
        case 'iceGiant':
            coverage = 0.55; sharpness = 3.0; octaves = 4; scale = 2.5; break;
        case 'subNeptune':
            coverage = 0.5; sharpness = 2.0; octaves = 3; scale = 2; break;
        default: // rocky with atmosphere
            coverage = 0.5; sharpness = 2.5; octaves = 5; scale = 3; break;
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / w, v = y / h;
            const [sx, sy, sz] = uvToSphere(u, v);

            let n = fbm(noise, sx * scale, sy * scale, sz * scale, octaves);
            // Shift and sharpen to create cloud patches
            n = clamp01((n - coverage + 0.5) * sharpness);

            // Reduce clouds at poles for gas/ice giants (banded look)
            if (category === 'gasGiant' || category === 'iceGiant') {
                const lat = Math.abs(v - 0.5) * 2;
                n *= 1 - lat * lat * 0.4;
            }

            const idx = (y * w + x) * 4;
            img.data[idx] = 255;
            img.data[idx + 1] = 255;
            img.data[idx + 2] = 255;
            img.data[idx + 3] = n * 180; // semi-transparent
        }
    }

    ctx.putImageData(img, 0, 0);
    return new THREE.CanvasTexture(canvas);
}

// --- Texture dispatcher ---

const EARTH_RADIUS_KM = 6371;
const ROCKY_CLOUD_MIN_RADIUS = 0.8; // Earth radii — smaller rocky bodies have no atmosphere

function bodyCategory(data) {
    if (data._category) return data._category;
    return categorizePlanet(data.radius / EARTH_RADIUS_KM);
}

export function generateBodyTexture(data, isMoon) {
    const seed = hashString(data.name);
    const rng = seededRandom(seed);

    if (isMoon) return generateMoonTexture(rng, data.color);

    const category = bodyCategory(data);
    switch (category) {
        case 'gasGiant': return generateGasGiantTexture(rng, data.color);
        case 'iceGiant': return generateIceGiantTexture(rng, data.color);
        case 'subNeptune': return generateSubNeptuneTexture(rng, data.color);
        default: return generateRockyTexture(rng, data.color);
    }
}

export function generateCloudTextureForBody(data, isMoon) {
    if (isMoon) return null;

    const category = bodyCategory(data);
    const radiusEarths = data.radius / EARTH_RADIUS_KM;

    // Rocky bodies need minimum size for atmosphere
    if (category === 'rocky' && radiusEarths < ROCKY_CLOUD_MIN_RADIUS) return null;

    const seed = hashString(data.name + '_clouds');
    const rng = seededRandom(seed);
    return generateCloudTexture(rng, category);
}
