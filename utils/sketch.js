'use strict';

function random() {
	const max = 50000;
	const min = 0;
	return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = class CountMinSketch {
	constructor(width, depth, array=Uint32Array) {
		this._width = width;
		this._depth = depth;

		// Get the maximum size of values, assuming unsigned ints
		this._maxSize = Math.pow(2, array.BYTES_PER_ELEMENT * 8);

		// Track additions and when to reset
		this._additions = 0;
		this._resetAfter = width * 10;

		// Create the table to store data in
		this._table = new array(width * depth);
		this._hashA = new Uint32Array(depth);
		for(let i=0; i<depth; i++) {
			this._hashA[i] = random();
		}
	}

	_findIndex(hashCode, d) {
		const hash = hashCode + this._hashA[d];
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
		for(let i=0, n=table.length; i<n; i++) {
			table[i] = Math.floor(table[i] / 2);
		}

		this._additions = 0;
	}

	static uint32(width, depth) {
		return new CountMinSketch(width, depth, Uint32Array);
	}

	static uint8(width, depth) {
		return new CountMinSketch(width, depth, Uint8Array);
	}
}
