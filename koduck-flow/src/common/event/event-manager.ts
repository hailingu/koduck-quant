/**
 * Koduck Flow 事件管理器基类
 *
 * 提供公共的事件管理功能，作为其他事件管理器的基类。
 * 不是单例，可以被继承扩展为不同类型的事件管理器。
 *
 * @example
 * ```typescript
 * class CustomEventManager extends EventManager {
 *   // 自定义实现
 * }
 * ```
 */
import { type EventConfiguration } from "./event";
import {
  EntityAddEvent,
  EntityRemoveEvent,
  EntityUpdateEvent,
} from "./entity-event";

/**
 * 事件管理器基类
 *
 * 提供通用的事件管理功能，包括调试模式、批处理配置等。
 * 作为其他具体事件管理器的基类，支持继承扩展。
 *
 * @since 1.0.0
 */
export class EventManager<T = unknown> {
  /** 实体添加事件 */
  public readonly added = new EntityAddEvent<T>();

  /** 实体移除事件 */
  public readonly removed = new EntityRemoveEvent<T>();

  /** 实体更新事件 */
  public readonly updated = new EntityUpdateEvent<T>();

  /**
   * 为所有管理的事件设置调试模式
   */
  setDebugMode(enabled: boolean): this {
    this.added.setDebugMode(enabled);
    this.removed.setDebugMode(enabled);
    this.updated.setDebugMode(enabled);
    return this;
  }

  /**
   * 一次性配置所有事件
   */
  configureAll(config: Partial<EventConfiguration>): this {
    this.added.updateConfiguration(config);
    this.removed.updateConfiguration(config);
    this.updated.updateConfiguration(config);
    return this;
  }

  /**
   * 配置所有事件的批处理
   */
  configureBatch(
    config: Partial<
      Pick<EventConfiguration, "batchSize" | "batchInterval" | "enableBatching">
    >
  ): this {
    return this.configureAll(config);
  }

  /**
   * 强制处理所有批次
   */
  flushAllBatches(): void {
    this.added.flushBatch();
    this.removed.flushBatch();
    this.updated.flushBatch();
  }

  /**
   * 清除所有事件的监听器
   */
  clearAll(): void {
    this.added.clear();
    this.removed.clear();
    this.updated.clear();
  }

  /**
   * 重置所有事件
   */
  resetAll(): void {
    this.added.reset();
    this.removed.reset();
    this.updated.reset();
  }

  /**
   * 条件执行 - 只有满足条件时才执行回调
   */
  when(condition: boolean, callback: (manager: this) => void): this {
    if (condition) {
      callback(this);
    }
    return this;
  }

  /**
   * 析构函数 - 清理所有资源
   */
  dispose(): void {
    this.added.dispose();
    this.removed.dispose();
    this.updated.dispose();
  }
}
