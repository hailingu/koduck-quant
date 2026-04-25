/**
 * Concrete Capability Implementations Module
 *
 * This module defines six specialized capability implementations for Duck Flow's capability system.
 * Each capability interface represents a specific type of functionality that can be applied to entities
 * within the flow system.
 *
 * **Core Capabilities**:
 * 1. **IRenderCapability** - Rendering entities to React components
 * 2. **IExecuteCapability** - Executing business logic on entities
 * 3. **ISerializeCapability** - Converting entities to various serialization formats
 * 4. **IValidateCapability** - Validating entity state and consistency
 * 5. **ITransformCapability** - Transforming entities between types
 * 6. **ILifecycleCapability** - Managing entity lifecycle events (create, update, destroy)
 *
 * **Design Pattern**: Strategy Pattern
 * - Each capability is independent and focused on a single responsibility
 * - All capabilities follow the same contract (canHandle → execute flow)
 * - Can be combined using the capability system for flexible entity processing
 *
 * **Type Safety**: All generic parameters are precisely typed to ensure compile-time safety
 *
 * **Usage Example**:
 * ```typescript
 * // Render capability
 * const renderCap: IRenderCapability = {
 *   name: 'render',
 *   canHandle: (entity) => entity.type === 'component',
 *   execute: (entity, context) => <MyComponent data={entity} />,
 * };
 *
 * // Execute capability
 * const executeCap: IExecuteCapability = {
 *   name: 'execute',
 *   canHandle: (entity) => entity.executable,
 *   execute: (entity, params) => entity.run(params),
 * };
 * ```
 *
 * **Performance Considerations**:
 * - All execute methods support both sync and async returns for flexibility
 * - canHandle is called before execute, allowing quick filtering
 * - Capability instances can be cached for reuse
 *
 * @module Capabilities
 * @see {@link ICapability} - Base capability interface
 * @see {@link AutoRegistry} - Decorator for automatic capability registration
 */

import type { IEntity } from "../../common/entity/types";
import type { IRenderContext } from "../../common/render/context";
import type { ICapability } from "./types";
import React from "react";

/**
 * Render Capability Interface
 *
 * Specialized capability for converting entities into React components.
 * This is the core capability used by the rendering system to visualize entities
 * within the flow framework.
 *
 * **Responsibility**:
 * - Determine if an entity can be rendered (canHandle)
 * - Convert the entity to a React component (execute)
 * - Apply optional CSS styling to rendered output
 *
 * **Type Parameters**:
 * - Args: `[IEntity, IRenderContext?]` - Entity and optional render context
 * - Result: `React.ReactElement | void` - React element or void if rendering fails
 *
 * **Typical Usage**:
 * ```typescript
 * // Create a render capability for button entities
 * const buttonRender: IRenderCapability = {
 *   name: 'render',
 *   css: { padding: '8px', cursor: 'pointer' },
 *   canHandle: (entity) => entity.type === 'button',
 *   execute: async (entity, context) => {
 *     const label = await entity.getLabel();
 *     return (
 *       <button onClick={() => entity.click()}>
 *         {label}
 *       </button>
 *     );
 *   },
 * };
 * ```
 *
 * **Performance Notes**:
 * - canHandle should be quick; typically O(1) complexity
 * - execute can be async for complex rendering scenarios
 * - CSS styles are optional and can be applied at the container level
 *
 * @see {@link ICapability} - Base capability interface
 * @see {@link IRenderContext} - Rendering context information
 * @see {@link IEntity} - Entity base type
 *
 * @example
 * ```typescript
 * const cap: IRenderCapability = {
 *   name: 'render',
 *   canHandle: (entity) => entity.renderable,
 *   execute: (entity) => <Component data={entity} />
 * };
 * ```
 */
