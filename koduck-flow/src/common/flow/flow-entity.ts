/**
 * @module flow-entity
 * @description Flow node entity default implementation with data and configuration management.
 *
 * This module provides the {@link FlowEntity} class, a concrete implementation of the
 * {@link IFlowNodeEntity} interface. It wraps an {@link INode} instance with metadata,
 * data, and configuration, providing serialization and resource management capabilities.
 *
 * ## Key Responsibilities
 * - **Node Wrapping**: Encapsulate INode instances with entity metadata
 * - **Data Management**: Manage entity-specific data and configuration
 * - **Serialization**: Convert entity state to JSON for persistence
 * - **Resource Cleanup**: Dispose of node and entity resources
 * - **Identity**: Generate and maintain unique entity identifiers
 *
 * ## Architecture Features
 * - **Generic Type Parameters**: Support custom node, data, and configuration types
 * - **Type Safety**: Full TypeScript typing with IFlowNodeEntity interface compliance
 * - **Lazy Initialization**: Optional data and configuration with sensible defaults
 * - **Bidirectional Mapping**: Entity ↔ Node relationship with identity tracking
 *
 * ## Design Patterns
 * - **Wrapper Pattern**: Wraps INode with additional metadata and capabilities
 * - **Adapter Pattern**: Adapts INode interface to IFlowNodeEntity contract
 * - **Resource Pattern**: Implements dispose() for cleanup operations
 *
 * ## Data Model
 * - **id**: Unique entity identifier (nanoid-based)
 * - **type**: Entity type classifier (default: "flow-entity")
 * - **data**: Entity-specific data storage (implements Data interface)
 * - **config**: Entity configuration parameters
 * - **node**: Wrapped node instance reference
 *
 * ## Serialization Strategy
 * - toJSON() captures complete entity state
 * - Includes node serialization for full flow reconstruction
 * - Preserves data and configuration in portable format
 *
 * ## Resource Management
 * - dispose() implements safe cleanup
 * - Delegates node disposal to node implementation
 * - Handles missing dispose() gracefully (type-safe check)
 *
 * ## Usage Example
 * ```typescript
 * // Create a flow entity
 * const node = createNode('my-node');
 * const entity = new FlowEntity(node, 'custom-entity', myData, myConfig);
 *
 * // Access entity properties
 * console.log(entity.id);        // 'flow-entity-abc123'
 * console.log(entity.type);      // 'custom-entity'
 * console.log(entity.node);      // node reference
 *
 * // Serialize to JSON
 * const json = entity.toJSON();
 * const snapshot = JSON.stringify(json);
 *
 * // Cleanup
 * entity.dispose();
 * ```
 *
 * @see {@link IFlowNodeEntity} for interface contract
 * @see {@link INode} for node type
 * @see {@link Data} for data storage
 * @see {@link IEntityArguments} for configuration type
 */

import { nanoid } from "nanoid";
import { Data } from "../data";
import type { IEntityArguments } from "../entity/";
import type { IFlowNodeEntity, INode } from "./types";

