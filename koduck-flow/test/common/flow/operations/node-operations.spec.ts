/**
 * Node Operations Unit Tests
 *
 * Comprehensive test suite for the NodeOperations class, covering:
 * - Node addition/removal with validation
 * - Node linking with error handling
 * - Batch operations with counting
 * - Node queries and existence checks
 * - Edge cases and boundary conditions
 *
 * Test Coverage: 9 methods, 24+ test cases
 * Target Coverage: ≥85%
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NodeOperations } from "../../../../src/common/flow/operations/node-operations";
import type { EntityRegistry } from "../../../../src/common/flow/entity-registry";
import type { FlowGraphCoordinator } from "../../../../src/common/flow/graph-coordinator";
import type { HookAdapter } from "../../../../src/common/flow/orchestration/hook-adapter";
import type { MetricsAdapter } from "../../../../src/common/flow/orchestration/metrics-adapter";
import type { IFlowNodeEntity } from "../../../../src/common/flow/types";

// Helper function to create mock entity
function createMockEntity(id: string): IFlowNodeEntity {
  return {
    id,
    node: { id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("NodeOperations", () => {
  let nodeOps: NodeOperations<unknown, unknown, IFlowNodeEntity, unknown>;
  let mockRegistry: Partial<EntityRegistry<unknown, unknown, IFlowNodeEntity, unknown>>;
  let mockGraphCoordinator: Partial<FlowGraphCoordinator<unknown, unknown>>;
  let mockHooks: Partial<HookAdapter<IFlowNodeEntity>>;
  let mockMetrics: Partial<MetricsAdapter>;

  beforeEach(() => {
    // Setup mock registry methods
    mockRegistry = {
      addNodeEntity: vi.fn(),
      removeNodeEntity: vi.fn().mockReturnValue(true),
      getNodeEntity: vi.fn().mockReturnValue(null),
      listNodeEntities: vi.fn().mockReturnValue([]),
    };

    // Setup mock graph coordinator methods
    mockGraphCoordinator = {
      registerNode: vi.fn(),
      removeNode: vi.fn(),
      linkNodes: vi.fn().mockReturnValue({ success: true, error: null }),
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
      recordEntityRemoval: vi.fn(),
    };

    // Create instance with mocks
    nodeOps = new NodeOperations(
      mockRegistry as EntityRegistry<unknown, unknown, IFlowNodeEntity, unknown>,
      mockGraphCoordinator as FlowGraphCoordinator<unknown, unknown>,
      mockHooks as HookAdapter<IFlowNodeEntity>,
      mockMetrics as MetricsAdapter
    );
  });

  describe("addNode", () => {
    it("should add node to registry", () => {
      const entity = createMockEntity("node-1");
      nodeOps.addNode(entity);

      expect(mockRegistry.addNodeEntity).toHaveBeenCalledWith(entity);
    });

    it("should register node in graph coordinator", () => {
      const entity = createMockEntity("node-1");
      nodeOps.addNode(entity);

      expect(mockGraphCoordinator.registerNode).toHaveBeenCalled();
    });

    it("should link to parent nodes when parentIds provided", () => {
      const parentEntity = createMockEntity("parent-1");
      const childEntity = createMockEntity("child-1");

      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(parentEntity);

      nodeOps.addNode(childEntity, { parentIds: ["parent-1"], linkMetadata: undefined });

      expect(mockGraphCoordinator.linkNodes).toHaveBeenCalled();
    });

    it("should not link if parent ID does not exist", () => {
      const childEntity = createMockEntity("child-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(null);

      nodeOps.addNode(childEntity, { parentIds: ["parent-1"], linkMetadata: undefined });

      expect(mockGraphCoordinator.linkNodes).not.toHaveBeenCalled();
    });

    it("should record link success metric", () => {
      const parentEntity = createMockEntity("parent-1");
      const childEntity = createMockEntity("child-1");

      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(parentEntity);
      (mockGraphCoordinator.linkNodes as unknown as any).mockReturnValue({ success: true });

      nodeOps.addNode(childEntity, { parentIds: ["parent-1"], linkMetadata: undefined });

      expect(mockMetrics.recordGraphLinkSuccess).toHaveBeenCalledWith("addNode");
    });

    it("should record link failure metric", () => {
      const parentEntity = createMockEntity("parent-1");
      const childEntity = createMockEntity("child-1");

      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(parentEntity);
      (mockGraphCoordinator.linkNodes as unknown as any).mockReturnValue({
        success: false,
        error: new Error("Link failed"),
      });

      nodeOps.addNode(childEntity, { parentIds: ["parent-1"], linkMetadata: undefined });

      expect(mockMetrics.recordGraphLinkFailure).toHaveBeenCalled();
    });

    it("should handle empty entity gracefully", () => {
      nodeOps.addNode(null as any);

      expect(mockRegistry.addNodeEntity).not.toHaveBeenCalled();
    });

    it("should process multiple parent IDs", () => {
      const parentEntity1 = createMockEntity("parent-1");
      const parentEntity2 = createMockEntity("parent-2");
      const childEntity = createMockEntity("child-1");

      (mockRegistry.getNodeEntity as unknown as any)
        .mockReturnValueOnce(parentEntity1)
        .mockReturnValueOnce(parentEntity2);

      nodeOps.addNode(childEntity, {
        parentIds: ["parent-1", "parent-2"],
        linkMetadata: undefined,
      });

      expect(mockGraphCoordinator.linkNodes).toHaveBeenCalledTimes(2);
    });
  });

  describe("removeNode", () => {
    it("should return false if node not found", () => {
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(null);

      const result = nodeOps.removeNode("node-1");

      expect(result).toBe(false);
    });

    it("should call runEntityRemoved hook", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);

      nodeOps.removeNode("node-1");

      expect(mockHooks.runEntityRemoved).toHaveBeenCalledWith("node-1");
    });

    it("should return false if hook rejects removal", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);
      (mockHooks.runEntityRemoved as any).mockReturnValueOnce(false);

      const result = nodeOps.removeNode("node-1");

      expect(result).toBe(false);
      expect(mockRegistry.removeNodeEntity).not.toHaveBeenCalled();
    });

    it("should remove node from registry", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);
      (mockRegistry.removeNodeEntity as any).mockReturnValueOnce(true);

      nodeOps.removeNode("node-1");

      expect(mockRegistry.removeNodeEntity).toHaveBeenCalled();
    });

    it("should record entity removal metric", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);
      (mockRegistry.removeNodeEntity as any).mockReturnValueOnce(true);

      nodeOps.removeNode("node-1");

      expect(mockMetrics.recordEntityRemoval).toHaveBeenCalled();
    });

    it("should remove node from graph coordinator on success", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);
      (mockRegistry.removeNodeEntity as any).mockReturnValueOnce(true);

      nodeOps.removeNode("node-1");

      expect(mockGraphCoordinator.removeNode).toHaveBeenCalledWith("node-1");
    });

    it("should return true on successful removal", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);
      (mockRegistry.removeNodeEntity as any).mockReturnValueOnce(true);

      const result = nodeOps.removeNode("node-1");

      expect(result).toBe(true);
    });
  });

  describe("linkNodes", () => {
    it("should return false for same source and target", () => {
      const result = nodeOps.linkNodes("node-1", "node-1");

      expect(result).toBe(false);
    });

    it("should return false if source node not found", () => {
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(null);

      const result = nodeOps.linkNodes("node-1", "node-2");

      expect(result).toBe(false);
    });

    it("should return false if target node not found", () => {
      const sourceEntity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(null);

      const result = nodeOps.linkNodes("node-1", "node-2");

      expect(result).toBe(false);
    });

    it("should register both nodes in graph coordinator", () => {
      const sourceEntity = createMockEntity("node-1");
      const targetEntity = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(targetEntity);

      nodeOps.linkNodes("node-1", "node-2");

      expect(mockGraphCoordinator.registerNode).toHaveBeenCalledTimes(2);
    });

    it("should call linkNodes on graph coordinator", () => {
      const sourceEntity = createMockEntity("node-1");
      const targetEntity = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as unknown as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(targetEntity);

      nodeOps.linkNodes("node-1", "node-2");

      expect(mockGraphCoordinator.linkNodes).toHaveBeenCalled();
    });

    it("should return true on successful link", () => {
      const sourceEntity = createMockEntity("node-1");
      const targetEntity = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(targetEntity);
      (mockGraphCoordinator.linkNodes as any).mockReturnValue({ success: true });

      const result = nodeOps.linkNodes("node-1", "node-2");

      expect(result).toBe(true);
    });

    it("should record success metric on successful link", () => {
      const sourceEntity = createMockEntity("node-1");
      const targetEntity = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(targetEntity);
      (mockGraphCoordinator.linkNodes as any).mockReturnValue({ success: true });

      nodeOps.linkNodes("node-1", "node-2");

      expect(mockMetrics.recordGraphLinkSuccess).toHaveBeenCalledWith("direct");
    });

    it("should return false on failed link", () => {
      const sourceEntity = createMockEntity("node-1");
      const targetEntity = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(sourceEntity)
        .mockReturnValueOnce(targetEntity);
      (mockGraphCoordinator.linkNodes as any).mockReturnValue({
        success: false,
        error: new Error("Link failed"),
      });

      const result = nodeOps.linkNodes("node-1", "node-2");

      expect(result).toBe(false);
    });
  });

  describe("addNodes", () => {
    it("should add each entity from array", () => {
      const entity1 = createMockEntity("node-1");
      const entity2 = createMockEntity("node-2");

      nodeOps.addNodes([entity1, entity2]);

      expect(mockRegistry.addNodeEntity).toHaveBeenCalledTimes(2);
    });

    it("should handle empty array", () => {
      nodeOps.addNodes([]);

      expect(mockRegistry.addNodeEntity).not.toHaveBeenCalled();
    });

    it("should propagate options to each addNode call", () => {
      const entity1 = createMockEntity("node-1");
      const entity2 = createMockEntity("node-2");
      const options = { parentIds: ["parent-1"], linkMetadata: undefined };

      const parent = createMockEntity("parent-1");
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValue(parent);

      nodeOps.addNodes([entity1, entity2], options);

      expect(mockGraphCoordinator.linkNodes).toHaveBeenCalledTimes(2);
    });
  });

  describe("removeNodes", () => {
    it("should return 0 for empty array", () => {
      const result = nodeOps.removeNodes([]);

      expect(result).toBe(0);
    });

    it("should return count of removed nodes", () => {
      const entity1 = createMockEntity("node-1");
      const entity2 = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity1).mockReturnValueOnce(entity2);

      const result = nodeOps.removeNodes(["node-1", "node-2"]);

      expect(result).toBe(2);
    });

    it("should only count successfully removed nodes", () => {
      const entity1 = createMockEntity("node-1");

      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity1).mockReturnValueOnce(null);

      const result = nodeOps.removeNodes(["node-1", "node-2"]);

      expect(result).toBe(1);
    });

    it("should call removeNode for each ID", () => {
      const entity1 = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValue(entity1);

      nodeOps.removeNodes(["node-1", "node-2", "node-3"]);

      expect(mockRegistry.removeNodeEntity).toHaveBeenCalledTimes(3);
    });
  });

  describe("getNode", () => {
    it("should return node entity from registry", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);

      const result = nodeOps.getNode("node-1");

      expect(result).toBe(entity);
    });

    it("should return undefined if node not found", () => {
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(undefined);

      const result = nodeOps.getNode("node-1");

      expect(result).toBeUndefined();
    });

    it("should call registry.getNodeEntity with correct ID", () => {
      nodeOps.getNode("node-1");

      expect(mockRegistry.getNodeEntity).toHaveBeenCalledWith("node-1");
    });
  });

  describe("hasNode", () => {
    it("should return true if node exists", () => {
      const entity = createMockEntity("node-1");
      (mockRegistry.getNodeEntity as any).mockReturnValueOnce(entity);

      const result = nodeOps.hasNode("node-1");

      expect(result).toBe(true);
    });

    it("should return false if node does not exist", () => {
      (mockRegistry.getNodeEntity as unknown as any).mockReturnValueOnce(undefined);

      const result = nodeOps.hasNode("node-1");

      expect(result).toBe(false);
    });

    it("should call registry.getNodeEntity with correct ID", () => {
      nodeOps.hasNode("node-1");

      expect(mockRegistry.getNodeEntity).toHaveBeenCalledWith("node-1");
    });
  });

  describe("getNodeCount", () => {
    it("should return count of nodes", () => {
      const entities = [
        createMockEntity("node-1"),
        createMockEntity("node-2"),
        createMockEntity("node-3"),
      ];
      (mockRegistry.listNodeEntities as any).mockReturnValueOnce(entities);

      const result = nodeOps.getNodeCount();

      expect(result).toBe(3);
    });

    it("should return 0 for empty registry", () => {
      (mockRegistry.listNodeEntities as any).mockReturnValueOnce([]);

      const result = nodeOps.getNodeCount();

      expect(result).toBe(0);
    });

    it("should call registry.listNodeEntities", () => {
      nodeOps.getNodeCount();

      expect(mockRegistry.listNodeEntities).toHaveBeenCalled();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete node lifecycle: add -> link -> remove", () => {
      const node1 = createMockEntity("node-1");
      const node2 = createMockEntity("node-2");

      (mockRegistry.getNodeEntity as any)
        .mockReturnValueOnce(node1)
        .mockReturnValueOnce(node2)
        .mockReturnValueOnce(node2);

      // Add nodes
      nodeOps.addNode(node1);
      nodeOps.addNode(node2);

      // Link nodes
      const linkResult = nodeOps.linkNodes("node-1", "node-2");

      // Remove node
      const removeResult = nodeOps.removeNode("node-1");

      expect(mockRegistry.addNodeEntity).toHaveBeenCalledTimes(2);
      expect(linkResult).toBe(true);
      expect(removeResult).toBe(true);
    });

    it("should handle batch operations efficiently", () => {
      const nodes = [
        createMockEntity("node-1"),
        createMockEntity("node-2"),
        createMockEntity("node-3"),
      ];

      // Add nodes in batch
      nodeOps.addNodes(nodes);

      // Get count
      (mockRegistry.listNodeEntities as any).mockReturnValueOnce(nodes);
      const count = nodeOps.getNodeCount();

      // Remove in batch
      (mockRegistry.getNodeEntity as any).mockReturnValue(nodes[0]);
      const removed = nodeOps.removeNodes(["node-1", "node-2", "node-3"]);

      expect(count).toBe(3);
      expect(removed).toBe(3);
    });
  });
});
