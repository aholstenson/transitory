'use strict';

const { Amount, Duration } = require('amounts');

const BoundedCache = require('./cache/bounded');
const BoundlessCache = require('./cache/boundless');

const LoadingCache = require('./cache/loading');
const ExpirationCache = require('./cache/expiration');
const MetricsCache = require('./cache/metrics');

const memoryEstimator = require('./utils/memoryEstimator');

/**
 * Builder for cache instances.
 */
class Builder {
	constructor() {
		this.options = {
			weigher: false,
			removalListener: false
		};
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
	maxSize(size) {
		this.options.maxSize = Amount(size).value;
		return this;
	}

	/**
	 * Set a function to use to determine the size of a cached object.
	 */
	withWeigher(weigher) {
		if(typeof weigher !== 'function') {
			throw new Error('Weigher should be a function that takes a key and value and returns a number');
		}
		this.options.weigher = weigher;
		return this;
	}

	/**
	 * Change to a cache where get can also resolve values if provided with
	 * a function as the second argument.
	 */
	loading() {
		this.options.loading = true;
		return this;
	}

	/**
	 * Change to a loading cache, where the get-method will return instances
	 * of Promise and automatically load unknown values.
	 */
	withLoader(loader) {
		this.options.loading = true;
		this.options.loader = loader;
		return this;
	}

	/**
	 * Set that the cache should expire items after some time.
	 */
	expireAfterWrite(time) {
		let evaluator;
		if(typeof time === 'function') {
			evaluator = time;
		} else if(typeof time === 'number') {
			evaluator = () => time;
		} else if(typeof time === 'string') {
			const ms = Duration(time).as('ms');
			evaluator = () => ms;
		} else {
			throw new Error('expireAfterWrite needs either a maximum age as a number or a function that returns a number');
		}
		this.options.maxWriteAge = evaluator;
		return this;
	}

	/**
	 * Set that the cache should expire items some time after they have been read.
	 */
	expireAfterRead(time) {
		let evaluator;
		if(typeof time === 'function') {
			evaluator = time;
		} else if(typeof time === 'number') {
			evaluator = () => time;
		} else if(typeof time === 'string') {
			const ms = Duration(time).as('ms');
			evaluator = () => ms;
		} else {
			throw new Error('expireAfterRead needs either a maximum age as a number or a function that returns a number');
		}
		this.options.maxNoReadAge = evaluator;
		return this;
	}

	/**
	 * Activate tracking of metrics for this cache.
	 */
	metrics() {
		this.options.metrics = true;
		return this;
	}

	/**
	 * Build and return the cache.
	 */
	build() {
		let Impl;
		if(this.options.maxSize) {
			Impl = BoundedCache;
		} else {
			Impl = BoundlessCache;
		}

		if(typeof this.options.maxWriteAge !== 'undefined' || typeof this.options.maxNoReadAge !== 'undefined') {
			Impl = ExpirationCache(Impl);
		}

		if(this.options.metrics) {
			Impl = MetricsCache(Impl);
		}

		if(this.options.loading) {
			Impl = LoadingCache(Impl);
		}

		return new Impl(this.options);
	}
}

module.exports = function() {
	return new Builder();
};

module.exports.RemovalCause = require('./utils/removal-cause');
module.exports.memoryUsageWeigher = (key, value) => memoryEstimator(value);
