/**
 * Worker Pool Metrics Collection System
 *
 * Provides centralized metrics collection, aggregation, and query functionality
 * for Worker Pool monitoring and observability.
 *
 * ## Features
 *
 * **Metrics Collection**:
 * - Counter metrics: task completion, failures, retries
 * - Gauge metrics: worker count, queue length, utilization
 * - Histogram metrics: task execution time, queue wait time
 * - Automatic metric registration and updates
 *
 * **Metric Aggregation**:
 * - Worker utilization calculation (busy/total ratio)
 * - Average response time from histogram data
 * - Success rate calculation (completed/total ratio)
 * - Real-time metric snapshots
 *
 * **Export & Integration**:
 * - JSON format export for external monitoring
 * - OpenTelemetry integration via existing metrics system
 * - Query API for metric retrieval
 *
 * @module PoolMetrics
 * @see {@link PoolMetrics}
 * @see {@link PoolMetricsSnapshot}
 *
 * @example
 * ```typescript
 * // Create metrics collector
 * const metrics = new PoolMetrics({
 *   poolId: 'primary-pool',
 *   scope: 'worker-metrics'
 * });
 *
 * // Register metrics with worker pool events
 * pool.on('task:completed', (taskId, duration) => {
 *   metrics.recordTaskCompletion(duration);
 * });
 *
 * // Query metrics
 * const snapshot = metrics.getSnapshot();
 * console.log('Utilization:', snapshot.utilization);
 * console.log('Avg Response Time:', snapshot.avgResponseTime);
 *
 * // Export as JSON
 * const json = metrics.exportJSON();
 * ```
 */

import { ScopedMeter, meter, type Attributes } from "../metrics";
import type { Counter, Gauge, Histogram } from "../metrics/types";

/**
 * Configuration options for PoolMetrics
 *
 * @interface PoolMetricsConfig
 * @property poolId - Identifier for the worker pool
 * @property scope - OpenTelemetry meter scope (default: 'worker-pool-metrics')
 * @property attributes - Additional attributes for all metrics
 * @property histogramBoundaries - Custom histogram bucket boundaries (default: exponential 10-10000ms)
 */
export interface PoolMetricsConfig {
  /** Pool instance identifier */
  poolId: string;
  /** Meter scope name for metrics */
  scope?: string;
  /** Additional attributes for metrics */
  attributes?: Attributes;
  /** Custom histogram bucket boundaries in milliseconds */
  histogramBoundaries?: number[];
}

/**
 * Snapshot of aggregated pool metrics
 *
 * Provides calculated metrics and aggregations at a point in time.
 *
 * @interface PoolMetricsSnapshot
 * @property timestamp - Snapshot creation timestamp (ms since epoch)
 * @property poolId - Pool identifier
 * @property totalWorkers - Total number of workers in pool
 * @property activeWorkers - Number of currently active workers
 * @property idleWorkers - Number of idle workers
 * @property queueLength - Current queue length
 * @property totalTasksCompleted - Cumulative completed tasks
 * @property totalTasksFailed - Cumulative failed tasks
 * @property totalTasksRetried - Cumulative retried tasks
 * @property utilization - Worker utilization ratio (0-1)
 * @property avgResponseTime - Average task response time (ms)
 * @property successRate - Task success rate (0-1)
 * @property taskDurationP50 - Median task duration (ms)
 * @property taskDurationP95 - 95th percentile task duration (ms)
 * @property taskDurationP99 - 99th percentile task duration (ms)
 */
export interface PoolMetricsSnapshot {
  /** Snapshot timestamp */
  timestamp: number;
  /** Pool identifier */
  poolId: string;
  /** Total workers */
  totalWorkers: number;
  /** Active workers */
  activeWorkers: number;
  /** Idle workers */
  idleWorkers: number;
  /** Queue length */
  queueLength: number;
  /** Total completed tasks */
  totalTasksCompleted: number;
  /** Total failed tasks */
  totalTasksFailed: number;
  /** Total retried tasks */
  totalTasksRetried: number;
  /** Worker utilization (0-1) */
  utilization: number;
  /** Average response time (ms) */
  avgResponseTime: number;
  /** Success rate (0-1) */
  successRate: number;
  /** 50th percentile task duration (ms) */
  taskDurationP50: number;
  /** 95th percentile task duration (ms) */
  taskDurationP95: number;
  /** 99th percentile task duration (ms) */
  taskDurationP99: number;
}

