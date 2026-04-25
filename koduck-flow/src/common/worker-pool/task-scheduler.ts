/**
 * @file Task Scheduler Implementation
 * @module worker-pool/task-scheduler
 *
 * Core task scheduling engine that manages:
 * - Task queuing (priority-based and FIFO)
 * - Worker assignment and selection
 * - Task execution lifecycle
 * - Timeout and retry handling
 *
 * The scheduler uses a priority queue for efficient task ordering and
 * implements multiple worker selection strategies for load balancing.
 */

import type { TaskContext } from "./task-context";
import { PriorityQueue } from "./priority-queue";
import type { WorkerMetadata } from "./worker-pool-core";
import type { WorkerPoolConfig } from "./types";

/**
 * Task scheduling statistics
 */
export interface SchedulerStats {
  /** Total tasks queued */
  totalQueued: number;
  /** Tasks in priority queue */
  priorityQueueSize: number;
  /** Tasks in FIFO queue */
  fifoQueueSize: number;
  /** Tasks in retry queue */
  retryQueueSize: number;
  /** Average queue wait time (ms) */
  avgWaitTime: number;
  /** Peak queue size */
  peakQueueSize: number;
  /** Total tasks timed out */
  totalTimedOut: number;
  /** Total retry attempts */
  totalRetries: number;
  /** Tasks that succeeded after retry */
  retriedTasksSucceeded: number;
  /** Tasks that failed after all retries */
  retriedTasksFailed: number;
}

/**
 * Task scheduler configuration options
 */
export interface SchedulerConfig {
  /** Scheduling strategy: 'round-robin' | 'least-tasks' | 'weighted' | 'fair' */
  strategy: "round-robin" | "least-tasks" | "weighted" | "fair";
  /** Enable priority queue (if false, FIFO only) */
  enablePriority: boolean;
  /** Maximum queue size before backpressure triggers */
  maxQueueSize: number;
}

/**
 * TaskScheduler - Manages task queuing and worker assignment
 *
 * Coordinates task distribution to workers using configurable scheduling strategies.
 * Maintains both priority and FIFO queues for flexible task ordering.
 *
 * @example
 * ```typescript
 * const scheduler = new TaskScheduler(config, poolCore);
 *
 * // Schedule a task
 * const promise = scheduler.schedule(taskContext);
 *
 * // Get queue statistics
 * const stats = scheduler.getStats();
 * console.log(`Queue size: ${stats.fifoQueueSize}`);
 *
 * // Wait for all queued tasks to complete
 * await scheduler.drain();
 * ```
 */
export class TaskScheduler {
  /** Priority queue for high-priority tasks */
  private readonly priorityQueue: PriorityQueue<TaskContext>;

  /** FIFO queue for normal-priority tasks */
  private readonly fifoQueue: TaskContext[] = [];

  /** Retry queue for failed tasks awaiting retry */
  private readonly retryQueue: TaskContext[] = [];

  /** Configuration */
  private readonly config: SchedulerConfig;

  /** Round-robin counter for sequential worker selection */
  private roundRobinIndex = 0;

  /** Statistics tracking */
  private readonly stats: SchedulerStats = {
    totalQueued: 0,
    priorityQueueSize: 0,
    fifoQueueSize: 0,
    retryQueueSize: 0,
    avgWaitTime: 0,
    peakQueueSize: 0,
    totalTimedOut: 0,
    totalRetries: 0,
    retriedTasksSucceeded: 0,
    retriedTasksFailed: 0,
  };

  /** Accumulated wait times for averaging */
  private totalWaitTime = 0;

  /** Task wait time samples count */
  private waitTimeSamples = 0;

  /** Retry check interval timer */
  private retryCheckTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new TaskScheduler
   *
   * @param config - Worker pool configuration
   * @param schedulerConfig - Optional scheduler-specific configuration
   */
  constructor(config: WorkerPoolConfig, schedulerConfig: Partial<SchedulerConfig> = {}) {
    // Initialize scheduler configuration
    this.config = {
      strategy: schedulerConfig.strategy || "round-robin",
      enablePriority: schedulerConfig.enablePriority !== false,
      maxQueueSize: schedulerConfig.maxQueueSize || config.maxQueueSize || 10000,
    };

    // Create priority queue with comparator for task priority
    // Lower priority values execute first (min-heap behavior)
    this.priorityQueue = new PriorityQueue<TaskContext>((a, b) => a.priority - b.priority);

    // Start retry check interval (every 100ms)
    this.startRetryChecker();
  }

  /**
   * Start the retry checker interval
   *
   * Periodically checks retry queue for tasks ready to retry
   */
  private startRetryChecker(): void {
    this.retryCheckTimer = setInterval(() => {
      this.processRetryQueue();
    }, 100); // Check every 100ms
  }

