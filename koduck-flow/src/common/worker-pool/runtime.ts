/**
 * Worker Pool Runtime Engine
 *
 * Core implementation of the WorkerPool interface, managing parallel task execution
 * with comprehensive fault tolerance, retry logic, and performance monitoring.
 *
 * ## Architecture Overview
 *
 * The runtime implements a complete task execution pipeline:
 * 1. **Task Queueing**: Priority-based queue with overflow protection
 * 2. **Scheduling**: Allocates available workers to queued tasks
 * 3. **Execution**: Runs handler with timeout and cancellation support
 * 4. **Failure Handling**: Retry logic with exponential backoff, worker recovery, and fallback
 * 5. **Monitoring**: Real-time statistics and event emission
 *
 * ## Worker State Management
 *
 * Workers transition through states:
 * - Available: Ready to accept new tasks
 * - Active: Currently executing a task
 * - Crashed: Failed and scheduled for recovery
 * - Recovered: Restored after crash recovery delay
 *
 * ## Retry Strategy
 *
 * Tasks are retried based on:
 * - Retryability flag in task options (default: true)
 * - Maximum retry count (configurable per task or globally)
 * - Retry delay with exponential backoff (configurable)
 * - Worker crash recovery: Uses dedicated recovery delay
 *
 * ## Error Handling Hierarchy
 *
 * 1. Task Timeout: Cancels execution, applies retry logic
 * 2. Worker Crash: Marks worker unavailable, schedules recovery
 * 3. Transient Error: Retries with delay if retries remain
 * 4. Permanent Error: Attempts fallback execution (main thread fallback)
 * 5. Fallback Failure: Rejects promise with final error
 *
 * ## Performance Characteristics
 *
 * - Task Queueing: O(1) amortized (priority bucketing)
 * - Worker Acquisition: O(1) (FIFO from available pool)
 * - Task Execution: O(n) where n = task complexity
 * - Timeout Handling: O(1) per task
 * - Cancellation: O(k) where k = registered callbacks
 * - Statistics Updates: O(1)
 *
 * ## Memory Management
 *
 * - In-flight tasks tracked for cleanup on disposal
 * - Recovery timers cleaned up automatically
 * - Failed tasks removed from inflight set
 * - Crashed workers recovered or handled gracefully
 *
 * ## Event Model
 *
 * Emits events at key lifecycle points:
 * - TASK_QUEUED: Task added to queue
 * - TASK_STARTED: Task begins execution
 * - TASK_COMPLETED: Task succeeded
 * - TASK_FAILED: Task failed after retries/fallback
 * - TASK_FALLBACK: Fallback execution triggered
 * - TASK_TIMEOUT: Task exceeded time limit
 * - WORKER_UNAVAILABLE: Worker crashed
 * - WORKER_RECOVERY_SCHEDULED: Recovery scheduled
 * - WORKER_RECOVERED: Worker restored
 * - POOL_STATS_UPDATED: Statistics snapshot
 *
 * @module WorkerPoolRuntime
 * @implements {WorkerPool}
 *
 * @example
 * ```typescript
 * // Create runtime with configuration
 * const runtime = new WorkerPoolRuntime({
 *   workerCount: 4,
 *   defaultTaskTimeout: 30000,
 *   maxRetries: 3,
 *   retryDelay: 100,
 *   handlers: {
 *     'compute': (payload, context) => {
 *       // Check cancellation
 *       if (context.cancellationToken.isCancellationRequested) {
 *         throw new Error('Task cancelled');
 *       }
 *
 *       // Perform computation
 *       return performComputation(payload);
 *     }
 *   }
 * });
 *
 * // Execute single task
 * try {
 *   const result = await runtime.execute({
 *     type: 'compute',
 *     payload: { data: [...] },
 *     timeout: 60000 // Override default timeout
 *   });
 * } catch (error) {
 *   console.error('Task failed:', error);
 * }
 *
 * // Execute batch
 * const results = await runtime.executeBatch([
 *   { type: 'compute', payload: { data: [...] } },
 *   { type: 'compute', payload: { data: [...] } },
 * ]);
 *
 * // Listen for events
 * runtime.addEventListener((event) => {
 *   console.log(`Worker pool event:`, event.type);
 * });
 *
 * // Get statistics
 * const stats = runtime.getStats();
 * console.log(`Active: ${stats.activeWorkers}/${stats.totalWorkers}`);
 *
 * // Cleanup
 * runtime.dispose();
 * ```
 *
 * @see {@link WorkerPool}
 * @see {@link TaskQueue}
 * @see {@link CancellationTokenSource}
 */

import {
  WorkerPoolError,
  type ExtendedTask,
  type PoolStats,
  type Task,
  type TaskFailureInfo,
  type TaskFallbackExecutor,
  type TaskHandler,
  type TaskExecutionContext,
  type WorkerPool,
  type WorkerPoolConfig,
  type WorkerPoolEvent,
  type WorkerPoolEventListener,
} from "./types";
import { CancellationTokenSource } from "./cancellation";
import { TaskQueue } from "./task-queue";
import type { QueueItem as QueueItemBase } from "./task-queue";

