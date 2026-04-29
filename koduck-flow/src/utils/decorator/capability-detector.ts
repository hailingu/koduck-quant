/**
 * Capability Detection Module
 *
 * Provides runtime detection of capabilities from class prototypes and methods.
 * Enables automatic capability discovery and wrapping for entities.
 *
 * **Key Components**:
 * 1. **DefaultCapabilityDetector** - Pattern-based capability detection
 * 2. **BaseCapability** - Abstract capability base class
 * 3. **EntityMethodCapability** - Wraps entity methods as capabilities
 *
 * **Detection Mechanism**:
 * - Scans class prototype for method names
 * - Matches method names against capability patterns (regex)
 * - Identifies capability types (render, execute, serialize, etc.)
 * - Extracts capability hierarchy via prototype chain
 *
 * **Patterns Supported**:
 * - Render: render, canRender, getRenderStyle
 * - Execute: execute, canExecute, run
 * - Serialize: serialize, deserialize, toJSON, fromJSON
 * - Validate: validate, isValid, check
 * - Transform: transform, convert, map
 * - Lifecycle: init, destroy, dispose, cleanup
 *
 * **Usage**:
 * ```typescript
 * const detector = new DefaultCapabilityDetector();
 *
 * // Detect capabilities on a prototype
 * const capabilities = detector.detectCapabilities(MyEntity.prototype);
 * // Result: ['render', 'execute', 'validate']
 *
 * // Create capability from method
 * const cap = detector.createCapabilityFromMethod(
 *   'render',
 *   entity.render.bind(entity),
 *   MyEntity.prototype
 * );
 *
 * // Or wrap directly
 * const wrapped = new EntityMethodCapability(
 *   entity,
 *   'render',
 *   'render',
 *   { canHandleMethodName: 'canRender' }
 * );
 * ```
 *
 * @module CapabilityDetector
 * @see {@link ICapabilityDetector} - Detector interface
 * @see {@link ICapability} - Capability interface
 */

import type { ICapability, ICapabilityDetector } from "./types";

/**
 * Default Capability Detector Implementation
 *
 * Detects capabilities from object prototypes using pattern matching.
 * Supports custom pattern registration for extensibility.
 *
 * **Detection Strategy**:
 * - Method name pattern matching using regex
 * - Prototype chain traversal to find all methods
 * - Capability aggregation (set-based deduplication)
 *
 * **Extensibility**:
 * - addCapabilityPattern() - Register custom patterns
 * - removeCapabilityPattern() - Remove patterns
 * - createCapabilityFromMethod() - Auto-wrap methods
 *
 * @implements {ICapabilityDetector}
 *
 * @example
 * ```typescript
 * const detector = new DefaultCapabilityDetector();
 *
 * // Detect all capabilities
 * const caps = detector.detectCapabilities(obj.prototype);
 *
 * // Add custom pattern
 * detector.addCapabilityPattern('export', [/^export/, /^toExport/]);
 *
 * // Check single method
 * const type = detector.detectMethodCapability('render', renderFunc);
 * ```
 */
export class DefaultCapabilityDetector implements ICapabilityDetector {
  /**
   * Capability pattern registry
   *
   * Maps capability names to regex patterns for method name matching.
   * Updated via addCapabilityPattern() and removeCapabilityPattern().
   *
   * Pre-configured patterns:
   * - render: render, canRender, getRenderStyle
   * - execute: execute, canExecute, run
   * - serialize: serialize, deserialize, toJSON, fromJSON
   * - validate: validate, isValid, check
   * - transform: transform, convert, map
   * - lifecycle: init, destroy, dispose, cleanup
   *
   * @private
   */
  private readonly capabilityPatterns = new Map<string, RegExp[]>([
    // Render-related capabilities
    ["render", [/^render$/, /^canRender$/, /^getRenderStyle$/]],

    // Execution-related capabilities
    ["execute", [/^execute$/, /^canExecute$/, /^run$/]],

    // Serialization-related capabilities
    ["serialize", [/^serialize$/, /^deserialize$/, /^toJSON$/, /^fromJSON$/]],

    // Validation-related capabilities
    ["validate", [/^validate$/, /^isValid$/, /^check$/]],

    // Transformation-related capabilities
    ["transform", [/^transform$/, /^convert$/, /^map$/]],

    // Lifecycle-related capabilities
    ["lifecycle", [/^init$/, /^destroy$/, /^dispose$/, /^cleanup$/]],
  ]);

