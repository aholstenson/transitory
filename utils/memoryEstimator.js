'use strict';

const OBJ_OVERHEAD = 4;

module.exports = function memoryEstimator(value) {
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
				let size = OBJ_OVERHEAD;
				value.forEach(v => size += memoryEstimator(v));
				return size;
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
};
