/**
 * @file WorkerPoolManager - Main Coordinator Framework
 * @module worker-pool/worker-pool-manager
 *
 * Main entry point for Worker Pool management and task coordination.
 * Provides unified API for task submission, pool configuration, and resource management.
 * Integrates task context management, worker management, and event emission.
 *
 * **Phase 1 Implementation**: Core coordinator with basic task submission API.
 * Full scheduling logic and backpressure control are implemented in Phase 2.
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { WorkerPoolConfig, PoolStats } from "./types";
import { WorkerPoolCore } from "./worker-pool-core";
import type { TaskContext } from "./task-context";
import {
  createTaskContext,
  markTaskFailed,
  markTaskCancelled,
  getTaskDuration,
} from "./task-context";
import type { EventBus } from "../event/event-bus";
import { WORKER_POOL_EVENTS } from "./events";

/**
 * Task submission object
 */
export interface TaskSubmission<T = unknown> {
  /** Task type identifier for routing */
  readonly type: string;
  /** Task payload data */
  readonly payload?: T;
  /** Task priority (0-10, higher = more urgent) */
  readonly priority?: number;
  /** Task timeout in milliseconds */
  readonly timeout?: number;
}

/**
 * Backpressure strategy types
 */
export type BackpressureStrategy = "drop" | "block" | "degrade";

/**
 * Backpressure configuration
 */
export interface BackpressureConfig {
  /** Strategy to apply when queue exceeds threshold */
  strategy: BackpressureStrategy;
  /** Queue length threshold (relative to maxQueueSize) */
  threshold: number; // 0-1, e.g., 0.8 = trigger at 80% of maxQueueSize
  /** Time to wait before checking recovery (ms) */
  recoveryCheckInterval: number;
  /** Enable automatic recovery attempts */
  autoRecover: boolean;
}

/**
 * Pool statistics including extended metrics
 */
export interface PoolStatistics extends PoolStats {
  /** Whether pool is backpressured */
  readonly backpressured: boolean;
  /** Whether pool is disposed */
  readonly disposed: boolean;
  /** Current backpressure strategy */
  readonly backpressureStrategy?: BackpressureStrategy;
  /** Queue usage percentage (0-100) */
  readonly queueUsagePercent?: number;
}

/**
 * Main coordinator for Worker Pool operations
 *
 * Manages worker lifecycle, task context, and event emission.
 * Provides submit/submitBatch/configure/getStats/drain/dispose APIs.
 *
 * @class WorkerPoolManager
 * @augments EventEmitter
 *
 * @example
 * ```typescript
 * const manager = new WorkerPoolManager({
 *   workerCount: 4,
 *   defaultTaskTimeout: 30000,
 * });
 *
 * // Initialize pool
 * await manager.initialize();
 *
 * // Submit single task
 * const result = await manager.submit({
 *   type: 'compute',
 *   payload: { value: 42 },
 *   priority: 8,
 * });
 *
 * // Submit batch of tasks
 * const results = await manager.submitBatch([
 *   { type: 'task1', payload: { data: 'a' } },
 *   { type: 'task2', payload: { data: 'b' } },
 * ]);
 *
 * // Get pool statistics
 * const stats = manager.getStats();
 *
 * // Graceful shutdown
 * await manager.dispose();
 * ```
 */
export class WorkerPoolManager extends EventEmitter {
  private readonly config: WorkerPoolConfig;
  private readonly core: WorkerPoolCore;
  private readonly taskContexts: Map<string, unknown> = new Map();
  private readonly eventBus: EventBus | undefined;
  private disposed: boolean = false;
  private backpressured: boolean = false;
  private readonly backpressureThreshold: number;
  private readonly drainTimeout: number;
  private backpressureConfig: BackpressureConfig;
  private recoveryMonitor: NodeJS.Timeout | undefined;
  private readonly droppedTasks: Map<string, number> = new Map(); // taskId -> count
  private readonly degradedTasks: Map<string, number> = new Map(); // taskId -> count

