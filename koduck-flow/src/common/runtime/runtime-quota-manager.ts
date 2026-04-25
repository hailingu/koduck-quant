/**
 * @module src/common/runtime/runtime-quota-manager
 * @description Manages tenant resource quotas including allocation, deallocation, and usage tracking.
 * Tracks quota usage across named buckets and provides snapshot reporting for monitoring.
 * Supports custom quota types with built-in entity quota management.
 * @example
 * ```typescript
 * const manager = new RuntimeQuotaManager(
 *   () => tenantContext,
 *   () => entityCount
 * );
 * if (manager.claimQuota('api-calls', 1)) {
 *   // Execute quota-gated operation
 * }
 * const usage = manager.getQuotaSnapshot('api-calls');
 * ```
 */

import { logger } from "../logger";
import type { ResolvedTenantContext, TenantQuotaSnapshot } from "./tenant-context";
import { TENANT_ENTITY_QUOTA_KEY } from "./types";

/**
 * RuntimeQuotaManager
 *
 * 负责管理租户配额（Tenant Quota）的申请、释放和跟踪。
 *
 * **核心职责**:
 * - 管理租户配额的申请与释放（支持自定义配额桶）
 * - 跟踪配额使用情况（实体配额专用管理）
 * - 生成配额快照（用于监控和报告）
 * - 处理配额限制检查（防止超额使用）
 *
 * **设计原则**:
 * - 使用 Provider 函数注入依赖，避免循环依赖
 * - 通过 Map 跟踪各配额桶的使用量
 * - 特殊处理实体配额（TENANT_ENTITY_QUOTA_KEY）
 * - 配额超限时记录警告日志但不抛出异常
 *
 * @example
 * ```typescript
 * const quotaManager = new RuntimeQuotaManager(
 *   () => runtime.getTenantContext() ?? null,
 *   () => entityManager.getEntities().length
 * );
 *
 * // 申请配额
 * if (quotaManager.claimQuota("api-calls", 1)) {
 *   // 执行需要配额的操作
 * }
 *
 * // 释放配额
 * quotaManager.releaseQuota("api-calls", 1);
 *
 * // 查询配额快照
 * const snapshot = quotaManager.getQuotaSnapshot("api-calls");
 * console.log(`使用: ${snapshot?.usage}, 限制: ${snapshot?.limit}`);
 * ```
 *
 * @since 2.1.0
 */
export class RuntimeQuotaManager {
  /**
   * 租户配额使用量跟踪表
   * - Key: 配额桶名称（如 "api-calls", "storage", TENANT_ENTITY_QUOTA_KEY）
   * - Value: 当前使用量
   */
  private readonly tenantQuotaUsage = new Map<string, number>();

  /**
   * 租户上下文提供函数
   * 通过 Provider 模式避免循环依赖
   */
  private readonly tenantContextProvider: () => ResolvedTenantContext | null;

  /**
   * 实体数量提供函数
   * 用于同步实体配额使用情况
   */
  private readonly entityCountProvider: () => number;

  /**
   * 创建配额管理器实例
   *
   * @param tenantContextProvider - 租户上下文提供函数，返回当前租户上下文或 null
   * @param entityCountProvider - 实体数量提供函数，返回当前实体总数
   *
   * @example
   * ```typescript
   * const quotaManager = new RuntimeQuotaManager(
   *   () => runtime.getTenantContext() ?? null,
   *   () => entityManager.getEntities().length
   * );
   * ```
   */
  constructor(
    tenantContextProvider: () => ResolvedTenantContext | null,
    entityCountProvider: () => number
  ) {
    this.tenantContextProvider = tenantContextProvider;
    this.entityCountProvider = entityCountProvider;
  }

