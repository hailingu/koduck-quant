/**
 * Worker Pool Module - Concurrent Task Execution Engine
 *
 * Comprehensive worker thread pool implementation with fault tolerance,
 * retry logic, timeout handling, and full observability support.
 *
 * ## Module Overview
 *
 * The worker pool module provides:
 *
 * **Core Components**:
 * - `WorkerPoolRuntime`: Main task execution engine implementing WorkerPool interface
 * - `TaskQueue`: Priority-based task queue with O(1) insertion/extraction
 * - `CancellationTokenSource`: Cancellation protocol for task cancellation
 * - Type definitions for all interfaces and configurations
 *
 * **Observability**:
 * - `WorkerPoolMetricsAdapter`: Converts events to metrics and structured logs
 * - OpenTelemetry integration for production monitoring
 * - Comprehensive event system for lifecycle tracking
 *
 * ## Architecture
 *
 * Task execution flow:
 * 1. Task submission via `execute()` or `executeBatch()`
 * 2. Queue management with priority support
 * 3. Worker allocation from available pool
 * 4. Handler invocation with timeout and cancellation
 * 5. Success completion or error handling
 * 6. Retry logic with configurable delays
 * 7. Fallback execution on final failure
 * 8. Event emission and metrics collection
 *
 * ## Retry Strategy
 *
 * - Retries determined by `retryable` flag (default: true)
 * - Configurable per-task or global `maxRetries` (default: 3)
 * - Exponential backoff via `retryDelay` (default: 25ms)
 * - Separate recovery delay for worker crashes (default: 50ms)
 *
 * ## Worker Recovery
 *
 * - Workers marked as crashed are temporarily unavailable
 * - Recovery delay before attempting to use worker again
 * - Event notifications for crash and recovery
 * - Automatic rescheduling after recovery
 *
 * ## Error Handling
 *
 * Comprehensive error taxonomy:
 * - QUEUE_OVERFLOW: Max queue size exceeded
 * - HANDLER_NOT_FOUND: No handler for task type
 * - TASK_TIMEOUT: Task exceeded time limit
 * - TASK_FAILED: Execution error after retries
 * - POOL_DISPOSED: Operations on disposed pool
 * - WORKER_CRASH: Worker failure detected
 *
 * ## Performance
 *
 * - Queue: O(1) enqueue/dequeue with priority bucketing
 * - Scheduling: O(n) where n = available worker slots
 * - Timeout: O(1) per task with efficient timer management
 * - Cancellation: O(k) where k = registered callbacks
 *
 * ## Configuration
 *
 * ```typescript
 * const pool = new WorkerPoolRuntime({
 *   workerCount: 4,              // Number of worker threads
 *   minWorkerCount: 1,           // Minimum threshold
 *   maxWorkerCount: 16,          // Maximum threshold
 *   maxQueueSize: Infinity,      // Queue overflow limit
 *   defaultTaskTimeout: 30000,   // Default timeout (ms)
 *   maxRetries: 3,               // Default retry count
 *   retryDelay: 25,              // Retry delay (ms)
 *   workerRecoveryDelay: 50,     // Recovery delay (ms)
 *   handlers: {                  // Task handlers
 *     'compute': computeHandler,
 *     'transform': transformHandler
 *   },
 *   fallbackExecutor: fallback,  // Custom fallback
 *   debug: false                 // Debug mode
 * });
 * ```
 *
 * ## Event System
 *
 * Subscribe to lifecycle events:
 * ```typescript
 * pool.addEventListener((event) => {
 *   switch (event.type) {
 *     case 'TASK_COMPLETED':
 *       console.log('Success:', event.result);
 *       break;
 *     case 'TASK_FAILED':
 *       console.error('Failed:', event.error);
 *       break;
 *     case 'WORKER_UNAVAILABLE':
 *       console.warn('Crash:', event.workerId);
 *       break;
 *   }
 * });
 * ```
 *
 * ## Observability
 *
 * Create metrics adapter for monitoring:
 * ```typescript
 * const metrics = new WorkerPoolMetricsAdapter(pool, {
 *   poolId: 'primary',
 *   scope: 'application-metrics',
 *   loggerTag: 'pool:primary'
 * });
 * ```
 *
 * Metrics collected:
 * - pool.active_workers: Gauge of current active workers
 * - pool.queue.size: Gauge of queued task count
 * - pool.tasks.completed_total: Gauge of cumulative successes
 * - pool.tasks.failed_total: Gauge of cumulative failures
 * - pool.task.completed.count: Counter of completion events
 * - pool.task.failed.count: Counter of failure events
 * - pool.task.fallback.count: Counter of fallback executions
 * - pool.worker.crash.count: Counter of worker crashes
 * - pool.worker.recovered.count: Counter of recoveries
 *
 * ## Cleanup
 *
 * Always dispose on shutdown:
 * ```typescript
 * pool.dispose();
 * metrics.dispose();
 * ```
 *
 * @module WorkerPool
 * @exports WorkerPoolRuntime
 * @exports WorkerPoolMetricsAdapter
 * @exports TaskQueue
 * @exports CancellationTokenSource
 * @exports WORKER_POOL_TIMEOUT_CODE
 * @exports WORKER_POOL_QUEUE_OVERFLOW_CODE
 * @exports WORKER_POOL_DISPOSED_CODE
 * @exports WORKER_POOL_WORKER_CRASH_CODE
 *
 * @example
 * ```typescript
 * import {
 *   WorkerPoolRuntime,
 *   WorkerPoolMetricsAdapter,
 *   type WorkerPool,
 *   type Task,
 * } from '@/common/worker-pool';
 *
 * // Create and configure pool
 * const pool = new WorkerPoolRuntime({
 *   workerCount: 4,
 *   defaultTaskTimeout: 30000,
 *   handlers: {
 *     'compute': async (payload, context) => {
 *       // Check cancellation
 *       if (context.cancellationToken.isCancellationRequested) {
 *         throw new Error('Cancelled');
 *       }
 *
 *       const result = await computeTask(payload);
 *
 *       // Verify still not cancelled
 *       context.cancellationToken.throwIfCancellationRequested();
 *
 *       return result;
 *     }
 *   }
 * });
 *
 * // Setup monitoring
 * const metrics = new WorkerPoolMetricsAdapter(pool, {
 *   poolId: 'main'
 * });
 *
 * // Listen for events
 * pool.addEventListener((event) => {
 *   if (event.type === 'TASK_FAILED') {
 *     console.error('Task failed:', event.error.code);
 *   }
 * });
 *
 * // Execute tasks
 * try {
 *   const result = await pool.execute({
 *     type: 'compute',
 *     payload: { data: [...] },
 *     timeout: 60000
 *   });
 * } catch (error) {
 *   console.error('Execution failed:', error);
 * }
 *
 * // Batch execution
 * const results = await pool.executeBatch([
 *   { type: 'compute', payload: { ... } },
 *   { type: 'compute', payload: { ... } }
 * ]);
 *
 * // Check pool health
 * const stats = pool.getStats();
 * console.log(`Active: ${stats.activeWorkers}/${stats.totalWorkers}`);
 * console.log(`Queued: ${stats.queueSize}`);
 * console.log(`Completed: ${stats.completedTasks}`);
 * console.log(`Failed: ${stats.failedTasks}`);
 *
 * // Cleanup on shutdown
 * pool.dispose();
 * metrics.dispose();
 * ```
 *
 * @see {@link WorkerPoolRuntime}
 * @see {@link WorkerPoolMetricsAdapter}
 * @see {@link TaskQueue}
 * @see {@link CancellationTokenSource}
 */

