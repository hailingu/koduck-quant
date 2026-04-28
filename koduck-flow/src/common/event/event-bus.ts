/**
 * Koduck Flow 系统级事件总线
 *
 * 统一管理系统级事件，包括日志记录和系统事件。
 * 继承自 EventManager 基类，可按需实例化，也提供默认实例。
 */

import { BaseEvent, GenericEvent } from "./event";
import { EventManager } from "./event-manager";

/**
 * 日志事件接口
 */
interface LogEvent {
  /** 日志级别 */
  level: "debug" | "info" | "warn" | "error" | "fatal";
  /** 日志消息 */
  message: string;
  /** 错误对象(如果有) */
  error?: Error | undefined;
  /** 上下文信息 */
  context?: Record<string, unknown> | undefined;
  /** 时间戳 */
  timestamp: number;
  /** 来源模块 */
  source?: string | undefined;
}

/**
 * 系统事件接口
 */
interface SystemEvent {
  /** 事件类型 */
  type: "startup" | "shutdown" | "error" | "warning" | "config-change";
  /** 事件数据 */
  data: unknown;
  /** 时间戳 */
  timestamp: number;
  /** 事件源 */
  source: string;
}

/**
 * 日志事件
 *
 * 专门用于日志数据的收集和分发
 */
class LoggingEvent extends BaseEvent<LogEvent> {
  constructor() {
    super("LoggingEvent", {
      enableBatching: true,
      batchSize: 50,
      batchInterval: 500, // 500ms批量处理日志
    });
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("debug", message, undefined, context, source);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("info", message, undefined, context, source);
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: Record<string, unknown>, source?: string): void {
    this.log("warn", message, undefined, context, source);
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error, context?: Record<string, unknown>, source?: string): void {
    this.log("error", message, error, context, source);
  }

  /**
   * 记录致命错误日志
   */
  fatal(message: string, error?: Error, context?: Record<string, unknown>, source?: string): void {
    this.log("fatal", message, error, context, source);
  }

  /**
   * 通用日志记录方法
   */
  private log(
    level: LogEvent["level"],
    message: string,
    error?: Error,
    context?: Record<string, unknown>,
    source?: string
  ): void {
    const logEvent: LogEvent = {
      level,
      message,
      error,
      context,
      timestamp: Date.now(),
      source,
    };

    this.fire(logEvent);
  }
}

/**
 * 系统事件总线
 *
 * 专门用于系统级事件的管理
 */
class SystemEventBus extends BaseEvent<SystemEvent> {
  constructor() {
    super("SystemEvent", {
      enableBatching: false, // 系统事件需要立即处理
    });
  }

