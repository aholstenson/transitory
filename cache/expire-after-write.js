'use strict';

const { PARENT, DATA } = require('./symbols');
const WrappingCache = require('./wrapping');
const RemovalCause = require('../utils/removal-cause');

/**
 * Wrapper for another cache that provides lazily-evaluated eviction of items
 * based on the time they were added to the cache.
 */
class ExpireAfterWriteCache extends WrappingCache {
	constructor(parent, options) {
		super(parent);

		this[DATA] = {
			removalListener: options.removalListener,

			maxWriteAge: options.maxWriteAge
		};

		WrappingCache.rewireRemovalListener(this, (key, value, cause) => {
			if(value.expires <= Date.now()) {
				cause = RemovalCause.EXPIRED;
			}

			return { key, value: value.value, cause };
		});
	}

	set(key, value) {
		const replaced = this[PARENT].set(key, {
			value,
			expires: Date.now() + this[DATA].maxWriteAge(key, value)
		});

		return replaced ? replaced.value : null;
	}

	get(key) {
		return this.getIfPresent(key, true);
	}

	getIfPresent(key, recordStats=true) {
		if(this.has(key)) {
			return this[PARENT].getIfPresent(key, recordStats).value;
		} else {
			return null;
		}
	}

	has(key) {
		const data = this[PARENT].getIfPresent(key, false);
		return data && data.expires > Date.now();
	}
}

module.exports = ExpireAfterWriteCache;
