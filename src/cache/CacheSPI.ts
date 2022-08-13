import { KeyType } from './KeyType';
import { RemovalListener } from './RemovalListener';
import { ON_REMOVE, ON_MAINTENANCE } from './symbols';

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
	 * Called when maintenance occurs in the cache. Can be used by layers to
	 * perform extra tasks during maintenance windows, such as expiring items.
	 */
	[ON_MAINTENANCE]?: () => void;
}
