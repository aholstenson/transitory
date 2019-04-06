import { Cache } from '../cache/cache';
import { BoundedCache } from '../cache/bounded';
import { KeyType } from '../cache/key-type';
import { BoundlessCache } from '../cache/boundless';
import { Weigher } from '../cache/weigher';
import { DefaultLoadingCache } from '../cache/loading';
import { ExpirationCache } from '../cache/expiration';
import { MetricsCache } from '../cache/metrics/index';
import { RemovalListener } from '../cache/removal-listener';
import { Loader } from '../cache/loading/loader';
import { MaxAgeDecider } from '../cache/expiration/max-age-decider';
import { LoadingCache } from '../cache/loading/loading-cache';
import { Expirable } from '../cache/expiration/expirable';

export interface CacheBuilder<K extends KeyType, V> {
	/**
	 * Set a listener that will be called every time something is removed
	 * from the cache.
	 */
	withRemovalListener(listener: RemovalListener<K, V>): this;

	/**
	 * Set the maximum number of items to keep in the cache before evicting
	 * something.
	 */
	maxSize(size: number): this;

	/**
	 * Set a function to use to determine the size of a cached object.
	 */
	withWeigher(weigher: Weigher<K, V>): this;

	/**
	 * Change to a cache where get can also resolve values if provided with
	 * a function as the second argument.
	 */
	loading(): LoadingCacheBuilder<K, V>;

	/**
	 * Change to a loading cache, where the get-method will return instances
	 * of Promise and automatically load unknown values.
	 */
	withLoader(loader: Loader<K, V>): LoadingCacheBuilder<K, V>;

	/**
	 * Set that the cache should expire items some time after they have been
	 * written to the cache.
	 */
	expireAfterWrite(time: number | MaxAgeDecider<K, V>): this;

	/**
	 * Set that the cache should expire items some time after they have been
	 * read from the cache.
	 */
	expireAfterRead(time: number | MaxAgeDecider<K, V>): this;

	/**
	 * Activate tracking of metrics for this cache.
	 */
	metrics(): this;

	/**
	 * Build the cache.
	 */
	build(): Cache<K, V>;
}

export interface LoadingCacheBuilder<K extends KeyType, V> extends CacheBuilder<K, V> {
	/**
	 * Build the cache.
	 */
	build(): LoadingCache<K, V>;
}

/**
 * Builder for cache instances.
 */
export class CacheBuilderImpl<K extends KeyType, V> implements CacheBuilder<K, V> {
	private optRemovalListener?: RemovalListener<K, V>;
	private optMaxSize?: number;
	private optWeigher?: Weigher<K, V>;
	private optMaxWriteAge?: MaxAgeDecider<K, V>;
	private optMaxNoReadAge?: MaxAgeDecider<K, V>;
	private optMetrics: boolean = false;

	/**
	 * Set a listener that will be called every time something is removed
	 * from the cache.
	 */
	public withRemovalListener(listener: RemovalListener<K, V>) {
		this.optRemovalListener = listener;
		return this;
	}

	/**
	 * Set the maximum number of items to keep in the cache before evicting
	 * something.
	 */
	public maxSize(size: number) {
		this.optMaxSize = size;
		return this;
	}

	/**
	 * Set a function to use to determine the size of a cached object.
	 */
	public withWeigher(weigher: Weigher<K, V>) {
		if(typeof weigher !== 'function') {
			throw new Error('Weigher should be a function that takes a key and value and returns a number');
		}
		this.optWeigher = weigher;
		return this;
	}

	/**
	 * Change to a cache where get can also resolve values if provided with
	 * a function as the second argument.
	 */
	public loading(): LoadingCacheBuilder<K, V> {
		return new LoadingCacheBuilderImpl(this, null);
	}

	/**
	 * Change to a loading cache, where the get-method will return instances
	 * of Promise and automatically load unknown values.
	 */
	public withLoader(loader: Loader<K, V>): LoadingCacheBuilder<K, V> {
		if(typeof loader !== 'function') {
			throw new Error('Loader should be a function that takes a key and returns a value or a promise that resolves to a value');
		}
		return new LoadingCacheBuilderImpl(this, loader);
	}

