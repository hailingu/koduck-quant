/**
 * Entity Operations Unit Tests
 *
 * Comprehensive test suite for the EntityOperations class, covering:
 * - Generic entity access (getEntity, getNodeEntity, getEdgeEntity)
 * - Entity existence checks (hasEntity)
 * - Entity queries (getAllEntities, getAllEdgeEntities)
 * - Edge cases and boundary conditions
 *
 * Test Coverage: 6 methods, 18+ test cases
 * Target Coverage: ≥85%
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityOperations } from "../../../../src/common/flow/operations/entity-operations";
import type { EntityRegistry } from "../../../../src/common/flow/entity-registry";
import type { HookAdapter } from "../../../../src/common/flow/orchestration/hook-adapter";
import type { MetricsAdapter } from "../../../../src/common/flow/orchestration/metrics-adapter";
import type { IFlowNodeEntity, IFlowEdgeEntity } from "../../../../src/common/flow/types";

// Helper function to create mock node entity
function createMockNodeEntity(id: string): IFlowNodeEntity {
  return {
    id,
    node: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Helper function to create mock edge entity
function createMockEdgeEntity(id: string): IFlowEdgeEntity {
  return {
    id,
    edge: { id, sourceId: "node-1", targetId: "node-2" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("EntityOperations", () => {
  let entityOps: EntityOperations<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>;
  let mockRegistry: Partial<EntityRegistry<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>>;
  let mockHooks: Partial<HookAdapter<IFlowNodeEntity>>;
  let mockMetrics: Partial<MetricsAdapter>;

  beforeEach(() => {
    // Setup mock registry methods
    mockRegistry = {
      getNodeEntity: vi.fn().mockReturnValue(undefined),
      getEdgeEntity: vi.fn().mockReturnValue(undefined),
      listNodeEntities: vi.fn().mockReturnValue([]),
      listEdgeEntities: vi.fn().mockReturnValue([]),
    };

    // Setup mock hooks
    mockHooks = {
      runEntityRemoved: vi.fn().mockReturnValue(true),
    };

    // Setup mock metrics
    mockMetrics = {
      recordGraphLinkSuccess: vi.fn(),
      recordGraphLinkFailure: vi.fn(),
      recordGraphLinkErrorLength: vi.fn(),
    };

    // Create instance with mocks
    entityOps = new EntityOperations(
      mockRegistry as EntityRegistry<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>,
      mockHooks as HookAdapter<IFlowNodeEntity>,
      mockMetrics as MetricsAdapter
    );
  });

  describe("getEntity", () => {
    it("should return node entity when found in registry", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(nodeEntity);

      const result = entityOps.getEntity("node-1");

      expect(result).toEqual(nodeEntity);
      expect(mockRegistry.getNodeEntity).toHaveBeenCalledWith("node-1");
    });

    it("should return edge entity when node not found but edge exists", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(undefined);
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(edgeEntity);

      const result = entityOps.getEntity("edge-1");

      expect(result).toEqual(edgeEntity);
      expect(mockRegistry.getNodeEntity).toHaveBeenCalledWith("edge-1");
      expect(mockRegistry.getEdgeEntity).toHaveBeenCalledWith("edge-1");
    });

    it("should return undefined when entity not found", () => {
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(undefined);
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(undefined);

      const result = entityOps.getEntity("non-existent");

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty ID", () => {
      const result = entityOps.getEntity("");

      expect(result).toBeUndefined();
      expect(mockRegistry.getNodeEntity).not.toHaveBeenCalled();
    });

    it("should support generic type parameter", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(nodeEntity);

      const result = entityOps.getEntity<IFlowNodeEntity>("node-1");

      expect(result).toEqual(nodeEntity);
    });
  });

  describe("hasEntity", () => {
    it("should return true when node entity exists", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(nodeEntity);

      const result = entityOps.hasEntity("node-1");

      expect(result).toBe(true);
    });

    it("should return true when edge entity exists", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(null);
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(edgeEntity);

      const result = entityOps.hasEntity("edge-1");

      expect(result).toBe(true);
    });

    it("should return false when entity does not exist", () => {
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(undefined);
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(undefined);

      const result = entityOps.hasEntity("non-existent");

      expect(result).toBe(false);
    });

    it("should return false for empty ID", () => {
      const result = entityOps.hasEntity("");

      expect(result).toBe(false);
      expect(mockRegistry.getNodeEntity).not.toHaveBeenCalled();
    });
  });

  describe("getNodeEntity", () => {
    it("should return node entity when found", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(nodeEntity);

      const result = entityOps.getNodeEntity("node-1");

      expect(result).toEqual(nodeEntity);
      expect(mockRegistry.getNodeEntity).toHaveBeenCalledWith("node-1");
    });

    it("should return undefined when node not found", () => {
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(undefined);

      const result = entityOps.getNodeEntity("non-existent");

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty ID", () => {
      const result = entityOps.getNodeEntity("");

      expect(result).toBeUndefined();
      expect(mockRegistry.getNodeEntity).not.toHaveBeenCalled();
    });
  });

  describe("getEdgeEntity", () => {
    it("should return edge entity when found", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(edgeEntity);

      const result = entityOps.getEdgeEntity("edge-1");

      expect(result).toEqual(edgeEntity);
      expect(mockRegistry.getEdgeEntity).toHaveBeenCalledWith("edge-1");
    });

    it("should return undefined when edge not found", () => {
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(undefined);

      const result = entityOps.getEdgeEntity("non-existent");

      expect(result).toBeUndefined();
    });

    it("should return undefined for empty ID", () => {
      const result = entityOps.getEdgeEntity("");

      expect(result).toBeUndefined();
      expect(mockRegistry.getEdgeEntity).not.toHaveBeenCalled();
    });
  });

  describe("getAllEntities", () => {
    it("should return all node entities from registry", () => {
      const entities = [createMockNodeEntity("node-1"), createMockNodeEntity("node-2")];
      (mockRegistry.listNodeEntities as unknown as any).mockReturnValue(entities);

      const result = entityOps.getAllEntities();

      expect(result).toEqual(entities);
      expect(mockRegistry.listNodeEntities).toHaveBeenCalled();
    });

    it("should return empty array when no entities exist", () => {
      (mockRegistry.listNodeEntities as unknown as any).mockReturnValue([]);

      const result = entityOps.getAllEntities();

      expect(result).toEqual([]);
    });

    it("should return multiple entities", () => {
      const entities = Array.from({ length: 5 }, (_, i) => createMockNodeEntity(`node-${i + 1}`));
      (mockRegistry.listNodeEntities as unknown as any).mockReturnValue(entities);

      const result = entityOps.getAllEntities();

      expect(result).toHaveLength(5);
      expect(result).toEqual(entities);
    });
  });

  describe("getAllEdgeEntities", () => {
    it("should return all edge entities from registry", () => {
      const entities = [createMockEdgeEntity("edge-1"), createMockEdgeEntity("edge-2")];
      (mockRegistry.listEdgeEntities as unknown as any).mockReturnValue(entities);

      const result = entityOps.getAllEdgeEntities();

      expect(result).toEqual(entities);
      expect(mockRegistry.listEdgeEntities).toHaveBeenCalled();
    });

    it("should return empty array when no edge entities exist", () => {
      (mockRegistry.listEdgeEntities as unknown as any).mockReturnValue([]);

      const result = entityOps.getAllEdgeEntities();

      expect(result).toEqual([]);
    });

    it("should return multiple edge entities", () => {
      const entities = Array.from({ length: 3 }, (_, i) => createMockEdgeEntity(`edge-${i + 1}`));
      (mockRegistry.listEdgeEntities as unknown as any).mockReturnValue(entities);

      const result = entityOps.getAllEdgeEntities();

      expect(result).toHaveLength(3);
      expect(result).toEqual(entities);
    });
  });

  describe("Integration Tests", () => {
    it("should handle mixed query for nodes and edges", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      const edgeEntity = createMockEdgeEntity("edge-1");

      (mockRegistry.getNodeEntity as unknown as any)
        .mockReturnValueOnce(nodeEntity)
        .mockReturnValueOnce(null);
      (mockRegistry.getEdgeEntity as unknown as any).mockReturnValue(edgeEntity);

      const node = entityOps.getEntity("node-1");
      const edge = entityOps.getEntity("edge-1");

      expect(node).toEqual(nodeEntity);
      expect(edge).toEqual(edgeEntity);
    });

    it("should maintain registry consistency across operations", () => {
      const nodeEntity = createMockNodeEntity("node-1");
      const entities = [nodeEntity];

      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(nodeEntity);
      (mockRegistry.listNodeEntities as unknown as any).mockReturnValue(entities);

      const single = entityOps.getNodeEntity("node-1");
      const all = entityOps.getAllEntities();

      expect(single).toEqual(nodeEntity);
      expect(all).toContain(nodeEntity);
    });
  });
});
