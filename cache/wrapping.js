'use strict';

const { PARENT, DATA } = require('./symbols');

/**
 * Base for caches that wrap another cache.
 */
class WrappingCache {
	constructor(parent) {
		this[PARENT] = parent;
	}

	get maxSize() {
		return this[PARENT].maxSize;
	}

	get size() {
		return this[PARENT].size;
	}

	set(key, value) {
		return this[PARENT].set(key, value);
	}

	get(key) {
		return this[PARENT].get(key);
	}

	getIfPresent(key, recordStats=null) {
		return this[PARENT].getIfPresent(key, recordStats);
	}

	has(key) {
		return this[PARENT].has(key);
	}

	delete(key) {
		return this[PARENT].delete(key);
	}

	static rewireRemovalListener(self, listener) {
		self[PARENT][DATA].removalListener = function(key, value, cause) {
			const remapped = listener.call(self, key, value, cause);
			if(self[DATA].removalListener) {
				if(remapped) {
					self[DATA].removalListener(remapped.key, remapped.value, remapped.cause);
				} else {
					self[DATA].removalListener(key, value, cause);
				}
			}
		};
	}
}

WrappingCache.PARENT = PARENT;
module.exports = WrappingCache;
