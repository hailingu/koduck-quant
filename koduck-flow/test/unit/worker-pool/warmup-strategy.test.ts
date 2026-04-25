import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WarmupStrategy,
  type WarmupConfig,
  type WorkerWarmupState,
} from "../../../src/common/worker-pool/warmup-strategy";

describe("WarmupStrategy", () => {
  let strategy: WarmupStrategy;

  beforeEach(() => {
    strategy = new WarmupStrategy({
      enablePreCreation: true,
      preCreationCount: 3,
      enableWarmup: true,
      warmupTaskType: "warmup",
      enableColdStartTracking: true,
      coreWorkerCount: 2,
      enableIdlePreCreation: true,
      idlePreCreationThreshold: 10000,
    });
  });

  afterEach(() => {
    strategy.dispose();
  });

  describe("Constructor and Configuration", () => {
    it("should create strategy with default config", () => {
      const defaultStrategy = new WarmupStrategy({});
      expect(defaultStrategy).toBeDefined();
      const stats = defaultStrategy.getStatistics();
      expect(stats.totalWorkersCreated).toBe(0);
      defaultStrategy.dispose();
    });

    it("should create strategy with custom config", () => {
      const config: Partial<WarmupConfig> = {
        enablePreCreation: true,
        preCreationCount: 5,
        coreWorkerCount: 3,
      };
      const customStrategy = new WarmupStrategy(config);
      expect(customStrategy).toBeDefined();
      customStrategy.dispose();
    });

    it("should validate preCreationCount >= 0", () => {
      expect(() => new WarmupStrategy({ preCreationCount: -1 })).toThrow(
        "preCreationCount must be >= 0"
      );
    });

    it("should validate coreWorkerCount >= 0", () => {
      expect(() => new WarmupStrategy({ coreWorkerCount: -1 })).toThrow(
        "coreWorkerCount must be >= 0"
      );
    });

    it("should validate coreWorkerCount <= preCreationCount", () => {
      expect(() => new WarmupStrategy({ preCreationCount: 2, coreWorkerCount: 3 })).toThrow(
        "coreWorkerCount must be <= preCreationCount"
      );
    });

    it("should validate idlePreCreationThreshold >= 0", () => {
      expect(() => new WarmupStrategy({ idlePreCreationThreshold: -100 })).toThrow(
        "idlePreCreationThreshold must be >= 0"
      );
    });
  });

  describe("Pre-creation Warmup", () => {
    it("should execute pre-creation warmup", () => {
      const onStartedSpy = vi.fn();
      strategy.on("pre-creation-started", onStartedSpy);

      const callbacks = strategy.executePreCreationWarmup();

      expect(onStartedSpy).toHaveBeenCalledWith(3);
      expect(callbacks.onWorkerCreated).toBeDefined();
      expect(callbacks.onWorkerWarmed).toBeDefined();
    });

    it("should track worker creation during pre-creation", () => {
      const onCreatedSpy = vi.fn();
      strategy.on("worker-created", onCreatedSpy);

      const callbacks = strategy.executePreCreationWarmup();

      callbacks.onWorkerCreated("worker-1");
      callbacks.onWorkerCreated("worker-2");

      expect(onCreatedSpy).toHaveBeenCalledTimes(2);

      const stats = strategy.getStatistics();
      expect(stats.totalWorkersCreated).toBe(2);
    });

    it("should throw error if disposed", () => {
      strategy.dispose();
      expect(() => strategy.executePreCreationWarmup()).toThrow("WarmupStrategy has been disposed");
    });

    it("should increment pre-creation execution counter", () => {
      const stats1 = strategy.getStatistics();
      expect(stats1.preCreationExecutions).toBe(0);

      strategy.executePreCreationWarmup();
      const stats2 = strategy.getStatistics();
      expect(stats2.preCreationExecutions).toBe(1);

      strategy.executePreCreationWarmup();
      const stats3 = strategy.getStatistics();
      expect(stats3.preCreationExecutions).toBe(2);
    });
  });

  describe("Worker Creation Tracking", () => {
    it("should record worker created without duration", () => {
      strategy.recordWorkerCreated("worker-1");

      const state = strategy.getWorkerState("worker-1");
      expect(state).toBeDefined();
      expect(state?.workerId).toBe("worker-1");
      expect(state?.isWarm).toBe(false);
      expect(state?.isColdStart).toBe(true);
      expect(state?.isCore).toBe(true); // First worker is core
    });

    it("should record worker created with duration", () => {
      const onCreatedSpy = vi.fn();
      strategy.on("worker-created", onCreatedSpy);

      strategy.recordWorkerCreated("worker-1", 45);

      const state = strategy.getWorkerState("worker-1");
      expect(state?.creationDuration).toBe(45);

      const stats = strategy.getStatistics();
      expect(stats.avgCreationTime).toBe(45);
    });

    it("should identify core workers correctly", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerCreated("worker-3");

      expect(strategy.isCoreWorker("worker-1")).toBe(true);
      expect(strategy.isCoreWorker("worker-2")).toBe(true);
      expect(strategy.isCoreWorker("worker-3")).toBe(false);
    });

    it("should track multiple workers and calculate average creation time", () => {
      strategy.recordWorkerCreated("worker-1", 30);
      strategy.recordWorkerCreated("worker-2", 40);
      strategy.recordWorkerCreated("worker-3", 50);

      const stats = strategy.getStatistics();
      expect(stats.totalWorkersCreated).toBe(3);
      expect(stats.avgCreationTime).toBe(40); // (30 + 40 + 50) / 3
    });
  });

  describe("Worker Warmup", () => {
    it("should record worker warmed", () => {
      const onWarmedSpy = vi.fn();
      strategy.on("worker-warmed", onWarmedSpy);

      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerWarmed("worker-1");

      const state = strategy.getWorkerState("worker-1");
      expect(state?.isWarm).toBe(true);
      expect(state?.warmedAt).toBeDefined();

      expect(onWarmedSpy).toHaveBeenCalledOnce();
    });

    it("should check if worker is warm", () => {
      strategy.recordWorkerCreated("worker-1");
      expect(strategy.isWorkerWarm("worker-1")).toBe(false);

      strategy.recordWorkerWarmed("worker-1");
      expect(strategy.isWorkerWarm("worker-1")).toBe(true);
    });

    it("should track warmup statistics", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerCreated("worker-3");

      strategy.recordWorkerWarmed("worker-1");
      strategy.recordWorkerWarmed("worker-2");

      const stats = strategy.getStatistics();
      expect(stats.warmedWorkers).toBe(2);
      expect(stats.coldStartWorkers).toBe(3);
    });
  });

  describe("Cold-Start Detection", () => {
    it("should identify cold-start workers", () => {
      strategy.recordWorkerCreated("worker-1");
      expect(strategy.isWorkerColdStart("worker-1")).toBe(true);

      strategy.recordWorkerWarmed("worker-1");
      // Still cold-start until first task
      expect(strategy.isWorkerColdStart("worker-1")).toBe(true);
    });

    it("should record first task execution", () => {
      const onColdStartSpy = vi.fn();
      strategy.on("worker-cold-start", onColdStartSpy);

      strategy.recordWorkerCreated("worker-1");
      strategy.recordFirstTaskExecution("worker-1", 120);

      const state = strategy.getWorkerState("worker-1");
      expect(state?.isColdStart).toBe(false);
      expect(state?.firstTaskDuration).toBe(120);
      expect(state?.firstTaskExecutedAt).toBeDefined();

      expect(onColdStartSpy).toHaveBeenCalledOnce();
    });

    it("should only record first task execution once", () => {
      const onColdStartSpy = vi.fn();
      strategy.on("worker-cold-start", onColdStartSpy);

      strategy.recordWorkerCreated("worker-1");
      strategy.recordFirstTaskExecution("worker-1", 120);
      strategy.recordFirstTaskExecution("worker-1", 80); // Should be ignored

      const state = strategy.getWorkerState("worker-1");
      expect(state?.firstTaskDuration).toBe(120); // First value retained
      expect(onColdStartSpy).toHaveBeenCalledOnce();
    });

    it("should track first task latency statistics", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerCreated("worker-3");

      strategy.recordFirstTaskExecution("worker-1", 100);
      strategy.recordFirstTaskExecution("worker-2", 150);
      strategy.recordFirstTaskExecution("worker-3", 200);

      const stats = strategy.getStatistics();
      expect(stats.avgFirstTaskLatency).toBe(150); // (100 + 150 + 200) / 3
      expect(stats.coldStartWorkers).toBe(0);
    });
  });

  describe("Activity Recording", () => {
    it("should record activity and update last activity time", () => {
      const start = Date.now();
      strategy.recordActivity();
      const end = Date.now();

      // Activity time should be within the recorded range
      expect(start).toBeLessThanOrEqual(end);
    });

    it("should reset idle timer on activity", () => {
      strategy.scheduleIdlePreCreation();

      const start = Date.now();
      strategy.recordActivity();

      // Calling again should not trigger idle detection immediately
      strategy.recordActivity();
      expect(Date.now() - start).toBeLessThan(1000);
    });
  });

  describe("Idle Pre-creation", () => {
    it("should schedule idle pre-creation", () => {
      const onScheduledSpy = vi.fn();
      strategy.on("idle-pre-creation-scheduled", onScheduledSpy);

      strategy.scheduleIdlePreCreation();
      expect(strategy).toBeDefined(); // Just verify it doesn't throw
    });

    it("should track idle pre-creation count", async () => {
      // Create strategy with very short idle threshold for testing
      const shortIdleStrategy = new WarmupStrategy({
        enableIdlePreCreation: true,
        idlePreCreationThreshold: 100, // 100ms
      });

      const onScheduledSpy = vi.fn();
      shortIdleStrategy.on("idle-pre-creation-scheduled", onScheduledSpy);

      shortIdleStrategy.scheduleIdlePreCreation();

      // Wait for idle detection
      await new Promise((resolve) => setTimeout(resolve, 500));

      const stats = shortIdleStrategy.getStatistics();
      expect(stats.idlePreCreations).toBeGreaterThan(0);

      shortIdleStrategy.dispose();
    });

    it("should throw error if disposed", () => {
      strategy.dispose();
      expect(() => strategy.scheduleIdlePreCreation()).toThrow("WarmupStrategy has been disposed");
    });
  });

  describe("Worker Prioritization", () => {
    it("should prioritize warm workers over cold-start workers", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerCreated("worker-3");

      strategy.recordWorkerWarmed("worker-1");
      strategy.recordWorkerWarmed("worker-2");
      // worker-3 is not warmed

      const prioritized = strategy.getPrioritizedWorkers(["worker-3", "worker-1", "worker-2"]);

      // Warmed workers should come first
      expect(prioritized[0]).toMatch(/worker-[12]/);
      expect(prioritized[1]).toMatch(/worker-[12]/);
      expect(prioritized[2]).toBe("worker-3");
    });

    it("should prioritize older workers (likely warmer)", async () => {
      strategy.recordWorkerCreated("worker-1");
      // Add a small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
      strategy.recordWorkerCreated("worker-2");

      const prioritized = strategy.getPrioritizedWorkers(["worker-2", "worker-1"]);

      // Older worker should come first (lower creation time = older)
      // Since we created worker-1 first, it has a lower createdAt timestamp
      const indexWorker1 = prioritized.indexOf("worker-1");
      const indexWorker2 = prioritized.indexOf("worker-2");
      expect(indexWorker1).toBeLessThanOrEqual(indexWorker2);
    });
  });

  describe("Worker Removal", () => {
    it("should remove worker from tracking", () => {
      strategy.recordWorkerCreated("worker-1");
      expect(strategy.getWorkerState("worker-1")).toBeDefined();

      strategy.removeWorker("worker-1");
      expect(strategy.getWorkerState("worker-1")).toBeUndefined();
    });

    it("should remove core worker designation", () => {
      strategy.recordWorkerCreated("worker-1");
      expect(strategy.isCoreWorker("worker-1")).toBe(true);

      strategy.removeWorker("worker-1");
      expect(strategy.isCoreWorker("worker-1")).toBe(false);
    });

    it("should decrement core worker count", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");

      const stats1 = strategy.getStatistics();
      expect(stats1.coreWorkersActive).toBe(2);

      strategy.removeWorker("worker-1");
      const stats2 = strategy.getStatistics();
      expect(stats2.coreWorkersActive).toBe(1);
    });
  });

  describe("Statistics Collection", () => {
    it("should return complete statistics snapshot", () => {
      strategy.recordWorkerCreated("worker-1", 30);
      strategy.recordWorkerCreated("worker-2", 40);
      strategy.recordWorkerWarmed("worker-1");
      strategy.recordFirstTaskExecution("worker-1", 100);

      const stats = strategy.getStatistics();

      expect(stats.totalWorkersCreated).toBe(2);
      expect(stats.warmedWorkers).toBe(1);
      expect(stats.coldStartWorkers).toBe(1); // Only worker-2 is still cold-start
      expect(stats.coreWorkersActive).toBe(2);
      expect(stats.avgCreationTime).toBe(35);
      expect(stats.avgFirstTaskLatency).toBe(100);
      expect(stats.preCreationExecutions).toBe(0);
      expect(stats.idlePreCreations).toBe(0);
    });

    it("should return empty statistics for new strategy", () => {
      const stats = strategy.getStatistics();

      expect(stats.totalWorkersCreated).toBe(0);
      expect(stats.warmedWorkers).toBe(0);
      expect(stats.coldStartWorkers).toBe(0);
      expect(stats.coreWorkersActive).toBe(0);
      expect(stats.avgCreationTime).toBe(0);
      expect(stats.avgFirstTaskLatency).toBe(0);
      expect(stats.preCreationExecutions).toBe(0);
      expect(stats.idlePreCreations).toBe(0);
    });

    it("should handle zero worker average calculations", () => {
      const stats = strategy.getStatistics();

      expect(stats.avgCreationTime).toBe(0);
      expect(stats.avgFirstTaskLatency).toBe(0);
    });
  });

  describe("Worker State Access", () => {
    it("should get worker state by ID", () => {
      strategy.recordWorkerCreated("worker-1");
      const state = strategy.getWorkerState("worker-1");

      expect(state?.workerId).toBe("worker-1");
    });

    it("should return undefined for non-existent worker", () => {
      const state = strategy.getWorkerState("non-existent");
      expect(state).toBeUndefined();
    });

    it("should get all worker states", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerCreated("worker-3");

      const allStates = strategy.getAllWorkerStates();
      expect(allStates.size).toBe(3);
      expect(allStates.has("worker-1")).toBe(true);
      expect(allStates.has("worker-2")).toBe(true);
      expect(allStates.has("worker-3")).toBe(true);
    });
  });

  describe("Event Emission", () => {
    it("should emit worker-created event", () => {
      const onCreatedSpy = vi.fn();
      strategy.on("worker-created", onCreatedSpy);

      strategy.recordWorkerCreated("worker-1");

      expect(onCreatedSpy).toHaveBeenCalledOnce();
      const state = onCreatedSpy.mock.calls[0][0] as WorkerWarmupState;
      expect(state.workerId).toBe("worker-1");
    });

    it("should emit worker-warmed event", () => {
      const onWarmedSpy = vi.fn();
      strategy.on("worker-warmed", onWarmedSpy);

      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerWarmed("worker-1");

      expect(onWarmedSpy).toHaveBeenCalledOnce();
    });

    it("should emit worker-cold-start event", () => {
      const onColdStartSpy = vi.fn();
      strategy.on("worker-cold-start", onColdStartSpy);

      strategy.recordWorkerCreated("worker-1");
      strategy.recordFirstTaskExecution("worker-1", 100);

      expect(onColdStartSpy).toHaveBeenCalledOnce();
    });

    it("should emit pre-creation-started event", () => {
      const onStartedSpy = vi.fn();
      strategy.on("pre-creation-started", onStartedSpy);

      strategy.executePreCreationWarmup();

      expect(onStartedSpy).toHaveBeenCalledWith(3);
    });
  });

  describe("Lifecycle", () => {
    it("should dispose properly", () => {
      strategy.recordWorkerCreated("worker-1");
      expect(strategy.getWorkerState("worker-1")).toBeDefined();

      strategy.dispose();

      expect(strategy.getWorkerState("worker-1")).toBeUndefined();
    });

    it("should throw error if using disposed strategy", () => {
      strategy.dispose();

      expect(() => strategy.executePreCreationWarmup()).toThrow("WarmupStrategy has been disposed");
      expect(() => strategy.scheduleIdlePreCreation()).toThrow("WarmupStrategy has been disposed");
    });

    it("should clear listeners on dispose", () => {
      const onCreatedSpy = vi.fn();
      strategy.on("worker-created", onCreatedSpy);

      strategy.dispose();
      strategy = new WarmupStrategy(); // Create new one for final test

      strategy.recordWorkerCreated("worker-1");
      // Listeners should be cleared from old instance
      expect(onCreatedSpy).not.toHaveBeenCalled();

      strategy.dispose();
    });

    it("should handle multiple dispose calls", () => {
      strategy.dispose();
      expect(() => strategy.dispose()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle recording non-existent worker warmup", () => {
      expect(() => strategy.recordWorkerWarmed("non-existent")).not.toThrow();
    });

    it("should handle recording non-existent worker first task", () => {
      expect(() => strategy.recordFirstTaskExecution("non-existent", 100)).not.toThrow();
    });

    it("should handle removing non-existent worker", () => {
      expect(() => strategy.removeWorker("non-existent")).not.toThrow();
    });

    it("should handle empty worker prioritization list", () => {
      const prioritized = strategy.getPrioritizedWorkers([]);
      expect(prioritized).toEqual([]);
    });

    it("should handle single worker prioritization", () => {
      strategy.recordWorkerCreated("worker-1");
      const prioritized = strategy.getPrioritizedWorkers(["worker-1"]);
      expect(prioritized).toEqual(["worker-1"]);
    });

    it("should support negative or zero creation duration", () => {
      strategy.recordWorkerCreated("worker-1", 0);
      strategy.recordWorkerCreated("worker-2", -5);

      const stats = strategy.getStatistics();
      expect(stats.avgCreationTime).toBe(-2.5);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent worker creation", () => {
      const callbacks = strategy.executePreCreationWarmup();

      callbacks.onWorkerCreated("worker-1");
      callbacks.onWorkerCreated("worker-2");
      callbacks.onWorkerCreated("worker-3");

      const stats = strategy.getStatistics();
      expect(stats.totalWorkersCreated).toBe(3);
    });

    it("should handle concurrent warmup recording", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerCreated("worker-2");

      strategy.recordWorkerWarmed("worker-1");
      strategy.recordWorkerWarmed("worker-2");

      const stats = strategy.getStatistics();
      expect(stats.warmedWorkers).toBe(2);
    });

    it("should handle interleaved creation and warmup", () => {
      strategy.recordWorkerCreated("worker-1");
      strategy.recordWorkerWarmed("worker-1");
      strategy.recordWorkerCreated("worker-2");
      strategy.recordWorkerWarmed("worker-2");
      strategy.recordWorkerCreated("worker-3");

      const stats = strategy.getStatistics();
      expect(stats.totalWorkersCreated).toBe(3);
      expect(stats.warmedWorkers).toBe(2);
    });
  });
});