const DEFAULT_MIN_WORKERS = 1;
const DEFAULT_MAX_WORKERS = 16;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 25;
const DEFAULT_WORKER_RECOVERY_DELAY = 50;

/**
 * Internal runtime configuration
 *
 * Normalized and validated configuration values used by the runtime.
 * All configuration options are resolved with defaults at construction time.
 *
 * @internal
 */
interface WorkerPoolRuntimeConfig {
  /** Total number of worker threads */
  workerCount: number;

  /** Minimum worker count threshold */
  minWorkerCount: number;

  /** Maximum worker count threshold */
  maxWorkerCount: number;

  /** Maximum queue size before overflow rejection */
  maxQueueSize: number;

  /** Default task execution timeout in milliseconds */
  defaultTaskTimeout: number;

  /** Default maximum retry attempts */
  maxRetries: number;

  /** Default delay between retry attempts in milliseconds */
  retryDelay: number;

  /** Delay before attempting crashed worker recovery in milliseconds */
  workerRecoveryDelay: number;

  /** Debug mode flag for verbose logging */
  debug: boolean;
}

/**
 * Runtime queue item representation
 *
 * Extends base queue item with runtime-specific state including
 * promise callbacks, cancellation tokens, timeout handles, and tracking flags.
 *
 * @internal
 */
interface RuntimeQueueItem extends QueueItemBase {
  /** The task to execute */
  task: ExtendedTask;

  /** Promise resolve callback */
  resolve: (value: unknown) => void;

  /** Promise reject callback */
  reject: (reason?: unknown) => void;

  /** Cancellation token source for this task execution */
  tokenSource: CancellationTokenSource;

  /** Timeout handler reference (null if not active) */
  timeoutId: ReturnType<typeof setTimeout> | null;

  /** Retry delay timer reference (null if not active) */
  retryTimer: ReturnType<typeof setTimeout> | null;

  /** Flag indicating if fallback execution was already attempted */
  fallbackTried: boolean;
}

/**
 * WorkerPoolRuntime - Core task execution engine
 *
 * Implements the WorkerPool interface with comprehensive task scheduling,
 * error handling, and worker lifecycle management.
 *
 * @internal
 */
export class WorkerPoolRuntime implements WorkerPool {
  /** Normalized configuration with all defaults resolved */
  private readonly config: WorkerPoolRuntimeConfig;

  /** Priority-based task queue */
  private readonly taskQueue = new TaskQueue();

  /** Task type to handler function mapping */
  private readonly handlers = new Map<string, TaskHandler>();

  /** Event listeners for pool lifecycle events */
  private readonly listeners = new Set<WorkerPoolEventListener>();

  /** List of all worker identifiers */
  private readonly workerIds: string[];

  /** Available workers ready to accept tasks (FIFO queue) */
  private readonly availableWorkers: string[] = [];

  /** In-flight tasks currently being executed */
  private readonly inflight = new Set<RuntimeQueueItem>();

  /** Workers that have crashed and are scheduled for recovery */
  private readonly crashedWorkers = new Set<string>();

  /** Active recovery timers for crashed workers */
  private readonly recoveryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Fallback executor for failed tasks */
  private readonly fallbackExecutor: TaskFallbackExecutor;

  /** Task ID sequence counter */
  private sequence = 0;

  /** Current pool statistics snapshot */
  private stats: PoolStats;

  /** Number of currently active workers */
  private activeWorkers = 0;

  /** Total completed tasks counter */
  private completedTasks = 0;

  /** Total failed tasks counter */
  private failedTasks = 0;

  /** Flag indicating if pool has been disposed */
  private disposed = false;

