/**
 * Edge Operations Unit Tests
 *
 * Comprehensive test suite for the EdgeOperations class
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EdgeOperations } from "../../../../src/common/flow/operations/edge-operations";
import type { EntityRegistry } from "../../../../src/common/flow/entity-registry";
import type { FlowGraphCoordinator } from "../../../../src/common/flow/graph-coordinator";
import type { HookAdapter } from "../../../../src/common/flow/orchestration/hook-adapter";
import type { MetricsAdapter } from "../../../../src/common/flow/orchestration/metrics-adapter";
import type { IFlowEdgeEntity, IFlowNodeEntity } from "../../../../src/common/flow/types";

// Helper to create mock edge entity
function createMockEdgeEntity(
  id: string,
  sourceId = "node-1",
  targetId = "node-2"
): IFlowEdgeEntity {
  return {
    id,
    edge: { id },
    sourceId,
    targetId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Helper to create mock node entity
function createMockNodeEntity(id: string): IFlowNodeEntity {
  return {
    id,
    node: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("EdgeOperations", () => {
  let edgeOps: EdgeOperations<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>;
  let mockRegistry: Partial<EntityRegistry<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>>;
  let mockGraphCoordinator: Partial<FlowGraphCoordinator<unknown, unknown>>;
  let mockHooks: Partial<HookAdapter<IFlowNodeEntity>>;
  let mockMetrics: Partial<MetricsAdapter>;

  beforeEach(() => {
    mockRegistry = {
      addEdgeEntity: vi.fn(),
      removeEdgeEntity: vi.fn().mockReturnValue({ removed: true }),
      getEdgeEntity: vi.fn().mockReturnValue(null),
      getNodeEntity: vi.fn().mockReturnValue(null),
      listEdgeEntities: vi.fn().mockReturnValue([]),
    };

    mockGraphCoordinator = {
      registerEdge: vi.fn(),
      detachEdge: vi.fn(),
    };

    mockHooks = {
      runEntityRemoved: vi.fn().mockReturnValue(true),
    };

    mockMetrics = {
      recordGraphLinkSuccess: vi.fn(),
      recordGraphLinkFailure: vi.fn(),
      recordEntityRemoval: vi.fn(),
    };

    edgeOps = new EdgeOperations(
      mockRegistry as EntityRegistry<unknown, unknown, IFlowNodeEntity, IFlowEdgeEntity>,
      mockGraphCoordinator as FlowGraphCoordinator<unknown, unknown>,
      mockHooks as HookAdapter<IFlowNodeEntity>,
      mockMetrics as MetricsAdapter
    );
  });

  describe("createEdge", () => {
    it("should return false if source is empty", () => {
      expect(edgeOps.createEdge("", "node-2", {})).toBe(false);
    });

    it("should return false if target is empty", () => {
      expect(edgeOps.createEdge("node-1", "", {})).toBe(false);
    });

    it("should return false if edge data is empty", () => {
      expect(edgeOps.createEdge("node-1", "node-2", null as any)).toBe(false);
    });

    it("should return true on successful creation", () => {
      const sourceNode = createMockNodeEntity("node-1");
      const targetNode = createMockNodeEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceNode)
        .mockReturnValueOnce(targetNode);

      const result = edgeOps.createEdge("node-1", "node-2", { type: "flow" });
      expect(result).toBe(true);
    });
  });

  describe("addEdge", () => {
    it("should return false if entity is null", () => {
      expect(edgeOps.addEdge(null as any)).toBe(false);
    });

    it("should add edge to registry", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      edgeOps.addEdge(edgeEntity);

      expect(mockRegistry.addEdgeEntity).toHaveBeenCalledWith(edgeEntity);
    });

    it("should return true on successful addition", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      const result = edgeOps.addEdge(edgeEntity);
      expect(result).toBe(true);
    });
  });

  describe("removeEdge", () => {
    it("should return false if ID is empty", () => {
      expect(edgeOps.removeEdge("")).toBe(false);
    });

    it("should return true on successful removal", () => {
      (mockRegistry.removeEdgeEntity as any).mockReturnValue({ removed: true });
      const result = edgeOps.removeEdge("edge-1");
      expect(result).toBe(true);
    });

    it("should record metrics on removal", () => {
      (mockRegistry.removeEdgeEntity as any).mockReturnValue({ removed: true });
      edgeOps.removeEdge("edge-1");
      expect(mockMetrics.recordEntityRemoval).toHaveBeenCalled();
    });
  });

  describe("createEdges", () => {
    it("should return 0 for empty array", () => {
      expect(edgeOps.createEdges([])).toBe(0);
    });

    it("should return count of created edges", () => {
      const sourceNode = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValue(sourceNode);

      const result = edgeOps.createEdges([
        { source: "node-1", target: "node-2", edge: { type: "flow" } },
        { source: "node-1", target: "node-3", edge: { type: "flow" } },
      ]);

      expect(result).toBe(2);
    });
  });

  describe("removeEdges", () => {
    it("should return 0 for empty array", () => {
      expect(edgeOps.removeEdges([])).toBe(0);
    });

    it("should return count of removed edges", () => {
      (mockRegistry.removeEdgeEntity as any).mockReturnValue({ removed: true });
      const result = edgeOps.removeEdges(["edge-1", "edge-2"]);
      expect(result).toBe(2);
    });
  });

  describe("getEdge", () => {
    it("should return undefined if ID is empty", () => {
      expect(edgeOps.getEdge("")).toBeUndefined();
    });

    it("should return edge from registry", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      (mockRegistry.getEdgeEntity as any).mockReturnValue(edgeEntity);
      expect(edgeOps.getEdge("edge-1")).toBe(edgeEntity);
    });
  });

  describe("hasEdge", () => {
    it("should return true if edge exists", () => {
      const edgeEntity = createMockEdgeEntity("edge-1");
      (mockRegistry.getEdgeEntity as any).mockReturnValue(edgeEntity);
      expect(edgeOps.hasEdge("edge-1")).toBe(true);
    });

    it("should return false if edge not found", () => {
      (mockRegistry.getEdgeEntity as any).mockReturnValue(undefined);
      expect(edgeOps.hasEdge("edge-1")).toBe(false);
    });
  });

  describe("getEdgeCount", () => {
    it("should return edge count", () => {
      const edges = [createMockEdgeEntity("edge-1"), createMockEdgeEntity("edge-2")];
      (mockRegistry.listEdgeEntities as any).mockReturnValue(edges);
      expect(edgeOps.getEdgeCount()).toBe(2);
    });

    it("should return 0 when no edges", () => {
      (mockRegistry.listEdgeEntities as any).mockReturnValue([]);
      expect(edgeOps.getEdgeCount()).toBe(0);
    });
  });

  describe("getEdgesBetween", () => {
    it("should return empty if source empty", () => {
      expect(edgeOps.getEdgesBetween("", "node-2")).toEqual([]);
    });

    it("should return edges between nodes", () => {
      const edge1 = createMockEdgeEntity("edge-1", "node-1", "node-2");
      const edge2 = createMockEdgeEntity("edge-2", "node-2", "node-3");

      (mockRegistry.listEdgeEntities as any).mockReturnValue([edge1, edge2]);
      const result = edgeOps.getEdgesBetween("node-1", "node-2");

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(edge1);
    });
  });

  describe("Integration", () => {
    it("should handle complete lifecycle", () => {
      const sourceNode = createMockNodeEntity("node-1");
      const targetNode = createMockNodeEntity("node-2");
      const edgeEntity = createMockEdgeEntity("edge-1", "node-1", "node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceNode)
        .mockReturnValueOnce(targetNode);

      (mockRegistry.getEdgeEntity as any).mockReturnValueOnce(edgeEntity);

      const createResult = edgeOps.createEdge("node-1", "node-2", { type: "flow" });
      expect(createResult).toBe(true);

      const addResult = edgeOps.addEdge(edgeEntity);
      expect(addResult).toBe(true);

      const getResult = edgeOps.getEdge("edge-1");
      expect(getResult).toBe(edgeEntity);

      (mockRegistry.removeEdgeEntity as any).mockReturnValue({ removed: true });
      const removeResult = edgeOps.removeEdge("edge-1");
      expect(removeResult).toBe(true);
    });

    it("should handle batch operations", () => {
      const sourceNode = createMockNodeEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValue(sourceNode);

      const edges = [
        createMockEdgeEntity("edge-1"),
        createMockEdgeEntity("edge-2"),
        createMockEdgeEntity("edge-3"),
      ];

      const createCount = edgeOps.createEdges([
        { source: "node-1", target: "node-2", edge: { type: "flow" } },
        { source: "node-1", target: "node-3", edge: { type: "flow" } },
        { source: "node-1", target: "node-4", edge: { type: "flow" } },
      ]);
      expect(createCount).toBe(3);

      (mockRegistry.listEdgeEntities as any).mockReturnValue(edges);
      expect(edgeOps.getEdgeCount()).toBe(3);

      (mockRegistry.removeEdgeEntity as any).mockReturnValue({ removed: true });
      const removeCount = edgeOps.removeEdges(["edge-1", "edge-2", "edge-3"]);
      expect(removeCount).toBe(3);
    });
  });
});
