/**
 * Flow Management Class - High-level public API
 *
 * Provides complete flow management: entity CRUD, graph operations, traversal, serialization.
 * Delegates business logic to specialized operations modules (Node, Edge, Entity, Traversal).
 *
 * @template N - Node type (default: INode)
 * @template E - Edge type (default: IEdge)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 * @template EE - Edge entity type (default: IFlowEdgeEntity<E>)
 * @implements {IFlow<N, E, NE, EE>}
 *
 * @example
 * ```typescript
 * const entityManager = new EntityManager();
 * const flow = new Flow(entityManager, 'my-flow');
 * const node = flow.createEntity('NodeType', { label: 'Start' });
 * flow.addNode(node);
 * flow.linkNodes(node1.id, node2.id);
 * const path = flow.findPath(node1.id, node2.id);
 * const json = flow.toJSON();
 * ```
 */

import { FlowGraphAST } from "./flow-graph";
import type { EntityManager } from "../entity";
import type {
  FlowLifecycleHandler,
  FlowLinkMetadata,
  FlowMetadata,
  FlowNodeLinkOptions,
  IEdge,
  IFlow,
  IFlowAST,
  IFlowEdgeEntity,
  IFlowEntity,
  IFlowNodeEntity,
  INode,
  NodeTraversalFn,
} from "./types";
import { EntityRegistry } from "./entity-registry";
import { FlowGraphCoordinator } from "./graph-coordinator";
import { FlowHooks } from "./hooks";
import { FlowMetrics } from "./metrics";
import { FlowTraversal } from "./traversal";
import { FlowCore } from "./flow-core";
import {
  NodeOperations,
  EdgeOperations,
  EntityOperations,
  TraversalOperations,
} from "./operations";
import { HookAdapter } from "./orchestration/hook-adapter";
import { MetricsAdapter } from "./orchestration/metrics-adapter";

/**
 * High-level public API for flow management functionality.
 *
 * @template N - Node type, defaults to INode
 * @template E - Edge type, defaults to IEdge
 * @template NE - Node entity type, defaults to IFlowNodeEntity<N>
 * @template EE - Edge entity type, defaults to IFlowEdgeEntity<E>
 */
export class Flow<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> implements IFlow<N, E, NE, EE>
{
  /** Entity manager, responsible for managing the lifecycle of all entities */
  entityManager: EntityManager;

  /** Flow unique identifier */
  id: string;

  /** Flow optional name */
  name: string | undefined;

  /** Flow creation time (ISO 8601 format) */
  createdAt: string;

  /** Flow last updated time (ISO 8601 format) */
  updatedAt: string | undefined;

  /** Flow metadata */
  metadata: FlowMetadata | undefined;

  /** Flow abstract syntax tree (AST) representation */
  private _flowAST: IFlowAST<N> | undefined;

  /** Core Subsystem Coordinator */
  private readonly core: FlowCore<N, E, NE, EE>;

  // Child system references extracted from core (for quick access)
  private readonly metrics: FlowMetrics;
  private readonly hooks: FlowHooks<NE>;
  private readonly registry: EntityRegistry<N, E, NE, EE>;
  private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>;
  private readonly traversal: FlowTraversal<N, E, NE, EE>;

  // Operations layer instances (initialized in constructor)
  private readonly nodeOps: NodeOperations<N, E, NE, EE>;
  private readonly edgeOps: EdgeOperations<N, E, NE, EE>;
  private readonly entityOps: EntityOperations<N, E, NE, EE>;
  private readonly traversalOps: TraversalOperations<N, E, NE, EE>;

  /**
   * Get Flow Graph AST (Abstract Syntax Tree)
   *
   * @returns flow graph object, containing all nodes and edges information
   */
  get flowGraph(): FlowGraphAST | undefined {
    return this.graphCoordinator.getGraph();
  }

  /**
   * Set Flow Graph AST
   *
   * @param graph - New flow graph object
   */
  set flowGraph(graph: FlowGraphAST | undefined) {
    this.graphCoordinator.setGraph(graph);
  }

  /**
   * Get Flow Abstract Representation
   *
   * @returns Flow AST, for serialization or analysis
   */
  get flowAST(): IFlowAST<N> | undefined {
    return this._flowAST;
  }

  /**
   * Set Flow Abstract Representation
   *
   * @param ast - New Flow AST
   */
  set flowAST(ast: IFlowAST<N> | undefined) {
    this._flowAST = ast;
  }

  /**
   * Whether lifecycle hooks are enabled
   *
   * @description
   * When set to false, all lifecycle events will not be triggered.
   * Used for performance optimization, can disable hooks during batch operations.
   *
   * @returns whether hooks are enabled
   * @example
   * ```typescript
   * flow.enableHooks = false;
   * // Add nodes in bulk (without triggering hooks)
   * for (let i = 0; i < 1000; i++) {
   *   flow.createEntity(...);
   * }
   * flow.enableHooks = true;
   * ```
   */
  get enableHooks(): boolean {
    return this.hooks.enableHooks;
  }

