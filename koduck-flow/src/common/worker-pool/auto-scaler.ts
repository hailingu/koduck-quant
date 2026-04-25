/**
 * AutoScaler - Dynamic Worker Pool Auto-scaling System
 *
 * Automatically adjusts worker pool size based on load metrics including:
 * - Queue length monitoring
 * - Worker utilization tracking
 * - Task wait time analysis
 *
 * ## Features
 *
 * **Load Monitoring**:
 * - Real-time queue length tracking
 * - Worker utilization calculation
 * - Task wait time measurement
 * - Configurable monitoring intervals
 *
 * **Scaling Decisions**:
 * - Intelligent scale-up conditions (high queue, high utilization)
 * - Smart scale-down conditions (low queue, low utilization)
 * - Configurable threshold-based decisions
 * - Adaptive scaling magnitude calculation
 *
 * **Cooldown Mechanism**:
 * - Prevents rapid scaling oscillations
 * - Separate cooldown periods for scale-up and scale-down
 * - Configurable cooldown durations
 *
 * **Safety Limits**:
 * - Enforces minimum worker count (minWorkers)
 * - Enforces maximum worker count (maxWorkers)
 * - Prevents over-aggressive scaling
 *
 * @module AutoScaler
 * @see {@link AutoScaler}
 * @see {@link AutoScalerConfig}
 *
 * @example
 * ```typescript
 * // Create auto-scaler
 * const scaler = new AutoScaler({
 *   minWorkers: 2,
 *   maxWorkers: 10,
 *   scaleUpThreshold: 0.8,
 *   scaleDownThreshold: 0.2,
 *   checkInterval: 5000
 * }, poolCore, metrics);
 *
 * // Start auto-scaling
 * scaler.start();
 *
 * // Check status
 * const status = scaler.getStatus();
 * console.log('Scaling active:', status.isRunning);
 *
 * // Stop auto-scaling
 * scaler.stop();
 * ```
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { PoolMetrics } from "./pool-metrics";
import type { IDisposable } from "../disposable";

/**
 * Configuration options for AutoScaler
 *
 * @interface AutoScalerConfig
 * @property minWorkers - Minimum number of workers to maintain
 * @property maxWorkers - Maximum number of workers allowed
 * @property scaleUpThreshold - Utilization threshold to trigger scale-up (0-1)
 * @property scaleDownThreshold - Utilization threshold to trigger scale-down (0-1)
 * @property queueLengthThreshold - Queue length threshold for scale-up
 * @property checkInterval - Interval between scaling checks (ms)
 * @property cooldownPeriod - Cooldown period after scaling operation (ms)
 * @property scaleUpStep - Number of workers to add during scale-up
 * @property scaleDownStep - Number of workers to remove during scale-down
 */
export interface AutoScalerConfig {
  /** Minimum worker count */
  minWorkers: number;
  /** Maximum worker count */
  maxWorkers: number;
  /** Worker utilization threshold for scale-up (0-1) */
  scaleUpThreshold: number;
  /** Worker utilization threshold for scale-down (0-1) */
  scaleDownThreshold: number;
  /** Queue length threshold for scale-up */
  queueLengthThreshold: number;
  /** Monitoring check interval (ms) */
  checkInterval: number;
  /** Cooldown period after scaling (ms) */
  cooldownPeriod: number;
  /** Workers to add during scale-up */
  scaleUpStep: number;
  /** Workers to remove during scale-down */
  scaleDownStep: number;
}

/**
 * Load metrics snapshot for scaling decisions
 *
 * @interface LoadMetrics
 * @property utilization - Current worker utilization (0-1)
 * @property queueLength - Current queue length
 * @property avgWaitTime - Average task wait time (ms)
 * @property totalWorkers - Total number of workers
 * @property activeWorkers - Number of active workers
 * @property idleWorkers - Number of idle workers
 */
export interface LoadMetrics {
  /** Worker utilization ratio */
  utilization: number;
  /** Current queue length */
  queueLength: number;
  /** Average wait time in ms */
  avgWaitTime: number;
  /** Total worker count */
  totalWorkers: number;
  /** Active worker count */
  activeWorkers: number;
  /** Idle worker count */
  idleWorkers: number;
}

