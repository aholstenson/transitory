
const { expect } = require('chai');
const BaseCache = require('../cache/base');

describe('BaseCache', function() {
	it('Can create', function() {
		expect(new BaseCache()).to.not.be.null;
	});

	it('set throws', function() {
		const cache = new BaseCache();
		expect(() => cache.set('key', value)).to.throw();
	});

	it('get throws', function() {
		const cache = new BaseCache();
		expect(() => cache.get('key')).to.throw();
	});

	it('getIfPresent throws', function() {
		const cache = new BaseCache();
		expect(() => cache.getIfPresent('key')).to.throw();
	});

	it('peek throws', function() {
		const cache = new BaseCache();
		expect(() => cache.peek('key')).to.throw();
	});

	it('delete throws', function() {
		const cache = new BaseCache();
		expect(() => cache.delete('key')).to.throw();
	});

	it('has throws', function() {
		const cache = new BaseCache();
		expect(() => cache.has('key')).to.throw();
	});

	it('clear throws', function() {
		const cache = new BaseCache();
		expect(() => cache.clear('key')).to.throw();
	});

	it('keys throws', function() {
		const cache = new BaseCache();
		expect(() => cache.keys()).to.throw();
	});

	it('cleanUp throws', function() {
		const cache = new BaseCache();
		expect(() => cache.cleanUp()).to.throw();
	});
});