export * from "./types";
export {
  WorkerPoolRuntime,
  WORKER_POOL_TIMEOUT_CODE,
  WORKER_POOL_QUEUE_OVERFLOW_CODE,
  WORKER_POOL_DISPOSED_CODE,
  WORKER_POOL_WORKER_CRASH_CODE,
} from "./runtime";
export { WorkerPoolMetricsAdapter } from "./metrics";
export type { WorkerPoolMetricsOptions } from "./metrics";
export { PriorityQueue } from "./priority-queue";
export type { Comparator } from "./priority-queue";
export { TaskScheduler } from "./task-scheduler";
export type { SchedulerStats, SchedulerConfig } from "./task-scheduler";
export { HealthMonitor } from "./health-monitor";
export type { HealthMonitorConfig, WorkerHealthMetrics, HealthCheckResult } from "./health-monitor";
export type { TaskContext, TaskContextOptions } from "./task-context";
export {
  createTaskContext,
  markTaskExecuting,
  markTaskCompleted,
  markTaskFailed,
  markTaskCancelled,
  getTaskDuration,
  hasTaskTimedOut,
  resetTaskForRetry,
  getTaskTotalTime,
  getTaskWaitTime,
  canRetryTask,
  calculateRetryDelay,
  scheduleTaskRetry,
  isTaskReadyToRetry,
  clearTaskTimeout,
  markTaskTimedOut,
} from "./task-context";
export { WarmupStrategy } from "./warmup-strategy";
export type {
  WarmupTask,
  WorkerWarmupState,
  WarmupStatistics,
  WarmupConfig,
} from "./warmup-strategy";
export { ResourceMonitor } from "./resource-monitor";
export type {
  WorkerResourceUsage,
  ResourceSnapshot,
  ResourceTrend,
  ResourceMonitorConfig,
} from "./resource-monitor";
export {
  WORKER_POOL_EVENTS,
  isWorkerPoolEvent,
  type WorkerPoolTaskSubmittedEvent,
  type WorkerPoolTaskCompletedEvent,
  type WorkerPoolTaskFailedEvent,
  type WorkerPoolWorkerCreatedEvent,
  type WorkerPoolWorkerTerminatedEvent,
  type WorkerPoolScalingUpEvent,
  type WorkerPoolScalingDownEvent,
  type WorkerPoolHealthWarningEvent,
  type WorkerPoolEvent,
} from "./events";
