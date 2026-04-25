/**
 * @file Automatic registry decorator system for entity classes.
 *
 * This module provides TypeScript decorator for automatically registering entity classes
 * in a registry manager with support for:
 *
 * - Automatic Registration: Decorators that instantly register classes
 * - Dynamic Registry Generation: Creates capability-aware registries at decoration time
 * - Capability Detection: Automatically detects capabilities from class methods
 * - Metadata Management: Stores and retrieves registration metadata
 * - Runtime Management: Register, unregister, and update registrations at runtime
 *
 * ## Core Patterns
 *
 * ### Decorator Pattern
 * The @AutoRegistry decorator applies the Decorator pattern to add registration
 * behavior to entity classes without modifying their implementation.
 *
 * ### Registry Pattern
 * Classes are automatically registered in a central RegistryManager, enabling:
 * - Type-based entity lookup
 * - Capability-based service discovery
 * - Priority-based selection among multiple implementations
 *
 * ### Metadata Pattern
 * Stores registration metadata on entity classes using static properties:
 * - `_autoRegistryMeta`: Registration information
 * - `_dynamicRegistryClass`: Generated registry class
 * - `_registryInstance`: Active registry instance
 *
 * ## Usage Overview
 *
 * Basic decorator usage with auto-registration and capabilities.
 * Also includes manual registration, metadata access, and runtime updates.
 *
 * ## Advanced Features
 *
 * ### Fallback Registry Manager
 * When no manager is provided, a global fallback manager is created automatically.
 * This ensures registrations work even without explicit configuration.
 *
 * ### Tracker System
 * Maintains a WeakMap of RegistryManager instances for lazy registry creation
 * and efficient memory management.
 *
 * ### Dynamic Registry Classes
 * Each decorated class gets a dynamically generated registry class that:
 * - Extends capability-aware registry patterns
 * - Implements interfaces required by RegistryManager
 * - Includes detected capabilities
 * - Maintains proper type information
 *
 * ## Performance Characteristics
 *
 * - Decoration time: O(1) for metadata setup
 * - Registration time: O(log n) for registry manager operations
 * - Lookup time: O(log n) for registry retrieval by name
 * - Memory: O(n) for tracking n decorated classes
 *
 * @see types.ts for AutoRegistryOptions and related interfaces
 * @see registry-generator.ts for dynamic registry class generation
 * @see capability-detector.ts for capability detection algorithms
 *
 * @author Duck Flow Team
 * @version 1.0.0
 * @since Phase 4.1
 */

import type { IEntity, IEntityConstructor } from "../../common/entity/types";
import { RegistryManager, createRegistryManager } from "../../common/registry/registry-manager";
import type { IMeta, ICapabilityAwareRegistry } from "../../common/registry/types";

import { DynamicRegistryGenerator } from "./registry-generator";
import { logger } from "../../common/logger";
import type { AutoRegistryOptions, IDynamicRegistryMeta } from "./types";

/**
 * Global fallback registry manager used when no manager is explicitly provided.
 *
 * Created lazily on first use to avoid unnecessary initialization.
 * Provides a sensible default for applications that don't require custom managers.
 *
 * @type {RegistryManager | null}
 * @private
 */
let fallbackRegistryManager: RegistryManager | null = null;

/**
 * Get or create the global fallback registry manager.
 *
 * Ensures only one fallback manager instance exists throughout the application.
 * Uses lazy initialization for performance optimization.
 *
 * @returns {RegistryManager} The global fallback registry manager
 *
 * @example
 * ```typescript
 * // First call creates the manager
 * const manager1 = getFallbackRegistryManager();
 *
 * // Subsequent calls return the same instance
 * const manager2 = getFallbackRegistryManager();
 * assert(manager1 === manager2); // true
 * ```
 *
 * @private
 */
function getFallbackRegistryManager(): RegistryManager {
  if (!fallbackRegistryManager) {
    fallbackRegistryManager = createRegistryManager();
  }

  return fallbackRegistryManager;
}