/**
 * FlowEntity - Default implementation of flow node entity
 *
 * Concrete implementation of {@link IFlowNodeEntity} that wraps an INode instance
 * with additional metadata, data storage, and configuration. Provides serialization,
 * resource management, and type-safe generic support.
 *
 * ## Design Characteristics
 * - **Immutable Identity**: Entity ID generated at construction, never changes
 * - **Mutable Data**: Data and configuration can be updated after construction
 * - **Lazy Defaults**: Optional parameters use sensible defaults (empty Data, empty config)
 * - **Type Flexibility**: Supports custom node, data, and configuration types
 * - **Node Delegation**: Resource disposal delegates to wrapped node
 *
 * ## Generic Type Parameters
 * - `N` (Node Type): Type of wrapped node, defaults to INode
 * - `D` (Data Type): Type of entity data, defaults to Data
 * - `C` (Config Type): Type of entity configuration, defaults to IEntityArguments
 *
 * ## Properties
 * - `id`: Unique identifier generated via nanoid() (readonly)
 * - `type`: Entity type classifier (readonly after construction)
 * - `data`: Mutable data storage
 * - `config`: Mutable configuration storage
 * - `node`: Reference to wrapped node instance (readonly)
 *
 * ## Lifecycle
 * 1. **Construction**: Generate ID, set type, initialize data/config
 * 2. **Operation**: Access/modify data and config, use node reference
 * 3. **Serialization**: Convert to JSON for persistence/transmission
 * 4. **Disposal**: Clean up node resources via dispose()
 *
 * @template N - Node type (default: INode)
 * @template D - Data type (default: Data)
 * @template C - Configuration type (default: IEntityArguments)
 *
 * @example
 * ```typescript
 * // Create with minimal parameters
 * const entity = new FlowEntity(myNode);
 * console.log(entity.id);    // Auto-generated ID
 * console.log(entity.type);  // 'flow-entity'
 *
 * // Create with custom type and data
 * const customEntity = new FlowEntity(
 *   myNode,
 *   'custom-type',
 *   customData,
 *   customConfig
 * );
 *
 * // Modify data after construction
 * entity.data.update({ key: 'value' });
 *
 * // Serialize for storage
 * const json = entity.toJSON();
 * saveToDatabase(json);
 *
 * // Clean up resources
 * entity.dispose();
 * ```
 *
 * @see {@link IFlowNodeEntity} for interface contract
 * @see {@link Data} for data storage implementation
 */
export class FlowEntity<
  N extends INode = INode,
  D extends Data = Data,
  C extends IEntityArguments = IEntityArguments,
