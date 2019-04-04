import { KeyType } from './cache/key-type';
import { CacheBuilder, CacheBuilderImpl } from './builder';

export { CacheBuilder, LoadingCacheBuilder } from './builder';

export { KeyType } from './cache/key-type';

export { AbstractCache } from './cache/abstract';
export { Cache } from './cache/cache';

export { Weigher } from './cache/weigher';

export { Metrics } from './cache/metrics';

export { RemovalReason } from './cache/removal-reason';
export { RemovalListener } from './cache/removal-listener';

export { Loader } from './cache/loading/loader';
export { LoadingCache } from './cache/loading/loading-cache';

export { Expirable } from './cache/expiration/expirable';
export { MaxAgeDecider } from './cache/expiration/max-age-decider';

export { memoryEstimator } from './utils/memoryEstimator';

/**
 * Create a new cache via a builder.
 */
export function newCache<K extends KeyType, V>(): CacheBuilder<K, V> {
	return new CacheBuilderImpl<K, V>();
}
