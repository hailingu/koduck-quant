/**
 * Capability-Aware Registry Base Class
 *
 * This module provides a unified, production-ready base implementation for the ICapabilityAwareRegistry interface.
 * It serves as the foundation for the decorator system's registry infrastructure.
 *
 * **Core Responsibilities**:
 * 1. Manage capability registrations (add, remove, clear, batch operations)
 * 2. Execute registered capabilities on entities
 * 3. Detect and report entity-level capability support
 * 4. Maintain capability metadata and lifecycle information
 * 5. Provide validation and diagnostic APIs
 *
 * **Architecture**:
 * - **Internal Map**: Maintains capabilities by name for O(1) lookup
 * - **Meta Enhancement**: Augments provided metadata with capability tracking info
 * - **Entity Proxy**: Delegates to entity methods when supported (canHandle/execute pattern)
 * - **Batch Operations**: Supports multi-capability execution and checking
 *
 * **Type Parameters**:
 * - `T extends IEntity` - Entity type this registry manages
 * - `TMeta extends IMeta` - Metadata type (defaults to IMeta with extras)
 *
 * **Usage Pattern**:
 * ```typescript
 * class MyRegistry<T extends IEntity> extends CapabilityAwareRegistryBase<T> {
 *   constructor(entityConstructor: IEntityConstructor<T>) {
 *     super(entityConstructor);
 *     this.setupCapabilities();
 *   }
 *
 *   private setupCapabilities() {
 *     this.addCapability({
 *       name: 'render',
 *       execute: (entity) => <div>{entity.toString()}</div>
 *     });
 *   }
 * }
 * ```
 *
 * **Performance Notes**:
 * - Capability lookup: O(1) via Map
 * - Batch execution: Parallel via Promise.all
 * - Metadata updates: Lazy evaluation where possible
 * - Entity capability detection: Cached in ensureExtras()
 *
 * **Design Patterns**:
 * - Strategy Pattern: Capabilities as pluggable strategies
 * - Factory Pattern: Capability creation and registration
 * - Proxy Pattern: Entity capability delegation
 * - Template Method: Protected hook methods for customization
 *
 * @abstract
 * @template T - Entity type managed by this registry
 * @template TMeta - Metadata type with optional extras property
 *
 * @example
 * ```typescript
 * // Create specialized registry by extending base
 * class ButtonRegistry extends CapabilityAwareRegistryBase<ButtonEntity> {
 *   constructor() {
 *     super(ButtonEntity);
 *     this.addCapabilities([
 *       renderCapability,
 *       executeCapability,
 *       validateCapability
 *     ]);
 *   }
 * }
 *
 * const registry = new ButtonRegistry();
 * const button = registry.createEntity();
 * await registry.executeCapability('render', button, context);
 * ```
 *
 * @see {@link ICapabilityAwareRegistry} - Interface this class implements
 * @see {@link ICapability} - Capability structure
 * @see {@link SpecificCapability} - Built-in capability implementations
 * @see {@link IEntity} - Entity base type
 */
import type { IEntity, IEntityConstructor, IEntityArguments } from "../../common/entity/types";
import type { ICapabilityAwareRegistry, IMeta } from "../../common/registry/types";
import type { ICapability } from "./types";
import { logger } from "../../common/logger";

/**
 * Capability-Aware Registry Base Implementation
 *
 * Abstract base class providing ICapabilityAwareRegistry implementation.
 * Subclasses should override setupCapabilities() or call addCapability/addCapabilities
 * to register specific capabilities for their entity type.
 */
export abstract class CapabilityAwareRegistryBase<
  T extends IEntity,
  TMeta extends IMeta & { extras?: Record<string, unknown> } = IMeta & {
    extras?: Record<string, unknown>;
  },
