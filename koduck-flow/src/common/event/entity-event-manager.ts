/**
 * Koduck Flow entity event manager
 *
 * Manages entity lifecycle-related events, including add, remove, update, and other operations.
 * Inherits from EventManager base class, can be instantiated on demand or reuse the default instance.
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
 * Entity event manager
 *
 * Dedicated manager for entity lifecycle events.
 * Inherits from EventManager base class, overrides base methods to handle specific entity events.
 *
 * @template T Entity data type
 * @since 1.0.0
 */
export class EntityEventManager<T = unknown> extends EventManager<T> {
  /**
   * Additional "update detail" event channel: without breaking the existing onUpdate signature,
   * provides details like update type/dirty region for rendering/listeners to subscribe selectively.
   */
  public readonly updatedWithDetail = new GenericEvent<{
    entity: T;
    detail?: EntityUpdateDetail;
  }>("EntityUpdateWithDetail");

  constructor() {
    super();
  }

  // ===== Entity event-specific methods =====

  /**
   * Chain-register lifecycle listeners
   * @param handlers - Lifecycle event handler object
   * @returns this Supports chaining
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
   * Register generic lifecycle listener (triggers on all events)
   * @param listener - Listener function
   * @returns this Supports chaining
   */
  registerAnyLifecycle(listener: IEventListener<T>): this {
    this.added.addEventListener(listener);
    this.removed.addEventListener(listener);
    this.updated.addEventListener(listener);
    return this;
  }

  /**
   * Quick setup for high-performance mode (suitable for high-frequency events)
   * @returns this Supports chaining
   */
  setupForPerformance(): this {
    return this.configureAll({
      enableBatching: true,
      batchSize: 100,
      batchInterval: 8,
    });
  }

  /**
   * Quick setup for debug mode (suitable for development and testing)
   * @returns this Supports chaining
   */
  setupForDebugging(): this {
    return this.setDebugMode(true).configureAll({
      enableBatching: false,
    });
  }

  // ===== Concise API design =====

  /**
   * Listen to entity add event - Concise API
   * @param listener Listener function
   * @returns this Supports chaining
   */
  onAdd(listener: IEventListener<T>): this {
    this.added.addEventListener(listener);
    return this;
  }

  /**
   * Listen to entity remove event - Concise API
   * @param listener Listener function
   * @returns this Supports chaining
   */
  onRemove(listener: IEventListener<T>): this {
    this.removed.addEventListener(listener);
    return this;
  }

  /**
   * Listen to entity update event - Concise API
   * @param listener Listener function
   * @returns this Supports chaining
   */
  onUpdate(listener: IEventListener<T>): this {
    this.updated.addEventListener(listener);
    return this;
  }

  /**
   * New: listen to update event with details
   */
  onUpdateDetail(listener: (payload: { entity: T; detail?: EntityUpdateDetail }) => void): this {
    this.updatedWithDetail.addEventListener(listener);
    return this;
  }

  /**
   * Fire add event - Concise API
   * @param data Event data
   * @returns this Supports chaining
   */
  fireAdd(data: T): this {
    this.added.fire(data);
    return this;
  }

  /**
   * Fire remove event - Concise API
   * @param data Event data
   * @returns this Supports chaining
   */
  fireRemove(data: T): this {
    this.removed.fire(data);
    return this;
  }

  /**
   * Fire update event - Concise API
   * @param data Event data
   * @returns this Supports chaining
   */
  fireUpdate(data: T): this {
    this.updated.fire(data);
    return this;
  }

  /**
   * New: fire update event with details (fires updated synchronously for compatibility)
   */
  fireUpdateWithDetail(entity: T, detail?: EntityUpdateDetail): this {
    this.updated.fire(entity);
    const payload = detail === undefined ? { entity } : { entity, detail };
    this.updatedWithDetail.fire(payload);
    return this;
  }

  /**
   * Listen to all types of events
   * @param listener Listener function
   * @returns this Supports chaining
   */
  onAny(listener: IEventListener<T>): this {
    this.onAdd(listener).onRemove(listener).onUpdate(listener);
    return this;
  }

  /**
   * Batch fire events
   * @param type Event type
   * @param dataArray Event data array
   * @returns this Supports chaining
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
   * Bridge all events to another entity event manager
   * @param target Target entity event manager
   * @returns this Supports chaining
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
