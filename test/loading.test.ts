
import { BoundlessCache } from '../src/cache/boundless';
import { DefaultLoadingCache } from '../src/cache/loading';
import { KeyType } from '../src/cache/key-type';
import { Loader } from '../src/cache/loading/loader';

import { RemovalHelper } from './removal-helper';
import { RemovalReason } from '../src/cache/removal-reason';

function newCache<K extends KeyType, V>(loader?: Loader<K, V>) {
	return new DefaultLoadingCache({
		loader: loader,
		parent: new BoundlessCache<K, V>({})
	});
}

describe('LoadingCache', function() {
	it('Can create', function() {
		newCache();
	});

	it('Set value in cache', function() {
		const cache = newCache<string, string>();
		cache.set('key', 'value');

		expect(cache.has('key')).toEqual(true);
		expect(cache.getIfPresent('key')).toEqual('value');
		expect(cache.get('key')).toBeInstanceOf(Promise);

		return cache.get('key')
			.then((v: string) => expect(v).toEqual('value'));
	});

	it('Get non-existent value in cache', function() {
		const cache = newCache<string, string>();

		expect(cache.getIfPresent('key')).toEqual(null);

		try {
			cache.get('key');
			fail();
		} catch(ex) {
		}
	});

	it('Delete works', function() {
		const cache = newCache<string, string>();
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.getIfPresent('key')).toEqual(null);
	});

	it('Loads non-existent via global loader', function() {
		const cache = newCache<number, number>(id => -id);

		return cache.get(100)
			.then((v: number) => expect(v).toEqual(-100));
	});

	it('Loads non-existent via local loader', function() {
		const cache = newCache<number, number>();

		return cache.get(100, key => key*2)
			.then((v: number) => expect(v).toEqual(200));
	});

	it('Loads non-existent via global loader with Promise', function() {
		const cache = newCache<number, number>(key => value(key / 2));

		return cache.get(100)
			.then((v: number) => expect(v).toEqual(50));
	});

	it('Non-existent failure via global loader with Promise', function() {
		const cache = newCache<number, string>(key => error());

		return cache.get(100)
			.then(() => { throw Error('This should have failed') })
			.catch(err => null);
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

function value(v: number): Promise<number> {
	return new Promise(resolve => {
		setTimeout(() => resolve(v), 0);
	});
}

function error(): Promise<string> {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(), 0);
	});
}