  /**
   * Set whether to enable lifecycle hooks
   *
   * @param value - true enable hooks, false disable hooks
   */
  set enableHooks(value: boolean | undefined) {
    this.hooks.enableHooks = value;
  }

  /**
   * Hook Execution Depth Limit
   *
   * @description
   * Prevents performance issues caused by deep recursion. Default is 5 levels.
   * @returns maximum recursion depth for hooks
   */
  get hookDepthLimit(): number {
    return this.hooks.hookDepthLimit;
  }

  /**
   * Set hook execution depth limit
   *
   * @param value - maximum recursion depth
   */
  set hookDepthLimit(value: number | undefined) {
    this.hooks.hookDepthLimit = value;
  }

  /**
   * Entity Added Event Handler
   *
   * @description
   * triggered when creating and adding new entities.
   * @returns handler function for entity added events
   * @example
   * ```typescript
   * flow.onEntityAdded = (entity) => {
   *   console.log('New entity:', entity.id);
   * };
   * ```
   */
  get onEntityAdded(): FlowLifecycleHandler<NE> | undefined {
    return this.hooks.onEntityAdded;
  }

  /**
   * Set entity added event handler
   *
   * @param handler - handler function
   */
  set onEntityAdded(handler: FlowLifecycleHandler<NE> | undefined) {
    this.hooks.onEntityAdded = handler;
  }

  /**
   * Entity Removed Event Handler
   *
   * @description
   * triggered when deleting entities. parameter passed is the ID of the deleted entity.
   * @returns handler function for entity removed events
   */
  get onEntityRemoved(): FlowLifecycleHandler<string> | undefined {
    return this.hooks.onEntityRemoved;
  }

  /**
   * Set entity removed event handler
   *
   * @param handler - handler function
   */
  set onEntityRemoved(handler: FlowLifecycleHandler<string> | undefined) {
    this.hooks.onEntityRemoved = handler;
  }

  /**
   * Flow Loaded Event Handler
   *
   * @description
   * triggered after calling loadFromJSON.
   * @returns handler function for flow loaded events
   */
  get onFlowLoaded(): FlowLifecycleHandler<Record<string, unknown>> | undefined {
    return this.hooks.onFlowLoaded;
  }

  /**
   * Set flow loaded event handler
   *
   * @param handler - handler function
   */
  set onFlowLoaded(handler: FlowLifecycleHandler<Record<string, unknown>> | undefined) {
    this.hooks.onFlowLoaded = handler;
  }

  /**
   * Flow Saved Event Handler
   *
   * @description
   * triggered after calling toJSON.
   * @returns handler function for flow saved events
   */
  get onFlowSaved(): FlowLifecycleHandler<void> | undefined {
    return this.hooks.onFlowSaved;
  }

  /**
   * Set flow saved event handler
   *
   * @param handler - handler function
   */
  set onFlowSaved(handler: FlowLifecycleHandler<void> | undefined) {
    this.hooks.onFlowSaved = handler;
  }

  /**
   * Constructor
   *
   * Create a new Flow instance, initializing all internal subsystems.
   *
   * @param entityManager - Entity manager instance, responsible for managing entity lifecycle
   * @param id - flow ID (optional). if not provided, automatically generate `flow-{timestamp}`
   *
   * @example
   * ```typescript
   * // Create flow with default ID
   * const flow1 = new Flow(entityManager);
   *
   * // Create flow with custom ID
   * const flow2 = new Flow(entityManager, 'my-workflow');
   * ```
   */
  constructor(entityManager: EntityManager, id?: string) {
    this.entityManager = entityManager;
    this.id = id || `flow-${Date.now()}`;
    this.createdAt = new Date().toISOString();
    this.core = new FlowCore<N, E, NE, EE>({
      entityManager,
      state: this,
      isNodeEntity: (entity): entity is NE => this.isNodeEntity(entity),
      isEdgeEntity: (entity): entity is EE => this.isEdgeEntity(entity),
      resolveEntity: (entityId) => this.getEntity(entityId),
      createGraph: () => new FlowGraphAST(),
    });
    this.hooks = this.core.getHooks();
    this.registry = this.core.getEntityRegistry();
    this.graphCoordinator = this.core.getGraphCoordinator();
    this.traversal = this.core.getTraversal();
    this.metrics = this.core.getMetrics();
    this._flowAST = undefined;
    this.enableHooks = true;
    this.hookDepthLimit = 5;

    // Initialize operations layer instances
    const hookAdapter = new HookAdapter<NE>(this.hooks);
    const metricsAdapter = new MetricsAdapter(this.metrics);

    this.nodeOps = new NodeOperations(
      this.registry,
      this.graphCoordinator,
      hookAdapter,
      metricsAdapter
    );
    this.edgeOps = new EdgeOperations(
      this.registry,
      this.graphCoordinator,
      hookAdapter,
      metricsAdapter
    );
    this.entityOps = new EntityOperations(this.registry, hookAdapter, metricsAdapter);
    this.traversalOps = new TraversalOperations(
      this.traversal,
      this.graphCoordinator,
      this.registry,
      metricsAdapter
    );
  }