/**
 * Internal record for tracking auto-registered classes.
 *
 * Stores factory and callback information for lazy registry instantiation.
 *
 * @interface AutoRegistryRecord
 * @private
 */
type AutoRegistryRecord = {
  create: () => ICapabilityAwareRegistry<IEntity, IMeta>;
  onRegister?: (registry: ICapabilityAwareRegistry<IEntity, IMeta>) => void;
};

/**
 * Tracker for mapping registry managers to their registered classes.
 *
 * Uses WeakMap to avoid memory leaks - when a manager is garbage collected,
 * its tracked registries are automatically cleaned up.
 *
 * Structure: RegistryManager -> Map<className, AutoRegistryRecord>
 *
 * @type {WeakMap<RegistryManager, Map<string, AutoRegistryRecord>>}
 * @private
 */
const autoRegistryTracker = new WeakMap<RegistryManager, Map<string, AutoRegistryRecord>>();

/**
 * Track an auto-registered class for lazy registry creation.
 *
 * Stores factory and callback information that allows creating
 * registry instances on-demand when needed.
 *
 * @template T - Entity type being tracked
 * @template TMeta - Registry metadata type
 *
 * @param {RegistryManager} manager - Registry manager to track under
 * @param {string} name - Unique name for this registry
 * @param {Function} create - Factory function to create registry instances
 * @param {Function} [onRegister] - Optional callback after registration
 *
 * @returns {void}
 *
 * @private
 */
function trackAutoRegistry<T extends IEntity, TMeta extends IMeta>(
  manager: RegistryManager,
  name: string,
  create: () => ICapabilityAwareRegistry<T, TMeta>,
  onRegister?: (registry: ICapabilityAwareRegistry<T, TMeta>) => void
): void {
  let entries = autoRegistryTracker.get(manager);
  if (!entries) {
    entries = new Map();
    autoRegistryTracker.set(manager, entries as Map<string, AutoRegistryRecord>);
  }

  const record: AutoRegistryRecord = {
    create: create as () => ICapabilityAwareRegistry<IEntity, IMeta>,
  };

  if (onRegister) {
    record.onRegister = onRegister as (registry: ICapabilityAwareRegistry<IEntity, IMeta>) => void;
  }

  entries.set(name, record);
}

/**
 * Ensure a registry is created and registered in the manager.
 *
 * Checks if a tracked registry exists and creates/registers it if needed.
 * Used for lazy initialization of registries.
 *
 * @param {string} typeName - Name of the registry to ensure
 * @param {RegistryManager} manager - Manager to check and register with
 *
 * @returns {boolean} true if registry exists or was successfully created; false otherwise
 *
 * @example
 * ```typescript
 * const ensured = ensureAutoRegistry('MyEntity', manager);
 * if (ensured) {
 *   const registry = manager.getRegistry('MyEntity');
 * }
 * ```
 *
 * @private
 */
export function ensureAutoRegistry(typeName: string, manager: RegistryManager): boolean {
  const entries = autoRegistryTracker.get(manager);
  const record = entries?.get(typeName);
  if (!record) {
    return false;
  }

  if (!manager.hasRegistry(typeName)) {
    const registry = record.create();
    manager.addRegistry(typeName, registry);
    record.onRegister?.(registry);
  }

  return true;
}