  /**
   * 系统启动事件
   */
  startup(data: unknown, source: string): void {
    this.fire({
      type: "startup",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * 系统关闭事件
   */
  shutdown(data: unknown, source: string): void {
    this.fire({
      type: "shutdown",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * 系统错误事件
   */
  systemError(data: unknown, source: string): void {
    this.fire({
      type: "error",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * 系统警告事件
   */
  systemWarning(data: unknown, source: string): void {
    this.fire({
      type: "warning",
      data,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * 配置变更事件
   */
  configChange(data: unknown, source: string): void {
    this.fire({
      type: "config-change",
      data,
      timestamp: Date.now(),
      source,
    });
  }
}

/**
 * 系统级事件总线
 *
 * 继承自 EventManager 基类，统一管理系统级事件
 * 提供可复用的默认实例，也支持按需创建独立实例
 */
class EventBus extends EventManager {
  /** 日志事件实例 */
  public readonly logging = new LoggingEvent();

  /** 系统事件实例 */
  public readonly system = new SystemEventBus();

  /** 通用事件映射 */
  private customEvents = new Map<string, BaseEvent<unknown>>();

  constructor() {
    super();
  }

  /**
   * 重写基类方法：为所有系统事件设置调试模式
   */
  override setDebugMode(enabled: boolean): this {
    this.logging.setDebugMode(enabled);
    this.system.setDebugMode(enabled);
    this.customEvents.forEach((event) => event.setDebugMode(enabled));
    return this;
  }

  /**
   * 重写基类方法：配置所有系统事件
   */
  override configureAll(config: Partial<import("./event").EventConfiguration>): this {
    this.logging.updateConfiguration(config);
    this.system.updateConfiguration(config);
    this.customEvents.forEach((event) => event.updateConfiguration(config));
    return this;
  }

  /**
   * 重写基类方法：强制处理所有系统事件批次
   */
  override flushAllBatches(): void {
    this.logging.flushBatch();
    this.system.flushBatch();
    this.customEvents.forEach((event) => event.flushBatch());
  }

  /**
   * 重写基类方法：清除所有系统事件监听器
   */
  override clearAll(): void {
    this.logging.clear();
    this.system.clear();
    this.customEvents.forEach((event) => event.clear());
  }

  /**
   * 重写基类方法：获取所有系统事件统计信息
   * 注意：按要求移除统计功能
   */
  getAllStats(): Record<string, unknown> {
    return {
      managerType: this.constructor.name,
      timestamp: Date.now(),
      message: "统计功能已移除",
    };
  }

  /**
   * 重写基类方法：重置所有系统事件
   */
  override resetAll(): void {
    this.logging.reset();
    this.system.reset();
    this.customEvents.forEach((event) => event.reset());
  }

  /**
   * 重写基类方法：清理所有系统事件资源
   */
  override dispose(): void {
    this.logging.dispose();
    this.system.dispose();
    this.customEvents.forEach((event) => event.dispose());
    this.customEvents.clear();
  }

  // ===== EventBus 特有的方法 =====

  /**
   * 注册自定义事件
   * @param eventName 事件名称
   * @param event 事件实例
   */
  registerEvent<T>(eventName: string, event: BaseEvent<T>): void {
    this.customEvents.set(eventName, event as BaseEvent<unknown>);
  }

  /**
   * 注销自定义事件并清理其资源
   * @param eventName 事件名称
   * @returns 是否成功注销
   */
  unregisterEvent(eventName: string): boolean {
    const event = this.customEvents.get(eventName);
    if (!event) return false;
    try {
      // 释放事件内的监听与定时器等资源
      event.dispose();
    } finally {
      this.customEvents.delete(eventName);
    }
    return true;
  }

  /**
   * 获取自定义事件
   * @param eventName 事件名称
   */
  getEvent<T>(eventName: string): BaseEvent<T> | undefined {
    return this.customEvents.get(eventName) as BaseEvent<T> | undefined;
  }

  /**
   * 通用事件监听器注册 (兼容性方法)
   * @param eventName 事件名称
   * @param listener 监听器函数
   */
  on<T>(eventName: string, listener: (payload: T) => void): () => void {
    let event = this.customEvents.get(eventName) as BaseEvent<T>;
    if (!event) {
      // 自动创建事件
      event = new GenericEvent<T>(eventName);
      this.customEvents.set(eventName, event as BaseEvent<unknown>);
    }
    return event.addEventListener(listener);
  }

  /**
   * 注销事件监听器 (兼容性方法)
   * @param eventName 事件名称
   * @param listener 监听器函数
   */
  off<T>(eventName: string, listener: (payload: T) => void): boolean {
    const event = this.customEvents.get(eventName) as BaseEvent<T>;
    return event ? event.removeEventListener(listener) : false;
  }

  /**
   * 触发事件 (兼容性方法)
   * @param eventName 事件名称
   * @param payload 事件数据
   */
  emit<T>(eventName: string, payload: T): void {
    const event = this.customEvents.get(eventName) as BaseEvent<T>;
    if (event) {
      event.fire(payload);
    }
  }
}

// 导出统一的事件系统
export { EventBus, LoggingEvent, SystemEventBus, type LogEvent, type SystemEvent };

export function createEventBus(): EventBus {
  return new EventBus();
}