  /**
   * Type guard: Check if entity is a node entity
   *
   * @internal
   * @param entity - Entity object to check
   * @returns True if entity implements IFlowNodeEntity interface (has node property)
   */
  private isNodeEntity(entity: unknown): entity is NE {
    return !!entity && typeof entity === "object" && "node" in (entity as Record<string, unknown>);
  }

  /**
   * Type guard: Check if entity is an edge entity
   *
   * @internal
   * @param entity - Entity object to check
   * @returns True if entity implements IFlowEdgeEntity interface (has edge property)
   */
  private isEdgeEntity(entity: unknown): entity is EE {
    return !!entity && typeof entity === "object" && "edge" in (entity as Record<string, unknown>);
  }

  /**
   * Traverse all nodes in the flow graph
   *
   * using depth-first search (DFS) algorithm Traverse the flow graph, starting from specified node or from root node.
   * provided callback is called for each node.
   *
   * @param f - traversal callback function, executed for each node
   * @param node - start node (optional). if not provided, starts from root node
   * @param _depth - internal parameter, for backward compatibility (deprecated)
   *
   * @example
   * ```typescript
   * // Print all nodes
   * flow.traverse((node) => {
   *   console.log('Node:', node);
   * });
   *
   * // Traverse starting from specific node
   * const startNode = flow.getNode('node-1');
   * if (startNode) {
   *   flow.traverse((node) => {
   *     console.log('Child node:', node);
   *   }, startNode);
   * }
   *
   * // Collect all nodes
   * const allNodes: N[] = [];
   * flow.traverse((node) => {
   *   allNodes.push(node);
   * });
   * ```
   *
   * @see {@link getAllNodes} directly get all nodes array
   * @see {@link FlowTraversal.traverse} Low-level traversal implementation
   */
  traverse(f: NodeTraversalFn<N>, node?: N, _depth?: number): void {
    if (typeof _depth === "number") {
      // depth parameter is currently only for backward compatibility
    }
    const start = performance.now();
    try {
      this.traversal.traverse(f, node);
    } finally {
      const dur = performance.now() - start;
      this.metrics.recordTraversal(dur);
    }
  }

  /**
   * Add Child node to target node
   *
   * establish parent-child relationship between two nodes.
   *
   * @param targetNode - parent node
   * @param childNode - child node to add
   * @returns whether successfully added (false if either node does not exist)
   *
   * @example
   * ```typescript
   * const parent = flow.getNode('parent-id');
   * const child = flow.getNode('child-id');
   * if (parent && child) {
   *   const success = flow.addToNode(parent, child);
   * }
   * ```
   *
   * @see {@link linkNodes} for node linking with existing IDs
   * @see {@link addNode} Add node to flow
   */
  addToNode(targetNode: N, childNode: N): boolean {
    const parentEntity = this.findEntityByNode(targetNode);
    const childEntity = this.findEntityByNode(childNode);
    if (!parentEntity || !childEntity) return false;
    this.graphCoordinator.registerNode(parentEntity);
    this.graphCoordinator.registerNode(childEntity);
    const { success } = this.graphCoordinator.linkNodes(parentEntity.id, childEntity.id);
    if (success) this.updatedAt = new Date().toISOString();
    return success;
  }

  /**
   * Remove specified node from flow
   *
   * @param id - Node entity ID
   * @returns True if removed, false if not found
   *
   * @see {@link removeEntity} remove any entity type
   */
  removeNode(id: string): boolean {
    const ok = this.nodeOps.removeNode(id);
    if (ok) this.updatedAt = new Date().toISOString();
    return ok;
  }

  /**
   * Get specified node data
   *
   * @param id - Node entity ID
   * @returns Node data, undefined if not found
   */
  getNode(id: string): N | undefined {
    const entity = this.getEntity(id);
    return entity?.node;
  }

  /**
   * Get all node data in flow
   *
   * @returns Array of all nodes
   */
  getAllNodes(): N[] {
    return this.getAllEntities().map((e) => e.node);
  }

  /**
   * Check if node exists in flow
   *
   * @param node - Node data to check
   * @returns True if node exists
   */
  hasNode(node: N): boolean {
    return this.getAllNodes().includes(node);
  }

  /**
   * Create new entity (node or edge)
   *
   * Creates entity via EntityManager, triggers onEntityAdded hook,
   * registers node in graph if applicable, records metrics.
   *
   * @template T - Entity type (default: NE)
   * @param type - Entity type identifier
   * @param args - Constructor arguments (optional)
   * @returns Created entity
   * @throws If hook returns false or creation fails
   *
   * @example
   * ```typescript
   * const entity = flow.createEntity('NodeType', { label: 'New Node' });
   * ```
   *
   * @see {@link createEdgeEntity} Create edge entity
   * @see {@link addNode} Add node to flow
   */
  createEntity<T extends NE = NE>(type: string, args?: Record<string, unknown>): T {
    const start = performance.now();
    const entity = this.entityManager.createEntity(type, args) as T;
    if (!this.hooks.runEntityAdded(entity as NE)) {
      this.entityManager.removeEntity((entity as { id: string }).id);
      throw new Error("Entity creation cancelled by hook");
    }
    const maybeNode = (entity as unknown as Partial<NE>)?.node;
    if (maybeNode) this.addNode(entity as NE);
    this.metrics.recordEntityCreated(type, performance.now() - start);
    this.updatedAt = new Date().toISOString();
    return entity;
  }

