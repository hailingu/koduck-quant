/**
 * Task Queue - Priority-Based Work Queue
 *
 * Implements efficient priority-based task queue for the worker pool.
 * Uses bucketing strategy to achieve O(1) average case insertion and removal.
 *
 * Data Structure:
 * - Map<priority, QueueItem[]> - Buckets of items at each priority level
 * - Sorted array of priority values - Maintains priority ordering
 * - Length counter - Track queue size without iteration
 *
 * Performance Characteristics:
 * - enqueue: O(1) average, O(n log n) when adding new priority (rare)
 * - dequeue: O(1) to extract highest priority item
 * - remove: O(n) where n = queue size (must filter all buckets)
 * - clear: O(1) amortized
 *
 * Priority Model:
 * - Higher numeric values = higher priority (execute sooner)
 * - Tasks at same priority execute FIFO (first-queued, first-executed)
 * - Supports negative priorities for lower-than-normal urgency
 *
 * Design Rationale:
 * - Bucketing avoids O(n) insertion for sorted queue
 * - Separate priorities array avoids O(n) bucket lookup
 * - Lazy recalculation in remove() balances accuracy vs performance
 *
 * @module TaskQueue
 * @see {@link WorkerPoolRuntime} for usage context
 * @see {@link QueueItem} for item structure
 *
 * @example
 * ```typescript
 * const queue = new TaskQueue();
 *
 * // Enqueue items with different priorities
 * queue.enqueue({ id: 'task-1', task, priority: 1, attempt: 0, enqueuedAt: now, resolve, reject });
 * queue.enqueue({ id: 'task-2', task, priority: 10, attempt: 0, enqueuedAt: now, resolve, reject });
 * queue.enqueue({ id: 'task-3', task, priority: 5, attempt: 0, enqueuedAt: now, resolve, reject });
 *
 * // Dequeue returns highest priority first (FIFO within priority)
 * queue.dequeue(); // task-2 (priority 10)
 * queue.dequeue(); // task-3 (priority 5)
 * queue.dequeue(); // task-1 (priority 1)
 *
 * // Remove by predicate
 * queue.remove((item) => item.id === 'task-1');
 * ```
 */

import type { ExtendedTask } from "./types";

/**
 * Queue Item - Unit of work in task queue
 *
 * Wraps task execution context including resolution callbacks
 * and retry tracking. Not exposed publicly, used internally.
 *
 * @internal
 */
interface QueueItem {
  /**
   * Unique item identifier
   *
   * Used for correlation and debugging.
   * Format: "task-{sequence}"
   */
  id: string;

  /**
   * The task to execute
   */
  task: ExtendedTask;

  /**
   * Promise resolve function
   *
   * Called when task succeeds to resolve caller's promise.
   */
  resolve: (value: unknown) => void;

  /**
   * Promise reject function
   *
   * Called when task fails to reject caller's promise.
   */
  reject: (reason?: unknown) => void;

  /**
   * Execution attempt number
   *
   * Incremented on each retry.
   */
  attempt: number;

  /**
   * Timestamp when item enqueued
   *
   * Used for diagnostics and monitoring.
   */
  enqueuedAt: number;

  /**
   * Task priority
   *
   * Higher values execute first.
   * Tasks at same priority execute FIFO.
   */
  priority: number;
}

/**
 * Priority-Based Task Queue
 *
 * Efficient work queue supporting priority-based ordering and removal.
 * Used by WorkerPoolRuntime to manage queued tasks.
 *
 * Performance:
 * - Enqueue: O(1) average, O(n log n) on new priority introduction (rare)
 * - Dequeue: O(1)
 * - Remove: O(n) worst case - filters all buckets
 * - Size tracking: O(1)
 *
 * Thread Safety:
 * Not thread-safe. Caller must synchronize access (WorkerPoolRuntime does).
 *
 * - Priority 0 is default (normal priority)
 * - Negative priorities supported for low-urgency tasks
 * - FIFO ordering within same priority level
 * - Dynamic priority levels (created on-demand)
 *
 * @example
 * ```typescript
 * const queue = new TaskQueue();
 *
 * // Queue tasks with various priorities
 * queue.enqueue(highPriorityItem);
 * queue.enqueue(normalPriorityItem);
 * queue.enqueue(lowPriorityItem);
 *
 * // Process highest priority first
 * while (queue.size > 0) {
 *   const item = queue.dequeue();
 *   processItem(item);
 * }
 * ```
 */
