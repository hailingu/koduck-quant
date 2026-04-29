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
 * Responsible for managing tenant quota claims, releases, and tracking.
 *
 * **Core Responsibilities**:
 * - Manage tenant quota claims and releases (supports custom quota buckets)
 * - Track quota usage (dedicated entity quota management)
 * - Generate quota snapshots (for monitoring and reporting)
 * - Handle quota limit checks (prevent overuse)
 *
 * **Design Principles**:
 * - Use Provider functions for dependency injection to avoid circular dependencies
 * - Track usage per quota bucket via Map
 * - Special handling for entity quota (TENANT_ENTITY_QUOTA_KEY)
 * - Log warning when quota exceeded but do not throw exceptions
 *
 * @example
 * ```typescript
 * const quotaManager = new RuntimeQuotaManager(
 *   () => runtime.getTenantContext() ?? null,
 *   () => entityManager.getEntities().length
 * );
 *
 * // Claim quota
 * if (quotaManager.claimQuota("api-calls", 1)) {
 *   // Execute operation that requires quota
 * }
 *
 * // Release quota
 * quotaManager.releaseQuota("api-calls", 1);
 *
 * // Query quota snapshot
 * const snapshot = quotaManager.getQuotaSnapshot("api-calls");
 * console.log(`Usage: ${snapshot?.usage}, Limit: ${snapshot?.limit}`);
 * ```
 *
 * @since 2.1.0
 */
export class RuntimeQuotaManager {
  /**
   * Tenant quota usage tracking table
   * - Key: quota bucket name (e.g., "api-calls", "storage", TENANT_ENTITY_QUOTA_KEY)
   * - Value: current usage
   */
  private readonly tenantQuotaUsage = new Map<string, number>();

  /**
   * Tenant context provider function
   * Avoids circular dependencies via Provider pattern
   */
  private readonly tenantContextProvider: () => ResolvedTenantContext | null;

  /**
   * Entity count provider function
   * Used to sync entity quota usage
   */
  private readonly entityCountProvider: () => number;

  /**
   * Create quota manager instance
   *
   * @param tenantContextProvider - Tenant context provider function, returns current tenant context or null
   * @param entityCountProvider - Entity count provider function, returns current total entity count
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
   * Claim tenant quota
   *
   * Attempts to claim a specified amount from the given quota bucket.
   * - If no tenant context is configured, always returns true (unlimited)
   * - If the specified quota bucket has no limit set, always returns true
   * - If claim would exceed the limit, returns false and logs a warning
   * - If claim succeeds, updates quota usage and returns true
   *
   * **Special Handling**:
   * - For entity quota (TENANT_ENTITY_QUOTA_KEY), uses actual entity count for checking
   *
   * @param bucket - Quota bucket name (e.g., "api-calls", "storage", TENANT_ENTITY_QUOTA_KEY)
   * @param amount - Quota amount to claim, defaults to 1
   * @returns Whether claim succeeded (true: success, false: exceeded)
   *
   * @example
   * ```typescript
   * // Claim API call quota
   * if (quotaManager.claimQuota("api-calls", 1)) {
   *   await callExternalAPI();
   * } else {
   *   throw new Error("API call quota exhausted");
   * }
   *
   * // Claim entity quota (before creating entity)
   * if (quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY)) {
   *   const entity = createEntity("MyEntity");
   * }
   * ```
   */
  claimQuota(bucket: string, amount = 1): boolean {
    // Parameter validation
    if (!bucket || amount <= 0) {
      return true;
    }

    const tenantContext = this.tenantContextProvider();
    if (!tenantContext) {
      return true; // No tenant context, unlimited
    }

    // Special handling for entity quota
    if (bucket === TENANT_ENTITY_QUOTA_KEY) {
      return this.ensureEntityQuotaAvailable();
    }

    // Get quota limit
    const limit = this.getQuotaLimit(bucket);
    const current = this.tenantQuotaUsage.get(bucket) ?? 0;
    const next = current + amount;

    // Check if exceeded
    if (limit !== undefined && next > limit) {
      logger.warn("KoduckFlowRuntime tenant quota exceeded", {
        tenantId: tenantContext.tenantId,
        bucket,
        limit,
        attempted: next,
      });
      return false;
    }

    // Update quota usage
    this.tenantQuotaUsage.set(bucket, next);
    return true;
  }

  /**
   * Release tenant quota
   *
   * Releases a specified amount from the given quota bucket.
   * - If quota bucket does not exist or usage is 0, returns 0 directly
   * - Usage will not go below 0 after release
   * - If usage becomes 0 after release, removes the quota bucket from tracking
   *
   * **Special Handling**:
   * - For entity quota (TENANT_ENTITY_QUOTA_KEY), automatically syncs actual entity count
   *
   * @param bucket - Quota bucket name
   * @param amount - Quota amount to release, defaults to 1
   * @returns Remaining usage after release
   *
   * @example
   * ```typescript
   * // Release API call quota
   * const remaining = quotaManager.releaseQuota("api-calls", 1);
   * console.log(`Remaining quota usage: ${remaining}`);
   *
   * // Release entity quota (after deleting entity)
   * quotaManager.releaseQuota(TENANT_ENTITY_QUOTA_KEY);
   * ```
   */
  releaseQuota(bucket: string, amount = 1): number {
    // Parameter validation
    if (!bucket || amount <= 0) {
      return this.tenantQuotaUsage.get(bucket) ?? 0;
    }

    // Special handling for entity quota: sync actual count
    if (bucket === TENANT_ENTITY_QUOTA_KEY) {
      this.syncEntityQuotaUsage();
      return this.tenantQuotaUsage.get(bucket) ?? 0;
    }

    const current = this.tenantQuotaUsage.get(bucket) ?? 0;
    if (current === 0) {
      return 0;
    }

    // Calculate usage after release (not below 0)
    const next = Math.max(current - amount, 0);
    if (next === 0) {
      this.tenantQuotaUsage.delete(bucket);
    } else {
      this.tenantQuotaUsage.set(bucket, next);
    }

    return next;
  }

