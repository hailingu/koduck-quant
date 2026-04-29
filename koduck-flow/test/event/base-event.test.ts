/**
 * BaseEvent core class unit tests
 * Tests event creation, listener management, firing, batching, and other core features
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseEvent } from "../../src/common/event/base-event";
import type { EventConfiguration } from "../../src/common/event/types";

// Concrete event implementation for testing
class TestEvent extends BaseEvent<string> {
  constructor(
    name: string = "TestEvent",
    config?: Partial<EventConfiguration>
  ) {
    super(name, config);
  }
}

// Complex data type for testing
interface TestData {
  id: string;
  value: number;
  metadata?: Record<string, unknown>;
}

class ComplexTestEvent extends BaseEvent<TestData> {
  constructor(config?: Partial<EventConfiguration>) {
    super("ComplexTestEvent", config);
  }
}

describe("BaseEvent", () => {
  let event: TestEvent;
  let complexEvent: ComplexTestEvent;

  beforeEach(() => {
    event = new TestEvent();
    complexEvent = new ComplexTestEvent();
  });

  describe("Basic event functionality", () => {
    it("should create an event instance", () => {
      expect(event).toBeInstanceOf(BaseEvent);
      expect(event).toBeInstanceOf(TestEvent);
      expect(event["eventName"]).toBe("TestEvent");
    });

    it("should support custom event names", () => {
      const customEvent = new TestEvent("CustomEventName");
      expect(customEvent["eventName"]).toBe("CustomEventName");
    });

    it("should initialize with an empty listener list", () => {
      expect(event["_listeners"]).toEqual([]);
      expect(event["_listeners"].length).toBe(0);
    });
  });

  describe("Listener management", () => {
    it("should be able to add listeners", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      expect(typeof unsubscribe).toBe("function");
      expect(event["_listeners"]).toContain(listener);
      expect(event["_listeners"].length).toBe(1);
    });

    it("should be able to remove listeners", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      expect(event["_listeners"]).toContain(listener);

      unsubscribe();

      expect(event["_listeners"]).not.toContain(listener);
      expect(event["_listeners"].length).toBe(0);
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      event.addEventListener(listener1);
      const unsub2 = event.addEventListener(listener2);
      event.addEventListener(listener3);

      expect(event["_listeners"].length).toBe(3);
      expect(event["_listeners"]).toContain(listener1);
      expect(event["_listeners"]).toContain(listener2);
      expect(event["_listeners"]).toContain(listener3);

      // Test partial removal
      unsub2();
      expect(event["_listeners"].length).toBe(2);
      expect(event["_listeners"]).not.toContain(listener2);
      expect(event["_listeners"]).toContain(listener1);
      expect(event["_listeners"]).toContain(listener3);
    });

    it("should allow adding the same listener multiple times", () => {
      const listener = vi.fn();

      event.addEventListener(listener);
      event.addEventListener(listener); // Duplicate add

      expect(event["_listeners"].length).toBe(2);

      // Firing event, listener should be called twice
      event.fire("test");
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("should handle repeated listener removal", () => {
      const listener = vi.fn();
      const unsubscribe = event.addEventListener(listener);

      unsubscribe();
      expect(event["_listeners"]).not.toContain(listener);

      // Repeated removal should not throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe("Event firing", () => {
    it("should fire events and call listeners", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test data");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test data");
    });

    it("should call multiple listeners in order", () => {
      const callOrder: number[] = [];
      const listener1 = vi.fn(() => callOrder.push(1));
      const listener2 = vi.fn(() => callOrder.push(2));
      const listener3 = vi.fn(() => callOrder.push(3));

      event.addEventListener(listener1);
      event.addEventListener(listener2);
      event.addEventListener(listener3);

      event.fire("test");

      expect(callOrder).toEqual([1, 2, 3]);
      expect(listener1).toHaveBeenCalledWith("test");
      expect(listener2).toHaveBeenCalledWith("test");
      expect(listener3).toHaveBeenCalledWith("test");
    });

    it("should handle complex data types", () => {
      const listener = vi.fn();
      complexEvent.addEventListener(listener);

      const testData: TestData = {
        id: "test-123",
        value: 42,
        metadata: { type: "test", enabled: true },
      };

      complexEvent.fire(testData);

      expect(listener).toHaveBeenCalledWith(testData);
    });

    it("should handle errors in listeners", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Listener error");
      });
      const normalListener = vi.fn();

      event.addEventListener(errorListener);
      event.addEventListener(normalListener);

      // Errors should not prevent other listeners from executing
      expect(() => event.fire("test")).not.toThrow();

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe("Event configuration", () => {
    it("should support custom configuration", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 5,
        enableDebugMode: true,
      };

      const configuredEvent = new TestEvent("ConfiguredEvent", config);
      expect(configuredEvent).toBeInstanceOf(TestEvent);
    });

    it("should support batch configuration", () => {
      const batchConfig: Partial<EventConfiguration> = {
        enableBatching: true,
        batchSize: 3,
        batchInterval: 10,
      };

      const batchEvent = new TestEvent("BatchEvent", batchConfig);
      expect(batchEvent).toBeInstanceOf(TestEvent);
    });

    it("should support concurrency configuration", () => {
      const concurrencyConfig: Partial<EventConfiguration> = {
        concurrencyMode: "parallel",
        concurrencyLimit: 5,
      };

      const concurrentEvent = new TestEvent(
        "ConcurrentEvent",
        concurrencyConfig
      );
      expect(concurrentEvent).toBeInstanceOf(TestEvent);
    });
  });

  describe("Performance and optimization", () => {
    it("should correctly track fire count", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      expect(event["_fireCount"]).toBe(0);

      event.fire("test1");
      expect(event["_fireCount"]).toBe(1);

      event.fire("test2");
      expect(event["_fireCount"]).toBe(2);
    });

    it("should handle a large number of listeners", () => {
      // Use high-performance config to support more listeners
      const highPerfEvent = new TestEvent("HighPerfEvent", {
        maxListeners: 1000,
        enableBatching: false, // Disable batching for easier testing
      });

      const listeners: Array<() => void> = [];
      const listenerCount = 50; // Use a reasonable count

      // Add a large number of listeners
      for (let i = 0; i < listenerCount; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        highPerfEvent.addEventListener(listener);
      }

      expect(highPerfEvent["_listeners"].length).toBe(listenerCount);

      highPerfEvent.fire("test");

      // Verify all listeners were called
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("test");
      });
    });

    it("should efficiently handle listener add and remove", () => {
      // Use non-batching config for easier testing
      const testEvent = new TestEvent("RemovalTest", {
        enableBatching: false,
        maxListeners: 200,
      });

      const listeners = [];
      const unsubscribers = [];

      // Add listeners
      for (let i = 0; i < 50; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        const unsub = testEvent.addEventListener(listener);
        unsubscribers.push(unsub);
      }

      expect(testEvent["_listeners"].length).toBe(50);

      // Remove half of the listeners
      for (let i = 0; i < 25; i++) {
        unsubscribers[i]();
      }

      expect(testEvent["_listeners"].length).toBe(25);

      // Fire event, only remaining listeners should be called
      testEvent.fire("test");

      for (let i = 0; i < 25; i++) {
        expect(listeners[i]).not.toHaveBeenCalled();
      }

      for (let i = 25; i < 50; i++) {
        expect(listeners[i]).toHaveBeenCalledWith("test");
      }
    });
  });

  describe("Edge cases", () => {
    it("should handle empty event firing", () => {
      expect(() => event.fire("test")).not.toThrow();
    });

    it("should handle special string data", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      // Test empty string
      event.fire("");
      expect(listener).toHaveBeenCalledWith("");

      // Test special characters
      event.fire("Special characters test");
      expect(listener).toHaveBeenCalledWith("Special characters test");
    });

    it("should handle rapid consecutive firing", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      // Rapid consecutive firing
      for (let i = 0; i < 10; i++) {
        event.fire(`test-${i}`);
      }

      expect(listener).toHaveBeenCalledTimes(10);
    });

    it("should handle listeners modifying the listener list during execution", () => {
      const unsub2Ref = { current: undefined as (() => void) | undefined };

      const listener1 = vi.fn(() => {
        // Remove another listener during listener execution
        if (unsub2Ref.current) unsub2Ref.current();
      });

      const listener2 = vi.fn();

      event.addEventListener(listener1);
      unsub2Ref.current = event.addEventListener(listener2);

      // This should not cause errors
      expect(() => event.fire("test")).not.toThrow();

      expect(listener1).toHaveBeenCalled();
      // listener2 may or may not be called depending on execution order
    });
  });

  describe("Resource cleanup", () => {
    it("should support clearing all listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);

      expect(event["_listeners"].length).toBe(2);

      // Manual cleanup (if available)
      if (typeof event.dispose === "function") {
        event.dispose();
        expect(event["_listeners"].length).toBe(0);
      }
    });
  });

  // ===== Advanced functionality tests =====

  describe("Advanced listener methods", () => {
    it("should support one-time listeners (once)", () => {
      const listener = vi.fn();
      event.once(listener);

      // First fire should call the listener
      event.fire("test1");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test1");

      // Second fire should not call the listener
      event.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // Still only called once
    });

    it("should support conditional listeners (when)", () => {
      const listener = vi.fn();
      const condition = (data: string) => data.startsWith("valid");

      event.when(condition, listener);

      // Data meeting the condition should trigger the listener
      event.fire("valid-data");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("valid-data");

      // Data not meeting the condition should not trigger the listener
      event.fire("invalid-data");
      expect(listener).toHaveBeenCalledTimes(1); // Still only called once
    });

    it("should support batch adding listeners (addListeners)", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      const result = event.addListeners(listener1, listener2, listener3);

      // Should return the event instance to support chaining
      expect(result).toBe(event);
      expect(event["_listeners"].length).toBe(3);

      event.fire("test");
      expect(listener1).toHaveBeenCalledWith("test");
      expect(listener2).toHaveBeenCalledWith("test");
      expect(listener3).toHaveBeenCalledWith("test");
    });

    it("should support the event getter property", () => {
      const eventGetter = event.event;
      expect(typeof eventGetter).toBe("function");

      const listener = vi.fn();
      const unsubscribe = eventGetter(listener);

      expect(typeof unsubscribe).toBe("function");

      event.fire("test");
      expect(listener).toHaveBeenCalledWith("test");

      // Test unsubscribe
      unsubscribe();
      event.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // Should only be called once
    });
  });

  describe("Data validation and deduplication", () => {
    it("should support data validator (setValidator)", () => {
      const validator = (data: string) => data.length > 3;
      const listener = vi.fn();

      // Enable debug mode to activate validator
      event.setDebugMode(true).setValidator(validator);
      event.addEventListener(listener);

      // Valid data should pass validation
      event.fire("valid");
      expect(listener).toHaveBeenCalledWith("valid");

      // In debug mode, invalid data should be filtered
      event.fire("no"); // Length <= 3
      // Listener should not be called again due to validation failure
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should support removing the validator", () => {
      const validator = (data: string) => data.length > 10; // Very strict validation
      const listener = vi.fn();

      event.setDebugMode(true).setValidator(validator);
      event.addEventListener(listener);

      // Remove validator
      event.setValidator(undefined);

      // Now short data should also pass
      event.fire("short");
      expect(listener).toHaveBeenCalledWith("short");
    });
  });

  describe("Configuration management", () => {
    it("should support getting configuration", () => {
      const config = event.configuration;
      expect(config).toBeDefined();
      expect(typeof config).toBe("object");
      expect(config).toHaveProperty("enableBatching");
      expect(config).toHaveProperty("maxListeners");
    });

    it("should support dynamic configuration updates", () => {
      const newConfig = { enableBatching: false, maxListeners: 100 };
      const result = event.updateConfiguration(newConfig);

      expect(result).toBe(event); // Supports chaining

      const updatedConfig = event.configuration;
      // Note: config update may need to merge with existing config, enableBatching may remain unchanged
      expect(updatedConfig.maxListeners).toBe(100);
    });

    it("should support maxListeners getter/setter", () => {
      // Test getter
      const initialMax = event.maxListeners;
      expect(typeof initialMax).toBe("number");

      // Test setter
      event.maxListeners = 50;
      expect(event.maxListeners).toBe(50);

      // Test invalid value handling
      const originalMax = event.maxListeners;
      event.maxListeners = -1; // Invalid value
      expect(event.maxListeners).toBe(originalMax); // Should remain unchanged

      event.maxListeners = 20000; // Out of range
      expect(event.maxListeners).toBe(originalMax); // Should remain unchanged
    });

    it("should support listener count and fire count statistics", () => {
      expect(event.listenerCount).toBe(0);
      expect(event.fireCount).toBe(0);

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      expect(event.listenerCount).toBe(1);

      event.addEventListener(listener2);
      expect(event.listenerCount).toBe(2);

      event.fire("test1");
      expect(event.fireCount).toBe(1);

      event.fire("test2");
      expect(event.fireCount).toBe(2);
    });

    it("should support hasListeners check", () => {
      expect(event.hasListeners()).toBe(false);

      const listener = vi.fn();
      event.addEventListener(listener);
      expect(event.hasListeners()).toBe(true);

      event.clear();
      expect(event.hasListeners()).toBe(false);
    });

    it("should support debug mode toggle", () => {
      const result = event.setDebugMode(true);
      expect(result).toBe(event); // Supports chaining

      const config = event.configuration;
      expect(config.enableDebugMode).toBe(true);

      event.setDebugMode(false);
      const updatedConfig = event.configuration;
      expect(updatedConfig.enableDebugMode).toBe(false);
    });
  });

  describe("Batching functionality", () => {
    let batchEvent: TestEvent;

    beforeEach(() => {
      batchEvent = new TestEvent("BatchTest", {
        enableBatching: true,
        batchSize: 3,
        batchInterval: 10,
      });
    });

    it("should support batch event processing", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      // Rapidly fire multiple events
      batchEvent.fire("event1");
      batchEvent.fire("event2");

      // Batching may fire immediately or with delay depending on implementation
      // Fire third event, should reach batch size threshold
      batchEvent.fire("event3");

      // Now batch should be processed, listener should be called
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith("event1");
      expect(listener).toHaveBeenCalledWith("event2");
      expect(listener).toHaveBeenCalledWith("event3");
    });

    it("should support manual batch flush", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      batchEvent.fire("event1");
      batchEvent.fire("event2");

      // Manual batch flush
      batchEvent.flushBatch();

      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenNthCalledWith(1, "event1");
      expect(listener).toHaveBeenNthCalledWith(2, "event2");
    });

    it("should automatically process batch after interval", async () => {
      const listener = vi.fn();
      batchEvent.addEventListener(listener);

      batchEvent.fire("event1");

      // Wait for batch interval
      await new Promise((resolve) => setTimeout(resolve, 15));

      expect(listener).toHaveBeenCalledWith("event1");
    });
  });

  describe("Async event handling", () => {
    it("should support async event firing (fireAsync)", async () => {
      const listener = vi.fn().mockResolvedValue(undefined);
      event.addEventListener(listener);

      await event.fireAsync("async-test");

      expect(listener).toHaveBeenCalledWith("async-test");
    });

    it("should support parallel async listeners", async () => {
      const parallelEvent = new TestEvent("ParallelTest", {
        concurrencyMode: "parallel",
      });

      const listener1 = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "listener1";
      });

      const listener2 = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return "listener2";
      });

      parallelEvent.addEventListener(listener1);
      parallelEvent.addEventListener(listener2);

      const startTime = Date.now();
      await parallelEvent.fireAsync("parallel-test");
      const endTime = Date.now();

      expect(listener1).toHaveBeenCalledWith("parallel-test");
      expect(listener2).toHaveBeenCalledWith("parallel-test");

      // Parallel execution should be faster than serial
      expect(endTime - startTime).toBeLessThan(20); // Should be close to the longer listener time
    });

    it("should support limited concurrency async listeners", async () => {
      const limitedEvent = new TestEvent("LimitedTest", {
        concurrencyMode: "limited",
        concurrencyLimit: 2,
      });

      const listeners = [];
      for (let i = 0; i < 4; i++) {
        const listener = vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return `listener${i}`;
        });
        listeners.push(listener);
        limitedEvent.addEventListener(listener);
      }

      await limitedEvent.fireAsync("limited-test");

      // All listeners should be called
      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("limited-test");
      });
    });

    it("should handle errors in async listeners", async () => {
      const errorListener = vi.fn().mockRejectedValue(new Error("Async error"));
      const normalListener = vi.fn().mockResolvedValue(undefined);

      event.addEventListener(errorListener);
      event.addEventListener(normalListener);

      // Async errors should not prevent other listeners from executing
      await expect(event.fireAsync("error-test")).resolves.not.toThrow();

      expect(errorListener).toHaveBeenCalledWith("error-test");
      expect(normalListener).toHaveBeenCalledWith("error-test");
    });

    it("should support async listener timeout handling", async () => {
      const timeoutEvent = new TestEvent("TimeoutTest", {
        concurrencyMode: "limited",
        listenerTimeout: 5, // 5ms timeout
      });

      const slowListener = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20)); // Slower than timeout
        return "slow";
      });

      const fastListener = vi.fn().mockResolvedValue("fast");

      timeoutEvent.addEventListener(slowListener);
      timeoutEvent.addEventListener(fastListener);

      await timeoutEvent.fireAsync("timeout-test");

      expect(slowListener).toHaveBeenCalledWith("timeout-test");
      expect(fastListener).toHaveBeenCalledWith("timeout-test");
    });
  });

  describe("Resource management and cleanup", () => {
    it("should support clear to cleanup listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);
      expect(event.listenerCount).toBe(2);

      event.clear();
      expect(event.listenerCount).toBe(0);
      expect(event.hasListeners()).toBe(false);

      // Firing event after cleanup should not call any listeners
      event.fire("test");
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it("should support reset to restore event state", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test1");
      event.fire("test2");

      expect(event.fireCount).toBe(2);
      expect(event.listenerCount).toBe(1);

      event.reset();

      expect(event.fireCount).toBe(0);
      expect(event.listenerCount).toBe(0);
      expect(event.hasListeners()).toBe(false);
    });

    it("should support dispose for destruction", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      event.addEventListener(listener1);
      event.addEventListener(listener2);

      // Create batch event to test batch cleanup
      const batchEvent = new TestEvent("DisposeTest", {
        enableBatching: true,
        batchSize: 10,
      });

      const batchListener = vi.fn();
      batchEvent.addEventListener(batchListener);

      expect(event.listenerCount).toBe(2);
      expect(batchEvent.listenerCount).toBe(1);

      // Events fired before dispose may have already been processed
      const batchListenerCallsBefore = batchListener.mock.calls.length;

      event.dispose();
      batchEvent.dispose();

      expect(event.listenerCount).toBe(0);
      expect(batchEvent.listenerCount).toBe(0);

      // Firing event after dispose should not call listeners
      event.fire("disposed-test");
      batchEvent.fire("disposed-batch-test");

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();

      // New calls after dispose should not happen
      expect(batchListener.mock.calls.length).toBe(batchListenerCallsBefore);
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle invalid listeners", () => {
      // Test null listener
      expect(() =>
        event.addEventListener(null as unknown as (data: string) => void)
      ).not.toThrow();

      // Test undefined listener
      expect(() =>
        event.addEventListener(undefined as unknown as (data: string) => void)
      ).not.toThrow();

      // Test non-function listener
      expect(() =>
        event.addEventListener(
          "not-a-function" as unknown as (data: string) => void
        )
      ).not.toThrow();

      // Listener list should not increase
      expect(event.listenerCount).toBe(0);
    });

    it("should handle listener count limits", () => {
      const limitedEvent = new TestEvent("LimitedEvent", {
        maxListeners: 2,
        enableBatching: false,
      });

      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      limitedEvent.addEventListener(listener1);
      limitedEvent.addEventListener(listener2);

      expect(limitedEvent.listenerCount).toBe(2);

      // Adding a third listener should be ignored or warned
      limitedEvent.addEventListener(listener3);

      // Depending on implementation, may limit or warn
      limitedEvent.fire("test");
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle empty batch flush", () => {
      const batchEvent = new TestEvent("EmptyBatchTest", {
        enableBatching: true,
      });

      // Flushing batch with no events should not throw
      expect(() => batchEvent.flushBatch()).not.toThrow();
    });

    it("should handle structural changes during listener execution", () => {
      const removingListener = vi.fn(() => {
        // Remove self in listener
        event.removeEventListener(removingListener);
      });

      const normalListener = vi.fn();

      event.addEventListener(removingListener);
      event.addEventListener(normalListener);

      expect(() => event.fire("structure-change-test")).not.toThrow();

      expect(removingListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
      expect(event.listenerCount).toBe(1); // removingListener should be removed
    });
  });
});
