/**
 * Entity Manager Module - Lifecycle and Registry Management for IEntity Instances
 *
 * Provides comprehensive entity lifecycle management, including creation, lookup, update, and removal.
 * The EntityManager serves as the central coordinator between entity registries and the application,
 * managing all entity instances and dispatching lifecycle events.
 *
 * **Core Responsibilities**:
 * - Entity lifecycle management (create → use → update → remove → dispose)
 * - Registry type registration and lookup
 * - Event dispatching at critical lifecycle points
 * - Integration with render hooks and entity event systems
 * - Graceful error handling and logging
 *
 * **Architecture Overview**:
 * - EntityManager: Main facade class (this file)
 * - EntityManagerCore: Core logic for entity CRUD operations
 * - EntityEventDispatcher: Event system integration
 * - EntityRegistryBridge: Registry lookup and metadata management
 * - EntityRenderHook: Render pipeline integration
 *
 * **Design Patterns**:
 * - **Facade Pattern**: Single unified interface for entity operations
 * - **Dependency Injection**: All subsystems injected via constructor
 * - **Observer Pattern**: Event-driven lifecycle notifications
 * - **Registry Pattern**: Type-based entity instantiation
 *
 * **Event System**:
 * Emits structured events at each lifecycle point:
 * - EntityManagerEvent.Init: Manager initialization
 * - EntityManagerEvent.EntityCreated: Entity successfully created
 * - EntityManagerEvent.EntityRemoved: Entity removed from system
 * - EntityManagerEvent.EntityLookup: Entity query operations
 * - EntityManagerEvent.Error: Error during operations
 *
 * **Performance Characteristics**:
 * - O(1) entity lookup by ID (HashMap-based)
 * - O(n) batch operations (linear in entity count)
 * - O(1) registry type lookup
 * - Event dispatch: O(k) where k = listener count
 *
 * **Usage Example**:
 * Create manager with dependencies → Register entity types → Create/update/query entities
 *
 * @see {@link EntityRegistry} - Entity type registration and instantiation
 * @see {@link IEntity} - Entity interface contract
 * @see {@link EntityManagerCore} - Core logic implementation
 *
 * @example
 * Creating and using the EntityManager:
 * ```typescript
 * // Initialize with dependencies
 * const manager = new EntityManager({
 *   registryBroker,
 *   renderEvents,
 *   entityEvents,
 * });
 *
 * // Register entity types
 * const nodeRegistry = new EntityRegistry(NodeEntity, { type: 'node' });
 * manager.registerEntityType('node', nodeRegistry);
 *
 * // Create entities
 * const entity = manager.createEntity('node', { position: { x: 0, y: 0 } });
 *
 * // Query and manipulate
 * const found = manager.getEntity(entity.id);
 * manager.updateEntity(found);
 * manager.removeEntity(entity.id);
 * ```
 */

import type { IDisposable } from "../disposable";
import { logger } from "../logger";
import type { EntityEventManager } from "../event/entity-event-manager";
import type { RenderEventManager } from "../event/render-event-manager";
import { EntityRegistry } from "./entity-registry";
import type { IManager } from "../manager/types";
import type { IEntity, IEntityArguments } from "./types";
import type { EntityUpdateDetail } from "./update-detail";
import { EntityManagerCore, type EntityManagerCoreDependencies } from "./entity-manager/core";
import { EntityEventDispatcher } from "./entity-manager/events";
import { EntityRegistryBridge } from "./entity-manager/registry-bridge";
import { EntityRenderHook } from "./entity-manager/render-hook";
import type { IRegistryBroker, RegistryEvent } from "../registry/broker";

/**
 * Event identifiers for EntityManager lifecycle and operations.
 *
 * Each event corresponds to a significant operation within the entity management system.
 * These events are logged and can be monitored for debugging and metrics collection.
 *
 * Event Categories:
 * - Initialization: Init event when manager is created
 * - Entity Lifecycle: EntityCreated, EntityRemoved, EntityLookup
 * - State Queries: EntityExists for existence checks
 * - Subsystem Events: RegistryBridge, RenderHook, EventDispatcher
 * - Error Handling: Error event for exception cases
 *
 * @example
 * Monitoring entity creation events:
 * ```typescript
 * eventBus.on(EntityManagerEvent.EntityCreated, (event) => {
 *   console.log(`Entity created: ${event.metadata.id}`);
 * });
 * ```
 */