/**
 * JSON export format for metrics
 *
 * @interface PoolMetricsExport
 * @property metadata - Export metadata (timestamp, version)
 * @property metrics - Current metrics snapshot
 * @property raw - Raw metric data from OpenTelemetry
 */
export interface PoolMetricsExport {
  /** Export metadata */
  metadata: {
    timestamp: number;
    version: string;
    poolId: string;
  };
  /** Current metrics snapshot */
  metrics: PoolMetricsSnapshot;
  /** Raw OpenTelemetry metrics */
  raw?: {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; sum: number; buckets: number[] }>;
  };
}

/**
 * Default histogram boundaries for task duration (milliseconds)
 * Exponential buckets: 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
 */
const DEFAULT_HISTOGRAM_BOUNDARIES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Worker Pool Metrics Collection System
 *
 * Centralized metrics collector providing registration, update, query,
 * and aggregation capabilities for worker pool monitoring.
 *
 * ## Metrics Collected
 *
 * **Counters**:
 * - `pool.tasks.completed`: Total completed tasks
 * - `pool.tasks.failed`: Total failed tasks
 * - `pool.tasks.retried`: Total retried tasks
 *
 * **Gauges**:
 * - `pool.workers.total`: Total worker count
 * - `pool.workers.active`: Active worker count
 * - `pool.workers.idle`: Idle worker count
 * - `pool.queue.length`: Current queue length
 *
 * **Histograms**:
 * - `pool.task.duration`: Task execution time distribution
 * - `pool.task.queue_wait`: Time spent waiting in queue
 *
 * ## Aggregated Metrics
 *
 * - Worker utilization: activeWorkers / totalWorkers
 * - Average response time: sum(durations) / count(durations)
 * - Success rate: completed / (completed + failed)
 * - Percentiles: P50, P95, P99 from histogram buckets
 *
 * @class PoolMetrics
 *
 * @example
 * ```typescript
 * const metrics = new PoolMetrics({
 *   poolId: 'compute-pool',
 *   scope: 'app-metrics',
 *   attributes: { env: 'production' }
 * });
 *
 * // Update metrics
 * metrics.recordTaskCompletion(125); // 125ms duration
 * metrics.recordTaskFailure();
 * metrics.updateWorkerCount(10, 7);
 * metrics.updateQueueLength(15);
 *
 * // Query metrics
 * const snapshot = metrics.getSnapshot();
 * console.log(`Utilization: ${(snapshot.utilization * 100).toFixed(1)}%`);
 *
 * // Export metrics
 * const json = metrics.exportJSON();
 * fs.writeFileSync('metrics.json', JSON.stringify(json, null, 2));
 * ```
 */
export class PoolMetrics {
  private readonly config: Required<PoolMetricsConfig>;
  private readonly scoped: ScopedMeter;

  // Counter metrics
  private readonly tasksCompletedCounter: Counter;
  private readonly tasksFailedCounter: Counter;
  private readonly tasksRetriedCounter: Counter;

  // Gauge metrics
  private readonly totalWorkersGauge: Gauge;
  private readonly activeWorkersGauge: Gauge;
  private readonly idleWorkersGauge: Gauge;
  private readonly queueLengthGauge: Gauge;

  // Histogram metrics
  private readonly taskDurationHistogram: Histogram;
  private readonly queueWaitHistogram: Histogram;

  // Internal state for aggregation
  private totalWorkers = 0;
  private activeWorkers = 0;
  private idleWorkers = 0;
  private queueLength = 0;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private tasksRetried = 0;

  // Task duration tracking for percentile calculation
  private taskDurations: number[] = [];
  private readonly maxDurationSamples = 1000; // Keep last 1000 samples