  /**
   * Stop the retry checker interval
   */
  private stopRetryChecker(): void {
    if (this.retryCheckTimer !== null) {
      clearInterval(this.retryCheckTimer);
      this.retryCheckTimer = null;
    }
  }

  /**
   * Process retry queue - move ready tasks back to main queue
   */
  private processRetryQueue(): void {
    const now = Date.now();
    const readyTasks: TaskContext[] = [];

    // Find tasks ready to retry
    for (let i = this.retryQueue.length - 1; i >= 0; i--) {
      const task = this.retryQueue[i];
      if (task.nextRetryTime !== null && now >= task.nextRetryTime) {
        readyTasks.push(task);
        this.retryQueue.splice(i, 1);
        this.stats.retryQueueSize--;
      }
    }

    // Re-enqueue ready tasks
    for (const task of readyTasks) {
      task.status = "pending";
      task.nextRetryTime = null;
      this.enqueue(task);
      this.stats.totalRetries++;
    }
  }

  /**
   * Schedule task for retry
   *
   * @param taskContext - Task context to retry
   */
  scheduleRetry(taskContext: TaskContext): void {
    // Check if task can be retried (before incrementing)
    if (taskContext.retryCount >= taskContext.maxRetries) {
      // Max retries exceeded - mark as failed
      this.stats.retriedTasksFailed++;
      const error = new Error(
        `Task ${taskContext.taskId} failed after ${taskContext.retryCount} retries`
      );
      taskContext.error = error;
      taskContext.status = "failed";
      taskContext.reject?.(error);
      return;
    }

    // Calculate retry delay BEFORE incrementing
    const delay = this.calculateRetryDelay(taskContext);
    taskContext.nextRetryTime = Date.now() + delay;
    taskContext.status = "retrying";

    // Now increment for next check
    taskContext.retryCount++;

    // Add to retry queue
    this.retryQueue.push(taskContext);
    this.stats.retryQueueSize++;
  }

