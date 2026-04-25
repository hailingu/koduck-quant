/**
 * Entity Registry Module
 *
 * This module provides entity registry management for the Flow system,
 * maintaining synchronized node and edge entities with the EntityManager.
 *
 * Main responsibilities:
 * - Register and track node entities with dual indexing (by node and by ID)
 * - Register and track edge entities for connection management
 * - Provide fast lookup paths for entities
 * - Maintain cache coherency with EntityManager
 *
 * Design patterns:
 * - **Caching Strategy**: Dual indexing for O(1) lookups (node-based and ID-based)
 * - **Lazy Loading**: Entities loaded on-demand from EntityManager
 * - **Cache Invalidation**: Automatic cleanup of stale entries
 * - **Type Safety**: Generic type guards for node and edge entities
 *
 * @module EntityRegistry
 *
 * @example
 * ```typescript
 * // Create registry with type guards
 * const registry = new EntityRegistry(entityManager, {
 *   isNodeEntity: (e): e is IFlowNodeEntity => e instanceof FlowNodeEntity,
 *   isEdgeEntity: (e): e is IFlowEdgeEntity => e instanceof FlowEdgeEntity,
 * });
 *
 * // Register node entity
 * const nodeEntity = createNodeEntity(...);
 * registry.addNodeEntity(nodeEntity);
 *
 * // Fast lookup by ID
 * const found = registry.getNodeEntity('node-123');
 *
 * // List all entities
 * const allNodes = registry.listNodeEntities();
 * const allEdges = registry.listEdgeEntities();
 * ```
 */

import type { EntityManager } from "../entity";
import type { IEdge, IFlowEdgeEntity, IFlowNodeEntity, INode, OptionalProp } from "./types";

/**
 * Type guard functions for differentiating entity types
 *
 * @template NE - Node entity type
 * @template EE - Edge entity type
 */
type EntityTypeGuards<NE extends IFlowNodeEntity, EE extends IFlowEdgeEntity> = {
  /** Type guard function to check if entity is a node entity */
  isNodeEntity(entity: unknown): entity is NE;
  /** Type guard function to check if entity is an edge entity */
  isEdgeEntity(entity: unknown): entity is EE;
};

/**
 * Entity Registry - Central registry for flow entities
 *
 * Maintains synchronization between node/edge entities and the underlying EntityManager.
 * Uses dual indexing strategy for optimal lookup performance:
 * - Node-to-entity index: Maps node objects to their corresponding entities
 * - ID-to-entity index: Maps entity IDs to entities for direct lookups
 *
 * This dual approach provides O(1) access for both node-based and ID-based queries.
 *
 * Design features:
 * - **Dual Indexing**: Fast lookups by both node reference and entity ID
 * - **Lazy Caching**: Entities cached on first access
 * - **Automatic Cleanup**: Stale cache entries removed during list operations
 * - **Generic Type Safety**: Full type safety with template parameters
 *
 * @template N - Node type (default: INode)
 * @template E - Edge type (default: IEdge)
 * @template NE - Node entity type (default: IFlowNodeEntity<N>)
 * @template EE - Edge entity type (default: IFlowEdgeEntity<E>)
 *
 * @example
 * ```typescript
 * // Single node entity operations
 * const entity = registry.getNodeEntity('node-123');
 *
 * // Batch operations
 * const allNodes = registry.listNodeEntities();
 * for (const entity of allNodes) {
 *   processEntity(entity);
 * }
 *
 * // Entity removal
 * registry.removeNodeEntity(entity);
 * registry.removeEntity('edge-456');
 * ```
 *
 * @see {@link EntityManager}
 * @see {@link FlowGraphCoordinator}
 */