  /**
   * Detect all capabilities on an object prototype
   *
   * Scans the entire prototype chain for methods matching
   * registered capability patterns.
   *
   * @param prototype - Object prototype to scan
   * @returns Array of detected capability names
   *
   * @remarks
   * - Traverses full prototype chain (up to Object.prototype)
   * - Returns deduplicated capability names
   * - Empty array if no capabilities found
   *
   * @example
   * ```typescript
   * class MyEntity {
   *   render() { ... }
   *   execute() { ... }
   *   validate() { ... }
   * }
   *
   * const detector = new DefaultCapabilityDetector();
   * const caps = detector.detectCapabilities(MyEntity.prototype);
   * // Result: ['render', 'execute', 'validate']
   * ```
   */
  detectCapabilities(prototype: Record<string, unknown>): string[] {
    const capabilities = new Set<string>();
    const methods = this.getAllMethods(prototype);

    for (const methodName of methods) {
      const method = prototype[methodName];
      if (typeof method === "function") {
        const capability = this.detectMethodCapability(
          methodName,
          method as (...args: unknown[]) => unknown
        );
        if (capability) {
          capabilities.add(capability);
        }
      }
    }

    return Array.from(capabilities);
  }

  /**
   * Detect capability from single method
   *
   * Matches method name against capability patterns.
   *
   * @param methodName - Name of the method to check
   * @param method - Method function (used for type checking)
   * @returns Capability name if matched, null otherwise
   *
   * @remarks
   * - Checks method against all patterns in order
   * - Returns first matching capability name
   * - Case-sensitive pattern matching
   *
   * @example
   * ```typescript
   * const type = detector.detectMethodCapability('render', () => {});
   * // Result: 'render'
   *
   * const type2 = detector.detectMethodCapability('unknown', () => {});
   * // Result: null
   * ```
   */
  detectMethodCapability(
    methodName: string,
    method: (...args: unknown[]) => unknown
  ): string | null {
    if (typeof method !== "function") return null;

    for (const [capabilityName, patterns] of this.capabilityPatterns) {
      if (patterns.some((pattern) => pattern.test(methodName))) {
        return capabilityName;
      }
    }

    return null;
  }

  /**
   * Get all methods from object and its prototype chain
   *
   * Traverses the complete prototype chain to find all methods.
   * Stops at Object.prototype.
   *
   * @param prototype - Starting prototype object
   * @returns Array of method names (excluding 'constructor')
   *
   * @private
   *
   * @remarks
   * - Includes inherited methods from parent classes
   * - Excludes constructor and non-function properties
   * - Deduplicates method names across prototype chain
   */
  private getAllMethods(prototype: Record<string, unknown>): string[] {
    const methods = new Set<string>();
    let current = prototype;

    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach((name) => {
        if (name !== "constructor" && typeof current[name] === "function") {
          methods.add(name);
        }
      });
      current = Object.getPrototypeOf(current);
    }

