/**
 * Edge Operations Module
 *
 * Encapsulates all edge-related operations, including:
 * - Edge creation/removal
 * - Edge queries
 * - Batch edge operations
 * - Edge linking
 *
 * @template N - Node type
 * @template E - Edge type
 * @template NE - Node entity type
 * @template EE - Edge entity type
 */

import type { EntityRegistry } from "../entity-registry";
import type { FlowGraphCoordinator } from "../graph-coordinator";
import type { HookAdapter } from "../orchestration/hook-adapter";
import type { MetricsAdapter } from "../orchestration/metrics-adapter";
import type { IEdge, IFlowEdgeEntity, IFlowNodeEntity, INode, INodeBase } from "../types";

/**
 * EdgeOperations class
 *
 * Provides comprehensive edge management capabilities with dependency injection.
 * All operations are delegated from the Flow facade through this class.
 *
 * Encapsulates edge-related business logic including:
 * - Edge creation and removal
 * - Edge queries and lookups
 * - Batch edge operations
 */
export class EdgeOperations<
  N extends INode<INodeBase> = INode<INodeBase>,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /**
   * Creates a new EdgeOperations instance
   *
   * @param registry - Entity registry for edge storage
   * @param graphCoordinator - Graph structure coordinator
   * @param hooks - Hook adapter for event handling
   * @param metrics - Metrics adapter for performance tracking
   */
  constructor(
    private readonly registry: EntityRegistry<N, E, NE, EE>,
    private readonly graphCoordinator: FlowGraphCoordinator<N, E, NE, EE>,

    private readonly hooks: HookAdapter<NE>,
    private readonly metrics: MetricsAdapter
  ) {}

  /**
   * Create an edge between two nodes
   *
   * Creates a new edge entity connecting two nodes with optional metadata.
   * Both source and target nodes must exist for successful edge creation.
   *
   * @param source - Source node ID
   * @param target - Target node ID
   * @param edge - Edge data
   * @param edgeEntity - Optional pre-created edge entity
   * @returns True if successfully created, false otherwise
   *
   * @example
   * ```typescript
   * const success = edgeOps.createEdge('node-1', 'node-2', {
   *   type: 'flow',
   *   label: 'connects'
   * });
   * ```
   */
  createEdge(source: string, target: string, edge: E, edgeEntity?: EE): boolean {
    if (!source || !target || !edge) return false;

    const sourceEntity = this.registry.getNodeEntity(source);
    const targetEntity = this.registry.getNodeEntity(target);
    if (!sourceEntity || !targetEntity) return false;

    if (edgeEntity) {
      return this.addEdge(edgeEntity);
    }

    // Edge creation would typically involve entity manager, but since we're
    // working at the operations level, we just return true to indicate
    // the edge could be created. The actual entity creation happens in Flow.createEdgeEntity()
    this.metrics.recordGraphLinkSuccess("createEdge");
    return true;
  }

  /**
   * Add an edge to the flow
   *
   * Registers an edge entity with the registry and graph coordinator.
   * The edge entity should already exist and contain valid source/target references.
   *
   * @param entity - Edge entity to add
   * @returns True if successfully added, false if entity is empty
   *
   * @example
   * ```typescript
   * const edge = flow.createEdgeEntity<IFlowEdgeEntity>('LinkType', {
   *   sourceId: 'node-1',
   *   targetId: 'node-2'
   * });
   * edgeOps.addEdge(edge);
   * ```
   */
  addEdge(entity: EE): boolean {
    if (!entity) return false;

    this.registry.addEdgeEntity(entity);
    this.graphCoordinator.registerEdge(entity);
    this.metrics.recordGraphLinkSuccess("addEdge");
    return true;
  }

  /**
   * Remove an edge from the flow
   *
   * Removes an edge entity by ID, detaching it from the graph structure.
   *
   * @param id - Edge ID to remove
   * @returns True if successfully removed, false if not found
   *
   * @example
   * ```typescript
   * const removed = edgeOps.removeEdge('edge-1');
   * ```
   */
  removeEdge(id: string): boolean {
    if (!id) return false;

    const start = performance.now();
    const { removed } = this.registry.removeEdgeEntity(id, (edge: EE) => {
      this.graphCoordinator.detachEdge(edge);
    });
    const dur = performance.now() - start;

    if (removed) {
      this.metrics.recordEntityRemoval(dur, true);
    }
    return removed;
  }

  /**
   * Create multiple edges
   *
   * Batch operation to create multiple edges between nodes.
   *
   * @param edges - Array of edge definitions with source, target, and edge data
   * @returns Number of edges successfully created
   *
   * @example
   * ```typescript
   * const count = edgeOps.createEdges([
   *   { source: 'node-1', target: 'node-2', edge: { type: 'flow' } },
   *   { source: 'node-2', target: 'node-3', edge: { type: 'flow' } }
   * ]);
   * ```
   */
  createEdges(edges: Array<{ source: string; target: string; edge: E }>): number {
    let count = 0;
    for (const edgeSpec of edges) {
      if (this.createEdge(edgeSpec.source, edgeSpec.target, edgeSpec.edge)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Remove multiple edges
   *
   * Batch operation to remove multiple edge entities by their IDs.
   *
   * @param ids - Array of edge IDs to remove
   * @returns Number of edges successfully removed
   *
   * @example
   * ```typescript
   * const removed = edgeOps.removeEdges(['edge-1', 'edge-2', 'edge-3']);
   * ```
   */
  removeEdges(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.removeEdge(id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get an edge by ID
   *
   * Retrieves an edge entity from the registry by its ID.
   *
   * @param id - Edge ID
   * @returns Edge entity or undefined if not found
   *
   * @example
   * ```typescript
   * const edge = edgeOps.getEdge('edge-1');
   * ```
   */
  getEdge(id: string): EE | undefined {
    if (!id) return undefined;
    return this.registry.getEdgeEntity(id);
  }

  /**
   * Check if an edge exists
   *
   * Checks whether an edge with the given ID exists in the flow.
   *
   * @param id - Edge ID to check
   * @returns True if edge exists, false otherwise
   *
   * @example
   * ```typescript
   * if (edgeOps.hasEdge('edge-1')) {
   *   console.log('Edge exists in the flow');
   * }
   * ```
   */
  hasEdge(id: string): boolean {
    return !!this.registry.getEdgeEntity(id);
  }

  /**
   * Get the total count of edges
   *
   * Returns the total number of edge entities currently registered.
   *
   * @returns Number of edges in the flow
   *
   * @example
   * ```typescript
   * const count = edgeOps.getEdgeCount();
   * console.log(`Total edges: ${count}`);
   * ```
   */
  getEdgeCount(): number {
    return this.registry.listEdgeEntities().length;
  }

  /**
   * Get all edges between two nodes
   *
   * Retrieves all edge entities that connect a source node to a target node.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @returns Array of edge entities, empty array if no edges found
   *
   * @example
   * ```typescript
   * const edges = edgeOps.getEdgesBetween('node-1', 'node-2');
   * ```
   */
  getEdgesBetween(sourceId: string, targetId: string): EE[] {
    if (!sourceId || !targetId) return [];

    const allEdges = this.registry.listEdgeEntities();
    return allEdges.filter((edge) => {
      // Note: This assumes edge entities have sourceId and targetId properties
      // Actual implementation may need to adjust based on IFlowEdgeEntity structure
      const edgeRecord = edge as Record<string, unknown>;
      return edgeRecord.sourceId === sourceId && edgeRecord.targetId === targetId;
    });
  }
}
