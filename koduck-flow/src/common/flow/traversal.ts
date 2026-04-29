/**
 * @module traversal
 * @description Graph traversal and node navigation utilities for Flow.
 *
 * This module provides the {@link FlowTraversal} class which encapsulates graph traversal
 * operations and node access patterns. Supports both graph-backed traversal (using FlowGraphCoordinator)
 * and fallback tree-based traversal using node.children property.
 *
 * ## Key Responsibilities
 * - **Graph Traversal**: Traverse nodes via graph coordinator with visited tracking
 * - **Entity Resolution**: Map between nodes and entities via registry
 * - **Hierarchy Navigation**: Get root nodes and child nodes/entities
 * - **Fallback Support**: Tree-based traversal when graph not available
 *
 * ## Architecture Patterns
 * - **Dual Mode**: Graph-backed (primary) with tree-based fallback
 * - **Visitor Pattern**: Support callback-based traversal with early termination
 * - **Entity Mapping**: Translate between node references and entity objects
 * - **Root Detection**: Identify entry points for traversal
 *
 * ## Design Features
 * - Automatic fallback to node.children tree when no graph
 * - Entity-based traversal via coordinator for efficiency
 * - Support for starting traversal from specific node
 * - Graceful handling of missing entities during traversal
 * - Type-safe generic support for custom node/edge types
 *
 * ## Usage Example
 * ```typescript
 * const traversal = new FlowTraversal(coordinator, registry);
 *
 * // Traverse from root nodes
 * traversal.traverse((node) => {
 *   console.log('Visiting node:', node.id);
 *   return true; // Continue traversal
 * });
 *
 * // Get entity and navigate hierarchy
 * const root = traversal.getRootEntity();
 * const children = traversal.getChildEntities(root);
 * const nodeId = traversal.getEntityIdByNode(node);
 * ```
 *
 * @see {@link FlowGraphCoordinator} for graph operations
 * @see {@link EntityRegistry} for entity management
 * @see {@link NodeTraversalFn} for visitor callback type
 */

import type { FlowGraphCoordinator } from "./graph-coordinator";
import type { EntityRegistry } from "./entity-registry";
import type { IEdge, IFlowEdgeEntity, IFlowNodeEntity, INode, NodeTraversalFn } from "./types";

/**
 * FlowTraversal - Graph and hierarchy traversal utility
 *
 * Provides efficient graph traversal and node navigation with support for both
 * graph-based and tree-based (fallback) traversal modes. Integrates graph coordinator
 * and entity registry for seamless node/entity mapping.
 *
 * ## Key Features
 * - **Dual Mode Traversal**: Graph-backed primary, tree fallback
 * - **Visitor Pattern**: Callback-based with early termination support
 * - **Entity Resolution**: Automatic node-to-entity mapping
 * - **Root Detection**: Find entry points for hierarchies
 * - **Child Navigation**: Get immediate children of nodes
 * - **Generic Types**: Full type support for custom node/edge types
 *
 * ## Traversal Algorithm
 * - **Graph Mode**: Depth-first via graph coordinator with visited tracking
 * - **Tree Mode**: Depth-first via node.children with cycle detection
 * - **Start Nodes**: Configurable start (specific node or all roots)
 * - **Callback**: Called for each visited node; return false to stop
 *
 * @template N - Node type (default: INode)
 * @template E - Edge type (default: IEdge)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 * @template EE - Edge entity type (default: IFlowEdgeEntity<E>)
 *
 * @example
 * ```typescript
 * // Create traversal utility
 * const traversal = new FlowTraversal(coordinator, registry);
 *
 * // Full graph traversal
 * traversal.traverse((node) => {
 *   console.log(node.id);
 *   return true; // Continue
 * });
 *
 * // Starting from specific node
 * traversal.traverse((node) => console.log(node.id), startNode);
 *
 * // Navigate hierarchy
 * const root = traversal.getRootEntity();
 * if (root) {
 *   const children = traversal.getChildEntities(root);
 * }
 * ```
 */
