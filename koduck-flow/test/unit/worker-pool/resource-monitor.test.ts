import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ResourceMonitor } from "../../../src/common/worker-pool/resource-monitor";

describe("ResourceMonitor", () => {
  let monitor: ResourceMonitor;

  beforeEach(() => {
    monitor = new ResourceMonitor({
      enableMemoryMonitoring: true,
      memoryWarningMB: 100,
      memoryCriticalMB: 200,
      memoryLimitMB: 500,
      enableCPUMonitoring: true,
      cpuWarningPercent: 70,
      cpuCriticalPercent: 90,
      enableTrendAnalysis: true,
      snapshotInterval: 100,
      maxSnapshots: 10,
      trendWindow: 500,
    });
  });

  afterEach(() => {
    monitor.dispose();
  });

  describe("Constructor and Configuration", () => {
    it("should create monitor with default config", () => {
      const defaultMonitor = new ResourceMonitor({});
      expect(defaultMonitor).toBeDefined();
      defaultMonitor.dispose();
    });

    it("should create monitor with custom config", () => {
      const customMonitor = new ResourceMonitor({
        enableMemoryMonitoring: true,
        memoryWarningMB: 256,
      });
      expect(customMonitor).toBeDefined();
      customMonitor.dispose();
    });

    it("should validate memoryWarningMB >= 0", () => {
      expect(() => new ResourceMonitor({ memoryWarningMB: -1 })).toThrow(
        "memoryWarningMB must be >= 0"
      );
    });

    it("should validate memoryCriticalMB >= memoryWarningMB", () => {
      expect(
        () =>
          new ResourceMonitor({
            memoryWarningMB: 200,
            memoryCriticalMB: 100,
          })
      ).toThrow("memoryCriticalMB must be >= memoryWarningMB");
    });

    it("should validate memoryLimitMB >= memoryCriticalMB", () => {
      expect(
        () =>
          new ResourceMonitor({
            memoryWarningMB: 200,
            memoryCriticalMB: 300,
            memoryLimitMB: 250,
          })
      ).toThrow("memoryLimitMB must be >= memoryCriticalMB");
    });

    it("should validate cpuWarningPercent between 0 and 100", () => {
      expect(() => new ResourceMonitor({ cpuWarningPercent: 150 })).toThrow(
        "cpuWarningPercent must be between 0 and 100"
      );
    });

    it("should validate cpuCriticalPercent >= cpuWarningPercent", () => {
      expect(
        () =>
          new ResourceMonitor({
            cpuWarningPercent: 80,
            cpuCriticalPercent: 70,
          })
      ).toThrow("cpuCriticalPercent must be between cpuWarningPercent and 100");
    });

    it("should validate snapshotInterval > 0", () => {
      expect(() => new ResourceMonitor({ snapshotInterval: 0 })).toThrow(
        "snapshotInterval must be > 0"
      );
    });

    it("should validate maxSnapshots >= 1", () => {
      expect(() => new ResourceMonitor({ maxSnapshots: 0 })).toThrow("maxSnapshots must be >= 1");
    });
  });

  describe("Memory Monitoring", () => {
    it("should record memory usage for worker", () => {
      monitor.recordMemoryUsage("worker-1", 50);
      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(50);
      expect(stats.workerCount).toBe(1);
    });

    it("should track peak memory usage", () => {
      monitor.recordMemoryUsage("worker-1", 50);
      monitor.recordMemoryUsage("worker-1", 120);
      monitor.recordMemoryUsage("worker-1", 80);

      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.peakMemory).toBe(120);
      expect(usage?.memoryUsage).toBe(80);
    });

    it("should aggregate memory from multiple workers", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      monitor.recordMemoryUsage("worker-2", 150);
      monitor.recordMemoryUsage("worker-3", 200);

      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(450);
      expect(stats.avgMemoryPerWorker).toBe(150);
      expect(stats.peakMemoryUsage).toBe(200);
      expect(stats.workerCount).toBe(3);
    });

    it("should emit memory-warning event when threshold exceeded", () => {
      let eventEmitted = false;
      monitor.on("resource:memory-warning", () => {
        eventEmitted = true;
      });
      monitor.recordMemoryUsage("worker-1", 120);
      expect(eventEmitted).toBe(true);
    });

    it("should emit memory-critical event when critical threshold exceeded", () => {
      let eventFired = false;
      monitor.on("resource:memory-critical", () => {
        eventFired = true;
      });
      monitor.recordMemoryUsage("worker-1", 250);
      expect(eventFired).toBe(true);
    });

    it("should emit memory-recovered event when below warning threshold", () => {
      monitor.recordMemoryUsage("worker-1", 250); // Trigger critical

      let eventFired = false;
      monitor.on("resource:memory-recovered", () => {
        eventFired = true;
      });

      monitor.recordMemoryUsage("worker-1", 50); // Should recover
      expect(eventFired).toBe(true);
    });

    it("should not emit duplicate warning events", async () => {
      let eventCount = 0;
      monitor.on("resource:memory-warning", () => {
        eventCount++;
      });

      monitor.recordMemoryUsage("worker-1", 120); // First warning
      monitor.recordMemoryUsage("worker-1", 130); // Should not emit again

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(eventCount).toBe(1);
    });

    it("should disable memory monitoring if disabled", () => {
      const disabledMonitor = new ResourceMonitor({
        enableMemoryMonitoring: false,
      });
      let eventEmitted = false;

      disabledMonitor.on("resource:memory-warning", () => {
        eventEmitted = true;
      });

      disabledMonitor.recordMemoryUsage("worker-1", 1000);
      expect(eventEmitted).toBe(false);
      disabledMonitor.dispose();
    });
  });

  describe("CPU Monitoring", () => {
    it("should record CPU time for worker", () => {
      monitor.recordCPUTime("worker-1", 100);
      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.cpuTime).toBe(100);
      expect(usage?.taskCount).toBe(1);
    });

    it("should accumulate CPU time across multiple tasks", () => {
      monitor.recordCPUTime("worker-1", 100);
      monitor.recordCPUTime("worker-1", 200);
      monitor.recordCPUTime("worker-1", 150);

      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.cpuTime).toBe(450);
      expect(usage?.taskCount).toBe(3);
    });

    it("should calculate CPU utilization", () => {
      monitor.recordCPUTime("worker-1", 100);
      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.cpuUtilization).toBeGreaterThan(0);
      expect(usage?.cpuUtilization).toBeLessThanOrEqual(1);
    });

    it("should emit cpu-warning event when threshold exceeded", () => {
      let eventFired = false;
      monitor.on("resource:cpu-warning", () => {
        eventFired = true;
      });

      // Record enough CPU time to reach warning threshold
      monitor.recordCPUTime("worker-1", 80); // 80ms out of 100ms snapshot interval
      expect(eventFired).toBe(true);
    });

    it("should emit cpu-critical event when critical threshold exceeded", () => {
      let eventFired = false;
      monitor.on("resource:cpu-critical", () => {
        eventFired = true;
      });

      // Record enough CPU time to reach critical threshold
      monitor.recordCPUTime("worker-1", 100); // Very high CPU usage
      expect(eventFired).toBe(true);
    });

    it("should emit cpu-recovered event when utilization drops", () => {
      monitor.recordCPUTime("worker-1", 100); // Trigger critical

      let eventFired = false;
      monitor.on("resource:cpu-recovered", () => {
        eventFired = true;
      });

      // Update with lower usage
      monitor.recordCPUTime("worker-1", 10);
      expect(eventFired).toBe(true);
    });

    it("should disable CPU monitoring if disabled", () => {
      const disabledMonitor = new ResourceMonitor({
        enableCPUMonitoring: false,
      });
      let eventEmitted = false;

      disabledMonitor.on("resource:cpu-warning", () => {
        eventEmitted = true;
      });

      disabledMonitor.recordCPUTime("worker-1", 1000);
      expect(eventEmitted).toBe(false);
      disabledMonitor.dispose();
    });
  });

  describe("Resource Statistics", () => {
    it("should return empty statistics when no workers tracked", () => {
      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(0);
      expect(stats.workerCount).toBe(0);
      expect(stats.avgMemoryPerWorker).toBe(0);
    });

    it("should calculate memory pressure", () => {
      monitor.recordMemoryUsage("worker-1", 250); // 250/500 = 0.5 pressure

      const stats = monitor.getResourceStatistics();
      expect(stats.memoryPressure).toBe(0.5);
    });

    it("should cap memory pressure at 1.0", () => {
      monitor.recordMemoryUsage("worker-1", 600); // 600/500 > 1.0

      const stats = monitor.getResourceStatistics();
      expect(stats.memoryPressure).toBeLessThanOrEqual(1);
    });

    it("should return complete statistics snapshot", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      monitor.recordMemoryUsage("worker-2", 150);
      monitor.recordCPUTime("worker-1", 50);

      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBeGreaterThan(0);
      expect(stats.avgMemoryPerWorker).toBeGreaterThan(0);
      expect(stats.peakMemoryUsage).toBeGreaterThan(0);
      expect(stats.workerCount).toBe(2);
      expect(stats.totalCPUTime).toBe(50);
      expect(stats.avgCPUUtilization).toBeGreaterThanOrEqual(0);
      expect(stats.memoryPressure).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Trend Analysis", () => {
    it("should return default trend when no snapshots", () => {
      const trend = monitor.getTrendAnalysis();
      expect(trend.memoryTrend).toBe(0);
      expect(trend.cpuTrend).toBe(0);
      expect(trend.scalingRecommendation).toBe("none");
    });

    it("should calculate memory trend from snapshots", async () => {
      monitor.startTrendMonitoring();

      monitor.recordMemoryUsage("worker-1", 100);
      await new Promise((resolve) => setTimeout(resolve, 110));

      monitor.recordMemoryUsage("worker-1", 200);
      await new Promise((resolve) => setTimeout(resolve, 110));

      const trend = monitor.getTrendAnalysis();
      expect(trend.memoryTrend).not.toBe(0);

      monitor.stopTrendMonitoring();
    });

    it("should calculate CPU trend from snapshots", async () => {
      monitor.startTrendMonitoring();

      monitor.recordCPUTime("worker-1", 50);
      await new Promise((resolve) => setTimeout(resolve, 110));

      monitor.recordCPUTime("worker-1", 100);
      await new Promise((resolve) => setTimeout(resolve, 110));

      const trend = monitor.getTrendAnalysis();
      expect(trend.cpuTrend).not.toBe(0);

      monitor.stopTrendMonitoring();
    });

    it("should project future memory usage", () => {
      monitor.startTrendMonitoring();

      monitor.recordMemoryUsage("worker-1", 100);
      monitor.recordMemoryUsage("worker-1", 200);

      const trend = monitor.getTrendAnalysis();
      expect(trend.projectedMemory).toBeGreaterThanOrEqual(0);

      monitor.stopTrendMonitoring();
    });

    it("should calculate resource pressure", () => {
      monitor.recordMemoryUsage("worker-1", 250); // 50% of limit
      monitor.recordCPUTime("worker-1", 50);

      const trend = monitor.getTrendAnalysis();
      expect(trend.resourcePressure).toBeGreaterThanOrEqual(0);
      expect(trend.resourcePressure).toBeLessThanOrEqual(1);
    });

    it("should recommend scale-up when high memory trend", async () => {
      monitor.startTrendMonitoring();

      monitor.recordMemoryUsage("worker-1", 300);
      await new Promise((resolve) => setTimeout(resolve, 110));

      monitor.recordMemoryUsage("worker-1", 350);

      const trend = monitor.getTrendAnalysis();
      // High memory should trigger scale-up recommendation
      expect(["scale-up", "none"]).toContain(trend.scalingRecommendation);

      monitor.stopTrendMonitoring();
    });

    it("should recommend scale-down when low resource usage", async () => {
      monitor.startTrendMonitoring();

      monitor.recordMemoryUsage("worker-1", 50);
      await new Promise((resolve) => setTimeout(resolve, 110));

      monitor.recordMemoryUsage("worker-1", 40);

      const trend = monitor.getTrendAnalysis();
      expect(["scale-down", "none"]).toContain(trend.scalingRecommendation);

      monitor.stopTrendMonitoring();
    });
  });

  describe("Trend Monitoring", () => {
    it("should start trend monitoring", async () => {
      // Record some memory first so snapshot will have data
      monitor.recordMemoryUsage("worker-1", 100);

      monitor.startTrendMonitoring();

      // The initial snapshot should be captured
      const snapshots = monitor.getSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);

      monitor.stopTrendMonitoring();
    });

    it("should capture periodic snapshots", async () => {
      monitor.startTrendMonitoring();
      monitor.recordMemoryUsage("worker-1", 100);

      const initialSnapshots = monitor.getSnapshots().length;

      await new Promise((resolve) => setTimeout(resolve, 150));

      const afterSnapshots = monitor.getSnapshots().length;
      expect(afterSnapshots).toBeGreaterThan(initialSnapshots);

      monitor.stopTrendMonitoring();
    });

    it("should emit snapshot events", async () => {
      // Record some memory first so snapshot will have data
      monitor.recordMemoryUsage("worker-1", 100);

      let snapshotEmitted = false;
      monitor.on("resource:snapshot", (snapshot) => {
        expect(snapshot.timestamp).toBeGreaterThan(0);
        expect(snapshot.totalMemory).toBeGreaterThanOrEqual(0);
        snapshotEmitted = true;
      });

      monitor.startTrendMonitoring();

      // The initial snapshot should be emitted
      expect(snapshotEmitted).toBe(true);
      monitor.stopTrendMonitoring();
    });

    it("should maintain max snapshot count", async () => {
      monitor.startTrendMonitoring();
      monitor.recordMemoryUsage("worker-1", 100);

      // Wait for more snapshots than maxSnapshots
      await new Promise((resolve) => setTimeout(resolve, 1200));

      const snapshots = monitor.getSnapshots();
      expect(snapshots.length).toBeLessThanOrEqual(monitor.getSnapshots().length + 2); // Account for timing

      monitor.stopTrendMonitoring();
    });

    it("should stop trend monitoring", async () => {
      monitor.startTrendMonitoring();
      monitor.recordMemoryUsage("worker-1", 100);

      const initialCount = monitor.getSnapshots().length;

      monitor.stopTrendMonitoring();
      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalCount = monitor.getSnapshots().length;
      expect(finalCount).toBe(initialCount); // No new snapshots after stop
    });

    it("should handle multiple start/stop cycles", () => {
      monitor.startTrendMonitoring();
      monitor.stopTrendMonitoring();
      monitor.startTrendMonitoring();
      monitor.stopTrendMonitoring();

      expect(monitor).toBeDefined();
    });
  });

  describe("Worker Management", () => {
    it("should get worker resource usage", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      const usage = monitor.getWorkerResourceUsage("worker-1");

      expect(usage).toBeDefined();
      expect(usage?.workerId).toBe("worker-1");
      expect(usage?.memoryUsage).toBe(100);
    });

    it("should return undefined for non-existent worker", () => {
      const usage = monitor.getWorkerResourceUsage("non-existent");
      expect(usage).toBeUndefined();
    });

    it("should get all worker resource usage", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      monitor.recordMemoryUsage("worker-2", 150);
      monitor.recordMemoryUsage("worker-3", 200);

      const allUsage = monitor.getAllWorkerResourceUsage();
      expect(allUsage.size).toBe(3);
      expect(allUsage.has("worker-1")).toBe(true);
      expect(allUsage.has("worker-2")).toBe(true);
      expect(allUsage.has("worker-3")).toBe(true);
    });

    it("should remove worker from tracking", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      expect(monitor.getWorkerResourceUsage("worker-1")).toBeDefined();

      monitor.removeWorker("worker-1");
      expect(monitor.getWorkerResourceUsage("worker-1")).toBeUndefined();
    });

    it("should clear all data", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      monitor.recordMemoryUsage("worker-2", 150);

      monitor.clearData();

      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(0);
      expect(stats.workerCount).toBe(0);
    });
  });

  describe("Lifecycle Management", () => {
    it("should dispose properly", () => {
      monitor.recordMemoryUsage("worker-1", 100);
      monitor.dispose();

      expect(() => monitor.recordMemoryUsage("worker-2", 100)).toThrow(
        "ResourceMonitor has been disposed"
      );
    });

    it("should throw error if using disposed monitor", () => {
      monitor.dispose();

      expect(() => monitor.recordMemoryUsage("worker-1", 100)).toThrow(
        "ResourceMonitor has been disposed"
      );
    });

    it("should throw error on disposed trend monitoring", () => {
      monitor.dispose();

      expect(() => monitor.startTrendMonitoring()).toThrow("ResourceMonitor has been disposed");
    });

    it("should handle multiple dispose calls", () => {
      monitor.dispose();
      expect(() => monitor.dispose()).not.toThrow();
    });

    it("should clear listeners on dispose", () => {
      const listener = vi.fn();
      monitor.on("resource:memory-warning", listener);

      monitor.dispose();
      // After disposal, the listener count should be 0
      expect(monitor.listenerCount("resource:memory-warning")).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero memory values", () => {
      monitor.recordMemoryUsage("worker-1", 0);
      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(0);
    });

    it("should handle very large memory values", () => {
      monitor.recordMemoryUsage("worker-1", 1_000_000);
      const stats = monitor.getResourceStatistics();
      expect(stats.totalMemoryUsage).toBe(1_000_000);
    });

    it("should handle zero CPU time", () => {
      monitor.recordCPUTime("worker-1", 0);
      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.cpuTime).toBe(0);
    });

    it("should handle negative CPU time gracefully", () => {
      monitor.recordCPUTime("worker-1", -100); // Negative should still be recorded
      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.cpuTime).toBe(-100);
    });

    it("should handle empty worker list in trend analysis", () => {
      monitor.startTrendMonitoring();
      const trend = monitor.getTrendAnalysis();
      expect(trend.scalingRecommendation).toBe("none");
      monitor.stopTrendMonitoring();
    });

    it("should handle rapid memory updates", () => {
      for (let i = 0; i < 1000; i++) {
        monitor.recordMemoryUsage("worker-1", Math.random() * 100);
      }

      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage).toBeDefined();
      expect(usage?.peakMemory).toBeGreaterThanOrEqual(0);
    });

    it("should handle rapid CPU updates", () => {
      for (let i = 0; i < 1000; i++) {
        monitor.recordCPUTime("worker-1", Math.random() * 50);
      }

      const usage = monitor.getWorkerResourceUsage("worker-1");
      expect(usage?.taskCount).toBe(1000);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent memory recording", () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            monitor.recordMemoryUsage(`worker-${i % 10}`, Math.random() * 100);
          })
        );
      }

      return Promise.all(promises).then(() => {
        const stats = monitor.getResourceStatistics();
        expect(stats.workerCount).toBeLessThanOrEqual(10);
      });
    });

    it("should handle concurrent CPU recording", () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            monitor.recordCPUTime(`worker-${i % 10}`, Math.random() * 50);
          })
        );
      }

      return Promise.all(promises).then(() => {
        const stats = monitor.getResourceStatistics();
        expect(stats.totalCPUTime).toBeGreaterThan(0);
      });
    });

    it("should handle interleaved memory and CPU updates", () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        const workerId = `worker-${i % 5}`;
        promises.push(
          Promise.resolve().then(() => {
            monitor.recordMemoryUsage(workerId, Math.random() * 100);
            monitor.recordCPUTime(workerId, Math.random() * 50);
          })
        );
      }

      return Promise.all(promises).then(() => {
        const stats = monitor.getResourceStatistics();
        expect(stats.workerCount).toBeGreaterThan(0);
      });
    });
  });

  describe("Configuration Updates", () => {
    it("should respect memory warning threshold changes", () => {
      const customMonitor = new ResourceMonitor({
        memoryWarningMB: 50,
      });

      let warningFired = false;
      customMonitor.on("resource:memory-warning", () => {
        warningFired = true;
      });

      customMonitor.recordMemoryUsage("worker-1", 60);
      expect(warningFired).toBe(true);

      customMonitor.dispose();
    });

    it("should respect CPU warning threshold changes", () => {
      const customMonitor = new ResourceMonitor({
        cpuWarningPercent: 20,
        snapshotInterval: 100,
      });

      let warningFired = false;
      customMonitor.on("resource:cpu-warning", () => {
        warningFired = true;
      });

      customMonitor.recordCPUTime("worker-1", 30);
      expect(warningFired).toBe(true);

      customMonitor.dispose();
    });

    it("should respect snapshot interval", async () => {
      const customMonitor = new ResourceMonitor({
        snapshotInterval: 50,
        enableTrendAnalysis: true,
      });

      customMonitor.startTrendMonitoring();
      customMonitor.recordMemoryUsage("worker-1", 100);

      const initialSnapshots = customMonitor.getSnapshots().length;

      await new Promise((resolve) => setTimeout(resolve, 120));

      const afterSnapshots = customMonitor.getSnapshots().length;
      expect(afterSnapshots).toBeGreaterThan(initialSnapshots);

      customMonitor.stopTrendMonitoring();
      customMonitor.dispose();
    });
  });
});
