/**
 * Priority Queue - High-Performance Task Priority Management
 *
 * Implements a min-heap based priority queue for efficient task scheduling.
 * Provides O(log n) insertion and removal with O(1) peek operations.
 *
 * Data Structure:
 * - Array-based binary heap (implicit structure, no node objects)
 * - Comparator function for flexible priority ordering
 * - Parent: floor((index - 1) / 2)
 * - Left child: 2 * index + 1
 * - Right child: 2 * index + 2
 *
 * Performance Characteristics:
 * - enqueue: O(log n) - sift up operation
 * - dequeue: O(log n) - sift down operation
 * - peek: O(1) - array access
 * - size: O(1) - counter maintained
 * - clear: O(1) - array reset
 *
 * Memory Efficiency:
 * - No additional node objects - pure array-based
 * - Implicit parent-child relationships
 * - Resizable array with power-of-2 growth factor
 *
 * Usage:
 * - Task scheduling with priorities
 * - Event priority queues
 * - Dijkstra's algorithm implementation
 * - Any application needing efficient priority ordering
 *
 * @module PriorityQueue
 * @see {@link WorkerPoolRuntime} for typical usage
 *
 * @example
 * ```typescript
 * // Min-heap: smaller values have higher priority (execute first)
 * const pq = new PriorityQueue<Task>((a, b) => a.priority - b.priority);
 *
 * // Add items with different priorities
 * pq.enqueue({ id: 'task-1', priority: 10 });
 * pq.enqueue({ id: 'task-2', priority: 5 });
 * pq.enqueue({ id: 'task-3', priority: 15 });
 *
 * // Extract items in priority order (higher priority first)
 * console.log(pq.dequeue().id); // 'task-2' (priority 5)
 * console.log(pq.dequeue().id); // 'task-1' (priority 10)
 * console.log(pq.dequeue().id); // 'task-3' (priority 15)
 *
 * // For max-heap (higher values first)
 * const maxPq = new PriorityQueue<Task>((a, b) => b.priority - a.priority);
 * ```
 */

/**
 * Comparator function for priority queue ordering
 *
 * Used to determine priority between two items:
 * - Return value < 0: first item has higher priority
 * - Return value > 0: second item has higher priority
 * - Return value = 0: items have equal priority
 *
 * @template T - Type of items in queue
 * @param a - First item to compare
 * @param b - Second item to compare
 * @returns Comparison result
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Priority Queue - Generic heap-based priority queue
 *
 * Efficiently manages items based on priority ordering.
 * Provides logarithmic insertion/removal with constant-time peek.
 *
 * The queue maintains a binary heap invariant:
 * For each node at index i:
 * - comparator(heap[i], heap[parent(i)]) >= 0
 *
 * @template T - Type of items stored in queue
 */
export class PriorityQueue<T> {
  /**
   * Internal heap array storing queue items
   *
   * @internal
   */
  private heap: T[] = [];

  /**
   * Comparator function for ordering items
   *
   * @internal
   */
  private readonly comparator: Comparator<T>;

  /**
   * Current number of items in queue
   *
   * Tracked separately for efficient size queries.
   *
   * @internal
   */
  private itemCount: number = 0;

  /**
   * Create a new priority queue with given comparator
   *
   * @param comparator - Function determining item priority ordering.
   * By default creates a min-heap (smaller values execute first).
   * Pass a reverse comparator for max-heap behavior.
   * @param initialCapacity - Initial array capacity (default: 16)
   *
   * @throws {TypeError} If comparator is not a function
   *
   * @example
   * ```typescript
   * // Min-heap: priorities 1,2,3 (1 executes first)
   * const minHeap = new PriorityQueue((a, b) => a.priority - b.priority);
   *
   * // Max-heap: priorities 1,2,3 (3 executes first)
   * const maxHeap = new PriorityQueue((a, b) => b.priority - a.priority);
   * ```
   */
  constructor(comparator: Comparator<T>, initialCapacity: number = 16) {
    if (typeof comparator !== "function") {
      throw new TypeError("Comparator must be a function");
    }
    this.comparator = comparator;
    this.heap = new Array(Math.max(initialCapacity, 16));
  }

  /**
   * Add an item to the priority queue
   *
   * Inserts item and maintains heap property via upward sift.
   *
   * Time complexity: O(log n)
   * Space complexity: O(1) amortized
   *
   * @param item - Item to add
   * @throws {Error} If queue is full (unlikely under normal usage)
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * pq.enqueue({ id: 'task-2', priority: 3 });
   * console.log(pq.size()); // 2
   * ```
   */
  enqueue(item: T): void {
    if (this.itemCount === this.heap.length) {
      // Grow capacity: double size with minimum of 16
      const newCapacity = Math.max(this.heap.length * 2, 16);
      const newHeap = new Array(newCapacity);
      for (let i = 0; i < this.itemCount; i++) {
        newHeap[i] = this.heap[i]!;
      }
      this.heap = newHeap;
    }

    this.heap[this.itemCount] = item;
    this.siftUp(this.itemCount);
    this.itemCount++;
  }

  /**
   * Remove and return the highest priority item
   *
   * Removes root and maintains heap property via downward sift.
   *
   * Time complexity: O(log n)
   * Space complexity: O(1)
   *
   * @returns The item with highest priority, or undefined if queue is empty
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * pq.enqueue({ id: 'task-2', priority: 3 });
   *
   * const first = pq.dequeue(); // { id: 'task-2', priority: 3 }
   * const second = pq.dequeue(); // { id: 'task-1', priority: 5 }
   * const third = pq.dequeue(); // undefined
   * ```
   */
  dequeue(): T | undefined {
    if (this.itemCount === 0) {
      return undefined;
    }

    const root = this.heap[0];
    this.itemCount--;

    if (this.itemCount > 0) {
      this.heap[0] = this.heap[this.itemCount];
      this.siftDown(0);
    }

    this.heap[this.itemCount] = undefined as unknown as T;
    return root;
  }

