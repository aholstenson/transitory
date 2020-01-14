/**
 * Metrics for a cache. Includes information about the number of hits,
 * misses and the hit ratio.
 */
export interface Metrics {
	hits: number;
	misses: number;
	readonly hitRate: number;
}
