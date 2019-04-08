import { Cache } from '../cache';
import { CacheSPI } from '../cache-spi';

import { Metrics } from '../metrics/metrics';
import { CountMinSketch } from './sketch';

import { ON_REMOVE, ON_MAINTENANCE, TRIGGER_REMOVE, MAINTENANCE } from '../symbols';

import { RemovalReason } from '../removal-reason';
import { CacheNode } from '../cache-node';
import { Weigher } from '../weigher';
import { KeyType } from '../key-type';
import { AbstractCache } from '../abstract';
import { RemovalListener } from '../removal-listener';

const percentInMain = 0.99;
const percentProtected = 0.8;
const percentOverflow = 0.01;

const DATA = Symbol('boundedData');

/**
 * Options usable with a BoundedCache.
 */
export interface BoundedCacheOptions<K extends KeyType, V> {
	/**
	 * The maximum size of the cache. For unweighed caches this is the maximum
	 * number of entries in the cache, for weighed caches this is the maximum
	 * weight of the cache.
	 */
	maxSize: number;

	/**
	 * Weigher function to use. If this is specified the cache turns into
	 * a weighted cache and the function is called when cached data is stored
	 * to determine its weight.
	 */
	weigher?: Weigher<K, V> | null;

	/**
	 * Listener to call whenever something is removed from the cache.
	 */
	removalListener?: RemovalListener<K, V> | null;
}

/**
 * Data as used by the bounded cache.
 */
interface BoundedCacheData<K extends KeyType, V> {
	values: Map<K, BoundedNode<K, V>>;

	maxSize: number;

	weigher: Weigher<K, V> | null;
	weightedMaxSize: number;
	weightedSize: number;

	removalListener: RemovalListener<K, V> | null;

	sketch: CountMinSketch;
	sketchGrowLimit: number;

	maintenanceTimeout: any;
	forceEvictionLimit: number;
	maintenanceInterval: number;

	window: CacheSection<K, V>;
	protected: CacheSection<K, V>;
	probation: ProbationSection<K, V>;
}

interface CacheSection<K extends KeyType, V> {
	head: BoundedNode<K, V>;
	size: number;
	maxSize: number;
}

interface ProbationSection<K extends KeyType, V> {
	head: BoundedNode<K, V>;
}

/**
 * Bounded cache implementation using W-TinyLFU to keep track of data.
 *
 * See https://arxiv.org/pdf/1512.00727.pdf for details about TinyLFU and
 * the W-TinyLFU optimization.
 */
export class BoundedCache<K extends KeyType, V> extends AbstractCache<K, V> implements Cache<K, V>, CacheSPI<K, V> {
	private [DATA]: BoundedCacheData<K, V>;

	public [ON_REMOVE]?: RemovalListener<K, V>;
	public [ON_MAINTENANCE]?: () => void;

	constructor(options: BoundedCacheOptions<K, V>) {
		super();

		const maxMain = Math.floor(percentInMain * options.maxSize);

		/*
		 * For weighted caches use an initial sketch size of 256. It will
		 * grow when the size of the cache approaches that size.
		 *
		 * Otherwise set it to a minimum of 128 or the maximum requested size
		 * of the graph.
		 */
		const sketchWidth = options.weigher ? 256 : Math.max(options.maxSize, 128);

		this[MAINTENANCE] = this[MAINTENANCE].bind(this);

		this[DATA] = {
			maxSize: options.weigher ? -1 : options.maxSize,
			removalListener: options.removalListener || null,

			weigher: options.weigher || null,
			weightedMaxSize: options.maxSize,
			weightedSize: 0,

			sketch: CountMinSketch.uint8(sketchWidth, 4),
			sketchGrowLimit: sketchWidth,

			values: new Map(),

			// Tracking of the window cache, around 1% of the total cache
			window: {
				head: new BoundedNode<K, V>(null, null),
				size: 0,
				maxSize: options.maxSize - maxMain
			},

			// SLRU protected segment, 80% * 99% of the total cache
			protected: {
				head: new BoundedNode<K, V>(null, null),
				size: 0,
				maxSize: Math.floor(maxMain * percentProtected)
			},

			// SLRU probation segment, 20% * 99% of the total cache
			probation: {
				head: new BoundedNode<K, V>(null, null),
			},

			// Timeout used to schedule maintenance
			maintenanceTimeout: null,
			// The maximum size we can temporarily be grow before an eviction is forced
			forceEvictionLimit: options.maxSize + Math.max(Math.floor(options.maxSize * percentOverflow), 5),
			// The time to wait before an eviction is triggered by a set
			maintenanceInterval: 5000
		};
	}

	/**
	 * Get the maximum size this cache can be.
	 */
	get maxSize() {
		return this[DATA].maxSize;
	}