export class TaskQueue {
  /**
   * Priority-based task buckets
   *
   * Map from priority level (numeric) to array of items at that priority.
   * When priority bucket becomes empty, it's removed to save memory.
   *
   * Internal data structure - not accessed directly.
   *
   * @private
   * @readonly
   */
  private readonly buckets = new Map<number, QueueItem[]>();

  /**
   * Sorted array of active priority levels
   *
   * Maintained in descending order (highest priority first).
   * Updated when buckets added/removed.
   * Enables O(1) access to highest priority bucket.
   *
   * @private
   */
  private priorities: number[] = [];

  /**
   * Cached queue size
   *
   * Incremented on enqueue, decremented on dequeue.
   * Enables O(1) size queries without iteration.
   * Recalculated in remove() to account for filtering.
   *
   * @private
   */
  private lengthValue = 0;

  /**
   * Add item to queue
   *
   * Enqueues item at appropriate priority level. Creates new priority
   * bucket if needed. Updates size counter.
   *
   * @param item - Queue item to add (includes task, priority, callbacks)
   *
   * Performance:
   * - O(1) if priority bucket exists (just array.push)
   * - O(n log n) if new priority introduced (due to priority sorting)
   * - Average: O(1) amortized (new priorities rare)
   *
   * - Items at same priority maintain FIFO order
   * - Safe to call from any context (WorkerPoolRuntime synchronizes)
   *
   * @example
   * ```typescript
   * queue.enqueue({
   *   id: 'task-42',
   *   task: { type: 'compute', payload: data },
   *   resolve: promiseResolve,
   *   reject: promiseReject,
   *   attempt: 1,
   *   enqueuedAt: Date.now(),
   *   priority: 5,
   * });
   * ```
   *
   * @see {@link dequeue} to retrieve items
   */
  enqueue(item: QueueItem): void {
    const bucket = this.ensureBucket(item.priority);
    bucket.push(item);
    this.lengthValue += 1;
  }

  /**
   * Remove and return highest priority item
   *
   * Returns item with highest priority value. Within same priority,
   * returns FIFO (first-enqueued item).
   * Removes empty priority buckets to maintain cleanliness.
   *
   * @returns Highest priority item, or undefined if queue empty
   *
   * Performance: O(1)
   *
   * - Safe even on empty queue (returns undefined, no error)
   * - Updates size counter on successful dequeue
   * - Removes buckets when they become empty (memory cleanup)
   *
   * @example
   * ```typescript
   * const item = queue.dequeue();
   * if (item) {
   *   executeTask(item); // Process highest priority item
   * }
   * ```
   *
   * @see {@link enqueue} to add items
   * @see {@link size} to check if queue empty
   */
  dequeue(): QueueItem | undefined {
    if (this.lengthValue === 0) {
      return undefined;
    }

    const currentPriority = this.priorities[0];
    const bucket = this.buckets.get(currentPriority);
    if (!bucket) {
      return undefined;
    }

    const item = bucket.shift();
    if (bucket.length === 0) {
      this.buckets.delete(currentPriority);
      this.priorities = this.priorities.slice(1);
    }

    if (item) {
      this.lengthValue -= 1;
    }

    return item;
  }

