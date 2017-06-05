'use strict';

const BoundedCache = require('./cache/bounded');
const BoundlessCache = require('./cache/boundless');

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
	 * Build and return the cache.
	 */
	build() {
		let cache;
		if(this.options.maxSize) {
			cache = new BoundedCache(this.options);
		} else {
			cache = new BoundlessCache();
		}

		return cache;
	}
}

module.exports = function() {
	return new Builder();
}
