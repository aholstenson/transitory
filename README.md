# Transitory

[![npm version](https://badge.fury.io/js/transitory.svg)](https://badge.fury.io/js/transitory)
[![Build Status](https://travis-ci.org/aholstenson/transitory.svg?branch=master)](https://travis-ci.org/aholstenson/transitory)
[![Coverage Status](https://coveralls.io/repos/aholstenson/transitory/badge.svg)](https://coveralls.io/github/aholstenson/transitory)
[![Dependencies](https://david-dm.org/aholstenson/transitory.svg)](https://david-dm.org/aholstenson/transitory)

Transitory is a in-memory cache with high hit rates using eviction based on
frequency and recency. Additional cache layers support time-based expiration,
automatic loading and metrics.

```javascript
const transitory = require('transitory');

const cache = transitory()
  .maxSize(1000)
  .expireAfterWrite('60s')
  .build();

cache.set('key', { value: 10 });
cache.set(1234, 'any value');

const value = cache.get('key');
```

## Performance

The caches in this library are designed to have a high hit rate by evicting
entries in the cache that are not frequently used. Transitory implements
[W-TinyLFU](https://arxiv.org/abs/1512.00727) as its eviction policy which is
a LFU policy that provides good hit rates for many use cases.

See [Performance](https://github.com/aholstenson/transitory/wiki/Performance)
in the wiki for comparisons of the hit rate of Transitory to other libraries.

## Basic API

There are a few basic things that all caches support.

* `cache.set(key, value): mixed|null`

    Set a value in the cache. The ke can be either a string or a number, while
    the value can be anything. Returns the previous value or `null` if no value
    exists for the given key.

* `cache.get(key): mixed|null`

    Get a cached value. The key can be either a string or a number. Will return
    any cached value and update is usage frequency.

* `cache.getIfPresent(key): mixed|null`

    Same as `get(key)` except this will never load a value if it does not exist.
    Usually used together with a loading cache to bypass loading if not needed.

* `cache.has(key): boolean`

    Check if the given key exists in the cache. The key can be either a
    string or a number.

* `cache.delete(key): mixed|null`

    Delete a value in the cache. The key can be either a key or a value.
    Returns the removed value or `null` if the value was not in the cache.

* `cache.clear()`

    Clear the cache removing all of the entries cached.

* `cache.keys(): Array[mixed]`

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

## Building a cache

Caches are created via a builder that helps with adding on all requested
functionality and returning a cache.

A builder is created by calling the imported function:

```javascript
const transitory = require('transitory');
const builder = transitory();
```

Calls on the builder can be chained:

```javascript
transitory().maxSize(100).loading().build();
```

## Limiting the size of a cache

Caches can be limited to a certain size. This type of cache will evict the
least frequently used items when it reaches its maximum size.

```javascript
const cache = transitory()
  .maxSize(100)
  .build();
```

It is also possible to change how the size of each entry in the cache is
calculated. This can be used to create a better cache if your entries vary in
their size in memory.

```javascript
const cache = transitory()
  .maxSize(2000)
  .withWeigher((key, value) => value.length)
  .build();
```

The size of an entry is evaluated when it is added to the cache so weighing
works best with immutable data. Transitory includes a weigher for estimated
memory:

```javascript
const cache = transitory()
  .maxSize('50M') // 50 000 000
  .withWeigher(transitory.memoryUsageWeigher)
  .build();
```

## Automatic expiry

Limiting the maximum amount of time an entry can exist in the cache can be done
by using `expireAfterWrite(time)` or `expireAfterRead(time)`. Entries
are lazy evaluated and will be removed when the values are set or deleted from
the cache.

```javascript
const cache = transitory()
  .expireAfterWrite(5000) // 5 seconds
  .expireAfterRead('1s') // Values need to be read at least once a second
  .build();
```

Values can either be a number representing milliseconds or a duration string
such as `1s`, `2m`, `1h` or `5d 20m`.

Both methods can also take a function that should return the maximum age
of the entry in milliseconds:

```javascript
const cache = transitory()
  .expireAfterWrite((key, value) => 5000)
  .expireAfterRead((key, value) => 5000 / key.length)
  .build();
```

If either `expireAfterWrite` or `expireAfterRead` has been used a maximum
age can be given to `set`:

```javascript
cache.set('key', value, { maxAge: 5000 });
cache.set(1000, value, { maxAge: '1m' });
```

## Loading caches

Caches can be made to automatically load values if they are not in the cache.
This type of caches relies heavily on the use of promises.

With a global loader:

```javascript
const cache = transitory()
  .withLoader(key => loadSlowData(key))
  .done();

cache.get(781)
  .then(data => handleLoadedData(data))
  .catch(err => handleError(err));

cache.get(1234, specialLoadingFunction)
```

Without a global loader:

```javascript
const cache = transitory()
  .loading()
  .done();

cache.get(781, key => loadSlowData(key))
  .then(data => handleLoadedData(data))
  .catch(err => handleError(err));
```

Loading caches can be combined with other things such as `maxSize`.

`withLoader` on the builder can be used with our without a function that loads
missing items. If provided the function may return a Promise or value.

API extensions for loading caches:

* `cache.get(key): Promise` - `get` always returns a promise that will eventually resolve to the loaded value or fail
* `cache.get(key, loader: Function): Promise` - provide a custom function that loads the value if needed, should return a Promise or a value. Example: `cache.get(500, key => key / 5)` would resolve to 100.

## Metrics

You can track the hit rate of the cache by activating support for metrics:

```javascript
const cache = transitory()
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
const RemovalCause = transitory.RemovalCause;
const cache = transitory()
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
        // A value was removed because it expired due to its autoSuggest
        break;
    }
  })
  .build();
```
