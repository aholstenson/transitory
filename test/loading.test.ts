import { newCache as newCacheImpl } from '../src/builder';
import { BoundlessCache } from '../src/cache/boundless';
import { KeyType } from '../src/cache/KeyType';
import { Loader } from '../src/cache/loading';
import { RemovalReason } from '../src/cache/RemovalReason';

import { RemovalHelper } from './removal-helper';

/**
 *
 * @param loader
 */
function newCache<K extends KeyType, V>(loader?: Loader<K, V>) {
	const builder = newCacheImpl<K, V>();
	if(loader) {
		return builder.withLoader(loader).build();
	}
	return builder.build();
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
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			cache.get('key');
			fail();
		// eslint-disable-next-line no-empty
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

		return cache.get(100, key => key * 2)
			.then((v: number) => expect(v).toEqual(200));
	});

	it('Loads non-existent via global loader with Promise', function() {
		const cache = newCache<number, number>(key => value(key / 2));

		return cache.get(100)
			.then((v: number) => expect(v).toEqual(50));
	});

	it('Non-existent failure via global loader with Promise', function() {
		const cache = newCache<number, string>(() => error());

		return cache.get(100)
			.then(() => {
				throw Error('This should have failed');
			})
			.catch(() => null);
	});

	it('Caches loader promises for concurrent gets', async function() {
		const resolves: Array<() => void> = [];
		const cache = newCache<number, string>(k => {
			return new Promise(resolve => {
				resolves.push(() => {
					resolve((k * 2).toString());
				});
			});
		});

		const promise1 = cache.get(100);
		const promise2 = cache.get(100);
		const promise3 = cache.get(100, () => 'whatever');
		const promise4 = cache.get(200);

		expect(promise1).toBe(promise2);
		expect(promise2).toBe(promise3);
		expect(promise1).not.toBe(promise4);

		resolves.forEach(r => r());

		expect(await promise1).toBe('200');
		expect(await promise2).toBe('200');
		expect(await promise3).toBe('200');
		expect(await promise4).toBe('400');
	});

	it.each([
		[ 'Standard', newCacheImpl<number, string>().metrics().build() ],
		[ 'Bounded', newCacheImpl<number, string>().metrics().maxSize(100).build() ],
		[ 'Expiring', newCacheImpl<number, string>().metrics().expireAfterRead(1000).build() ],
	])('%s cache does not load null values', async (_type, cache) => {
		const result1 = await cache.get(100, () => null); // misses +1
		expect(result1).toBe(null);
		expect(cache.metrics).toMatchObject({ hits: 0, misses: 1 });
		expect(cache.size).toBe(0);
		expect(cache.has(100)).toBe(false);
		expect(cache.peek(100)).toBe(null);
		expect(cache.getIfPresent(100)).toBe(null); // misses +1
		expect(cache.metrics).toMatchObject({ hits: 0, misses: 2 });
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

/**
 *
 * @param v
 */
function value(v: number): Promise<number> {
	return new Promise(resolve => {
		setTimeout(() => resolve(v), 0);
	});
}

/**
 *
 */
function error(): Promise<string> {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(), 0);
	});
}
