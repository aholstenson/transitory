/**
 * Node in a double-linked list.
 */
class CacheNode {
    constructor(key, value) {
        this.key = key;
        this.value = value;

        this.previous = this;
        this.next = this;
    }

    remove() {
        this.previous.next = this.next;
        this.next.previous = this.previous;
        this.next = this.previous = this;
    }

    append(head) {
        const tail = head.previous;
        head.previous = this;
        tail.next = this;
        this.next = head;
        this.previous = tail;
    }

    move(head) {
        this.remove();
        this.append(head);
    }
}
module.exports = CacheNode;
