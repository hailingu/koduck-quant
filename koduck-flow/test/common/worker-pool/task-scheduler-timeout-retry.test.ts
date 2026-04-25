/**
 * @file Task Timeout and Retry Tests
 * @module worker-pool/task-scheduler-timeout-retry.test
 *
 * Tests for timeout handling and retry mechanisms in TaskScheduler
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TaskScheduler } from "../../../src/common/worker-pool/task-scheduler";
import { createTaskContext } from "../../../src/common/worker-pool/task-context";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";

describe("TaskScheduler - Timeout and Retry", () => {
  let scheduler: TaskScheduler;
  let config: WorkerPoolConfig;

  beforeEach(() => {
    config = {
      workerCount: 2,
      maxQueueSize: 100,
      defaultTaskTimeout: 1000,
      maxRetries: 3,
      retryDelay: 100,
      retryStrategy: "fixed",
    };
    scheduler = new TaskScheduler(config);
  });

  afterEach(() => {
    scheduler.dispose();
  });

  describe("Timeout Handling", () => {
    it("should start timeout timer for task", () => {
      const task = createTaskContext(
        "test-1",
        "compute",
        { value: 42 },
        {
          timeout: 500,
          maxRetries: 2,
        }
      );

      const onTimeout = vi.fn();
      scheduler.startTaskTimeout(task, onTimeout);

      expect(task.timeoutTimer).not.toBeNull();
    });

    it("should cancel timeout timer", () => {
      const task = createTaskContext(
        "test-2",
        "compute",
        { value: 42 },
        {
          timeout: 500,
        }
      );

      const onTimeout = vi.fn();
      scheduler.startTaskTimeout(task, onTimeout);
      expect(task.timeoutTimer).not.toBeNull();

      scheduler.cancelTaskTimeout(task);
      expect(task.timeoutTimer).toBeNull();
    });

    it("should invoke onTimeout callback when task times out", async () => {
      const task = createTaskContext(
        "test-3",
        "compute",
        { value: 42 },
        {
          timeout: 50, // 50ms timeout
          maxRetries: 1,
        }
      );

      const onTimeout = vi.fn();
      scheduler.startTaskTimeout(task, onTimeout);

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTimeout).toHaveBeenCalledWith(task);
      expect(task.error).toBeDefined();
      expect(task.error?.name).toBe("TaskTimeoutError");
    });

    it("should increment totalTimedOut stat", async () => {
      const task = createTaskContext(
        "test-4",
        "compute",
        { value: 42 },
        {
          timeout: 50,
          maxRetries: 0, // No retries
        }
      );

      const onTimeout = vi.fn();
      scheduler.startTaskTimeout(task, onTimeout);

      const statsBefore = scheduler.getStats();
      expect(statsBefore.totalTimedOut).toBe(0);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const statsAfter = scheduler.getStats();
      expect(statsAfter.totalTimedOut).toBe(1);
    });

    it("should not timeout if cancelled before expiry", async () => {
      const task = createTaskContext(
        "test-5",
        "compute",
        { value: 42 },
        {
          timeout: 100,
        }
      );

      const onTimeout = vi.fn();
      scheduler.startTaskTimeout(task, onTimeout);

      // Cancel before timeout
      await new Promise((resolve) => setTimeout(resolve, 50));
      scheduler.cancelTaskTimeout(task);

      // Wait past original timeout
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  describe("Retry Logic - Fixed Strategy", () => {
    it("should schedule task for retry with fixed delay", () => {
      const task = createTaskContext(
        "test-6",
        "compute",
        { value: 42 },
        {
          maxRetries: 3,
          retryDelay: 200,
          retryStrategy: "fixed",
        }
      );

      task.error = new Error("Task failed");
      scheduler.scheduleRetry(task);

      expect(task.status).toBe("retrying");
      expect(task.nextRetryTime).toBeGreaterThan(Date.now());
      expect(scheduler.getStats().retryQueueSize).toBe(1);
    });

    it("should use fixed delay regardless of retry count", () => {
      const task = createTaskContext(
        "test-7",
        "compute",
        { value: 42 },
        {
          maxRetries: 3,
          retryDelay: 100,
          retryStrategy: "fixed",
        }
      );

      // First retry
      task.retryCount = 0;
      scheduler.scheduleRetry(task);
      const firstDelay = task.nextRetryTime! - Date.now();

      // Clear for second retry
      task.status = "failed";
      task.nextRetryTime = null;

      // Second retry
      task.retryCount = 1;
      scheduler.scheduleRetry(task);
      const secondDelay = task.nextRetryTime! - Date.now();

      // Fixed strategy should have similar delays (within 10ms tolerance)
      expect(Math.abs(secondDelay - firstDelay)).toBeLessThan(10);
    });
  });

  describe("Retry Logic - Exponential Backoff", () => {
    it("should calculate exponential backoff delay", () => {
      const task = createTaskContext(
        "test-8",
        "compute",
        { value: 42 },
        {
          maxRetries: 4,
          retryDelay: 100,
          retryStrategy: "exponential",
        }
      );

      // First retry: 100ms
      task.retryCount = 0;
      scheduler.scheduleRetry(task);
      const delay1 = task.nextRetryTime! - Date.now();
      expect(delay1).toBeGreaterThanOrEqual(90); // 100ms ± tolerance
      expect(delay1).toBeLessThanOrEqual(110);

      task.status = "failed";
      task.nextRetryTime = null;

      // Second retry: 200ms
      task.retryCount = 1;
      scheduler.scheduleRetry(task);
      const delay2 = task.nextRetryTime! - Date.now();
      expect(delay2).toBeGreaterThanOrEqual(190);
      expect(delay2).toBeLessThanOrEqual(210);

      task.status = "failed";
      task.nextRetryTime = null;

      // Third retry: 400ms
      task.retryCount = 2;
      scheduler.scheduleRetry(task);
      const delay3 = task.nextRetryTime! - Date.now();
      expect(delay3).toBeGreaterThanOrEqual(390);
      expect(delay3).toBeLessThanOrEqual(410);
    });

    it("should apply maxRetryDelay cap for exponential backoff", () => {
      const task = createTaskContext(
        "test-9",
        "compute",
        { value: 42 },
        {
          maxRetries: 5,
          retryDelay: 100,
          retryStrategy: "exponential",
          maxRetryDelay: 500,
        }
      );

      // Retry with high count (would be 100 * 2^4 = 1600ms without cap)
      task.retryCount = 4;
      scheduler.scheduleRetry(task);
      const delay = task.nextRetryTime! - Date.now();

      expect(delay).toBeLessThanOrEqual(510); // Should be capped at 500ms
    });
  });

  describe("Retry Logic - Linear Backoff", () => {
    it("should calculate linear backoff delay", () => {
      const task = createTaskContext(
        "test-10",
        "compute",
        { value: 42 },
        {
          maxRetries: 4,
          retryDelay: 100,
          retryStrategy: "linear",
        }
      );

      // First retry: 100ms * 1
      task.retryCount = 0;
      scheduler.scheduleRetry(task);
      const delay1 = task.nextRetryTime! - Date.now();
      expect(delay1).toBeGreaterThanOrEqual(90);
      expect(delay1).toBeLessThanOrEqual(110);

      task.status = "failed";
      task.nextRetryTime = null;

      // Second retry: 100ms * 2
      task.retryCount = 1;
      scheduler.scheduleRetry(task);
      const delay2 = task.nextRetryTime! - Date.now();
      expect(delay2).toBeGreaterThanOrEqual(190);
      expect(delay2).toBeLessThanOrEqual(210);

      task.status = "failed";
      task.nextRetryTime = null;

      // Third retry: 100ms * 3
      task.retryCount = 2;
      scheduler.scheduleRetry(task);
      const delay3 = task.nextRetryTime! - Date.now();
      expect(delay3).toBeGreaterThanOrEqual(290);
      expect(delay3).toBeLessThanOrEqual(310);
    });
  });

  describe("Retry Queue Management", () => {
    it("should add task to retry queue", () => {
      const task = createTaskContext(
        "test-11",
        "compute",
        { value: 42 },
        {
          maxRetries: 2,
          retryDelay: 100,
        }
      );

      const statsBefore = scheduler.getStats();
      expect(statsBefore.retryQueueSize).toBe(0);

      scheduler.scheduleRetry(task);

      const statsAfter = scheduler.getStats();
      expect(statsAfter.retryQueueSize).toBe(1);
    });

    it("should process retry queue and re-enqueue ready tasks", async () => {
      const task = createTaskContext(
        "test-12",
        "compute",
        { value: 42 },
        {
          maxRetries: 2,
          retryDelay: 50, // 50ms delay
        }
      );

      scheduler.scheduleRetry(task);
      expect(scheduler.getStats().retryQueueSize).toBe(1);

      // Wait for retry delay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Task should be moved to main queue
      expect(scheduler.getStats().retryQueueSize).toBe(0);
      expect(task.retryCount).toBe(1);
      expect(task.status).toBe("pending");
    });

    it("should track totalRetries stat", async () => {
      const task = createTaskContext(
        "test-13",
        "compute",
        { value: 42 },
        {
          maxRetries: 2,
          retryDelay: 50,
        }
      );

      const statsBefore = scheduler.getStats();
      expect(statsBefore.totalRetries).toBe(0);

      scheduler.scheduleRetry(task);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const statsAfter = scheduler.getStats();
      expect(statsAfter.totalRetries).toBe(1);
    });

    it("should not retry if max retries exceeded", () => {
      const task = createTaskContext(
        "test-14",
        "compute",
        { value: 42 },
        {
          maxRetries: 2,
          retryDelay: 100,
        }
      );

      // Set retry count to max (2 retries allowed, so at 2 we can't retry again)
      task.retryCount = 2;

      // Mock resolve/reject
      const rejectFn = vi.fn();
      task.reject = rejectFn;

      scheduler.scheduleRetry(task);

      expect(task.status).toBe("failed");
      expect(scheduler.getStats().retryQueueSize).toBe(0);
      expect(rejectFn).toHaveBeenCalled();
      expect(scheduler.getStats().retriedTasksFailed).toBe(1);
    });
  });

  describe("Retry Success Tracking", () => {
    it("should track retriedTasksSucceeded when retry count > 0", () => {
      const task = createTaskContext("test-15", "compute", { value: 42 });
      task.retryCount = 2;

      scheduler.markRetrySuccess(task);

      expect(scheduler.getStats().retriedTasksSucceeded).toBe(1);
    });

    it("should not track retriedTasksSucceeded for first attempt", () => {
      const task = createTaskContext("test-16", "compute", { value: 42 });
      task.retryCount = 0;

      scheduler.markRetrySuccess(task);

      expect(scheduler.getStats().retriedTasksSucceeded).toBe(0);
    });
  });

  describe("Combined Timeout and Retry", () => {
    it("should retry task after timeout", async () => {
      const task = createTaskContext(
        "test-17",
        "compute",
        { value: 42 },
        {
          timeout: 30,
          maxRetries: 2,
          retryDelay: 20, // Short delay to ensure nextRetryTime is soon
        }
      );

      // Verify initial state
      expect(task.retryCount).toBe(0);
      expect(task.maxRetries).toBe(2);

      const onTimeout = vi.fn((timedOutTask) => {
        // Immediately check state when timeout fires
        expect(timedOutTask.taskId).toBe("test-17");
        expect(timedOutTask.retryCount).toBe(0);
      });

      scheduler.startTaskTimeout(task, onTimeout);

      // Wait for timeout to fire (30ms) + some buffer (20ms) = 50ms
      // This is before processRetryQueue (100ms) so we can catch it in retryQueue
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify timeout occurred
      expect(onTimeout).toHaveBeenCalled();
      expect(scheduler.getStats().totalTimedOut).toBe(1);

      // Verify task was added to retry queue
      expect(scheduler.getStats().retryQueueSize).toBe(1);
      expect(task.status).toBe("retrying");
      expect(task.retryCount).toBe(1); // Incremented by scheduleRetry

      // Now wait longer to let retry processor run multiple times
      // First cycle will move it from retry queue to main queue
      // Wait 200ms total to ensure processing
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify retry was re-enqueued (moved out of retry queue, into main queue)
      // So retryQueueSize should be 0, and totalRetries should be 1
      expect(scheduler.getStats().totalRetries).toBe(1);
    });
  });

  describe("Scheduler Disposal", () => {
    it("should stop retry checker on dispose", () => {
      const task = createTaskContext(
        "test-18",
        "compute",
        { value: 42 },
        {
          maxRetries: 2,
          retryDelay: 100,
        }
      );

      scheduler.scheduleRetry(task);
      expect(scheduler.getStats().retryQueueSize).toBe(1);

      scheduler.dispose();

      expect(scheduler.getStats().retryQueueSize).toBe(0);
    });

    it("should cancel all timeout timers on dispose for queued tasks", () => {
      const task1 = createTaskContext("test-19", "compute", { value: 1 });
      const task2 = createTaskContext("test-20", "compute", { value: 2 });

      // Start timers and add to queues
      scheduler.startTaskTimeout(task1, vi.fn());
      scheduler.startTaskTimeout(task2, vi.fn());
      scheduler.schedule(task1);
      scheduler.schedule(task2);

      expect(task1.timeoutTimer).not.toBeNull();
      expect(task2.timeoutTimer).not.toBeNull();

      scheduler.dispose();

      expect(task1.timeoutTimer).toBeNull();
      expect(task2.timeoutTimer).toBeNull();
    });
  });

  describe("getTotalQueueSize", () => {
    it("should include retry queue in total size", () => {
      const task1 = createTaskContext("test-21", "compute", { value: 1 });
      const task2 = createTaskContext(
        "test-22",
        "compute",
        { value: 2 },
        {
          maxRetries: 2,
          retryDelay: 100,
        }
      );

      // Add to main queue
      scheduler.schedule(task1);

      // Add to retry queue
      scheduler.scheduleRetry(task2);

      expect(scheduler.getQueueSize()).toBe(1); // Main queue only
      expect(scheduler.getTotalQueueSize()).toBe(2); // Main + retry
    });
  });
});