export interface IRenderCapability
  extends ICapability<[IEntity, IRenderContext?], React.ReactElement | void> {
  /**
   * Capability name - always 'render'
   *
   * Used for identifying and selecting this capability within the capability system.
   * Must be the literal string 'render' for type safety.
   *
   * @example
   * ```typescript
   * if (capability.name === 'render') {
   *   // Handle as render capability
   * }
   * ```
   */
  readonly name: "render";

  /**
   * Optional CSS styles for rendered element
   *
   * Applied to the root container of the rendered React element.
   * Allows declarative styling without inline style attributes.
   *
   * - Styles are applied by the rendering framework
   * - Can be overridden at container level
   * - Performance: Static object, no recomputation needed
   *
   * @example
   * ```typescript
   * css: {
   *   padding: '16px',
   *   border: '1px solid #ddd',
   *   borderRadius: '4px'
   * }
   * ```
   */
  readonly css?: React.CSSProperties;

  /**
   * Determine if this capability can render the given entity
   *
   * Called before execute to quickly filter capabilities.
   * Should return true only if this capability can successfully render the entity.
   *
   * @param entity - The entity to check for renderability
   * @param context - Optional render context (theme, locale, viewport, etc.)
   * @returns true if this capability can render the entity, false otherwise
   *
   * Should be a quick O(1) check when possible. Can inspect entity properties
   * to make determination. Should not have side effects.
   *
   * @example
   * ```typescript
   * canHandle: (entity, context) => {
   *   return entity.type === 'component' && entity.renderable;
   * }
   * ```
   */
  canHandle(entity: IEntity, context?: IRenderContext): boolean;

  /**
   * Execute the rendering operation
   *
   * Converts the entity into a React component or element.
   * Supports both synchronous and asynchronous rendering.
   *
   * @param entity - The entity to render
   * @param context - Optional render context with theme, locale, etc.
   * @returns React element tree or undefined if rendering fails
   *
   * Can return a Promise for async rendering. Should return void/undefined if unable
   * to render (after canHandle returned true). React.memo or useMemo can optimize
   * re-renders. May throw errors which are caught by the rendering system.
   *
   * @example
   * ```typescript
   * execute: async (entity, context) => {
   *   const data = await entity.loadData();
   *   const theme = context?.theme || defaultTheme;
   *   return <EntityComponent data={data} theme={theme} />;
   * }
   * ```
   */
  execute(
    entity: IEntity,
    context?: IRenderContext
  ): Promise<React.ReactElement | void> | React.ReactElement | void;
}

/**
 * Execute Capability Interface
 *
 * Specialized capability for executing business logic on entities.
 * Represents operations that transform or mutate entity state.
 *
 * **Responsibility**:
 * - Determine if an entity can be executed (canHandle)
 * - Execute entity business logic with parameters (execute)
 * - Return results of execution
 *
 * **Type Parameters**:
 * - Args: `[IEntity, unknown]` - Entity and execution parameters
 * - Result: `unknown` - Execution result (any type)
 *
 * **Typical Usage**:
 * ```typescript
 * // Execute capability for workflow nodes
 * const workflowExecutor: IExecuteCapability = {
 *   name: 'execute',
 *   canHandle: (entity) => entity.isExecutable,
 *   execute: async (entity, params) => {
 *     return entity.workflow(params);
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * const cap: IExecuteCapability = {
 *   name: 'execute',
 *   canHandle: (entity) => entity.executable,
 *   execute: async (entity, params) => await entity.run(params)
 * };
 * ```
 */
export interface IExecuteCapability extends ICapability<[IEntity, unknown], unknown> {
  /**
   * Capability name - always 'execute'
   *
   * Used for identifying this capability in the capability system.
   * Must be the literal string 'execute' for type discrimination.
   */
  readonly name: "execute";