export class FlowTraversal<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
  private readonly entityRegistry: EntityRegistry<N, E, NE, EE>;

  /**
   * Constructor
   *
   * Initializes traversal utility with graph coordinator and entity registry.
   *
   * @param graphCoordinator - The graph coordinator for topology navigation
   * @param entityRegistry - The entity registry for entity resolution
   */
  constructor(
    graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>,
    entityRegistry: EntityRegistry<N, E, NE, EE>
  ) {
    this.graphCoordinator = graphCoordinator;
    this.entityRegistry = entityRegistry;
  }

  /**
   * Traverse all or subset of nodes using visitor pattern
   *
   * Performs depth-first traversal calling visitor for each node.
   * Uses graph-based traversal if available, falls back to tree-based traversal.
   *
   * @param fn - Visitor function called for each node; return false to stop
   * @param start - Optional starting node (uses roots if not provided)
   *
   * @description
   * - Graph Mode: Uses coordinator.traverseFromEntity with entity-based callback
   * - Tree Mode: Walks node.children hierarchy with fallback list
   * - Visited Tracking: Prevents cycles in graph mode
   * - Early Termination: Stops traversal if visitor returns false
   * - Safe: Handles missing entities gracefully
   *
   * @example
   * ```typescript
   * traversal.traverse((node) => {
   *   console.log('Visiting:', node.id);
   *   if (node.id === 'target') return false; // Stop traversal
   *   return true; // Continue
   * });
   * ```
   */
  traverse(fn: NodeTraversalFn<N>, start?: N): void {
    if (this.graphCoordinator.hasGraph()) {
      const visited = new Set<string>();
      const startIds = this.resolveStartNodeIds(start);
      for (const id of startIds) {
        const shouldContinue = this.graphCoordinator.traverseFromEntity(
          id,
          (entity) => fn(entity.node),
          visited
        );
        if (shouldContinue === false) {
          break;
        }
      }
      return;
    }

    const visitedNodes = new Set<N>();
    const startNodes = start ? [start] : this.collectAllNodes();
    for (const current of startNodes) {
      if (visitedNodes.has(current)) continue;
      visitedNodes.add(current);
      const cont = fn(current);
      if (cont === false) {
        break;
      }
    }
  }

  /**
   * Get entity ID for a node reference
   *
   * Maps node object to its corresponding entity ID via registry.
   *
   * @param node - The node to lookup
   * @returns Entity ID if found, undefined otherwise
   *
   * @description
   * - Queries registry.findNodeEntityByNode()
   * - Returns undefined if node not registered
   * - Useful for entity-based operations
   */
  getEntityIdByNode(node: N): string | undefined {
    const entity = this.entityRegistry.findNodeEntityByNode(node);
    return entity?.id;
  }

  /**
   * Get root entity for traversal
   *
   * Returns first root node entity (entry point for hierarchy).
   *
   * @returns Root entity if found, undefined if no entities exist
   *
   * @description
   * - Graph Mode: Gets first root from coordinator.getRootNodeIds()
   * - Tree Mode: Returns first entity from registry.listNodeEntities()
   * - Used as starting point for traversal if no start specified
   * - Returns undefined for empty flow
   */
  getRootEntity(): NE | undefined {
    if (this.graphCoordinator.hasGraph()) {
      const rootIds = this.graphCoordinator.getRootNodeIds();
      for (const rootId of rootIds) {
        const entity = this.entityRegistry.getNodeEntity(rootId);
        if (entity) {
          return entity;
        }
      }
    }

    const entities = this.entityRegistry.listNodeEntities();
    return entities[0];
  }

  /**
   * Get child entities for a given entity
   *
   * Returns immediate child entities of a parent entity.
   *
   * @param entity - The parent entity
   * @returns Array of child entities (may be empty)
   *
   * @description
   * - Graph Mode: Uses coordinator.getChildNodeIds() for children
   * - Tree Mode: Uses entity.node.children array
   * - Returns only direct children (not recursive)
   * - Safely handles missing entities with filtering
   * - O(d) where d is number of children
   *
   * @example
   * ```typescript
   * const children = traversal.getChildEntities(parentEntity);
   * for (const child of children) {
   *   console.log('Child:', child.id);
   * }
   * ```
   */
  getChildEntities(entity: NE): NE[] {
    if (this.graphCoordinator.hasGraph()) {
      const childIds = this.graphCoordinator.getChildNodeIds(entity.id);
      const out: NE[] = [];
      for (const childId of childIds) {
        const childEntity = this.entityRegistry.getNodeEntity(childId);
        if (childEntity) {
          out.push(childEntity);
        }
      }
      return out;
    }

    const out: NE[] = [];
    const childNodes = (entity.node.children as readonly N[] | undefined) ?? [];
    for (const child of childNodes) {
      const mapped = this.entityRegistry.findNodeEntityByNode(child);
      if (mapped) {
        out.push(mapped);
      }
    }
    return out;
  }

  private resolveStartNodeIds(start?: N): string[] {
    if (start) {
      const startId = this.getEntityIdByNode(start);
      if (startId) {
        return [startId];
      }
    }
    return this.graphCoordinator.getRootNodeIds();
  }

  private collectAllNodes(): N[] {
    return this.entityRegistry
      .listNodeEntities()
      .map((entity) => entity.node)
      .filter((node): node is N => !!node);
  }
}