  /**
   * Create WorkerPoolManager instance
   *
   * @param config - Pool configuration
   * @param eventBus - Optional EventBus for emitting pool events to global event system
   */
  constructor(config: WorkerPoolConfig = {}, eventBus?: EventBus) {
    super();

    this.config = config;
    this.core = new WorkerPoolCore(config);
    this.eventBus = eventBus;

    // Set backpressure thresholds
    this.backpressureThreshold = config.maxQueueSize ?? 10000;
    this.drainTimeout = 30000;

    // Initialize backpressure configuration
    this.backpressureConfig = {
      strategy: "block",
      threshold: 0.8,
      recoveryCheckInterval: 500,
      autoRecover: true,
    };
  }

  /**
   * Initialize the worker pool
   *
   * Must be called before submitting tasks.
   *
   * @throws Error if pool is already disposed
   *
   * @example
   * ```typescript
   * const manager = new WorkerPoolManager({ workerCount: 4 });
   * await manager.initialize();
   * ```
   */
  async initialize(): Promise<void> {
    this.checkDisposed();
    await this.core.initialize();
    this.emit("pool:initialized", { config: this.config });
  }

  /**
   * Submit a single task to the pool
   *
   * @template T - Task payload type
   * @template R - Task result type
   * @param task - Task to submit
   * @returns Promise that resolves with task result
   * @throws Error if pool is disposed or backpressured
   *
   * @example
   * ```typescript
   * const result = await manager.submit({
   *   type: 'process',
   *   payload: { data: 'test' },
   *   priority: 8,
   * });
   * ```
   */
  async submit<T = unknown, R = unknown>(task: TaskSubmission<T>): Promise<R> {
    this.checkDisposed();

    return new Promise<R>((resolve, reject) => {
      const taskId = this.generateTaskId();

      // Create task context
      const context = createTaskContext<T, R>(taskId, task.type, task.payload ?? ({} as T), {
        priority: task.priority ?? 5,
        timeout: task.timeout ?? this.config.defaultTaskTimeout ?? 60000,
      });

      // Store callbacks in context
      context.resolve = resolve;
      context.reject = reject;

      // Apply backpressure check with strategy handling
      const backpressureResult = this.checkAndHandleBackpressure(taskId, task.type);

      if (backpressureResult.rejected) {
        const error = new Error(backpressureResult.reason);
        markTaskFailed(context as TaskContext, error);
        reject(error);
        return;
      }

      if (backpressureResult.degraded) {
        // Track degraded task execution
        const currentCount = this.degradedTasks.get(taskId) ?? 0;
        this.degradedTasks.set(taskId, currentCount + 1);
        this.emit("backpressure:degraded", {
          taskId,
          type: task.type,
          reason: backpressureResult.reason,
        });
      }

      this.taskContexts.set(taskId, context as unknown);
      this.emit("task:created", { taskId, type: task.type, priority: context.priority });

      // Emit task submitted event to EventBus
      this.emitEvent(WORKER_POOL_EVENTS.TASK_SUBMITTED, {
        type: WORKER_POOL_EVENTS.TASK_SUBMITTED,
        taskId,
        taskType: task.type,
        priority: context.priority,
        timeout: context.timeout,
        queueSize: this.taskContexts.size,
        timestamp: Date.now(),
      });

      // Schedule task (Phase 2 will implement actual scheduling)
      setImmediate(() => {
        try {
          this.handleTaskAssignment(context);
        } catch (error) {
          const taskError = error instanceof Error ? error : new Error(String(error));
          markTaskFailed(context as TaskContext, taskError);
          this.handleTaskFailure(context, taskError);
        }
      });
    });
  }

  /**
   * Submit multiple tasks as a batch
   *
   * @template T - Task payload type
   * @template R - Task result type
   * @param tasks - Array of tasks to submit
   * @returns Promise that resolves with array of results in submission order
   * @throws Error if pool is disposed or backpressured
   *
   * @example
   * ```typescript
   * const results = await manager.submitBatch([
   *   { type: 'resize', payload: { width: 100 } },
   *   { type: 'compress', payload: { quality: 0.8 } },
   * ]);
   * ```
   */
  async submitBatch<T = unknown, R = unknown>(
    tasks: ReadonlyArray<TaskSubmission<T>>
  ): Promise<R[]> {
    this.checkDisposed();

    const promises = tasks.map((task) => this.submit<T, R>(task));
    return Promise.all(promises);
  }

