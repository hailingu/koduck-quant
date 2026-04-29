import { EntityRegistry } from "../entity-registry";
import type { IEntityArguments } from "../types";
import type { IRegistryBroker } from "../../registry/broker";

/**
 * @module src/common/entity/entity-manager/registry-bridge
 * @description Bridge between entity manager and registry system.
 * Handles registry resolution, entity instantiation, and type management
 */

/**
 * Result of resolving a registry from type name or registry object
 * @typedef {Object} RegistryResolution
 * @property {EntityRegistry} registry - The resolved registry configuration
 * @property {string} [typeName] - Optional type name if resolution came from a type name string
 */
export interface RegistryResolution {
  registry: EntityRegistry;
  typeName?: string;
}

/**
 * Bridge adapter connecting entity manager to registry broker
 * @class
 * @description Provides methods for resolving entity registries, instantiating entities,
 * and managing entity type registrations through the registry broker interface
 */
export class EntityRegistryBridge {
  private readonly registryBroker: IRegistryBroker;

  /**
   * Create a new EntityRegistryBridge instance
   * @param {IRegistryBroker} registryBroker - The registry broker for looking up and managing registries
   */
  constructor(registryBroker: IRegistryBroker) {
    this.registryBroker = registryBroker;
  }

  /**
   * Resolve an entity registry from either a type name string or registry object
   * @param {string | EntityRegistry} typeNameOrRegistry - Either a type name string to look up,
   * or a registry object directly
   * @returns {RegistryResolution | undefined} Resolution containing registry and optional type name,
   * or undefined if type name not found and registry object is not valid
   * @example
   * const resolution = bridge.resolveRegistry('my-type');
   * if (resolution) {
   *   const entity = bridge.instantiateEntity(resolution.registry);
   * }
   */
  resolveRegistry(typeNameOrRegistry: string | EntityRegistry): RegistryResolution | undefined {
    if (typeof typeNameOrRegistry !== "string") {
      const metaType = typeNameOrRegistry.meta?.type;
      return metaType !== undefined
        ? { registry: typeNameOrRegistry, typeName: metaType }
        : { registry: typeNameOrRegistry };
    }

    const registry = this.registryBroker.getRegistryForType(typeNameOrRegistry) as
      | EntityRegistry
      | undefined;

    if (!registry) {
      // Need to access the actual RegistryManager for auto-registration
      // Need to get RegistryManager instance via broker here
      // Temporarily commented out, will be handled via other means later
      // const restored = ensureAutoRegistry(typeNameOrRegistry, this.getRegistryManager());
      // if (restored) {
      //   registry = this.registryBroker.getRegistryForType(typeNameOrRegistry) as
      //     | EntityRegistry
      //     | undefined;
      // }
    }

    if (!registry) {
      return undefined;
    }

    return { registry, typeName: typeNameOrRegistry };
  }

  /**
   * Instantiate a new entity from a registry configuration
   * @template T - Entity type
   * @param {EntityRegistry} registry - The registry configuration containing constructor and default args
   * @param {IEntityArguments} [args] - Optional initialization arguments merged with registry defaults
   * @returns {T} New entity instance of the specified type
   * @throws {Error} If registry constructor is not available
   * @example
   * const entity = bridge.instantiateEntity<MyEntity>(registry, { id: 'new-1' });
   */
  instantiateEntity<T>(registry: EntityRegistry, args?: IEntityArguments): T {
    const Constructor = registry.getConstructor();
    if (!Constructor) {
      throw new Error("Entity registry constructor not available");
    }

    const finalArgs = { ...registry.args, ...args };
    return new Constructor(finalArgs) as T;
  }

  /**
   * Get all registered entity type names
   * @returns {string[]} Array of all registered type identifiers
   */
  getAvailableTypes(): string[] {
    return this.registryBroker.getRegistryNames();
  }

  /**
   * Register a new entity type
   * @param {string} typeName - Unique identifier for the entity type
   * @param {EntityRegistry} registry - Registry configuration for the type,
   * contains constructor, metadata, and default arguments
   */
  registerType(typeName: string, registry: EntityRegistry): void {
    this.registryBroker.addRegistry(typeName, registry);
  }

  /**
   * Check if an entity type is registered
   * @param {string} typeName - Type identifier to check
   * @returns {boolean} True if type is registered in the broker, false otherwise
   */
  hasType(typeName: string): boolean {
    return this.registryBroker.hasRegistry(typeName);
  }

  /**
   * Get the registry configuration for an entity type
   * @param {string} typeName - Type identifier to look up
   * @returns {EntityRegistry | undefined} Registry configuration if found, undefined otherwise
   */
  getRegistry(typeName: string): EntityRegistry | undefined {
    return this.registryBroker.getRegistryForType(typeName) as EntityRegistry | undefined;
  }
}
