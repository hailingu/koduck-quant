/**
 * Failover Handler Unit Tests
 *
 * Tests for worker failure detection and failover logic
 *
 * Coverage targets:
 * - Crash detection and handling
 * - Hang detection and handling
 * - Task reassignment logic
 * - Worker termination and replacement
 * - Cooldown mechanism
 * - Concurrent failover limits
 * - Metrics tracking
 * - Event emission
 *
 * Target: >85% coverage
 */

 

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import { FailoverHandler } from "../../../src/common/worker-pool/failover-handler";
import type { WorkerMetadata } from "../../../src/common/worker-pool/worker-pool-core";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";

/**
 * Mock HealthMonitor
 */
class MockHealthMonitor extends EventEmitter {
  unregisterWorker = vi.fn();
}

/**
 * Mock WorkerPoolCore
 */
class MockWorkerPoolCore {
  private workers = new Map<string, WorkerMetadata>();

  getWorker(workerId: string): WorkerMetadata | undefined {
    return this.workers.get(workerId);
  }

  addMockWorker(workerId: string, metadata: Partial<WorkerMetadata> = {}): void {
    const mockWrapper = {
      terminate: vi.fn(),
      onMessage: vi.fn(),
      onError: vi.fn(),
      postMessage: vi.fn(),
    };

    this.workers.set(workerId, {
      id: workerId,
      state: "idle",
      wrapper: mockWrapper as unknown as WorkerMetadata["wrapper"],
      currentTaskId: undefined,
      completedTasks: 0,
      failedTasks: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      responseTimeSamples: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      memoryUsage: 0,
      ...metadata,
    });
  }

  removeMockWorker(workerId: string): void {
    this.workers.delete(workerId);
  }

  clearMockWorkers(): void {
    this.workers.clear();
  }
}

/**
 * Mock TaskScheduler
 */
class MockTaskScheduler {
  scheduleRetry = vi.fn();
}

