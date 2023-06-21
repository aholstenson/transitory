import { AbstractCache } from '../AbstractCache';
import { Cache } from '../Cache';
import { CacheSPI } from '../CacheSPI';
import { KeyType } from '../KeyType';
import { Loader } from '../loading/Loader';
import { LoaderManager, LoaderResult } from '../loading/LoaderManager';
import { resolveLoader } from '../loading/LoadingCache';
import { Metrics } from '../metrics/Metrics';
import { MetricsRecorder } from '../metrics/MetricsRecorder';
import { NoopMetrics } from '../metrics/NoopMetrics';
import { RemovalListener } from '../RemovalListener';
import { RemovalReason } from '../RemovalReason';
import { ON_REMOVE, ON_MAINTENANCE, TRIGGER_REMOVE, MAINTENANCE } from '../symbols';

const DATA = Symbol('boundlessData');

const EVICTION_DELAY = 5000;

/**
 * Options for a boundless cache.
 */
export interface BoundlessCacheOptions<K extends KeyType, V> {
	/**
	 * Listener that triggers when a cached value is removed.
	 */
	removalListener?: RemovalListener<K, V> | undefined | null;

	/**
	 * The default loader for this cache.
	 */
	loader?: Loader<K, V> | undefined | null;

	/**
	 * Metrics recorder for this cache.
	 */
	metrics?: MetricsRecorder;
}

/**
 * Data as used by the boundless cache.
 */
interface BoundlessCacheData<K extends KeyType, V> extends BoundlessCacheOptions<K, V> {
	values: Map<K, V>;

	/**
	 * Manages all loader promises.
	 */
	promises: LoaderManager<K, V>;

	evictionTimeout: any;

	/**
	 * Metrics recorder for this cache.
	 */
	metrics: MetricsRecorder;
}

/**
 * Boundless cache.
 */
export class BoundlessCache<K extends KeyType, V> extends AbstractCache<K, V> implements Cache<K, V>, CacheSPI<K, V> {
	private [DATA]: BoundlessCacheData<K, V>;

	public [ON_REMOVE]?: RemovalListener<K, V>;
	public [ON_MAINTENANCE]?: () => void;

	public constructor(options: BoundlessCacheOptions<K, V>) {
		super();

		this[DATA] = {
			values: new Map(),

			removalListener: options.removalListener || null,

			evictionTimeout: null,

			metrics: options.metrics ?? NoopMetrics,

			loader: options.loader,

			promises: new LoaderManager((key, value) => {
				this.set(key, value);
			}),
		};
	}

	/**
	 * The maximum size the cache can be. Will be -1 if the cache is unbounded.
	 *
	 * @returns
	 *   maximum size, always `-1`
	 */
	public get maxSize() {
		return -1;
	}

	/**
	 * The current size of the cache.
	 *
	 * @returns
	 *   entries in the cache
	 */
	public get size() {
		return this[DATA].values.size;
	}

	/**
	 * The size of the cache weighted via the activate estimator.
	 *
	 * @returns
	 *   entries in the cache
	 */
	public get weightedSize() {
		return this.size;
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
		const data = this[DATA];

		const old = data.values.get(key);

		// Update with the new value
		data.values.set(key, value);

		// Schedule an eviction
		if(! data.evictionTimeout) {
			data.evictionTimeout = setTimeout(() => this[MAINTENANCE](), EVICTION_DELAY);
		}

		// Return the value we replaced
		if(old !== undefined) {
			this[TRIGGER_REMOVE](key, old, RemovalReason.REPLACED);
			return old;
		} else {
			return null;
		}
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
		const data = this[DATA];
		const value = data.values.get(key);
		if(value === undefined || value === null) {
			data.metrics.miss();
			return null;
		}
		data.metrics.hit();
		return value;
	}

	/**
	 * Get cached value or load it if not currently cached. Updates the usage
	 * of the key.
	 *
	 * @param key -
	 *   key to get
	 * @param loader -
	 *   optional loader to use for loading the object
	 * @returns
	 *   promise that resolves to the loaded value
	 */
	public get<R extends V | undefined | null>(key: K, loader?: Loader<K, V>): Promise<LoaderResult<R>> {
		const data = this[DATA];
		const value = data.values.get(key);
		if(value !== null && value !== undefined) {
			data.metrics.hit();
			return Promise.resolve(value as LoaderResult<R>);
		}
		data.metrics.miss();
		return this[DATA].promises.get(key, resolveLoader(this[DATA].loader, loader)) as Promise<LoaderResult<R>>;
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
		const data = this[DATA];
		const value = data.values.get(key);
		return value === undefined ? null : value;
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
		const data = this[DATA];

		const old = data.values.get(key);
		data.values.delete(key);

		if(old !== undefined) {
			// Trigger removal events
			this[TRIGGER_REMOVE](key, old, RemovalReason.EXPLICIT);

			// Queue an eviction event if one is not set
			if(! data.evictionTimeout) {
				data.evictionTimeout = setTimeout(() => this[MAINTENANCE](), EVICTION_DELAY);
			}

			return old;
		} else {
			return null;
		}
	}

	/**
	 * Check if the given key exists in the cache.
	 *
	 * @param key -
	 *   key to check
	 * @returns
	 *   `true` if value currently exists, `false` otherwise
	 */
	public has(key: K) {
		const data = this[DATA];
		return data.values.has(key);
	}

	/**
	 * Clear all of the cached data.
	 */
	public clear() {
		const data = this[DATA];
		const oldValues = data.values;

		// Simply replace the value map new data
		data.values = new Map();

		// Trigger removal events for all of the content in the cache
		for(const [ key, value ] of oldValues.entries()) {
			this[TRIGGER_REMOVE](key, value, RemovalReason.EXPLICIT);
		}
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
	public keys() {
		this[MAINTENANCE]();
		return Array.from(this[DATA].values.keys());
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
	public cleanUp() {
		// Simply request eviction so extra layers can handle this
		this[MAINTENANCE]();
	}

	/**
	 * Get metrics for this cache. Returns an object with the keys `hits`,
	 * `misses` and `hitRate`. For caches that do not have metrics enabled
	 * trying to access metrics will throw an error.
	 *
	 * @returns
	 *   the metrics for this cache
	 */
	public get metrics(): Metrics {
		return this[DATA].metrics;
	}

	private [TRIGGER_REMOVE](key: K, value: any, reason: RemovalReason) {
		const data = this[DATA];

		// Trigger any extended remove listeners
		const onRemove = this[ON_REMOVE];
		if(onRemove) {
			onRemove(key, value, reason);
		}

		if(data.removalListener) {
			data.removalListener(key, value as V, reason);
		}
	}

	private [MAINTENANCE]() {
		// Trigger the onEvict listener if one exists
		const onEvict = this[ON_MAINTENANCE];
		if(onEvict) {
			onEvict();
		}

		const data = this[DATA];
		if(data.evictionTimeout) {
			clearTimeout(data.evictionTimeout);
			data.evictionTimeout = null;
		}
	}
}
