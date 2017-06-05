'use strict';

const DATA = Symbol('data');
const maxSize = Symbol('maxSize');
const evict = Symbol('evict');

const WINDOW = Symbol('window');
const PROTECTED = Symbol('protected');
const PROBATION = Symbol('probation');

const CountMinSketch = require('../utils/sketch');

const percentInMain = 0.99;
const percentProtected = 0.8;

/**
 * Bounded cache implementation using W-TinyLFU to keep track of data.
 *
 * See https://arxiv.org/pdf/1512.00727.pdf for details about TinyLFU and
 * the W-TinyLFU optimization.
 */
class BoundedCache {
	constructor(options) {
		this[maxSize] = options.maxSize;

		const maxMain = Math.floor(percentInMain * options.maxSize);
		this[DATA] = {
			sketch: CountMinSketch.uint8(Math.floor(options.maxSize / 4) || 10, 4),

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
			}
		};
	}

	/**
	 * Get the maximum size this cache can be.
	 */
	get maxSize() {
		return this[maxSize];
	}

	/**
	 * Get the current size of the cache.
	 */
	get size() {
		return this[DATA].values.size;
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

		// Append the new node to the window space
		node.append(data.window.head);
		data.window.size++;

		// Register access to the key
		data.sketch.update(key);

		// Call evict to possibly evict an item
		this[evict]();

		// Return the value we replaced
		return old ? old.value : null;
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
	getIfPresent(key) {
		const data = this[DATA];

		const node = data.values.get(key);
		if(! node) {
			// This value does not exist in the cache
			return null;
		}

		// Register access to the key
		data.sketch.update(key);

		switch(node.location) {
			case WINDOW:
				// In window cache, marks a most recently used
				node.move(data.window.head);
				break;
			case PROBATION:
				// In SLRU probation segment, move to protected
				node.location = PROTECTED;
				node.move(data.protected.head);

				if(data.protected.size >= data.protected.maxSize) {
					/*
					 * There is now too many nodes in the protected segment
					 * so demote the least recently used.
					 */
					const lru = data.protected.head.next;
					lru.location = PROBATION;
					lru.move(data.probation.head);
				} else {
					// Plenty of room, keep track of the size
					data.protected.size++;
				}
				break;
			case PROTECTED:
				// SLRU protected segment, mark as most recently used
				node.move(data.protected.head);
				break;
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
					data.protected.size--;
					break;
				case WINDOW:
					// Node was in window, reduce window size
					data.window.size--;
					break;
			}

			// Remove from main value storage
			data.values.delete(key);

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

	[evict]() {
		const data = this[DATA];
		if(data.window.size <= data.window.maxSize) return;

		/*
		 * Evict the least recently used item in the window space to the
		 * probation segment.
		 */
		const first = data.window.head.next;

		first.move(data.probation.head);
		first.location = PROBATION;

		data.window.size--;

		// Check if we should evict something from the entire cache
		if(data.values.size <= this[maxSize]) return;

		const probation = data.probation.head.next;

		// Estimate how often the two items have been accessed
		const freqFirst = data.sketch.estimate(first.key);
		const freqProbation = data.sketch.estimate(probation.key);

		// Remove item on probabiton if used less that newly evicted
		const toRemove = freqFirst > freqProbation ? probation : first;
		data.values.delete(toRemove.key);
		toRemove.remove();
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
