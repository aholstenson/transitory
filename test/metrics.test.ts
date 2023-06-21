import { newCache as newCacheImpl } from '../src/builder';
import { StandardMetrics } from '../src/cache';
import { BoundlessCache } from '../src/cache/boundless';
import { KeyType } from '../src/cache/KeyType';
import { RemovalReason } from '../src/cache/RemovalReason';

import { RemovalHelper } from './removal-helper';

/**
 *
 */
function newCache<K extends KeyType, V>() {
	return newCacheImpl<K, V>().metrics().build();
}

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

	it('Records stats properly', function() {
		const metrics = new StandardMetrics();

		metrics.count(1, 1);
		expect(metrics).toMatchObject({ hits: 1, misses: 1 });

		metrics.hit();
		expect(metrics).toMatchObject({ hits: 2, misses: 1 });

		metrics.hit(2);
		expect(metrics).toMatchObject({ hits: 4, misses: 1 });

		metrics.record(false);
		expect(metrics).toMatchObject({ hits: 4, misses: 2 });

		metrics.miss(-1);
		expect(metrics).toMatchObject({ hits: 4, misses: 1 });
	});

	describe('Removal listeners', function() {
		it('Triggers on delete', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundlessCache<string, number>({
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			expect(removal.didRemove).toEqual(false);

			cache.delete('one');
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.EXPLICIT);
		});

		it('Triggers on set', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundlessCache<string, number>({
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			expect(removal.didRemove).toEqual(false);

			cache.set('one', 4321);
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.REPLACED);
		});

		it('Triggers on clear', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundlessCache<string, number>({
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			expect(removal.didRemove).toEqual(false);

			cache.clear();
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.EXPLICIT);
		});
	});
});
