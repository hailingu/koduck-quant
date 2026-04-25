/**
 * Traversal Operations Unit Tests
 *
 * Tests for the TraversalOperations class, covering:
 * - Basic traversal (DFS, BFS)
 * - Path finding algorithms
 * - Connectivity checks
 * - Topological sorting
 * - Edge cases and error conditions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TraversalOperations } from "../../../../src/common/flow/operations/traversal-operations";
import type { FlowTraversal } from "../../../../src/common/flow/traversal";
import type { EntityRegistry } from "../../../../src/common/flow/entity-registry";
import type { FlowGraphCoordinator } from "../../../../src/common/flow/graph-coordinator";
import type { MetricsAdapter } from "../../../../src/common/flow/orchestration/metrics-adapter";

describe("TraversalOperations", () => {
  let traversalOps: TraversalOperations<unknown, unknown, unknown, unknown>;
  let mockTraversal: FlowTraversal<unknown, unknown>;
  let mockGraphCoordinator: FlowGraphCoordinator<unknown, unknown, unknown, unknown>;
  let mockRegistry: EntityRegistry<unknown, unknown, unknown, unknown>;
  let mockMetrics: MetricsAdapter;

  beforeEach(() => {
    // Setup mock dependencies
    mockTraversal = {} as FlowTraversal<unknown, unknown>;
    mockGraphCoordinator = {
      getChildNodeIds: vi.fn().mockReturnValue([]),
    } as unknown as FlowGraphCoordinator<unknown, unknown, unknown, unknown>;

    mockRegistry = {
      listNodeEntities: vi.fn().mockReturnValue([]),
    } as unknown as EntityRegistry<unknown, unknown, unknown, unknown>;

    mockMetrics = {} as MetricsAdapter;

    // Create instance with mocks
    traversalOps = new TraversalOperations(
      mockTraversal,
      mockGraphCoordinator,
      mockRegistry,
      mockMetrics
    );
  });

  describe("getSuccessors", () => {
    it("should return child node IDs", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValue(["child1", "child2"]);

      const result = traversalOps.getSuccessors("node-1");

      expect(result).toEqual(["child1", "child2"]);
      expect(mockCoordinator.getChildNodeIds).toHaveBeenCalledWith("node-1");
    });

    it("should return empty array for nodes with no children", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.getSuccessors("leaf-node");

      expect(result).toEqual([]);
    });
  });

  describe("getPredecessors", () => {
    it("should return parent node IDs", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([
        { id: "parent1" },
        { id: "parent2" },
        { id: "other" },
      ]);

      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["target-node"])
        .mockReturnValueOnce(["target-node"])
        .mockReturnValueOnce(["other-child"]);

      const result = traversalOps.getPredecessors("target-node");

      expect(result).toEqual(["parent1", "parent2"]);
    });

    it("should return empty array for root nodes", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "root" }]);
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.getPredecessors("root");

      expect(result).toEqual([]);
    });
  });

  describe("getNeighbors", () => {
    it("should return both successors and predecessors", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "parent" }]);
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["child"])
        .mockReturnValueOnce(["target"]);

      const result = traversalOps.getNeighbors("target");

      expect(result).toContain("child");
      expect(result).toContain("parent");
      expect(result.length).toBe(2);
    });

    it("should not duplicate neighbors", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "both" }]);
      mockCoordinator.getChildNodeIds.mockReturnValueOnce(["both"]).mockReturnValueOnce(["target"]);

      const result = traversalOps.getNeighbors("target");

      expect(result).toEqual(["both"]);
    });
  });

  describe("findPath", () => {
    it("should return same node when source equals target", () => {
      const result = traversalOps.findPath("node-1", "node-1");

      expect(result).toEqual(["node-1"]);
    });

    it("should find direct path", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValueOnce(["target"]).mockReturnValueOnce([]);

      const result = traversalOps.findPath("source", "target");

      expect(result).toEqual(["source", "target"]);
    });

    it("should find path through intermediate nodes", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["intermediate"])
        .mockReturnValueOnce(["target"])
        .mockReturnValueOnce([]);

      const result = traversalOps.findPath("source", "target");

      expect(result).toEqual(["source", "intermediate", "target"]);
    });

    it("should return null when no path exists", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.findPath("source", "unreachable");

      expect(result).toBeNull();
    });
  });

  describe("findAllPaths", () => {
    it("should find single path", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValueOnce(["target"]).mockReturnValueOnce([]);

      const result = traversalOps.findAllPaths("source", "target");

      expect(result).toEqual([["source", "target"]]);
    });

    it("should find multiple paths", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["path1", "path2"]) // from source
        .mockReturnValueOnce(["target"]) // from path1
        .mockReturnValueOnce(["target"]) // from path2
        .mockReturnValueOnce([]) // from target (path1)
        .mockReturnValueOnce([]); // from target (path2)

      const result = traversalOps.findAllPaths("source", "target");

      expect(result.length).toBe(2);
      expect(result).toContainEqual(["source", "path1", "target"]);
      expect(result).toContainEqual(["source", "path2", "target"]);
    });

    it("should return empty array when no paths exist", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.findAllPaths("source", "unreachable");

      expect(result).toEqual([]);
    });
  });

  describe("isConnected", () => {
    it("should return true when nodes are connected", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValueOnce(["target"]).mockReturnValueOnce([]);

      const result = traversalOps.isConnected("source", "target");

      expect(result).toBe(true);
    });

    it("should return false when nodes are not connected", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.isConnected("source", "unreachable");

      expect(result).toBe(false);
    });
  });

  describe("getConnectedComponents", () => {
    it("should return single component for isolated graph", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "node1" }, { id: "node2" }]);
      mockCoordinator.getChildNodeIds.mockReturnValue([]);

      const result = traversalOps.getConnectedComponents();

      expect(result.length).toBe(2);
      expect(result).toContainEqual(["node1"]);
      expect(result).toContainEqual(["node2"]);
    });

    it("should return single component for connected graph", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "node1" }, { id: "node2" }]);
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["node2"])
        .mockReturnValueOnce([])
        .mockReturnValueOnce(["node2"])
        .mockReturnValueOnce([]);

      const result = traversalOps.getConnectedComponents();

      expect(result.length).toBe(1);
      expect(result[0]).toContain("node1");
      expect(result[0]).toContain("node2");
    });
  });

  describe("topologicalSort", () => {
    it("should return nodes in topological order", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b", "c"]) // a successors for in-degree
        .mockReturnValueOnce(["c"]) // b successors for in-degree
        .mockReturnValueOnce([]) // c successors for in-degree
        .mockReturnValueOnce(["b", "c"]) // a successors during sort
        .mockReturnValueOnce(["c"]) // b successors during sort
        .mockReturnValueOnce([]); // c successors during sort

      const result = traversalOps.topologicalSort();

      expect(result).not.toBeNull();
      if (result) {
        expect(result.indexOf("a")).toBeLessThan(result.indexOf("b"));
        expect(result.indexOf("b")).toBeLessThan(result.indexOf("c"));
      }
    });

    it("should return null if cycle exists", () => {
      const mockRegistry_ = mockRegistry as any;
      const mockCoordinator = mockGraphCoordinator as any;

      mockRegistry_.listNodeEntities.mockReturnValue([{ id: "a" }, { id: "b" }]);
      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b"]) // a -> b
        .mockReturnValueOnce(["a"]) // b -> a (cycle)
        .mockReturnValueOnce(["b"]) // a successors during sort
        .mockReturnValueOnce(["a"]); // b successors during sort

      const result = traversalOps.topologicalSort();

      expect(result).toBeNull();
    });
  });

  describe("dfs", () => {
    it("should visit all nodes in DFS order", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      const visited: string[] = [];

      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b"])
        .mockReturnValueOnce(["c"])
        .mockReturnValueOnce([]);

      traversalOps.dfs("a", (nodeId: string) => {
        visited.push(nodeId);
      });

      expect(visited).toEqual(["a", "b", "c"]);
    });

    it("should stop traversal if visitor returns false", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      const visited: string[] = [];

      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b"])
        .mockReturnValueOnce(["c"])
        .mockReturnValueOnce([]);

      traversalOps.dfs("a", (nodeId: string) => {
        visited.push(nodeId);
        if (nodeId === "b") {
          return false;
        }
      });

      expect(visited).toEqual(["a", "b"]);
    });
  });

  describe("bfs", () => {
    it("should visit all nodes in BFS order", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      const visited: string[] = [];

      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b", "c"])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      traversalOps.bfs("a", (nodeId: string) => {
        visited.push(nodeId);
      });

      expect(visited).toContain("a");
      expect(visited).toContain("b");
      expect(visited).toContain("c");
      expect(visited[0]).toBe("a");
    });

    it("should stop traversal if visitor returns false", () => {
      const mockCoordinator = mockGraphCoordinator as any;
      const visited: string[] = [];

      mockCoordinator.getChildNodeIds
        .mockReturnValueOnce(["b", "c"])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);

      traversalOps.bfs("a", (nodeId: string) => {
        visited.push(nodeId);
        if (nodeId === "b") {
          return false;
        }
      });

      expect(visited).toEqual(["a", "b"]);
    });
  });
});
