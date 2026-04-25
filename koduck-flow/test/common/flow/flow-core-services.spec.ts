import { describe, expect, it, beforeEach } from "vitest";
import { FlowCore } from "../../../src/common/flow/flow-core";
import type { IFlowEntity, IFlowNodeEntity, IFlowEdgeEntity } from "../../../src/common/flow/types";

/**
 * Stub EntityManager for testing
 * Minimal implementation to support FlowCore initialization
 */
class StubEntityManager {
  private readonly entities = new Map<string, IFlowEntity>();

  getEntity(id: string): IFlowEntity | undefined {
    return this.entities.get(id);
  }

  getEntities(): IFlowEntity[] {
    return [...this.entities.values()];
  }

  createEntity(): null {
    return null;
  }

  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  updateEntity(entity: IFlowEntity): boolean {
    if (!entity?.id) return false;
    this.entities.set(entity.id, entity);
    return true;
  }

  batchUpdateEntity(): number {
    return 0;
  }

  add(entity: IFlowEntity): void {
    this.entities.set(entity.id, entity);
  }

  get events() {
    return {
      added: { addEventListener: () => () => void 0 },
      removed: { addEventListener: () => () => void 0 },
      updated: { addEventListener: () => () => void 0 },
    };
  }
}

/**
 * Stub serialization state for FlowCore
 */
class StubFlowSerializationState {
  id = "test-flow";
  metadata = undefined;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getEntity(id: string): IFlowEntity | undefined {
    return undefined;
  }
}

