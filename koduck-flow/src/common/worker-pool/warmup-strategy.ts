/**
 * Warmup Strategy - Worker Warmup and Cold-Start Optimization
 *
 * Implements strategies to optimize worker startup performance and reduce
 * first task latency through:
 *
 * - Pre-creation during app startup
 * - Idle-time pre-creation for peak load preparation
 * - Warmup task execution for resource loading
 * - Cold-start detection and tracking
 * - Hot worker retention to avoid disposal
 * - Performance metrics collection
 *
 * ## Performance Goals
 *
 * - Worker creation time: < 50ms
 * - First task latency reduction: > 30%
 * - Improved cache hit rate through warmup
 * - Efficient memory utilization
 *
 * @module WarmupStrategy
 * @see {@link WarmupStrategy}
 * @see {@link WarmupConfig}
 *
 * @example
 * ```typescript
 * const strategy = new WarmupStrategy({
 *   enablePreCreation: true,
 *   preCreationCount: 2,
 *   enableWarmup: true,
 *   warmupTaskType: 'warmup',
 *   coreWorkerCount: 2,
 * });
 *
 * // On pool initialization
 * await strategy.executePreCreationWarmup();
 *
 * // During idle detection
 * strategy.scheduleIdlePreCreation();
 *
 * // Track worker creation
 * strategy.recordWorkerCreated(workerId);
 * strategy.recordFirstTaskExecution(workerId, duration);
 * ```
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { IDisposable } from "../disposable";

/**
 * Warmup task definition
 *
 * @interface WarmupTask
 * @property type - Task type for warmup execution
 * @property data - Data to pass to warmup executor
 */
export interface WarmupTask {
  /** Task type identifier */
  type: string;
  /** Task data payload */
  data?: unknown;
}

/**
 * Worker warmup state information
 *
 * @interface WorkerWarmupState
 * @property workerId - Worker identifier
 * @property isWarm - Whether worker is warmed up
 * @property isColdStart - Whether this is a cold-start worker
 * @property createdAt - Timestamp when worker was created
 * @property warmedAt - Timestamp when worker was warmed (if applicable)
 * @property firstTaskExecutedAt - Timestamp of first task execution
 * @property creationDuration - Time taken to create worker (ms)
 * @property firstTaskDuration - Duration of first task execution (ms)
 * @property isCore - Whether worker is part of core pool
 */
export interface WorkerWarmupState {
  /** Worker ID */
  workerId: string;
  /** Is warmed up */
  isWarm: boolean;
  /** Is cold start */
  isColdStart: boolean;
  /** Created timestamp */
  createdAt: number;
  /** Warmed timestamp */
  warmedAt?: number | undefined;
  /** First task executed timestamp */
  firstTaskExecutedAt?: number | undefined;
  /** Creation duration in ms */
  creationDuration?: number | undefined;
  /** First task duration in ms */
  firstTaskDuration?: number | undefined;
  /** Is core worker */
  isCore: boolean;
}

/**
 * Warmup statistics snapshot
 *
 * @interface WarmupStatistics
 * @property totalWorkersCreated - Total workers created
 * @property warmedWorkers - Number of warmed workers
 * @property coldStartWorkers - Number of cold-start workers
 * @property coreWorkersActive - Number of active core workers
 * @property avgCreationTime - Average worker creation time (ms)
 * @property avgFirstTaskLatency - Average first task latency (ms)
 * @property preCreationExecutions - Number of pre-creation warmup executions
 * @property idlePreCreations - Number of idle-triggered pre-creations
 */
export interface WarmupStatistics {
  /** Total workers created */
  totalWorkersCreated: number;
  /** Warmed workers count */
  warmedWorkers: number;
  /** Cold-start workers count */
  coldStartWorkers: number;
  /** Core workers active */
  coreWorkersActive: number;
  /** Average creation time */
  avgCreationTime: number;
  /** Average first task latency */
  avgFirstTaskLatency: number;
  /** Pre-creation executions */
  preCreationExecutions: number;
  /** Idle pre-creations */
  idlePreCreations: number;
}

