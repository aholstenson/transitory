import { KeyType } from './KeyType';
import { RemovalListener } from './RemovalListener';

/**
 * Common options for caches.
 */
export interface CommonCacheOptions<K extends KeyType, V> {
	removalListener?: RemovalListener<K, V> | null;
}
