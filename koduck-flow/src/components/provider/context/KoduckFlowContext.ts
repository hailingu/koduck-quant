/**
 * @module src/components/provider/context/KoduckFlowContext
 * @description React Context for sharing KoduckFlow runtime state across component tree.
 * Provides centralized access to the KoduckFlow runtime instance and configuration.
 */

import { createContext } from "react";

import type {
  KoduckFlowRuntime,
  KoduckFlowRuntimeFactory,
  ResolvedTenantContext,
  RuntimeEnvironmentKey,
  RuntimeControllerSource,
} from "../../../common/runtime";

/**
 * Source of the KoduckFlow runtime instance.
 * Indicates where the runtime was obtained from in the component hierarchy.
 * @typedef {'prop' | 'factory' | 'local' | 'global' | RuntimeControllerSource} KoduckFlowRuntimeSource
 */
export type KoduckFlowRuntimeSource =
  | "prop"
  | "factory"
  | "local"
  | "global"
  | RuntimeControllerSource;

/**
 * Value provided by KoduckFlowContext to child components.
 * Contains the runtime instance and metadata about its configuration and source.
 *
 * @typedef {Object} KoduckFlowContextValue
 * @property {KoduckFlowRuntime} runtime - The active KoduckFlow runtime instance
 * @property {RuntimeEnvironmentKey} [environment] - Runtime environment identifier (development, production, etc.)
 * @property {KoduckFlowRuntimeFactory} [factory] - Factory function used to create the runtime
 * @property {KoduckFlowRuntimeSource} source - Origin of the runtime (prop, factory, local, or global)
 * @property {ResolvedTenantContext} [tenant] - Tenant context if multi-tenant mode is enabled
 */
export type KoduckFlowContextValue = {
  runtime: KoduckFlowRuntime;
  environment?: RuntimeEnvironmentKey;
  factory?: KoduckFlowRuntimeFactory;
  source: KoduckFlowRuntimeSource;
  tenant?: ResolvedTenantContext;
};

/**
 * React Context for accessing the KoduckFlow runtime across the component tree.
 * Must be used within a KoduckFlowProvider component.
 *
 * @type {React.Context<KoduckFlowContextValue | null>}
 * @example
 * // In component:
 * const contextValue = useContext(KoduckFlowContext);
 * if (contextValue) {
 *   const { runtime, environment } = contextValue;
 *   console.log('Runtime environment:', environment);
 * }
 *
 * // Recommended: Use the useKoduckFlowRuntime hook instead
 * const { runtime } = useKoduckFlowRuntime();
 */
export const KoduckFlowContext = createContext<KoduckFlowContextValue | null>(null);
