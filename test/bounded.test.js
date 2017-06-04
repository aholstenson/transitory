
const { expect } = require('chai');
const BoundedCache = require('../cache/bounded');

describe('BoundedCache', function() {
	it('Can create', function() {
		expect(new BoundedCache({
			maxSize: 50
		})).to.not.be.null;
	});

	it('Set value in cache', function() {
		const cache = new BoundedCache({ maxSize: 50 });
		cache.set('key', 'value');

		expect(cache.get('key')).to.equal('value');
	});

	it('Get non-existent value in cache', function() {
		const cache = new BoundedCache({ maxSize: 50 });

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
});
