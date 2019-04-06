import { CacheBuilderImpl } from '../src/builder/unified-builder';
import { AbstractCache } from '../src/cache/abstract';

describe('Builder', function() {
	it('Can create boundless cache', function() {
		const cache = new CacheBuilderImpl<string, string>()
			.build();

		expect(cache).toBeTruthy()
		expect(cache.maxSize).toEqual(-1);
	});

	it('Can create bounded cache', function() {
		const cache = new CacheBuilderImpl<string, string>()
			.maxSize(200)
			.build();

		expect(cache).toBeTruthy();
		expect(cache.maxSize).toEqual(200);
	});

	it('Boundless cache is cache', function() {
		const cache = new CacheBuilderImpl<string, string>()
			.build();

		expect(cache instanceof AbstractCache).toEqual(true);
	});

	it('Bounded cache is cache', function() {
		const cache = new CacheBuilderImpl<string, string>()
			.maxSize(200)
			.build();

		expect(cache instanceof AbstractCache).toEqual(true);
	});

	it('Can create bounded cache', function() {
		const cache = new CacheBuilderImpl<string, string>()
			.maxSize(20000)
			.build();

		expect(cache).not.toBeNull();
		expect(cache.maxSize).toEqual(20000);
	});

	it('Can create boundless cache with loader', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.withLoader(() => Math.random())
			.build();

		expect(cache.maxSize).toEqual(-1);

		const p = cache.get('id');
		expect(p).toBeInstanceOf(Promise);
		return p;
	});

	it('Can create bounded cache with loader', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.withLoader(() => Math.random())
			.build();

		expect(cache.maxSize).toEqual(200);

		const p = cache.get('id');
		expect(p).toBeInstanceOf(Promise);
		return p;
	});

	it('Can create boundedless cache with local loader', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.loading()
			.build();

		expect(cache.maxSize).toEqual(-1);
	});

	it('Can create bounded cache with local loader', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.loading()
			.build();

		expect(cache.maxSize).toEqual(200);
	});

	it('Boundless cache with loader is cache', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.loading()
			.build();

		expect(cache instanceof AbstractCache).toEqual(true);
	});

	it('Bounded cache with loader is cache', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.loading()
			.build();

		expect(cache instanceof AbstractCache).toEqual(true);
	});

	it('Can create boundless cache with expire after write', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.expireAfterWrite(5000)
			.build();

		expect(cache.maxSize).toEqual(-1);
	});

	it('Can create bounded cache with expire after write', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.expireAfterWrite(5000)
			.build();

		expect(cache.maxSize).toEqual(200);
	});

	it('Can create boundless cache with expire after read', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.expireAfterRead(5000)
			.build();

		expect(cache.maxSize).toEqual(-1);
	});

	it('Can create bounded cache with expire after read', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.expireAfterRead(5000)
			.build();

		expect(cache.maxSize).toEqual(200);
	});

	it('Can create boundless cache with metrics', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.metrics()
			.build();

		expect(cache.maxSize).toEqual(-1);
	});

	it('Can create bounded cache with metrics', function() {
		const cache = new CacheBuilderImpl<string, number>()
			.maxSize(200)
			.metrics()
			.build();

		expect(cache.maxSize).toEqual(200);
	});
});
