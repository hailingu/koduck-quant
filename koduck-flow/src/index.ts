/**
 * Flow - 流程管理和实体渲染框架
 *
 * 这是 Flow 框架的主要入口文件，导出所有核心功能和 API。
 */

// 核心 API - 最常用的全局接口
export * from "./common/api";

// 实体系统
export * from "./common/entity/entity";
export * from "./common/entity/entity-manager";
export * from "./common/entity/entity-registry";

// 注册表系统
export * from "./common/registry";

// 渲染系统
export * from "./common/render";

// 事件系统
export * from "./common/event";

// 数据和时间
export * from "./common/data";

// 资源管理
export * from "./common/disposable";

// Global Runtime Management
export {
  getGlobalRuntime,
  setGlobalRuntime,
  resetGlobalRuntime,
  disposeGlobalRuntime,
  type SetGlobalRuntimeOptions,
  type ResetGlobalRuntimeOptions,
  type DisposeGlobalRuntimeOptions,
} from "./common/global-runtime";

// KoduckFlow Runtime
export * from "./common/runtime";
export { KoduckFlowProvider, type KoduckFlowProviderProps } from "./components/provider/KoduckFlowProvider";
export { DebugPanel, type DebugPanelProps } from "./components/debug/DebugPanel";
export {
  useKoduckFlowContext,
  useKoduckFlowRuntime,
  useKoduckFlowManagers,
  useKoduckFlowManager,
  useKoduckFlowTenant,
  useTenantFeatureFlag,
  useTenantRollout,
} from "./components/provider/hooks/useKoduckFlowRuntime";

// 流程引擎
export * from "./common/engine";

// 对话原生 Plan Canvas
export * from "./conversation-plan";

// 类型定义 (如果需要的话，可以手动导出特定类型)
