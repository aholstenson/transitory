import { TimerWheel } from '../src/cache/expiration/TimerWheel';
import { KeyType } from '../src/cache/KeyType';


/**
 *
 * @param array
 */
function newWheel<K extends KeyType>(array?: K[]): TimerWheel<K, number> {
	const r = array || [];
	return new TimerWheel((expired: K[]) => expired.forEach(k => r.push(k)));
}

describe('TimerWheel', function() {
	it('Schedule', function() {
		const wheel = newWheel<string>();

		const node = wheel.node('test', 1);
		wheel.schedule(node, 10);
	});

	describe('Expiration', function() {
		it('Expire in 200 ms @ 500 ms', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 200);

			wheel.advance(500);
			expect(expired.length).toEqual(0);
		});

		it('Expire in 200 ms @ 1.07 seconds', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 200);

			wheel.advance(1070);
			expect(expired.length).toEqual(1);
			expect(expired[0]).toEqual('test');
		});

		it('Expire in 2 seconds @ 1.07 seconds', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2000);

			wheel.advance(1024);
			expect(expired.length).toEqual(0);
		});

		it('Expire in 2 seconds @ 4 seconds', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2000);

			wheel.advance(4000);
			expect(expired.length).toEqual(1);
			expect(expired[0]).toEqual('test');
		});

		it('Expire in 2 minutes @ 1 minute', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2 * 60 * 1000);

			wheel.advance(60 * 1000);
			expect(expired.length).toEqual(0);
		});

		it('Expire in 2 minutes @ 3 minutes', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2 * 60 * 1000);

			wheel.advance(3 * 60 * 1000);
			expect(expired.length).toEqual(1);
			expect(expired[0]).toEqual('test');
		});

		it('Expire in 2 minutes @ 1 minute and, 3 minutes', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2 * 60 * 1000);

			wheel.advance(1 * 60 * 1000);
			expect(expired.length).toEqual(0);

			wheel.advance(3 * 60 * 1000);
			expect(expired.length).toEqual(1);
			expect(expired[0]).toEqual('test');
		});

		it('Expire in 2 minutes @ 1 minute, 1 minute-10seconds and 2 minutes', function() {
			const expired: string[] = [];
			const wheel = newWheel(expired);

			const node = wheel.node('test', 1);
			wheel.schedule(node, 2 * 60 * 1000);

			wheel.advance(1 * 60 * 1000);
			expect(expired.length).toEqual(0);
			wheel.advance(2 * 60 * 1000 - 10000);
			expect(expired.length).toEqual(0);

			wheel.advance(2 * 60 * 1001);

			expect(expired.length).toEqual(1);
			expect(expired[0]).toEqual('test');
		});
	});
});
