/**
 * Tenant context utility functions
 * @module runtime/utils/tenant-utils
 */

import type {
  ResolvedTenantContext,
  TenantResourceQuota,
  TenantRolloutConfig,
} from "../tenant-context";

/**
 * Clone tenant resource quotas object
 *
 * @param quotas - Original quotas object
 * @returns Cloned quotas object, or undefined if input is empty
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
 * Deep clone tenant context object
 *
 * This function clones all nested objects, including:
 * - environmentKey
 * - quotas (including custom field)
 * - metadata
 * - rollout (including features field)
 *
 * @param context - Original tenant context
 * @returns Cloned tenant context, or undefined if input is empty
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
 * cloned.environmentKey.region = 'us-west-1'; // will not affect the original object
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
