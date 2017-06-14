
const { expect } = require('chai');
const BoundlessCache = require('../cache/boundless');
const ExpirationCache = require('../cache/expiration');
const RemovalCause = require('../utils/removal-cause');

const newCache = (listener) => {
	let Impl = ExpirationCache(BoundlessCache);
	return new Impl({
		maxWriteAge: () => 10,
		removalListener: listener
	});
};

describe('ExpirationCache', function() {
	it('Can create', function() {
		expect(newCache()).to.not.be.null;
	});

	it('Set value in cache', function() {
		const cache = newCache();
		cache.set('key', 'value');

		expect(cache.has('key')).to.equal(true);
		expect(cache.getIfPresent('key')).to.equal('value');
	});

	it('Get non-existent value in cache', function() {
		const cache = newCache();

		expect(cache.getIfPresent('key')).to.equal(null);
	});

	it('Delete works', function() {
		const cache = newCache();
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.getIfPresent('key')).to.equal(null);
	});

	it('Set value in cache with timeout', function(cb) {
		const cache = newCache();
		cache.set('key', 'value');

		setTimeout(() => {
			expect(cache.get('key')).to.be.null;
			cb();
		}, 20);
	});

	it('Set evicts old keys', function(cb) {
		const cache = newCache();
		cache.set('key', 'value');

		setTimeout(() => {
			cache.set('key2', 'value');
			cache.__await();
			expect(cache.size).to.equal(1);
			cb();
		}, 1080);
	});

	describe('Removal listeners', function() {
		it('Triggers on delete', function() {
			const listener = removalListener();
			const cache = newCache(listener);

			cache.set('one', 1234);
			expect(listener.removed).to.equal(null);

			cache.delete('one');
			expect(listener.removed).to.deep.equal({
				key: 'one',
				value: 1234,
				reason: RemovalCause.EXPLICIT
			});
		});

		it('Triggers on set', function() {
			const listener = removalListener();
			const cache = newCache(listener);

			cache.set('one', 1234);
			expect(listener.removed).to.equal(null);

			cache.set('one', 4321);
			expect(listener.removed).to.deep.equal({
				key: 'one',
				value: 1234,
				reason: RemovalCause.REPLACED
			});
		});

		it('Triggers on expiration', function(cb) {
			const listener = removalListener();
			const cache = newCache(listener);

			cache.set('one', 1234);
			expect(listener.removed).to.equal(null);

			setTimeout(() => {
				cache.set('one', 4321);
				expect(listener.removed).to.deep.equal({
					key: 'one',
					value: 1234,
					reason: RemovalCause.EXPIRED
				});
				cb();
			}, 20);
		});
	});
});

function removalListener() {
	let result = (key, value, reason) => {
		result.removed = { key, value, reason };
	};
	result.removed = null;
	return result;
}
