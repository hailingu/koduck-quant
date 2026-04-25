/**
 * Worker Pool Core Module
 *
 * Implements Worker lifecycle management and core pool functionality.
 *
 * ## Responsibilities
 *
 * - **Worker Registry**: Maintains registry of all active workers
 * - **Worker Lifecycle**: Handles creation, initialization, state transitions, termination
 * - **State Machine**: Enforces valid worker state transitions (idle -> busy -> idle, error, terminated)
 * - **Communication Protocol**: Wraps worker messaging with error handling
 * - **Health Tracking**: Tracks worker availability, failure counts, metrics
 * - **Scaling Support**: Enables dynamic pool size adjustment with concurrent creation and graceful shutdown
 * - **Warmup Mechanism**: Pre-initializes workers to reduce first-task latency
 * - **Recycling Strategy**: Automatically recycles idle workers based on timeout
 *
 * ## Worker State Machine
 *
 * - **idle**: Ready to accept tasks
 * - **busy**: Currently executing a task
 * - **error**: Failed or crashed, recovery pending
 * - **terminated**: Permanently shut down, no longer usable
 *
 * ## Scaling Events
 *
 * - **scaled-up**: Emitted when workers are created (count, newTotal)
 * - **scaled-down**: Emitted when workers are terminated (count, newTotal)
 * - **scale-error**: Emitted when scaling operation fails (error, operation)
 * - **worker-recycled**: Emitted when idle worker is recycled (workerId, idleTime)
 *
 * @see {@link WorkerWrapper} for individual worker interface
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { WorkerPoolConfig } from "./types";
import { WorkerWrapper, type WorkerMessage } from "./worker-wrapper";

/**
 * Worker metadata for tracking state and metrics
 */
export interface WorkerMetadata {
  /** Unique worker identifier */
  id: string;

  /** Current worker state */
  state: "idle" | "busy" | "error" | "terminated";

  /** Wrapped worker instance */
  wrapper: WorkerWrapper;

  /** Current task ID if busy */
  currentTaskId: string | undefined;

  /** Number of completed tasks */
  completedTasks: number;

  /** Number of failed tasks */
  failedTasks: number;

  /** Average task execution time (ms) */
  avgResponseTime: number;

  /** Total response time for averaging */
  totalResponseTime: number;

  /** Response time sample count */
  responseTimeSamples: number;

  /** Creation timestamp */
  createdAt: number;

  /** Last activity timestamp */
  lastActivityAt: number;

  /** Memory usage estimate (MB) */
  memoryUsage: number;
}

/**
 * Pool statistics snapshot
 */
export interface CoreStats {
  total: number;
  idle: number;
  busy: number;
  error: number;
  totalMemory: number;
}

/**
 * Task result data
 */
export interface TaskResult {
  taskId: string;
  status: "success" | "error" | "timeout" | "cancelled";
  data?: unknown;
  error?: Error | undefined;
  duration: number;
  workerId: string;
  retryCount: number;
} /**
} * Task completion callback
} */
export type TaskCompleteCallback = (result: TaskResult) => void;

/**
 * WorkerPoolCore - Manages worker lifecycle and communication
 *
 * Extends EventEmitter to support scaling events
 */
export class WorkerPoolCore extends EventEmitter {
  private readonly config: WorkerPoolConfig;

  private readonly workers = new Map<string, WorkerMetadata>();

  private readonly taskCompleteCallbacks = new Map<string, Set<TaskCompleteCallback>>();

  private workerIdCounter = 0;

  private roundRobinIndex = 0;

  private disposed = false;

  /** Mutex for atomicity of scaling operations */
  private scalingLock = false;

  /** Recycling timer for idle worker cleanup */
  private recyclingTimer: NodeJS.Timeout | undefined;

  /**
   * Create new WorkerPoolCore instance
   *
   * @param config - Worker pool configuration
   */
  constructor(config: WorkerPoolConfig) {
    super();
    this.config = config;
  }

  /**
   * Initialize the pool with initial worker count
   *
   * Starts the recycling timer if idle timeout is configured
   */
  async initialize(): Promise<void> {
    if (this.disposed) {
      throw new Error("Worker pool core has been disposed");
    }

    const initialCount = this.config.minWorkerCount ?? 2;

    for (let i = 0; i < initialCount; i++) {
      await this.createWorker();
    }

    // Start recycling timer if idle timeout is configured
    this.startRecycling();
  }

