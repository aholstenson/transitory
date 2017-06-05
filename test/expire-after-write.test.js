
const { expect } = require('chai');
const BoundlessCache = require('../cache/boundless');
const ExpireAfterWriteCache = require('../cache/expire-after-write');

const newCache = () => new ExpireAfterWriteCache(new BoundlessCache({}), {
	maxWriteAge: 1
});

describe('ExpireAfterWriteCache', function() {
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

	it('Set value in cache', function(cb) {
		const cache = newCache();
		cache.set('key', 'value');

		setTimeout(() => {
			expect(cache.get('key')).to.be.null;
			cb();
		}, 2);
	});
});
