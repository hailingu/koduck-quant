/**
 * 配置状态管理接口
 * 用于集中管理配置状态，解耦各模块间的状态依赖
 */

import type { KoduckFlowConfig } from "../../schema.js";

/**
 * 配置变更监听器类型
 */
export type ConfigChangeListener = (config: KoduckFlowConfig, previousConfig: KoduckFlowConfig) => void;

/**
 * 配置状态管理器接口
 * 提供配置状态的读写、订阅和历史记录功能
 */
export interface IConfigState {
  /**
   * 获取当前配置状态
   * @returns 当前的配置对象
   */
  getCurrentConfig(): KoduckFlowConfig;

  /**
   * 设置配置状态
   * @param config - 新的配置对象
   * @param silent - 是否静默更新（不触发监听器）
   */
  setCurrentConfig(config: KoduckFlowConfig, silent?: boolean): void;

  /**
   * 获取上一次的配置状态
   * @returns 上一次的配置对象，如果不存在返回 undefined
   */
  getPreviousConfig(): KoduckFlowConfig | undefined;

  /**
   * 订阅配置变更事件
   * @param listener - 配置变更监听器
   * @returns 取消订阅的函数
   */
  subscribe(listener: ConfigChangeListener): () => void;

  /**
   * 取消订阅配置变更事件
   * @param listener - 要取消的监听器
   */
  unsubscribe(listener: ConfigChangeListener): void;

  /**
   * 获取所有监听器
   * @returns 当前注册的所有监听器
   */
  getListeners(): ReadonlyArray<ConfigChangeListener>;

  /**
   * 清空所有监听器
   */
  clearListeners(): void;

  /**
   * 获取配置历史记录
   * @param limit - 返回的历史记录数量限制
   * @returns 配置历史记录数组
   */
  getHistory(limit?: number): ReadonlyArray<{
    config: KoduckFlowConfig;
    timestamp: number;
    trigger?: string;
  }>;

  /**
   * 清空配置历史记录
   */
  clearHistory(): void;
}