  /**
   * Calculate retry delay based on strategy
   *
   * @param taskContext - Task context
   * @returns Delay in milliseconds
   */
  private calculateRetryDelay(taskContext: TaskContext): number {
    const { retryStrategy, retryDelay, retryCount, maxRetryDelay } = taskContext;

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
   * Start timeout timer for task
   *
   * @param taskContext - Task context
   * @param onTimeout - Callback when timeout occurs
   */
  startTaskTimeout(taskContext: TaskContext, onTimeout: (task: TaskContext) => void): void {
    // Clear any existing timer
    if (taskContext.timeoutTimer !== null) {
      clearTimeout(taskContext.timeoutTimer);
    }

    // Set new timeout
    taskContext.timeoutTimer = setTimeout(() => {
      taskContext.timeoutTimer = null;
      this.handleTaskTimeout(taskContext, onTimeout);
    }, taskContext.timeout);
  }

  /**
   * Cancel task timeout
   *
   * @param taskContext - Task context
   */
  cancelTaskTimeout(taskContext: TaskContext): void {
    if (taskContext.timeoutTimer !== null) {
      clearTimeout(taskContext.timeoutTimer);
      taskContext.timeoutTimer = null;
    }
  }

  /**
   * Handle task timeout
   *
   * @param taskContext - Task context that timed out
   * @param onTimeout - Callback to handle timeout
   */
  private handleTaskTimeout(
    taskContext: TaskContext,
    onTimeout: (task: TaskContext) => void
  ): void {
    this.stats.totalTimedOut++;

    const timeoutError = new Error(
      `Task ${taskContext.taskId} timed out after ${taskContext.timeout}ms`
    );
    timeoutError.name = "TaskTimeoutError";
    taskContext.error = timeoutError;

    // Invoke callback (typically to cancel worker execution)
    onTimeout(taskContext);

    // Attempt retry if possible
    this.scheduleRetry(taskContext);
  }

  /**
   * Mark task as succeeded after retry
   *
   * @param taskContext - Task context
   */
  markRetrySuccess(taskContext: TaskContext): void {
    if (taskContext.retryCount > 0) {
      this.stats.retriedTasksSucceeded++;
    }
  }

  /**
   * Schedule a task for execution
   *
   * Enqueues the task and attempts immediate worker assignment.
   * Returns a promise that resolves when task completes.
   *
   * @template T - Task payload type
   * @template R - Task result type
   * @param taskContext - Task context to schedule
   * @returns Promise resolving to task result
   * @throws Error if queue is full (backpressure)
   */
  schedule<T = unknown, R = unknown>(taskContext: TaskContext<T, R>): Promise<R> {
    // Check backpressure before enqueuing
    if (this.getQueueSize() >= this.config.maxQueueSize) {
      const error = new Error(
        `Task queue full (${this.getQueueSize()}/${this.config.maxQueueSize})`
      );
      taskContext.reject?.(error);
      throw error;
    }

    // Enqueue task (cast to unknown to avoid generics assignment issues)
    this.enqueue(taskContext as TaskContext<unknown, unknown>);

    // Return promise that resolves when task completes
    return new Promise<R>((resolve, reject) => {
      taskContext.resolve = resolve as (value: R) => void;
      taskContext.reject = reject;
    });
  }

  /**
   * Enqueue a task into appropriate queue
   *
   * High-priority tasks (priority < 5) go to priority queue,
   * others go to FIFO queue if priority queues are disabled.
   *
   * @param task - Task context to enqueue
   */
  private enqueue(task: TaskContext<unknown, unknown>): void {
    const queueSize = this.getQueueSize();

    // Update peak queue size statistic
    if (queueSize > this.stats.peakQueueSize) {
      this.stats.peakQueueSize = queueSize;
    }

    // Route to appropriate queue
    if (this.config.enablePriority && task.priority < 5) {
      // High-priority task (0-4) -> priority queue
      this.priorityQueue.enqueue(task);
      this.stats.priorityQueueSize++;
    } else {
      // Normal/low-priority task (5-10) -> FIFO queue
      this.fifoQueue.push(task);
      this.stats.fifoQueueSize++;
    }

    this.stats.totalQueued++;
  }

  /**
   * Dequeue the next task to execute
   *
   * Priority queue is checked first for high-priority tasks,
   * then FIFO queue for normal-priority tasks.
   *
   * @returns Next task to execute, or undefined if queues empty
   */
  dequeue(): TaskContext | undefined {
    let task: TaskContext | undefined;

    // Try priority queue first
    if (this.stats.priorityQueueSize > 0) {
      task = this.priorityQueue.dequeue();
      if (task) {
        this.stats.priorityQueueSize--;
      }
    }

    // Fall back to FIFO queue
    if (!task && this.stats.fifoQueueSize > 0) {
      task = this.fifoQueue.shift();
      if (task) {
        this.stats.fifoQueueSize--;
      }
    }

    // Track wait time for statistics
    if (task) {
      const waitTime = Date.now() - task.createdAt;
      this.totalWaitTime += waitTime;
      this.waitTimeSamples++;
      this.stats.avgWaitTime = Math.round(this.totalWaitTime / this.waitTimeSamples);
    }

    return task;
  }

  /**
   * Get current queue size
   *
   * @returns Total number of tasks in all queues (excluding retry queue)
   */
  getQueueSize(): number {
    return this.stats.priorityQueueSize + this.stats.fifoQueueSize;
  }

  /**
   * Get total queue size including retry queue
   *
   * @returns Total number of tasks in all queues
   */
  getTotalQueueSize(): number {
    return this.stats.priorityQueueSize + this.stats.fifoQueueSize + this.stats.retryQueueSize;
  }

  /**
   * Select a worker for task assignment using configured strategy
   *
   * Implements multiple scheduling strategies for load balancing:
   * - round-robin: Distribute tasks sequentially
   * - least-tasks: Assign to worker with fewest tasks
   * - weighted: Probabilistic selection based on response time
   * - fair: Balanced consideration of load and response time
   *
   * @param idleWorkers - Array of available workers
   * @returns Selected worker, or null if none available
   */
  selectWorker(idleWorkers: WorkerMetadata[]): WorkerMetadata | null {
    if (idleWorkers.length === 0) {
      return null;
    }

    if (idleWorkers.length === 1) {
      return idleWorkers[0];
    }

    switch (this.config.strategy) {
      case "round-robin":
        return this.selectRoundRobin(idleWorkers);
      case "least-tasks":
        return this.selectLeastTasks(idleWorkers);
      case "weighted":
        return this.selectWeighted(idleWorkers);
      case "fair":
        return this.selectFair(idleWorkers);
      default:
        return this.selectRoundRobin(idleWorkers);
    }
  }

  /**
   * Round-robin worker selection
   *
   * Distributes tasks sequentially across workers.
   * Ensures fair distribution over time.
   *
   * @param workers - Available workers
   * @returns Selected worker using round-robin
   */
  private selectRoundRobin(workers: WorkerMetadata[]): WorkerMetadata {
    const worker = workers[this.roundRobinIndex % workers.length];
    this.roundRobinIndex++;
    return worker;
  }

  /**
   * Least-tasks worker selection
   *
   * Selects the worker with the fewest completed tasks.
   * Good for balancing total work distribution.
   *
   * @param workers - Available workers
   * @returns Worker with minimum completed tasks
   */
  private selectLeastTasks(workers: WorkerMetadata[]): WorkerMetadata {
    return workers.reduce(
      (min, worker) => (worker.completedTasks < min.completedTasks ? worker : min),
      workers[0]
    );
  }

  /**
   * Weighted worker selection
   *
   * Probabilistically selects workers based on response time weights.
   * Faster workers have higher selection probability.
   *
   * @param workers - Available workers
   * @returns Probabilistically selected worker
   */
  private selectWeighted(workers: WorkerMetadata[]): WorkerMetadata {
    // Calculate weights based on inverse response time
    // Faster workers (lower response time) get higher weights
    const weights = workers.map((w) => {
      const responseTime = w.avgResponseTime || 1; // Avoid division by zero
      return 1 / responseTime;
    });

    // Normalize weights to 0-1 range
    const maxWeight = Math.max(...weights);
    const normalizedWeights = weights.map((w) => w / maxWeight);

    // Probabilistic selection using cumulative distribution
    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < normalizedWeights.length; i++) {
      cumulative += normalizedWeights[i];
      if (random <= cumulative) {
        return workers[i];
      }
    }

    // Fallback to last worker (should rarely happen)
    const lastIdx = workers.length - 1;
    return workers[lastIdx] || workers[0];
  }

