/**
 * @file Core type definitions for the decorator-based capability system.
 *
 * This module provides comprehensive TypeScript interfaces for:
 * - **Capability System**: Core capability definition and execution patterns
 * - **Decorator Framework**: Decorator options and metadata structures
 * - **Registry Management**: Auto-registration and capability-aware registry patterns
 * - **Container Management**: Capability container interfaces for dependency management
 * - **Performance & Caching**: Cache and performance tracking for capability execution
 *
 * ## Architecture Overview
 *
 * The capability system implements several key patterns:
 *
 * ### Capability Pattern
 * - **ICapability**: Base interface defining what a capability is
 * - **ICapabilityProvider**: Manages collection of capabilities
 * - **ICapabilityExecutor**: Executes capabilities with advanced features
 * - **ICapabilityCache**: Optimizes capability access with caching
 * - **ICapabilityManager**: High-level orchestration of all capability operations
 *
 * ### Registry Pattern
 * - **AutoRegistryOptions**: Configuration for automatic class registration
 * - **IDynamicRegistryMeta**: Metadata for dynamically generated registries
 * - **ICapabilityAwareRegistry**: Registry with built-in capability filtering
 *
 * ### Execution Pattern
 * - **ICapabilityContext**: Provides execution context for capabilities
 * - **ICapabilityResult**: Standardized result format for capability execution
 * - **ICapabilityExecutor**: Multiple execution strategies (sync, async, batched, retried, timeout)
 *
 * ## Type Relationships
 *
 * ```
 * ICapability ──► ICapabilityProvider ──┐
 *                                       ├─► ICapabilityManager
 * ICapabilityExecutor ────────────────►┤
 * ICapabilityCache ──────────────────►┘
 *
 * AutoRegistry @Decorator ──► IDynamicRegistryMeta ──► ICapabilityAwareRegistry
 * ```
 *
 * ## Key Features
 *
 * ### Generic Capability System
 * - Generic type parameters for flexible argument and result types
 * - Strongly-typed provider for compile-time safety
 * - Support for specialized capability interfaces (Render, Execute, Serialize, etc.)
 *
 * ### Advanced Execution
 * - Synchronous and asynchronous execution
 * - Batch execution for parallel operations
 * - Conditional execution with predicates
 * - Automatic retry logic with configurable attempts
 * - Timeout protection with configurable limits
 *
 * ### Caching & Performance
 * - Optional TTL-based capability caching
 * - Batch cache operations for efficiency
 * - Automatic cleanup of expired entries
 * - Performance statistics and monitoring
 *
 * ### Configuration & Debugging
 * - Global system configuration for caching, execution, and debugging
 * - Multiple logging levels and performance tracking
 * - Health check functionality
 * - Performance reporting with top performers
 *
 * ## Usage Patterns
 *
 * ### 1. Basic Capability Definition
 * ```typescript
 * const renderCapability: ICapability<[entity, context], ReactElement> = {
 *   name: 'render',
 *   canHandle: (entity, context) => entity instanceof RenderableEntity,
 *   execute: async (entity, context) => {
 *     return <div>{entity.content}</div>;
 *   }
 * };
 * ```
 *
 * ### 2. Using Capability Provider
 * ```typescript
 * const provider = new DefaultCapabilityProvider([renderCapability]);
 * provider.add(executeCapability).add(validateCapability);
 *
 * const render = provider.get('render');
 * const allCaps = provider.all();
 * const filtered = provider.filter(cap => cap.name.startsWith('render'));
 * ```
 *
 * ### 3. Auto-Registry Decorator
 * ```typescript
 * @AutoRegistry({
 *   autoRegister: true,
 *   capabilities: ['render', 'execute'],
 *   priority: 1
 * })
 * class MyEntity extends RenderableEntity {
 *   // Entity implementation
 * }
 * ```
 *
 * ### 4. Capability Manager for Orchestration
 * ```typescript
 * const manager = new CapabilityManager(provider);
 * const result = await manager.smartExecute('render',
 *   { timeout: 5000, retries: 3 },
 *   entity,
 *   context
 * );
 * ```
 *
 * ## Performance Considerations
 *
 * - **Capability Caching**: Enable for high-frequency capability lookups
 * - **Batch Operations**: Use executeBatch for multiple capabilities
 * - **Timeout Protection**: Always set timeouts for untrusted capability code
 * - **Performance Tracking**: Use built-in statistics for monitoring
 *
 * ## Related Modules
 *
 * - `auto-registry.ts` - Decorator implementation for automatic registration
 * - `capabilities.ts` - Concrete capability implementations (Render, Execute, etc.)
 * - `capability-container.ts` - Container management for capability resolution
 * - `capability-aware-registry-base.ts` - Base class for capability-aware registries
 * - `capability-detector.ts` - Runtime capability detection and analysis
 * - `registry-generator.ts` - Code generation for dynamic registries
 *
 * @author Koduck Flow Team
 * @version 1.0.0
 * @since Phase 4.1
 */

import type { IEntity } from "../../common/entity";
import type { IMeta, IRegistryManager } from "../../common/registry/types";