export const EntityManagerEvent = {
  /** EntityManager instance initialization completed */
  Init: "entity-manager:init",
  /** Entity instance successfully created */
  EntityCreated: "entity-manager:entity-created",
  /** Entity instance removed from the system */
  EntityRemoved: "entity-manager:entity-removed",
  /** Entity lookup query executed */
  EntityLookup: "entity-manager:entity-lookup",
  /** Entity existence check performed */
  EntityExists: "entity-manager:entity-exists",
  /** Registry bridge operation executed */
  RegistryBridge: "entity-manager:registry-bridge",
  /** Render hook integrated with entity */
  RenderHook: "entity-manager:render-hook",
  /** Event dispatcher dispatched entity event */
  EventDispatcher: "entity-manager:event-dispatcher",
  /** Error during entity management operation */
  Error: "entity-manager:error",
} as const;

/**
 * Logger instance configured for EntityManager operations.
 *
 * Pre-configured with context tag and component metadata for consistent
 * logging across all EntityManager operations. Used internally for
 * event logging, debugging, and error tracking.
 *
 * @internal
 */
const entityLogger = logger.withContext({
  tag: "entity-manager",
  metadata: { component: "EntityManager" },
});

/**
 * EntityManager Dependencies Interface
 *
 * Specifies all required and optional dependencies for EntityManager construction.
 * Follows dependency injection pattern for testability and flexibility.
 *
 * @see {@link EntityManager} constructor for usage
 *
 * @example
 * ```typescript
 * const dependencies: EntityManagerDependencies = {
 *   registryBroker: createRegistryBroker(),
 *   renderEvents: createRenderEventManager(),
 *   entityEvents: createEntityEventManager(),
 * };
 * const manager = new EntityManager(dependencies);
 * ```
 */
export interface EntityManagerDependencies {
  /**
   * Registry broker for accessing and managing entity type registrations.
   *
   * Provides access to entity type registrations and notifies manager of
   * registry changes (add, remove, rebind operations).
   *
   * @see {@link IRegistryBroker}
   */
  registryBroker: IRegistryBroker;

  /**
   * Render event manager for integrating entities into the render pipeline.
   *
   * Used by EntityRenderHook to coordinate entity rendering lifecycle.
   * Required for proper render system integration.
   *
   * @see {@link RenderEventManager}
   */
  renderEvents: RenderEventManager;

  /**
   * Optional entity event manager for dispatching entity lifecycle events.
   *
   * If provided, entity creation/removal/update events will be dispatched.
   * If omitted, event dispatch is silently disabled (no error).
   *
   * @see {@link EntityEventManager}
   */
  entityEvents?: EntityEventManager<IEntity>;
}

/**
 * Entity Manager - Central Lifecycle and Registry Management for All Entities
 *
 * Implements IManager interface and provides entity lifecycle management functionality.
 * Acts as the facade layer between application code and internal entity subsystems.
 *
 * **Core Responsibilities**:
 * - Entity instance creation from registered types
 * - Entity lookup and querying by ID
 * - Entity updating (single and batch)
 * - Entity removal (single and batch)
 * - Entity type registration and management
 * - Integration with event system and render pipeline
 * - Graceful error handling with comprehensive logging
 *
 * **Properties**:
 * - type: "entity" - IManager interface compliance
 * - name: "EntityManager" - Human-readable name
 * - events: Public event manager for lifecycle events
 *
 * **Subsystems**:
 * - EntityManagerCore: Core CRUD operations
 * - EntityEventDispatcher: Event system bridge
 * - EntityRegistryBridge: Registry lookup and management
 * - EntityRenderHook: Render pipeline integration
 *
 * **Lifecycle Workflow**:
 * 1. Constructor: Initialize subsystems and register with broker
 * 2. Listen for registry changes: Registry added/removed/rebound
 * 3. Operations: Create, query, update, remove entities
 * 4. Dispose: Clean up listeners and release resources
 *
 * **Typical Usage Flow**:
 * ```
 * new EntityManager(deps) → registerEntityType() → createEntity() → updateEntity() → removeEntity()
 * ```
 *
 * @see {@link EntityRegistry} - Type registration
 * @see {@link EntityManagerCore} - Core implementation
 * @see {@link IEntity} - Entity interface
 */
