/**
 * @module src/components/hooks/useDuckFlowRuntime
 * @description React hooks for accessing DuckFlow runtime and its managers from components.
 * Provides convenient access to runtime services, managers, and tenant configuration.
 */

import { useContext, useMemo } from "react";

import type { DuckFlowRuntime, IManager, ResolvedTenantContext } from "../../common/runtime";
import { DuckFlowContext } from "../context/DuckFlowContext";

/**
 * Hook to access the DuckFlow context value.
 * Must be called within a component tree wrapped by DuckFlowProvider.
 * @returns {DuckFlowContextValue} The current DuckFlow context containing runtime and metadata
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const { runtime, environment } = useDuckFlowContext();
 */
export const useDuckFlowContext = () => {
  const context = useContext(DuckFlowContext);
  if (!context) {
    throw new Error(
      "DuckFlow context is unavailable. Wrap your component tree in DuckFlowProvider."
    );
  }

  return context;
};

/**
 * Hook to access the DuckFlow runtime instance.
 * Extracts and returns just the runtime from the context.
 * @returns {DuckFlowRuntime} The active DuckFlow runtime instance
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const runtime = useDuckFlowRuntime();
 * const entities = runtime.EntityManager.query({ type: 'node' });
 */
export const useDuckFlowRuntime = (): DuckFlowRuntime => {
  return useDuckFlowContext().runtime;
};

/**
 * Hook to access all runtime managers and configuration metadata in a memoized object.
 * Aggregates the most commonly used managers and metadata for convenience.
 * Returns an object with runtime, environment, factory, source, and all standard managers
 * (entityManager, renderManager, registryManager, eventBus, renderEvents, entityEvents).
 * @returns {Object} Memoized object containing runtime and manager references
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const { entityManager, renderManager, eventBus } = useDuckFlowManagers();
 * eventBus.on('entity:created', (entity) => {
 *   console.log('Entity created:', entity.id);
 * });
 */
export const useDuckFlowManagers = () => {
  const { runtime, environment, factory, source } = useDuckFlowContext();
  return useMemo(
    () => ({
      runtime,
      environment,
      factory,
      source,
      entityManager: runtime.EntityManager,
      renderManager: runtime.RenderManager,
      registryManager: runtime.RegistryManager,
      eventBus: runtime.EventBus,
      renderEvents: runtime.RenderEvents,
      entityEvents: runtime.EntityEvents,
    }),
    [runtime, environment, factory, source]
  );
};

/**
 * Hook to access a specific manager by name from the runtime.
 * Allows accessing custom or less commonly used managers.
 * @template {IManager} T - Type of manager to retrieve
 * @param {string} name - The registered name of the manager
 * @returns {T | undefined} The manager instance or undefined if not found
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const customManager = useDuckFlowManager<CustomManager>('custom');
 * if (customManager) {
 *   customManager.doSomething();
 * }
 */
export const useDuckFlowManager = <T extends IManager = IManager>(name: string): T | undefined => {
  const runtime = useDuckFlowRuntime();
  return runtime.getManager<T>(name);
};

/**
 * Hook to access tenant context if available.
 * Returns undefined in single-tenant or non-tenant environments.
 * @returns {ResolvedTenantContext | undefined} Tenant context or undefined
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const tenant = useDuckFlowTenant();
 * if (tenant) {
 *   console.log('Tenant ID:', tenant.id);
 * }
 */
export const useDuckFlowTenant = (): ResolvedTenantContext | undefined => {
  const { tenant } = useDuckFlowContext();
  return tenant;
};

/**
 * Hook to check if a feature flag is enabled for the current tenant.
 * Returns default value if tenant is not configured or flag is not found.
 * @param {string} flag - The name of the feature flag to check
 * @param {boolean} [defaultValue=false] - Value to return if flag not found
 * @returns {boolean} Whether the feature flag is enabled
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const isExperimental = useTenantFeatureFlag('experimental-feature');
 * if (isExperimental) {
 *   return <ExperimentalComponent />;
 * }
 */
export const useTenantFeatureFlag = (flag: string, defaultValue = false): boolean => {
  const runtime = useDuckFlowRuntime();
  return runtime.isTenantFeatureEnabled(flag, defaultValue);
};

/**
 * Hook to check if the current tenant is included in a feature rollout.
 * Uses optional seed for deterministic but randomized rollout decisions.
 * @param {string} [seed] - Optional seed for rollout decision (ensures consistent behavior)
 * @returns {boolean} Whether tenant is included in the rollout
 * @throws {Error} If called outside DuckFlowProvider wrapper
 * @example
 * const isInRollout = useTenantRollout('feature-x-rollout');
 * if (isInRollout) {
 *   return <NewFeatureComponent />;
 * }
 */
export const useTenantRollout = (seed?: string): boolean => {
  const runtime = useDuckFlowRuntime();
  return runtime.isTenantInRollout(seed);
};
