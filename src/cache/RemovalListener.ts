import { KeyType } from './KeyType';

import { RemovalReason } from './RemovalReason';

/**
 * Listener for removal events. Receives the key, value and the reason it
 * was removed from the cache.
 */
export type RemovalListener<K extends KeyType, V> = (key: K, value: V, reason: RemovalReason) => void;
