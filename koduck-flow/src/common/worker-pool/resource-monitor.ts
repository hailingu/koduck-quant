/**
 * Resource Monitor - Worker Pool Resource Usage Monitoring
 *
 * Implements comprehensive resource monitoring for Worker Pool including:
 *
 * - **Memory Monitoring**: Track worker memory usage and aggregate pool memory
 * - **CPU Monitoring**: Estimate CPU utilization based on task execution times
 * - **Resource Limits**: Set thresholds and trigger alerts when limits exceeded
 * - **Trend Analysis**: Track historical resource usage for predictive scaling
 * - **Alert System**: Emit events when resource thresholds are exceeded
 * - **Auto-Scaling Integration**: Provide resource data for scaling decisions
 *
 * ## Resource Metrics
 *
 * For each worker, tracks:
 * - **Memory Usage**: Current memory consumption (MB)
 * - **Peak Memory**: Maximum memory reached
 * - **CPU Time**: Cumulative task execution time
 * - **CPU Utilization**: Estimated utilization percentage
 *
 * ## Trend Analysis
 *
 * - **Historical Snapshots**: Periodic snapshots of resource metrics
 * - **Moving Averages**: Calculate trends over time windows
 * - **Resource Pressure**: Aggregate pressure metric combining memory and CPU
 * - **Projection**: Estimate future resource needs
 *
 * @module ResourceMonitor
 * @see {@link ResourceMonitor}
 * @see {@link ResourceMonitorConfig}
 *
 * @example
 * ```typescript
 * const monitor = new ResourceMonitor({
 *   enableMemoryMonitoring: true,
 *   memoryLimitMB: 1024,
 *   memoryWarningMB: 800,
 *   enableCPUMonitoring: true,
 *   cpuWarningPercent: 80,
 * });
 *
 * // Subscribe to resource alerts
 * monitor.on('resource:memory-warning', (workerId, usage) => {
 *   console.log(`Worker ${workerId} memory warning: ${usage}MB`);
 * });
 *
 * monitor.on('resource:memory-critical', (workerId, usage) => {
 *   console.log(`Worker ${workerId} memory critical: ${usage}MB`);
 *   // Trigger worker termination or restart
 * });
 *
 * // Record resource usage
 * monitor.recordMemoryUsage(workerId, memoryMB);
 * monitor.recordCPUTime(workerId, taskDurationMs);
 *
 * // Get resource statistics
 * const stats = monitor.getResourceStatistics();
 * console.log('Total pool memory:', stats.totalMemoryUsage);
 *
 * // Get trend analysis
 * const trends = monitor.getTrendAnalysis();
 * console.log('Memory trend:', trends.memoryTrend);
 * ```
 */

import { EventEmitter } from "../event/browser-event-emitter";
import type { IDisposable } from "../disposable";

/**
 * Resource usage data for a worker
 *
 * @interface WorkerResourceUsage
 */
export interface WorkerResourceUsage {
  /** Worker ID */
  workerId: string;
  /** Current memory usage in MB */
  memoryUsage: number;
  /** Peak memory usage in MB */
  peakMemory: number;
  /** Cumulative CPU time in ms */
  cpuTime: number;
  /** Number of tasks processed */
  taskCount: number;
  /** Estimated CPU utilization (0-1) */
  cpuUtilization: number;
  /** Last update timestamp */
  lastUpdate: number;
}

/**
 * Historical resource snapshot
 *
 * @interface ResourceSnapshot
 */
export interface ResourceSnapshot {
  /** Snapshot timestamp */
  timestamp: number;
  /** Total pool memory usage */
  totalMemory: number;
  /** Average memory per worker */
  avgMemory: number;
  /** Peak memory recorded */
  peakMemory: number;
  /** Average CPU utilization */
  avgCPUUtilization: number;
  /** Number of active workers */
  activeWorkerCount: number;
}

/**
 * Resource trend analysis
 *
 * @interface ResourceTrend
 */
