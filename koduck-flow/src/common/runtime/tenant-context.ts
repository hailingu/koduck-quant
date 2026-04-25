import { normalizeRuntimeKey, type RuntimeEnvironmentKey } from "./runtime-key";

export type TenantResourceQuota = {
  /** Maximum number of live entities that can exist at the same time. */
  maxEntities?: number;
  /** Maximum workflow definitions that can be registered for the tenant. */
  maxWorkflowDefinitions?: number;
  /** Maximum workflow runs that can execute concurrently. */
  maxConcurrentRuns?: number;
  /** Custom quota buckets keyed by domain specific identifiers. */
  custom?: Record<string, number>;
};

export type TenantRolloutConfig = {
  /** Named cohort or rollout channel (e.g. "beta" / "internal"). */
  cohort?: string;
  /** Percentage [0, 100] of traffic/users that should receive the rollout. */
  percentage?: number;
  /** Primary variant identifier for split tests. */
  variant?: string;
  /** Explicit feature toggles keyed by capability. */
  features?: Record<string, boolean>;
  /** Optional sticky key used to hash rollout assignment (defaults to tenantId). */
  stickyKey?: string;
};

export type DuckFlowTenantConfig = {
  /** Unique tenant identifier. */
  tenantId: string;
  /** Optional display name for dashboards or logs. */
  displayName?: string;
  /** Preferred environment name when none is supplied via provider props. */
  environment?: string;
  /** Resource quota definitions enforced by the runtime. */
  quotas?: TenantResourceQuota;
  /** Gradual rollout configuration and feature toggles. */
  rollout?: TenantRolloutConfig;
  /** Arbitrary metadata propagated to runtime consumers. */
  metadata?: Record<string, unknown>;
};

export type ResolvedTenantContext = DuckFlowTenantConfig & {
  /** The effective runtime environment key derived for the tenant. */
  environmentKey: RuntimeEnvironmentKey;
  /** Normalized environment identifier combining tenant + environment. */
  normalizedEnvironmentKey: string;
  /** Resolved environment name (mirrors environmentKey.environment). */
  environment: string;
};

export type TenantQuotaSnapshot = {
  key: string;
  usage: number;
  limit?: number;
  remaining?: number;
};

export function resolveTenantContext(
  tenant: DuckFlowTenantConfig,
  baseEnvironment: RuntimeEnvironmentKey
): ResolvedTenantContext {
  const environmentKey: RuntimeEnvironmentKey = {
    environment: tenant.environment ?? baseEnvironment.environment,
    tenantId: tenant.tenantId ?? baseEnvironment.tenantId,
  };

  if (!environmentKey.environment) {
    environmentKey.environment = baseEnvironment.environment ?? "default";
  }

  return {
    ...tenant,
    environmentKey,
    environment: environmentKey.environment,
    normalizedEnvironmentKey: normalizeRuntimeKey(environmentKey),
  };
}