  /**
   * Determine if this capability can execute the given entity
   *
   * Quick predicate to check executability before calling execute.
   *
   * @param entity - The entity to check for executability
   * @param params - Optional execution parameters
   * @returns true if this capability can execute the entity, false otherwise
   *
   * @example
   * ```typescript
   * canHandle: (entity, params) => {
   *   return entity.type === 'action' && entity.isEnabled;
   * }
   * ```
   */
  canHandle(entity: IEntity, params: unknown): boolean;

  /**
   * Execute entity logic
   *
   * Runs the entity's business logic with the provided parameters.
   * Supports both sync and async execution.
   *
   * @param entity - The entity to execute
   * @param params - Execution parameters (structure depends on entity type)
   * @returns Execution result (type depends on entity implementation)
   *
   * @example
   * ```typescript
   * execute: (entity, params) => {
   *   return entity.handler(params);
   * }
   * ```
   */
  execute(entity: IEntity, params: unknown): Promise<unknown> | unknown;
}

/**
 * Serialize Capability Interface
 *
 * Specialized capability for converting entities into various serialization formats.
 * Supports multiple formats (JSON, XML, YAML) for flexible data exchange.
 *
 * **Responsibility**:
 * - Determine if entity can be serialized (canHandle)
 * - Convert entity to serialization format (execute)
 * - Support multiple format options
 *
 * **Type Parameters**:
 * - Args: `[IEntity, Record<string, unknown>?]` - Entity and optional options
 * - Result: `string | Record<string, unknown>` - Serialized data (string or object)
 *
 * **Typical Usage**:
 * ```typescript
 * const jsonSerializer: ISerializeCapability = {
 *   name: 'serialize',
 *   format: 'json',
 *   canHandle: (entity) => entity.serializable,
 *   execute: (entity, options) => {
 *     return JSON.stringify(entity, null, 2);
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * const cap: ISerializeCapability = {
 *   name: 'serialize',
 *   format: 'json',
 *   canHandle: (entity) => entity.type === 'data',
 *   execute: (entity, opts) => ({ id: entity.id, ...entity.data })
 * };
 * ```
 */
export interface ISerializeCapability
  extends ICapability<[IEntity, Record<string, unknown>?], string | Record<string, unknown>> {
  /**
   * Capability name - always 'serialize'
   *
   * Identifies this as a serialization capability in the system.
   */
  readonly name: "serialize";

  /**
   * Serialization format
   *
   * Indicates the output format of serialization:
   * - 'json' - JSON text format
   * - 'xml' - XML text format
   * - 'yaml' - YAML text format
   * - 'custom' - Custom format defined by implementation
   *
   * @default undefined
   */
  readonly format?: "json" | "xml" | "yaml" | "custom";

  /**
   * Determine if entity can be serialized
   *
   * Quick check before attempting serialization.
   *
   * @param entity - Entity to check for serializability
   * @param options - Optional serialization options
   * @returns true if serialization is supported, false otherwise
   *
   * @example
   * ```typescript
   * canHandle: (entity, options) => {
   *   return entity.serializable && (!options?.strict || entity.validated);
   * }
   * ```
   */
  canHandle(entity: IEntity, options?: Record<string, unknown>): boolean;

  /**
   * Execute serialization
   *
   * Convert the entity to the specified serialization format.
   * Supports both sync and async operations.
   *
   * @param entity - Entity to serialize
   * @param options - Serialization options (e.g., includeMetadata, compress, etc.)
   * @returns Serialized data as string or object
   *
   * @example
   * ```typescript
   * execute: async (entity, options) => {
   *   const data = await entity.toSerializable();
   *   return JSON.stringify(data);
   * }
   * ```
   */
  execute(
    entity: IEntity,
    options?: Record<string, unknown>
  ): Promise<string | Record<string, unknown>> | string | Record<string, unknown>;
}