  /**
   * Construct a WorkerPoolRuntime instance
   *
   * Initializes worker pool with configuration, creates worker identifiers,
   * registers handlers, and sets up fallback executor.
   *
   * The constructor performs:
   * - Configuration normalization with defaults
   * - Worker count calculation based on hardware concurrency
   * - Worker identifier creation
   * - Handler registration from config
   * - Fallback executor setup
   * - Initial statistics snapshot
   *
   * @param config - Configuration options with defaults:
   * - workerCount: Desired number (auto-detected if omitted)
   * - minWorkerCount: Minimum threshold (default: 1)
   * - maxWorkerCount: Maximum threshold (default: 16)
   * - maxQueueSize: Overflow limit (default: Infinity)
   * - defaultTaskTimeout: Global timeout ms (default: 30000)
   * - maxRetries: Global retry count (default: 3)
   * - retryDelay: Retry delay ms (default: 25)
   * - workerRecoveryDelay: Recovery delay ms (default: 50)
   * - handlers: Initial handler mapping
   * - fallbackExecutor: Custom fallback strategy
   * - debug: Enable debug mode
   *
   * @example
   * ```typescript
   * const runtime = new WorkerPoolRuntime({
   *   workerCount: 4,
   *   defaultTaskTimeout: 30000,
   *   maxRetries: 3,
   *   handlers: {
   *     'compute': computeHandler,
   *     'transform': transformHandler
   *   }
   * });
   * ```
   */
  constructor(config: WorkerPoolConfig = {}) {
    const minWorkerCount = config.minWorkerCount ?? DEFAULT_MIN_WORKERS;
    const maxWorkerCount = config.maxWorkerCount ?? DEFAULT_MAX_WORKERS;
    const detectedWorkers =
      typeof navigator !== "undefined" && typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : 4;
    const desiredWorkers = config.workerCount ?? detectedWorkers;
    const workerCount = Math.min(Math.max(desiredWorkers, minWorkerCount), maxWorkerCount);

    this.config = {
      workerCount,
      minWorkerCount,
      maxWorkerCount,
      maxQueueSize: config.maxQueueSize ?? Number.POSITIVE_INFINITY,
      defaultTaskTimeout: config.defaultTaskTimeout ?? DEFAULT_TIMEOUT,
      maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
      retryDelay: config.retryDelay ?? DEFAULT_RETRY_DELAY,
      workerRecoveryDelay: config.workerRecoveryDelay ?? DEFAULT_WORKER_RECOVERY_DELAY,
      debug: config.debug ?? false,
    };

    if (config.handlers) {
      for (const [type, handler] of Object.entries(config.handlers)) {
        this.registerHandler(type, handler);
      }
    }

    this.workerIds = Array.from(
      { length: this.config.workerCount },
      (_, index) => `worker-${index + 1}`
    );
    this.availableWorkers.push(...this.workerIds);

    this.stats = {
      totalWorkers: this.config.workerCount,
      activeWorkers: 0,
      queueSize: 0,
      completedTasks: 0,
      failedTasks: 0,
    };

    this.fallbackExecutor = config.fallbackExecutor ?? this.createFallbackExecutor();
  }

  /**
   * Execute a single task
   *
   * Adds task to queue and returns promise that resolves/rejects when complete.
   * Performs queue overflow check, creates runtime task wrapper, and schedules execution.
   *
   * Process:
   * 1. Validate pool is not disposed
   * 2. Check queue size against maxQueueSize
   * 3. Create runtime task wrapper with unique ID
   * 4. Enqueue with task priority
   * 5. Emit TASK_QUEUED event
   * 6. Trigger scheduling
   *
   * @template T - The task result type
   * @param task - Task definition with type, payload, options
   * @returns Promise resolving to task result or rejecting with error
   *
   * @throws {WorkerPoolError} If queue is full (QUEUE_OVERFLOW code)
   * @throws {WorkerPoolError} If pool is disposed (POOL_DISPOSED code)
   * @throws {WorkerPoolError} If no handler registered for task type
   * @throws {WorkerPoolError} If all retries exhausted and fallback fails
   * @throws {Error} If task execution fails and fallback unavailable
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = await runtime.execute({
   *   type: 'compute',
   *   payload: { data: [...] }
   * });
   *
   * // With timeout override
   * const result = await runtime.execute({
   *   type: 'compute',
   *   payload: { data: [...] },
   *   timeout: 60000
   * });
   *
   * // With retry options
   * const result = await runtime.execute({
   *   type: 'compute',
   *   payload: { data: [...] },
   *   options: {
   *     priority: 10,
   *     maxRetries: 5,
   *     retryDelay: 1000,
   *     retryable: true
   *   }
   * });
   *
   * // Error handling
   * try {
   *   await runtime.execute(task);
   * } catch (error) {
   *   if (error instanceof WorkerPoolError) {
   *     console.error(`Code: ${error.code}`);
   *   }
   * }
   * ```
   *
   * @see {@link executeBatch}
   * @see {@link TaskExecutionOptions}
   */
  execute<T>(task: Task<T>): Promise<T> {
    this.ensureNotDisposed();

    return new Promise<T>((resolve, reject) => {
      const projectedSize = this.taskQueue.size + this.inflight.size + 1;
      if (projectedSize > this.config.maxQueueSize) {
        reject(new WorkerPoolError("Worker pool queue is full", "QUEUE_OVERFLOW", task));
        return;
      }

      const runtimeTask = this.createRuntimeTask(task, resolve, reject);
      this.taskQueue.enqueue(runtimeTask);
      this.emit({ type: "TASK_QUEUED", taskId: runtimeTask.id });
      this.updateStats();
      this.schedule();
    });
  }

  /**
   * Execute multiple tasks in parallel
   *
   * Convenience method that executes all tasks via execute() and
   * returns array of results in same order as input.
   *
   * Performance: O(n) where n = number of tasks
   *
   * @template T - The result type for all tasks
   * @param tasks - Array of task definitions
   * @returns Promise resolving to array of results (same order as input)
   *
   * @throws {WorkerPoolError} If any task fails permanently
   * @throws {Error} Propagates errors from individual task executions
   *
   * If any task fails, entire batch promise rejects.
   * Already-executing tasks continue and may complete or fail independently.
   *
   * @example
   * ```typescript
   * const tasks = [
   *   { type: 'compute', payload: { id: 1, data: [...] } },
   *   { type: 'compute', payload: { id: 2, data: [...] } },
   *   { type: 'compute', payload: { id: 3, data: [...] } },
   * ];
   *
   * try {
   *   const results = await runtime.executeBatch(tasks);
   *   console.log('All completed:', results);
   * } catch (error) {
   *   console.error('Batch failed:', error);
   * }
   * ```
   *
   * @see {@link execute}
   */
  executeBatch<T>(tasks: Task<T>[]): Promise<T[]> {
    return Promise.all(tasks.map((task) => this.execute(task)));
  }

