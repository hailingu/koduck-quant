/**
 * RuntimeTenantContext Unit Tests
 *
 * @description
 * Test all functions of the tenant context manager to ensure context setting, getting, syncing, and clearing work correctly.
 *
 * @coverage
 * - Constructor and initialization
 * - Context setting (setTenantContext)
 * - Context getting (getTenantContext)
 * - Context checking (hasTenantContext)
 * - DI container sync
 * - Boundary conditions and error handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeTenantContext } from "../../../src/common/runtime/runtime-tenant-context";
import { createCoreContainer } from "../../../src/common/di/bootstrap";
import type { IDependencyContainer } from "../../../src/common/di/types";
import { TOKENS } from "../../../src/common/di/tokens";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";

/**
 * Create a complete test tenant context
 */
function createTestContext(overrides?: Partial<ResolvedTenantContext>): ResolvedTenantContext {
  return {
    tenantId: "tenant-test",
    environment: "production",
    environmentKey: {
      tenantId: overrides?.tenantId ?? "tenant-test",
      environment: overrides?.environment ?? "production",
    },
    normalizedEnvironmentKey: `${overrides?.tenantId ?? "tenant-test"}::${overrides?.environment ?? "production"}`,
    ...overrides,
  };
}

describe("RuntimeTenantContext", () => {
  let container: IDependencyContainer;
  let tenantContext: RuntimeTenantContext;

  beforeEach(() => {
    container = createCoreContainer();
    tenantContext = new RuntimeTenantContext(container);
  });

  describe("Constructor and Initialization", () => {
    it("should successfully create an instance", () => {
      expect(tenantContext).toBeDefined();
    });

    it("should throw an error when container is null", () => {
      const fn = () => new RuntimeTenantContext(null as unknown as IDependencyContainer);
      expect(fn).toThrow("Container cannot be null or undefined");
    });

    it("should throw an error when container is undefined", () => {
      const fn = () => new RuntimeTenantContext(undefined as unknown as IDependencyContainer);
      expect(fn).toThrow("Container cannot be null or undefined");
    });

    it("should have no tenant context on initialization", () => {
      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });
  });

  describe("setTenantContext() - Set Tenant Context", () => {
    it("should successfully set tenant context", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      expect(tenantContext.hasTenantContext()).toBe(true);
      const retrieved = tenantContext.getTenantContext();
      expect(retrieved).toBeDefined();
      expect(retrieved?.tenantId).toBe("tenant-123");
      expect(retrieved?.environment).toBe("production");
    });

    it("should deep clone tenant context instead of referencing", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
        quotas: { maxEntities: 1000 },
      });

      tenantContext.setTenantContext(context);

      // Modify original object
      context.quotas!.maxEntities = 999;

      // Internal state should not be affected
      const retrieved = tenantContext.getTenantContext();
      expect(retrieved?.quotas?.maxEntities).toBe(1000);
    });

    it("should sync tenant context to DI container", () => {
      const context = createTestContext({
        tenantId: "tenant-456",
        environment: "staging",
      });

      tenantContext.setTenantContext(context);

      const registered = container.resolve<ResolvedTenantContext>(TOKENS.tenantContext);
      expect(registered).toBeDefined();
      expect(registered.tenantId).toBe("tenant-456");
    });

    it("should sync tenant quotas to DI container", () => {
      const context = createTestContext({
        tenantId: "tenant-789",
        environment: "production",
        quotas: {
          maxEntities: 500,
        },
      });

      tenantContext.setTenantContext(context);

       
      const quotas = container.resolve<any>(TOKENS.tenantQuota);
      expect(quotas).toBeDefined();
      expect(quotas.maxEntities).toBe(500);
    });

    it("should sync tenant Rollout config to DI container", () => {
      const context = createTestContext({
        tenantId: "tenant-rollout",
        environment: "production",
        rollout: {
          percentage: 50,
          variant: "beta",
        },
      });

      tenantContext.setTenantContext(context);

       
      const rollout = container.resolve<any>(TOKENS.tenantRollout);
      expect(rollout).toBeDefined();
      expect(rollout.percentage).toBe(50);
      expect(rollout.variant).toBe("beta");
    });

    it("should set quota in DI container to null when quota does not exist", () => {
      const context = createTestContext({
        tenantId: "tenant-no-quota",
        environment: "production",
        // No quotas field
      });

      tenantContext.setTenantContext(context);

      const quotas = container.resolve(TOKENS.tenantQuota);
      expect(quotas).toBeNull();
    });

    it("should set Rollout in DI container to null when Rollout does not exist", () => {
      const context = createTestContext({
        tenantId: "tenant-no-rollout",
        environment: "production",
        // No rollout field
      });

      tenantContext.setTenantContext(context);

      const rollout = container.resolve(TOKENS.tenantRollout);
      expect(rollout).toBeNull();
    });

    it("should support passing null to clear tenant context", () => {
      // First set context
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });
      tenantContext.setTenantContext(context);
      expect(tenantContext.hasTenantContext()).toBe(true);

      // Clear context
      tenantContext.setTenantContext(null);

      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("should support passing undefined to clear tenant context", () => {
      // First set context
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });
      tenantContext.setTenantContext(context);
      expect(tenantContext.hasTenantContext()).toBe(true);

      // Clear context
      tenantContext.setTenantContext(undefined);

      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("should clean up DI container when clearing context", () => {
      // First set context
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
        quotas: { maxEntities: 1000 },
        rollout: { percentage: 50 },
      });
      tenantContext.setTenantContext(context);

      // Clear context
      tenantContext.setTenantContext(null);

      // Verify values in DI container are cleared
      expect(container.resolve(TOKENS.tenantContext)).toBeNull();
      expect(container.resolve(TOKENS.tenantQuota)).toBeNull();
      expect(container.resolve(TOKENS.tenantRollout)).toBeNull();
    });

    it("should support replacing existing tenant context", () => {
      const context1 = createTestContext({
        tenantId: "tenant-old",
        environment: "staging",
      });
      const context2 = createTestContext({
        tenantId: "tenant-new",
        environment: "production",
      });

      tenantContext.setTenantContext(context1);
      expect(tenantContext.getTenantContext()?.tenantId).toBe("tenant-old");

      tenantContext.setTenantContext(context2);
      expect(tenantContext.getTenantContext()?.tenantId).toBe("tenant-new");
    });
  });

  describe("getTenantContext() - Get Tenant Context", () => {
    it("should return a deep clone of tenant context", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
        quotas: {
          maxEntities: 1000,
        },
      });

      tenantContext.setTenantContext(context);

      const retrieved = tenantContext.getTenantContext();
      expect(retrieved).toBeDefined();

      // Modifying returned object should not affect internal state
      retrieved!.tenantId = "tenant-modified";
      retrieved!.quotas!.maxEntities = 9999;

      const retrieved2 = tenantContext.getTenantContext();
      expect(retrieved2?.tenantId).toBe("tenant-123");
      expect(retrieved2?.quotas?.maxEntities).toBe(1000);
    });

    it("should return undefined when no tenant context", () => {
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("should return a new copy each time", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      const copy1 = tenantContext.getTenantContext();
      const copy2 = tenantContext.getTenantContext();

      // Should be different object references
      expect(copy1).not.toBe(copy2);
      // But content should be the same
      expect(copy1).toEqual(copy2);
    });
  });

  describe("hasTenantContext() - Check if Tenant Context Exists", () => {
    it("should return false when no tenant context", () => {
      expect(tenantContext.hasTenantContext()).toBe(false);
    });

    it("should return true when tenant context exists", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      expect(tenantContext.hasTenantContext()).toBe(true);
    });

    it("should return false after clearing tenant context", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);
      expect(tenantContext.hasTenantContext()).toBe(true);

      tenantContext.setTenantContext(null);
      expect(tenantContext.hasTenantContext()).toBe(false);
    });
  });

  describe("Boundary Conditions and Error Handling", () => {
    it("should handle complete tenant context with all fields", () => {
      const context = createTestContext({
        tenantId: "tenant-full",
        environment: "production",
        displayName: "Full Tenant",
        metadata: {
          region: "us-west",
          tier: "premium",
        },
        quotas: {
          maxEntities: 5000,
        },
        rollout: {
          percentage: 75,
          variant: "v2",
          cohort: "early-adopters",
          features: {
            newFeature: true,
            betaFeature: false,
          },
        },
      });

      tenantContext.setTenantContext(context);

      const retrieved = tenantContext.getTenantContext();
      expect(retrieved).toBeDefined();
      expect(retrieved?.displayName).toBe("Full Tenant");
      expect(retrieved?.metadata?.region).toBe("us-west");
      expect(retrieved?.quotas?.maxEntities).toBe(5000);
      expect(retrieved?.rollout?.percentage).toBe(75);
      expect(retrieved?.rollout?.features?.newFeature).toBe(true);
    });

    it("should handle minimal tenant context (only required fields)", () => {
      const context = createTestContext({
        tenantId: "tenant-minimal",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      const retrieved = tenantContext.getTenantContext();
      expect(retrieved).toBeDefined();
      expect(retrieved?.tenantId).toBe("tenant-minimal");
      expect(retrieved?.quotas).toBeUndefined();
      expect(retrieved?.rollout).toBeUndefined();
    });

    it("should correctly handle alternating set and clear operations", () => {
      const context1 = createTestContext({
        tenantId: "tenant-1",
        environment: "staging",
      });
      const context2 = createTestContext({
        tenantId: "tenant-2",
        environment: "production",
      });

      tenantContext.setTenantContext(context1);
      expect(tenantContext.getTenantContext()?.tenantId).toBe("tenant-1");

      tenantContext.setTenantContext(null);
      expect(tenantContext.hasTenantContext()).toBe(false);

      tenantContext.setTenantContext(context2);
      expect(tenantContext.getTenantContext()?.tenantId).toBe("tenant-2");

      tenantContext.setTenantContext(undefined);
      expect(tenantContext.hasTenantContext()).toBe(false);
    });
  });
});