export class EntityManager implements IManager, IDisposable {
  /**
   * Type identifier for IManager interface compliance.
   * Static readonly marker identifying this class as EntityManager.
   */
  static readonly type = "EntityManager";

  /**
   * Human-readable name: "EntityManager"
   * Used for identification in logging and debugging.
   */
  readonly name = "EntityManager";

  /**
   * Manager type: "entity"
   * Indicates this manager handles entity objects.
   */
  readonly type = "entity";

  /**
   * Internal storage map for entity instances.
   * Maps entity ID (string) to IEntity instance.
   * Performance: O(1) lookup, O(n) iteration.
   *
   * @internal
   */
  protected entityInstanceMap: Map<string, IEntity>;

  /**
   * Registry broker reference.
   * Used to access entity type registrations and listen for changes.
   *
   * @protected
   */
  protected registryBroker: IRegistryBroker;

  /**
   * Core logic implementation for entity CRUD operations.
   * Delegates business logic from manager.
   *
   * @private
   * @readonly
   */
  private readonly core: EntityManagerCore;

  /**
   * Event dispatcher for entity lifecycle events.
   * Bridges internal events to external event system.
   *
   * @private
   * @readonly
   */
  private readonly eventDispatcher: EntityEventDispatcher;

  /**
   * Registry bridge for type lookup and metadata management.
   * Provides registry-aware entity operations.
   *
   * @private
   * @readonly
   */
  private readonly registryBridge: EntityRegistryBridge;

  /**
   * Render hook integration for render pipeline coordination.
   * Manages entity render state during lifecycle.
   *
   * @private
   * @readonly
   */
  private readonly renderHook: EntityRenderHook;

  /**
   * Unsubscribe function for registry change listener.
   * Called during dispose() to clean up listener.
   *
   * @private
   * @readonly
   */
  private readonly registryChangeUnsubscribe?: () => void;

  /**
   * Public event manager for entity lifecycle events.
   * Exposed for external listeners to monitor entity operations.
   *
   * **Events**:
   * - EntityManagerEvent.EntityCreated: New entity created
   * - EntityManagerEvent.EntityRemoved: Entity removed
   * - EntityManagerEvent.EntityUpdated: Entity updated
   * - EntityManagerEvent.Error: Operation error
   *
   * @public
   * @readonly
   */
  public readonly events: EntityEventManager<IEntity>;

  /**
   * Constructs EntityManager with required dependencies.
   *
   * **Initialization Steps**:
   * 1. Store registry broker reference
   * 2. Register self with broker (for RegistryManager access)
   * 3. Subscribe to registry change events
   * 4. Create subsystem instances (bridge, hook, dispatcher, core)
   * 5. Log successful initialization
   *
   * **Error Handling**:
   * If dependencies are invalid, constructor throws error (fail-fast approach).
   *
   * @param registryBroker.registryBroker
   * @param registryBroker - Registry broker for type management
   * @param renderEvents - Render event manager instance
   * @param entityEvents - Optional entity event manager
   *
   * @param registryBroker.renderEvents
   * @param registryBroker.entityEvents
   * @throws {Error} If dependencies are invalid or initialization fails
   *
   * @example
   * ```typescript
   * const manager = new EntityManager({
   *   registryBroker: createRegistryBroker(),
   *   renderEvents: createRenderEventManager(),
   *   entityEvents: createEntityEventManager(),
   * });
   * ```
   */
  constructor({ registryBroker, renderEvents, entityEvents }: EntityManagerDependencies) {
    this.registryBroker = registryBroker;
    // Register itself to the broker so RegistryManager can access EntityManager methods via the broker
    this.registryBroker.registerEntityManager({
      getEntityTypeRegistry: this.getEntityTypeRegistry.bind(this),
    });

    // Set up event listeners to listen for registry change events
    this.registryChangeUnsubscribe = this.registryBroker.onRegistryChange(
      this.handleRegistryChange.bind(this)
    );

    this.registryBridge = new EntityRegistryBridge(this.registryBroker);
    this.renderHook = new EntityRenderHook(renderEvents);
    this.eventDispatcher = new EntityEventDispatcher(entityEvents);

    const store = new Map<string, IEntity>();
    const coreDeps: EntityManagerCoreDependencies = {
      store,
      registryBridge: this.registryBridge,
      events: this.eventDispatcher,
      renderHook: this.renderHook,
    };
    this.core = new EntityManagerCore(coreDeps);
    this.entityInstanceMap = store;
    this.events = this.eventDispatcher.events;

    entityLogger.info({
      event: EntityManagerEvent.Init,
      message: "EntityManager initialized",
      emoji: "🦆",
      metadata: {
        registryCount: this.registryBroker.getRegistryNames().length,
      },
    });
  }