describe("FlowCore Services", () => {
  let entityManager: StubEntityManager;
  let serializationState: StubFlowSerializationState;
  let flowCore: FlowCore;

  beforeEach(() => {
    entityManager = new StubEntityManager();
    serializationState = new StubFlowSerializationState();
    flowCore = new FlowCore({
      // @ts-expect-error - Using stub for testing purposes
      entityManager,
      // @ts-expect-error - Using stub for testing purposes
      state: serializationState,
      isNodeEntity: (e): e is IFlowNodeEntity => "node" in (e as Record<string, unknown>),
      isEdgeEntity: (e): e is IFlowEdgeEntity => "edge" in (e as Record<string, unknown>),
      resolveEntity: (id) => serializationState.getEntity(id),
    });
  });

  describe("getServices()", () => {
    it("should return services object with all required properties", () => {
      const services = flowCore.getServices();

      expect(services).toHaveProperty("entityManager");
      expect(services).toHaveProperty("registry");
      expect(services).toHaveProperty("graphCoordinator");
      expect(services).toHaveProperty("hooks");
      expect(services).toHaveProperty("metrics");
      expect(services).toHaveProperty("traversal");
      expect(services).toHaveProperty("serialization");
    });

    it("should return same instance references as individual getters", () => {
      const services = flowCore.getServices();

      expect(services.entityManager).toBe(entityManager);
      expect(services.registry).toBe(flowCore.getEntityRegistry());
      expect(services.graphCoordinator).toBe(flowCore.getGraphCoordinator());
      expect(services.hooks).toBe(flowCore.getHooks());
      expect(services.metrics).toBe(flowCore.getMetrics());
      expect(services.traversal).toBe(flowCore.getTraversal());
      expect(services.serialization).toBe(flowCore.getSerialization());
    });

    it("should return stable service references on multiple calls", () => {
      const services1 = flowCore.getServices();
      const services2 = flowCore.getServices();

      expect(services1.entityManager).toBe(services2.entityManager);
      expect(services1.registry).toBe(services2.registry);
      expect(services1.graphCoordinator).toBe(services2.graphCoordinator);
      expect(services1.hooks).toBe(services2.hooks);
      expect(services1.metrics).toBe(services2.metrics);
      expect(services1.traversal).toBe(services2.traversal);
      expect(services1.serialization).toBe(services2.serialization);
    });

    it("should return a frozen object (readonly)", () => {
      const services = flowCore.getServices();

      // Attempting to modify should fail silently (in non-strict mode) or throw (in strict mode)
      // Using strict comparison to verify it's frozen
      const isFrozen = Object.isFrozen(services);
      expect(isFrozen).toBe(true);
    });

    it("should prevent property assignment on returned services object", () => {
      const services = flowCore.getServices();
      const originalMetrics = services.metrics;

      // Try to assign a new property - will throw in strict mode
      expect(() => {
        (services as Record<string, unknown>).metrics = null;
      }).toThrow(); // Object.freeze throws in strict mode

      // Verify the property wasn't actually modified
      expect(services.metrics).toBe(originalMetrics);
    });

    it("should prevent adding new properties to returned services object", () => {
      const services = flowCore.getServices();

      // Try to add a new property - will throw in strict mode
      expect(() => {
        // @ts-expect-error - Testing runtime behavior
        services.newProperty = "test";
      }).toThrow();

      // Verify the property was not added
      expect((services as Record<string, unknown>).newProperty).toBeUndefined();
    });
  });

  describe("Service Reference Consistency", () => {
    it("should return services that are the same objects used internally", () => {
      const services = flowCore.getServices();
      const registry1 = flowCore.getEntityRegistry();
      const registry2 = services.registry;

      // These should be the exact same object
      expect(registry1).toBe(registry2);
    });

    it("should maintain service references across multiple getServices calls", () => {
      const call1 = flowCore.getServices();
      const call2 = flowCore.getServices();
      const call3 = flowCore.getServices();

      // All calls should return the same service instances
      expect(call1.registry).toBe(call2.registry);
      expect(call2.registry).toBe(call3.registry);
      expect(call1.hooks).toBe(call2.hooks);
      expect(call2.hooks).toBe(call3.hooks);
    });
  });

  describe("Service Immutability", () => {
    it("should prevent mutation of service properties at runtime", () => {
      const services = flowCore.getServices();

      // Verify we cannot reassign properties
      const descriptor = Object.getOwnPropertyDescriptor(services, "registry");
      expect(descriptor).toBeDefined();

      // The object should be frozen
      expect(Object.isFrozen(services)).toBe(true);
    });

    it("should allow reading nested properties from immutable services", () => {
      const services = flowCore.getServices();

      // Should be able to read properties
      expect(services.metrics).toBeDefined();
      expect(services.hooks).toBeDefined();
      expect(services.registry).toBeDefined();
    });
  });

  describe("All Services Are Properly Initialized", () => {
    it("should return initialized EntityManager", () => {
      const services = flowCore.getServices();
      expect(services.entityManager).toBeDefined();
      expect(services.entityManager).toBe(entityManager);
    });

    it("should return initialized EntityRegistry", () => {
      const services = flowCore.getServices();
      expect(services.registry).toBeDefined();
      expect(typeof services.registry.addNodeEntity).toBe("function");
    });

    it("should return initialized FlowGraphCoordinator", () => {
      const services = flowCore.getServices();
      expect(services.graphCoordinator).toBeDefined();
      expect(typeof services.graphCoordinator.registerNode).toBe("function");
    });

    it("should return initialized FlowHooks", () => {
      const services = flowCore.getServices();
      expect(services.hooks).toBeDefined();
      expect(typeof services.hooks.queueAsyncTask).toBe("function");
    });

    it("should return initialized FlowMetrics", () => {
      const services = flowCore.getServices();
      expect(services.metrics).toBeDefined();
      expect(typeof services.metrics.markFlowCreated).toBe("function");
    });

    it("should return initialized FlowTraversal", () => {
      const services = flowCore.getServices();
      expect(services.traversal).toBeDefined();
      expect(typeof services.traversal.traverse).toBe("function");
    });

    it("should return initialized FlowSerialization", () => {
      const services = flowCore.getServices();
      expect(services.serialization).toBeDefined();
      expect(typeof services.serialization.toJSON).toBe("function");
    });
  });

  describe("Backward Compatibility with Individual Getters", () => {
    it("should not break existing individual getter methods", () => {
      expect(() => {
        flowCore.getEntityRegistry();
        flowCore.getGraphCoordinator();
        flowCore.getHooks();
        flowCore.getMetrics();
        flowCore.getTraversal();
        flowCore.getSerialization();
      }).not.toThrow();
    });

    it("should return same instances via individual getters and getServices", () => {
      const services = flowCore.getServices();

      expect(services.registry).toBe(flowCore.getEntityRegistry());
      expect(services.graphCoordinator).toBe(flowCore.getGraphCoordinator());
      expect(services.hooks).toBe(flowCore.getHooks());
      expect(services.metrics).toBe(flowCore.getMetrics());
      expect(services.traversal).toBe(flowCore.getTraversal());
      expect(services.serialization).toBe(flowCore.getSerialization());
    });
  });

  describe("Type Safety", () => {
    it("should provide proper type inference for returned services", () => {
      const services = flowCore.getServices();

      // These should be properly typed
      const registry = services.registry;
      const hooks = services.hooks;
      const metrics = services.metrics;

      expect(registry).toBeDefined();
      expect(hooks).toBeDefined();
      expect(metrics).toBeDefined();
    });

    it("should return readonly services that prevent modification", () => {
      const services = flowCore.getServices();

      // Verify TypeScript readonly works at runtime too
      expect(Object.isFrozen(services)).toBe(true);
    });
  });
});
