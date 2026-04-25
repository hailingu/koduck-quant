/**
 * @file Task Context Management
 * @module worker-pool/task-context
 *
 * Manages execution context and state for tasks submitted to Worker Pool.
 * Tracks task lifecycle, retry attempts, and execution metadata.
 */

/**
 * Task context containing execution state and metadata
 */
export interface TaskContext<T = unknown, R = unknown> {
  /** Unique task identifier */
  readonly taskId: string;
  /** Task type for handler routing */
  readonly taskType: string;
  /** Task payload */
  readonly data: T;
  /** Task priority (0-10, higher = more urgent) */
  readonly priority: number;
  /** Creation timestamp (ms) */
  readonly createdAt: number;
  /** Promise resolve function */
  resolve: ((value: R) => void) | null;
  /** Promise reject function */
  reject: ((reason?: Error) => void) | null;
  /** Current retry attempt count */
  retryCount: number;
  /** Total timeout duration in milliseconds */
  timeout: number;
  /** Maximum retry attempts allowed */
  maxRetries: number;
  /** Retry strategy (fixed, exponential, linear) */
  retryStrategy: "fixed" | "exponential" | "linear";
  /** Base delay between retries (ms) */
  retryDelay: number;
  /** Maximum retry delay cap (ms) */
  maxRetryDelay: number | undefined;
  /** Timestamp when task can be retried (ms) */
  nextRetryTime: number | null;
  /** Execution start time (ms) */
  executionStartTime: number | null;
  /** Worker ID executing this task */
  workerId: string | null;
  /** Task status */
  status: "pending" | "executing" | "completed" | "failed" | "cancelled" | "retrying";
  /** Error if task failed */
  error: Error | null;
  /** Task result */
  result: R | null;
  /** Timeout timer ID for cancellation */
  timeoutTimer: NodeJS.Timeout | null;
}

/**
 * Task creation options
 */
export interface TaskContextOptions {
  /** Task priority (0-10, higher = more urgent) */
  priority?: number;
  /** Task timeout in milliseconds */
  timeout?: number;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay strategy */
  retryStrategy?: "fixed" | "exponential" | "linear";
  /** Base retry delay in ms */
  retryDelay?: number;
  /** Maximum retry delay cap in ms */
  maxRetryDelay?: number;
}

/**
 * Create a new task context
 *
 * @template T - Task payload type
 * @template R - Task result type
 * @param taskId - Unique task identifier
 * @param taskType - Task type for routing
 * @param data - Task payload
 * @param options - Task configuration options
 * @returns New task context
 */
export function createTaskContext<T = unknown, R = unknown>(
  taskId: string,
  taskType: string,
  data: T,
  options: TaskContextOptions = {}
): TaskContext<T, R> {
  const {
    priority = 5,
    timeout = 30000,
    maxRetries = 3,
    retryStrategy = "fixed",
    retryDelay = 1000,
    maxRetryDelay = undefined,
  } = options;

  return {
    taskId,
    taskType,
    data,
    priority: Math.max(0, Math.min(10, priority)),
    createdAt: Date.now(),
    resolve: null,
    reject: null,
    retryCount: 0,
    timeout,
    maxRetries,
    retryStrategy,
    retryDelay,
    maxRetryDelay,
    nextRetryTime: null,
    executionStartTime: null,
    workerId: null,
    status: "pending",
    error: null,
    result: null,
    timeoutTimer: null,
  };
}

/**
 * Mark task as executing
 *
 * @param context - Task context
 * @param workerId - Worker ID executing the task
 */
export function markTaskExecuting(context: TaskContext, workerId: string): void {
  context.status = "executing";
  context.executionStartTime = Date.now();
  context.workerId = workerId;
}

/**
 * Mark task as completed successfully
 *
 * @template R - Result type
 * @param context - Task context
 * @param result - Task result
 */
export function markTaskCompleted<R = unknown>(context: TaskContext<unknown, R>, result: R): void {
  context.status = "completed";
  context.result = result;
  if (context.resolve) {
    context.resolve(result);
    context.resolve = null;
  }
}

/**
 * Mark task as failed
 *
 * @param context - Task context
 * @param error - Error that occurred
 */
export function markTaskFailed(context: TaskContext, error: unknown): void {
  const taskError = error instanceof Error ? error : new Error(String(error));
  context.status = "failed";
  context.error = taskError;
  if (context.reject) {
    context.reject(taskError);
    context.reject = null;
  }
}