  /**
   * Update pool configuration dynamically
   *
   * @param config - Partial configuration to merge
   * @throws Error if pool is disposed
   *
   * @example
   * ```typescript
   * manager.configure({
   *   maxQueueSize: 5000,
   *   defaultTaskTimeout: 120000,
   * });
   * ```
   */
  configure(config: Partial<WorkerPoolConfig>): void {
    this.checkDisposed();

    // Validate min and max worker count
    const minCount = config.minWorkerCount ?? this.config.minWorkerCount ?? 1;
    const maxCount = config.maxWorkerCount ?? this.config.maxWorkerCount ?? 16;

    if (minCount > maxCount) {
      throw new Error(
        `minWorkerCount (${minCount}) cannot be greater than maxWorkerCount (${maxCount})`
      );
    }

    // Validate worker count configuration
    if (config.workerCount !== undefined) {
      if (config.workerCount < minCount || config.workerCount > maxCount) {
        throw new Error(
          `Worker count ${config.workerCount} must be between ${minCount} and ${maxCount}`
        );
      }
    }

    this.emit("pool:configured", { config });
  }

  /**
   * Get current pool statistics
   *
   * @returns Pool statistics including worker count, queue size, and performance metrics
   *
   * @example
   * ```typescript
   * const stats = manager.getStats();
   * console.log(`Active: ${stats.activeWorkers}/${stats.totalWorkers}`);
   * console.log(`Queue: ${stats.queueSize}`);
   * console.log(`Completed: ${stats.completedTasks}`);
   * ```
   */
  getStats(): PoolStatistics {
    const coreStats = this.core.getStats?.() ?? {
      total: 0,
      idle: 0,
      busy: 0,
      error: 0,
      totalMemory: 0,
    };

    const backpressureMetrics = this.getBackpressureMetrics();

    // Map CoreStats format to PoolStats format
    const poolStats: PoolStats = {
      totalWorkers: coreStats.total,
      activeWorkers: coreStats.busy,
      queueSize: this.taskContexts.size,
      completedTasks: 0,
      failedTasks: coreStats.error,
    };

    return {
      ...poolStats,
      backpressured: this.backpressured,
      disposed: this.disposed,
      backpressureStrategy: this.backpressureConfig.strategy,
      queueUsagePercent: backpressureMetrics.queueUsagePercent,
    };
  }

  /**
   * Wait for all pending tasks to complete
   *
   * @returns Promise that resolves when queue is empty and all tasks complete
   * @throws Error if drain times out or pool is disposed
   *
   * @example
   * ```typescript
   * await manager.drain();
   * console.log('All tasks completed');
   * ```
   */
  async drain(): Promise<void> {
    if (this.disposed) {
      throw new Error("Cannot drain disposed pool");
    }

    const startTime = Date.now();
    let lastTaskCount = this.taskContexts.size;

    return new Promise<void>((resolve, reject) => {
      const checkDrained = (): void => {
        const currentTaskCount = this.taskContexts.size;
        const elapsedTime = Date.now() - startTime;

        // Timeout check
        if (elapsedTime > this.drainTimeout) {
          reject(
            new Error(`Drain timeout after ${elapsedTime}ms with ${currentTaskCount} pending tasks`)
          );
          return;
        }

        // All tasks completed
        if (currentTaskCount === 0) {
          resolve();
          return;
        }

        // Progress check
        if (currentTaskCount < lastTaskCount) {
          lastTaskCount = currentTaskCount;
          setImmediate(checkDrained);
        } else {
          // No progress, wait and check again
          setTimeout(checkDrained, 100);
        }
      };

      checkDrained();
    });
  }

