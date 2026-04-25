/**
 * @fileoverview RuntimeDebugConfiguration
 * 提供调试配置管理功能
 *
 * 职责:
 * - 管理调试选项的设置和获取
 * - 同步调试配置到Logger
 * - 同步调试配置到事件管理器
 *
 * 使用场景:
 * ```typescript
 * const debugConfig = new RuntimeDebugConfiguration({
 *   eventBus,
 *   renderEvents,
 *   entityEvents
 * });
 *
 * debugConfig.configureDebug({
 *   enabled: true,
 *   logLevel: 'debug',
 *   eventTracking: true
 * });
 *
 * const options = debugConfig.getDebugOptions();
 * ```
 *
 * @module RuntimeDebugConfiguration
 * @since Phase 2.5
 */

import { logger } from "../logger";
import type { LogConfig } from "../logger";
import type { DebugOptions } from "./debug-options";
import type { EventBus } from "../event/event-bus";
import type { RenderEventManager } from "../event/render-event-manager";
import type { EntityEventManager } from "../event/entity-event-manager";
import type { IEntity } from "../entity/";

/**
 * 事件管理器集合接口
 */
interface EventManagers {
  /** 事件总线 */
  eventBus: EventBus;
  /** 渲染事件管理器 */
  renderEvents: RenderEventManager;
  /** 实体事件管理器 */
  entityEvents: EntityEventManager<IEntity>;
}

/**
 * RuntimeDebugConfiguration 类
 * 负责调试配置的管理和同步
 *
 * @example
 * ```typescript
 * const debugConfig = new RuntimeDebugConfiguration({
 *   eventBus: myEventBus,
 *   renderEvents: myRenderEvents,
 *   entityEvents: myEntityEvents
 * });
 *
 * // 配置调试选项
 * debugConfig.configureDebug({
 *   enabled: true,
 *   logLevel: 'debug',
 *   eventTracking: true,
 *   includeEmoji: true,
 *   panel: { position: 'bottom' }
 * });
 *
 * // 获取当前调试选项
 * const options = debugConfig.getDebugOptions();
 * ```
 */
export class RuntimeDebugConfiguration {
  /**
   * 当前调试选项
   * @private
   */
  private debugOptions: DebugOptions | undefined;

  /**
   * 事件管理器集合
   * @private
   */
  private readonly eventManagers: EventManagers;

  /**
   * 创建 RuntimeDebugConfiguration 实例
   *
   * @param eventManagers - 事件管理器集合对象
   * @param eventManagers.eventBus - 事件总线
   * @param eventManagers.renderEvents - 渲染事件管理器
   * @param eventManagers.entityEvents - 实体事件管理器
   *
   * @example
   * ```typescript
   * const debugConfig = new RuntimeDebugConfiguration({
   *   eventBus: new EventBus(),
   *   renderEvents: new RenderEventManager(),
   *   entityEvents: new EntityEventManager()
   * });
   * ```
   */
  constructor(eventManagers: EventManagers) {
    this.eventManagers = eventManagers;
  }

  /**
   * 配置调试选项
   *
   * 此方法会:
   * 1. 克隆并存储调试选项（深度克隆 panel 对象）
   * 2. 同步配置到 Logger
   * 3. 同步配置到事件管理器
   *
   * @param options - 调试选项，如果为 undefined 则清除调试配置
   *
   * @example
   * ```typescript
   * // 启用调试
   * debugConfig.configureDebug({
   *   enabled: true,
   *   logLevel: 'debug',
   *   eventTracking: true
   * });
   *
   * // 清除调试配置
   * debugConfig.configureDebug();
   * ```
   */
  configureDebug(options?: DebugOptions): void {
    // 克隆并存储调试选项
    const snapshot = options ? this.cloneDebugOptions(options) : undefined;
    this.debugOptions = snapshot;

    // 同步到 Logger
    this.syncToLogger(options);

    // 同步到事件管理器
    const eventDebugEnabled = Boolean(options?.eventTracking);
    this.syncToEventManagers(eventDebugEnabled);
  }

  /**
   * 获取当前调试选项
   *
   * 返回调试选项的深度克隆，以防止外部修改内部状态
   *
   * @returns 调试选项的克隆，如果未配置则返回 undefined
   *
   * @example
   * ```typescript
   * const options = debugConfig.getDebugOptions();
   * if (options) {
   *   console.log('Debug enabled:', options.enabled);
   *   console.log('Log level:', options.logLevel);
   * }
   * ```
   */
  getDebugOptions(): DebugOptions | undefined {
    if (!this.debugOptions) {
      return undefined;
    }
    return this.cloneDebugOptions(this.debugOptions);
  }

  /**
   * 同步调试配置到 Logger
   *
   * 根据 DebugOptions 中的设置更新 Logger 的配置
   *
   * @param options - 调试选项
   * @private
   *
   * @example
   * ```typescript
   * // 内部调用示例
   * this.syncToLogger({
   *   enabled: true,
   *   logLevel: 'debug',
   *   includeEmoji: true
   * });
   * ```
   */
  private syncToLogger(options?: DebugOptions): void {
    const logConfig: Partial<LogConfig> = {};

    if (options?.enabled !== undefined) {
      logConfig.enabled = options.enabled;
    }
    if (options?.logLevel) {
      logConfig.level = options.logLevel;
    }
    if (options?.includeEmoji !== undefined) {
      logConfig.includeEmoji = options.includeEmoji;
    }

    if (Object.keys(logConfig).length > 0) {
      logger.setConfig(logConfig);
    }
  }

  /**
   * 同步调试配置到事件管理器
   *
   * 启用或禁用事件总线、渲染事件管理器和实体事件管理器的调试模式
   *
   * @param enabled - 是否启用事件调试
   * @private
   *
   * @example
   * ```typescript
   * // 内部调用示例
   * this.syncToEventManagers(true); // 启用事件调试
   * this.syncToEventManagers(false); // 禁用事件调试
   * ```
   */
  private syncToEventManagers(enabled: boolean): void {
    this.eventManagers.eventBus.setDebugMode(enabled);
    this.eventManagers.renderEvents.setDebugMode?.(enabled);
    this.eventManagers.entityEvents.setDebugMode(enabled);
  }

  /**
   * 深度克隆调试选项
   *
   * 创建 DebugOptions 的深度克隆，特别处理 panel 对象
   *
   * @param options - 要克隆的调试选项
   * @returns 调试选项的深度克隆
   * @private
   *
   * @example
   * ```typescript
   * // 内部调用示例
   * const clone = this.cloneDebugOptions({
   *   enabled: true,
   *   panel: { position: 'bottom', width: 300 }
   * });
   * ```
   */
  private cloneDebugOptions(options: DebugOptions): DebugOptions {
    const clone: DebugOptions = { ...options };
    if (options.panel) {
      clone.panel = { ...options.panel };
    } else {
      delete (clone as { panel?: DebugOptions["panel"] }).panel;
    }
    return clone;
  }
}
