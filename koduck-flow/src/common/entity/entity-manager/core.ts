import type { IEntity, IEntityArguments } from "../types";
import type { EntityUpdateDetail } from "../update-detail";
import { ErrorCode, ErrorSeverity, logError } from "../../errors";
import type { EntityRegistry } from "../entity-registry";
import { EntityRegistryBridge } from "./registry-bridge";
import { EntityEventDispatcher } from "./events";
import { EntityRenderHook } from "./render-hook";
import { borrowEntityArray, releaseEntityArray } from "../../memory";

/**
 * @module src/common/entity/entity-manager/core
 * @description Core entity manager that handles CRUD operations for entities,
 * type registration, and lifecycle event management
 */

/**
 * Dependencies injected into EntityManagerCore
 * @typedef {Object} EntityManagerCoreDependencies
 * @property {Map<string, IEntity>} [store] - Optional pre-existing entity store,
 * defaults to new Map if not provided
 * @property {EntityRegistryBridge} registryBridge - Bridge for entity type registration and resolution
 * @property {EntityEventDispatcher} events - Dispatcher for entity lifecycle events
 * @property {EntityRenderHook} renderHook - Hook for render lifecycle callbacks
 */
export interface EntityManagerCoreDependencies {
  store?: Map<string, IEntity>;
  registryBridge: EntityRegistryBridge;
  events: EntityEventDispatcher;
  renderHook: EntityRenderHook;
}

/**
 * Core entity manager for CRUD operations and type management
 * @class
 * @description Manages entity storage, creation, updates, removal, and type registration.
 * Coordinates with event dispatcher and render hook for lifecycle management.
 */
export class EntityManagerCore {
  private readonly store: Map<string, IEntity>;
  private readonly registryBridge: EntityRegistryBridge;
  private readonly events: EntityEventDispatcher;
  private readonly renderHook: EntityRenderHook;

  /**
   * Create a new EntityManagerCore instance
   * @param {EntityManagerCoreDependencies} deps - Dependency injection object with
   * store, registryBridge, events, and renderHook
   */
  constructor(deps: EntityManagerCoreDependencies) {
    this.store = deps.store ?? new Map<string, IEntity>();
    this.registryBridge = deps.registryBridge;
    this.events = deps.events;
    this.renderHook = deps.renderHook;
  }

  /**
   * Get the internal entity store map
   * @returns {Map<string, IEntity>} Reference to the internal store
   */
  getStore(): Map<string, IEntity> {
    return this.store;
  }

  /**
   * Get all entities as an array
   * @returns {IEntity[]} Array copy of all stored entities
   */
  getEntities(): IEntity[] {
    return Array.from(this.store.values());
  }

  /**
   * Get a single entity by ID with type casting support
   * @template T - Entity type (defaults to IEntity)
   * @param {string} id - Unique entity identifier
   * @returns {T | undefined} The entity if found and valid, undefined otherwise
   * @example
   * const entity = manager.getEntity<MyEntity>('entity-123');
   * if (entity) {
   *   console.log(entity.type);
   * }
   */
  getEntity<T extends IEntity = IEntity>(id: string): T | undefined {
    if (!this.isValidId(id)) {
      logError(ErrorCode.ENTITY_INVALID_ID, `Invalid entity ID provided: ${id}`, {
        severity: ErrorSeverity.WARNING,
        context: { providedId: id, idType: typeof id },
      });
      return undefined;
    }
    return this.store.get(id) as T | undefined;
  }

  /**
   * Check if an entity exists in the store
   * @param {string} id - Entity identifier to check
   * @returns {boolean} True if entity exists, false otherwise
   */
  hasEntity(id: string): boolean {
    return this.store.has(id);
  }

