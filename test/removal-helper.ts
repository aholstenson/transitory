import { KeyType } from '../src/cache/KeyType';
import { RemovalListener } from '../src/cache/RemovalListener';
import { RemovalReason } from '../src/cache/RemovalReason';

export class RemovalHelper<K extends KeyType, V> {
	public listener: RemovalListener<K, V>;

	public didRemove: boolean;

	public removedKey: K | null;
	public removedValue: V | null;
	public removalReason: RemovalReason | null;

	public constructor() {
		this.listener = (key, value, reason) => {
			this.didRemove = true;

			this.removedKey = key;
			this.removedValue = value;
			this.removalReason = reason;
		};

		this.didRemove = false;
		this.removedKey = null;
		this.removedValue = null;
		this.removalReason = null;
	}

	public reset() {
		this.didRemove = false;
	}
}
