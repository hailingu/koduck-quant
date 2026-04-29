/**
 * Entity convenience API for lifecycle and capability management.
 *
 * Provides high-level wrappers to create, query, and mutate entities that are
 * currently registered in the active `KoduckFlowRuntime`. All operations delegate
 * to the runtime proxy and therefore require an initialized runtime context.
 * Capability helpers intentionally perform defensive checks to avoid invoking
 * unsupported entity features.
 *
 * The Entity API provides functionality in three main areas:
 * 1. Lifecycle management: create, retrieve, remove, and batch operations
 * 2. Entity querying: check existence and retrieve all entities
 * 3. Capability execution: discover and execute dynamic entity capabilities
 *
 * Usage example:
 * ```typescript
 * import { createEntity, getEntity, removeEntity, executeCapability } from './entity';
 *
 * // Create an entity
 * const entity = createEntity('MyEntity', { name: 'Test' });
 * if (entity) {
 *   // Retrieve it
 *   const retrieved = getEntity(entity.id);
 *
 *   // Execute a capability
 *   const result = await executeCapability(entity, 'myCapability', 'arg1', 'arg2');
 *
 *   // Remove it
 *   removeEntity(entity.id);
 * }
 * ```
 *
 * @module entity
 * @see {@link ./render | Render API}
 * @see {@link ./flow | Flow API}
 * @see {@link ./manager | Manager API}
 */
import type { IEntity, IEntityArguments } from "../entity";
import { runtime } from "./runtime-context";

/**
 * Creates a new entity with the specified type name.
 *
 * Creates an entity registered in the active `KoduckFlowRuntime` with the given
 * type name and optional arguments. The entity is immediately available in the
 * runtime and can be queried via `getEntity`.
 *
 * @template {IEntity} T - The entity type to create (defaults to IEntity).
 * @param {string} typeName - The type name of the entity to create.
 * @param {IEntityArguments} [args] - Optional arguments to pass to the entity constructor.
 * @returns {T | null} The created entity or null if creation failed.
 *
 * Usage example:
 * ```typescript
 * import { createEntity } from './entity';
 *
 * interface MyEntity extends IEntity {
 * readonly name: string;
 * }
 *
 * const entity = createEntity<MyEntity>('MyEntity', { name: 'Test' });
 * if (entity) {
 * console.log(entity.name);
 * }
 * ```
 *
 * @see {@link getEntity | getEntity} for retrieving the created entity
 * @see {@link removeEntity | removeEntity} for deletion
 */
export function createEntity<T extends IEntity = IEntity>(
  typeName: string,
  args?: IEntityArguments
): T | null {
  return runtime.createEntity<T>(typeName, args);
}

/**
 * Retrieves an entity by its unique identifier.
 *
 * Fetches an entity from the active `KoduckFlowRuntime` by its ID. If the entity
 * does not exist, returns undefined.
 *
 * @template {IEntity} T - The entity type to retrieve (defaults to IEntity).
 * @param {string} id - The unique identifier of the entity to retrieve.
 * @returns {T | undefined} The entity or undefined if not found.
 *
 * Usage example:
 * ```typescript
 * import { getEntity } from './entity';
 *
 * const entity = getEntity('entity-id');
 * if (entity) {
 * console.log('Entity found:', entity.id);
 * } else {
 * console.log('Entity not found');
 * }
 * ```
 *
 * @see {@link hasEntity | hasEntity} to check existence before retrieval
 * @see {@link getEntities | getEntities} to retrieve all entities
 */
export function getEntity<T extends IEntity = IEntity>(id: string): T | undefined {
  return runtime.getEntity<T>(id);
}