/**
 * Core capability interface defining the contract for all capabilities.
 *
 * A capability represents a composable unit of functionality that can be:
 * - Registered in a capability provider
 * - Executed with specific arguments
 * - Filtered and queried based on capabilities
 * - Prioritized for selection among multiple implementations
 *
 * ## Generic Parameters
 *
 * - `TArgs extends unknown[]`: Tuple type for capability arguments (e.g., `[Entity, Context]`)
 * - `TResult`: Return type for capability execution (default: `unknown`)
 *
 * ## Method Signatures
 *
 * - `canHandle(...args)`: Predicate to check if this capability can handle given arguments
 * - `execute(...args)`: Main execution method supporting both sync and async operations
 *
 * ## Usage
 *
 * ```typescript
 * // Example 1: Synchronous capability
 * const addCapability: ICapability<[number, number], number> = {
 *   name: 'add',
 *   priority: 1,
 *   canHandle: (a, b) => typeof a === 'number' && typeof b === 'number',
 *   execute: (a, b) => a + b
 * };
 *
 * // Example 2: Asynchronous capability with metadata
 * const fetchCapability: ICapability<[string], Response> = {
 *   name: 'fetch',
 *   priority: 2,
 *   canHandle: (url) => url.startsWith('http'),
 *   execute: async (url) => fetch(url),
 *   meta: { timeout: 5000, retries: 3 }
 * };
 *
 * // Example 3: Using with provider
 * const provider = new DefaultCapabilityProvider([addCapability]);
 * provider.add(fetchCapability);
 * const result = await provider.executeCapability('fetch',
 *   { params: ['https://api.example.com'] }
 * );
 * ```
 *
 * @template TArgs - Tuple of capability argument types
 * @template TResult - Return type of capability execution (default: unknown)
 *
 * @see ICapabilityProvider for managing multiple capabilities
 * @see ICapabilityExecutor for advanced execution strategies
 * @see IRenderCapability, IExecuteCapability for concrete implementations
 */
export interface ICapability<TArgs extends unknown[] = unknown[], TResult = unknown> {
  /**
   * Unique identifier for this capability.
   *
   * Used to reference the capability in provider operations and execution calls.
   * Should be a stable, lowercase string identifier (e.g., 'render', 'execute', 'serialize').
   *
   * @example
   * ```typescript
   * const capability: ICapability = {
   *   name: 'render',
   *   // ...
   * };
   *
   * const result = await provider.executeCapability(capability.name, context);
   * ```
   */
  readonly name: string;

  /**
   * Priority level for capability selection when multiple capabilities match.
   *
   * Higher numbers indicate higher priority. When multiple capabilities can handle
   * the same operation, the provider selects the one with the highest priority.
   * Defaults to 0 if not specified.
   *
   * **Priority Guidelines**:
   * - Critical/Default implementations: 1-5
   * - Standard implementations: 10-50
   * - Optimized/Specialized implementations: 100+
   *
   * Defaults to: 0
   * @example
   * ```typescript
   * // Specialized renderer with higher priority
   * const webGLRenderer: ICapability = {
   *   name: 'render',
   *   priority: 100, // Will be selected over default renderer (priority 10)
   *   canHandle: (entity) => entity.supportsWebGL,
   *   execute: (entity) => renderWithWebGL(entity)
   * };
   * ```
   */
  readonly priority?: number;

  /**
   * Predicate method to check if this capability can handle the given arguments.
   *
   * This method is called to determine whether this capability is applicable
   * for the given inputs. It should be a pure function with no side effects.
   *
   * **When to return true**:
   * - The capability implementation can successfully handle the inputs
   * - All required argument types match expectations
   * - No external conditions prevent execution
   *
   * **When to return false**:
   * - The argument types don't match
   * - Required capability features are not available
   * - Current state prevents execution
   *
   * @param args - Arguments to check for capability compatibility
   * @returns true if this capability can handle the given arguments; false otherwise
   *
   * @example
   * ```typescript
   * const renderCapability: ICapability<[Entity, Context?], ReactElement> = {
   *   name: 'render',
   *   canHandle: (entity, context) => {
   *     // Only handle entities with render method
   *     return typeof entity?.render === 'function' &&
   *            !(entity instanceof NonRenderableEntity);
   *   },
   *   execute: (entity, context) => entity.render(context)
   * };
   * ```
   */
  canHandle(...args: TArgs): boolean;

  /**
   * Execute the capability with the provided arguments.
   *
   * This method performs the actual capability operation. It can be either
   * synchronous or asynchronous. The capability system automatically handles
   * both cases transparently.
   *
   * **Execution Contract**:
   * - Should only be called if `canHandle(...args)` returns true
   * - Should handle all errors gracefully
   * - May throw errors which will be caught by the executor
   * - Should be idempotent when possible
   *
   * **Performance Guidelines**:
   * - Keep synchronous operations under 1ms
   * - For expensive operations, return a Promise
   * - Consider caching expensive computations
   * - Use timeouts for potentially long-running operations
   *
   * @param args - Arguments to pass to the capability execution
   * @returns Capability result or Promise of result
   * @throws May throw errors which are caught by the executor
   *
   * @example
   * ```typescript
   * // Synchronous execution
   * const addCapability: ICapability<[number, number], number> = {
   *   name: 'add',
   *   canHandle: (a, b) => typeof a === 'number' && typeof b === 'number',
   *   execute: (a, b) => a + b // Returns immediately
   * };
   *
   * // Asynchronous execution
   * const fetchCapability: ICapability<[string], any> = {
   *   name: 'fetch',
   *   canHandle: (url) => typeof url === 'string',
   *   execute: async (url) => {
   *     const response = await fetch(url);
   *     return response.json();
   *   }
   * };
   * ```
   */
  execute(...args: TArgs): Promise<TResult> | TResult;

