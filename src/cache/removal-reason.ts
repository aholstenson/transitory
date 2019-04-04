/**
 * The reason something was removed from a cache.
 */
export enum RemovalReason {
	EXPLICIT = 'explicit',
	REPLACED = 'replaced',
	SIZE = 'size',
	EXPIRED = 'expired'
}
