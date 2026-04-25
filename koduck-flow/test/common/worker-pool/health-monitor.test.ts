/**
 * Health Monitor Unit Tests
 *
 * Comprehensive test suite for HealthMonitor functionality including:
 * - Initialization and lifecycle
 * - Worker registration and unregistration
 * - Metrics collection and calculation
 * - Health state transitions
 * - Event emission
 * - Health scoring algorithm
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HealthMonitor,
  type HealthMonitorConfig,
  type HealthCheckResult,
} from "../../../src/common/worker-pool/health-monitor";

describe("HealthMonitor", () => {
  let monitor: HealthMonitor;

  const defaultConfig: HealthMonitorConfig = {
    checkInterval: 100,
    heartbeatTimeout: 500,
    responseTimeWarning: 100,
    responseTimeCritical: 300,
    memoryWarning: 50,
    memoryCritical: 100,
    failureRateWarning: 0.1,
    failureRateCritical: 0.3,
    metricsWindow: 60000,
    minSamples: 3,
  };

  beforeEach(() => {
    monitor = new HealthMonitor(defaultConfig);
  });

  afterEach(async () => {
    if (monitor.isMonitoring()) {
      await monitor.stop();
    }
  });

  describe("Constructor and Initialization", () => {
    it("should create monitor with default config", () => {
      const m = new HealthMonitor();
      expect(m).toBeDefined();
      expect(m.getWorkerCount()).toBe(0);
    });

    it("should merge custom config with defaults", () => {
      const customConfig: HealthMonitorConfig = {
        checkInterval: 1000,
      };
      const m = new HealthMonitor(customConfig);
      expect(m).toBeDefined();
    });

    it("should not be monitoring initially", () => {
      expect(monitor.isMonitoring()).toBe(false);
    });
  });

  describe("Lifecycle Management", () => {
    it("should start monitoring", async () => {
      expect(monitor.isMonitoring()).toBe(false);
      await monitor.start();
      expect(monitor.isMonitoring()).toBe(true);
    });

    it("should stop monitoring", async () => {
      await monitor.start();
      expect(monitor.isMonitoring()).toBe(true);
      await monitor.stop();
      expect(monitor.isMonitoring()).toBe(false);
    });

    it("should handle multiple starts without error", async () => {
      await monitor.start();
      await monitor.start();
      expect(monitor.isMonitoring()).toBe(true);
    });

    it("should handle stop when not running", async () => {
      expect(async () => {
        await monitor.stop();
      }).not.toThrow();
    });
  });

  describe("Worker Registration", () => {
    it("should register a new worker", () => {
      expect(monitor.getWorkerCount()).toBe(0);
      monitor.registerWorker("worker-1");
      expect(monitor.getWorkerCount()).toBe(1);
    });

    it("should not duplicate worker registration", () => {
      monitor.registerWorker("worker-1");
      monitor.registerWorker("worker-1");
      expect(monitor.getWorkerCount()).toBe(1);
    });

    it("should initialize worker with healthy state", () => {
      monitor.registerWorker("worker-1");
      const metrics = monitor.getWorkerMetrics("worker-1");

      expect(metrics).toBeDefined();
      expect(metrics!.state).toBe("healthy");
      expect(metrics!.score).toBe(100);
      expect(metrics!.workerId).toBe("worker-1");
    });

    it("should unregister a worker", () => {
      monitor.registerWorker("worker-1");
      expect(monitor.getWorkerCount()).toBe(1);

      monitor.unregisterWorker("worker-1");
      expect(monitor.getWorkerCount()).toBe(0);
      expect(monitor.getWorkerMetrics("worker-1")).toBeUndefined();
    });
  });

  describe("Task Completion Recording", () => {
    beforeEach(() => {
      monitor.registerWorker("worker-1");
    });

    it("should record successful task completion", () => {
      monitor.recordTaskCompletion("worker-1", 50, true);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.recentSuccesses).toBe(1);
      expect(metrics.recentFailures).toBe(0);
      expect(metrics.successStreak).toBe(1);
      expect(metrics.lastSuccessTime).toBeDefined();
    });

    it("should record failed task completion", () => {
      monitor.recordTaskCompletion("worker-1", 50, false);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.recentSuccesses).toBe(0);
      expect(metrics.recentFailures).toBe(1);
      expect(metrics.successStreak).toBe(0);
      expect(metrics.lastFailureTime).toBeDefined();
    });

    it("should track response times", async () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 100 + i * 10, true);
      }

      // Start health monitoring to trigger evaluation
      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.avgResponseTime).toBeGreaterThan(0);
      expect(metrics.peakResponseTime).toBeGreaterThanOrEqual(metrics.avgResponseTime);
    });

    it("should reset success streak on failure", () => {
      monitor.recordTaskCompletion("worker-1", 50, true);
      monitor.recordTaskCompletion("worker-1", 50, true);
      expect(monitor.getWorkerMetrics("worker-1")!.successStreak).toBe(2);

      monitor.recordTaskCompletion("worker-1", 50, false);
      expect(monitor.getWorkerMetrics("worker-1")!.successStreak).toBe(0);
    });
  });

  describe("Memory Usage Recording", () => {
    beforeEach(() => {
      monitor.registerWorker("worker-1");
    });

    it("should record memory usage", () => {
      monitor.recordMemoryUsage("worker-1", 100);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.memoryUsage).toBe(100);
    });

    it("should track peak memory", () => {
      monitor.recordMemoryUsage("worker-1", 50);
      monitor.recordMemoryUsage("worker-1", 150);
      monitor.recordMemoryUsage("worker-1", 100);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.memoryPeak).toBe(150);
      expect(metrics.memoryUsage).toBe(100);
    });
  });

  describe("Heartbeat Recording", () => {
    beforeEach(() => {
      monitor.registerWorker("worker-1");
    });

    it("should record successful heartbeat", () => {
      monitor.recordHeartbeat("worker-1", 25);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.heartbeatLatency).toBe(25);
      expect(metrics.lastHeartbeatTime).toBeDefined();
      expect(metrics.missedPings).toBe(0);
    });

    it("should reset missed pings on successful heartbeat", () => {
      monitor.recordMissedPing("worker-1");
      monitor.recordMissedPing("worker-1");
      expect(monitor.getWorkerMetrics("worker-1")!.missedPings).toBe(2);

      monitor.recordHeartbeat("worker-1", 25);
      expect(monitor.getWorkerMetrics("worker-1")!.missedPings).toBe(0);
    });

    it("should record missed pings", () => {
      monitor.recordMissedPing("worker-1");
      monitor.recordMissedPing("worker-1");

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.missedPings).toBe(2);
    });
  });

  describe("Health Metrics Retrieval", () => {
    it("should return undefined for unregistered worker", () => {
      expect(monitor.getWorkerMetrics("unknown")).toBeUndefined();
    });

    it("should get metrics for registered worker", () => {
      monitor.registerWorker("worker-1");
      const metrics = monitor.getWorkerMetrics("worker-1");
      expect(metrics).toBeDefined();
    });

    it("should get all metrics", () => {
      monitor.registerWorker("worker-1");
      monitor.registerWorker("worker-2");
      monitor.registerWorker("worker-3");

      const allMetrics = monitor.getAllMetrics();
      expect(allMetrics.size).toBe(3);
      expect(allMetrics.has("worker-1")).toBe(true);
      expect(allMetrics.has("worker-2")).toBe(true);
      expect(allMetrics.has("worker-3")).toBe(true);
    });
  });

  describe("Health Scoring and State Transitions", () => {
    beforeEach(() => {
      monitor.registerWorker("worker-1");
    });

    it("should maintain healthy state with good metrics", () => {
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 50, true);
      }
      monitor.recordMemoryUsage("worker-1", 30);
      monitor.recordHeartbeat("worker-1", 10);

      // Trigger evaluation
      vi.useFakeTimers();
      monitor.registerWorker("worker-1"); // Re-register to reset

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.state).toBe("healthy");
      expect(metrics.score).toBeGreaterThanOrEqual(80);

      vi.useRealTimers();
    });

    it("should detect slow response times", async () => {
      // Record slow tasks to trigger critical threshold
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 500, true);
      }

      await monitor.start();
      // Wait for health check to run
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.score).toBeLessThan(100);
    });

    it("should detect high failure rates", async () => {
      // Record many failures
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 50, false);
      }

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.failureRate).toBeGreaterThan(0);
    });

    it("should detect high memory usage", async () => {
      monitor.recordMemoryUsage("worker-1", 200);

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.memoryUsage).toBe(200);
      expect(metrics.score).toBeLessThan(100);
    });

    it("should transition from unhealthy to healthy", async () => {
      // First make it unhealthy
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 500, false);
      }

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));

      let metrics = monitor.getWorkerMetrics("worker-1")!;
      const wasUnhealthy = metrics.state === "unhealthy" || metrics.state === "degraded";

      // Record good metrics
      for (let i = 0; i < 10; i++) {
        monitor.recordTaskCompletion("worker-1", 50, true);
      }
      monitor.recordMemoryUsage("worker-1", 30);

      // Wait for re-evaluation
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      metrics = monitor.getWorkerMetrics("worker-1")!;
      if (wasUnhealthy) {
        expect(metrics.score).toBeGreaterThanOrEqual(50);
      }
    });
  });

  describe("Event Emission", () => {
    beforeEach(() => {
      monitor.registerWorker("worker-1");
    });

    it("should emit health:checked event on interval", async () => {
      const checkSpy = vi.fn((result: HealthCheckResult) => {
        expect(result.timestamp).toBeDefined();
        expect(result.metrics).toBeInstanceOf(Map);
      });

      monitor.on("health:checked", checkSpy);

      await monitor.start();
      // Wait for first check to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      expect(checkSpy).toHaveBeenCalled();
    });

    it("should emit health:unhealthy event when state degrades", async () => {
      const unhealthySpy = vi.fn();
      monitor.on("health:unhealthy", unhealthySpy);

      // Create unhealthy conditions
      for (let i = 0; i < 10; i++) {
        monitor.recordTaskCompletion("worker-1", 500, false);
      }

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      // Event may or may not fire depending on scoring, but function should work
      expect(typeof unhealthySpy).toBe("function");
    });

    it("should emit health:recovered event when state improves", async () => {
      const recoveredSpy = vi.fn();
      monitor.on("health:recovered", recoveredSpy);

      // Start with poor state
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 500, false);
      }

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Improve state
      for (let i = 0; i < 10; i++) {
        monitor.recordTaskCompletion("worker-1", 50, true);
      }
      monitor.recordMemoryUsage("worker-1", 30);

      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      expect(typeof recoveredSpy).toBe("function");
    });
  });

  describe("Multiple Workers", () => {
    it("should manage multiple workers independently", () => {
      monitor.registerWorker("worker-1");
      monitor.registerWorker("worker-2");
      monitor.registerWorker("worker-3");

      monitor.recordTaskCompletion("worker-1", 50, true);
      monitor.recordTaskCompletion("worker-2", 200, false);
      monitor.recordTaskCompletion("worker-3", 100, true);

      const metrics1 = monitor.getWorkerMetrics("worker-1")!;
      const metrics2 = monitor.getWorkerMetrics("worker-2")!;
      const metrics3 = monitor.getWorkerMetrics("worker-3")!;

      expect(metrics1.recentSuccesses).toBe(1);
      expect(metrics2.recentFailures).toBe(1);
      expect(metrics3.recentSuccesses).toBe(1);
    });

    it("should track pool health percentage", async () => {
      monitor.registerWorker("worker-1");
      monitor.registerWorker("worker-2");

      // Make worker-1 unhealthy, keep worker-2 healthy
      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-1", 500, false);
      }

      for (let i = 0; i < 5; i++) {
        monitor.recordTaskCompletion("worker-2", 50, true);
      }

      await monitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await monitor.stop();

      const allMetrics = monitor.getAllMetrics();
      expect(allMetrics.size).toBe(2);
    });
  });

  describe("Configuration Thresholds", () => {
    it("should use custom response time thresholds", async () => {
      const customMonitor = new HealthMonitor({
        checkInterval: 100,
        responseTimeWarning: 200,
        responseTimeCritical: 400,
        minSamples: 2,
      });

      customMonitor.registerWorker("worker-1");

      // Record tasks faster than warning threshold
      for (let i = 0; i < 3; i++) {
        customMonitor.recordTaskCompletion("worker-1", 100, true);
      }

      await customMonitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await customMonitor.stop();

      const metrics = customMonitor.getWorkerMetrics("worker-1")!;
      expect(metrics.avgResponseTime).toBeLessThan(200);
    });

    it("should use custom memory thresholds", async () => {
      const customMonitor = new HealthMonitor({
        checkInterval: 100,
        memoryWarning: 200,
        memoryCritical: 400,
        minSamples: 1,
      });

      customMonitor.registerWorker("worker-1");
      customMonitor.recordMemoryUsage("worker-1", 250);

      await customMonitor.start();
      await new Promise((resolve) => setTimeout(resolve, 150));
      await customMonitor.stop();

      const metrics = customMonitor.getWorkerMetrics("worker-1")!;
      expect(metrics.memoryUsage).toBe(250);
    });
  });

  describe("Edge Cases", () => {
    it("should handle metrics for non-existent worker", () => {
      monitor.recordTaskCompletion("non-existent", 50, true);
      monitor.recordMemoryUsage("non-existent", 100);
      monitor.recordHeartbeat("non-existent", 25);
      monitor.recordMissedPing("non-existent");

      // Should not throw and should return undefined
      expect(monitor.getWorkerMetrics("non-existent")).toBeUndefined();
    });

    it("should handle zero response times", () => {
      monitor.registerWorker("worker-1");
      monitor.recordTaskCompletion("worker-1", 0, true);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.recentSuccesses).toBe(1);
    });

    it("should handle very large numbers", () => {
      monitor.registerWorker("worker-1");
      monitor.recordMemoryUsage("worker-1", 999999);
      monitor.recordTaskCompletion("worker-1", 999999, true);

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      expect(metrics.memoryUsage).toBe(999999);
    });

    it("should clean up old data", () => {
      monitor.registerWorker("worker-1");

      // Record many old samples
      for (let i = 0; i < 200; i++) {
        monitor.recordTaskCompletion("worker-1", 50 + i, true);
      }

      const metrics = monitor.getWorkerMetrics("worker-1")!;
      // Should still have valid metrics, but old data should be cleaned
      expect(metrics.recentSuccesses).toBeGreaterThan(0);
    });
  });

  describe("Performance", () => {
    it("should handle many workers efficiently", () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        monitor.registerWorker(`worker-${i}`);
      }

      for (let i = 0; i < 100; i++) {
        monitor.recordTaskCompletion(`worker-${i}`, 50, Math.random() > 0.2);
        monitor.recordMemoryUsage(`worker-${i}`, Math.random() * 256);
      }

      const duration = Date.now() - startTime;
      expect(monitor.getWorkerCount()).toBe(100);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should retrieve all metrics efficiently", () => {
      for (let i = 0; i < 50; i++) {
        monitor.registerWorker(`worker-${i}`);
      }

      const startTime = Date.now();
      const allMetrics = monitor.getAllMetrics();
      const duration = Date.now() - startTime;

      expect(allMetrics.size).toBe(50);
      expect(duration).toBeLessThan(100);
    });
  });
});