  /**
   * Optional metadata associated with the capability.
   *
   * Used to store configuration, options, and additional information about
   * the capability. Common metadata fields include:
   * - `timeout`: Maximum execution time in milliseconds
   * - `retries`: Number of retry attempts on failure
   * - `cache`: Whether results should be cached
   * - `version`: Version of the capability implementation
   * - `tags`: Array of categorization tags
   *
   * @example
   * ```typescript
   * const capability: ICapability = {
   *   name: 'render',
   *   canHandle: (entity) => entity instanceof Component,
   *   execute: (entity) => entity.render(),
   *   meta: {
   *     timeout: 5000,
   *     retries: 3,
   *     cache: true,
   *     version: '2.0.0',
   *     tags: ['ui', 'react', 'performant']
   *   }
   * };
   * ```
   */
  readonly meta?: Record<string, unknown>;
}

/**
 * Capability container interface for managing a collection of capabilities.
 *
 * Represents a container that holds capabilities and associated configuration.
 * Typically used by components or services that provide multiple capabilities.
 *
 * @template T - Type of capabilities in the container (default: ICapability)
 *
 * @example
 * ```typescript
 * const container: ICapabilityContainer = {
 *   capabilities: [renderCapability, executeCapability, validateCapability],
 *   config: {
 *     timeout: 5000,
 *     retries: 3,
 *     enableCaching: true
 *   }
 * };
 * ```
 */
export interface ICapabilityContainer<T extends ICapability = ICapability> {
  /**
   * Array of capabilities provided by this container.
   *
   * @example
   * ```typescript
   * const container = {
   *   capabilities: [
   *     { name: 'render', ... },
   *     { name: 'execute', ... }
   *   ]
   * };
   * ```
   */
  readonly capabilities?: T[];

  /**
   * Configuration object for the container.
   *
   * May include settings like execution timeouts, caching strategies,
   * or container-specific options.
   *
   * @example
   * ```typescript
   * const container = {
   *   config: {
   *     timeout: 5000,
   *     cacheResults: true,
   *     parallelExecution: true
   *   }
   * };
   * ```
   */
  readonly config?: Record<string, unknown>;
}

/**
 * Capability provider interface for managing and executing capabilities.
 *
 * A provider manages a collection of capabilities and provides operations to:
 * - Query and retrieve capabilities
 * - Add, remove, and update capabilities
 * - Execute capabilities with context
 * - Filter and transform the capability collection
 *
 * The provider supports chainable operations for fluent API usage.
 *
 * @template T - Type of capabilities managed by this provider (default: ICapability)
 *
 * @example
 * ```typescript
 * const provider = new DefaultCapabilityProvider([renderCapability]);
 *
 * // Fluent API chaining
 * provider
 *   .add(executeCapability)
 *   .add(validateCapability)
 *   .remove('deprecated-capability');
 *
 * // Query operations
 * const render = provider.get('render');
 * const allCapabilities = provider.all();
 * const filtered = provider.filter(cap => cap.priority > 50);
 * ```
 */
export interface ICapabilityProvider<T extends ICapability = ICapability> {
  /**
   * Get all capabilities in the provider.
   *
   * Returns a snapshot of all currently registered capabilities as an array.
   *
   * @returns Array of all registered capabilities
   *
   * @example
   * ```typescript
   * const allCapabilities = provider.all();
   * console.log(`Provider has ${allCapabilities.length} capabilities`);
   * allCapabilities.forEach(cap => console.log(`- ${cap.name}`));
   * ```
   */
  all(): T[];

  /**
   * Get a capability by name.
   *
   * Retrieves a capability with the specified name, or undefined if not found.
   *
   * @template K - Capability name literal type for type safety
   * @param name - Name of the capability to retrieve
   * @returns The requested capability, or undefined if not found
   *
   * @example
   * ```typescript
   * const renderCapability = provider.get('render');
   * if (renderCapability) {
   *   console.log('Render capability found');
   * }
   *
   * // Type-safe retrieval with literal types
   * const typed = provider.get<'render'>('render');
   * ```
   */
  get<K extends string>(name: K): T | undefined;

  /**
   * Check if a capability exists in the provider.
   *
   * @param name - Name of the capability to check
   * @returns true if the capability exists; false otherwise
   *
   * @example
   * ```typescript
   * if (provider.has('render')) {
   *   await provider.executeCapability('render', context);
   * }
   * ```
   */
  has(name: string): boolean;

  /**
   * Add a capability to the provider.
   *
   * Adds or replaces a capability in the provider. Returns `this` for method chaining.
   *
   * @param capability - Capability to add
   * @returns The provider instance for chaining
   *
   * @example
   * ```typescript
   * provider
   *   .add(renderCapability)
   *   .add(executeCapability)
   *   .add(validateCapability);
   * ```
   */
  add(capability: T): this;

