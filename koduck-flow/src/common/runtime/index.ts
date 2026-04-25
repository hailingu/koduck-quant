/**
 * @module src/common/runtime
 * @description DuckFlow Runtime module exporting unified runtime orchestration and management services.
 * Provides the main DuckFlowRuntime class for flow execution and lifecycle management, along with
 * specialized managers for DI container, managers, tenant context, quota, feature flags, debugging,
 * and entity operations.
 *
 * ## Primary Exports (Recommended for most use cases)
 * - `DuckFlowRuntime` - Main runtime orchestrator implementing Facade Pattern
 * - `createDuckFlowRuntime(options)` - Factory function for runtime creation
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
 * import { createDuckFlowRuntime } from '@duckflow/duck-flow';
 *
 * // Create runtime with default configuration
 * const runtime = createDuckFlowRuntime({
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

export { DuckFlowRuntime, createDuckFlowRuntime, createScopedRuntime } from "./duck-flow-runtime";

// ==================== 核心模块导出（高级用户） ====================
// 这些模块可用于自定义 Runtime 实现或单独使用

export { RuntimeContainerManager } from "./runtime-container-manager";
export { RuntimeManagerCoordinator } from "./runtime-manager-coordinator";
export { RuntimeTenantContext } from "./runtime-tenant-context";
export { RuntimeQuotaManager } from "./runtime-quota-manager";
export { RuntimeFeatureFlag } from "./runtime-feature-flag";
export { RuntimeDebugConfiguration } from "./runtime-debug-configuration";
export { RuntimeEntityOperations } from "./runtime-entity-operations";

// ==================== 工具函数导出 ====================

export * from "./utils";
export { normalizeRuntimeKey } from "./runtime-key";
export { resolveTenantContext } from "./tenant-context";
export { DEFAULT_DEBUG_OPTIONS, mergeDebugOptions } from "./debug-options";

// ==================== 工厂类导出 ====================

export { DuckFlowRuntimeFactory } from "./runtime-factory";
export { DuckFlowRuntimeController } from "./runtime-controller";

// ==================== 类型导出 ====================

// Manager 相关类型
export type { IManager } from "../manager/types";
export type {
  CoreManagerKey,
  ManagerInitializationOptions,
  ManagerInitializationRetryConfig,
  ManagerRegistrationOptions,
} from "./types";

// Runtime 选项类型
export type { DuckFlowRuntimeOptions } from "./types";
export type { RuntimeEnvironmentKey } from "./runtime-key";
export type { RuntimeCreationOptions } from "./runtime-factory";

// 租户相关类型
export type {
  DuckFlowTenantConfig,
  TenantResourceQuota,
  TenantRolloutConfig,
  ResolvedTenantContext,
  TenantQuotaSnapshot,
} from "./tenant-context";

// 调试相关类型
export type { DebugOptions, DebugPanelOptions, DebugPanelPosition } from "./debug-options";

// Controller 相关类型
export type {
  RuntimeControllerOptions,
  RuntimeControllerSnapshot,
  RuntimeControllerSource,
  RuntimeControllerListener,
  RuntimeSetOptions,
  RuntimeSwitchOptions,
} from "./runtime-controller";