  /**
   * Dispose pool and clean up resources
   *
   * Terminates all workers, cancels pending tasks, and releases memory.
   * After disposal, the pool cannot be reused.
   *
   * @returns Promise that resolves when cleanup is complete
   *
   * @example
   * ```typescript
   * await manager.dispose();
   * ```
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Clean up recovery monitor
    if (this.recoveryMonitor) {
      clearInterval(this.recoveryMonitor);
      this.recoveryMonitor = undefined;
    }

    this.emit("pool:disposing");

    // Cancel all pending tasks
    for (const [taskId, contextData] of this.taskContexts.entries()) {
      const context = contextData as TaskContext;
      if (context.status === "pending" || context.status === "executing") {
        markTaskCancelled(context);
        if (context.reject) {
          context.reject(new Error("Pool disposed"));
          context.reject = null;
        }
      }
      this.taskContexts.delete(taskId);
    }

    // Clear backpressure tracking
    this.droppedTasks.clear();
    this.degradedTasks.clear();

    // Dispose core worker pool
    await this.core.dispose?.();

    this.emit("pool:disposed");
    this.removeAllListeners();
  }

  /**
   * Handle task assignment to worker
   *
   * @private
   * @param context - Task context as unknown type
   */
  private handleTaskAssignment(context: unknown): void {
    const ctx = context as TaskContext;
    // Phase 2: Implement actual scheduling logic
    // For now, emit event and set up timeout
    this.emit("task:assigned", { taskId: ctx.taskId, type: ctx.taskType });

    // Set up timeout for task
    if (ctx.timeout > 0) {
      setTimeout(() => {
        if (ctx.status === "pending" || ctx.status === "executing") {
          const timeoutError = new Error(`Task ${ctx.taskId} timed out after ${ctx.timeout}ms`);
          markTaskFailed(ctx, timeoutError);
          this.handleTaskFailure(ctx, timeoutError);
        }
      }, ctx.timeout);
    }
  }

  /**
   * Handle task failure
   *
   * @private
   * @param context - Task context as unknown type
   * @param error - Failure error
   */
  private handleTaskFailure(context: unknown, error: Error): void {
    const ctx = context as TaskContext;
    this.taskContexts.delete(ctx.taskId);
    this.emit("task:failed", {
      taskId: ctx.taskId,
      type: ctx.taskType,
      error: error.message,
      duration: getTaskDuration(ctx),
    });
  }

  /**
   * Check if pool is disposed
   *
   * @private
   * @throws Error if pool is disposed
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error("WorkerPool is disposed");
    }
  }

  /**
   * Check and handle backpressure based on configured strategy
   *
   * @private
   * @param taskId - Task identifier
   * @param taskType - Task type
   * @returns Backpressure result with rejection/degradation status
   */
  private checkAndHandleBackpressure(
    taskId: string,
    taskType: string
  ): { rejected: boolean; degraded: boolean; reason: string } {
    const queueSize = this.taskContexts.size;
    const threshold = Math.ceil(this.backpressureThreshold * this.backpressureConfig.threshold);

    // No backpressure
    if (queueSize < threshold) {
      if (this.backpressured) {
        this.backpressured = false;
        this.emit("backpressure:recovered", {
          queueSize,
          threshold,
        });
        this.startRecoveryMonitoring();
      }
      return { rejected: false, degraded: false, reason: "" };
    }

    // Backpressure threshold exceeded
    this.backpressured = true;

    switch (this.backpressureConfig.strategy) {
      case "drop": {
        // Drop new tasks
        const droppedCount = (this.droppedTasks.get(taskId) ?? 0) + 1;
        this.droppedTasks.set(taskId, droppedCount);

        this.emit("backpressure:drop", {
          taskId,
          taskType,
          queueSize,
          threshold,
          droppedCount,
        });

        return {
          rejected: true,
          degraded: false,
          reason: `Task dropped due to backpressure: queue size ${queueSize}/${this.backpressureThreshold}`,
        };
      }

      case "degrade": {
        // Degrade service (accept with warning)
        const degradedCount = (this.degradedTasks.get(taskId) ?? 0) + 1;
        this.degradedTasks.set(taskId, degradedCount);

        return {
          rejected: false,
          degraded: true,
          reason: `Task accepted in degraded mode: queue size ${queueSize}/${this.backpressureThreshold}`,
        };
      }

      case "block":
      default: {
        // Block submission (throw error)
        return {
          rejected: true,
          degraded: false,
          reason: `Backpressure threshold exceeded: ${queueSize}/${this.backpressureThreshold} tasks queued`,
        };
      }
    }
  }

