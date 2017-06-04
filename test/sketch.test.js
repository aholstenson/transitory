
const { expect } = require('chai');
const CountMinSketch = require('../utils/sketch');

describe('CountMinSketch', function() {
	describe('uint8', function() {
		it('Update + estimate String', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			sketch.update('one');
			sketch.update('two', 5);

			expect(sketch.estimate('two')).to.equal(5);
		});

		it('Update + estimate Object', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			sketch.update({ key: 'one' });
			sketch.update({ key: 'two' }, 5);

			expect(sketch.estimate({ key: 'one' })).to.equal(1);
		});
	});

	describe('Generic', function() {
		it('Decay after N updates', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			const n = sketch._resetAfter; // internal variable

			// Perform up to n-1 updates
			for(let i=0; i<n-1; i++) {
				sketch.update(i % 10);
			}

			// Perform one last update
			const current = sketch.estimate(2);
			sketch.update(2);

			// Check that the value has been cut in half
			const updated = sketch.estimate(2);

			expect(updated).to.equal(Math.floor(current / 2));
		});
	});
});
