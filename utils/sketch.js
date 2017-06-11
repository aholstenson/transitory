'use strict';

const hashcode = require('./hashcode');

function toPowerOfN(n) {
	return Math.pow(2, Math.ceil(Math.log(n) / Math.LN2));
}

function hash2(a) {
	a = (a ^ 61) ^ (a >>> 16);
    a = a + (a << 3);
    a = a ^ (a >>> 4);
    a = safeishMultiply(a, 0x27d4eb2d);
    a = a ^ (a >>> 15);
	return a;
}

function safeishMultiply(a, b) {
	return ((a & 0xffff) * b) + ((((a >>> 16) * b) & 0xffff) << 16);
}

/**
 * Count-min sketch suitable for use with W-TinyLFU. Similiar to a regular
 * count-min sketch but with a few important differences to achieve better
 * estimations:
 *
 * 1) Enforces that the width of the sketch is a power of 2.
 * 2) Uses a reset that decays all values by half when width * 10 additions
 *    have been made.
 */
module.exports = class CountMinSketch {
	constructor(width, depth, decay) {
		this._width = toPowerOfN(width);
		this._depth = depth;

		// Get the maximum size of values, assuming unsigned ints
		this._maxSize = Math.pow(2, Uint8Array.BYTES_PER_ELEMENT * 8) - 1;

		// Track additions and when to reset
		this._additions = 0;
		this._resetAfter = decay ? width * 10 : -1;

		// Create the table to store data in
		this._table = new Uint8Array(this._width * depth);
		this._random = Math.floor(Math.random() * 0xffffff) | 1;
	}

	_findIndex(h1, h2, d) {
		let h = h1 + safeishMultiply(h2, d);
		return d * this._width + (h & (this._width - 1));
	}

	update(hashCode) {
		const table = this._table;
		const maxSize = this._maxSize;

		const estimate = this.estimate(hashCode);

		const h2 = hash2(hashCode);
		let added = false;
		for(let i=0, n=this._depth; i<n; i++) {
			const idx = this._findIndex(hashCode, h2, i);
			const v = table[idx];
			if(v < maxSize && v === estimate) {
				table[idx] = Math.min(v + 1, maxSize);
				added = true;
			}
		}

		if(added && ++this._additions == this._resetAfter) {
			this._performReset();
		}
	}

	estimate(hashCode) {
		const table = this._table;
		const h2 = hash2(hashCode);

		let result = this._maxSize;
		for(let i=0, n=this._depth; i<n; i++) {
			const value = table[this._findIndex(hashCode, h2, i)];
			if(value < result) {
				result = value;
			}
		}

		return result;
	}

	_performReset() {
		const table = this._table;
		this._additions /= 2;
		for(let i=0, n=table.length; i<n; i++) {
			this._additions -= table[i] & 1;
			table[i] = Math.floor(table[i] >>> 1);
		}
	}

	static hash(key) {
		return hashcode(key);
	}

	static uint8(width, depth, decay=true) {
		return new CountMinSketch(width, depth, decay);
	}
}
