import { Cache } from '../Cache';
import { KeyType } from '../KeyType';

import { Loader } from './Loader';
import { LoaderResult } from './LoaderManager';

/**
 * Cache that also supports loading of data if it's not in the cache.
 */
export interface LoadingCache<K extends KeyType, V> extends Cache<K, V> {
	/**
	 * Get cached value or load it if not currently cached. Updates the usage
	 * of the key.
	 *
	 * @param key -
	 *   key to get
	 * @param loader -
	 *   optional loader to use for loading the object
	 * @returns
	 *   promise that resolves to the loaded value
	 */
	get<R extends V | null | undefined = V>(key: K, loader?: Loader<K, V>): Promise<LoaderResult<R>>;
}

/**
 * Given two loaders, returns the most relevant one, or throws an exception if the provded loaders are invalid.
 *
 * @param defaultLoader -
 *   the primary loader
 * @param loader -
 *   the specific loader that can override the default one
 * @returns
 *   resolved loader, or throws an exception
 */
export function resolveLoader<K extends KeyType, V>(defaultLoader: Loader<K, V> | undefined | null, loader: Loader<K, V> | undefined | null) : Loader<K, V> {
	if(defaultLoader !== undefined && defaultLoader !== null) {
		return defaultLoader;
	}
	if(loader !== undefined && loader !== null) {
		if(typeof loader !== 'function') {
			throw new Error('If loader is used it must be a function that returns a value or a Promise');
		}
		return loader;
	}
	throw new Error('No loader is provided');
}
