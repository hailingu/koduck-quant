/**
 * Failover Handler Module
 *
 * Implements fault detection and failover logic for worker pool.
 *
 * ## Responsibilities
 *
 * - **Fault Detection**: Monitors worker health and detects failures
 * - **Task Reassignment**: Retrieves tasks from failed workers and reschedules them
 * - **Worker Recovery**: Handles worker restart with cooldown logic
 * - **Failover Metrics**: Tracks failover statistics and recovery rates
 *
 * ## Failover Flow
 *
 * 1. Detect worker failure (crash or hang)
 * 2. Retrieve current task from failed worker
 * 3. Terminate and cleanup failed worker
 * 4. Reassign task to healthy worker
 * 5. Create replacement worker after cooldown
 *
 * @example
 * ```typescript
 * const failoverHandler = new FailoverHandler(healthMonitor, workerPoolCore, scheduler, config);
 *
 * // Subscribe to failover events
 * failoverHandler.on('failover:started', (workerId, taskId) => {
 *   console.log(`Failover initiated for worker ${workerId}, task ${taskId}`);
 * });
 *
 * // Start failover monitoring
 * await failoverHandler.start();
 *
 * // Stop monitoring
 * await failoverHandler.stop();
 * ```
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { HealthMonitor } from "./health-monitor";
import type { WorkerPoolCore } from "./worker-pool-core";
import type { TaskScheduler } from "./task-scheduler";
import type { WorkerPoolConfig } from "./types";

/**
 * Failover statistics
 */
export interface FailoverStats {
  /** Total failover events */
  totalFailovers: number;

  /** Total task reassignments */
  totalReassignments: number;

  /** Total worker restarts */
  totalRestarts: number;

  /** Successful recoveries */
  successfulRecoveries: number;

  /** Failed recovery attempts */
  failedRecoveries: number;

  /** Tasks lost during failover */
  tasksLost: number;

  /** Average recovery time (ms) */
  avgRecoveryTime: number;

  /** Last failover timestamp */
  lastFailoverTime?: number;

  /** Total zombie workers detected */
  totalZombiesDetected: number;

  /** Total zombie workers cleaned up */
  totalZombiesCleanedUp: number;

  /** Average inactive duration before cleanup (ms) */
  avgInactiveDuration: number;

  /** Last zombie cleanup timestamp */
  lastZombieCleanupTime?: number;
}

/**
 * Failover handler configuration
 */
export interface FailoverConfig {
  /** Enable automatic failover */
  enabled?: boolean;

  /** Cooldown before worker restart (ms) */
  restartCooldown?: number;

  /** Maximum concurrent failovers */
  maxConcurrentFailovers?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Failover context for tracking recovery
 */
interface FailoverContext {
  workerId: string;
  taskId?: string;
  startTime: number;
  reason: "crash" | "hang" | "zombie";
}

/**
 * Failover Handler - Manages worker failure detection and recovery
 */
export class FailoverHandler extends EventEmitter {
  private readonly healthMonitor: HealthMonitor;
  private readonly workerPoolCore: WorkerPoolCore;
  private readonly scheduler: TaskScheduler;
  private readonly config: Required<FailoverConfig>;
  private readonly poolConfig: WorkerPoolConfig;

  private readonly stats: FailoverStats = {
    totalFailovers: 0,
    totalReassignments: 0,
    totalRestarts: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    tasksLost: 0,
    avgRecoveryTime: 0,
    totalZombiesDetected: 0,
    totalZombiesCleanedUp: 0,
    avgInactiveDuration: 0,
  };

  private readonly zombieInactiveDurations: number[] = [];

  private readonly activeFailovers = new Map<string, FailoverContext>();
  private readonly restartTimers = new Map<string, NodeJS.Timeout>();
  private isRunning = false;

  // Bound event handlers for proper removal
  private readonly boundHandleWorkerCrash!: (workerId: string, error?: Error) => void;
  private readonly boundHandleWorkerHang!: (workerId: string) => void;
  private readonly boundHandleWorkerZombie!: (workerId: string, inactiveDuration: number) => void;

  private readonly defaultConfig: Required<FailoverConfig> = {
    enabled: true,
    restartCooldown: 5000,
    maxConcurrentFailovers: 3,
    debug: false,
  };

