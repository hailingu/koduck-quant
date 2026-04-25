/**
 * Manager 初始化相关类型定义
 * @module runtime/types/manager-initialization
 */

/**
 * Manager 初始化重试配置
 */
export interface ManagerInitializationRetryConfig {
  /**
   * 重试次数（默认 1，表示不重试）
   */
  attempts?: number;

  /**
   * 重试延迟（毫秒）
   */
  delayMs?: number;
}

/**
 * Manager 初始化选项
 */
export interface ManagerInitializationOptions {
  /**
   * 重试配置
   */
  retries?: ManagerInitializationRetryConfig;

  /**
   * 初始化超时时间（毫秒）
   */
  timeoutMs?: number;

  /**
   * 是否在重试时发出警告（默认 true）
   */
  warnOnRetry?: boolean;
}

/**
 * Manager 注册选项
 */
export interface ManagerRegistrationOptions {
  /**
   * 是否懒加载（仅在首次访问时初始化）
   */
  lazy?: boolean;

  /**
   * 是否为必需的 Manager（如果初始化失败则阻止运行时启动）
   */
  required?: boolean;

  /**
   * 依赖的其他 Manager 名称列表
   */
  dependencies?: string[];

  /**
   * 自定义初始化选项（覆盖运行时级别的配置）
   */
  initialization?: ManagerInitializationOptions;
}

/**
 * 标准化后的 Manager 初始化配置（内部使用）
 */
export type NormalizedManagerInitializationConfig = {
  retries: {
    attempts: number;
    delayMs: number;
  };
  timeoutMs?: number;
  warnOnRetry: boolean;
};

/**
 * 默认的 Manager 初始化配置
 */
export const DEFAULT_MANAGER_INITIALIZATION_CONFIG: NormalizedManagerInitializationConfig = {
  retries: {
    attempts: 1,
    delayMs: 0,
  },
  warnOnRetry: true,
};
