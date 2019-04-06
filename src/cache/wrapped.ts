import { KeyType } from './key-type';

import { Cache } from './cache';
import { CacheSPI } from './cache-spi';
import { AbstractCache } from './abstract';

import { Metrics } from './metrics/metrics';
import { RemovalListener } from './removal-listener';

import { ON_REMOVE, ON_EVICT, TRIGGER_REMOVE } from './symbols';
import { RemovalReason } from './removal-reason';

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

	constructor(parent: Cache<K, V> & CacheSPI<K, V>, removalListener: RemovalListener<K, V> | null) {
		super();

		this[PARENT] = parent;
		this[REMOVAL_LISTENER] = removalListener;

		// Custom onRemove handler for the parent cache
		this[PARENT][ON_REMOVE] = this[TRIGGER_REMOVE].bind(this);
	}

	get maxSize(): number {
		return this[PARENT].maxSize;
	}

	get size(): number {
		return this[PARENT].size;
	}

	get weightedSize(): number {
		return this[PARENT].weightedSize;
	}

	public set(key: K, value: V): V | null {
		return this[PARENT].set(key, value);
	}

	public getIfPresent(key: K): V | null {
		return this[PARENT].getIfPresent(key);
	}

	public peek(key: K): V | null {
		return this[PARENT].peek(key);
	}

	public has(key: K): boolean {
		return this[PARENT].has(key);
	}

	public delete(key: K): V | null {
		return this[PARENT].delete(key);
	}

	public clear(): void {
		return this[PARENT].clear();
	}

	public keys(): K[] {
		return this[PARENT].keys();
	}

	public cleanUp(): void {
		return this[PARENT].cleanUp();
	}

	public get metrics(): Metrics {
		return this[PARENT].metrics;
	}

	public get [ON_EVICT](): (() => void) | undefined {
		return this[PARENT][ON_EVICT];
	}

	public set [ON_EVICT](listener: (() => void) | undefined) {
		this[PARENT][ON_EVICT] = listener;
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
