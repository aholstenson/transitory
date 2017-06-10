'use strict';

const { DATA } = require('./symbols');

/**
 * Extension to a cache that tracks metrics about the size and hit rate of
 * a cache.
 */
module.exports = ParentCache => class MetricsCache extends ParentCache {
	constructor(options) {
		super(options);

		this[DATA].metrics = {
			hits: 0,
			misses: 0,

			get hitRate() {
				const total = this.hits + this.misses;
				if(total == 0) return 1.0;

				return this.hits / total;
			}
		};
	}

	get metrics() {
		return this[DATA].metrics;
	}

	getIfPresent(key, recordStats=true) {
		const result = super.getIfPresent(key, recordStats);
		if(recordStats) {
			if(result === null) {
				this[DATA].metrics.misses++;
			} else {
				this[DATA].metrics.hits++;
			}
		}
		return result;
	}
};
