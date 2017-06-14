const { expect } = require('chai');
const TimerWheel = require('../utils/timer-wheel');

const newWheel = (array) => {
	array = array || [];
	return new TimerWheel(expired => expired.forEach(k => array.push(k)));
};

describe('TimerWheel', function() {
	it('Schedule', function() {
		let wheel = newWheel();

		let node = wheel.node('test');
		wheel.schedule(node, 10);
	});

	describe('Expiration', function() {
		it('Expire in 200 ms @ 500 ms', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 200);

			wheel.advance(500);
			expect(expired.length).to.equal(0);
		});

		it('Expire in 200 ms @ 1.07 seconds', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 200);

			wheel.advance(1070);
			expect(expired.length).to.equal(1);
			expect(expired[0]).to.equal('test');
		});

		it('Expire in 2 seconds @ 1.07 seconds', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2000);

			wheel.advance(1024);
			expect(expired.length).to.equal(0);
		});

		it('Expire in 2 seconds @ 4 seconds', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2000);

			wheel.advance(4000);
			expect(expired.length).to.equal(1);
			expect(expired[0]).to.equal('test');
		});

		it('Expire in 2 minutes @ 1 minute', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2*60*1000);

			wheel.advance(60*1000);
			expect(expired.length).to.equal(0);
		});

		it('Expire in 2 minutes @ 3 minutes', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2*60*1000);

			wheel.advance(3*60*1000);
			expect(expired.length).to.equal(1);
			expect(expired[0]).to.equal('test');
		});

		it('Expire in 2 minutes @ 1 minute and, 3 minutes', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2*60*1000);

			wheel.advance(1*60*1000);
			expect(expired.length).to.equal(0);

			wheel.advance(3*60*1000);
			expect(expired.length).to.equal(1);
			expect(expired[0]).to.equal('test');
		});

		it('Expire in 2 minutes @ 1 minute, 1 minute-10seconds and 2 minutes', function() {
			let expired = [];
			let wheel = newWheel(expired);

			let node = wheel.node('test');
			wheel.schedule(node, 2*60*1000);

			wheel.advance(1*60*1000);
			expect(expired.length).to.equal(0);
			wheel.advance(2*60*1000-10000);
			expect(expired.length).to.equal(0);

			wheel.advance(2*60*1000);

			expect(expired.length).to.equal(1);
			expect(expired[0]).to.equal('test');
		});
	})
});