> implements IFlowNodeEntity<N>
{
  readonly id: string;
  readonly type: string;
  data: D;
  config: C;

  /**
   * Reference to the wrapped node instance
   *
   * Provides access to the underlying INode for node-specific operations.
   * This reference is immutable after construction.
   *
   * @see {@link INode} for node interface
   */
  node: N;

  /**
   * Construct a FlowEntity wrapping an INode
   *
   * Creates a new entity instance with the given node and optional metadata.
   * Automatically generates a unique entity ID using nanoid() algorithm.
   * Initializes data and configuration with sensible defaults if not provided.
   *
   * ## ID Generation
   * Entity ID is generated using nanoid() with "flow-entity-" prefix:
   * - Format: "flow-entity-" + nanoid()
   * - Example: "flow-entity-V1StGXR_Z5j3eK"
   * - Uniqueness: Cryptographically unique, collision probability negligible
   *
   * ## Default Initialization
   * - If `data` not provided: Creates new empty Data instance
   * - If `config` not provided: Creates empty configuration object
   * - If `type` not provided: Uses "flow-entity" as default type
   *
   * @param node - The node instance to wrap (required)
   * @param type - Entity type classifier (optional, default: "flow-entity").
   * Used to differentiate entity subtypes in heterogeneous collections.
   * @param data - Initial data storage (optional, default: new Data()).
   * Stores entity-specific application data.
   * @param config - Initial configuration (optional, default: {}).
   * Stores entity configuration parameters.
   *
   * @example
   * ```typescript
   * // Minimal construction
   * const entity = new FlowEntity(myNode);
   *
   * // Full construction with custom types
   * const customEntity = new FlowEntity(
   *   myNode,
   *   'render-node',
   *   new CustomData({ title: 'My Node' }),
   *   { layout: 'grid', columns: 3 }
   * );
   *
   * // Access generated ID
   * console.log(entity.id);    // "flow-entity-abc123xyz"
   * console.log(entity.type);  // "flow-entity" or custom type
   * ```
   *
   * @see {@link Data} for data storage
   * @see {@link IEntityArguments} for configuration contract
   */
  constructor(node: N, type: string = "flow-entity", data?: D, config?: C) {
    this.node = node;
    this.type = type;
    this.data = data ?? (new Data() as D);
    this.config = config ?? ({} as C);
    this.id = "flow-entity-" + nanoid();
  }

  /**
   * Serialize entity to JSON representation
   *
   * Converts the entity and wrapped node to a JSON-serializable object.
   * Captures complete entity state including metadata, data, configuration,
   * and node state. Suitable for persistence, transmission, or reconstruction.
   *
   * ## Serialization Format
   * The resulting JSON object contains:
   * - `id`: Entity identifier (string)
   * - `type`: Entity type classifier (string)
   * - `data`: Serialized data from this.data.toJSON()
   * - `config`: Configuration object
   * - `node`: Serialized node from this.node.toJSON()
   *
   * ## Data Preservation
   * - Entity metadata preserved: id, type, config
   * - Data layer preserved: calls data.toJSON() for full data serialization
   * - Node state preserved: calls node.toJSON() for node-specific serialization
   * - All values are JSON-compatible (strings, numbers, objects, arrays)
   *
   * ## Serialization Strategy
   * - Recursive serialization: delegates to data.toJSON() and node.toJSON()
   * - Complete state capture: all mutable properties included
   * - No loss of information needed for reconstruction
   * - Safe for JSON.stringify() without custom replacers
   *
   * @returns JSON representation of entity state as Record with id, type, data, config, node
   *
   * @description
   * Assumes this.data and this.node implement toJSON() correctly.
   * Does not perform deep validation of nested serialization.
   * Result is safe to serialize with JSON.stringify().
   * Can be used with deserializer for reconstruction.
   *
   * @example
   * ```typescript
   * // Serialize entity to JSON
   * const entity = new FlowEntity(myNode);
   * const json = entity.toJSON();
   *
   * // Convert to string
   * const jsonString = JSON.stringify(json);
   *
   * // Store or transmit jsonString
   * // Later: reconstruct from string
   * const restored = JSON.parse(jsonString);
   * // Use restored to rebuild entity state
   * ```
   *
   * @see {@link Data.toJSON} for data serialization
   * @see {@link INode.toJSON} for node serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      type: this.type,
      data: this.data.toJSON(),
      config: this.config,
      node: this.node.toJSON(),
    };
  }

  /**
   * Release entity resources and cleanup
   *
   * Performs cleanup operations for the entity and wrapped node.
   * Safely delegates node disposal using duck-typing to avoid errors
   * if node doesn't implement dispose().
   *
   * ## Cleanup Behavior
   * - **Node Disposal**: Calls node.dispose() if method exists (type-safe)
   * - **Entity State**: No explicit entity state cleanup needed
   * - **Graceful Degradation**: No error if node lacks dispose() method
   * - **Duck Typing**: Checks for method existence before calling
   *
   * ## Resource Management
   * - Should be called when entity is no longer needed
   * - Prevents memory leaks from node resources
   * - Safe to call multiple times (idempotent)
   * - After dispose(), entity should not be reused
   *
   * ## Implementation Notes
   * - Uses runtime type check: `"dispose" in this.node && typeof this.node.dispose === "function"`
   * - Does not throw if node doesn't support disposal
   * - Allows graceful handling of heterogeneous node types
   * - Suitable for garbage collection preparation
   *
   * @returns void - No return value
   *
   * @description
   * Safely releases any resources held by the entity and its wrapped node.
   * Does not perform validation or error reporting beyond type checking.
   * Assumes node.dispose() completes synchronously.
   *
   * @example
   * ```typescript
   * // Create and use entity
   * const entity = new FlowEntity(myNode);
   * // ... use entity ...
   *
   * // Cleanup when done
   * entity.dispose();
   * // Entity can now be garbage collected
   *
   * // Safe to call on entities whose nodes lack dispose()
   * const simpleEntity = new FlowEntity(simpleNode);
   * simpleEntity.dispose();  // No error even if simpleNode has no dispose()
   * ```
   *
   * @see {@link INode.dispose} for node disposal interface
   */
  dispose(): void {
    // Safely dispose wrapped node if it supports disposal
    // Uses duck-typing to avoid errors with heterogeneous node types
    if ("dispose" in this.node && typeof this.node.dispose === "function") {
      this.node.dispose();
    }
  }
}
