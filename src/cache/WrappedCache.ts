import { AbstractCache } from './AbstractCache';
import { Cache } from './Cache';
import { CacheSPI } from './CacheSPI';
import { KeyType } from './KeyType';
import { Metrics } from './metrics/Metrics';
import { RemovalListener } from './RemovalListener';
import { RemovalReason } from './RemovalReason';
import { ON_REMOVE, ON_MAINTENANCE, TRIGGER_REMOVE } from './symbols';

const PARENT = Symbol('parent');
const REMOVAL_LISTENER = Symbol('removalListener');

/**
 * Wrapper for another cache, used to extend that cache with new behavior,
 * like for loading things or collecting metrics.
 */
export abstract class WrappedCache<K extends KeyType, V> extends AbstractCache<K, V> implements Cache<K, V>, CacheSPI<K, V> {
	private [PARENT]: Cache<K, V> & CacheSPI<K, V>;

	public [ON_REMOVE]?: RemovalListener<K, V>;
	private [REMOVAL_LISTENER]: RemovalListener<K, V> | null;

	public constructor(parent: Cache<K, V> & CacheSPI<K, V>, removalListener: RemovalListener<K, V> | null) {
		super();

		this[PARENT] = parent;
		this[REMOVAL_LISTENER] = removalListener;

		// Custom onRemove handler for the parent cache
		this[PARENT][ON_REMOVE] = this[TRIGGER_REMOVE].bind(this);
	}

	/**
	 * The maximum size the cache can be. Will be -1 if the cache is unbounded.
	 *
	 * @returns
	 *   maximum size
	 */
	public get maxSize(): number {
		return this[PARENT].maxSize;
	}

	/**
	 * The current size of the cache.
	 *
	 * @returns
	 *   current size
	 */
	public get size(): number {
		return this[PARENT].size;
	}

	/**
	 * The size of the cache weighted via the activate estimator.
	 *
	 * @returns
	 *   current weighted size
	 */
	public get weightedSize(): number {
		return this[PARENT].weightedSize;
	}

	/**
	 * Store a value tied to the specified key. Returns the previous value or
	 * `null` if no value currently exists for the given key.
	 *
	 * @param key -
	 *   key to store value under
	 * @param value -
	 *   value to store
	 * @returns
	 *   current value or `null`
	 */
	public set(key: K, value: V): V | null {
		return this[PARENT].set(key, value);
	}

	/**
	 * Get the cached value for the specified key if it exists. Will return
	 * the value or `null` if no cached value exist. Updates the usage of the
	 * key.
	 *
	 * @param key -
	 *   key to get
	 * @returns
	 *   current value or `null`
	 */
	public getIfPresent(key: K): V | null {
		return this[PARENT].getIfPresent(key);
	}

	/**
	 * Peek to see if a key is present without updating the usage of the
	 * key. Returns the value associated with the key or `null`  if the key
	 * is not present.
	 *
	 * In many cases `has(key)` is a better option to see if a key is present.
	 *
	 * @param key -
	 *   the key to check
	 * @returns
	 *   value associated with key or `null`
	 */
	public peek(key: K): V | null {
		return this[PARENT].peek(key);
	}

	/**
	 * Check if the given key exists in the cache.
	 *
	 * @param key -
	 *   key to check
	 * @returns
	 *   `true` if value currently exists, `false` otherwise
	 */
	public has(key: K): boolean {
		return this[PARENT].has(key);
	}

	/**
	 * Delete a value in the cache. Returns the deleted value or `null` if
	 * there was no value associated with the key in the cache.
	 *
	 * @param key -
	 *   the key to delete
	 * @returns
	 *   deleted value or `null`
	 */
	public delete(key: K): V | null {
		return this[PARENT].delete(key);
	}

	/**
	 * Clear the cache removing all of the entries cached.
	 */
	public clear(): void {
		this[PARENT].clear();
	}

	/**
	 * Get all of the keys in the cache as an array. Can be used to iterate
	 * over all of the values in the cache, but be sure to protect against
	 * values being removed during iteration due to time-based expiration if
	 * used.
	 *
	 * @returns
	 *   snapshot of keys
	 */
	public keys(): K[] {
		return this[PARENT].keys();
	}

	/**
	 * Request clean up of the cache by removing expired entries and
	 * old data. Clean up is done automatically a short time after sets and
	 * deletes, but if your cache uses time-based expiration and has very
	 * sporadic updates it might be a good idea to call `cleanUp()` at times.
	 *
	 * A good starting point would be to call `cleanUp()` in a `setInterval`
	 * with a delay of at least a few minutes.
	 */
	public cleanUp(): void {
		this[PARENT].cleanUp();
	}

	/**
	 * Get metrics for this cache. Returns an object with the keys `hits`,
	 * `misses` and `hitRate`. For caches that do not have metrics enabled
	 * trying to access metrics will throw an error.
	 *
	 * @returns
	 *   metrics
	 */
	public get metrics(): Metrics {
		return this[PARENT].metrics;
	}

	public get [ON_MAINTENANCE](): (() => void) | undefined {
		return this[PARENT][ON_MAINTENANCE];
	}

	public set [ON_MAINTENANCE](listener: (() => void) | undefined) {
		this[PARENT][ON_MAINTENANCE] = listener;
	}

	private [TRIGGER_REMOVE](key: K, value: V, reason: RemovalReason) {
		// Trigger any extended remove listeners
		const onRemove = this[ON_REMOVE];
		if(onRemove) {
			onRemove(key, value, reason);
		}

		// Trigger the removal listener
		const listener = this[REMOVAL_LISTENER];
		if(listener) {
			listener(key, value, reason);
		}
	}
}
