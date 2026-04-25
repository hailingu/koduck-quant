import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { WorkerPoolManager } from "../../../src/common/worker-pool/worker-pool-manager";
import {
  WORKER_POOL_EVENTS,
  type WorkerPoolTaskSubmittedEvent,
} from "../../../src/common/worker-pool/events";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";
import type { EventBus } from "../../../src/common/event/event-bus";

/**
 * Integration tests for Worker Pool Event System Integration
 *
 * Verifies:
 * - Events are emitted to EventBus when tasks are submitted
 * - EventBus integration doesn't break pool operations
 * - Event data contains correct information
 * - Event emission handles errors gracefully
 */
describe("Worker Pool Event System Integration", () => {
  let manager: WorkerPoolManager;
  let mockEventBus: EventBus;
  let eventEmitSpy: ReturnType<typeof vi.spyOn>;

  /**
   * Helper function to wait for a specified duration
   */
  const waitAsync = (ms: number): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  };

  /**
   * Helper function to cancel a promise with timeout
   */
  const cancelWithTimeout = async (promise: Promise<unknown>): Promise<void> => {
    try {
      await Promise.race([promise, Promise.reject(new Error("timeout"))]);
    } catch {
      // Expected
    }
  };

  beforeEach(() => {
    // Create a mock EventBus for testing
    const eventEmitter = new EventEmitter();
    eventEmitSpy = vi.spyOn(eventEmitter, "emit") as unknown as ReturnType<typeof vi.spyOn>;

    // Create mock EventBus object that extends EventEmitter
    mockEventBus = eventEmitter as unknown as EventBus;

    // Create manager with mock EventBus
    const config: WorkerPoolConfig = {
      workerCount: 2,
      defaultTaskTimeout: 30000,
      maxQueueSize: 1000,
    };
    manager = new WorkerPoolManager(config, mockEventBus);
  });

  afterEach(async () => {
    await manager.dispose();
    vi.clearAllMocks();
  });

  describe("Event Bus Integration", () => {
    it("should initialize without EventBus", async () => {
      const configNoEvents: WorkerPoolConfig = {
        workerCount: 2,
        defaultTaskTimeout: 30000,
      };
      const managerNoEvents = new WorkerPoolManager(configNoEvents);

      expect(managerNoEvents).toBeDefined();
      await managerNoEvents.dispose();
    });

    it("should emit task-submitted event on task submission", async () => {
      await manager.initialize();

      const task = {
        type: "test",
        payload: { data: "test" },
        priority: 5,
      };

      const promise = manager.submit(task);

      // Give time for event emission
      await waitAsync(10);

      expect(eventEmitSpy).toHaveBeenCalledWith(
        WORKER_POOL_EVENTS.TASK_SUBMITTED,
        expect.objectContaining({
          type: WORKER_POOL_EVENTS.TASK_SUBMITTED,
          taskType: "test",
          priority: 5,
        })
      );

      // Cancel the promise
      await cancelWithTimeout(promise);
    });

    it("should include correct task data in event", async () => {
      await manager.initialize();

      const task = {
        type: "compute",
        payload: { value: 42 },
        priority: 8,
        timeout: 60000,
      };

      const promise = manager.submit(task);

      // Give time for event emission
      await waitAsync(10);

      const calls = eventEmitSpy.mock.calls as unknown[] as Array<[string, unknown]>;
      const taskSubmittedCall = calls.find((call) => call[0] === WORKER_POOL_EVENTS.TASK_SUBMITTED);

      expect(taskSubmittedCall).toBeDefined();
      if (taskSubmittedCall) {
        const eventData = taskSubmittedCall[1] as WorkerPoolTaskSubmittedEvent;
        expect(eventData.taskType).toBe("compute");
        expect(eventData.priority).toBe(8);
        expect(eventData.timeout).toBe(60000);
        expect(eventData.queueSize).toBeGreaterThanOrEqual(0);
        expect(eventData.timestamp).toBeLessThanOrEqual(Date.now());
      }

      // Cancel the promise
      await cancelWithTimeout(promise);
    });

    it("should include queue size in event", async () => {
      await manager.initialize();

      // Submit multiple tasks
      const promises: Array<Promise<unknown>> = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          manager.submit({
            type: "task",
            payload: { index: i },
          })
        );
      }

      // Give time for event emissions
      await waitAsync(20);

      const calls = eventEmitSpy.mock.calls as unknown[] as Array<[string, unknown]>;
      const taskSubmittedCalls = calls.filter(
        (call) => call[0] === WORKER_POOL_EVENTS.TASK_SUBMITTED
      );

      expect(taskSubmittedCalls.length).toBe(3);

      // Queue size should increase with each submission
      const queueSizes = taskSubmittedCalls.map(
        (call) => (call[1] as WorkerPoolTaskSubmittedEvent).queueSize
      );

      expect(queueSizes[0]).toBeLessThanOrEqual(queueSizes[1]);
      expect(queueSizes[1]).toBeLessThanOrEqual(queueSizes[2]);

      // Cancel promises
      for (const p of promises) {
        await cancelWithTimeout(p);
      }
    });

    it("should handle EventBus emission errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const throwingEventBus = new EventEmitter();
      throwingEventBus.emit = vi.fn(() => {
        throw new Error("Emission failed");
      });

      const config: WorkerPoolConfig = {
        workerCount: 2,
        defaultTaskTimeout: 30000,
      };
      const managerWithErrorBus = new WorkerPoolManager(
        config,
        throwingEventBus as unknown as EventBus
      );

      await managerWithErrorBus.initialize();

      // Submit task - should not throw even if event emission fails
      const task = {
        type: "test",
        payload: { data: "test" },
      };

      const promise = managerWithErrorBus.submit(task);
      await waitAsync(10);

      // EventBus emit should have been called
      expect(throwingEventBus.emit).toHaveBeenCalled();

      // Error should have been logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      await cancelWithTimeout(promise);
      await managerWithErrorBus.dispose();
    });

    it("should work correctly without EventBus", async () => {
      const config: WorkerPoolConfig = {
        workerCount: 2,
        defaultTaskTimeout: 30000,
      };
      const managerNoEventBus = new WorkerPoolManager(config);

      await managerNoEventBus.initialize();

      // Should be able to submit tasks without errors
      const task = {
        type: "test",
        payload: { data: "test" },
      };

      const promise = managerNoEventBus.submit(task);

      // Should not throw
      await cancelWithTimeout(promise);

      await managerNoEventBus.dispose();
    });
  });

  describe("Event Data Structure", () => {
    it("should emit event with all required fields", async () => {
      await manager.initialize();

      const task = {
        type: "analysis",
        payload: { input: "data" },
        priority: 7,
        timeout: 45000,
      };

      const promise = manager.submit(task);

      // Give time for event emission
      await waitAsync(10);

      const calls = eventEmitSpy.mock.calls as unknown[] as Array<[string, unknown]>;
      const taskSubmittedCall = calls.find((call) => call[0] === WORKER_POOL_EVENTS.TASK_SUBMITTED);

      expect(taskSubmittedCall).toBeDefined();
      if (taskSubmittedCall) {
        const eventData = taskSubmittedCall[1] as WorkerPoolTaskSubmittedEvent;

        // Check all required fields
        expect(eventData).toHaveProperty("type");
        expect(eventData).toHaveProperty("taskId");
        expect(eventData).toHaveProperty("taskType");
        expect(eventData).toHaveProperty("priority");
        expect(eventData).toHaveProperty("queueSize");
        expect(eventData).toHaveProperty("timestamp");

        // Check optional fields
        expect(eventData).toHaveProperty("timeout");

        // Verify types
        expect(typeof eventData.taskId).toBe("string");
        expect(typeof eventData.taskType).toBe("string");
        expect(typeof eventData.priority).toBe("number");
        expect(typeof eventData.queueSize).toBe("number");
        expect(typeof eventData.timestamp).toBe("number");
        expect(typeof eventData.timeout).toBe("number");
      }

      // Cancel promise
      await cancelWithTimeout(promise);
    });

    it("should use consistent event type identifier", async () => {
      await manager.initialize();

      const task = {
        type: "test",
        payload: {},
      };

      const promise = manager.submit(task);

      // Give time for event emission
      await waitAsync(10);

      const calls = eventEmitSpy.mock.calls as unknown[] as Array<[string, unknown]>;
      const taskSubmittedCall = calls.find((call) => call[0] === WORKER_POOL_EVENTS.TASK_SUBMITTED);

      expect(taskSubmittedCall).toBeDefined();
      if (taskSubmittedCall) {
        const eventData = taskSubmittedCall[1] as WorkerPoolTaskSubmittedEvent;
        expect(eventData.type).toBe(WORKER_POOL_EVENTS.TASK_SUBMITTED);
        expect(eventData.type).toBe("worker-pool:task-submitted");
      }

      // Cancel promise
      await cancelWithTimeout(promise);
    });
  });

  describe("Event Emission Timing", () => {
    it("should emit event immediately after task submission", async () => {
      await manager.initialize();

      const task = {
        type: "test",
        payload: {},
      };

      const submitTime = Date.now();
      const promise = manager.submit(task);

      // Give time for event emission
      await waitAsync(10);

      const calls = eventEmitSpy.mock.calls as unknown[] as Array<[string, unknown]>;
      const taskSubmittedCall = calls.find((call) => call[0] === WORKER_POOL_EVENTS.TASK_SUBMITTED);

      expect(taskSubmittedCall).toBeDefined();
      if (taskSubmittedCall) {
        const eventData = taskSubmittedCall[1] as WorkerPoolTaskSubmittedEvent;
        const eventTime = eventData.timestamp;

        // Event should be emitted around submission time
        expect(eventTime).toBeGreaterThanOrEqual(submitTime - 100);
        expect(eventTime).toBeLessThanOrEqual(Date.now() + 100);
      }

      // Cancel promise
      await cancelWithTimeout(promise);
    });
  });
});
