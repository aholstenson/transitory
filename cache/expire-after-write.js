'use strict';

const { DATA, ON_REMOVE, EVICT } = require('./symbols');
const RemovalCause = require('../utils/removal-cause');
const TimerWheel = require('../utils/timer-wheel');

/**
 * Wrapper for another cache that provides evictions of times based on timers.
 *
 * Currently supports expiration based on maximum age.
 */
module.exports = ParentCache => class ExpireAfterWriteCache extends ParentCache {
	constructor(options) {
		super(options);

		this[DATA].maxWriteAge = options.maxWriteAge;
		this[DATA].timerWheel = new TimerWheel(keys => keys.forEach(key => this.delete(key)));
	}

	set(key, value) {
		const timerWheel = this[DATA].timerWheel;
		let node = timerWheel.node(key, value);

		if(this[DATA].maxWriteAge) {
			let age = this[DATA].maxWriteAge(key, value);
			if(age >= 0) {
				this[DATA].timerWheel.schedule(node, age);
			}
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
			return super.getIfPresent(key, recordStats).value;
		} else {
			return null;
		}
	}

	has(key) {
		const data = super.getIfPresent(key, false);
		return data && ! data.isExpired();
	}

	delete(key) {
		const node = super.delete(key);
		if(node) {
			this[DATA].timerWheel.deschedule(node);
			return node.value;
		}
		return null;
	}

	[ON_REMOVE](key, value, cause) {
		if(value.isExpired()) {
			cause = RemovalCause.EXPIRED;
		}
		super[ON_REMOVE](key, value.value, cause);
	}

	[EVICT]() {
		this[DATA].timerWheel.advance();
		super[EVICT]();
	}
};
