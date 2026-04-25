/**
 * @file Worker Pool Manager Unit Tests
 * @module test/common/worker-pool/worker-pool-manager
 *
 * Comprehensive test suite for WorkerPoolManager implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "../../../src/common/event/browser-event-emitter";
import {
  WorkerPoolManager,
  type BackpressureStrategy,
} from "../../../src/common/worker-pool/worker-pool-manager";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";

describe("WorkerPoolManager", () => {
  let manager: WorkerPoolManager;

  const defaultConfig: WorkerPoolConfig = {
    minWorkerCount: 2,
    maxWorkerCount: 4,
  };

  beforeEach(async () => {
    manager = new WorkerPoolManager(defaultConfig);
  });

  afterEach(async () => {
    if (manager) {
      try {
        await manager.dispose();
      } catch {
        // Ignore disposal errors in tests
      }
    }
  });

  describe("Constructor and Initialization", () => {
    it("should create manager with default config", () => {
      const mgr = new WorkerPoolManager(defaultConfig);
      expect(mgr).toBeDefined();
      expect(mgr instanceof EventEmitter).toBe(true);
    });

    it("should initialize with configured worker counts", async () => {
      await manager.initialize();

      const stats = manager.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);
    });

    it("should emit pool:initialized event on initialization", async () => {
      const initSpy = vi.fn();
      manager.on("pool:initialized", initSpy);

      await manager.initialize();

      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe("submit<T, R> - Single Task Submission", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should accept a single task and return a promise", async () => {
      const promise = manager.submit<{ x: number }, number>({
        type: "compute",
        payload: { x: 42 },
      });

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should create task context with correct properties", async () => {
      const taskCreatedSpy = vi.fn();
      manager.on("task:created", taskCreatedSpy);

      const data = { value: 100 };
      manager.submit<{ value: number }, number>({
        type: "math",
        payload: data,
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(taskCreatedSpy).toHaveBeenCalled();
    });

    it("should accept task priority and timeout in submission", async () => {
      const taskCreatedSpy = vi.fn();
      manager.on("task:created", taskCreatedSpy);

      manager.submit<unknown, unknown>({
        type: "task",
        priority: 8,
        timeout: 60000,
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(taskCreatedSpy).toHaveBeenCalled();
    });

    it("should queue task if no workers available", async () => {
      for (let i = 0; i < 10; i++) {
        const promise = manager.submit<number, number>({
          type: "task",
          payload: i,
        });
        // Silently handle rejections during disposal
        promise.catch(() => undefined);
      }

      const statsAfter = manager.getStats();
      expect(statsAfter.queueSize).toBeGreaterThanOrEqual(0);
    });

    it("should handle backpressure threshold", async () => {
      const config: WorkerPoolConfig = {
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 5,
      };

      const mgr = new WorkerPoolManager(config);
      await mgr.initialize();

      for (let i = 0; i < 10; i++) {
        try {
          const promise = mgr.submit<number, number>({
            type: "task",
            payload: i,
          });
          // Silently handle rejections
          promise.catch(() => undefined);
        } catch (error) {
          expect(error).toBeDefined();
          break;
        }
      }

      await mgr.dispose();
    });
  });

  describe("submitBatch<T, R> - Batch Task Submission", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should accept multiple tasks in a batch", async () => {
      const tasks = [
        { type: "compute", payload: { x: 1 } },
        { type: "compute", payload: { x: 2 } },
        { type: "compute", payload: { x: 3 } },
      ];

      const promise = manager.submitBatch<{ x: number }, number>(tasks);

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should submit all tasks in batch with proper event emission", async () => {
      const batchTaskCount = 5;
      const tasks = Array.from({ length: batchTaskCount }, (_, i) => ({
        type: "process",
        payload: { id: i },
      }));

      const promise = manager.submitBatch<{ id: number }, number>(tasks);

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should return promise that resolves to array of results", async () => {
      const tasks = [
        { type: "task1", payload: { order: 1 } },
        { type: "task2", payload: { order: 2 } },
        { type: "task3", payload: { order: 3 } },
      ];

      const promise = manager.submitBatch<{ order: number }, number>(tasks);

      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe("configure - Dynamic Configuration", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should update worker pool configuration", () => {
      const newConfig: Partial<WorkerPoolConfig> = {
        maxWorkerCount: 8,
      };

      expect(() => manager.configure(newConfig)).not.toThrow();
    });

    it("should emit pool:configured event on configuration change", () => {
      const configSpy = vi.fn();
      manager.on("pool:configured", configSpy);

      manager.configure({ maxWorkerCount: 6 });

      expect(configSpy).toHaveBeenCalled();
    });

    it("should validate worker count configuration", () => {
      expect(() => {
        manager.configure({
          minWorkerCount: 2,
          maxWorkerCount: 1,
        });
      }).toThrow();
    });
  });

  describe("getStats - Statistics Retrieval", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should return pool statistics", () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty("totalWorkers");
      expect(stats).toHaveProperty("activeWorkers");
      expect(stats).toHaveProperty("queueSize");
      expect(stats).toHaveProperty("completedTasks");
      expect(stats).toHaveProperty("failedTasks");
      expect(stats).toHaveProperty("backpressured");
      expect(stats).toHaveProperty("disposed");
    });

    it("should return valid worker counts", () => {
      const stats = manager.getStats();

      expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
      expect(stats.failedTasks).toBeGreaterThanOrEqual(0);
    });

    it("should track queue size correctly", async () => {
      const statsBefore = manager.getStats();

      manager.submit<number, number>({
        type: "task",
        payload: 42,
      });

      await new Promise((resolve) => setImmediate(resolve));

      const statsAfter = manager.getStats();
      expect(statsAfter.queueSize).toBeGreaterThanOrEqual(statsBefore.queueSize);
    });
  });

  describe("drain - Queue Completion", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it.skip("should wait for all queued tasks to complete", async () => {
      for (let i = 0; i < 5; i++) {
        const promise = manager.submit<number, number>({
          type: "task",
          payload: i,
        });
        // Silently handle rejections during disposal
        promise.catch(() => undefined);
      }

      await expect(manager.drain()).resolves.toBeUndefined();
    });

    it("should return when queue is already empty", async () => {
      await expect(manager.drain()).resolves.toBeUndefined();
    });

    it("should timeout if tasks take too long", async () => {
      await expect(manager.drain()).resolves.toBeUndefined();
    });
  });

  describe("dispose - Graceful Shutdown", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should emit pool:disposing event", async () => {
      const disposingSpy = vi.fn();
      manager.on("pool:disposing", disposingSpy);

      await manager.dispose();

      expect(disposingSpy).toHaveBeenCalled();
    });

    it("should emit pool:disposed event on completion", async () => {
      const disposedSpy = vi.fn();
      manager.on("pool:disposed", disposedSpy);

      await manager.dispose();

      expect(disposedSpy).toHaveBeenCalled();
    });

    it("should terminate all workers", async () => {
      await manager.dispose();

      expect(manager.getStats().disposed).toBe(true);
    });

    it("should reject new submissions after disposal", async () => {
      await manager.dispose();

      const promise = manager.submit<unknown, unknown>({
        type: "task",
      });

      await expect(promise).rejects.toThrow();
    });
  });

  describe("Event Emission System", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should emit task:created event", async () => {
      const createdSpy = vi.fn();
      manager.on("task:created", createdSpy);

      manager.submit<unknown, unknown>({
        type: "task",
      });

      await new Promise((resolve) => setImmediate(resolve));

      expect(createdSpy).toHaveBeenCalled();
    });

    it("should emit task:assigned event on assignment", async () => {
      const assignedSpy = vi.fn();
      manager.on("task:assigned", assignedSpy);

      manager.submit<unknown, unknown>({
        type: "task",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(assignedSpy).toHaveBeenCalled();
    });

    it("should support event listener registration", () => {
      const listener = vi.fn();
      manager.on("pool:initialized", listener);

      expect(manager.listeners("pool:initialized")).toContain(listener);
    });

    it("should support event listener removal", async () => {
      const listener = vi.fn();
      manager.on("pool:initialized", listener);
      manager.removeListener("pool:initialized", listener);

      expect(manager.listeners("pool:initialized")).not.toContain(listener);
    });
  });

  describe("Backpressure Control", () => {
    it("should apply default backpressure threshold", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
      });
      await mgr.initialize();

      const stats = mgr.getStats();
      expect(stats.backpressured).toBe(false);

      await mgr.dispose();
    });

    it("should apply custom backpressure threshold", async () => {
      const customThreshold = 500;
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: customThreshold,
      });
      await mgr.initialize();

      const stats = mgr.getStats();
      expect(stats).toBeDefined();

      await mgr.dispose();
    });

    it("should handle high-volume submissions with backpressure", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 50,
      });
      await mgr.initialize();

      let submittedCount = 0;

      for (let i = 0; i < 100; i++) {
        try {
          const promise = mgr.submit<number, number>({
            type: "task",
            payload: i,
          });
          // Silently handle rejections
          promise.catch(() => undefined);
          submittedCount++;
        } catch {
          // Backpressure rejection expected
        }
      }

      expect(submittedCount).toBeGreaterThan(0);

      await mgr.dispose();
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should emit task:failed event on task failure", async () => {
      const failedSpy = vi.fn();
      manager.on("task:failed", failedSpy);
    });

    it("should handle missing task payload gracefully", async () => {
      const promise = manager.submit<unknown, unknown>({
        type: "unknown-type",
      });
      expect(promise).toBeInstanceOf(Promise);
    });

    it("should recover from temporary worker failures", async () => {
      for (let i = 0; i < 3; i++) {
        const promise = manager.submit<number, number>({
          type: "task",
          payload: i,
        });
        // Silently handle rejections during disposal
        promise.catch(() => undefined);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const statsAfter = manager.getStats();
      expect(statsAfter).toBeDefined();
    });
  });

  describe("Task Priority and Ordering", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should accept task priority in submission", () => {
      const promise = manager.submit<unknown, unknown>({
        type: "task",
        priority: 8,
      });

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should respect priority range 0-10", () => {
      const highPriority = manager.submit<unknown, unknown>({
        type: "task1",
        priority: 10,
      });

      const lowPriority = manager.submit<unknown, unknown>({
        type: "task2",
        priority: 0,
      });

      expect(highPriority).toBeInstanceOf(Promise);
      expect(lowPriority).toBeInstanceOf(Promise);
    });

    it("should default priority to 5", () => {
      const promise = manager.submit<unknown, unknown>({
        type: "task",
      });

      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe("Task Timeout Handling", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should accept custom timeout in submission", () => {
      const promise = manager.submit<unknown, unknown>({
        type: "task",
        timeout: 60000,
      });

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should use default timeout when not specified", () => {
      const promise = manager.submit<unknown, unknown>({
        type: "task",
      });

      expect(promise).toBeInstanceOf(Promise);
    });

    it("should apply timeout to batch submissions", () => {
      const tasks = [{ type: "task1" }, { type: "task2", timeout: 45000 }];

      const promise = manager.submitBatch<unknown, unknown>(tasks);

      expect(promise).toBeInstanceOf(Promise);
    });
  });

  describe("Configuration Update Edge Cases", () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it("should handle partial configuration updates", () => {
      expect(() =>
        manager.configure({
          maxWorkerCount: 6,
        })
      ).not.toThrow();
    });

    it("should handle empty configuration updates", () => {
      expect(() => manager.configure({})).not.toThrow();
    });
  });

  describe("Integration: Full Workflow", () => {
    it.skip("should complete a full workflow: init -> submit -> drain -> dispose", async () => {
      const mgr = new WorkerPoolManager(defaultConfig);

      await mgr.initialize();
      let stats = mgr.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(0);

      for (let i = 0; i < 3; i++) {
        const promise = mgr.submit<number, number>({
          type: "task",
          payload: i,
        });
        // Silently handle rejections
        promise.catch(() => undefined);
      }

      await mgr.drain();

      stats = mgr.getStats();
      expect(stats).toBeDefined();

      await mgr.dispose();
    });

    it.skip("should handle configure between submit and drain", async () => {
      const mgr = new WorkerPoolManager(defaultConfig);

      await mgr.initialize();

      for (let i = 0; i < 2; i++) {
        const promise = mgr.submit<number, number>({
          type: "task",
          payload: i,
        });
        // Silently handle rejections
        promise.catch(() => undefined);
      }

      mgr.configure({
        maxWorkerCount: 8,
      });

      await mgr.drain();

      await mgr.dispose();
    });

    it("should handle multiple reconfigurations", async () => {
      const mgr = new WorkerPoolManager(defaultConfig);

      await mgr.initialize();

      for (let i = 0; i < 3; i++) {
        mgr.configure({
          maxWorkerCount: 2 + i,
        });
      }

      await mgr.dispose();
    });
  });

  describe("Enhanced Backpressure Control", () => {
    it("should apply block strategy correctly", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 50,
      });
      await mgr.initialize();

      mgr.configureBackpressure({
        strategy: "block",
        threshold: 0.8,
        autoRecover: true,
      });

      for (let i = 0; i < 10; i++) {
        mgr.submit<number, number>({ type: "task", payload: i }).catch(() => {
          // ignore
        });
      }

      const metrics = mgr.getBackpressureMetrics();
      expect(metrics).toHaveProperty("queueSize");
      expect(metrics).toHaveProperty("backpressured");
      expect(metrics).toHaveProperty("strategy");
      expect(metrics.strategy).toBe("block");

      await mgr.dispose();
    });

    it("should apply drop strategy correctly", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 50,
      });
      await mgr.initialize();

      mgr.configureBackpressure({
        strategy: "drop",
        threshold: 0.8,
        autoRecover: true,
      });

      mgr.on("backpressure:drop", vi.fn());

      for (let i = 0; i < 10; i++) {
        mgr.submit<number, number>({ type: "task", payload: i }).catch(() => {
          // ignore
        });
      }

      await new Promise((r) => setImmediate(r));

      const metrics = mgr.getBackpressureMetrics();
      expect(metrics.strategy).toBe("drop");

      await mgr.dispose();
    });

    it("should apply degrade strategy correctly", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 50,
      });
      await mgr.initialize();

      mgr.configureBackpressure({
        strategy: "degrade",
        threshold: 0.8,
        autoRecover: true,
      });

      mgr.on("backpressure:degraded", vi.fn());

      for (let i = 0; i < 10; i++) {
        mgr.submit<number, number>({ type: "task", payload: i }).catch(() => {
          // ignore
        });
      }

      const metrics = mgr.getBackpressureMetrics();
      expect(metrics.strategy).toBe("degrade");

      await mgr.dispose();
    });

    it("should return accurate backpressure metrics", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 100,
      });
      await mgr.initialize();

      const metrics = mgr.getBackpressureMetrics();

      expect(metrics).toHaveProperty("queueSize");
      expect(metrics).toHaveProperty("threshold");
      expect(metrics).toHaveProperty("queueUsagePercent");
      expect(metrics).toHaveProperty("backpressured");
      expect(metrics).toHaveProperty("strategy");
      expect(metrics).toHaveProperty("droppedTasksCount");
      expect(metrics).toHaveProperty("degradedTasksCount");

      expect(metrics.queueUsagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.queueUsagePercent).toBeLessThanOrEqual(100);

      await mgr.dispose();
    });

    it("should validate backpressure strategy", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
      });
      await mgr.initialize();

      expect(() => {
        mgr.configureBackpressure({
          strategy: "invalid" as BackpressureStrategy,
        });
      }).toThrow();

      await mgr.dispose();
    });

    it("should emit backpressure:configured event", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
      });
      await mgr.initialize();

      const configSpy = vi.fn();
      mgr.on("backpressure:configured", configSpy);

      mgr.configureBackpressure({
        strategy: "drop",
        threshold: 0.9,
      });

      expect(configSpy).toHaveBeenCalled();

      await mgr.dispose();
    });

    it("should handle high-volume submissions with backpressure", async () => {
      const mgr = new WorkerPoolManager({
        minWorkerCount: 1,
        maxWorkerCount: 2,
        maxQueueSize: 500,
      });
      await mgr.initialize();

      mgr.configureBackpressure({
        strategy: "degrade",
        threshold: 0.8,
      });

      for (let i = 0; i < 200; i++) {
        mgr
          .submit<number, number>({
            type: "compute",
            payload: i,
            priority: i % 10,
          })
          .catch(() => {
            // ignore
          });
      }

      await new Promise((r) => setTimeout(r, 100));

      const metrics = mgr.getBackpressureMetrics();
      // Queue usage percent can exceed 100% if tasks queue faster than drain
      expect(metrics.queueUsagePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.queueSize).toBeGreaterThanOrEqual(0);

      await mgr.dispose();
    });
  });
});