  /**
   * Remove a capability from the provider by name.
   *
   * If the capability doesn't exist, this is a no-op. Returns `this` for method chaining.
   *
   * @param name - Name of the capability to remove
   * @returns The provider instance for chaining
   *
   * @example
   * ```typescript
   * provider
   *   .remove('deprecated-capability')
   *   .remove('old-render-handler');
   * ```
   */
  remove(name: string): this;

  /**
   * Perform batch operations on capabilities.
   *
   * Allows adding and removing multiple capabilities in a single call.
   * Returns `this` for method chaining.
   *
   * @param operations - Array of add/remove operations
   * @returns The provider instance for chaining
   *
   * @example
   * ```typescript
   * provider.batch([
   *   { type: 'add', capability: newRender },
   *   { type: 'add', capability: newExecute },
   *   { type: 'remove', name: 'old-capability' }
   * ]);
   * ```
   */
  batch(
    operations: Array<{
      type: "add" | "remove";
      capability?: T;
      name?: string;
    }>
  ): this;

  /**
   * Remove all capabilities from the provider.
   *
   * Clears all registered capabilities. Returns `this` for method chaining.
   *
   * @returns The provider instance for chaining
   *
   * @example
   * ```typescript
   * provider.clear();
   * console.log(provider.all().length); // 0
   * ```
   */
  clear(): this;

  /**
   * Create a clone of this provider.
   *
   * Returns a new provider instance with a copy of all current capabilities.
   * Changes to the clone don't affect the original provider.
   *
   * @returns A new provider with the same capabilities
   *
   * @example
   * ```typescript
   * const backup = provider.clone();
   * provider.clear();
   * console.log(backup.all().length); // Still has capabilities
   * console.log(provider.all().length); // 0
   * ```
   */
  clone(): ICapabilityProvider<T>;

  /**
   * Filter capabilities based on a predicate function.
   *
   * Returns a new provider containing only capabilities that match the predicate.
   *
   * @param predicate - Function that returns true for capabilities to include
   * @returns A new provider with filtered capabilities
   *
   * @example
   * ```typescript
   * // Get only high-priority capabilities
   * const highPriority = provider.filter(cap => (cap.priority ?? 0) >= 50);
   *
   * // Get only render-related capabilities
   * const renderCaps = provider.filter(cap => cap.name.includes('render'));
   * ```
   */
  filter(predicate: (capability: T) => boolean): ICapabilityProvider<T>;

  /**
   * Execute a capability with the given context.
   *
   * Finds the capability by name and executes it with the provided context.
   * Returns a standardized capability result with success status and error info.
   *
   * @param name - Name of the capability to execute
   * @param context - Execution context including parameters and metadata
   * @returns Result with success status and data or error
   *
   * @example
   * ```typescript
   * const result = await provider.executeCapability('render', {
   *   entity: myEntity,
   *   params: [myEntity, renderContext]
   * });
   *
   * if (result.success) {
   *   console.log('Render result:', result.result);
   * } else {
   *   console.error('Render failed:', result.error);
   * }
   * ```
   */
  executeCapability(name: string, context: ICapabilityContext): Promise<ICapabilityResult>;
}

/**
 * Decorator options for the AutoRegistry decorator.
 *
 * Configuration object passed to the @AutoRegistry decorator to control
 * how classes are automatically registered and their capabilities detected.
 *
 * @template T - Entity type being decorated (default: IEntity)
 * @template TMeta - Registry metadata type (default: IMeta)
 *
 * @example
 * ```typescript
 * @AutoRegistry<MyEntity>({
 *   registryManager: myManager,
 *   autoRegister: true,
 *   registryName: 'my-entity-registry',
 *   capabilities: ['render', 'execute'],
 *   priority: 1,
 *   enableCapabilityDetection: true
 * })
 * class MyEntity extends RenderableEntity {
 *   // Implementation
 * }
 * ```
 */
export interface AutoRegistryOptions<T extends IEntity = IEntity, TMeta extends IMeta = IMeta> {
  /**
   * The registry manager instance where the entity will be registered.
   *
   * This is required and determines which registry system manages the entity.
   *
   * @type {IRegistryManager<T, TMeta>}
   */
  registryManager: IRegistryManager<T, TMeta>;

  /**
   * Whether to automatically register the class when decorated.
   *
   * If true, the class will be registered immediately during decoration.
   * If false, registration must be triggered manually.
   *
   * Default: true
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   autoRegister: false // Register manually later
   * })
   * class MyEntity {
   *   // Will not auto-register
   * }
   * ```
   */
  autoRegister?: boolean;

  /**
   * Custom name for the registry.
   *
   * Defaults to the class name or entity type if not specified.
   * Used as the key in the registry manager.
   *
   * Default: EntityClass.type || EntityClass.name
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   registryName: 'custom-entity-registry'
   * })
   * class MyEntity {
   *   // Registered as 'custom-entity-registry'
   * }
   * ```
   */
  registryName?: string;

  /**
   * Pre-defined list of capability names for this entity.
   *
   * These capabilities will be associated with the entity's registry.
   * Can be combined with automatic capability detection.
   *
   * Default: []
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   capabilities: ['render', 'execute', 'serialize']
   * })
   * class MyEntity {
   *   // Will have these capabilities
   * }
   * ```
   */
  capabilities?: string[];

