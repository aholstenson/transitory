'use strict';

const { DATA } = require('./symbols');
const WrappingCache = require('./wrapping');
const RemovalCause = require('../utils/removal-cause');

class ExpireAfterWriteCache extends WrappingCache {
	constructor(parent, options) {
		super(parent);

		this[DATA] = {
			removalListener: options.removalListener,

			maxWriteAge: options.maxWriteAge
		};

		WrappingCache.rewireRemovalListener(this, (key, value, cause) => {
			if(value.expires > Date.now()) {
				cause = RemovalCause.EXPIRED;
			}

			return { key, value: value.value, cause };
		});
	}

	set(key, value) {
		const replaced = super.set(key, {
			value,
			expires: Date.now() + this[DATA].maxWriteAge
		});

		return replaced ? replaced.value : null;
	}

	get(key) {
		return this.getIfPresent(key);
	}

	getIfPresent(key) {
		if(this.has(key)) {
			return super.getIfPresent(key, true).value;
		} else {
			return null;
		}
	}

	has(key) {
		const data = super.getIfPresent(key, false);
		return data && data.expires > Date.now();
	}
}

module.exports = ExpireAfterWriteCache;