    return Array.from(methods);
  }

  /**
   * Register custom capability pattern
   *
   * Adds or updates capability patterns for detection.
   * Patterns are tested in order; first match wins.
   *
   * @param capabilityName - Capability name to register
   * @param patterns - Array of regex patterns for method names
   *
   * @remarks
   * - Replaces any existing patterns with same name
   * - Patterns are case-sensitive
   * - Use anchors (^, $) for exact matching
   *
   * @example
   * ```typescript
   * detector.addCapabilityPattern('export', [
   *   /^export$/,
   *   /^toExportFormat$/,
   *   /^exportAs/
   * ]);
   * ```
   */
  addCapabilityPattern(capabilityName: string, patterns: RegExp[]): void {
    this.capabilityPatterns.set(capabilityName, patterns);
  }

  /**
   * Remove capability pattern
   *
   * Unregisters patterns for a capability.
   * New detection won't find this capability type.
   *
   * @param capabilityName - Capability name to remove
   * @returns true if pattern existed and was removed, false otherwise
   *
   * @example
   * ```typescript
   * const removed = detector.removeCapabilityPattern('render');
   * if (removed) {
   *   console.log('Render capability patterns removed');
   * }
   * ```
   */
  removeCapabilityPattern(capabilityName: string): boolean {
    return this.capabilityPatterns.delete(capabilityName);
  }

  /**
   * Create capability from detected method
   *
   * Auto-generates a capability wrapper for a method.
   * Useful for one-off capability creation from detected methods.
   *
   * @template T - Specific capability type
   * @param methodName - Method name to wrap
   * @param method - The method function to wrap
   * @param entityPrototype - Entity prototype (for metadata)
   * @returns Capability instance or null if method not detected
   *
   * @remarks
   * - Auto-detects capability type from method name
   * - Creates ICapability with execute=method
   * - Includes metadata about source and detection
   * - Basic canHandle() only checks args.length > 0
   *
   * @example
   * ```typescript
   * const cap = detector.createCapabilityFromMethod(
   *   'render',
   *   entity.render.bind(entity),
   *   MyEntity.prototype
   * );
   *
   * if (cap) {
   *   await cap.execute(entity, context);
   * }
   * ```
   */
  createCapabilityFromMethod<T extends ICapability>(
    methodName: string,
    method: (...args: unknown[]) => unknown,
    entityPrototype: Record<string, unknown>
  ): T | null {
    const capabilityName = this.detectMethodCapability(methodName, method);
    if (!capabilityName) return null;

    // Create basic capability wrapper
    const capability: ICapability = {
      name: capabilityName,
      priority: 1,
      canHandle: (...args: unknown[]): boolean => {
        // Basic check: require at least one argument
        return args.length > 0;
      },
      execute: method,
      meta: {
        methodName,
        source: "auto-detected",
        entityPrototype: entityPrototype.constructor?.name || "Unknown",
        version: "1.0.0",
        description: `Auto-generated capability for ${methodName}`,
      },
    };

    return capability as T;
  }
}

/**
 * Base Capability Abstract Class
 *
 * Provides default implementations for ICapability.
 * Subclasses should override canHandle() and execute() for specific behavior.
 *
 * **Features**:
 * - Priority-based execution ordering
 * - Metadata storage and retrieval
 * - Resource cleanup via dispose()
 * - Extensible for custom behavior
 *
 * **Usage**:
 * ```typescript
 * class MyCapability extends BaseCapability {
 *   canHandle(...args) {
 *     return args[0]?.type === 'mytype';
 *   }
 *
 *   execute(...args) {
 *     return performAction(args[0]);
 *   }
 * }
 *
 * const cap = new MyCapability('action', {
 *   priority: 10,
 *   meta: { description: 'Custom action' }
 * });
 * ```
 *
 * @abstract
 * @implements {ICapability}
 */
export class BaseCapability implements ICapability {
  /**
   * Capability name
   *
   * Unique identifier for this capability in the system.
   * Must be unique within a registry.
   *
   * @readonly
   */
  readonly name: string;

  /**
   * Execution priority
   *
   * Higher numbers execute first when multiple capabilities
   * match the same arguments. Allows control over execution order.
   *
   * @readonly
   * @default 0
   */
  readonly priority: number;

  /**
   * Capability metadata
   *
   * Arbitrary key-value data associated with the capability.
   * Accessible via getMeta() method.
   *
   * @readonly
   */
  readonly meta: Record<string, unknown>;

  /**
   * Constructor
   *
   * @param name - Capability name
   * @param options - Optional configuration
   * @param options.priority - Execution priority (default: 0)
   * @param options.meta - Metadata object (default: {})
   *
   * @example
   * ```typescript
   * const cap = new BaseCapability('render', {
   *   priority: 5,
   *   meta: { version: '1.0', author: 'system' }
   * });
   * ```
   */
  constructor(
    name: string,
    options: {
      priority?: number;
      meta?: Record<string, unknown>;
    } = {}
  ) {
    this.name = name;
    this.priority = options.priority || 0;
    this.meta = options.meta || {};
  }