  /**
   * Retrieves all entity instances currently managed.
   *
   * Returns a snapshot of all entities in the system at the time of call.
   * Mutations to the returned array do not affect internal storage.
   *
   * **Performance**: O(n) where n is the total entity count
   *
   * @returns Array of all IEntity instances, empty if no entities exist
   *
   * @example
   * ```typescript
   * // Get all entities
   * const allEntities = manager.getEntities();
   * console.log(`Total entities: ${allEntities.length}`);
   *
   * // Iterate through entities
   * allEntities.forEach(entity => {
   *   console.log(`Entity ${entity.id}: ${entity.type}`);
   * });
   * ```
   *
   * @see {@link getEntity} - Get single entity by ID
   */
  getEntities(): IEntity[] {
    const entities = this.core.getEntities();
    entityLogger.debug({
      event: EntityManagerEvent.EntityLookup,
      message: "Fetched all entities",
      emoji: "🔍",
      metadata: { count: entities.length },
    });
    return entities;
  }

  /**
   * Retrieves entity by unique identifier with optional type assertion.
   *
   * Performs O(1) lookup in the entity instance map.
   * Returns undefined if entity ID not found.
   * Supports generic type parameter for type-safe retrieval.
   *
   * **Type Safety**:
   * Generic type T allows runtime type specification and type checking.
   * If entity type doesn't match expected T, still returns the entity
   * (runtime type checking is application's responsibility).
   *
   * **Performance**: O(1) constant-time lookup
   *
   * @template T - Entity type for type-safe retrieval, defaults to IEntity
   * @param id - Unique entity identifier (string)
   * @returns Entity instance of type T, undefined if not found
   *
   * @example
   * ```typescript
   * // Get entity by ID
   * const entity = manager.getEntity(entityId);
   * if (entity) {
   *   console.log('Found:', entity.id);
   * }
   *
   * // Type-safe generic retrieval
   * const nodeEntity = manager.getEntity<IFlowNodeEntity>(nodeId);
   * if (nodeEntity) {
   *   nodeEntity.updatePosition(100, 100); // Typed methods available
   * }
   * ```
   *
   * @see {@link getEntities} - Get all entities
   * @see {@link removeEntity} - Remove entity by ID
   */
  getEntity<T extends IEntity = IEntity>(id: string): T | undefined {
    const entity = this.core.getEntity<T>(id);
    entityLogger.debug({
      event: EntityManagerEvent.EntityLookup,
      message: "Entity lookup by id",
      emoji: "🔎",
      metadata: { id, found: !!entity },
    });
    return entity;
  }

  /**
   * Removes entity from management by unique identifier.
   *
   * **Operation Details**:
   * - Performs entity lookup and removal from internal map
   * - Triggers entity disposal if applicable
   * - Notifies render system of entity removal
   * - Dispatches EntityRemoved event on success
   * - Idempotent: safe to call multiple times with same ID
   *
   * **Error Handling**:
   * Returns false if entity not found, does not throw exception.
   * All errors are logged with emoji indicators for easy debugging.
   *
   * **Performance**: O(1) constant-time removal
   *
   * @param id - Unique entity identifier to remove
   * @returns true if entity was removed, false if ID not found
   *
   * @example
   * ```typescript
   * // Remove single entity
   * if (manager.removeEntity(entityId)) {
   *   console.log('Entity removed successfully');
   * } else {
   *   console.warn('Entity not found');
   * }
   *
   * // Safe to call multiple times (idempotent)
   * manager.removeEntity(entityId); // true
   * manager.removeEntity(entityId); // false (already gone)
   * ```
   *
   * @see {@link removeEntities} - Remove multiple entities
   * @see {@link removeAllEntities} - Remove all entities
   * @see {@link getEntity} - Check if entity exists
   */
  removeEntity(id: string): boolean {
    const result = this.core.removeEntity(id);
    entityLogger.info({
      event: EntityManagerEvent.EntityRemoved,
      message: result ? "Entity removed" : "Entity not found for removal",
      emoji: result ? "🗑️" : "❓",
      metadata: { id, success: result },
    });
    return result;
  }

