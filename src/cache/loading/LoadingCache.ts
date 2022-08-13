import { Cache } from '../Cache';
import { KeyType } from '../KeyType';

import { Loader } from './Loader';

/**
 * Cache that also supports loading of data if it's not in the cache.
 */
export interface LoadingCache<K extends KeyType, V> extends Cache<K, V> {
	get(key: K, loader?: Loader<K, V>): Promise<V>;
}
