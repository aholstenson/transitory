import { CacheNode } from '../cache/cache-node';

const OBJ_OVERHEAD = 4;

export function memoryEstimator(value: any): number {
	switch(typeof value) {
		case 'string':
			return OBJ_OVERHEAD + value.length * 2;
		case 'boolean':
			return 4;
		case 'number':
			return 8;
		case 'object':
		{
			if(typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
				return OBJ_OVERHEAD + value.length;
			} else if(Array.isArray(value)) {
				let arraySize = OBJ_OVERHEAD;
				for(const v of value) {
					arraySize += memoryEstimator(v);
				}
				return arraySize;
			} else if(value instanceof CacheNode) {
				// Treat cache nodes as having a key and value field
				return OBJ_OVERHEAD
					+ OBJ_OVERHEAD + memoryEstimator(value.key)
					+ OBJ_OVERHEAD + memoryEstimator(value.value);
			}

			let size = OBJ_OVERHEAD;
			Object.keys(value).forEach(key => {
				size += OBJ_OVERHEAD;

				size += memoryEstimator(key);
				size += memoryEstimator(value[key]);
			});
			return size;
		}
		default:
			return 0;
	}
}
