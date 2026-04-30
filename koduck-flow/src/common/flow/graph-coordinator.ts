/**
 * @module graph-coordinator
 * @description Graph topology coordination and management for the Flow system.
 *
 * This module provides the {@link FlowGraphCoordinator} class which manages the graph topology
 * representation of flow entities. It coordinates node and edge registration, graph creation,
 * traversal operations, and link management while maintaining consistency with the entity registry.
 *
 * ## Key Responsibilities
 * - **Graph Creation & Initialization**: Create and manage graph instances with lazy initialization
 * - **Node Registration**: Register flow nodes into the graph topology, handling entity metadata
 * - **Edge Registration**: Register flow edges between nodes, maintaining link metadata
 * - **Link Management**: Create/remove connections between nodes with optional metadata
 * - **Graph Traversal**: Traverse graph from source nodes with visitor pattern support
 * - **Entity Resolution**: Resolve entities by ID with lazy loading from custom resolver
 *
 * ## Architecture Patterns
 * - **Graph Representation**: Uses FlowGraphAST for directed acyclic graph representation
 * - **Lazy Graph Creation**: Graph is only created when first needed (ensureGraph pattern)
 * - **Entity Integration**: Works closely with EntityRegistry for entity tracking
 * - **Custom Entity Resolution**: Supports pluggable entity resolver for dynamic lookup
 * - **Link Metadata**: Attaches rich metadata to edges including port information and state
 * - **Type Safety**: Full generic type support for custom node/edge types
 *
 * ## Design Features
 * - Prevents duplicate node registrations automatically
 * - Gracefully handles edge registration without pre-registered nodes
 * - Supports multi-source/multi-target edges with port-based connections
 * - Traversal with cycle detection via visited set tracking
 * - Error handling for edge attachment (silently ignores cycles)
 *
 * ## Usage Example
 * ```typescript
 * // Create coordinator with entity registry and custom resolver
 * const coordinator = new FlowGraphCoordinator<MyNode, MyEdge, MyNodeEntity, MyEdgeEntity>({
 *   registry,
 *   createGraph: () => new FlowGraphAST(),
 *   resolveEntity: (id) => externalEntityMap.get(id),
 * });
 *
 * // Register nodes and edges
 * coordinator.registerNode(nodeEntity);
 * coordinator.registerEdge(edgeEntity);
 *
 * // Create direct links between nodes
 * const result = coordinator.linkNodes('source-id', 'target-id', {
 *   edgeId: 'edge-123',
 *   sourcePort: 'output',
 *   targetPort: 'input',
 * });
 *
 * // Traverse from root nodes
 * coordinator.traverseFromEntity('root-id', (entity) => {
 *   console.log('Visiting:', entity.id);
 * }, new Set());
 * ```
 *
 * @see {@link EntityRegistry} for entity management
 * @see {@link FlowGraphAST} for graph data structure
 * @see {@link IFlowNodeEntity} for node entity interface
 * @see {@link IFlowEdgeEntity} for edge entity interface
 */

import { FlowGraphAST } from "./flow-graph";
import type { EntityRegistry } from "./entity-registry";
import type {
  FlowLinkMetadata,
  IEdge,
  IFlowEdgeEntity,
  IFlowEntity,
  IFlowNodeEntity,
  INode,
} from "./types";

/**
 * Configuration options for FlowGraphCoordinator initialization
 *
 * @template N - Node type extending INode
 * @template E - Edge type extending IEdge
 * @template NE - Node entity type extending IFlowNodeEntity
 * @template EE - Edge entity type extending IFlowEdgeEntity
 */
type FlowGraphCoordinatorOptions<
  N extends INode,
  E extends IEdge,
  NE extends IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E>,
> = {
  /** The entity registry for tracking and resolving entities */
  registry: EntityRegistry<N, E, NE, EE>;
  /** Optional factory function for creating graph instances (defaults to new FlowGraphAST()) */
  createGraph?: () => FlowGraphAST;
  /** Optional custom entity resolver for lazy loading entities by ID */
  resolveEntity?: (id: string) => IFlowEntity | undefined;
};