/**
 * Scaling decision result
 *
 * @interface ScalingDecision
 * @property action - Scaling action to take
 * @property magnitude - Number of workers to add/remove
 * @property reason - Reason for the decision
 */
export interface ScalingDecision {
  /** Scaling action */
  action: "scale-up" | "scale-down" | "no-change";
  /** Number of workers to scale */
  magnitude: number;
  /** Reason for decision */
  reason: string;
}

/**
 * AutoScaler status information
 *
 * @interface AutoScalerStatus
 * @property isRunning - Whether auto-scaling is active
 * @property isPaused - Whether auto-scaling is paused
 * @property lastScaleTime - Timestamp of last scaling operation
 * @property lastScaleAction - Last scaling action taken
 * @property inCooldown - Whether currently in cooldown period
 * @property cooldownRemaining - Remaining cooldown time (ms)
 */
export interface AutoScalerStatus {
  /** Auto-scaling active */
  isRunning: boolean;
  /** Auto-scaling paused */
  isPaused: boolean;
  /** Last scale timestamp */
  lastScaleTime: number;
  /** Last scale action */
  lastScaleAction: "scale-up" | "scale-down" | "none";
  /** In cooldown period */
  inCooldown: boolean;
  /** Cooldown time remaining in ms */
  cooldownRemaining: number;
}

/**
 * WorkerPoolCore interface for scaling operations
 * This interface defines the contract for worker pool operations
 */
export interface IWorkerPoolCore {
  /** Get total worker count */
  getWorkerCount(): number;
  /** Get active worker count */
  getActiveWorkerCount(): number;
  /** Get idle worker count */
  getIdleWorkerCount(): number;
  /** Scale up by adding workers */
  scaleUp(count: number): Promise<void>;
  /** Scale down by removing workers */
  scaleDown(count: number): Promise<void>;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: AutoScalerConfig = {
  minWorkers: 1,
  maxWorkers: 10,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.2,
  queueLengthThreshold: 10,
  checkInterval: 5000,
  cooldownPeriod: 30000,
  scaleUpStep: 1,
  scaleDownStep: 1,
};

/**
 * AutoScaler - Automatically scales worker pool based on load
 *
 * Monitors pool metrics and dynamically adjusts worker count to maintain
 * optimal performance. Implements cooldown mechanisms to prevent oscillation.
 *
 * @class AutoScaler
 * @augments EventEmitter
 * @implements {IDisposable}
 *
 * @fires AutoScaler#scale-up - Emitted when scaling up workers
 * @fires AutoScaler#scale-down - Emitted when scaling down workers
 * @fires AutoScaler#error - Emitted when scaling operation fails
 *
 * @example
 * ```typescript
 * const scaler = new AutoScaler(config, poolCore, metrics);
 *
 * scaler.on('scale-up', (count) => {
 *   console.log(`Scaled up by ${count} workers`);
 * });
 *
 * scaler.start();
 * ```
 */
export class AutoScaler extends EventEmitter implements IDisposable {
  private readonly config: AutoScalerConfig;
  private readonly poolCore: IWorkerPoolCore;
  private readonly metrics: PoolMetrics;

  private isRunning = false;
  private isPaused = false;
  private checkTimer?: NodeJS.Timeout | undefined;
  private lastScaleTime = 0;
  private lastScaleAction: "scale-up" | "scale-down" | "none" = "none";
  private disposed = false;

  /**
   * Create a new AutoScaler instance
   *
   * @param config - Auto-scaler configuration
   * @param poolCore - Worker pool core for scaling operations
   * @param metrics - Pool metrics for load monitoring
   */
  constructor(config: Partial<AutoScalerConfig>, poolCore: IWorkerPoolCore, metrics: PoolMetrics) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.poolCore = poolCore;
    this.metrics = metrics;

    this.validateConfig();
  }

