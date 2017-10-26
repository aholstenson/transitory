'use strict';

function throwError() {
	throw new Error('Unusable cache, create caches via the builder');
}

module.exports = class BaseCache {
	set(key, value) {
		throwError();
	}

	get(key) {
		throwError();
	}

	getIfPresent(key, recordStats=true) {
		throwError();
	}

	delete(key) {
		throwError();
	}

	has(key) {
		throwError();
	}

	clear() {
		throwError();
	}

	keys() {
		throwError();
	}

	cleanUp() {
		throwError();
	}
}
