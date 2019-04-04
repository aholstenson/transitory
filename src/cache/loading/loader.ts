import { KeyType } from '../key-type';

/**
 * Function used to load a value in the cache. Can return a promise or a
 * value directly.
 */
export type Loader<K extends KeyType, V> = (key: K) => Promise<V> | V;
