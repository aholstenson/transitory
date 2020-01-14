import { Cache } from '../Cache';
import { CacheSPI } from '../CacheSPI';

import { Metrics } from '../metrics/Metrics';
import { CountMinSketch } from './CountMinSketch';

import { ON_REMOVE, ON_MAINTENANCE, TRIGGER_REMOVE, MAINTENANCE } from '../symbols';

import { RemovalReason } from '../RemovalReason';
import { CacheNode } from '../CacheNode';
import { Weigher } from '../Weigher';
import { KeyType } from '../KeyType';
import { AbstractCache } from '../AbstractCache';
import { RemovalListener } from '../RemovalListener';

const percentInMain = 0.99;
const percentProtected = 0.8;
const percentOverflow = 0.01;

const adaptiveRestartThreshold = 0.05;
const adaptiveStepPercent = 0.0625;
const adaptiveStepDecayRate = 0.98;

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
	/**
	 * Values within the cache.
	 */
	values: Map<K, BoundedNode<K, V>>;

	/**
	 * The maximum size of the cache or -1 if the cache uses weighing.
	 */
	maxSize: number;

	/**
	 * Weigher being used for this cache. Invoked to determine the weight of
	 * an item being cached.
	 */
	weigher: Weigher<K, V> | null;
	/**
	 * Maximum size of the cache as a weight.
	 */
	weightedMaxSize: number;
	/**
	 * The current weight of all items in the cache.
	 */
	weightedSize: number;

	/**
	 * Listener to invoke when removals occur.
	 */
	removalListener: RemovalListener<K, V> | null;

	/**
	 * Sketch used to keep track of the frequency of which items are used.
	 */
	sketch: CountMinSketch;
	/**
	 * The limit at which to grow the sketch.
	 */
	sketchGrowLimit: number;

	/**
	 * Timeout holder for performing maintenance. When this is set it means
	 * that a maintenance is queued for later.
	 */
	maintenanceTimeout: any;
	/**
	 * The maximum size the cache can grow without an eviction being applied
	 * directly.
	 */
	forceEvictionLimit: number;
	/**
	 * The time in milliseconds to delay maintenance.
	 */
	maintenanceInterval: number;

	/**
	 * Adaptive data used to adjust the size of the window.
	 */
	adaptiveData: AdaptiveData;

	/**
	 * Tracking of the window cache, starts at around 1% of the total cache.
	 */
	window: CacheSection<K, V>;

	/**
	 * SLRU protected segment, 80% * (100% - windowSize) of the total cache
	 */
	protected: CacheSection<K, V>;

	/**
	 * SLRU probation segment, 20% * (100% - windowSize) of the total cache
	 */
	probation: ProbationSection<K, V>;
}

/**
 * Node in a double-linked list used for the segments within the cache.
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

/**
 * Location of a node within the caches segments.
 */
const enum Location {
	WINDOW = 0,
	PROTECTED = 1,
	PROBATION = 2
}

/**
 * Segment within the cache including a tracker for the current size and
 * the maximum size it can be.
 */
interface CacheSection<K extends KeyType, V> {
	/**
	 * Head of the linked list containing nodes for this segment.
	 */
	head: BoundedNode<K, V>;

	/**
	 * Current size of the segment. Updated whenever something is added or
	 * removed from the segment.
	 */
	size: number;

	/**
	 * The maximum size of the segment. Set on creation and can then be moved
	 * around using the adaptive adjustment.
	 */
	maxSize: number;
}

/**
 * Special type for the probation segment that doesn't track its size.
 */
interface ProbationSection<K extends KeyType, V> {
	/**
	 * Head of the linked list containing nodes for this segment.
	 */
	head: BoundedNode<K, V>;
}

/**
 * Data used for adaptive adjustment of the window segment.
 */
interface AdaptiveData {
	/**
	 * The adjustment left to perform, a positive number indicates that the
	 * window size should be increased.
	 */
	adjustment: any;

	/**
	 * The current step size for the hill climbing.
	 */
	stepSize: any;

	/**
	 * The hit rate of the previous sample.
	 */
	previousHitRate: number;

	/**
	 * The number of this in the current sample.
	 */
	misses: number;

	/**
	 * The number of misses in the current sample.
	 */
	hits: number;
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

