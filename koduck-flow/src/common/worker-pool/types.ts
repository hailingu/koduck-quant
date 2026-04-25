/**
 * Worker Pool Type Definitions & Interfaces
 *
 * Defines the core type system for a thread-based task execution pool.
 * Enables CPU-intensive parallel task processing with support for:
 * - Task-based execution model (type-dispatched handlers)
 * - Configurable concurrency (worker count, queue limits)
 * - Fault tolerance (retry logic, worker recovery, fallback execution)
 * - Observable behavior (event streams, metrics collection)
 * - Cooperative cancellation (CancellationToken protocol)
 *
 * Core Abstractions:
 * 1. Task - Unit of work: type, payload, timeout
 * 2. TaskExecutionContext - Runtime execution environment with retry info
 * 3. PoolStats - Real-time pool state: workers, queue, completion counts
 * 4. WorkerPool - Main interface: execute, batch, stats, events
 * 5. WorkerPoolError - Typed error reporting with error codes
 *
 * Event Model:
 * - Rich event stream for monitoring pool behavior
 * - Events for: task queuing, execution, completion, failures, recovery
 * - Enables external metrics collection and diagnostics
 *
 * Performance Model:
 * - Priority-based task queue: O(1) enqueue/dequeue per priority
 * - Bounded pool size: Prevents resource exhaustion
 * - Configurable timeouts: Prevents indefinite task hangs
 * - Worker recovery: Automatic crash detection and restoration
 *
 * @module WorkerPoolTypes
 * @see {@link WorkerPoolRuntime} for default implementation
 * @see {@link TaskQueue} for priority queue implementation
 * @see {@link CancellationTokenSource} for cancellation protocol
 *
 * @example
 * ```typescript
 * import {
 *   Task,
 *   TaskExecutionContext,
 *   WorkerPool,
 *   WorkerPoolConfig,
 * } from './types';
 *
 * // Define task type
 * interface ComputeTask extends Task<{ value: number }> {
 *   type: 'compute';
 * }
 *
 * // Define handler
 * const computeHandler = (payload: { value: number }, context: TaskExecutionContext) => {
 *   console.log(`Processing attempt ${context.attempt}/${context.maxRetries}`);
 *   return payload.value * 2;
 * };
 *
 * // Configure and use
 * const config: WorkerPoolConfig = {
 *   workerCount: 4,
 *   defaultTaskTimeout: 30_000,
 *   handlers: { compute: computeHandler },
 * };
 * ```
 */

/**
 * Retry strategy for failed tasks
 *
 * Determines how delays between retry attempts are calculated:
 * - 'fixed': Constant delay between retries (uses retryDelay)
 * - 'exponential': Exponentially increasing delay (delay * 2^attempt)
 * - 'linear': Linearly increasing delay (delay * attempt)
 *
 * @example
 * ```typescript
 * // Fixed 1000ms delay between retries
 * { retryStrategy: 'fixed', retryDelay: 1000 }
 *
 * // Exponential backoff: 100ms, 200ms, 400ms, 800ms...
 * { retryStrategy: 'exponential', retryDelay: 100 }
 *
 * // Linear backoff: 500ms, 1000ms, 1500ms, 2000ms...
 * { retryStrategy: 'linear', retryDelay: 500 }
 * ```
 */
export type RetryStrategy = "fixed" | "exponential" | "linear";

/**
 * Retry configuration options
 *
 * Controls how failed tasks are retried:
 * - maxRetries: Maximum retry attempts (0 = no retries)
 * - retryDelay: Base delay in milliseconds
 * - retryStrategy: How delay scales with attempts
 * - maxRetryDelay: Cap for exponential/linear backoff (optional)
 * - retryableErrors: Error codes that should trigger retry (optional)
 *
 * @example
 * ```typescript
 * const retryConfig: RetryConfig = {
 *   maxRetries: 3,
 *   retryDelay: 1000,
 *   retryStrategy: 'exponential',
 *   maxRetryDelay: 10000,
 *   retryableErrors: ['NETWORK_ERROR', 'TIMEOUT']
 * };
 * ```
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries (ms) */
  retryDelay: number;
  /** Retry delay calculation strategy */
  retryStrategy: RetryStrategy;
  /** Maximum retry delay cap (ms) for exponential/linear strategies */
  maxRetryDelay?: number;
  /** Error codes that should trigger retry (if undefined, all errors retry) */
  retryableErrors?: string[];
}

/**
 * Retry statistics tracking
 *
 * Tracks retry behavior metrics for monitoring and tuning:
 * - Total retry attempts made
 * - Tasks that succeeded after retry
 * - Tasks that failed after all retries
 * - Average retry count per task
 */
export interface RetryMetrics {
  /** Total number of retry attempts across all tasks */
  totalRetries: number;
  /** Tasks that succeeded after at least one retry */
  retriedTasksSucceeded: number;
  /** Tasks that failed after exhausting all retries */
  retriedTasksFailed: number;
  /** Average retry count for tasks that needed retries */
  avgRetriesPerTask: number;
  /** Current tasks in retry queue waiting for delay */
  pendingRetries: number;
}