  /**
   * Checks if entity exists in the system by identifier.
   *
   * Fast existence check without retrieving the entity instance.
   * Useful for validation before attempting retrieval or removal operations.
   *
   * **Performance**: O(1) constant-time lookup
   *
   * @param id - Unique entity identifier to check
   * @returns true if entity exists, false otherwise
   *
   * @example
   * ```typescript
   * // Check before retrieval
   * if (manager.hasEntity(entityId)) {
   *   const entity = manager.getEntity(entityId);
   *   console.log('Entity:', entity);
   * } else {
   *   console.warn('Entity does not exist');
   * }
   *
   * // Conditional removal
   * const removed = manager.hasEntity(entityId) && manager.removeEntity(entityId);
   * if (removed) {
   *   console.log('Entity was present and removed');
   * }
   * ```
   *
   * @see {@link getEntity} - Retrieve entity instance
   * @see {@link removeEntity} - Remove entity
   */
  hasEntity(id: string): boolean {
    const exists = this.core.hasEntity(id);
    entityLogger.debug({
      event: EntityManagerEvent.EntityExists,
      message: "Entity existence check",
      emoji: exists ? "✅" : "❌",
      metadata: { id, exists },
    });
    return exists;
  }

  /**
   * Creates entity instance by registered type name (overload 1).
   *
   * @template T - Entity type, defaults to IEntity
   * @param typeName - Registered entity type name (e.g., "node", "edge")
   * @param args - Optional initialization arguments for entity constructor
   * @returns Created entity instance, null if type not found or creation fails
   *
   * @overload
   */
  createEntity<T extends IEntity = IEntity>(typeName: string, args?: IEntityArguments): T | null;

  /**
   * Creates entity instance using EntityRegistry (overload 2).
   *
   * @template T - Entity type, defaults to IEntity
   * @param registry - EntityRegistry instance containing constructor and metadata
   * @param args - Optional initialization arguments (overrides registry defaults)
   * @returns Created entity instance, null if creation fails
   *
   * @overload
   */
  createEntity<T extends IEntity = IEntity>(
    registry: EntityRegistry,
    args?: IEntityArguments
  ): T | null;

  /**
   * Creates entity instance - implementation (accepts both overload formats).
   *
   * **Behavior**:
   * - Accepts either string type name or EntityRegistry instance
   * - Delegates to EntityManagerCore for actual instantiation
   * - Handles errors gracefully, returns null on failure
   * - Logs comprehensive creation details with emoji indicators
   * - Dispatches EntityCreated event on success
   *
   * **Error Handling**:
   * All errors are caught and logged, method returns null instead of throwing.
   * This allows application to handle creation failure without try-catch.
   *
   * @template T - Entity type for type-safe instantiation
   * @param typeNameOrRegistry - Either string type name or EntityRegistry instance
   * @param args - Optional initialization arguments for constructor
   * @returns Entity instance on success, null if creation fails
   *
   * @example
   * ```typescript
   * // Create from type name
   * const node = manager.createEntity<IFlowNodeEntity>('node', { x: 100, y: 100 });
   *
   * // Create from registry
   * const registry = new EntityRegistry(CustomEntity, { initialized: true });
   * const custom = manager.createEntity<CustomEntity>(registry);
   *
   * // Error handling
   * if (!custom) {
   *   console.warn('Failed to create custom entity');
   * }
   * ```
   *
   * @see {@link EntityRegistry} - Entity type registration
   * @see {@link EntityManagerCore.createEntity} - Core implementation
   * @see {@link removeEntity} - Remove entity after creation
   */
  createEntity<T extends IEntity = IEntity>(
    typeNameOrRegistry: string | EntityRegistry,
    args?: IEntityArguments
  ): T | null {
    try {
      const entity = this.core.createEntity<T>(typeNameOrRegistry, args);
      entityLogger.info({
        event: EntityManagerEvent.EntityCreated,
        message: entity ? "Entity created" : "Entity creation failed",
        emoji: entity ? "✨" : "⚠️",
        metadata: {
          type:
            typeof typeNameOrRegistry === "string"
              ? typeNameOrRegistry
              : (typeNameOrRegistry.meta?.type ?? "unknown"),
          id: entity?.id,
        },
        details: args,
      });
      return entity;
    } catch (error) {
      entityLogger.error({
        event: EntityManagerEvent.Error,
        message: "Error during entity creation",
        emoji: "💥",
        error,
        metadata: {
          type:
            typeof typeNameOrRegistry === "string"
              ? typeNameOrRegistry
              : (typeNameOrRegistry.meta?.type ?? "unknown"),
        },
        details: args,
      });
      return null;
    }
  }

