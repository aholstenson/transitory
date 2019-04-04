import { KeyType } from './key-type';
import { RemovalListener } from './removal-listener';

import { ON_REMOVE, ON_EVICT } from './symbols';

/**
 * Type not part of the public API, used by caches and their layers as their
 * "base".
 */
export interface CacheSPI<K extends KeyType, V> {
	/**
	 * Called when a key is removed from the cache. Intended to be overriden
	 * so that the value and removal reason can be modified.
	 */
	[ON_REMOVE]?: RemovalListener<K, V>;

	/**
	 * Called when eviction occurs in the cache. Can be used by layers to
	 * perform extra tasks during eviction, such as expiring items.
	 */
	[ON_EVICT]?: () => void;
}
