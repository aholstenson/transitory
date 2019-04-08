import { KeyType } from '../key-type';

import { Cache } from '../cache';
import { CommonCacheOptions } from '../common-options';
import { CacheSPI } from '../cache-spi';
import { AbstractCache } from '../abstract';

import { Metrics } from '../metrics/metrics';
import { Expirable } from './expirable';
import { RemovalListener } from '../removal-listener';
import { RemovalReason } from '../removal-reason';

import { TimerWheel, TimerNode } from './timer-wheel';
import { MaxAgeDecider } from './max-age-decider';

import { PARENT, ON_REMOVE, TRIGGER_REMOVE, ON_MAINTENANCE, MAINTENANCE } from '../symbols';

const DATA = Symbol('expirationData');

/**
 * Options available for a loading cache.
 */
export interface ExpirationCacheOptions<K extends KeyType, V> extends CommonCacheOptions<K, V> {
	maxWriteAge?: MaxAgeDecider<K, V>;
	maxNoReadAge?: MaxAgeDecider<K, V>;

	parent: Cache<K, Expirable<V>>;
}

interface ExpirationCacheData<K extends KeyType, V> {
	timerWheel: TimerWheel<K, V>;

	removalListener: RemovalListener<K, V> | null;

	maxWriteAge?: MaxAgeDecider<K, V>;
	maxNoReadAge?: MaxAgeDecider<K, V>;
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

	constructor(options: ExpirationCacheOptions<K, V>) {
		super();

		this[PARENT] = options.parent;

		this[DATA] = {
			maxWriteAge: options.maxWriteAge,
			maxNoReadAge: options.maxNoReadAge,

			removalListener: options.removalListener || null,

			timerWheel: new TimerWheel(keys => {
				for(const key of keys) {
					this.delete(key);
				}
			})
		};

		// Custom onRemove handler for the parent cache
		this[PARENT][ON_REMOVE] = (key: K, node: Expirable<V>, reason: RemovalReason) => {
			if(node.isExpired()) {
				reason = RemovalReason.EXPIRED;
			}

			this[DATA].timerWheel.deschedule(node as TimerNode<K, V>);
			this[TRIGGER_REMOVE](key, node.value as V, reason);
		};

		// Custom maintenance behaviour to advance the wheel
		this[PARENT][ON_MAINTENANCE] = this[MAINTENANCE].bind(this);
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

	public getIfPresent(key: K): V | null {
		const node = this[PARENT].getIfPresent(key);
		if(node) {
			if(node.isExpired()) {
				// Check if the node is expired and return null if so
				return null;
			}

			// Reschedule if we have a maximum age between reads
			const data = this[DATA];
			if(data.maxNoReadAge) {
				const age = data.maxNoReadAge(key, node.value as V);
				if(! data.timerWheel.schedule(node as TimerNode<K, V>, age)) {
					// Age was not accepted by wheel, expire it directly
					this.delete(key);
				}
			}

			return node.value;
		}

		return null;
	}

	public peek(key: K): V | null {
		const node = this[PARENT].peek(key);
		return node && ! node.isExpired() ? node.value : null;
	}

	public has(key: K): boolean {
		const node = this[PARENT].peek(key);
		return (node && ! node.isExpired()) || false;
	}

	public delete(key: K): V | null {
		const node = this[PARENT].delete(key);
		return node ? node.value : null;
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

	get metrics(): Metrics {
		return this[PARENT].metrics;
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
