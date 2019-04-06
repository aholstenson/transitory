import { KeyType } from '../cache/key-type';
import { RemovalListener } from '../cache/removal-listener';

/**
 * Common options for caches.
 */
export interface CommonCacheOptions<K extends KeyType, V> {
	removalListener?: RemovalListener<K, V> | null;
}
