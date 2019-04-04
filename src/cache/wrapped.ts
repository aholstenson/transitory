import { KeyType } from './key-type';

import { Cache } from './cache';
import { CacheSPI } from './cache-spi';
import { AbstractCache } from './abstract';

import { Metrics } from './metrics';
import { RemovalListener } from './removal-listener';

import { ON_REMOVE, ON_EVICT } from './symbols';

const PARENT = Symbol('parent');

/**
 * Wrapper for another cache, used to extend that cache with new behavior,
 * like for loading things or collecting metrics.
 */
export abstract class WrappedCache<K extends KeyType, V> extends AbstractCache<K, V> implements Cache<K, V>, CacheSPI<K, V> {
	private [PARENT]: Cache<K, V> & CacheSPI<K, V>;

	constructor(parent: Cache<K, V> & CacheSPI<K, V>) {
		super();

		this[PARENT] = parent;
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

	public get [ON_REMOVE](): RemovalListener<K, V> | undefined {
		return this[PARENT][ON_REMOVE];
	}

	public set [ON_REMOVE](listener: RemovalListener<K, V> | undefined) {
		this[PARENT][ON_REMOVE] = listener;
	}

	public get [ON_EVICT](): (() => void) | undefined {
		return this[PARENT][ON_EVICT];
	}

	public set [ON_EVICT](listener: (() => void) | undefined) {
		this[PARENT][ON_EVICT] = listener;
	}
}
