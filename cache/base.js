'use strict';

module.exports = class BaseCache {
	set(key, value) {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	get(key) {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	getIfPresent(key) {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	delete(key) {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	has(key) {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	clear() {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	keys() {
		throw new Error('Unusable cache, reate caches via the builder');
	}

	cleanUp() {
		throw new Error('Unusable cache, reate caches via the builder');
	}
}