	/**
	 * Set that the cache should expire items after some time.
	 */
	public expireAfterWrite(time: number | MaxAgeDecider<K, V>) {
		let evaluator;
		if(typeof time === 'function') {
			evaluator = time;
		} else if(typeof time === 'number') {
			evaluator = () => time;
		} else {
			throw new Error('expireAfterWrite needs either a maximum age as a number or a function that returns a number');
		}
		this.optMaxWriteAge = evaluator;
		return this;
	}

	/**
	 * Set that the cache should expire items some time after they have been read.
	 */
	public expireAfterRead(time: number | MaxAgeDecider<K, V>): this {
		let evaluator;
		if(typeof time === 'function') {
			evaluator = time;
		} else if(typeof time === 'number') {
			evaluator = () => time;
		} else {
			throw new Error('expireAfterRead needs either a maximum age as a number or a function that returns a number');
		}
		this.optMaxNoReadAge = evaluator;
		return this;
	}

	/**
	 * Activate tracking of metrics for this cache.
	 */
	public metrics(): this {
		this.optMetrics = true;
		return this;
	}

	/**
	 * Build and return the cache.
	 */
	public build() {
		let cache: Cache<K, V>;
		if(typeof this.optMaxWriteAge !== 'undefined' || typeof this.optMaxNoReadAge !== 'undefined') {
			/*
			 * Requested expiration - wrap the base cache a bit as it needs
			 * custom types, a custom weigher if used and removal listeners
			 * are added on the expiration cache instead.
			 */
			let parentCache: Cache<K, Expirable<V>>;
			if(this.optMaxSize) {
				parentCache = new BoundedCache({
					maxSize: this.optMaxSize,
					weigher: createExpirableWeigher(this.optWeigher)
				});
			} else {
				parentCache = new BoundlessCache({});
			}

			cache = new ExpirationCache({
				maxNoReadAge: this.optMaxNoReadAge,
				maxWriteAge: this.optMaxWriteAge,

				removalListener: this.optRemovalListener,

				parent: parentCache
			});
		} else {
			if(this.optMaxSize) {
				cache = new BoundedCache({
					maxSize: this.optMaxSize,
					weigher: this.optWeigher,
					removalListener: this.optRemovalListener
				});
			} else {
				cache = new BoundlessCache({
					removalListener: this.optRemovalListener
				});
			}
		}

		if(this.optMetrics) {
			// Collect metrics if requested
			cache = new MetricsCache({
				parent: cache
			});
		}

		return cache;
	}
}

class LoadingCacheBuilderImpl<K extends KeyType, V> implements LoadingCacheBuilder<K, V> {
	private parent: CacheBuilder<K, V>;
	private loader: Loader<K, V> | null;

	constructor(parent: CacheBuilder<K, V>, loader: Loader<K, V> | null) {
		this.parent = parent;
		this.loader = loader;
	}

	public withRemovalListener(listener: RemovalListener<K, V>): this {
		this.parent.withRemovalListener(listener);
		return this;
	}

	public maxSize(size: number): this {
		this.parent.maxSize(size);
		return this;
	}

	public withWeigher(weigher: Weigher<K, V>): this {
		this.parent.withWeigher(weigher);
		return this;
	}

	public loading(): LoadingCacheBuilder<K, V> {
		throw new Error('Already building a loading cache');
	}

	public withLoader(loader: Loader<K, V>): LoadingCacheBuilder<K, V> {
		throw new Error('Already building a loading cache');
	}

	public expireAfterWrite(time: number | MaxAgeDecider<K, V>): this {
		this.parent.expireAfterWrite(time);
		return this;
	}

	public expireAfterRead(time: number | MaxAgeDecider<K, V>): this {
		this.parent.expireAfterRead(time);
		return this;
	}

	public metrics(): this {
		this.parent.metrics();
		return this;
	}

	public build(): LoadingCache<K, V> {
		return new DefaultLoadingCache({
			loader: this.loader,

			parent: this.parent.build()
		});
	}
}

function createExpirableWeigher<K extends KeyType, V>(w: Weigher<K, V> | undefined): Weigher<K, Expirable<V>> | null {
	if(! w) return null;

	return (key, node) => w(key, node.value as V);
}
