import { BoundlessCache } from '../src/cache/boundless';
import { RemovalHelper } from './removal-helper';
import { RemovalReason } from '../src/cache/removal-reason';

describe('BoundlessCache', function() {
	it('Can create', function() {
		new BoundlessCache<string, number>({})
	});

	it('Set value in cache', function() {
		const cache = new BoundlessCache({});
		cache.set('key', 'value');

		expect(cache.has('key')).toEqual(true);
		expect(cache.getIfPresent('key')).toEqual('value');
	});

	it('Get non-existent value in cache', function() {
		const cache = new BoundlessCache({});

		expect(cache.getIfPresent('key')).toEqual(null);
	});

	it('Delete works', function() {
		const cache = new BoundlessCache({});
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.getIfPresent('key')).toEqual(null);
	});

	it('Clear for empty', function() {
		const cache = new BoundlessCache({});
		cache.clear();
		expect(cache.size).toEqual(0);
	});

	it('Clear for single', function() {
		const cache = new BoundlessCache({});
		cache.set('key', 'value');

		cache.clear();
		expect(cache.size).toEqual(0);
	});

	it('Getting keys work', function() {
		const cache = new BoundlessCache({});
		cache.set('key', 'value');

		expect(cache.keys()).toEqual([ 'key' ]);
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
	})
});
