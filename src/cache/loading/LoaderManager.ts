import { isPromise } from 'util/types';

import { KeyType } from '../KeyType';

import { Loader } from './Loader';

export type LoaderResult<V> = Exclude<V, undefined>;

/**
 * Manages multiple concurrent loading get requests to a cache.
 * Makes sure that only 1 promise is created which concurrent requests ultimately use.
 * This is useful in case many concurrent database requests for the same piece of data
 * come in, so only 1 database request will be made.
 *
 * @example
 * ```ts
 * // all of the requests are for the same key, and the cache will only allow 1 fetchMetadata to run concurrently.
 * const requests = new Array(100).fill('key')
 *   .map(key => cache.get(key, async () => fetchMetadata(key)));
 *
 * const results = Promise.all(requests);
 * ```
 */
export class LoaderManager<K extends KeyType, V> {
	private readonly promises = new Map<unknown, Promise<V>>();
	private readonly onResolved: (key: K, value: V) => void;

	public constructor(onResolved: (key: K, value: V) => void) {
		this.onResolved = onResolved;
	}

	public get<R extends V | null | undefined>(
		key: K,
		loader: Loader<K, R>
	): Promise<LoaderResult<R>> {
		// See if the promise for a key is already present
		const existingPromise = this.promises.get(key);
		if(existingPromise !== undefined) {
			// existing loader already working, just use its result
			return existingPromise as Promise<LoaderResult<R>>;
		}

		// create a loader
		const loaderResult = loader(key);

		// if it just returned nil, simply return null
		if(loaderResult === null || loaderResult === undefined) {
			return Promise.resolve(null) as Promise<LoaderResult<R>>;
		}

		// if it's not a promise, there is nothing to manage, just return the result
		if(! isPromise(loaderResult)) {
			this.onResolved(key, loaderResult);
			return Promise.resolve(loaderResult as LoaderResult<R>);
		}

		// create a new promise that waits for the loader to finish
		// this promise will be reused for any concurrent loads on the same key
		const newPromise = new Promise<LoaderResult<R>>((resolve, reject) => {
			loaderResult.then(
				r => {
					// remove self from map
					this.promises.delete(key);
					if(r !== null && r !== undefined) {
						// callback for when loader is resolved
						this.onResolved(key, r);
					}
					// resolve the promise
					resolve((r ?? null) as LoaderResult<R>);
				},
				err => {
					// remove self from map
					this.promises.delete(key);
					reject(err);
				}
			);
		});

		// add promise to map so others can share it
		this.promises.set(key, newPromise as Promise<LoaderResult<V>>);

		return newPromise;
	}
}
