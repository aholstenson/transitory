'use strict';

const { DATA, ON_REMOVE } = require('./symbols');
const RemovalCause = require('../utils/removal-cause');

/**
 * Wrapper for another cache that provides lazily-evaluated eviction of items
 * based on the time they were added to the cache.
 */
module.exports = ParentCache => class ExpireAfterWriteCache extends ParentCache {
	constructor(options) {
		super(options);

		this[DATA].maxWriteAge = options.maxWriteAge;
	}

	set(key, value) {
		const replaced = super.set(key, {
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
			return super.getIfPresent(key, recordStats).value;
		} else {
			return null;
		}
	}

	has(key) {
		const data = super.getIfPresent(key, false);
		return data && data.expires > Date.now();
	}

	[ON_REMOVE](key, value, cause) {
		if(value.expires <= Date.now()) {
			cause = RemovalCause.EXPIRED;
		}
		super[ON_REMOVE](key, value.value, cause);
	}
};
