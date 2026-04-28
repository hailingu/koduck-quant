/**
 * 配置状态管理器实现
 * 集中管理配置状态，解耦各模块间的状态依赖
 */

import type { KoduckFlowConfig } from "../schema.js";
import type { IConfigState, ConfigChangeListener } from "./types/index.js";

/**
 * 配置历史记录条目
 */
interface ConfigHistoryEntry {
  config: KoduckFlowConfig;
  timestamp: number;
  trigger?: string;
}

/**
 * 配置状态管理器
 * 提供配置状态的读写、订阅和历史记录功能
 */
export class ConfigStateManager implements IConfigState {
  private currentConfig: KoduckFlowConfig;
  private previousConfig: KoduckFlowConfig | undefined;
  private readonly listeners: Set<ConfigChangeListener>;
  private history: ConfigHistoryEntry[];
  private readonly maxHistorySize: number;

  constructor(initialConfig: KoduckFlowConfig, maxHistorySize = 50) {
    this.currentConfig = initialConfig;
    this.previousConfig = undefined;
    this.listeners = new Set();
    this.history = [];
    this.maxHistorySize = maxHistorySize;

    // 记录初始配置到历史
    this.addToHistory(initialConfig, "initialization");
  }

  /**
   * 获取当前配置状态
   */
  getCurrentConfig(): KoduckFlowConfig {
    return this.currentConfig;
  }

  /**
   * 设置配置状态
   */
  setCurrentConfig(config: KoduckFlowConfig, silent = false): void {
    const oldConfig = this.currentConfig;
    this.previousConfig = oldConfig;
    this.currentConfig = config;

    // 记录到历史
    this.addToHistory(config, "manual-update");

    // 触发监听器
    if (!silent && this.listeners.size > 0) {
      this.notifyListeners(config, oldConfig);
    }
  }

  /**
   * 获取上一次的配置状态
   */
  getPreviousConfig(): KoduckFlowConfig | undefined {
    return this.previousConfig;
  }

  /**
   * 订阅配置变更事件
   */
  subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);

    // 返回取消订阅函数
    return () => {
      this.unsubscribe(listener);
    };
  }

  /**
   * 取消订阅配置变更事件
   */
  unsubscribe(listener: ConfigChangeListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 获取所有监听器
   */
  getListeners(): ReadonlyArray<ConfigChangeListener> {
    return Array.from(this.listeners);
  }

  /**
   * 清空所有监听器
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * 获取配置历史记录
   */
  getHistory(limit?: number): ReadonlyArray<ConfigHistoryEntry> {
    if (limit && limit > 0) {
      return this.history.slice(-limit);
    }
    return [...this.history];
  }

  /**
   * 清空配置历史记录
   */
  clearHistory(): void {
    // 保留最新的一条记录
    if (this.history.length > 0) {
      const latest = this.history.at(-1)!;
      this.history = [latest];
    } else {
      this.history = [];
    }
  }

  /**
   * 添加配置到历史记录
   */
  private addToHistory(config: KoduckFlowConfig, trigger?: string): void {
    const entry: ConfigHistoryEntry = {
      config,
      timestamp: Date.now(),
    };
    if (trigger !== undefined) {
      entry.trigger = trigger;
    }
    this.history.push(entry);

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 通知所有监听器配置已变更
   */
  private notifyListeners(newConfig: KoduckFlowConfig, oldConfig: KoduckFlowConfig): void {
    for (const listener of this.listeners) {
      try {
        listener(newConfig, oldConfig);
      } catch (error) {
        console.error("Error in config change listener:", error);
      }
    }
  }

  /**
   * 更新配置并记录触发器
   */
  updateConfig(config: KoduckFlowConfig, trigger: string, silent = false): void {
    const oldConfig = this.currentConfig;
    this.previousConfig = oldConfig;
    this.currentConfig = config;

    // 记录到历史
    this.addToHistory(config, trigger);

    // 触发监听器
    if (!silent && this.listeners.size > 0) {
      this.notifyListeners(config, oldConfig);
    }
  }

  /**
   * 获取监听器数量
   */
  getListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * 获取历史记录大小
   */
  getHistorySize(): number {
    return this.history.length;
  }
}
