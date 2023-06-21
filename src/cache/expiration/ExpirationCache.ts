
import { isPromise } from 'util/types';

import { AbstractCache } from '../AbstractCache';
import { Cache } from '../Cache';
import { CacheSPI } from '../CacheSPI';
import { CommonCacheOptions } from '../CommonCacheOptions';
import { KeyType } from '../KeyType';
import { Loader } from '../loading/Loader';
import { LoaderResult } from '../loading/LoaderManager';
import { NoopMetrics } from '../metrics';
import { Metrics } from '../metrics/Metrics';
import { MetricsRecorder } from '../metrics/MetricsRecorder';
import { RemovalListener } from '../RemovalListener';
import { RemovalReason } from '../RemovalReason';
import { PARENT, ON_REMOVE, TRIGGER_REMOVE, ON_MAINTENANCE, MAINTENANCE } from '../symbols';

import { Expirable } from './Expirable';
import { MaxAgeDecider } from './MaxAgeDecider';
import { TimerWheel, TimerNode } from './TimerWheel';


const DATA = Symbol('expirationData');

/**
 * Options available for a loading cache.
 */
export interface ExpirationCacheOptions<K extends KeyType, V> extends CommonCacheOptions<K, V> {
	maxWriteAge?: MaxAgeDecider<K, V>;
	maxNoReadAge?: MaxAgeDecider<K, V>;

	parent: Cache<K, Expirable<V>>;

	/**
	 * The default loader for this cache.
	 */
	loader?: Loader<K, V> | undefined | null;

	/**
	 * Metrics recorder for this cache.
	 */
	metrics?: MetricsRecorder;
}

interface ExpirationCacheData<K extends KeyType, V> {
	timerWheel: TimerWheel<K, V>;

	removalListener: RemovalListener<K, V> | null;

	maxWriteAge?: MaxAgeDecider<K, V>;
	maxNoReadAge?: MaxAgeDecider<K, V>;

	/**
	 * The default loader for this cache.
	 */
	loader?: Loader<K, Expirable<V>> | undefined | null;

	/**
	 * Metrics recorder for this cache.
	 */
	metrics: MetricsRecorder;
}

/**
 * Wrapper for another cache that provides evictions of times based on timers.
 *
 * Currently supports expiration based on maximum age.
 */
export class ExpirationCache<K extends KeyType, V> extends AbstractCache<K, V> implements CacheSPI<K, V> {
	private [DATA]: ExpirationCacheData<K, V>;
	private [PARENT]: Cache<K, Expirable<V>> & CacheSPI<K, Expirable<V>>;

	public [ON_REMOVE]?: RemovalListener<K, V>;
	public [ON_MAINTENANCE]?: () => void;