/**
 * Class decorator for automatic entity registration.
 *
 * Automatically registers an entity class in a registry manager, generating a
 * capability-aware registry and storing metadata. Supports both immediate and
 * deferred registration.
 *
 * ## Key Features
 *
 * - **Automatic Registry Generation**: Creates specialized registry classes
 * - **Capability Detection**: Analyzes methods to find capabilities
 * - **Metadata Storage**: Preserves registration information on the class
 * - **Fallback Manager**: Uses global manager if none provided
 * - **Error Handling**: Logs registration failures without breaking decoration
 *
 * ## Generic Parameters
 *
 * - `T extends IEntity`: Type of entity being decorated
 * - `TMeta extends IMeta`: Type of registry metadata
 *
 * ## Decoration Timeline
 *
 * 1. Extract and validate options
 * 2. Generate dynamic registry class
 * 3. Store metadata on entity class
 * 4. Track in manager (if provided)
 * 5. Optionally register immediately (if autoRegister=true)
 *
 * @template T - Entity type (default: IEntity)
 * @template TMeta - Metadata type (default: IMeta)
 *
 * @param {AutoRegistryOptions<T, TMeta>} options - Decorator configuration
 *
 * @returns {Function} Class decorator function
 *
 * @throws May log errors during registration but does not throw exceptions
 *
 * @example
 * ```typescript
 * // Basic usage with required options
 * @AutoRegistry({
 *   registryManager: myManager,
 *   autoRegister: true,
 *   capabilities: ['render', 'execute'],
 *   priority: 10
 * })
 * class RenderableEntity extends Entity {
 *   render(context: RenderContext) {
 *     return <div>Content</div>;
 *   }
 *
 *   canRender() {
 *     return true;
 *   }
 *
 *   execute(params: unknown) {
 *     return { result: 'done' };
 *   }
 *
 *   canExecute() {
 *     return true;
 *   }
 * }
 *
 * // Deferred registration
 * @AutoRegistry({
 *   registryManager: myManager,
 *   autoRegister: false // Register later
 * })
 * class LazyEntity extends Entity {
 *   // ...
 * }
 * manualRegister(LazyEntity, undefined, myManager);
 *
 * // With custom metadata
 * @AutoRegistry({
 *   registryManager: myManager,
 *   registryName: 'special-entity',
 *   meta: {
 *     version: '2.0',
 *     author: 'team',
 *     performance: { renderTime: '2ms' }
 *   }
 * })
 * class SpecialEntity extends Entity {
 *   // ...
 * }
 * ```
 *
 * @see AutoRegistryOptions for all configuration options
 * @see getDynamicRegistryClass to retrieve generated registry class
 * @see getAutoRegistryMeta to retrieve stored metadata
 * @see manualRegister to register deferred entities
 */
export function AutoRegistry<T extends IEntity, TMeta extends IMeta = IMeta>(
  options: AutoRegistryOptions<T, TMeta>
): <K extends IEntityConstructor<T>>(EntityClass: K) => K {
  const {
    registryManager: providedRegistryManager,
    autoRegister = true,
    registryName,
    capabilities = [],
    priority = 0,
    meta = {},
  } = options;

  const resolvedRegistryManager = providedRegistryManager ?? getFallbackRegistryManager();

  return function <K extends IEntityConstructor<T>>(EntityClass: K): K {
    // Generate dynamic registry class using the generator utility
    const DynamicRegistryClass = DynamicRegistryGenerator.generateRegistry(EntityClass, {
      capabilities,
      priority,
      meta,
      enableCapabilityDetection: true,
    });

    // Create metadata for this registration
    const registryMeta: IDynamicRegistryMeta = {
      registryClass: DynamicRegistryClass as new (...args: unknown[]) => unknown,
      detectedCapabilities: capabilities,
      createdAt: Date.now(),
    };

    // Attach metadata to entity class using type assertion for safety
    const ExtendedEntityClass = EntityClass as typeof EntityClass & {
      _autoRegistryMeta?: IDynamicRegistryMeta;
      _dynamicRegistryClass?: unknown;
      _registryInstance?: unknown;
    };

    ExtendedEntityClass._autoRegistryMeta = registryMeta;
    ExtendedEntityClass._dynamicRegistryClass = DynamicRegistryClass;

    // Determine registry name (fallback: class type or name)
    const name = registryName || EntityClass.type || EntityClass.name;
    const createRegistryInstance = () =>
      new DynamicRegistryClass(EntityClass) as ICapabilityAwareRegistry<T, TMeta>;
    const onRegister = (instance: ICapabilityAwareRegistry<T, TMeta>): void => {
      ExtendedEntityClass._registryInstance = instance;
    };

    // Track for lazy initialization
    const trackingManager =
      resolvedRegistryManager instanceof RegistryManager ? resolvedRegistryManager : undefined;
    if (trackingManager) {
      trackAutoRegistry(trackingManager, name, createRegistryInstance, onRegister);
    }

    // Auto-register to RegistryManager if enabled
    if (autoRegister) {
      logger.info(`[AutoRegistry] Starting registration of decorated entity: ${name}`, {
        entityClass: EntityClass.name,
        capabilities,
        priority,
        meta,
      });

      const registryInstance = createRegistryInstance();

      try {
        const capabilityAwareRegistry = registryInstance;

        logger.debug(`[AutoRegistry] Successfully created registry instance: ${name}`, {
          registryInstance,
          capabilityAwareRegistry,
        });

        resolvedRegistryManager.addRegistry(name, capabilityAwareRegistry);
        onRegister(capabilityAwareRegistry);

        // Verify registration succeeded
        const verifyRegistry = resolvedRegistryManager.getRegistry(name);
        if (verifyRegistry) {
          logger.info(`[AutoRegistry] ✅ Verified successful registration: ${name}`);
        } else {
          logger.error(`[AutoRegistry] ❌ Verification failed for: ${name}`);
        }

        logger.debug(`[AutoRegistry] Registered ${name} with capabilities:`, capabilities);
      } catch (error) {
        logger.error(`[AutoRegistry] ❌ Registration failed: ${name}`, error as unknown);
      }
    }

    return EntityClass;
  };
}

