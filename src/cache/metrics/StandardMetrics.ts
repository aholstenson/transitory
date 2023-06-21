import { MetricsRecorder } from './MetricsRecorder';

export class StandardMetrics implements MetricsRecorder {
	private _hits: number = 0;
	public get hits(): number {
		return this._hits;
	}

	private _misses: number = 0;
	public get misses(): number {
		return this._misses;
	}

	public get hitRate(): number {
		const total = this.hits + this.misses;
		return total === 0 ? 1.0 : this.hits / total;
	}

	public hit(count?: number) {
		this._hits += count ?? 1;
	}

	public miss(count?: number) {
		this._misses += count ?? 1;
	}

	public record(isHit: boolean) {
		if(isHit) {
			this._hits += 1;
		} else {
			this._misses += 1;
		}
	}

	public count(hits: number, misses: number) {
		this._hits += hits;
		this._misses += misses;
	}

	public reset(): void {
		this._hits = 0;
		this._misses = 0;
	}

	public toJSON() {
		return {
			hits: this.hits,
			misses: this.misses,
		};
	}
}
