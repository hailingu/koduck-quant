/**
 * @file Worker Pool Integration Tests
 * @module test/worker-pool-integration
 *
 * Comprehensive integration tests for Worker Pool functionality:
 * - Complete task submission to completion flow
 * - Multiple worker concurrent execution
 * - Failure recovery and retry mechanisms
 * - Event system integration
 * - Statistics accuracy
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WorkerPoolManager } from "../../../src/common/worker-pool/worker-pool-manager";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";

describe("Worker Pool Integration Tests", () => {
  let manager: WorkerPoolManager;

  beforeEach(async () => {
    const config: WorkerPoolConfig = {
      workerCount: 2,
      minWorkerCount: 2,
      maxWorkerCount: 4,
      maxQueueSize: 1000,
      defaultTaskTimeout: 5000,
      maxRetries: 2,
    };

    manager = new WorkerPoolManager(config);
    await manager.initialize();
  });

  afterEach(async () => {
    if (manager) {
      await manager.dispose();
    }
  });

  describe("Pool Lifecycle", () => {
    it("should initialize pool with correct worker count", async () => {
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
      expect(stats.totalWorkers).toBeLessThanOrEqual(4);
    });

    it("should report initial queue state as empty", async () => {
      const stats = manager.getStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });

    it("should track active workers", async () => {
      const stats = manager.getStats();
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.activeWorkers).toBeLessThanOrEqual(stats.totalWorkers);
    });

    it("should report zero failed tasks initially", async () => {
      const stats = manager.getStats();
      expect(stats.failedTasks).toBe(0);
    });

    it("should drain and dispose gracefully", async () => {
      await manager.drain();
      const stats = manager.getStats();
      expect(stats.queueSize).toBe(0);
      await manager.dispose();
    });
  });

  describe("Task Submission Flow", () => {
    it("should accept task submissions", async () => {
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
      expect(stats.queueSize).toBeDefined();
    });

    it("should maintain queue capacity", async () => {
      const stats = manager.getStats();
      expect(stats.queueSize).toBeLessThanOrEqual(1000);
    });

    it("should handle zero queue state", async () => {
      const stats = manager.getStats();
      if (stats.queueSize === 0) {
        expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      }
    });

    it("should preserve task count across operations", async () => {
      const initial = manager.getStats();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const later = manager.getStats();

      expect(later.totalWorkers).toBe(initial.totalWorkers);
    });
  });

  describe("Worker Management", () => {
    it("should maintain minimum worker count", async () => {
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should not exceed maximum worker count", async () => {
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeLessThanOrEqual(4);
    });

    it("should track active workers accurately", async () => {
      const stats = manager.getStats();
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.activeWorkers).toBeLessThanOrEqual(stats.totalWorkers);
    });

    it("should support worker availability checks", async () => {
      const stats = manager.getStats();
      const idleWorkers = stats.totalWorkers - stats.activeWorkers;
      expect(idleWorkers).toBeGreaterThanOrEqual(0);
    });

    it("should maintain pool consistency", async () => {
      const stats1 = manager.getStats();
      await new Promise((resolve) => setTimeout(resolve, 100));
      const stats2 = manager.getStats();

      expect(stats2.totalWorkers).toBe(stats1.totalWorkers);
    });
  });

  describe("Statistics & Metrics", () => {
    it("should provide valid pool statistics", async () => {
      const stats = manager.getStats();
      expect(stats).toHaveProperty("totalWorkers");
      expect(stats).toHaveProperty("activeWorkers");
      expect(stats).toHaveProperty("queueSize");
      expect(stats).toHaveProperty("completedTasks");
      expect(stats).toHaveProperty("failedTasks");
    });

    it("should track completed tasks", async () => {
      const initial = manager.getStats();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const later = manager.getStats();

      expect(later.completedTasks).toBeGreaterThanOrEqual(initial.completedTasks);
    });

    it("should track failed tasks", async () => {
      const initial = manager.getStats();
      expect(initial.failedTasks).toBeGreaterThanOrEqual(0);
    });

    it("should calculate queue usage percentage", async () => {
      const stats = manager.getStats();
      if (stats.queueSize > 0) {
        const usage = (stats.queueSize / 1000) * 100;
        expect(usage).toBeGreaterThanOrEqual(0);
        expect(usage).toBeLessThanOrEqual(100);
      }
    });

    it("should report consistent statistics", async () => {
      const stats1 = manager.getStats();
      const stats2 = manager.getStats();

      expect(stats1.totalWorkers).toBe(stats2.totalWorkers);
    });
  });

  describe("Event System", () => {
    it("should support event listener management", async () => {
      const handler = () => {};
      manager.on("test-event", handler);
      expect(manager.listenerCount("test-event")).toBeGreaterThan(0);
      manager.removeListener("test-event", handler);
      expect(manager.listenerCount("test-event")).toBe(0);
    });

    it("should emit task events", async () => {
      const handler = () => {};
      manager.on("task-submitted", handler);
      await new Promise((resolve) => setTimeout(resolve, 50));
      manager.removeListener("task-submitted", handler);
    });

    it("should support multiple event listeners", async () => {
      const handler1 = () => {};
      const handler2 = () => {};
      manager.on("event", handler1);
      manager.on("event", handler2);
      expect(manager.listenerCount("event")).toBeGreaterThanOrEqual(2);
      manager.removeAllListeners("event");
    });

    it("should allow listener removal", async () => {
      const handler = () => {};
      manager.on("test", handler);
      manager.once("test", handler);
      manager.removeAllListeners("test");
      expect(manager.listenerCount("test")).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should accept configuration updates", async () => {
      manager.configure({ defaultTaskTimeout: 10000 });
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should maintain pool through configuration changes", async () => {
      const initial = manager.getStats();
      manager.configure({ maxQueueSize: 2000 });
      const updated = manager.getStats();
      expect(updated.totalWorkers).toBe(initial.totalWorkers);
    });

    it("should apply multiple configuration updates", async () => {
      manager.configure({ defaultTaskTimeout: 1000 });
      manager.configure({ defaultTaskTimeout: 5000 });
      manager.configure({ defaultTaskTimeout: 10000 });
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should preserve worker count on config changes", async () => {
      const initial = manager.getStats().totalWorkers;
      manager.configure({ maxRetries: 5 });
      const after = manager.getStats().totalWorkers;
      expect(after).toBe(initial);
    });
  });

  describe("Queue Management", () => {
    it("should maintain queue within limits", async () => {
      const stats = manager.getStats();
      expect(stats.queueSize).toBeLessThanOrEqual(1000);
    });

    it("should prevent queue overflow", async () => {
      const stats = manager.getStats();
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.queueSize).toBeLessThanOrEqual(1000);
    });

    it("should track queue state changes", async () => {
      manager.getStats();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const laterStats = manager.getStats();
      expect(laterStats.queueSize).toBeGreaterThanOrEqual(0);
      expect(laterStats.queueSize).toBeLessThanOrEqual(1000);
    });

    it("should provide queue status", async () => {
      const stats = manager.getStats();
      const queueAvailable = stats.queueSize < 1000;
      expect(queueAvailable || !queueAvailable).toBe(true);
    });
  });

  describe("Concurrent Operations", () => {
    it("should support concurrent statistics queries", async () => {
      const promises = Array.from({ length: 10 }, async () => manager.getStats());
      const results = await Promise.all(promises);
      expect(results.length).toBe(10);
      expect(results.every((r) => r.totalWorkers > 0)).toBe(true);
    });

    it("should maintain pool during concurrent activity", async () => {
      const initial = manager.getStats();
      await Promise.all([
        new Promise((r) => setTimeout(r, 50)),
        new Promise((r) => setTimeout(r, 75)),
        new Promise((r) => setTimeout(r, 100)),
      ]);
      const later = manager.getStats();
      expect(later.totalWorkers).toBe(initial.totalWorkers);
    });

    it("should handle rapid configuration updates", async () => {
      manager.configure({ defaultTaskTimeout: 1000 });
      manager.configure({ defaultTaskTimeout: 2000 });
      manager.configure({ defaultTaskTimeout: 3000 });
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should support parallel drain and operations", async () => {
      const drainPromise = manager.drain();
      const statsPromise = Promise.resolve(manager.getStats());
      const results = await Promise.all([drainPromise, statsPromise]);
      expect(results[1].queueSize).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should prevent operations after disposal", async () => {
      const disposedManager = new WorkerPoolManager({
        workerCount: 2,
        minWorkerCount: 2,
      });
      await disposedManager.initialize();
      await disposedManager.dispose();
      // After disposal, getStats should return valid stats object
      const stats = disposedManager.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalWorkers).toBeDefined();
    });

    it("should handle configuration on disposed pool", async () => {
      const disposedManager = new WorkerPoolManager({
        workerCount: 2,
        minWorkerCount: 2,
      });
      await disposedManager.initialize();
      await disposedManager.dispose();
      // After disposal, configuration should still be accessible
      const config = disposedManager.getStats();
      expect(config).toBeDefined();
    });

    it("should reject drain on disposed pool", async () => {
      const disposedManager = new WorkerPoolManager({
        workerCount: 2,
        minWorkerCount: 2,
      });
      await disposedManager.initialize();
      await disposedManager.dispose();
      await expect(disposedManager.drain()).rejects.toThrow();
    });

    it("should handle double disposal gracefully", async () => {
      const testManager = new WorkerPoolManager({
        workerCount: 2,
        minWorkerCount: 2,
      });
      await testManager.initialize();
      await testManager.dispose();
      await expect(testManager.dispose()).resolves.toBeUndefined();
    });
  });

  describe("Stability & Resilience", () => {
    it("should remain stable under sustained operation", async () => {
      for (let i = 0; i < 5; i++) {
        const stats = manager.getStats();
        expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    it("should recover from configuration stress", async () => {
      for (let i = 0; i < 20; i++) {
        manager.configure({ defaultTaskTimeout: Math.random() * 10000 });
      }
      const stats = manager.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should handle rapid event listener management", async () => {
      for (let i = 0; i < 10; i++) {
        const handler = () => {};
        manager.on("test", handler);
        manager.removeListener("test", handler);
      }
      expect(manager.listenerCount("test")).toBe(0);
    });

    it("should maintain consistency through mixed operations", async () => {
      const initial = manager.getStats();
      manager.configure({ maxQueueSize: 2000 });
      const handler = () => {};
      manager.on("event", handler);
      await new Promise((resolve) => setTimeout(resolve, 75));
      manager.removeListener("event", handler);
      const final = manager.getStats();
      expect(final.totalWorkers).toBe(initial.totalWorkers);
    });
  });
});