/**
 * Retrieve auto-registry metadata from an entity class.
 *
 * Returns the metadata that was stored by the @AutoRegistry decorator,
 * including the registry class, detected capabilities, and creation timestamp.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to inspect
 *
 * @returns {IDynamicRegistryMeta | undefined} Metadata or undefined if not decorated
 *
 * @example
 * ```typescript
 * @AutoRegistry({ registryManager, capabilities: ['render', 'execute'] })
 * class MyEntity { }
 *
 * const meta = getAutoRegistryMeta(MyEntity);
 * if (meta) {
 *   console.log('Created at:', new Date(meta.createdAt));
 *   console.log('Capabilities:', meta.detectedCapabilities);
 * }
 * ```
 *
 * @see AutoRegistry for the decorator that stores this metadata
 */
export function getAutoRegistryMeta<T extends IEntity>(
  EntityClass: IEntityConstructor<T>
): IDynamicRegistryMeta | undefined {
  return (EntityClass as unknown as { _autoRegistryMeta?: IDynamicRegistryMeta })._autoRegistryMeta;
}

/**
 * Retrieve the dynamically generated registry class for an entity.
 *
 * Returns the registry class that was generated by the @AutoRegistry decorator.
 * Can be used to manually instantiate registries or inspect registry structure.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to inspect
 *
 * @returns {Function | undefined} Registry constructor or undefined if not decorated
 *
 * @example
 * ```typescript
 * const RegistryClass = getDynamicRegistryClass(MyEntity);
 * if (RegistryClass) {
 *   const registry = new RegistryClass(MyEntity);
 *   // Use registry directly
 * }
 * ```
 *
 * @see getRegistryInstance to get the active instance instead
 */
export function getDynamicRegistryClass<T extends IEntity>(
  EntityClass: IEntityConstructor<T>
): (new (entityConstructor: IEntityConstructor<T>) => unknown) | undefined {
  return (EntityClass as unknown as { _dynamicRegistryClass?: unknown })._dynamicRegistryClass as
    | (new (entityConstructor: IEntityConstructor<T>) => unknown)
    | undefined;
}

/**
 * Retrieve the active registry instance for a decorated entity.
 *
 * Returns the registry instance that was created and registered in the
 * registry manager, or undefined if not yet initialized.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to inspect
 *
 * @returns {unknown | undefined} Active registry instance or undefined
 *
 * @example
 * ```typescript
 * const instance = getRegistryInstance(MyEntity);
 * if (instance) {
 *   // Registry has been created and registered
 * } else {
 *   // Registry not yet initialized (may need ensureAutoRegistry)
 * }
 * ```
 *
 * @see ensureAutoRegistry to ensure registry is created
 */
