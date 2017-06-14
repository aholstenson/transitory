'use strict';

const { expect } = require('chai');
const builder = require('../index');

describe('Builder', function() {
	it('Can create boundless cache', function() {
		const cache = builder()
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);
	});

	it('Can create bounded cache', function() {
		const cache = builder()
			.maxSize(200)
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);
	});

	it('Can create boundless cache with loader', function() {
		const cache = builder()
			.withLoader(() => Math.random())
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);

		const p = cache.get('id');
		expect(p).to.be.instanceof(Promise);
		return p;
	});

	it('Can create bounded cache with loader', function() {
		const cache = builder()
			.maxSize(200)
			.withLoader(() => Math.random())
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);

		const p = cache.get('id');
		expect(p).to.be.instanceof(Promise);
		return p;
	});

	it('Can create boundedless cache with local loader', function() {
		const cache = builder()
			.loading()
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);

		const p = cache.get('id');
		expect(p).to.be.instanceof(Promise);
		return p;
	});

	it('Can create bounded cache with local loader', function() {
		const cache = builder()
			.maxSize(200)
			.loading()
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);

		const p = cache.get('id');
		expect(p).to.be.instanceof(Promise);
		return p;
	});

	it('Can create boundless cache with expire after write', function() {
		const cache = builder()
			.expireAfterWrite(5000)
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);
	});

	it('Can create bounded cache with expire after write', function() {
		const cache = builder()
			.maxSize(200)
			.expireAfterWrite(5000)
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);
	});

	it('Can create boundless cache with expire after read', function() {
		const cache = builder()
			.expireAfterRead(5000)
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);
	});

	it('Can create bounded cache with expire after read', function() {
		const cache = builder()
			.maxSize(200)
			.expireAfterRead(5000)
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);
	});

	it('Can create boundless cache with metrics', function() {
		const cache = builder()
			.metrics()
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(-1);
		expect(cache.metrics).to.not.be.null;
	});

	it('Can create bounded cache with metrics', function() {
		const cache = builder()
			.maxSize(200)
			.metrics()
			.build();

		expect(cache).to.not.be.null;
		expect(cache.maxSize).to.equal(200);
		expect(cache.metrics).to.not.be.null;
	});
});
