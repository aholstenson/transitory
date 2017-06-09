'use strict';

const { DATA, ON_REMOVE } = require('./symbols');

const evict = Symbol('evict');

const WINDOW = Symbol('window');
const PROTECTED = Symbol('protected');
const PROBATION = Symbol('probation');

const RemovalCause = require('../utils/removal-cause');
const CountMinSketch = require('../utils/sketch');
const hashIt = require('hash-it');

const percentInMain = 0.99;
const percentProtected = 0.8;
const percentOverflow = 0.15;

/**
 * Get the width of the sketch by rounding to the nearest power of 2.
 */
function roundSketchSize(maxSize) {
	const c = Math.floor(maxSize / 4) || 1;
	return Math.pow(2, Math.ceil(Math.log(c) / Math.log(2)));
}

/**
 * Bounded cache implementation using W-TinyLFU to keep track of data.
 *
 * See https://arxiv.org/pdf/1512.00727.pdf for details about TinyLFU and
 * the W-TinyLFU optimization.
 */
class BoundedCache {
	constructor(options) {
		const maxMain = Math.floor(percentInMain * options.maxSize);
		const sketchWidth = options.weigher ? 256 : roundSketchSize(options.maxSize);
		this[DATA] = {
			maxSize: options.weigher ? -1 : options.maxSize,
			removalListener: options.removalListener,

			weigher: options.weigher,
			weightedMaxSize: options.maxSize,
			weightedSize: 0,

			sketch: CountMinSketch.uint8(sketchWidth, 4),
			sketchGrowLimit: sketchWidth * 4,

			values: new Map(),

			// Tracking of the window cache, around 1% of the total cache
			window: {
				head: new Node(),
				size: 0,
				maxSize: options.maxSize - maxMain
			},

			// SLRU protected segment, 80% * 99% of the total cache
			protected: {
				head: new Node(),
				size: 0,
				maxSize: Math.floor(maxMain * percentProtected)
			},

			// SLRU probation segment, 20% * 99% of the total cache
			probation: {
				head: new Node()
			},

			// Timeout used to schedule evictions
			evictionTimeout: 0,
			// The maximum size we can temporarily be grow before an eviction is forced
			forceEvictionLimit: options.maxSize + Math.max(Math.floor(options.maxSize * percentOverflow), 5),
			// The time to wait before an eviction is triggered by a set
			evictionInterval: 5000
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
	set(key, value) {
		const data = this[DATA];

		const old = data.values.get(key);

		// Create a node and add it to the backing map
		const node = new Node(key, value);
		data.values.set(key, node);

		if(data.weigher) {
			node.weight = data.weigher(key, value);
		}

		// Update our weight
		data.weightedSize += node.weight;
		if(old) {
			data.weightedSize -= old.weight;
		}

		// Check if we reached the grow limit of the sketch
		if(data.weighter && data.values.size >= data.sketchGrowLimit) {
			const sketchWidth = data.values.width * 2;
			data.sketch = CountMinSketch.uint8(sketchWidth, 4);
			data.sketchGrowLimit = sketchWidth * 4;
		}

		// Append the new node to the window space
		node.append(data.window.head);
		data.window.size += node.weight;

		// Register access to the key
		data.sketch.update(node.hashCode);

		// Schedule eviction
		if(data.weightedSize >= data.forceEvictionLimit) {
			this[evict]();
		} else if(! data.evictionTimeout) {
			data.evictionTimeout = setTimeout(() => this[evict](), data.evictionInterval);
		}

		// Return the value we replaced
		if(old) {
			this[ON_REMOVE](key, old.value, RemovalCause.REPLACED);
			return old.value;
		} else {
			return null;
		}
	}

	/**
	 * Get a previously cached value.
	 */
	get(key) {
		return this.getIfPresent(key);
	}

	/**
	 * Get a value from this cache if it has been previously cached.
	 */
	getIfPresent(key, recordStats=true) {
		const data = this[DATA];

		const node = data.values.get(key);
		if(! node) {
			// This value does not exist in the cache
			return null;
		}

		if(recordStats) {
			// Register access to the key
			data.sketch.update(node.hashCode);

			switch(node.location) {
				case WINDOW:
					// In window cache, mark as most recently used
					node.move(data.window.head);
					break;
				case PROBATION:
					// In SLRU probation segment, move to protected
					node.location = PROTECTED;
					node.move(data.protected.head);

					while(data.protected.size > data.protected.maxSize) {
						/*
						 * There is now too many nodes in the protected segment
						 * so demote the least recently used.
						 */
						const lru = data.protected.head.next;
						lru.location = PROBATION;
						lru.move(data.probation.head);
						data.protected.size -= lru.weight;
					}

					// Plenty of room, keep track of the size
					data.protected.size += node.weight;

					break;
				case PROTECTED:
					// SLRU protected segment, mark as most recently used
					node.move(data.protected.head);
					break;
			}
		}

		return node.value;
	}

	/**
	 * Delete any value associated with the given key from the cache.
	 */
	delete(key) {
		const data = this[DATA];

		const node = data.values.get(key);
		if(node) {
			// Remove the node from its current list
			node.remove();

			switch(node.location) {
				case PROTECTED:
					// Node was protected, reduce the size
					data.protected.size -= node.weight;
					break;
				case WINDOW:
					// Node was in window, reduce window size
					data.window.size -= node.weight;
					break;
			}

			// Reduce overall weight
			data.weightedSize -= node.weight;

			// Remove from main value storage
			data.values.delete(key);

			this[ON_REMOVE](key, node.value, RemovalCause.EXPLICIT);

			return node.value;
		}

		return null;
	}

	/**
	 * Check if a certain value exists in the cache.
	 */
	has(key) {
		const data = this[DATA];
		return data.values.has(key);
	}

	[ON_REMOVE](key, value, cause) {
		const data = this[DATA];
		if(data.removalListener) {
			data.removalListener(key, value, cause);
		}
	}

	[evict]() {
		const data = this[DATA];

		/*
		* Evict the least recently used item in the window space to the
		* probation segment until we are below the maximum size.
		*/
		let evictedToProbation = 0;
		while(data.window.size > data.window.maxSize) {
			const first = data.window.head.next;

			first.move(data.probation.head);
			first.location = PROBATION;

			data.window.size -= first.weight;

			evictedToProbation++;
		}

		/*
		 * Evict items for real until we are below our maximum size.
		 */
		while(data.weightedSize > data.weightedMaxSize) {
			const probation = data.probation.head.next;
			const evicted = evictedToProbation == 0 ? null : data.probation.head.previous;

			const hasProbation = probation != data.probation.head;
			const hasEvicted = evicted && evicted != data.probation.head;

			let toRemove;
			if(! hasProbation && ! hasEvicted) {
				// TODO: Probation queue is empty, how is this handled?
				break;
			} else if(! hasEvicted) {
				toRemove = probation;
			} else if(! hasProbation) {
				toRemove = evicted;

				evictedToProbation--;
			} else {
				// Estimate how often the two items have been accessed
				const freqEvicted = data.sketch.estimate(evicted.hashCode);
				const freqProbation = data.sketch.estimate(probation.hashCode);

				if(freqEvicted > freqProbation) {
					toRemove = probation;
				} else if(freqEvicted == freqProbation) {
					// Exactly the same count, remove something randomly
					toRemove = Math.random() < 0.5 ? probation : evicted;
				} else {
					toRemove = evicted;
				}

				evictedToProbation--;
			}

			data.values.delete(toRemove.key);
			toRemove.remove();
			data.weightedSize -= toRemove.weight;

			this[ON_REMOVE](toRemove.key, toRemove.value, RemovalCause.SIZE);
		}

		if(data.evictionTimeout) {
			data.evictionTimeout = null;
			clearTimeout(data.evictionTimeout);
		}
	}

	__await() {
		this[evict]();
	}
}

module.exports = BoundedCache;

/**
 * Node in a double-linked list.
 */
class Node {
	constructor(key, value) {
		this.key = key;
		this.value = value;
		this.hashCode = hashIt(key);
		this.weight = 1;

		this.location = WINDOW;

		this.previous = this;
		this.next = this;
	}

	remove() {
		this.previous.next = this.next;
		this.next.previous = this.previous;
		this.next = this.previous = this;
	}

	append(head) {
		const tail = head.previous;
		head.previous = this;
		tail.next = this;
		this.next = head;
		this.previous = tail;
	}

	move(head) {
		this.remove();
		this.append(head);
	}
}
