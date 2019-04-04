import { KeyType } from '../src/cache/key-type';

import { BoundlessCache } from '../src/cache/boundless';
import { MetricsCache } from '../src/cache/metrics/index';

function newCache<K extends KeyType, V>() {
	return new MetricsCache(new BoundlessCache<K, V>({}));
};

describe('MetricsCache', function() {
	it('Can create', function() {
		newCache();
	});

	it('Set and get value in cache', function() {
		const cache = newCache();
		cache.set('key', 'value');

		expect(cache.has('key')).toEqual(true);
		expect(cache.getIfPresent('key')).toEqual('value');

		expect(cache.metrics.hits).toEqual(1);
		expect(cache.metrics.misses).toEqual(0);
		expect(cache.metrics.hitRate).toEqual(1.0);
	});

	it('Get non-existent value in cache', function() {
		const cache = newCache();

		expect(cache.getIfPresent('key')).toEqual(null);

		expect(cache.metrics.hits).toEqual(0);
		expect(cache.metrics.misses).toEqual(1);
		expect(cache.metrics.hitRate).toEqual(0);
	});

	it('Get without recording stats', function() {
		const cache = newCache();

		expect(cache.peek('key')).toEqual(null);

		expect(cache.metrics.hits).toEqual(0);
		expect(cache.metrics.misses).toEqual(0);
		expect(cache.metrics.hitRate).toEqual(1);
	});

	it('Peek without recording stats', function() {
		const cache = newCache();

		expect(cache.peek('key')).toEqual(null);

		expect(cache.metrics.hits).toEqual(0);
		expect(cache.metrics.misses).toEqual(0);
		expect(cache.metrics.hitRate).toEqual(1);
	});
});
