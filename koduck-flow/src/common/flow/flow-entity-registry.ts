/**
 * @file Flow Entity Registry
 * @module flow-entity-registry
 * @description Centralized registry for Flow Node and Flow Edge entities.
 * Manages entity registration and provides factory helpers for creating
 * flow entity instances.
 *
 * @see docs/design/flow-entity-component-design.md section 2.2
 */

import { RegistryManager, createRegistryManager } from "../registry/registry-manager";
import { FlowNodeEntity, type IFlowNodeEntityArguments } from "./flow-node-entity";
import { FlowEdgeEntity, type IFlowEdgeEntityArguments } from "./flow-edge-entity";
import type { IRegistry } from "../registry/types";
import type { IEntity } from "../entity/types";

/**
 * Flow entity registry manager singleton.
 *
 * This registry manager is dedicated to managing Flow-specific entities
 * (FlowNodeEntity, FlowEdgeEntity) and provides a centralized location
 * for entity lookup and creation.
 *
 * @example
 * ```typescript
 * import { flowRegistryManager, createFlowNodeEntity } from './flow-entity-registry';
 *
 * // Register custom entity types
 * flowRegistryManager.addRegistry('custom-node', customRegistry);
 *
 * // Create entities via factory helpers
 * const node = createFlowNodeEntity({ nodeType: 'task', label: 'My Task' });
 * ```
 */
export const flowRegistryManager: RegistryManager = createRegistryManager();

/**
 * Registry names for built-in flow entity types
 */
export const FLOW_NODE_ENTITY_TYPE = "flow-node-entity";
export const FLOW_EDGE_ENTITY_TYPE = "flow-edge-entity";

/**
 * Simple registry implementation for FlowNodeEntity
 */
class FlowNodeEntityRegistry implements IRegistry<FlowNodeEntity> {
  readonly meta = {
    type: FLOW_NODE_ENTITY_TYPE,
    description: "Registry for FlowNodeEntity instances",
  };

  getConstructor(): typeof FlowNodeEntity {
    return FlowNodeEntity;
  }
}

/**
 * Simple registry implementation for FlowEdgeEntity
 */
class FlowEdgeEntityRegistry implements IRegistry<FlowEdgeEntity> {
  readonly meta = {
    type: FLOW_EDGE_ENTITY_TYPE,
    description: "Registry for FlowEdgeEntity instances",
  };

  getConstructor(): typeof FlowEdgeEntity {
    return FlowEdgeEntity;
  }
}

// Create and register the built-in registries
const flowNodeEntityRegistry = new FlowNodeEntityRegistry();
const flowEdgeEntityRegistry = new FlowEdgeEntityRegistry();

// Register built-in entity types
flowRegistryManager.addRegistry(FLOW_NODE_ENTITY_TYPE, flowNodeEntityRegistry);
flowRegistryManager.addRegistry(FLOW_EDGE_ENTITY_TYPE, flowEdgeEntityRegistry);

// Set default registry to flow-node-entity for convenience
flowRegistryManager.setDefaultRegistry(FLOW_NODE_ENTITY_TYPE);

/**
 * Gets the FlowNodeEntity constructor from the registry.
 *
 * @returns The FlowNodeEntity class constructor
 *
 * @example
 * ```typescript
 * const NodeClass = getFlowNodeEntityType();
 * const node = new NodeClass({ nodeType: 'task', label: 'Task Node' });
 * ```
 */
export function getFlowNodeEntityType(): typeof FlowNodeEntity {
  const registry = flowRegistryManager.getRegistry(FLOW_NODE_ENTITY_TYPE);
  if (!registry) {
    throw new Error(`Registry for "${FLOW_NODE_ENTITY_TYPE}" not found`);
  }
  return registry.getConstructor() as typeof FlowNodeEntity;
}

/**
 * Gets the FlowEdgeEntity constructor from the registry.
 *
 * @returns The FlowEdgeEntity class constructor
 *
 * @example
 * ```typescript
 * const EdgeClass = getFlowEdgeEntityType();
 * const edge = new EdgeClass({
 *   sourceNodeId: 'node1',
 *   sourcePortId: 'out1',
 *   targetNodeId: 'node2',
 *   targetPortId: 'in1',
 * });
 * ```
 */
export function getFlowEdgeEntityType(): typeof FlowEdgeEntity {
  const registry = flowRegistryManager.getRegistry(FLOW_EDGE_ENTITY_TYPE);
  if (!registry) {
    throw new Error(`Registry for "${FLOW_EDGE_ENTITY_TYPE}" not found`);
  }
  return registry.getConstructor() as typeof FlowEdgeEntity;
}

/**
 * Factory function to create a FlowNodeEntity instance.
 *
 * Uses the registry to get the constructor and creates a new instance
 * with the provided initial data.
 *
 * @param initialData - Initial data for the node entity
 * @returns A new FlowNodeEntity instance
 *
 * @example
 * ```typescript
 * const taskNode = createFlowNodeEntity({
 *   nodeType: 'task',
 *   label: 'Process Data',
 *   position: { x: 100, y: 100 },
 *   inputPorts: [{ id: 'in1', name: 'Input', type: 'input' }],
 *   outputPorts: [{ id: 'out1', name: 'Output', type: 'output' }],
 * });
 * ```
 */
export function createFlowNodeEntity(initialData?: IFlowNodeEntityArguments): FlowNodeEntity {
  const NodeClass = getFlowNodeEntityType();
  return new NodeClass(initialData);
}

/**
 * Factory function to create a FlowEdgeEntity instance.
 *
 * Uses the registry to get the constructor and creates a new instance
 * with the provided initial data.
 *
 * @param initialData - Initial data for the edge entity (connection info required)
 * @returns A new FlowEdgeEntity instance
 *
 * @example
 * ```typescript
 * const edge = createFlowEdgeEntity({
 *   sourceNodeId: 'node1',
 *   sourcePortId: 'out1',
 *   targetNodeId: 'node2',
 *   targetPortId: 'in1',
 *   pathType: 'bezier',
 *   animationState: 'idle',
 * });
 * ```
 */
export function createFlowEdgeEntity(initialData: IFlowEdgeEntityArguments): FlowEdgeEntity {
  const EdgeClass = getFlowEdgeEntityType();
  return new EdgeClass(initialData);
}

/**
 * Checks if a registry exists for the given type name.
 *
 * @param typeName - The registry type name to check
 * @returns true if the registry exists, false otherwise
 */
export function hasFlowEntityRegistry(typeName: string): boolean {
  return flowRegistryManager.getRegistry(typeName) !== undefined;
}

/**
 * Gets a registry by type name from the flow registry manager.
 *
 * @param typeName - The registry type name
 * @returns The registry or undefined if not found
 */
export function getFlowEntityRegistry(typeName: string): IRegistry<IEntity> | undefined {
  return flowRegistryManager.getRegistry(typeName);
}

/**
 * Registers a custom flow entity type.
 *
 * @param typeName - Unique type name for the entity
 * @param registry - Registry implementation for the entity type
 *
 * @example
 * ```typescript
 * class CustomNodeRegistry implements IRegistry<CustomNodeEntity> {
 *   readonly meta = { type: 'custom-node' };
 *   getConstructor() { return CustomNodeEntity; }
 * }
 *
 * registerFlowEntityType('custom-node', new CustomNodeRegistry());
 * ```
 */
export function registerFlowEntityType<T extends IEntity>(
  typeName: string,
  registry: IRegistry<T>
): void {
  flowRegistryManager.addRegistry(typeName, registry);
}
