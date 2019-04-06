import { KeyType } from '../cache/key-type';
import { CacheBuilder, CacheBuilderImpl } from './unified-builder';

export { CacheBuilder, LoadingCacheBuilder } from './unified-builder';

/**
 * Create a new cache via a builder.
 */
export function newCache<K extends KeyType, V>(): CacheBuilder<K, V> {
	return new CacheBuilderImpl<K, V>();
}