/**
 * Task - Base unit of work for execution
 *
 * Represents a single computational task to be executed by a pool handler.
 * Tasks are dispatched to handlers based on type, enabling type-safe task routing.
 *
 * @template T - Task payload type, defaults to unknown
 *
 * - Tasks are immutable once enqueued
 * - Type field determines which handler executes the task
 * - Timeout applies per execution attempt (retries get fresh timeouts)
 * - Missing timeout uses pool's defaultTaskTimeout
 *
 * @example
 * ```typescript
 * const task: Task<{ data: string }> = {
 *   type: 'process-string',
 *   payload: { data: 'hello' },
 *   timeout: 5000, // 5 seconds max
 * };
 * ```
 *
 * @see {@link TaskExecutionContext} for execution environment
 * @see {@link TaskExecutionOptions} for extended options
 */
export interface Task<T = unknown> {
  /**
   * Task type identifier
   *
   * Used for routing to appropriate handler. Must match a registered handler key.
   * Enables polymorphic task processing within single pool.
   * If no handler registered for type, task fails with HANDLER_NOT_FOUND error.
   *
   * @example
   * ```typescript
   * // Type used to route to handler
   * { type: 'image-process', payload: imageData }
   * // Dispatches to handler registered for 'image-process'
   * ```
   */
  type: string;

  /**
   * Task payload - The actual data for computation
   *
   * Serializable data structure passed to handler. Type parameter allows
   * compile-time type safety in handler implementations.
   * Payload should be serializable (JSON-compatible) for potential future
   * worker thread support. Avoid circular references and functions.
   */
  payload: T;

  /**
   * Execution timeout in milliseconds
   *
   * Maximum time allowed for single execution attempt. If handler does not
   * complete within timeout, execution is canceled and task retried (if configured).
   * - Undefined uses pool's defaultTaskTimeout (typically 30 seconds)
   * - Timeout resets on each retry (not cumulative)
   * - Zero or negative values disable timeout
   *
   * @example
   * ```typescript
   * // Task with 10 second timeout
   * { type: 'quick', payload: data, timeout: 10000 }
   * ```
   */
  timeout?: number;
}

/**
 * Task Execution Context
 *
 * Runtime environment and metadata for task handler execution. Provides access to:
 * - Retry information (current attempt, max retries)
 * - Task identification for logging and correlation
 * - Cancellation control for graceful shutdown
 * - Pool statistics for adaptive behavior
 *
 * Passed as second parameter to task handlers, enabling handlers to:
 * 1. Observe execution attempt number
 * 2. Check retry count before expensive operations
 * 3. Respond to cancellation requests
 * 4. Adapt behavior based on pool load
 * 5. Distinguish between initial execution and fallback execution
 *
 * @see {@link CancellationToken} for cancellation protocol
 * @see {@link PoolStats} for statistics structure
 *
 * @example
 * ```typescript
 * const handler: TaskHandler<string, number> = (payload, context) => {
 *   // Guard against repeated retries
 *   if (context.attempt > 1) {
 *     console.log(`Retry attempt ${context.attempt}/${context.maxRetries}`);
 *   }
 *
 *   // Check if cancellation requested
 *   context.cancellationToken.throwIfCancellationRequested();
 *
 *   // Adapt to pool load
 *   if (context.stats.activeWorkers === context.stats.totalWorkers) {
 *     // Pool at capacity, use aggressive cache strategy
 *   }
 *
 *   // Distinguish fallback execution
 *   if (context.fallback) {
 *     console.log('Executing fallback on main thread');
 *   }
 *
 *   return computeResult(payload);
 * };
 * ```
 */
export interface TaskExecutionContext {
  /**
   * Current attempt number (1-indexed)
   *
   * First attempt: attempt = 1
   * First retry after timeout: attempt = 2
   * Increments for each retry
   *
   * @readonly
   */
  readonly attempt: number;

  /**
   * Maximum allowed retry attempts (not including initial attempt)
   *
   * If maxRetries = 2, the task can be attempted up to 3 times total.
   * - Attempt 1: Initial execution
   * - Attempt 2: First retry
   * - Attempt 3: Second retry (then exhausted)
   *
   * Configured via task.options.maxRetries or pool.defaultTaskTimeout
   *
   * @readonly
   */
  readonly maxRetries: number;

  /**
   * Unique task identifier
   *
   * Assigned when task enqueued. Enables correlation in logs and metrics.
   * Format: "task-{sequence}" where sequence increments per pool instance.
   *
   * @readonly
   * @example "task-42"
   */
  readonly taskId: string;

  /**
   * Fallback execution flag
   *
   * True when executing on main thread after worker failures.
   * Enables handlers to detect fallback scenario and adjust strategy.
   *
   * @readonly
   */
  readonly fallback: boolean;

