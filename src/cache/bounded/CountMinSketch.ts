import { hashcode } from './hashcode';
import { KeyType } from '../KeyType';

function toPowerOfN(n: number) {
	return Math.pow(2, Math.ceil(Math.log(n) / Math.LN2));
}

function hash2(a: number) {
	a = (a ^ 61) ^ (a >>> 16);
	a = a + (a << 3);
	a = a ^ (a >>> 4);
	a = safeishMultiply(a, 0x27d4eb2d);
	a = a ^ (a >>> 15);
	return a;
}

function safeishMultiply(a: number, b: number) {
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
export class CountMinSketch {
	private readonly width: number;
	private readonly depth: number;

	public readonly maxSize: number;
	public readonly halfMaxSize: number;
	public readonly slightlyLessThanHalfMaxSize: number;

	private additions: number;
	public readonly resetAfter: number;

	private table: Uint8Array;

	constructor(width: number, depth: number, decay: boolean) {
		this.width = toPowerOfN(width);
		this.depth = depth;

		// Get the maximum size of values, assuming unsigned ints
		this.maxSize = Math.pow(2, Uint8Array.BYTES_PER_ELEMENT * 8) - 1;
		this.halfMaxSize = this.maxSize / 2;
		this.slightlyLessThanHalfMaxSize = this.halfMaxSize - Math.max(this.halfMaxSize / 4, 1);

		// Track additions and when to reset
		this.additions = 0;
		this.resetAfter = decay ? width * 10 : -1;

		// Create the table to store data in
		this.table = new Uint8Array(this.width * depth);
	}

	private findIndex(h1: number, h2: number, d: number) {
		const h = h1 + safeishMultiply(h2, d);
		return d * this.width + (h & (this.width - 1));
	}

	public update(hashCode: number) {
		const table = this.table;
		const maxSize = this.maxSize;

		const estimate = this.estimate(hashCode);

		const h2 = hash2(hashCode);
		let added = false;
		for(let i=0, n=this.depth; i<n; i++) {
			const idx = this.findIndex(hashCode, h2, i);
			const v = table[idx];
			if(v + 1 < maxSize && v <= estimate) {
				table[idx] = v + 1;
				added = true;
			}
		}

		if(added && ++this.additions === this.resetAfter) {
			this.performReset();
		}
	}

	public estimate(hashCode: number) {
		const table = this.table;
		const h2 = hash2(hashCode);

		let result = this.maxSize;
		for(let i=0, n=this.depth; i<n; i++) {
			const value = table[this.findIndex(hashCode, h2, i)];
			if(value < result) {
				result = value;
			}
		}

		return result;
	}

	private performReset() {
		const table = this.table;
		this.additions /= 2;
		for(let i=0, n=table.length; i<n; i++) {
			this.additions -= table[i] & 1;
			table[i] = Math.floor(table[i] >>> 1);
		}
	}

	public static hash(key: KeyType) {
		return hashcode(key);
	}

	public static uint8(width: number, depth: number, decay=true) {
		return new CountMinSketch(width, depth, decay);
	}
}
