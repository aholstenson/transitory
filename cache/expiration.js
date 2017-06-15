'use strict';

const { Duration } = require('amounts');

const { DATA, ON_REMOVE, EVICT } = require('./symbols');
const RemovalCause = require('../utils/removal-cause');
const TimerWheel = require('../utils/timer-wheel');

/**
 * Wrapper for another cache that provides evictions of times based on timers.
 *
 * Currently supports expiration based on maximum age.
 */
module.exports = ParentCache => class ExpirationCache extends ParentCache {
	constructor(options) {
		super(options);

		this[DATA].maxWriteAge = options.maxWriteAge;
		this[DATA].maxNoReadAge = options.maxNoReadAge;
		this[DATA].timerWheel = new TimerWheel(keys => keys.forEach(key => this.delete(key)));
	}

	set(key, value, options) {
		const data = this[DATA];
		const timerWheel = data.timerWheel;
		let node = timerWheel.node(key, value);

		let age = null;
		if(options && typeof options.maxAge !== 'undefined') {
			age = options.maxAge;
		} else if(data.maxWriteAge) {
			age = data.maxWriteAge(key, value) || 0;
		} else if(data.maxNoReadAge) {
			age = data.maxNoReadAge(key, value) || 0;
		}

		if(typeof age === 'string') {
			// Parse strings that are ages
			age = Duration(age).as('ms');
		}

		if(age !== null && ! data.timerWheel.schedule(node, age)) {
			// Age was not accepted by wheel, delete any previous value
			return this.delete(key);
		}

		try {
			const replaced = super.set(key, node);
			return replaced ? replaced.value : null;
		} catch(ex) {
			timerWheel.deschedule(node);
			throw ex;
		}
	}

	get(key) {
		return this.getIfPresent(key, true);
	}

	getIfPresent(key, recordStats=true) {
		if(this.has(key)) {
			const node = super.getIfPresent(key, recordStats);
			if(node) {
				// Reschedule if we have a maximum age between reads
				const data = this[DATA];
				if(data.maxNoReadAge) {
					let age = data.maxNoReadAge(key, node.value)
					if(! data.timerWheel.schedule(node, age)) {
						// Age was not accepted by wheel, expire it directly
						this.delete(key);
					}
				}
				return node.value;
			}
		}

		return null;
	}

	has(key) {
		const data = super.getIfPresent(key, false);
		return (data && ! data.isExpired()) || false;
	}

	delete(key) {
		const node = super.delete(key);
		if(node) {
			return node.value;
		}
		return null;
	}

	[ON_REMOVE](key, value, cause) {
		if(value.isExpired()) {
			cause = RemovalCause.EXPIRED;
		}

		this[DATA].timerWheel.deschedule(value);
		super[ON_REMOVE](key, value.value, cause);
	}

	[EVICT]() {
		this[DATA].timerWheel.advance();
		super[EVICT]();
	}
};