  /**
   * Cancellation token for cooperative shutdown
   *
   * Handlers should check this regularly for cancellation requests.
   * Can use either:
   * - throwIfCancellationRequested(): Throws error if cancelled
   * - onCancellation(callback): Register cancellation listener
   *
   * @readonly
   * @see {@link CancellationToken}
   */
  readonly cancellationToken: CancellationToken;

  /**
   * Current pool statistics snapshot
   *
   * Provides real-time pool state for adaptive handler behavior.
   * Snapshot at context creation time (may change during execution).
   *
   * @readonly
   * @see {@link PoolStats}
   */
  readonly stats: PoolStats;
}

/**
 * Task Failure Information
 *
 * Context provided to fallback executors when task fails after retries.
 * Enables fallback to understand failure scenario and adapt response.
 *
 * @see {@link TaskFallbackExecutor} for fallback function signature
 *
 * @example
 * ```typescript
 * const fallbackExecutor: TaskFallbackExecutor = (task, failure) => {
 *   console.error(
 *     `Task ${task.type} failed after ${failure.attempts} attempts, ` +
 *     (failure.timeout ? 'due to timeout' : `error: ${failure.error.message}`)
 *   );
 *
 *   // Return cached result or safe default
 *   return FALLBACK_RESULT;
 * };
 * ```
 */
export interface TaskFailureInfo {
  /**
   * Original error that occurred
   *
   * The final error before fallback activation. May be:
   * - WorkerPoolError for pool-specific errors
   * - Custom handler error
   * - Timeout error
   *
   * @readonly
   */
  readonly error: Error;

  /**
   * Number of attempts already made
   *
   * Helps fallback understand effort expended.
   * Fallback execution would be attempt (attempts + 1).
   *
   * @readonly
   */
  readonly attempts: number;

  /**
   * Whether final failure was due to timeout
   *
   * True if last attempt exceeded timeout limit.
   * False if handler threw error before timeout.
   * Helps fallback distinguish failure cause.
   *
   * @readonly
   */
  readonly timeout: boolean;
}

/**
 * Pool Statistics
 *
 * Real-time operational statistics of the worker pool.
 * Snapshot reflects state at specific point in time.
 * Used for monitoring, debugging, and adaptive task handling.
 *
 * @example
 * ```typescript
 * const stats = pool.getStats();
 * console.log(
 *   `Pool: ${stats.activeWorkers}/${stats.totalWorkers} workers active, ` +
 *   `${stats.queueSize} queued, ` +
 *   `${stats.completedTasks} completed, ` +
 *   `${stats.failedTasks} failed`
 * );
 *
 * // Adaptive behavior based on load
 * if (stats.queueSize > 100) {
 *   console.warn('Task queue backlog detected');
 * }
 * ```
 *
 * @see {@link WorkerPool.getStats} to retrieve current snapshot
 */
export interface PoolStats {
  /**
   * Total number of worker threads in pool
   *
   * Fixed after pool initialization. Configured via workerCount parameter.
   * Range: 1 to maxWorkerCount (typically 1-16).
   */
  totalWorkers: number;

  /**
   * Current number of active worker threads
   *
   * Workers currently executing tasks. Can be 0 to totalWorkers.
   * Zero means pool idle with all tasks queued waiting for availability.
   */
  activeWorkers: number;

  /**
   * Number of tasks waiting in queue
   *
   * Tasks not yet assigned to worker. Increases when activeWorkers >= totalWorkers.
   * Can grow to maxQueueSize before new tasks rejected.
   */
  queueSize: number;

  /**
   * Cumulative count of successfully completed tasks
   *
   * Monotonically increasing counter (never decreases).
   * Resets to 0 when pool disposed and recreated.
   */
  completedTasks: number;

  /**
   * Cumulative count of failed tasks
   *
   * Tasks that failed after all retries and fallback attempts.
   * Includes both worker crashes and handler errors.
   * Monotonically increasing counter (never decreases).
   */
  failedTasks: number;
}

/**
 * Worker Pool Interface
 *
 * Main public API for task execution coordination. Provides methods for:
 * - Single task execution
 * - Batch task execution
 * - Monitoring statistics
 * - Event subscription for diagnostics
 * - Handler registration (optional, implementation-dependent)
 *
 * Design Pattern: Facade over complex scheduling and state management.
 *
 * Thread Safety:
 * All methods are thread-safe and can be called concurrently from multiple
 * contexts. Internal state protected by queue and atomic counters.
 *
 * Resource Management:
 * Pool maintains pooled resources (workers, timers, event listeners).
 * Must call appropriate cleanup method when done (typically dispose()).
 *
 * @see {@link WorkerPoolRuntime} for default implementation
 *
 * @example
 * ```typescript
 * // Create and configure pool
 * const pool: WorkerPool = new WorkerPoolRuntime({
 *   workerCount: 4,
 *   defaultTaskTimeout: 30_000,
 * });
 *
 * // Register handler for task type
 * pool.registerHandler?.('compute', (payload, context) => {
 *   return computeResult(payload);
 * });
 *
 * // Execute single task
 * try {
 *   const result = await pool.execute({ type: 'compute', payload });
 * } catch (error) {
 *   console.error('Task failed:', error);
 * }
 *
 * // Monitor pool statistics
 * const stats = pool.getStats();
 * console.log(`${stats.activeWorkers}/${stats.totalWorkers} workers active`);
 * ```
 */
