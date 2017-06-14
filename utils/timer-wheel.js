'use strict';

/**
 * A timer wheel for variable expiration of items in a cache. Stores items in
 * layers that are circular buffers that represent a time span.
 *
 * This implementation takes some extra care to work with Number as they are
 * actually doubles and shifting turns them into 32-bit ints. To represent
 * time we need more than 32-bits so to fully support things this implementation
 * uses a base which is removed from all of the numbers to make them fit into
 * 32-bits.
 *
 * Based on an idea by Ben Manes implemented in Caffeine.
 */

function toPowerOfN(n) {
	return Math.pow(2, Math.ceil(Math.log(n) / Math.LN2));
}

const LAYERS = [ 64, 64, 32, 4, 1 ];
const SPANS = [	toPowerOfN(1000), toPowerOfN(60000), toPowerOfN(3600000), toPowerOfN(86400000), LAYERS[3] * toPowerOfN(86400000), LAYERS[3] * toPowerOfN(86400000) ];

const SHIFTS = SPANS.slice(0, SPANS.length-1).map(span => 1 + Math.floor(Math.log(span - 1) * Math.LOG2E));

module.exports = class TimerWheel {
	constructor(evict) {
		this.evict = evict;

		this.base = Date.now();
		this.layers = LAYERS.map(b => {
			const result = new Array(b);
			for(let i=0; i<b; i++) {
				result[i] = new Node();
			}
			return result;
		});

		this.time = 0;
	}

	get localTime() {
		return Date.now() - this.base;
	}

	_findBucket(node) {
		let d = node.time - this.time;
		if(d <= 0) return null;

		let layers = this.layers;
		for(let i=0, n=layers.length-1; i<n; i++) {
			if(d >= SPANS[i + 1]) continue;

			const ticks = node.time >>> SHIFTS[i];
			const index = ticks & (layers[i].length - 1);
			return layers[i][index];
		}
		return layers[layers.length - 1][0];
	}

	advance(localTime) {
		const previous = this.time;
		const time = localTime || this.localTime;
		this.time = time;

		const layers = this.layers;

		// Holder for expired keys
		let expired = null;

		/*
		 * Go through all of the layers on the wheel, evict things and move
		 * other stuff around.
		 */
		for(let i=0, n=SHIFTS.length; i<n; i++) {
			const previousTicks = previous >>> SHIFTS[i];
			const timeTicks = time >>> SHIFTS[i];

			// At the same tick, no need to keep working down the layers
			if(timeTicks <= previousTicks) break;

			const wheel = layers[i];

			// Figure out the actual buckets to use
			let start, end;
			if(time - previous >= SPANS[i + 1]) {
				start = 0;
				end = wheel.length - 1;
			} else {
				start = previousTicks & (SPANS[i] - 1);
				end = timeTicks & (SPANS[i] - 1);
			}

			// Go through all of the buckets and move stuff around
			for(let i=start; i<=end; i++) {
				const head = wheel[i & (wheel.length - 1)];

				let node = head.next;

				head.previous = head;
				head.next = head;

				while(node != head) {
					const next = node.next;
					node.remove();

					if(node.time <= time) {
						// This node has expired, add it to the queue
						if(! expired) expired = [];
						expired.push(node.key);
					} else {
						// Find a new bucket to put this node in
						let b = this._findBucket(node);
						node.append(b);
					}
					node = next;
				}
			}
		}

		if(expired) {
			this.evict(expired);
		}
	}

	/**
	 * Create a node that that helps with tracking when a key and value
	 * should be evicted.
	 */
	node(key, value) {
		return new Node(this, key, value);
	}

	/**
	 * Schedule eviction of the given node at the given timestamp.
	 */
	schedule(node, time) {
		node.remove();

		if(time <= 0) return false;

		node.time = this.localTime + time;

		const parent = this._findBucket(node);
		if(! parent) return false;

		node.append(parent);
		return true;
	}

	/*
	 * Remove the given node from the wheel.
	 */
	deschedule(node) {
		node.remove();
	}
}

/* Node in a doubly linked list. More or less the same as used in BoundedCache */
class Node {
	constructor(wheel, key, value) {
		this.wheel = wheel;

		this.key = key;
		this.value = value;

		this.previous = this;
		this.next = this;
	}

	isExpired() {
		return this.wheel.localTime > this.time;
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
