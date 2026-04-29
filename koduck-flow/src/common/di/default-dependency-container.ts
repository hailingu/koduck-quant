/**
 * @module src/common/di/default-dependency-container
 * @description
 * Default implementation of the DI container interface.
 * Provides service registration, resolution, lifecycle management,
 * scope support, and circular dependency detection.
 *
 * @example
 * ```typescript
 * const container = new DefaultDependencyContainer();
 *
 * // Register services
 * container.register('logger', () => new Logger(), { lifecycle: 'singleton' });
 * container.registerInstance('config', { debug: true });
 *
 * // Resolve services
 * const logger = container.resolve('logger');
 * const config = container.resolve('config');
 *
 * // Create scope
 * const scope = container.createScope();
 * const scopedService = scope.resolve('scopedService');
 * scope.dispose();
 * ```
 */

import type {
  IDependencyContainer,
  RegistrationOptions,
  ServiceDescriptor,
  ServiceLifecycle,
} from "./types";

/**
 * Internal record for storing scoped service instances
 * @internal
 */
type ScopedInstanceRecord = {
  instance: unknown;
  dispose?: ((instance: unknown) => void) | undefined;
  ownsInstance: boolean;
};

/**
 * Default DI container implementation
 *
 * Features:
 * - Service registration with lifecycle management (singleton, transient, scoped)
 * - Circular dependency detection
 * - Scope support for per-scope instances
 * - Resource cleanup and disposal
 * - Parent-child container hierarchy
 *
 * @implements {IDependencyContainer}
 *
 * @example
 * ```typescript
 * const container = new DefaultDependencyContainer();
 *
 * // Singleton: one instance for application lifetime
 * container.register('database', () => new Database(), { lifecycle: 'singleton' });
 *
 * // Transient: new instance each time
 * container.register('logger', () => new Logger(), { lifecycle: 'transient' });
 *
 * // Scoped: one instance per scope
 * container.register('request', () => new Request(), { lifecycle: 'scoped' });
 * ```
 */
export class DefaultDependencyContainer implements IDependencyContainer {
  /** Registry mapping tokens to service descriptors */
  private readonly registry = new Map<string | symbol, ServiceDescriptor>();
  /** Storage for scoped instances in this container */
  private readonly scopeInstances = new Map<string | symbol, ScopedInstanceRecord>();
  /** Parent container for scope resolution hierarchy */
  private parent: DefaultDependencyContainer | undefined;
  /** Child containers created from this scope */
  private readonly children = new Set<DefaultDependencyContainer>();
  /** Whether this container has been disposed */
  private disposed = false;
  /** Stack of tokens currently being resolved (for circular dependency detection) */
  private currentResolutionStack: (string | symbol)[] | undefined;

  /**
   * Registers a service factory in the container
   *
   * @template T Service type
   * @param token Unique service identifier
   * @param factory Service factory function
   * @param options Registration options (lifecycle, disposal handler, replace flag)
   * @throws {Error} If service already registered without replace flag
   * @throws {Error} If container is disposed
   *
   * @example
   * ```typescript
   * container.register('logger', (container) => new Logger(), {
   *   lifecycle: 'singleton',
   *   dispose: (logger) => logger.close()
   * });
   * ```
   */
  register<T>(
    token: string | symbol,
    factory: (container: IDependencyContainer) => T,
    options: RegistrationOptions<T> | ServiceLifecycle = {}
  ): void {
    this.ensureNotDisposed();

    // Normalize options: handle shorthand lifecycle string
    const normalizedOptions = typeof options === "string" ? { lifecycle: options } : options;
    const lifecycle: ServiceLifecycle = normalizedOptions.lifecycle ?? "singleton";
    const ownsInstance = normalizedOptions.ownsInstance ?? true;
    const descriptor: ServiceDescriptor = {
      factory: factory as (container: IDependencyContainer) => unknown,
      lifecycle,
      ownsInstance,
    };

    if (normalizedOptions.dispose !== undefined) {
      descriptor.dispose = normalizedOptions.dispose as (instance: unknown) => void;
    }

    // Check for existing registration
    const existingDescriptor = this.registry.get(token);
    if (existingDescriptor) {
      if (normalizedOptions.replace === false) {
        throw new Error(
          `Service '${String(token)}' has already been registered. Use replace option to override.`
        );
      }
      // Clean up previous registration
      this.disposeDescriptor(existingDescriptor);
    }

    this.registry.set(token, descriptor);
  }