  /**
   * Validate configuration parameters
   *
   * @throws {Error} If configuration is invalid
   */
  private validateConfig(): void {
    const { minWorkers, maxWorkers, scaleUpThreshold, scaleDownThreshold } = this.config;

    if (minWorkers < 0) {
      throw new Error("minWorkers must be >= 0");
    }
    if (maxWorkers < minWorkers) {
      throw new Error("maxWorkers must be >= minWorkers");
    }
    if (scaleUpThreshold <= 0 || scaleUpThreshold > 1) {
      throw new Error("scaleUpThreshold must be between 0 and 1");
    }
    if (scaleDownThreshold < 0 || scaleDownThreshold >= 1) {
      throw new Error("scaleDownThreshold must be between 0 and 1");
    }
    if (scaleDownThreshold >= scaleUpThreshold) {
      throw new Error("scaleDownThreshold must be < scaleUpThreshold");
    }
  }

  /**
   * Start auto-scaling loop
   *
   * Begins monitoring pool metrics and making scaling decisions
   * at configured intervals.
   */
  start(): void {
    if (this.disposed) {
      throw new Error("AutoScaler has been disposed");
    }
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.scheduleNextCheck();
    this.emit("started");
  }

  /**
   * Stop auto-scaling loop
   *
   * Stops monitoring and clears any scheduled checks.
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isPaused = false;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = undefined;
    }
    this.emit("stopped");
  }

  /**
   * Pause auto-scaling temporarily
   *
   * Keeps the loop running but skips scaling decisions.
   */
  pause(): void {
    if (!this.isRunning || this.isPaused) {
      return;
    }
    this.isPaused = true;
    this.emit("paused");
  }

  /**
   * Resume auto-scaling after pause
   */
  resume(): void {
    if (!this.isRunning || !this.isPaused) {
      return;
    }
    this.isPaused = false;
    this.emit("resumed");
  }