  /**
   * Fair worker selection
   *
   * Balances both task count and response time.
   * Prevents overloading fast workers while ensuring reasonable distribution.
   *
   * @param workers - Available workers
   * @returns Fairly selected worker based on combined metrics
   */
  private selectFair(workers: WorkerMetadata[]): WorkerMetadata {
    // Calculate composite score for each worker
    // Lower score = better candidate
    const scores = workers.map((worker) => {
      // Normalized task count component (40% weight)
      const maxTasks = Math.max(...workers.map((w) => w.completedTasks));
      const taskScore = maxTasks > 0 ? worker.completedTasks / maxTasks : 0.5;

      // Normalized response time component (60% weight)
      const maxResponseTime = Math.max(...workers.map((w) => w.avgResponseTime || 1));
      const responseScore = maxResponseTime > 0 ? worker.avgResponseTime / maxResponseTime : 0.5;

      // Combined score with weights
      const score = taskScore * 0.4 + responseScore * 0.6;

      return { worker, score };
    });

    // Select worker with lowest score
    return scores.reduce(
      (best, current) => (current.score < best.score ? current : best),
      scores[0]
    ).worker;
  }

  /**
   * Change scheduling strategy at runtime
   *
   * @param strategy - New scheduling strategy
   */
  setStrategy(strategy: SchedulerConfig["strategy"]): void {
    this.config.strategy = strategy;
  }

  /**
   * Drain the scheduler - wait for all queued tasks to complete
   *
   * Useful for graceful shutdown or synchronization points.
   *
   * @returns Promise that resolves when queues are empty
   */
  async drain(): Promise<void> {
    // Wait for both queues to empty
    while (this.getQueueSize() > 0) {
      // Sleep briefly to avoid busy-waiting
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  /**
   * Clear all queued tasks
   *
   * @returns Array of cleared tasks
   */
  clear(): TaskContext[] {
    const cleared: TaskContext[] = [];

    // Clear priority queue
    while (!this.priorityQueue.isEmpty()) {
      const task = this.priorityQueue.dequeue();
      if (task) {
        cleared.push(task);
        this.stats.priorityQueueSize--;
      }
    }

    // Clear FIFO queue
    cleared.push(...this.fifoQueue);
    this.fifoQueue.length = 0;
    this.stats.fifoQueueSize = 0;

    return cleared;
  }

  /**
   * Get scheduler statistics
   *
   * @returns Current statistics snapshot
   */
  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  /**
   * Update pool configuration
   *
   * @param config - New configuration options to apply
   */
  updateConfig(config: Partial<SchedulerConfig>): void {
    if (config.strategy !== undefined) {
      this.config.strategy = config.strategy;
    }
    if (config.enablePriority !== undefined) {
      this.config.enablePriority = config.enablePriority;
    }
    if (config.maxQueueSize !== undefined) {
      this.config.maxQueueSize = config.maxQueueSize;
    }
  }

  /**
   * Dispose scheduler and clean up resources
   *
   * Note: This only clears tasks in queues. Tasks that have been dequeued
   * and are currently executing should have their timers managed by the caller.
   */
  dispose(): void {
    this.stopRetryChecker();

    // Clear all timeout timers for queued tasks
    const allTasks = [...this.priorityQueue.toArray(), ...this.fifoQueue, ...this.retryQueue];

    for (const task of allTasks) {
      this.cancelTaskTimeout(task);
    }

    // Clear queues
    this.clear();
    this.retryQueue.length = 0;
    this.stats.retryQueueSize = 0;
  }
}