/**
 * Removes an entity from the runtime.
 *
 * Deletes an entity from the active `KoduckFlowRuntime` by its ID. This is a permanent
 * operation. The entity is removed from all render pipelines and system registries.
 *
 * @param {string} id - The unique identifier of the entity to remove.
 * @returns {boolean} true if entity was successfully removed, false if entity was not found.
 *
 * Usage example:
 * ```typescript
 * import { removeEntity } from './entity';
 *
 * const success = removeEntity('entity-id');
 * if (success) {
 * console.log('Entity deleted');
 * } else {
 * console.log('Entity not found');
 * }
 * ```
 *
 * @see {@link removeEntities | removeEntities} for batch removal
 * @see {@link hasEntity | hasEntity} to check existence before removal
 */
export function removeEntity(id: string): boolean {
  return runtime.removeEntity(id);
}

/**
 * Checks if an entity exists in the runtime.
 *
 * Determines whether an entity with the given ID is currently registered in the
 * active `KoduckFlowRuntime`.
 *
 * @param {string} id - The unique identifier to check.
 * @returns {boolean} true if entity exists, false otherwise.
 *
 * Usage example:
 * ```typescript
 * import { hasEntity } from './entity';
 *
 * if (hasEntity('entity-id')) {
 * console.log('Entity exists');
 * }
 * ```
 *
 * @see {@link getEntity | getEntity} to retrieve the entity
 * @see {@link getEntities | getEntities} to get all entities
 */
export function hasEntity(id: string): boolean {
  return runtime.hasEntity(id);
}

/**
 * Retrieves all entities in the runtime.
 *
 * Returns an array of all entities currently registered in the active `KoduckFlowRuntime`.
 * The array is a snapshot at the time of the call.
 *
 * @returns {IEntity[]} Array of all entities in the runtime.
 *
 * Usage example:
 * ```typescript
 * import { getEntities } from './entity';
 *
 * const allEntities = getEntities();
 * console.log(`Total entities: ${allEntities.length}`);
 *
 * allEntities.forEach(entity => {
 * console.log(`Entity ID: ${entity.id}`);
 * });
 * ```
 *
 * @see {@link getEntity | getEntity} for retrieving a specific entity
 * @see {@link hasEntity | hasEntity} for existence checking
 */
export function getEntities(): IEntity[] {
  return runtime.getEntities();
}

/**
 * Removes multiple entities in batch.
 *
 * Deletes a collection of entities from the active `KoduckFlowRuntime` by their IDs.
 * This is more efficient than removing entities one by one.
 *
 * @param {string[]} ids - Array of unique identifiers to remove.
 * @returns {number} The number of entities successfully removed.
 *
 * Usage example:
 * ```typescript
 * import { removeEntities } from './entity';
 *
 * const idsToRemove = ['id-1', 'id-2', 'id-3'];
 * const removed = removeEntities(idsToRemove);
 * console.log(`Removed ${removed} entities`);
 * ```
 *
 * @see {@link removeEntity | removeEntity} for removing a single entity
 * @see {@link getEntities | getEntities} to get all entity IDs before removal
 */
export function removeEntities(ids: string[]): number {
  return runtime.removeEntities(ids);
}

/**
 * Executes a named capability on an entity with defensive error handling.
 *
 * Executes a dynamic capability (feature) on an entity with comprehensive error handling.
 * First checks if the entity has the capability, then executes it. Failures at any stage
 * are caught and logged, returning null instead of throwing.
 *
 * @template T - The return type of the capability (defaults to unknown).
 * @param {IEntity} entity - The entity to execute the capability on.
 * @param {string} capabilityName - The name of the capability to execute.
 * @param {...unknown[]} params - Variable arguments to pass to the capability.
 * @returns {Promise<T | null>} Promise resolving to the capability result or null on failure.
 *
 * Usage example:
 * ```typescript
 * import { executeCapability } from './entity';
 *
 * interface MyResult {
 * status: string;
 * data?: unknown;
 * }
 *
 * const entity = getEntity('entity-id');
 * if (entity) {
 * const result = await executeCapability<MyResult>(
 * entity,
 * 'myCapability',
 * 'arg1',
 * 'arg2'
 * );
 *
 * if (result) {
 * console.log('Capability executed:', result.status);
 * } else {
 * console.log('Capability execution failed');
 * }
 * }
 * ```
 *
 * @see {@link hasCapability | hasCapability} to check capability availability
 * @see {@link getEntityCapabilities | getEntityCapabilities} to list all capabilities
 */
