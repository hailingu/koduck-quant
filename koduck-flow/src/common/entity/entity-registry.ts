/**
 * Entity Registry Module - Concrete Registry Implementation for IEntity
 *
 * Provides the concrete implementation of IRegistry interface specialized for IEntity types.
 * This is a registry item (data holder), not the registry manager itself.
 * It stores all metadata needed to construct an entity instance on demand.
 *
 * **Design Purpose**:
 * Registry pattern separates entity class definitions from their construction metadata.
 * Enables:
 * - Lazy entity instantiation
 * - Centralized entity type registration
 * - Factory-based entity creation
 * - Type-safe entity management
 *
 * **Registration Workflow**:
 * 1. Define entity class (extends Entity<D, C>)
 * 2. Create EntityRegistry with constructor and metadata
 * 3. Register with RegistryManager using entity type name
 * 4. RegistryManager can later retrieve and instantiate entities
 *
 * **Typical Usage Flow**:
 * Entity Class → EntityRegistry (holds metadata) → RegistryManager → instantiation → Entity instance
 *
 * **Key Responsibilities**:
 * - Store entity constructor function
 * - Store optional constructor arguments
 * - Manage entity metadata (type, description)
 * - Provide factory method to create instances
 *
 * **Performance**:
 * - O(1) registry lookup
 * - O(1) instance creation (single constructor call)
 * - Metadata cached at registration time
 *
 * @see {@link IRegistry} - Registry interface contract
 * @see {@link IEntity} - Entity interface
 * @see {@link RegistryManager} - Central registry manager
 *
 * @example
 * Basic entity registry creation and usage:
 * - Create registry: new EntityRegistry(MyEntityClass, initialArgs, metadata)
 * - Register: registryManager.register("myEntity", entityRegistry)
 * - Instantiate: registry.createInstance()
 */

import { type IEntity, type IEntityArguments, type IEntityConstructor } from "./types";
import { type IRegistry, type IMeta } from "../registry/types";

/**
 * Concrete Registry Implementation for IEntity
 *
 * Stores construction metadata for a specific entity type.
 * Implements IRegistry<IEntity> to provide type-safe registry behavior.
 * Instances of this class are typically managed by RegistryManager.
 *
 * **What it stores**:
 * - entityConstructor: The entity class constructor function
 * - args: Optional initialization arguments for the constructor
 * - meta: Metadata about the entity (type name, description, etc.)
 *
 * **What it does**:
 * - Provides factory methods to create entity instances
 * - Returns metadata about the entity type
 * - Supports lazy instantiation pattern
 *
 * **Type Parameters**:
 * - IEntity: The entity interface contract
 * - IRegistry<IEntity>: The registry contract
 *
 * @example
 * Creating and using an EntityRegistry:
 *
 * Define custom entity:
 * class FlowNodeEntity extends Entity {
 *   static type = "FlowNode";
 * }
 *
 * Create registry:
 * const registry = new EntityRegistry(
 *   FlowNodeEntity,
 *   { position: { x: 0, y: 0 } },
 *   { type: "FlowNode", description: "Standard flow node" }
 * );
 *
 * Register with manager:
 * registryManager.register("FlowNode", registry);
 *
 * Later retrieve and instantiate:
 * const registry = registryManager.getRegistry("FlowNode");
 * const instance = registry.createInstance();
 * console.log(instance.type); // "FlowNode"
 */
export class EntityRegistry implements IRegistry<IEntity> {
  /**
   * Entity constructor function stored for later instantiation.
   *
   * Called by createInstance() to create new entity instances.
   * Readonly to prevent accidental modification after registration.
   * Type: IEntityConstructor<IEntity> ensures type safety.
   */
  public readonly entityConstructor: IEntityConstructor<IEntity>;