/**
 * Configuration for WarmupStrategy
 *
 * @interface WarmupConfig
 * @property enablePreCreation - Enable pre-creation on startup
 * @property preCreationCount - Number of workers to pre-create
 * @property enableWarmup - Enable warmup task execution
 * @property warmupTaskType - Task type for warmup execution
 * @property warmupTaskData - Data to pass to warmup tasks
 * @property enableColdStartTracking - Track cold-start metrics
 * @property coreWorkerCount - Number of workers to retain as core
 * @property enableIdlePreCreation - Enable pre-creation during idle
 * @property idlePreCreationThreshold - Idle time before pre-creation (ms)
 * @property enableHotWorkerRetention - Prevent disposal of hot workers
 */
export interface WarmupConfig {
  /** Enable pre-creation */
  enablePreCreation: boolean;
  /** Pre-creation count */
  preCreationCount: number;
  /** Enable warmup */
  enableWarmup: boolean;
  /** Warmup task type */
  warmupTaskType: string;
  /** Warmup task data */
  warmupTaskData?: unknown;
  /** Enable cold-start tracking */
  enableColdStartTracking: boolean;
  /** Core worker count */
  coreWorkerCount: number;
  /** Enable idle pre-creation */
  enableIdlePreCreation: boolean;
  /** Idle pre-creation threshold (ms) */
  idlePreCreationThreshold: number;
  /** Enable hot worker retention */
  enableHotWorkerRetention: boolean;
}

/**
 * Default warmup configuration
 */
const DEFAULT_CONFIG: WarmupConfig = {
  enablePreCreation: true,
  preCreationCount: 2,
  enableWarmup: true,
  warmupTaskType: "warmup",
  enableColdStartTracking: true,
  coreWorkerCount: 2,
  enableIdlePreCreation: true,
  idlePreCreationThreshold: 60000, // 1 minute
  enableHotWorkerRetention: true,
};

/**
 * WarmupStrategy - Implements warmup and cold-start optimization
 *
 * Manages worker pre-creation, warmup execution, cold-start detection,
 * and hot worker retention strategies to optimize pool startup performance.
 *
 * @class WarmupStrategy
 * @augments EventEmitter
 * @implements {IDisposable}
 *
 * @fires WarmupStrategy#worker-created - When a worker is created
 * @fires WarmupStrategy#worker-warmed - When a worker is warmed
 * @fires WarmupStrategy#worker-cold-start - When cold-start detected
 * @fires WarmupStrategy#pre-creation-started - When pre-creation starts
 * @fires WarmupStrategy#pre-creation-completed - When pre-creation completes
 * @fires WarmupStrategy#idle-pre-creation-scheduled - When idle pre-creation scheduled
 */
export class WarmupStrategy extends EventEmitter implements IDisposable {
  private readonly config: WarmupConfig;

  // Worker tracking
  private readonly workerStates = new Map<string, WorkerWarmupState>();
  private readonly coreWorkerIds = new Set<string>();

  // Statistics
  private totalCreationTime = 0;
  private totalFirstTaskLatency = 0;
  private preCreationExecutions = 0;
  private idlePreCreations = 0;

  // Idle tracking
  private lastActivityTime = Date.now();
  private idleCheckTimer?: NodeJS.Timeout | undefined;
  private disposed = false;

  /**
   * Create a new WarmupStrategy instance
   *
   * @param config - Warmup configuration
   */
  constructor(config: Partial<WarmupConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.validateConfig();
  }

  /**
   * Validate configuration parameters
   *
   * @throws {Error} If configuration is invalid
   */
  private validateConfig(): void {
    if (this.config.preCreationCount < 0) {
      throw new Error("preCreationCount must be >= 0");
    }
    if (this.config.coreWorkerCount < 0) {
      throw new Error("coreWorkerCount must be >= 0");
    }
    if (this.config.coreWorkerCount > this.config.preCreationCount) {
      throw new Error("coreWorkerCount must be <= preCreationCount");
    }
    if (this.config.idlePreCreationThreshold < 0) {
      throw new Error("idlePreCreationThreshold must be >= 0");
    }
  }

