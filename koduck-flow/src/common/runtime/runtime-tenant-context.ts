/**
 * RuntimeTenantContext - Tenant context manager
 *
 * @description
 * Manages tenant context in a multi-tenant environment, providing the following core features:
 * 1. Tenant context setting and retrieval
 * 2. Deep copy of tenant context (prevents external modification)
 * 3. Sync tenant config to DI container (tenantContext, tenantQuota, tenantRollout)
 * 4. Tenant context clearing and resetting
 *
 * @responsibilities
 * - Manages tenant context lifecycle
 * - Ensures tenant data isolation (via deep copy)
 * - Syncs tenant config to dependency injection container
 * - Provides tenant context query interface
 *
 * @example
 * ```typescript
 * const tenantContext = new RuntimeTenantContext(container);
 *
 * // Set tenant context
 * tenantContext.setTenantContext({
 *   tenantId: 'tenant-123',
 *   environment: 'production',
 *   quotas: { maxEntities: 1000 },
 *   rollout: { percentage: 50, variant: 'beta' }
 * });
 *
 * // Get tenant context (returns deep copy)
 * const context = tenantContext.getTenantContext();
 *
 * // Check if tenant context exists
 * if (tenantContext.hasTenantContext()) {
 *   console.log('Tenant context is set');
 * }
 *
 * // Clear tenant context
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
 * RuntimeTenantContext class
 *
 * @description
 * Manages tenant context setting, retrieval, sync, and clearing.
 * Uses deep copy strategy to ensure tenant data isolation, preventing external code from accidentally modifying internal state.
 *
 * @class
 */
export class RuntimeTenantContext {
  /**
   * Current tenant context (internal state)
   * @private
   */
  private tenantContext: ResolvedTenantContext | null = null;

  /**
   * DI container reference for syncing tenant config
   * @private
   * @readonly
   */
  private readonly container: IDependencyContainer;

  /**
   * Create RuntimeTenantContext instance
   *
   * @param container - Dependency injection container
   * @throws {Error} If container is null or undefined
   */
  constructor(container: IDependencyContainer) {
    if (!container) {
      throw new Error("Container cannot be null or undefined");
    }
    this.container = container;
  }

  /**
   * Set tenant context
   *
   * @description
   * Sets or clears tenant context. If null or undefined is passed, clears current context.
   * If a valid context is passed, deep-copies it and syncs to DI container.
   *
   * @param context - Tenant context to set, null means clear
   *
   * @example
   * ```typescript
   * // Set tenant context
   * tenantContext.setTenantContext({
   *   tenantId: 'tenant-123',
   *   environment: 'production'
   * });
   *
   * // Clear tenant context
   * tenantContext.setTenantContext(null);
   * ```
   */
  setTenantContext(context?: ResolvedTenantContext | null): void {
    // If null or undefined is passed, clear context
    if (!context) {
      this.tenantContext = null;
      this.clearContainer();
      return;
    }

    // Deep clone tenant context to ensure data isolation
    const snapshot = cloneTenantContext(context);
    if (!snapshot) {
      // If clone fails (e.g., context is empty object), do nothing
      return;
    }

    // Update internal state
    this.tenantContext = snapshot;

    // Sync to DI container
    this.syncToContainer(snapshot);

    // Log
    logger.info("KoduckFlowRuntime attached tenant context", {
      tenantId: snapshot.tenantId,
      environment: snapshot.environment,
      normalizedEnvironmentKey: snapshot.normalizedEnvironmentKey,
    });
  }

  /**
   * Get tenant context
   *
   * @description
   * Returns a deep copy of tenant context to prevent external code from modifying internal state.
   * If tenant context does not exist, returns undefined.
   *
   * @returns Deep copy of tenant context, or undefined if not set
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
   * Check if tenant context exists
   *
   * @description
   * Quickly checks whether tenant context is currently set, more efficient than calling getTenantContext().
   *
   * @returns true if tenant context exists, false otherwise
   *
   * @example
   * ```typescript
   * if (tenantContext.hasTenantContext()) {
   *   // Execute tenant-related operations
   * }
   * ```
   */
  hasTenantContext(): boolean {
    return this.tenantContext !== null;
  }

  /**
   * Sync tenant context to DI container
   *
   * @description
   * Registers tenant context and its sub-configs (quotas, rollout) to DI container,
   * allowing other modules to retrieve tenant info via dependency injection.
   *
   * @param snapshot - Tenant context snapshot to sync
   * @private
   */
  private syncToContainer(snapshot: ResolvedTenantContext): void {
    // Register full tenant context
    this.container.registerInstance(TOKENS.tenantContext, snapshot, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });

    // Register tenant quota config (if exists)
    this.container.registerInstance(TOKENS.tenantQuota, snapshot.quotas ?? null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });

    // Register tenant rollout config (if exists)
    this.container.registerInstance(TOKENS.tenantRollout, snapshot.rollout ?? null, {
      lifecycle: "singleton",
      replace: true,
      ownsInstance: false,
    });
  }

  /**
   * Clear tenant config from DI container
   *
   * @description
   * Sets tenant-related tokens in DI container to null,
   * ensuring dependent modules do not receive stale tenant information.
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
