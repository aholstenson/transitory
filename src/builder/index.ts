import { KeyType } from '../cache/KeyType';

import { CacheBuilder, CacheBuilderImpl } from './CacheBuilder';

export { CacheBuilder, LoadingCacheBuilder } from './CacheBuilder';

/**
 * Create a new cache via a builder.
 *
 * @returns
 *   builder of a cache
 */
export function newCache<K extends KeyType, V>(): CacheBuilder<K, V> {
	return new CacheBuilderImpl<K, V>();
}
