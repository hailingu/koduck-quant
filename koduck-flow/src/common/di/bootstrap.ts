/**
 * @module src/common/di/bootstrap
 * @description
 * Core DI container bootstrap and service registration module.
 * Provides factory functions to create and initialize the Duck Flow dependency injection container
 * with all core services pre-registered according to their lifecycle configuration.
 *
 * @example
 * ```typescript
 * // Create a container with default core services
 * const container = createCoreContainer();
 *
 * // Or with service overrides for testing
 * const container = createCoreContainer({
 *   runtime: { instance: mockRuntime },
 *   renderManager: { factory: () => new MockRenderManager() }
 * });
 *
 * // Resolve a service
 * const runtime = container.resolve(TOKENS.runtime);
 * ```
 */

import { DefaultDependencyContainer } from "./default-dependency-container";
import type { IDependencyContainer, RegistrationOptions, ServiceFactory } from "./types";
import type { CoreServiceRegistration } from "./core-service-registration";
import { CORE_SERVICE_REGISTRY } from "./generated/core-services";

/**
 * Type representing any core service key from the registry
 * @see CORE_SERVICE_REGISTRY
 */
export type CoreServiceKey = keyof typeof CORE_SERVICE_REGISTRY;

type CoreServiceType<K extends CoreServiceKey> =
  (typeof CORE_SERVICE_REGISTRY)[K] extends CoreServiceRegistration<infer T> ? T : never;

/**
 * Configuration object for overriding a core service
 * Allows specifying a custom factory function or instance for a service
 * @template T The service type
 */
type OverrideOptions<T> = Partial<RegistrationOptions<T>> & {
  factory?: ServiceFactory<T>;
  instance?: T;
};

/**
 * Type representing override configuration for a specific core service
 * @template K The key of the core service to override
 */
export type CoreServiceOverride<K extends CoreServiceKey> = OverrideOptions<CoreServiceType<K>>;

/**
 * Map of service key to override configuration
 * Used to customize services during container initialization
 */
export type CoreServiceOverrides = Partial<{
  [K in CoreServiceKey]: CoreServiceOverride<K>;
}>;

/**
 * Creates and initializes the core DI container with all default services registered
 *
 * @param overrides - Optional overrides for specific core services.
 * Allows injecting mock implementations or custom factories for testing
 * @returns Initialized IDependencyContainer with all core services registered
 *
 * @example
 * ```typescript
 * // Default container
 * const container = createCoreContainer();
 *
 * // Container with mocked runtime for testing
 * const testContainer = createCoreContainer({
 *   runtime: { instance: mockRuntime }
 * });
 * ```
 */
export function createCoreContainer(overrides?: CoreServiceOverrides): IDependencyContainer {
  const container = new DefaultDependencyContainer();
  registerCoreServices(container, overrides);
  return container;
}

/**
 * Registers all core services into the provided DI container
 *
 * Iterates through CORE_SERVICE_REGISTRY and registers each service with its configured
 * lifecycle (transient, singleton, scoped). Applies any provided overrides to customize
 * service factories or instances.
 *
 * @param container - The DI container to register services into
 * @param overrides - Optional service overrides for customization
 * @returns The same container instance for chaining
 *
 * @throws Error if service registration fails (e.g., duplicate token, invalid factory)
 *
 * @example
 * ```typescript
 * const container = new DefaultDependencyContainer();
 * registerCoreServices(container, {
 *   renderManager: { factory: () => new CustomRenderManager() }
 * });
 * ```
 */
export function registerCoreServices(
  container: IDependencyContainer,
  overrides?: CoreServiceOverrides
): IDependencyContainer {
  for (const key of Object.keys(CORE_SERVICE_REGISTRY) as CoreServiceKey[]) {
    const config = CORE_SERVICE_REGISTRY[key] as CoreServiceRegistration<unknown>;
    const override = overrides?.[key] as OverrideOptions<unknown> | undefined;
    registerConfig(container, config, override);
  }
  return container;
}

/**
 * Internal helper function to register a single service configuration
 *
 * Applies override options (lifecycle, factory, instance, dispose, ownsInstance)
 * and delegates to the appropriate container registration method.
 *
 * @param container - DI container to register into
 * @param config - Service configuration from the registry
 * @param override - Optional override for this specific service
 */
function registerConfig(
  container: IDependencyContainer,
  config: CoreServiceRegistration<unknown>,
  override?: OverrideOptions<unknown>
): void {
  // Resolve lifecycle: use override if provided, otherwise use default from config
  const lifecycle = override?.lifecycle ?? config.lifecycle;
  const dispose = override?.dispose ?? config.dispose;
  const ownsInstance = override?.ownsInstance ?? config.ownsInstance;

  // Build registration options with computed values
  const options: RegistrationOptions<unknown> = {
    lifecycle,
    replace: true, // Always replace existing registration (important for overrides)
  };

  // Apply optional dispose handler if provided
  if (dispose !== undefined) {
    options.dispose = dispose as (instance: unknown) => void;
  }

  // Apply ownership flag if specified
  if (ownsInstance !== undefined) {
    options.ownsInstance = ownsInstance;
  }

  // If an instance override is provided, register it directly
  if (override?.instance !== undefined) {
    container.registerInstance(config.token, override.instance, options);
    return;
  }

  // Otherwise use factory function (override factory takes precedence over config factory)
  const factory: ServiceFactory<unknown> = override?.factory ?? config.factory;

  container.register(config.token, factory, options);
}
