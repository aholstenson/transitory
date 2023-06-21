import { Metrics } from './Metrics';

/** A mutable version of metrics, for updating cache statistics. */
export interface MetricsRecorder extends Metrics {
	/**
	 * Increment number of hits to the metrics (default 1).
	 *
	 * @param count -
	 *   amount to increment the hits by
	 */
	hit(count?: number): void;

	/**
	 * Increment number of hits to the cache (default 1).
	 *
	 * @param count -
	 *   amount to increment the misses by
	 */
	miss(count?: number): void;

	/**
	 * Increment hits or misses by 1 (true = hit, false = miss).
	 *
	 * @param isHit -
	 *   increment hits or misses
	 */
	record(isHit: boolean): void;

	/**
	 * Increment number of hits and misses to the metrics.
	 *
	 * @param hits -
	 *   amount to increment the hits by
	 *
	 * @param misses -
	 *   amount to increment the misses by
	 */
	count(hits: number, misses: number): void;

	/**
	 * Reset all metrics.
	 */
	reset(): void;
}
