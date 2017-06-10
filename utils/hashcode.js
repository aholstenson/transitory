'use strict';

/*eslint no-fallthrough: "off"*/

const C1 = 0xcc9e2d51;
const C2 = 0x1b873593;

function safeishMultiply(a, b) {
	return ((a & 0xffff) * b) + ((((a >>> 16) * b) & 0xffff) << 16);
}

/**
 * Utility for calculating stable hashcodes for keys used in a cache.
 */
module.exports = function hashcode(obj, seed=0) {
	switch(typeof obj) {
		case 'string':
		{
			let hash = seed;
			let n = obj.length & ~0x3;
			for(let i=0; i<n; i+=4) {
				let k1 = ((obj.charCodeAt(i) & 0xffff)) |
					((obj.charCodeAt(i + 1) & 0xffff) << 8) |
					((obj.charCodeAt(i + 2) & 0xffff) << 16) |
					((obj.charCodeAt(i + 3) & 0xffff) << 24);

				k1 = safeishMultiply(k1, C1);
				k1 = (k1 << 15) | (k1 >>> 17);
				k1 = safeishMultiply(k1, C2);

				hash ^= k1;
				hash = (hash << 13) | (hash >>> 19);
				hash = hash * 5 + 0xe6546b64;
			}

			let k1 = 0;
			switch(obj.length & 3) {
				case 3:
					k1 ^= (obj.charCodeAt(n + 2) & 0xffff) << 16;
				case 2:
					k1 ^= (obj.charCodeAt(n + 1) & 0xffff) << 8;
				case 1:
					k1 ^= (obj.charCodeAt(n) & 0xffff);

					k1 = safeishMultiply(k1, C1);
					k1 = (k1 << 15) | (k1 >>> 17);
					k1 = safeishMultiply(k1, C2);

					hash ^= k1;
			}

			hash ^= obj.length;

			hash ^= hash >>> 16;
			hash = safeishMultiply(hash, 0x85ebca6b);
			hash ^= hash >>> 13;
			hash = safeishMultiply(hash, 0xc2b2ae35);
			hash ^= hash >>> 16;

			return hash >>> 0;
		}
		case 'number':
		{
			let hash = obj;

			hash = safeishMultiply(hash, C1);
			hash = (hash << 15) | (hash >>> 17);
			hash = safeishMultiply(hash, C2);

			hash = (hash << 13) | (hash >>> 19);
			hash = hash * 5 + 0xe6546b64;

			hash ^= hash >>> 16;
			hash = safeishMultiply(hash, 0x85ebca6b);
			hash ^= hash >>> 13;
			hash = safeishMultiply(hash, 0xc2b2ae35);
			hash ^= hash >>> 16;

			hash ^= 1;

			return hash >>> 0;
		}
		case 'boolean':
		{
			return obj ? 1231 : 1237;
		}
		case 'undefined':
			return 0;
		default:
			throw new Error('The given value can not be used as a key in a cache, value was: ' + obj.toString());
	}
};
