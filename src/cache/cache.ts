import { KeyType } from './key-type';
import { Metrics } from './metrics';

/**
 * Cache for a mapping between keys and values.
 */
export interface Cache<K extends KeyType, V> {

	/**
	 * The maximum size the cache can be. Will be -1 if the cache is unbounded.
	 */
	readonly maxSize: number;

	/**
	 * The current size of the cache.
	 */
	readonly size: number;

	/**
	 * The size of the cache weighted via the activate estimator.
	 */
	readonly weightedSize: number;

	/**
	 * Store a value tied to the specified key. Returns the previous value or
	 * `null` if no value currently exists for the given key.
	 */
	set(key: K, value: V): V | null;

	/**
	 * Get the cached value for the specified key if it exists. Will return
	 * the value or `null` if no cached value exist. Updates the usage of the
	 * key.
	 */
	getIfPresent(key: K): V | null;

	/**
	 * Peek to see if a key is present without updating the usage of the
	 * key. Returns the value associated with the key or `null`  if the key
	 * is not present.
	 *
	 * In many cases `has(key)` is a better option to see if a key is present.
	 *
	 * @param key
	 *   the key to check
	 */
	peek(key: K): V | null;

	/**
	 * Check if the given key exists in the cache.
	 *
	 * @param key
	 */
	has(key: K): boolean;

	/**
	 * Delete a value in the cache. Returns the removed value or `null` if
	 * there was no value associated with the key in the cache.
	 *
	 * @param key
	 *   the key to delete
	 */
	delete(key: K): V | null;

	/**
	 * Clear the cache removing all of the entries cached.
	 */
	clear(): void;

	/**
	 * Get all of the keys in the cache as an `Array`. Can be used to iterate
	 * over all of the values in the cache, but be sure to protect against values
	 * being removed during iteration due to time-based expiration if used.
	 */
	keys(): K[];

	/**
	 * Request clean up of the cache by removing expired entries and
	 * old data. Clean up is done automatically a short time after sets and
	 * deletes, but if your cache uses time-based expiration and has very
	 * sporadic updates it might be a good idea to call `cleanUp()` at times.
	 *
	 * A good starting point would be to call `cleanUp()` in a `setInterval`
	 * with a delay of at least a few minutes.
	 */
	cleanUp(): void;

	/**
	 * Get metrics for this cache. Returns an object with the keys `hits`,
	 * `misses` and `hitRate`. For caches that do not have metrics enabled
	 * trying to access metrics will throw an error.
	 */
	readonly metrics: Metrics;
}
