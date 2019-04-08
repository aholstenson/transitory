export const PARENT = Symbol('parent');

/**
 * SPI extension for listening to removal of a wrapped cache.
 */
export const ON_REMOVE = Symbol('onRemove');

/**
 * Shared symbol used for common code that triggers remove listeners.
 */
export const TRIGGER_REMOVE = Symbol('triggerRemove');

/**
 * SPI extension for listening to eviction events.
 */
export const ON_MAINTENANCE = Symbol('onMaintenance');

/**
 * Shared symbol used for common code related to maintenace.
 */
export const MAINTENANCE = Symbol('maintenance');