  /**
   * Start the worker recycling mechanism
   *
   * Periodically checks for idle workers exceeding the idle timeout
   * and terminates them while maintaining minimum worker count.
   *
   * Default idle timeout: 5 minutes (300000ms)
   * Can be configured via WorkerPoolConfig.idleTimeout (if added)
   *
   * @private
   */
  private startRecycling(): void {
    // Default to 5 minutes if not configured
    const idleTimeout = (this.config as { idleTimeout?: number }).idleTimeout ?? 300000;

    if (idleTimeout <= 0) {
      return; // Recycling disabled
    }

    // Check every minute or half the idle timeout, whichever is smaller
    const checkInterval = Math.min(60000, idleTimeout / 2);

    this.recyclingTimer = setInterval(() => {
      void this.recycleIdleWorkers();
    }, checkInterval);
  }

  /**
   * Check and recycle idle workers that exceed the idle timeout
   *
   * Only recycles workers beyond the minimum count.
   * Emits 'worker-recycled' event for each recycled worker.
   *
   * @private
   */
  private async recycleIdleWorkers(): Promise<void> {
    if (this.disposed || this.scalingLock) {
      return; // Skip if disposed or scaling in progress
    }

    const idleTimeout = (this.config as { idleTimeout?: number }).idleTimeout ?? 300000;
    if (idleTimeout <= 0) {
      return;
    }

    const minWorkers = this.config.minWorkerCount ?? 2;
    const now = Date.now();
    const idleWorkers = this.getIdleWorkers();

    // Find workers that have been idle too long
    const recycleCandidates = idleWorkers.filter((w) => {
      const idleTime = now - w.lastActivityAt;
      return idleTime > idleTimeout;
    });

    if (recycleCandidates.length === 0) {
      return;
    }

    // Sort by idle time (longest first)
    const sortedCandidates = [...recycleCandidates].sort((a, b) => {
      const aIdleTime = now - a.lastActivityAt;
      const bIdleTime = now - b.lastActivityAt;
      return bIdleTime - aIdleTime;
    });

    // Recycle workers while maintaining minimum count
    for (const worker of sortedCandidates) {
      if (this.workers.size <= minWorkers) {
        break; // Reached minimum, stop recycling
      }

      const idleTime = now - worker.lastActivityAt;

      try {
        await this.terminateWorker(worker.id);
        this.emit("worker-recycled", worker.id, idleTime);
      } catch (error) {
        console.warn(`Failed to recycle worker ${worker.id}:`, error);
      }
    }
  }

  /**
   * Stop the recycling timer
   *
   * @private
   */
  private stopRecycling(): void {
    if (this.recyclingTimer) {
      clearInterval(this.recyclingTimer);
      this.recyclingTimer = undefined;
    }
  }

  /**
   * Create a new worker
   *
   * @private
   * @returns Worker ID
   * @throws Error if maximum workers exceeded or disposed
   */
  private async createWorker(): Promise<string> {
    if (this.disposed) {
      throw new Error("Worker pool core has been disposed");
    }

    const maxWorkers = this.config.maxWorkerCount ?? 16;
    if (this.workers.size >= maxWorkers) {
      throw new Error(`Maximum worker count (${maxWorkers}) reached`);
    }

    const workerId = `worker_${++this.workerIdCounter}`;
    const wrapper = new WorkerWrapper(workerId, this.config);

    // Setup message handler for task completion
    wrapper.onMessage((message: WorkerMessage) => {
      this.handleWorkerMessage(workerId, message);
    });

    // Setup error handler
    wrapper.onError((error: Error) => {
      this.handleWorkerError(workerId, error);
    });

    const metadata: WorkerMetadata = {
      id: workerId,
      state: "idle",
      wrapper,
      currentTaskId: undefined,
      completedTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      responseTimeSamples: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      memoryUsage: 0,
    };

    this.workers.set(workerId, metadata);
    return workerId;
  }