  /**
   * Priority level for this entity in the registry.
   *
   * Higher priorities are preferred when multiple entities match.
   * Uses the same priority system as capabilities.
   *
   * Default: 0
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   priority: 100 // High priority
   * })
   * class SpecializedEntity {
   *   // Will be selected over low-priority entities
   * }
   * ```
   */
  priority?: number;

  /**
   * Additional metadata to store with the entity in the registry.
   *
   * Can include any custom information relevant to the entity.
   *
   * Default: {}
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   meta: {
   *     version: '2.0.0',
   *     tags: ['ui', 'react'],
   *     author: 'team-name',
   *     performance: { renderTime: '2ms' }
   *   }
   * })
   * class MyEntity {
   *   // Metadata stored for later retrieval
   * }
   * ```
   */
  meta?: Record<string, unknown>;

  /**
   * Enable automatic capability detection for the entity class.
   *
   * When enabled, the decorator will analyze the entity class to detect
   * methods matching capability patterns (e.g., canRender + render).
   *
   * Default: undefined (uses system default)
   * @example
   * ```typescript
   * @AutoRegistry({
   *   registryManager,
   *   enableCapabilityDetection: true
   * })
   * class MyEntity {
   *   canRender() { return true; }
   *   render() { return <div />; }
   *   // Detector will find 'render' capability
   * }
   * ```
   */
  enableCapabilityDetection?: boolean;
}

/**
 * Capability detector interface for runtime capability detection.
 *
 * Analyzes entity classes and instances to detect and create capability objects.
 *
 * @example
 * ```typescript
 * const detector = new CapabilityDetector();
 * const capabilities = detector.detectCapabilities(MyEntityClass.prototype);
 * ```
 */
export interface ICapabilityDetector {
  /**
   * Detect all capabilities from an entity prototype.
   *
   * Analyzes the prototype for methods matching capability patterns
   * (e.g., canRender + render = render capability).
   *
   * @param prototype - Entity prototype to analyze
   * @returns Array of detected capability names
   *
   * @example
   * ```typescript
   * const detector = new CapabilityDetector();
   * const capabilities = detector.detectCapabilities(MyEntity.prototype);
   * // Returns: ['render', 'execute', 'serialize']
   * ```
   */
  detectCapabilities(prototype: Record<string, unknown>): string[];

  /**
   * Create a capability instance from a method.
   *
   * Wraps a method in the ICapability interface.
   *
   * @template T - Type of capability to create
   * @param name - Name for the created capability
   * @param method - Method to wrap as a capability
   * @returns Capability instance or null if unable to create
   *
   * @example
   * ```typescript
   * const detector = new CapabilityDetector();
   * const renderCap = detector.createCapability('render', entity.render);
   * ```
   */
  createCapability?<T extends ICapability>(
    name: string,
    method: (...args: unknown[]) => unknown
  ): T | null;
}

/**
 * Metadata for dynamically generated registries.
 *
 * Stores information about registry classes that are created by the AutoRegistry decorator.
 *
 * @example
 * ```typescript
 * const meta: IDynamicRegistryMeta = {
 *   registryClass: DynamicRegistry,
 *   detectedCapabilities: ['render', 'execute'],
 *   createdAt: Date.now()
 * };
 * ```
 */
export interface IDynamicRegistryMeta {
  /**
   * Constructor for the dynamically generated registry class.
   */
  registryClass: new (...args: unknown[]) => unknown;

  /**
   * List of capability names detected for this registry.
   */
  detectedCapabilities: string[];

  /**
   * Timestamp when the registry was created (milliseconds since epoch).
   */
  createdAt: number;
}

/**
 * Execution context for capability execution.
 *
 * Provides information needed for capability execution including
 * the target entity, parameters, and optional metadata.
 *
 * @example
 * ```typescript
 * const context: ICapabilityContext = {
 *   entity: myEntity,
 *   params: [myEntity, renderContext],
 *   meta: { timeout: 5000, retries: 3 }
 * };
 * ```
 */
export interface ICapabilityContext {
  /**
   * The target entity being operated on.
   *
   * The entity that the capability will operate on.
   */
  entity: unknown;

  /**
   * Parameters to pass to the capability.
   *
   * Arguments that will be spread to the capability's execute method.
   * Example: `[entity, renderContext]` for render capability.
   */
  params: unknown[];

  /**
   * Optional metadata for the execution.
   *
   * May include execution options like timeout, retry count, etc.
   */
  meta?: Record<string, unknown>;
}

/**
 * Standardized result from capability execution.
 *
 * Provides consistent format for capability execution results,
 * including success status, result data, and error information.
 *
 * @template T - Type of the execution result (default: unknown)
 *
 * @example
 * ```typescript
 * const result: ICapabilityResult<ReactElement> = {
 *   result: <div>Rendered content</div>,
 *   capability: 'render',
 *   success: true
 * };
 * ```
 */
export interface ICapabilityResult<T = unknown> {
  /**
   * The result data from capability execution.
   *
   * Type depends on the specific capability. May be undefined if execution failed
   * or the capability returns no meaningful result.
   */
  result?: T;

  /**
   * Name of the capability that was executed.
   *
   * Used to identify which capability produced this result.
   */
  capability: string;

  /**
   * Whether the capability execution succeeded.
   *
   * true if the capability executed without error; false otherwise.
   */
  success: boolean;

