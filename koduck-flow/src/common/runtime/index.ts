/**
 * @module src/common/runtime
 * @description KoduckFlow Runtime module exporting unified runtime orchestration and management services.
 * Provides the main KoduckFlowRuntime class for flow execution and lifecycle management, along with
 * specialized managers for DI container, managers, tenant context, quota, feature flags, debugging,
 * and entity operations.
 *
 * ## Primary Exports (Recommended for most use cases)
 * - `KoduckFlowRuntime` - Main runtime orchestrator implementing Facade Pattern
 * - `createKoduckFlowRuntime(options)` - Factory function for runtime creation
 * - `createScopedRuntime(parent, tenant)` - Create scoped runtime for multi-tenancy
 *
 * ## Core Modules (Advanced usage / custom implementations)
 * - `RuntimeContainerManager` - DI container and service resolution
 * - `RuntimeManagerCoordinator` - Manager lifecycle and initialization
 * - `RuntimeTenantContext` - Multi-tenant context management
 * - `RuntimeQuotaManager` - Resource quota enforcement
 * - `RuntimeFeatureFlag` - Feature flags and gradual rollout
 * - `RuntimeDebugConfiguration` - Debug options and configuration
 * - `RuntimeEntityOperations` - Entity creation, deletion, and rendering
 *
 * ## Architecture
 * - Uses Facade Pattern for simplified public API
 * - Delegates specialized operations to dedicated modules
 * - Supports multi-tenancy with isolated runtime instances
 * - Enforces resource quotas and limits
 *
 * @example
 * ```typescript
 * import { createKoduckFlowRuntime } from '@koduckflow/koduck-flow';
 *
 * // Create runtime with default configuration
 * const runtime = createKoduckFlowRuntime({
 *   enableMetrics: true,
 *   enableCache: true
 * });
 *
 * // Access managers
 * const entityManager = runtime.EntityManager;
 * const registryManager = runtime.RegistryManager;
 *
 * // Execute flow
 * const result = await runtime.execute(flow, context);
 *
 * // Cleanup
 * runtime.dispose();
 * ```
 */

// ==================== Primary Exports ====================
// Backward compatible, most commonly used exports

export { KoduckFlowRuntime, createKoduckFlowRuntime, createScopedRuntime } from "./koduck-flow-runtime";

// ==================== Core Module Exports (Advanced Users) ====================
// These modules can be used for custom Runtime implementations or independently

export { RuntimeContainerManager } from "./runtime-container-manager";
export { RuntimeManagerCoordinator } from "./runtime-manager-coordinator";
export { RuntimeTenantContext } from "./runtime-tenant-context";
export { RuntimeQuotaManager } from "./runtime-quota-manager";
export { RuntimeFeatureFlag } from "./runtime-feature-flag";
export { RuntimeDebugConfiguration } from "./runtime-debug-configuration";
export { RuntimeEntityOperations } from "./runtime-entity-operations";

// ==================== Utility Exports ====================

export * from "./utils";
export { normalizeRuntimeKey } from "./runtime-key";
export { resolveTenantContext } from "./tenant-context";
export { DEFAULT_DEBUG_OPTIONS, mergeDebugOptions } from "./debug-options";

// ==================== Factory Exports ====================

export { KoduckFlowRuntimeFactory } from "./runtime-factory";
export { KoduckFlowRuntimeController } from "./runtime-controller";

// ==================== Type Exports ====================

// Manager-related types
export type { IManager } from "../manager/types";
export type {
  CoreManagerKey,
  ManagerInitializationOptions,
  ManagerInitializationRetryConfig,
  ManagerRegistrationOptions,
} from "./types";

// Runtime option types
export type { KoduckFlowRuntimeOptions } from "./types";
export type { RuntimeEnvironmentKey } from "./runtime-key";
export type { RuntimeCreationOptions } from "./runtime-factory";

// Tenant-related types
export type {
  KoduckFlowTenantConfig,
  TenantResourceQuota,
  TenantRolloutConfig,
  ResolvedTenantContext,
  TenantQuotaSnapshot,
} from "./tenant-context";

// Debug-related types
export type { DebugOptions, DebugPanelOptions, DebugPanelPosition } from "./debug-options";

// Controller-related types
export type {
  RuntimeControllerOptions,
  RuntimeControllerSnapshot,
  RuntimeControllerSource,
  RuntimeControllerListener,
  RuntimeSetOptions,
  RuntimeSwitchOptions,
} from "./runtime-controller";
