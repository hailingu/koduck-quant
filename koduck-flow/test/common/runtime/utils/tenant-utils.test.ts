/**
 * Tenant utility function unit tests
 */

import { describe, it, expect } from "vitest";
import {
  cloneTenantContext,
  cloneTenantResourceQuotas,
} from "../../../../src/common/runtime/utils/tenant-utils";
import type {
  ResolvedTenantContext,
  TenantResourceQuota,
} from "../../../../src/common/runtime/tenant-context";

describe("tenant-utils", () => {
  describe("cloneTenantResourceQuotas", () => {
    it("should return undefined for undefined input", () => {
      const result = cloneTenantResourceQuotas(undefined);
      expect(result).toBeUndefined();
    });

    it("should clone quotas without custom field", () => {
      const original: TenantResourceQuota = {
        maxEntities: 100,
        maxWorkflowDefinitions: 50,
      };

      const cloned = cloneTenantResourceQuotas(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });

    it("should deep clone quotas with custom field", () => {
      const original: TenantResourceQuota = {
        maxEntities: 100,
        maxConcurrentRuns: 10,
        custom: {
          maxConnections: 50,
          maxApiCalls: 1000,
        },
      };

      const cloned = cloneTenantResourceQuotas(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned?.custom).not.toBe(original.custom);
    });

    it("should not affect original when modifying cloned quotas", () => {
      const original: TenantResourceQuota = {
        maxEntities: 100,
        custom: {
          maxConnections: 50,
        },
      };

      const cloned = cloneTenantResourceQuotas(original)!;
      cloned.maxEntities = 200;
      cloned.custom!.maxConnections = 100;

      expect(original.maxEntities).toBe(100);
      expect(original.custom!.maxConnections).toBe(50);
    });
  });

  describe("cloneTenantContext", () => {
    it("should return undefined for undefined input", () => {
      const result = cloneTenantContext(undefined);
      expect(result).toBeUndefined();
    });

    it("should clone minimal context", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
      };

      const cloned = cloneTenantContext(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned?.environmentKey).not.toBe(original.environmentKey);
    });

    it("should clone context with displayName", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        displayName: "Production Tenant",
      };

      const cloned = cloneTenantContext(original);

      expect(cloned?.displayName).toBe("Production Tenant");
    });

    it("should deep clone context with quotas", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        quotas: {
          maxEntities: 100,
          custom: {
            maxConnections: 50,
          },
        },
      };

      const cloned = cloneTenantContext(original);

      expect(cloned?.quotas).toEqual(original.quotas);
      expect(cloned?.quotas).not.toBe(original.quotas);
      expect(cloned?.quotas?.custom).not.toBe(original.quotas?.custom);
    });

    it("should deep clone context with metadata", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        metadata: {
          version: "1.0.0",
          tags: ["premium", "enterprise"],
        },
      };

      const cloned = cloneTenantContext(original);

      expect(cloned?.metadata).toEqual(original.metadata);
      expect(cloned?.metadata).not.toBe(original.metadata);
    });

    it("should deep clone context with rollout config", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        rollout: {
          variant: "beta",
          cohort: "early-adopters",
          percentage: 25,
          features: {
            newUI: true,
            aiAssistant: false,
          },
        },
      };

      const cloned = cloneTenantContext(original);

      expect(cloned?.rollout).toEqual(original.rollout);
      expect(cloned?.rollout).not.toBe(original.rollout);
      expect(cloned?.rollout?.features).not.toBe(original.rollout?.features);
    });

    it("should clone rollout config without features", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        rollout: {
          variant: "stable",
          cohort: "general",
          percentage: 100,
        },
      };

      const cloned = cloneTenantContext(original);

      expect(cloned?.rollout).toEqual(original.rollout);
      expect(cloned?.rollout?.features).toBeUndefined();
    });

    it("should not affect original when modifying cloned context", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-1",
        environment: "production",
        environmentKey: { environment: "production", tenantId: "tenant-1" },
        normalizedEnvironmentKey: "production_tenant-1",
        quotas: {
          maxEntities: 100,
          custom: { maxConnections: 50 },
        },
        metadata: { version: "1.0.0" },
        rollout: {
          percentage: 50,
          features: { newUI: true },
        },
      };

      const cloned = cloneTenantContext(original)!;

      // Modify cloned object
      cloned.tenantId = "tenant-2";
      cloned.environmentKey.environment = "staging";
      cloned.quotas!.maxEntities = 200;
      cloned.quotas!.custom!.maxConnections = 100;
      cloned.metadata!.version = "2.0.0";
      cloned.rollout!.percentage = 75;
      cloned.rollout!.features!.newUI = false;

      // Verify original object is not affected
      expect(original.tenantId).toBe("tenant-1");
      expect(original.environmentKey.environment).toBe("production");
      expect(original.quotas?.maxEntities).toBe(100);
      expect(original.quotas?.custom?.maxConnections).toBe(50);
      expect(original.metadata?.version).toBe("1.0.0");
      expect(original.rollout?.percentage).toBe(50);
      expect(original.rollout?.features?.newUI).toBe(true);
    });

    it("should clone complete context with all fields", () => {
      const original: ResolvedTenantContext = {
        tenantId: "tenant-123",
        environment: "staging",
        environmentKey: {
          environment: "staging",
          tenantId: "tenant-123",
        },
        normalizedEnvironmentKey: "staging_tenant-123",
        displayName: "Staging EU Tenant",
        quotas: {
          maxEntities: 500,
          maxWorkflowDefinitions: 100,
          maxConcurrentRuns: 20,
          custom: {
            maxConnections: 100,
            maxApiCalls: 5000,
            rateLimit: 1000,
          },
        },
        metadata: {
          version: "2.1.0",
          tags: ["staging", "eu"],
          createdAt: "2024-01-01",
        },
        rollout: {
          variant: "canary",
          cohort: "internal-testing",
          percentage: 10,
          features: {
            newUI: true,
            aiAssistant: true,
            experimentalFeature: false,
          },
        },
      };

      const cloned = cloneTenantContext(original)!;

      // Verify all fields are correctly cloned
      expect(cloned).toEqual(original);

      // Verify all nested objects are new references
      expect(cloned).not.toBe(original);
      expect(cloned.environmentKey).not.toBe(original.environmentKey);
      expect(cloned.quotas).not.toBe(original.quotas);
      expect(cloned.quotas?.custom).not.toBe(original.quotas?.custom);
      expect(cloned.metadata).not.toBe(original.metadata);
      expect(cloned.rollout).not.toBe(original.rollout);
      expect(cloned.rollout?.features).not.toBe(original.rollout?.features);
    });
  });
});