  /**
   * Updates entity properties and state.
   *
   * Marks entity as modified and triggers update in internal state.
   * Notifies render system to update entity rendering.
   * Dispatches EntityUpdated event.
   *
   * **Update Details**:
   * Optional EntityUpdateDetail parameter can specify which properties changed.
   * If provided, enables optimized update handling (e.g., partial re-renders).
   *
   * @template T - Entity type, defaults to IEntity
   * @param entity - Entity instance to update
   * @param detail - Optional update details specifying changed properties
   * @returns true if update successful, false if entity not found
   *
   * @example
   * ```typescript
   * // Update entity with position change
   * const entity = manager.getEntity(id);
   * if (entity && 'updatePosition' in entity) {
   *   entity.updatePosition(200, 150);
   *   manager.updateEntity(entity, { type: 'position' });
   * }
   * ```
   *
   * @see {@link batchUpdateEntity} - Update multiple entities
   * @see {@link getEntity} - Retrieve entity before updating
   */
  updateEntity<T extends IEntity = IEntity>(entity: T, detail?: EntityUpdateDetail): boolean {
    return this.core.updateEntity(entity, detail);
  }

  /**
   * Batch updates multiple entities in single operation.
   *
   * Performs efficient batch update of multiple entity instances.
   * Each entity is updated sequentially with potential optimization
   * from batch operation indicators.
   *
   * **Performance**:
   * - More efficient than individual updateEntity calls
   * - Useful for bulk operations after graph transformations
   * - O(n) where n is entity count
   *
   * @template T - Entity type, defaults to IEntity
   * @param entities - Array of entity instances to update
   * @param detail - Optional update details applied to all entities
   * @returns Number of entities successfully updated
   *
   * @example
   * ```typescript
   * // Update all visible entities
   * const visibleEntities = manager.getEntities().filter(e => e.isVisible);
   * const updated = manager.batchUpdateEntity(visibleEntities, { type: 'visibility' });
   * console.log(`Updated ${updated} entities`);
   * ```
   *
   * @see {@link updateEntity} - Update single entity
   * @see {@link removeEntities} - Remove multiple entities
   */
  batchUpdateEntity<T extends IEntity = IEntity>(
    entities: T[],
    detail?: EntityUpdateDetail
  ): number {
    return this.core.batchUpdateEntity(entities, detail);
  }

  /**
   * Removes multiple entities by their identifiers in batch operation.
   *
   * Efficiently removes a collection of entities from the system.
   * Idempotent: safe to include IDs that don't exist.
   *
   * **Performance**:
   * - More efficient than individual removeEntity calls
   * - O(n) where n is ID count
   *
   * @param ids - Array of unique entity identifiers to remove
   * @returns Number of entities actually removed (may be less than ids.length)
   *
   * @example
   * ```typescript
   * // Remove all orphaned nodes
   * const orphanedIds = findOrphanedNodeIds();
   * const removed = manager.removeEntities(orphanedIds);
   * console.log(`Removed ${removed} orphaned entities`);
   * ```
   *
   * @see {@link removeEntity} - Remove single entity
   * @see {@link removeAllEntities} - Remove all entities
   */
  removeEntities(ids: string[]): number {
    return this.core.removeEntities(ids);
  }

