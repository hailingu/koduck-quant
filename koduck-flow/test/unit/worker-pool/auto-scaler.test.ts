import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  AutoScaler,
  type AutoScalerConfig,
  type IWorkerPoolCore,
} from "../../../src/common/worker-pool/auto-scaler";
import { PoolMetrics } from "../../../src/common/worker-pool/pool-metrics";

/**
 * Mock WorkerPoolCore for testing
 */
class MockWorkerPoolCore implements IWorkerPoolCore {
  private totalWorkers = 4;
  private activeWorkers = 2;

  getWorkerCount(): number {
    return this.totalWorkers;
  }

  getActiveWorkerCount(): number {
    return this.activeWorkers;
  }

  getIdleWorkerCount(): number {
    return this.totalWorkers - this.activeWorkers;
  }

  async scaleUp(count: number): Promise<void> {
    this.totalWorkers += count;
  }

  async scaleDown(count: number): Promise<void> {
    this.totalWorkers -= count;
  }

  // Test helpers
  setWorkerCounts(total: number, active: number): void {
    this.totalWorkers = total;
    this.activeWorkers = active;
  }
}

describe("AutoScaler", () => {
  let mockPoolCore: MockWorkerPoolCore;
  let mockMetrics: PoolMetrics;
  let scaler: AutoScaler;

  beforeEach(() => {
    mockPoolCore = new MockWorkerPoolCore();
    mockMetrics = new PoolMetrics({ poolId: "test-pool" });

    // Set initial metrics state
    mockMetrics.updateWorkerCount(4, 2);
    mockMetrics.updateQueueLength(0);
  });

  afterEach(() => {
    if (scaler) {
      scaler.dispose();
    }
  });

  describe("Constructor and Configuration", () => {
    it("should create auto-scaler with default config", () => {
      scaler = new AutoScaler({}, mockPoolCore, mockMetrics);
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.isPaused).toBe(false);
      expect(status.lastScaleAction).toBe("none");
    });

    it("should create auto-scaler with custom config", () => {
      const config: Partial<AutoScalerConfig> = {
        minWorkers: 2,
        maxWorkers: 20,
        scaleUpThreshold: 0.75,
        scaleDownThreshold: 0.25,
        checkInterval: 10000,
      };

      scaler = new AutoScaler(config, mockPoolCore, mockMetrics);
      expect(scaler).toBeDefined();
    });

    it("should validate minWorkers >= 0", () => {
      expect(() => new AutoScaler({ minWorkers: -1 }, mockPoolCore, mockMetrics)).toThrow(
        "minWorkers must be >= 0"
      );
    });

    it("should validate maxWorkers >= minWorkers", () => {
      expect(
        () => new AutoScaler({ minWorkers: 10, maxWorkers: 5 }, mockPoolCore, mockMetrics)
      ).toThrow("maxWorkers must be >= minWorkers");
    });

    it("should validate scaleUpThreshold range", () => {
      expect(() => new AutoScaler({ scaleUpThreshold: 0 }, mockPoolCore, mockMetrics)).toThrow(
        "scaleUpThreshold must be between 0 and 1"
      );

      expect(() => new AutoScaler({ scaleUpThreshold: 1.5 }, mockPoolCore, mockMetrics)).toThrow(
        "scaleUpThreshold must be between 0 and 1"
      );
    });

    it("should validate scaleDownThreshold range", () => {
      expect(() => new AutoScaler({ scaleDownThreshold: -0.1 }, mockPoolCore, mockMetrics)).toThrow(
        "scaleDownThreshold must be between 0 and 1"
      );

      expect(() => new AutoScaler({ scaleDownThreshold: 1 }, mockPoolCore, mockMetrics)).toThrow(
        "scaleDownThreshold must be between 0 and 1"
      );
    });

    it("should validate scaleDownThreshold < scaleUpThreshold", () => {
      expect(
        () =>
          new AutoScaler(
            { scaleDownThreshold: 0.8, scaleUpThreshold: 0.7 },
            mockPoolCore,
            mockMetrics
          )
      ).toThrow("scaleDownThreshold must be < scaleUpThreshold");
    });
  });

  describe("Lifecycle Control", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        { checkInterval: 100, cooldownPeriod: 200 },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should start auto-scaling", () => {
      const startedSpy = vi.fn();
      scaler.on("started", startedSpy);

      scaler.start();
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(startedSpy).toHaveBeenCalled();
    });

    it("should stop auto-scaling", () => {
      const stoppedSpy = vi.fn();
      scaler.on("stopped", stoppedSpy);

      scaler.start();
      scaler.stop();
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(false);
      expect(stoppedSpy).toHaveBeenCalled();
    });

    it("should not start if already running", () => {
      const startedSpy = vi.fn();
      scaler.on("started", startedSpy);

      scaler.start();
      scaler.start(); // Second start

      expect(startedSpy).toHaveBeenCalledTimes(1);
    });

    it("should pause auto-scaling", () => {
      const pausedSpy = vi.fn();
      scaler.on("paused", pausedSpy);

      scaler.start();
      scaler.pause();
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.isPaused).toBe(true);
      expect(pausedSpy).toHaveBeenCalled();
    });

    it("should resume auto-scaling", () => {
      const resumedSpy = vi.fn();
      scaler.on("resumed", resumedSpy);

      scaler.start();
      scaler.pause();
      scaler.resume();
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.isPaused).toBe(false);
      expect(resumedSpy).toHaveBeenCalled();
    });

    it("should throw error if started after disposal", () => {
      scaler.dispose();

      expect(() => {
        scaler.start();
      }).toThrow("AutoScaler has been disposed");
    });
  });

  describe("Status Reporting", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        { checkInterval: 100, cooldownPeriod: 1000 },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should report initial status", () => {
      const status = scaler.getStatus();

      expect(status.isRunning).toBe(false);
      expect(status.isPaused).toBe(false);
      expect(status.lastScaleTime).toBe(0);
      expect(status.lastScaleAction).toBe("none");
      expect(status.inCooldown).toBe(false);
      expect(status.cooldownRemaining).toBe(0);
    });

    it("should report cooldown status after scaling", async () => {
      // Trigger scale-up
      mockMetrics.updateWorkerCount(4, 4); // High utilization
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 500 });

      const status = scaler.getStatus();
      expect(status.inCooldown).toBe(true);
      expect(status.cooldownRemaining).toBeGreaterThan(0);
      expect(status.lastScaleAction).toBe("scale-up");
    });
  });

  describe("Load Monitoring", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        { checkInterval: 100, cooldownPeriod: 50 },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should collect load metrics from pool", () => {
      mockMetrics.updateWorkerCount(10, 8);
      mockMetrics.updateQueueLength(15);
      mockMetrics.recordTaskCompletion(100);

      scaler.start();

      // Metrics should be collected during check
      expect(mockMetrics.getSnapshot().totalWorkers).toBe(10);
      expect(mockMetrics.getSnapshot().activeWorkers).toBe(8);
      expect(mockMetrics.getSnapshot().queueLength).toBe(15);

      scaler.stop();
    });
  });

  describe("Scale-Up Decision", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 10,
          scaleUpThreshold: 0.8,
          queueLengthThreshold: 10,
          checkInterval: 100,
          cooldownPeriod: 50,
          scaleUpStep: 2,
        },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should scale up when utilization exceeds threshold", async () => {
      // Set high utilization (90%) - start with fewer workers
      mockPoolCore.setWorkerCounts(5, 5);
      mockMetrics.updateWorkerCount(5, 5);
      mockMetrics.updateQueueLength(0);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 500 });

      expect(scaleUpSpy).toHaveBeenCalledWith(
        2, // magnitude
        expect.stringContaining("high utilization"),
        expect.any(Object)
      );

      scaler.stop();
    });

    it("should scale up when queue length exceeds threshold", async () => {
      // Set high queue length
      mockPoolCore.setWorkerCounts(4, 2);
      mockMetrics.updateWorkerCount(4, 2);
      mockMetrics.updateQueueLength(15);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 500 });

      expect(scaleUpSpy).toHaveBeenCalledWith(
        2,
        expect.stringContaining("queue length"),
        expect.any(Object)
      );

      scaler.stop();
    });

    it("should not scale up beyond maxWorkers", async () => {
      // Already at max capacity
      mockPoolCore.setWorkerCounts(10, 9);
      mockMetrics.updateWorkerCount(10, 9);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(scaleUpSpy).not.toHaveBeenCalled();

      scaler.stop();
    });

    it("should cap scale-up by available capacity", async () => {
      // Close to max, only 1 slot available
      mockPoolCore.setWorkerCounts(9, 8);
      mockMetrics.updateWorkerCount(9, 8);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 500 });

      // Should scale by 1 (available capacity) not 2 (configured step)
      expect(scaleUpSpy).toHaveBeenCalledWith(1, expect.any(String), expect.any(Object));

      scaler.stop();
    });
  });

  describe("Scale-Down Decision", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 10,
          scaleDownThreshold: 0.2,
          checkInterval: 100,
          cooldownPeriod: 50,
          scaleDownStep: 2,
        },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should scale down when utilization is low and queue is empty", async () => {
      // Set low utilization (10%)
      mockPoolCore.setWorkerCounts(10, 1);
      mockMetrics.updateWorkerCount(10, 1);
      mockMetrics.updateQueueLength(0);

      const scaleDownSpy = vi.fn();
      scaler.on("scale-down", scaleDownSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 500 });

      expect(scaleDownSpy).toHaveBeenCalledWith(
        2,
        expect.stringContaining("low utilization"),
        expect.any(Object)
      );

      scaler.stop();
    });

    it("should not scale down if queue is not empty", async () => {
      // Low utilization but non-empty queue
      mockPoolCore.setWorkerCounts(10, 1);
      mockMetrics.updateWorkerCount(10, 1);
      mockMetrics.updateQueueLength(5);

      const scaleDownSpy = vi.fn();
      scaler.on("scale-down", scaleDownSpy);
      scaler.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(scaleDownSpy).not.toHaveBeenCalled();

      scaler.stop();
    });

    it("should not scale down below minWorkers", async () => {
      // Already at min capacity
      mockPoolCore.setWorkerCounts(2, 0);
      mockMetrics.updateWorkerCount(2, 0);
      mockMetrics.updateQueueLength(0);

      const scaleDownSpy = vi.fn();
      scaler.on("scale-down", scaleDownSpy);
      scaler.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(scaleDownSpy).not.toHaveBeenCalled();

      scaler.stop();
    });

    it("should cap scale-down by excess workers", async () => {
      // Close to min, only 1 excess worker
      mockPoolCore.setWorkerCounts(3, 0);
      mockMetrics.updateWorkerCount(3, 0);
      mockMetrics.updateQueueLength(0);

      const scaleDownSpy = vi.fn();
      scaler.on("scale-down", scaleDownSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 500 });

      // Should scale down by 1 (excess) not 2 (configured step)
      expect(scaleDownSpy).toHaveBeenCalledWith(1, expect.any(String), expect.any(Object));

      scaler.stop();
    });
  });

  describe("Cooldown Mechanism", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 10,
          scaleUpThreshold: 0.8,
          checkInterval: 50,
          cooldownPeriod: 200,
        },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should prevent scaling during cooldown period", async () => {
      // First scale-up
      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 300 });

      // Try to trigger another scale-up immediately
      mockMetrics.updateQueueLength(30);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should only have been called once due to cooldown
      expect(scaleUpSpy).toHaveBeenCalledTimes(1);

      scaler.stop();
    });

    it("should allow scaling after cooldown period expires", async () => {
      // First scale-up
      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 300 });

      // Wait for cooldown to expire
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Update to keep high load
      mockMetrics.updateWorkerCount(5, 5);
      mockMetrics.updateQueueLength(25);

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalledTimes(2), { timeout: 300 });

      scaler.stop();
    });
  });

  describe("Pause and Resume", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        {
          scaleUpThreshold: 0.8,
          checkInterval: 50,
          cooldownPeriod: 50,
        },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should not scale when paused", async () => {
      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();
      scaler.pause();

      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(scaleUpSpy).not.toHaveBeenCalled();

      scaler.stop();
    });

    it("should resume scaling after resume", async () => {
      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();
      scaler.pause();

      await new Promise((resolve) => setTimeout(resolve, 100));

      scaler.resume();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 300 });

      scaler.stop();
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      scaler = new AutoScaler(
        {
          scaleUpThreshold: 0.8,
          checkInterval: 50,
          cooldownPeriod: 50,
        },
        mockPoolCore,
        mockMetrics
      );
    });

    it("should emit error event on scaling failure", async () => {
      const errorMessage = "Scale-up failed";
      vi.spyOn(mockPoolCore, "scaleUp").mockRejectedValue(new Error(errorMessage));

      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20);

      const errorSpy = vi.fn();
      scaler.on("error", errorSpy);
      scaler.start();

      await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled(), { timeout: 300 });

      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: errorMessage }));

      scaler.stop();
    });
  });

  describe("Disposal", () => {
    beforeEach(() => {
      scaler = new AutoScaler({ checkInterval: 100 }, mockPoolCore, mockMetrics);
    });

    it("should stop scaling on disposal", () => {
      scaler.start();
      expect(scaler.getStatus().isRunning).toBe(true);

      scaler.dispose();

      expect(scaler.getStatus().isRunning).toBe(false);
    });

    it("should remove all listeners on disposal", () => {
      const listener = vi.fn();
      scaler.on("scale-up", listener);
      scaler.on("scale-down", listener);
      scaler.on("error", listener);

      scaler.dispose();

      expect(scaler.listenerCount("scale-up")).toBe(0);
      expect(scaler.listenerCount("scale-down")).toBe(0);
      expect(scaler.listenerCount("error")).toBe(0);
    });

    it("should be idempotent", () => {
      scaler.dispose();
      scaler.dispose(); // Second disposal

      expect(scaler.getStatus().isRunning).toBe(false);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle realistic traffic spike", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 8,
          scaleUpThreshold: 0.7,
          scaleDownThreshold: 0.3,
          queueLengthThreshold: 5,
          checkInterval: 50,
          cooldownPeriod: 100,
          scaleUpStep: 2,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      // Start with 2 workers
      mockPoolCore.setWorkerCounts(2, 2);
      mockMetrics.updateWorkerCount(2, 2);
      mockMetrics.updateQueueLength(10);

      scaler.start();

      // Wait for first scale-up
      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });
      expect(mockPoolCore.getWorkerCount()).toBe(4);

      // Continue high load
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(12);

      // Wait for second scale-up
      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalledTimes(2), { timeout: 200 });
      expect(mockPoolCore.getWorkerCount()).toBe(6);

      // Load decreases
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockPoolCore.setWorkerCounts(6, 1);
      mockMetrics.updateWorkerCount(6, 1);
      mockMetrics.updateQueueLength(0);

      // Wait for scale-down
      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 200 });

      scaler.stop();
    });

    it("should maintain stability under normal load", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 4,
          maxWorkers: 10,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          checkInterval: 50,
          cooldownPeriod: 50,
        },
        mockPoolCore,
        mockMetrics
      );

      // Set moderate utilization (50%)
      mockPoolCore.setWorkerCounts(4, 2);
      mockMetrics.updateWorkerCount(4, 2);
      mockMetrics.updateQueueLength(2);

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      scaler.start();

      await new Promise((resolve) => setTimeout(resolve, 300));

      // Should not scale in either direction
      expect(scaleUpSpy).not.toHaveBeenCalled();
      expect(scaleDownSpy).not.toHaveBeenCalled();
      expect(mockPoolCore.getWorkerCount()).toBe(4);

      scaler.stop();
    });
  });

  describe("Pressure Testing: Rapid Scaling Cycles", () => {
    /**
     * Tests rapid sequential scaling operations to ensure the auto-scaler
     * handles fast toggling between scale-up and scale-down correctly.
     */
    it("should handle rapid alternating scale-up and scale-down cycles", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 10,
          scaleUpThreshold: 0.7,
          scaleDownThreshold: 0.3,
          checkInterval: 30,
          cooldownPeriod: 50,
          scaleUpStep: 2,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      scaler.start();

      // Cycle 1: High load → Scale up
      mockPoolCore.setWorkerCounts(2, 2);
      mockMetrics.updateWorkerCount(2, 2);
      mockMetrics.updateQueueLength(15);

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      // Cycle 2: Load drops → Scale down (after cooldown)
      await new Promise((resolve) => setTimeout(resolve, 100));
      mockPoolCore.setWorkerCounts(4, 1);
      mockMetrics.updateWorkerCount(4, 1);
      mockMetrics.updateQueueLength(0);

      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 200 });

      // Cycle 3: High load again → Scale up
      await new Promise((resolve) => setTimeout(resolve, 100));
      mockPoolCore.setWorkerCounts(3, 3);
      mockMetrics.updateWorkerCount(3, 3);
      mockMetrics.updateQueueLength(20);

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalledTimes(2), { timeout: 200 });

      expect(scaleUpSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(scaleDownSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      scaler.stop();
    });

    it("should maintain stability during 10 rapid load fluctuations", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 12,
          scaleUpThreshold: 0.75,
          scaleDownThreshold: 0.25,
          checkInterval: 25,
          cooldownPeriod: 50,
          scaleUpStep: 1,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      const errorSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);
      scaler.on("error", errorSpy);

      scaler.start();

      // Simulate 10 rapid load fluctuations
      const fluctuations = [
        { workers: 2, active: 2, queue: 20 }, // High load
        { workers: 2, active: 1, queue: 0 }, // Low load
        { workers: 3, active: 3, queue: 15 }, // High load
        { workers: 3, active: 1, queue: 2 }, // Low load
        { workers: 4, active: 4, queue: 18 }, // High load
        { workers: 4, active: 1, queue: 0 }, // Low load
        { workers: 5, active: 3, queue: 12 }, // Medium load
        { workers: 5, active: 1, queue: 1 }, // Low load
        { workers: 6, active: 6, queue: 16 }, // High load
        { workers: 6, active: 2, queue: 0 }, // Low load
      ];

      for (const fluc of fluctuations) {
        mockPoolCore.setWorkerCounts(fluc.workers, fluc.active);
        mockMetrics.updateWorkerCount(fluc.workers, fluc.active);
        mockMetrics.updateQueueLength(fluc.queue);
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      // Should not crash or have errors
      expect(errorSpy).not.toHaveBeenCalled();
      // Should make at least one scaling decision
      expect(scaleUpSpy.mock.calls.length + scaleDownSpy.mock.calls.length).toBeGreaterThan(0);

      scaler.stop();
    });

    it("should not lose events during rapid successive cycles", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 1,
          maxWorkers: 10,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          checkInterval: 20,
          cooldownPeriod: 40,
          scaleUpStep: 1,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const events: Array<{ type: string; magnitude: number }> = [];
      scaler.on("scale-up", (magnitude) => events.push({ type: "scale-up", magnitude }));
      scaler.on("scale-down", (magnitude) => events.push({ type: "scale-down", magnitude }));

      scaler.start();

      // Trigger rapid scale-ups
      for (let i = 0; i < 5; i++) {
        mockPoolCore.setWorkerCounts(1 + i, 1 + i);
        mockMetrics.updateWorkerCount(1 + i, 1 + i);
        mockMetrics.updateQueueLength(20);
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      // Events should be recorded (subject to cooldown limits)
      expect(events.length).toBeGreaterThan(0);

      scaler.stop();
    });
  });

  describe("Pressure Testing: Extreme Load Scenarios", () => {
    /**
     * Tests auto-scaler behavior under extreme and unrealistic load conditions,
     * ensuring graceful handling of edge cases and extreme metrics.
     */
    it("should handle extremely high queue length (10000+ items)", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 100,
          scaleUpThreshold: 0.6,
          queueLengthThreshold: 100,
          checkInterval: 50,
          cooldownPeriod: 50,
          scaleUpStep: 10,
        },
        mockPoolCore,
        mockMetrics
      );

      mockPoolCore.setWorkerCounts(2, 2);
      mockMetrics.updateWorkerCount(2, 2);
      mockMetrics.updateQueueLength(10000); // Extreme queue

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      // Should scale up significantly but not beyond maxWorkers
      const workersAfterScale = mockPoolCore.getWorkerCount();
      expect(workersAfterScale).toBeLessThanOrEqual(100);

      scaler.stop();
    });

    it("should handle extreme utilization ratios (99% and 1%)", async () => {
      // Create scaler first with realistic max workers
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 50,
          scaleUpThreshold: 0.75,
          scaleDownThreshold: 0.05,
          queueLengthThreshold: 1,
          checkInterval: 50,
          cooldownPeriod: 50,
          scaleUpStep: 3,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      scaler.start();

      // Test 99% utilization (with small pool for reliability)
      mockPoolCore.setWorkerCounts(10, 10);
      mockMetrics.updateWorkerCount(10, 10);
      mockMetrics.updateQueueLength(15);

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      // Verify scale-up occurred
      expect(scaleUpSpy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );

      // Reset and test 1% utilization
      await new Promise((resolve) => setTimeout(resolve, 100));
      mockPoolCore.setWorkerCounts(50, 1);
      mockMetrics.updateWorkerCount(50, 1);
      mockMetrics.updateQueueLength(0);

      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 200 });

      expect(scaleDownSpy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );

      scaler.stop();
    });

    it("should handle maximum worker pool size (1000 workers)", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 100,
          maxWorkers: 1000,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          checkInterval: 50,
          cooldownPeriod: 50,
          scaleUpStep: 100,
          scaleDownStep: 50,
        },
        mockPoolCore,
        mockMetrics
      );

      mockPoolCore.setWorkerCounts(1000, 800);
      mockMetrics.updateWorkerCount(1000, 800);
      mockMetrics.updateQueueLength(5000);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should not exceed max workers or crash
      expect(mockPoolCore.getWorkerCount()).toBeLessThanOrEqual(1000);

      scaler.stop();
    });

    it("should gracefully handle zero workers scenario", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 0,
          maxWorkers: 10,
          scaleUpThreshold: 0.5,
          checkInterval: 50,
          cooldownPeriod: 50,
        },
        mockPoolCore,
        mockMetrics
      );

      mockPoolCore.setWorkerCounts(0, 0);
      mockMetrics.updateWorkerCount(0, 0);
      mockMetrics.updateQueueLength(100);

      const scaleUpSpy = vi.fn();
      const errorSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("error", errorSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      expect(errorSpy).not.toHaveBeenCalled();

      scaler.stop();
    });
  });

  describe("Pressure Testing: Rate Limiting Performance", () => {
    /**
     * Tests auto-scaler performance when heavily rate-limited,
     * ensuring fairness and predictable behavior under constraints.
     */
    it("should respect strict rate limiting (1 scale action per 500ms)", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 20,
          scaleUpThreshold: 0.7,
          scaleDownThreshold: 0.2,
          checkInterval: 30, // Frequent checks
          cooldownPeriod: 500, // Strict rate limiting
          scaleUpStep: 2,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      // Trigger multiple high-load conditions rapidly
      for (let i = 0; i < 5; i++) {
        mockPoolCore.setWorkerCounts(2 + i, 2 + i);
        mockMetrics.updateWorkerCount(2 + i, 2 + i);
        mockMetrics.updateQueueLength(50);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Despite rapid triggers, should only scale a few times due to cooldown
      expect(scaleUpSpy.mock.calls.length).toBeLessThanOrEqual(3);

      scaler.stop();
    });

    it("should handle performance under max rate limiting (100ms cooldown)", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 1,
          maxWorkers: 50,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          checkInterval: 20, // Very frequent checks
          cooldownPeriod: 100, // Very strict rate limiting
          scaleUpStep: 5,
        },
        mockPoolCore,
        mockMetrics
      );

      const startTime = Date.now();
      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      // Maintain high load for extended period
      const maintainHighLoad = setInterval(() => {
        mockPoolCore.setWorkerCounts(1, 1);
        mockMetrics.updateWorkerCount(1, 1);
        mockMetrics.updateQueueLength(100);
      }, 25);

      await new Promise((resolve) => setTimeout(resolve, 500));
      clearInterval(maintainHighLoad);

      const elapsedTime = Date.now() - startTime;

      // Should not lag significantly
      expect(elapsedTime).toBeLessThan(1000);
      // Should make reasonable scaling decisions
      expect(scaleUpSpy.mock.calls.length).toBeGreaterThanOrEqual(1);

      scaler.stop();
    });

    it("should queue and process scaling decisions fairly under rate limit", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 15,
          scaleUpThreshold: 0.75,
          scaleDownThreshold: 0.25,
          checkInterval: 40,
          cooldownPeriod: 200,
          scaleUpStep: 1,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const decisions: Array<{ action: string; reason: string; time: number }> = [];
      const startTime = Date.now();

      scaler.on("scale-up", (magnitude, reason) => {
        decisions.push({ action: "scale-up", reason, time: Date.now() - startTime });
      });
      scaler.on("scale-down", (magnitude, reason) => {
        decisions.push({ action: "scale-down", reason, time: Date.now() - startTime });
      });

      scaler.start();

      // Alternate between high and low load patterns
      for (let cycle = 0; cycle < 3; cycle++) {
        // High load phase
        mockPoolCore.setWorkerCounts(2 + cycle, 2 + cycle);
        mockMetrics.updateWorkerCount(2 + cycle, 2 + cycle);
        mockMetrics.updateQueueLength(30);
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Low load phase
        mockPoolCore.setWorkerCounts(5 + cycle, 0);
        mockMetrics.updateWorkerCount(5 + cycle, 0);
        mockMetrics.updateQueueLength(0);
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      // Decisions should be spread out respecting cooldown
      if (decisions.length > 1) {
        for (let i = 1; i < decisions.length; i++) {
          const timeBetweenDecisions = decisions[i].time - decisions[i - 1].time;
          expect(timeBetweenDecisions).toBeGreaterThanOrEqual(180); // Allow some variance
        }
      }

      scaler.stop();
    });
  });

  describe("Pressure Testing: Cascading Scale Actions", () => {
    /**
     * Tests scenarios where multiple scaling conditions occur simultaneously
     * or in quick succession, ensuring correct prioritization and handling.
     */
    it("should handle simultaneous scale-up and queue pressure", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 15,
          scaleUpThreshold: 0.7,
          queueLengthThreshold: 5,
          checkInterval: 50,
          cooldownPeriod: 50,
          scaleUpStep: 2,
        },
        mockPoolCore,
        mockMetrics
      );

      // Both high utilization AND high queue length
      mockPoolCore.setWorkerCounts(4, 3);
      mockMetrics.updateWorkerCount(4, 3);
      mockMetrics.updateQueueLength(50);

      const scaleUpSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.start();

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      // Should make decisive scale-up decision
      expect(scaleUpSpy).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(String),
        expect.any(Object)
      );

      scaler.stop();
    });

    it("should handle threshold boundary transitions correctly", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 20,
          scaleUpThreshold: 0.75,
          scaleDownThreshold: 0.25,
          queueLengthThreshold: 10,
          checkInterval: 50,
          cooldownPeriod: 50,
          scaleUpStep: 2,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      scaler.start();

      // Test just below threshold - should NOT scale up
      mockPoolCore.setWorkerCounts(4, 3);
      mockMetrics.updateWorkerCount(4, 3);
      mockMetrics.updateQueueLength(1); // Below queue threshold

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(scaleUpSpy).not.toHaveBeenCalled();

      // Exceed threshold with queue pressure - should scale up
      await new Promise((resolve) => setTimeout(resolve, 50));
      mockPoolCore.setWorkerCounts(4, 4);
      mockMetrics.updateWorkerCount(4, 4);
      mockMetrics.updateQueueLength(20); // Exceed queue threshold

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      scaler.stop();
    });

    it("should recover from over-scaling situations", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 10,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.2,
          queueLengthThreshold: 5,
          checkInterval: 50,
          cooldownPeriod: 100,
          scaleUpStep: 3,
          scaleDownStep: 2,
        },
        mockPoolCore,
        mockMetrics
      );

      const scaleUpSpy = vi.fn();
      const scaleDownSpy = vi.fn();
      scaler.on("scale-up", scaleUpSpy);
      scaler.on("scale-down", scaleDownSpy);

      scaler.start();

      // Trigger aggressive scale-up
      mockPoolCore.setWorkerCounts(2, 2);
      mockMetrics.updateWorkerCount(2, 2);
      mockMetrics.updateQueueLength(100);

      await vi.waitFor(() => expect(scaleUpSpy).toHaveBeenCalled(), { timeout: 200 });

      const workersAfterScaleUp = mockPoolCore.getWorkerCount();

      // Load suddenly drops - wait for cooldown to expire
      await new Promise((resolve) => setTimeout(resolve, 150));
      mockPoolCore.setWorkerCounts(workersAfterScaleUp, 0);
      mockMetrics.updateWorkerCount(workersAfterScaleUp, 0);
      mockMetrics.updateQueueLength(0);

      // Should scale down to recover after cooldown expires
      await vi.waitFor(() => expect(scaleDownSpy).toHaveBeenCalled(), { timeout: 200 });

      const workersAfterRecovery = mockPoolCore.getWorkerCount();
      expect(workersAfterRecovery).toBeLessThan(workersAfterScaleUp);

      scaler.stop();
    });

    it("should maintain consistent behavior through 5 full scaling cycles", async () => {
      scaler = new AutoScaler(
        {
          minWorkers: 2,
          maxWorkers: 12,
          scaleUpThreshold: 0.7,
          scaleDownThreshold: 0.3,
          checkInterval: 40,
          cooldownPeriod: 80,
          scaleUpStep: 2,
          scaleDownStep: 1,
        },
        mockPoolCore,
        mockMetrics
      );

      const cycleResults: Array<{ cycleNum: number; startWorkers: number; endWorkers: number }> =
        [];
      let currentCycle = 0;

      const recordCycle = () => {
        cycleResults.push({
          cycleNum: currentCycle,
          startWorkers: mockPoolCore.getWorkerCount(),
          endWorkers: 0, // Update later
        });
      };

      scaler.start();

      for (currentCycle = 1; currentCycle <= 5; currentCycle++) {
        recordCycle();

        // High load
        mockPoolCore.setWorkerCounts(mockPoolCore.getWorkerCount(), mockPoolCore.getWorkerCount());
        mockMetrics.updateWorkerCount(mockPoolCore.getWorkerCount(), mockPoolCore.getWorkerCount());
        mockMetrics.updateQueueLength(25);

        await new Promise((resolve) => setTimeout(resolve, 120));

        // Low load
        mockPoolCore.setWorkerCounts(mockPoolCore.getWorkerCount(), 1);
        mockMetrics.updateWorkerCount(mockPoolCore.getWorkerCount(), 1);
        mockMetrics.updateQueueLength(0);

        await new Promise((resolve) => setTimeout(resolve, 120));

        cycleResults[currentCycle - 1].endWorkers = mockPoolCore.getWorkerCount();
      }

      // All cycles should complete without crash
      expect(cycleResults.length).toBe(5);

      // Worker count should stay within bounds throughout
      for (const cycle of cycleResults) {
        expect(cycle.startWorkers).toBeGreaterThanOrEqual(2);
        expect(cycle.startWorkers).toBeLessThanOrEqual(12);
        expect(cycle.endWorkers).toBeGreaterThanOrEqual(2);
        expect(cycle.endWorkers).toBeLessThanOrEqual(12);
      }

      scaler.stop();
    });
  });
});