  /**
   * Execute pre-creation warmup on startup
   *
   * Creates and optionally warms up initial set of workers.
   * Returns callback functions for the pool to register created workers.
   *
   * @returns Object containing callbacks for worker registration
   */
  executePreCreationWarmup(): {
    onWorkerCreated: (workerId: string) => void;
    onWorkerWarmed?: (workerId: string) => void;
  } {
    if (this.disposed) {
      throw new Error("WarmupStrategy has been disposed");
    }

    this.preCreationExecutions++;
    this.emit("pre-creation-started", this.config.preCreationCount);

    return {
      onWorkerCreated: (workerId: string) => {
        this.recordWorkerCreated(workerId);
      },
      onWorkerWarmed: (workerId: string) => {
        this.recordWorkerWarmed(workerId);
      },
    };
  }

  /**
   * Schedule idle-time pre-creation
   *
   * Sets up monitoring to pre-create workers during idle periods.
   * This helps prepare for load spikes.
   */
  scheduleIdlePreCreation(): void {
    if (this.disposed) {
      throw new Error("WarmupStrategy has been disposed");
    }

    if (!this.config.enableIdlePreCreation || this.idleCheckTimer) {
      return;
    }

    // Reset last activity time on schedule
    this.lastActivityTime = Date.now();

    this.idleCheckTimer = setInterval(
      () => {
        const idleTime = Date.now() - this.lastActivityTime;
        if (idleTime >= this.config.idlePreCreationThreshold) {
          this.emit("idle-pre-creation-scheduled", this.config.preCreationCount);
          this.idlePreCreations++;
        }
      },
      Math.min(this.config.idlePreCreationThreshold / 4, 15000)
    ); // Check every 1/4 of threshold or max 15s
  }

  /**
   * Record worker activity to track idle time
   *
   * Should be called whenever a worker executes a task.
   * Resets the idle time counter.
   */
  recordActivity(): void {
    this.lastActivityTime = Date.now();
  }

  /**
   * Record worker creation
   *
   * @param workerId - Worker ID
   * @param creationDuration - Time taken to create worker (ms)
   */
  recordWorkerCreated(workerId: string, creationDuration?: number): void {
    const state: WorkerWarmupState = {
      workerId,
      isWarm: false,
      isColdStart: true,
      createdAt: Date.now(),
      creationDuration: creationDuration,
      isCore: this.coreWorkerIds.size < this.config.coreWorkerCount,
    };

    // Mark first N workers as core workers
    if (state.isCore) {
      this.coreWorkerIds.add(workerId);
    }

    this.workerStates.set(workerId, state);

    if (creationDuration !== undefined) {
      this.totalCreationTime += creationDuration;
    }

    this.emit("worker-created", state);
  }

  /**
   * Record worker warmup completion
   *
   * @param workerId - Worker ID
   */
  recordWorkerWarmed(workerId: string): void {
    const state = this.workerStates.get(workerId);
    if (!state) {
      return;
    }

    state.isWarm = true;
    state.warmedAt = Date.now();

    this.emit("worker-warmed", state);
  }

  /**
   * Record first task execution on worker
   *
   * Updates cold-start status and tracks latency.
   *
   * @param workerId - Worker ID
   * @param duration - Task execution duration (ms)
   */
  recordFirstTaskExecution(workerId: string, duration: number): void {
    const state = this.workerStates.get(workerId);
    if (!state) {
      return;
    }

    // Only record if this is the first task
    if (state.firstTaskExecutedAt !== undefined) {
      return;
    }

    state.firstTaskExecutedAt = Date.now();
    state.firstTaskDuration = duration;
    state.isColdStart = false; // No longer cold after first task

    this.totalFirstTaskLatency += duration;

    this.emit("worker-cold-start", state);
  }