/**
 * Validate Capability Interface
 *
 * Specialized capability for validating entity state and consistency.
 * Returns structured validation results including any errors found.
 *
 * **Responsibility**:
 * - Determine if entity can be validated (canHandle)
 * - Validate entity state (execute)
 * - Return validation result with error details
 *
 * **Type Parameters**:
 * - Args: `[IEntity, Record<string, unknown>?]` - Entity and validation options
 * - Result: `{ valid: boolean; errors?: string[] }` - Validation result
 *
 * **Typical Usage**:
 * ```typescript
 * const validator: IValidateCapability = {
 *   name: 'validate',
 *   rules: ['required', 'format', 'consistency'],
 *   canHandle: (entity) => entity.validatable,
 *   execute: (entity) => {
 *     const errors = [];
 *     if (!entity.id) errors.push('ID is required');
 *     return {
 *       valid: errors.length === 0,
 *       errors: errors.length > 0 ? errors : undefined,
 *     };
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * const cap: IValidateCapability = {
 *   name: 'validate',
 *   rules: ['required'],
 *   canHandle: (entity) => entity.type === 'form',
 *   execute: (entity) => {
 *     const valid = entity.allFieldsValid;
 *     return { valid, errors: valid ? undefined : entity.getErrors() };
 *   }
 * };
 * ```
 */
export interface IValidateCapability
  extends ICapability<[IEntity, Record<string, unknown>?], { valid: boolean; errors?: string[] }> {
  /**
   * Capability name - always 'validate'
   *
   * Identifies this as a validation capability.
   */
  readonly name: "validate";

  /**
   * Validation rules applied
   *
   * List of rule names used for validation:
   * - 'required' - Check for required fields
   * - 'format' - Check data format validity
   * - 'consistency' - Check cross-field consistency
   * - 'custom' - Custom validation rule
   *
   * @default undefined
   */
  readonly rules?: string[];

  /**
   * Determine if entity can be validated
   *
   * Check before attempting validation.
   *
   * @param entity - Entity to check for validity
   * @param options - Optional validation options
   * @returns true if validation is possible, false otherwise
   *
   * @example
   * ```typescript
   * canHandle: (entity, options) => entity.validatable
   * ```
   */
  canHandle(entity: IEntity, options?: Record<string, unknown>): boolean;

  /**
   * Execute validation
   *
   * Validate the entity state and return structured results.
   * Supports both sync and async validation.
   *
   * @param entity - Entity to validate
   * @param options - Validation options (strictness, rules, etc.)
   * @returns Validation result with valid flag and error list
   *
   * @example
   * ```typescript
   * execute: async (entity, options) => {
   *   const validationResult = await entity.validate();
   *   return {
   *     valid: validationResult.ok,
   *     errors: validationResult.errors
   *   };
   * }
   * ```
   */
  execute(
    entity: IEntity,
    options?: Record<string, unknown>
  ): Promise<{ valid: boolean; errors?: string[] }> | { valid: boolean; errors?: string[] };
}

/**
 * Transform Capability Interface
 *
 * Specialized capability for transforming entities between different types or formats.
 * Enables flexible entity conversion and adaptation strategies.
 *
 * **Responsibility**:
 * - Determine if entity can be transformed to target type (canHandle)
 * - Transform entity to new type (execute)
 * - Support multiple transform types
 *
 * **Type Parameters**:
 * - Args: `[IEntity, string, Record<string, unknown>?]` - Entity, target type, options
 * - Result: `IEntity` - Transformed entity
 *
 * **Typical Usage**:
 * ```typescript
 * const transformer: ITransformCapability = {
 *   name: 'transform',
 *   supportedTransforms: ['toView', 'toDTO', 'toModel'],
 *   canHandle: (entity, targetType) => {
 *     return ['toView', 'toDTO'].includes(targetType);
 *   },
 *   execute: (entity, targetType) => {
 *     if (targetType === 'toView') return entity.toView();
 *     if (targetType === 'toDTO') return entity.toDTO();
 *     throw new Error(`Unsupported transform: ${targetType}`);
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * const cap: ITransformCapability = {
 *   name: 'transform',
 *   supportedTransforms: ['toJSON', 'toXML'],
 *   canHandle: (entity, type) => entity.transformable,
 *   execute: (entity, type) => type === 'toJSON' ? entity.toJSON() : entity.toXML()
 * };
 * ```
 */