  /**
   * View the highest priority item without removing it
   *
   * Time complexity: O(1)
   * Space complexity: O(1)
   *
   * @returns The item with highest priority, or undefined if queue is empty
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   *
   * const next = pq.peek(); // { id: 'task-1', priority: 5 }
   * console.log(pq.size()); // Still 1 - peek doesn't remove
   * ```
   */
  peek(): T | undefined {
    return this.itemCount > 0 ? this.heap[0] : undefined;
  }

  /**
   * Check if queue contains no items
   *
   * Time complexity: O(1)
   *
   * @returns True if queue is empty, false otherwise
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * console.log(pq.isEmpty()); // true
   *
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * console.log(pq.isEmpty()); // false
   * ```
   */
  isEmpty(): boolean {
    return this.itemCount === 0;
  }

  /**
   * Get the number of items in queue
   *
   * Time complexity: O(1)
   *
   * @returns Current queue size
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * pq.enqueue({ id: 'task-2', priority: 3 });
   * console.log(pq.size()); // 2
   * ```
   */
  size(): number {
    return this.itemCount;
  }

  /**
   * Remove all items from the queue
   *
   * Time complexity: O(1) amortized
   * Note: Array capacity is preserved for reuse
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * pq.enqueue({ id: 'task-2', priority: 3 });
   *
   * pq.clear();
   * console.log(pq.size()); // 0
   * console.log(pq.isEmpty()); // true
   * ```
   */
  clear(): void {
    for (let i = 0; i < this.itemCount; i++) {
      this.heap[i] = undefined as unknown as T;
    }
    this.itemCount = 0;
  }

  /**
   * Toposorted array of items in priority order (destructive)
   *
   * Returns items in priority order by repeatedly calling dequeue.
   * This empties the queue.
   *
   * Time complexity: O(n log n)
   * Space complexity: O(n) for returned array
   *
   * Useful for debugging and testing priority ordering.
   *
   * @returns Array of items in priority order
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   * pq.enqueue({ id: 'task-2', priority: 3 });
   * pq.enqueue({ id: 'task-3', priority: 8 });
   *
   * const ordered = pq.toArray();
   * // [
   * //   { id: 'task-2', priority: 3 },
   * //   { id: 'task-1', priority: 5 },
   * //   { id: 'task-3', priority: 8 }
   * // ]
   * console.log(pq.isEmpty()); // true (queue was emptied)
   * ```
   */
  toArray(): T[] {
    const result: T[] = [];
    while (!this.isEmpty()) {
      const item = this.dequeue();
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  /**
   * Get internal statistics for monitoring and debugging
   *
   * Time complexity: O(1)
   *
   * @returns Statistics object with size and capacity information
   *
   * @internal
   *
   * @example
   * ```typescript
   * const pq = new PriorityQueue((a, b) => a.priority - b.priority);
   * pq.enqueue({ id: 'task-1', priority: 5 });
   *
   * const stats = pq.getStats();
   * console.log(stats);
   * // { size: 1, capacity: 16, utilizationPercent: 6.25 }
   * ```
   */
  getStats(): {
    size: number;
    capacity: number;
    utilizationPercent: number;
  } {
    return {
      size: this.itemCount,
      capacity: this.heap.length,
      utilizationPercent: (this.itemCount / this.heap.length) * 100,
    };
  }

  /**
   * Restore heap property by moving item up towards root
   *
   * Called after insertion at leaf to maintain heap invariant.
   * Bubble up until parent has higher or equal priority.
   *
   * Time complexity: O(log n)
   * Space complexity: O(1)
   *
   * @param index - Index of item to sift up
   * @internal
   */
  private siftUp(index: number): void {
    let currentIndex = index;
    const item = this.heap[currentIndex];

    while (currentIndex > 0) {
      const parentIndex = Math.floor((currentIndex - 1) / 2);
      const parent = this.heap[parentIndex];

      // If parent has higher or equal priority, stop
      if (this.comparator(parent, item) <= 0) {
        break;
      }

      // Move parent down and continue
      this.heap[currentIndex] = parent;
      currentIndex = parentIndex;
    }

    this.heap[currentIndex] = item;
  }

  /**
   * Restore heap property by moving item down towards leaves
   *
   * Called after dequeue to maintain heap invariant.
   * Bubble down until all children have lower or equal priority.
   *
   * Time complexity: O(log n)
   * Space complexity: O(1)
   *
   * @param index - Index of item to sift down
   * @internal
   */
  private siftDown(index: number): void {
    const item = this.heap[index];
    const half = Math.floor(this.itemCount / 2);
    let currentIndex = index;

    while (currentIndex < half) {
      let childIndex = currentIndex * 2 + 1;
      const rightChildIndex = childIndex + 1;

      const leftChild = this.heap[childIndex];
      const rightChild = rightChildIndex < this.itemCount ? this.heap[rightChildIndex] : null;

      // Use right child if it has higher priority
      if (rightChild && this.comparator(rightChild, leftChild) < 0) {
        childIndex = rightChildIndex;
      }

      const child = this.heap[childIndex];

      // If item has higher or equal priority than child, stop
      if (this.comparator(item, child) <= 0) {
        break;
      }

      // Move child up and continue
      this.heap[currentIndex] = child;
      currentIndex = childIndex;
    }

    this.heap[currentIndex] = item;
  }
}
