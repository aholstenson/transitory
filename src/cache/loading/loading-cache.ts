import { KeyType } from '../key-type';

import { Cache } from '../cache';

import { Loader } from './loader';

/**
 * Cache that also supports loading of data if it's not in the cache.
 */
export interface LoadingCache<K extends KeyType, V> extends Cache<K, V> {
	get(key: K, loader?: Loader<K, V>): Promise<V>;
}