  /**
   * Create a new PoolMetrics instance
   *
   * Initializes all OpenTelemetry metrics (counters, gauges, histograms)
   * with the configured scope and attributes.
   *
   * @param config - Metrics configuration
   *
   * @example
   * ```typescript
   * const metrics = new PoolMetrics({
   *   poolId: 'worker-pool-1',
   *   scope: 'my-app',
   *   attributes: { region: 'us-west-2' },
   *   histogramBoundaries: [10, 50, 100, 500, 1000]
   * });
   * ```
   */
  constructor(config: PoolMetricsConfig) {
    this.config = {
      poolId: config.poolId,
      scope: config.scope ?? "worker-pool-metrics",
      attributes: {
        component: "worker-pool",
        poolId: config.poolId,
        ...config.attributes,
      },
      histogramBoundaries: config.histogramBoundaries ?? DEFAULT_HISTOGRAM_BOUNDARIES,
    };

    // Initialize scoped meter
    this.scoped = new ScopedMeter(meter(this.config.scope), this.config.attributes);

    // Initialize counter metrics
    this.tasksCompletedCounter = this.scoped.counter("pool.tasks.completed", {
      description: "Total number of completed tasks",
      unit: "count",
    });

    this.tasksFailedCounter = this.scoped.counter("pool.tasks.failed", {
      description: "Total number of failed tasks",
      unit: "count",
    });

    this.tasksRetriedCounter = this.scoped.counter("pool.tasks.retried", {
      description: "Total number of retried tasks",
      unit: "count",
    });

    // Initialize gauge metrics
    this.totalWorkersGauge = this.scoped.gauge("pool.workers.total", {
      description: "Total number of workers in the pool",
      unit: "count",
    });

    this.activeWorkersGauge = this.scoped.gauge("pool.workers.active", {
      description: "Number of actively executing workers",
      unit: "count",
    });

    this.idleWorkersGauge = this.scoped.gauge("pool.workers.idle", {
      description: "Number of idle workers",
      unit: "count",
    });

    this.queueLengthGauge = this.scoped.gauge("pool.queue.length", {
      description: "Number of tasks waiting in queue",
      unit: "count",
    });

    // Initialize histogram metrics
    this.taskDurationHistogram = this.scoped.histogram("pool.task.duration", {
      description: "Task execution time distribution",
      unit: "ms",
    });

    this.queueWaitHistogram = this.scoped.histogram("pool.task.queue_wait", {
      description: "Time spent waiting in queue before execution",
      unit: "ms",
    });
  }

  /**
   * Record task completion
   *
   * Increments completion counter and records task duration in histogram.
   *
   * @param duration - Task execution duration in milliseconds
   * @param attributes - Optional additional attributes
   *
   * @example
   * ```typescript
   * metrics.recordTaskCompletion(125, { taskType: 'compute' });
   * ```
   */
  recordTaskCompletion(duration: number, attributes?: Attributes): void {
    this.tasksCompletedCounter.add(1, attributes);
    this.taskDurationHistogram.record(duration, attributes);
    this.tasksCompleted++;

    // Store duration for percentile calculation
    this.taskDurations.push(duration);
    if (this.taskDurations.length > this.maxDurationSamples) {
      this.taskDurations.shift(); // Remove oldest sample
    }
  }

  /**
   * Record task failure
   *
   * Increments failure counter with optional error attributes.
   *
   * @param attributes - Optional error attributes (error code, type, etc.)
   *
   * @example
   * ```typescript
   * metrics.recordTaskFailure({ errorCode: 'TIMEOUT' });
   * ```
   */
  recordTaskFailure(attributes?: Attributes): void {
    this.tasksFailedCounter.add(1, attributes);
    this.tasksFailed++;
  }

  /**
   * Record task retry
   *
   * Increments retry counter with optional retry context.
   *
   * @param attributes - Optional retry attributes (attempt number, reason, etc.)
   *
   * @example
   * ```typescript
   * metrics.recordTaskRetry({ attempt: 2, reason: 'worker_crash' });
   * ```
   */
  recordTaskRetry(attributes?: Attributes): void {
    this.tasksRetriedCounter.add(1, attributes);
    this.tasksRetried++;
  }