  /**
   * Check if worker is warm (ready for immediate execution)
   *
   * @param workerId - Worker ID
   * @returns True if worker is warm
   */
  isWorkerWarm(workerId: string): boolean {
    return this.workerStates.get(workerId)?.isWarm ?? false;
  }

  /**
   * Check if worker is cold-start
   *
   * @param workerId - Worker ID
   * @returns True if worker is cold-start
   */
  isWorkerColdStart(workerId: string): boolean {
    return this.workerStates.get(workerId)?.isColdStart ?? true;
  }

  /**
   * Check if worker is part of core pool
   *
   * Core workers are retained and not disposed during scale-down.
   *
   * @param workerId - Worker ID
   * @returns True if worker is core worker
   */
  isCoreWorker(workerId: string): boolean {
    return this.workerStates.get(workerId)?.isCore ?? false;
  }

  /**
   * Get priority order for worker selection
   *
   * Hot workers are prioritized over cold-start workers.
   *
   * @param workerIds - List of worker IDs to prioritize
   * @returns Sorted worker IDs by priority (warm > cold-start)
   */
  getPrioritizedWorkers(workerIds: string[]): string[] {
    return workerIds.sort((a, b) => {
      const stateA = this.workerStates.get(a);
      const stateB = this.workerStates.get(b);

      // Prioritize warm workers
      if ((stateA?.isWarm ?? false) !== (stateB?.isWarm ?? false)) {
        return (stateB?.isWarm ?? false) ? 1 : -1;
      }

      // Then prioritize by creation time (older = more likely to be warm)
      const timeA = stateA?.createdAt ?? 0;
      const timeB = stateB?.createdAt ?? 0;
      return timeA - timeB;
    });
  }

  /**
   * Remove worker from tracking
   *
   * Should be called when worker is disposed.
   *
   * @param workerId - Worker ID
   */
  removeWorker(workerId: string): void {
    this.workerStates.delete(workerId);
    this.coreWorkerIds.delete(workerId);
  }

  /**
   * Get warmup statistics snapshot
   *
   * @returns Current warmup statistics
   */
  getStatistics(): WarmupStatistics {
    let warmedCount = 0;
    let coldStartCount = 0;

    for (const state of this.workerStates.values()) {
      if (state.isWarm) {
        warmedCount++;
      }
      if (state.isColdStart) {
        coldStartCount++;
      }
    }

    const totalWorkers = this.workerStates.size;
    const avgCreationTime = totalWorkers > 0 ? this.totalCreationTime / totalWorkers : 0;
    const firstTaskCount = Array.from(this.workerStates.values()).filter(
      (s) => s.firstTaskExecutedAt !== undefined
    ).length;
    const avgFirstTaskLatency =
      firstTaskCount > 0 ? this.totalFirstTaskLatency / firstTaskCount : 0;

    return {
      totalWorkersCreated: totalWorkers,
      warmedWorkers: warmedCount,
      coldStartWorkers: coldStartCount,
      coreWorkersActive: this.coreWorkerIds.size,
      avgCreationTime,
      avgFirstTaskLatency,
      preCreationExecutions: this.preCreationExecutions,
      idlePreCreations: this.idlePreCreations,
    };
  }

  /**
   * Get warmup state for a specific worker
   *
   * @param workerId - Worker ID
   * @returns Worker warmup state or undefined if not found
   */
  getWorkerState(workerId: string): WorkerWarmupState | undefined {
    return this.workerStates.get(workerId);
  }

  /**
   * Get all worker states
   *
   * @returns Map of worker ID to warmup state
   */
  getAllWorkerStates(): ReadonlyMap<string, WorkerWarmupState> {
    return this.workerStates;
  }

  /**
   * Clear idle monitoring
   */
  private clearIdleMonitoring(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = undefined;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.clearIdleMonitoring();
    this.workerStates.clear();
    this.coreWorkerIds.clear();
    this.disposed = true;
    this.removeAllListeners();
  }
}