/**
 * FlowGraphCoordinator - Central coordinator for flow graph topology management
 *
 * Manages the directed graph representation of flow nodes and edges, coordinating registration,
 * link management, traversal, and entity resolution. Works closely with EntityRegistry to
 * maintain consistent entity tracking across the flow system.
 *
 * ## Dual-Purpose Design
 * - **Primary**: Manages graph topology representation and navigation
 * - **Secondary**: Coordinates between entity registry and graph structure
 *
 * ## Key Features
 * - Lazy graph initialization on first use (ensureGraph pattern)
 * - Automatic node registration when referenced by edges
 * - Port-aware edge connections with metadata preservation
 * - Cycle detection during traversal via visited set
 * - Graceful error handling for invalid operations
 * - Custom entity resolution with fallback to registry
 *
 * ## Generic Type Parameters
 * @template N - The concrete node type (default: INode)
 * @template E - The concrete edge type (default: IEdge)
 * @template NE - The concrete node entity type (default: IFlowNodeEntity<N>)
 * @template EE - The concrete edge entity type (default: IFlowEdgeEntity<E>)
 *
 * ## Internal Structure
 * - graph: Optional FlowGraphAST instance (lazily created)
 * - registry: EntityRegistry for entity tracking
 * - createGraph: Factory for graph instances
 * - resolveEntity: Custom resolver for dynamic entity lookup
 *
 * @example
 * ```typescript
 * // Create coordinator for custom flow types
 * const coordinator = new FlowGraphCoordinator<CustomNode, CustomEdge>({
 *   registry: new EntityRegistry(manager, guards),
 *   createGraph: () => new FlowGraphAST(),
 * });
 *
 * // Register entities
 * coordinator.registerNode(nodeEntity);
 * coordinator.registerEdge(edgeEntity);
 *
 * // Navigate graph
 * const roots = coordinator.getRootNodeIds();
 * const children = coordinator.getChildNodeIds(rootId);
 * ```
 */