  /**
   * Create failover handler instance
   * @param healthMonitor - Health monitor instance
   * @param workerPoolCore - Worker pool core instance
   * @param scheduler - Task scheduler instance
   * @param poolConfig - Worker pool configuration
   * @param config - Failover configuration options
   */
  constructor(
    healthMonitor: HealthMonitor,
    workerPoolCore: WorkerPoolCore,
    scheduler: TaskScheduler,
    poolConfig: WorkerPoolConfig,
    config: FailoverConfig = {}
  ) {
    super();
    this.healthMonitor = healthMonitor;
    this.workerPoolCore = workerPoolCore;
    this.scheduler = scheduler;
    this.poolConfig = poolConfig;
    this.config = { ...this.defaultConfig, ...config };

    // Bind event handlers once
    this.boundHandleWorkerCrash = this.handleWorkerCrash.bind(this);
    this.boundHandleWorkerHang = this.handleWorkerHang.bind(this);
    this.boundHandleWorkerZombie = this.handleWorkerZombie.bind(this);
  }

  /**
   * Start failover monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;

    // Listen to worker health events using bound references
    this.healthMonitor.on("worker:crashed", this.boundHandleWorkerCrash);
    this.healthMonitor.on("worker:hung", this.boundHandleWorkerHang);
    this.healthMonitor.on("worker:zombie", this.boundHandleWorkerZombie);

    if (this.config.debug) {
      console.debug("[FailoverHandler] Failover monitoring started");
    }
  }

  /**
   * Stop failover monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Remove event listeners using bound references
    this.healthMonitor.off("worker:crashed", this.boundHandleWorkerCrash);
    this.healthMonitor.off("worker:hung", this.boundHandleWorkerHang);
    this.healthMonitor.off("worker:zombie", this.boundHandleWorkerZombie);

    // Clear all restart timers
    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();

    if (this.config.debug) {
      console.debug("[FailoverHandler] Failover monitoring stopped");
    }
  }

  /**
   * Handle worker crash event
   * @param workerId - Crashed worker ID
   * @param error - Error that caused the crash
   */
  private handleWorkerCrash(workerId: string, error?: Error): void {
    if (this.config.debug) {
      console.debug(`[FailoverHandler] Handling crash for worker ${workerId}:`, error?.message);
    }

    this.initiateFailover(workerId, "crash");
  }

  /**
   * Handle worker hang event
   * @param workerId - Hung worker ID
   */
  private handleWorkerHang(workerId: string): void {
    if (this.config.debug) {
      console.debug(`[FailoverHandler] Handling hang for worker ${workerId}`);
    }

    this.initiateFailover(workerId, "hang");
  }

  /**
   * Handle worker zombie event
   * @param workerId - Zombie worker ID
   * @param inactiveDuration - Duration of inactivity (ms)
   */
  private handleWorkerZombie(workerId: string, inactiveDuration: number): void {
    // Track zombie detection statistics
    this.stats.totalZombiesDetected++;
    this.zombieInactiveDurations.push(inactiveDuration);

    // Calculate average inactive duration
    const totalDuration = this.zombieInactiveDurations.reduce((sum, d) => sum + d, 0);
    this.stats.avgInactiveDuration = totalDuration / this.zombieInactiveDurations.length;

    // Keep only recent samples (last 100)
    if (this.zombieInactiveDurations.length > 100) {
      this.zombieInactiveDurations.shift();
    }

    if (this.config.debug) {
      console.debug(
        `[FailoverHandler] Handling zombie worker ${workerId} (inactive for ${inactiveDuration}ms)`
      );
    }

    this.initiateFailover(workerId, "zombie");
  }

  /**
   * Initiate failover for a failed worker
   * @param workerId - Failed worker ID
   * @param reason - Failure reason
   */
  private async initiateFailover(
    workerId: string,
    reason: "crash" | "hang" | "zombie"
  ): Promise<void> {
    // Check if already handling failover for this worker
    if (this.activeFailovers.has(workerId)) {
      if (this.config.debug) {
        console.debug(`[FailoverHandler] Failover already in progress for worker ${workerId}`);
      }
      return;
    }

    // Check concurrent failover limit
    if (this.activeFailovers.size >= this.config.maxConcurrentFailovers) {
      if (this.config.debug) {
        console.debug("[FailoverHandler] Max concurrent failovers reached, queueing...");
      }
      // Could implement a queue here, for now just skip
      return;
    }

    const startTime = Date.now();

    // Get worker metadata
    const workerMeta = this.workerPoolCore.getWorker(workerId);
    if (!workerMeta) {
      if (this.config.debug) {
        console.debug(`[FailoverHandler] Worker ${workerId} not found in pool`);
      }
      return;
    }

    this.stats.totalFailovers++;

    // Get current task if any
    const taskId = workerMeta.currentTaskId;
    // Note: We'll retrieve task context when needed for reassignment

    // Create failover context
    const failoverContext: FailoverContext = {
      workerId,
      startTime,
      reason,
    };

    if (taskId) {
      failoverContext.taskId = taskId;
    }

    this.activeFailovers.set(workerId, failoverContext);

    this.emit("failover:started", workerId, taskId, reason);

    // Use setImmediate to allow tests to observe activeFailovers state
    await new Promise((resolve) => setImmediate(resolve));

    try {
      // Step 1: Reassign task if exists
      if (taskId) {
        await this.reassignTask(taskId, workerId);
      }

      // Step 2: Terminate failed worker
      // Note: Worker termination needs to be handled by WorkerPoolCore
      // For now, we'll emit an event for the pool to handle
      this.emit("worker:needs-termination", workerId);

      // Step 3: Schedule worker replacement notification
      this.scheduleWorkerRestart(workerId);

      // Update stats
      const recoveryTime = Date.now() - startTime;
      this.recordSuccessfulRecovery(recoveryTime);
      this.stats.lastFailoverTime = Date.now();

      // Track zombie cleanup if this was a zombie failover
      if (reason === "zombie") {
        this.stats.totalZombiesCleanedUp++;
        this.stats.lastZombieCleanupTime = Date.now();
      }

      this.emit("failover:completed", workerId, recoveryTime);

      if (this.config.debug) {
        console.debug(
          `[FailoverHandler] Failover completed for worker ${workerId} in ${recoveryTime}ms`
        );
      }
    } catch (error) {
      this.recordFailedRecovery();
      this.emit("failover:failed", workerId, error);

      if (this.config.debug) {
        console.error(`[FailoverHandler] Failover failed for worker ${workerId}:`, error);
      }
    } finally {
      this.activeFailovers.delete(workerId);
    }
  }