export function getRegistryInstance<T extends IEntity>(
  EntityClass: IEntityConstructor<T>
): unknown | undefined {
  return (EntityClass as unknown as { _registryInstance?: unknown })._registryInstance;
}

/**
 * Check if an entity class has been decorated with @AutoRegistry.
 *
 * Returns true if the class has auto-registry metadata, false otherwise.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to check
 *
 * @returns {boolean} true if class is auto-registered; false otherwise
 *
 * @example
 * ```typescript
 * @AutoRegistry({ registryManager })
 * class DecoratedEntity { }
 *
 * class PlainEntity { }
 *
 * console.log(hasAutoRegistry(DecoratedEntity)); // true
 * console.log(hasAutoRegistry(PlainEntity)); // false
 * ```
 */
export function hasAutoRegistry<T extends IEntity>(EntityClass: IEntityConstructor<T>): boolean {
  return !!(EntityClass as unknown as { _autoRegistryMeta?: IDynamicRegistryMeta })
    ._autoRegistryMeta;
}

/**
 * Manually register an entity class that has @AutoRegistry but autoRegister=false.
 *
 * Creates the registry instance and registers it with the manager. Useful for
 * deferred registration or re-registration of entities.
 *
 * @template T - Entity type
 * @template TMeta - Metadata type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to register
 * @param {string} [registryName] - Optional custom registry name (defaults to class name/type)
 * @param {RegistryManager} [registryManager] - Registry manager to use (defaults to fallback)
 *
 * @returns {boolean} true if registration succeeded; false if class not decorated or registration failed
 *
 * @example
 * ```typescript
 * @AutoRegistry({
 *   registryManager,
 *   autoRegister: false // Don't auto-register
 * })
 * class DeferredEntity extends Entity { }
 *
 * // Later, when ready
 * const success = manualRegister(DeferredEntity);
 * if (!success) {
 *   console.error('Failed to register DeferredEntity');
 * }
 * ```
 *
 * @see unregister to remove a registration
 * @see updateRegistry to modify a registration
 */
export function manualRegister<T extends IEntity, TMeta extends IMeta = IMeta>(
  EntityClass: IEntityConstructor<T>,
  registryName?: string,
  registryManager: RegistryManager = getFallbackRegistryManager()
): boolean {
  const DynamicRegistryClass = getDynamicRegistryClass(EntityClass);
  if (!DynamicRegistryClass) {
    logger.warn(`[AutoRegistry] No dynamic registry found for ${EntityClass.name}`);
    return false;
  }

  const name = registryName || EntityClass.type || EntityClass.name;
  const createRegistryInstance = () =>
    new DynamicRegistryClass(EntityClass) as ICapabilityAwareRegistry<T, TMeta>;
  const ExtendedEntityClass = EntityClass as typeof EntityClass & {
    _registryInstance?: unknown;
  };
  const onRegister = (instance: ICapabilityAwareRegistry<T, TMeta>): void => {
    ExtendedEntityClass._registryInstance = instance;
  };

  const trackingManager = registryManager instanceof RegistryManager ? registryManager : undefined;
  if (trackingManager) {
    trackAutoRegistry(trackingManager, name, createRegistryInstance, onRegister);
  }

  const registryInstance = createRegistryInstance();

  try {
    registryManager.addRegistry(name, registryInstance);
    onRegister(registryInstance);

    logger.debug(`[AutoRegistry] Manually registered ${name}`);
    return true;
  } catch (error) {
    logger.warn(`[AutoRegistry] Failed to manually register ${name}:`, error as unknown);
    return false;
  }
}

/**
 * Unregister an entity class from its registry manager.
 *
 * Removes the registry from the manager and clears the instance reference.
 * Useful for cleanup or when an entity is no longer needed.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to unregister
 * @param {string} [registryName] - Optional custom registry name (defaults to class name/type)
 * @param {RegistryManager} [registryManager] - Registry manager to use (defaults to fallback)
 *
 * @returns {boolean} true if unregistration succeeded; false if registry not found or removal failed
 *
 * @example
 * ```typescript
 * // Register
 * manualRegister(MyEntity);
 *
 * // Later, clean up
 * unregister(MyEntity);
 *
 * // Verify it's gone
 * const instance = getRegistryInstance(MyEntity);
 * console.log(instance); // undefined
 * ```
 *
 * @see manualRegister to re-register after unregistering
 */
