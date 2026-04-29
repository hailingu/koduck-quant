import { describe, expect, it, beforeEach } from "vitest";
import { FlowCore } from "../../../src/common/flow/flow-core";
import type { IFlowEntity, IFlowNodeEntity, IFlowEdgeEntity } from "../../../src/common/flow/types";

/**
 * Stub EntityManager for testing
 * Minimal implementation to support FlowCore lifecycle testing
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
 * Stub serialization state for FlowCore lifecycle testing
 */
class StubFlowSerializationState {
  id = "test-flow";
  metadata = undefined;

   
  getEntity(id: string): IFlowEntity | undefined {
    return undefined;
  }
}

describe("FlowCore Lifecycle Management", () => {
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

  describe("Initialization", () => {
    it("should initialize all 6 subsystems during construction", () => {
      expect(flowCore.getEntityRegistry()).toBeDefined();
      expect(flowCore.getGraphCoordinator()).toBeDefined();
      expect(flowCore.getHooks()).toBeDefined();
      expect(flowCore.getMetrics()).toBeDefined();
      expect(flowCore.getTraversal()).toBeDefined();
      expect(flowCore.getSerialization()).toBeDefined();
    });

    it("should initialize FlowSerializer subsystem", () => {
      expect(flowCore.getFlowSerializer()).toBeDefined();
    });

    it("should have entityManager set correctly", () => {
      const services = flowCore.getServices();
      expect(services.entityManager).toBe(entityManager);
    });
  });

  describe("Service Accessors", () => {
    it("getEntityRegistry() should return EntityRegistry instance", () => {
      const registry = flowCore.getEntityRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.addNodeEntity).toBe("function");
      expect(typeof registry.getNodeEntity).toBe("function");
      expect(typeof registry.listNodeEntities).toBe("function");
    });

    it("getGraphCoordinator() should return FlowGraphCoordinator instance", () => {
      const coordinator = flowCore.getGraphCoordinator();
      expect(coordinator).toBeDefined();
      expect(typeof coordinator.registerNode).toBe("function");
      expect(typeof coordinator.linkNodes).toBe("function");
      expect(typeof coordinator.getGraph).toBe("function");
    });

    it("getHooks() should return FlowHooks instance", () => {
      const hooks = flowCore.getHooks();
      expect(hooks).toBeDefined();
      expect(typeof hooks.runEntityAdded).toBe("function");
      expect(typeof hooks.runEntityRemoved).toBe("function");
    });

    it("getMetrics() should return FlowMetrics instance", () => {
      const metrics = flowCore.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics.recordEntityCreated).toBe("function");
      expect(typeof metrics.recordTraversal).toBe("function");
    });

    it("getTraversal() should return FlowTraversal instance", () => {
      const traversal = flowCore.getTraversal();
      expect(traversal).toBeDefined();
      expect(typeof traversal.traverse).toBe("function");
      expect(typeof traversal.getRootEntity).toBe("function");
    });

    it("getSerialization() should return FlowSerialization instance", () => {
      const serialization = flowCore.getSerialization();
      expect(serialization).toBeDefined();
      expect(typeof serialization.loadFromJSON).toBe("function");
    });

    it("getFlowSerializer() should return FlowSerializer instance", () => {
      const serializer = flowCore.getFlowSerializer();
      expect(serializer).toBeDefined();
      expect(typeof serializer.toJSON).toBe("function");
    });
  });

  describe("getServices() Readonly Constraint", () => {
    it("should return frozen object that cannot be modified", () => {
      const services = flowCore.getServices();

      // Attempting to modify should fail in strict mode
      expect(() => {
        Object.assign(services, { entityManager: null });
      }).toThrow(); // Object.assign on frozen object throws TypeError in strict mode

      // The original value should remain unchanged
      expect(services.entityManager).toBe(entityManager);
    });

    it("should prevent adding new properties to services object", () => {
      const services = flowCore.getServices();

      expect(() => {
        // @ts-expect-error - Testing runtime behavior of frozen object
        services.newProperty = "value";
      }).toThrow(); // Throws TypeError in strict mode

      // New property should not exist
      expect("newProperty" in services).toBe(false);
    });

    it("should have all 8 required service properties", () => {
      const services = flowCore.getServices();

      expect(Object.keys(services).sort()).toEqual(
        [
          "entityManager",
          "graphCoordinator",
          "hooks",
          "metrics",
          "registry",
          "serialization",
          "serializer",
          "traversal",
        ].sort()
      );
    });
  });

  describe("Service Reference Consistency", () => {
    it("should return same instance on multiple calls to getServices()", () => {
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

    it("getServices().registry should match getEntityRegistry()", () => {
      const services = flowCore.getServices();
      expect(services.registry).toBe(flowCore.getEntityRegistry());
    });

    it("getServices().graphCoordinator should match getGraphCoordinator()", () => {
      const services = flowCore.getServices();
      expect(services.graphCoordinator).toBe(flowCore.getGraphCoordinator());
    });

    it("getServices().hooks should match getHooks()", () => {
      const services = flowCore.getServices();
      expect(services.hooks).toBe(flowCore.getHooks());
    });

    it("getServices().metrics should match getMetrics()", () => {
      const services = flowCore.getServices();
      expect(services.metrics).toBe(flowCore.getMetrics());
    });

    it("getServices().traversal should match getTraversal()", () => {
      const services = flowCore.getServices();
      expect(services.traversal).toBe(flowCore.getTraversal());
    });

    it("getServices().serialization should match getSerialization()", () => {
      const services = flowCore.getServices();
      expect(services.serialization).toBe(flowCore.getSerialization());
    });

    it("getServices().serializer should match getFlowSerializer()", () => {
      const services = flowCore.getServices();
      expect(services.serializer).toBe(flowCore.getFlowSerializer());
    });
  });

  describe("Subsystem Integration", () => {
    it("EntityRegistry should be initialized and functional", () => {
      const registry = flowCore.getEntityRegistry();
      const nodeEntity = {
        id: "node-1",
        node: {
          id: "node-1",
        },
      } as any;  

      registry.addNodeEntity(nodeEntity);
      const retrieved = registry.getNodeEntity("node-1");

      expect(retrieved).toBe(nodeEntity);
    });

    it("FlowGraphCoordinator should be initialized and functional", () => {
      const coordinator = flowCore.getGraphCoordinator();

      // Graph coordinator should be initialized and have required methods
      expect(coordinator).toBeDefined();
      expect(typeof coordinator.registerNode).toBe("function");
      expect(typeof coordinator.linkNodes).toBe("function");
      expect(typeof coordinator.getGraph).toBe("function");
    });

    it("FlowHooks should be initialized and functional", () => {
      const hooks = flowCore.getHooks();
      let callCount = 0;

      hooks.onEntityAdded = () => {
        callCount++;
      };

      const entity = {
        id: "node-1",
        node: {
          id: "node-1",
        },
      } as any;  

      hooks.runEntityAdded(entity);
      expect(callCount).toBe(1);
    });

    it("FlowMetrics should be initialized and functional", () => {
      const metrics = flowCore.getMetrics();

      // Should not throw when recording metrics
      expect(() => {
        metrics.recordEntityCreated("TestType", 10);
        metrics.recordTraversal(5);
      }).not.toThrow();
    });

    it("FlowTraversal should be initialized and functional", () => {
      const traversal = flowCore.getTraversal();

      // Should have traverse method callable
      expect(typeof traversal.traverse).toBe("function");
      expect(typeof traversal.getRootEntity).toBe("function");
    });

    it("FlowSerialization should be initialized and functional", () => {
      const serialization = flowCore.getSerialization();

      // Should have loadFromJSON method callable
      expect(typeof serialization.loadFromJSON).toBe("function");
    });
  });

  describe("Lifecycle Disposal", () => {
    it("should allow metrics disposal without errors", () => {
      const metrics = flowCore.getMetrics();

      expect(() => {
        metrics.markFlowDisposed();
        metrics.dispose();
      }).not.toThrow();
    });
  });

  describe("Type Safety", () => {
    it("should maintain generic type parameters correctly", () => {
      // This test validates that FlowCore properly maintains generic types
      // Compile-time type checking handled by TypeScript
      // Runtime test to ensure FlowCore instance exists and has correct methods

      expect(typeof flowCore.getEntityRegistry).toBe("function");
      expect(typeof flowCore.getServices).toBe("function");
    });

    it("should work with generic parameters through constructor", () => {
      // Verify that FlowCore accepts and stores generic type information
      // The actual generic enforcement happens at compile-time

      const testState = new StubFlowSerializationState();
      const testManager = new StubEntityManager();

      // This should compile without type errors (generic type parameters are correct)
      const testFlowCore = new FlowCore({
        // @ts-expect-error - Using stub for testing
        entityManager: testManager,
        // @ts-expect-error - Using stub for testing
        state: testState,
        isNodeEntity: (e): e is IFlowNodeEntity => "node" in (e as Record<string, unknown>),
        isEdgeEntity: (e): e is IFlowEdgeEntity => "edge" in (e as Record<string, unknown>),
        resolveEntity: (id) => testState.getEntity(id),
      });

      expect(testFlowCore).toBeDefined();
      expect(testFlowCore.getEntityRegistry()).toBeDefined();
    });
  });
});
