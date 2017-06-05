
const { expect } = require('chai');
const BoundlessCache = require('../cache/boundless');
const LoadingCache = require('../cache/loading');

const newCache = loader => new LoadingCache(new BoundlessCache({}), {
	loader: loader
});

describe('LoadingCache', function() {
	it('Can create', function() {
		expect(newCache()).to.not.be.null;
	});

	it('Set value in cache', function() {
		const cache = newCache();
		cache.set('key', 'value');

		expect(cache.has('key')).to.equal(true);
		expect(cache.getIfPresent('key')).to.equal('value');
		expect(cache.get('key')).to.be.an.instanceof(Promise);

		return cache.get('key')
			.then(v => expect(v).to.equal('value'));
	});

	it('Get non-existent value in cache', function() {
		const cache = newCache();

		expect(cache.getIfPresent('key')).to.equal(null);
		expect(cache.get('key')).to.be.an.instanceof(Promise);
		return cache.get('key')
			.then(v => expect(v).to.equal(null));
	});

	it('Delete works', function() {
		const cache = newCache();
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.getIfPresent('key')).to.equal(null);
	});

	it('Loads non-existent via global loader', function() {
		const cache = newCache(id => -id);

		return cache.get(100)
			.then(v => expect(v).to.equal(-100));
	});

	it('Loads non-existent via local loader', function() {
		const cache = newCache();

		return cache.get(100, key => key*2)
			.then(v => expect(v).to.equal(200));
	});

	it('Loads non-existent via global loader with Promise', function() {
		const cache = newCache(key => value(key / 2));

		return cache.get(100)
			.then(v => expect(v).to.equal(50));
	});

	it('Non-existent failure via global loader with Promise', function() {
		const cache = newCache(key => error());

		return cache.get(100)
			.then(() => { throw Error('This should have failed') })
			.catch(err => null);
	});
});

function value(v) {
	return new Promise(resolve => {
		setTimeout(() => resolve(v), 0);
	});
}

function error(v) {
	return new Promise((resolve, reject) => {
		setTimeout(() => reject(v), 0);
	});
}