  /**
   * Create edge entity (connections)
   *
   * create edge entity representing connection between two nodes. Edge entity automatically register to graph.
   * method performs type validation to ensure created entity implements IFlowEdgeEntity interface.
   *
   * @template T - edge entity type, defaults to EE (Edge entity)
   * @param type - edge entity type identifier
   * @param args - parameters for edge Constructor (optional)
   * @returns newly created edge entity
   * @throws if creation failed or entity does not implement IFlowEdgeEntity interface
   *
   * @example
   * ```typescript
   * const edge = flow.createEdgeEntity('LinkType', { label: 'connects to' });
   * ```
   *
   * @see {@link createEntity} Create generic entity
   * @see {@link linkNodes} Link two nodes
   * @see {@link addEdgeEntity} Add already created edge to flow
   */
  createEdgeEntity<T extends EE = EE>(type: string, args?: Record<string, unknown>): T {
    const created = this.entityManager.createEntity(type, args);
    if (!created || !this.isEdgeEntity(created)) {
      if (created) this.entityManager.removeEntity((created as { id: string }).id);
      throw new Error(`Entity of type ${type} does not implement IFlowEdgeEntity`);
    }
    this.edgeOps.addEdge(created);
    this.metrics.recordEdgeEntityCreated(type, 0);
    this.updatedAt = new Date().toISOString();
    return created as T;
  }

  /**
   * Get specified entity
   *
   * Get entity by specified ID. Returns associated entity object.
   * This operation records performance metrics.
   *
   * @template T - Entity type to retrieve (defaults to node entity type)
   * @param id - entity ID
   * @returns found entity, returns undefined if does not exist
   *
   * @example
   * ```typescript
   * // Get generic entity
   * const entity = flow.getEntity('entity-1');
   *
   * // Get entity of specific type
   * const nodeEntity = flow.getEntity<IFlowNodeEntity>('node-1');
   * ```
   *
   * @see {@link getNode} Get node data
   * @see {@link getEdgeEntity} Get edge entity
   */
  public getEntity<T extends IFlowEntity = NE>(id: string): T | undefined {
    return this.entityOps.getEntity<T>(id);
  }

  /**
   * Remove specified entity
   *
   * Deletes the entity with given ID. Automatically handles removal logic based on entity type:
   * - Node entity: remove node from graph
   * - Edge entity: remove connection from graph
   *
   * @param id - entity ID
   * @returns whether successfully removed (false if does not exist or removal failed)
   *
   * @example
   * ```typescript
   * const removed = flow.removeEntity('entity-1');
   * ```
   *
   * @see {@link removeNode} specifically remove node
   * @see {@link removeEdgeEntity} specifically remove edge
   */
  removeEntity(id: string): boolean {
    const entity = this.getEntity(id);
    if (!entity) return false;
    let removed = false;
    if (this.isNodeEntity(entity)) {
      removed = this.registry.removeNodeEntity(entity);
      if (removed) this.graphCoordinator.removeNode(id);
    } else if (this.isEdgeEntity(entity)) {
      const { removed: edgeRemoved } = this.registry.removeEdgeEntity(id, (edge: EE) => {
        this.graphCoordinator.detachEdge(edge);
      });
      removed = edgeRemoved;
    } else {
      removed = this.registry.removeEntity(id);
    }
    if (removed) {
      this.metrics.recordEntityRemoved();
      this.updatedAt = new Date().toISOString();
    }
    return removed;
  }

  /**
   * Update single entity
   *
   * Update existing entity with provided data. This operation records performance metrics.
   *
   * @param entity - entity object containing update data
   * @returns whether successfully updated
   *
   * @example
   * ```typescript
   * const entity = flow.getEntity<IFlowNodeEntity>('node-1');
   * if (entity) {
   *   entity.node.label = 'Updated Label';
   *   const success = flow.updateEntity(entity);
   *   console.log('Updated:', success);
   * }
   * ```
   *
   * @see {@link batchUpdateEntity} Batch update multiple entities
   */
  updateEntity(entity: NE): boolean {
    const start = performance.now();
    const ok = this.entityManager.updateEntity(entity);
    const dur = performance.now() - start;
    this.metrics.recordEntityUpdate(dur, ok);
    if (ok) this.updatedAt = new Date().toISOString();
    return ok;
  }

  /**
   * Batch update multiple entities
   *
   * update multiple entities at once, more efficient than calling updateEntity individually.
   * Suitable for scenarios needing to modify multiple entities simultaneously (e.g., performance optimization).
   *
   * @param entities - array of entities to update
   * @returns number of entities successfully updated
   *
   * @example
   * ```typescript
   * const entities = flow.getAllEntities();
   * // update certain property of all entities
   * entities.forEach(e => {
   *   e.metadata = { updated: true };
   * });
   * const count = flow.batchUpdateEntity(entities);
   * console.log(`Updated ${count} entities`);
   * ```
   *
   * @see {@link updateEntity} Update single entity
   */
  batchUpdateEntity(entities: NE[]): number {
    const start = performance.now();
    const n = this.entityManager.batchUpdateEntity(entities);
    const dur = performance.now() - start;
    this.metrics.recordEntityBatchUpdate(entities.length, dur);
    if (n > 0) this.updatedAt = new Date().toISOString();
    return n;
  }

