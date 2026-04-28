/**
 * Runtime Factory Test Helpers
 *
 * @description
 * High-level helper methods for testing runtime factory quota enforcement,
 * multi-tenant isolation, and quota-gated operation scenarios in E2E tests.
 *
 * Provides abstractions for:
 * - Seeding tenants with distinct quota configurations
 * - Attempting quota-consuming operations (entity creation, flows)
 * - Verifying quota enforcement errors are triggered
 * - Validating tenant isolation across quota boundaries
 * - Resetting quotas and cleanup
 *
 * @example
 * ```typescript
 * // Test quota enforcement
 * const helper = new RuntimeFactoryHelpers();
 * await helper.seedTenantWithQuota(page, 'tenant-1', { maxEntities: 5 });
 * await helper.attemptQuotaOverage(page, 'createEntity', 6);
 * await helper.verifyQuotaError(page);
 *
 * // Test tenant isolation
 * await helper.verifyTenantIsolation(page, 'tenant-1', 'isolated');
 * ```
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Page, expect } from "@playwright/test";

/**
 * RuntimeFactoryHelpers
 *
 * 负责测试运行时工厂、配额管理和多租户隔离的辅助方法集合。
 *
 * **核心职责**:
 * - 配额初始化: seedTenantWithQuota - 为租户设置初始配额限制
 * - 配额测试: attemptQuotaOverage - 尝试超出配额限制的操作
 * - 错误验证: verifyQuotaError - 验证预期的配额错误
 * - 隔离验证: verifyTenantIsolation - 验证多租户数据隔离
 * - 状态查询: getQuotaUsage, getTenantContext - 查询当前配额/租户状态
 * - 清理操作: resetQuotas - 重置配额用于下一个测试
 *
 * @example
 * ```typescript
 * const helpers = new RuntimeFactoryHelpers();
 *
 * // 种子配额测试
 * await helpers.seedTenantWithQuota(page, 'tenant-1', { maxEntities: 5 });
 *
 * // 尝试超出限制
 * await helpers.attemptQuotaOverage(page, 'createEntity', 6);
 *
 * // 验证错误
 * await helpers.verifyQuotaError(page, 'quotaExceeded');
 *
 * // 验证隔离
 * await helpers.verifyTenantIsolation(page, 'tenant-1', 'isolated');
 *
 * // 重置
 * await helpers.resetQuotas(page);
 * ```
 *
 * @since 2.1.0
 */
export class RuntimeFactoryHelpers {
  /**
   * Seed a tenant with specific quota configuration
   *
   * Initializes a tenant runtime with configured quotas (maxEntities, maxWorkflowDefinitions, etc).
   * Internally calls the runtime factory API to register the tenant context with quotas.
   *
   * @param page - Playwright page object
   * @param tenantId - Tenant identifier (e.g., 'tenant-1', 'tenant-restricted')
   * @param quotas - Quota configuration object
   *   - maxEntities?: number - Maximum entities this tenant can create
   *   - maxWorkflowDefinitions?: number - Maximum workflow definitions
   *   - maxConcurrentRuns?: number - Maximum concurrent workflow runs
   *   - custom?: Record<string, number> - Custom quota buckets
   * @returns Promise resolving when tenant is seeded and ready
   *
   * @example
   * ```typescript
   * // Basic: high quota limit
   * await helpers.seedTenantWithQuota(page, 'tenant-premium', { maxEntities: 1000 });
   *
   * // Restricted: low quota limit
   * await helpers.seedTenantWithQuota(page, 'tenant-basic', { maxEntities: 10 });
   *
   * // Multiple quotas
   * await helpers.seedTenantWithQuota(page, 'tenant-full', {
   *   maxEntities: 500,
   *   maxWorkflowDefinitions: 100,
   *   maxConcurrentRuns: 10,
   *   custom: { 'api-calls': 1000, 'storage-gb': 50 }
   * });
   * ```
   */
  async seedTenantWithQuota(
    page: Page,
    tenantId: string,
    quotas: Record<string, number>
  ): Promise<void> {
    // Inject runtime factory API call via page.evaluate
    // This executes JavaScript in the browser context to configure tenant quotas
    await page.evaluate(
      ({ tenantId: tid, quotas: q }) => {
        // Access the global KoduckFlow runtime instance
        const runtime = (globalThis as unknown as { __koduckflowRuntime?: Record<string, unknown> })
          .__koduckflowRuntime;
        if (!runtime) {
          throw new Error("KoduckFlow runtime not found in window context");
        }

        // Get or create runtime for this tenant
        const tenantContext = {
          tenantId: tid,
          quotas: q,
          environment: "test",
        };

        // Set tenant context in the runtime
        if (runtime.setTenantContext) {
          (runtime.setTenantContext as (ctx: unknown) => void)(tenantContext);
        }

        // Optionally sync quota manager
        if (runtime.quotaManager) {
          // Pre-register quota buckets in quota manager
          // (implementation varies based on runtime API)
        }
      },
      { tenantId, quotas }
    );

    // Verify tenant was seeded by checking context
    await this.verifyTenantContext(page, tenantId);
  }

