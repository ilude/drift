export function getSolSystem() {
    return {
        name: 'Sol System',
        bodies: [
            { name: 'Sol', type: 'Star', distance: 0, e: 0, period: 0, radius: 695700, color: '#ffdd44', emissive: true, moons: [] },
            { name: 'Mercury', type: 'Planet', distance: 0.387, e: 0.206, period: 0.241, radius: 2440, color: '#aaaaaa', moons: [] },
            { name: 'Venus', type: 'Planet', distance: 0.723, e: 0.007, period: 0.615, radius: 6052, color: '#ddaa66', moons: [] },
            { name: 'Earth', type: 'Planet', distance: 1.0, e: 0.017, period: 1.0, radius: 6371, color: '#4488cc', moons: [
                { name: 'Luna', distance: 0.04, e: 0.055, period: 0.0748, radius: 1737, color: '#999999' }
            ]},
            { name: 'Mars', type: 'Planet', distance: 1.524, e: 0.093, period: 1.881, radius: 3390, color: '#cc5533', moons: [
                { name: 'Phobos', distance: 0.02, e: 0.015, period: 0.0008, radius: 11, color: '#887766' },
                { name: 'Deimos', distance: 0.03, e: 0.0002, period: 0.003, radius: 6, color: '#887766' }
            ]},
            { name: 'Jupiter', type: 'Planet', distance: 5.203, e: 0.049, period: 11.86, radius: 69911, color: '#ddaa77', moons: [
                { name: 'Io', distance: 0.06, e: 0.004, period: 0.00484, radius: 1822, color: '#ddcc44' },
                { name: 'Europa', distance: 0.08, e: 0.009, period: 0.00972, radius: 1561, color: '#ccccdd' },
                { name: 'Ganymede', distance: 0.10, e: 0.001, period: 0.01959, radius: 2634, color: '#aaaaaa' },
                { name: 'Callisto', distance: 0.13, e: 0.007, period: 0.04570, radius: 2410, color: '#777788' }
            ]},
            { name: 'Saturn', type: 'Planet', distance: 9.537, e: 0.054, period: 29.46, radius: 58232, color: '#ccbb77', moons: [
                { name: 'Titan', distance: 0.10, e: 0.029, period: 0.0437, radius: 2575, color: '#cc9944' },
                { name: 'Enceladus', distance: 0.04, e: 0.005, period: 0.00375, radius: 252, color: '#ddddee' }
            ]},
            { name: 'Uranus', type: 'Planet', distance: 19.19, e: 0.047, period: 84.01, radius: 25362, color: '#88bbcc', moons: [
                { name: 'Miranda', distance: 0.04, e: 0.001, period: 0.00387, radius: 236, color: '#aabbbb' },
                { name: 'Titania', distance: 0.08, e: 0.001, period: 0.02387, radius: 789, color: '#aaaaaa' }
            ]},
            { name: 'Neptune', type: 'Planet', distance: 30.07, e: 0.009, period: 164.8, radius: 24622, color: '#4466cc', moons: [
                { name: 'Triton', distance: 0.06, e: 0.000, period: 0.01610, radius: 1353, color: '#99aaaa' }
            ]},
            { name: 'Ceres', type: 'Dwarf Planet', distance: 2.77, e: 0.076, period: 4.60, radius: 473, color: '#888877', moons: [] },
            { name: 'Pluto', type: 'Dwarf Planet', distance: 39.48, e: 0.250, period: 248.0, radius: 1188, color: '#ccaa88', moons: [
                { name: 'Charon', distance: 0.05, e: 0.000, period: 0.01745, radius: 606, color: '#999988' }
            ]},
            { name: 'Haumea', type: 'Dwarf Planet', distance: 43.22, e: 0.189, period: 284.1, radius: 816, color: '#aaaaaa', moons: [
                { name: "Hi'iaka", distance: 0.06, e: 0.050, period: 0.1345, radius: 160, color: '#888888' }
            ]},
            { name: 'Makemake', type: 'Dwarf Planet', distance: 45.79, e: 0.161, period: 309.9, radius: 715, color: '#bb9977', moons: [] },
            { name: 'Eris', type: 'Dwarf Planet', distance: 67.78, e: 0.436, period: 559.0, radius: 1163, color: '#bbbbbb', moons: [
                { name: 'Dysnomia', distance: 0.05, e: 0.010, period: 0.04384, radius: 350, color: '#777777' }
            ]},
            { name: 'Sedna', type: 'Detached Object', distance: 506, e: 0.843, period: 11400, radius: 498, color: '#cc6644', moons: [] },
        ],
        comets: [
            { name: 'Halley', a: 17.83, e: 0.967, period: 75.3, inc: 4, node: 58.42, peri: 111.33, color: '#99ccff' },
            { name: 'Hale-Bopp', a: 186, e: 0.995, period: 2533, inc: 3, node: 282.47, peri: 130.59, color: '#aaddff' },
            { name: 'Encke', a: 2.22, e: 0.848, period: 3.3, inc: 2, node: 334.57, peri: 186.55, color: '#88bbaa' },
            { name: 'Swift-Tuttle', a: 26.09, e: 0.963, period: 133.3, inc: 5, node: 139.38, peri: 152.98, color: '#bbaaff' },
            { name: 'Tempel 1', a: 3.12, e: 0.510, period: 5.5, inc: 2, node: 68.76, peri: 179.19, color: '#aa9988' },
            { name: 'Churyumov-Ger.', a: 3.46, e: 0.678, period: 6.4, inc: 1, node: 45.93, peri: 14.52, color: '#998877' },
            { name: 'Hyakutake', a: 1700, e: 0.9998, period: 70000, inc: 3, node: 188.05, peri: 130.17, color: '#ccddff' },
            { name: 'Neowise', a: 358.5, e: 0.999, period: 6800, inc: 4, node: 61.01, peri: 37.28, color: '#ddeeff' },
        ],
        asteroidBelts: [
            { name: 'Main Belt', minAU: 2.1, maxAU: 3.3, count: 1387, color: '#555544', size: 0.25, maxInc: 3 },
            { name: 'Kuiper Belt - Cold Classical', minAU: 42, maxAU: 48, count: 1523, color: '#333344', size: 0.3, maxInc: 1 },
            { name: 'Kuiper Belt - Hot Classical', minAU: 30, maxAU: 50, count: 1261, color: '#334455', size: 0.3, maxInc: 5 },
            { name: 'Kuiper Belt - Resonant', minAU: 39, maxAU: 48, count: 842, color: '#443355', size: 0.3, maxInc: 3 },
        ],
    };
}
