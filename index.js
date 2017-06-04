'use strict';

const BoundedCache = require('./cache/bounded');

/**
 * Builder for cache instances.
 */
class Builder {
    constructor() {
        this.options = {};
    }

    /**
     * Set the maximum number of items to keep in the cache before evicting
     * something.
     */
    withMaxSize(size) {
        this.options.maxSize = size;
        return this;
    }

    /**
     * Build and return the cache.
     */
    build() {
        if(! this.options.maxSize) {
            throw new Error('Caches without maximum size are currently not supported');
        }

        return new BoundedCache(this.options);
    }
}

module.exports = function() {
    return new Builder();
}