  /**
   * Registers a pre-constructed service instance in the container
   *
   * The same instance will be returned on every resolution.
   * Useful for singletons, configuration objects, or test mocks.
   *
   * @template T Service type
   * @param token Unique service identifier
   * @param instance Pre-constructed service instance
   * @param options Registration options (lifecycle defaults to 'singleton')
   * @throws {Error} If container is disposed
   *
   * @example
   * ```typescript
   * const config = { apiUrl: 'https://api.example.com' };
   * container.registerInstance('config', config);
   * ```
   */
  registerInstance<T>(
    token: string | symbol,
    instance: T,
    options: RegistrationOptions<T> | ServiceLifecycle = {}
  ): void {
    const normalizedOptions = typeof options === "string" ? { lifecycle: options } : options;
    const lifecycle: ServiceLifecycle = normalizedOptions.lifecycle ?? "singleton";
    const ownsInstance = normalizedOptions.ownsInstance ?? Boolean(normalizedOptions.dispose);
    this.register(token, () => instance, {
      ...normalizedOptions,
      lifecycle,
      ownsInstance,
    });

    // Set the instance directly on the descriptor
    const descriptor = this.registry.get(token);
    if (descriptor) {
      descriptor.instance = instance;
      descriptor.ownsInstance = ownsInstance;
    }
  }

  /**
   * Resolves and returns a service instance by its token
   *
   * Service instantiation follows these rules:
   * - singleton: Returns the same instance (created on first resolution)
   * - transient: Creates a new instance each time
   * - scoped: Returns the same instance within the current scope
   *
   * @template T The expected service type
   * @param token The service token
   * @returns The resolved service instance
   * @throws {Error} If service not found or already disposed
   * @throws {Error} If circular dependency detected
   *
   * @example
   * ```typescript
   * const logger = container.resolve<Logger>('logger');
   * const service = container.resolve(TOKENS.myService);
   * ```
   */
  resolve<T>(token: string | symbol): T {
    this.ensureNotDisposed();
    // Initialize or reuse resolution stack for circular dependency detection
    let stack = this.currentResolutionStack;
    let isRootCall = false;
    if (!stack) {
      stack = [];
      this.currentResolutionStack = stack;
      isRootCall = true;
    }

    try {
      return this.resolveInternal<T>(token, this, stack);
    } finally {
      // Clean up stack only if this was the root call
      if (isRootCall) {
        stack.length = 0;
        this.currentResolutionStack = undefined;
      }
    }
  }

  /**
   * Internal resolution logic with circular dependency detection
   * @internal
   */
  private resolveInternal<T>(
    token: string | symbol,
    scope: DefaultDependencyContainer,
    stack: (string | symbol)[]
  ): T {
    this.ensureNotDisposed();

    // Look up service in registry, delegate to parent if not found
    const descriptor = this.registry.get(token);
    if (!descriptor) {
      if (this.parent) {
        return this.parent.resolveInternal<T>(token, scope, stack);
      }
      throw new Error(`Service '${String(token)}' not found`);
    }

    // Detect circular dependencies
    if (stack.includes(token)) {
      throw new Error(`Circular dependency detected for token: ${String(token)}`);
    }

    stack.push(token);
    try {
      return this.materialize<T>(token, descriptor, scope, stack);
    } finally {
      stack.pop();
    }
  }

  /**
   * Checks whether a service is registered in this container or its parents
   *
   * @param token The service token to check
   * @returns true if service is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (container.has('logger')) {
   *   const logger = container.resolve('logger');
   * }
   * ```
   */
  has(token: string | symbol): boolean {
    if (this.registry.has(token)) {
      return true;
    }
    return this.parent ? this.parent.has(token) : false;
  }

  /**
   * Clears all service registrations from this container
   *
   * Note: This does NOT call dispose handlers or clean up instances.
   * Use dispose() if you need to clean up resources.
   *
   * @throws {Error} If container is disposed
   */
  clear(): void {
    this.registry.clear();
    this.scopeInstances.clear();
    this.currentResolutionStack = undefined;
  }

