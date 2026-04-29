/**
 * GenericEvent and createEmitter function unit tests
 * Tests the generic event class and event emitter factory function
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GenericEvent,
  createEmitter,
} from "../../src/common/event/generic-event";
import { BaseEvent } from "../../src/common/event/base-event";
import type { EventConfiguration } from "../../src/common/event/types";

describe("GenericEvent", () => {
  let event: GenericEvent<string>;

  beforeEach(() => {
    event = new GenericEvent<string>();
  });

  describe("Basic functionality", () => {
    it("should create a GenericEvent instance", () => {
      expect(event).toBeInstanceOf(GenericEvent);
      expect(event).toBeInstanceOf(BaseEvent);
      expect(event["eventName"]).toBe("GenericEvent");
    });

    it("should support custom event names", () => {
      const customEvent = new GenericEvent<number>("CustomEvent");
      expect(customEvent["eventName"]).toBe("CustomEvent");
    });

    it("should support custom configuration", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 200,
        enableDebugMode: true,
      };

      const configuredEvent = new GenericEvent<string>(
        "ConfiguredEvent",
        config
      );
      expect(configuredEvent).toBeInstanceOf(GenericEvent);
      expect(configuredEvent["eventName"]).toBe("ConfiguredEvent");
    });

    it("should support preset configurations", () => {
      const highPerfEvent = new GenericEvent<string>(
        "HighPerfEvent",
        "high-performance"
      );
      expect(highPerfEvent).toBeInstanceOf(GenericEvent);
      expect(highPerfEvent["eventName"]).toBe("HighPerfEvent");
    });
  });

  describe("Event handling functionality", () => {
    it("should be able to add and fire listeners", () => {
      const listener = vi.fn();
      event.addEventListener(listener);

      event.fire("test data");

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("test data");
    });

    it("should support multiple data types", () => {
      const numberEvent = new GenericEvent<number>("NumberEvent");
      const objectEvent = new GenericEvent<{ id: string; value: number }>(
        "ObjectEvent"
      );

      const numberListener = vi.fn();
      const objectListener = vi.fn();

      numberEvent.addEventListener(numberListener);
      objectEvent.addEventListener(objectListener);

      numberEvent.fire(42);
      objectEvent.fire({ id: "test", value: 100 });

      expect(numberListener).toHaveBeenCalledWith(42);
      expect(objectListener).toHaveBeenCalledWith({ id: "test", value: 100 });
    });

    it("should correctly handle listener add and remove", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      const unsub1 = event.addEventListener(listener1);
      event.addEventListener(listener2);

      event.fire("test1");
      expect(listener1).toHaveBeenCalledWith("test1");
      expect(listener2).toHaveBeenCalledWith("test1");

      unsub1();
      event.fire("test2");
      expect(listener1).toHaveBeenCalledTimes(1); // Still only once
      expect(listener2).toHaveBeenCalledWith("test2");
      expect(listener2).toHaveBeenCalledTimes(2);
    });
  });

  describe("Inherited BaseEvent functionality", () => {
    it("should inherit all BaseEvent functionality", () => {
      // Verify GenericEvent has BaseEvent methods
      expect(typeof event.fire).toBe("function");
      expect(typeof event.addEventListener).toBe("function");
      expect(typeof event.event).toBe("function"); // getter returns function
    });

    it("should support conditional listeners", () => {
      const listener = vi.fn();

      // Use when method (if available)
      if (typeof event.when === "function") {
        event.when((data) => data.includes("important"), listener);

        event.fire("normal message");
        expect(listener).not.toHaveBeenCalled();

        event.fire("important message");
        expect(listener).toHaveBeenCalledWith("important message");
      }
    });

    it("should support error handling", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
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

  describe("Performance tests", () => {
    it("should efficiently handle a large number of listeners", () => {
      const highPerfEvent = new GenericEvent<string>("PerfTest", {
        maxListeners: 1000,
        enableBatching: false,
      });

      const listeners: Array<() => void> = [];

      // Add multiple listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        highPerfEvent.addEventListener(listener);
      }

      expect(highPerfEvent["_listeners"].length).toBe(100);

      highPerfEvent.fire("performance test");

      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledWith("performance test");
      });
    });

    it("should efficiently handle frequent event firing", () => {
      const listener = vi.fn();
      const fastEvent = new GenericEvent<number>("FastEvent", {
        enableBatching: false,
      });

      fastEvent.addEventListener(listener);

      // Rapidly fire multiple events
      for (let i = 0; i < 1000; i++) {
        fastEvent.fire(i);
      }

      expect(listener).toHaveBeenCalledTimes(1000);
    });
  });
});

describe("createEmitter", () => {
  describe("Factory function functionality", () => {
    it("should create a BaseEvent instance", () => {
      const emitter = createEmitter<string>();

      expect(emitter).toBeInstanceOf(BaseEvent);
      expect(emitter).toBeInstanceOf(GenericEvent);
    });

    it("should support custom event names", () => {
      const emitter = createEmitter<string>("CustomEmitter");
      expect(emitter["eventName"]).toBe("CustomEmitter");
    });

    it("should support configuration parameters", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: true,
        batchSize: 50,
        maxListeners: 500,
      };

      const emitter = createEmitter<string>("ConfiguredEmitter", config);
      expect(emitter).toBeInstanceOf(GenericEvent);
      expect(emitter["eventName"]).toBe("ConfiguredEmitter");
    });

    it("should support preset configurations", () => {
      const emitter = createEmitter<string>("PresetEmitter", "debug");
      expect(emitter).toBeInstanceOf(GenericEvent);
      expect(emitter["eventName"]).toBe("PresetEmitter");
    });

    it("should use default values", () => {
      const emitter = createEmitter<string>();
      expect(emitter["eventName"]).toBe("GenericEvent");
    });
  });

  describe("Created emitter functionality", () => {
    it("should work correctly", () => {
      interface TestMessage {
        type: string;
        data: unknown;
      }

      const emitter = createEmitter<TestMessage>("MessageEmitter");
      const listener = vi.fn();

      emitter.addEventListener(listener);

      const testMessage = { type: "info", data: { value: 42 } };
      emitter.fire(testMessage);

      expect(listener).toHaveBeenCalledWith(testMessage);
    });

    it("should support type safety", () => {
      const stringEmitter = createEmitter<string>("StringEmitter");
      const numberEmitter = createEmitter<number>("NumberEmitter");

      const stringListener = vi.fn();
      const numberListener = vi.fn();

      stringEmitter.addEventListener(stringListener);
      numberEmitter.addEventListener(numberListener);

      stringEmitter.fire("hello");
      numberEmitter.fire(123);

      expect(stringListener).toHaveBeenCalledWith("hello");
      expect(numberListener).toHaveBeenCalledWith(123);
    });

    it("should create independent emitter instances", () => {
      const emitter1 = createEmitter<string>("Emitter1");
      const emitter2 = createEmitter<string>("Emitter2");

      expect(emitter1).not.toBe(emitter2);
      expect(emitter1["eventName"]).toBe("Emitter1");
      expect(emitter2["eventName"]).toBe("Emitter2");

      const listener1 = vi.fn();
      const listener2 = vi.fn();

      emitter1.addEventListener(listener1);
      emitter2.addEventListener(listener2);

      emitter1.fire("test1");
      emitter2.fire("test2");

      expect(listener1).toHaveBeenCalledWith("test1");
      expect(listener1).not.toHaveBeenCalledWith("test2");
      expect(listener2).toHaveBeenCalledWith("test2");
      expect(listener2).not.toHaveBeenCalledWith("test1");
    });
  });

  describe("Compatibility with BaseEvent", () => {
    it("should be compatible with the BaseEvent interface", () => {
      const emitter: BaseEvent<string> = createEmitter<string>("CompatTest");

      const listener = vi.fn();
      emitter.addEventListener(listener);
      emitter.fire("compatibility test");

      expect(listener).toHaveBeenCalledWith("compatibility test");
    });

    it("should support all BaseEvent functionality", () => {
      const emitter = createEmitter<string>("FullFeatured");

      // Test IEvent interface
      const eventFn = emitter.event;
      expect(typeof eventFn).toBe("function");

      const listener = vi.fn();
      const unsubscribe = eventFn(listener);

      expect(typeof unsubscribe).toBe("function");
      emitter.fire("test");
      expect(listener).toHaveBeenCalledWith("test");

      unsubscribe();
      emitter.fire("test2");
      expect(listener).toHaveBeenCalledTimes(1); // Should only be called once
    });
  });
});
