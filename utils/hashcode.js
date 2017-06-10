'use strict';

/**
 * Utility for calculating stable hashcodes for keys used in a cache.
 */
module.exports = function hashcode(obj) {
	switch(typeof obj) {
		case 'string':
		{
			let hash = 5381;
			for(let i=0, n=obj.length; i<n; i++) {
				hash = (hash * 33) ^ obj.charCodeAt(i);
			}
			hash >>> 0;
			return hash;
		}
		case 'number':
		{
			let hash = obj;
			hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
			hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
			hash = ((hash >> 16) ^ hash);
			return hash;
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