  /**
   * Disposes the container and all managed service instances
   *
   * Cleanup order:
   * 1. Dispose all child scopes
   * 2. Call dispose handlers for scoped instances
   * 3. Call dispose handlers for singleton instances
   * 4. Clear all registrations
   * 5. Disconnect from parent
   *
   * After disposal, the container and its children cannot be used.
   *
   * @example
   * ```typescript
   * const container = createCoreContainer();
   * // ... use container ...
   * container.dispose(); // Cleanup all resources
   * ```
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Dispose child scopes first
    for (const child of this.children) {
      child.dispose();
    }
    this.children.clear();

    // Dispose scoped instances
    for (const record of this.scopeInstances.values()) {
      this.runDispose(record.instance, record.dispose, record.ownsInstance);
    }
    this.scopeInstances.clear();

    // Dispose singleton and other registered services
    for (const descriptor of this.registry.values()) {
      this.disposeDescriptor(descriptor);
    }

    this.registry.clear();
    this.currentResolutionStack = undefined;
    this.disposed = true;

    // Disconnect from parent
    if (this.parent) {
      this.parent.children.delete(this);
      this.parent = undefined;
    }
  }

  /**
   * Creates a child scope container for managing scoped instances
   *
   * Scoped services:
   * - Share singleton and transient service definitions from parent
   * - Have separate instances for scoped services
   * - Can be independently disposed
   *
   * @returns New scoped child container
   *
   * @example
   * ```typescript
   * const scope = container.createScope();
   * try {
   *   const scopedService = scope.resolve(TOKENS.scopedService);
   *   // Use scopedService...
   * } finally {
   *   scope.dispose(); // Cleanup scoped instances
   * }
   * ```
   */
  createScope(): IDependencyContainer {
    this.ensureNotDisposed();
    const scopedContainer = new DefaultDependencyContainer();
    scopedContainer.parent = this;
    this.children.add(scopedContainer);
    return scopedContainer;
  }

  private materialize<T>(
    token: string | symbol,
    descriptor: ServiceDescriptor,
    scope: DefaultDependencyContainer,
    stack: (string | symbol)[]
  ): T {
    const targetContainer = descriptor.lifecycle === "singleton" ? this : scope;
    const previousStack = targetContainer.currentResolutionStack;
    if (previousStack !== stack) {
      targetContainer.currentResolutionStack = stack;
    }

    try {
      switch (descriptor.lifecycle) {
        case "singleton": {
          if (descriptor.instance === undefined) {
            descriptor.instance = descriptor.factory(this);
          }
          return descriptor.instance as T;
        }
        case "scoped": {
          const cached = scope.scopeInstances.get(token);
          if (cached) {
            return cached.instance as T;
          }
          const instance = descriptor.factory(scope);
          const record: ScopedInstanceRecord = {
            instance,
            ownsInstance: descriptor.ownsInstance,
          };
          if (descriptor.dispose !== undefined) {
            record.dispose = descriptor.dispose;
          }
          scope.scopeInstances.set(token, record);
          return instance as T;
        }
        case "transient":
        default:
          return descriptor.factory(scope) as T;
      }
    } finally {
      if (previousStack !== stack) {
        targetContainer.currentResolutionStack = previousStack;
      }
    }
  }

  private disposeDescriptor(descriptor: ServiceDescriptor): void {
    if (descriptor.instance !== undefined) {
      this.runDispose(descriptor.instance, descriptor.dispose, descriptor.ownsInstance);
      delete descriptor.instance;
    }
  }

  private runDispose(
    instance: unknown,
    disposer: ((instance: unknown) => void) | undefined,
    ownsInstance: boolean
  ): void {
    if (!ownsInstance) {
      return;
    }

    try {
      if (disposer) {
        disposer(instance);
        return;
      }

      const maybeDisposable = instance as { dispose?: () => void };
      if (maybeDisposable && typeof maybeDisposable.dispose === "function") {
        maybeDisposable.dispose();
      }
    } catch {
      // ignore dispose errors to keep teardown resilient
    }
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error("This dependency container has been disposed.");
    }
  }
}
