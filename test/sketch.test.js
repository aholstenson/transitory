
const { expect } = require('chai');
const CountMinSketch = require('../utils/sketch');

function hash(key) {
	return CountMinSketch.hash(key);
}

describe('CountMinSketch', function() {
	describe('uint8', function() {
		it('Update + estimate', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			sketch.update(hash('one'));
			sketch.update(hash('two'), 5);

			expect(sketch.estimate(hash('two'))).to.equal(5);
		});
	});

	describe('Generic', function() {
		it('Decay after N updates', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			const n = sketch._resetAfter; // internal variable

			// Perform up to n-1 updates
			for(let i=0; i<n-1; i++) {
				sketch.update(hash(i % 10));
			}

			// Perform one last update
			const current = sketch.estimate(hash(2));
			sketch.update(hash(2));

			// Check that the value has been cut in half
			const updated = sketch.estimate(hash(2));

			expect(updated).to.be.within(Math.floor(current / 2), Math.ceil(current / 2));
		});
	});
});