  /**
   * Get root entity
   *
   * return root entity of flow graph (typically top-level entity without parent node).
   * If flow is tree structure, this returns the root node entity.
   *
   * @returns root entity, returns undefined if not found
   *
   * @example
   * ```typescript
   * const root = flow.getRootEntity();
   * if (root) {
   *   console.log('Root entity:', root.id);
   * }
   * ```
   *
   * @see {@link getChildEntities} Get child entities of specified entity
   * @see {@link traverse} Traverse entire flow
   */
  getRootEntity(): NE | undefined {
    return this.traversal.getRootEntity();
  }

  /**
   * Get child entities of specified entity
   *
   * Return array of direct child entities (first-level child nodes, non-recursive).
   * For tree structure, this returns direct child nodes. For graph structure, returns all direct downstream nodes.
   *
   * @param entity - Parent entity
   * @returns array of child entities
   *
   * @example
   * ```typescript
   * const parent = flow.getEntity<IFlowNodeEntity>('parent-id');
   * if (parent) {
   *   const children = flow.getChildEntities(parent);
   *   console.log(`Children count: ${children.length}`);
   *   children.forEach(child => {
   *     console.log('Child:', child.id);
   *   });
   * }
   * ```
   *
   * @see {@link getRootEntity} Get root entity
   * @see {@link traverse} recursively traverse all descendants
   */
  getChildEntities(entity: NE): NE[] {
    return this.traversal.getChildEntities(entity);
  }

  /**
   * Get all entities in flow
   *
   * Return array of all node entities in the flow. Edge entities can be obtained separately via getAllEdgeEntities.
   * method ensures all entities are registered in graph coordinator.
   *
   * @returns Array of all node entities
   *
   * @example
   * ```typescript
   * const allEntities = flow.getAllEntities();
   * console.log(`Total entities: ${allEntities.length}`);
   *
   * // Iterate over each entity
   * allEntities.forEach(entity => {
   *   console.log('Entity:', entity.id, entity.node);
   * });
   * ```
   *
   * @see {@link getAllNodes} Get all node data
   * @see {@link getAllEdgeEntities} Get all edge entities
   * @see {@link traverse} Traverse using callback
   */
  public getAllEntities(): NE[] {
    const entities = this.entityOps.getAllEntities();
    for (const entity of entities) {
      this.graphCoordinator.registerNode(entity);
    }
    return entities;
  }

  // ============================================================================
  // Traversal Operations
  // ============================================================================

  /**
   * Get successor nodes (direct children)
   *
   * Return all direct successor node IDs of the specified node.
   *
   * @param nodeId - Node ID
   * @returns Array of successor node IDs
   *
   * @example
   * ```typescript
   * const successors = flow.getSuccessors('node-1');
   * console.log('Direct children:', successors);
   * ```
   *
   * @see {@link getPredecessors} Get predecessor nodes
   * @see {@link getNeighbors} Get neighboring nodes
   */
  public getSuccessors(nodeId: string): string[] {
    return this.traversalOps.getSuccessors(nodeId);
  }

  /**
   * Get predecessor nodes (direct parents)
   *
   * Return all direct predecessor node IDs of the specified node.
   *
   * @param nodeId - Node ID
   * @returns Array of predecessor node IDs
   *
   * @example
   * ```typescript
   * const predecessors = flow.getPredecessors('node-2');
   * console.log('Direct parents:', predecessors);
   * ```
   *
   * @see {@link getSuccessors} Get successor nodes
   * @see {@link getNeighbors} Get neighboring nodes
   */
  public getPredecessors(nodeId: string): string[] {
    return this.traversalOps.getPredecessors(nodeId);
  }

  /**
   * Get neighboring nodes (both predecessors and successors)
   *
   * Return all neighboring node IDs of the specified node (including predecessors and successors).
   *
   * @param nodeId - Node ID
   * @returns Array of neighboring node IDs
   *
   * @example
   * ```typescript
   * const neighbors = flow.getNeighbors('node-1');
   * console.log('All adjacent nodes:', neighbors);
   * ```
   *
   * @see {@link getSuccessors} Get successor nodes
   * @see {@link getPredecessors} Get predecessor nodes
   */
  public getNeighbors(nodeId: string): string[] {
    return this.traversalOps.getNeighbors(nodeId);
  }

  /**
   * Find a path between two nodes using BFS
   *
   * Find shortest path from source node to target node using breadth-first search algorithm.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Array of node IDs representing the path, or null if no path exists
   *
   * @example
   * ```typescript
   * const path = flow.findPath('node-1', 'node-5');
   * if (path) {
   *   console.log('Path found:', path);
   * } else {
   *   console.log('No path exists');
   * }
   * ```
   *
   * @see {@link findAllPaths} Find all possible paths
   * @see {@link isConnected} Check connectivity
   */
  public findPath(sourceId: string, targetId: string): string[] | null {
    return this.traversalOps.findPath(sourceId, targetId);
  }

