import { KeyType } from './KeyType';

/**
 * Weigher that evaluates a key and value and returns a size.
 */
export type Weigher<K extends KeyType, V> = (key: K, value: V) => number;