export interface ResourceTrend {
  /** Memory usage trend (positive = increasing) */
  memoryTrend: number;
  /** CPU utilization trend */
  cpuTrend: number;
  /** Projected memory usage in 1 minute */
  projectedMemory: number;
  /** Resource pressure metric (0-1) */
  resourcePressure: number;
  /** Recommendation for scaling action */
  scalingRecommendation: "scale-up" | "scale-down" | "none";
}

/**
 * Resource monitor configuration
 *
 * @interface ResourceMonitorConfig
 */
export interface ResourceMonitorConfig {
  /** Enable memory monitoring */
  enableMemoryMonitoring: boolean;
  /** Memory usage warning threshold (MB) */
  memoryWarningMB: number;
  /** Memory usage critical threshold (MB) */
  memoryCriticalMB: number;
  /** Memory limit for pool (MB) */
  memoryLimitMB: number;
  /** Enable CPU monitoring */
  enableCPUMonitoring: boolean;
  /** CPU utilization warning threshold (0-100) */
  cpuWarningPercent: number;
  /** CPU utilization critical threshold (0-100) */
  cpuCriticalPercent: number;
  /** Enable trend analysis */
  enableTrendAnalysis: boolean;
  /** Snapshot interval for trend analysis (ms) */
  snapshotInterval: number;
  /** Maximum snapshots to retain */
  maxSnapshots: number;
  /** Time window for trend calculation (ms) */
  trendWindow: number;
}

/**
 * Default resource monitor configuration
 */
const DEFAULT_CONFIG: ResourceMonitorConfig = {
  enableMemoryMonitoring: true,
  memoryWarningMB: 512,
  memoryCriticalMB: 1024,
  memoryLimitMB: 2048,
  enableCPUMonitoring: true,
  cpuWarningPercent: 80,
  cpuCriticalPercent: 95,
  enableTrendAnalysis: true,
  snapshotInterval: 10000, // 10 seconds
  maxSnapshots: 360, // Keep 1 hour at 10s intervals
  trendWindow: 60000, // 1 minute window for trend
};

/**
 * ResourceMonitor - Comprehensive resource usage monitoring for Worker Pool
 *
 * Tracks and analyzes worker resource usage (memory, CPU) and provides
 * alerts when thresholds are exceeded. Supports trend analysis for
 * predictive scaling decisions.
 *
 * @class ResourceMonitor
 * @augments EventEmitter
 * @implements {IDisposable}
 *
 * Events emitted:
 * - resource:memory-warning - Memory usage warning
 * - resource:memory-critical - Memory usage critical
 * - resource:memory-recovered - Memory usage recovered
 * - resource:cpu-warning - CPU utilization warning
 * - resource:cpu-critical - CPU utilization critical
 * - resource:cpu-recovered - CPU utilization recovered
 * - resource:pressure-high - Overall resource pressure high
 * - resource:snapshot - Resource snapshot captured
 */
export class ResourceMonitor extends EventEmitter implements IDisposable {
  private readonly config: ResourceMonitorConfig;

  // Resource tracking
  private readonly workerResources = new Map<string, WorkerResourceUsage>();
  private readonly workerMemoryWarnings = new Set<string>();
  private readonly workerCPUWarnings = new Set<string>();

  // Trend tracking
  private readonly snapshots: ResourceSnapshot[] = [];
  private snapshotTimer?: NodeJS.Timeout | undefined;

  private disposed = false;