	/**
	 * Get the current size of the cache.
	 */
	get size() {
		return this[DATA].values.size;
	}

	/**
	 * Get the weighted size of all items in the cache.
	 */
	get weightedSize() {
		return this[DATA].weightedSize;
	}

	/**
	 * Cache and associate a value with the given key.
	 */
	public set(key: K, value: V): V | null {
		const data = this[DATA];

		const old = data.values.get(key);

		// Create a node and add it to the backing map
		const node = new BoundedNode(key, value);
		data.values.set(key, node);

		if(data.weigher) {
			node.weight = data.weigher(key, value);
		}

		// Update our weight
		data.weightedSize += node.weight;
		if(old) {
			// Remove the old node
			old.remove();

			// Ajudst weight
			data.weightedSize -= old.weight;

			// Update weights of where the node belonged
			switch(old.location) {
				case Location.PROTECTED:
					// Node was protected, reduce the size
					data.protected.size -= old.weight;
					break;
				case Location.WINDOW:
					// Node was in window, reduce window size
					data.window.size -= old.weight;
					break;
			}
		}

		// Check if we reached the grow limit of the sketch
		if(data.weigher && data.values.size >= data.sketchGrowLimit) {
			const sketchWidth = data.values.size * 2;
			data.sketch = CountMinSketch.uint8(sketchWidth, 4);
			data.sketchGrowLimit = sketchWidth;
		}

		// Append the new node to the window space
		node.appendToTail(data.window.head);
		data.window.size += node.weight;

		// Register access to the key
		data.sketch.update(node.hashCode);

		// Schedule eviction
		if(data.weightedSize >= data.forceEvictionLimit) {
			this[MAINTENANCE]();
		} else if(! data.maintenanceTimeout) {
			data.maintenanceTimeout = setTimeout(this[MAINTENANCE], data.maintenanceInterval);
		}

		// Return the value we replaced
		if(old) {
			this[TRIGGER_REMOVE](key, old.value, RemovalReason.REPLACED);
			return old.value;
		} else {
			return null;
		}
	}

	/**
	 * Get a previously cached value.
	 */
	public getIfPresent(key: K) {
		const data = this[DATA];

		const node = data.values.get(key);
		if(! node) {
			// This value does not exist in the cache
			return null;
		}

		// Register access to the key
		data.sketch.update(node.hashCode);

		switch(node.location) {
			case Location.WINDOW:
				// In window cache, mark as most recently used
				node.moveToTail(data.window.head);
				break;
			case Location.PROBATION:
				// In SLRU probation segment, move to protected
				node.location = Location.PROTECTED;
				node.moveToTail(data.protected.head);

				// Plenty of room, keep track of the size
				data.protected.size += node.weight;

				while(data.protected.size > data.protected.maxSize) {
					/*
					 * There is now too many nodes in the protected segment
					 * so demote the least recently used.
					 */
					const lru = data.protected.head.next;
					lru.location = Location.PROBATION;
					lru.moveToTail(data.probation.head);
					data.protected.size -= lru.weight;
				}

				break;
			case Location.PROTECTED:
				// SLRU protected segment, mark as most recently used
				node.moveToTail(data.protected.head);
				break;
		}

		return node.value;
	}

	public peek(key: K) {
		const data = this[DATA];
		const node = data.values.get(key);
		return node ? node.value : null;
	}

	/**
	 * Delete any value associated with the given key from the cache.
	 */
	public delete(key: K) {
		const data = this[DATA];

		const node = data.values.get(key);
		if(node) {
			// Remove the node from its current list
			node.remove();

			switch(node.location) {
				case Location.PROTECTED:
					// Node was protected, reduce the size
					data.protected.size -= node.weight;
					break;
				case Location.WINDOW:
					// Node was in window, reduce window size
					data.window.size -= node.weight;
					break;
			}

			// Reduce overall weight
			data.weightedSize -= node.weight;

			// Remove from main value storage
			data.values.delete(key);

			this[TRIGGER_REMOVE](key, node.value, RemovalReason.EXPLICIT);

			if(! data.maintenanceTimeout) {
				data.maintenanceTimeout = setTimeout(this[MAINTENANCE], data.maintenanceInterval);
			}

			return node.value;
		}

		return null;
	}

	/**
	 * Check if a certain value exists in the cache.
	 */
	public has(key: K) {
		const data = this[DATA];
		return data.values.has(key);
	}

	public clear() {
		const data = this[DATA];

		const oldValues = data.values;
		data.values = new Map();
		for(const [ key, node ] of oldValues) {
			this[TRIGGER_REMOVE](key, node.value, RemovalReason.EXPLICIT);
		}
		data.weightedSize = 0;

		data.window.head.remove();
		data.window.size = 0;

		data.probation.head.remove();

		data.protected.head.remove();
		data.protected.size = 0;

		if(data.maintenanceTimeout) {
			clearTimeout(data.maintenanceTimeout);
			data.maintenanceTimeout = null;
		}
	}