  /**
   * Error information if execution failed.
   *
   * Set only when success is false. Provides details about what went wrong.
   */
  error?: Error;
}

/**
 * Capability executor interface for advanced execution strategies.
 *
 * Provides methods for executing capabilities with support for timeouts,
 * retries, batching, and conditional execution.
 *
 * @template T - Type of capabilities being executed (default: ICapability)
 *
 * @example
 * ```typescript
 * const executor = new CapabilityExecutor(provider);
 * const result = await executor.executeWithRetry('render', 3, entity, context);
 * ```
 */
export interface ICapabilityExecutor<T extends ICapability = ICapability> {
  /**
   * Execute a capability synchronously.
   *
   * Immediately executes the capability and returns the result or undefined
   * if the capability is not found.
   *
   * @template TResult - Type of execution result
   * @param capabilityName - Name of the capability to execute
   * @param args - Arguments to pass to the capability
   * @returns Result or undefined if capability not found
   * @throws May throw if capability execution throws
   *
   * @example
   * ```typescript
   * const result = executor.execute<number>('add', 5, 3);
   * ```
   */
  execute<TResult>(capabilityName: string, ...args: unknown[]): TResult | undefined;

  /**
   * Execute a capability asynchronously.
   *
   * Returns a Promise that resolves with the result or undefined
   * if the capability is not found.
   *
   * @template TResult - Type of execution result
   * @param capabilityName - Name of the capability to execute
   * @param args - Arguments to pass to the capability
   * @returns Promise resolving to result or undefined
   *
   * @example
   * ```typescript
   * const result = await executor.executeAsync<Data>('fetch', 'https://api.example.com');
   * ```
   */
  executeAsync<TResult>(capabilityName: string, ...args: unknown[]): Promise<TResult | undefined>;

  /**
   * Execute multiple capabilities in parallel.
   *
   * Executes all provided operations concurrently and returns results
   * as an array of capability results.
   *
   * @param operations - Array of capability operations to execute
   * @returns Promise resolving to array of capability results
   *
   * @example
   * ```typescript
   * const results = await executor.executeBatch([
   *   { capability: 'render', args: [entity, context] },
   *   { capability: 'serialize', args: [entity] },
   *   { capability: 'validate', args: [entity] }
   * ]);
   * ```
   */
  executeBatch(
    operations: Array<{
      capability: string;
      args: unknown[];
    }>
  ): Promise<ICapabilityResult[]>;

  /**
   * Execute a capability only if a condition is met.
   *
   * Checks the predicate against available capabilities and executes
   * if a matching capability is found.
   *
   * @param condition - Predicate to check capabilities
   * @param capabilityName - Name of the capability to execute
   * @param args - Arguments to pass to the capability
   * @returns Promise resolving to capability result or undefined
   *
   * @example
   * ```typescript
   * const result = await executor.executeIf(
   *   cap => cap.priority > 50,
   *   'render',
   *   entity,
   *   context
   * );
   * ```
   */
  executeIf(
    condition: (capability: T) => boolean,
    capabilityName: string,
    ...args: unknown[]
  ): Promise<ICapabilityResult | undefined>;

  /**
   * Execute a capability with automatic retry on failure.
   *
   * Attempts to execute the capability up to maxRetries times if it fails.
   * Returns the first successful result or the last error.
   *
   * @template TResult - Type of execution result
   * @param capabilityName - Name of the capability to execute
   * @param maxRetries - Maximum number of retry attempts
   * @param args - Arguments to pass to the capability
   * @returns Promise resolving to result or undefined
   *
   * @example
   * ```typescript
   * const result = await executor.executeWithRetry<Data>(
   *   'fetch',
   *   3, // Retry up to 3 times
   *   'https://api.example.com'
   * );
   * ```
   */
  executeWithRetry<TResult>(
    capabilityName: string,
    maxRetries: number,
    ...args: unknown[]
  ): Promise<TResult | undefined>;

  /**
   * Execute a capability with a timeout limit.
   *
   * Executes the capability with a maximum time limit. If execution
   * takes longer, it will be terminated and return undefined.
   *
   * @template TResult - Type of execution result
   * @param capabilityName - Name of the capability to execute
   * @param timeoutMs - Maximum execution time in milliseconds
   * @param args - Arguments to pass to the capability
   * @returns Promise resolving to result or undefined if timeout occurs
   *
   * @example
   * ```typescript
   * const result = await executor.executeWithTimeout<Data>(
   *   'heavyComputation',
   *   5000, // 5 second timeout
   *   complexData
   * );
   * ```
   */
  executeWithTimeout<TResult>(
    capabilityName: string,
    timeoutMs: number,
    ...args: unknown[]
  ): Promise<TResult | undefined>;
}

/**
 * Capability cache interface for optimizing repeated capability access.
 *
 * Provides caching with TTL (time-to-live) support for frequently accessed capabilities.
 *
 * @example
 * ```typescript
 * const cache = new CapabilityCache({ maxSize: 100, defaultTtlMs: 60000 });
 * cache.setCapability('render', renderCapability);
 * const cached = cache.getCapability('render');
 * ```
 */
export interface ICapabilityCache {
  /**
   * Retrieve a cached capability.
   *
   * @param name - Name of the capability to retrieve
   * @returns Capability if found and not expired; undefined otherwise
   *
   * @example
   * ```typescript
   * const cached = cache.getCapability('render');
   * if (cached) {
   *   console.log('Found cached capability');
   * }
   * ```
   */
  getCapability(name: string): ICapability | undefined;

