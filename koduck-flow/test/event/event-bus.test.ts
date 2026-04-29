import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventBus,
  LoggingEvent,
  SystemEventBus,
  createEventBus,
} from "../../src/common/event/event-bus";
import { BaseEvent } from "../../src/common/event/base-event";
import { GenericEvent } from "../../src/common/event/generic-event";

describe("EventBus Event System", () => {
  describe("LoggingEvent", () => {
    let loggingEvent: LoggingEvent;

    beforeEach(() => {
      loggingEvent = new LoggingEvent();
    });

    afterEach(() => {
      loggingEvent.dispose();
    });

    test("should correctly initialize logging event", () => {
      expect(loggingEvent).toBeInstanceOf(BaseEvent);
      // Test event name passed via constructor argument
    });

    test("should correctly configure batching", () => {
      const config = loggingEvent.configuration;
      expect(config.enableBatching).toBe(true);
      expect(config.batchSize).toBe(50);
      expect(config.batchInterval).toBe(500);
    });

    test("should correctly record debug logs", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.debug("Debug message", { user: "test" }, "test-source");

      expect(listener).toHaveBeenCalledWith({
        level: "debug",
        message: "Debug message",
        error: undefined,
        context: { user: "test" },
        timestamp: expect.any(Number),
        source: "test-source",
      });
    });

    test("should correctly record info logs", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.info("Info message", { module: "test" });

      expect(listener).toHaveBeenCalledWith({
        level: "info",
        message: "Info message",
        error: undefined,
        context: { module: "test" },
        timestamp: expect.any(Number),
        source: undefined,
      });
    });

    test("should correctly record warn logs", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      loggingEvent.warn("Warning message");

      expect(listener).toHaveBeenCalledWith({
        level: "warn",
        message: "Warning message",
        error: undefined,
        context: undefined,
        timestamp: expect.any(Number),
        source: undefined,
      });
    });

    test("should correctly record error logs", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      const error = new Error("Critical error");
      loggingEvent.error(
        "Error message",
        error,
        { severity: "high" },
        "error-source"
      );

      expect(listener).toHaveBeenCalledWith({
        level: "error",
        message: "Error message",
        error,
        context: { severity: "high" },
        timestamp: expect.any(Number),
        source: "error-source",
      });
    });

    test("should correctly record fatal logs", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      const fatalError = new Error("Fatal error");
      loggingEvent.fatal(
        "Fatal message",
        fatalError,
        { critical: true },
        "fatal-source"
      );

      expect(listener).toHaveBeenCalledWith({
        level: "fatal",
        message: "Fatal message",
        error: fatalError,
        context: { critical: true },
        timestamp: expect.any(Number),
        source: "fatal-source",
      });
    });

    test("should support all log levels", () => {
      const listener = vi.fn();
      loggingEvent.addEventListener(listener);

      // Manually call each log method
      loggingEvent.debug("debug message");
      loggingEvent.info("info message");
      loggingEvent.warn("warn message");
      loggingEvent.error("error message");
      loggingEvent.fatal("fatal message");

      expect(listener).toHaveBeenCalledTimes(5);
      const levels = ["debug", "info", "warn", "error", "fatal"] as const;
      levels.forEach((level, index) => {
        expect(listener).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            level,
            message: `${level} message`,
          })
        );
      });
    });
  });

  describe("SystemEventBus", () => {
    let systemEventBus: SystemEventBus;

    beforeEach(() => {
      systemEventBus = new SystemEventBus();
    });

    afterEach(() => {
      systemEventBus.dispose();
    });

    test("should correctly initialize system event bus", () => {
      expect(systemEventBus).toBeInstanceOf(BaseEvent);
      // System event bus inherits from BaseEvent
    });

    test("should disable batching", () => {
      const config = systemEventBus.configuration;
      expect(config.enableBatching).toBe(false);
    });

    test("should correctly trigger startup event", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { version: "1.0.0" };
      systemEventBus.startup(data, "app");

      expect(listener).toHaveBeenCalledWith({
        type: "startup",
        data,
        timestamp: expect.any(Number),
        source: "app",
      });
    });

    test("should correctly trigger shutdown event", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { graceful: true };
      systemEventBus.shutdown(data, "app");

      expect(listener).toHaveBeenCalledWith({
        type: "shutdown",
        data,
        timestamp: expect.any(Number),
        source: "app",
      });
    });

    test("should correctly trigger systemError event", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { errorCode: 500 };
      systemEventBus.systemError(data, "server");

      expect(listener).toHaveBeenCalledWith({
        type: "error",
        data,
        timestamp: expect.any(Number),
        source: "server",
      });
    });

    test("should correctly trigger systemWarning event", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { memory: "high" };
      systemEventBus.systemWarning(data, "monitor");

      expect(listener).toHaveBeenCalledWith({
        type: "warning",
        data,
        timestamp: expect.any(Number),
        source: "monitor",
      });
    });

    test("should correctly trigger configChange event", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      const data = { key: "debug", value: true };
      systemEventBus.configChange(data, "config-manager");

      expect(listener).toHaveBeenCalledWith({
        type: "config-change",
        data,
        timestamp: expect.any(Number),
        source: "config-manager",
      });
    });

    test("should support all system event types", () => {
      const listener = vi.fn();
      systemEventBus.addEventListener(listener);

      // Manually call each system event method
      systemEventBus.startup({ test: true }, "test-source");
      systemEventBus.shutdown({ test: true }, "test-source");
      systemEventBus.systemError({ test: true }, "test-source");
      systemEventBus.systemWarning({ test: true }, "test-source");
      systemEventBus.configChange({ test: true }, "test-source");

      expect(listener).toHaveBeenCalledTimes(5);

      const eventTypes = [
        "startup",
        "shutdown",
        "error",
        "warning",
        "config-change",
      ];
      eventTypes.forEach((expectedType, index) => {
        expect(listener).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            type: expectedType,
            source: "test-source",
          })
        );
      });
    });
  });

  describe("EventBus instance", () => {
    test("factory function should create EventBus instance", () => {
      const factoryInstance = createEventBus();

      expect(factoryInstance).toBeInstanceOf(EventBus);
      expect(factoryInstance.logging).toBeInstanceOf(LoggingEvent);
      expect(factoryInstance.system).toBeInstanceOf(SystemEventBus);

      factoryInstance.dispose();
    });

    test("constructor should create independent instances", () => {
      const instance1 = new EventBus();
      const instance2 = new EventBus();

      expect(instance1).not.toBe(instance2);
      expect(instance1.logging).toBeInstanceOf(LoggingEvent);
      expect(instance2.system).toBeInstanceOf(SystemEventBus);

      instance1.dispose();
      instance2.dispose();
    });
  });

  describe("EventBus Debug Mode", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should set debug mode for all events", () => {
      const setDebugModeSpy = vi.spyOn(eventBus.logging, "setDebugMode");
      const systemSetDebugModeSpy = vi.spyOn(eventBus.system, "setDebugMode");

      eventBus.setDebugMode(true);

      expect(setDebugModeSpy).toHaveBeenCalledWith(true);
      expect(systemSetDebugModeSpy).toHaveBeenCalledWith(true);
    });

    test("should return itself to support chaining", () => {
      const result = eventBus.setDebugMode(true);
      expect(result).toBe(eventBus);
    });
  });

  describe("EventBus Configuration", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should configure parameters for all events", () => {
      const config = { enableBatching: false, batchSize: 10 };
      const updateConfigSpy = vi.spyOn(eventBus.logging, "updateConfiguration");
      const systemUpdateConfigSpy = vi.spyOn(
        eventBus.system,
        "updateConfiguration"
      );

      eventBus.configureAll(config);

      expect(updateConfigSpy).toHaveBeenCalledWith(config);
      expect(systemUpdateConfigSpy).toHaveBeenCalledWith(config);
    });

    test("should return itself to support chaining", () => {
      const result = eventBus.configureAll({ enableBatching: false });
      expect(result).toBe(eventBus);
    });
  });

  describe("EventBus Batch Management", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should flush batches for all events", () => {
      const flushBatchSpy = vi.spyOn(eventBus.logging, "flushBatch");
      const systemFlushBatchSpy = vi.spyOn(eventBus.system, "flushBatch");

      eventBus.flushAllBatches();

      expect(flushBatchSpy).toHaveBeenCalled();
      expect(systemFlushBatchSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Cleanup", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should clear all event listeners", () => {
      const clearSpy = vi.spyOn(eventBus.logging, "clear");
      const systemClearSpy = vi.spyOn(eventBus.system, "clear");

      eventBus.clearAll();

      expect(clearSpy).toHaveBeenCalled();
      expect(systemClearSpy).toHaveBeenCalled();
    });

    test("should reset all events", () => {
      const resetSpy = vi.spyOn(eventBus.logging, "reset");
      const systemResetSpy = vi.spyOn(eventBus.system, "reset");

      eventBus.resetAll();

      expect(resetSpy).toHaveBeenCalled();
      expect(systemResetSpy).toHaveBeenCalled();
    });

    test("should dispose all event resources", () => {
      const disposeSpy = vi.spyOn(eventBus.logging, "dispose");
      const systemDisposeSpy = vi.spyOn(eventBus.system, "dispose");

      eventBus.dispose();

      expect(disposeSpy).toHaveBeenCalled();
      expect(systemDisposeSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Statistics", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should return statistics", () => {
      const stats = eventBus.getAllStats();

      expect(stats).toEqual({
        managerType: "EventBus",
        timestamp: expect.any(Number),
        message: "Statistics feature removed",
      });
    });
  });

  describe("EventBus Custom Events", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should register custom events", () => {
      const customEvent = new GenericEvent<string>("test-event");
      eventBus.registerEvent("test", customEvent);

      const retrievedEvent = eventBus.getEvent<string>("test");
      expect(retrievedEvent).toBe(customEvent);
    });

    test("should unregister custom events", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const disposeSpy = vi.spyOn(customEvent, "dispose");

      eventBus.registerEvent("test", customEvent);
      const result = eventBus.unregisterEvent("test");

      expect(result).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
      expect(eventBus.getEvent("test")).toBeUndefined();
    });

    test("should handle unregistering non-existent events", () => {
      const result = eventBus.unregisterEvent("non-existent");
      expect(result).toBe(false);
    });

    test("should return undefined for non-existent custom events", () => {
      const event = eventBus.getEvent("non-existent");
      expect(event).toBeUndefined();
    });
  });

  describe("EventBus Compatibility Methods", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should support on method for event listening", () => {
      const listener = vi.fn();
      const unsubscribe = eventBus.on<string>("test-event", listener);

      expect(typeof unsubscribe).toBe("function");

      // Verify event was auto-created
      const event = eventBus.getEvent<string>("test-event");
      expect(event).toBeInstanceOf(GenericEvent);
    });

    test("should support off method for removing listeners", () => {
      const listener = vi.fn();
      eventBus.on<string>("test-event", listener);

      const result = eventBus.off<string>("test-event", listener);
      expect(result).toBe(true);
    });

    test("should handle removing listeners for non-existent events", () => {
      const listener = vi.fn();
      const result = eventBus.off<string>("non-existent", listener);
      expect(result).toBe(false);
    });

    test("should support emit method for firing events", () => {
      const listener = vi.fn();
      eventBus.on<string>("test-event", listener);

      eventBus.emit<string>("test-event", "test payload");

      expect(listener).toHaveBeenCalledWith("test payload");
    });

    test("should handle firing non-existent events", () => {
      // Should not throw an error
      expect(() => {
        eventBus.emit<string>("non-existent", "test");
      }).not.toThrow();
    });

    test("should set debug mode for custom events", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const setDebugModeSpy = vi.spyOn(customEvent, "setDebugMode");

      eventBus.registerEvent("test", customEvent);
      eventBus.setDebugMode(true);

      expect(setDebugModeSpy).toHaveBeenCalledWith(true);
    });

    test("should configure parameters for custom events", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const updateConfigSpy = vi.spyOn(customEvent, "updateConfiguration");
      const config = { enableBatching: false };

      eventBus.registerEvent("test", customEvent);
      eventBus.configureAll(config);

      expect(updateConfigSpy).toHaveBeenCalledWith(config);
    });

    test("should flush custom event batches", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const flushBatchSpy = vi.spyOn(customEvent, "flushBatch");

      eventBus.registerEvent("test", customEvent);
      eventBus.flushAllBatches();

      expect(flushBatchSpy).toHaveBeenCalled();
    });

    test("should clear custom event listeners", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const clearSpy = vi.spyOn(customEvent, "clear");

      eventBus.registerEvent("test", customEvent);
      eventBus.clearAll();

      expect(clearSpy).toHaveBeenCalled();
    });

    test("should reset custom events", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const resetSpy = vi.spyOn(customEvent, "reset");

      eventBus.registerEvent("test", customEvent);
      eventBus.resetAll();

      expect(resetSpy).toHaveBeenCalled();
    });

    test("should dispose custom event resources", () => {
      const customEvent = new GenericEvent<string>("test-event");
      const disposeSpy = vi.spyOn(customEvent, "dispose");

      eventBus.registerEvent("test", customEvent);
      eventBus.dispose();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe("EventBus Integration", () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.dispose();
    });

    test("should support full event lifecycle", () => {
      // Logging event test
      const logListener = vi.fn();
      eventBus.logging.addEventListener(logListener);
      eventBus.logging.info("Test log message");

      expect(logListener).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          message: "Test log message",
        })
      );

      // System event test
      const systemListener = vi.fn();
      eventBus.system.addEventListener(systemListener);
      eventBus.system.startup({ version: "1.0" }, "app");

      expect(systemListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "startup",
          data: { version: "1.0" },
          source: "app",
        })
      );

      // Custom event test
      const customListener = vi.fn();
      eventBus.on<number>("custom-event", customListener);
      eventBus.emit<number>("custom-event", 42);

      expect(customListener).toHaveBeenCalledWith(42);
    });

    test("should correctly handle mixed event operations", () => {
      // Register multiple events
      const event1 = new GenericEvent<string>("event1");
      const event2 = new GenericEvent<number>("event2");

      eventBus.registerEvent("test1", event1);
      eventBus.registerEvent("test2", event2);

      // Set debug mode
      eventBus.setDebugMode(true);

      // Configure all events
      eventBus.configureAll({ enableBatching: false });

      // Flush batches
      eventBus.flushAllBatches();

      // Clean up all resources
      eventBus.clearAll();
      eventBus.resetAll();

      // Verify events still exist but are cleaned
      expect(eventBus.getEvent("test1")).toBe(event1);
      expect(eventBus.getEvent("test2")).toBe(event2);
    });
  });
});
