/**
 * Runtime 类型定义统一导出
 * @module runtime/types
 */

// Manager 初始化相关类型
export { DEFAULT_MANAGER_INITIALIZATION_CONFIG } from "./manager-initialization";

export type {
  ManagerInitializationRetryConfig,
  ManagerInitializationOptions,
  ManagerRegistrationOptions,
  NormalizedManagerInitializationConfig,
} from "./manager-initialization";

// Manager 生命周期相关类型
export {
  MANAGER_LIFECYCLE_STATUS,
  ManagerInitializationError,
  CORE_MANAGER_KEYS,
  INITIALIZATION_TIMEOUT_FLAG,
} from "./manager-lifecycle";

export type {
  ManagerLifecycleStatus,
  ManagerLifecycleState,
  CoreManagerKey,
} from "./manager-lifecycle";

// Runtime 选项相关类型
export type { DuckFlowRuntimeOptions, CoreManagers } from "./runtime-options";

export { TENANT_ENTITY_QUOTA_KEY } from "./runtime-options";
