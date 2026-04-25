/**
 * RuntimeTenantContext - 租户上下文管理器
 *
 * @description
 * 负责管理多租户环境下的租户上下文(Tenant Context)，提供以下核心功能：
 * 1. 租户上下文的设置与获取
 * 2. 租户上下文的深拷贝（防止外部修改）
 * 3. 租户配置同步到 DI 容器（tenantContext, tenantQuota, tenantRollout）
 * 4. 租户上下文的清空与重置
 *
 * @responsibilities
 * - 管理租户上下文的生命周期
 * - 确保租户数据的隔离性（通过深拷贝）
 * - 同步租户配置到依赖注入容器
 * - 提供租户上下文的查询接口
 *
 * @example
 * ```typescript
 * const tenantContext = new RuntimeTenantContext(container);
 *
 * // 设置租户上下文
 * tenantContext.setTenantContext({
 *   tenantId: 'tenant-123',
 *   environment: 'production',
 *   quotas: { maxEntities: 1000 },
 *   rollout: { percentage: 50, variant: 'beta' }
 * });
 *
 * // 获取租户上下文（返回深拷贝）
 * const context = tenantContext.getTenantContext();
 *
 * // 检查是否存在租户上下文
 * if (tenantContext.hasTenantContext()) {
 *   console.log('Tenant context is set');
 * }
 *
 * // 清空租户上下文
 * tenantContext.setTenantContext(null);
 * ```
 *
 * @module RuntimeTenantContext
 * @since v2.1.0
 */

import type { IDependencyContainer } from "../di/types";
import type { ResolvedTenantContext } from "./tenant-context";
import { TOKENS } from "../di/tokens";
import { cloneTenantContext } from "./utils/tenant-utils";
import { logger } from "../logger";

/**
 * RuntimeTenantContext 类
 *
 * @description
 * 管理租户上下文的设置、获取、同步和清空。
 * 使用深拷贝策略确保租户数据的隔离性，防止外部代码意外修改内部状态。
 *
 * @class
 */
export class RuntimeTenantContext {
  /**
   * 当前租户上下文（内部状态）
   * @private
   */
  private tenantContext: ResolvedTenantContext | null = null;

  /**
   * DI 容器引用，用于同步租户配置
   * @private
   * @readonly
   */
  private readonly container: IDependencyContainer;

  /**
   * 创建 RuntimeTenantContext 实例
   *
   * @param container - 依赖注入容器
   * @throws {Error} 如果 container 为 null 或 undefined
   */
  constructor(container: IDependencyContainer) {
    if (!container) {
      throw new Error("Container cannot be null or undefined");
    }
    this.container = container;
  }

  /**
   * 设置租户上下文
   *
   * @description
   * 设置或清空租户上下文。如果传入 null 或 undefined，则清空当前上下文。
   * 如果传入有效上下文，则进行深拷贝并同步到 DI 容器。
   *
   * @param context - 要设置的租户上下文，null 表示清空
   *
   * @example
   * ```typescript
   * // 设置租户上下文
   * tenantContext.setTenantContext({
   *   tenantId: 'tenant-123',
   *   environment: 'production'
   * });
   *
   * // 清空租户上下文
   * tenantContext.setTenantContext(null);
   * ```
   */
  setTenantContext(context?: ResolvedTenantContext | null): void {
    // 如果传入 null 或 undefined，清空上下文
    if (!context) {
      this.tenantContext = null;
      this.clearContainer();
      return;
    }

    // 深拷贝租户上下文，确保数据隔离
    const snapshot = cloneTenantContext(context);
    if (!snapshot) {
      // 如果克隆失败（例如 context 为空对象），不做任何操作
      return;
    }

    // 更新内部状态
    this.tenantContext = snapshot;

    // 同步到 DI 容器
    this.syncToContainer(snapshot);

    // 记录日志
    logger.info("DuckFlowRuntime attached tenant context", {
      tenantId: snapshot.tenantId,
      environment: snapshot.environment,
      normalizedEnvironmentKey: snapshot.normalizedEnvironmentKey,
    });
  }

  /**
   * 获取租户上下文
   *
   * @description
   * 返回租户上下文的深拷贝，防止外部代码修改内部状态。
   * 如果租户上下文不存在，返回 undefined。
   *
   * @returns 租户上下文的深拷贝，如果不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const context = tenantContext.getTenantContext();
   * if (context) {
   *   console.log(`Tenant ID: ${context.tenantId}`);
   * }
   * ```
   */
  getTenantContext(): ResolvedTenantContext | undefined {
    return cloneTenantContext(this.tenantContext ?? undefined);
  }

  /**
   * 检查是否存在租户上下文
   *
   * @description
   * 快速检查当前是否设置了租户上下文，比调用 getTenantContext() 更高效。
   *
   * @returns 如果存在租户上下文返回 true，否则返回 false
   *
   * @example
   * ```typescript
   * if (tenantContext.hasTenantContext()) {
   *   // 执行租户相关操作
   * }
   * ```
   */
  hasTenantContext(): boolean {
    return this.tenantContext !== null;
  }

  /**
   * 同步租户上下文到 DI 容器
   *
   * @description
   * 将租户上下文及其子配置（quotas, rollout）注册到 DI 容器，
   * 使得其他模块可以通过依赖注入获取租户信息。
   *
   * @param snapshot - 要同步的租户上下文快照
   * @private
   */
  private syncToContainer(snapshot: ResolvedTenantContext): void {
    // 注册完整的租户上下文
    this.container.registerInstance(TOKENS.tenantContext, snapshot, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });

    // 注册租户配额配置（如果存在）
    this.container.registerInstance(TOKENS.tenantQuota, snapshot.quotas ?? null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });

    // 注册租户 Rollout 配置（如果存在）
    this.container.registerInstance(TOKENS.tenantRollout, snapshot.rollout ?? null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });
  }

  /**
   * 清空 DI 容器中的租户配置
   *
   * @description
   * 将 DI 容器中的租户相关 token 设置为 null，
   * 确保依赖注入的模块不会获取到过期的租户信息。
   *
   * @private
   */
  private clearContainer(): void {
    this.container.registerInstance(TOKENS.tenantContext, null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });
    this.container.registerInstance(TOKENS.tenantQuota, null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });
    this.container.registerInstance(TOKENS.tenantRollout, null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });
  }
}