  /**
   * Get current pool statistics snapshot
   *
   * Returns a copy of the current pool statistics. Statistics are updated
   * continuously during task execution and event emission.
   *
   * @returns PoolStats object with current state:
   * - totalWorkers: Fixed pool size
   * - activeWorkers: Currently executing
   * - queueSize: Waiting in queue
   * - completedTasks: Success count
   * - failedTasks: Failure count
   *
   * @example
   * ```typescript
   * const stats = runtime.getStats();
   * console.log(`Utilization: ${stats.activeWorkers}/${stats.totalWorkers}`);
   * console.log(`Queued: ${stats.queueSize}`);
   * console.log(`Completed: ${stats.completedTasks}`);
   * console.log(`Failed: ${stats.failedTasks}`);
   * ```
   */
  getStats(): PoolStats {
    return { ...this.stats };
  }

  /**
   * Register a task handler function
   *
   * Associates a handler function with a task type. Handlers are invoked
   * when tasks of that type are executed. Only one handler per type.
   *
   * The handler receives the task payload and execution context:
   * - context.attempt: Current attempt number (1-indexed)
   * - context.maxRetries: Maximum retries allowed
   * - context.taskId: Unique task identifier
   * - context.fallback: True if fallback execution
   * - context.cancellationToken: For cancellation checks
   * - context.stats: Current pool statistics snapshot
   *
   * @template TPayload - The task payload type (default: unknown)
   * @template TResult - The handler result type (default: unknown)
   * @param type - Task type identifier (e.g., 'compute', 'transform')
   * @param handler - Function that executes the task
   *
   * @example
   * ```typescript
   * runtime.registerHandler('compute', async (payload, context) => {
   *   // Check cancellation before long operation
   *   if (context.cancellationToken.isCancellationRequested) {
   *     throw new Error('Task cancelled');
   *   }
   *
   *   const result = await performComputation(payload.data);
   *
   *   // Check again after operation
   *   context.cancellationToken.throwIfCancellationRequested();
   *
   *   return result;
   * });
   *
   * runtime.registerHandler('transform', (payload, context) => {
   *   return {
   *     ...payload,
   *     transformed: true,
   *     attempt: context.attempt
   *   };
   * });
   * ```
   *
   * @see {@link unregisterHandler}
   * @see {@link TaskHandler}
   * @see {@link TaskExecutionContext}
   */
  registerHandler<TPayload = unknown, TResult = unknown>(
    type: string,
    handler: TaskHandler<TPayload, TResult>
  ): void {
    this.handlers.set(type, handler as TaskHandler);
  }

