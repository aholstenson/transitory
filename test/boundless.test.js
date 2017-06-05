
const { expect } = require('chai');
const BoundlessCache = require('../cache/boundless');

describe('BoundlessCache', function() {
	it('Can create', function() {
		expect(new BoundlessCache()).to.not.be.null;
	});

	it('Set value in cache', function() {
		const cache = new BoundlessCache();
		cache.set('key', 'value');

		expect(cache.has('key')).to.equal(true);
		expect(cache.get('key')).to.equal('value');
	});

	it('Get non-existent value in cache', function() {
		const cache = new BoundlessCache();

		expect(cache.get('key')).to.equal(null);
	});

	it('Delete works', function() {
		const cache = new BoundlessCache();
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.get('key')).to.equal(null);
	});
});
