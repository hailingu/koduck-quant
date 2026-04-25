import { EntityEventManager } from "../../event/entity-event-manager";
import type { IEntity } from "../types";
import type { EntityUpdateDetail } from "../update-detail";

/**
 * @module src/common/entity/entity-manager/events
 * @description Entity event dispatcher that delegates to EntityEventManager.
 * Provides a simple facade for firing entity lifecycle events (add, remove, update)
 */

/**
 * Dispatcher for entity lifecycle events
 * @class
 * @description Wraps EntityEventManager to provide a clean API for entity operations.
 * Handles add, remove, and update events with optional update details.
 */
export class EntityEventDispatcher {
  private readonly eventManager: EntityEventManager<IEntity>;

  /**
   * Create a new EntityEventDispatcher instance
   * @param {EntityEventManager<IEntity>} [eventManager] - Optional pre-existing event manager.
   * If not provided, creates a new EntityEventManager internally
   */
  constructor(eventManager?: EntityEventManager<IEntity>) {
    this.eventManager = eventManager ?? new EntityEventManager<IEntity>();
  }

  /**
   * Get the underlying event manager instance
   * @returns {EntityEventManager<IEntity>} The event manager used by this dispatcher
   */
  get events(): EntityEventManager<IEntity> {
    return this.eventManager;
  }

  /**
   * Fire an entity add event
   * @param {IEntity} entity - The entity that was added
   * @throws May throw if event handlers throw exceptions
   * @example
   * dispatcher.fireAdd(newEntity);
   */
  fireAdd(entity: IEntity): void {
    this.eventManager.fireAdd(entity);
  }

  /**
   * Fire an entity remove event
   * @param {IEntity} entity - The entity that was removed
   * @throws May throw if event handlers throw exceptions
   * @example
   * dispatcher.fireRemove(removedEntity);
   */
  fireRemove(entity: IEntity): void {
    this.eventManager.fireRemove(entity);
  }

  /**
   * Fire an entity update event without detailed information
   * @param {IEntity} entity - The entity that was updated
   * @throws May throw if event handlers throw exceptions
   * @example
   * dispatcher.fireUpdate(updatedEntity);
   */
  fireUpdate(entity: IEntity): void {
    this.eventManager.fireUpdate(entity);
  }

  /**
   * Fire an entity update event with detailed change information
   * @param {IEntity} entity - The entity that was updated
   * @param {EntityUpdateDetail} detail - Details about what changed in the entity,
   * can include changed fields, old values, new values, etc.
   * @throws May throw if event handlers throw exceptions
   * @example
   * dispatcher.fireUpdateWithDetail(updatedEntity, {
   *   changedFields: ['name', 'status'],
   *   timestamp: Date.now()
   * });
   */
  fireUpdateWithDetail(entity: IEntity, detail: EntityUpdateDetail): void {
    this.eventManager.fireUpdateWithDetail(entity, detail);
  }

  /**
   * Dispose of resources and clean up event listeners
   * @example
   * dispatcher.dispose(); // Called during shutdown
   */
  dispose(): void {
    this.eventManager.dispose();
  }
}