export interface WorkerPool {
  /**
   * Execute single task
   *
   * Enqueues task and returns promise that resolves with task result.
   * Task runs asynchronously in worker thread pool.
   *
   * @template T - Task payload type
   *
   * @param task - Task to execute with type, payload, and optional timeout
   *
   * @returns Promise resolving to task result value
   *
   * @throws {WorkerPoolError} with code QUEUE_OVERFLOW if queue at capacity
   * @throws {WorkerPoolError} with code HANDLER_NOT_FOUND if no handler for task type
   * @throws {WorkerPoolError} with code TASK_TIMEOUT if execution exceeds timeout
   * @throws {WorkerPoolError} with code POOL_DISPOSED if pool disposed
   * @throws Custom handler errors or fallback executor errors
   *
   * Retry behavior configured via:
   * - task.options.maxRetries (default: pool.config.maxRetries)
   * - task.options.retryable (default: true)
   * - task.options.retryDelay (default: pool.config.retryDelay)
   *
   * @example
   * ```typescript
   * // Basic execution
   * const result = await pool.execute({
   *   type: 'render',
   *   payload: { data },
   *   timeout: 5000,
   * });
   *
   * // With retry configuration
   * const result = await pool.execute({
   *   type: 'compute',
   *   payload: data,
   *   options: {
   *     maxRetries: 2,
   *     retryDelay: 100,
   *     priority: 10,
   *   },
   * });
   * ```
   *
   * @see {@link Task}
   * @see {@link WorkerPoolError}
   */
  execute<T>(task: Task<T>): Promise<T>;

  /**
   * Execute multiple tasks in parallel
   *
   * Enqueues all tasks and returns promise that resolves to results array.
   * Results array maintains input order (not completion order).
   * If any task fails, entire batch fails (fail-fast semantics).
   *
   * @template T - Task payload type (all tasks same payload type)
   *
   * @param tasks - Array of tasks to execute
   *
   * @returns Promise resolving to results array in input order
   *
   * @throws {WorkerPoolError} if any task fails
   * - Remaining tasks may still complete
   * - Error from first failed task propagated
   *
   * - Batch does not execute atomically - tasks start as workers available
   * - No ordering guarantees - worker assignment based on availability
   * - Efficient for bulk operations but not transactional
   *
   * @example
   * ```typescript
   * const tasks = [
   *   { type: 'process', payload: data1 },
   *   { type: 'process', payload: data2 },
   *   { type: 'process', payload: data3 },
   * ];
   *
   * try {
   *   const results = await pool.executeBatch(tasks);
   *   console.log('All tasks succeeded:', results);
   * } catch (error) {
   *   console.error('Batch failed:', error);
   * }
   * ```
   *
   * @see {@link execute} for single task execution
   */
  executeBatch<T>(tasks: Task<T>[]): Promise<T[]>;

  /**
   * Get current pool statistics
   *
   * Returns snapshot of pool state at call time. Useful for monitoring,
   * diagnostics, and adaptive scheduling decisions.
   *
   * @returns Current pool statistics including worker counts, queue size, metrics
   *
   * - Statistics are point-in-time snapshot (not real-time guarantees)
   * - No performance cost (O(1) copy of atomic counters)
   * - Safe to call frequently without overhead
   *
   * @example
   * ```typescript
   * const stats = pool.getStats();
   * if (stats.queueSize > 100) {
   *   console.warn('Task queue backlog');
   * }
   * if (stats.activeWorkers === stats.totalWorkers) {
   *   console.log('Pool at capacity');
   * }
   * ```
   *
   * @see {@link PoolStats}
   */
  getStats(): PoolStats;

  /**
   * Subscribe to pool events
   *
   * Registers listener that receives all pool events. Listeners called
   * synchronously for each event, so should execute quickly to avoid
   * blocking pool operations.
   *
   * @param listener - Callback function receiving pool events
   *
   * - Listeners added incrementally (no deduplication)
   * - Safe to add/remove listeners during event handling
   * - Exceptions in listeners are caught and suppressed
   * - Listeners should be removed when no longer needed to prevent memory leak
   *
   * @example
   * ```typescript
   * pool.addEventListener((event) => {
   *   switch (event.type) {
   *     case 'TASK_COMPLETED':
   *       console.log(`Task ${event.taskId} completed: ${event.result}`);
   *       break;
   *     case 'TASK_FAILED':
   *       console.error(`Task ${event.taskId} failed: ${event.error.message}`);
   *       break;
   *     case 'POOL_STATS_UPDATED':
   *       metrics.record(event.stats);
   *       break;
   *   }
   * });
   * ```
   *
   * @see {@link removeEventListener} to unsubscribe
   * @see {@link WorkerPoolEvent} for event types
   */
  addEventListener(listener: WorkerPoolEventListener): void;

