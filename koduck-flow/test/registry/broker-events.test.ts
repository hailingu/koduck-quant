import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RegistryBroker, createRegistryBroker } from "../../src/common/registry/broker-impl";
import type { IRegistry, IRegistryManager } from "../../src/common/registry/types";
import type { IEntity } from "../../src/common/entity";

describe("RegistryBroker Event System", () => {
  let broker: RegistryBroker;

  // Mock registry using vi.fn()
  const mockRegistry = {
    meta: { type: "MockEntityRegistry" },
    getConstructor: vi.fn(),
  } as unknown as IRegistry<IEntity>;

  // Mock registry manager
  const mockRegistryManager = {
    addRegistry: vi.fn(),
    removeRegistry: vi.fn().mockReturnValue(true),
    setDefaultRegistry: vi.fn(),
    bindTypeToRegistry: vi.fn(),
    unbindType: vi.fn(),
    getRegistry: vi.fn(),
    getRegistryForType: vi.fn(),
    getRegistryForEntity: vi.fn(),
    getDefaultRegistry: vi.fn(),
    getRegistryNames: vi.fn().mockReturnValue([]),
  } as unknown as IRegistryManager<IEntity>;

  beforeEach(() => {
    broker = createRegistryBroker();
    broker.registerRegistryManager(mockRegistryManager);
  });

  afterEach(() => {
    broker.dispose();
  });

  describe("Registry Events", () => {
    it("should emit REGISTRY_ADDED event when registry is added", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      broker.addRegistry("test", mockRegistry);

      expect(listener).toHaveBeenCalledWith({
        type: "REGISTRY_ADDED",
        payload: { name: "test", registry: mockRegistry },
      });

      unsubscribe();
    });

    it("should emit REGISTRY_REMOVED event when registry is removed", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      broker.addRegistry("test", mockRegistry);
      broker.removeRegistry("test");

      expect(listener).toHaveBeenCalledWith({
        type: "REGISTRY_REMOVED",
        payload: { name: "test" },
      });

      unsubscribe();
    });

    it("should emit DEFAULT_REGISTRY_CHANGED event when default registry is set", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      broker.addRegistry("test", mockRegistry);
      broker.setDefaultRegistry("test");

      expect(listener).toHaveBeenCalledWith({
        type: "DEFAULT_REGISTRY_CHANGED",
        payload: { name: "test" },
      });

      unsubscribe();
    });

    it("should emit TYPE_BOUND event when type is bound to registry", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      broker.addRegistry("test", mockRegistry);
      broker.bindTypeToRegistry("TestEntity", "test");

      expect(listener).toHaveBeenCalledWith({
        type: "TYPE_BOUND",
        payload: { type: "TestEntity", registryName: "test" },
      });

      unsubscribe();
    });

    it("should allow unsubscribing from registry events", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      broker.addRegistry("test", mockRegistry);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      broker.addRegistry("test2", mockRegistry);
      expect(listener).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe("Entity Events", () => {
    it("should allow subscribing to entity events", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onEntityChange(listener);

      // Note: Entity events would be emitted by EntityManager
      // This test verifies the subscription mechanism works
      expect(typeof unsubscribe).toBe("function");

      unsubscribe();
    });
  });

  describe("Performance", () => {
    it("should handle event emission with minimal delay", () => {
      const listener = vi.fn();
      const unsubscribe = broker.onRegistryChange(listener);

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        broker.addRegistry(`test${i}`, mockRegistry);
      }
      const end = performance.now();

      const totalTime = end - start;
      const avgTime = totalTime / 1000;

      expect(avgTime).toBeLessThan(1); // Should be less than 1ms per operation
      expect(listener).toHaveBeenCalledTimes(1000);

      unsubscribe();
    });
  });
});
