'use strict';

const { expect } = require('chai');
const hashcode = require('../utils/hashcode');

describe('Hash codes', function() {
	it('Calculates for string', function() {
		expect(hashcode('key')).to.not.be.null;
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
