/**
 * Flow Entity Event System
 *
 * Handles entity lifecycle events, including add, remove, update, and other operations.
 * All entity events inherit from BaseEvent, benefiting from batching and performance optimizations.
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
 * Entity event type constants
 */
export const EntityEventType = {
  ADD: "EntityAdd",
  REMOVE: "EntityRemove",
  UPDATE: "EntityUpdate",
} as const;

export type EntityEventTypeValue =
  (typeof EntityEventType)[keyof typeof EntityEventType];

/**
 * Generic entity event class
 *
 * Uses generic factory pattern to replace repetitive entity event class implementations, reducing code redundancy.
 * Supports all entity lifecycle event types: add, remove, update.
 *
 * @template T - Entity data type
 * @since 1.0.0
 */
export class EntityEvent<T = unknown> extends BaseEvent<T> {
  constructor(eventType: EntityEventTypeValue) {
    super(eventType);
  }
}

/** Entity add event class */
export class EntityAddEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.ADD);
  }

  /** Fire entity added event */
  fireEntityAdded(entityData: E): void {
    this.fire(entityData);
  }
}

/** Entity remove event class */
export class EntityRemoveEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.REMOVE);
  }

  /** Fire entity removed event */
  fireEntityRemoved(entityData: E): void {
    this.fire(entityData);
  }
}

/** Entity update event class */
export class EntityUpdateEvent<E = unknown> extends EntityEvent<E> {
  constructor() {
    super(EntityEventType.UPDATE);
  }

  /** Fire entity updated event */
  fireEntityUpdated(entityData: E): void {
    this.fire(entityData);
  }
}