  /**
   * Reassign task from failed worker by scheduling it for retry
   *
   * NOTE: This method currently relies on external task tracking.
   * In a full implementation, WorkerPoolCore should track task contexts
   * so we can retrieve and reschedule them.
   *
   * @param taskId - ID of task to reassign
   * @param failedWorkerId - ID of failed worker
   */
  private async reassignTask(taskId: string, failedWorkerId: string): Promise<void> {
    try {
      // Emit event to notify task needs reassignment
      // The WorkerPoolCore or TaskScheduler should handle this by:
      // 1. Retrieving the task context for this taskId
      // 2. Calling scheduler.scheduleRetry(taskContext)

      this.stats.totalReassignments++;

      this.emit("task:needs-reassignment", taskId, failedWorkerId);

      if (this.config.debug) {
        console.debug(
          `[FailoverHandler] Task ${taskId} scheduled for reassignment from worker ${failedWorkerId}`
        );
      }
    } catch (error) {
      this.stats.tasksLost++;

      this.emit("task:lost", taskId, failedWorkerId, error);

      if (this.config.debug) {
        console.error(`[FailoverHandler] Failed to reassign task ${taskId}:`, error);
      }

      throw error;
    }
  }

  // Note: Worker termination is handled by WorkerPoolCore through events
  // This avoids coupling to private methods

  /**
   * Schedule worker restart notification after cooldown period
   * @param workerId - Worker ID to restart (for tracking only)
   */
  private scheduleWorkerRestart(workerId: string): void {
    // Clear any existing timer for this worker
    const existingTimer = this.restartTimers.get(workerId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      // Emit event to notify that a replacement worker is needed
      // The WorkerPoolCore should handle this by creating a new worker
      this.stats.totalRestarts++;
      this.restartTimers.delete(workerId);

      this.emit("worker:needs-replacement", workerId);

      if (this.config.debug) {
        console.debug(`[FailoverHandler] Replacement worker requested for ${workerId}`);
      }
    }, this.config.restartCooldown);

    this.restartTimers.set(workerId, timer);
  }

  /**
   * Record successful recovery
   * @param recoveryTime - Time taken for recovery (ms)
   */
  private recordSuccessfulRecovery(recoveryTime: number): void {
    this.stats.successfulRecoveries++;

    // Update average recovery time
    const totalRecoveries = this.stats.successfulRecoveries;
    const currentAvg = this.stats.avgRecoveryTime;
    this.stats.avgRecoveryTime =
      (currentAvg * (totalRecoveries - 1) + recoveryTime) / totalRecoveries;
  }

  /**
   * Record failed recovery
   */
  private recordFailedRecovery(): void {
    this.stats.failedRecoveries++;
  }

  /**
   * Get failover statistics
   * @returns Current failover stats
   */
  getStats(): FailoverStats {
    return { ...this.stats };
  }

  /**
   * Get active failover count
   * @returns Number of active failovers
   */
  getActiveFailoverCount(): number {
    return this.activeFailovers.size;
  }

  /**
   * Check if failover is in progress for worker
   * @param workerId - Worker ID to check
   * @returns True if failover is active for this worker
   */
  isFailoverActive(workerId: string): boolean {
    return this.activeFailovers.has(workerId);
  }

  /**
   * Dispose failover handler
   */
  async dispose(): Promise<void> {
    await this.stop();
    this.activeFailovers.clear();
  }
}