export interface ITransformCapability
  extends ICapability<[IEntity, string, Record<string, unknown>?], IEntity> {
  /**
   * Capability name - always 'transform'
   *
   * Identifies this as a transformation capability.
   */
  readonly name: "transform";

  /**
   * Supported transformation types
   *
   * List of available transformation targets:
   * - 'toView' - Transform to view model
   * - 'toDTO' - Transform to data transfer object
   * - 'toModel' - Transform to domain model
   * - Custom types as needed
   *
   * @default undefined
   */
  readonly supportedTransforms?: string[];

  /**
   * Determine if entity can be transformed
   *
   * Check if transformation to target type is supported.
   *
   * @param entity - Entity to transform
   * @param targetType - Target transformation type
   * @param options - Optional transformation options
   * @returns true if transformation is supported, false otherwise
   *
   * @example
   * ```typescript
   * canHandle: (entity, targetType, options) => {
   *   return this.supportedTransforms?.includes(targetType) ?? false;
   * }
   * ```
   */
  canHandle(entity: IEntity, targetType: string, options?: Record<string, unknown>): boolean;

  /**
   * Execute transformation
   *
   * Transform the entity to the specified target type.
   * Supports both sync and async transformations.
   *
   * @param entity - Entity to transform
   * @param targetType - Target transformation type
   * @param options - Transformation options (strategy, depth, etc.)
   * @returns Transformed entity instance
   *
   * @example
   * ```typescript
   * execute: async (entity, targetType, options) => {
   *   if (targetType === 'toDTO') {
   *     return entity.toDTO(options?.depth);
   *   }
   *   throw new Error(`Unknown transform: ${targetType}`);
   * }
   * ```
   */
  execute(
    entity: IEntity,
    targetType: string,
    options?: Record<string, unknown>
  ): Promise<IEntity> | IEntity;
}

/**
 * Lifecycle Capability Interface
 *
 * Specialized capability for managing entity lifecycle events (create, update, destroy).
 * Enables reactive handling of entity state transitions.
 *
 * **Responsibility**:
 * - Determine if entity lifecycle can be handled (canHandle)
 * - Execute lifecycle hooks (execute)
 * - Support create, update, and destroy phases
 *
 * **Type Parameters**:
 * - Args: `[IEntity, 'create'|'update'|'destroy', Record<string, unknown>?]` - Entity, phase, options
 * - Result: `void` - Lifecycle handlers typically have no return value
 *
 * **Typical Usage**:
 * ```typescript
 * const lifecycleHandler: ILifecycleCapability = {
 *   name: 'lifecycle',
 *   supportedPhases: ['create', 'update', 'destroy'],
 *   canHandle: (entity, phase) => entity.hasLifecycle,
 *   execute: async (entity, phase) => {
 *     if (phase === 'create') await entity.onCreate();
 *     if (phase === 'update') await entity.onUpdate();
 *     if (phase === 'destroy') await entity.onDestroy();
 *   },
 * };
 * ```
 *
 * @example
 * ```typescript
 * const cap: ILifecycleCapability = {
 *   name: 'lifecycle',
 *   supportedPhases: ['create', 'destroy'],
 *   canHandle: (entity, phase) => entity.lifecycle?.includes(phase),
 *   execute: (entity, phase) => {
 *     entity.hooks?.[phase]?.();
 *   }
 * };
 * ```
 */