  /**
   * Unregister a task handler function
   *
   * Removes the handler associated with the given task type.
   * Subsequent task executions of this type will fail with HANDLER_NOT_FOUND.
   *
   * @param type - Task type identifier to unregister
   *
   * @example
   * ```typescript
   * runtime.unregisterHandler('compute');
   * ```
   *
   * @see {@link registerHandler}
   */
  unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * Add event listener for pool lifecycle events
   *
   * Listener is called for all pool events: task lifecycle, worker state,
   * statistics updates. Listener should not throw - exceptions are caught
   * and logged to avoid disrupting pool operations.
   *
   * Events emitted:
   * - TASK_QUEUED: Task added to queue
   * - TASK_STARTED: Task began execution
   * - TASK_COMPLETED: Task succeeded
   * - TASK_FAILED: Task failed permanently
   * - TASK_FALLBACK: Fallback execution triggered
   * - TASK_TIMEOUT: Task exceeded timeout
   * - WORKER_UNAVAILABLE: Worker crashed
   * - WORKER_RECOVERY_SCHEDULED: Recovery scheduled
   * - WORKER_RECOVERED: Worker restored
   * - POOL_STATS_UPDATED: Statistics changed
   *
   * @param listener - Event handler function
   *
   * @example
   * ```typescript
   * runtime.addEventListener((event) => {
   *   switch (event.type) {
   *     case 'TASK_COMPLETED':
   *       console.log(`Task ${event.taskId} completed:`, event.result);
   *       break;
   *     case 'TASK_FAILED':
   *       console.error(`Task ${event.taskId} failed:`, event.error);
   *       break;
   *     case 'WORKER_UNAVAILABLE':
   *       console.warn(`Worker ${event.workerId} crashed`);
   *       break;
   *     case 'POOL_STATS_UPDATED':
   *       console.log(`Stats:`, event.stats);
   *       break;
   *   }
   * });
   * ```
   *
   * @see {@link removeEventListener}
   * @see {@link WorkerPoolEvent}
   */
  addEventListener(listener: WorkerPoolEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener for pool lifecycle events
   *
   * @param listener - Previously registered listener to remove
   *
   * @example
   * ```typescript
   * runtime.removeEventListener(myListener);
   * ```
   *
   * @see {@link addEventListener}
   */
  removeEventListener(listener: WorkerPoolEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Dispose and clean up pool resources
   *
   * Stops accepting new tasks, cancels all queued/in-flight tasks,
   * clears timers, and releases worker references. After disposal,
   * all pool operations throw POOL_DISPOSED error.
   *
   * Cleanup sequence:
   * 1. Mark pool as disposed
   * 2. Reject all queued tasks
   * 3. Cancel all in-flight tasks
   * 4. Clear all timeouts and timers
   * 5. Release worker references
   * 6. Clear handlers and listeners
   *
   * This is idempotent - safe to call multiple times.
   *
   * @example
   * ```typescript
   * // Use in cleanup phase
   * runtime.dispose();
   *
   * // All subsequent operations throw
   * try {
   *   await runtime.execute(task);
   * } catch (error) {
   *   console.log(error.code); // 'POOL_DISPOSED'
   * }
   * ```
   *
   * Call this when shutting down application to ensure clean resource cleanup.
   * In Node.js, consider using process exit handlers.
   * In browsers, consider using beforeunload events.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    let queueItem: RuntimeQueueItem | undefined;
    while ((queueItem = this.taskQueue.dequeue() as RuntimeQueueItem | undefined)) {
      queueItem.reject(
        new WorkerPoolError("Worker pool disposed", "POOL_DISPOSED", queueItem.task)
      );
    }

    for (const item of this.inflight) {
      item.tokenSource.cancel();
      item.reject(new WorkerPoolError("Worker pool disposed", "POOL_DISPOSED", item.task));
      if (item.timeoutId) {
        clearTimeout(item.timeoutId);
      }
      if (item.retryTimer) {
        clearTimeout(item.retryTimer);
      }
    }

    this.inflight.clear();
    for (const timer of this.recoveryTimers.values()) {
      clearTimeout(timer);
    }
    this.recoveryTimers.clear();
    this.crashedWorkers.clear();
    this.availableWorkers.length = 0;
    this.handlers.clear();
    this.listeners.clear();
  }

  /**
   * Create a runtime task wrapper from a task definition
   *
   * Wraps the public task with runtime-specific state including unique ID,
   * promise callbacks, cancellation token, and tracking flags.
   *
   * @internal
   * @template T - Result type
   * @param task - The task to wrap
   * @param resolve - Promise resolve callback
   * @param reject - Promise reject callback
   * @returns RuntimeQueueItem ready for queueing
   */
  private createRuntimeTask<T>(
    task: Task<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: unknown) => void
  ): RuntimeQueueItem {
    const extendedTask: ExtendedTask<T> = task;
    const priority = extendedTask.options?.priority ?? 0;

    const runtimeTask: RuntimeQueueItem = {
      id: this.generateTaskId(),
      task: extendedTask,
      resolve: (value: unknown) => {
        resolve(value as T);
      },
      reject,
      attempt: 0,
      enqueuedAt: Date.now(),
      priority,
      tokenSource: new CancellationTokenSource(),
      timeoutId: null,
      retryTimer: null,
      fallbackTried: false,
    };

    return runtimeTask;
  }

  /**
   * Schedule next available tasks to available workers
   *
   * Core scheduling algorithm: attempts to fill all available worker slots
   * with queued tasks up to configured worker count. Runs continuously as
   * workers become available.
   *
   * Scheduling logic:
   * - Check if pool disposed, exit if true
   * - While activeWorkers < configured workerCount:
   * - Dequeue highest priority task from queue
   * - If no task, exit scheduling loop
   * - Try to acquire an available worker ID
   * - If no workers available, re-enqueue and exit
   * - Process task with worker
   *
   * Performance: O(k) where k = queued tasks scheduled
   *
   * @internal
   */
  private schedule(): void {
    if (this.disposed) {
      return;
    }

    while (this.activeWorkers < this.config.workerCount) {
      const queueItem = this.taskQueue.dequeue() as RuntimeQueueItem | undefined;
      if (!queueItem) {
        break;
      }

      const workerId = this.acquireWorkerId();
      if (!workerId) {
        this.taskQueue.enqueue(queueItem);
        break;
      }

      this.processQueueItem(queueItem, workerId);
    }
  }

  /**
   * Process a queued task with an assigned worker
   *
   * Orchestrates complete task execution lifecycle:
   * 1. Update worker state (active count, stats)
   * 2. Add to in-flight tracking
   * 3. Invoke handler with timeout and error handling
   * 4. Handle success/failure outcomes
   * 5. Clean up and reschedule if needed
   *
   * Error paths trigger retry logic, fallback execution, or final rejection.
   * Finally clause ensures worker release and state cleanup.
   *
   * @internal
   * @param queueItem - Runtime task from queue
   * @param workerId - Allocated worker identifier
   */
  private processQueueItem(queueItem: RuntimeQueueItem, workerId: string): void {
    if (this.disposed) {
      queueItem.reject(
        new WorkerPoolError("Worker pool disposed", "POOL_DISPOSED", queueItem.task)
      );
      return;
    }

    this.activeWorkers += 1;
    this.emit({ type: "TASK_STARTED", taskId: queueItem.id, workerId });
    this.updateStats();

    this.inflight.add(queueItem);

    this.invokeTask(queueItem)
      .then((result) => {
        this.onTaskSuccess(queueItem, result);
      })
      .catch((error) => {
        void this.onTaskFailure(
          queueItem,
          error instanceof Error ? error : new Error(String(error)),
          workerId
        );
      })
      .finally(() => {
        this.inflight.delete(queueItem);
        if (!this.crashedWorkers.has(workerId)) {
          this.releaseWorkerId(workerId);
        }
        this.activeWorkers = Math.max(0, this.activeWorkers - 1);
        this.updateStats();
        this.schedule();
      });
  }

