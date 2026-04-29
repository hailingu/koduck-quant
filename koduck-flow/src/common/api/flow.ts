/**
 * Flow Convenience API
 *
 * Provides convenient operation functions for flow entities on top of the general entity module.
 * Main features include:
 * - Create flow entity (createFlowEntity)
 * - Get parent nodes of a node (getNodeParents)
 * - Get child nodes of a node (getNodeChildren)
 *
 * These functions handle parameter adaptation and node relationship queries. Runtime state changes
 * are still performed via the shared entity API.
 *
 * @module FlowAPI
 *
 * @example
 * ```typescript
 * // Create flow entity
 * const flow = createFlowEntity('workflow', { name: 'My Flow' });
 *
 * // Get node relationships
 * const parents = getNodeParents('node-123');
 * const children = getNodeChildren('node-123');
 * ```
 *
 * @see {@link createEntity}
 * @see {@link getEntity}
 */
import type { IEntity } from "../entity";
import { createEntity, getEntity } from "./entity";

/**
 * Create Flow Entity
 *
 * Factory function for creating flow entities of a specified type. After creation, the entity can be
 * added to the flow graph and manipulated through other APIs.
 *
 * @template TData - Entity data type
 * @template TConfig - Entity configuration type
 *
 * @param nodeType - Node type identifier used for entity factory lookup
 * @param data - Initial data for the node
 * @param config - Optional node configuration parameters
 *
 * @returns IEntity object on success, null on failure
 *
 * @throws Catches internal exceptions and returns null while logging the error
 *
 * @example
 * ```typescript
 * // Basic usage
 * const entity = createFlowEntity('task-node', { label: 'Task 1' });
 * if (entity) {
 *   console.log('Created entity:', entity.id);
 * }
 *
 * // Usage with configuration
 * const configuredEntity = createFlowEntity(
 *   'decision-node',
 *   { condition: true },
 *   { timeout: 5000 }
 * );
 *
 * // Handling creation failure
 * const entity2 = createFlowEntity('unknown-type', {});
 * if (!entity2) {
 *   console.error('Failed to create entity');
 * }
 * ```
 *
 * @see {@link IEntity}
 * @see {@link createEntity}
 */
export function createFlowEntity<
  TData = Record<string, unknown>,
  TConfig = Record<string, unknown>,
>(nodeType: string, data: TData, config?: TConfig): IEntity | null {
  try {
    return createEntity<IEntity>("FlowEntity", {
      type: nodeType,
      data,
      config,
    });
  } catch (error) {
    console.error(`Failed to create flow entity of type ${nodeType}:`, error);
    return null;
  }
}

/**
 * Get all parent nodes of a node
 *
 * Queries all parent node IDs for the given node ID in the flow graph.
 * Returns an array of parent node IDs, not the full node objects.
 *
 * @param entityId - Entity ID of the target node
 *
 * @returns Array of parent node IDs, empty array if no parents or query failed
 *
 * Notes:
 * - Returns empty array if entity does not exist
 * - Returns empty array if entity has no 'node' property
 * - Internal exceptions are caught and logged, not thrown
 *
 * @example
 * ```typescript
 * // Get all parents of a node
 * const parents = getNodeParents('node-456');
 * console.log('Parent nodes:', parents); // ['node-123', 'node-789']
 *
 * // If node does not exist
 * const orphanParents = getNodeParents('non-existent');
 * console.log('Orphan parents:', orphanParents); // []
 * ```
 *
 * @see {@link getNodeChildren}
 * @see {@link getEntity}
 */
export function getNodeParents(entityId: string): string[] {
  try {
    const entity = getEntity(entityId);
    if (entity && typeof entity === "object" && "node" in entity) {
      const node = (entity as Record<string, unknown>).node;
      if (node && typeof node === "object" && "parents" in node) {
        const parents = (node as Record<string, unknown>).parents;
        return Array.isArray(parents) ? (parents as string[]) : [];
      }
    }
    return [];
  } catch (error) {
    console.error(`Failed to get parents for node ${entityId}:`, error);
    return [];
  }
}

/**
 * Get all child nodes of a node
 *
 * Queries all child node IDs for the given node ID in the flow graph.
 * Returns an array of child node IDs, not the full node objects.
 *
 * @param entityId - Entity ID of the target node
 *
 * @returns Array of child node IDs, empty array if no children or query failed
 *
 * Notes:
 * - Returns empty array if entity does not exist
 * - Returns empty array if entity has no 'node' property
 * - Internal exceptions are caught and logged, not thrown
 *
 * @example
 * ```typescript
 * // Get all children of a node
 * const children = getNodeChildren('node-456');
 * console.log('Child nodes:', children); // ['node-111', 'node-222']
 *
 * // Leaf nodes have no children
 * const leafChildren = getNodeChildren('leaf-node');
 * console.log('Leaf children:', leafChildren); // []
 * ```
 *
 * @see {@link getNodeParents}
 * @see {@link getEntity}
 */
export function getNodeChildren(entityId: string): string[] {
  try {
    const entity = getEntity(entityId);
    if (entity && typeof entity === "object" && "node" in entity) {
      const node = (entity as Record<string, unknown>).node;
      if (node && typeof node === "object" && "children" in node) {
        const children = (node as Record<string, unknown>).children;
        return Array.isArray(children) ? (children as string[]) : [];
      }
    }
    return [];
  } catch (error) {
    console.error(`Failed to get children for node ${entityId}:`, error);
    return [];
  }
}
