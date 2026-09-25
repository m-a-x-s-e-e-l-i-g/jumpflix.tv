/** Preserve the last successful value through transient failures without caching failures as data. */
export class ResilientCache<T> {
	value: T | undefined;
	fetchedAt = 0;
	lastError: string | null = null;
	private failedAt = -Infinity;
	private inFlight: Promise<T> | undefined;
	private generation = 0;
	constructor(
		private readonly now = Date.now,
		private readonly retryMs = 15_000
	) {}
	invalidate() {
		this.fetchedAt = -Infinity;
		this.failedAt = -Infinity;
		this.generation++;
		this.inFlight = undefined;
	}
	async get(load: () => Promise<T>, maxAgeMs = 300_000): Promise<T> {
		if (this.value !== undefined && this.now() - this.fetchedAt < maxAgeMs) return this.value;
		if (this.inFlight) return this.inFlight;
		if (this.now() - this.failedAt < this.retryMs) {
			if (this.value !== undefined) return this.value;
			throw new Error(this.lastError ?? 'Content temporarily unavailable');
		}
		const generation = this.generation;
		const pending = (async () => {
			try {
				const value = await Promise.resolve().then(load);
				if (generation === this.generation) {
					this.value = value;
					this.fetchedAt = this.now();
					this.lastError = null;
				}
				return value;
			} catch (error) {
				if (generation === this.generation) {
					this.lastError = error instanceof Error ? error.message : String(error);
					this.failedAt = this.now();
				}
				if (this.value !== undefined) return this.value;
				throw error;
			} finally {
				if (generation === this.generation) this.inFlight = undefined;
			}
		})();
		this.inFlight = pending;
		return pending;
	}
}
