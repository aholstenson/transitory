import { KeyType } from './key-type';

import { RemovalReason } from './removal-reason';

/**
 * Listener for removal events. Receives the key, value and the reason it
 * was removed from the cache.
 */
export type RemovalListener<K extends KeyType, V> = (key: K, value: V, reason: RemovalReason) => void;
