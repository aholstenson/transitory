import { hashcode } from '../src/cache/bounded/hashcode';

describe('Hash codes', function() {
	it('Calculates for string', function() {
		expect(hashcode('')).toEqual(0);
		expect(hashcode('', 1)).toEqual(0x514E28B7);
		expect(hashcode('abc')).toEqual(0xB3DD93FA);
		expect(hashcode('aaaa', 0x9747b28c)).toEqual(0x5A97808A);
		expect(hashcode('Hello, world!', 0x9747b28c)).toEqual(0x24884CBA);
	});

	it('Calculates for number', function() {
		expect(hashcode(9292)).toBeTruthy();
	});

	it('Calculates for boolean', function() {
		expect(hashcode(false)).toBeTruthy();
	});

	it('Fails for object', function() {
		expect(() => hashcode({} as any)).toThrow();
	});

	it('Fails for function', function() {
		expect(() => hashcode(function() {} as any)).toThrow();
	});
});
