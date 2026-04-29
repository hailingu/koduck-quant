import type React from "react";

import type { IEntity, IEntityArguments, IRenderableEntity } from "../entity/";
import type { EntityManager } from "../entity/entity-manager";
import type { RenderManager } from "../render/render-manager";
import type { RuntimeQuotaManager } from "./runtime-quota-manager";

/**
 * RuntimeEntityOperations
 *
 * Provides shortcut methods for entity and render operations, encapsulating common operations for entity creation, deletion, and render management.
 *
 * ## Core Responsibilities
 *
 * 1. **Entity Operations**:
 * - Entity creation (with quota check)
 * - Entity querying
 * - Entity deletion (with quota sync)
 * - Batch deletion
 *
 * 2. **Render Operations**:
 * - Add entity to render
 * - Remove entity from render
 * - Get entity render element
 *
 * 3. **Quota Integration**:
 * - Quota check before creation
 * - Quota sync after deletion
 *
 * ## Usage Example
 *
 * ```typescript
 * const operations = new RuntimeEntityOperations(
 * entityManager,
 * renderManager,
 * quotaManager
 * );
 *
 * // Create entity (automatic quota check)
 * const entity = operations.createEntity('Rectangle', { width: 100, height: 50 });
 *
 * // Add to render
 * if (entity) {
 * operations.addEntityToRender(entity);
 * }
 *
 * // Delete entity (automatic quota sync)
 * operations.removeEntity(entity.id);
 * ```
 *
 * @since Phase 3.1
 */
export class RuntimeEntityOperations {
  private readonly entityManager: EntityManager;
  private readonly renderManager: RenderManager;
  private readonly quotaManager: RuntimeQuotaManager;

  /**
   * Create entity operations manager
   *
   * @param entityManager - Entity manager instance
   * @param renderManager - Render manager instance
   * @param quotaManager - Quota manager instance
   */
  constructor(
    entityManager: EntityManager,
    renderManager: RenderManager,
    quotaManager: RuntimeQuotaManager
  ) {
    this.entityManager = entityManager;
    this.renderManager = renderManager;
    this.quotaManager = quotaManager;
  }

  // ==================== Entity Operations ====================

  /**
   * Create entity
   *
   * Check entity quota before creation, sync quota usage after successful creation.
   *
   * @param typeName - Entity type name
   * @param args - Entity initialization arguments
   * @returns Created entity instance, or null if quota is insufficient
   *
   * @example
   * ```typescript
   * const rect = operations.createEntity<Rectangle>('Rectangle', {
   *   width: 100,
   *   height: 50,
   *   fill: '#ff0000'
   * });
   * ```
   */
  createEntity<T extends IEntity = IEntity>(typeName: string, args?: IEntityArguments): T | null {
    // Check quota before creation
    if (!this.quotaManager.ensureEntityQuotaAvailable()) {
      return null;
    }

    const entity = this.entityManager.createEntity<T>(typeName, args);

    // Sync quota usage after successful creation
    if (entity) {
      this.quotaManager.syncEntityQuotaUsage();
    }

    return entity;
  }

  /**
   * Get entity
   *
   * @param id - Entity ID
   * @returns Entity instance, or undefined if not found
   *
   * @example
   * ```typescript
   * const entity = operations.getEntity('entity-123');
   * if (entity) {
   *   console.log(entity.type, entity.id);
   * }
   * ```
   */
  getEntity<T extends IEntity = IEntity>(id: string): T | undefined {
    return this.entityManager.getEntity<T>(id);
  }

  /**
   * Delete entity
   *
   * Sync quota usage after successful deletion.
   *
   * @param id - Entity ID
   * @returns Whether deletion was successful
   *
   * @example
   * ```typescript
   * const removed = operations.removeEntity('entity-123');
   * console.log(removed ? 'Deletion successful' : 'Entity does not exist');
   * ```
   */
  removeEntity(id: string): boolean {
    const removed = this.entityManager.removeEntity(id);

    // Sync quota usage after successful removal
    if (removed) {
      this.quotaManager.syncEntityQuotaUsage();
    }

    return removed;
  }

  /**
   * Check if entity exists
   *
   * @param id - Entity ID
   * @returns Whether entity exists
   *
   * @example
   * ```typescript
   * if (operations.hasEntity('entity-123')) {
   *   console.log('Entity exists');
   * }
   * ```
   */
  hasEntity(id: string): boolean {
    return this.entityManager.hasEntity(id);
  }

  /**
   * Get all entities
   *
   * @returns Array of all entities
   *
   * @example
   * ```typescript
   * const allEntities = operations.getEntities();
   * console.log(`Total ${allEntities.length} entities`);
   * ```
   */
  getEntities(): IEntity[] {
    return this.entityManager.getEntities();
  }

  /**
   * Batch delete entities
   *
   * Sync quota usage after successful deletion.
   *
   * @param ids - Array of entity IDs
   * @returns Number of entities actually deleted
   *
   * @example
   * ```typescript
   * const removed = operations.removeEntities(['entity-1', 'entity-2', 'entity-3']);
   * console.log(`Deleted ${removed} entities`);
   * ```
   */
  removeEntities(ids: string[]): number {
    const removed = this.entityManager.removeEntities(ids);

    // Sync quota usage if any entities were removed
    if (removed > 0) {
      this.quotaManager.syncEntityQuotaUsage();
    }

    return removed;
  }

  // ==================== Render Operations ====================

  /**
   * Add entity to render
   *
   * @param entity - Entity to add to rendering
   *
   * @example
   * ```typescript
   * const entity = operations.createEntity('Rectangle', { width: 100 });
   * if (entity) {
   *   operations.addEntityToRender(entity);
   * }
   * ```
   */
  addEntityToRender(entity: IEntity): void {
    this.renderManager.addEntityToRender(entity as IRenderableEntity);
  }

  /**
   * Remove entity from render
   *
   * @param entityId - Entity ID
   *
   * @example
   * ```typescript
   * operations.removeEntityFromRender('entity-123');
   * ```
   */
  removeEntityFromRender(entityId: string): void {
    this.renderManager.removeEntityFromRender(entityId);
  }

  /**
   * Get entity render element
   *
   * @param entityId - Entity ID
   * @returns React element, string, Promise, or null/void
   *
   * @example
   * ```typescript
   * const element = operations.getEntityRenderElement('entity-123');
   * if (element) {
   *   // Render element...
   * }
   * ```
   */
  getEntityRenderElement(
    entityId: string
  ): React.ReactElement | string | Promise<string> | null | void {
    return this.renderManager.render(entityId);
  }
}
