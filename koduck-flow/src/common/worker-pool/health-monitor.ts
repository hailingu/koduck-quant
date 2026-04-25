/**
 * Health Monitor Module
 *
 * Implements Worker health tracking and monitoring capabilities.
 *
 * ## Responsibilities
 *
 * - **Heartbeat Detection**: Periodic ping/pong mechanism to detect unresponsive workers
 * - **Metrics Collection**: Track response times, memory usage, task failure rates
 * - **Health Evaluation**: Score workers based on collected metrics
 * - **State Classification**: Classify workers as healthy, degraded, or unhealthy
 * - **Event Emission**: Emit health-related events for external listeners
 * - **Recovery Tracking**: Monitor worker recovery from temporary failures
 *
 * ## Health Metrics
 *
 * For each worker, tracks:
 * - **Response Time**: Average execution time and variability
 * - **Memory Usage**: Current and peak memory consumption
 * - **Task Failure Rate**: Percentage of failed tasks
 * - **Success Streak**: Count of consecutive successful tasks
 * - **Last Activity**: Timestamp of last successful task completion
 *
 * ## Health States
 *
 * - **Healthy**: All metrics within acceptable ranges
 * - **Degraded**: Some metrics warning, but still functional
 * - **Unhealthy**: One or more critical metrics exceeded
 * - **Recovering**: Recently became healthy after being unhealthy
 *
 * ## Event Types
 *
 * - `health:checked` - Health check completed
 * - `health:unhealthy` - Worker became unhealthy
 * - `health:recovered` - Worker recovered to healthy state
 * - `health:degraded` - Worker entered degraded state
 *
 * @example
 * ```typescript
 * const monitor = new HealthMonitor(config);
 *
 * // Subscribe to health events
 * monitor.on('health:unhealthy', (workerId, metrics) => {
 *   console.log(`Worker ${workerId} is unhealthy:`, metrics);
 *   // Trigger worker replacement or restart
 * });
 *
 * // Start monitoring
 * await monitor.start();
 *
 * // Update metrics when task completes
 * monitor.recordTaskCompletion(workerId, duration, success);
 *
 * // Update memory usage
 * monitor.recordMemoryUsage(workerId, memoryMB);
 *
 * // Cleanup
 * await monitor.stop();
 * ```
 *
 * @see {@link WorkerPoolCore} for worker lifecycle integration
 * @see {@link TaskScheduler} for task execution integration
 */

import { EventEmitter } from "../event/browser-event-emitter";

/**
 * Health monitor configuration
 */
export interface HealthMonitorConfig {
  /** Interval between health checks (ms), default 5000 */
  checkInterval?: number;

  /** Heartbeat timeout threshold (ms), default 10000 */
  heartbeatTimeout?: number;

  /** Response time warning threshold (ms), default 5000 */
  responseTimeWarning?: number;

  /** Response time critical threshold (ms), default 15000 */
  responseTimeCritical?: number;

  /** Memory usage warning (MB), default 256 */
  memoryWarning?: number;

  /** Memory usage critical (MB), default 512 */
  memoryCritical?: number;

  /** Task failure rate warning (0-1), default 0.1 (10%) */
  failureRateWarning?: number;

  /** Task failure rate critical (0-1), default 0.3 (30%) */
  failureRateCritical?: number;

  /** Time window for metrics calculation (ms), default 60000 */
  metricsWindow?: number;

  /** Minimum sample count before evaluation, default 5 */
  minSamples?: number;

  /** Worker crash detection timeout (ms), default 30000 */
  crashTimeout?: number;

  /** Worker hang detection timeout (ms), default 60000 */
  hangTimeout?: number;

  /** Cooldown period before worker restart (ms), default 5000 */
  restartCooldown?: number;

  /** Zombie worker detection timeout (ms), default 120000 (2 minutes) */
  zombieTimeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Worker health metrics snapshot
 */
export interface WorkerHealthMetrics {
  /** Worker ID */
  workerId: string;

  /** Health score 0-100 */
  score: number;

  /** Health state */
  state: "healthy" | "degraded" | "unhealthy" | "recovering";

  /** Average response time (ms) */
  avgResponseTime: number;

  /** Response time standard deviation (ms) */
  responseTimeStdDev: number;

  /** Peak response time (ms) */
  peakResponseTime: number;

  /** Current memory usage (MB) */
  memoryUsage: number;

  /** Memory usage peak (MB) */
  memoryPeak: number;

  /** Task failure rate (0-1) */
  failureRate: number;

  /** Recent task success count */
  recentSuccesses: number;

  /** Recent task failure count */
  recentFailures: number;