  /**
   * Determine if capability can handle arguments
   *
   * Default implementation returns true.
   * Subclasses should override for specific behavior.
   *
   * @param _args - Arguments to check (ignored in base implementation)
   * @returns Always true in base implementation
   *
   * @remarks
   * Override in subclasses to provide actual capability checking:
   * ```typescript
   * canHandle(entity, context) {
   *   return entity.type === 'mytype' && context?.enabled;
   * }
   * ```
   */
  canHandle(): boolean {
    // Default implementation for base class
    return true;
  }

  /**
   * Execute the capability
   *
   * Default implementation throws error.
   * Subclasses must override with actual implementation.
   *
   * @param _args - Arguments for execution (ignored in base)
   * @returns Result or error promise
   *
   * @throws {Error} If not overridden in subclass
   *
   * @remarks
   * Override in subclasses to implement capability:
   * ```typescript
   * execute(entity, context) {
   *   return performAction(entity, context);
   * }
   * ```
   */
  execute(): Promise<unknown> | unknown {
    // Default implementation - must be overridden
    throw new Error(`Capability ${this.name} execute method not implemented`);
  }

  /**
   * Get capability metadata
   *
   * Returns a copy of metadata object to prevent external modification.
   *
   * @returns Copy of metadata object
   *
   * @example
   * ```typescript
   * const meta = cap.getMeta();
   * console.log(meta.version);
   * ```
   */
  getMeta(): Record<string, unknown> {
    return { ...this.meta };
  }

  /**
   * Clean up capability resources
   *
   * Called when capability is no longer needed.
   * Clears all metadata to free memory.
   *
   * @remarks
   * Override in subclasses to clean up specific resources:
   * ```typescript
   * dispose() {
   *   this.connection?.close();
   *   this.cache?.clear();
   *   super.dispose();
   * }
   * ```
   *
   * @example
   * ```typescript
   * cap.dispose();  // Clean up when done
   * ```
   */
  dispose(): void {
    // Default implementation - clear metadata
    Object.keys(this.meta).forEach((key) => delete this.meta[key]);
  }
}

/**
 * Entity Method Capability Wrapper
 *
 * Wraps entity methods as ICapability instances.
 * Enables uniform capability treatment of entity methods.
 *
 * **Features**:
 * - Automatic context binding (method called with entity as 'this')
 * - Optional canHandle method delegation
 * - Full metadata tracking
 * - Proper error handling and reporting
 *
 * **Usage**:
 * ```typescript
 * const entity = {
 *   type: 'button',
 *   canRender: () => true,
 *   render: (context) => <Button />
 * };
 *
 * const renderCap = new EntityMethodCapability(
 *   entity,
 *   'render',
 *   'render',
 *   {
 *     canHandleMethodName: 'canRender',
 *     priority: 10,
 *     meta: { description: 'Button render' }
 *   }
 * );
 *
 * if (renderCap.canHandle(context)) {
 *   const result = await renderCap.execute(context);
 * }
 * ```
 *
 * @augments BaseCapability
 *
 * @example
 * ```typescript
 * const cap = new EntityMethodCapability(
 *   myEntity,
 *   'serialize',
 *   'serialize',
 *   { canHandleMethodName: 'isSerializable' }
 * );
 * ```
 */
export class EntityMethodCapability extends BaseCapability {
  /**
   * Reference to the entity owning the method
   *
   * Used for method binding and context during execution.
   *
   * @private
   */
  private readonly entity: Record<string, unknown>;

  /**
   * Name of the method to execute
   *
   * Must exist on entity object.
   *
   * @private
   */
  private readonly methodName: string;

  /**
   * Optional name of canHandle method on entity
   *
   * If provided, called to determine if execute should run.
   * Otherwise just checks if method exists.
   *
   * @private
   */
  private readonly canHandleMethodName?: string;