  /**
   * Find all paths between two nodes using DFS
   *
   * Find all possible paths from source node to target node using depth-first search algorithm.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Array of arrays of node IDs representing all paths
   *
   * @example
   * ```typescript
   * const allPaths = flow.findAllPaths('node-1', 'node-5');
   * console.log(`Found ${allPaths.length} paths`);
   * allPaths.forEach((path, index) => {
   *   console.log(`Path ${index + 1}:`, path);
   * });
   * ```
   *
   * @see {@link findPath} Find shortest path
   * @see {@link isConnected} Check connectivity
   */
  public findAllPaths(sourceId: string, targetId: string): string[][] {
    return this.traversalOps.findAllPaths(sourceId, targetId);
  }

  /**
   * Check if two nodes are connected
   *
   * Check if a path exists between two nodes.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns True if there is a path between the nodes, false otherwise
   *
   * @example
   * ```typescript
   * if (flow.isConnected('node-1', 'node-5')) {
   *   console.log('Nodes are connected');
   * } else {
   *   console.log('Nodes are not connected');
   * }
   * ```
   *
   * @see {@link findPath} Find path
   * @see {@link getConnectedComponents} Get connected components
   */
  public isConnected(sourceId: string, targetId: string): boolean {
    return this.traversalOps.isConnected(sourceId, targetId);
  }

  /**
   * Get connected components in the graph
   *
   * Get all connected components in the graph (each connected component is a set of mutually connected nodes).
   *
   * @returns Array of arrays of node IDs representing connected components
   *
   * @example
   * ```typescript
   * const components = flow.getConnectedComponents();
   * console.log(`Graph has ${components.length} connected components`);
   * components.forEach((component, index) => {
   *   console.log(`Component ${index + 1}:`, component);
   * });
   * ```
   *
   * @see {@link isConnected} Check connectivity between two nodes
   * @see {@link topologicalSort} Topological sort
   */
  public getConnectedComponents(): string[][] {
    return this.traversalOps.getConnectedComponents();
  }

  /**
   * Get topological sort of nodes
   *
   * Perform topological sort on graph nodes using Kahn's algorithm.
   * Returns null if cycle is detected in the graph.
   *
   * @returns Array of node IDs in topological order, or null if cycle exists
   *
   * @example
   * ```typescript
   * const sorted = flow.topologicalSort();
   * if (sorted) {
   *   console.log('Topological order:', sorted);
   * } else {
   *   console.log('Graph contains a cycle');
   * }
   * ```
   *
   * @see {@link getConnectedComponents} Get connected components
   * @see {@link dfs} Depth-first traversal
   */
  public topologicalSort(): string[] | null {
    return this.traversalOps.topologicalSort();
  }

  /**
   * Depth-first search traversal
   *
   * Perform depth-first search traversal starting from specified node. Visitor callback can return false to stop traversal.
   *
   * @param startId - Starting node ID
   * @param visitor - Callback function for each node visited; return false to stop
   * @returns void
   *
   * @example
   * ```typescript
   * flow.dfs('node-1', (nodeId) => {
   *   console.log('Visiting node:', nodeId);
   *   // Return false to stop traversal
   *   return true;
   * });
   * ```
   *
   * @see {@link bfs} Breadth-first traversal
   * @see {@link traverse} Generic traversal method
   */
  public dfs(startId: string, visitor: (nodeId: string) => boolean | void): void {
    return this.traversalOps.dfs(startId, visitor);
  }

  /**
   * Breadth-first search traversal
   *
   * Perform breadth-first search traversal starting from specified node. Visitor callback can return false to stop traversal.
   *
   * @param startId - Starting node ID
   * @param visitor - Callback function for each node visited; return false to stop
   * @returns void
   *
   * @example
   * ```typescript
   * flow.bfs('node-1', (nodeId) => {
   *   console.log('Visiting node:', nodeId);
   *   // Return false to stop traversal
   *   return true;
   * });
   * ```
   *
   * @see {@link dfs} Depth-first traversal
   * @see {@link traverse} Generic traversal method
   */
  public bfs(startId: string, visitor: (nodeId: string) => boolean | void): void {
    return this.traversalOps.bfs(startId, visitor);
  }

  /**
   * Serialize the flow to JSON
   *
   * convert all flow data (nodes, edges, metadata) to JSON object format.
   * Generated JSON can be saved, transmitted, or restored with loadFromJSON.
   *
   * @returns JSON object containing all flow data
   *
   * @example
   * ```typescript
   * // Serialize the flow
   * const json = flow.toJSON();
   *
   * // Save to local storage
   * localStorage.setItem('my-flow', JSON.stringify(json));
   *
   * // Serialize and send to server
   * await fetch('/api/flows', {
   *   method: 'POST',
   *   headers: { 'Content-Type': 'application/json' },
   *   body: JSON.stringify(json)
   * });
   * ```
   *
   * @see {@link loadFromJSON} Restore flow from JSON
   * @see {@link onFlowSaved} Serialization completion event
   */
  toJSON(): Record<string, unknown> {
    return this.core.getFlowSerializer().toJSON();
  }

