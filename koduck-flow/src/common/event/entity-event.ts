/**
 * Flow 实体事件系统
 *
 * 专门处理实体生命周期相关的事件，包括添加、移除、更新等操作。
 * 所有实体事件都继承自 BaseEvent，享受批处理和性能优化特性。
 *
 * @example
 * ```typescript
 * const addEvent = new EntityAddEvent<Entity>();
 * addEvent.addEventListener((entity) => console.log("Entity added:", entity));
 * addEvent.fire(newEntity);
 * ```
 */

import { BaseEvent } from "./event";

/**
 * 实体事件类型常量
 */
export const EntityEventType = {
  ADD: "EntityAdd",
  REMOVE: "EntityRemove",
  UPDATE: "EntityUpdate",
} as const;

export type EntityEventTypeValue =
  (typeof EntityEventType)[keyof typeof EntityEventType];

/**
 * 通用实体事件类
 *
 * 使用泛型工厂模式替代重复的实体事件类实现，减少代码冗余。
 * 支持所有实体生命周期事件类型：添加、移除、更新。
 *
 * @template T - 实体数据类型
 * @since 1.0.0
 */
export class EntityEvent<T = unknown> extends BaseEvent<T> {
  constructor(eventType: EntityEventTypeValue) {
    super(eventType);
  }
}

/** 实体添加事件类 */
export class EntityAddEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.ADD);
  }

  /** 触发实体添加事件 */
  fireEntityAdded(entityData: E): void {
    this.fire(entityData);
  }
}

/** 实体移除事件类 */
export class EntityRemoveEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.REMOVE);
  }

  /** 触发实体移除事件 */
  fireEntityRemoved(entityData: E): void {
    this.fire(entityData);
  }
}

/** 实体更新事件类 */
export class EntityUpdateEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.UPDATE);
  }

  /** 触发实体更新事件 */
  fireEntityUpdated(entityData: E): void {
    this.fire(entityData);
  }
}
