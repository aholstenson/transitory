'use strict';

const hashcode = require('./hashcode');

function random() {
	return (Math.floor((Math.random() * 30) << 1) | 1);
}

function toPowerOfN(n) {
	return Math.pow(2, Math.ceil(Math.log(n) / Math.LN2));
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
	constructor(width, depth, array=Uint32Array) {
		this._width = toPowerOfN(width);
		this._depth = depth;

		// Get the maximum size of values, assuming unsigned ints
		this._maxSize = Math.pow(2, array.BYTES_PER_ELEMENT * 8);

		// Track additions and when to reset
		this._additions = 0;
		this._resetAfter = width * 10;

		// Create the table to store data in
		this._table = new array(this._width * depth);
		this._hashA = new Uint32Array(depth);
		for(let i=0; i<depth; i++) {
			this._hashA[i] = random();
		}
	}

	_findIndex(hashCode, d) {
		hashCode *= this._hashA[d];
		return d * this._width + hashCode % this._width;
	}

	update(hashCode, valueToAdd=1) {
		const table = this._table;
		const maxSize = this._maxSize;

		let added = false;
		for(let i=0, n=this._depth; i<n; i++) {
			const idx = this._findIndex(hashCode, i);
			const v = table[idx];
			if(v < maxSize) {
				table[idx] = Math.min(v + valueToAdd, maxSize);
				added = true;
			}
		}

		if(added && ++this._additions == this._resetAfter) {
			this._performReset();
		}
	}

	estimate(hashCode) {
		const table = this._table;
		let result = this._maxSize;
		for(let i=0, n=this._depth; i<n; i++) {
			const value = table[this._findIndex(hashCode, i)];
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

	static uint32(width, depth) {
		return new CountMinSketch(width, depth, Uint32Array);
	}

	static uint8(width, depth) {
		return new CountMinSketch(width, depth, Uint8Array);
	}
}
