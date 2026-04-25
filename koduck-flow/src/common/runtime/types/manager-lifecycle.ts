/**
 * Manager 生命周期状态相关类型定义
 * @module runtime/types/manager-lifecycle
 */

/**
 * Manager 生命周期状态枚举
 */
export const MANAGER_LIFECYCLE_STATUS = {
  /** 已注册但未初始化 */
  Registered: "registered",
  /** 正在初始化中 */
  Initializing: "initializing",
  /** 已就绪（初始化成功） */
  Ready: "ready",
  /** 初始化失败 */
  Failed: "failed",
} as const;

/**
 * Manager 生命周期状态类型
 */
export type ManagerLifecycleStatus =
  (typeof MANAGER_LIFECYCLE_STATUS)[keyof typeof MANAGER_LIFECYCLE_STATUS];

/**
 * Manager 生命周期状态对象
 */
export type ManagerLifecycleState = {
  /** 当前状态 */
  status: ManagerLifecycleStatus;
  /** 初始化 Promise（如果正在初始化） */
  promise?: Promise<void>;
  /** 错误信息（如果初始化失败） */
  error?: unknown;
  /** 依赖路径（用于循环依赖检测） */
  path?: string[];
};

/**
 * Manager 初始化错误类
 */
export class ManagerInitializationError extends Error {
  /** 依赖路径 */
  readonly path: string[];

  constructor(name: string, message: string, options?: { cause?: unknown; path?: string[] }) {
    const errorOptions = options?.cause === undefined ? undefined : { cause: options.cause };
    super(`Manager '${name}': ${message}`, errorOptions);
    this.name = "ManagerInitializationError";
    this.path = options?.path ?? [];
  }
}

/**
 * 核心 Manager 键名常量
 */
export const CORE_MANAGER_KEYS = ["entity", "render", "registry"] as const;

/**
 * 核心 Manager 键名类型
 */
export type CoreManagerKey = (typeof CORE_MANAGER_KEYS)[number];

/**
 * Manager 初始化超时标志（内部使用）
 */
export const INITIALIZATION_TIMEOUT_FLAG = Symbol("duck-flow-manager-init-timeout");
