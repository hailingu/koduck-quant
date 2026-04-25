/**
 * @module src/common/di/core-service-registration
 * @description
 * Core service registration configuration interface.
 * Defines the shape of service registration metadata used by the DI container
 * to initialize and manage service lifecycle.
 */

import type { ServiceFactory, ServiceLifecycle } from "./types";

/**
 * Configuration descriptor for a core service in the DI container
 *
 * Specifies how a service should be instantiated, its lifecycle,
 * disposal behavior, and instance ownership semantics.
 *
 * @template T The service type
 *
 * @property token - Unique symbol identifier for the service
 * @property factory - Function that creates service instances
 * @property lifecycle - Service lifecycle mode (transient, singleton, scoped)
 * @property ownsInstance - Whether the container owns and manages the instance lifetime
 * @property dispose - Optional cleanup function called when service is disposed
 *
 * @example
 * ```typescript
 * const runtimeRegistration: CoreServiceRegistration<IFlowRuntime> = {
 *   token: TOKENS.runtime,
 *   factory: (container) => new FlowRuntime(container),
 *   lifecycle: 'singleton',
 *   ownsInstance: true,
 *   dispose: (runtime) => runtime.cleanup()
 * };
 * ```
 */
export interface CoreServiceRegistration<T> {
  /**
   * Unique symbol that identifies this service in the container
   * Used for service registration and resolution
   */
  token: symbol;

  /**
   * Factory function that creates service instances
   * Called by the container to instantiate the service
   * @param container - The DI container for resolving dependencies
   * @returns A new instance of the service
   */
  factory: ServiceFactory<T>;

  /**
   * Service lifecycle management strategy
   * - 'transient': New instance created each time
   * - 'singleton': Single instance for application lifetime
   * - 'scoped': Single instance per scope (e.g., request, feature)
   * @see ServiceLifecycle
   */
  lifecycle: ServiceLifecycle;

  /**
   * Whether the container owns and should manage the service instance lifetime
   * If true, container is responsible for disposal when needed
   * If false, the creator retains ownership and responsibility
   */
  ownsInstance: boolean;

  /**
   * Optional cleanup/disposal handler for the service
   * Called when the service instance is being disposed (container cleanup or scop end)
   * Should perform resource cleanup (close connections, free memory, etc.)
   * @param instance - The service instance to dispose
   */
  dispose?: (instance: T) => void;
}