  /**
   * Unsubscribe from pool events
   *
   * Removes previously registered event listener. Safe to call even if
   * listener not registered (no-op).
   *
   * @param listener - Previously registered listener to remove
   *
   * - Must pass same function reference registered with addEventListener
   * - Listener removed from notification list immediately
   * - Safe to call from within event handler
   *
   * @example
   * ```typescript
   * const listener = (event) => { console.log(event); };
   * pool.addEventListener(listener);
   * // Later...
   * pool.removeEventListener(listener);
   * ```
   *
   * @see {@link addEventListener} to subscribe
   */
  removeEventListener(listener: WorkerPoolEventListener): void;

  /**
   * Register task handler (Optional method)
   *
   * Registers function that handles tasks of given type. When task with matching
   * type executed, handler called with task payload and execution context.
   *
   * Optional method - implementations may or may not support dynamic handler
   * registration. Handlers can also be provided in WorkerPoolConfig during
   * construction.
   *
   * @template TPayload - Task payload type
   * @template TResult - Task result type
   *
   * @param type - Task type identifier (used in task.type)
   * @param handler - Function to execute for matching tasks
   *
   * @throws {Error} if handler already registered for type (implementation-dependent)
   *
   * - Handler replaces previous handler for same type (if implementation supports it)
   * - Handler must be synchronous or return Promise
   * - Handler exceptions cause task failure and retry
   * - Handler has access to TaskExecutionContext for retry info and cancellation
   *
   * @example
   * ```typescript
   * pool.registerHandler?.('image-resize', (payload, context) => {
   *   console.log(`Resizing image (attempt ${context.attempt})`);
   *   return resizeImage(payload.path, payload.size);
   * });
   *
   * // Later: execute task
   * const result = await pool.execute({
   *   type: 'image-resize',
   *   payload: { path: '/img.png', size: 100 },
   * });
   * ```
   *
   * @see {@link unregisterHandler} to remove handler
   * @see {@link TaskHandler} for handler function type
   */
  registerHandler?<TPayload = unknown, TResult = unknown>(
    type: string,
    handler: TaskHandler<TPayload, TResult>
  ): void;

  /**
   * Unregister task handler (Optional method)
   *
   * Removes handler for given task type. Subsequent tasks of this type
   * will fail with HANDLER_NOT_FOUND error.
   *
   * Optional method - implementations may or may not support dynamic handler
   * registration/removal.
   *
   * @param type - Task type identifier
   *
   * - Safe to unregister non-existent handlers (no-op)
   * - In-flight tasks with this type will fail
   * - New tasks queued after unregister will fail
   *
   * @example
   * ```typescript
   * pool.unregisterHandler?.('deprecated-task-type');
   * ```
   *
   * @see {@link registerHandler} to register handler
   */
  unregisterHandler?(type: string): void;
}

/**
 * WorkerPoolError
 *
 * Custom error class for worker pool exceptions. Wraps pool-specific errors
 * with error codes for programmatic error handling and recovery strategies.
 *
 * Error Codes:
 * - QUEUE_OVERFLOW: Task queue exceeded maxQueueSize
 * - HANDLER_NOT_FOUND: No handler registered for task type
 * - TASK_TIMEOUT: Task execution exceeded timeout limit
 * - TASK_CANCELLED: Task cancelled by cancellation token
 * - POOL_DISPOSED: Pool has been disposed
 * - WORKER_CRASH: Worker thread crashed or became unavailable
 *
 * @example
 * ```typescript
 * try {
 *   const result = await pool.execute(task);
 * } catch (error) {
 *   if (error instanceof WorkerPoolError) {
 *     switch (error.code) {
 *       case 'TASK_TIMEOUT':
 *         console.error('Task timeout', error.task);
 *         break;
 *       case 'QUEUE_OVERFLOW':
 *         console.error('Too many queued tasks');
 *         break;
 *       default:
 *         console.error('Pool error:', error.message);
 *     }
 *   }
 * }
 * ```
 */
export class WorkerPoolError extends Error {
  /**
   * Error code for programmatic error handling
   *
   * Enables specific error recovery logic based on failure type.
   * Examples: TASK_TIMEOUT, HANDLER_NOT_FOUND, QUEUE_OVERFLOW
   *
   * @readonly
   */
  public code: string;

  /**
   * Associated task (if applicable)
   *
   * The task that caused this error, if available. Useful for debugging
   * and logging which task failed and why.
   *
   * @readonly
   */
  public task: Task | undefined;

  /**
   * Constructor
   *
   * @param message - Error description
   * @param code - Error code for classification
   * @param task - Optional task associated with error
   */
  constructor(message: string, code: string, task?: Task) {
    super(message);
    this.name = "WorkerPoolError";
    this.code = code;
    this.task = task;
  }
}