export interface ILifecycleCapability
  extends ICapability<[IEntity, "create" | "update" | "destroy", Record<string, unknown>?], void> {
  /**
   * Capability name - always 'lifecycle'
   *
   * Identifies this as a lifecycle capability.
   */
  readonly name: "lifecycle";

  /**
   * Supported lifecycle phases
   *
   * List of lifecycle phases this capability handles:
   * - 'create' - Entity creation phase
   * - 'update' - Entity update phase
   * - 'destroy' - Entity destruction/cleanup phase
   *
   * @default undefined
   */
  readonly supportedPhases?: Array<"create" | "update" | "destroy">;

  /**
   * Determine if entity lifecycle can be handled
   *
   * Check if this capability supports the given lifecycle phase.
   *
   * @param entity - Entity to check
   * @param phase - Lifecycle phase ('create', 'update', or 'destroy')
   * @param options - Optional lifecycle options
   * @returns true if lifecycle phase is supported, false otherwise
   *
   * @example
   * ```typescript
   * canHandle: (entity, phase, options) => {
   *   return this.supportedPhases?.includes(phase) ?? false;
   * }
   * ```
   */
  canHandle(
    entity: IEntity,
    phase: "create" | "update" | "destroy",
    options?: Record<string, unknown>
  ): boolean;

  /**
   * Execute lifecycle handler
   *
   * Handle the specified lifecycle phase for the entity.
   * Supports both sync and async handlers.
   *
   * @param entity - Entity undergoing lifecycle transition
   * @param phase - Lifecycle phase to handle ('create', 'update', or 'destroy')
   * @param options - Lifecycle options (context data, flags, etc.)
   * @returns void or Promise<void>
   *
   * @example
   * ```typescript
   * execute: async (entity, phase, options) => {
   *   switch (phase) {
   *     case 'create':
   *       await entity.initialize(options);
   *       break;
   *     case 'update':
   *       await entity.refresh(options);
   *       break;
   *     case 'destroy':
   *       await entity.cleanup();
   *       break;
   *   }
   * }
   * ```
   */
  execute(
    entity: IEntity,
    phase: "create" | "update" | "destroy",
    options?: Record<string, unknown>
  ): Promise<void> | void;
}

/**
 * Specific Capability Union Type
 *
 * Union of all six concrete capability implementations.
 * Used for type-safe capability handling and discrimination.
 *
 * Represents any of the specialized capabilities:
 * - IRenderCapability - Rendering to React components
 * - IExecuteCapability - Business logic execution
 * - ISerializeCapability - Data serialization
 * - IValidateCapability - State validation
 * - ITransformCapability - Type transformation
 * - ILifecycleCapability - Lifecycle management
 *
 * @example
 * ```typescript
 * function handleCapability(cap: SpecificCapability) {
 *   switch (cap.name) {
 *     case 'render':
 *       // Handle render capability
 *       break;
 *     case 'execute':
 *       // Handle execute capability
 *       break;
 *     default:
 *       // Handle other capabilities
 *   }
 * }
 * ```
 *
 * @see {@link IRenderCapability}
 * @see {@link IExecuteCapability}
 * @see {@link ISerializeCapability}
 */
export type SpecificCapability =
  | IRenderCapability
  | IExecuteCapability
  | ISerializeCapability
  | IValidateCapability
  | ITransformCapability
  | ILifecycleCapability;

/**
 * Capability Name Constants
 *
 * Enumeration of all capability names used in the system.
 * Using constants ensures type safety and prevents typos.
 *
 * Values:
 * - `RENDER: 'render'` - Rendering capability name
 * - `EXECUTE: 'execute'` - Execution capability name
 * - `SERIALIZE: 'serialize'` - Serialization capability name
 * - `VALIDATE: 'validate'` - Validation capability name
 * - `TRANSFORM: 'transform'` - Transformation capability name
 * - `LIFECYCLE: 'lifecycle'` - Lifecycle capability name
 *
 * @example
 * ```typescript
 * const capName = CAPABILITY_NAMES.RENDER; // 'render'
 *
 * if (capability.name === CAPABILITY_NAMES.RENDER) {
 *   // Type-safe comparison
 * }
 * ```
 */
