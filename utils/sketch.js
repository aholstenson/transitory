'use strict';

function random() {
	return (Math.floor(Math.random() * 30) << 1) | 1;
}

module.exports = class CountMinSketch {
	constructor(width, depth, array=Uint32Array) {
		this._width = width;
		this._depth = depth;

		// Get the maximum size of values, assuming unsigned ints
		this._maxSize = Math.pow(2, array.BYTES_PER_ELEMENT * 8);

		// Track additions and when to reset
		this._additions = 0;
		this._resetAfter = width * depth * 10;

		// Create the table to store data in
		this._table = new array(width * depth);
		this._hashA = new Uint8Array(depth);
		for(let i=0; i<depth; i++) {
			this._hashA[i] = random();
		}

	}

	_findIndex(hashCode, d) {
		let hash = (hashCode * this._hashA[d]) & 0xFFFFFFFF;
		hash += hash >>> 32;
		return d * this._width + hash % this._width;
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
			table[i] = Math.floor(table[i] / 2);
		}
	}

	static uint32(width, depth) {
		return new CountMinSketch(width, depth, Uint32Array);
	}

	static uint8(width, depth) {
		return new CountMinSketch(width, depth, Uint8Array);
	}
}
