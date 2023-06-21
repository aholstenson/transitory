import { Cache } from './Cache';
import { KeyType } from './KeyType';
import { Loader } from './loading';
import { LoaderResult } from './loading/LoaderManager';
import { Metrics } from './metrics/Metrics';

/**
 * Abstract class for all cache implementations. This exists so that its
 * possible to use instanceof with caches like: `obj instanceof AbstractCache`.
 */
export abstract class AbstractCache<K extends KeyType, V> implements Cache<K, V> {
	public abstract maxSize: number;
	public abstract size: number;
	public abstract weightedSize: number;

	public abstract set(key: K, value: V): V | null;
	public abstract get<R extends V | undefined | null>(key: K, loader?: Loader<K, V> | undefined): Promise<LoaderResult<R>> ;
	public abstract getIfPresent(key: K): V | null;
	public abstract peek(key: K): V | null;
	public abstract has(key: K): boolean;
	public abstract delete(key: K): V | null;
	public abstract clear(): void;
	public abstract keys(): K[];
	public abstract cleanUp(): void;
	public abstract metrics: Metrics;
}