export async function executeCapability<T = unknown>(
  entity: IEntity,
  capabilityName: string,
  ...params: unknown[]
): Promise<T | null> {
  try {
    const entityObj = entity as unknown as Record<string, unknown>;

    if (typeof entityObj.hasCapability === "function") {
      const hasCapabilityMethod = entityObj.hasCapability as (name: string) => boolean;
      const hasCapability = hasCapabilityMethod(capabilityName);
      if (!hasCapability) {
        console.warn(`Entity ${entity.id} does not have capability: ${capabilityName}`);
        return null;
      }
    }

    if (typeof entityObj.executeCapability === "function") {
      const executeMethod = entityObj.executeCapability as (...args: unknown[]) => Promise<T>;
      return await executeMethod(capabilityName, ...params);
    }

    console.warn(`Entity ${entity.id} does not support capability execution`);
    return null;
  } catch (error) {
    console.error(`Failed to execute capability ${capabilityName} on entity ${entity.id}:`, error);
    return null;
  }
}

/**
 * Checks if an entity has a specific capability.
 *
 * Determines whether an entity supports a particular capability (feature) with
 * defensive error handling. Returns false for any errors.
 *
 * @param {IEntity} entity - The entity to check.
 * @param {string} capabilityName - The name of the capability to check for.
 * @returns {boolean} true if entity has the capability, false otherwise or on error.
 *
 * Usage example:
 * ```typescript
 * import { hasCapability } from './entity';
 *
 * const entity = getEntity('entity-id');
 * if (entity && hasCapability(entity, 'myCapability')) {
 * console.log('Entity supports myCapability');
 * await executeCapability(entity, 'myCapability');
 * }
 * ```
 *
 * @see {@link executeCapability | executeCapability} to execute a capability
 * @see {@link getEntityCapabilities | getEntityCapabilities} to list all capabilities
 */
export function hasCapability(entity: IEntity, capabilityName: string): boolean {
  try {
    const entityObj = entity as unknown as Record<string, unknown>;
    if (typeof entityObj.hasCapability === "function") {
      const hasCapabilityMethod = entityObj.hasCapability as (name: string) => boolean;
      return hasCapabilityMethod(capabilityName);
    }
    return false;
  } catch (error) {
    console.error(`Failed to check capability ${capabilityName} for entity ${entity.id}:`, error);
    return false;
  }
}

/**
 * Retrieves all capabilities available on an entity.
 *
 * Returns a list of all capability (feature) names that an entity supports.
 * Returns an empty array if the entity doesn't support capability queries or on error.
 *
 * @param {IEntity} entity - The entity to query for capabilities.
 * @returns {string[]} Array of capability names, empty array if none or on error.
 *
 * Usage example:
 * ```typescript
 * import { getEntityCapabilities, hasCapability, executeCapability } from './entity';
 *
 * const entity = getEntity('entity-id');
 * if (entity) {
 * const capabilities = getEntityCapabilities(entity);
 * console.log('Available capabilities:', capabilities);
 *
 * capabilities.forEach(cap => {
 * if (hasCapability(entity, cap)) {
 * executeCapability(entity, cap);
 * }
 * });
 * }
 * ```
 *
 * @see {@link hasCapability | hasCapability} to check specific capability
 * @see {@link executeCapability | executeCapability} to execute a capability
 */
export function getEntityCapabilities(entity: IEntity): string[] {
  try {
    const entityObj = entity as unknown as Record<string, unknown>;
    if (typeof entityObj.getCapabilities === "function") {
      const getCapabilitiesMethod = entityObj.getCapabilities as () => string[];
      return getCapabilitiesMethod();
    }
    return [];
  } catch (error) {
    console.error(`Failed to get capabilities for entity ${entity.id}:`, error);
    return [];
  }
}