  /**
   * Optional initialization arguments passed to entity constructor.
   *
   * Used when creating new instances via createInstance().
   * If undefined, entity constructor called with no arguments.
   * Typical usage: passing initial data or configuration.
   *
   * Type: IEntityArguments allows flexible key-value configuration.
   */
  public readonly args?: IEntityArguments;

  /**
   * Metadata describing this entity type.
   *
   * Includes:
   * - type: Entity type identifier (from constructor or class name)
   * - description: Human-readable description
   * - Additional custom metadata from user
   *
   * Always defined (never undefined), uses sensible defaults if not provided.
   */
  public readonly meta?: IMeta;

  /**
   * Creates a new EntityRegistry for a specific entity class.
   *
   * Stores all metadata needed to:
   * - Identify the entity type
   * - Construct new instances
   * - Access metadata about the entity
   *
   * **Constructor Behavior**:
   * - Stores the entity constructor function as-is
   * - Only stores args if explicitly provided (not null/undefined)
   * - Generates meta with sensible defaults if not fully specified
   * - Type name comes from constructor.type or constructor.name (fallback)
   * - Description generated from entity type if not provided
   *
   * @param entityConstructor - Entity class constructor function
   * Must be a valid constructor that returns IEntity instances
   * Typically extends Entity<D, C> class
   *
   * @param args - Optional initialization arguments for the entity constructor
   * Passed to constructor when creating new instances via createInstance()
   * If undefined/null, entity created with no arguments
   * Useful for pre-configured entity initialization
   *
   * @param meta - Optional metadata about this entity type
   * Merged with generated metadata
   * Can include type, description, and custom properties
   * Type field overrides constructor-derived type if provided
   *
   * @example
   * Simple registry creation:
   * const registry = new EntityRegistry(MyEntity);
   *
   * With initialization arguments:
   * const registry = new EntityRegistry(
   *   MyEntity,
   *   { color: "red", size: "large" }
   * );
   *
   * With full metadata:
   * const registry = new EntityRegistry(
   *   MyEntity,
   *   { x: 100, y: 100 },
   *   { type: "Node", description: "Flow diagram node" }
   * );
   */
  constructor(
    entityConstructor: IEntityConstructor<IEntity>,
    args?: IEntityArguments,
    meta?: IMeta
  ) {
    this.entityConstructor = entityConstructor;
    if (args !== undefined) {
      this.args = args;
    }
    this.meta = {
      type: entityConstructor.type || (entityConstructor as { name: string }).name,
      description:
        meta?.description || `Registry for ${(entityConstructor as { name: string }).name}`,
      ...meta,
    };
  }

  /**
   * Gets the entity constructor function stored in this registry.
   *
   * Returns the same IEntityConstructor provided at construction.
   * Used for reflection, type checking, or direct instantiation.
   *
   * @returns The entity constructor function
   *
   * @example
   * const Constructor = registry.getConstructor();
   * const instance = new Constructor(args);
   */
  public getConstructor(): IEntityConstructor<IEntity> {
    return this.entityConstructor;
  }

  /**
   * Creates a new entity instance using stored constructor and arguments.
   *
   * Factory method implementing lazy instantiation pattern.
   * Calls stored entityConstructor with stored args (if any).
   *
   * **Behavior**:
   * - If args stored: passes args to constructor
   * - If no args: calls constructor with no arguments
   * - Returns fully initialized IEntity instance
   * - Each call creates a new independent instance
   *
   * **Performance**: O(1) - single constructor invocation
   *
   * @returns New entity instance configured with stored arguments
   *
   * @throws May throw if constructor fails (e.g., invalid args)
   *
   * @example
   * Create single instance:
   * const entity = registry.createInstance();
   *
   * Create multiple instances:
   * const entities = [
   *   registry.createInstance(),
   *   registry.createInstance(),
   *   registry.createInstance()
   * ];
   * // Each is independent with fresh state
   */
  public createInstance(): IEntity {
    if (this.args) {
      return new this.entityConstructor(this.args);
    } else {
      return new this.entityConstructor();
    }
  }
}