  /** Last successful task time */
  lastSuccessTime?: number;

  /** Last failure time */
  lastFailureTime?: number;

  /** Consecutive success count */
  successStreak: number;

  /** Time in current state (ms) */
  stateTime: number;

  /** Last heartbeat response time */
  lastHeartbeatTime?: number;

  /** Heartbeat response latency (ms) */
  heartbeatLatency?: number;

  /** Consecutive pong failures */
  missedPings: number;

  /** Whether worker is crashed */
  isCrashed: boolean;

  /** Whether worker is hung (unresponsive) */
  isHung: boolean;

  /** Last task start time */
  lastTaskStartTime?: number;

  /** Crash count */
  crashCount: number;

  /** Hang count */
  hangCount: number;

  /** Last activity timestamp (task completion, heartbeat, etc.) */
  lastActiveAt?: number;

  /** Whether worker is zombie (inactive for too long) */
  isZombie: boolean;

  /** Zombie count */
  zombieCount: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Check timestamp */
  timestamp: number;

  /** Worker metrics by ID */
  metrics: Map<string, WorkerHealthMetrics>;

  /** Count of unhealthy workers */
  unhealthyCount: number;

  /** Count of degraded workers */
  degradedCount: number;

  /** Overall pool health percentage */
  poolHealthPercentage: number;
}

/**
 * Internal worker health data
 */
interface WorkerHealthData {
  metrics: WorkerHealthMetrics;
  responseTimes: number[];
  failureTimes: number[];
  memoryHistory: number[];
  lastStateChange: number;
  previousState: WorkerHealthMetrics["state"];
}

/**
 * Health Monitor - Tracks and evaluates worker health
 */
export class HealthMonitor extends EventEmitter {
  private readonly config: Required<HealthMonitorConfig>;
  private readonly healthData = new Map<string, WorkerHealthData>();
  private checkTimer: NodeJS.Timeout | undefined;
  private isRunning = false;

  private readonly defaultConfig: Required<HealthMonitorConfig> = {
    checkInterval: 5000,
    heartbeatTimeout: 10000,
    responseTimeWarning: 5000,
    responseTimeCritical: 15000,
    memoryWarning: 256,
    memoryCritical: 512,
    failureRateWarning: 0.1,
    failureRateCritical: 0.3,
    metricsWindow: 60000,
    minSamples: 5,
    crashTimeout: 30000,
    hangTimeout: 60000,
    restartCooldown: 5000,
    zombieTimeout: 120000,
    debug: false,
  };

  /**
   * Create health monitor instance
   * @param config - Health monitor configuration options
   */
  constructor(config: HealthMonitorConfig = {}) {
    super();
    this.config = { ...this.defaultConfig, ...config } as Required<HealthMonitorConfig>;
  }

  /**
   * Start health monitoring
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runHealthCheck();
  }

  /**
   * Stop health monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  /**
   * Register a worker for health monitoring
   * @param workerId - Worker identifier
   */
  registerWorker(workerId: string): void {
    if (this.healthData.has(workerId)) return;

    const metrics: WorkerHealthMetrics = {
      workerId,
      score: 100,
      state: "healthy",
      avgResponseTime: 0,
      responseTimeStdDev: 0,
      peakResponseTime: 0,
      memoryUsage: 0,
      memoryPeak: 0,
      failureRate: 0,
      recentSuccesses: 0,
      recentFailures: 0,
      successStreak: 0,
      stateTime: Date.now(),
      missedPings: 0,
      isCrashed: false,
      isHung: false,
      crashCount: 0,
      hangCount: 0,
      lastActiveAt: Date.now(),
      isZombie: false,
      zombieCount: 0,
    };

    this.healthData.set(workerId, {
      metrics,
      responseTimes: [],
      failureTimes: [],
      memoryHistory: [],
      lastStateChange: Date.now(),
      previousState: "healthy",
    });
  }

  /**
   * Unregister a worker from monitoring
   * @param workerId - Worker identifier
   */
  unregisterWorker(workerId: string): void {
    this.healthData.delete(workerId);
  }

  /**
   * Record successful task completion
   * @param workerId - Worker identifier
   * @param duration - Task execution duration (ms)
   * @param success - Whether task succeeded
   */
  recordTaskCompletion(workerId: string, duration: number, success: boolean): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    const now = Date.now();

    // Update last active timestamp
    data.metrics.lastActiveAt = now;

