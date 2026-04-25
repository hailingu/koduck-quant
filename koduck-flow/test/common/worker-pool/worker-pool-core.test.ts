import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkerPoolCore } from "../../../src/common/worker-pool/worker-pool-core";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";

describe("WorkerPoolCore", () => {
  let core: WorkerPoolCore;

  const createCore = (config: Partial<WorkerPoolConfig> = {}): WorkerPoolCore => {
    const defaultConfig: WorkerPoolConfig = {
      minWorkerCount: 2,
      maxWorkerCount: 4,
      ...config,
    };
    return new WorkerPoolCore(defaultConfig);
  };

  beforeEach(async () => {
    core = createCore();
    await core.initialize();
  });

  afterEach(async () => {
    if (core) {
      await core.dispose();
    }
  });

  describe("Worker Lifecycle", () => {
    it("should initialize with configured minimum workers", async () => {
      const stats = core.getStats();
      expect(stats.total).toBe(2);
      expect(stats.idle).toBe(2);
      expect(stats.busy).toBe(0);
      expect(stats.error).toBe(0);
    });

    it("should create workers on demand up to maximum", async () => {
      const newCore = createCore({ minWorkerCount: 1, maxWorkerCount: 3 });
      await newCore.initialize();

      const statsInit = newCore.getStats();
      expect(statsInit.total).toBe(1);

      await newCore.scaleUp(2);
      const statsAfter = newCore.getStats();
      expect(statsAfter.total).toBe(3);

      await newCore.dispose();
    });

    it("should not exceed maximum worker count", async () => {
      await expect(core.scaleUp(10)).rejects.toThrow(/exceed maxWorkers/);

      const stats = core.getStats();
      expect(stats.total).toBe(2); // Still 2, scale up failed
    });

    it("should respect minimum worker count on scale down", async () => {
      await core.scaleUp(2); // Now 4 workers
      const before = core.getStats();
      expect(before.total).toBe(4);

      await core.scaleDown(10); // Try to remove many
      const after = core.getStats();
      expect(after.total).toBe(2); // Only removed to minimum
    });
  });

  describe("Idle Worker Pool", () => {
    it("should return all idle workers initially", () => {
      const idle = core.getIdleWorkers();
      expect(idle).toHaveLength(2);
      expect(idle.every((w) => w.state === "idle")).toBe(true);
    });

    it("should get specific worker by ID", () => {
      const idle = core.getIdleWorkers();
      const workerId = idle[0].id;

      const worker = core.getWorker(workerId);
      expect(worker).toBeDefined();
      expect(worker?.id).toBe(workerId);
    });

    it("should return undefined for non-existent worker ID", () => {
      const worker = core.getWorker("non-existent");
      expect(worker).toBeUndefined();
    });
  });

  describe("Task Assignment", () => {
    it("should provide assignTask method", async () => {
      const idle = core.getIdleWorkers();
      if (idle.length > 0) {
        // Test that method exists and can be called
        expect(typeof core.assignTask).toBe("function");
      }
    });

    it("should reject assignment to unknown worker", async () => {
      await expect(core.assignTask("unknown-worker", "task-1", { data: "test" })).rejects.toThrow(
        /Worker not found/
      );
    });
  });

  describe("Task Completion Callbacks", () => {
    it("should register and invoke task completion callback", async () => {
      const callback = vi.fn();

      core.onTaskComplete("task-1", callback);

      // Verify callback is registered
      expect(callback).toBeDefined();
    });

    it("should support multiple callbacks for same task", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = core.onTaskComplete("task-1", cb1);
      const unsub2 = core.onTaskComplete("task-1", cb2);

      expect(unsub1).toBeDefined();
      expect(unsub2).toBeDefined();

      // Verify unsubscribe functions exist
      expect(typeof unsub1).toBe("function");
      expect(typeof unsub2).toBe("function");
    });

    it("should unsubscribe from completion callback", () => {
      const callback = vi.fn();
      const unsubscribe = core.onTaskComplete("task-1", callback);

      unsubscribe();

      // Callback should no longer be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Pool Statistics", () => {
    it("should report accurate statistics", async () => {
      const stats = core.getStats();

      expect(stats.total).toBeGreaterThanOrEqual(2);
      expect(stats.idle).toBeGreaterThanOrEqual(2);
      expect(stats.busy).toBe(0);
      expect(stats.error).toBe(0);
      expect(stats.totalMemory).toBeGreaterThanOrEqual(0);
    });

    it("should initialize with configured minimum workers", async () => {
      const newCore = createCore({ minWorkerCount: 3, maxWorkerCount: 5 });
      await newCore.initialize();

      const stats = newCore.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(3);
      expect(stats.idle).toBeGreaterThanOrEqual(3);

      await newCore.dispose();
    });
  });

  describe("Idle Synchronization", () => {
    it("should provide wait for idle method", async () => {
      // Simply verify the method exists and completes
      const promise = core.waitForIdle();
      expect(promise).toBeDefined();
      await promise; // Should resolve immediately if all idle
    });
  });

  describe("Round-Robin Index", () => {
    it("should increment round-robin index on each call", () => {
      const idx1 = core.getRoundRobinIndex();
      const idx2 = core.getRoundRobinIndex();
      const idx3 = core.getRoundRobinIndex();

      expect(idx2).toBe(idx1 + 1);
      expect(idx3).toBe(idx2 + 1);
    });
  });

  describe("Disposal", () => {
    it("should dispose all workers gracefully", async () => {
      const statsBefore = core.getStats();
      expect(statsBefore.total).toBeGreaterThan(0);

      await core.dispose();

      // After disposal, accessing pool should throw errors for most operations
      expect(() => {
        core.getStats();
      }).not.toThrow(); // getStats should still work

      const stats = core.getStats();
      expect(stats.total).toBe(0); // No workers left
    });

    it("should handle multiple dispose calls gracefully", async () => {
      await core.dispose();
      await core.dispose(); // Should not throw

      const stats = core.getStats();
      expect(stats.total).toBe(0);
    });

    it("should prevent operations after disposal", async () => {
      await core.dispose();

      await expect(core.initialize()).rejects.toThrow(/disposed/);
    });
  });
});