  /**
   * Record queue wait time
   *
   * Records time a task spent waiting in queue before execution.
   *
   * @param waitTime - Queue wait time in milliseconds
   * @param attributes - Optional task attributes
   *
   * @example
   * ```typescript
   * metrics.recordQueueWait(50); // Task waited 50ms in queue
   * ```
   */
  recordQueueWait(waitTime: number, attributes?: Attributes): void {
    this.queueWaitHistogram.record(waitTime, attributes);
  }

  /**
   * Update worker count metrics
   *
   * Updates total, active, and idle worker gauges.
   *
   * @param total - Total number of workers
   * @param active - Number of active workers
   *
   * @example
   * ```typescript
   * metrics.updateWorkerCount(10, 7); // 10 total, 7 active, 3 idle
   * ```
   */
  updateWorkerCount(total: number, active: number): void {
    this.totalWorkers = total;
    this.activeWorkers = active;
    this.idleWorkers = total - active;

    this.totalWorkersGauge.set(total);
    this.activeWorkersGauge.set(active);
    this.idleWorkersGauge.set(this.idleWorkers);
  }

  /**
   * Update queue length metric
   *
   * Updates the current queue length gauge.
   *
   * @param length - Current queue length
   *
   * @example
   * ```typescript
   * metrics.updateQueueLength(25); // 25 tasks waiting
   * ```
   */
  updateQueueLength(length: number): void {
    this.queueLength = length;
    this.queueLengthGauge.set(length);
  }

  /**
   * Calculate worker utilization
   *
   * Returns ratio of active workers to total workers (0-1).
   * Returns 0 if no workers exist.
   *
   * @returns Worker utilization ratio
   *
   * @example
   * ```typescript
   * const util = metrics.calculateUtilization();
   * console.log(`${(util * 100).toFixed(1)}% utilized`);
   * ```
   */
  calculateUtilization(): number {
    if (this.totalWorkers === 0) {
      return 0;
    }
    return this.activeWorkers / this.totalWorkers;
  }

  /**
   * Calculate average response time
   *
   * Computes average from stored task duration samples.
   * Returns 0 if no tasks have completed.
   *
   * @returns Average response time in milliseconds
   *
   * @example
   * ```typescript
   * const avgTime = metrics.calculateAvgResponseTime();
   * console.log(`Avg response: ${avgTime.toFixed(2)}ms`);
   * ```
   */
  calculateAvgResponseTime(): number {
    if (this.taskDurations.length === 0) {
      return 0;
    }
    const sum = this.taskDurations.reduce((acc, d) => acc + d, 0);
    return sum / this.taskDurations.length;
  }

  /**
   * Calculate success rate
   *
   * Returns ratio of completed tasks to total tasks (0-1).
   * Returns 1 if no tasks have been executed yet.
   *
   * @returns Success rate ratio
   *
   * @example
   * ```typescript
   * const rate = metrics.calculateSuccessRate();
   * console.log(`${(rate * 100).toFixed(2)}% success rate`);
   * ```
   */
  calculateSuccessRate(): number {
    const total = this.tasksCompleted + this.tasksFailed;
    if (total === 0) {
      return 1; // No tasks = perfect success rate by default
    }
    return this.tasksCompleted / total;
  }

