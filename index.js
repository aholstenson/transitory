'use strict';

const BoundedCache = require('./cache/bounded');
const BoundlessCache = require('./cache/boundless');

const LoadingCache = require('./cache/loading');
const ExpireAfterWriteCache = require('./cache/expire-after-write');

/**
 * Builder for cache instances.
 */
class Builder {
	constructor() {
		this.options = {};
	}

	/**
	 * Set a listener that will be called every time something is removed
	 * from the cache.
	 */
	withRemovalListener(listener) {
		this.options.removalListener = listener;
		return this;
	}

	/**
	 * Set the maximum number of items to keep in the cache before evicting
	 * something.
	 */
	withMaxSize(size) {
		this.options.maxSize = size;
		return this;
	}

	/**
	 * Change to a loading cache, where the get-method will return instances
	 * of Promise and automatically load unknown values.
	 */
	withLoading(loader) {
		this.options.loading = true;
		this.options.loader = loader;
		return this;
	}

    expireAfterWrite(time) {
		let evaluator;
		if(typeof time === 'function') {
			evaluator = time;
		} else if(typeof time === 'number') {
			evaluator = () => time;
		} else {
			throw new Error('Expiration needs either a maximum age as a number or a function that returns a number');
		}
        this.options.maxWriteAge = evaluator;
        return this;
    }

	/**
	 * Build and return the cache.
	 */
	build() {
		let cache;
		if(this.options.maxSize) {
			cache = new BoundedCache(this.options);
		} else {
			cache = new BoundlessCache(this.options);
		}

        if(this.options.maxWriteAge > 0) {
            cache = new ExpireAfterWriteCache(cache, this.options);
        }

		if(this.options.loading) {
			cache = new LoadingCache(cache, this.options);
		}

		return cache;
	}
}

module.exports = function() {
	return new Builder();
};

module.exports.RemovalCause = require('./utils/removal-cause');