  /**
   * Removes all entities from the system.
   *
   * Clears all entity instances and resets internal storage.
   * Useful for:
   * - System reset or cleanup
   * - Transitioning to new flow diagram
   * - Memory cleanup before disposal
   *
   * **Warning**: This is destructive and cannot be undone.
   * Ensure you have saved entity state before calling.
   *
   * @returns Total number of entities removed
   *
   * @example
   * ```typescript
   * // Clear all entities and start fresh
   * const cleared = manager.removeAllEntities();
   * console.log(`Cleared ${cleared} entities from system`);
   * ```
   *
   * @see {@link removeEntity} - Remove single entity
   * @see {@link removeEntities} - Remove multiple entities
   */
  removeAllEntities(): number {
    return this.core.removeAllEntities();
  }

  /**
   * Retrieves all available entity type names that can be instantiated.
   *
   * Returns list of all registered entity type identifiers.
   * Useful for validation, dropdown lists, or type exploration.
   *
   * @returns Array of registered entity type names (e.g., ["node", "edge", "component"])
   *
   * @example
   * ```typescript
   * // Display available entity types
   * const types = manager.getAvailableTypes();
   * console.log('Available entity types:', types);
   *
   * // Validate entity type before creation
   * const requestedType = 'node';
   * if (manager.getAvailableTypes().includes(requestedType)) {
   *   const entity = manager.createEntity(requestedType);
   * }
   * ```
   *
   * @see {@link registerEntityType} - Register new entity type
   * @see {@link hasEntityType} - Check if specific type exists
   */
  getAvailableTypes(): string[] {
    return this.core.getAvailableTypes();
  }

  /**
   * Registers entity type for runtime instantiation.
   *
   * Adds new entity type to the manager's registry.
   * Once registered, entities of this type can be created using createEntity().
   * Typically called during system initialization for all supported entity types.
   *
   * **Registration Process**:
   * 1. Registry holds constructor and default arguments
   * 2. Type name becomes available in getAvailableTypes()
   * 3. createEntity(typeName) can now instantiate this type
   * 4. Registration is permanent for manager lifetime
   *
   * **Best Practices**:
   * - Register all types before first createEntity call
   * - Use consistent, lowercase type names (e.g., "node", "edge")
   * - Combine related types (Button, TextField → "button", "text-field")
   *
   * @param typeName - Unique entity type name (e.g., "node", "edge")
   * @param registry - EntityRegistry instance with constructor and defaults
   *
   * @example
   * ```typescript
   * // Register flow node type
   * const nodeRegistry = new EntityRegistry(
   *   NodeEntity,
   *   { x: 0, y: 0, width: 120, height: 60 },
   *   { type: "node", description: "Flow diagram node" }
   * );
   * manager.registerEntityType("node", nodeRegistry);
   *
   * // Now can create nodes
   * const node = manager.createEntity("node", { x: 100, y: 100 });
   * ```
   *
   * @see {@link getAvailableTypes} - Get all registered types
   * @see {@link hasEntityType} - Check type registration
   * @see {@link createEntity} - Create entities by type name
   */
  registerEntityType(typeName: string, registry: EntityRegistry): void {
    this.core.registerEntityType(typeName, registry);
  }

  /**
   * Checks if entity type name is registered in the manager.
   *
   * Quick predicate check before attempting creation.
   * Returns false for unknown types.
   *
   * @param typeName - Entity type name to check
   * @returns true if type is registered, false otherwise
   *
   * @example
   * ```typescript
   * // Conditional creation
   * if (manager.hasEntityType('node')) {
   *   const node = manager.createEntity('node');
   * } else {
   *   console.warn('Node type not registered');
   * }
   * ```
   *
   * @see {@link getAvailableTypes} - Get all registered types
   * @see {@link registerEntityType} - Register new type
   */
  hasEntityType(typeName: string): boolean {
    return this.core.hasEntityType(typeName);
  }

