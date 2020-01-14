import { RemovalHelper } from './removal-helper';

import { BoundedCache } from '../src/cache/bounded';
import { RemovalReason } from '../src/cache/RemovalReason';

describe('BoundedCache', function() {
	it('Can create', function() {
		new BoundedCache({
			maxSize: 50
		})
	});

	it('Set value in cache', function() {
		const cache = new BoundedCache<string, string>({ maxSize: 50 });
		cache.set('key', 'value');

		expect(cache.has('key')).toEqual(true);
		expect(cache.getIfPresent('key')).toEqual('value');
		expect(cache.peek('key')).toEqual('value');

		cache.cleanUp();
	});

	it('Get non-existent value in cache', function() {
		const cache = new BoundedCache({ maxSize: 50 });

		expect(cache.getIfPresent('key')).toEqual(null);
	});

	it('Delete works', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.getIfPresent('key')).toEqual(null);

		cache.cleanUp();
	});

	it('Weighted size is correct', function() {
		const cache = new BoundedCache({ maxSize: 50 });

		expect(cache.weightedSize).toEqual(0);
		expect(cache.maxSize).toEqual(50);

		cache.set('key', 'value');
		expect(cache.weightedSize).toEqual(1);

		cache.set('key2', 'value');
		expect(cache.weightedSize).toEqual(2);

		cache.set('key', 'value');
		expect(cache.weightedSize).toEqual(2);

		cache.delete('key');
		expect(cache.weightedSize).toEqual(1);

		cache.cleanUp();
	});

	it('Clear for empty', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.clear();
		expect(cache.size).toEqual(0);
	});

	it('Clear for single', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		cache.clear();
		expect(cache.size).toEqual(0);
	});

	it('Getting keys work', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		expect(cache.keys()).toEqual([ 'key' ]);
		cache.cleanUp();
	});

	describe('Eviction', function() {
		it('Does not exceed maxSize', function() {
			const maxSize = 10;
			const cache = new BoundedCache({ maxSize });

			for(let i=0; i<maxSize*2; i++) {
				cache.set(i, i);
				cache.cleanUp();
			}

			expect(cache.size).toEqual(maxSize);
		});

		it('Eviction order for small cache', function() {
			const maxSize = 3;
			const cache = new BoundedCache({ maxSize });

			for(let i=0; i<maxSize; i++) {
				cache.set(i, i);
			}

			cache.getIfPresent(0);
			cache.getIfPresent(2);

			cache.set(maxSize, maxSize);
			cache.cleanUp();

			expect(cache.getIfPresent(1)).toEqual(null);
			expect(cache.getIfPresent(2)).toEqual(2);
			expect(cache.getIfPresent(3)).toEqual(3);
		});

		it('Keys evicted before array returned', function() {
			const maxSize = 10;
			const cache = new BoundedCache({ maxSize });

			for(let i=0; i<maxSize*2; i++) {
				cache.set(i, i);
			}

			expect(cache.keys().length).toEqual(maxSize);
			cache.cleanUp();
		});
	});

	describe('Removal listeners', function() {
		it('Triggers on delete', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundedCache({
				maxSize: 10,
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			cache.cleanUp();
			expect(removal.didRemove).toEqual(false);

			cache.delete('one');
			cache.cleanUp();
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.EXPLICIT);
		});

		it('Triggers on set', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundedCache({
				maxSize: 10,
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			cache.cleanUp();
			expect(removal.didRemove).toEqual(false);

			cache.set('one', 4321);
			cache.cleanUp();
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.REPLACED);
		});

		it('Triggers on evict', function() {
			const removal = new RemovalHelper<number, number>();
			const cache = new BoundedCache({
				maxSize: 5,
				removalListener: removal.listener
			});

			for(let i=0; i<5; i++) {
				cache.set(i, 1234);
			}
			cache.cleanUp();
			expect(removal.didRemove).toEqual(false);

			cache.getIfPresent(0);
			cache.getIfPresent(1);
			cache.getIfPresent(2);
			cache.getIfPresent(3);

			cache.set(5, 1234);
			cache.cleanUp();
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual(4);
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.SIZE);
		});

		it('Triggers on clear', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = new BoundedCache({
				maxSize: 10,
				removalListener: removal.listener
			});

			cache.set('one', 1234);
			cache.cleanUp();
			expect(removal.didRemove).toEqual(false);

			cache.clear();
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.EXPLICIT);
		});
	});

	describe('Weighted', function() {
		it('Can set', function() {
			const cache = new BoundedCache<string, string>({
				maxSize: 50,
				weigher: (key, value) => 2
			});
			cache.set('key', 'value');

			expect(cache.has('key')).toEqual(true);
			expect(cache.getIfPresent('key')).toEqual('value');

			cache.cleanUp();
		});

		it('Does not exceed maxSize', function() {
			const cache = new BoundedCache<number, number>({
				maxSize: 50,
				weigher: (key, value) => 10
			});

			for(let i=0; i<6; i++) {
				cache.set(i, i);
			}

			cache.cleanUp();

			expect(cache.size).toEqual(5);
		});

		it('Variable sizes do not exceed maxSize', function() {
			const cache = new BoundedCache<number, number>({
				maxSize: 500,
				weigher: (key, value) => value
			});

			for(let i=0; i<500; i++) {
				cache.set(i, i);
			}

			cache.cleanUp();

			expect(cache.weightedSize).toBeLessThanOrEqual(500);
		});

		it('Variable sizes with random access do not exceed maxSize', function() {
			const cache = new BoundedCache<number, number>({
				maxSize: 500,
				weigher: (key, value) => value
			});

			randomTrace(cache, 400, 5000);

			cache.cleanUp();

			expect(cache.weightedSize).toBeLessThanOrEqual(500);
		});
	});
});

function randomTrace(cache: BoundedCache<number, number>, max: number, n: number) {
	for(let i=0; i<n; i++) {
		const id = Math.floor(Math.random() * max);
		let c = cache.getIfPresent(id);
		if(c == null) {
			cache.set(id, id);
		}
	}
}