  /**
   * Get snapshot for specified quota bucket
   *
   * Returns current usage of the quota bucket, including usage, limit, and remaining.
   * - If no tenant context is configured, returns undefined
   * - If the quota bucket has no limit set, returns only usage
   *
   * @param bucket - Quota bucket name
   * @returns Quota snapshot object, or undefined (when no tenant context)
   *
   * @example
   * ```typescript
   * const snapshot = quotaManager.getQuotaSnapshot("api-calls");
   * if (snapshot) {
   *   console.log(`Quota bucket: ${snapshot.key}`);
   *   console.log(`Usage: ${snapshot.usage}`);
   *   console.log(`Limit: ${snapshot.limit}`);
   *   console.log(`Remaining: ${snapshot.remaining}`);
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
   * List snapshots for all quota buckets
   *
   * Returns snapshots for all configured or used quota buckets.
   * - Includes used quota buckets (tenantQuotaUsage)
   * - Includes configured but unused quota buckets (from tenant context)
   * - If no tenant context is configured, returns empty array
   *
   * @returns Array of quota snapshots
   *
   * @example
   * ```typescript
   * const snapshots = quotaManager.listQuotaSnapshots();
   * for (const snapshot of snapshots) {
   *   console.log(`${snapshot.key}: ${snapshot.usage}/${snapshot.limit ?? "unlimited"}`);
   * }
   * ```
   */
  listQuotaSnapshots(): TenantQuotaSnapshot[] {
    const tenantContext = this.tenantContextProvider();
    if (!tenantContext) {
      return [];
    }

    // Collect all quota bucket keys
    const keys = new Set<string>(this.tenantQuotaUsage.keys());

    // Add configured entity quota
    const quotas = tenantContext.quotas;
    if (quotas?.maxEntities !== undefined) {
      keys.add(TENANT_ENTITY_QUOTA_KEY);
    }

    // Add custom quota buckets
    if (quotas?.custom) {
      for (const key of Object.keys(quotas.custom)) {
        keys.add(key);
      }
    }

    // Generate snapshot list
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
   * Ensure entity quota is available
   *
   * Checks whether current entity count has reached the tenant entity quota limit.
   * - If no entity quota limit (maxEntities) is configured, always returns true
   * - If current entity count >= limit, returns false and logs a warning
   * - Otherwise returns true
   *
   * **Note**: This method does not update quota usage, only performs a check
   *
   * @returns Whether a new entity can be created (true: yes, false: limit reached)
   *
   * @example
   * ```typescript
   * if (quotaManager.ensureEntityQuotaAvailable()) {
   *   const entity = entityManager.createEntity("MyEntity");
   * } else {
   *   throw new Error("Entity quota exhausted");
   * }
   * ```
   */
  ensureEntityQuotaAvailable(): boolean {
    const tenantContext = this.tenantContextProvider();
    const limit = tenantContext?.quotas?.maxEntities;

    if (limit === undefined) {
      return true; // Unlimited
    }

    const current = this.entityCountProvider();
    if (current >= limit) {
      logger.warn("KoduckFlowRuntime tenant entity quota exceeded", {
        tenantId: tenantContext?.tenantId,
        limit,
        current,
      });
      return false;
    }

    return true;
  }

  /**
   * Sync entity quota usage
   *
   * Updates entity quota bucket (TENANT_ENTITY_QUOTA_KEY) usage to the current actual entity count.
   * - If no entity quota limit (maxEntities) is configured, removes entity quota bucket from tracking
   * - Otherwise updates to actual entity count
   *
   * **Usage Scenarios**:
   * - When setting or clearing tenant context
   * - After creating or deleting entities
   * - When releasing entity quota
   *
   * @example
   * ```typescript
   * // Sync after deleting entity
   * entityManager.removeEntity(entityId);
   * quotaManager.syncEntityQuotaUsage();
   *
   * // Sync after setting tenant context
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
   * Clear all quota usage
   *
   * Clears quota tracking table, resetting all quota bucket usage to 0.
   *
   * **Usage Scenarios**:
   * - When clearing tenant context (setTenantContext(null))
   * - When switching tenants
   *
   * @internal
   */
  clear(): void {
    this.tenantQuotaUsage.clear();
  }

  /**
   * Get limit value for specified quota bucket
   *
   * @param bucket - Quota bucket name
   * @returns Quota limit value, or undefined (unlimited or no tenant context)
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
