export function seededRandom(seed: number): () => number {
	let s = Math.abs(seed) || 1;
	return () => {
		s = (s * 16807 + 0) % 2147483647;
		return (s - 1) / 2147483646;
	};
}

export function rngInt(rng: () => number, min: number, max: number): number {
	return min + Math.floor(rng() * (max - min + 1));
}

export function rngFloat(rng: () => number, min: number, max: number): number {
	return min + rng() * (max - min);
}

export function rngGaussian(rng: () => number): number {
	const u1 = rng(),
		u2 = rng();
	return Math.sqrt(-2 * Math.log(u1 || 1e-10)) * Math.cos(2 * Math.PI * u2);
}

export function rngWeighted<T extends { weight: number }>(
	rng: () => number,
	entries: T[],
): T {
	const total = entries.reduce((s, e) => s + e.weight, 0);
	let r = rng() * total;
	for (const entry of entries) {
		r -= entry.weight;
		if (r <= 0) return entry;
	}
	return entries[entries.length - 1];
}

export function rngPick<T>(rng: () => number, arr: T[]): T {
	return arr[Math.floor(rng() * arr.length)];
}
