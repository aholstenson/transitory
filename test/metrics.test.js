
const { expect } = require('chai');
const BoundlessCache = require('../cache/boundless');
const MetricsCache = require('../cache/metrics');

const newCache = () => {
	let Impl = MetricsCache(BoundlessCache);
	return new Impl({})
};

describe('MetricsCache', function() {
	it('Can create', function() {
		expect(newCache()).to.not.be.null;
	});

	it('Set and get value in cache', function() {
		const cache = newCache();
		cache.set('key', 'value');

		expect(cache.has('key')).to.equal(true);
		expect(cache.getIfPresent('key')).to.equal('value');

		expect(cache.metrics.hits).to.equal(1);
		expect(cache.metrics.misses).to.equal(0);
		expect(cache.metrics.hitRate).to.equal(1.0);
	});

	it('Get non-existent value in cache', function() {
		const cache = newCache();

		expect(cache.getIfPresent('key')).to.equal(null);

		expect(cache.metrics.hits).to.equal(0);
		expect(cache.metrics.misses).to.equal(1);
		expect(cache.metrics.hitRate).to.equal(0);
	});

	it('Get without recording stats', function() {
		const cache = newCache();

		expect(cache.getIfPresent('key', false)).to.equal(null);

		expect(cache.metrics.hits).to.equal(0);
		expect(cache.metrics.misses).to.equal(0);
		expect(cache.metrics.hitRate).to.equal(1);
	});
});