  /**
   * Store a capability in the cache.
   *
   * Stores the capability with an optional TTL. If TTL is not specified,
   * the capability is stored indefinitely (until cleared).
   *
   * @param name - Name to store the capability under
   * @param capability - Capability to cache
   * @param ttlMs - Optional TTL in milliseconds
   *
   * @example
   * ```typescript
   * // Cache indefinitely
   * cache.setCapability('render', renderCapability);
   *
   * // Cache for 1 minute
   * cache.setCapability('fetch', fetchCapability, 60000);
   * ```
   */
  setCapability(name: string, capability: ICapability, ttlMs?: number): void;

  /**
   * Store multiple capabilities in batch.
   *
   * Efficiently stores multiple capabilities in a single operation.
   *
   * @param entries - Array of cache entries with capability, name, and optional TTL
   *
   * @example
   * ```typescript
   * cache.setCapabilities([
   *   { name: 'render', capability: renderCap, ttlMs: 60000 },
   *   { name: 'execute', capability: executeCap },
   *   { name: 'serialize', capability: serializeCap, ttlMs: 30000 }
   * ]);
   * ```
   */
  setCapabilities(
    entries: Array<{
      name: string;
      capability: ICapability;
      ttlMs?: number;
    }>
  ): void;

  /**
   * Clean up expired cache entries.
   *
   * Removes all entries that have exceeded their TTL. Should be called
   * periodically to prevent memory bloat.
   *
   * @example
   * ```typescript
   * // Run cleanup every 5 minutes
   * setInterval(() => cache.cleanup(), 5 * 60 * 1000);
   * ```
   */
  cleanup(): void;

  /**
   * Clear all cached capabilities.
   *
   * Removes all entries from the cache regardless of TTL.
   *
   * @example
   * ```typescript
   * cache.clear();
   * console.log(cache.getCapability('render')); // undefined
   * ```
   */
  clear(): void;

  /**
   * Get cache statistics for monitoring.
   *
   * Returns detailed statistics about cache performance and state.
   *
   * @returns Object with cache statistics
   *
   * @example
   * ```typescript
   * const stats = cache.getStats();
   * console.log(`Cache hit rate: ${stats.hitRate * 100}%`);
   * console.log(`Average access time: ${stats.averageAccessTime}ms`);
   * ```
   */
  getStats(): {
    /** Total number of cached entries */
    size: number;
    /** Cache hit rate (0-1) */
    hitRate: number;
    /** Cache miss rate (0-1) */
    missRate: number;
    /** Number of expired entries */
    expiredCount: number;
    /** Average access time in milliseconds */
    averageAccessTime: number;
  };
}

/**
 * Capability manager interface for high-level capability orchestration.
 *
 * Coordinates provider, executor, and cache to provide a unified interface
 * for capability management and execution.
 *
 * @template T - Type of capabilities being managed (default: ICapability)
 *
 * @example
 * ```typescript
 * const manager = new CapabilityManager(provider, executor, cache);
 * await manager.smartExecute('render', { timeout: 5000 }, entity, context);
 * ```
 */
export interface ICapabilityManager<T extends ICapability = ICapability> {
  /**
   * The underlying capability provider.
   *
   * Provides direct access to the capability collection management.
   */
  readonly provider: ICapabilityProvider<T>;

  /**
   * The underlying capability executor.
   *
   * Provides direct access to execution strategies.
   */
  readonly executor: ICapabilityExecutor<T>;

  /**
   * The underlying capability cache.
   *
   * Provides direct access to caching operations.
   */
  readonly cache: ICapabilityCache;

  /**
   * Register a single capability.
   *
   * Adds a capability to the provider and optionally caches it.
   * Returns this for method chaining.
   *
   * @param capability - Capability to register
   * @returns The manager instance for chaining
   *
   * @example
   * ```typescript
   * manager.registerCapability(renderCapability);
   * ```
   */
  registerCapability(capability: T): this;

  /**
   * Register multiple capabilities in batch.
   *
   * Adds multiple capabilities efficiently. Returns this for method chaining.
   *
   * @param capabilities - Array of capabilities to register
   * @returns The manager instance for chaining
   *
   * @example
   * ```typescript
   * manager.registerCapabilities([
   *   renderCapability,
   *   executeCapability,
   *   validateCapability
   * ]);
   * ```
   */
  registerCapabilities(capabilities: T[]): this;

  /**
   * Intelligently execute a capability with automatic optimization.
   *
   * Automatically selects the best execution strategy based on configuration
   * and system state. May retry, timeout, or use cached results.
   *
   * @template TResult - Type of execution result
   * @param capabilityName - Name of the capability to execute
   * @param options - Optional execution options
   * @param options.timeout - Maximum execution time in milliseconds
   * @param options.retries - Maximum number of retry attempts
   * @param options.condition - Optional predicate for capability filtering
   * @param args - Arguments to pass to the capability
   * @returns Promise resolving to result or undefined
   *
   * @example
   * ```typescript
   * const result = await manager.smartExecute<ReactElement>(
   *   'render',
   *   { timeout: 5000, retries: 3 },
   *   entity,
   *   context
   * );
   * ```
   */
  smartExecute<TResult>(
    capabilityName: string,
    options?: {
      timeout?: number;
      retries?: number;
      condition?: (capability: T) => boolean;
    },
    ...args: unknown[]
  ): Promise<TResult | undefined>;

