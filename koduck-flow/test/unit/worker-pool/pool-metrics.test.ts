/**
 * Unit Tests for PoolMetrics
 *
 * Tests metrics collection, aggregation, query, and export functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PoolMetrics } from "../../../src/common/worker-pool/pool-metrics";
import { setMetricsProvider, InMemoryMetricsProvider } from "../../../src/common/metrics";

describe("PoolMetrics", () => {
  let provider: InMemoryMetricsProvider;
  let metrics: PoolMetrics;

  beforeEach(() => {
    // Create fresh in-memory provider for each test
    provider = new InMemoryMetricsProvider();
    setMetricsProvider(provider);

    // Create metrics instance
    metrics = new PoolMetrics({
      poolId: "test-pool",
      scope: "test-metrics",
    });
  });

  afterEach(() => {
    metrics.reset();
  });

  describe("Constructor and Configuration", () => {
    it("should create metrics instance with default config", () => {
      const m = new PoolMetrics({ poolId: "default-test" });
      expect(m).toBeDefined();
      expect(m.queryMetric("pool.workers.total")).toBe(0);
    });

    it("should accept custom scope and attributes", () => {
      const m = new PoolMetrics({
        poolId: "custom-pool",
        scope: "custom-scope",
        attributes: { env: "test", region: "us-west" },
      });
      expect(m).toBeDefined();
    });

    it("should accept custom histogram boundaries", () => {
      const customBoundaries = [5, 10, 50, 100, 500];
      const m = new PoolMetrics({
        poolId: "custom-histogram",
        histogramBoundaries: customBoundaries,
      });
      expect(m).toBeDefined();
    });
  });

  describe("Task Completion Recording", () => {
    it("should record task completion", () => {
      metrics.recordTaskCompletion(100);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1);
    });

    it("should record multiple task completions", () => {
      metrics.recordTaskCompletion(50);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(150);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(3);
    });

    it("should record task durations in histogram", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.avgResponseTime).toBeGreaterThan(0);
    });

    it("should accept optional attributes", () => {
      metrics.recordTaskCompletion(100, { taskType: "compute" });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1);
    });

    it("should maintain duration samples for percentiles", () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.taskDurationP50).toBeGreaterThan(0);
      expect(snapshot.taskDurationP95).toBeGreaterThan(snapshot.taskDurationP50);
    });

    it("should limit duration samples to maxDurationSamples", () => {
      // Record more than 1000 samples
      for (let i = 0; i < 1500; i++) {
        metrics.recordTaskCompletion(i);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1500);
      // Internal duration array should be capped at 1000
      expect(snapshot.avgResponseTime).toBeGreaterThan(0);
    });
  });

  describe("Task Failure Recording", () => {
    it("should record task failure", () => {
      metrics.recordTaskFailure();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksFailed).toBe(1);
    });

    it("should record multiple task failures", () => {
      metrics.recordTaskFailure();
      metrics.recordTaskFailure();
      metrics.recordTaskFailure();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksFailed).toBe(3);
    });

    it("should accept error attributes", () => {
      metrics.recordTaskFailure({ errorCode: "TIMEOUT", errorType: "execution" });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksFailed).toBe(1);
    });
  });

  describe("Task Retry Recording", () => {
    it("should record task retry", () => {
      metrics.recordTaskRetry();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksRetried).toBe(1);
    });

    it("should record multiple retries", () => {
      metrics.recordTaskRetry({ attempt: 1 });
      metrics.recordTaskRetry({ attempt: 2 });

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksRetried).toBe(2);
    });
  });

  describe("Queue Wait Time Recording", () => {
    it("should record queue wait time", () => {
      metrics.recordQueueWait(50);
      metrics.recordQueueWait(75);

      // No error should be thrown
      expect(true).toBe(true);
    });

    it("should accept optional attributes", () => {
      metrics.recordQueueWait(100, { priority: "high" });
      expect(true).toBe(true);
    });
  });

  describe("Worker Count Updates", () => {
    it("should update worker counts", () => {
      metrics.updateWorkerCount(10, 7);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(10);
      expect(snapshot.activeWorkers).toBe(7);
      expect(snapshot.idleWorkers).toBe(3);
    });

    it("should handle all workers active", () => {
      metrics.updateWorkerCount(5, 5);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(5);
      expect(snapshot.activeWorkers).toBe(5);
      expect(snapshot.idleWorkers).toBe(0);
    });

    it("should handle all workers idle", () => {
      metrics.updateWorkerCount(8, 0);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(8);
      expect(snapshot.activeWorkers).toBe(0);
      expect(snapshot.idleWorkers).toBe(8);
    });

    it("should handle zero workers", () => {
      metrics.updateWorkerCount(0, 0);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(0);
      expect(snapshot.activeWorkers).toBe(0);
      expect(snapshot.idleWorkers).toBe(0);
    });
  });

  describe("Queue Length Updates", () => {
    it("should update queue length", () => {
      metrics.updateQueueLength(25);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.queueLength).toBe(25);
    });

    it("should handle empty queue", () => {
      metrics.updateQueueLength(0);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.queueLength).toBe(0);
    });

    it("should handle queue length changes", () => {
      metrics.updateQueueLength(10);
      metrics.updateQueueLength(20);
      metrics.updateQueueLength(5);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.queueLength).toBe(5); // Latest value
    });
  });

  describe("Worker Utilization Calculation", () => {
    it("should calculate utilization correctly", () => {
      metrics.updateWorkerCount(10, 7);

      const utilization = metrics.calculateUtilization();
      expect(utilization).toBe(0.7); // 7/10 = 0.7
    });

    it("should return 0 utilization for zero workers", () => {
      metrics.updateWorkerCount(0, 0);

      const utilization = metrics.calculateUtilization();
      expect(utilization).toBe(0);
    });

    it("should return 1.0 for full utilization", () => {
      metrics.updateWorkerCount(5, 5);

      const utilization = metrics.calculateUtilization();
      expect(utilization).toBe(1);
    });

    it("should include utilization in snapshot", () => {
      metrics.updateWorkerCount(10, 8);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.utilization).toBe(0.8);
    });
  });

  describe("Average Response Time Calculation", () => {
    it("should calculate average response time", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);
      metrics.recordTaskCompletion(300);

      const avgTime = metrics.calculateAvgResponseTime();
      expect(avgTime).toBe(200); // (100 + 200 + 300) / 3
    });

    it("should return 0 for no tasks", () => {
      const avgTime = metrics.calculateAvgResponseTime();
      expect(avgTime).toBe(0);
    });

    it("should handle single task", () => {
      metrics.recordTaskCompletion(150);

      const avgTime = metrics.calculateAvgResponseTime();
      expect(avgTime).toBe(150);
    });

    it("should include avgResponseTime in snapshot", () => {
      metrics.recordTaskCompletion(50);
      metrics.recordTaskCompletion(100);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.avgResponseTime).toBe(75);
    });
  });

  describe("Success Rate Calculation", () => {
    it("should calculate success rate correctly", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();

      const rate = metrics.calculateSuccessRate();
      expect(rate).toBe(0.75); // 3/(3+1) = 0.75
    });

    it("should return 1.0 for no tasks (perfect success)", () => {
      const rate = metrics.calculateSuccessRate();
      expect(rate).toBe(1);
    });

    it("should return 1.0 for all successes", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(100);

      const rate = metrics.calculateSuccessRate();
      expect(rate).toBe(1);
    });

    it("should return 0.0 for all failures", () => {
      metrics.recordTaskFailure();
      metrics.recordTaskFailure();

      const rate = metrics.calculateSuccessRate();
      expect(rate).toBe(0);
    });

    it("should include successRate in snapshot", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.successRate).toBe(0.5);
    });
  });

  describe("Percentile Calculation", () => {
    it("should calculate P50 (median)", () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const p50 = metrics.calculatePercentile(50);
      expect(p50).toBeGreaterThanOrEqual(50);
      expect(p50).toBeLessThanOrEqual(60);
    });

    it("should calculate P95", () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1);
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const p95 = metrics.calculatePercentile(95);
      expect(p95).toBeGreaterThan(90);
    });

    it("should calculate P99", () => {
      const durations = Array.from({ length: 100 }, (_, i) => i + 1);
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const p99 = metrics.calculatePercentile(99);
      expect(p99).toBeGreaterThan(95);
    });

    it("should return 0 for no data", () => {
      const p50 = metrics.calculatePercentile(50);
      expect(p50).toBe(0);
    });

    it("should handle single data point", () => {
      metrics.recordTaskCompletion(100);

      const p50 = metrics.calculatePercentile(50);
      expect(p50).toBe(100);
    });

    it("should include percentiles in snapshot", () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.taskDurationP50).toBeGreaterThan(0);
      expect(snapshot.taskDurationP95).toBeGreaterThan(snapshot.taskDurationP50);
      expect(snapshot.taskDurationP99).toBeGreaterThanOrEqual(snapshot.taskDurationP95);
    });
  });

  describe("Snapshot Generation", () => {
    it("should generate complete snapshot", () => {
      metrics.updateWorkerCount(10, 7);
      metrics.updateQueueLength(15);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);
      metrics.recordTaskFailure();
      metrics.recordTaskRetry();

      const snapshot = metrics.getSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.poolId).toBe("test-pool");
      expect(snapshot.totalWorkers).toBe(10);
      expect(snapshot.activeWorkers).toBe(7);
      expect(snapshot.idleWorkers).toBe(3);
      expect(snapshot.queueLength).toBe(15);
      expect(snapshot.totalTasksCompleted).toBe(2);
      expect(snapshot.totalTasksFailed).toBe(1);
      expect(snapshot.totalTasksRetried).toBe(1);
      expect(snapshot.utilization).toBe(0.7);
      expect(snapshot.avgResponseTime).toBe(150);
      expect(snapshot.successRate).toBe(2 / 3);
      expect(snapshot.taskDurationP50).toBeGreaterThan(0);
      expect(snapshot.taskDurationP95).toBeGreaterThan(0);
      expect(snapshot.taskDurationP99).toBeGreaterThan(0);
    });

    it("should generate snapshot with default values for no data", () => {
      const snapshot = metrics.getSnapshot();

      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.poolId).toBe("test-pool");
      expect(snapshot.totalWorkers).toBe(0);
      expect(snapshot.activeWorkers).toBe(0);
      expect(snapshot.idleWorkers).toBe(0);
      expect(snapshot.queueLength).toBe(0);
      expect(snapshot.totalTasksCompleted).toBe(0);
      expect(snapshot.totalTasksFailed).toBe(0);
      expect(snapshot.totalTasksRetried).toBe(0);
      expect(snapshot.utilization).toBe(0);
      expect(snapshot.avgResponseTime).toBe(0);
      expect(snapshot.successRate).toBe(1); // Perfect success by default
      expect(snapshot.taskDurationP50).toBe(0);
      expect(snapshot.taskDurationP95).toBe(0);
      expect(snapshot.taskDurationP99).toBe(0);
    });

    it("should generate snapshots at different times", () => {
      const snapshot1 = metrics.getSnapshot();

      // Wait a bit
      const waitUntil = Date.now() + 10;
      while (Date.now() < waitUntil) {
        // Busy wait
      }

      const snapshot2 = metrics.getSnapshot();

      expect(snapshot2.timestamp).toBeGreaterThanOrEqual(snapshot1.timestamp);
    });
  });

  describe("JSON Export", () => {
    it("should export metrics as JSON", () => {
      metrics.updateWorkerCount(10, 7);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();

      const json = metrics.exportJSON();

      expect(json.metadata).toBeDefined();
      expect(json.metadata.poolId).toBe("test-pool");
      expect(json.metadata.version).toBe("1.0.0");
      expect(json.metadata.timestamp).toBeGreaterThan(0);

      expect(json.metrics).toBeDefined();
      expect(json.metrics.totalWorkers).toBe(10);
      expect(json.metrics.totalTasksCompleted).toBe(1);

      expect(json.raw).toBeDefined();
      expect(json.raw?.counters).toBeDefined();
      expect(json.raw?.gauges).toBeDefined();
      expect(json.raw?.histograms).toBeDefined();
    });

    it("should include raw counter data", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();
      metrics.recordTaskRetry();

      const json = metrics.exportJSON();

      expect(json.raw?.counters["pool.tasks.completed"]).toBe(1);
      expect(json.raw?.counters["pool.tasks.failed"]).toBe(1);
      expect(json.raw?.counters["pool.tasks.retried"]).toBe(1);
    });

    it("should include raw gauge data", () => {
      metrics.updateWorkerCount(10, 7);
      metrics.updateQueueLength(25);

      const json = metrics.exportJSON();

      expect(json.raw?.gauges["pool.workers.total"]).toBe(10);
      expect(json.raw?.gauges["pool.workers.active"]).toBe(7);
      expect(json.raw?.gauges["pool.workers.idle"]).toBe(3);
      expect(json.raw?.gauges["pool.queue.length"]).toBe(25);
    });

    it("should include raw histogram data", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);

      const json = metrics.exportJSON();

      expect(json.raw?.histograms["pool.task.duration"]).toBeDefined();
      expect(json.raw?.histograms["pool.task.duration"].count).toBe(2);
      expect(json.raw?.histograms["pool.task.duration"].sum).toBe(300);
      expect(json.raw?.histograms["pool.task.duration"].buckets).toBeDefined();
    });

    it("should be JSON-serializable", () => {
      metrics.recordTaskCompletion(100);

      const json = metrics.exportJSON();
      const serialized = JSON.stringify(json);
      const parsed = JSON.parse(serialized);

      expect(parsed.metadata.poolId).toBe("test-pool");
      expect(parsed.metrics.totalTasksCompleted).toBe(1);
    });
  });

  describe("Metric Query", () => {
    it("should query worker metrics", () => {
      metrics.updateWorkerCount(10, 7);

      expect(metrics.queryMetric("pool.workers.total")).toBe(10);
      expect(metrics.queryMetric("pool.workers.active")).toBe(7);
      expect(metrics.queryMetric("pool.workers.idle")).toBe(3);
    });

    it("should query queue metrics", () => {
      metrics.updateQueueLength(25);

      expect(metrics.queryMetric("pool.queue.length")).toBe(25);
    });

    it("should query task metrics", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();
      metrics.recordTaskRetry();

      expect(metrics.queryMetric("pool.tasks.completed")).toBe(1);
      expect(metrics.queryMetric("pool.tasks.failed")).toBe(1);
      expect(metrics.queryMetric("pool.tasks.retried")).toBe(1);
    });

    it("should query aggregated metrics", () => {
      metrics.updateWorkerCount(10, 8);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);

      expect(metrics.queryMetric("utilization")).toBe(0.8);
      expect(metrics.queryMetric("avgResponseTime")).toBe(150);
      expect(metrics.queryMetric("successRate")).toBe(1);
    });

    it("should query percentile metrics", () => {
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      for (const d of durations) {
        metrics.recordTaskCompletion(d);
      }

      const p50 = metrics.queryMetric("taskDurationP50");
      const p95 = metrics.queryMetric("taskDurationP95");
      const p99 = metrics.queryMetric("taskDurationP99");

      expect(p50).toBeGreaterThan(0);
      expect(p95).toBeGreaterThan(0);
      expect(p99).toBeGreaterThan(0);
    });

    it("should return undefined for unknown metric", () => {
      expect(metrics.queryMetric("unknown.metric")).toBeUndefined();
    });
  });

  describe("Reset Functionality", () => {
    it("should reset all metrics", () => {
      metrics.updateWorkerCount(10, 7);
      metrics.updateQueueLength(25);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskFailure();
      metrics.recordTaskRetry();

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(0);
      expect(snapshot.activeWorkers).toBe(0);
      expect(snapshot.queueLength).toBe(0);
      expect(snapshot.totalTasksCompleted).toBe(0);
      expect(snapshot.totalTasksFailed).toBe(0);
      expect(snapshot.totalTasksRetried).toBe(0);
      expect(snapshot.avgResponseTime).toBe(0);
    });

    it("should reset duration samples", () => {
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);

      metrics.reset();

      const snapshot = metrics.getSnapshot();
      expect(snapshot.taskDurationP50).toBe(0);
      expect(snapshot.taskDurationP95).toBe(0);
      expect(snapshot.taskDurationP99).toBe(0);
    });

    it("should allow recording after reset", () => {
      metrics.recordTaskCompletion(100);
      metrics.reset();
      metrics.recordTaskCompletion(200);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1);
      expect(snapshot.avgResponseTime).toBe(200);
    });
  });

  describe("Integration with OpenTelemetry", () => {
    it("should register metrics with OpenTelemetry provider", () => {
      metrics.recordTaskCompletion(100);
      metrics.updateWorkerCount(5, 3);

      const snapshot = provider.snapshot();
      const meterData = snapshot.meters.find((m) => m.scope === "test-metrics");

      expect(meterData).toBeDefined();
      expect(meterData!.counters.length).toBeGreaterThan(0);
      expect(meterData!.gauges.length).toBeGreaterThan(0);
      expect(meterData!.histograms.length).toBeGreaterThan(0);
    });

    it("should emit counter metrics to OpenTelemetry", () => {
      metrics.recordTaskCompletion(100);

      const snapshot = provider.snapshot();
      const meterData = snapshot.meters.find((m) => m.scope === "test-metrics");
      const counter = meterData?.counters.find((c) => c.name === "pool.tasks.completed");

      expect(counter).toBeDefined();
    });

    it("should emit gauge metrics to OpenTelemetry", () => {
      metrics.updateWorkerCount(10, 7);

      const snapshot = provider.snapshot();
      const meterData = snapshot.meters.find((m) => m.scope === "test-metrics");
      const gauge = meterData?.gauges.find((g) => g.name === "pool.workers.total");

      expect(gauge).toBeDefined();
    });

    it("should emit histogram metrics to OpenTelemetry", () => {
      metrics.recordTaskCompletion(100);

      const snapshot = provider.snapshot();
      const meterData = snapshot.meters.find((m) => m.scope === "test-metrics");
      const histogram = meterData?.histograms.find((h) => h.name === "pool.task.duration");

      expect(histogram).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large task counts", () => {
      for (let i = 0; i < 100000; i++) {
        metrics.recordTaskCompletion(100);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(100000);
    });

    it("should handle very large durations", () => {
      metrics.recordTaskCompletion(999999999);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.avgResponseTime).toBe(999999999);
    });

    it("should handle zero duration", () => {
      metrics.recordTaskCompletion(0);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.avgResponseTime).toBe(0);
    });

    it("should handle negative active workers (invalid but defensive)", () => {
      // Intentionally pass invalid data to test defensive code
      metrics.updateWorkerCount(10, -1);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(10);
      expect(snapshot.activeWorkers).toBe(-1);
      expect(snapshot.idleWorkers).toBe(11); // 10 - (-1) = 11
    });

    it("should handle active > total workers (invalid but defensive)", () => {
      metrics.updateWorkerCount(5, 10);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(5);
      expect(snapshot.activeWorkers).toBe(10);
      expect(snapshot.idleWorkers).toBe(-5); // 5 - 10 = -5
    });
  });

  describe("Performance Characteristics", () => {
    it("should handle high-frequency updates efficiently", () => {
      const start = Date.now();

      for (let i = 0; i < 10000; i++) {
        metrics.recordTaskCompletion(Math.random() * 1000);
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete in < 1 second
    });

    it("should generate snapshots efficiently", () => {
      // Record some data
      for (let i = 0; i < 1000; i++) {
        metrics.recordTaskCompletion(i);
      }

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        metrics.getSnapshot();
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // 100 snapshots in < 100ms
    });

    it("should export JSON efficiently", () => {
      // Record some data
      for (let i = 0; i < 1000; i++) {
        metrics.recordTaskCompletion(i);
      }
      metrics.updateWorkerCount(10, 7);
      metrics.updateQueueLength(25);

      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        metrics.exportJSON();
      }

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // 100 exports in < 100ms
    });
  });

  describe("Real-world Scenario", () => {
    it("should track realistic worker pool lifecycle", () => {
      // Pool starts with 5 workers
      metrics.updateWorkerCount(5, 0);
      metrics.updateQueueLength(0);

      // Tasks come in
      metrics.updateQueueLength(20);

      // Workers start processing
      metrics.updateWorkerCount(5, 5);

      // Tasks complete
      for (let i = 0; i < 15; i++) {
        metrics.recordTaskCompletion(100 + Math.random() * 100);
      }

      // Some tasks fail
      for (let i = 0; i < 3; i++) {
        metrics.recordTaskFailure({ errorCode: "TIMEOUT" });
      }

      // Some tasks are retried
      for (let i = 0; i < 2; i++) {
        metrics.recordTaskRetry({ attempt: 2 });
      }

      // Queue shrinks
      metrics.updateQueueLength(5);

      // Some workers become idle
      metrics.updateWorkerCount(5, 3);

      // Get final snapshot
      const snapshot = metrics.getSnapshot();

      expect(snapshot.totalWorkers).toBe(5);
      expect(snapshot.activeWorkers).toBe(3);
      expect(snapshot.idleWorkers).toBe(2);
      expect(snapshot.queueLength).toBe(5);
      expect(snapshot.totalTasksCompleted).toBe(15);
      expect(snapshot.totalTasksFailed).toBe(3);
      expect(snapshot.totalTasksRetried).toBe(2);
      expect(snapshot.utilization).toBe(0.6); // 3/5
      expect(snapshot.successRate).toBe(15 / 18); // 15/(15+3)
      expect(snapshot.avgResponseTime).toBeGreaterThan(100);
      expect(snapshot.avgResponseTime).toBeLessThan(200);
      expect(snapshot.taskDurationP50).toBeGreaterThan(0);
      expect(snapshot.taskDurationP95).toBeGreaterThan(snapshot.taskDurationP50);
      expect(snapshot.taskDurationP99).toBeGreaterThanOrEqual(snapshot.taskDurationP95);
    });
  });

  describe("Extreme Metric Values (Min/Max Boundaries)", () => {
    it("should handle maximum worker pool size", () => {
      const maxWorkers = 100000;
      const activeWorkers = Math.floor(maxWorkers * 0.8);
      metrics.updateWorkerCount(maxWorkers, activeWorkers);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(maxWorkers);
      expect(snapshot.activeWorkers).toBe(activeWorkers);
      expect(snapshot.idleWorkers).toBe(maxWorkers - activeWorkers);
      expect(snapshot.utilization).toBe(0.8);
    });

    it("should handle extremely large queue lengths", () => {
      const largeQueue = 1000000;
      metrics.updateQueueLength(largeQueue);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.queueLength).toBe(largeQueue);
    });

    it("should handle extreme task completion durations", () => {
      const extremeDurations = [0, 1, 1000000, 99999999];
      for (const duration of extremeDurations) {
        metrics.recordTaskCompletion(duration);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(4);
      expect(snapshot.avgResponseTime).toBeGreaterThan(0);
      expect(snapshot.taskDurationP50).toBeGreaterThanOrEqual(0);
    });

    it("should maintain consistency with maximum task volumes", () => {
      const taskCount = 50000;
      for (let i = 0; i < taskCount; i++) {
        metrics.recordTaskCompletion(100 + (i % 900));
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(taskCount);
      expect(snapshot.avgResponseTime).toBeGreaterThanOrEqual(100);
      expect(snapshot.avgResponseTime).toBeLessThanOrEqual(999);
    });

    it("should correctly calculate utilization at extreme ratios", () => {
      const testCases = [
        { total: 1, active: 0, expectedUtil: 0 },
        { total: 1, active: 1, expectedUtil: 1 },
        { total: 100, active: 1, expectedUtil: 0.01 },
        { total: 100, active: 99, expectedUtil: 0.99 },
        { total: 1000, active: 500, expectedUtil: 0.5 },
      ];

      for (const testCase of testCases) {
        metrics.reset();
        metrics.updateWorkerCount(testCase.total, testCase.active);

        const utilization = metrics.calculateUtilization();
        expect(utilization).toBeCloseTo(testCase.expectedUtil, 5);
      }
    });
  });

  describe("Concurrent Updates Simulation", () => {
    it("should handle interleaved metric updates consistently", () => {
      // Simulate concurrent updates interleaved
      metrics.updateWorkerCount(10, 5);
      metrics.recordTaskCompletion(100);
      metrics.updateQueueLength(15);
      metrics.recordTaskCompletion(150);
      metrics.updateWorkerCount(10, 8);
      metrics.recordTaskFailure();
      metrics.updateQueueLength(10);
      metrics.recordTaskCompletion(120);
      metrics.recordTaskRetry();
      metrics.updateWorkerCount(10, 7);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(10);
      expect(snapshot.activeWorkers).toBe(7);
      expect(snapshot.idleWorkers).toBe(3);
      expect(snapshot.queueLength).toBe(10);
      expect(snapshot.totalTasksCompleted).toBe(3);
      expect(snapshot.totalTasksFailed).toBe(1);
      expect(snapshot.totalTasksRetried).toBe(1);
      expect(snapshot.utilization).toBe(0.7);
    });

    it("should maintain accuracy with rapid gauge updates", () => {
      // Rapid sequential gauge updates
      for (let i = 0; i < 100; i++) {
        metrics.updateWorkerCount(10 + i, Math.floor((10 + i) * 0.5));
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(109);
      expect(snapshot.activeWorkers).toBe(54);
      expect(snapshot.idleWorkers).toBe(55);
      expect(snapshot.utilization).toBeCloseTo(54 / 109, 5);
    });

    it("should accumulate counter metrics correctly with interleaved updates", () => {
      // Interleave different counter types
      for (let i = 0; i < 50; i++) {
        metrics.recordTaskCompletion(50);
        if (i % 3 === 0) {
          metrics.recordTaskFailure();
        }
        if (i % 5 === 0) {
          metrics.recordTaskRetry();
        }
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(50);
      expect(snapshot.totalTasksFailed).toBe(17); // Math.floor(50 / 3) + 1
      expect(snapshot.totalTasksRetried).toBe(10); // 50 / 5
    });

    it("should maintain histogram accuracy during concurrent recordings", () => {
      // Record durations concurrently (simulated)
      const durations = Array.from({ length: 100 }, (_, i) => i * 10);
      for (const duration of durations) {
        metrics.recordTaskCompletion(duration);
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(100);
      expect(snapshot.taskDurationP50).toBeGreaterThan(0);
      expect(snapshot.taskDurationP95).toBeGreaterThan(snapshot.taskDurationP50);
      expect(snapshot.taskDurationP99).toBeGreaterThanOrEqual(snapshot.taskDurationP95);
    });
  });

  describe("Cleanup and Reset with Reuse", () => {
    it("should reset all metrics to initial state", () => {
      // Record data
      metrics.updateWorkerCount(10, 7);
      metrics.updateQueueLength(20);
      metrics.recordTaskCompletion(100);
      metrics.recordTaskCompletion(200);
      metrics.recordTaskFailure();

      // Verify data exists
      let snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(2);

      // Reset
      metrics.reset();

      // Verify clean state
      snapshot = metrics.getSnapshot();
      expect(snapshot.totalWorkers).toBe(0);
      expect(snapshot.activeWorkers).toBe(0);
      expect(snapshot.idleWorkers).toBe(0);
      expect(snapshot.queueLength).toBe(0);
      expect(snapshot.totalTasksCompleted).toBe(0);
      expect(snapshot.totalTasksFailed).toBe(0);
      expect(snapshot.totalTasksRetried).toBe(0);
      expect(snapshot.avgResponseTime).toBe(0);
      expect(snapshot.utilization).toBe(0);
      expect(snapshot.successRate).toBe(1); // Perfect success (no tasks)
    });

    it("should reuse metrics instance after reset without corruption", () => {
      // First use
      metrics.updateWorkerCount(5, 3);
      metrics.recordTaskCompletion(100);
      let snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1);
      expect(snapshot.utilization).toBe(0.6);

      // Reset
      metrics.reset();

      // Second use - verify clean state
      metrics.updateWorkerCount(10, 5);
      metrics.recordTaskCompletion(200);
      snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1); // New count starts at 1
      expect(snapshot.totalWorkers).toBe(10);
      expect(snapshot.utilization).toBe(0.5);

      // Third use
      metrics.reset();
      metrics.updateWorkerCount(8, 2);
      metrics.recordTaskCompletion(50);
      snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(1);
      expect(snapshot.utilization).toBe(0.25);
    });

    it("should handle multiple sequential reset-reuse cycles", () => {
      for (let cycle = 0; cycle < 10; cycle++) {
        metrics.updateWorkerCount(cycle + 1, 1);
        metrics.recordTaskCompletion(100);

        let snapshot = metrics.getSnapshot();
        expect(snapshot.totalWorkers).toBe(cycle + 1);
        expect(snapshot.totalTasksCompleted).toBe(1);
        expect(snapshot.avgResponseTime).toBe(100);

        metrics.reset();

        snapshot = metrics.getSnapshot();
        expect(snapshot.totalWorkers).toBe(0);
        expect(snapshot.totalTasksCompleted).toBe(0);
      }
    });

    it("should maintain histogram consistency after reset and reuse", () => {
      // First use - record durations
      const firstDurations = [10, 20, 30, 40, 50];
      for (const d of firstDurations) {
        metrics.recordTaskCompletion(d);
      }
      let snapshot = metrics.getSnapshot();
      const firstP50 = snapshot.taskDurationP50;

      // Reset
      metrics.reset();

      // Second use - record different durations
      const secondDurations = [100, 200, 300, 400, 500];
      for (const d of secondDurations) {
        metrics.recordTaskCompletion(d);
      }
      snapshot = metrics.getSnapshot();
      const secondP50 = snapshot.taskDurationP50;

      // Verify different distributions
      expect(secondP50).toBeGreaterThan(firstP50);
      expect(snapshot.totalTasksCompleted).toBe(5); // Second use only
    });
  });

  describe("State Consistency Under Stress", () => {
    it("should maintain consistent calculation across rapid metric changes", () => {
      // Rapid state changes
      for (let i = 0; i < 100; i++) {
        const workers = (i % 20) + 1;
        const active = i % (workers + 1);
        metrics.updateWorkerCount(workers, active);

        const snapshot = metrics.getSnapshot();
        expect(snapshot.totalWorkers).toBe(workers);
        expect(snapshot.activeWorkers).toBe(active);
        expect(snapshot.idleWorkers).toBe(workers - active);
        expect(snapshot.utilization).toBeCloseTo(active / workers, 5);
      }
    });

    it("should handle success rate consistency with mixed operations", () => {
      const totalOps = 100;
      let expectedSuccesses = 0;
      let expectedFailures = 0;

      for (let i = 0; i < totalOps; i++) {
        if (i % 3 === 0) {
          metrics.recordTaskFailure();
          expectedFailures++;
        } else {
          metrics.recordTaskCompletion(100);
          expectedSuccesses++;
        }
      }

      const snapshot = metrics.getSnapshot();
      expect(snapshot.totalTasksCompleted).toBe(expectedSuccesses);
      expect(snapshot.totalTasksFailed).toBe(expectedFailures);
      const expectedRate = expectedSuccesses / (expectedSuccesses + expectedFailures);
      expect(snapshot.successRate).toBeCloseTo(expectedRate, 5);
    });

    it("should validate metric relationships remain consistent", () => {
      // Test multiple scenarios
      const scenarios = [
        { workers: 5, active: 2, queue: 10 },
        { workers: 20, active: 15, queue: 5 },
        { workers: 100, active: 50, queue: 500 },
        { workers: 1, active: 1, queue: 0 },
      ];

      for (const scenario of scenarios) {
        metrics.reset();
        metrics.updateWorkerCount(scenario.workers, scenario.active);
        metrics.updateQueueLength(scenario.queue);

        const snapshot = metrics.getSnapshot();

        // Verify consistency constraints
        expect(snapshot.totalWorkers).toBe(scenario.workers);
        expect(snapshot.activeWorkers).toBe(scenario.active);
        expect(snapshot.idleWorkers).toBe(scenario.workers - scenario.active);
        expect(snapshot.queueLength).toBe(scenario.queue);
        expect(snapshot.utilization).toBeCloseTo(scenario.active / scenario.workers, 5);
        expect(snapshot.totalWorkers).toBeGreaterThanOrEqual(snapshot.activeWorkers);
        expect(snapshot.totalWorkers).toBeGreaterThanOrEqual(snapshot.idleWorkers);
      }
    });
  });

  describe("Complex State Transitions", () => {
    it("should track complete lifecycle with state transitions", () => {
      const snapshots: Array<ReturnType<typeof metrics.getSnapshot>> = [];

      // Startup: 0 workers
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[0].totalWorkers).toBe(0);

      // Scale up: add workers
      metrics.updateWorkerCount(5, 0);
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[1].totalWorkers).toBe(5);
      expect(snapshots[1].utilization).toBe(0);

      // Work arrives: queue builds
      metrics.updateQueueLength(50);
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[2].queueLength).toBe(50);

      // Workers activate
      metrics.updateWorkerCount(5, 5);
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[3].utilization).toBe(1);

      // Work completes
      for (let i = 0; i < 30; i++) {
        metrics.recordTaskCompletion(100 + Math.random() * 50);
      }
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[4].totalTasksCompleted).toBe(30);

      // Some failures
      for (let i = 0; i < 5; i++) {
        metrics.recordTaskFailure();
      }
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[5].totalTasksFailed).toBe(5);

      // Recovery: scale down
      metrics.updateQueueLength(5);
      metrics.updateWorkerCount(3, 2);
      snapshots.push(metrics.getSnapshot());
      expect(snapshots[6].totalWorkers).toBe(3);
      expect(snapshots[6].queueLength).toBe(5);

      // Verify transitions
      for (let i = 0; i < snapshots.length - 1; i++) {
        expect(snapshots[i + 1].timestamp).toBeGreaterThanOrEqual(snapshots[i].timestamp);
      }
    });
  });
});
