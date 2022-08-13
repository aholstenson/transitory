import { BoundlessCache } from '../src/cache/boundless';
import { ExpirationCache, Expirable } from '../src/cache/expiration';
import { KeyType } from '../src/cache/KeyType';
import { RemovalListener } from '../src/cache/RemovalListener';
import { RemovalReason } from '../src/cache/RemovalReason';

import { RemovalHelper } from './removal-helper';

/**
 *
 * @param listener
 */
function newCache<K extends KeyType, V>(listener?: RemovalListener<K, V>) {
	return new ExpirationCache({
		parent: new BoundlessCache<K, Expirable<V>>({}),

		maxWriteAge: () => 100,
		removalListener: listener
	});
}

/**
 *
 * @param listener
 */
function newReadCache<K extends KeyType, V>(listener?: RemovalListener<K, V>) {
	return new ExpirationCache({
		parent: new BoundlessCache<K, Expirable<V>>({}),

		maxNoReadAge: () => 10,
		removalListener: listener
	});
}

describe('ExpirationCache', function() {
	it('Can create', function() {
		newCache();
	});

	describe('With maxWriteAge', function() {
		it('Set value in cache', function() {
			const cache = newCache();
			cache.set('key', 'value');

			expect(cache.has('key')).toEqual(true);
			expect(cache.getIfPresent('key')).toEqual('value');
		});

		it('Get non-existent value in cache', function() {
			const cache = newCache();

			expect(cache.getIfPresent('key')).toEqual(null);
		});

		it('Delete works', function() {
			const cache = newCache();
			cache.set('key', 'value');

			cache.delete('key');
			expect(cache.getIfPresent('key')).toEqual(null);
		});

		it('Set value in cache with timeout', function(cb) {
			const cache = newCache();
			cache.set('key', 'value');

			setTimeout(() => {
				expect(cache.getIfPresent('key')).toBeNull();
				cb();
			}, 200);
		});

		it('Set evicts old keys', function(cb) {
			const cache = newCache();
			cache.set('key', 'value');

			setTimeout(() => {
				cache.set('key2', 'value');
				cache.cleanUp();
				expect(cache.size).toEqual(1);
				cb();
			}, 1080);
		});

		it('Keys evicted before array returned', function(cb) {
			const cache = newCache();
			cache.set('key', 'value');

			setTimeout(() => {
				cache.cleanUp();
				expect(cache.keys().length).toEqual(0);
				cb();
			}, 1080);
		});
	});

	describe('With maxNoReadAge', function() {
		it('Set value in cache', function() {
			const cache = newReadCache();
			cache.set('key', 'value');

			expect(cache.has('key')).toEqual(true);
			expect(cache.getIfPresent('key')).toEqual('value');
		});

		it('Set value in cache with timeout', function(cb) {
			const cache = newReadCache();
			cache.set('key', 'value');

			setTimeout(() => {
				expect(cache.getIfPresent('key')).toBeNull();
				cb();
			}, 15);
		});

		it('Set and get value in cache with timeout', function(cb) {
			const cache = newReadCache();
			cache.set('key', 'value');

			// Trigger the max age read
			cache.getIfPresent('key');

			setTimeout(() => {
				expect(cache.getIfPresent('key')).toBeNull();
				cb();
			}, 15);
		});
	});

	describe('Removal listeners', function() {
		it('Triggers on delete', function() {
			const removal = new RemovalHelper<string, string>();
			const cache = newCache(removal.listener);
			cache.set('key', 'value');

			cache.delete('key');
			expect(cache.getIfPresent('key')).toEqual(null);

			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('key');
			expect(removal.removedValue).toEqual('value');
			expect(removal.removalReason).toEqual(RemovalReason.EXPLICIT);
		});

		it('Triggers on set', function() {
			const removal = new RemovalHelper<string, number>();
			const cache = newCache(removal.listener);

			cache.set('one', 1234);
			expect(removal.didRemove).toEqual(false);

			cache.set('one', 4321);
			expect(removal.didRemove).toEqual(true);
			expect(removal.removedKey).toEqual('one');
			expect(removal.removedValue).toEqual(1234);
			expect(removal.removalReason).toEqual(RemovalReason.REPLACED);
		});

		it('Triggers on expiration', function(cb) {
			const removal = new RemovalHelper<string, number>();
			const cache = newCache(removal.listener);

			cache.set('one', 1234);
			expect(removal.didRemove).toEqual(false);

			setTimeout(() => {
				cache.set('one', 4321);
				expect(removal.didRemove).toEqual(true);
				expect(removal.removedKey).toEqual('one');
				expect(removal.removedValue).toEqual(1234);
				expect(removal.removalReason).toEqual(RemovalReason.EXPIRED);
				cb();
			}, 200);
		});
	});
});