	public keys(): K[] {
		this[MAINTENANCE]();
		return Array.from(this[DATA].values.keys());
	}

	public cleanUp() {
		this[MAINTENANCE]();
	}

	get metrics(): Metrics {
		throw new Error('Metrics are not supported by this cache');
	}

	private [TRIGGER_REMOVE](key: K, value: any, cause: RemovalReason) {
		const data = this[DATA];

		// Trigger any extended remove listeners
		const onRemove = this[ON_REMOVE];
		if(onRemove) {
			onRemove(key, value, cause);
		}

		// Trigger the removal listener
		if(data.removalListener) {
			data.removalListener(key, value, cause);
		}
	}

	private [MAINTENANCE]() {
		/*
		 * Trigger the onMaintenance listener if one exists. This is done
		 * before eviction occurs so that extra layers have a chance to
		 * apply their own eviction rules.
		 *
		 * This can be things such as things being removed because they have
		 * been expired which in turn might cause eviction to be unnecessary.
		 */
		const onMaintenance = this[ON_MAINTENANCE];
		if(onMaintenance) {
			onMaintenance();
		}

		const data = this[DATA];

		/*
		* Evict the least recently used item in the window space to the
		* probation segment until we are below the maximum size.
		*/
		let evictedToProbation = 0;
		while(data.window.size > data.window.maxSize) {
			const first = data.window.head.next;

			first.moveToTail(data.probation.head);
			first.location = Location.PROBATION;

			data.window.size -= first.weight;

			evictedToProbation++;
		}

		/*
		 * Evict items for real until we are below our maximum size.
		 */
		while(data.weightedSize > data.weightedMaxSize) {
			const probation = data.probation.head.next;
			const evictedCandidate = evictedToProbation === 0 ? data.probation.head : data.probation.head.previous;

			const hasProbation = probation !== data.probation.head;
			const hasEvicted = evictedCandidate !== data.probation.head;

			let toRemove: BoundedNode<K, V>;
			if(! hasProbation && ! hasEvicted) {
				// TODO: Probation queue is empty, how is this handled?
				break;
			} else if(! hasEvicted) {
				toRemove = probation;
			} else if(! hasProbation) {
				toRemove = evictedCandidate;

				evictedToProbation--;
			} else {
				/*
				 * Estimate how often the two items have been accessed to
				 * determine which of the keys should actually be evicted.
				 *
				 * Also protect against hash collision attacks where the
				 * frequency of an item in the cache is raised causing the
				 * candidate to never be admitted into the cache.
				 */
				let removeCandidate;

				const freqEvictedCandidate = data.sketch.estimate(evictedCandidate.hashCode);
				const freqProbation = data.sketch.estimate(probation.hashCode);

				if(freqEvictedCandidate > freqProbation) {
					removeCandidate = false;
				} else if(freqEvictedCandidate < data.sketch.slightlyLessThanHalfMaxSize) {
					/*
					 * If the frequency of the candidate is slightly less than
					 * half it can be admitted without going through randomness
					 * checks.
					 *
					 * The idea here is that will reduce the number of random
					 * admittances.
					 */
					removeCandidate = true;
				} else {
					/*
					 * Make it a 1 in 1000 chance that the candidate is not
					 * removed.
					 *
					 * TODO: Should this be lower or higher? Please open an issue if you have thoughts on this
					 */
					removeCandidate = Math.floor(Math.random() * 1000) >= 1;
				}

				toRemove = removeCandidate ? evictedCandidate : probation;
				evictedToProbation--;
			}

			if(toRemove.key === null) {
				throw new Error('Cache issue, problem with removal');
			}

			data.values.delete(toRemove.key);
			toRemove.remove();
			data.weightedSize -= toRemove.weight;

			this[TRIGGER_REMOVE](toRemove.key, toRemove.value, RemovalReason.SIZE);
		}

		if(data.maintenanceTimeout) {
			clearTimeout(data.maintenanceTimeout);
			data.maintenanceTimeout = null;
		}
	}
}

/**
 * Node in a double-linked list.
 */
class BoundedNode<K extends KeyType, V> extends CacheNode<K, V> {
	public readonly hashCode: number;
	public weight: number;
	public location: Location;

	constructor(key: K | null, value: V | null) {
		super(key, value);

		this.hashCode = key == null ? 0 : CountMinSketch.hash(key);
		this.weight = 1;
		this.location = Location.WINDOW;
	}
}

const enum Location {
	WINDOW = 0,
	PROTECTED = 1,
	PROBATION = 2
}
