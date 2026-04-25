/**
 * @module src/common/di/types
 * @description
 * Core DI container type definitions and interfaces.
 * Defines the contract for dependency injection container implementation,
 * service registration, and lifecycle management.
 *
 * @example
 * ```typescript
 * import type {
 *   IDependencyContainer,
 *   ServiceLifecycle,
 *   ServiceFactory
 * } from '@/common/di/types';
 *
 * const factory: ServiceFactory<MyService> = (container) => {
 *   return new MyService();
 * };
 * ```
 */

/**
 * Service lifecycle management strategy
 * - 'singleton': Single instance created once and reused for entire application lifetime
 * - 'transient': New instance created each time service is resolved
 * - 'scoped': Single instance per scope (e.g., per request, per feature context)
 */
export type ServiceLifecycle = "singleton" | "transient" | "scoped";

/**
 * Factory function type for creating service instances
 * @template T The service type produced by this factory
 * @param container The DI container used to resolve dependencies
 * @returns A new instance of the service
 * @example
 * ```typescript
 * const runtimeFactory: ServiceFactory<IFlowRuntime> = (container) => {
 *   const config = container.resolve(TOKENS.config);
 *   return new FlowRuntime(config);
 * };
 * ```
 */
export type ServiceFactory<T> = (container: IDependencyContainer) => T;

/**
 * Options for service registration in the container
 * @template T The service type being registered
 * @property lifecycle Service lifecycle mode (default: 'transient')
 * @property dispose Optional cleanup function for the service instance
 * @property replace Whether to replace existing registration (default: false)
 * @property ownsInstance Whether container owns the instance lifetime
 */
export interface RegistrationOptions<T = unknown> {
  /** Service lifecycle mode (singleton, transient, or scoped) */
  lifecycle?: ServiceLifecycle;
  /** Cleanup handler called when service is disposed */
  dispose?: (instance: T) => void;
  /** If true, replaces any existing registration for this token */
  replace?: boolean;
  /** If true, container manages the instance lifetime and disposal */
  ownsInstance?: boolean;
}

/**
 * Dependency injection container interface
 *
 * Defines the contract for service registration, resolution, and lifecycle management.
 * Implementations are responsible for maintaining service registry, managing instances,
 * and handling disposal based on configured lifecycle.
 *
 * @example
 * ```typescript
 * const container = createCoreContainer();
 *
 * // Register a service
 * container.register(
 *   'myService',
 *   (c) => new MyService(),
 *   { lifecycle: 'singleton' }
 * );
 *
 * // Resolve the service
 * const service = container.resolve<MyService>('myService');
 *
 * // Check if service exists
 * if (container.has('myService')) {
 *   // ...
 * }
 *
 * // Create a scoped container
 * const scopedContainer = container.createScope();
 *
 * // Cleanup resources
 * container.dispose();
 * ```
 */
export interface IDependencyContainer {
  /**
   * Registers a service factory in the container
   *
   * The factory function will be called each time the service is resolved
   * (for transient) or once (for singleton/scoped) depending on lifecycle.
   *
   * @template T The service type
   * @param token Unique identifier (string or symbol) for the service
   * @param factory Function that creates service instances
   * @param options Registration options including lifecycle and disposal handler
   * @throws Error if registration fails (e.g., duplicate token without replace flag)
   *
   * @example
   * ```typescript
   * container.register(
   *   TOKENS.runtime,
   *   (container) => new FlowRuntime(config),
   *   { lifecycle: 'singleton', dispose: (inst) => inst.cleanup() }
   * );
   * ```
   */
  register<T>(
    token: string | symbol,
    factory: ServiceFactory<T>,
    options?: RegistrationOptions<T> | ServiceLifecycle
  ): void;

  /**
   * Registers a pre-constructed instance in the container
   *
   * The same instance will be returned on every resolution.
   * Useful for configuration objects, singletons, or test mocks.
   *
   * @template T The service type
   * @param token Unique identifier for the service
   * @param instance The pre-constructed instance
   * @param options Registration options (lifecycle should be 'singleton')
   *
   * @example
   * ```typescript
   * const config = { apiEndpoint: 'https://api.example.com' };
   * container.registerInstance(TOKENS.config, config);
   * ```
   */
  registerInstance<T>(
    token: string | symbol,
    instance: T,
    options?: RegistrationOptions<T> | ServiceLifecycle
  ): void;

  /**
   * Resolves and returns a service instance by its token
   *
   * Depending on lifecycle:
   * - singleton: Returns the same instance
   * - transient: Creates a new instance each time
   * - scoped: Returns the same instance within the same scope
   *
   * @template T The expected service type
   * @param token The service token used during registration
   * @returns The service instance
   * @throws Error if service is not registered or resolution fails
   *
   * @example
   * ```typescript
   * const runtime = container.resolve<IFlowRuntime>(TOKENS.runtime);
   * ```
   */
  resolve<T>(token: string | symbol): T;

  /**
   * Checks whether a service is registered in the container
   *
   * @param token The service token to check
   * @returns true if service is registered, false otherwise
   *
   * @example
   * ```typescript
   * if (container.has(TOKENS.config)) {
   *   const config = container.resolve(TOKENS.config);
   * }
   * ```
   */
  has(token: string | symbol): boolean;

  /**
   * Clears all service registrations from the container
   *
   * Note: This does NOT call dispose handlers or clean up instances.
   * Use dispose() if you need to clean up resources.
   */
  clear(): void;

  /**
   * Disposes the container and all managed service instances
   *
   * Calls the dispose handler for each service that owns its instance.
   * After disposal, the container should not be used for further operations.
   *
   * @example
   * ```typescript
   * container.dispose(); // Cleanup all services
   * ```
   */
  dispose(): void;

  /**
   * Creates a child scope container for the current container
   *
   * Scoped services will have a single instance within each scope.
   * The child scope shares singleton and transient service definitions
   * but has separate scoped instances.
   *
   * @returns A new scoped child container
   *
   * @example
   * ```typescript
   * const scopedContainer = container.createScope();
   * const scopedService = scopedContainer.resolve(TOKENS.scopedService);
   * scopedContainer.dispose(); // Cleanup scoped instances
   * ```
   */
  createScope(): IDependencyContainer;
}

/**
 * Service descriptor interface representing internal service registration metadata
 *
 * Used internally by the container to store and manage service information.
 * Each registered service has a corresponding descriptor containing its factory,
 * lifecycle, instance (if applicable), and disposal handler.
 *
 * @property factory The service factory function
 * @property lifecycle The service lifecycle mode
 * @property instance The cached instance (for singleton/scoped)
 * @property dispose Optional disposal handler
 * @property ownsInstance Whether container owns the instance lifetime
 *
 * @example
 * ```typescript
 * // Internal representation
 * const descriptor: ServiceDescriptor = {
 *   factory: (c) => new MyService(),
 *   lifecycle: 'singleton',
 *   instance: undefined,
 *   dispose: (inst) => inst.cleanup(),
 *   ownsInstance: true
 * };
 * ```
 */
export interface ServiceDescriptor {
  /** Factory function for creating service instances */
  factory: ServiceFactory<unknown>;
  /** Service lifecycle (singleton, transient, scoped) */
  lifecycle: ServiceLifecycle;
  /** Cached instance for singleton/scoped services */
  instance?: unknown;
  /** Optional cleanup handler for the service */
  dispose?: (instance: unknown) => void;
  /** Whether the container owns and manages this instance */
  ownsInstance: boolean;
}