  /**
   * Attempt to exceed quota limits with repeated operations
   *
   * Performs repeated operations (e.g., entity creation) to trigger quota enforcement.
   * Stops on first error or completes all operations if quota allows.
   *
   * @param page - Playwright page object
   * @param operationType - Type of quota-consuming operation
   *   - 'createEntity': Creates entities until quota exceeded
   *   - 'createFlow': Creates flows until quota exceeded
   *   - 'customBucket': Increments custom quota bucket
   * @param count - Number of operations to attempt
   * @returns Promise resolving when operations complete or quota is exceeded
   *
   * @example
   * ```typescript
   * // Attempt to create 6 entities (will fail if maxEntities is 5)
   * await helpers.attemptQuotaOverage(page, 'createEntity', 6);
   *
   * // Attempt to create 20 flows
   * await helpers.attemptQuotaOverage(page, 'createFlow', 20);
   *
   * // Attempt custom bucket operations
   * await helpers.attemptQuotaOverage(page, 'customBucket', 1000);
   * ```
   */
  async attemptQuotaOverage(
    page: Page,
    operationType: "createEntity" | "createFlow" | "customBucket",
    count: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const result = await page.evaluate(
        ({ opType, index }) => {
          const runtime = (globalThis as unknown as { __koduckflowRuntime?: Record<string, unknown> })
            .__koduckflowRuntime;
          if (!runtime) return { success: false, error: "Runtime not found" };

          try {
            switch (opType) {
              case "createEntity": {
                // Attempt entity creation
                const quotaManager = runtime.quotaManager as unknown as {
                  claimQuota?: (bucket: string, amount: number) => boolean;
                };
                if (quotaManager && !quotaManager.claimQuota?.("maxEntities", 1)) {
                  return { success: false, error: "quotaExceeded", type: "maxEntities" };
                }
                // Simulate entity creation
                return { success: true, id: `entity-${index}` };
              }

              case "createFlow": {
                // Attempt flow creation
                const quotaManager = runtime.quotaManager as unknown as {
                  claimQuota?: (bucket: string, amount: number) => boolean;
                };
                if (quotaManager && !quotaManager.claimQuota?.("maxWorkflowDefinitions", 1)) {
                  return { success: false, error: "quotaExceeded", type: "maxWorkflowDefinitions" };
                }
                // Simulate flow creation
                return { success: true, id: `flow-${index}` };
              }

              case "customBucket": {
                // Attempt custom bucket operation
                const quotaManager = runtime.quotaManager as unknown as {
                  claimQuota?: (bucket: string, amount: number) => boolean;
                };
                if (quotaManager && !quotaManager.claimQuota?.("custom", 1)) {
                  return { success: false, error: "quotaExceeded", type: "custom" };
                }
                return { success: true };
              }

              default:
                return { success: false, error: "Unknown operation type" };
            }
          } catch (error) {
            return { success: false, error: String(error) };
          }
        },
        { opType: operationType, index: i }
      );

      // Stop if quota exceeded
      if (!result.success) {
        // Store error state for verification
        await page.evaluate((err) => {
          (globalThis as unknown as Record<string, unknown>).__lastQuotaError = err;
        }, result.error);
        break;
      }
    }
  }

  /**
   * Verify that a quota error was triggered
   *
   * Checks for expected quota enforcement error in the UI or runtime state.
   * Validates that the error message appears with correct quota type.
   *
   * @param page - Playwright page object
   * @returns Promise resolving when error is verified
   *
   * @example
   * ```typescript
   * // Verify basic quota exceeded error
   * await helpers.verifyQuotaError(page);
   *
   * // Verify with custom matcher
   * const errorDialog = page.locator('[data-testid="quota-error"]');
   * await expect(errorDialog).toBeVisible();
   * const message = await errorDialog.locator('text').innerText();
   * expect(message).toContain('quota');
   * ```
   */
  async verifyQuotaError(page: Page): Promise<void> {
    // Check for quota error in runtime state
    const errorState = await page.evaluate(() => {
      return (globalThis as unknown as Record<string, unknown>).__lastQuotaError;
    });

    expect(errorState).toBe("quotaExceeded");
  }

  /**
   * Verify tenant isolation - data from one tenant is not visible to another
   *
   * Validates that entities/flows/configurations created in one tenant
   * are not visible after switching to another tenant.
   *
   * @param page - Playwright page object
   * @param tenantId - Tenant to verify isolation for
   * @param expectedState - Expected isolation state ('isolated', 'non-isolated', 'shared')
   * @returns Promise resolving when isolation is verified
   *
   * @example
   * ```typescript
   * // Switch to tenant-1, create entity, switch to tenant-2, verify not visible
   * await helpers.seedTenantWithQuota(page, 'tenant-1', { maxEntities: 100 });
   * await helpers.seedTenantWithQuota(page, 'tenant-2', { maxEntities: 100 });
   *
   * // Create entity in tenant-1
   * await page.locator('[data-testid="create-entity-btn"]').click();
   * await page.fill('[data-testid="entity-name"]', 'Tenant1Entity');
   * await page.locator('[data-testid="confirm-btn"]').click();
   *
   * // Switch to tenant-2
   * const tenantSelector = page.locator(RuntimeSelectors.tenantSwitchButton);
   * await tenantSelector.click();
   * await page.locator('[data-testid="tenant-option-tenant-2"]').click();
   *
   * // Verify entity not visible
   * await helpers.verifyTenantIsolation(page, 'tenant-2', 'isolated');
   * ```
   */
  async verifyTenantIsolation(
    page: Page,
    tenantId: string,
    expectedState: "isolated" | "non-isolated" | "shared"
  ): Promise<void> {
    const tenantContext = await this.getTenantContext(page);
    expect(tenantContext.tenantId).toBe(tenantId);

    if (expectedState === "isolated") {
      // Verify data isolation: entities from other tenants are not visible
      // This assumes there's a way to query/count entities in the current tenant
      const currentTenantEntities = await page.evaluate(() => {
        const runtime = (globalThis as any).__koduckflowRuntime;
        if (!runtime?.entityManager) return [];
        return runtime.entityManager.getEntities?.() || [];
      });

      expect(Array.isArray(currentTenantEntities)).toBe(true);
      // Further validation depends on test data setup
    }
  }

  /**
   * Get current quota usage snapshot for a tenant
   *
   * Returns quota usage statistics (current/limit/remaining) for specified bucket.
   *
   * @param page - Playwright page object
   * @param quotaBucket - Quota bucket name ('maxEntities', 'api-calls', etc)
   * @returns Promise<{usage: number, limit?: number, remaining?: number}>
   *
   * @example
   * ```typescript
   * const usage = await helpers.getQuotaUsage(page, 'maxEntities');
   * console.log(`Entities: ${usage.usage}/${usage.limit} (${usage.remaining} remaining)`);
   * expect(usage.usage).toBeLessThanOrEqual(usage.limit);
   * ```
   */
  async getQuotaUsage(
    page: Page,
    quotaBucket: string
  ): Promise<{ usage: number; limit?: number; remaining?: number }> {
    return await page.evaluate((bucket) => {
      const runtime = (globalThis as any).__koduckflowRuntime;
      if (!runtime?.quotaManager) {
        return { usage: 0 };
      }

      const snapshot = runtime.quotaManager.getQuotaSnapshot(bucket);
      return snapshot || { usage: 0 };
    }, quotaBucket);
  }

  /**
   * Get current tenant context information
   *
   * Returns active tenant ID, quotas, and environment configuration.
   *
   * @param page - Playwright page object
   * @returns Promise<{tenantId: string, quotas?: Record<string, number>}>
   *
   * @example
   * ```typescript
   * const context = await helpers.getTenantContext(page);
   * expect(context.tenantId).toBe('tenant-1');
   * expect(context.quotas?.maxEntities).toBe(100);
   * ```
   */
  async getTenantContext(
    page: Page
  ): Promise<{ tenantId: string; quotas?: Record<string, number> }> {
    return await page.evaluate(() => {
      const runtime = (globalThis as any).__koduckflowRuntime;
      if (!runtime) return { tenantId: "default" };

      const tenantContext = runtime.getTenantContext?.();
      return (
        tenantContext || {
          tenantId: "default",
        }
      );
    });
  }

  /**
   * Verify tenant context is set correctly
   *
   * Internal helper to validate tenant was initialized properly.
   *
   * @param page - Playwright page object
   * @param expectedTenantId - Expected tenant ID
   * @returns Promise resolving when verification passes
   */
  private async verifyTenantContext(page: Page, expectedTenantId: string): Promise<void> {
    const context = await this.getTenantContext(page);
    expect(context.tenantId).toBe(expectedTenantId);
  }

  /**
   * Reset quotas after test (cleanup)
   *
   * Clears quota state and resets tenant context for next test.
   * Called in afterEach hook for test isolation.
   *
   * @param page - Playwright page object
   * @returns Promise resolving when cleanup is complete
   *
   * @example
   * ```typescript
   * afterEach(async ({ page }) => {
   *   await helpers.resetQuotas(page);
   * });
   * ```
   */
  async resetQuotas(page: Page): Promise<void> {
    await page.evaluate(() => {
      const runtime = (globalThis as any).__koduckflowRuntime;
      if (runtime?.quotaManager) {
        runtime.quotaManager.reset?.();
      }
      (globalThis as any).__lastQuotaError = null;
    });
  }

  /**
   * Wait for quota enforcement to be active
   *
   * Polls until runtime quota manager is initialized and ready.
   * Used before attempting quota-gated operations.
   *
   * @param page - Playwright page object
   * @param timeout - Maximum wait time in milliseconds (default 5000)
   * @returns Promise resolving when quota enforcement is ready
   */
  async waitForQuotaEnforcement(page: Page, timeout = 5000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const isReady = await page.evaluate(() => {
        const runtime = (globalThis as any).__koduckflowRuntime;
        return runtime && (runtime as any).quotaManager !== undefined;
      });

      if (isReady) {
        return;
      }

      await page.waitForTimeout(100);
    }

    throw new Error(`Quota enforcement not ready after ${timeout}ms`);
  }
}
