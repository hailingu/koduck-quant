/**
 * Traversal Operations Module
 *
 * Encapsulates graph traversal and path query operations, including:
 * - Basic traversal (DFS, BFS)
 * - Path finding algorithms
 * - Connectivity checks
 * - Topological sorting
 *
 * @template N - Node type
 * @template E - Edge type
 * @template NE - Node entity type
 * @template EE - Edge entity type
 */

import type { FlowTraversal } from "../traversal";
import type { EntityRegistry } from "../entity-registry";
import type { FlowGraphCoordinator } from "../graph-coordinator";
import type { MetricsAdapter } from "../orchestration/metrics-adapter";
import type { IEdge, IFlowEdgeEntity, IFlowNodeEntity, INode } from "../types";

/**
 * TraversalOperations class
 *
 * Provides comprehensive graph traversal and path query capabilities.
 * All traversal algorithms are encapsulated here with metrics tracking.
 */
export class TraversalOperations<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /**
   * Creates a new TraversalOperations instance
   *
   * @param traversal - Traversal utility for graph algorithms
   * @param graphCoordinator - Graph coordinator for topology access
   * @param registry - Entity registry for node lookup
   * @param metrics - Metrics adapter for performance tracking
   */
  constructor(
    private readonly traversal: FlowTraversal<N, E>,
    private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>,
    private readonly registry: EntityRegistry<N, E, NE, EE>,
    private readonly metrics: MetricsAdapter
  ) {}

  /**
   * Get successor nodes (direct children)
   *
   * @param nodeId - Node ID
   * @returns Array of successor node IDs
   */
  getSuccessors(nodeId: string): string[] {
    return this.graphCoordinator.getChildNodeIds(nodeId);
  }

  /**
   * Get predecessor nodes (direct parents)
   *
   * @param nodeId - Node ID
   * @returns Array of predecessor node IDs
   */
  getPredecessors(nodeId: string): string[] {
    return this.graphCoordinator.getParentNodeIds(nodeId);
  }

  /**
   * Get neighboring nodes (both predecessors and successors)
   *
   * @param nodeId - Node ID
   * @returns Array of neighboring node IDs
   */
  getNeighbors(nodeId: string): string[] {
    const successors = this.getSuccessors(nodeId);
    const predecessors = this.getPredecessors(nodeId);
    const neighbors = new Set<string>([...successors, ...predecessors]);
    return Array.from(neighbors);
  }

  /**
   * Find a path between two nodes using BFS
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Array of node IDs representing the path, or null if no path exists
   */
  findPath(sourceId: string, targetId: string): string[] | null {
    if (sourceId === targetId) {
      return [sourceId];
    }

    const queue: string[] = [sourceId];
    const visited = new Set<string>([sourceId]);
    const parent = new Map<string, string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      const successors = this.getSuccessors(current);

      for (const successor of successors) {
        if (successor === targetId) {
          const path: string[] = [targetId];
          let node: string | undefined = current;
          while (node !== undefined) {
            path.unshift(node);
            node = parent.get(node);
          }
          return path;
        }

        if (!visited.has(successor)) {
          visited.add(successor);
          parent.set(successor, current);
          queue.push(successor);
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between two nodes using DFS
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Array of arrays of node IDs representing all paths
   */
  findAllPaths(sourceId: string, targetId: string): string[][] {
    const allPaths: string[][] = [];

    const dfsForPaths = (
      current: string,
      target: string,
      visited: Set<string>,
      path: string[]
    ): void => {
      if (current === target) {
        allPaths.push([...path]);
        return;
      }

      const successors = this.getSuccessors(current);
      for (const successor of successors) {
        if (!visited.has(successor)) {
          visited.add(successor);
          path.push(successor);
          dfsForPaths(successor, target, visited, path);
          path.pop();
          visited.delete(successor);
        }
      }
    };

    const visited = new Set<string>([sourceId]);
    dfsForPaths(sourceId, targetId, visited, [sourceId]);

    return allPaths;
  }

  /**
   * Check if two nodes are connected
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns True if there is a path between the nodes, false otherwise
   */
  isConnected(sourceId: string, targetId: string): boolean {
    return this.findPath(sourceId, targetId) !== null;
  }

  /**
   * Get connected components in the graph
   *
   * @returns Array of arrays of node IDs representing connected components
   */
  getConnectedComponents(): string[][] {
    const nodes = new Set<string>();
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const nodeEntity of this.registry.listNodeEntities()) {
      nodes.add(nodeEntity.id);
    }

    const dfsComponent = (nodeId: string, component: Set<string>): void => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);
      component.add(nodeId);

      const successors = this.getSuccessors(nodeId);
      const predecessors = this.getPredecessors(nodeId);
      const neighbors = new Set<string>([...successors, ...predecessors]);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfsComponent(neighbor, component);
        }
      }
    };

    for (const nodeId of nodes) {
      if (!visited.has(nodeId)) {
        const component = new Set<string>();
        dfsComponent(nodeId, component);
        components.push(Array.from(component));
      }
    }

    return components;
  }

  /**
   * Get topological sort of nodes
   *
   * Uses Kahn's algorithm for topological sorting. Returns null if cycle is detected.
   *
   * @returns Array of node IDs in topological order, or null if cycle exists
   */
  topologicalSort(): string[] | null {
    const nodes = new Set<string>();
    const inDegree = new Map<string, number>();

    for (const nodeEntity of this.registry.listNodeEntities()) {
      nodes.add(nodeEntity.id);
      inDegree.set(nodeEntity.id, 0);
    }

    for (const nodeId of nodes) {
      const successors = this.getSuccessors(nodeId);
      for (const successor of successors) {
        inDegree.set(successor, (inDegree.get(successor) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      const successors = this.getSuccessors(current);
      for (const successor of successors) {
        const newDegree = (inDegree.get(successor) ?? 0) - 1;
        inDegree.set(successor, newDegree);
        if (newDegree === 0) {
          queue.push(successor);
        }
      }
    }

    if (result.length !== nodes.size) {
      return null;
    }

    return result;
  }

  /**
   * Depth-first search traversal
   *
   * @param startId - Starting node ID
   * @param visitor - Callback function for each node visited; return false to stop
   */
  dfs(startId: string, visitor: (nodeId: string) => boolean | void): void {
    const visited = new Set<string>();

    const dfsHelper = (nodeId: string): boolean => {
      if (visited.has(nodeId)) {
        return true;
      }
      visited.add(nodeId);

      const result = visitor(nodeId);
      if (result === false) {
        return false;
      }

      const successors = this.getSuccessors(nodeId);
      for (const successor of successors) {
        if (!dfsHelper(successor)) {
          return false;
        }
      }

      return true;
    };

    dfsHelper(startId);
  }

  /**
   * Breadth-first search traversal
   *
   * @param startId - Starting node ID
   * @param visitor - Callback function for each node visited; return false to stop
   */
  bfs(startId: string, visitor: (nodeId: string) => boolean | void): void {
    const visited = new Set<string>([startId]);
    const queue: string[] = [startId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const result = visitor(current);
      if (result === false) {
        return;
      }

      const successors = this.getSuccessors(current);
      for (const successor of successors) {
        if (!visited.has(successor)) {
          visited.add(successor);
          queue.push(successor);
        }
      }
    }
  }
}