  /**
   * Assign a task to an idle worker
   *
   * @param workerId - ID of idle worker
   * @param taskId - Task ID
   * @param taskData - Task data
   * @throws Error if worker not found or not idle
   */
  async assignTask(workerId: string, taskId: string, taskData: unknown): Promise<void> {
    const metadata = this.workers.get(workerId);
    if (!metadata) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    if (metadata.state !== "idle") {
      throw new Error(`Worker not idle: ${workerId} (state=${metadata.state})`);
    }

    // Update state
    metadata.state = "busy";
    metadata.currentTaskId = taskId;
    metadata.lastActivityAt = Date.now();

    // Send task to worker
    await metadata.wrapper.postMessage({
      type: "task",
      id: taskId,
      data: taskData,
      timestamp: Date.now(),
    });
  }

  /**
   * Get all idle workers
   *
   * @returns Array of idle worker metadata
   */
  getIdleWorkers(): WorkerMetadata[] {
    return Array.from(this.workers.values()).filter((w) => w.state === "idle");
  }

  /**
   * Get worker by ID
   *
   * @param workerId - Worker ID
   * @returns Worker metadata or undefined
   */
  getWorker(workerId: string): WorkerMetadata | undefined {
    return this.workers.get(workerId);
  }

  /**
   * Register callback for task completion
   *
   * @param taskId - Task ID to monitor
   * @param callback - Completion callback
   * @returns Unsubscribe function
   */
  onTaskComplete(taskId: string, callback: TaskCompleteCallback): () => void {
    if (!this.taskCompleteCallbacks.has(taskId)) {
      this.taskCompleteCallbacks.set(taskId, new Set());
    }

    const callbacks = this.taskCompleteCallbacks.get(taskId)!;
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.taskCompleteCallbacks.delete(taskId);
      }
    };
  }

  /**
   * Handle message from worker
   *
   * @private
   * @param workerId - Worker ID
   * @param message - Worker message
   */
  /**
   * Handle message from worker
   *
   * @private
   * @param workerId - Worker ID
   * @param message - Worker message
   */
  private handleWorkerMessage(workerId: string, message: WorkerMessage): void {
    const metadata = this.workers.get(workerId);
    if (!metadata) {
      console.warn(`Message from unknown worker: ${workerId}`);
      return;
    }

    if (message.type === "progress") {
      metadata.lastActivityAt = Date.now();
      return;
    }

    this.handleTaskCompletion(workerId, metadata, message);
  }

  /**
   * Handle task completion message
   *
   * @private
   * @param workerId - Worker ID
   * @param metadata - Worker metadata
   * @param message - Worker message
   */
  private handleTaskCompletion(
    workerId: string,
    metadata: WorkerMetadata,
    message: WorkerMessage
  ): void {
    if (message.type !== "result" && message.type !== "error") {
      return;
    }

    const taskId = message.id ?? metadata.currentTaskId;
    if (!taskId) {
      console.warn(`Message missing task ID from worker: ${workerId}`);
      return;
    }

    // Calculate response time
    const now = Date.now();
    const duration = message.duration ?? now - metadata.lastActivityAt;

    // Update metrics
    metadata.totalResponseTime += duration;
    metadata.responseTimeSamples += 1;
    metadata.avgResponseTime = metadata.totalResponseTime / metadata.responseTimeSamples;

    // Create result object
    const result: TaskResult = {
      taskId,
      status: message.type === "result" ? "success" : "error",
      data: message.data,
      error: message.error ? new Error(message.error.message) : undefined,
      duration,
      workerId,
      retryCount: 0,
    };

    // Update completion counts
    if (message.type === "result") {
      metadata.completedTasks += 1;
    } else {
      metadata.failedTasks += 1;
    }

    // Transition back to idle
    metadata.state = "idle";
    metadata.currentTaskId = undefined;
    metadata.lastActivityAt = now;

    // Invoke callbacks
    const callbacks = this.taskCompleteCallbacks.get(taskId);
    if (callbacks) {
      for (const cb of callbacks) {
        cb(result);
      }
    }
  }

  /**
   * Handle worker error
   *
   * @private
   * @param workerId - Worker ID
   * @param error - Error from worker
   */
  private handleWorkerError(workerId: string, error: Error): void {
    const metadata = this.workers.get(workerId);
    if (!metadata) {
      console.warn(`Error from unknown worker: ${workerId}`, error);
      return;
    }

    // Mark as error state
    metadata.state = "error";
    metadata.failedTasks += 1;

    const taskId = metadata.currentTaskId;
    if (taskId) {
      // Notify task failed
      const result: TaskResult = {
        taskId,
        status: "error",
        error,
        duration: Date.now() - metadata.lastActivityAt,
        workerId,
        retryCount: 0,
      };

      const callbacks = this.taskCompleteCallbacks.get(taskId);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(result);
        }
      }

      metadata.currentTaskId = undefined;
    }

    console.warn(`Worker ${workerId} encountered error:`, error.message);
  }

  /**
   * Get current pool statistics
   *
   * @returns Statistics snapshot
   */
  getStats(): CoreStats {
    let idle = 0;
    let busy = 0;
    let error = 0;
    let totalMemory = 0;

    for (const metadata of this.workers.values()) {
      if (metadata.state === "idle") {
        idle += 1;
      } else if (metadata.state === "busy") {
        busy += 1;
      } else if (metadata.state === "error") {
        error += 1;
      }

      totalMemory += metadata.memoryUsage;
    }

    return {
      total: this.workers.size,
      idle,
      busy,
      error,
      totalMemory,
    };
  }

  /**
   * Wait for all workers to become idle
   */
  async waitForIdle(): Promise<void> {
    while (true) {
      const stats = this.getStats();
      if (stats.busy === 0) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    }
  }

  /**
   * Scale up worker count with concurrent creation and warmup
   *
   * Creates multiple workers concurrently for better performance.
   * Includes warmup mechanism to reduce first-task latency.
   * Emits 'scaled-up' event on success, 'scale-error' on failure.
   *
   * @param count - Number of workers to add
   * @throws Error if max workers exceeded or scaling already in progress
   */
  async scaleUp(count: number): Promise<void> {
    // Validate count
    if (count <= 0) {
      return;
    }

    // Acquire lock for atomicity
    if (this.scalingLock) {
      throw new Error("Scaling operation already in progress");
    }

    this.scalingLock = true;

    try {
      const maxWorkers = this.config.maxWorkerCount ?? 16;
      const currentSize = this.workers.size;
      const newTotal = currentSize + count;

      if (newTotal > maxWorkers) {
        throw new Error(
          `Cannot scale up: would exceed maxWorkers (${maxWorkers}). Current: ${currentSize}, requested: +${count}`
        );
      }

      // Create workers concurrently for better performance
      const creationPromises: Promise<string>[] = [];
      const actualCount = Math.min(count, maxWorkers - currentSize);

      for (let i = 0; i < actualCount; i++) {
        creationPromises.push(
          this.createWorker().catch((error) => {
            // Emit error but don't fail entire operation
            this.emit("scale-error", error, "scale-up");
            throw error;
          })
        );
      }

      // Wait for all workers to be created
      const createdWorkerIds = await Promise.allSettled(creationPromises);

      // Count successful creations
      const successCount = createdWorkerIds.filter((r) => r.status === "fulfilled").length;

      // Warmup newly created workers
      const warmupPromises: Promise<void>[] = [];
      for (const result of createdWorkerIds) {
        if (result.status === "fulfilled") {
          const workerId = result.value;
          warmupPromises.push(this.warmupWorker(workerId));
        }
      }

      // Wait for warmup to complete (fire-and-forget warmup failures)
      await Promise.allSettled(warmupPromises);

      if (successCount > 0) {
        // Emit scaled-up event
        this.emit("scaled-up", successCount, this.workers.size);
      }

      // If some workers failed to create, throw error
      const failedCount = createdWorkerIds.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        throw new Error(
          `Partial scale-up failure: ${successCount}/${actualCount} workers created successfully`
        );
      }
    } finally {
      // Always release lock
      this.scalingLock = false;
    }
  }

  /**
   * Warmup a worker by sending a no-op ping message
   *
   * This reduces first-task latency by ensuring the worker is fully initialized
   * and its event loop is running.
   *
   * @private
   * @param workerId - Worker ID to warmup
   */
  private async warmupWorker(workerId: string): Promise<void> {
    const metadata = this.workers.get(workerId);
    if (metadata?.state !== "idle") {
      return;
    }

    try {
      // Send ping message to initialize worker
      await metadata.wrapper.postMessage({
        type: "ping",
        id: "warmup",
        data: null,
        timestamp: Date.now(),
      });

      // Update last activity time
      metadata.lastActivityAt = Date.now();
    } catch (error) {
      // Warmup failure is not critical, just log
      console.warn(`Worker warmup failed for ${workerId}:`, error);
    }
  }

  /**
   * Scale down worker count with intelligent selection strategy
   *
   * Selects workers to terminate based on:
   * 1. Only idle workers (never busy workers)
   * 2. Longest idle time first (LRU strategy)
   * 3. Respects minimum worker count
   *
   * Emits 'scaled-down' event on success, 'scale-error' on failure.
   *
   * @param count - Number of idle workers to remove
   * @returns Actual number of workers terminated
   * @throws Error if scaling already in progress
   */
  async scaleDown(count: number): Promise<number> {
    // Validate count
    if (count <= 0) {
      return 0;
    }

    // Acquire lock for atomicity
    if (this.scalingLock) {
      throw new Error("Scaling operation already in progress");
    }

    this.scalingLock = true;

    try {
      const minWorkers = this.config.minWorkerCount ?? 2;
      const idleWorkers = this.getIdleWorkers();
      const canTerminate = Math.max(0, this.workers.size - minWorkers);
      const toTerminate = Math.min(count, canTerminate, idleWorkers.length);

      if (toTerminate === 0) {
        return 0;
      }

      // Sort idle workers by idle time (longest idle first) - use slice to avoid mutation
      const sortedIdleWorkers = [...idleWorkers].sort((a, b) => {
        const aIdleTime = Date.now() - a.lastActivityAt;
        const bIdleTime = Date.now() - b.lastActivityAt;
        return bIdleTime - aIdleTime; // Descending order
      });

      // Terminate workers sequentially (safer than concurrent)
      const terminatedIds: string[] = [];
      for (let i = 0; i < toTerminate; i++) {
        const worker = sortedIdleWorkers[i];

        try {
          // Wait for any in-flight messages to complete
          await this.gracefulTerminate(worker.id);
          terminatedIds.push(worker.id);
        } catch (error) {
          // Emit error but continue with remaining workers
          this.emit("scale-error", error, "scale-down");
          console.warn(`Failed to terminate worker ${worker.id}:`, error);
        }
      }

      if (terminatedIds.length > 0) {
        // Emit scaled-down event
        this.emit("scaled-down", terminatedIds.length, this.workers.size);
      }

      return terminatedIds.length;
    } finally {
      // Always release lock
      this.scalingLock = false;
    }
  }

  /**
   * Gracefully terminate a worker
   *
   * Ensures any pending messages are processed before termination.
   * Waits briefly for the worker to finish if it transitions to busy.
   *
   * @private
   * @param workerId - Worker ID to terminate
   */
  private async gracefulTerminate(workerId: string): Promise<void> {
    const metadata = this.workers.get(workerId);
    if (!metadata) {
      return;
    }

    // If worker becomes busy during termination, wait for it to finish
    const maxWaitTime = 5000; // 5 seconds max wait
    const startTime = Date.now();

    while (metadata.state === "busy" && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
    }

    // Terminate regardless of state after timeout
    await this.terminateWorker(workerId);
  }

  /**
   * Terminate a specific worker
   *
   * @private
   * @param workerId - Worker ID to terminate
   */
  private async terminateWorker(workerId: string): Promise<void> {
    const metadata = this.workers.get(workerId);
    if (!metadata) {
      return;
    }

    metadata.state = "terminated";
    await metadata.wrapper.terminate();
    this.workers.delete(workerId);
  }

  /**
   * Get round-robin index for scheduling
   *
   * @returns Index for round-robin selection
   */
  getRoundRobinIndex(): number {
    return this.roundRobinIndex++;
  }

  /**
   * Dispose all workers and cleanup
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop recycling timer
    this.stopRecycling();

    // Wait for all workers to finish
    await this.waitForIdle();

    // Terminate all workers
    const workerIds = Array.from(this.workers.keys());
    for (const workerId of workerIds) {
      await this.terminateWorker(workerId);
    }

    // Clear callbacks
    this.taskCompleteCallbacks.clear();

    // Remove all event listeners
    this.removeAllListeners();
  }
}
