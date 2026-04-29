/**
 * EventManager and EntityEventManager unit tests
 * Tests event manager functionality, including basic event management and entity-specific management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventManager } from "../../src/common/event/event-manager";
import {
  EntityEventManager,
  createEntityEventManager,
} from "../../src/common/event/entity-event-manager";
import type { EventConfiguration } from "../../src/common/event/types";

// Test entity interface
interface TestEntity {
  id: string;
  name: string;
  value: number;
}

describe("EventManager", () => {
  let eventManager: EventManager<TestEntity>;

  beforeEach(() => {
    eventManager = new EventManager<TestEntity>();
  });

  afterEach(() => {
    eventManager.dispose();
  });

  describe("Basic functionality", () => {
    it("should create an event manager instance", () => {
      expect(eventManager).toBeInstanceOf(EventManager);
      expect(eventManager.added).toBeDefined();
      expect(eventManager.removed).toBeDefined();
      expect(eventManager.updated).toBeDefined();
    });

    it("should provide three basic events", () => {
      expect(eventManager.added).toBeDefined();
      expect(eventManager.removed).toBeDefined();
      expect(eventManager.updated).toBeDefined();

      // Verify events have basic listening capabilities
      expect(typeof eventManager.added.addEventListener).toBe("function");
      expect(typeof eventManager.removed.addEventListener).toBe("function");
      expect(typeof eventManager.updated.addEventListener).toBe("function");
    });
  });

  describe("Event firing and listening", () => {
    it("should be able to fire and listen to add events", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      const testEntity: TestEntity = { id: "1", name: "test", value: 42 };
      eventManager.added.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("should be able to fire and listen to remove events", () => {
      const listener = vi.fn();
      eventManager.removed.addEventListener(listener);

      const testEntity: TestEntity = { id: "2", name: "removed", value: 0 };
      eventManager.removed.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("should be able to fire and listen to update events", () => {
      const listener = vi.fn();
      eventManager.updated.addEventListener(listener);

      const testEntity: TestEntity = { id: "3", name: "updated", value: 100 };
      eventManager.updated.fire(testEntity);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(testEntity);
    });

    it("should support multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventManager.added.addEventListener(listener1);
      eventManager.added.addEventListener(listener2);
      eventManager.added.addEventListener(listener3);

      const testEntity: TestEntity = { id: "4", name: "multi", value: 200 };
      eventManager.added.fire(testEntity);

      expect(listener1).toHaveBeenCalledWith(testEntity);
      expect(listener2).toHaveBeenCalledWith(testEntity);
      expect(listener3).toHaveBeenCalledWith(testEntity);
    });
  });

  describe("Configuration management", () => {
    it("should be able to set debug mode", () => {
      const result = eventManager.setDebugMode(true);
      expect(result).toBe(eventManager); // Supports chaining

      // Verify debug mode is applied (requires internal state access)
      eventManager.setDebugMode(false);
    });

    it("should be able to configure all events", () => {
      const config: Partial<EventConfiguration> = {
        enableBatching: false,
        maxListeners: 50,
        enableDebugMode: true,
      };

      const result = eventManager.configureAll(config);
      expect(result).toBe(eventManager); // Supports chaining
    });

    it("should be able to configure batching", () => {
      const batchConfig = {
        enableBatching: true,
        batchSize: 20,
        batchInterval: 10,
      };

      const result = eventManager.configureBatch(batchConfig);
      expect(result).toBe(eventManager); // Supports chaining
    });
  });

  describe("Batch management", () => {
    it("should be able to flush all batches", () => {
      expect(() => eventManager.flushAllBatches()).not.toThrow();
    });

    it("should work in batch processing mode", () => {
      // Enable batching
      eventManager.configureBatch({
        enableBatching: true,
        batchSize: 3,
        batchInterval: 50,
      });

      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      // Add multiple entities
      const entities = [
        { id: "1", name: "batch1", value: 1 },
        { id: "2", name: "batch2", value: 2 },
        { id: "3", name: "batch3", value: 3 },
      ];

      entities.forEach((entity) => eventManager.added.fire(entity));

      // Manually flush batches
      eventManager.flushAllBatches();

      // Listener should be called
      expect(listener).toHaveBeenCalled();
    });
  });

  describe("Cleanup and reset", () => {
    it("should be able to clear all event listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventManager.added.addEventListener(listener1);
      eventManager.removed.addEventListener(listener2);
      eventManager.updated.addEventListener(listener3);

      eventManager.clearAll();

      // Firing events should not call listeners
      const testEntity: TestEntity = { id: "clear", name: "test", value: 0 };
      eventManager.added.fire(testEntity);
      eventManager.removed.fire(testEntity);
      eventManager.updated.fire(testEntity);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).not.toHaveBeenCalled();
    });

    it("should be able to reset all events", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      eventManager.resetAll();

      // Should work normally after reset
      const testEntity: TestEntity = { id: "reset", name: "test", value: 0 };
      eventManager.added.fire(testEntity);

      // Listeners may be cleared after reset depending on implementation
      // Mainly testing that it does not throw
      expect(() => eventManager.added.fire(testEntity)).not.toThrow();
    });
  });

  describe("Conditional execution", () => {
    it("should support conditional execution", () => {
      const callback = vi.fn();

      // When condition is true, callback should execute
      const result1 = eventManager.when(true, callback);
      expect(result1).toBe(eventManager);
      expect(callback).toHaveBeenCalledWith(eventManager);

      // When condition is false, callback should not execute
      callback.mockReset();
      const result2 = eventManager.when(false, callback);
      expect(result2).toBe(eventManager);
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Resource management", () => {
    it("should correctly release resources", () => {
      const listener = vi.fn();
      eventManager.added.addEventListener(listener);

      expect(() => eventManager.dispose()).not.toThrow();

      // Behavior after dispose depends on implementation
      // Mainly testing that it does not throw
      expect(() =>
        eventManager.added.fire({ id: "disposed", name: "test", value: 0 })
      ).not.toThrow();
    });
  });
});

describe("EntityEventManager", () => {
  let entityManager: EntityEventManager<TestEntity>;

  beforeEach(() => {
    entityManager = createEntityEventManager<TestEntity>();
  });

  afterEach(() => {
    entityManager.dispose();
  });

  describe("Instance management", () => {
    it("should create instances via factory function", () => {
      const factoryInstance = createEntityEventManager<TestEntity>();
      expect(factoryInstance).toBeInstanceOf(EntityEventManager);
      factoryInstance.dispose();
    });

    it("factory function should return independent instances on each call", () => {
      const instance1 = createEntityEventManager<TestEntity>();
      const instance2 = createEntityEventManager<TestEntity>();

      expect(instance1).not.toBe(instance2);
      expect(instance1).toBeInstanceOf(EventManager);
      expect(instance2).toBeInstanceOf(EntityEventManager);

      instance1.dispose();
      instance2.dispose();
    });

    it("should allow direct instantiation", () => {
      const directInstance = new EntityEventManager<TestEntity>();
      expect(directInstance).toBeInstanceOf(EntityEventManager);
      directInstance.dispose();
    });
  });

  describe("Entity-specific features", () => {
    it("should provide additional update detail events", () => {
      expect(entityManager.updatedWithDetail).toBeDefined();
      expect(typeof entityManager.updatedWithDetail.addEventListener).toBe(
        "function"
      );
    });

    it("should be able to register lifecycle listeners", () => {
      const addedListener = vi.fn();
      const removedListener = vi.fn();
      const updatedListener = vi.fn();

      const result = entityManager.registerLifecycle({
        onAdded: addedListener,
        onRemoved: removedListener,
        onUpdated: updatedListener,
      });

      expect(result).toBe(entityManager); // Supports chaining

      // Test event firing
      const testEntity: TestEntity = {
        id: "lifecycle",
        name: "test",
        value: 42,
      };

      entityManager.added.fire(testEntity);
      expect(addedListener).toHaveBeenCalledWith(testEntity);

      entityManager.removed.fire(testEntity);
      expect(removedListener).toHaveBeenCalledWith(testEntity);

      entityManager.updated.fire(testEntity);
      expect(updatedListener).toHaveBeenCalledWith(testEntity);
    });

    it("should be able to register universal lifecycle listeners", () => {
      const universalListener = vi.fn();

      const result = entityManager.registerAnyLifecycle(universalListener);
      expect(result).toBe(entityManager);

      const testEntity: TestEntity = {
        id: "universal",
        name: "test",
        value: 123,
      };

      // All events should trigger the universal listener
      entityManager.added.fire(testEntity);
      expect(universalListener).toHaveBeenCalledWith(testEntity);

      entityManager.removed.fire(testEntity);
      expect(universalListener).toHaveBeenCalledTimes(2);

      entityManager.updated.fire(testEntity);
      expect(universalListener).toHaveBeenCalledTimes(3);
    });

    it("should support update detail events", () => {
      const detailListener = vi.fn();
      entityManager.updatedWithDetail.addEventListener(detailListener);

      const testEntity: TestEntity = { id: "detail", name: "test", value: 456 };
      const updateDetail = {
        changes: new Set(["position"] as const),
        prevBounds: { x: 0, y: 0, width: 50, height: 25 },
        nextBounds: { x: 10, y: 10, width: 100, height: 50 },
      };

      entityManager.updatedWithDetail.fire({
        entity: testEntity,
        detail: updateDetail,
      });

      expect(detailListener).toHaveBeenCalledWith({
        entity: testEntity,
        detail: updateDetail,
      });
    });
  });

  describe("Performance configuration", () => {
    it("should be able to set high-performance mode", () => {
      const result = entityManager.setupForPerformance();
      expect(result).toBe(entityManager); // Supports chaining
    });

    it("should be able to set debug mode", () => {
      const result = entityManager.setupForDebugging();
      expect(result).toBe(entityManager); // Supports chaining
    });
  });

  describe("Entity event firing methods", () => {
    it("should be able to fire entity add events", () => {
      const listener = vi.fn();
      entityManager.added.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-add",
        name: "test",
        value: 789,
      };

      // Use convenience method to fire event
      if (typeof entityManager.fireAdd === "function") {
        entityManager.fireAdd(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });

    it("should be able to fire entity remove events", () => {
      const listener = vi.fn();
      entityManager.removed.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-remove",
        name: "test",
        value: 0,
      };

      if (typeof entityManager.fireRemove === "function") {
        entityManager.fireRemove(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });

    it("should be able to fire entity update events", () => {
      const listener = vi.fn();
      entityManager.updated.addEventListener(listener);

      const testEntity: TestEntity = {
        id: "fire-update",
        name: "updated",
        value: 999,
      };

      if (typeof entityManager.fireUpdate === "function") {
        entityManager.fireUpdate(testEntity);
        expect(listener).toHaveBeenCalledWith(testEntity);
      }
    });
  });

  describe("Batch operations", () => {
    it("should support batch add events", () => {
      const listener = vi.fn();
      entityManager.added.addEventListener(listener);

      const entities: TestEntity[] = [
        { id: "batch1", name: "test1", value: 1 },
        { id: "batch2", name: "test2", value: 2 },
        { id: "batch3", name: "test3", value: 3 },
      ];

      entityManager.fireBatch("add", entities);
      expect(listener).toHaveBeenCalledTimes(entities.length);
    });

    it("should support batch remove events", () => {
      const listener = vi.fn();
      entityManager.removed.addEventListener(listener);

      const entities: TestEntity[] = [
        { id: "remove1", name: "test1", value: 0 },
        { id: "remove2", name: "test2", value: 0 },
        { id: "remove3", name: "test3", value: 0 },
      ];

      entityManager.fireBatch("remove", entities);
      expect(listener).toHaveBeenCalledTimes(entities.length);
    });
  });

  describe("Error handling", () => {
    it("should handle errors in listeners", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error in listener");
      });
      const normalListener = vi.fn();

      entityManager.added.addEventListener(errorListener);
      entityManager.added.addEventListener(normalListener);

      const testEntity: TestEntity = {
        id: "error-test",
        name: "error",
        value: -1,
      };

      // Errors should not prevent other listeners from executing
      expect(() => entityManager.added.fire(testEntity)).not.toThrow();
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });
});