  /**
   * Invoke task handler with timeout enforcement
   *
   * Execution pipeline:
   * 1. Lookup handler for task type
   * 2. Create fresh cancellation token
   * 3. Build execution context
   * 4. Resolve timeout (task override or config default)
   * 5. Call handler (may return Promise or value)
   * 6. Race execution against timeout
   * 7. Clean up timeout timer
   * 8. Resolve/reject with result or timeout error
   *
   * Timeout behavior:
   * - If no timeout or timeout <= 0, execute without limit
   * - Else wrap execution in timeout promise race
   * - Cancel token on timeout before rejection
   *
   * Error handling:
   * - Non-Error exceptions converted to Error instances
   * - Timeout errors use TASK_TIMEOUT code
   * - HANDLER_NOT_FOUND if type unregistered
   *
   * @internal
   * @param queueItem - Runtime task with handler and timeout
   * @returns Promise resolving to handler result
   * @throws {WorkerPoolError} If handler not found or task times out
   * @throws {Error} If handler throws
   */
  private async invokeTask(queueItem: RuntimeQueueItem): Promise<unknown> {
    const handler = this.handlers.get(queueItem.task.type);
    if (!handler) {
      throw new WorkerPoolError(
        `No handler registered for task type ${queueItem.task.type}`,
        "HANDLER_NOT_FOUND",
        queueItem.task
      );
    }

    if (queueItem.timeoutId) {
      clearTimeout(queueItem.timeoutId);
      queueItem.timeoutId = null;
    }

    queueItem.tokenSource = new CancellationTokenSource();

    const timeout = this.resolveTimeout(queueItem.task);
    const context = this.createExecutionContext(queueItem, false);
    const execution = Promise.resolve(handler(queueItem.task.payload, context));

    if (!Number.isFinite(timeout) || timeout <= 0) {
      return execution;
    }

    return new Promise<unknown>((resolve, reject) => {
      queueItem.timeoutId = setTimeout(() => {
        queueItem.tokenSource.cancel();
        reject(
          new WorkerPoolError(`Task timed out after ${timeout}ms`, "TASK_TIMEOUT", queueItem.task)
        );
      }, timeout);

      execution
        .then((value) => {
          if (queueItem.timeoutId) {
            clearTimeout(queueItem.timeoutId);
            queueItem.timeoutId = null;
          }
          resolve(value);
        })
        .catch((error) => {
          if (queueItem.timeoutId) {
            clearTimeout(queueItem.timeoutId);
            queueItem.timeoutId = null;
          }
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    });
  }

  /**
   * Handle successful task completion
   *
   * Updates statistics, resolves promise, emits completion event.
   * Called when handler returns successfully without timeout.
   *
   * @internal
   * @param queueItem - Completed task
   * @param result - Handler return value
   */
  private onTaskSuccess(queueItem: RuntimeQueueItem, result: unknown): void {
    this.completedTasks += 1;
    this.stats.completedTasks = this.completedTasks;
    queueItem.resolve(result);
    this.emit({ type: "TASK_COMPLETED", taskId: queueItem.id, result });
    this.updateStats();
  }

  /**
   * Handle task failure with retry and fallback logic
   *
   * Failure resolution process:
   * 1. Increment attempt counter
   * 2. Detect worker crash vs. transient error
   * 3. If worker crashed, initiate recovery
   * 4. If retryable and retries remain, schedule retry with delay
   * 5. If retries exhausted, attempt fallback execution
   * 6. If fallback fails or not available, reject task
   * 7. Emit appropriate events (FALLBACK, FAILED)
   *
   * Retry behavior:
   * - Checks task.options.retryable (default: true)
   * - Checks attempt counter against maxRetries
   * - Uses workerRecoveryDelay if worker crashed
   * - Otherwise uses retryDelay (task or config default)
   *
   * @internal
   * @param queueItem - Failed task with attempt tracking
   * @param error - Original execution error
   * @param workerId - Worker that failed
   */
  private async onTaskFailure(
    queueItem: RuntimeQueueItem,
    error: Error,
    workerId: string
  ): Promise<void> {
    queueItem.attempt += 1;

    const workerCrashed = this.isWorkerCrash(error);
    if (workerCrashed) {
      this.handleWorkerCrash(workerId, error);
    }

    if (this.shouldRetry(queueItem)) {
      const delay = workerCrashed
        ? this.config.workerRecoveryDelay
        : this.resolveRetryDelay(queueItem.task);
      queueItem.retryTimer = setTimeout(() => {
        if (this.disposed) {
          queueItem.reject(
            new WorkerPoolError("Worker pool disposed", "POOL_DISPOSED", queueItem.task)
          );
          return;
        }

        queueItem.tokenSource = new CancellationTokenSource();
        this.taskQueue.enqueue(queueItem);
        this.emit({ type: "TASK_QUEUED", taskId: queueItem.id });
        this.updateStats();
        this.schedule();
      }, delay);
      return;
    }

    this.recordFailure();

    if (!queueItem.fallbackTried) {
      queueItem.fallbackTried = true;
      try {
        const result = await this.runFallback(queueItem, error);
        this.emit({
          type: "TASK_FALLBACK",
          taskId: queueItem.id,
          attempts: queueItem.attempt,
          error,
        });
        this.onTaskSuccess(queueItem, result);
        return;
      } catch (fallbackError) {
        error = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError));
      }
    }

    const workerError =
      error instanceof WorkerPoolError
        ? error
        : new WorkerPoolError(error.message ?? "Task failed", "TASK_FAILED", queueItem.task);

    queueItem.reject(workerError);
    this.emit({ type: "TASK_FAILED", taskId: queueItem.id, error: workerError });
    this.updateStats();
  }