			adaptiveData: {
				hits: 0,
				misses: 0,

				adjustment: 0,

				previousHitRate: 0,
				stepSize: - adaptiveStepPercent * options.maxSize
			},

			window: {
				head: new BoundedNode<K, V>(null, null),
				size: 0,
				maxSize: options.maxSize - maxMain
			},

			protected: {
				head: new BoundedNode<K, V>(null, null),
				size: 0,
				maxSize: Math.floor(maxMain * percentProtected)
			},

			probation: {
				head: new BoundedNode<K, V>(null, null),
			},

			maintenanceTimeout: null,
			forceEvictionLimit: options.maxSize + Math.max(Math.floor(options.maxSize * percentOverflow), 5),
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

			// Adjust weight
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
			data.adaptiveData.misses++;
			return null;
		}

		// Keep track of the hit
		data.adaptiveData.hits++;

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
		* Evict the least recently used node in the window space to the
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
		 * Evict nodes for real until we are below our maximum size.
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
				 * Estimate how often the two nodes have been accessed to
				 * determine which of the keys should actually be evicted.
				 *
				 * Also protect against hash collision attacks where the
				 * frequency of an node in the cache is raised causing the
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

		// Perform adaptive adjustment of size of window cache
		adaptiveAdjustment(data);

		if(data.maintenanceTimeout) {
			clearTimeout(data.maintenanceTimeout);
			data.maintenanceTimeout = null;
		}
	}
}

/**
 * Perform adaptive adjustment. This will do a simple hill climb and attempt
 * to find the best balance between the recency and frequency parts of the
 * cache.
 *
 * This is based on the work done in Caffeine and the paper Adaptive Software
 * Cache Management by Gil Einziger, Ohad Eytan, Roy Friedman and Ben Manes.
 *
 * This implementation does work in chunks so that not too many nodes are
 * moved around at once. At every maintenance interval it:
 *
 * 1) Checks if there are enough samples to calculate a new adjustment.
 * 2)
 *   Takes the current adjustment and increases or decreases the window in
 *   chunks. At every invocation it currently moves a maximum of 1000 nodes
 *   around.
 *
 * @param data
 */
function adaptiveAdjustment<K extends KeyType, V>(data: BoundedCacheData<K, V>) {
	/*
	 * Calculate the new adaptive adjustment. This might result in a
	 * recalculation or it may skip touching the adjustment.
	 */
	calculateAdaptiveAdjustment(data);

	const a = data.adaptiveData.adjustment;
	if(a > 0) {
		// Increase the window size if the adjustment is positive
		increaseWindowSegmentSize(data);
	} else if(a < 0) {
		// Decrease the window size if the adjustment is negative
		decreaseWindowSegmentSize(data);
	}
}

/**
 * Evict nodes from the protected segment to the probation segment if there
 * are too many nodes in the protected segment.
 *
 * @param data
 */
function evictProtectedToProbation<K extends KeyType, V>(data: BoundedCacheData<K, V>) {
	/*
	 * Move up to 1000 nodes from the protected segment to the probation one
	 * if the segment is over max size.
	 */
	let i = 0;
	while(i++ < 1000 && data.protected.size > data.protected.maxSize) {
		const lru = data.protected.head.next;
		if(lru === data.protected.head) break;

		lru.location = Location.PROBATION;
		lru.moveToTail(data.probation.head);
		data.protected.size -= lru.weight;
	}
}

/**
 * Calculate the adjustment to the window size. This will check if there is
 * enough samples to do a step and if so perform a simple hill climbing to
 * find the new adjustment.
 *
 * @returns
 *   `true` if an adjustment occurred, `false` otherwise
 */
function calculateAdaptiveAdjustment<K extends KeyType, V>(data: BoundedCacheData<K, V>): boolean {
	const adaptiveData = data.adaptiveData;
	const requestCount = adaptiveData.hits + adaptiveData.misses;
	if(requestCount < data.sketch.resetAfter) {
		/*
		 * Skip adjustment if the number of gets in the cache has not reached
		 * the same size as the sketch reset.
		 */
		return false;
	}

	const hitRate = adaptiveData.hits / requestCount;
	const hitRateDiff = hitRate - adaptiveData.previousHitRate;
	const amount = hitRateDiff >= 0 ? adaptiveData.stepSize : - adaptiveData.stepSize;

	let nextStep;
	if(Math.abs(hitRateDiff) >= adaptiveRestartThreshold) {
		nextStep = adaptiveStepPercent * data.weightedMaxSize * (amount >= 0 ? 1 : - 1);
	} else {
		nextStep = adaptiveStepDecayRate * amount;
	}

	// Store the adjustment, step size and previous hit rate for the next step
	adaptiveData.adjustment = Math.floor(amount);
	adaptiveData.stepSize = nextStep;
	adaptiveData.previousHitRate = hitRate;

	// Reset the sample data
	adaptiveData.misses = 0;
	adaptiveData.hits = 0;

	return true;
}

