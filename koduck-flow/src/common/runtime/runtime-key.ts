/**
 * @module src/common/runtime/runtime-key
 * @description Runtime environment key definitions and utilities for multi-tenant runtime identification.
 * Provides types and functions for working with runtime environment keys in Koduck Flow.
 * @example
 * ```typescript
 * const key: RuntimeEnvironmentKey = {
 *   environment: 'production',
 *   tenantId: 'acme-corp'
 * };
 * const normalized = normalizeRuntimeKey(key); // 'acme-corp::production'
 * ```
 */

/**
 * Key identifying a runtime environment with optional multi-tenant support
 * @typedef {Object} RuntimeEnvironmentKey
 * @property {string} environment - Environment name (e.g., 'development', 'staging', 'production')
 * @property {string} [tenantId] - Optional tenant identifier for multi-tenant scenarios
 * @example
 * ```typescript
 * // Single-tenant environment
 * const devKey: RuntimeEnvironmentKey = { environment: 'development' };
 *
 * // Multi-tenant environment
 * const prodKey: RuntimeEnvironmentKey = {
 *   environment: 'production',
 *   tenantId: 'acme-corp'
 * };
 * ```
 */
export type RuntimeEnvironmentKey = {
  environment: string;
  tenantId?: string | undefined;
};

/**
 * Normalize runtime environment key to canonical string format
 * Combines environment and tenantId into a normalized format for use as cache key.
 * Format: 'environment' (no tenant) or 'tenantId::environment' (with tenant)
 *
 * @param {RuntimeEnvironmentKey} key - Runtime environment key to normalize
 * @returns {string} Canonical normalized key string
 * @example
 * ```typescript
 * // Single tenant
 * normalizeRuntimeKey({ environment: 'dev' })
 * // Returns: 'dev'
 *
 * // Multi-tenant
 * normalizeRuntimeKey({ environment: 'prod', tenantId: 'acme' })
 * // Returns: 'acme::prod'
 *
 * // Whitespace trimmed
 * normalizeRuntimeKey({ environment: '  staging  ', tenantId: '  tenant-1  ' })
 * // Returns: 'tenant-1::staging'
 * ```
 */
export function normalizeRuntimeKey(key: RuntimeEnvironmentKey): string {
  const env = key.environment?.trim() || "default";
  const tenant = key.tenantId?.trim();
  if (!tenant) {
    return env;
  }
  return `${tenant}::${env}`;
}