  /**
   * Determine if task should be retried
   *
   * Retry logic checks:
   * - Task retryable flag (default: true)
   * - Attempt counter vs maxRetries limit
   *
   * @internal
   * @param queueItem - Task with retry configuration
   * @returns True if retry should be attempted
   */
  private shouldRetry(queueItem: RuntimeQueueItem): boolean {
    const retryable = queueItem.task.options?.retryable ?? true;
    if (!retryable) {
      return false;
    }

    const maxRetries = queueItem.task.options?.maxRetries ?? this.config.maxRetries;
    return queueItem.attempt < maxRetries;
  }

  /**
   * Resolve retry delay for a task
   *
   * Uses task-specific delay if configured, otherwise uses global default.
   *
   * @internal
   * @param task - Task with optional retryDelay
   * @returns Delay in milliseconds
   */
  private resolveRetryDelay(task: ExtendedTask): number {
    return task.options?.retryDelay ?? this.config.retryDelay;
  }

  /**
   * Resolve timeout for a task
   *
   * Uses task-specific timeout if set, otherwise uses global default.
   *
   * @internal
   * @param task - Task with optional timeout
   * @returns Timeout in milliseconds
   */
  private resolveTimeout(task: Task): number {
    return typeof task.timeout === "number" ? task.timeout : this.config.defaultTaskTimeout;
  }

  /**
   * Create task execution context
   *
   * Builds the context object passed to handlers containing retry info,
   * task ID, fallback flag, cancellation token, and statistics.
   *
   * @internal
   * @param queueItem - Runtime task with attempt tracking
   * @param fallback - True if this is fallback execution
   * @returns TaskExecutionContext for handler
   */
  private createExecutionContext(
    queueItem: RuntimeQueueItem,
    fallback: boolean
  ): TaskExecutionContext {
    const maxRetries = queueItem.task.options?.maxRetries ?? this.config.maxRetries;

    return {
      attempt: queueItem.attempt + 1,
      maxRetries,
      taskId: queueItem.id,
      fallback,
      cancellationToken: queueItem.tokenSource.token,
      stats: this.getStatsSnapshot(),
    };
  }

  /**
   * Get current pool statistics snapshot
   *
   * Captures current state: total/active workers, queue size, success/failure counters.
   *
   * @internal
   * @returns Immutable statistics object
   */
  private getStatsSnapshot(): PoolStats {
    return {
      totalWorkers: this.config.workerCount,
      activeWorkers: this.activeWorkers,
      queueSize: this.taskQueue.size,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
    };
  }

  /**
   * Update pool statistics and emit update event
   *
   * Called whenever state changes to keep stats synchronized.
   *
   * @internal
   */
  private updateStats(): void {
    this.stats = this.getStatsSnapshot();
    this.emit({ type: "POOL_STATS_UPDATED", stats: this.stats });
  }

  /**
   * Handle worker crash and schedule recovery
   *
   * Worker crash protocol:
   * 1. Mark worker as crashed (idempotent)
   * 2. Remove from available workers
   * 3. Emit crash and recovery scheduled events
   * 4. Schedule recovery timer
   * 5. After delay: remove crashed flag, re-add to available, emit recovered
   *
   * @internal
   * @param workerId - Failed worker identifier
   * @param error - Crash error information
   */
  private handleWorkerCrash(workerId: string, error: Error): void {
    if (this.disposed) {
      return;
    }
    if (this.crashedWorkers.has(workerId)) {
      return;
    }

    this.crashedWorkers.add(workerId);
    this.removeWorkerId(workerId);

    const delay = this.config.workerRecoveryDelay;
    this.emit({ type: "WORKER_UNAVAILABLE", workerId, error });
    this.emit({ type: "WORKER_RECOVERY_SCHEDULED", workerId, delay });

    const timer = setTimeout(() => {
      this.recoveryTimers.delete(workerId);
      if (this.disposed) {
        return;
      }
      this.crashedWorkers.delete(workerId);
      this.releaseWorkerId(workerId);
      this.emit({ type: "WORKER_RECOVERED", workerId });
      this.schedule();
    }, delay);

    this.recoveryTimers.set(workerId, timer);
  }