  /**
   * 申请租户配额
   *
   * 尝试从指定配额桶中申请指定数量的配额。
   * - 如果没有配置租户上下文，则总是返回 true（无限制）
   * - 如果指定配额桶没有设置限制，则总是返回 true
   * - 如果申请后会超过限制，则返回 false 并记录警告日志
   * - 如果申请成功，则更新配额使用量并返回 true
   *
   * **特殊处理**:
   * - 对于实体配额（TENANT_ENTITY_QUOTA_KEY），使用实际实体数量进行检查
   *
   * @param bucket - 配额桶名称（如 "api-calls", "storage", TENANT_ENTITY_QUOTA_KEY）
   * @param amount - 申请的配额数量，默认为 1
   * @returns 申请是否成功（true: 成功, false: 超限）
   *
   * @example
   * ```typescript
   * // 申请 API 调用配额
   * if (quotaManager.claimQuota("api-calls", 1)) {
   *   await callExternalAPI();
   * } else {
   *   throw new Error("API 调用配额已用尽");
   * }
   *
   * // 申请实体配额（创建实体前）
   * if (quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY)) {
   *   const entity = createEntity("MyEntity");
   * }
   * ```
   */
  claimQuota(bucket: string, amount = 1): boolean {
    // 参数校验
    if (!bucket || amount <= 0) {
      return true;
    }

    const tenantContext = this.tenantContextProvider();
    if (!tenantContext) {
      return true; // 无租户上下文，不限制
    }

    // 实体配额特殊处理
    if (bucket === TENANT_ENTITY_QUOTA_KEY) {
      return this.ensureEntityQuotaAvailable();
    }

    // 获取配额限制
    const limit = this.getQuotaLimit(bucket);
    const current = this.tenantQuotaUsage.get(bucket) ?? 0;
    const next = current + amount;

    // 检查是否超限
    if (limit !== undefined && next > limit) {
      logger.warn("DuckFlowRuntime tenant quota exceeded", {
        tenantId: tenantContext.tenantId,
        bucket,
        limit,
        attempted: next,
      });
      return false;
    }

    // 更新配额使用量
    this.tenantQuotaUsage.set(bucket, next);
    return true;
  }

  /**
   * 释放租户配额
   *
   * 从指定配额桶中释放指定数量的配额。
   * - 如果配额桶不存在或使用量为 0，则直接返回 0
   * - 释放后使用量不会低于 0
   * - 如果释放后使用量为 0，则从跟踪表中删除该配额桶
   *
   * **特殊处理**:
   * - 对于实体配额（TENANT_ENTITY_QUOTA_KEY），自动同步实际实体数量
   *
   * @param bucket - 配额桶名称
   * @param amount - 释放的配额数量，默认为 1
   * @returns 释放后的剩余使用量
   *
   * @example
   * ```typescript
   * // 释放 API 调用配额
   * const remaining = quotaManager.releaseQuota("api-calls", 1);
   * console.log(`剩余配额使用量: ${remaining}`);
   *
   * // 释放实体配额（删除实体后）
   * quotaManager.releaseQuota(TENANT_ENTITY_QUOTA_KEY);
   * ```
   */
  releaseQuota(bucket: string, amount = 1): number {
    // 参数校验
    if (!bucket || amount <= 0) {
      return this.tenantQuotaUsage.get(bucket) ?? 0;
    }

    // 实体配额特殊处理：同步实际数量
    if (bucket === TENANT_ENTITY_QUOTA_KEY) {
      this.syncEntityQuotaUsage();
      return this.tenantQuotaUsage.get(bucket) ?? 0;
    }

    const current = this.tenantQuotaUsage.get(bucket) ?? 0;
    if (current === 0) {
      return 0;
    }

    // 计算释放后的使用量（不低于 0）
    const next = Math.max(current - amount, 0);
    if (next === 0) {
      this.tenantQuotaUsage.delete(bucket);
    } else {
      this.tenantQuotaUsage.set(bucket, next);
    }

    return next;
  }

  /**
   * 获取指定配额桶的快照
   *
   * 返回配额桶的当前使用情况，包括使用量、限制和剩余量。
   * - 如果没有配置租户上下文，则返回 undefined
   * - 如果配额桶没有设置限制，则只返回使用量
   *
   * @param bucket - 配额桶名称
   * @returns 配额快照对象，或 undefined（无租户上下文时）
   *
   * @example
   * ```typescript
   * const snapshot = quotaManager.getQuotaSnapshot("api-calls");
   * if (snapshot) {
   *   console.log(`配额桶: ${snapshot.key}`);
   *   console.log(`使用量: ${snapshot.usage}`);
   *   console.log(`限制: ${snapshot.limit}`);
   *   console.log(`剩余: ${snapshot.remaining}`);
   * }
   * ```
   */
  getQuotaSnapshot(bucket: string): TenantQuotaSnapshot | undefined {
    const tenantContext = this.tenantContextProvider();
    if (!tenantContext) {
      return undefined;
    }

    const usage = this.tenantQuotaUsage.get(bucket) ?? 0;
    const limit = this.getQuotaLimit(bucket);

    const snapshot: TenantQuotaSnapshot = {
      key: bucket,
      usage,
    };

    if (limit !== undefined) {
      snapshot.limit = limit;
      snapshot.remaining = Math.max(limit - usage, 0);
    }

    return snapshot;
  }