  /**
   * Start monitoring for backpressure recovery
   *
   * @private
   */
  private startRecoveryMonitoring(): void {
    if (!this.backpressureConfig.autoRecover) {
      return;
    }

    if (this.recoveryMonitor) {
      clearInterval(this.recoveryMonitor);
    }

    this.recoveryMonitor = setInterval(() => {
      const queueSize = this.taskContexts.size;
      const threshold = Math.ceil(this.backpressureThreshold * this.backpressureConfig.threshold);

      // Check if we're still under pressure
      if (queueSize >= threshold && !this.backpressured) {
        this.backpressured = true;
        this.emit("backpressure:activated", {
          queueSize,
          threshold,
          strategy: this.backpressureConfig.strategy,
        });
      }

      // Check if pressure has decreased
      if (queueSize < threshold / 2 && this.backpressured) {
        this.backpressured = false;
        this.emit("backpressure:recovered", {
          queueSize,
          threshold,
        });
        if (this.recoveryMonitor) {
          clearInterval(this.recoveryMonitor);
          this.recoveryMonitor = undefined;
        }
      }
    }, this.backpressureConfig.recoveryCheckInterval);
  }

  /**
   * Configure backpressure behavior
   *
   * @param config - Backpressure configuration
   *
   * @example
   * ```typescript
   * manager.configureBackpressure({
   *   strategy: 'drop',
   *   threshold: 0.9,
   *   autoRecover: true,
   * });
   * ```
   */
  configureBackpressure(config: Partial<BackpressureConfig>): void {
    this.checkDisposed();

    const updated = { ...this.backpressureConfig, ...config };

    // Validate strategy
    if (!["drop", "block", "degrade"].includes(updated.strategy)) {
      throw new Error(
        `Invalid backpressure strategy: ${updated.strategy}. Must be 'drop', 'block', or 'degrade'`
      );
    }

    // Validate threshold
    if (updated.threshold < 0 || updated.threshold > 1) {
      throw new Error(`Backpressure threshold must be between 0 and 1, got ${updated.threshold}`);
    }

    this.backpressureConfig = updated;
    this.emit("backpressure:configured", { config: this.backpressureConfig });
  }

  /**
   * Get backpressure metrics
   *
   * @returns Object containing backpressure metrics
   */
  getBackpressureMetrics(): {
    queueSize: number;
    threshold: number;
    queueUsagePercent: number;
    backpressured: boolean;
    strategy: BackpressureStrategy;
    droppedTasksCount: number;
    degradedTasksCount: number;
  } {
    const queueSize = this.taskContexts.size;
    const threshold = Math.ceil(this.backpressureThreshold * this.backpressureConfig.threshold);
    const droppedCount = Array.from(this.droppedTasks.values()).reduce((a, b) => a + b, 0);
    const degradedCount = Array.from(this.degradedTasks.values()).reduce((a, b) => a + b, 0);

    return {
      queueSize,
      threshold,
      queueUsagePercent: Math.round((queueSize / this.backpressureThreshold) * 100),
      backpressured: this.backpressured,
      strategy: this.backpressureConfig.strategy,
      droppedTasksCount: droppedCount,
      degradedTasksCount: degradedCount,
    };
  }

  /**
   * Emit event to EventBus if available
   *
   * @private
   * @param eventType - Event type/name
   * @param eventData - Event data payload
   */
  private emitEvent(eventType: string, eventData: Record<string, unknown>): void {
    if (this.eventBus) {
      try {
        // Safely emit to EventBus without blocking pool operations
        // EventBus is optional, so we check if it exists before emitting
        const bus = this.eventBus as unknown as EventEmitter;
        bus.emit(eventType, eventData);
      } catch (error) {
        // Log but don't fail pool operations if event emission fails
        console.error(`Failed to emit worker pool event ${eventType}:`, error);
      }
    }
  }

  /**
   * Generate unique task ID
   *
   * @private
   * @returns Unique task identifier
   */
  private generateTaskId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 9);
    return `task-${timestamp}-${random}`;
  }
}
