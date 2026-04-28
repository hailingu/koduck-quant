/**
 * 配置提供者接口
 * 提供统一的配置访问和管理抽象层
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * 配置提供者接口
 * 用于解耦配置加载器与具体实现的依赖
 */
export interface IConfigProvider {
  /**
   * 获取完整配置对象
   * @returns 当前的配置对象
   */
  getConfig(): KoduckFlowConfig;

  /**
   * 获取指定路径的配置值
   * @param path - 配置路径，使用点号分隔，如 'render.mode'
   * @returns 配置值，如果不存在返回 undefined
   */
  get<T = unknown>(path: string): T | undefined;

  /**
   * 设置指定路径的配置值
   * @param path - 配置路径
   * @param value - 配置值
   */
  set(path: string, value: unknown): void;

  /**
   * 检查配置路径是否存在
   * @param path - 配置路径
   * @returns 是否存在
   */
  has(path: string): boolean;

  /**
   * 验证配置对象是否符合 schema
   * @param config - 要验证的配置对象
   * @returns 验证结果
   */
  validate(config: KoduckFlowConfig): import("../../schema.js").ValidationResult;

  /**
   * 重新加载配置
   * @param options - 可选的运行时覆盖配置
   * @param context - 配置变更上下文
   * @returns 重新加载后的配置对象
   */
  reload(options?: Partial<KoduckFlowConfig>, context?: unknown): KoduckFlowConfig;
}