  /**
   * Create a new ResourceMonitor instance
   *
   * @param config - Resource monitor configuration
   */
  constructor(config: Partial<ResourceMonitorConfig> = {}) {
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
    if (this.config.memoryWarningMB < 0) {
      throw new Error("memoryWarningMB must be >= 0");
    }
    if (this.config.memoryCriticalMB < this.config.memoryWarningMB) {
      throw new Error("memoryCriticalMB must be >= memoryWarningMB");
    }
    if (this.config.memoryLimitMB < this.config.memoryCriticalMB) {
      throw new Error("memoryLimitMB must be >= memoryCriticalMB");
    }
    if (this.config.cpuWarningPercent < 0 || this.config.cpuWarningPercent > 100) {
      throw new Error("cpuWarningPercent must be between 0 and 100");
    }
    if (
      this.config.cpuCriticalPercent < this.config.cpuWarningPercent ||
      this.config.cpuCriticalPercent > 100
    ) {
      throw new Error("cpuCriticalPercent must be between cpuWarningPercent and 100");
    }
    if (this.config.snapshotInterval <= 0) {
      throw new Error("snapshotInterval must be > 0");
    }
    if (this.config.maxSnapshots < 1) {
      throw new Error("maxSnapshots must be >= 1");
    }
  }

  /**
   * Start resource trend monitoring
   *
   * Begins periodic snapshot collection for trend analysis.
   */
  startTrendMonitoring(): void {
    this.assertNotDisposed();

    if (!this.config.enableTrendAnalysis || this.snapshotTimer) {
      return;
    }

    // Take initial snapshot
    this.captureSnapshot();

    // Schedule periodic snapshots
    this.snapshotTimer = setInterval(() => {
      this.captureSnapshot();
    }, this.config.snapshotInterval);
  }

