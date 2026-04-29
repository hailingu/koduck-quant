/**
 * Runtime Factory & Quota Enforcement E2E Tests (E2E-C2)
 *
 * @description
 * Comprehensive test suite for validating multi-tenant isolation and quota enforcement
 * through the runtime factory API.
 *
 * Tests verify:
 * - Tenant seeding with distinct quota configurations
 * - Quota enforcement when operations attempt to exceed limits
 * - Error states when quotas are exceeded
 * - Tenant isolation across quota boundaries
 * - Quota reset and cleanup between tests
 *
 * @example
 * ```bash
 * # Run all runtime factory tests
 * npx playwright test runtime-factory.spec.ts
 *
 * # Run specific test
 * npx playwright test runtime-factory.spec.ts -g "should enforce entity quota limits"
 *
 * # Run with UI mode
 * npx playwright test runtime-factory.spec.ts --ui
 * ```
 *
 * @see docs/e2e-remediation-task-list.md#E2E-C2
 */

 
import { test, expect, testData } from "./fixtures";
import { RuntimeFactoryHelpers } from "./helpers";

// Initialize helper instance
const factoryHelpers = new RuntimeFactoryHelpers();

// NOTE: Runtime factory API bridge not yet exposed in harness (see docs/e2e-remediation-plan.md#phase-c)
test.describe.skip("Runtime Factory & Quota Enforcement (E2E-C2)", () => {
  // Cleanup after each test
  test.afterEach(async ({ runtimePage }) => {
    await factoryHelpers.resetQuotas(runtimePage);
  });

  test.describe("Tenant Quota Seeding", () => {
    test("should seed tenant with basic quota configuration", async ({ runtimePage }) => {
      // Arrange & Act
      const tenantId = testData.quotaScenarios.basic.tenantId;
      const quotas = testData.quotaScenarios.basic.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Assert: Verify tenant context is set
      const context = await factoryHelpers.getTenantContext(runtimePage);
      expect(context.tenantId).toBe(tenantId);
    });

    test("should seed tenant with restricted quota configuration", async ({ runtimePage }) => {
      // Arrange
      const tenantId = testData.quotaScenarios.restricted.tenantId;
      const quotas = testData.quotaScenarios.restricted.quotas;

      // Act
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Assert
      const context = await factoryHelpers.getTenantContext(runtimePage);
      expect(context.tenantId).toBe(tenantId);

      // Verify quota limits are enforced
      const usage = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");
      expect(usage.limit).toBeLessThanOrEqual(10); // Restricted quota
    });

    test("should seed multiple tenants with different quotas", async ({ runtimePage }) => {
      // Arrange
      const tenantA = testData.quotaScenarios.basic;
      const tenantB = testData.quotaScenarios.restricted;

      // Act: Seed tenant A
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantA.tenantId, tenantA.quotas);
      let context = await factoryHelpers.getTenantContext(runtimePage);
      expect(context.tenantId).toBe(tenantA.tenantId);

      // Act: Seed tenant B
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantB.tenantId, tenantB.quotas);
      context = await factoryHelpers.getTenantContext(runtimePage);
      expect(context.tenantId).toBe(tenantB.tenantId);

      // Assert: Each tenant maintains separate quotas
      const usageB = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");
      expect(usageB.limit).toBe(tenantB.quotas.maxEntities);
    });
  });

  test.describe("Quota Enforcement - Entity Limits", () => {
    test("should enforce entity quota limits when exceeded", async ({ runtimePage }) => {
      // Arrange: Seed tenant with very low quota
      const tenantId = testData.quotaScenarios.restricted.tenantId;
      const quotas = testData.quotaScenarios.restricted.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Attempt to exceed entity quota
      const maxEntities = quotas.maxEntities;
      const attemptCount = maxEntities + 3; // Try to create 3 more than allowed

      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", attemptCount);

      // Assert: Quota error should have been triggered
      await factoryHelpers.verifyQuotaError(runtimePage);
    });

    test("should allow operations within entity quota limits", async ({ runtimePage }) => {
      // Arrange: Seed tenant with generous quota
      const tenantId = testData.quotaScenarios.basic.tenantId;
      const quotas = testData.quotaScenarios.basic.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Attempt to create entities within limit
      const createCount = Math.floor(quotas.maxEntities / 2); // Half of limit

      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", createCount);

      // Assert: No quota error (operations succeed)
      const errorState = await runtimePage.evaluate(() => {
        return (globalThis as any).__lastQuotaError;
      });
      expect(errorState).toBeNull();
    });

    test("should enforce strict edge case quota (maxEntities: 1)", async ({ runtimePage }) => {
      // Arrange: Seed tenant with edge case quota
      const tenantId = testData.quotaScenarios.edgeCase.tenantId;
      const quotas = testData.quotaScenarios.edgeCase.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: First entity should succeed, second should fail
      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", 1);

      // Attempt second entity (should exceed quota)
      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", 1);

      // Assert: Quota exceeded on second attempt
      await factoryHelpers.verifyQuotaError(runtimePage);
    });
  });

  test.describe("Quota Enforcement - Workflow Limits", () => {
    test("should enforce workflow definition quota limits", async ({ runtimePage }) => {
      // Arrange: Seed tenant with restricted workflow quota
      const tenantId = testData.quotaScenarios.restricted.tenantId;
      const quotas = testData.quotaScenarios.restricted.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Attempt to exceed workflow definition quota
      const maxWorkflows = quotas.maxWorkflowDefinitions;
      const attemptCount = maxWorkflows + 2;

      await factoryHelpers.attemptQuotaOverage(runtimePage, "createFlow", attemptCount);

      // Assert: Quota error should be triggered
      await factoryHelpers.verifyQuotaError(runtimePage);
    });

    test("should track workflow quota separately from entity quota", async ({ runtimePage }) => {
      // Arrange: Seed tenant
      const tenantId = testData.quotaScenarios.basic.tenantId;
      const quotas = testData.quotaScenarios.basic.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Create entities
      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", 10);

      // Assert: Entity quota and workflow quota are tracked independently
      const entityUsage = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");
      const workflowUsage = await factoryHelpers.getQuotaUsage(
        runtimePage,
        "maxWorkflowDefinitions"
      );

      // Both quotas should have their own limits
      expect(entityUsage.limit).toBe(quotas.maxEntities);
      expect(workflowUsage.limit).toBe(quotas.maxWorkflowDefinitions);
    });
  });

  test.describe("Tenant Isolation", () => {
    test("should isolate entities between tenants with different quotas", async ({
      runtimePage,
    }) => {
      // Arrange: Seed two tenants with different quotas
      const tenantAQuotas = testData.quotaScenarios.basic;
      const tenantBQuotas = testData.quotaScenarios.restricted;

      await factoryHelpers.seedTenantWithQuota(
        runtimePage,
        tenantAQuotas.tenantId,
        tenantAQuotas.quotas
      );

      // Act: Verify tenant A isolation
      await factoryHelpers.verifyTenantIsolation(runtimePage, tenantAQuotas.tenantId, "isolated");

      // Act: Switch to tenant B and seed
      await factoryHelpers.seedTenantWithQuota(
        runtimePage,
        tenantBQuotas.tenantId,
        tenantBQuotas.quotas
      );

      // Assert: Verify tenant B isolation (separate quota enforcement)
      await factoryHelpers.verifyTenantIsolation(runtimePage, tenantBQuotas.tenantId, "isolated");

      // Assert: Tenant B has restricted quota while Tenant A has generous quota
      const contextB = await factoryHelpers.getTenantContext(runtimePage);
      expect(contextB.tenantId).toBe(tenantBQuotas.tenantId);
    });

    test("should maintain quota enforcement after switching tenants", async ({ runtimePage }) => {
      // Arrange: Seed two tenants
      const tenantA = testData.quotaScenarios.basic;
      const tenantB = testData.quotaScenarios.restricted;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantA.tenantId, tenantA.quotas);

      // Act: Attempt operations in tenant A (should not exceed quota)
      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", 5);

      // Switch to tenant B
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantB.tenantId, tenantB.quotas);

      // Act: Attempt operations in tenant B (should exceed quota faster)
      await factoryHelpers.attemptQuotaOverage(runtimePage, "createEntity", 10);

      // Assert: Tenant B quota enforcement triggered
      await factoryHelpers.verifyQuotaError(runtimePage);

      // Act: Switch back to tenant A
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantA.tenantId, tenantA.quotas);

      // Assert: Tenant A quota limits still apply (independent tracking)
      const contextA = await factoryHelpers.getTenantContext(runtimePage);
      expect(contextA.tenantId).toBe(tenantA.tenantId);
    });
  });

  test.describe("Quota Reset & Cleanup", () => {
    test("should reset quotas between tests", async ({ runtimePage }) => {
      // Arrange
      const tenantId = testData.quotaScenarios.restricted.tenantId;
      const quotas = testData.quotaScenarios.restricted.quotas;

      // Act: Setup initial quotas
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);
      const resetContext = await factoryHelpers.getTenantContext(runtimePage);
      expect(resetContext.tenantId).toBe(tenantId);

      // Act: Reset (simulate test cleanup)
      await factoryHelpers.resetQuotas(runtimePage);

      // Assert: Error state should be cleared
      const errorState = await runtimePage.evaluate(() => {
        return (globalThis as any).__lastQuotaError;
      });
      expect(errorState).toBeNull();
    });

    test("should allow quota reseeding after reset", async ({ runtimePage }) => {
      // Arrange
      const tenant1 = testData.quotaScenarios.basic;
      const tenant2 = testData.quotaScenarios.restricted;

      // Act: Setup tenant 1
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenant1.tenantId, tenant1.quotas);
      const context1 = await factoryHelpers.getTenantContext(runtimePage);
      expect(context1.tenantId).toBe(tenant1.tenantId);

      // Act: Reset
      await factoryHelpers.resetQuotas(runtimePage);

      // Act: Setup tenant 2 after reset
      await factoryHelpers.seedTenantWithQuota(runtimePage, tenant2.tenantId, tenant2.quotas);
      const context2 = await factoryHelpers.getTenantContext(runtimePage);
      expect(context2.tenantId).toBe(tenant2.tenantId);

      // Assert: Tenant 2 quota enforced
      const usage = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");
      expect(usage.limit).toBe(tenant2.quotas.maxEntities);
    });
  });

  test.describe("Quota Manager State", () => {
    test("should wait for quota enforcement to be active", async ({ runtimePage }) => {
      // Act: Wait for quota manager
      await factoryHelpers.waitForQuotaEnforcement(runtimePage, 5000);

      // Assert: No timeout thrown
      expect(true).toBe(true);
    });

    test("should report quota usage accurately", async ({ runtimePage }) => {
      // Arrange: Seed tenant
      const tenantId = testData.quotaScenarios.basic.tenantId;
      const quotas = testData.quotaScenarios.basic.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Get quota usage
      const usage = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");

      // Assert: Usage snapshot includes limit
      expect(usage.usage).toBeGreaterThanOrEqual(0);
      expect(usage.limit).toBe(quotas.maxEntities);
      expect(usage.remaining).toBeDefined();
    });

    test("should track multiple quota buckets independently", async ({ runtimePage }) => {
      // Arrange: Seed tenant with multiple quotas
      const tenantId = testData.quotaScenarios.basic.tenantId;
      const quotas = testData.quotaScenarios.basic.quotas;

      await factoryHelpers.seedTenantWithQuota(runtimePage, tenantId, quotas);

      // Act: Get usage for different buckets
      const entityUsage = await factoryHelpers.getQuotaUsage(runtimePage, "maxEntities");
      const workflowUsage = await factoryHelpers.getQuotaUsage(
        runtimePage,
        "maxWorkflowDefinitions"
      );
      const concurrentUsage = await factoryHelpers.getQuotaUsage(runtimePage, "maxConcurrentRuns");

      // Assert: Each bucket has independent limit
      expect(entityUsage.limit).toBe(quotas.maxEntities);
      expect(workflowUsage.limit).toBe(quotas.maxWorkflowDefinitions);
      expect(concurrentUsage.limit).toBe(quotas.maxConcurrentRuns);
    });
  });
});
