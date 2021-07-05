import { CacheBuilderImpl } from '../src/builder/unified-builder';

const uuidCacheExpireAfterWrite: number = 3000;// 3 seconds

describe('Cache testing', () => {
	const RealDate = Date.now;
	let date: number = Date.now();

	afterAll(() => {
		global.Date.now = RealDate;
	});

	function setNow() {
		global.Date.now = jest.fn(() => date++);
	}

	test('Cache timing out relead test', () => {
		/*
		 * A problem was discoverd in the Loading cache where the code executed
		 * if(this.has(key)) {return Promise.resolve(this.getIfPresent(key) as V); }
		 * Both the calls to has() and getIfPresent() read the Date.now() value to see
		 * if the entry has expired. The problem occured when Date.now() returned the
		 * next value for the second call - the clock had moved on - and the entry had
		 * become timed out.
		 * This test simulates that condition by mocking the Date.now() function.
		 */
		const testCache = new CacheBuilderImpl<string, boolean>()
			.maxSize(200)
			.withLoader(uuid => cacheLoader(uuid))
			.expireAfterWrite(uuidCacheExpireAfterWrite)
			.build();
		setNow();
		const myKey: string = 'fred';
		testCache.set(myKey, true);
		// Set date to the millisecond before timeout so that it times out on the second
		// read within testCache.get().
		date = date + uuidCacheExpireAfterWrite - 1;
		return (testCache.get(myKey))
			.then((result: boolean) => {
				expect(result).toBeTruthy();
			});
	});
});

function cacheLoader(val: any): Promise<boolean> {
	return Promise.resolve(true);
}