/**
 * Node in a double-linked list.
 */
export class CacheNode<K, V> {
	public key: K | null;
	public value: V | null;

	public next: this;
	public previous: this;

	constructor(key: K | null, value: V | null) {
		this.key = key;
		this.value = value;

		this.previous = this;
		this.next = this;
	}

	public remove() {
		this.previous.next = this.next;
		this.next.previous = this.previous;
		this.next = this.previous = this;
	}

	public appendToTail(head: this) {
		const tail = head.previous;
		head.previous = this;
		tail.next = this;
		this.next = head;
		this.previous = tail;
	}

	public moveToTail(head: this) {
		this.remove();
		this.appendToTail(head);
	}
}
