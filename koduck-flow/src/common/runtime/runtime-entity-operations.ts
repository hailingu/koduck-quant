import type React from "react";

import type { IEntity, IEntityArguments, IRenderableEntity } from "../entity/";
import type { EntityManager } from "../entity/entity-manager";
import type { RenderManager } from "../render/render-manager";
import type { RuntimeQuotaManager } from "./runtime-quota-manager";

/**
 * RuntimeEntityOperations
 *
 * 提供实体和渲染操作的快捷方法，封装实体创建、删除与渲染管理的常用操作。
 *
 * ## 核心职责
 *
 * 1. **实体操作**：
 * - 实体创建（含配额检查）
 * - 实体查询
 * - 实体删除（含配额同步）
 * - 批量删除
 *
 * 2. **渲染操作**：
 * - 添加实体到渲染
 * - 从渲染移除实体
 * - 获取实体渲染元素
 *
 * 3. **配额集成**：
 * - 创建前配额检查
 * - 删除后配额同步
 *
 * ## 使用示例
 *
 * ```typescript
 * const operations = new RuntimeEntityOperations(
 * entityManager,
 * renderManager,
 * quotaManager
 * );
 *
 * // 创建实体（自动配额检查）
 * const entity = operations.createEntity('Rectangle', { width: 100, height: 50 });
 *
 * // 添加到渲染
 * if (entity) {
 * operations.addEntityToRender(entity);
 * }
 *
 * // 删除实体（自动配额同步）
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
   * 创建实体操作管理器
   *
   * @param entityManager - 实体管理器实例
   * @param renderManager - 渲染管理器实例
   * @param quotaManager - 配额管理器实例
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
   * 创建实体
   *
   * 在创建前检查实体配额，创建成功后同步配额使用情况。
   *
   * @param typeName - 实体类型名称
   * @param args - 实体初始化参数
   * @returns 创建的实体实例，如果配额不足则返回 null
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
   * 获取实体
   *
   * @param id - 实体 ID
   * @returns 实体实例，如果不存在则返回 undefined
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
   * 删除实体
   *
   * 删除成功后同步配额使用情况。
   *
   * @param id - 实体 ID
   * @returns 是否删除成功
   *
   * @example
   * ```typescript
   * const removed = operations.removeEntity('entity-123');
   * console.log(removed ? '删除成功' : '实体不存在');
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
   * 检查实体是否存在
   *
   * @param id - 实体 ID
   * @returns 实体是否存在
   *
   * @example
   * ```typescript
   * if (operations.hasEntity('entity-123')) {
   *   console.log('实体存在');
   * }
   * ```
   */
  hasEntity(id: string): boolean {
    return this.entityManager.hasEntity(id);
  }

  /**
   * 获取所有实体
   *
   * @returns 所有实体的数组
   *
   * @example
   * ```typescript
   * const allEntities = operations.getEntities();
   * console.log(`共有 ${allEntities.length} 个实体`);
   * ```
   */
  getEntities(): IEntity[] {
    return this.entityManager.getEntities();
  }

  /**
   * 批量删除实体
   *
   * 删除成功后同步配额使用情况。
   *
   * @param ids - 实体 ID 数组
   * @returns 实际删除的实体数量
   *
   * @example
   * ```typescript
   * const removed = operations.removeEntities(['entity-1', 'entity-2', 'entity-3']);
   * console.log(`删除了 ${removed} 个实体`);
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
   * 添加实体到渲染
   *
   * @param entity - 要添加到渲染的实体
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
   * 从渲染移除实体
   *
   * @param entityId - 实体 ID
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
   * 获取实体的渲染元素
   *
   * @param entityId - 实体 ID
   * @returns React 元素、字符串、Promise 或 null/void
   *
   * @example
   * ```typescript
   * const element = operations.getEntityRenderElement('entity-123');
   * if (element) {
   *   // 渲染元素...
   * }
   * ```
   */
  getEntityRenderElement(
    entityId: string
  ): React.ReactElement | string | Promise<string> | null | void {
    return this.renderManager.render(entityId);
  }
}
