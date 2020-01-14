
import { CountMinSketch } from '../src/cache/bounded/CountMinSketch';

function hash(key: number | string) {
	return CountMinSketch.hash(key);
}

describe('CountMinSketch', function() {
	describe('uint8', function() {
		it('Update + estimate', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			sketch.update(hash('one'));
			sketch.update(hash('two'));
			sketch.update(hash('two'));
			sketch.update(hash('two'));
			sketch.update(hash('two'));
			sketch.update(hash('two'));

			expect(sketch.estimate(hash('two'))).toEqual(5);
		});

		it('Stability', function() {
			const updates = 2000;
			const max = 200;
			const sketch = CountMinSketch.uint8(max, 4, false);
			const data = new Map();
			for(let i=0; i<updates; i++) {
				const key = Math.floor(Math.random() * max);
				let c = data.get(key) || 0;
				data.set(key, c + 1);
				sketch.update(hash(key));
			}

			let diff = 0;
			data.forEach((value, key) => {
				const estimated = sketch.estimate(hash(key));
				const isSame = estimated === value || (value > 255 && estimated === 255);
				if(! isSame) diff++;
			});

			expect(diff / data.size).toBeLessThan(0.10);
		});
	});

	describe('Generic', function() {
		it('Decay after N updates', function() {
			const sketch = CountMinSketch.uint8(5, 4);
			const n = 5*10;// same as sketch.resetAfter

			// Perform up to n-1 updates
			for(let i=0; i<n-1; i++) {
				sketch.update(hash(i % 10));
			}

			// Perform one last update
			const current = sketch.estimate(hash(2));
			sketch.update(hash(2));

			// Check that the value has been cut in half
			const updated = sketch.estimate(hash(2));

			expect(updated).toBeLessThanOrEqual(Math.ceil(current / 2));
			expect(updated).toBeGreaterThanOrEqual(Math.floor(current / 2));
		});
	});
});
