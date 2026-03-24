/** Simulation epoch: January 20, 2038 (day after Unix Y2K38 overflow) */
const SIM_EPOCH_MS = new Date(2038, 0, 20).getTime();
const MS_PER_DAY = 86_400_000;
const SECONDS_PER_DAY = 86_400;

/**
 * Game simulation clock. Stores elapsed time as float64 days since epoch.
 * Provides accessors for days, seconds, Date conversion, and formatting.
 */
export class GameClock {
	/** Fractional days since sim epoch (float64). */
	private _days: number;

	constructor(days = 0) {
		this._days = days;
	}

	// --- Primary accessors ---

	/** Fractional days since epoch. */
	get days(): number {
		return this._days;
	}

	/** Total seconds since epoch (computed from days). */
	get totalSeconds(): number {
		return this._days * SECONDS_PER_DAY;
	}

	// --- Mutation ---

	/** Advance clock by fractional days. */
	advanceDays(delta: number): void {
		this._days += delta;
	}

	/** Set clock to a specific day value. */
	setDays(days: number): void {
		this._days = days;
	}

	// --- Conversion ---

	/** Convert to a JS Date object. */
	toDate(): Date {
		return new Date(SIM_EPOCH_MS + this._days * MS_PER_DAY);
	}

	/** Integer day number (floor of days). */
	dayNumber(): number {
		return Math.floor(this._days);
	}

	// --- Formatting ---

	/** Full datetime string: "YYYY-MM-DD HH:MM:SS" */
	formatDateTime(): string {
		const d = this.toDate();
		const y = d.getFullYear();
		const mo = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		const h = String(d.getHours()).padStart(2, "0");
		const mi = String(d.getMinutes()).padStart(2, "0");
		const s = String(d.getSeconds()).padStart(2, "0");
		return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
	}

	/** Date-only string: "YYYY-MM-DD" */
	formatDate(): string {
		const d = this.toDate();
		const y = d.getFullYear();
		const mo = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${mo}-${day}`;
	}

	// --- Serialization ---

	/** For JSON.stringify -- returns days (same unit as all timestamps). */
	toJSON(): number {
		return this._days;
	}

	/** Create from a serialized days value. */
	static fromDays(days: number): GameClock {
		return new GameClock(days);
	}

	/** Create from seconds. */
	static fromSeconds(seconds: number): GameClock {
		return new GameClock(seconds / SECONDS_PER_DAY);
	}
}