export class FlowGraphCoordinator<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /** The underlying directed graph data structure */
  private graph: FlowGraphAST | undefined;

  /** Reference to entity registry for entity tracking and resolution */
  private readonly registry: EntityRegistry<N, E, NE, EE>;

  /** Factory function for creating graph instances */
  private readonly createGraph: () => FlowGraphAST;

  /** Optional custom entity resolver for dynamic entity lookup */
  private readonly resolveEntity: ((id: string) => IFlowEntity | undefined) | undefined;

  /**
   * Constructor
   *
   * Initializes the graph coordinator with entity registry and optional configuration options.
   * The graph is not created until first accessed via ensureGraph() (lazy initialization pattern).
   *
   * @param options - Configuration options including registry and optional graph factory/resolver
   *
   * @example
   * ```typescript
   * const coordinator = new FlowGraphCoordinator({
   *   registry: entityRegistry,
   *   createGraph: () => new FlowGraphAST(),
   *   resolveEntity: (id) => customEntityMap.get(id),
   * });
   * ```
   */
  constructor(options: FlowGraphCoordinatorOptions<N, E, NE, EE>) {
    this.registry = options.registry;
    this.graph = undefined;
    this.createGraph = options.createGraph ?? (() => new FlowGraphAST());
    this.resolveEntity = options.resolveEntity;
  }

  /**
   * Get the current graph instance
   *
   * @returns The FlowGraphAST instance if graph has been created, undefined if not yet initialized
   *
   * @remarks
   * - Returns undefined if graph hasn't been accessed yet (lazy initialization)
   * - Use ensureGraph() to get or create graph
   * - Useful for checking if graph exists without triggering creation
   *
   * @example
   * ```typescript
   * const graph = coordinator.getGraph();
   * if (graph) {
   *   console.log('Graph nodes:', graph.getNodes().length);
   * }
   * ```
   */
  getGraph(): FlowGraphAST | undefined {
    return this.graph;
  }

  /**
   * Manually set the graph instance
   *
   * @param graph - The FlowGraphAST instance to set, or undefined to clear
   *
   * @remarks
   * - Allows replacement of existing graph with new instance
   * - Setting to undefined clears the graph
   * - Use with care to avoid losing graph state
   * - Typically used in testing or graph reset scenarios
   *
   * @example
   * ```typescript
   * const newGraph = new FlowGraphAST();
   * coordinator.setGraph(newGraph);
   * ```
   */
  setGraph(graph: FlowGraphAST | undefined): void {
    this.graph = graph;
  }

  /**
   * Get or create the graph instance
   *
   * Implements lazy initialization pattern. If graph doesn't exist, creates one using
   * the createGraph factory function.
   *
   * @returns The FlowGraphAST instance (always non-undefined after call)
   *
   * @remarks
   * - First call triggers graph creation via factory function
   * - Subsequent calls return existing instance
   * - Preferred way to access graph when you need guaranteed instance
   * - O(1) after first call (no repeated creation)
   *
   * @example
   * ```typescript
   * const graph = coordinator.ensureGraph();
   * graph.addNode({ id: 'node-1', data: {} });
   * ```
   */
  ensureGraph(): FlowGraphAST {
    this.graph ??= this.createGraph();
    return this.graph;
  }

  /**
   * Check if graph instance exists
   *
   * @returns true if graph has been created, false if still uninitialized
   *
   * @remarks
   * - Non-intrusive check that doesn't trigger graph creation
   * - Useful for conditional logic based on graph initialization state
   * - O(1) operation
   *
   * @example
   * ```typescript
   * if (coordinator.hasGraph()) {
   *   console.log('Graph is initialized');
   * }
   * ```
   */
  hasGraph(): boolean {
    return !!this.graph;
  }

  /**
   * Register a node entity in the graph
   *
   * Adds a node to the graph with entity metadata. Automatically extracts entity type
   * and converts entity data to JSON. Does nothing if entity already registered.
   *
   * @param entity - The node entity to register (can be undefined)
   *
   * @remarks
   * - Safe to call with undefined entity (no-op)
   * - Automatically detects entity type from type property or constructor name
   * - Gracefully handles JSON serialization errors
   * - Prevents duplicate registrations (idempotent)
   * - Creates graph if needed via ensureGraph()
   * - Stores rich metadata: entity type, ID, and serialized data
   *
   * @example
   * ```typescript
   * const nodeEntity = createNodeEntity(node);
   * coordinator.registerNode(nodeEntity);
   *
   * // Can be called multiple times safely
   * coordinator.registerNode(nodeEntity); // No-op, already registered
   *
   * // Safe to call with undefined
   * coordinator.registerNode(undefined); // No-op
   * ```
   */
  registerNode(entity: NE | undefined): void {
    if (!entity) return;
    const graph = this.ensureGraph();
    if (graph.hasNode(entity.id)) {
      return;
    }

    let entityType: string | undefined;
    const withType = entity as unknown as { type?: string };
    if (withType && typeof withType.type === "string") {
      entityType = withType.type;
    } else if (entity.constructor) {
      entityType = entity.constructor.name;
    }

    let data: Record<string, unknown> | undefined;
    if (typeof entity.toJSON === "function") {
      try {
        data = entity.toJSON();
      } catch {
        data = undefined;
      }
    }

    graph.addNode({
      id: entity.id,
      entityType,
      data,
    });
  }

  /**
   * Register an edge entity in the graph
   *
   * Adds edge connections to the graph based on the edge entity's source and target nodes.
   * Automatically registers source and target nodes if not already registered.
   * Supports multi-source and multi-target edges with port-aware connections.
   *
   * @param edgeEntity - The edge entity to register (can be undefined)
   *
   * @description
   * - Safe to call with undefined edge (no-op)
   * - Silently ignores edges without sources or targets
   * - Creates graph if needed via ensureGraph()
   * - Automatically registers source and target nodes
   * - Attaches rich link metadata including port information
   * - Gracefully handles cycle errors during attachment
   * - Supports multi-source/multi-target topologies
   *
   * @example
   * ```typescript
   * // Register edge with multiple sources and targets
   * const edgeEntity = {
   *   id: 'edge-1',
   *   edge: {
   *     sources: [{ nodeId: 'source-1', port: 'output' }],
   *     targets: [{ nodeId: 'target-1', port: 'input' }],
   *     state: 'connected',
   *   },
   * };
   * coordinator.registerEdge(edgeEntity);
   * ```
   */
  registerEdge(edgeEntity: EE | undefined): void {
    if (!edgeEntity || !edgeEntity.edge) return;
    const edge = edgeEntity.edge;
    const sources = Array.isArray(edge.sources) ? edge.sources : [];
    const targets = Array.isArray(edge.targets) ? edge.targets : [];
    if (!sources.length || !targets.length) return;

    for (const source of sources) {
      if (!source?.nodeId) continue;
      const sourceEntity = this.ensureNodeEntity(source.nodeId);
      this.registerNode(sourceEntity);

      for (const target of targets) {
        if (!target?.nodeId) continue;
        const targetEntity = this.ensureNodeEntity(target.nodeId);
        this.registerNode(targetEntity);

        const metadata: FlowLinkMetadata = {
          edgeId: edgeEntity.id,
          sourcePort: source.port,
          sourcePortIndex: source.portIndex,
          targetPort: target.port,
          targetPortIndex: target.portIndex,
          state: edge.state,
        };

        try {
          this.ensureGraph().attachChild(source.nodeId, target.nodeId, metadata);
        } catch {
          // ignore attach errors (e.g. cycles)
        }
      }
    }
  }

  /**
   * Create a direct link between two nodes
   *
   * Establishes a connection from source node to target node with optional metadata.
   * Automatically registers both nodes if not already present.
   *
   * @param sourceId - The ID of the source node
   * @param targetId - The ID of the target node
   * @param metadata - Optional FlowLinkMetadata with edge and port information
   *
   * @returns Object with success status and optional error if linking failed
   *
   * @description
   * - Validates that both source and target IDs are valid (non-empty, distinct)
   * - Returns early if IDs are invalid or node entities cannot be resolved
   * - Automatically registers nodes before linking
   * - Attempts to attach child link via ensureGraph().attachChild()
   * - Returns success status and error details for debugging
   * - Handles cycles gracefully (errors caught and returned)
   *
   * @example
   * ```typescript
   * const result = coordinator.linkNodes('node-1', 'node-2', {
   *   edgeId: 'edge-123',
   *   sourcePort: 'output',
   *   targetPort: 'input',
   *   state: 'connected',
   * });
   *
   * if (result.success) {
   *   console.log('Link created successfully');
   * } else {
   *   console.error('Link failed:', result.error);
   * }
   * ```
   */
  linkNodes(
    sourceId: string,
    targetId: string,
    metadata?: FlowLinkMetadata
  ): { success: boolean; error?: unknown } {
    if (!sourceId || !targetId || sourceId === targetId) {
      return { success: false };
    }

    const sourceEntity = this.ensureNodeEntity(sourceId);
    const targetEntity = this.ensureNodeEntity(targetId);
    if (!sourceEntity || !targetEntity) {
      return { success: false };
    }

    this.registerNode(sourceEntity);
    this.registerNode(targetEntity);

    try {
      this.ensureGraph().attachChild(sourceId, targetId, metadata);
      return { success: true };
    } catch (error) {
      return { success: false, error };
    }
  }

  /**
   * Remove a direct link between two nodes
   *
   * Removes the connection from source node to target node.
   *
   * @param sourceId - The ID of the source node
   * @param targetId - The ID of the target node
   *
   * @returns true if link was successfully removed, false if not found or invalid IDs
   *
   * @description
   * - Returns false if graph doesn't exist (no links to remove)
   * - Returns false if source or target ID is empty
   * - Delegates to graph.detachChild() for actual removal
   * - Silently fails if link doesn't exist (returns false)
   * - O(1) average operation via graph implementation
   *
   * @example
   * ```typescript
   * const removed = coordinator.unlinkNodes('node-1', 'node-2');
   * if (removed) {
   *   console.log('Link removed successfully');
   * }
   * ```
   */
  unlinkNodes(sourceId: string, targetId: string): boolean {
    if (!this.graph) return false;
    if (!sourceId || !targetId) return false;
    return this.graph.detachChild(sourceId, targetId);
  }

  /**
   * Remove a node from the graph
   *
   * Removes the specified node and all its associations from the graph.
   *
   * @param nodeId - The ID of the node to remove
   *
   * @description
   * - Safe to call even if graph doesn't exist (no-op)
   * - Removes node and associated links
   * - Does not remove entity from registry
   * - Delegates to graph.removeNode()
   *
   * @example
   * ```typescript
   * coordinator.removeNode('node-123');
   * // Node is now removed from graph topology
   * ```
   */
  removeNode(nodeId: string): void {
    this.graph?.removeNode(nodeId);
  }

  /**
   * Detach an edge from the graph
   *
   * Removes all links associated with an edge entity from the graph.
   * Handles multi-source and multi-target edges.
   *
   * @param edgeEntity - The edge entity to detach (can be undefined)
   *
   * @description
   * - Safe to call with undefined edge (no-op)
   * - Returns early if graph doesn't exist
   * - Iterates through all source-target pairs
   * - Removes links matching the edge entity ID
   * - Silently ignores missing links
   * - Does not remove edge from registry
   * - O(n*m) where n=sources and m=targets
   *
   * @example
   * ```typescript
   * coordinator.detachEdge(edgeEntity);
   * // All links associated with this edge are removed
   * ```
   */
  detachEdge(edgeEntity: EE | undefined): void {
    if (!this.graph || !edgeEntity || !edgeEntity.edge) return;
    const edge = edgeEntity.edge;
    const sources = Array.isArray(edge.sources) ? edge.sources : [];
    const targets = Array.isArray(edge.targets) ? edge.targets : [];
    for (const source of sources) {
      if (!source?.nodeId) continue;
      for (const target of targets) {
        if (!target?.nodeId) continue;
        this.detachEdgePair(source.nodeId, target.nodeId, edgeEntity.id);
      }
    }
  }

  private detachEdgePair(sourceId: string, targetId: string, edgeEntityId: string): void {
    if (!this.graph) return;
    const links = this.graph.getChildren(sourceId);
    for (const link of links) {
      if (link.targetId !== targetId) continue;
      const edgeId = link.metadata?.edgeId;
      if (!edgeId || edgeId === edgeEntityId) {
        this.graph.detachChild(sourceId, targetId);
      }
    }
  }

  /**
   * Get all root node IDs in the graph
   *
   * Returns the IDs of all nodes with no incoming edges (entry points).
   *
   * @returns Array of root node IDs, empty array if graph doesn't exist or no roots
   *
   * @description
   * - Returns empty array if graph not initialized
   * - Root nodes are nodes with no parents in the DAG
   * - Useful for starting graph traversals
   * - O(n) where n is number of nodes
   *
   * @example
   * ```typescript
   * const rootIds = coordinator.getRootNodeIds();
   * for (const id of rootIds) {
   *   coordinator.traverseFromEntity(id, (entity) => {
   *     console.log('Visiting:', entity.id);
   *   }, new Set());
   * }
   * ```
   */
  getRootNodeIds(): string[] {
    if (!this.graph) {
      return [];
    }
    return this.graph.getRoots();
  }

  /**
   * Get child node IDs for a given parent node
   *
   * Returns the IDs of all nodes that have incoming edges from the specified parent node.
   *
   * @param nodeId - The ID of the parent node
   *
   * @returns Array of child node IDs, empty array if node has no children or graph doesn't exist
   *
   * @description
   * - Returns empty array if graph not initialized
   * - Child nodes are direct dependents of the parent
   * - Returns only immediate children (not recursive descendants)
   * - O(d) where d is number of children for the node
   * - Useful for navigating graph structure
   *
   * @example
   * ```typescript
   * const children = coordinator.getChildNodeIds('parent-node');
   * for (const childId of children) {
   *   console.log('Child:', childId);
   * }
   * ```
   */
  getChildNodeIds(nodeId: string): string[] {
    if (!this.graph) {
      return [];
    }
    return this.graph.getChildren(nodeId).map((link) => link.targetId);
  }

  /**
   * Get parent node IDs for a given child node.
   *
   * @param nodeId - The ID of the child node
   * @returns Array of parent node IDs, empty array if node has no parents or graph doesn't exist
   *
   * @remarks
   * This delegates to the graph's parent index instead of scanning every node. Traversal and
   * connected-component queries call this path frequently in large graphs.
   */
  getParentNodeIds(nodeId: string): string[] {
    if (!this.graph) {
      return [];
    }
    return this.graph.getParents(nodeId);
  }

  /**
   * Traverse the graph starting from an entity using visitor pattern
   *
   * Performs depth-first traversal from the specified entity, calling visitor function
   * for each encountered entity. Automatically handles cycles via visited set.
   *
   * @param entityId - The ID of the starting entity for traversal
   * @param visitor - Function called for each visited entity; return false to stop traversal
   * @param visited - Set tracking visited entity IDs (for cycle detection)
   *
   * @returns false if visitor returned false (early termination), true if traversal completed
   *
   * @description
   * - Returns true immediately if graph doesn't exist
   * - Prevents revisiting nodes via visited set (cycle detection)
   * - Calls visitor function for each unvisited entity
   * - Visitor can return false to stop traversal early
   * - Traverses children depth-first via recursive call
   * - Automatically resolves entities via registry or custom resolver
   * - Safe to call with non-existent entity IDs (skipped silently)
   * - O(n+m) where n=entities and m=edges
   *
   * @example
   * ```typescript
   * const visited = new Set<string>();
   * const success = coordinator.traverseFromEntity('start-id', (entity) => {
   *   console.log('Visiting:', entity.id);
   *   if (entity.id === 'target-id') {
   *     return false; // Stop traversal
   *   }
   * }, visited);
   *
   * if (!success) {
   *   console.log('Traversal stopped early at target');
   * }
   * ```
   */
  traverseFromEntity(
    entityId: string,
    visitor: (entity: NE) => boolean | void,
    visited: Set<string>
  ): boolean {
    if (!this.graph) return true;
    if (visited.has(entityId)) return true;
    visited.add(entityId);

    const nodeEntity = this.ensureNodeEntity(entityId);
    if (!nodeEntity) {
      return true;
    }

    const cont = visitor(nodeEntity);
    if (cont === false) {
      return false;
    }

    const links = this.graph.getChildren(entityId);
    for (const link of links) {
      if (!this.traverseFromEntity(link.targetId, visitor, visited)) {
        return false;
      }
    }

    return true;
  }

  private isFlowNodeEntity(entity: IFlowEntity | undefined): entity is NE {
    if (!entity) return false;
    const candidate = entity as unknown as { node?: unknown };
    return candidate && typeof candidate === "object" && "node" in candidate;
  }

  private ensureNodeEntity(nodeId: string): NE | undefined {
    const existing = this.registry.getNodeEntity(nodeId);
    if (existing) {
      return existing;
    }
    const resolved = this.resolveEntity?.(nodeId);
    if (this.isFlowNodeEntity(resolved)) {
      const typed = resolved;
      this.registry.addNodeEntity(typed);
      return typed;
    }
    return undefined;
  }
}
