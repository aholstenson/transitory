
import { CacheNode } from '../src/cache/CacheNode';
import { memoryEstimator } from '../src/utils/memoryEstimator';

describe('memoryEstimator', function() {
	it('string', function() {
		expect(memoryEstimator('kaka')).toEqual(12);
	});

	it('number', function() {
		expect(memoryEstimator(2)).toEqual(8);
	});

	it('boolean', function() {
		expect(memoryEstimator(false)).toEqual(4);
	});

	it('object', function() {
		expect(memoryEstimator({ kaka: 2 })).toEqual(28);
	});

	it('array', function() {
		expect(memoryEstimator([ 2, 'kaka' ])).toEqual(24);
	});

	it('CacheNode', function() {
		expect(memoryEstimator(new CacheNode('key', { kaka: 2 }))).toEqual(50);
	});
});
