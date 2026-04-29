import type { IEntity } from "../entity/types";
import type { IRegistryManager, IRegistry } from "./types";

/**
 * RegistryBroker interface
 *
 * Mediator pattern interface for decoupling direct dependencies between RegistryManager and EntityManager.
 * Coordinates registry queries and management operations in an event-driven manner.
 */
export interface IRegistryBroker {
  /**
   * Register RegistryManager instance
   * @param manager RegistryManager instance
   */
  registerRegistryManager(manager: IRegistryManager<IEntity>): void;

  /**
   * Register EntityManager instance
   * @param manager EntityManager instance (avoids circular dependencies via callback)
   */
  registerEntityManager(manager: { getEntityTypeRegistry: (type: string) => unknown }): void;

  /**
   * Get registry by entity type
   * @param type Entity type
   * @returns Corresponding registry instance
   */
  getRegistryForType(type: string): IRegistry<IEntity> | undefined;

  /**
   * Get registry by entity instance
   * @param entity Entity instance
   * @returns Corresponding registry instance
   */
  getRegistryForEntity(entity: IEntity): IRegistry<IEntity> | undefined;

  /**
   * Get default registry
   * @returns Default registry instance
   */
  getDefaultRegistry(): IRegistry<IEntity> | undefined;

  /**
   * Check if registry exists
   * @param name Registry name
   * @returns Whether it exists
   */
  hasRegistry(name: string): boolean;

  /**
   * Get all registry names
   * @returns Array of registry names
   */
  getRegistryNames(): string[];

  /**
   * Add registry
   * @param name Registry name
   * @param registry Registry instance
   */
  addRegistry(name: string, registry: IRegistry<IEntity>): void;

  /**
   * Remove registry
   * @param name Registry name
   * @returns Whether removal succeeded
   */
  removeRegistry(name: string): boolean;

  /**
   * Set default registry
   * @param name Registry name
   */
  setDefaultRegistry(name: string): void;

  /**
   * Bind entity type to registry
   * @param type Entity type
   * @param name Registry name
   */
  bindTypeToRegistry(type: string, name: string): void;

  /**
   * Unbind type
   * @param type Entity type
   */
  unbindType(type: string): void;

  /**
   * Subscribe to registry change events
   * @param listener Event listener
   * @returns Unsubscribe function
   */
  onRegistryChange(listener: (event: RegistryEvent) => void): () => void;

  /**
   * Subscribe to entity change events
   * @param listener Event listener
   * @returns Unsubscribe function
   */
  onEntityChange(listener: (event: EntityEvent) => void): () => void;

  /**
   * Clean up resources
   */
  dispose(): void;
}

/**
 * Registry event types
 */
export type RegistryEvent =
  | { type: "REGISTRY_ADDED"; payload: { name: string; registry: IRegistry<IEntity> } }
  | { type: "REGISTRY_REMOVED"; payload: { name: string } }
  | { type: "REGISTRY_UPDATED"; payload: { name: string; registry: IRegistry<IEntity> } }
  | { type: "DEFAULT_REGISTRY_CHANGED"; payload: { name: string } }
  | { type: "TYPE_BOUND"; payload: { type: string; registryName: string } }
  | { type: "TYPE_UNBOUND"; payload: { type: string } };

/**
 * Entity event types
 */
export type EntityEvent =
  | { type: "ENTITY_CREATED"; payload: { id: string; type: string; entity: IEntity } }
  | { type: "ENTITY_UPDATED"; payload: { id: string; changes: Partial<IEntity> } }
  | { type: "ENTITY_REMOVED"; payload: { id: string } };
