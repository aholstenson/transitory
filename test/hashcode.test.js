'use strict';

const { expect } = require('chai');
const hashcode = require('../utils/hashcode');

describe('Hash codes', function() {
	it('Calculates for string', function() {
		expect(hashcode('')).to.equal(0);
		expect(hashcode('', 1)).to.equal(0x514E28B7);
		expect(hashcode('abc')).to.equal(0xB3DD93FA);
		expect(hashcode('aaaa', 0x9747b28c)).to.equal(0x5A97808A);
		expect(hashcode('Hello, world!', 0x9747b28c)).to.equal(0x24884CBA);
	});

	it('Calculates for number', function() {
		expect(hashcode(9292)).to.not.be.null;
	});

	it('Calculates for boolean', function() {
		expect(hashcode(false)).to.not.be.null;
	});

	it('Fails for object', function() {
		expect(() => hashcode({})).to.throw;
	});

	it('Fails for function', function() {
		expect(() => hashcode(function() {})).to.throw;
	});
});
