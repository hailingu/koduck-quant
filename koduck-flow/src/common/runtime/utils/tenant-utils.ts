/**
 * 租户上下文工具函数
 * @module runtime/utils/tenant-utils
 */

import type {
  ResolvedTenantContext,
  TenantResourceQuota,
  TenantRolloutConfig,
} from "../tenant-context";

/**
 * 克隆租户资源配额对象
 *
 * @param quotas - 原始配额对象
 * @returns 克隆后的配额对象，如果输入为空则返回 undefined
 */
export function cloneTenantResourceQuotas(
  quotas?: TenantResourceQuota
): TenantResourceQuota | undefined {
  if (!quotas) {
    return undefined;
  }
  const cloned: TenantResourceQuota = { ...quotas };
  if (quotas.custom) {
    cloned.custom = { ...quotas.custom };
  }
  return cloned;
}

/**
 * 深度克隆租户上下文对象
 *
 * 该函数会克隆所有嵌套对象，包括：
 * - environmentKey
 * - quotas（包括 custom 字段）
 * - metadata
 * - rollout（包括 features 字段）
 *
 * @param context - 原始租户上下文
 * @returns 克隆后的租户上下文，如果输入为空则返回 undefined
 *
 * @example
 * ```typescript
 * const original: ResolvedTenantContext = {
 *   tenantId: 'tenant-1',
 *   environment: 'production',
 *   environmentKey: { region: 'us-east-1' },
 *   normalizedEnvironmentKey: 'production_us-east-1',
 * };
 *
 * const cloned = cloneTenantContext(original);
 * cloned.environmentKey.region = 'us-west-1'; // 不会影响原始对象
 * ```
 */
export function cloneTenantContext(
  context?: ResolvedTenantContext
): ResolvedTenantContext | undefined {
  if (!context) {
    return undefined;
  }

  const clone: ResolvedTenantContext = {
    tenantId: context.tenantId,
    environment: context.environment,
    environmentKey: { ...context.environmentKey },
    normalizedEnvironmentKey: context.normalizedEnvironmentKey,
  };

  if (context.displayName !== undefined) {
    clone.displayName = context.displayName;
  }

  const quotas = cloneTenantResourceQuotas(context.quotas);
  if (quotas) {
    clone.quotas = quotas;
  }

  if (context.metadata) {
    clone.metadata = { ...context.metadata };
  }

  const rollout = context.rollout;
  if (rollout) {
    const { features, ...rest } = rollout;
    const clonedRollout: TenantRolloutConfig = { ...rest };
    if (features) {
      clonedRollout.features = { ...features };
    }
    clone.rollout = clonedRollout;
  }

  return clone;
}