  /**
   * Get current auto-scaler status
   *
   * @returns Current status information
   */
  getStatus(): AutoScalerStatus {
    const now = Date.now();
    const timeSinceLastScale = now - this.lastScaleTime;
    const inCooldown = timeSinceLastScale < this.config.cooldownPeriod;
    const cooldownRemaining = inCooldown ? this.config.cooldownPeriod - timeSinceLastScale : 0;

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      lastScaleTime: this.lastScaleTime,
      lastScaleAction: this.lastScaleAction,
      inCooldown,
      cooldownRemaining,
    };
  }

  /**
   * Schedule next scaling check
   */
  private scheduleNextCheck(): void {
    if (!this.isRunning) {
      return;
    }

    this.checkTimer = setTimeout(() => {
      this.performScalingCheck().catch((error) => {
        this.emit("error", error);
      });
      this.scheduleNextCheck();
    }, this.config.checkInterval);
  }

  /**
   * Perform scaling check and make decisions
   */
  private async performScalingCheck(): Promise<void> {
    if (this.isPaused) {
      return;
    }

    // Check cooldown period
    if (this.isInCooldown()) {
      return;
    }

    // Collect load metrics
    const loadMetrics = this.collectLoadMetrics();

    // Make scaling decision
    const decision = this.makeScalingDecision(loadMetrics);

    // Execute scaling action
    if (decision.action !== "no-change") {
      await this.executeScaling(decision, loadMetrics);
    }
  }

  /**
   * Check if currently in cooldown period
   *
   * @returns True if in cooldown
   */
  private isInCooldown(): boolean {
    if (this.lastScaleTime === 0) {
      return false;
    }
    const timeSinceLastScale = Date.now() - this.lastScaleTime;
    return timeSinceLastScale < this.config.cooldownPeriod;
  }

  /**
   * Collect current load metrics from pool
   *
   * @returns Load metrics snapshot
   */
  private collectLoadMetrics(): LoadMetrics {
    const snapshot = this.metrics.getSnapshot();

    return {
      utilization: snapshot.utilization,
      queueLength: snapshot.queueLength,
      avgWaitTime: snapshot.avgResponseTime, // Using avgResponseTime as proxy for wait time
      totalWorkers: snapshot.totalWorkers,
      activeWorkers: snapshot.activeWorkers,
      idleWorkers: snapshot.idleWorkers,
    };
  }

  /**
   * Make scaling decision based on load metrics
   *
   * @param metrics - Current load metrics
   * @returns Scaling decision
   */
  private makeScalingDecision(metrics: LoadMetrics): ScalingDecision {
    const { scaleUpThreshold, scaleDownThreshold, queueLengthThreshold, minWorkers, maxWorkers } =
      this.config;

    // Check scale-up conditions
    const shouldScaleUp =
      metrics.utilization > scaleUpThreshold || metrics.queueLength > queueLengthThreshold;

    if (shouldScaleUp && metrics.totalWorkers < maxWorkers) {
      const magnitude = this.calculateScaleUpMagnitude(metrics);
      const reason = this.buildScaleUpReason(metrics);
      return { action: "scale-up", magnitude, reason };
    }

    // Check scale-down conditions
    const shouldScaleDown = metrics.utilization < scaleDownThreshold && metrics.queueLength === 0;

    if (shouldScaleDown && metrics.totalWorkers > minWorkers) {
      const magnitude = this.calculateScaleDownMagnitude(metrics);
      const reason = this.buildScaleDownReason(metrics);
      return { action: "scale-down", magnitude, reason };
    }

    return {
      action: "no-change",
      magnitude: 0,
      reason: "Load within acceptable range",
    };
  }

  /**
   * Calculate scale-up magnitude based on load
   *
   * @param metrics - Current load metrics
   * @returns Number of workers to add
   */
  private calculateScaleUpMagnitude(metrics: LoadMetrics): number {
    const { scaleUpStep, maxWorkers } = this.config;
    const availableCapacity = maxWorkers - metrics.totalWorkers;

    // Use configured step size, capped by available capacity
    return Math.min(scaleUpStep, availableCapacity);
  }

  /**
   * Calculate scale-down magnitude based on load
   *
   * @param metrics - Current load metrics
   * @returns Number of workers to remove
   */
  private calculateScaleDownMagnitude(metrics: LoadMetrics): number {
    const { scaleDownStep, minWorkers } = this.config;
    const excessWorkers = metrics.totalWorkers - minWorkers;

    // Use configured step size, capped by excess workers
    return Math.min(scaleDownStep, excessWorkers);
  }

  /**
   * Build reason string for scale-up decision
   *
   * @param metrics - Current load metrics
   * @returns Reason string
   */
  private buildScaleUpReason(metrics: LoadMetrics): string {
    const reasons: string[] = [];

    if (metrics.utilization > this.config.scaleUpThreshold) {
      reasons.push(`high utilization (${(metrics.utilization * 100).toFixed(1)}%)`);
    }
    if (metrics.queueLength > this.config.queueLengthThreshold) {
      reasons.push(`queue length (${metrics.queueLength})`);
    }

    return `Scale up due to ${reasons.join(", ")}`;
  }

  /**
   * Build reason string for scale-down decision
   *
   * @param metrics - Current load metrics
   * @returns Reason string
   */
  private buildScaleDownReason(metrics: LoadMetrics): string {
    return `Scale down due to low utilization (${(metrics.utilization * 100).toFixed(1)}%) and empty queue`;
  }

  /**
   * Execute scaling operation
   *
   * @param decision - Scaling decision
   * @param metrics - Current load metrics
   */
  private async executeScaling(decision: ScalingDecision, metrics: LoadMetrics): Promise<void> {
    try {
      if (decision.action === "scale-up") {
        await this.poolCore.scaleUp(decision.magnitude);
        this.lastScaleAction = "scale-up";
        this.lastScaleTime = Date.now();
        this.emit("scale-up", decision.magnitude, decision.reason, metrics);
      } else if (decision.action === "scale-down") {
        await this.poolCore.scaleDown(decision.magnitude);
        this.lastScaleAction = "scale-down";
        this.lastScaleTime = Date.now();
        this.emit("scale-down", decision.magnitude, decision.reason, metrics);
      }
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stop();
    this.disposed = true;
    this.removeAllListeners();
  }
}