export class EntityRegistry<
  N extends INode = INode,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /** Underlying entity manager for persistent storage */
  private readonly entityManager: EntityManager;

  /** Type guard functions for entity type differentiation */
  private readonly guards: EntityTypeGuards<NE, EE>;

  /** Node-to-entity mapping cache for O(1) lookups by node reference */
  private readonly nodeIndex = new Map<N, NE>();

  /** Entity ID-to-entity mapping for fast direct lookups by ID */
  private readonly nodeIdIndex = new Map<string, NE>();

  /** Edge entity storage by ID */
  private readonly edgeEntities = new Map<string, EE>();

  /**
   * Constructor
   *
   * Initializes the entity registry with entity manager and type guard functions.
   * The type guards are essential for differentiating between node and edge entities.
   *
   * @param entityManager - The underlying entity manager for persistent storage
   * @param guards - Type guard functions for node and edge entity type checking
   *
   * @example
   * ```typescript
   * const registry = new EntityRegistry(manager, {
   *   isNodeEntity: (e): e is IFlowNodeEntity => e.type === 'node',
   *   isEdgeEntity: (e): e is IFlowEdgeEntity => e.type === 'edge',
   * });
   * ```
   */
  constructor(entityManager: EntityManager, guards: EntityTypeGuards<NE, EE>) {
    this.entityManager = entityManager;
    this.guards = guards;
  }

  /**
   * Get the underlying entity manager
   *
   * @returns The EntityManager instance used for persistent storage
   */
  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  /**
   * Register a node entity
   *
   * Adds node entity to both indexes (node-based and ID-based) for fast lookups.
   * Also registers the entity with the underlying EntityManager if needed.
   *
   * @param entity - The node entity to register
   *
   * @remarks
   * - Creates dual index entries for O(1) lookup performance
   * - Safe to call multiple times for the same entity (idempotent)
   * - Updates existing entries if called for same entity again
   *
   * @example
   * ```typescript
   * const nodeEntity = createNodeEntity(node);
   * registry.addNodeEntity(nodeEntity);
   *
   * // Now entity is accessible by both node and ID
   * const byNode = registry.findNodeEntityByNode(node);
   * const byId = registry.getNodeEntity(nodeEntity.id);
   * ```
   */
  addNodeEntity(entity: NE): void {
    const node = entity.node as N | undefined;
    if (node) {
      this.nodeIndex.set(node, entity);
    }
    // Add to ID index for fast lookup
    this.nodeIdIndex.set(entity.id, entity);
  }

  /**
   * Remove a node entity
   *
   * Removes the node entity from all indexes and the underlying EntityManager.
   *
   * @param entity - The node entity to remove
   * @returns true if entity was successfully removed, false otherwise
   *
   * @remarks
   * - Removes from both node and ID indexes
   * - Delegates actual removal to EntityManager
   * - Safe to call even if entity not found (returns false)
   *
   * @example
   * ```typescript
   * const removed = registry.removeNodeEntity(nodeEntity);
   * if (removed) {
   *   console.log('Entity removed successfully');
   * }
   * ```
   */
  removeNodeEntity(entity: NE): boolean {
    const node = entity.node as N | undefined;
    if (node) {
      this.nodeIndex.delete(node);
    }
    // Remove from ID index
    this.nodeIdIndex.delete(entity.id);
    return this.entityManager.removeEntity(entity.id);
  }

  /**
   * Get node entity by ID
   *
   * Retrieves a node entity using ID-based lookup with caching.
   * Uses a fast path (ID index) first, then falls back to EntityManager query.
   *
   * @param id - The entity ID to lookup
   * @returns The node entity if found, undefined otherwise
   *
   * @remarks
   * - O(1) average lookup time via ID index
   * - Lazily caches entities from EntityManager
   * - Automatically registers newly found entities
   *
   * @example
   * ```typescript
   * const entity = registry.getNodeEntity('node-123');
   * if (entity) {
   *   console.log('Found:', entity.id);
   * }
   * ```
   */
  getNodeEntity(id: string): NE | undefined {
    // Fast path: check ID index first
    const cached = this.nodeIdIndex.get(id);
    if (cached) {
      return cached;
    }

    // Slow path: query EntityManager and cache
    const candidate = this.entityManager.getEntity(id);
    if (this.guards.isNodeEntity(candidate)) {
      const typed = candidate as NE;
      this.addNodeEntity(typed);
      return typed;
    }
    return undefined;
  }

  /**
   * Find node entity by node reference
   *
   * Looks up the entity associated with a specific node object using node-based indexing.
   * Falls back to EntityManager scan if not in cache.
   *
   * @param node - The node object to lookup
   * @returns The node entity associated with the node, undefined if not found
   *
   * @remarks
   * - Returns O(1) if node is in cache
   * - O(n) fallback scan through EntityManager
   * - Caches all encountered entities during scan
   * - Useful for reverse lookup from node to entity
   *
   * @example
   * ```typescript
   * const node = createNode(...);
   * const entity = registry.findNodeEntityByNode(node);
   * if (entity) {
   *   console.log('Entity for node:', entity.id);
   * }
   * ```
   */
  findNodeEntityByNode(node: N): NE | undefined {
    const cached = this.nodeIndex.get(node);
    if (cached) {
      return cached;
    }
    for (const entity of this.entityManager.getEntities()) {
      if (!this.guards.isNodeEntity(entity)) {
        continue;
      }
      const typed = entity as NE;
      const entityNode = typed.node as N | undefined;
      if (entityNode) {
        this.nodeIndex.set(entityNode, typed);
        if (entityNode === node) {
          return typed;
        }
      }
    }
    return undefined;
  }

  /**
   * List all node entities
   *
   * Retrieves all node entities and updates indexes accordingly.
   * Also performs cache cleanup to remove stale entries.
   *
   * @returns Array of all node entities in the registry
   *
   * @remarks
   * - Iterates through EntityManager to ensure completeness
   * - Automatically caches all discovered entities
   * - Cleans up stale entries from both indexes
   * - O(n) operation where n is number of entities in EntityManager
   * - Safe to call repeatedly, maintains cache coherency
   *
   * @example
   * ```typescript
   * const allNodes = registry.listNodeEntities();
   * console.log(`Found ${allNodes.length} node entities`);
   *
   * for (const entity of allNodes) {
   *   processEntity(entity);
   * }
   * ```
   */
  listNodeEntities(): NE[] {
    const entities: NE[] = [];
    for (const entity of this.entityManager.getEntities()) {
      if (!this.guards.isNodeEntity(entity)) {
        continue;
      }
      const typed = entity as NE;
      const node = typed.node as N | undefined;
      if (node) {
        this.nodeIndex.set(node, typed);
      }
      // Update ID index
      this.nodeIdIndex.set(typed.id, typed);
      entities.push(typed);
    }

    // Cleanup stale entries
    if (entities.length < this.nodeIndex.size) {
      const validNodes = new Set(entities.map((entity) => entity.node as N));
      for (const key of [...this.nodeIndex.keys()]) {
        if (!validNodes.has(key)) {
          this.nodeIndex.delete(key);
        }
      }
    }

    if (entities.length < this.nodeIdIndex.size) {
      const validIds = new Set(entities.map((entity) => entity.id));
      for (const key of [...this.nodeIdIndex.keys()]) {
        if (!validIds.has(key)) {
          this.nodeIdIndex.delete(key);
        }
      }
    }

    return entities;
  }

  /**
   * Register an edge entity
   *
   * Adds edge entity to the edge registry for tracking.
   *
   * @param entity - The edge entity to register
   *
   * @remarks
   * - Stores edge in ID-indexed map
   * - Edges are typically created and managed by FlowGraphCoordinator
   * - Safe to call multiple times (updates existing entry)
   *
   * @example
   * ```typescript
   * const edgeEntity = createEdgeEntity(sourceId, targetId);
   * registry.addEdgeEntity(edgeEntity);
   * ```
   */
  addEdgeEntity(entity: EE): void {
    this.edgeEntities.set(entity.id, entity);
  }

  /**
   * Get edge entity by ID
   *
   * Retrieves an edge entity using ID lookup with caching.
   * Uses cache first, falls back to EntityManager query.
   *
   * @param id - The edge entity ID to lookup
   * @returns The edge entity if found, undefined otherwise
   *
   * @remarks
   * - O(1) cached lookups for recently accessed edges
   * - Falls back to EntityManager scan if not cached
   * - Automatically caches newly found entities
   *
   * @example
   * ```typescript
   * const edge = registry.getEdgeEntity('edge-456');
   * if (edge) {
   *   console.log('Edge:', edge.id);
   * }
   * ```
   */
  getEdgeEntity(id: string): EE | undefined {
    const stored = this.edgeEntities.get(id);
    if (stored) {
      return stored;
    }
    const candidate = this.entityManager.getEntity(id);
    if (this.guards.isEdgeEntity(candidate)) {
      const typed = candidate as EE;
      this.edgeEntities.set(id, typed);
      return typed;
    }
    return undefined;
  }

  /**
   * List all edge entities
   *
   * Retrieves all edge entities and updates the edge registry.
   * Performs cache cleanup to remove stale entries.
   *
   * @returns Array of all edge entities in the registry
   *
   * @remarks
   * - Scans EntityManager for complete list
   * - Caches all discovered edges
   * - Cleans up stale cache entries
   * - O(n) operation where n is total entities in EntityManager
   * - Use when you need comprehensive edge inventory
   *
   * @example
   * ```typescript
   * const allEdges = registry.listEdgeEntities();
   * console.log(`Found ${allEdges.length} edges`);
   *
   * for (const edge of allEdges) {
   *   validateEdge(edge);
   * }
   * ```
   */
  listEdgeEntities(): EE[] {
    const edges: EE[] = [];
    for (const entity of this.entityManager.getEntities()) {
      if (!this.guards.isEdgeEntity(entity)) {
        continue;
      }
      const typed = entity as EE;
      this.edgeEntities.set(typed.id, typed);
      edges.push(typed);
    }

    if (edges.length < this.edgeEntities.size) {
      const validIds = new Set(edges.map((edge) => edge.id));
      for (const key of [...this.edgeEntities.keys()]) {
        if (!validIds.has(key)) {
          this.edgeEntities.delete(key);
        }
      }
    }

    return edges;
  }

  /**
   * Remove an edge entity
   *
   * Removes edge entity from registry and EntityManager with optional callback.
   *
   * @param edgeId - The ID of the edge entity to remove
   * @param beforeRemove - Optional callback invoked before removal with the edge entity
   * @returns Object with removed edge entity (if found) and removal success status
   *
   * @remarks
   * - The beforeRemove callback allows cleanup operations (e.g., event notification)
   * - Returns both the edge entity and removal status for flexibility
   * - Removes from local cache and EntityManager
   * - Safe to call even if edge not found (returns { entity: undefined, removed: false })
   *
   * @example
   * ```typescript
   * const { entity, removed } = registry.removeEdgeEntity('edge-456', (edge) => {
   *   console.log('Removing edge:', edge.id);
   * });
   *
   * if (removed) {
   *   console.log('Edge removal complete');
   * }
   * ```
   */
  removeEdgeEntity(
    edgeId: string,
    beforeRemove?: (edge: EE) => void
  ): { entity: OptionalProp<EE>; removed: boolean } {
    const edge = this.getEdgeEntity(edgeId);
    if (edge) {
      beforeRemove?.(edge);
      this.edgeEntities.delete(edgeId);
    }
    const removed = this.entityManager.removeEntity(edgeId);
    return { entity: edge, removed: removed || !!edge };
  }

  /**
   * Remove any entity (node or edge)
   *
   * Removes an entity of any type from the registry.
   * Automatically detects entity type and cleans up appropriate indexes.
   *
   * @param id - The ID of the entity to remove
   * @returns true if entity was successfully removed, false otherwise
   *
   * @remarks
   * - Automatically determines entity type via type guards
   * - Cleans up node indexes if entity is node type
   * - Cleans up edge cache if entity is edge type
   * - Delegates final removal to EntityManager
   * - Suitable for generic entity removal operations
   *
   * @example
   * ```typescript
   * // Remove any entity by ID
   * const removed = registry.removeEntity('any-entity-id');
   * if (removed) {
   *   console.log('Entity removed');
   * }
   * ```
   */
  removeEntity(id: string): boolean {
    const candidate = this.entityManager.getEntity(id);
    if (this.guards.isNodeEntity(candidate)) {
      const typed = candidate as NE;
      const node = typed.node as N | undefined;
      if (node) {
        this.nodeIndex.delete(node);
      }
      // Remove from ID index
      this.nodeIdIndex.delete(id);
    }
    if (this.guards.isEdgeEntity(candidate)) {
      this.edgeEntities.delete(id);
    }
    return this.entityManager.removeEntity(id);
  }

  /**
   * Count entities by type
   *
   * Returns count of node and edge entities in the registry.
   *
   * @returns Object with nodeCount and edgeCount
   *
   * @remarks
   * - Provides quick inventory of entity distribution
   * - Scans EntityManager so reflects true entity count
   * - Useful for diagnostics and monitoring
   * - O(n) where n is total entities in EntityManager
   *
   * @example
   * ```typescript
   * const counts = registry.countEntities();
   * console.log(`Nodes: ${counts.nodeCount}, Edges: ${counts.edgeCount}`);
   * ```
   */
  countEntities(): { nodeCount: number; edgeCount: number } {
    let nodeCount = 0;
    let edgeCount = 0;
    for (const entity of this.entityManager.getEntities()) {
      if (this.guards.isNodeEntity(entity)) {
        nodeCount += 1;
      } else if (this.guards.isEdgeEntity(entity)) {
        edgeCount += 1;
      }
    }
    return { nodeCount, edgeCount };
  }
}