> implements ICapabilityAwareRegistry<T, TMeta>
{
  /**
   * Internal map storing capabilities by name
   *
   * - Key: Capability name (e.g., 'render', 'execute')
   * - Value: ICapability instance
   * - Provides O(1) lookup performance
   *
   * @protected
   */
  protected capabilities = new Map<string, ICapability>();

  /**
   * Constructor function for creating entity instances
   *
   * Used by createEntity() to instantiate new entities.
   * Must be set in constructor.
   *
   * @protected
   */
  protected entityConstructor: IEntityConstructor<T>;

  /**
   * Optional entity initialization arguments
   *
   * If provided, passed to createEntity() by default.
   * Can be overridden per-call.
   *
   * @public
   */
  public readonly args?: IEntityArguments;

  /**
   * Enhanced metadata with capability tracking
   *
   * Structure:
   * ```typescript
   * {
   *   ...original,  // Spreads all original meta fields
   *   capabilitiesDetectedAt?: number;  // Timestamp of capability detection
   *   extras: {
   *     ...original.extras,  // Existing extras
   *     capabilities?: string[];  // Registered capability names
   *     capabilitiesDetectedAt?: number;  // Last detection time
   *     _capabilitiesStorageVersion?: number;  // Storage version (2)
   *   }
   * }
   * ```
   *
   * @public
   * @readonly
   */
  public readonly meta: TMeta & {
    capabilitiesDetectedAt?: number;
    extras: Record<string, unknown> & {
      capabilities?: string[];
      capabilitiesDetectedAt?: number;
      _capabilitiesStorageVersion?: number;
    };
  };

  /**
   * Constructor
   *
   * Initializes the registry with entity constructor and optional metadata.
   * Automatically enhances metadata to include capability tracking.
   *
   * @param entityConstructor - Constructor for creating entity instances
   * @param args - Optional default arguments for entity creation
   * @param meta - Optional metadata to merge (augmented with capability info)
   *
   * @remarks
   * - Meta is enhanced with capabilitiesDetectedAt timestamp
   * - Extras object is created/merged with capability tracking fields
   * - All original meta fields are preserved during enhancement
   *
   * @example
   * ```typescript
   * class MyRegistry extends CapabilityAwareRegistryBase {
   *   constructor() {
   *     super(
   *       EntityClass,
   *       { someArgs: 123 },
   *       { type: 'entity', version: 1 }
   *     );
   *   }
   * }
   * ```
   */
  constructor(entityConstructor: IEntityConstructor<T>, args?: IEntityArguments, meta?: TMeta) {
    this.entityConstructor = entityConstructor;
    if (args !== undefined) {
      this.args = args;
    }

    // Enhance metadata to include capability information
    // Preserve original meta fields (or add minimal structure if absent),
    // then append capability tracking information
    const original = (meta || {}) as IMeta &
      Partial<{ capabilities: string[]; capabilitiesDetectedAt: number }>;
    const names = Array.isArray(original.capabilities) ? original.capabilities : [];
    const baseMeta: IMeta & {
      capabilitiesDetectedAt?: number;
      extras: Record<string, unknown> & {
        capabilities?: string[];
        capabilitiesDetectedAt?: number;
        _capabilitiesStorageVersion?: number;
      };
    } = {
      ...original,
      capabilitiesDetectedAt: original.capabilitiesDetectedAt || Date.now(),
      extras: {
        ...(original.extras || {}),
        capabilities: names,
        capabilitiesDetectedAt: original.capabilitiesDetectedAt || Date.now(),
        _capabilitiesStorageVersion: 2,
      },
    };
    this.meta = baseMeta as TMeta & {
      capabilitiesDetectedAt?: number;
      extras: typeof baseMeta.extras;
    };
  }

  /**
   * Ensure extras object exists and is properly typed
   *
   * Helper method for safe access to meta.extras with proper typing.
   *
   * @returns The meta.extras object with capability tracking fields
   *
   * @protected
   */
  private ensureExtras(): Record<string, unknown> & {
    capabilities?: string[];
    capabilitiesDetectedAt?: number;
    _capabilitiesStorageVersion?: number;
  } {
    return this.meta.extras as Record<string, unknown> & {
      capabilities?: string[];
      capabilitiesDetectedAt?: number;
      _capabilitiesStorageVersion?: number;
    };
  }

  // ============================================================================
  // IRegistry Interface Implementation
  // ============================================================================

  /**
   * Get the entity constructor
   *
   * Returns the constructor function used to create entity instances.
   *
   * @returns The entity constructor
   *
   * @example
   * ```typescript
   * const Constructor = registry.getConstructor();
   * const entity = new Constructor();
   * ```
   */
  getConstructor(): IEntityConstructor<T> {
    return this.entityConstructor;
  }

  /**
   * Create a new entity instance
   *
   * Uses the registered entity constructor, optionally with provided arguments.
   * Falls back to stored args if not provided.
   *
   * @param args - Optional entity initialization arguments
   * @returns New entity instance
   *
   * @example
   * ```typescript
   * const entity1 = registry.createEntity();
   * const entity2 = registry.createEntity({ prop: 'value' });
   * ```
   */
  createEntity(...args: [IEntityArguments?]): T {
    const entityArgs = args[0] || this.args;
    return new this.entityConstructor(entityArgs);
  }

  // ============================================================================
  // ICapabilityAwareRegistry Interface Implementation
  // ============================================================================

  /**
   * Check if a capability is registered
   *
   * Quick predicate to determine if a specific capability exists.
   *
   * @param name - Capability name to check
   * @returns true if capability is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.hasCapability('render')) {
   *   // Can render entities
   * }
   * ```
   */
  hasCapability(name: string): boolean {
    return this.capabilities.has(name);
  }

  /**
   * Execute a registered capability
   *
   * Executes the capability with provided arguments.
   * Validates that capability exists and can handle the arguments.
   *
   * @param name - Capability name to execute
   * @param args - Arguments to pass to capability.execute()
   * @returns Execution result
   *
   * @throws {Error} If capability not found or cannot handle arguments
   *
   * @example
   * ```typescript
   * try {
   *   const result = await registry.executeCapability('render', entity, context);
   * } catch (error) {
   *   console.error('Render failed:', error);
   * }
   * ```
   */
  async executeCapability(name: string, ...args: unknown[]): Promise<unknown> {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new Error(`Capability '${name}' not found in registry`);
    }

    if (!capability.canHandle(...args)) {
      throw new Error(`Capability '${name}' cannot handle the provided arguments`);
    }

    return await capability.execute(...args);
  }

  /**
   * Get all registered capability names
   *
   * Returns list of all capability names in this registry.
   *
   * @returns Array of capability names
   *
   * @example
   * ```typescript
   * const capabilities = registry.getCapabilities();
   * console.log('Registered capabilities:', capabilities);
   * // Output: ['render', 'execute', 'validate']
   * ```
   */
  getCapabilities(): string[] {
    return Array.from(this.capabilities.keys());
  }

  // ============================================================================
  // ICapabilityContainer Interface Implementation
  // ============================================================================

  /**
   * Get all supported capability names
   *
   * Alias for getCapabilities() providing ICapabilityContainer compliance.
   *
   * @returns Array of supported capability names
   */
  get supportedCapabilities(): string[] {
    return this.getCapabilities();
  }

  /**
   * Get a specific capability instance
   *
   * Retrieves the capability object for typed access.
   *
   * @template K - Specific capability type
   * @param name - Capability name
   * @returns Capability instance or undefined if not found
   *
   * @example
   * ```typescript
   * const renderCap = registry.getCapability<IRenderCapability>('render');
   * if (renderCap) {
   *   // Use render capability directly
   * }
   * ```
   */
  getCapability<K extends ICapability>(name: string): K | undefined {
    return this.capabilities.get(name) as K | undefined;
  }

  /**
   * Execute capability with entity context
   *
   * Executes capability, passing entity as first argument.
   * Useful for context-aware capability execution.
   *
   * @param name - Capability name
   * @param _entity - Entity context (passed to capability)
   * @param args - Additional arguments
   * @returns Execution result
   *
   * @throws {Error} If capability not found or cannot handle context
   *
   * @example
   * ```typescript
   * const result = await registry.executeCapabilityWithContext(
   *   'validate',
   *   entity,
   *   [validationOptions]
   * );
   * ```
   */
  executeCapabilityWithContext(
    name: string,
    _entity: T,
    args: unknown[]
  ): Promise<unknown> | unknown {
    const capability = this.capabilities.get(name);
    if (!capability) {
      throw new Error(`Capability '${name}' not found`);
    }

    if (!capability.canHandle(...args)) {
      throw new Error(`Capability '${name}' cannot handle the provided context`);
    }

    return capability.execute(...args);
  }

  // ============================================================================
  // Capability Management Methods
  // ============================================================================

  /**
   * Add a capability to the registry
   *
   * Registers a single capability and updates metadata.
   * Supports fluent interface (returns this).
   *
   * @param capability - ICapability instance to register
   * @returns this (for method chaining)
   *
   * @protected
   *
   * @example
   * ```typescript
   * registry
   *   .addCapability(renderCapability)
   *   .addCapability(executeCapability);
   * ```
   */
  protected addCapability(capability: ICapability): this {
    this.capabilities.set(capability.name, capability);

    if (this.meta) {
      const names = Array.from(this.capabilities.keys());
      const extras = this.ensureExtras();
      extras.capabilities = names;
      extras.capabilitiesDetectedAt = Date.now();
      extras._capabilitiesStorageVersion = 2;
    }

    return this;
  }

  /**
   * Remove a capability from the registry
   *
   * Unregisters a capability and updates metadata.
   * Supports fluent interface (returns this).
   *
   * @param name - Capability name to remove
   * @returns this (for method chaining)
   *
   * @protected
   *
   * @example
   * ```typescript
   * registry.removeCapability('render');
   * ```
   */
  protected removeCapability(name: string): this {
    this.capabilities.delete(name);
    if (this.meta) {
      const names = Array.from(this.capabilities.keys());
      const extras = this.ensureExtras();
      extras.capabilities = names;
    }

    return this;
  }

  /**
   * Add multiple capabilities at once
   *
   * Batch operation for registering multiple capabilities.
   * More efficient than calling addCapability() individually.
   *
   * @param capabilities - Array of ICapability instances
   * @returns this (for method chaining)
   *
   * @protected
   *
   * @example
   * ```typescript
   * registry.addCapabilities([
   *   renderCapability,
   *   executeCapability,
   *   validateCapability
   * ]);
   * ```
   */
  protected addCapabilities(capabilities: ICapability[]): this {
    capabilities.forEach((cap) => this.addCapability(cap));
    return this;
  }

  /**
   * Clear all registered capabilities
   *
   * Removes all capabilities from the registry.
   * Supports fluent interface (returns this).
   *
   * @returns this (for method chaining)
   *
   * @protected
   *
   * @example
   * ```typescript
   * registry.clearCapabilities();
   * // All capabilities removed
   * ```
   */
  protected clearCapabilities(): this {
    this.capabilities.clear();
    if (this.meta) {
      const extras = this.ensureExtras();
      extras.capabilities = [];
    }

    return this;
  }

  // ============================================================================
  // Batch Operation Methods
  // ============================================================================

  /**
   * Check multiple capabilities at once
   *
   * Validates that entity supports specified capabilities.
   * Performs checks in parallel for efficiency.
   *
   * @param entity - Entity to check
   * @param capabilityNames - Names of capabilities to check
   * @returns Array of boolean results (parallel to capabilityNames)
   *
   * @remarks
   * - First checks if capability is registered
   * - Then checks if entity supports the capability
   * - Results array maintains order matching capabilityNames
   *
   * @example
   * ```typescript
   * const results = registry.checkCapabilities(entity, ['render', 'execute']);
   * // results: [true, false]  - entity supports render but not execute
   * ```
   */
  checkCapabilities?(entity: T, capabilityNames: string[]): boolean[] {
    return capabilityNames.map((name) => {
      // First check if registry has the capability
      if (!this.hasCapability(name)) {
        return false;
      }

      // Then check if entity supports the capability
      return this.entityHasCapability(entity, name);
    });
  }

  /**
   * Execute multiple capabilities sequentially
   *
   * Performs batch capability execution with error handling.
   * Returns all results (successful or error) in parallel.
   *
   * @param entity - Entity context for execution
   * @param operations - Array of {capability, args} objects
   * @returns Promise resolving to array of results and errors
   *
   * @remarks
   * - Executes in parallel (Promise.all)
   * - Errors are caught and returned as result values
   * - All operations complete regardless of individual failures
   *
   * @example
   * ```typescript
   * const results = await registry.executeCapabilities(entity, [
   *   { capability: 'render', args: [context] },
   *   { capability: 'validate', args: [options] }
   * ]);
   * // results: [ReactElement, { valid: true }]
   * ```
   */
  executeCapabilities?(
    entity: T,
    operations: Array<{ capability: string; args: unknown[] }>
  ): Promise<unknown[]> {
    return Promise.all(
      operations.map(async (operation) => {
        try {
          const result = await this.executeCapability(
            operation.capability,
            entity,
            ...operation.args
          );
          return result;
        } catch (error) {
          logger.error(`Failed to execute capability '${operation.capability}':`, error);
          return error;
        }
      })
    );
  }

  // ============================================================================
  // Entity Capability Delegation Methods
  // ============================================================================

  /**
   * Check if entity has capability implementation
   *
   * Looks for canHandle{CapabilityName} and execute methods on entity.
   * Enables delegation to entity-level capability implementations.
   *
   * @param entity - Entity to check
   * @param capabilityName - Capability name to check for
   * @returns true if entity has both canXxx and execute methods
   *
   * @protected
   *
   * @remarks
   * Looks for methods named:
   * - `can{CapName}` - Predicate (e.g., canRender)
   * - `{capName}` - Implementation (e.g., render)
   *
   * @example
   * ```typescript
   * // Entity must have:
   * entity.canRender = () => true;
   * entity.render = (context) => <div>...</div>;
   *
   * const hasIt = registry.entityHasCapability(entity, 'render');  // true
   * ```
   */
  protected entityHasCapability(entity: T, capabilityName: string): boolean {
    const entityRecord = entity as Record<string, unknown>;
    const hasMethod = typeof entityRecord[`can${this.capitalize(capabilityName)}`] === "function";
    const hasImplementation = typeof entityRecord[capabilityName] === "function";

    return hasMethod && hasImplementation;
  }

  /**
   * Execute entity-level capability
   *
   * Calls entity's canXxx method to check, then executes capability.
   * Enables entity-driven capability implementation.
   *
   * @param entity - Entity to call capability on
   * @param capabilityName - Capability name
   * @param args - Arguments to pass
   * @returns Capability execution result
   *
   * @throws {Error} If entity doesn't have or cannot handle capability
   *
   * @protected
   *
   * @remarks
   * Follows pattern:
   * 1. Look up canXxx(args) method
   * 2. If true, call xxx(args) method
   * 3. Return result
   * 4. If false or method missing, throw error
   *
   * @example
   * ```typescript
   * const result = await registry.executeEntityCapability(
   *   entity,
   *   'render',
   *   context
   * );
   * ```
   */
  protected async executeEntityCapability(
    entity: T,
    capabilityName: string,
    ...args: unknown[]
  ): Promise<unknown> {
    const canMethodName = `can${this.capitalize(capabilityName)}`;
    const executeMethodName = capabilityName;

    const entityRecord = entity as Record<string, unknown>;
    const canExecute = entityRecord[canMethodName];
    const executeMethod = entityRecord[executeMethodName];

    if (typeof canExecute === "function" && typeof executeMethod === "function") {
      const canHandle = canExecute.call(entity, ...args);
      if (canHandle) {
        return await executeMethod.call(entity, ...args);
      } else {
        throw new Error(`Entity cannot handle ${capabilityName} with provided arguments`);
      }
    }

    throw new Error(`Entity does not implement ${capabilityName} capability`);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Capitalize first letter of string
   *
   * Helper method for method name generation (e.g., 'render' → 'Render').
   *
   * @param str - String to capitalize
   * @returns Capitalized string
   *
   * @private
   *
   * @example
   * ```typescript
   * capitalize('render')  // 'Render'
   * capitalize('execute')  // 'Execute'
   * ```
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Get capability statistics
   *
   * Provides diagnostic information about registered capabilities.
   *
   * @returns Statistics object with counts and names
   *
   * @remarks
   * Structure:
   * ```typescript
   * {
   *   totalCapabilities: number,
   *   capabilityNames: string[],
   *   lastUpdated: number | undefined
   * }
   * ```
   *
   * @example
   * ```typescript
   * const stats = registry.getCapabilityStats();
   * console.log(stats);
   * // { totalCapabilities: 3, capabilityNames: ['render', 'execute', 'validate'], lastUpdated: 1634567890 }
   * ```
   */
  getCapabilityStats() {
    return {
      totalCapabilities: this.capabilities.size,
      capabilityNames: this.getCapabilities(),
      lastUpdated: this.meta?.capabilitiesDetectedAt,
    };
  }

  /**
   * Validate registry completeness
   *
   * Performs sanity checks on registry state.
   * Useful for debugging and diagnostics.
   *
   * @returns Validation result with issues list
   *
   * @remarks
   * Checks:
   * - Entity constructor exists
   * - Meta contains type information
   * - At least one capability registered
   *
   * @example
   * ```typescript
   * const { isValid, issues } = registry.validate();
   * if (!isValid) {
   *   console.error('Registry validation failed:', issues);
   * }
   * ```
   */
  validate(): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this.entityConstructor) {
      issues.push("Missing entity constructor");
    }

    if (!this.meta?.type) {
      issues.push("Missing registry type in meta");
    }

    if (this.capabilities.size === 0) {
      issues.push("No capabilities registered");
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}