/**
 * Mark task as cancelled
 *
 * @param context - Task context
 */
export function markTaskCancelled(context: TaskContext): void {
  context.status = "cancelled";
  context.error = new Error("Task cancelled");
  if (context.reject) {
    context.reject(context.error);
    context.reject = null;
  }
}

/**
 * Get task execution duration in milliseconds
 *
 * @param context - Task context
 * @returns Duration in milliseconds, or 0 if not yet executing
 */
export function getTaskDuration(context: TaskContext): number {
  if (!context.executionStartTime) {
    return 0;
  }
  return Date.now() - context.executionStartTime;
}

/**
 * Check if task has exceeded timeout
 *
 * @param context - Task context
 * @returns True if task has exceeded timeout
 */
export function hasTaskTimedOut(context: TaskContext): boolean {
  if (!context.executionStartTime) {
    return false;
  }
  return getTaskDuration(context) > context.timeout;
}

/**
 * Reset task for retry
 *
 * @param context - Task context
 */
export function resetTaskForRetry(context: TaskContext): void {
  context.retryCount += 1;
  context.executionStartTime = null;
  context.workerId = null;
  context.status = "pending";
  context.error = null;
  context.result = null;
}

/**
 * Get total time from task creation to now
 *
 * @param context - Task context
 * @returns Time in milliseconds
 */
export function getTaskTotalTime(context: TaskContext): number {
  return Date.now() - context.createdAt;
}

/**
 * Get time task spent waiting (not executing)
 *
 * @param context - Task context
 * @returns Time in milliseconds
 */
export function getTaskWaitTime(context: TaskContext): number {
  if (!context.executionStartTime) {
    return getTaskTotalTime(context);
  }
  return context.executionStartTime - context.createdAt;
}

/**
 * Check if task can be retried
 *
 * @param context - Task context
 * @returns True if task has retries remaining
 */
export function canRetryTask(context: TaskContext): boolean {
  return context.retryCount < context.maxRetries;
}

/**
 * Calculate retry delay for next attempt
 *
 * Applies the configured retry strategy:
 * - 'fixed': Constant delay
 * - 'exponential': delay * (2 ^ retryCount)
 * - 'linear': delay * (retryCount + 1)
 *
 * @param context - Task context
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(context: TaskContext): number {
  const { retryStrategy, retryDelay, retryCount, maxRetryDelay } = context;

  let delay: number;

  switch (retryStrategy) {
    case "exponential":
      delay = retryDelay * Math.pow(2, retryCount);
      break;
    case "linear":
      delay = retryDelay * (retryCount + 1);
      break;
    case "fixed":
    default:
      delay = retryDelay;
      break;
  }

  // Apply cap if configured
  if (maxRetryDelay !== undefined && delay > maxRetryDelay) {
    delay = maxRetryDelay;
  }

  return delay;
}

/**
 * Schedule task for retry
 *
 * Sets the retry timestamp and marks status as retrying
 *
 * @param context - Task context
 */
export function scheduleTaskRetry(context: TaskContext): void {
  const delay = calculateRetryDelay(context);
  context.nextRetryTime = Date.now() + delay;
  context.status = "retrying";
  context.executionStartTime = null;
  context.workerId = null;
}

/**
 * Check if task is ready to retry
 *
 * @param context - Task context
 * @returns True if retry delay has elapsed
 */
export function isTaskReadyToRetry(context: TaskContext): boolean {
  if (context.status !== "retrying" || context.nextRetryTime === null) {
    return false;
  }
  return Date.now() >= context.nextRetryTime;
}

/**
 * Clear timeout timer if set
 *
 * @param context - Task context
 */
export function clearTaskTimeout(context: TaskContext): void {
  if (context.timeoutTimer !== null) {
    clearTimeout(context.timeoutTimer);
    context.timeoutTimer = null;
  }
}

/**
 * Mark task as timed out
 *
 * @param context - Task context
 */
export function markTaskTimedOut(context: TaskContext): void {
  const timeoutError = new Error(`Task ${context.taskId} timed out after ${context.timeout}ms`);
  timeoutError.name = "TaskTimeoutError";
  context.status = "failed";
  context.error = timeoutError;
  clearTaskTimeout(context);
}
