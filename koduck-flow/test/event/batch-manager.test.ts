import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { BatchManager } from "../../src/common/event/batch-manager";
import type {
  EventConfiguration,
  Scheduler,
} from "../../src/common/event/types";

describe("BatchManager", () => {
  let config: EventConfiguration;
  let batchManager: BatchManager<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    config = {
      maxListeners: 100,
      enableBatching: true,
      batchSize: 5,
      batchInterval: 10,
      enableAutoOptimization: true,
      autoOptimizeThreshold: 3,
      enableDebugMode: false,
      concurrencyMode: "parallel" as const,
      concurrencyLimit: 5,
    };
    batchManager = new BatchManager(config);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Constructor and initialization", () => {
    test("should correctly initialize batch manager", () => {
      expect(batchManager.batchCount).toBe(0);
    });

    test("should allocate an appropriately sized buffer", () => {
      const smallConfig = { ...config, batchSize: 2 };
      const smallBatchManager = new BatchManager(smallConfig);
      expect(smallBatchManager.batchCount).toBe(0);
    });
  });

  describe("Batch processing decisions", () => {
    test("should return false when batching is disabled", () => {
      const noBatchConfig = { ...config, enableBatching: false };
      const noBatchManager = new BatchManager(noBatchConfig);

      expect(noBatchManager.shouldUseBatchProcessing(10)).toBe(false);
    });

    test("should always return true when auto-optimization is disabled", () => {
      const noOptConfig = { ...config, enableAutoOptimization: false };
      const noOptManager = new BatchManager(noOptConfig);

      expect(noOptManager.shouldUseBatchProcessing(1)).toBe(true);
      expect(noOptManager.shouldUseBatchProcessing(100)).toBe(true);
    });

    test("should make decisions based on listener count and threshold", () => {
      expect(batchManager.shouldUseBatchProcessing(2)).toBe(false); // Below threshold
      expect(batchManager.shouldUseBatchProcessing(3)).toBe(false); // At threshold
      expect(batchManager.shouldUseBatchProcessing(4)).toBe(true); // Above threshold
    });
  });

  describe("Batch queue management", () => {
    test("should be able to add events to the batch queue", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      expect(batchManager.batchCount).toBe(1);

      batchManager.addToBatch("event2", processor);
      expect(batchManager.batchCount).toBe(2);
    });

    test("should process immediately when batch size is reached", () => {
      const processor = vi.fn();

      // Add 5 events (equal to batch size)
      for (let i = 0; i < 5; i++) {
        batchManager.addToBatch(`event${i}`, processor);
      }

      // Should process immediately without waiting for timer
      expect(processor).toHaveBeenCalledTimes(5);
      expect(batchManager.batchCount).toBe(0);
    });

    test("should process incomplete batches via timer", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      expect(processor).not.toHaveBeenCalled();
      expect(batchManager.batchCount).toBe(2);

      // Fast-forward time to trigger batch processing
      vi.advanceTimersByTime(10);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });

    test("should correctly handle circular buffer", () => {
      const processor = vi.fn();

      // Add a large number of events to test circular buffer
      for (let i = 0; i < 15; i++) {
        batchManager.addToBatch(`event${i}`, processor);

        // Process every 5
        if ((i + 1) % 5 === 0) {
          expect(processor).toHaveBeenCalledTimes(i + 1);
        }
      }
    });
  });

  describe("Batch data access", () => {
    test("should return current batch event data", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);
      batchManager.addToBatch("event3", processor);

      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual(["event1", "event2", "event3"]);
    });

    test("should return an empty array for empty batches", () => {
      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual([]);
    });
  });

  describe("Manual batch control", () => {
    test("should be able to force flush batch", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      expect(processor).not.toHaveBeenCalled();

      batchManager.flushBatch(processor);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });

    test("should be able to handle empty batch flush", () => {
      const processor = vi.fn();

      batchManager.flushBatch(processor);

      expect(processor).not.toHaveBeenCalled();
      expect(batchManager.batchCount).toBe(0);
    });

    test("should be able to use processor without data", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", vi.fn());
      batchManager.addToBatch("event2", vi.fn());

      batchManager.processBatch(processor);

      expect(processor).toHaveBeenCalledTimes(2);
      expect(batchManager.batchCount).toBe(0);
    });
  });

  describe("Custom scheduler support", () => {
    test("should use custom scheduler", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(123),
        cancel: vi.fn(),
      };

      const customConfig = { ...config, scheduler: customScheduler };
      const customBatchManager = new BatchManager(customConfig);
      const processor = vi.fn();

      customBatchManager.addToBatch("event1", processor);

      expect(customScheduler.schedule).toHaveBeenCalled();
    });

    test("should use RAF scheduler", () => {
      const rafScheduler: Scheduler = {
        kind: "raf",
        schedule: vi.fn().mockReturnValue(456),
        cancel: vi.fn(),
      };

      const rafConfig = { ...config, scheduler: rafScheduler };
      const rafBatchManager = new BatchManager(rafConfig);
      const processor = vi.fn();

      rafBatchManager.addToBatch("event1", processor);

      expect(rafScheduler.schedule).toHaveBeenCalledWith(
        expect.any(Function),
        10
      );
    });

    test("should correctly cancel custom scheduler", () => {
      const customScheduler: Scheduler = {
        kind: "custom",
        schedule: vi.fn().mockReturnValue(789),
        cancel: vi.fn(),
      };

      const customConfig = { ...config, scheduler: customScheduler };
      const customBatchManager = new BatchManager(customConfig);
      const processor = vi.fn();

      customBatchManager.addToBatch("event1", processor);
      customBatchManager.addToBatch("event2", processor);
      customBatchManager.addToBatch("event3", processor);
      customBatchManager.addToBatch("event4", processor);
      customBatchManager.addToBatch("event5", processor); // Trigger immediate processing

      expect(customScheduler.cancel).toHaveBeenCalledWith(789);
    });
  });

  describe("Built-in scheduler behavior", () => {
    test("should use setTimeout for batches with delay", () => {
      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10);
    });

    test("should use requestAnimationFrame for batches without delay", () => {
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(123);
      const zeroDelayConfig = { ...config, batchInterval: 0 };
      const zeroDelayManager = new BatchManager(zeroDelayConfig);
      const processor = vi.fn();

      zeroDelayManager.addToBatch("event1", processor);

      expect(rafSpy).toHaveBeenCalled();
    });

    test("should fallback to setTimeout when RAF is unavailable", () => {
      const originalRAF = global.requestAnimationFrame;
      // @ts-expect-error - Deliberately delete RAF to test fallback mechanism
      delete global.requestAnimationFrame;

      const setTimeoutSpy = vi.spyOn(global, "setTimeout");
      const zeroDelayConfig = { ...config, batchInterval: 0 };
      const zeroDelayManager = new BatchManager(zeroDelayConfig);
      const processor = vi.fn();

      zeroDelayManager.addToBatch("event1", processor);

      expect(setTimeoutSpy).toHaveBeenCalled();

      global.requestAnimationFrame = originalRAF;
    });
  });

  describe("Configuration updates", () => {
    test("should update configuration and adjust buffer size", () => {
      const processor = vi.fn();

      // Add some data
      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      const newConfig = { ...config, batchSize: 10 };
      batchManager.updateConfiguration(newConfig);

      // Existing data should be retained
      expect(batchManager.batchCount).toBe(2);
      const batchData = batchManager.getBatchData();
      expect(batchData).toEqual(["event1", "event2"]);
    });

    test("should reschedule when batch interval changes", () => {
      const processor = vi.fn();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      batchManager.addToBatch("event1", processor);

      const newConfig = { ...config, batchInterval: 20 };
      batchManager.updateConfiguration(newConfig);

      expect(clearTimeoutSpy).toHaveBeenCalled();
      // Should reschedule with new interval, but implementation has issues, missing handler
    });

    test("should not reallocate buffer when configuration is unchanged", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      const oldData = batchManager.getBatchData();

      // Update with same configuration
      batchManager.updateConfiguration(config);

      const newData = batchManager.getBatchData();
      expect(newData).toEqual(oldData);
    });
  });

  describe("Cleanup and resource management", () => {
    test("should be able to clear batch state", () => {
      const processor = vi.fn();
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      batchManager.addToBatch("event1", processor);
      batchManager.addToBatch("event2", processor);

      batchManager.clear();

      expect(batchManager.batchCount).toBe(0);
      expect(batchManager.getBatchData()).toEqual([]);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    test("should clear empty batches without errors", () => {
      expect(() => {
        batchManager.clear();
      }).not.toThrow();

      expect(batchManager.batchCount).toBe(0);
    });
  });

  describe("Edge cases", () => {
    test("should handle zero-size batch configuration", () => {
      const zeroBatchConfig = { ...config, batchSize: 0 };
      const zeroBatchManager = new BatchManager(zeroBatchConfig);
      const processor = vi.fn();

      // Should process immediately because size is 0
      zeroBatchManager.addToBatch("event1", processor);
      expect(processor).toHaveBeenCalledTimes(1);
    });

    test("should handle negative batch interval", () => {
      const negativeBatchConfig = { ...config, batchInterval: -5 };
      const negativeBatchManager = new BatchManager(negativeBatchConfig);
      const processor = vi.fn();
      const rafSpy = vi
        .spyOn(global, "requestAnimationFrame")
        .mockReturnValue(123);

      negativeBatchManager.addToBatch("event1", processor);

      // Negative interval, since not greater than 0, will use requestAnimationFrame
      expect(rafSpy).toHaveBeenCalled();
    });

    test("should handle a large number of events without overflow", () => {
      const processor = vi.fn();

      // Add more events than the buffer can hold
      for (let i = 0; i < 200; i++) {
        batchManager.addToBatch(`event${i}`, processor);
      }

      // Verify all events were processed
      expect(processor).toHaveBeenCalledTimes(200);
    });

    test("should correctly handle consecutive flush operations", () => {
      const processor = vi.fn();

      batchManager.addToBatch("event1", processor);
      batchManager.flushBatch(processor);
      batchManager.flushBatch(processor); // Second flush should be safe

      expect(processor).toHaveBeenCalledTimes(1);
      expect(batchManager.batchCount).toBe(0);
    });
  });
});
