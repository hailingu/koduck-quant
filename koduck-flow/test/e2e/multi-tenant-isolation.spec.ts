import { test, expect, E2EHelpers, testData } from "./fixtures";

test.describe("Multi-tenant Isolation (E2E-003)", () => {
  test("should switch between tenants successfully", async ({ runtimePage }) => {
    // Switch to tenant A
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);

    // Verify tenant context
    await E2EHelpers.verifyTenantIsolation(runtimePage, testData.tenants.tenantA.id);

    // Switch to tenant B
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantB.id);

    // Verify tenant context changed
    await E2EHelpers.verifyTenantIsolation(runtimePage, testData.tenants.tenantB.id);
  });

  test("should isolate entities between tenants", async ({ runtimePage }) => {
    const entityA = { id: "tenant-a-entity", type: "node", name: "Tenant A Entity" };
    const entityB = { id: "tenant-b-entity", type: "node", name: "Tenant B Entity" };

    // Create entity in tenant A
    await E2EHelpers.createEntityInTenant(runtimePage, testData.tenants.tenantA.id, entityA);
    await E2EHelpers.verifyEntityExists(runtimePage, entityA.id);

    // Switch to tenant B
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantB.id);

    // Verify entity A is not visible in tenant B
    const entityAElement = runtimePage.locator(`[data-testid="entity-${entityA.id}"]`);
    await expect(entityAElement).not.toBeVisible();

    // Create entity in tenant B
    await E2EHelpers.createEntityInTenant(runtimePage, testData.tenants.tenantB.id, entityB);
    await E2EHelpers.verifyEntityExists(runtimePage, entityB.id);

    // Switch back to tenant A
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);

    // Verify entity B is not visible in tenant A
    const entityBElement = runtimePage.locator(`[data-testid="entity-${entityB.id}"]`);
    await expect(entityBElement).not.toBeVisible();

    // But entity A should still be visible
    await E2EHelpers.verifyEntityExists(runtimePage, entityA.id);
  });

  test("should isolate flows between tenants", async ({ runtimePage }) => {
    const flowA = {
      id: "tenant-a-flow",
      name: "Tenant A Flow",
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "end", type: "end", position: { x: 200, y: 100 } },
      ],
      connections: [{ from: "start", to: "end" }],
    };

    const flowB = {
      id: "tenant-b-flow",
      name: "Tenant B Flow",
      nodes: [
        { id: "start", type: "start", position: { x: 100, y: 100 } },
        { id: "end", type: "end", position: { x: 200, y: 100 } },
      ],
      connections: [{ from: "start", to: "end" }],
    };

    // Create flow in tenant A
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);
    await E2EHelpers.createFlow(runtimePage, flowA);
    await expect(runtimePage.locator(`[data-testid="flow-${flowA.id}"]`)).toBeVisible();

    // Switch to tenant B
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantB.id);

    // Verify flow A is not visible
    const flowAElement = runtimePage.locator(`[data-testid="flow-${flowA.id}"]`);
    await expect(flowAElement).not.toBeVisible();

    // Create flow in tenant B
    await E2EHelpers.createFlow(runtimePage, flowB);
    await expect(runtimePage.locator(`[data-testid="flow-${flowB.id}"]`)).toBeVisible();

    // Switch back to tenant A
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);

    // Verify flow B is not visible, but flow A is
    const flowBElement = runtimePage.locator(`[data-testid="flow-${flowB.id}"]`);
    await expect(flowBElement).not.toBeVisible();
    await expect(runtimePage.locator(`[data-testid="flow-${flowA.id}"]`)).toBeVisible();
  });

  test("should maintain tenant-specific configurations", async ({ runtimePage }) => {
    // Switch to tenant A (light theme)
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);

    // Verify theme configuration
    await expect(runtimePage.locator('[data-testid="theme-indicator"]')).toHaveAttribute(
      "data-theme",
      "light"
    );

    // Switch to tenant B (dark theme)
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantB.id);

    // Verify theme changed
    await expect(runtimePage.locator('[data-testid="theme-indicator"]')).toHaveAttribute(
      "data-theme",
      "dark"
    );

    // Verify feature availability (tenant B has only basic features)
    await expect(runtimePage.locator('[data-testid="advanced-feature"]')).not.toBeVisible();
    await expect(runtimePage.locator('[data-testid="basic-feature"]')).toBeVisible();
  });

  test("should prevent cross-tenant data access", async ({ runtimePage }) => {
    // Create sensitive data in tenant A
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantA.id);
    const sensitiveEntity = { id: "sensitive-data", type: "data", name: "Sensitive Data" };
    await E2EHelpers.createTestEntity(runtimePage, sensitiveEntity);

    // Try to access from tenant B (should fail or not show)
    await E2EHelpers.switchTenant(runtimePage, testData.tenants.tenantB.id);

    // Verify sensitive data is not accessible
    const sensitiveElement = runtimePage.locator(`[data-testid="entity-${sensitiveEntity.id}"]`);
    await expect(sensitiveElement).not.toBeVisible();

    // Verify no data leakage in any form
    const allEntities = await runtimePage.locator('[data-testid^="entity-"]').allTextContents();
    expect(allEntities.join("")).not.toContain("Sensitive Data");
  });
});