	public constructor(options: ExpirationCacheOptions<K, V>) {
		super();

		this[PARENT] = options.parent;

		const timerWheel = new TimerWheel<K, V>(keys => {
			for(const key of keys) {
				this.delete(key);
			}
		});

		this[DATA] = {
			maxWriteAge: options.maxWriteAge,
			maxNoReadAge: options.maxNoReadAge,

			removalListener: options.removalListener || null,

			timerWheel,

			metrics: options.metrics ?? NoopMetrics,

			loader: options.loader ? wrapLoader(timerWheel, options.loader) : undefined,
		};

		// Custom onRemove handler for the parent cache
		this[PARENT][ON_REMOVE] = (key: K, node: Expirable<V>, reason: RemovalReason) => {
			const actualReason = node.isExpired() ? RemovalReason.EXPIRED : reason;
			this[DATA].timerWheel.deschedule(node as TimerNode<K, V>);
			this[TRIGGER_REMOVE](key, node.value as V, actualReason);
		};

		// Custom maintenance behaviour to advance the wheel
		this[PARENT][ON_MAINTENANCE] = this[MAINTENANCE].bind(this);
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
	 *   weighted size
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
	public set(key: K, value: V) {
		const data = this[DATA];
		const timerWheel = data.timerWheel;
		const node = timerWheel.node(key, value);

		let age = null;
		if(data.maxWriteAge) {
			age = data.maxWriteAge(key, value) || 0;
		} else if(data.maxNoReadAge) {
			age = data.maxNoReadAge(key, value) || 0;
		}

		if(age !== null && ! data.timerWheel.schedule(node, age)) {
			// Age was not accepted by wheel, delete any previous value
			return this.delete(key);
		}

		try {
			const replaced = this[PARENT].set(key, node);
			return replaced ? replaced.value : null;
		} catch(ex) {
			timerWheel.deschedule(node);
			throw ex;
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
		const node = this[PARENT].getIfPresent(key);
		const value = this.unwrapNode(key, node);
		data.metrics.record(value !== null);
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
		const nodePromise = this[PARENT].get(key, resolveWrappedLoader(data.timerWheel, data.loader, loader));
		return nodePromise.then(node => {
			const value = this.unwrapNode(key, node);
			data.metrics.record(value !== null);
			return value as LoaderResult<R>;
		});
	}

	/**
	 * Unwraps an expirable node as a value, handling expiration logic.
	 *
	 * @param key -
	 *   the key associated to the node
	 *
	 * @param node -
	 *   the node to unwrap
	 *
	 * @returns
	 *   the unwrapped value or null
	 */
	protected unwrapNode(key: K, node: Expirable<V> | null): V | null {
		const data = this[DATA];

		if(! node) {
			return null;
		}

		if(node.isExpired()) {
			// Check if the node is expired and return null if so
			return null;
		}

		// Reschedule if we have a maximum age between reads
		if(data.maxNoReadAge) {
			const age = data.maxNoReadAge(key, node.value as V);
			if(! data.timerWheel.schedule(node as TimerNode<K, V>, age)) {
				// Age was not accepted by wheel, expire it directly
				this.delete(key);
			}
		}

		return node.value;
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
		const node = this[PARENT].peek(key);
		return node && ! node.isExpired() ? node.value : null;
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
		const node = this[PARENT].peek(key);
		return (node && ! node.isExpired()) || false;
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
		const node = this[PARENT].delete(key);
		return node ? node.value : null;
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
	 *   metrics if available via the parent cache
	 */
	public get metrics(): Metrics {
		return this[DATA].metrics;
	}

	private [MAINTENANCE]() {
		this[DATA].timerWheel.advance();

		const onMaintenance = this[ON_MAINTENANCE];
		if(onMaintenance) {
			onMaintenance();
		}
	}

	private [TRIGGER_REMOVE](key: K, value: V, reason: RemovalReason) {
		// Trigger any extended remove listeners
		const onRemove = this[ON_REMOVE];
		if(onRemove) {
			onRemove(key, value, reason);
		}

		const data = this[DATA];
		// Trigger the removal listener
		if(data.removalListener) {
			data.removalListener(key, value, reason);
		}
	}
}

/**
 * Wraps a loader so it returns expirable nodes.
 *
 * @param timerWheel -
 *   the timerWheel
 *
 * @param loader -
 *   the loader to wrap
 *
 * @returns
 *   a wrapped loader that returns Expirable nodes
 */
function wrapLoader<K extends KeyType, V>(timerWheel: TimerWheel<K, V>, loader: Loader<K, V>): Loader<K, Expirable<V>> {
	return key => {
		const maybePromise = loader(key);
		if(maybePromise === null || maybePromise === undefined) {
			return null;
		}
		if(! isPromise(maybePromise)) {
			return timerWheel.node(key, maybePromise);
		}
		return maybePromise.then(value => {
			if(value === null || value === undefined) {
				return null;
			}
			return timerWheel.node(key, value);
		});
	};
}

/**
 * Given two loaders, returns the most relevant one, or throws an exception if the provded loaders are invalid.
 *
 * @param timerWheel -
 *   the timerWheel
 *
 * @param defaultLoader -
 *   the primary loader
 *
 * @param loader -
 *   the specific loader that can override the default one
 *
 * @returns
 *   resolved loader, or throws an exception
 */
export function resolveWrappedLoader<K extends KeyType, V>(
	timerWheel: TimerWheel<K, V>,
	defaultLoader: Loader<K, Expirable<V>> | undefined | null,
	loader: Loader<K, V> | undefined | null,
) : Loader<K, Expirable<V>> {
	if(defaultLoader !== undefined && defaultLoader !== null) {
		return defaultLoader;
	}
	if(loader !== undefined && loader !== null) {
		if(typeof loader !== 'function') {
			throw new Error('If loader is used it must be a function that returns a value or a Promise');
		}
		return wrapLoader(timerWheel, loader);
	}
	throw new Error('No loader is provided');
}