  /**
   * Create and register a new entity
   * @template T - Entity type (defaults to IEntity)
   * @param {string | EntityRegistry} typeNameOrRegistry - Either a type name string (for registered types)
   * or an EntityRegistry object for inline type definition
   * @param {IEntityArguments} [args] - Initialization arguments passed to entity constructor
   * @returns {T | null} The created entity instance, or null if creation failed
   * @throws Logs error internally but does not throw; errors are logged with context
   * @example
   * const entity = manager.createEntity('my-type', { initialData: {} });
   * if (entity) {
   *   console.log(`Created entity: ${entity.id}`);
   * }
   */
  createEntity<T extends IEntity = IEntity>(
    typeNameOrRegistry: string | EntityRegistry,
    args?: IEntityArguments
  ): T | null {
    const resolution = this.registryBridge.resolveRegistry(typeNameOrRegistry);
    if (!resolution) {
      const typeName =
        typeof typeNameOrRegistry === "string" ? typeNameOrRegistry : typeNameOrRegistry.meta?.type;
      logError(ErrorCode.ENTITY_TYPE_NOT_REGISTERED, `Entity type "${typeName}" not registered`, {
        severity: ErrorSeverity.WARNING,
        context: {
          typeName,
          availableTypes: this.registryBridge.getAvailableTypes(),
        },
      });
      return null;
    }

    try {
      const entity = this.registryBridge.instantiateEntity<T>(resolution.registry, args);
      this.store.set(entity.id, entity);

      try {
        this.events.fireAdd(entity);
      } catch (error) {
        logError(
          ErrorCode.EVENT_DISPATCH_FAILED,
          `Failed to dispatch entity add event for entity "${entity.id}"`,
          {
            severity: ErrorSeverity.ERROR,
            context: { entityId: entity.id, entityType: entity.type },
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }

      this.renderHook.entityCreated(entity.id);
      return entity;
    } catch (error) {
      const typeName =
        typeof typeNameOrRegistry === "string"
          ? typeNameOrRegistry
          : resolution.registry.meta?.type;

      logError(ErrorCode.ENTITY_CREATION_FAILED, `Failed to create entity of type "${typeName}"`, {
        severity: ErrorSeverity.ERROR,
        context: { typeName, args },
        cause: error instanceof Error ? error : new Error(String(error)),
      });
      return null;
    }
  }

  /**
   * Update a single entity instance
   * @template T - Entity type (defaults to IEntity)
   * @param {T} entity - The entity object with updated properties and valid id
   * @param {EntityUpdateDetail} [detail] - Optional update detail information for tracking
   * what changed in the entity
   * @returns {boolean} True if update succeeded, false if entity invalid or not found
   * @example
   * const success = manager.updateEntity(updatedEntity, { changedFields: ['name'] });
   * if (success) {
   *   console.log('Entity updated');
   * }
   */
  updateEntity<T extends IEntity = IEntity>(entity: T, detail?: EntityUpdateDetail): boolean {
    if (!entity || !entity.id) {
      logError(ErrorCode.ENTITY_INVALID_ARGS, "Invalid entity provided for update", {
        severity: ErrorSeverity.WARNING,
        context: { entity },
      });
      return false;
    }

    if (!this.store.has(entity.id)) {
      logError(ErrorCode.ENTITY_NOT_FOUND, `Entity with ID "${entity.id}" not found for update`, {
        severity: ErrorSeverity.WARNING,
        context: {
          entityId: entity.id,
          entityType: entity.type,
          availableEntityIds: Array.from(this.store.keys()),
        },
      });
      return false;
    }

    const updatedEntities = borrowEntityArray<IEntity>();

    try {
      this.store.set(entity.id, entity);
      updatedEntities.push(entity);

      this._emitUpdateEvents(updatedEntities, detail);
      this.renderHook.entityUpdated(entity.id);
      return true;
    } catch (error) {
      logError(ErrorCode.ENTITY_UPDATE_FAILED, `Failed to update entity "${entity.id}"`, {
        severity: ErrorSeverity.ERROR,
        context: { entityId: entity.id, entityType: entity.type },
        cause: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    } finally {
      releaseEntityArray(updatedEntities);
    }
  }

  /**
   * Update multiple entities in a batch operation
   * @template T - Entity type (defaults to IEntity)
   * @param {T[]} entities - Array of entity objects to update, each must have valid id
   * @param {EntityUpdateDetail} [detail] - Optional update detail information applied to all entities
   * @returns {number} Number of entities successfully updated
   * @example
   * const count = manager.batchUpdateEntity([entity1, entity2], { changedFields: ['status'] });
   * console.log(`Updated ${count} entities`);
   */
  batchUpdateEntity<T extends IEntity = IEntity>(
    entities: T[],
    detail?: EntityUpdateDetail
  ): number {
    if (!Array.isArray(entities)) {
      logError(ErrorCode.ENTITY_INVALID_ARGS, "Invalid parameter: entities must be an array", {
        severity: ErrorSeverity.WARNING,
        context: { providedValue: entities, expectedType: "IEntity[]" },
      });
      return 0;
    }

    if (entities.length === 0) {
      return 0;
    }

    const updatedEntities = borrowEntityArray<IEntity>();

    try {
      const updatedCount = this._collectUpdatedEntities(entities, updatedEntities);
      this._emitUpdateEvents(updatedEntities, detail);
      return updatedCount;
    } finally {
      releaseEntityArray(updatedEntities);
    }
  }

  private _collectUpdatedEntities<T extends IEntity>(entities: T[], bucket: IEntity[]): number {
    let updatedCount = 0;
    for (const entity of entities) {
      if (!entity || !entity.id) {
        continue;
      }
      if (!this.store.has(entity.id)) {
        continue;
      }
      try {
        this.store.set(entity.id, entity);
        bucket.push(entity);
        updatedCount += 1;
      } catch (error) {
        logError(
          ErrorCode.ENTITY_UPDATE_FAILED,
          `Failed to update entity "${entity.id}" in batch operation`,
          {
            severity: ErrorSeverity.ERROR,
            context: { entityId: entity.id, entityType: entity.type },
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }
    }
    return updatedCount;
  }

  private _emitUpdateEvents(updatedEntities: IEntity[], detail?: EntityUpdateDetail): void {
    for (const entity of updatedEntities) {
      try {
        if (detail) {
          this.events.fireUpdateWithDetail(entity, detail);
        } else {
          this.events.fireUpdate(entity);
        }
      } catch (error) {
        logError(
          ErrorCode.EVENT_DISPATCH_FAILED,
          `Failed to dispatch entity update event for entity "${entity.id}"`,
          {
            severity: ErrorSeverity.ERROR,
            context: { entityId: entity.id, entityType: entity.type },
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }
    }
  }

  /**
   * Remove a single entity by ID
   * @param {string} id - Entity identifier to remove
   * @returns {boolean} True if entity was found and removed, false otherwise
   * @example
   * const success = manager.removeEntity('entity-123');
   * if (success) {
   *   console.log('Entity removed');
   * }
   */
  removeEntity(id: string): boolean {
    if (!this.isValidId(id)) {
      logError(ErrorCode.ENTITY_INVALID_ID, `Invalid entity ID provided for removal: ${id}`, {
        severity: ErrorSeverity.WARNING,
        context: { providedId: id, idType: typeof id },
      });
      return false;
    }

    const entity = this.store.get(id);

    if (!entity) {
      logError(ErrorCode.ENTITY_NOT_FOUND, `Entity with ID "${id}" not found for removal`, {
        severity: ErrorSeverity.WARNING,
        context: {
          id,
          availableEntityIds: Array.from(this.store.keys()),
        },
      });
      return false;
    }

    const removed = this.store.delete(id);
    if (removed) {
      try {
        this.events.fireRemove(entity);
      } catch (error) {
        logError(
          ErrorCode.EVENT_DISPATCH_FAILED,
          `Failed to dispatch entity removal event for entity "${id}"`,
          {
            severity: ErrorSeverity.ERROR,
            context: { entityId: id, entityType: entity.type },
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }

      this.renderHook.entityRemoved(entity.id);
    }

    return removed;
  }

  /**
   * Remove multiple entities by IDs
   * @param {string[]} ids - Array of entity identifiers to remove
   * @returns {number} Number of entities successfully removed
   * @example
   * const count = manager.removeEntities(['entity-1', 'entity-2', 'entity-3']);
   * console.log(`Removed ${count} entities`);
   */
  removeEntities(ids: string[]): number {
    if (!Array.isArray(ids)) {
      logError(ErrorCode.ENTITY_INVALID_ARGS, "Invalid parameter: ids must be an array", {
        severity: ErrorSeverity.WARNING,
        context: { providedValue: ids, expectedType: "string[]" },
      });
      return 0;
    }

    if (ids.length === 0) {
      return 0;
    }

    let removedCount = 0;
    const removedEntities = borrowEntityArray<IEntity>();

    try {
      for (const id of ids) {
        if (!this.isValidId(id)) {
          continue;
        }
        const entity = this.store.get(id);
        if (entity && this.store.delete(id)) {
          removedEntities.push(entity);
          removedCount += 1;
        }
      }

      for (const entity of removedEntities) {
        try {
          this.events.fireRemove(entity);
        } catch (error) {
          logError(
            ErrorCode.EVENT_DISPATCH_FAILED,
            `Failed to dispatch entity removal event for entity "${entity.id}"`,
            {
              severity: ErrorSeverity.ERROR,
              context: { entityId: entity.id, entityType: entity.type },
              cause: error instanceof Error ? error : new Error(String(error)),
            }
          );
        }
      }

      if (removedEntities.length > 0) {
        this.renderHook.entitiesRemoved(removedEntities.map((entity) => entity.id));
      }

      return removedCount;
    } finally {
      releaseEntityArray(removedEntities);
    }
  }

  /**
   * Remove all entities from the store
   * @returns {number} Total number of entities that were removed
   * @example
   * const total = manager.removeAllEntities();
   * console.log(`Removed all ${total} entities`);
   */
  removeAllEntities(): number {
    return this.removeEntities(Array.from(this.store.keys()));
  }

  /**
   * Get all registered entity type names
   * @returns {string[]} Array of available entity type identifiers
   */
  getAvailableTypes(): string[] {
    return this.registryBridge.getAvailableTypes();
  }

  /**
   * Register a new entity type
   * @param {string} typeName - Unique identifier for the entity type
   * @param {EntityRegistry} registry - Registry configuration for the entity type,
   * contains meta information, factory, and handlers
   * @example
   * manager.registerEntityType('custom-node', customNodeRegistry);
   */
  registerEntityType(typeName: string, registry: EntityRegistry): void {
    this.registryBridge.registerType(typeName, registry);
  }

  /**
   * Check if an entity type is registered
   * @param {string} typeName - Type identifier to check
   * @returns {boolean} True if type is registered, false otherwise
   */
  hasEntityType(typeName: string): boolean {
    return this.registryBridge.hasType(typeName);
  }

  /**
   * Get the registry configuration for an entity type
   * @param {string} typeName - Type identifier to look up
   * @returns {EntityRegistry | undefined} Registry configuration if found, undefined otherwise
   */
  getEntityTypeRegistry(typeName: string): EntityRegistry | undefined {
    return this.registryBridge.getRegistry(typeName);
  }

  /**
   * Dispose of all resources and clean up
   * Removes all entities and cleans up event dispatcher
   * @example
   * manager.dispose(); // Called when shutting down the entity manager
   */
  dispose(): void {
    this.removeAllEntities();
    this.events.dispose();
  }

  private isValidId(id: unknown): id is string {
    return typeof id === "string" && id.length > 0;
  }
}
