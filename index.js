'use strict';

const BoundedCache = require('./cache/bounded');
const BoundlessCache = require('./cache/boundless');

const LoadingCache = require('./cache/loading');

/**
 * Builder for cache instances.
 */
class Builder {
	constructor() {
		this.options = {};
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

	/**
	 * Build and return the cache.
	 */
	build() {
		let cache;
		if(this.options.maxSize) {
			cache = new BoundedCache(this.options);
		} else {
			cache = new BoundlessCache();
		}

		if(this.options.loading) {
			cache = new LoadingCache(cache, this.options);
		}

		return cache;
	}
}

module.exports = function() {
	return new Builder();
}
