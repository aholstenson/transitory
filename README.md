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
