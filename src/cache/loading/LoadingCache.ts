import { Cache } from '../Cache';
import { KeyType } from '../KeyType';

import { Loader } from './Loader';

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
	get(key: K, loader?: Loader<K, V>): Promise<V>;
}