export const CAPABILITY_NAMES = {
  RENDER: "render" as const,
  EXECUTE: "execute" as const,
  SERIALIZE: "serialize" as const,
  VALIDATE: "validate" as const,
  TRANSFORM: "transform" as const,
  LIFECYCLE: "lifecycle" as const,
} as const;

/**
 * Capability Name Type
 *
 * Derived type representing all valid capability names.
 * Created from CAPABILITY_NAMES constant for type safety.
 *
 * Equivalent to: `'render' | 'execute' | 'serialize' | 'validate' | 'transform' | 'lifecycle'`
 *
 * @example
 * ```typescript
 * function requireCapability(name: CapabilityName) {
 *   // name is guaranteed to be a valid capability name
 * }
 * ```
 *
 * @see {@link CAPABILITY_NAMES}
 */
export type CapabilityName = (typeof CAPABILITY_NAMES)[keyof typeof CAPABILITY_NAMES];

/**
 * Capability Factory Interface
 *
 * Factory pattern for creating capability instances.
 * Allows decoupling of capability creation from usage.
 *
 * **Responsibilities**:
 * - Create new capability instances by name
 * - Report supported capability names
 * - Check capability support before creation
 *
 * **Type Parameter**:
 * - `T extends ICapability` - Specific capability type or base ICapability
 *
 * **Typical Usage**:
 * ```typescript
 * class CapabilityFactory implements ICapabilityFactory {
 *   createCapability(name: string): ICapability | undefined {
 *     switch (name) {
 *       case 'render':
 *         return new RenderCapability();
 *       case 'execute':
 *         return new ExecuteCapability();
 *       default:
 *         return undefined;
 *     }
 *   }
 *
 *   getSupportedCapabilities(): string[] {
 *     return ['render', 'execute', 'serialize'];
 *   }
 * }
 * ```
 *
 * @template T - Capability type created by this factory (default: ICapability)
 *
 * @example
 * ```typescript
 * const factory: ICapabilityFactory = new CapabilityFactory();
 *
 * // Check before creating
 * if (factory.supportsCapability('render')) {
 *   const cap = factory.createCapability('render');
 * }
 * ```
 *
 * @see {@link SpecificCapability}
 * @see {@link ICapability}
 */
export interface ICapabilityFactory<T extends ICapability = ICapability> {
  /**
   * Create a capability instance
   *
   * Instantiate a capability by name with optional configuration.
   * Returns undefined if the capability is not supported.
   *
   * @param name - Capability name (must match CAPABILITY_NAMES)
   * @param config - Optional configuration object for capability initialization
   * @returns Created capability instance or undefined if not supported
   *
   * @example
   * ```typescript
   * const cap = factory.createCapability('render', { theme: 'dark' });
   * if (cap) {
   *   // Use capability
   * } else {
   *   console.warn('Render capability not supported');
   * }
   * ```
   */
  createCapability(name: string, config?: Record<string, unknown>): T | undefined;

  /**
   * Get list of supported capability names
   *
   * Returns all capability names that this factory can create.
   *
   * @returns Array of supported capability names
   *
   * @example
   * ```typescript
   * const supported = factory.getSupportedCapabilities();
   * console.log('Available capabilities:', supported);
   * // Output: ['render', 'execute', 'serialize']
   * ```
   */
  getSupportedCapabilities(): string[];

  /**
   * Check if a capability is supported
   *
   * Quick predicate to check if this factory can create a capability.
   * More efficient than checking `getSupportedCapabilities().includes(name)`.
   *
   * @param name - Capability name to check
   * @returns true if supported, false otherwise
   *
   * @example
   * ```typescript
   * if (factory.supportsCapability('validate')) {
   *   const validator = factory.createCapability('validate');
   * }
   * ```
   */
  supportsCapability(name: string): boolean;
}