/**
 * Task Execution Options
 *
 * Optional configuration for individual task execution. Allows per-task
 * tuning of retry behavior, prioritization, and timeouts.
 *
 * @example
 * ```typescript
 * const options: TaskExecutionOptions = {
 *   priority: 10,      // Higher priority tasks execute first
 *   retryable: true,   // Allow automatic retries
 *   maxRetries: 2,     // Maximum 2 retry attempts
 *   retryDelay: 100,   // 100ms delay between retries
 * };
 *
 * const result = await pool.execute({
 *   type: 'process',
 *   payload: data,
 *   options,
 * });
 * ```
 *
 * @see {@link ExtendedTask}
 */
export interface TaskExecutionOptions {
  /**
   * Task priority (0 = normal, higher = more urgent)
   *
   * Higher values execute sooner when multiple tasks queued.
   * Negative values supported for lower priority.
   * Default: 0 (normal priority)
   */
  priority?: number;

  /**
   * Whether task can be retried on failure
   *
   * If false, task fails immediately without retry attempts.
   * Default: true (automatic retry enabled)
   */
  retryable?: boolean;

  /**
   * Maximum retry attempts for this task
   *
   * Number of times to retry after initial failure.
   * Overrides pool's defaultMaxRetries if specified.
   * Default: pool configuration value
   *
   * If maxRetries = 2, task can execute up to 3 times total
   * (1 initial + 2 retries)
   */
  maxRetries?: number;

  /**
   * Delay between retry attempts (milliseconds)
   *
   * Time to wait before retrying after a failure.
   * Overrides pool's retryDelay if specified.
   * Default: pool configuration value (typically 25ms)
   */
  retryDelay?: number;
}

/**
 * Extended Task Interface
 *
 * Task with optional execution configuration. Extends base Task with
 * per-task execution options for granular control.
 *
 * @template T - Payload type
 *
 * @example
 * ```typescript
 * const task: ExtendedTask<ImageData> = {
 *   type: 'resize',
 *   payload: imageData,
 *   timeout: 10000,
 *   options: {
 *     priority: 5,      // High priority
 *     maxRetries: 1,    // Limited retries for I/O operations
 *   },
 * };
 * ```
 *
 * @see {@link Task}
 * @see {@link TaskExecutionOptions}
 */
export interface ExtendedTask<T = unknown> extends Task<T> {
  /**
   * Optional task execution configuration
   *
   * Overrides pool defaults for this specific task.
   * Useful for tasks with special requirements.
   */
  options?: TaskExecutionOptions;
}

/**
 * Task Handler Function Type
 *
 * User-supplied function that executes task logic. Called with task payload
 * and execution context providing retry information and cancellation support.
 *
 * Handler responsibilities:
 * 1. Accept payload and context parameters
 * 2. Perform computation or I/O operation
 * 3. Return result or Promise<result>
 * 4. Check cancellation token periodically
 * 5. Throw errors for failures (triggering retry logic)
 *
 * @template TPayload - Task payload type
 * @template TResult - Task result type
 *
 * @param payload - Task payload to process
 * @param context - Execution context with metadata and controls
 *
 * @returns Task result (synchronous) or Promise<result> (async)
 *
 * @throws Any error to trigger retry logic (if configured)
 *
 * @example
 * ```typescript
 * // Synchronous handler
 * const syncHandler: TaskHandler<string, number> = (payload, context) => {
 *   return payload.length;
 * };
 *
 * // Asynchronous handler with retry awareness
 * const asyncHandler: TaskHandler<ImageData, ProcessedImage> = async (payload, context) => {
 *   // Check cancellation
 *   context.cancellationToken.throwIfCancellationRequested();
 *
 *   // Log retry attempts
 *   if (context.attempt > 1) {
 *     console.log(`Retry attempt ${context.attempt}/${context.maxRetries}`);
 *   }
 *
 *   // Perform work
 *   const result = await processImage(payload);
 *
 *   // Check cancellation before returning
 *   context.cancellationToken.throwIfCancellationRequested();
 *   return result;
 * };
 * ```
 *
 * @see {@link TaskExecutionContext} for context parameter
 * @see {@link CancellationToken} for cancellation protocol
 */
export type TaskHandler<TPayload = unknown, TResult = unknown> = (
  payload: TPayload,
  context: TaskExecutionContext
) => Promise<TResult> | TResult;

/**
 * Task Fallback Executor Function Type
 *
 * Optional function called when task fails after all retry attempts.
 * Enables graceful degradation: main thread execution, cached results,
 * default values, or error recovery.
 *
 * Fallback is only called if:
 * 1. Task failed (handler threw or timed out)
 * 2. All retries exhausted
 * 3. Fallback not already attempted for this task
 *
 * @template T - Result type
 *
 * @param task - The failed task
 * @param failure - Information about the failure
 *
 * @returns Fallback result (synchronous) or Promise<result> (async)
 *
 * @throws If fallback itself fails, error propagated to caller
 *
 * Fallback execution occurs on main thread, so should be lightweight.
 * Avoid expensive computations or blocking operations.
 *
 * @example
 * ```typescript
 * const fallbackExecutor: TaskFallbackExecutor = (task, failure) => {
 *   console.warn(
 *     `Task ${task.type} failed after ${failure.attempts} attempts`
 *   );
 *
 *   if (failure.timeout) {
 *     return CACHED_RESULT_FOR_TIMEOUT;
 *   }
 
 *   if (task.type === 'query') {
 *     return EMPTY_RESULT;
 *   }
 *
 *   throw failure.error; // Re-throw if no recovery available
 * };
 * ```
 *
 * @see {@link TaskFailureInfo} for failure details
 */
