
const { expect } = require('chai');
const CountMinSketch = require('../utils/sketch');
const hashIt = require('hash-it');

describe('CountMinSketch', function() {
	describe('uint8', function() {
		it('Update + estimate', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			sketch.update(hashIt('one'));
			sketch.update(hashIt('two'), 5);

			expect(sketch.estimate(hashIt('two'))).to.equal(5);
		});
	});

	describe('Generic', function() {
		it('Decay after N updates', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			const n = sketch._resetAfter; // internal variable

			// Perform up to n-1 updates
			for(let i=0; i<n-1; i++) {
				sketch.update(hashIt(i % 10));
			}

			// Perform one last update
			const current = sketch.estimate(hashIt(2));
			sketch.update(hashIt(2));

			// Check that the value has been cut in half
			const updated = sketch.estimate(hashIt(2));

			expect(updated).to.equal(Math.floor(current / 2));
		});
	});
});
