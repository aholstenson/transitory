# Transitory

Transitory is a in-memory caching library for JavaScript. It provides a
bounded cache that evicts the least frequently used items when the cache gets
full. This library aims to provide caches that have a high hit rate with
fast enough access.

```javascript
const transitory = require('transitory');

const cache = transitory()
	.withMaxSize(1000)
	.build();

cache.set('key', { value: 10 });

const value = cache.get('key');
```

## Basic API

There are a few basic things that all caches support.

* `cache.maxSize: number` - the maximum size of the cache or `-1` if boundless
* `cache.size: number` - the number of items in the cache
* `cache.get(key): mixed|null` - get a cached value
* `cache.getIfPresent(key): mixed|null` - get a cached value without optional loading (see below)
* `cache.has(key): boolean` - check if the given key exists in the cache
* `cache.set(key, value): mixed|null` - set a value in the cache. Returns the previous value or `null`
* `cache.delete(key): mixed|null` - delete a value in the cache. Returns the removed value or `null`

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
transitory().withMaxSize(100).withLoading().build();
```

## Limiting the size of a cache

Caches can be limited to a certain size. This type of cache will evict the
least frequently used items when it reaches its maximum size.

```javascript
const cache = transitory()
	.withMaxSize(100)
	.build();
```

It is also possible to change how the size of each entry in the cache is
calculated. This can be used to create a better cache if your entries vary in
their size in memory.

```javascript
const cache = transitory()
	.withMaxSize(2000)
	.withWeigher((key, value) => value.length)
	.build();
```

The size of an entry is evaluated when it is added to the cache so weighing
works best with immutable data. Transitory includes a weigher for estimated
memory:

```javascript
const cache = transitory()
	.withMaxSize(5242880)
	.withWeigher(transitory.memoryUsageWeigher)
	.build();
```

## Automatic expiry

Limiting the maximum amount of time an entry can exist in the cache can be done
by using `expireAfterWrite(timeInMs)`. For now its recommended to use this
together with `withMaxSize` as removal is lazily executed when the cache is
updated and needs to evict old data.

```javascript
const cache = transitory()
	.withMaxSize(100)
	.expireAfterWrite(5000) // 5 seconds
	.build();
```

## Loading caches

Caches can be made to automatically load values if they are not in the cache.
This type of caches relies heavily on the use of promises.

```javascript
const cache = transitory()
	.withLoading(key => loadSlowData(key))
	.done();

cache.get(781)
	.then(data => handleLoadedData(data))
	.catch(err => handleError(err));
```

Loading caches can be combined with other things such as `withMaxSize`.

`withLoading` on the builder can be used with our without a function that loads
missing items. If provided the function may return a Promise or value.

API extensions for loading caches:

* `cache.get(key): Promise` - `get` always returns a promise that will eventually resolve to the loaded value or fail
* `cache.get(key, loader: Function): Promise` - provide a custom function that loads the value if needed, should return a Promise or a value. Example: `cache.get(500, key => key / 5)` would resolve to 100.

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
