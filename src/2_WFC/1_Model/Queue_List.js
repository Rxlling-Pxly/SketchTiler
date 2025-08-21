/**
 * An list-based queue implementation with an O(1) enqueue and O(N) dequeue.
 * Is tied in performance with a linked list-based queue in practice due to CPU caching.
 * See queueBenchmark.js in the archive folder to witness it for yourself.
 */
export default class Queue {
  list = [];
  length = 0;

  /** Adds `element` to the back of the queue.
   *  @param {any} element */
  enqueue(element) {
    this.list.push(element);
    this.length++;
  }

  /** Returns the element at the front of the queue if there is one. Otherwise, returns `null`.
   *  @returns {any | null} */
  dequeue() {
    if (this.length === 0) return null;
    
    this.length--;
    return this.list.shift();
  }
}