  /**
   * Get comprehensive performance report.
   *
   * Returns detailed performance statistics about capability execution.
   *
   * @returns Object with performance metrics
   *
   * @example
   * ```typescript
   * const report = manager.getPerformanceReport();
   * console.log(`Total capabilities: ${report.totalCapabilities}`);
   * console.log(`Total executions: ${report.totalExecutions}`);
   * console.log(`Top performers:`, report.topPerformers);
   * ```
   */
  getPerformanceReport(): {
    /** Total number of registered capabilities */
    totalCapabilities: number;
    /** Total number of capability executions */
    totalExecutions: number;
    /** Average execution time in milliseconds */
    averageExecutionTime: number;
    /** Cache statistics */
    cacheStats: ReturnType<ICapabilityCache["getStats"]>;
    /** Best performing capabilities */
    topPerformers: Array<{ name: string; avgTime: number; count: number }>;
  };

  /**
   * Perform a health check on the capability system.
   *
   * Checks for issues and provides recommendations.
   *
   * @returns Object with health status and diagnostics
   *
   * @example
   * ```typescript
   * const health = manager.healthCheck();
   * if (health.status === 'healthy') {
   *   console.log('System is operating normally');
   * } else {
   *   console.warn('Issues found:', health.issues);
   *   console.log('Recommendations:', health.recommendations);
   * }
   * ```
   */
  healthCheck(): {
    /** Overall system health status */
    status: "healthy" | "degraded" | "unhealthy";
    /** Array of identified issues */
    issues: string[];
    /** Recommended actions to fix issues */
    recommendations: string[];
  };
}

/**
 * Global capability system configuration.
 *
 * Configuration object for system-wide settings affecting caching,
 * execution, and debugging behavior.
 *
 * @example
 * ```typescript
 * const config: ICapabilitySystemConfig = {
 *   cache: {
 *     enabled: true,
 *     defaultTtlMs: 60000,
 *     maxSize: 100,
 *     cleanupIntervalMs: 5 * 60 * 1000
 *   },
 *   execution: {
 *     defaultTimeoutMs: 5000,
 *     defaultMaxRetries: 3,
 *     enablePerformanceTracking: true
 *   },
 *   debug: {
 *     enabled: false,
 *     logLevel: 'warn'
 *   }
 * };
 * ```
 */
export interface ICapabilitySystemConfig {
  /**
   * Global caching configuration.
   *
   * Controls how capabilities are cached and cache maintenance.
   *
   * @property enabled - Whether caching is enabled globally
   * @property defaultTtlMs - Default time-to-live for cached capabilities in milliseconds
   * @property maxSize - Maximum number of items to cache
   * @property cleanupIntervalMs - How often to clean up expired entries
   *
   * @example
   * ```typescript
   * cache: {
   *   enabled: true,
   *   defaultTtlMs: 60000,      // 1 minute default TTL
   *   maxSize: 100,              // Max 100 cached capabilities
   *   cleanupIntervalMs: 300000  // Cleanup every 5 minutes
   * }
   * ```
   */
  cache?: {
    /** Whether caching is enabled */
    enabled: boolean;
    /** Default TTL for cached capabilities in milliseconds */
    defaultTtlMs?: number;
    /** Maximum number of cached entries */
    maxSize?: number;
    /** Cleanup interval in milliseconds */
    cleanupIntervalMs?: number;
  };

  /**
   * Global execution configuration.
   *
   * Controls default behavior for capability execution.
   *
   * @property defaultTimeoutMs - Default timeout for all capability executions
   * @property defaultMaxRetries - Default number of retry attempts
   * @property enablePerformanceTracking - Whether to track execution performance
   *
   * @example
   * ```typescript
   * execution: {
   *   defaultTimeoutMs: 5000,        // 5 second default timeout
   *   defaultMaxRetries: 3,          // Retry 3 times by default
   *   enablePerformanceTracking: true // Track all execution metrics
   * }
   * ```
   */
  execution?: {
    /** Default timeout for executions in milliseconds */
    defaultTimeoutMs?: number;
    /** Default maximum number of retries */
    defaultMaxRetries?: number;
    /** Enable performance metrics collection */
    enablePerformanceTracking?: boolean;
  };

  /**
   * Global debugging configuration.
   *
   * Controls logging and tracing behavior for troubleshooting.
   *
   * @property enabled - Whether debugging is enabled
   * @property logLevel - Minimum log level to output
   * @property enableTracing - Whether to enable execution tracing
   *
   * @example
   * ```typescript
   * debug: {
   *   enabled: process.env.DEBUG === 'true',
   *   logLevel: 'debug',      // Log all messages including debug
   *   enableTracing: true     // Trace capability calls
   * }
   * ```
   */
  debug?: {
    /** Whether debugging is enabled */
    enabled: boolean;
    /** Minimum log level: 'error' | 'warn' | 'info' | 'debug' */
    logLevel: "error" | "warn" | "info" | "debug";
    /** Enable execution tracing */
    enableTracing?: boolean;
  };
}
