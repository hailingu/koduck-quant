/**
 * 运行时配置管理接口
 * 用于管理运行时配置覆盖和动态配置更新
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * 运行时配置管理器接口
 * 负责管理运行时配置覆盖、持久化和合并逻辑
 */
export interface IConfigRuntime {
  /**
   * 应用运行时配置覆盖
   * @param overrides - 要应用的配置覆盖对象
   * @param persist - 是否持久化覆盖配置
   * @returns 应用覆盖后的完整配置
   */
  applyOverrides(overrides: Partial<KoduckFlowConfig>, persist?: boolean): Promise<KoduckFlowConfig>;

  /**
   * 获取当前运行时覆盖配置
   * @returns 当前的运行时覆盖配置
   */
  getOverrides(): Partial<KoduckFlowConfig>;

  /**
   * 清除运行时覆盖配置
   * @param persist - 是否同时清除持久化的覆盖配置
   * @returns 清除后的配置
   */
  clearOverrides(persist?: boolean): Promise<KoduckFlowConfig>;

  /**
   * 合并多个配置对象
   * @param configs - 要合并的配置对象数组，按优先级从低到高排列
   * @returns 合并后的配置对象
   */
  merge(...configs: Array<Partial<KoduckFlowConfig>>): KoduckFlowConfig;

  /**
   * 从持久化存储加载覆盖配置
   * @returns 加载的覆盖配置
   */
  loadPersistedOverrides(): Promise<Partial<KoduckFlowConfig>>;

  /**
   * 保存覆盖配置到持久化存储
   * @param overrides - 要保存的覆盖配置
   */
  saveOverrides(overrides: Partial<KoduckFlowConfig>): Promise<void>;
}
