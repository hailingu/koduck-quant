/**
 * RuntimeFeatureFlag - Feature Flag and Rollout Management Module
 *
 * @module RuntimeFeatureFlag
 * @description
 * Manages feature flags and gradual rollout logic for tenant contexts.
 * This module provides:
 * - Feature flag querying
 * - Rollout percentage-based bucket calculation
 * - Variant and cohort retrieval
 *
 * @example Basic feature flag check
 * ```typescript
 * const featureFlag = new RuntimeFeatureFlag(
 *   () => runtime.getTenantContext() ?? null
 * );
 *
 * if (featureFlag.isFeatureEnabled('new-ui', false)) {
 *   // Show new UI
 * }
 * ```
 *
 * @example Rollout-based feature gating
 * ```typescript
 * if (featureFlag.isInRollout('feature-x')) {
 *   // User is in the rollout percentage
 * }
 *
 * const variant = featureFlag.getRolloutVariant();
 * if (variant === 'experimental') {
 *   // Show experimental features
 * }
 * ```
 *
 * @since 2.1.0
 * @author KoduckFlow Team
 */

import { hashString, clampPercentage } from "./utils/hash-utils";
import type { ResolvedTenantContext } from "./tenant-context";

/**
 * RuntimeFeatureFlag class
 *
 * @description
 * Encapsulates feature flag and rollout management logic.
 * Uses a provider pattern to access tenant context, avoiding circular dependencies.
 *
 * Design principles:
 * - Provider pattern for tenant context access
 * - Consistent hashing for rollout bucket calculation
 * - Immutable tenant context (read-only access)
 * - Defensive programming (handles missing/invalid data)
 *
 * @class
 */
export class RuntimeFeatureFlag {
  private readonly tenantContextProvider: () => ResolvedTenantContext | null;

  /**
   * Creates a RuntimeFeatureFlag instance
   *
   * @param tenantContextProvider - Function that provides current tenant context
   *
   * @throws {Error} If tenantContextProvider is not a function
   *
   * @example
   * ```typescript
   * const featureFlag = new RuntimeFeatureFlag(
   *   () => tenantContext.getTenantContext() ?? null
   * );
   * ```
   */
  constructor(tenantContextProvider: () => ResolvedTenantContext | null) {
    if (typeof tenantContextProvider !== "function") {
      throw new TypeError("RuntimeFeatureFlag: tenantContextProvider must be a function");
    }
    this.tenantContextProvider = tenantContextProvider;
  }

  /**
   * Checks if a feature flag is enabled
   *
   * @param flag - Feature flag name
   * @param defaultValue - Default value if flag is not configured (default: false)
   * @returns true if feature is enabled, false otherwise
   *
   * @description
   * Queries the tenant context's rollout features map.
   * If no tenant context or no rollout configuration exists, returns defaultValue.
   * If flag is not in the features map, returns defaultValue.
   *
   * @example
   * ```typescript
   * // Check if 'dark-mode' feature is enabled
   * const isDarkMode = featureFlag.isFeatureEnabled('dark-mode', false);
   *
   * // Check with explicit default
   * const isNewUI = featureFlag.isFeatureEnabled('new-ui', true);
   * ```
   */
  isFeatureEnabled(flag: string, defaultValue = false): boolean {
    const tenantContext = this.tenantContextProvider();
    const features = tenantContext?.rollout?.features;
    if (!features) {
      return defaultValue;
    }
    if (flag in features) {
      return features[flag] ?? defaultValue;
    }
    return defaultValue;
  }

  /**
   * Gets the rollout variant
   *
   * @returns Rollout variant string, or undefined if not configured
   *
   * @description
   * Retrieves the rollout variant from tenant context.
   * Useful for A/B testing and feature experiments.
   *
   * @example
   * ```typescript
   * const variant = featureFlag.getRolloutVariant();
   * if (variant === 'control') {
   *   // Show control version
   * } else if (variant === 'experimental') {
   *   // Show experimental version
   * }
   * ```
   */
  getRolloutVariant(): string | undefined {
    const tenantContext = this.tenantContextProvider();
    return tenantContext?.rollout?.variant;
  }

