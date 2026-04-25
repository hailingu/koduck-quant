/**
 * @module src/common/runtime/runtime-factory
 * @description Factory for creating and managing DuckFlow runtime instances.
 * Supports multi-tenant scenarios with shared runtime caching and lifecycle management.
 * @example
 * ```typescript
 * const factory = new DuckFlowRuntimeFactory();
 * const runtime = factory.getOrCreateRuntime({
 *   environment: 'production',
 *   tenantId: 'tenant-1'
 * }, {
 *   enableMetrics: true,
 *   metadata: { region: 'us-east-1' }
 * });
 * ```
 */

import { logger } from "../logger";

import {
  DuckFlowRuntime,
  createDuckFlowRuntime,
  type DuckFlowRuntimeOptions,
} from "./duck-flow-runtime";
import { normalizeRuntimeKey, type RuntimeEnvironmentKey } from "./runtime-key";

/**
 * Extended options for runtime creation with optional metadata attachment
 * @interface RuntimeCreationOptions
 * @augments {DuckFlowRuntimeOptions}
 * @property {Record<string,unknown>} [metadata] - Custom metadata to attach to created runtime
 */
export interface RuntimeCreationOptions extends DuckFlowRuntimeOptions {
  metadata?: Record<string, unknown>;
}

/**
 * Factory for creating, caching, and managing DuckFlow runtime instances
 * @class DuckFlowRuntimeFactory
 * @description Manages runtime lifecycle with singleton pattern per environment/tenant combination.
 * Handles runtime creation, caching, disposal, and metadata tracking.
 * @example
 * ```typescript
 * const factory = new DuckFlowRuntimeFactory();
 *
 * // Get or create runtime
 * const runtime = factory.getOrCreateRuntime(
 *   { environment: 'prod', tenantId: 'tenant-1' },
 *   { enableMetrics: true, metadata: { version: '1.0' } }
 * );
 *
 * // Check existence
 * if (factory.hasRuntime(key)) {
 *   factory.disposeRuntime(key);
 * }
 *
 * // Cleanup
 * factory.disposeAll();
 * ```
 */
export class DuckFlowRuntimeFactory {
  private readonly runtimes = new Map<string, DuckFlowRuntime>();
  private readonly metadata = new Map<string, Record<string, unknown>>();

  /**
   * Get existing runtime or create new one for given environment
   * @param {RuntimeEnvironmentKey} key - Environment and tenant identifier
   * @param {RuntimeCreationOptions} [options={}] - Configuration for new runtime
   * @returns {DuckFlowRuntime} Existing or newly created runtime instance
   * @example
   * ```typescript
   * const runtime = factory.getOrCreateRuntime(
   *   { environment: 'staging', tenantId: 'tenant-2' },
   *   {
   *     enableMetrics: true,
   *     enableCache: true,
   *     metadata: { dataCenter: 'eu-west-1' }
   *   }
   * );
   * ```
   */
  getOrCreateRuntime(
    key: RuntimeEnvironmentKey,
    options: RuntimeCreationOptions = {}
  ): DuckFlowRuntime {
    const normalizedKey = normalizeRuntimeKey(key);
    const existing = this.runtimes.get(normalizedKey);
    if (existing) {
      logger.debug("♻️ 复用 DuckFlowRuntime 实例", this.composeLogPayload(normalizedKey, key));
      return existing;
    }

    logger.info("🚀 创建新的 DuckFlowRuntime 实例", this.composeLogPayload(normalizedKey, key));
    const runtime = createDuckFlowRuntime(options);
    this.runtimes.set(normalizedKey, runtime);
    if (options.metadata) {
      this.metadata.set(normalizedKey, options.metadata);
    }
    return runtime;
  }

  /**
   * Check if runtime exists for given environment
   * @param {RuntimeEnvironmentKey} key - Environment and tenant identifier
   * @returns {boolean} True if runtime exists and is cached
   * @example
   * ```typescript
   * const exists = factory.hasRuntime({ environment: 'prod', tenantId: 'tenant-1' });
   * ```
   */
  hasRuntime(key: RuntimeEnvironmentKey): boolean {
    return this.runtimes.has(normalizeRuntimeKey(key));
  }

  /**
   * Dispose and remove a cached runtime instance
   * @param {RuntimeEnvironmentKey} key - Environment and tenant identifier
   * @throws {Error} Logs error if runtime disposal fails, but does not throw
   * @example
   * ```typescript
   * factory.disposeRuntime({ environment: 'staging', tenantId: 'tenant-2' });
   * ```
   */
  disposeRuntime(key: RuntimeEnvironmentKey): void {
    const normalizedKey = normalizeRuntimeKey(key);
    const runtime = this.runtimes.get(normalizedKey);
    if (!runtime) {
      return;
    }

    logger.info("🧹 销毁 DuckFlowRuntime 实例", this.composeLogPayload(normalizedKey, key));
    try {
      runtime.dispose();
    } catch (error) {
      logger.error("销毁 DuckFlowRuntime 实例失败", {
        ...this.composeLogPayload(normalizedKey, key),
        error,
      });
    }

    this.runtimes.delete(normalizedKey);
    this.metadata.delete(normalizedKey);
  }

  /**
   * Dispose all cached runtime instances
   * Iterates through all runtimes and disposes each one, clearing the cache
   * @example
   * ```typescript
   * factory.disposeAll();
   * // All runtimes are disposed and cache is cleared
   * ```
   */
  disposeAll(): void {
    for (const normalizedKey of this.runtimes.keys()) {
      const [tenantPart, environmentPart] = normalizedKey.includes("::")
        ? normalizedKey.split("::")
        : [undefined, normalizedKey];
      this.disposeRuntime({
        environment: environmentPart,
        tenantId: tenantPart,
      });
    }
  }

  /**
   * Get metadata attached to a cached runtime
   * @param {RuntimeEnvironmentKey} key - Environment and tenant identifier
   * @returns {Record<string,unknown>|undefined} Metadata if runtime exists, undefined otherwise
   * @example
   * ```typescript
   * const meta = factory.getRuntimeMetadata({ environment: 'prod', tenantId: 'tenant-1' });
   * console.log(meta?.region, meta?.version);
   * ```
   */
  getRuntimeMetadata(key: RuntimeEnvironmentKey): Record<string, unknown> | undefined {
    return this.metadata.get(normalizeRuntimeKey(key));
  }

  private composeLogPayload(normalizedKey: string, key: RuntimeEnvironmentKey) {
    return {
      normalizedKey,
      environment: key.environment,
      tenantId: key.tenantId,
    };
  }
}