  /**
   * Retrieves entity type registration information by name.
   *
   * Returns EntityRegistry instance if type is registered.
   * Returns undefined if type unknown or not found.
   * Useful for introspection and metadata access.
   *
   * @param typeName - Entity type name to lookup
   * @returns EntityRegistry if found, undefined otherwise
   *
   * @example
   * ```typescript
   * // Get registry for type inspection
   * const registry = manager.getEntityTypeRegistry('node');
   * if (registry) {
   *   console.log('Node registry meta:', registry.meta);
   *   console.log('Default args:', registry.args);
   * }
   * ```
   *
   * @see {@link hasEntityType} - Check if type exists
   * @see {@link getAvailableTypes} - List all types
   */
  getEntityTypeRegistry(typeName: string): EntityRegistry | undefined {
    return this.core.getEntityTypeRegistry(typeName);
  }

  /**
   * Handles registry broker change notifications.
   *
   * Internal method called by registry broker when registration state changes.
   * Responds to registry add, remove, and rebind events.
   * Can extend this method in subclasses for custom behavior.
   *
   * **Event Types Handled**:
   * - REGISTRY_ADDED: New registry was added to broker
   * - REGISTRY_REMOVED: Registry was removed from broker
   * - DEFAULT_REGISTRY_CHANGED: Default registry changed
   * - TYPE_BOUND: Type was bound to registry
   * - TYPE_UNBOUND: Type was unbound from registry
   *
   * **Current Implementation**:
   * Currently a pass-through placeholder.
   * Extension point for subclasses to add custom logic.
   *
   * @param event - RegistryEvent describing the change
   *
   * @internal
   * @private
   */
  private handleRegistryChange(event: RegistryEvent): void {
    // When registry changes occur, can add handling logic here
    // E.g.: Update caches, rebind types, notify listeners
    switch (event.type) {
      case "REGISTRY_ADDED":
        // Handle registry added
        break;
      case "REGISTRY_REMOVED":
        // Handle registry removed
        break;
      case "DEFAULT_REGISTRY_CHANGED":
        // Handle default registry changed
        break;
      case "TYPE_BOUND":
        // Handle type bound
        break;
      case "TYPE_UNBOUND":
        // Handle type unbound
        break;
    }
  }

  /**
   * Disposes of EntityManager and releases all resources.
   *
   * **Cleanup Operations**:
   * - Unsubscribe from registry broker change events
   * - Clear all entity instances from storage
   * - Dispose core subsystems
   * - Release event listeners
   *
   * **After Disposal**:
   * - Manager cannot be used further
   * - All entity references become invalid
   * - Storage is cleared
   *
   * **Important**:
   * Always call dispose() before discarding manager reference.
   * Failure to dispose may leak resources and event listeners.
   *
   * @example
   * ```typescript
   * // Cleanup after use
   * manager.dispose();
   *
   * // All operations now invalid
   * // manager.createEntity(...); // Error or no-op
   * ```
   *
   * @see {@link IDisposable} - Disposable interface
   */
  dispose(): void {
    this.registryChangeUnsubscribe?.();
    this.core.dispose();
  }
}

/**
 * Factory function to create EntityManager instance.
 *
 * Recommended approach for EntityManager instantiation.
 * Encapsulates instantiation logic and allows for future extensions
 * (e.g., singleton pattern, object pooling, or interception).
 *
 * **Why use factory instead of new**:
 * - Allows transparent implementation changes
 * - Enables dependency injection framework integration
 * - Supports future optimizations without API changes
 * - Cleaner semantics: "create" vs "new"
 *
 * @param deps - EntityManager dependencies (registryBroker, renderEvents, entityEvents)
 * @returns New EntityManager instance ready to use
 *
 * @example
 * ```typescript
 * // Create manager using factory
 * const manager = createEntityManager({
 *   registryBroker: broker,
 *   renderEvents: renderEventManager,
 *   entityEvents: entityEventManager,
 * });
 *
 * // Equivalent to:
 * // const manager = new EntityManager({ ... });
 *
 * // Use manager
 * manager.registerEntityType('node', nodeRegistry);
 * const entity = manager.createEntity('node');
 * ```
 *
 * @see {@link EntityManager} - Main EntityManager class
 * @see {@link EntityManagerDependencies} - Dependencies interface
 */
export function createEntityManager(deps: EntityManagerDependencies): EntityManager {
  return new EntityManager(deps);
}
