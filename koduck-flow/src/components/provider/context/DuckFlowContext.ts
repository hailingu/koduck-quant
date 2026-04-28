/**
 * @module src/components/provider/context/DuckFlowContext
 * @description React Context for sharing DuckFlow runtime state across component tree.
 * Provides centralized access to the DuckFlow runtime instance and configuration.
 */

import { createContext } from "react";

import type {
  DuckFlowRuntime,
  DuckFlowRuntimeFactory,
  ResolvedTenantContext,
  RuntimeEnvironmentKey,
  RuntimeControllerSource,
} from "../../../common/runtime";

/**
 * Source of the DuckFlow runtime instance.
 * Indicates where the runtime was obtained from in the component hierarchy.
 * @typedef {'prop' | 'factory' | 'local' | 'global' | RuntimeControllerSource} DuckFlowRuntimeSource
 */
export type DuckFlowRuntimeSource =
  | "prop"
  | "factory"
  | "local"
  | "global"
  | RuntimeControllerSource;

/**
 * Value provided by DuckFlowContext to child components.
 * Contains the runtime instance and metadata about its configuration and source.
 *
 * @typedef {Object} DuckFlowContextValue
 * @property {DuckFlowRuntime} runtime - The active DuckFlow runtime instance
 * @property {RuntimeEnvironmentKey} [environment] - Runtime environment identifier (development, production, etc.)
 * @property {DuckFlowRuntimeFactory} [factory] - Factory function used to create the runtime
 * @property {DuckFlowRuntimeSource} source - Origin of the runtime (prop, factory, local, or global)
 * @property {ResolvedTenantContext} [tenant] - Tenant context if multi-tenant mode is enabled
 */
export type DuckFlowContextValue = {
  runtime: DuckFlowRuntime;
  environment?: RuntimeEnvironmentKey;
  factory?: DuckFlowRuntimeFactory;
  source: DuckFlowRuntimeSource;
  tenant?: ResolvedTenantContext;
};

/**
 * React Context for accessing the DuckFlow runtime across the component tree.
 * Must be used within a DuckFlowProvider component.
 *
 * @type {React.Context<DuckFlowContextValue | null>}
 * @example
 * // In component:
 * const contextValue = useContext(DuckFlowContext);
 * if (contextValue) {
 *   const { runtime, environment } = contextValue;
 *   console.log('Runtime environment:', environment);
 * }
 *
 * // Recommended: Use the useDuckFlowRuntime hook instead
 * const { runtime } = useDuckFlowRuntime();
 */
export const DuckFlowContext = createContext<DuckFlowContextValue | null>(null);