  /**
   * Gets the rollout cohort
   *
   * @returns Rollout cohort string, or undefined if not configured
   *
   * @description
   * Retrieves the rollout cohort from tenant context.
   * Useful for grouping users in rollout experiments.
   *
   * @example
   * ```typescript
   * const cohort = featureFlag.getRolloutCohort();
   * if (cohort === 'early-adopters') {
   *   // Enable beta features
   * }
   * ```
   */
  getRolloutCohort(): string | undefined {
    const tenantContext = this.tenantContextProvider();
    return tenantContext?.rollout?.cohort;
  }

  /**
   * Checks if tenant is in rollout percentage
   *
   * @param seed - Optional seed for rollout bucket calculation
   * @returns true if tenant is in rollout, false otherwise
   *
   * @description
   * Determines if the tenant is included in the rollout based on percentage.
   * Uses consistent hashing to assign tenants to buckets (0-99).
   *
   * Behavior:
   * - If no rollout percentage configured: returns true (100% rollout)
   * - If percentage <= 0: returns false (0% rollout)
   * - If percentage >= 100: returns true (100% rollout)
   * - Otherwise: compares bucket hash against percentage
   *
   * The bucket is calculated from:
   * - Optional seed parameter
   * - Rollout stickyKey (for consistent user experience)
   * - Tenant ID
   * - Normalized environment key
   *
   * @example Basic rollout check
   * ```typescript
   * // Check if user is in 25% rollout
   * if (featureFlag.isInRollout()) {
   *   // Show new feature
   * }
   * ```
   *
   * @example With custom seed
   * ```typescript
   * // Use user ID as seed for per-user rollout
   * if (featureFlag.isInRollout(`user-${userId}`)) {
   *   // Show user-specific rollout
   * }
   * ```
   */
  isInRollout(seed?: string): boolean {
    const tenantContext = this.tenantContextProvider();
    const percentage = tenantContext?.rollout?.percentage;
    if (percentage === undefined) {
      return true;
    }

    const normalized = clampPercentage(percentage);
    if (normalized <= 0) {
      return false;
    }
    if (normalized >= 100) {
      return true;
    }

    const bucket = this.computeRolloutBucket(seed);
    return bucket < normalized;
  }

  /**
   * Computes rollout bucket using consistent hashing
   *
   * @param seed - Optional seed for bucket calculation
   * @returns Bucket number (0-99)
   *
   * @private
   * @internal
   *
   * @description
   * Calculates a deterministic bucket (0-99) for rollout decisions.
   * Uses consistent hashing to ensure same inputs always produce same bucket.
   *
   * Hashing inputs (in order):
   * 1. Optional seed parameter
   * 2. Rollout stickyKey (from tenant context)
   * 3. Tenant ID
   * 4. Normalized environment key
   * 5. Fallback: "koduckflow" if no inputs available
   *
   * Inputs are joined with "::" separator and hashed using hashString().
   * Result is modulo 100 to produce bucket in range [0, 99].
   *
   * @example
   * ```typescript
   * // Internal usage only
   * const bucket = this.computeRolloutBucket('user-123');
   * // bucket will be in range 0-99
   * ```
   */
  private computeRolloutBucket(seed?: string): number {
    const tenantContext = this.tenantContextProvider();
    const parts: string[] = [];

    if (seed) {
      parts.push(seed);
    }
    const sticky = tenantContext?.rollout?.stickyKey;
    if (sticky) {
      parts.push(sticky);
    }
    if (tenantContext?.tenantId) {
      parts.push(tenantContext.tenantId);
    }
    if (tenantContext?.normalizedEnvironmentKey) {
      parts.push(tenantContext.normalizedEnvironmentKey);
    }
    if (parts.length === 0) {
      parts.push("koduckflow");
    }

    const combined = parts.join("::");
    return hashString(combined) % 100;
  }
}