export type TaskFallbackExecutor = <T = unknown>(
  task: Task<T>,
  failure: TaskFailureInfo
) => Promise<T> | T;

/**
 * Worker Pool Configuration
 *
 * Settings for pool initialization and behavior. Customizes:
 * - Concurrency level (worker count)
 * - Timeout and retry behavior
 * - Failure recovery strategies
 * - Event and metrics collection
 *
 * All properties optional with sensible defaults based on platform
 * capabilities (e.g., navigator.hardwareConcurrency).
 *
 * @example
 * ```typescript
 * const config: WorkerPoolConfig = {
 *   workerCount: 4,
 *   defaultTaskTimeout: 30_000,
 *   maxQueueSize: 1000,
 *   maxRetries: 3,
 *   retryDelay: 25,
 *   workerRecoveryDelay: 50,
 *   handlers: {
 *     'compute': computeHandler,
 *     'io': ioHandler,
 *   },
 * };
 *
 * const pool = new WorkerPoolRuntime(config);
 * ```
 *
 * @see {@link WorkerPoolRuntime} for default implementation
 */
export interface WorkerPoolConfig {
  /**
   * Number of worker threads
   *
   * Defaults to navigator.hardwareConcurrency (if available) or 4.
   * Must be between minWorkerCount and maxWorkerCount.
   */
  workerCount?: number;

  /**
   * Minimum worker threads (soft limit)
   *
   * Default: 1
   */
  minWorkerCount?: number;

  /**
   * Maximum worker threads (soft limit)
   *
   * Default: 16
   */
  maxWorkerCount?: number;

  /**
   * Maximum tasks in queue before rejection
   *
   * New tasks rejected (throw QUEUE_OVERFLOW) if queue exceeds this size.
   * Default: Infinity (unlimited queue)
   *
   * Set lower to implement backpressure and prevent memory exhaustion.
   */
  maxQueueSize?: number;

  /**
   * Worker initialization timeout (milliseconds)
   *
   * Not currently used in runtime. Reserved for future worker thread support.
   */
  workerInitTimeout?: number;

  /**
   * Default task execution timeout (milliseconds)
   *
   * Applied to tasks without explicit timeout.
   * Default: 30,000ms (30 seconds)
   *
   * Set to 0 or negative to disable timeouts.
   */
  defaultTaskTimeout?: number;

  /**
   * Default maximum retry attempts
   *
   * Number of retries for failed tasks (not including initial attempt).
   * Default: 3 (up to 4 total attempts = 1 initial + 3 retries)
   *
   * Per-task options.maxRetries overrides this value.
   */
  maxRetries?: number;

  /**
   * Default retry delay (milliseconds)
   *
   * Time between retry attempts (applies after non-crash failures).
   * Default: 25ms
   *
   * Per-task options.retryDelay overrides this value.
   */
  retryDelay?: number;

  /**
   * Retry strategy for failed tasks
   *
   * Determines how retry delays scale with attempt count:
   * - 'fixed': Constant delay (uses retryDelay)
   * - 'exponential': Exponentially increasing (delay * 2^attempt)
   * - 'linear': Linearly increasing (delay * attempt)
   *
   * Default: 'fixed'
   *
   * @see {@link RetryStrategy}
   */
  retryStrategy?: RetryStrategy;

  /**
   * Maximum retry delay cap (milliseconds)
   *
   * Upper bound for exponential/linear retry delays.
   * Prevents delays from growing unbounded.
   * Default: 30,000ms (30 seconds)
   *
   * Only applies to 'exponential' and 'linear' strategies.
   */
  maxRetryDelay?: number;

  /**
   * Worker recovery delay after crash (milliseconds)
   *
   * Time to wait before attempting to restore a crashed worker.
   * Default: 50ms
   *
   * Higher values avoid thrashing if worker is persistently crashing.
   */
  workerRecoveryDelay?: number;

  /**
   * Enable debug logging
   *
   * When true, logs pool events and state transitions.
   * Default: false
   */
  debug?: boolean;

  /**
   * Custom fallback executor
   *
   * If provided, called for tasks that fail after retries.
   * If not provided, uses built-in fallback (re-execution on main thread).
   */
  fallbackExecutor?: TaskFallbackExecutor;

  /**
   * Pre-registered task handlers
   *
   * Map of task type → handler function for built-in tasks.
   * Can be extended with registerHandler() after pool creation.
   *
   * @example
   * ```typescript
   * handlers: {
   *   'process': (payload, context) => processData(payload),
   *   'render': (payload, context) => renderComponent(payload),
   * }
   * ```
   */
  handlers?: Record<string, TaskHandler>;
}

