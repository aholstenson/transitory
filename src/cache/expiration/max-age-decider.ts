import { KeyType } from '../key-type';

/**
 * Decider for how long something stays cached. Takes in the key and the value
 * and should return a maximum age in milliseconds.
 */
export type MaxAgeDecider<K extends KeyType, V> = (key: K, value: V) => number;
