/**
 * @module src/components/provider/hooks/useKoduckFlowRuntime
 * @description React hooks for accessing KoduckFlow runtime and its managers from components.
 * Provides convenient access to runtime services, managers, and tenant configuration.
 */

import { useContext, useMemo } from "react";

import type { KoduckFlowRuntime, IManager, ResolvedTenantContext } from "../../../common/runtime";
import { KoduckFlowContext } from "../context/KoduckFlowContext";

/**
 * Hook to access the KoduckFlow context value.
 * Must be called within a component tree wrapped by KoduckFlowProvider.
 * @returns {KoduckFlowContextValue} The current KoduckFlow context containing runtime and metadata
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const { runtime, environment } = useKoduckFlowContext();
 */
export const useKoduckFlowContext = () => {
  const context = useContext(KoduckFlowContext);
  if (!context) {
    throw new Error(
      "KoduckFlow context is unavailable. Wrap your component tree in KoduckFlowProvider."
    );
  }

  return context;
};

/**
 * Hook to access the KoduckFlow runtime instance.
 * Extracts and returns just the runtime from the context.
 * @returns {KoduckFlowRuntime} The active KoduckFlow runtime instance
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const runtime = useKoduckFlowRuntime();
 * const entities = runtime.EntityManager.query({ type: 'node' });
 */
export const useKoduckFlowRuntime = (): KoduckFlowRuntime => {
  return useKoduckFlowContext().runtime;
};

/**
 * Hook to access all runtime managers and configuration metadata in a memoized object.
 * Aggregates the most commonly used managers and metadata for convenience.
 * Returns an object with runtime, environment, factory, source, and all standard managers
 * (entityManager, renderManager, registryManager, eventBus, renderEvents, entityEvents).
 * @returns {Object} Memoized object containing runtime and manager references
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const { entityManager, renderManager, eventBus } = useKoduckFlowManagers();
 * eventBus.on('entity:created', (entity) => {
 *   console.log('Entity created:', entity.id);
 * });
 */
export const useKoduckFlowManagers = () => {
  const { runtime, environment, factory, source } = useKoduckFlowContext();
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
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const customManager = useKoduckFlowManager<CustomManager>('custom');
 * if (customManager) {
 *   customManager.doSomething();
 * }
 */
export const useKoduckFlowManager = <T extends IManager = IManager>(name: string): T | undefined => {
  const runtime = useKoduckFlowRuntime();
  return runtime.getManager<T>(name);
};

/**
 * Hook to access tenant context if available.
 * Returns undefined in single-tenant or non-tenant environments.
 * @returns {ResolvedTenantContext | undefined} Tenant context or undefined
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const tenant = useKoduckFlowTenant();
 * if (tenant) {
 *   console.log('Tenant ID:', tenant.id);
 * }
 */
export const useKoduckFlowTenant = (): ResolvedTenantContext | undefined => {
  const { tenant } = useKoduckFlowContext();
  return tenant;
};

/**
 * Hook to check if a feature flag is enabled for the current tenant.
 * Returns default value if tenant is not configured or flag is not found.
 * @param {string} flag - The name of the feature flag to check
 * @param {boolean} [defaultValue=false] - Value to return if flag not found
 * @returns {boolean} Whether the feature flag is enabled
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const isExperimental = useTenantFeatureFlag('experimental-feature');
 * if (isExperimental) {
 *   return <ExperimentalComponent />;
 * }
 */
export const useTenantFeatureFlag = (flag: string, defaultValue = false): boolean => {
  const runtime = useKoduckFlowRuntime();
  return runtime.isTenantFeatureEnabled(flag, defaultValue);
};

/**
 * Hook to check if the current tenant is included in a feature rollout.
 * Uses optional seed for deterministic but randomized rollout decisions.
 * @param {string} [seed] - Optional seed for rollout decision (ensures consistent behavior)
 * @returns {boolean} Whether tenant is included in the rollout
 * @throws {Error} If called outside KoduckFlowProvider wrapper
 * @example
 * const isInRollout = useTenantRollout('feature-x-rollout');
 * if (isInRollout) {
 *   return <NewFeatureComponent />;
 * }
 */
export const useTenantRollout = (seed?: string): boolean => {
  const runtime = useKoduckFlowRuntime();
  return runtime.isTenantInRollout(seed);
};
