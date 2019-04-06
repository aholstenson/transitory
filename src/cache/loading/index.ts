import { KeyType } from '../key-type';

import { Cache } from '../cache';
import { CommonCacheOptions } from '../common-options';
import { WrappedCache } from '../wrapped';

import { LoadingCache } from './loading-cache';
import { Loader } from './loader';

const DATA = Symbol('loadingData');

/**
 * Options available for a loading cache.
 */
export interface LoadingCacheOptions<K extends KeyType, V> extends CommonCacheOptions<K, V> {
	loader?: Loader<K, V> | undefined | null;

	parent: Cache<K, V>;
}

interface LoadingCacheData<K extends KeyType, V> {
	promises: Map<K, Promise<V>>;

	loader: Loader<K, V> | null;
}

/**
 * Extension to another cache that will load items if they are not cached.
 */
export class WrappedLoadingCache<K extends KeyType, V> extends WrappedCache<K, V> implements LoadingCache<K, V> {
	private [DATA]: LoadingCacheData<K, V>;

	constructor(options: LoadingCacheOptions<K, V>) {
		super(options.parent, options.removalListener || null);

		this[DATA] = {
			promises: new Map(),
			loader: options.loader || null
		};
	}

	public get(key: K, loader?: Loader<K, V>): Promise<V> {
		if(this.has(key)) {
			return Promise.resolve(this.getIfPresent(key) as V);
		}

		const data = this[DATA];

		// First check if we are already loading this value
		let promise = data.promises.get(key);
		if(promise) return promise;

		// Create the initial promise if we are not already loading
		if(typeof loader !== 'undefined') {
			if(typeof loader !== 'function') {
				throw new Error('If loader is used it must be a function that returns a value or a Promise');
			}
			promise = Promise.resolve(loader(key));
		} else if(data.loader) {
			promise = Promise.resolve(data.loader(key));
		}

		if(! promise) {
			throw new Error('No way to load data for key: ' + key);
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
}