/**
 * Increase the size of the window segment. This will change increase the max
 * size of the window segment and decrease the max size of the protected
 * segment. The method will then move nodes from the probation and protected
 * segment the window segment.
 *
 * @param data
 */
function increaseWindowSegmentSize<K extends KeyType, V>(data: BoundedCacheData<K, V>) {
	if(data.protected.maxSize === 0) {
		// Can't increase the window size anymore
		return;
	}

	let amountLeftToAdjust = Math.min(data.adaptiveData.adjustment, data.protected.maxSize);
	data.protected.maxSize -= amountLeftToAdjust;
	data.window.maxSize += amountLeftToAdjust;

	/*
	 * Evict nodes from the protected are to the probation area now that it
	 * is smaller.
	 */
	evictProtectedToProbation(data);

	/*
	 * Transfer up to 1000 node into the window segment.
	 */
	for(let i=0; i<1000; i++) {
		let lru = data.probation.head.next;
		if(lru === data.probation.head || lru.weight > amountLeftToAdjust) {
			/*
			 * Either got the probation head or the node was to big to fit.
			 * Move on and check in the protected area.
			 */
			lru = data.protected.head.next;
			if(lru === data.protected.head) {
				// No more values to remove
				break;
			}
		}

		if(lru.weight > amountLeftToAdjust) {
			/*
			 * The node weight exceeds what is left of the adjustment.
			 */
			break;
		}

		amountLeftToAdjust -= lru.weight;

		// Remove node from its current segment
		if(lru.location === Location.PROTECTED) {
			// If its protected reduce the size
			data.protected.size -= lru.weight;
		}

		// Move to the window segment
		lru.moveToTail(data.window.head);
		data.window.size += lru.weight;
		lru.location = Location.WINDOW;
	}

	/*
	 * Keep track of the adjustment amount that is left. The next maintenance
	 * invocation will look at this and attempt to adjust for it.
	 */
	data.protected.maxSize += amountLeftToAdjust;
	data.window.maxSize -= amountLeftToAdjust;
	data.adaptiveData.adjustment = amountLeftToAdjust;
}

/**
 * Decrease the size of the window. This will increase the size of the
 * protected segment while decreasing the size of the window segment. Nodes
 * will be moved from the window segment into the probation segment, where
 * they are later moved to the protected segment when they are accessed.
 *
 * @param data
 */
function decreaseWindowSegmentSize<K extends KeyType, V>(data: BoundedCacheData<K, V>) {
	if(data.window.maxSize <= 1) {
		// Can't decrease the size of the window anymore
		return;
	}

	let amountLeftToAdjust = Math.min(-data.adaptiveData.adjustment, Math.max(data.window.maxSize - 1, 0));
	data.window.maxSize -= amountLeftToAdjust;
	data.protected.maxSize += amountLeftToAdjust;

	/*
	 * Transfer upp to 1000 nodes from the window segment into the probation
	 * segment.
	 */
	for(let i=0; i<1000; i++) {
		const lru = data.window.head.next;
		if(lru === data.window.head) {
			// No more nodes in the window segment, can't adjust anymore
			break;
		}

		if(lru.weight > amountLeftToAdjust) {
			/*
			 * The node weight exceeds what is left of the change. Can't move
			 * it around.
			 */
			break;
		}

		amountLeftToAdjust -= lru.weight;

		// Remove node from the window
		lru.moveToTail(data.probation.head);
		lru.location = Location.PROBATION;
		data.window.size -= lru.weight;
	}

	/*
	 * Keep track of the adjustment amount that is left. The next maintenance
	 * invocation will look at this and attempt to adjust for it.
	 */
	data.window.maxSize += amountLeftToAdjust;
	data.protected.maxSize -= amountLeftToAdjust;
	data.adaptiveData.adjustment = -amountLeftToAdjust;
}