  /**
   * Load flow data from JSON
   *
   * populate flow with provided JSON data. clears existing data and loads new data.
   * Trigger onFlowLoaded hook after loading completes.
   *
   * @param json - JSON object containing flow data
   * @throws if JSON format is incorrect or contains invalid data
   *
   * @example
   * ```typescript
   * // Restore from local storage
   * const saved = localStorage.getItem('my-flow');
   * if (saved) {
   *   const json = JSON.parse(saved);
   *   flow.loadFromJSON(json);
   * }
   *
   * // Load from server
   * const response = await fetch('/api/flows/flow-1');
   * const json = await response.json();
   * flow.loadFromJSON(json);
   * ```
   *
   * @see {@link toJSON} Serialize the flow
   * @see {@link onFlowLoaded} Load completion event
   */
  loadFromJSON(json: Record<string, unknown>): void {
    this.core.getFlowSerializer().loadFromJSON(json);
  }

  /**
   * Clean up flow resources
   *
   * Release all resources occupied by flow, including performance metrics collector, etc.
   * flow instance should not be used after calling.
   *
   * @example
   * ```typescript
   * // Clean up flow resources
   * flow.dispose();
   * // Should not use flow instance anymore after this
   * ```
   *
   * @see {@link constructor} Create flow instance
   */
  dispose(): void {
    // Clean up resources
    this.metrics.markFlowDisposed();
    this.metrics.dispose();
  }

