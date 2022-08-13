import { Cache } from '../Cache';
import { CommonCacheOptions } from '../CommonCacheOptions';
import { KeyType } from '../KeyType';
import { WrappedCache } from '../WrappedCache';

import { Metrics } from './Metrics';


const METRICS = Symbol('metrics');

/**
 * Options available for a metrics cache.
 */
export interface MetricsCacheOptions<K extends KeyType, V> extends CommonCacheOptions<K, V> {
	parent: Cache<K, V>;
}

/**
 * Extension to a cache that tracks metrics about the size and hit rate of
 * a cache.
 */
export class MetricsCache<K extends KeyType, V> extends WrappedCache<K, V> {
	private [METRICS]: Metrics;

	public constructor(options: MetricsCacheOptions<K, V>) {
		super(options.parent, options.removalListener || null);

		this[METRICS] = {
			hits: 0,
			misses: 0,

			get hitRate() {
				const total = this.hits + this.misses;
				if(total === 0) return 1.0;

				return this.hits / total;
			}
		};
	}

	/**
	 * Get metrics for this cache. Returns an object with the keys `hits`,
	 * `misses` and `hitRate`. For caches that do not have metrics enabled
	 * trying to access metrics will throw an error.
	 *
	 * @returns
	 *   metrics of cache
	 */
	public get metrics(): Metrics {
		return this[METRICS];
	}

	/**
	 * Get the cached value for the specified key if it exists. Will return
	 * the value or `null` if no cached value exist. Updates the usage of the
	 * key.
	 *
	 * @param key -
	 *   key to get
	 * @returns
	 *   current value or `null`
	 */
	public getIfPresent(key: K): V | null {
		const result = super.getIfPresent(key);

		if(result === null) {
			this[METRICS].misses++;
		} else {
			this[METRICS].hits++;
		}
		return result;
	}
}