  /**
   * Calculate percentile from duration samples
   *
   * Computes the specified percentile from stored task durations.
   * Returns 0 if no duration samples exist.
   *
   * @param percentile - Percentile to calculate (0-100)
   * @returns Duration at the specified percentile
   *
   * @example
   * ```typescript
   * const p95 = metrics.calculatePercentile(95);
   * const p99 = metrics.calculatePercentile(99);
   * ```
   */
  calculatePercentile(percentile: number): number {
    if (this.taskDurations.length === 0) {
      return 0;
    }

    // Sort durations in ascending order
    const sorted = [...this.taskDurations].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get current metrics snapshot
   *
   * Returns aggregated metrics snapshot with all calculated values.
   *
   * @returns Current metrics snapshot
   *
   * @example
   * ```typescript
   * const snapshot = metrics.getSnapshot();
   * console.log('Pool Status:', {
   *   utilization: `${(snapshot.utilization * 100).toFixed(1)}%`,
   *   avgResponseTime: `${snapshot.avgResponseTime.toFixed(2)}ms`,
   *   successRate: `${(snapshot.successRate * 100).toFixed(2)}%`,
   *   p95: `${snapshot.taskDurationP95}ms`
   * });
   * ```
   */
  getSnapshot(): PoolMetricsSnapshot {
    return {
      timestamp: Date.now(),
      poolId: this.config.poolId,
      totalWorkers: this.totalWorkers,
      activeWorkers: this.activeWorkers,
      idleWorkers: this.idleWorkers,
      queueLength: this.queueLength,
      totalTasksCompleted: this.tasksCompleted,
      totalTasksFailed: this.tasksFailed,
      totalTasksRetried: this.tasksRetried,
      utilization: this.calculateUtilization(),
      avgResponseTime: this.calculateAvgResponseTime(),
      successRate: this.calculateSuccessRate(),
      taskDurationP50: this.calculatePercentile(50),
      taskDurationP95: this.calculatePercentile(95),
      taskDurationP99: this.calculatePercentile(99),
    };
  }

  /**
   * Export metrics as JSON
   *
   * Creates JSON export with metadata, snapshot, and raw metrics.
   * Suitable for external monitoring systems or log aggregation.
   *
   * @returns JSON-serializable metrics export
   *
   * @example
   * ```typescript
   * const json = metrics.exportJSON();
   * await fs.promises.writeFile(
   *   'metrics.json',
   *   JSON.stringify(json, null, 2)
   * );
   * ```
   */
  exportJSON(): PoolMetricsExport {
    return {
      metadata: {
        timestamp: Date.now(),
        version: "1.0.0",
        poolId: this.config.poolId,
      },
      metrics: this.getSnapshot(),
      raw: {
        counters: {
          "pool.tasks.completed": this.tasksCompleted,
          "pool.tasks.failed": this.tasksFailed,
          "pool.tasks.retried": this.tasksRetried,
        },
        gauges: {
          "pool.workers.total": this.totalWorkers,
          "pool.workers.active": this.activeWorkers,
          "pool.workers.idle": this.idleWorkers,
          "pool.queue.length": this.queueLength,
        },
        histograms: {
          "pool.task.duration": {
            count: this.taskDurations.length,
            sum: this.taskDurations.reduce((a, b) => a + b, 0),
            buckets: this.config.histogramBoundaries,
          },
        },
      },
    };
  }

  /**
   * Query specific metric value
   *
   * Retrieves current value of a specific metric by name.
   *
   * @param metricName - Name of metric to query
   * @returns Current metric value or undefined if not found
   *
   * @example
   * ```typescript
   * const queueLen = metrics.queryMetric('pool.queue.length');
   * const utilization = metrics.queryMetric('utilization');
   * ```
   */
  queryMetric(metricName: string): number | undefined {
    const snapshot = this.getSnapshot();

    const metricMap: Record<string, number> = {
      "pool.workers.total": snapshot.totalWorkers,
      "pool.workers.active": snapshot.activeWorkers,
      "pool.workers.idle": snapshot.idleWorkers,
      "pool.queue.length": snapshot.queueLength,
      "pool.tasks.completed": snapshot.totalTasksCompleted,
      "pool.tasks.failed": snapshot.totalTasksFailed,
      "pool.tasks.retried": snapshot.totalTasksRetried,
      utilization: snapshot.utilization,
      avgResponseTime: snapshot.avgResponseTime,
      successRate: snapshot.successRate,
      taskDurationP50: snapshot.taskDurationP50,
      taskDurationP95: snapshot.taskDurationP95,
      taskDurationP99: snapshot.taskDurationP99,
    };

    return metricMap[metricName];
  }

  /**
   * Reset all metrics
   *
   * Resets all counters and clears duration samples.
   * Useful for testing or periodic metric resets.
   *
   * @example
   * ```typescript
   * metrics.reset(); // Reset all metrics to initial state
   * ```
   */
  reset(): void {
    this.totalWorkers = 0;
    this.activeWorkers = 0;
    this.idleWorkers = 0;
    this.queueLength = 0;
    this.tasksCompleted = 0;
    this.tasksFailed = 0;
    this.tasksRetried = 0;
    this.taskDurations = [];

    // Note: OpenTelemetry metrics are cumulative and cannot be reset
    // This only resets internal tracking state
  }
}
