
const { expect } = require('chai');
const BoundedCache = require('../cache/bounded');
const RemovalCause = require('../utils/removal-cause');

describe('BoundedCache', function() {
	it('Can create', function() {
		expect(new BoundedCache({
			maxSize: 50
		})).to.not.be.null;
	});

	it('Set value in cache', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		expect(cache.has('key')).to.equal(true);
		expect(cache.get('key')).to.equal('value');
	});

	it('Get non-existent value in cache', function() {
		const cache = new BoundedCache({ maxSize: 50 });

		expect(cache.get('key')).to.equal(null);
	});

	it('Delete works', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		cache.delete('key');
		expect(cache.get('key')).to.equal(null);
	});

	describe('Eviction', function() {
		it('Does not exceed maxSize', function() {
			const maxSize = 10;
			const cache = new BoundedCache({ maxSize });

			for(let i=0; i<maxSize*2; i++) {
				cache.set(i, i);
			}

			expect(cache.size).to.equal(maxSize);
		});

		it('Eviction order for small cache', function() {
			const maxSize = 3;
			const cache = new BoundedCache({ maxSize });

			for(let i=0; i<=maxSize; i++) {
				cache.set(i, i);
			}

			cache.get(3);
			cache.get(1);

			cache.set(maxSize + 1);

			expect(cache.get(2)).to.equal(null);
			expect(cache.get(1)).to.equal(1);
			expect(cache.get(3)).to.equal(3);
		});
	});

	describe('Removal listeners', function() {
		it('Triggers on delete', function() {
			const listener = removalListener();
			const cache = new BoundedCache({
				maxSize: 10,
				removalListener: listener
			});

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
			const cache = new BoundedCache({
				maxSize: 10,
				removalListener: listener
			});

			cache.set('one', 1234);
			expect(listener.removed).to.equal(null);

			cache.set('one', 4321);
			expect(listener.removed).to.deep.equal({
				key: 'one',
				value: 1234,
				reason: RemovalCause.REPLACED
			});
		});

		it('Triggers on evict', function() {
			const listener = removalListener();
			const cache = new BoundedCache({
				maxSize: 5,
				removalListener: listener
			});

			for(let i=0; i<5; i++) {
				cache.set(i, 1234);
			}
			expect(listener.removed).to.equal(null);

			cache.set(5, 1234);
			expect(listener.removed).to.deep.equal({
				key: 4,
				value: 1234,
				reason: RemovalCause.SIZE
			});
		});
	});

	describe('Weighted', function() {
		it('Can set', function() {
			const cache = new BoundedCache({
				maxSize: 50,
				weigher: (key, value) => 2
			});
			cache.set('key', 'value');

			expect(cache.has('key')).to.equal(true);
			expect(cache.get('key')).to.equal('value');
		});

		it('Does not exceed maxSize', function() {
			const cache = new BoundedCache({
				maxSize: 50,
				weigher: (key, value) => 10
			});

			for(let i=0; i<6; i++) {
				cache.set(i, i);
			}

			expect(cache.size).to.equal(5);
		});
	})
});

function removalListener() {
	let result = (key, value, reason) => {
		result.removed = { key, value, reason };
	};
	result.removed = null;
	return result;
}