  /**
   * Remove items matching predicate
   *
   * Removes all items where predicate returns true. Useful for:
   * - Canceling specific tasks
   * - Removing tasks for disposed pool
   * - Filtering tasks by criteria
   *
   * @param predicate - Function returning true for items to remove
   *
   * Returns: void (modifies queue in-place)
   *
   * Performance:
   * - O(n * m) where n = number of priority levels, m = items per level
   * - Requires full scan of all buckets
   * - Recalculates size after filtering (not estimated)
   *
   * - Removes empty buckets after filtering
   * - Size counter recalculated accurately
   * - Safe to call on empty queue
   * - Does not maintain priority array order (already sorted)
   *
   * @example
   * ```typescript
   * // Remove specific task
   * queue.remove((item) => item.id === 'task-42');
   *
   * // Remove all tasks of type
   * queue.remove((item) => item.task.type === 'cancelled-type');
   *
   * // Remove expired tasks
   * queue.remove((item) => Date.now() - item.enqueuedAt > TIMEOUT);
   * ```
   *
   * @see {@link enqueue}
   * @see {@link clear} to empty entire queue
   */
  remove(predicate: (item: QueueItem) => boolean): void {
    for (const priority of this.priorities) {
      const bucket = this.buckets.get(priority);
      if (!bucket) {
        continue;
      }

      const filtered = bucket.filter((item) => !predicate(item));
      if (filtered.length === 0) {
        this.buckets.delete(priority);
        this.priorities = this.priorities.filter((value) => value !== priority);
      } else if (filtered.length !== bucket.length) {
        this.buckets.set(priority, filtered);
      }
    }

    this.recalculateSize();
  }

  /**
   * Clear all items from queue
   *
   * Removes all queued items, resets size to zero.
   * Useful for disposal and cleanup.
   *
   * Performance: O(1) (just clearing maps/arrays)
   *
   * @example
   * ```typescript
   * // Clean up on pool shutdown
   * queue.clear();
   * assert(queue.size === 0);
   * ```
   *
   * @see {@link remove} for selective removal
   */
  clear(): void {
    this.buckets.clear();
    this.priorities = [];
    this.lengthValue = 0;
  }

  /**
   * Current number of items in queue
   *
   * Accurate count maintained via counters (not recalculated on each call).
   * Cost: O(1)
   *
   * @returns Number of queued items (0 if empty)
   *
   * - Includes all priority levels
   * - Updated incrementally on enqueue/dequeue
   * - Recalculated after remove() for accuracy
   *
   * @example
   * ```typescript
   * if (queue.size === 0) {
   *   console.log('Queue empty');
   * }
   * if (queue.size > MAX_QUEUE) {
   *   rejectNewTasks(); // Backpressure
   * }
   * ```
   */
  get size(): number {
    return this.lengthValue;
  }

  /**
   * Ensure priority bucket exists, creating if needed
   *
   * Gets or creates bucket for given priority. Inserts into sorted
   * priorities array to maintain descending order.
   *
   * @param priority - Priority level
   * @returns Array bucket for priority (may be newly created)
   *
   * Performance:
   * - O(1) if bucket exists (Map lookup)
   * - O(n log n) if new bucket created (array sort)
   * - Average: O(1) amortized (new priorities rare)
   *
   * @private
   */
  private ensureBucket(priority: number): QueueItem[] {
    if (this.buckets.has(priority)) {
      return this.buckets.get(priority)!;
    }

    const bucket: QueueItem[] = [];
    this.buckets.set(priority, bucket);
    this.priorities = [...this.priorities, priority].sort((a, b) => b - a);
    return bucket;
  }

  /**
   * Recalculate queue size from scratch
   *
   * Iterates all buckets to count items. Used after remove() operations
   * to ensure accuracy since filtering doesn't update counter in-place.
   *
   * Performance: O(n * m) where n = priorities, m = items per level
   *
   * @private
   */
  private recalculateSize(): void {
    let count = 0;
    for (const bucket of this.buckets.values()) {
      count += bucket.length;
    }
    this.lengthValue = count;
  }
}

/**
 * QueueItem Type Export
 *
 * Exported for use in WorkerPoolRuntime which extends QueueItem
 * with pool-specific fields (timeouts, token sources, etc).
 *
 * @see {@link QueueItem}
 */
export type { QueueItem };