  /**
   * Constructor
   *
   * Wraps an entity method as a capability.
   *
   * @param entity - Entity object containing the method
   * @param methodName - Name of method to wrap
   * @param capabilityName - Name for this capability in the system
   * @param options - Configuration options
   * @param options.canHandleMethodName - Optional method for checking if capable
   * @param options.priority - Execution priority
   * @param options.meta - Additional metadata
   *
   * @remarks
   * - entity.methodName must be a function
   * - If canHandleMethodName provided, entity.canHandleMethodName must exist
   * - Method will be called with entity as 'this' context
   *
   * @example
   * ```typescript
   * new EntityMethodCapability(
   *   entity,
   *   'render',
   *   'render',
   *   { canHandleMethodName: 'canRender', priority: 5 }
   * );
   * ```
   */
  constructor(
    entity: Record<string, unknown>,
    methodName: string,
    capabilityName: string,
    options: {
      canHandleMethodName?: string;
      priority?: number;
      meta?: Record<string, unknown>;
    } = {}
  ) {
    const meta: Record<string, unknown> = {
      ...options.meta,
      description: `Entity method: ${methodName}`,
      methodName,
    };

    const constructorOptions: { priority?: number; meta?: Record<string, unknown> } = {
      meta,
    };
    if (options.priority !== undefined) {
      constructorOptions.priority = options.priority;
    }

    super(capabilityName, constructorOptions);

    this.entity = entity;
    this.methodName = methodName;
    if (options.canHandleMethodName !== undefined) {
      this.canHandleMethodName = options.canHandleMethodName;
    }
  }

  /**
   * Override: Check if entity method can handle arguments
   *
   * Delegates to entity's canHandle method if available,
   * otherwise just checks if method exists.
   *
   * @param args - Arguments to check
   * @returns true if method can handle, false otherwise
   *
   * @remarks
   * - Calls entity.canHandleMethodName(...args) if available
   * - Falls back to checking if entity.methodName exists
   * - Maintains entity context ('this' binding)
   */
  override canHandle(...args: unknown[]): boolean {
    // If canHandle method exists on entity, call it
    if (this.canHandleMethodName && typeof this.entity[this.canHandleMethodName] === "function") {
      const method = this.entity[this.canHandleMethodName] as (...args: unknown[]) => boolean;
      return method.call(this.entity, ...args);
    }

    // Otherwise check if method exists
    return typeof this.entity[this.methodName] === "function";
  }

  /**
   * Override: Execute the entity method
   *
   * Calls the entity method with proper 'this' binding.
   * Throws if method cannot handle arguments or doesn't exist.
   *
   * @param args - Arguments to pass to method
   * @returns Method result (sync or async)
   *
   * @throws {Error} If canHandle returns false or method doesn't exist
   *
   * @remarks
   * - Method called with entity as 'this' context
   * - Supports both sync and async methods (Promises)
   * - Proper error messages include entity type
   *
   * @example
   * ```typescript
   * const result = await cap.execute(context);
   * ```
   */
  override execute(...args: unknown[]): Promise<unknown> | unknown {
    if (!this.canHandle(...args)) {
      const entityType = (this.entity as { type?: string }).type || "unknown";
      throw new Error(`Cannot execute capability ${this.name} on entity ${entityType}`);
    }

    const method = this.entity[this.methodName] as (...args: unknown[]) => unknown;
    return method.call(this.entity, ...args);
  }

  /**
   * Override: Get extended metadata
   *
   * Includes entity context info (id, type) along with base metadata.
   *
   * @returns Metadata object with entity context
   *
   * @remarks
   * - Includes entityId and entityType if available
   * - Includes methodName and canHandleMethodName
   * - Useful for debugging and logging
   *
   * @example
   * ```typescript
   * const meta = cap.getMeta();
   * console.log(`Entity: ${meta.entityType} (${meta.entityId})`);
   * ```
   */
  override getMeta(): Record<string, unknown> {
    const entityId = (this.entity as { id?: string }).id;
    const entityType = (this.entity as { type?: string }).type;

    return {
      ...super.getMeta(),
      entityId,
      entityType,
      methodName: this.methodName,
      canHandleMethodName: this.canHandleMethodName,
    };
  }
}