/**
 * Worker Pool Event Type Union
 *
 * Discriminated union of all pool events. Enables type-safe event
 * handling with TypeScript narrowing.
 *
 * Event Categories:
 * - WORKER_*: Worker lifecycle events
 * - TASK_*: Task execution events
 * - POOL_*: Pool-wide state events
 *
 * @example
 * ```typescript
 * pool.addEventListener((event) => {
 *   if (event.type === 'TASK_COMPLETED') {
 *     console.log(`Task ${event.taskId} result:`, event.result);
 *   } else if (event.type === 'WORKER_UNAVAILABLE') {
 *     console.warn(`Worker ${event.workerId} crashed`);
 *   }
 * });
 * ```
 *
 * @see {@link WorkerPoolEventListener}
 */
export type WorkerPoolEvent =
  | { type: "WORKER_STARTED"; workerId: string }
  | { type: "WORKER_STOPPED"; workerId: string }
  | { type: "TASK_QUEUED"; taskId: string }
  | { type: "TASK_STARTED"; taskId: string; workerId: string }
  | { type: "TASK_COMPLETED"; taskId: string; result: unknown }
  | { type: "TASK_FAILED"; taskId: string; error: Error }
  | { type: "TASK_FALLBACK"; taskId: string; attempts: number; error: Error }
  | { type: "POOL_STATS_UPDATED"; stats: PoolStats }
  | { type: "WORKER_UNAVAILABLE"; workerId: string; error: Error }
  | { type: "WORKER_RECOVERY_SCHEDULED"; workerId: string; delay: number }
  | { type: "WORKER_RECOVERED"; workerId: string };

/**
 * Worker Pool Event Listener Function Type
 *
 * Callback function registered to receive pool events.
 * Called synchronously for each event in order.
 *
 * @param event - The pool event that occurred
 *
 * - Listeners should complete quickly to avoid blocking pool
 * - Exceptions in listeners are caught and suppressed
 * - Safe to modify listeners during event handling
 *
 * @example
 * ```typescript
 * const listener: WorkerPoolEventListener = (event) => {
 *   switch (event.type) {
 *     case 'POOL_STATS_UPDATED':
 *       updateMetrics(event.stats);
 *       break;
 *     case 'TASK_FAILED':
 *       logError(event);
 *       break;
 *   }
 * };
 * pool.addEventListener(listener);
 * ```
 *
 * @see {@link WorkerPool.addEventListener}
 * @see {@link WorkerPoolEvent}
 */
export type WorkerPoolEventListener = (event: WorkerPoolEvent) => void;

/**
 * Cancellation Token
 *
 * Enables cooperative cancellation of task execution. Implements standard
 * cancellation pattern for graceful shutdown and timeout handling.
 *
 * Usage Pattern:
 * 1. Handler checks isCancellationRequested periodically
 * 2. Or register callback with onCancellation()
 * 3. Or call throwIfCancellationRequested() to assert not cancelled
 *
 * @example
 * ```typescript
 * const handler: TaskHandler<DataChunk[], Result> = async (chunks, context) => {
 *   const results = [];
 *
 *   for (const chunk of chunks) {
 *     // Check for cancellation before processing chunk
 *     context.cancellationToken.throwIfCancellationRequested();
 *
 *     const result = await processChunk(chunk);
 *     results.push(result);
 *   }
 *
 *   return combineResults(results);
 * };
 * ```
 *
 * @see {@link TaskExecutionContext.cancellationToken}
 */
export interface CancellationToken {
  /**
   * Check if cancellation has been requested
   *
   * Use to conditionally abort computation:
   * ```typescript
   * if (context.cancellationToken.isCancellationRequested) {
   *   // Early exit or cleanup
   * }
   * ```
   *
   * @readonly
   */
  readonly isCancellationRequested: boolean;

  /**
   * Register cancellation callback
   *
   * Called immediately if already cancelled, otherwise called when
   * cancellation occurs. Useful for cleanup (closing connections, etc).
   *
   * @param callback - Function to call on cancellation
   *
   * - Callbacks execute in registration order
   * - Callback exceptions are silently suppressed
   * - Safe to register callbacks from within callbacks
   *
   * @example
   * ```typescript
   * context.cancellationToken.onCancellation(() => {
   *   console.log('Task cancelled, cleaning up');
   *   conn.close();
   * });
   * ```
   */
  onCancellation(callback: () => void): void;

  /**
   * Assert token not cancelled, throw if it is
   *
   * Convenience method to fail immediately if cancelled.
   * Useful at function entry points and critical sections.
   *
   * @throws {WorkerPoolError} with code TASK_CANCELLED if cancelled
   *
   * @example
   * ```typescript
   * context.cancellationToken.throwIfCancellationRequested();
   * // Continue knowing we're not cancelled
   * ```
   */
  throwIfCancellationRequested(): void;
}