export function unregister<T extends IEntity>(
  EntityClass: IEntityConstructor<T>,
  registryName?: string,
  registryManager: RegistryManager = getFallbackRegistryManager()
): boolean {
  const name = registryName || EntityClass.type || EntityClass.name;

  try {
    const removed = registryManager.removeRegistry(name);
    if (removed) {
      const ExtendedEntityClass = EntityClass as typeof EntityClass & {
        _registryInstance?: unknown;
      };
      delete ExtendedEntityClass._registryInstance;
      logger.debug(`[AutoRegistry] Unregistered ${name}`);
    }
    return removed;
  } catch (error) {
    logger.warn(`[AutoRegistry] Failed to unregister ${name}:`, error as unknown);
    return false;
  }
}

/**
 * Update registration information for an entity class at runtime.
 *
 * Allows modifying capabilities, metadata, and other registration properties
 * without losing the class's registration status. Internally unregisters and
 * re-registers with new configuration.
 *
 * ## Update Strategy
 *
 * 1. Unregister current registry
 * 2. Generate new registry with updated options
 * 3. Re-register with new configuration
 *
 * This ensures clean state and proper initialization with new settings.
 *
 * @template T - Entity type
 *
 * @param {IEntityConstructor<T>} EntityClass - Entity class to update
 * @param {Object} options - Update options
 * @param {string[]} [options.capabilities] - New capabilities to set
 * @param {Record<string, unknown>} [options.meta] - New metadata to set
 * @param {string} [options.registryName] - Registry name (for lookups)
 * @param {RegistryManager} [options.registryManager] - Manager to use (defaults to fallback)
 *
 * @returns {boolean} true if update succeeded; false if update failed
 *
 * @example
 * ```typescript
 * // Register with initial capabilities
 * @AutoRegistry({
 *   registryManager,
 *   capabilities: ['render'],
 *   priority: 1
 * })
 * class EvolvingEntity extends Entity { }
 *
 * // Later, add more capabilities
 * updateRegistry(EvolvingEntity, {
 *   capabilities: ['render', 'execute', 'serialize'],
 *   meta: { version: '2.0', updated: Date.now() }
 * });
 *
 * // Verify update
 * const meta = getAutoRegistryMeta(EvolvingEntity);
 * console.log('Updated at:', meta?.createdAt);
 * ```
 *
 * @see manualRegister for initial registration
 * @see unregister for removal
 */
export function updateRegistry<T extends IEntity>(
  EntityClass: IEntityConstructor<T>,
  options: {
    capabilities?: string[];
    meta?: Record<string, unknown>;
    registryName?: string;
    registryManager?: RegistryManager;
  }
): boolean {
  const { capabilities, meta, registryName, registryManager } = options;
  const resolvedManager = registryManager ?? getFallbackRegistryManager();

  // First, unregister the current registry
  const unregistered = unregister(EntityClass, registryName, resolvedManager);
  if (!unregistered) {
    return false;
  }

  // Prepare options for new registry generation
  const registryOptions: {
    capabilities?: string[];
    meta?: Record<string, unknown>;
    enableCapabilityDetection: boolean;
  } = {
    enableCapabilityDetection: false, // Avoid re-detection
  };

  if (capabilities !== undefined) {
    registryOptions.capabilities = capabilities;
  }

  if (meta !== undefined) {
    registryOptions.meta = meta;
  }

  // Generate and store new dynamic registry class
  const DynamicRegistryClass = DynamicRegistryGenerator.generateRegistry(
    EntityClass,
    registryOptions
  );

  const ExtendedEntityClass = EntityClass as typeof EntityClass & {
    _dynamicRegistryClass?: unknown;
  };
  ExtendedEntityClass._dynamicRegistryClass = DynamicRegistryClass;

  // Re-register with new configuration
  return manualRegister(EntityClass, registryName, resolvedManager);
}
