# Transitory

Transitory is a in-memory caching library for JavaScript. It provides a
bounded cache that evicts the least frequently used items when the cache gets
full.

```javascript
const transitory = require('transitory');

const cache = transitory()
	.withMaxSize(1000)
	.build();

cache.set('key', { value: 10 });

const value = cache.get('key');
```