  /**
   * Stop resource trend monitoring
   */
  stopTrendMonitoring(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  /**
   * Capture a resource snapshot
   *
   * @internal
   */
  private captureSnapshot(): void {
    const workers = Array.from(this.workerResources.values());

    if (workers.length === 0) {
      return;
    }

    const totalMemory = workers.reduce((sum, w) => sum + w.memoryUsage, 0);
    const avgMemory = totalMemory / workers.length;
    const peakMemory = Math.max(...workers.map((w) => w.peakMemory));
    const avgCPUUtilization =
      workers.reduce((sum, w) => sum + w.cpuUtilization, 0) / workers.length;

    const snapshot: ResourceSnapshot = {
      timestamp: Date.now(),
      totalMemory,
      avgMemory,
      peakMemory,
      avgCPUUtilization,
      activeWorkerCount: workers.length,
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    this.emit("resource:snapshot", snapshot);
  }

  /**
   * Record memory usage for a worker
   *
   * @param workerId - Worker ID
   * @param memoryMB - Memory usage in MB
   */
  recordMemoryUsage(workerId: string, memoryMB: number): void {
    this.assertNotDisposed();

    if (!this.config.enableMemoryMonitoring) {
      return;
    }

    let resource = this.workerResources.get(workerId);
    if (resource) {
      resource.memoryUsage = memoryMB;
      resource.lastUpdate = Date.now();
      if (memoryMB > resource.peakMemory) {
        resource.peakMemory = memoryMB;
      }
    } else {
      resource = {
        workerId,
        memoryUsage: memoryMB,
        peakMemory: memoryMB,
        cpuTime: 0,
        taskCount: 0,
        cpuUtilization: 0,
        lastUpdate: Date.now(),
      };
      this.workerResources.set(workerId, resource);
    }

    // Check memory thresholds
    this.checkMemoryThresholds(workerId, memoryMB);
  }

  /**
   * Check memory usage thresholds and emit alerts
   *
   * @internal
   */
  private checkMemoryThresholds(workerId: string, memoryMB: number): void {
    const wasCritical = this.workerMemoryWarnings.has(workerId);

    if (memoryMB >= this.config.memoryCriticalMB) {
      if (!wasCritical) {
        this.workerMemoryWarnings.add(workerId);
        this.emit("resource:memory-critical", workerId, memoryMB);
      }
    } else if (memoryMB >= this.config.memoryWarningMB) {
      if (!this.workerMemoryWarnings.has(workerId)) {
        this.workerMemoryWarnings.add(workerId);
        this.emit("resource:memory-warning", workerId, memoryMB);
      }
    } else if (wasCritical) {
      // Recovered below warning threshold
      this.workerMemoryWarnings.delete(workerId);
      this.emit("resource:memory-recovered", workerId, memoryMB);
    }
  }

  /**
   * Record CPU time (task execution duration) for a worker
   *
   * @param workerId - Worker ID
   * @param durationMs - Task execution duration in ms
   */
  recordCPUTime(workerId: string, durationMs: number): void {
    this.assertNotDisposed();

    if (!this.config.enableCPUMonitoring) {
      return;
    }

    let resource = this.workerResources.get(workerId);
    if (resource) {
      resource.cpuTime += durationMs;
      resource.taskCount++;
      resource.lastUpdate = Date.now();
    } else {
      resource = {
        workerId,
        memoryUsage: 0,
        peakMemory: 0,
        cpuTime: durationMs,
        taskCount: 1,
        cpuUtilization: 0,
        lastUpdate: Date.now(),
      };
      this.workerResources.set(workerId, resource);
    }

    // Update CPU utilization estimate
    this.updateCPUUtilization(workerId);

    // Check CPU thresholds
    this.checkCPUThresholds(workerId);
  }

  /**
   * Update CPU utilization estimate
   *
   * @internal
   */
  private updateCPUUtilization(workerId: string): void {
    const resource = this.workerResources.get(workerId);
    if (!resource || resource.taskCount === 0) {
      return;
    }

    // Estimate utilization based on average task time vs. monitoring window
    const avgTaskTime = resource.cpuTime / resource.taskCount;
    const baseWindow = this.config.snapshotInterval || 10000;

    // Assume tasks arrive uniformly, utilization = avg task time / sampling window
    resource.cpuUtilization = Math.min(1, avgTaskTime / baseWindow);
  }

  /**
   * Check CPU utilization thresholds and emit alerts
   *
   * @internal
   */
  private checkCPUThresholds(workerId: string): void {
    const resource = this.workerResources.get(workerId);
    if (!resource) {
      return;
    }

    const utilPercent = resource.cpuUtilization * 100;
    const wasCritical = this.workerCPUWarnings.has(workerId);

    if (utilPercent >= this.config.cpuCriticalPercent) {
      if (!wasCritical) {
        this.workerCPUWarnings.add(workerId);
        this.emit("resource:cpu-critical", workerId, utilPercent);
      }
    } else if (utilPercent >= this.config.cpuWarningPercent) {
      if (!this.workerCPUWarnings.has(workerId)) {
        this.workerCPUWarnings.add(workerId);
        this.emit("resource:cpu-warning", workerId, utilPercent);
      }
    } else if (wasCritical) {
      // Recovered below warning threshold
      this.workerCPUWarnings.delete(workerId);
      this.emit("resource:cpu-recovered", workerId, utilPercent);
    }
  }

  /**
   * Get resource statistics snapshot
   *
   * @returns Current resource usage statistics
   */
  getResourceStatistics(): {
    totalMemoryUsage: number;
    avgMemoryPerWorker: number;
    peakMemoryUsage: number;
    workerCount: number;
    totalCPUTime: number;
    avgCPUUtilization: number;
    memoryPressure: number;
  } {
    const workers = Array.from(this.workerResources.values());

    if (workers.length === 0) {
      return {
        totalMemoryUsage: 0,
        avgMemoryPerWorker: 0,
        peakMemoryUsage: 0,
        workerCount: 0,
        totalCPUTime: 0,
        avgCPUUtilization: 0,
        memoryPressure: 0,
      };
    }

    const totalMemory = workers.reduce((sum, w) => sum + w.memoryUsage, 0);
    const avgMemory = totalMemory / workers.length;
    const peakMemory = Math.max(...workers.map((w) => w.peakMemory));
    const totalCPUTime = workers.reduce((sum, w) => sum + w.cpuTime, 0);
    const avgCPUUtilization =
      workers.reduce((sum, w) => sum + w.cpuUtilization, 0) / workers.length;

    // Memory pressure: ratio of current to limit
    const memoryPressure = Math.min(1, totalMemory / this.config.memoryLimitMB);

    return {
      totalMemoryUsage: totalMemory,
      avgMemoryPerWorker: avgMemory,
      peakMemoryUsage: peakMemory,
      workerCount: workers.length,
      totalCPUTime,
      avgCPUUtilization,
      memoryPressure,
    };
  }

  /**
   * Get trend analysis based on historical snapshots
   *
   * @returns Trend analysis with recommendations
   */
  getTrendAnalysis(): ResourceTrend {
    if (this.snapshots.length < 2) {
      return {
        memoryTrend: 0,
        cpuTrend: 0,
        projectedMemory: 0,
        resourcePressure: 0,
        scalingRecommendation: "none",
      };
    }

    // Filter snapshots within trend window
    const now = Date.now();
    const recentSnapshots = this.snapshots.filter(
      (s) => now - s.timestamp <= this.config.trendWindow
    );

    if (recentSnapshots.length < 2) {
      return {
        memoryTrend: 0,
        cpuTrend: 0,
        projectedMemory: 0,
        resourcePressure: 0,
        scalingRecommendation: "none",
      };
    }

    // Calculate linear trend for memory
    const memoryTrend = this.calculateTrend(recentSnapshots.map((s) => s.totalMemory));
    const cpuTrend = this.calculateTrend(recentSnapshots.map((s) => s.avgCPUUtilization));

    // Project memory usage (linear extrapolation)
    const projectedMemory = (recentSnapshots.at(-1)?.totalMemory ?? 0) + memoryTrend;

    // Calculate overall resource pressure
    const currentStats = this.getResourceStatistics();
    const resourcePressure = (currentStats.memoryPressure + currentStats.avgCPUUtilization) / 2;

    // Determine scaling recommendation
    let scalingRecommendation: "scale-up" | "scale-down" | "none" = "none";
    if (projectedMemory > this.config.memoryLimitMB * 0.8 || memoryTrend > 10) {
      scalingRecommendation = "scale-up";
    } else if (resourcePressure < 0.3 && cpuTrend < -0.05) {
      scalingRecommendation = "scale-down";
    }

    return {
      memoryTrend,
      cpuTrend,
      projectedMemory,
      resourcePressure,
      scalingRecommendation,
    };
  }

  /**
   * Calculate linear trend from values
   *
   * @internal
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    // Simple linear regression: trend = (last - first) / count
    const first = values[0];
    const last = values.at(-1) ?? values[0];
    return (last - first) / Math.max(1, values.length - 1);
  }

  /**
   * Get resource usage for specific worker
   *
   * @param workerId - Worker ID
   * @returns Worker resource usage or undefined if not found
   */
  getWorkerResourceUsage(workerId: string): WorkerResourceUsage | undefined {
    return this.workerResources.get(workerId);
  }

  /**
   * Get all worker resource usage data
   *
   * @returns Map of worker ID to resource usage
   */
  getAllWorkerResourceUsage(): ReadonlyMap<string, WorkerResourceUsage> {
    return this.workerResources;
  }

  /**
   * Remove worker from tracking
   *
   * @param workerId - Worker ID to remove
   */
  removeWorker(workerId: string): void {
    this.workerResources.delete(workerId);
    this.workerMemoryWarnings.delete(workerId);
    this.workerCPUWarnings.delete(workerId);
  }

  /**
   * Clear all tracked data
   */
  clearData(): void {
    this.workerResources.clear();
    this.workerMemoryWarnings.clear();
    this.workerCPUWarnings.clear();
    this.snapshots.length = 0;
  }

  /**
   * Get all historical snapshots
   *
   * @returns Array of resource snapshots
   */
  getSnapshots(): readonly ResourceSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stopTrendMonitoring();
    this.workerResources.clear();
    this.workerMemoryWarnings.clear();
    this.workerCPUWarnings.clear();
    this.snapshots.length = 0;
    this.disposed = true;
    this.removeAllListeners();
  }

  /**
   * Assert that monitor is not disposed
   *
   * @internal
   * @throws {Error} If monitor is disposed
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error("ResourceMonitor has been disposed");
    }
  }
}
