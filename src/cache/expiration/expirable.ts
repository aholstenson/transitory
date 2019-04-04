/**
 * Expirable object.
 */
export interface Expirable<V> {
	/**
	 * Get the current value.
	 */
	readonly value: V | null;

	/**
	 * Get if this expirable object is considered expired.
	 */
	isExpired(): boolean;
}
