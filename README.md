# Transitory

[![npm version](https://badge.fury.io/js/transitory.svg)](https://badge.fury.io/js/transitory)
[![Build Status](https://travis-ci.org/aholstenson/transitory.svg?branch=master)](https://travis-ci.org/aholstenson/transitory)
[![Coverage Status](https://coveralls.io/repos/aholstenson/transitory/badge.svg)](https://coveralls.io/github/aholstenson/transitory)
[![Dependencies](https://david-dm.org/aholstenson/transitory.svg)](https://david-dm.org/aholstenson/transitory)

Transitory is a in-memory cache for Node and the browser, with high hit rates
using eviction based on frequency and recency. Additional cache layers support 
time-based expiration, automatic loading and metrics.

```javascript
import { newCache } from 'transitory';

const cache = newCache()
  .maxSize(1000)
  .expireAfterWrite(60000) // 60 seconds
  .build();

cache.set('key', { value: 10 });
cache.set(1234, 'any value');

const value = cache.getIfPresent('key');
```

## Supported features

* Limiting cache size to a total number of items
* Limiting cache size based on the weight of items
* LFU (least-frequently used) eviction of items
* Listener for evicted and removed items
* Expiration of items a certain time after they were stored in the cache
* Expiration of items based on if they haven't been read for a certain time
* Automatic loading if a value is not cached
* Collection of metrics about hit rates

## Performance

The caches in this library are designed to have a high hit rate by evicting
entries in the cache that are not frequently used. Transitory implements
[W-TinyLFU](https://arxiv.org/abs/1512.00727) as its eviction policy which is
a LFU policy that provides good hit rates for many use cases.

See [Performance](https://github.com/aholstenson/transitory/wiki/Performance)
in the wiki for comparisons of the hit rate of Transitory to other libraries.

## Cache API

There are a few basic things that all caches support. All caches support
strings, numbers and booleans as their `KeyType`.

* `cache.set(key: KeyType, value: ValueType): ValueType | null`

    Store a value tied to the specified key. Returns the previous value or
    `null` if no value currently exists for the given key.

* `cache.getIfPresent(key: KeyType): ValueType | null`

    Get the cached value for the specified key if it exists. Will return
	  the value or `null` if no cached value exist. Updates the usage of the
	  key. This is the main way to get cached items, unless the cache is a
    loading cache.

* `cache.get(key: KeyType, loader?): Promise<ValueType | null>`

    _For loading caches:_ Get a value loading it if it is not cached. Can
    optionally take a `loader` function that loads the value.

* `cache.peek(key: KeyType): ValueType | null`

    Peek to see if a key is present without updating the usage of the
	  key. Returns the value associated with the key or `null`  if the key
	  is not present.

* `cache.has(key: KeyType): boolean`

    Check if the given key exists in the cache.

* `cache.delete(key: KeyType): ValueType | null`

    Delete a value in the cache. Returns the removed value or `null` if there
    was no value associated with the key in the cache.

* `cache.clear()`

    Clear the cache removing all of the entries cached.

* `cache.keys(): KeyType[]`

    Get all of the keys in the cache as an `Array`. Can be used to iterate
    over all of the values in the cache, but be sure to protect against values
    being removed during iteration due to time-based expiration if used.

* `cache.maxSize: number`

   The maximum size of the cache or `-1` if boundless. This size represents the
   weighted size of the cache.

* `cache.size: number`

   The number of entries stored in the cache. This is the actual number of entries
   and not the weighted size of all of the entries in the cache.

* `cache.weightedSize: number`

    Get the weighted size of the cache. This is the weight of all entries that
    are currently in the cache.

* `cache.cleanUp()`

    _Advanced:_ Request clean up of the cache by removing expired entries and
    old data. Clean up is done automatically a short time after sets and
    deletes, but if your cache uses time-based expiration and has very
    sporadic updates it might be a good idea to call `cleanUp()` at times.
    A good starting point would be to call `cleanUp()` in a `setInterval`
    with a delay of at least a few minutes.

* `cache.metrics: Metrics`

    _For metric enabled caches:_ Get metrics for this cache. Returns an object
    with the keys `hits`, `misses` and `hitRate`. For caches that do not have
    metrics enabled trying to access metrics will throw an error.

## Building a cache

Caches are created via a builder that helps with adding on all requested
functionality and returning a cache.

A builder is created by calling the imported function:

```javascript
import { newCache } from 'transitory';
const builder = newCache();
```

Calls on the builder can be chained:

```javascript
newCache().maxSize(100).loading().build();
```

## Limiting the size of a cache

Caches can be limited to a certain size. This type of cache will evict the
least frequently used items when it reaches its maximum size.

```javascript
const cache = newCache()
  .maxSize(100)
  .build();
```

It is also possible to change how the size of each entry in the cache is
calculated. This can be used to create a better cache if your entries vary in
their size in memory.

```javascript
const cache = newCache()
  .maxSize(2000)
  .withWeigher((key, value) => value.length)
  .build();
```

The size of an entry is evaluated when it is added to the cache so weighing
works best with immutable data. Transitory includes a weigher for estimated
memory:

```javascript
import { memoryUsageWeigher } from 'transitory';

const cache = newCache()
  .maxSize(50000000)
  .withWeigher(memoryUsageWeigher)
  .build();
```

## Automatic expiry

Limiting the maximum amount of time an entry can exist in the cache can be done
by using `expireAfterWrite(time)` or `expireAfterRead(time)`. Entries
are lazy evaluated and will be removed when the values are set or deleted from
the cache.

```javascript
const cache = newCache()
  .expireAfterWrite(5000) // 5 seconds
  .expireAfterRead(1000) // Values need to be read at least once a second
  .build();
```

Both methods can also take a function that should return the maximum age
of the entry in milliseconds:

```javascript
const cache = newCache()
  .expireAfterWrite((key, value) => 5000)
  .expireAfterRead((key, value) => 5000 / key.length)
  .build();
```

## Loading caches

Caches can be made to automatically load values if they are not in the cache.
This type of caches relies heavily on the use of promises.

With a global loader:

```javascript
const cache = newCache()
  .withLoader(key => loadSlowData(key))
  .done();

cache.get(781)
  .then(data => handleLoadedData(data))
  .catch(err => handleError(err));

cache.get(1234, specialLoadingFunction)
```

Without a global loader:

```javascript
const cache = newCache()
  .loading()
  .done();

cache.get(781, key => loadSlowData(key))
  .then(data => handleLoadedData(data))
  .catch(err => handleError(err));
```

Loading caches can be combined with other things such as `maxSize`.

## Metrics

You can track the hit rate of the cache by activating support for metrics:

```javascript
const cache = newCache()
  .metrics()
  .done();

const metrics = cache.metrics;

console.log('hitRate=', metrics.hitRate);
console.log('hits=', metrics.hits);
console.log('misses=', metrics.misses);
```

## Removal listener

Caches support a single removal listener that will be notified when items in
the cache are removed.

```javascript
import { RemovalCause } from 'transitory';
const cache = newCache()
  .withRemovalListener((key, value, reason) => {
    switch(reason) {
      case RemovalCause.EXPLICIT:
        // The user of the cache requested something to be removed
        break;
      case RemovalCause.REPLACED:
        // A new value was loaded and this value was replaced
        break;
      case RemovalCause.SIZE:
        // A value was evicted from the cache because the max size has been reached
        break;
      case RemovalCause.EXPIRED:
        // A value was removed because it expired due to its max age
        break;
    }
  })
  .build();
```