  /**
   * Add node to flow
   *
   * Add node entity to flow, can specify parent node to establish tree/graph structure.
   * Supports specifying multiple parent nodes and custom link metadata.
   *
   * @param entity - Node entity to add
   * @param options - node options (optional)
   * @param options.parentIds - Parent node ID array
   * @param options.linkMetadata - link metadata object or generation function
   *
   * @example
   * ```typescript
   * // Add root node
   * const root = flow.createEntity<IFlowNodeEntity>('RootNode', {
   *   label: 'Root'
   * });
   * flow.addNode(root);
   *
   * // Add child node
   * const child = flow.createEntity<IFlowNodeEntity>('ChildNode', {
   *   label: 'Child'
   * });
   * flow.addNode(child, {
   *   parentIds: [root.id],
   *   linkMetadata: { type: 'parent-child' }
   * });
   *
   * // Use function to generate link metadata
   * flow.addNode(child, {
   *   parentIds: [root.id],
   *   linkMetadata: (parentId, childId) => ({
   *     source: parentId,
   *     target: childId,
   *     type: 'flow'
   *   })
   * });
   * ```
   *
   * @see {@link createEntity} Create a node entity
   * @see {@link linkNodes} Link two existing nodes
   */
  public addNode(entity: NE, options?: FlowNodeLinkOptions): void {
    this.nodeOps.addNode(entity, options);
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get all edge entities in flow
   *
   * Return array of all edge entities (connections) in the flow. These are connections established between nodes.
   * method ensures all edges are registered in graph coordinator.
   *
   * @returns Array of all edge entities
   *
   * @example
   * ```typescript
   * const edges = flow.getAllEdgeEntities();
   * console.log(`Total edges: ${edges.length}`);
   *
   * // Check edges
   * edges.forEach(edge => {
   *   console.log(`Edge: ${edge.id}`, edge.edge);
   * });
   * ```
   *
   * @see {@link getAllEntities} Get all node entities
   * @see {@link linkNodes} Create connections between nodes
   * @see {@link addEdgeEntity} Add edge entity
   */
  public getAllEdgeEntities(): EE[] {
    return this.entityOps.getAllEdgeEntities();
  }

  /**
   * Add edge entity to flow
   *
   * Add edge entity (connection object) to flow and register in graph.
   * Edge entity should already contain references to source and target nodes before adding.
   *
   * @param edge - Edge entity to add
   * @returns whether successfully added (returns false if parameter is empty)
   *
   * @example
   * ```typescript
   * const edge = flow.createEdgeEntity<IFlowEdgeEntity>('LinkType', {
   *   sourceId: 'node-1',
   *   targetId: 'node-2',
   *   label: 'connects'
   * });
   *
   * const success = flow.addEdgeEntity(edge);
   * console.log('Edge added:', success);
   * ```
   *
   * @see {@link createEdgeEntity} Create edge entity
   * @see {@link linkNodes} Directly link two nodes
   */
  public addEdgeEntity(edge: EE): boolean {
    const result = this.edgeOps.addEdge(edge);
    if (result) {
      this.updatedAt = new Date().toISOString();
    }
    return result;
  }

  /**
   * Link two nodes
   *
   * Create connections (edges) between two nodes. Both nodes must exist for successful linking.
   * Link operation will be validated and registered through the graph coordinator.
   *
   * @param sourceId - Source node entity ID
   * @param targetId - Target node entity ID
   * @param metadata - link metadata (optional)
   * @returns whether successfully linked
   *
   * @example
   * ```typescript
   * // Create two nodes
   * const node1 = flow.createEntity<IFlowNodeEntity>('NodeType', { label: 'Start' });
   * const node2 = flow.createEntity<IFlowNodeEntity>('NodeType', { label: 'End' });
   *
   * flow.addNode(node1);
   * flow.addNode(node2);
   *
   * // Link two nodes
   * const success = flow.linkNodes(node1.id, node2.id, {
   *   type: 'flow',
   *   label: 'transitions to'
   * });
   *
   * if (success) {
   *   console.log('Nodes linked successfully');
   * }
   * ```
   *
   * @see {@link unlinkNodes} remove link
   * @see {@link addNode} Add node and establish links simultaneously
   * @see {@link createEdgeEntity} Create custom edge entity
   */
  public linkNodes(sourceId: string, targetId: string, metadata?: FlowLinkMetadata): boolean {
    const result = this.nodeOps.linkNodes(sourceId, targetId, {
      parentIds: undefined,
      linkMetadata: metadata,
    });
    if (result) {
      this.updatedAt = new Date().toISOString();
    }
    return result;
  }

  /**
   * remove link between two nodes
   *
   * Remove connections between source and target nodes. If node ID is invalid or link does not exist, returns false.
   *
   * @param sourceId - Source node entity ID
   * @param targetId - Target node entity ID
   * @returns Whether successfully removed (returns false if node does not exist or link does not exist)
   *
   * @example
   * ```typescript
   * const node1 = flow.getEntity<IFlowNodeEntity>('node-1');
   * const node2 = flow.getEntity<IFlowNodeEntity>('node-2');
   *
   * if (node1 && node2) {
   *   const removed = flow.unlinkNodes(node1.id, node2.id);
   *   console.log('Link removed:', removed);
   * }
   * ```
   *
   * @see {@link linkNodes} Create link
   * @see {@link removeEdgeEntity} Remove edge entity
   */
  public unlinkNodes(sourceId: string, targetId: string): boolean {
    const detached = this.graphCoordinator.unlinkNodes(sourceId, targetId);
    if (detached) {
      this.metrics.recordGraphLinkRemoved();
      this.updatedAt = new Date().toISOString();
    }
    return detached;
  }

  /**
   * Remove edge entity
   *
   * Delete specified edge entity from flow and its related graph connections.
   *
   * @param edgeId - Edge entity ID
   * @returns Whether successfully removed (returns false if not exists)
   *
   * @example
   * ```typescript
   * const edge = flow.getEdgeEntity('edge-1');
   * if (edge) {
   *   const removed = flow.removeEdgeEntity(edge.id);
   *   console.log('Edge removed:', removed);
   * }
   * ```
   *
   * @see {@link addEdgeEntity} Add edge entity
   * @see {@link unlinkNodes} remove link between two nodes
   */
  public removeEdgeEntity(edgeId: string): boolean {
    const result = this.edgeOps.removeEdge(edgeId);
    if (result) {
      this.metrics.recordEdgeEntityRemoved();
      this.updatedAt = new Date().toISOString();
    }
    return result;
  }

  /**
   * Get specified edge entity
   *
   * Retrieve edge entity from registry by edge entity ID.
   *
   * @param edgeId - Edge entity ID
   * @returns Found edge entity, returns undefined if it does not exist or ID is empty
   *
   * @example
   * ```typescript
   * const edge = flow.getEdgeEntity('edge-1');
   * if (edge) {
   *   console.log('Edge data:', edge.edge);
   *   console.log('Edge id:', edge.id);
   * }
   * ```
   *
   * @see {@link createEdgeEntity} Create edge entity
   * @see {@link getAllEdgeEntities} Get all edge entities
   */
  public getEdgeEntity(edgeId: string): EE | undefined {
    return this.edgeOps.getEdge(edgeId);
  }

  /**
   * Find entity corresponding to node data
   *
   * Find and return corresponding node entity by node object. For reverse lookup from node data.
   *
   * @param node - Node data
   * @returns Corresponding node entity, returns undefined if not found
   *
   * @example
   * ```typescript
   * const node = flow.getNode('node-1');
   * if (node) {
   *   const entity = flow.findEntityByNode(node);
   *   console.log('Entity id:', entity?.id);
   * }
   * ```
   *
   * @see {@link getNode} Get node by ID
   * @see {@link attachEntityToNode} Attach entity to node
   */
  public findEntityByNode(node: N): NE | undefined {
    return this.registry.findNodeEntityByNode(node);
  }

  /**
   * Attach entity to node
   *
   * Internal method: Associate node entity with node object.
   * method is typically used internally, not recommended to call directly.
   *
   * @internal
   * @param _node - Node object (parameter name prefix _ indicates unused)
   * @param entity - Node entity to attach
   *
   * @see {@link findEntityByNode} Get entity corresponding to node
   */
  attachEntityToNode(_node: N, entity: NE): void {
    this.registry.addNodeEntity(entity);
    this.graphCoordinator.registerNode(entity);
  }
}
