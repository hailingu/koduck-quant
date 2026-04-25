import type { RenderEventManager } from "../../event/render-event-manager";

/**
 * @module src/common/entity/entity-manager/render-hook
 * @description Render lifecycle hook that integrates entity manager with render events.
 * Triggers render updates whenever entities are created, updated, or removed
 */

/**
 * Hook for coordinating entity lifecycle events with render operations
 * @class
 * @description Bridges entity manager operations with the render event system,
 * automatically requesting re-renders when entity state changes
 */
export class EntityRenderHook {
  private readonly renderEvents: RenderEventManager;

  /**
   * Create a new EntityRenderHook instance
   * @param {RenderEventManager} renderEvents - Render event manager for dispatching render requests
   */
  constructor(renderEvents: RenderEventManager) {
    this.renderEvents = renderEvents;
  }

  /**
   * Notify render system that an entity was created
   * @param {string} entityId - ID of the newly created entity
   * @example
   * hook.entityCreated('entity-123');
   */
  entityCreated(entityId: string): void {
    this.requestRender({
      entityIds: [entityId],
      reason: "entity-created",
      op: "render",
    });
  }

  /**
   * Notify render system that an entity was updated
   * @param {string} entityId - ID of the entity that was updated
   * @example
   * hook.entityUpdated('entity-123');
   */
  entityUpdated(entityId: string): void {
    this.requestRender({
      entityIds: [entityId],
      reason: "entity-updated",
      op: "render",
    });
  }

  /**
   * Notify render system that an entity was removed
   * @param {string} entityId - ID of the removed entity
   * @example
   * hook.entityRemoved('entity-123');
   */
  entityRemoved(entityId: string): void {
    this.requestRender({
      entityIds: [entityId],
      reason: "entity-removed",
      op: "remove",
    });
  }

  /**
   * Notify render system that multiple entities were removed
   * @param {string[]} ids - Array of entity IDs that were removed
   * @example
   * hook.entitiesRemoved(['entity-1', 'entity-2', 'entity-3']);
   */
  entitiesRemoved(ids: string[]): void {
    if (ids.length === 0) {
      return;
    }
    this.requestRender({
      entityIds: ids,
      reason: "entities-removed",
      op: "remove",
    });
  }

  /**
   * Request render update with specified entity IDs and operation
   * @private
   * @param {Object} payload - Render request configuration
   * @param {string[]} payload.entityIds - Array of entity IDs affected
   * @param {string} payload.reason - Reason for the render request
   * (entity-created, entity-updated, entity-removed, entities-removed)
   * @param {string} payload.op - Operation type: 'render' for display or 'remove' for cleanup
   */
  private requestRender(payload: {
    entityIds: string[];
    reason: string;
    op: "render" | "remove";
  }): void {
    try {
      this.renderEvents.requestRenderEntities(payload);
    } catch {
      // Swallow render hook errors to keep entity operations resilient.
    }
  }
}
