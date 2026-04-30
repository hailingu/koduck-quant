/**
 * Node Operations Module
 *
 * Encapsulates all node-related operations, including:
 * - Node addition/removal
 * - Node linking
 * - Batch node operations
 * - Node queries
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
import type {
  FlowLinkMetadata,
  FlowNodeLinkOptions,
  IEdge,
  IFlowNodeEntity,
  IFlowEdgeEntity,
  INode,
  INodeBase,
} from "../types";

/**
 * NodeOperations class
 *
 * Provides comprehensive node management capabilities with dependency injection.
 * All operations are delegated from the Flow facade through this class.
 *
 * Encapsulates node-related business logic including:
 * - Node addition and removal
 * - Node linking and unlinking
 * - Node querying and counting
 */
export class NodeOperations<
  N extends INode<INodeBase> = INode<INodeBase>,
  E extends IEdge = IEdge,
  NE extends IFlowNodeEntity<N> = IFlowNodeEntity<N>,
  EE extends IFlowEdgeEntity<E> = IFlowEdgeEntity<E>,
> {
  /**
   * Creates a new NodeOperations instance
   *
   * @param registry - Entity registry for node storage
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
   * Add a node to the flow
   *
   * Registers a node entity with optional parent linking. If parent IDs are provided,
   * creates connections from parent nodes to the new node.
   *
   * @param entity - Node entity to add
   * @param options - Optional linking options with parent IDs and metadata
   * @throws Error if entity is invalid
   *
   * @example
   * ```typescript
   * const root = nodeOps.createEntity<IFlowNodeEntity>('RootNode', {
   *   label: 'Root'
   * });
   * nodeOps.addNode(root);
   *
   * const child = nodeOps.createEntity<IFlowNodeEntity>('ChildNode', {
   *   label: 'Child'
   * });
   * nodeOps.addNode(child, {
   *   parentIds: [root.id],
   *   linkMetadata: { type: 'parent-child' }
   * });
   * ```
   */
  addNode(entity: NE, options?: FlowNodeLinkOptions): void {
    if (!entity) return;

    this.registry.addNodeEntity(entity);
    this.graphCoordinator.registerNode(entity);

    const parentIds = options?.parentIds ?? [];
    if (!parentIds.length) {
      return;
    }

    for (const parentId of parentIds) {
      if (!parentId) continue;
      const parentEntity = this.registry.getNodeEntity(parentId);
      if (!parentEntity) continue;

      this.graphCoordinator.registerNode(parentEntity);
      const metadata =
        typeof options?.linkMetadata === "function"
          ? options.linkMetadata(parentId, entity.id)
          : options?.linkMetadata;

      const { success, error } = this.graphCoordinator.linkNodes(parentId, entity.id, metadata);
      if (success) {
        this.metrics.recordGraphLinkSuccess("addNode");
      } else {
        this.metrics.recordGraphLinkFailure("addNode", {
          parent: parentId,
        });
        if (error instanceof Error) {
          this.metrics.recordGraphLinkErrorLength(error.message.length);
        }
      }
    }
  }

  /**
   * Remove a node from the flow
   *
   * Removes a node entity by ID, triggering removal hooks and updating the graph structure.
   *
   * @param id - Node ID to remove
   * @returns True if successfully removed, false if not found or hook prevented removal
   *
   * @example
   * ```typescript
   * const success = nodeOps.removeNode('node-1');
   * if (success) {
   *   console.log('Node removed successfully');
   * }
   * ```
   */
  removeNode(id: string): boolean {
    const entity = this.registry.getNodeEntity(id);
    if (!entity) return false;

    if (!this.hooks.runEntityRemoved(id)) {
      return false;
    }

    const start = performance.now();
    const ok = this.registry.removeNodeEntity(entity);
    const dur = performance.now() - start;
    this.metrics.recordEntityRemoval(dur, ok);
    if (ok) {
      this.graphCoordinator.removeNode(id);
    }
    return ok;
  }

  /**
   * Link two nodes together
   *
   * Creates a connection between two node entities with optional metadata.
   * Both nodes must exist for successful linking.
   *
   * @param sourceId - Source node ID
   * @param targetId - Target node ID
   * @param metadata - Optional link metadata
   * @returns True if successfully linked, false otherwise
   *
   * @example
   * ```typescript
   * const success = nodeOps.linkNodes('node-1', 'node-2', {
   *   type: 'flow',
   *   label: 'transitions to'
   * });
   *
   * if (success) {
   *   console.log('Nodes linked successfully');
   * }
   * ```
   */
  linkNodes(sourceId: string, targetId: string, metadata?: FlowNodeLinkOptions): boolean {
    if (!sourceId || !targetId || sourceId === targetId) {
      return false;
    }

    const sourceEntity = this.registry.getNodeEntity(sourceId);
    const targetEntity = this.registry.getNodeEntity(targetId);
    if (!sourceEntity || !targetEntity) {
      return false;
    }

    this.graphCoordinator.registerNode(sourceEntity);
    this.graphCoordinator.registerNode(targetEntity);

    const linkMetadata: FlowLinkMetadata | undefined =
      metadata && "linkMetadata" in metadata
        ? typeof metadata.linkMetadata === "function"
          ? metadata.linkMetadata(sourceId, targetId)
          : metadata.linkMetadata
        : undefined;
    const { success, error } = this.graphCoordinator.linkNodes(
      sourceId,
      targetId,
      linkMetadata
    );
    if (success) {
      this.metrics.recordGraphLinkSuccess("direct");
      return true;
    } else {
      this.metrics.recordGraphLinkFailure("direct");
      if (error instanceof Error) {
        this.metrics.recordGraphLinkErrorLength(error.message.length);
      }
      return false;
    }
  }

  /**
   * Add multiple nodes to the flow
   *
   * Batch operation to add multiple node entities with optional linking options.
   *
   * @param entities - Array of node entities to add
   * @param options - Optional linking options applied to all nodes
   *
   * @example
   * ```typescript
   * const nodes = [
   *   nodeOps.createEntity<IFlowNodeEntity>('Type1', { label: 'Node 1' }),
   *   nodeOps.createEntity<IFlowNodeEntity>('Type2', { label: 'Node 2' })
   * ];
   * nodeOps.addNodes(nodes);
   * ```
   */
  addNodes(entities: NE[], options?: FlowNodeLinkOptions): void {
    for (const entity of entities) {
      this.addNode(entity, options);
    }
  }

  /**
   * Remove multiple nodes from the flow
   *
   * Batch operation to remove multiple node entities by their IDs.
   *
   * @param ids - Array of node IDs to remove
   * @returns Number of nodes successfully removed
   *
   * @example
   * ```typescript
   * const removed = nodeOps.removeNodes(['node-1', 'node-2', 'node-3']);
   * console.log(`Removed ${removed} nodes`);
   * ```
   */
  removeNodes(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.removeNode(id)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get a node entity by ID
   *
   * Retrieves a node entity from the registry by its ID.
   *
   * @param id - Node ID
   * @returns Node entity or undefined if not found
   *
   * @example
   * ```typescript
   * const node = nodeOps.getNode('node-1');
   * if (node) {
   *   console.log('Found node:', node.id);
   * }
   * ```
   */
  getNode(id: string): NE | undefined {
    return this.registry.getNodeEntity(id);
  }

  /**
   * Check if a node entity ID exists
   *
   * Checks whether a node with the given ID exists in the flow.
   *
   * @param id - Node ID to check
   * @returns True if node exists, false otherwise
   *
   * @example
   * ```typescript
   * if (nodeOps.hasNode('node-1')) {
   *   console.log('Node exists in the flow');
   * }
   * ```
   */
  hasNode(id: string): boolean {
    return !!this.registry.getNodeEntity(id);
  }

  /**
   * Get the total count of nodes in the flow
   *
   * Returns the total number of node entities currently registered.
   *
   * @returns Number of nodes in the flow
   *
   * @example
   * ```typescript
   * const count = nodeOps.getNodeCount();
   * console.log(`Total nodes: ${count}`);
   * ```
   */
  getNodeCount(): number {
    return this.registry.listNodeEntities().length;
  }
}
