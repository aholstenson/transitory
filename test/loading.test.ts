
import { BoundlessCache } from '../src/cache/boundless';
import { WrappedLoadingCache } from '../src/cache/loading';
import { KeyType } from '../src/cache/key-type';
import { Loader } from '../src/cache/loading/loader';

function newCache<K extends KeyType, V>(loader?: Loader<K, V>) {
	return new WrappedLoadingCache({
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