  /**
   * Remove worker from available pool
   *
   * @internal
   * @param workerId - Worker to remove
   */
  private removeWorkerId(workerId: string): void {
    const index = this.availableWorkers.indexOf(workerId);
    if (index !== -1) {
      this.availableWorkers.splice(index, 1);
    }
  }

  /**
   * Type guard to detect worker crash error
   *
   * @internal
   * @param error - Error to check
   * @returns True if error is WorkerPoolError with WORKER_CRASH code
   */
  private isWorkerCrash(error: Error): error is WorkerPoolError {
    return error instanceof WorkerPoolError && error.code === WORKER_POOL_WORKER_CRASH_CODE;
  }

  /**
   * Increment failure counter and update stats
   *
   * @internal
   */
  private recordFailure(): void {
    this.failedTasks += 1;
    this.stats.failedTasks = this.failedTasks;
  }

  /**
   * Acquire an available worker
   *
   * Removes and returns first available worker from pool (FIFO).
   *
   * @internal
   * @returns Worker ID or undefined if none available
   */
  private acquireWorkerId(): string | undefined {
    return this.availableWorkers.shift();
  }

  /**
   * Release worker back to available pool
   *
   * Idempotent - safely handles already-released workers.
   *
   * @internal
   * @param workerId - Worker to return to available pool
   */
  private releaseWorkerId(workerId: string): void {
    if (this.availableWorkers.includes(workerId)) {
      return;
    }
    this.availableWorkers.push(workerId);
  }

  /**
   * Generate unique task identifier
   *
   * Uses sequential counter for simple, predictable IDs.
   *
   * @internal
   * @returns Task ID like "task-1", "task-2", etc.
   */
  private generateTaskId(): string {
    this.sequence += 1;
    return `task-${this.sequence}`;
  }

  /**
   * Emit event to all registered listeners
   *
   * Listener exceptions are caught and ignored to prevent disrupting pool.
   * Listener exceptions are caught and ignored to prevent disrupting pool scheduling
   *
   * @internal
   * @param event - Event to emit
   */
  private emit(event: WorkerPoolEvent): void {
    if (this.listeners.size === 0) {
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener exceptions to prevent disrupting pool scheduling
      }
    }
  }

  /**
   * Execute task via fallback executor
   *
   * Called when primary execution fails and retries exhausted.
   * Builds failure info from original error and attempt count.
   *
   * @internal
   * @param queueItem - Failed task with context
   * @param error - Original execution error
   * @returns Promise with fallback result
   */
  private async runFallback(queueItem: RuntimeQueueItem, error: Error): Promise<unknown> {
    const failureInfo: TaskFailureInfo = {
      error,
      attempts: queueItem.attempt,
      timeout: error instanceof WorkerPoolError && error.code === "TASK_TIMEOUT",
    };

    const result = this.fallbackExecutor(queueItem.task, failureInfo);
    return result;
  }

  /**
   * Create default fallback executor
   *
   * Default behavior: re-runs handler in main thread (fallback context).
   * Uses same handler but marks execution as fallback.
   *
   * @internal
   * @returns Fallback executor function
   */
  private createFallbackExecutor(): TaskFallbackExecutor {
    return <T>(task: Task<T>, failure: TaskFailureInfo): Promise<T> | T => {
      const handler = this.handlers.get(task.type) as TaskHandler<T, T> | undefined;
      if (!handler) {
        throw failure.error;
      }

      const tokenSource = new CancellationTokenSource();
      const context: TaskExecutionContext = {
        attempt: failure.attempts + 1,
        maxRetries: failure.attempts + 1,
        taskId: `fallback-${task.type}-${Date.now()}`,
        fallback: true,
        cancellationToken: tokenSource.token,
        stats: this.getStatsSnapshot(),
      };

      return handler(task.payload, context);
    };
  }

  /**
   * Ensure pool is not disposed before operation
   *
   * @internal
   * @throws {WorkerPoolError} If pool disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new WorkerPoolError("Worker pool has been disposed", "POOL_DISPOSED");
    }
  }
}

/**
 * Error code: Task execution exceeded timeout limit
 * Used with WorkerPoolError to indicate timeout condition
 * @constant
 */
export const WORKER_POOL_TIMEOUT_CODE = "TASK_TIMEOUT" as const;

/**
 * Error code: Queue size exceeded maxQueueSize limit
 * Used when trying to execute task with full queue
 * @constant
 */
export const WORKER_POOL_QUEUE_OVERFLOW_CODE = "QUEUE_OVERFLOW" as const;

/**
 * Error code: Worker pool has been disposed
 * All operations fail with this code after disposal
 * @constant
 */
export const WORKER_POOL_DISPOSED_CODE = "POOL_DISPOSED" as const;

/**
 * Error code: Worker crash detected
 * Indicates worker failure requiring recovery
 * @constant
 */
export const WORKER_POOL_WORKER_CRASH_CODE = "WORKER_CRASH" as const;
