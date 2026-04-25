/**
 * Duck Flow 实体事件管理器
 *
 * 专门管理实体生命周期相关的事件，包括添加、移除、更新等操作。
 * 继承自 EventManager 基类，可按需实例化或复用默认实例。
 *
 * @example
 * ```typescript
 * const manager = new EntityEventManager<Entity>();
 * manager.onAdd((entity) => console.log("Entity added:", entity));
 * manager.fireAdd(newEntity);
 * ```
 */

import { type IEventListener } from "./event";
import { EventManager } from "./event-manager";
import { GenericEvent } from "./generic-event";
import type { EntityUpdateDetail } from "../entity/update-detail";

/**
 * 实体事件管理器
 *
 * 面向实体生命周期事件的专用管理器。
 * 继承自 EventManager 基类，重写基类方法来处理具体的实体事件。
 *
 * @template T 实体数据类型
 * @since 1.0.0
 */
export class EntityEventManager<T = unknown> extends EventManager<T> {
  /**
   * 附加的“更新详情”事件通道：不破坏现有 onUpdate 签名的前提下，
   * 提供更新类型/脏区等细节，供渲染/监听方选择性订阅。
   */
  public readonly updatedWithDetail = new GenericEvent<{
    entity: T;
    detail?: EntityUpdateDetail;
  }>("EntityUpdateWithDetail");

  constructor() {
    super();
  }

  // ===== 实体事件特有的方法 =====

  /**
   * 链式注册生命周期监听器
   * @param handlers - 生命周期事件处理器对象
   * @returns this 支持链式调用
   */
  registerLifecycle(handlers: {
    onAdded?: IEventListener<T>;
    onRemoved?: IEventListener<T>;
    onUpdated?: IEventListener<T>;
  }): this {
    if (handlers.onAdded) this.added.addEventListener(handlers.onAdded);
    if (handlers.onRemoved) this.removed.addEventListener(handlers.onRemoved);
    if (handlers.onUpdated) this.updated.addEventListener(handlers.onUpdated);
    return this;
  }

  /**
   * 注册通用生命周期监听器（所有事件都会触发）
   * @param listener - 监听器函数
   * @returns this 支持链式调用
   */
  registerAnyLifecycle(listener: IEventListener<T>): this {
    this.added.addEventListener(listener);
    this.removed.addEventListener(listener);
    this.updated.addEventListener(listener);
    return this;
  }

  /**
   * 快速配置高性能模式（适合高频事件）
   * @returns this 支持链式调用
   */
  setupForPerformance(): this {
    return this.configureAll({
      enableBatching: true,
      batchSize: 100,
      batchInterval: 8,
    });
  }

  /**
   * 快速配置调试模式（适合开发和测试）
   * @returns this 支持链式调用
   */
  setupForDebugging(): this {
    return this.setDebugMode(true).configureAll({
      enableBatching: false,
    });
  }

  // ===== 简洁API设计 =====

  /**
   * 监听实体添加事件 - 简洁API
   * @param listener 监听器函数
   * @returns this 支持链式调用
   */
  onAdd(listener: IEventListener<T>): this {
    this.added.addEventListener(listener);
    return this;
  }

  /**
   * 监听实体移除事件 - 简洁API
   * @param listener 监听器函数
   * @returns this 支持链式调用
   */
  onRemove(listener: IEventListener<T>): this {
    this.removed.addEventListener(listener);
    return this;
  }

  /**
   * 监听实体更新事件 - 简洁API
   * @param listener 监听器函数
   * @returns this 支持链式调用
   */
  onUpdate(listener: IEventListener<T>): this {
    this.updated.addEventListener(listener);
    return this;
  }

  /**
   * 新增：监听带详情的更新事件
   */
  onUpdateDetail(listener: (payload: { entity: T; detail?: EntityUpdateDetail }) => void): this {
    this.updatedWithDetail.addEventListener(listener);
    return this;
  }

  /**
   * 触发添加事件 - 简洁API
   * @param data 事件数据
   * @returns this 支持链式调用
   */
  fireAdd(data: T): this {
    this.added.fire(data);
    return this;
  }

  /**
   * 触发移除事件 - 简洁API
   * @param data 事件数据
   * @returns this 支持链式调用
   */
  fireRemove(data: T): this {
    this.removed.fire(data);
    return this;
  }

  /**
   * 触发更新事件 - 简洁API
   * @param data 事件数据
   * @returns this 支持链式调用
   */
  fireUpdate(data: T): this {
    this.updated.fire(data);
    return this;
  }

  /**
   * 新增：触发带详情的更新事件（同步触发 updated 以保持兼容）
   */
  fireUpdateWithDetail(entity: T, detail?: EntityUpdateDetail): this {
    this.updated.fire(entity);
    const payload = detail === undefined ? { entity } : { entity, detail };
    this.updatedWithDetail.fire(payload);
    return this;
  }

  /**
   * 监听所有类型的事件
   * @param listener 监听器函数
   * @returns this 支持链式调用
   */
  onAny(listener: IEventListener<T>): this {
    this.onAdd(listener).onRemove(listener).onUpdate(listener);
    return this;
  }

  /**
   * 批量触发事件
   * @param type 事件类型
   * @param dataArray 事件数据数组
   * @returns this 支持链式调用
   */
  fireBatch(type: "add" | "remove" | "update", dataArray: T[]): this {
    const eventMap = {
      add: this.added,
      remove: this.removed,
      update: this.updated,
    };

    const targetEvent = eventMap[type];
    dataArray.forEach((data) => targetEvent.fire(data));
    return this;
  }

  /**
   * 桥接所有事件到另一个实体事件管理器
   * @param target 目标实体事件管理器
   * @returns this 支持链式调用
   */
  bridgeAllTo(target: EntityEventManager<T>): this {
    this.onAdd((data) => target.fireAdd(data))
      .onRemove((data) => target.fireRemove(data))
      .onUpdate((data) => target.fireUpdate(data));
    return this;
  }
}

export function createEntityEventManager<T = unknown>(): EntityEventManager<T> {
  return new EntityEventManager<T>();
}
