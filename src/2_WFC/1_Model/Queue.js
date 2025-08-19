/**
 * Utilizes a linked list for O(1) enqueueing/dequeueing.
 * Isn't much faster than an array-based queue in practice due to CPU caching.
 */
export default class Queue {
  front = null;
  back = null;
  length = 0;

  /**
   * Adds an element to the back of the queue.
   * @param {any} element
   */
  enqueue(element) {
    const node = new Node(element);

    if (this.length === 0) {
      this.front = node;
      this.back = node;
    } else {
      this.back.next = node;
      this.back = node;
    }
    
    this.length++;
  }

  /**
   * Returns the element at the front of the queue if there is one, or null if there isn't. 
   * @returns {any | null}
   */
  dequeue() {
    if (this.length === 0) return null;

    const element = this.front.data;
    this.front = this.front.next;
    this.length--;

    if (!this.front) this.back = null;	// update back to match front

    return element;
  }
}

/** A node of a linked list. */
class Node {
  /** @param {any} data */
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}