import { KeyType } from '../key-type';

import { Cache } from '../cache';
import { WrappedCache } from '../wrapped';

import { Metrics } from './metrics';
import { CommonCacheOptions } from '../common-options';

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

	constructor(options: MetricsCacheOptions<K, V>) {
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

	get metrics(): Metrics {
		return this[METRICS];
	}

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
