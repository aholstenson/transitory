import { KeyType } from '../key-type';

import { Cache } from '../cache';
import { CacheSPI } from '../cache-spi';
import { AbstractCache } from '../abstract';

import { RemovalListener } from '../removal-listener';
import { RemovalReason } from '../removal-reason';

import { Metrics } from '../metrics';

import { ON_REMOVE, ON_EVICT, TRIGGER_REMOVE, EVICT } from '../symbols';

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
}

/**
 * Data as used by the boundless cache.
 */
interface BoundlessCacheData<K extends KeyType, V> {
	values: Map<K, V>;

	removalListener: RemovalListener<K, V> | null;

	evictionTimeout: any;
}

/**
 * Boundless cache.
 */
export class BoundlessCache<K extends KeyType, V> extends AbstractCache<K, V> implements Cache<K, V>, CacheSPI<K, V> {
	private [DATA]: BoundlessCacheData<K, V>;

	public [ON_REMOVE]?: RemovalListener<K, V>;
	public [ON_EVICT]?: () => void;

	constructor(options: BoundlessCacheOptions<K, V>) {
		super();

		this[DATA] = {
			values: new Map(),

			removalListener: options.removalListener || null,

			evictionTimeout: null
		};
	}

	/**
	 * Get the maximum size this cache can be.
	 */
	get maxSize() {
		return -1;
	}

	/**
	 * Get the current size of the cache.
	 */
	get size() {
		return this[DATA].values.size;
	}

	get weightedSize() {
		return this.size;
	}

	/**
	 * Cache and associate a value with the given key.
	 */
	public set(key: K, value: V): V | null {
		const data = this[DATA];

		const old = data.values.get(key);

		// Update with the new value
		data.values.set(key, value);

		// Schedule an eviction
		if(! data.evictionTimeout) {
			data.evictionTimeout = setTimeout(() => this[EVICT](), EVICTION_DELAY);
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
	 * Get a value from this cache if it has been previously cached.
	 */
	public getIfPresent(key: K): V | null {
		const data = this[DATA];
		const value = data.values.get(key);
		return value === undefined ? null : value;
	}

	public peek(key: K): V | null {
		const data = this[DATA];
		const value = data.values.get(key);
		return value === undefined ? null : value;
	}

	/**
	 * Delete any value associated with the given key from the cache.
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
				data.evictionTimeout = setTimeout(() => this[EVICT](), EVICTION_DELAY);
			}

			return old;
		} else {
			return null;
		}
	}

	/**
	 * Check if a certain value exists in the cache.
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
	 * Get all of the keys currently in the cache.
	 */
	public keys() {
		this[EVICT]();
		return Array.from(this[DATA].values.keys());
	}

	/**
	 * Clean up.
	 */
	public cleanUp() {
		// Simply request eviction so extra layers can handle this
		this[EVICT]();
	}

	get metrics(): Metrics {
		throw new Error('Metrics are not supported by this cache');
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

	private [EVICT]() {
		// Trigger the onEvict listener if one exists
		const onEvict = this[ON_EVICT];
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
