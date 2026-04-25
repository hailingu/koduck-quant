/**
 * 全局API - Duck-flow 统一接口
 *
 * Duck-flow 的全局 API 入口，聚合各个领域模块的能力并输出统一的使用体验。
 * 提供实体管理、流程控制、渲染与管理器操作等常用方法，同时暴露运行时配置工具。
 */

export * from "./api/runtime";
export * from "./api/entity";
export * from "./api/render";
export * from "./api/manager";
export * from "./api/flow";

// Re-export global runtime functions
export {
  getGlobalRuntime,
  setGlobalRuntime,
  resetGlobalRuntime,
  disposeGlobalRuntime,
  type SetGlobalRuntimeOptions,
  type ResetGlobalRuntimeOptions,
  type DisposeGlobalRuntimeOptions,
} from "./global-runtime";

export type { Entity, EntityArguments } from "./entity/entity";
export type { IEntity, IEntityArguments } from "./entity/types";
