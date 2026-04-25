/**
 * Entity Operations Module
 *
 * Encapsulates core entity-related operations, including:
 * - Entity queries (get, list)
 * - Entity type checking
 *
 * This module provides a lightweight delegation layer for entity operations.
 * Update and removal operations with performance metrics and graph coordination
 * are handled directly by the Flow class.
 *
 * @template N - Node type
 * @template E - Edge type
 * @template NE - Node entity type
 * @template EE - Edge entity type
 */

import type { EntityRegistry } from "../entity-registry";
import type { HookAdapter } from "../orchestration/hook-adapter";
import type { MetricsAdapter } from "../orchestration/metrics-adapter";
import type {
  IEdge,
  IFlowEntity,
  IFlowNodeEntity,
  IFlowEdgeEntity,
  INode,
  INodeBase,
} from "../types";

/**
 * EntityOperations class
 *
 * Provides basic entity management capabilities with dependency injection.
 * Serves as a lightweight delegation layer for entity queries.
 *
 * Encapsulates entity-related logic including:
 * - Entity queries and lookups
 * - Entity type identification
 * - Basic entity access patterns
 */
export class EntityOperations<
  N extends INode<INodeBase> = INode<INodeBase>,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity = IFlowNodeEntity,
  EE extends IFlowEdgeEntity = IFlowEdgeEntity,
> {
  // @ts-expect-error - Type compatibility issue with generics
  private readonly registry: EntityRegistry<N, E, NE, EE>;

  /**
   * Creates a new EntityOperations instance
   *
   * @param registry - Entity registry for storage and retrieval
   * @param _hookAdapter - Hook adapter for event handling (reserved for future use)
   * @param _metricsAdapter - Metrics adapter for performance tracking (reserved for future use)
   */
  constructor(
    // @ts-expect-error - Type compatibility issue with generics
    registry: EntityRegistry<N, E, NE, EE>,
    _hookAdapter: HookAdapter<NE>,
    _metricsAdapter: MetricsAdapter
  ) {
    this.registry = registry;
  }

  /**
   * Get entity by ID with optional type parameter
   *
   * Retrieves an entity from the registry by its ID with support for
   * generic type parameters for type-safe access.
   *
   * @template T - Entity type (defaults to IFlowEntity)
   * @param id - Entity ID to retrieve
   * @returns Entity of type T or undefined if not found
   *
   * @example
   * ```typescript
   * // Generic entity access
   * const entity = entityOps.getEntity('entity-1');
   *
   * // Type-safe node entity access
   * const nodeEntity = entityOps.getEntity<IFlowNodeEntity>('node-1');
   *
   * // Type-safe edge entity access
   * const edgeEntity = entityOps.getEntity<IFlowEdgeEntity>('edge-1');
   * ```
   *
   * @see {@link getNodeEntity} For type-safe node entity retrieval
   * @see {@link getEdgeEntity} For type-safe edge entity retrieval
   * @see {@link hasEntity} To check entity existence before retrieval
   */
  getEntity<T extends IFlowEntity = IFlowEntity>(id: string): T | undefined {
    if (!id) return undefined;
    const entity = this.registry.getNodeEntity(id) ?? this.registry.getEdgeEntity(id);
    return entity as T | undefined;
  }

  /**
   * Check if any entity exists by ID
   *
   * Verifies whether an entity with the given ID exists in the registry.
   * Returns false for empty or invalid IDs.
   *
   * @param id - Entity ID to check
   * @returns True if entity exists, false otherwise
   *
   * @example
   * ```typescript
   * if (entityOps.hasEntity('node-1')) {
   *   console.log('Node exists');
   * }
   * ```
   *
   * @see {@link getEntity} To retrieve the entity if it exists
   */
  hasEntity(id: string): boolean {
    if (!id) return false;
    const entity = this.registry.getNodeEntity(id) ?? this.registry.getEdgeEntity(id);
    return entity !== undefined;
  }

  /**
   * Get a node entity with type safety
   *
   * Retrieves a node entity by ID with guaranteed type safety.
   * Returns undefined if entity doesn't exist or is not a node.
   *
   * @param id - Node entity ID
   * @returns Node entity or undefined if not found
   *
   * @example
   * ```typescript
   * const nodeEntity = entityOps.getNodeEntity('node-1');
   * if (nodeEntity) {
   *   console.log('Node label:', nodeEntity.node.label);
   * }
   * ```
   *
   * @see {@link getEdgeEntity} For edge entity retrieval
   * @see {@link getEntity} For generic entity retrieval
   */
  getNodeEntity(id: string): NE | undefined {
    if (!id) return undefined;
    return this.registry.getNodeEntity(id);
  }

  /**
   * Get an edge entity with type safety
   *
   * Retrieves an edge entity by ID with guaranteed type safety.
   * Returns undefined if entity doesn't exist or is not an edge.
   *
   * @param id - Edge entity ID
   * @returns Edge entity or undefined if not found
   *
   * @example
   * ```typescript
   * const edgeEntity = entityOps.getEdgeEntity('edge-1');
   * if (edgeEntity) {
   *   console.log('Connection:', edgeEntity.edge.sourceId, '->', edgeEntity.edge.targetId);
   * }
   * ```
   *
   * @see {@link getNodeEntity} For node entity retrieval
   * @see {@link getEntity} For generic entity retrieval
   */
  getEdgeEntity(id: string): EE | undefined {
    if (!id) return undefined;
    return this.registry.getEdgeEntity(id);
  }

  /**
   * Get all node entities in the flow
   *
   * Returns a list of all node entities currently stored in the registry.
   * Useful for batch operations and inspections.
   *
   * @returns Array of all node entities (empty array if none exist)
   *
   * @example
   * ```typescript
   * const allNodes = entityOps.getAllEntities();
   * console.log(`Total nodes: ${allNodes.length}`);
   *
   * // Filter nodes by criteria
   * const activeNodes = allNodes.filter(n => n.active !== false);
   * ```
   *
   * @see {@link getAllEdgeEntities} For all edge entities
   */
  getAllEntities(): NE[] {
    return this.registry.listNodeEntities();
  }

  /**
   * Get all edge entities in the flow
   *
   * Returns a list of all edge entities currently stored in the registry.
   * Useful for batch operations on connections.
   *
   * @returns Array of all edge entities (empty array if none exist)
   *
   * @example
   * ```typescript
   * const allEdges = entityOps.getAllEdgeEntities();
   * console.log(`Total connections: ${allEdges.length}`);
   * ```
   *
   * @see {@link getAllEntities} For all node entities
   */
  getAllEdgeEntities(): EE[] {
    return this.registry.listEdgeEntities();
  }
}