  /**
   * 列出所有配额桶的快照
   *
   * 返回所有已配置或已使用的配额桶的快照列表。
   * - 包括已使用的配额桶（tenantQuotaUsage）
   * - 包括已配置但未使用的配额桶（来自租户上下文）
   * - 如果没有配置租户上下文，则返回空数组
   *
   * @returns 配额快照数组
   *
   * @example
   * ```typescript
   * const snapshots = quotaManager.listQuotaSnapshots();
   * for (const snapshot of snapshots) {
   *   console.log(`${snapshot.key}: ${snapshot.usage}/${snapshot.limit ?? "无限制"}`);
   * }
   * ```
   */
  listQuotaSnapshots(): TenantQuotaSnapshot[] {
    const tenantContext = this.tenantContextProvider();
    if (!tenantContext) {
      return [];
    }

    // 收集所有配额桶键
    const keys = new Set<string>(this.tenantQuotaUsage.keys());

    // 添加已配置的实体配额
    const quotas = tenantContext.quotas;
    if (quotas?.maxEntities !== undefined) {
      keys.add(TENANT_ENTITY_QUOTA_KEY);
    }

    // 添加自定义配额桶
    if (quotas?.custom) {
      for (const key of Object.keys(quotas.custom)) {
        keys.add(key);
      }
    }

    // 生成快照列表
    const snapshots: TenantQuotaSnapshot[] = [];
    for (const key of keys) {
      const snapshot = this.getQuotaSnapshot(key);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }

    return snapshots;
  }

  /**
   * 确保实体配额可用
   *
   * 检查当前实体数量是否已达到租户的实体配额限制。
   * - 如果没有配置实体配额限制（maxEntities），则总是返回 true
   * - 如果当前实体数量 >= 限制，则返回 false 并记录警告日志
   * - 否则返回 true
   *
   * **注意**: 此方法不更新配额使用量，仅做检查
   *
   * @returns 是否可以创建新实体（true: 可以, false: 已达限制）
   *
   * @example
   * ```typescript
   * if (quotaManager.ensureEntityQuotaAvailable()) {
   *   const entity = entityManager.createEntity("MyEntity");
   * } else {
   *   throw new Error("实体配额已用尽");
   * }
   * ```
   */
  ensureEntityQuotaAvailable(): boolean {
    const tenantContext = this.tenantContextProvider();
    const limit = tenantContext?.quotas?.maxEntities;

    if (limit === undefined) {
      return true; // 无限制
    }

    const current = this.entityCountProvider();
    if (current >= limit) {
      logger.warn("DuckFlowRuntime tenant entity quota exceeded", {
        tenantId: tenantContext?.tenantId,
        limit,
        current,
      });
      return false;
    }

    return true;
  }

  /**
   * 同步实体配额使用情况
   *
   * 将实体配额桶（TENANT_ENTITY_QUOTA_KEY）的使用量更新为当前实际实体数量。
   * - 如果没有配置实体配额限制（maxEntities），则从跟踪表中删除实体配额桶
   * - 否则更新为实际实体数量
   *
   * **使用场景**:
   * - 设置或清除租户上下文时
   * - 创建或删除实体后
   * - 释放实体配额时
   *
   * @example
   * ```typescript
   * // 删除实体后同步
   * entityManager.removeEntity(entityId);
   * quotaManager.syncEntityQuotaUsage();
   *
   * // 设置租户上下文后同步
   * runtime.setTenantContext(context);
   * quotaManager.syncEntityQuotaUsage();
   * ```
   */
  syncEntityQuotaUsage(): void {
    const tenantContext = this.tenantContextProvider();
    const limit = tenantContext?.quotas?.maxEntities;

    if (limit === undefined) {
      this.tenantQuotaUsage.delete(TENANT_ENTITY_QUOTA_KEY);
      return;
    }

    const count = this.entityCountProvider();
    this.tenantQuotaUsage.set(TENANT_ENTITY_QUOTA_KEY, count);
  }

  /**
   * 清空所有配额使用量
   *
   * 清空配额跟踪表，重置所有配额桶的使用量为 0。
   *
   * **使用场景**:
   * - 清除租户上下文时（setTenantContext(null)）
   * - 租户切换时
   *
   * @internal
   */
  clear(): void {
    this.tenantQuotaUsage.clear();
  }

  /**
   * 获取指定配额桶的限制值
   *
   * @param bucket - 配额桶名称
   * @returns 配额限制值，或 undefined（无限制或未配置租户上下文）
   *
   * @internal
   */
  private getQuotaLimit(bucket: string): number | undefined {
    const tenantContext = this.tenantContextProvider();
    if (!tenantContext?.quotas) {
      return undefined;
    }

    if (bucket === TENANT_ENTITY_QUOTA_KEY) {
      return tenantContext.quotas.maxEntities;
    }

    return tenantContext.quotas.custom?.[bucket];
  }
}
