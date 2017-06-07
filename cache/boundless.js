'use strict';

const { DATA, ON_REMOVE } = require('./symbols');

const RemovalCause = require('../utils/removal-cause');

/**
 * Boundless cache.
 */
class BoundlessCache {
	constructor(options) {
		this[DATA] = {
			values: new Map(),

			removalListener: options.removalListener
		};
	}

	/**
	 * Get the maximum size this cache can be.
	 */
	get maxSize() {
		return -1;
	}

	/**
	 * Get the current size of the cache.
	 */
	get size() {
		return this[DATA].values.size;
	}

	/**
	 * Cache and associate a value with the given key.
	 */
	set(key, value) {
		const data = this[DATA];

		const old = data.values.get(key);

		// Update with the new value
		data.values.set(key, value);

		// Return the value we replaced
		if(old !== undefined) {
			this[ON_REMOVE](key, old, RemovalCause.REPLACED);
			return old;
		} else {
			return null;
		}
	}

	/**
	 * Get a previously cached value.
	 */
	get(key) {
		return this.getIfPresent(key);
	}

	/**
	 * Get a value from this cache if it has been previously cached.
	 */
	getIfPresent(key) {
		const data = this[DATA];
		const value = data.values.get(key);
		return value === undefined ? null : value;
	}

	/**
	 * Delete any value associated with the given key from the cache.
	 */
	delete(key) {
		const data = this[DATA];

		const old = data.values.get(key);
		data.values.delete(key);

		if(old !== undefined) {
			this[ON_REMOVE](key, old, RemovalCause.EXPLICIT);
			return old;
		} else {
			return null;
		}
	}

	/**
	 * Check if a certain value exists in the cache.
	 */
	has(key) {
		const data = this[DATA];
		return data.values.has(key);
	}

	[ON_REMOVE](key, value, cause) {
		const data = this[DATA];
		if(data.removalListener) {
			data.removalListener(key, value, cause);
		}
	}
}

module.exports = BoundlessCache;