    if (success) {
      data.metrics.recentSuccesses++;
      data.metrics.successStreak++;
      data.metrics.lastSuccessTime = now;
      data.responseTimes.push(duration);

      // Keep only recent samples within time window
      data.responseTimes = data.responseTimes.filter(
        (t, i) => data.responseTimes.length - i <= 100 || now - t < this.config.metricsWindow
      );
    } else {
      data.metrics.recentFailures++;
      data.metrics.successStreak = 0;
      data.metrics.lastFailureTime = now;
      data.failureTimes.push(now);

      // Keep only recent failures within time window
      data.failureTimes = data.failureTimes.filter((t) => now - t < this.config.metricsWindow);
    }

    this.updateMetrics(workerId);
  }

  /**
   * Record memory usage for a worker
   * @param workerId - Worker identifier
   * @param memoryMB - Memory usage in MB
   */
  recordMemoryUsage(workerId: string, memoryMB: number): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    data.metrics.memoryUsage = memoryMB;
    data.metrics.memoryPeak = Math.max(data.metrics.memoryPeak, memoryMB);
    data.memoryHistory.push(memoryMB);

    // Keep only recent samples
    data.memoryHistory = data.memoryHistory.slice(-100);
  }

  /**
   * Record successful heartbeat response
   * @param workerId - Worker identifier
   * @param latency - Heartbeat latency (ms)
   */
  recordHeartbeat(workerId: string, latency: number): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    const now = Date.now();
    data.metrics.lastHeartbeatTime = now;
    data.metrics.lastActiveAt = now;
    data.metrics.heartbeatLatency = latency;
    data.metrics.missedPings = 0;
  }

  /**
   * Record missed heartbeat
   * @param workerId - Worker identifier
   */
  recordMissedPing(workerId: string): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    data.metrics.missedPings++;
  }

  /**
   * Record task start for crash/hang detection
   * @param workerId - Worker identifier
   */
  recordTaskStart(workerId: string): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    data.metrics.lastTaskStartTime = Date.now();
    // Reset hung state when new task starts
    if (data.metrics.isHung) {
      data.metrics.isHung = false;
      this.emit("worker:recovered-from-hang", workerId);
    }
  }

  /**
   * Mark worker as crashed
   * @param workerId - Worker identifier
   * @param error - Error that caused the crash
   */
  markWorkerCrashed(workerId: string, error?: Error): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    if (!data.metrics.isCrashed) {
      data.metrics.isCrashed = true;
      data.metrics.crashCount++;
      data.metrics.state = "unhealthy";
      data.metrics.score = 0;

      this.emit("worker:crashed", workerId, error);

      if (this.config.debug) {
        console.debug(`[HealthMonitor] Worker ${workerId} crashed:`, error?.message);
      }
    }
  }

  /**
   * Detect crashed workers
   * Checks for workers that haven't responded in crashTimeout period
   * @returns Array of crashed worker IDs
   */
  detectCrashedWorkers(): string[] {
    const now = Date.now();
    const crashedWorkers: string[] = [];

    for (const [workerId, data] of this.healthData) {
      // Skip if already marked as crashed
      if (data.metrics.isCrashed) continue;

      // Check if worker hasn't sent heartbeat within timeout
      const lastHeartbeat = data.metrics.lastHeartbeatTime;
      if (lastHeartbeat && now - lastHeartbeat > this.config.crashTimeout) {
        this.markWorkerCrashed(workerId);
        crashedWorkers.push(workerId);
      }
    }

    return crashedWorkers;
  }

  /**
   * Detect hung workers
   * Checks for workers stuck on a task for too long
   * @returns Array of hung worker IDs
   */
  detectHungWorkers(): string[] {
    const now = Date.now();
    const hungWorkers: string[] = [];

    for (const [workerId, data] of this.healthData) {
      // Skip if already hung or crashed
      if (data.metrics.isHung || data.metrics.isCrashed) continue;

      // Check if worker has been running a task for too long
      const lastTaskStart = data.metrics.lastTaskStartTime;
      if (lastTaskStart && now - lastTaskStart > this.config.hangTimeout) {
        data.metrics.isHung = true;
        data.metrics.hangCount++;
        data.metrics.state = "unhealthy";
        data.metrics.score = Math.min(data.metrics.score, 20);

        this.emit("worker:hung", workerId);
        hungWorkers.push(workerId);

        if (this.config.debug) {
          console.debug(
            `[HealthMonitor] Worker ${workerId} hung (task running for ${now - lastTaskStart}ms)`
          );
        }
      }
    }

    return hungWorkers;
  }

  /**
   * Check if a worker is failed (crashed or hung)
   * @param workerId - Worker identifier
   * @returns True if worker is crashed or hung
   */
  isWorkerFailed(workerId: string): boolean {
    const data = this.healthData.get(workerId);
    if (!data) return false;

    return data.metrics.isCrashed || data.metrics.isHung;
  }

  /**
   * Get all failed workers
   * @returns Array of failed worker IDs
   */
  getFailedWorkers(): string[] {
    return Array.from(this.healthData.entries())
      .filter(([, data]) => data.metrics.isCrashed || data.metrics.isHung)
      .map(([workerId]) => workerId);
  }

  /**
   * Clear failed state for worker (for recovery)
   * @param workerId - Worker identifier
   */
  clearFailedState(workerId: string): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    data.metrics.isCrashed = false;
    data.metrics.isHung = false;
    delete data.metrics.lastTaskStartTime;
    data.metrics.score = 100;
    data.metrics.state = "healthy";
  }

  /**
   * Detect zombie workers
   * Checks for workers that haven't been active for too long
   * A worker is considered a zombie if it hasn't completed a task, sent a heartbeat,
   * or shown any activity for more than zombieTimeout period
   * @returns Array of zombie worker IDs
   */
  detectZombieWorkers(): string[] {
    const now = Date.now();
    const zombieWorkers: string[] = [];

    for (const [workerId, data] of this.healthData) {
      // Skip if already marked as zombie, crashed, or hung
      if (data.metrics.isZombie || data.metrics.isCrashed || data.metrics.isHung) continue;

      // Check if worker has been inactive for too long
      const lastActive = data.metrics.lastActiveAt;
      if (lastActive && now - lastActive > this.config.zombieTimeout) {
        const inactiveDuration = now - lastActive;
        data.metrics.isZombie = true;
        data.metrics.zombieCount++;
        data.metrics.state = "unhealthy";
        data.metrics.score = 0;

        this.emit("worker:zombie", workerId, inactiveDuration);
        zombieWorkers.push(workerId);

        if (this.config.debug) {
          console.debug(
            `[HealthMonitor] Worker ${workerId} is zombie (inactive for ${inactiveDuration}ms)`
          );
        }
      }
    }

    return zombieWorkers;
  }

  /**
   * Check if a worker is zombie
   * @param workerId - Worker identifier
   * @returns True if worker is zombie
   */
  isWorkerZombie(workerId: string): boolean {
    const data = this.healthData.get(workerId);
    if (!data) return false;

    return data.metrics.isZombie;
  }

  /**
   * Get all zombie workers
   * @returns Array of zombie worker IDs
   */
  getZombieWorkers(): string[] {
    return Array.from(this.healthData.entries())
      .filter(([, data]) => data.metrics.isZombie)
      .map(([workerId]) => workerId);
  }

  /**
   * Clear zombie state for worker (for recovery or removal)
   * @param workerId - Worker identifier
   */
  clearZombieState(workerId: string): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    data.metrics.isZombie = false;
  }

  /**
   * Get metrics for a specific worker
   * @param workerId - Worker identifier
   * @returns Worker health metrics or undefined
   */
  getWorkerMetrics(workerId: string): WorkerHealthMetrics | undefined {
    return this.healthData.get(workerId)?.metrics;
  }

  /**
   * Get health metrics for all workers
   * @returns Map of worker ID to health metrics
   */
  getAllMetrics(): Map<string, WorkerHealthMetrics> {
    const result = new Map<string, WorkerHealthMetrics>();
    for (const [id, data] of this.healthData) {
      result.set(id, data.metrics);
    }
    return result;
  }

  /**
   * Perform a health check cycle
   */
  private runHealthCheck(): void {
    if (!this.isRunning) return;

    this.checkTimer = setTimeout(() => {
      this.performHealthCheck();
      this.runHealthCheck();
    }, this.config.checkInterval);
  }

  /**
   * Execute health check for all workers
   */
  private performHealthCheck(): void {
    const timestamp = Date.now();
    const metrics = new Map<string, WorkerHealthMetrics>();
    let unhealthyCount = 0;
    let degradedCount = 0;

    // Detect crashed, hung, and zombie workers
    this.detectCrashedWorkers();
    this.detectHungWorkers();
    this.detectZombieWorkers();

    for (const [workerId, data] of this.healthData) {
      // Skip health evaluation for failed workers (crashed, hung, or zombie)
      if (!data.metrics.isCrashed && !data.metrics.isHung && !data.metrics.isZombie) {
        this.evaluateWorkerHealth(workerId, data);
      }
      metrics.set(workerId, data.metrics);

      if (data.metrics.state === "unhealthy") {
        unhealthyCount++;
      } else if (data.metrics.state === "degraded") {
        degradedCount++;
      }
    }

    const totalWorkers = this.healthData.size;
    const healthyCount = totalWorkers - unhealthyCount - degradedCount;
    const poolHealthPercentage = totalWorkers > 0 ? (healthyCount / totalWorkers) * 100 : 100;

    const result: HealthCheckResult = {
      timestamp,
      metrics,
      unhealthyCount,
      degradedCount,
      poolHealthPercentage,
    };

    this.emit("health:checked", result);
  }

  /**
   * Evaluate and update health for a single worker
   * @param workerId - Worker identifier
   * @param data - Worker health data to update
   */
  private evaluateWorkerHealth(workerId: string, data: WorkerHealthData): void {
    const metrics = data.metrics;
    const now = Date.now();

    // Calculate response time metrics
    if (data.responseTimes.length >= this.config.minSamples) {
      metrics.avgResponseTime =
        data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length;
      metrics.peakResponseTime = Math.max(...data.responseTimes);

      // Calculate standard deviation
      const variance =
        data.responseTimes.reduce((sum, time) => {
          return sum + Math.pow(time - metrics.avgResponseTime, 2);
        }, 0) / data.responseTimes.length;
      metrics.responseTimeStdDev = Math.sqrt(variance);
    }

    // Calculate failure rate
    const totalTasks = metrics.recentSuccesses + metrics.recentFailures;
    if (totalTasks >= this.config.minSamples) {
      metrics.failureRate = metrics.recentFailures / totalTasks;
    }

    // Update state time
    metrics.stateTime = now - data.lastStateChange;

    // Evaluate health score and state
    const oldState = metrics.state;
    this.calculateHealthScore(metrics);

    // Emit state change events
    if (oldState !== metrics.state) {
      data.previousState = oldState;
      data.lastStateChange = now;

      if (metrics.state === "unhealthy") {
        this.emit("health:unhealthy", workerId, metrics);
      } else if (metrics.state === "degraded") {
        this.emit("health:degraded", workerId, metrics);
      } else if (metrics.state === "healthy" && oldState !== "healthy") {
        this.emit("health:recovered", workerId, metrics);
      }
    }

    if (this.config.debug) {
      console.debug(
        `[HealthMonitor] Worker ${workerId}: score=${metrics.score}, state=${metrics.state}`
      );
    }
  }

  /**
   * Calculate health score and determine state
   * @param metrics - Metrics object to score and classify
   */
  private calculateHealthScore(metrics: WorkerHealthMetrics): void {
    let score = 100;

    // Response time scoring
    if (metrics.avgResponseTime > this.config.responseTimeCritical) {
      score -= 40;
    } else if (metrics.avgResponseTime > this.config.responseTimeWarning) {
      score -= 20;
    }

    // Memory usage scoring
    if (metrics.memoryUsage > this.config.memoryCritical) {
      score -= 30;
    } else if (metrics.memoryUsage > this.config.memoryWarning) {
      score -= 15;
    }

    // Failure rate scoring
    if (metrics.failureRate > this.config.failureRateCritical) {
      score -= 30;
    } else if (metrics.failureRate > this.config.failureRateWarning) {
      score -= 15;
    }

    // Missed ping scoring
    if (metrics.missedPings > 0) {
      score -= Math.min(metrics.missedPings * 5, 25);
    }

    metrics.score = Math.max(0, Math.min(100, score));

    // Determine state based on score
    if (metrics.score >= 80) {
      if (metrics.state === "unhealthy" || metrics.state === "degraded") {
        metrics.state = "recovering";
      } else if (metrics.state === "recovering") {
        metrics.state = "healthy";
      } else {
        metrics.state = "healthy";
      }
    } else if (metrics.score >= 60) {
      metrics.state = "degraded";
    } else {
      metrics.state = "unhealthy";
    }
  }

  /**
   * Update derived metrics for a worker
   * @param workerId - Worker identifier
   */
  private updateMetrics(workerId: string): void {
    const data = this.healthData.get(workerId);
    if (!data) return;

    // Cleanup old data outside metrics window
    const now = Date.now();
    data.responseTimes = data.responseTimes.filter((t, i) => {
      return data.responseTimes.length - i <= 100 || now - t < this.config.metricsWindow;
    });

    data.failureTimes = data.failureTimes.filter((t) => now - t < this.config.metricsWindow);
  }

  /**
   * Get total worker count
   * @returns Number of registered workers
   */
  getWorkerCount(): number {
    return this.healthData.size;
  }

  /**
   * Check if monitor is running
   * @returns True if health monitoring is active
   */
  isMonitoring(): boolean {
    return this.isRunning;
  }
}