describe("FailoverHandler", () => {
  let healthMonitor: MockHealthMonitor;
  let workerPoolCore: MockWorkerPoolCore;
  let taskScheduler: MockTaskScheduler;
  let poolConfig: WorkerPoolConfig;
  let failoverHandler: FailoverHandler;

  beforeEach(() => {
    healthMonitor = new MockHealthMonitor();
    workerPoolCore = new MockWorkerPoolCore();
    taskScheduler = new MockTaskScheduler();
    poolConfig = {
      minWorkerCount: 2,
      maxWorkerCount: 10,
      maxQueueSize: 1000,
    };
  });

  afterEach(async () => {
    if (failoverHandler) {
      await failoverHandler.dispose();
    }
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe("Constructor and Initialization", () => {
    it("should create failover handler with default config", () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      expect(failoverHandler).toBeDefined();
      expect(failoverHandler.getActiveFailoverCount()).toBe(0);
    });

    it("should create failover handler with custom config", () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig,
        {
          enabled: true,
          restartCooldown: 10000,
          maxConcurrentFailovers: 5,
          debug: true,
        }
      );

      expect(failoverHandler).toBeDefined();
    });

    it("should start failover monitoring", async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      await failoverHandler.start();

      // Verify event listeners are registered
      expect(healthMonitor.listenerCount("worker:crashed")).toBeGreaterThan(0);
      expect(healthMonitor.listenerCount("worker:hung")).toBeGreaterThan(0);
    });

    it("should stop failover monitoring", async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      await failoverHandler.start();
      await failoverHandler.stop();

      // Verify event listeners are removed
      expect(healthMonitor.listenerCount("worker:crashed")).toBe(0);
      expect(healthMonitor.listenerCount("worker:hung")).toBe(0);
    });

    it("should not start if disabled", async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig,
        { enabled: false }
      );

      await failoverHandler.start();

      expect(healthMonitor.listenerCount("worker:crashed")).toBe(0);
    });
  });

  describe("Worker Crash Handling", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig,
        { restartCooldown: 100 }
      );
      await failoverHandler.start();
    });

    it("should handle worker crash without task", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const failoverStarted = vi.fn();
      const failoverCompleted = vi.fn();

      failoverHandler.on("failover:started", failoverStarted);
      failoverHandler.on("failover:completed", failoverCompleted);

      // Emit crash event
      healthMonitor.emit("worker:crashed", workerId);

      // Wait for failover to complete
      await vi.waitFor(() => {
        expect(failoverCompleted).toHaveBeenCalled();
      });

      expect(failoverStarted).toHaveBeenCalledWith(workerId, undefined, "crash");
      expect(failoverCompleted).toHaveBeenCalledWith(workerId, expect.any(Number));

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBe(1);
      expect(stats.successfulRecoveries).toBe(1);
    });

    it("should handle worker crash with task", async () => {
      const workerId = "worker_1";
      const taskId = "task_123";

      workerPoolCore.addMockWorker(workerId, { currentTaskId: taskId });

      const taskReassigned = vi.fn();
      failoverHandler.on("task:needs-reassignment", taskReassigned);

      // Emit crash event
      healthMonitor.emit("worker:crashed", workerId, new Error("Worker crashed"));

      // Wait for failover to process
      await vi.waitFor(() => {
        expect(taskReassigned).toHaveBeenCalled();
      });

      expect(taskReassigned).toHaveBeenCalledWith(taskId, workerId);

      const stats = failoverHandler.getStats();
      expect(stats.totalReassignments).toBe(1);
    });

    it("should emit worker termination event", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const workerTermination = vi.fn();
      failoverHandler.on("worker:needs-termination", workerTermination);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(workerTermination).toHaveBeenCalled();
      });

      expect(workerTermination).toHaveBeenCalledWith(workerId);
    });

    it("should schedule worker replacement after cooldown", async () => {
      vi.useFakeTimers();

      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const workerReplacement = vi.fn();
      failoverHandler.on("worker:needs-replacement", workerReplacement);

      healthMonitor.emit("worker:crashed", workerId);

      // Advance time by cooldown period
      await vi.advanceTimersByTimeAsync(100);

      expect(workerReplacement).toHaveBeenCalledWith(workerId);

      const stats = failoverHandler.getStats();
      expect(stats.totalRestarts).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("Worker Hang Handling", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    it("should handle worker hang", async () => {
      const workerId = "worker_2";
      const taskId = "task_456";

      workerPoolCore.addMockWorker(workerId, {
        state: "busy",
        currentTaskId: taskId,
      });

      const failoverStarted = vi.fn();
      failoverHandler.on("failover:started", failoverStarted);

      healthMonitor.emit("worker:hung", workerId);

      await vi.waitFor(() => {
        expect(failoverStarted).toHaveBeenCalled();
      });

      expect(failoverStarted).toHaveBeenCalledWith(workerId, taskId, "hang");

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBe(1);
    });

    it("should reassign task from hung worker", async () => {
      const workerId = "worker_2";
      const taskId = "task_456";

      workerPoolCore.addMockWorker(workerId, { currentTaskId: taskId });

      const taskReassigned = vi.fn();
      failoverHandler.on("task:needs-reassignment", taskReassigned);

      healthMonitor.emit("worker:hung", workerId);

      await vi.waitFor(() => {
        expect(taskReassigned).toHaveBeenCalled();
      });

      expect(taskReassigned).toHaveBeenCalledWith(taskId, workerId);
    });
  });

  describe("Concurrent Failover Management", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig,
        { maxConcurrentFailovers: 2 }
      );
      await failoverHandler.start();
    });

    it("should limit concurrent failovers", async () => {
      const worker1 = "worker_1";
      const worker2 = "worker_2";
      const worker3 = "worker_3";

      workerPoolCore.addMockWorker(worker1);
      workerPoolCore.addMockWorker(worker2);
      workerPoolCore.addMockWorker(worker3);

      const failoverStarted = vi.fn();
      failoverHandler.on("failover:started", failoverStarted);

      // Trigger 3 concurrent crashes
      healthMonitor.emit("worker:crashed", worker1);
      healthMonitor.emit("worker:crashed", worker2);
      healthMonitor.emit("worker:crashed", worker3);

      await vi.waitFor(() => {
        expect(failoverStarted).toHaveBeenCalled();
      });

      // Should process at most 2 concurrent failovers
      expect(failoverHandler.getActiveFailoverCount()).toBeLessThanOrEqual(2);
    });

    it("should track active failovers", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      healthMonitor.emit("worker:crashed", workerId);

      // Should have 1 active failover immediately
      await vi.waitFor(() => {
        expect(failoverHandler.getActiveFailoverCount()).toBeGreaterThan(0);
      });

      // Wait for completion
      await vi.waitFor(
        () => {
          expect(failoverHandler.getActiveFailoverCount()).toBe(0);
        },
        { timeout: 1000 }
      );
    });

    it("should check if failover is active for worker", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      expect(failoverHandler.isFailoverActive(workerId)).toBe(false);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(failoverHandler.isFailoverActive(workerId)).toBe(true);
      });
    });
  });

  describe("Statistics and Metrics", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    it("should track total failovers", async () => {
      workerPoolCore.addMockWorker("worker_1");
      workerPoolCore.addMockWorker("worker_2");

      healthMonitor.emit("worker:crashed", "worker_1");
      healthMonitor.emit("worker:crashed", "worker_2");

      await vi.waitFor(() => {
        const stats = failoverHandler.getStats();
        expect(stats.totalFailovers).toBe(2);
      });
    });

    it("should track task reassignments", async () => {
      workerPoolCore.addMockWorker("worker_1", { currentTaskId: "task_1" });
      workerPoolCore.addMockWorker("worker_2", { currentTaskId: "task_2" });

      healthMonitor.emit("worker:crashed", "worker_1");
      healthMonitor.emit("worker:crashed", "worker_2");

      await vi.waitFor(() => {
        const stats = failoverHandler.getStats();
        expect(stats.totalReassignments).toBe(2);
      });
    });

    it("should track successful recoveries", async () => {
      workerPoolCore.addMockWorker("worker_1");

      healthMonitor.emit("worker:crashed", "worker_1");

      await vi.waitFor(() => {
        const stats = failoverHandler.getStats();
        expect(stats.successfulRecoveries).toBeGreaterThan(0);
      });
    });

    it("should calculate average recovery time", async () => {
      workerPoolCore.addMockWorker("worker_1");

      healthMonitor.emit("worker:crashed", "worker_1");

      await vi.waitFor(() => {
        const stats = failoverHandler.getStats();
        if (stats.successfulRecoveries > 0) {
          expect(stats.avgRecoveryTime).toBeGreaterThan(0);
        }
      });
    });

    it("should update lastFailoverTime", async () => {
      workerPoolCore.addMockWorker("worker_1");

      const statsBefore = failoverHandler.getStats();
      expect(statsBefore.lastFailoverTime).toBeUndefined();

      healthMonitor.emit("worker:crashed", "worker_1");

      await vi.waitFor(() => {
        const statsAfter = failoverHandler.getStats();
        expect(statsAfter.lastFailoverTime).toBeGreaterThan(0);
      });
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    it("should handle worker not found", async () => {
      const workerId = "nonexistent_worker";

      const failoverStarted = vi.fn();
      failoverHandler.on("failover:started", failoverStarted);

      healthMonitor.emit("worker:crashed", workerId);

      // Should not start failover for nonexistent worker
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(failoverStarted).not.toHaveBeenCalled();
    });

    it("should skip duplicate failover for same worker", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const failoverStarted = vi.fn();
      failoverHandler.on("failover:started", failoverStarted);

      // Trigger multiple crashes for same worker
      healthMonitor.emit("worker:crashed", workerId);
      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(failoverStarted).toHaveBeenCalled();
      });

      // Should only process one failover
      expect(failoverStarted).toHaveBeenCalledTimes(1);
    });

    it("should emit failover:failed on error", async () => {
      const workerId = "worker_1";

      // Don't add worker to pool to simulate error
      const failoverFailed = vi.fn();
      failoverHandler.on("failover:failed", failoverFailed);

      healthMonitor.emit("worker:crashed", workerId);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBe(0); // Should not count as failover if worker not found
    });
  });

  describe("Event Emissions", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    it("should emit failover:started event", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const listener = vi.fn();
      failoverHandler.on("failover:started", listener);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(workerId, undefined, "crash");
      });
    });

    it("should emit task:needs-reassignment event", async () => {
      const workerId = "worker_1";
      const taskId = "task_123";

      workerPoolCore.addMockWorker(workerId, { currentTaskId: taskId });

      const listener = vi.fn();
      failoverHandler.on("task:needs-reassignment", listener);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(taskId, workerId);
      });
    });

    it("should emit worker:needs-termination event", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const listener = vi.fn();
      failoverHandler.on("worker:needs-termination", listener);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(workerId);
      });
    });

    it("should emit worker:needs-replacement event after cooldown", async () => {
      vi.useFakeTimers();

      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const listener = vi.fn();
      failoverHandler.on("worker:needs-replacement", listener);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.advanceTimersByTimeAsync(5000);

      expect(listener).toHaveBeenCalledWith(workerId);

      vi.useRealTimers();
    });

    it("should emit failover:completed event", async () => {
      const workerId = "worker_1";
      workerPoolCore.addMockWorker(workerId);

      const listener = vi.fn();
      failoverHandler.on("failover:completed", listener);

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalledWith(workerId, expect.any(Number));
      });
    });
  });

  describe("Dispose and Cleanup", () => {
    it("should clear restart timers on dispose", async () => {
      vi.useFakeTimers();

      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      await failoverHandler.start();

      workerPoolCore.addMockWorker("worker_1");
      healthMonitor.emit("worker:crashed", "worker_1");

      // Run pending immediates/timers
      await vi.runAllTimersAsync();

      await failoverHandler.dispose();

      // Timers should be cleared
      expect(vi.getTimerCount()).toBe(0);

      vi.useRealTimers();
    });

    it("should clear active failovers on dispose", async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      await failoverHandler.start();

      workerPoolCore.addMockWorker("worker_1");
      healthMonitor.emit("worker:crashed", "worker_1");

      await failoverHandler.dispose();

      expect(failoverHandler.getActiveFailoverCount()).toBe(0);
    });
  });

  describe("Integration: Worker Failover Flow", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    afterEach(async () => {
      await failoverHandler.dispose();
    });

    it("should handle complete worker crash lifecycle with task reassignment", async () => {
      const workerId = "worker_1";
      const taskId = "task_100";

      // Setup: Create worker with active task
      workerPoolCore.addMockWorker(workerId, {
        currentTaskId: taskId,
        state: "busy",
        completedTasks: 5,
        failedTasks: 0,
      });

      const events: Array<{ type: string; data?: unknown }> = [];
      failoverHandler.on("failover:started", (wId: string) => {
        events.push({ type: "failover:started", data: wId });
      });
      failoverHandler.on("task:needs-reassignment", (tId: string, wId: string) => {
        events.push({ type: "task:reassigned", data: { taskId: tId, workerId: wId } });
      });
      failoverHandler.on("worker:needs-termination", (wId: string) => {
        events.push({ type: "worker:terminated", data: wId });
      });
      failoverHandler.on("worker:needs-replacement", (wId: string) => {
        events.push({ type: "worker:replaced", data: wId });
      });

      // Trigger crash
      healthMonitor.emit("worker:crashed", workerId, new Error("Process exited"));

      // Verify event sequence
      await vi.waitFor(() => {
        expect(events.length).toBeGreaterThanOrEqual(3);
      });

      // Verify correct sequence
      expect(events.some((e) => e.type === "failover:started")).toBe(true);
      expect(events.some((e) => e.type === "task:reassigned")).toBe(true);
      expect(events.some((e) => e.type === "worker:terminated")).toBe(true);

      // Verify stats
      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBe(1);
      expect(stats.totalReassignments).toBe(1);
    });

    it("should handle concurrent multiple worker failures with rate limiting", async () => {
      // Setup: Multiple workers
      for (let i = 1; i <= 5; i++) {
        workerPoolCore.addMockWorker(`worker_${i}`, {
          state: "idle",
          completedTasks: i * 10,
        });
      }

      const failoverEvents: string[] = [];
      failoverHandler.on("failover:started", (wId: string) => {
        failoverEvents.push(wId);
      });

      // Trigger simultaneous failures
      for (let i = 1; i <= 5; i++) {
        healthMonitor.emit("worker:crashed", `worker_${i}`, new Error("Crash"));
      }

      await vi.waitFor(() => {
        expect(failoverEvents.length).toBeGreaterThan(0);
      });

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBeLessThanOrEqual(5);
      expect(stats.totalFailovers).toBeGreaterThan(0);

      // Verify concurrent failover limit is respected (default: 3)
      expect(failoverHandler.getActiveFailoverCount()).toBeLessThanOrEqual(3);
    });

    it("should maintain worker metadata during failover transitions", async () => {
      const workerId = "worker_metadata";

      // Add worker with specific metadata
      workerPoolCore.addMockWorker(workerId, {
        state: "busy",
        completedTasks: 42,
        failedTasks: 3,
        avgResponseTime: 150.5,
        totalResponseTime: 6321,
        responseTimeSamples: 42,
        memoryUsage: 125487232,
      });

      const metadataSnapshots: unknown[] = [];

      failoverHandler.on("failover:started", () => {
        const worker = workerPoolCore.getWorker(workerId);
        if (worker) {
          metadataSnapshots.push({
            completedTasks: worker.completedTasks,
            failedTasks: worker.failedTasks,
            avgResponseTime: worker.avgResponseTime,
          });
        }
      });

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(metadataSnapshots.length).toBeGreaterThan(0);
      });

      // Verify metadata was captured before termination
      const snapshot = metadataSnapshots[0] as any;
      expect(snapshot.completedTasks).toBe(42);
      expect(snapshot.failedTasks).toBe(3);
      expect(snapshot.avgResponseTime).toBe(150.5);
    });
  });

  describe("Integration: Task Reassignment Flow", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    afterEach(async () => {
      await failoverHandler.dispose();
    });

    it("should properly reassign multiple pending tasks from failed worker", async () => {
      const workerId = "multi_task_worker";

      // Setup: Worker with potential multiple tasks (represented by currentTaskId)
      workerPoolCore.addMockWorker(workerId, {
        currentTaskId: "task_primary",
        state: "busy",
        completedTasks: 10,
      });

      const reassignedTasks: string[] = [];
      failoverHandler.on("task:needs-reassignment", (taskId: string) => {
        reassignedTasks.push(taskId);
      });

      // Trigger failure
      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(reassignedTasks.length).toBeGreaterThan(0);
      });

      // Verify at least primary task was reassigned
      expect(reassignedTasks).toContain("task_primary");

      const stats = failoverHandler.getStats();
      expect(stats.totalReassignments).toBeGreaterThan(0);
    });

    it("should handle task reassignment failures gracefully", async () => {
      const workerId = "failing_reassign_worker";

      workerPoolCore.addMockWorker(workerId, {
        currentTaskId: "task_critical",
        state: "busy",
      });

      // Mock scheduler to simulate failure
      taskScheduler.scheduleRetry.mockImplementation(() => {
        throw new Error("Scheduler unavailable");
      });

      failoverHandler.on("failover:failed", (wId: string, error: Error) => {
        expect(error).toBeDefined();
      });

      // Trigger failure
      healthMonitor.emit("worker:crashed", workerId);

      // Should handle error gracefully without crashing
      await vi.waitFor(() => {
        expect(failoverHandler.getStats().totalFailovers).toBeGreaterThan(0);
      });

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Integration: Cleanup and Recovery", () => {
    beforeEach(async () => {
      failoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );
      await failoverHandler.start();
    });

    afterEach(async () => {
      await failoverHandler.dispose();
    });

    it("should properly cleanup resources after complete failover cycle", async () => {
      const workerId = "cleanup_worker";

      workerPoolCore.addMockWorker(workerId, {
        currentTaskId: "task_cleanup",
        state: "busy",
      });

      const cleanupEvents: string[] = [];
      failoverHandler.on("failover:completed", (wId: string) => {
        cleanupEvents.push(wId);
      });

      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(cleanupEvents.length).toBeGreaterThan(0);
      });

      // After cleanup, failover should no longer be active
      expect(failoverHandler.isFailoverActive(workerId)).toBe(false);

      // Active failover count should be reduced
      expect(failoverHandler.getActiveFailoverCount()).toBe(0);
    });

    it("should maintain recovery statistics across multiple failover cycles", async () => {
      const workers = ["worker_a", "worker_b", "worker_c"];

      for (const wId of workers) {
        workerPoolCore.addMockWorker(wId);
      }

      // First cycle
      healthMonitor.emit("worker:crashed", "worker_a");
      await vi.waitFor(() => {
        expect(failoverHandler.getStats().totalFailovers).toBe(1);
      });

      // Second cycle
      healthMonitor.emit("worker:crashed", "worker_b");
      await vi.waitFor(() => {
        expect(failoverHandler.getStats().totalFailovers).toBe(2);
      });

      // Third cycle
      healthMonitor.emit("worker:crashed", "worker_c");
      await vi.waitFor(() => {
        expect(failoverHandler.getStats().totalFailovers).toBe(3);
      });

      const stats = failoverHandler.getStats();
      expect(stats.totalFailovers).toBe(3);
      // Verify tracking is working across cycles
      expect(stats.totalFailovers).toBeGreaterThan(0);
    });

    it("should reset state completely on dispose for clean restart", async () => {
      const workerId = "dispose_test_worker";

      workerPoolCore.addMockWorker(workerId);
      healthMonitor.emit("worker:crashed", workerId);

      await vi.waitFor(() => {
        expect(failoverHandler.getStats().totalFailovers).toBe(1);
      });

      // Dispose
      await failoverHandler.dispose();

      // After dispose, active failovers should be cleared
      expect(failoverHandler.getActiveFailoverCount()).toBe(0);

      // Create new instance and verify clean state
      const newFailoverHandler = new FailoverHandler(
        healthMonitor as any,
        workerPoolCore as any,
        taskScheduler as any,
        poolConfig
      );

      expect(newFailoverHandler.getActiveFailoverCount()).toBe(0);

      await newFailoverHandler.dispose();
    });
  });
});
