'use strict';

const { DATA } = require('./symbols');

const NOOP = () => null;

/**
 * Extension to another cache that will load items if they are not cached.
 */
module.exports = ParentCache => class LoadingCache extends ParentCache {
	constructor(options) {
		super(options);

		this[DATA].promises = new Map();
		this[DATA].loader = options.loader || NOOP;
	}

	get(key, loader) {
		if(this.has(key)) {
			return Promise.resolve(this.getIfPresent(key));
		}

		const data = this[DATA];

		// First check if we are already loading this value
		let promise = data.promises.get(key);
		if(promise) return promise;

		// Create the initial promise if we are not already loading
		if(typeof loader !== 'undefined') {
			if(typeof loader !== 'function') {
				throw new Error('If loader is used it must be a function that returns a value or a Promise')
			}
			promise = Promise.resolve(loader(key));
		} else {
			promise = Promise.resolve(data.loader(key));
		}

		// Enhance with handler that will remove promise and set value if success
		const resolve = () => data.promises.delete(key);
		promise = promise.then(result => {
			this.set(key, result);
			resolve();
			return result;
		}).catch(err => {
			resolve();
			throw err;
		});

		data.promises.set(key, promise);
		return promise;
	}
};
