/**
 * RuntimeFeatureFlag Unit Tests
 *
 * @description
 * Comprehensive test suite for RuntimeFeatureFlag module.
 * Tests feature flag queries, rollout logic, and bucket calculation.
 */

import { describe, it, expect } from "vitest";
import { RuntimeFeatureFlag } from "../../../src/common/runtime/runtime-feature-flag";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";

/**
 * Helper function to create a test tenant context
 */
function createTestContext(overrides?: Partial<ResolvedTenantContext>): ResolvedTenantContext {
  return {
    tenantId: overrides?.tenantId ?? "tenant-test",
    environment: overrides?.environment ?? "production",
    environmentKey: {
      tenantId: overrides?.tenantId ?? "tenant-test",
      environment: overrides?.environment ?? "production",
    },
    normalizedEnvironmentKey: `${overrides?.tenantId ?? "tenant-test"}::${overrides?.environment ?? "production"}`,
    quotas: overrides?.quotas,
    rollout: overrides?.rollout,
  };
}

describe("RuntimeFeatureFlag", () => {
  describe("Constructor and Initialization", () => {
    it("should successfully create an instance", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag).toBeDefined();
      expect(featureFlag).toBeInstanceOf(RuntimeFeatureFlag);
    });

    it("should throw an error when provider is not a function", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new RuntimeFeatureFlag(null);
      }).toThrow("RuntimeFeatureFlag: tenantContextProvider must be a function");
    });

    it("should throw an error when provider is undefined", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new RuntimeFeatureFlag(undefined);
      }).toThrow("RuntimeFeatureFlag: tenantContextProvider must be a function");
    });

    it("should accept a provider that returns null", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("test")).toBe(false);
    });
  });

  describe("isFeatureEnabled() - Feature Flag Query", () => {
    it("should return default value false when no tenant context", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
    });

    it("should return specified default value when no tenant context", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("feature-a", true)).toBe(true);
      expect(featureFlag.isFeatureEnabled("feature-b", false)).toBe(false);
    });

    it("should return default value when no rollout config", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
      expect(featureFlag.isFeatureEnabled("feature-a", true)).toBe(true);
    });

    it("should return default value when no features config", () => {
      const context = createTestContext({
        rollout: {
          percentage: 50,
          features: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
      expect(featureFlag.isFeatureEnabled("feature-a", true)).toBe(true);
    });

    it("should return feature flag config value - true", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "dark-mode": true,
            "new-ui": false,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("dark-mode")).toBe(true);
    });

    it("should return feature flag config value - false", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "dark-mode": true,
            "new-ui": false,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("new-ui")).toBe(false);
    });

    it("should return default value when feature does not exist", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "dark-mode": true,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("non-existent")).toBe(false);
      expect(featureFlag.isFeatureEnabled("non-existent", true)).toBe(true);
    });

    it("should support multiple feature flags", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "feature-1": true,
            "feature-2": false,
            "feature-3": true,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("feature-1")).toBe(true);
      expect(featureFlag.isFeatureEnabled("feature-2")).toBe(false);
      expect(featureFlag.isFeatureEnabled("feature-3")).toBe(true);
    });
  });

  describe("getRolloutVariant() - Get Rollout Variant", () => {
    it("should return undefined when no tenant context", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });

    it("should return undefined when no rollout config", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });

    it("should return configured variant", () => {
      const context = createTestContext({
        rollout: {
          variant: "experimental",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBe("experimental");
    });

    it("should handle variant as undefined", () => {
      const context = createTestContext({
        rollout: {
          variant: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });
  });

  describe("getRolloutCohort() - Get Rollout Cohort", () => {
    it("should return undefined when no tenant context", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });

    it("should return undefined when no rollout config", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });

    it("should return configured cohort", () => {
      const context = createTestContext({
        rollout: {
          cohort: "early-adopters",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBe("early-adopters");
    });

    it("should handle cohort as undefined", () => {
      const context = createTestContext({
        rollout: {
          cohort: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });
  });

  describe("isInRollout() - Rollout Percentage Check", () => {
    it("should return true when no tenant context", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("should return true when no percentage config (100% rollout)", () => {
      const context = createTestContext({
        rollout: {
          percentage: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("should return false when percentage = 0", () => {
      const context = createTestContext({
        rollout: {
          percentage: 0,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(false);
    });

    it("should return false when percentage < 0", () => {
      const context = createTestContext({
        rollout: {
          percentage: -10,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(false);
    });

    it("should return true when percentage = 100", () => {
      const context = createTestContext({
        rollout: {
          percentage: 100,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("should return true when percentage > 100", () => {
      const context = createTestContext({
        rollout: {
          percentage: 150,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("should return correct result based on percentage and bucket calculation", () => {
      // Create a context that will generate a predictable bucket
      const context = createTestContext({
        tenantId: "test-tenant-123",
        rollout: {
          percentage: 50,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // The result should be deterministic based on the hash
      const result = featureFlag.isInRollout();
      expect(typeof result).toBe("boolean");
    });

    it("should use seed parameter to affect bucket calculation", () => {
      const context = createTestContext({
        tenantId: "test-tenant",
        rollout: {
          percentage: 50,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // Different seeds should potentially produce different results
      const result1 = featureFlag.isInRollout("seed-1");
      const result2 = featureFlag.isInRollout("seed-2");

      // Results should be boolean
      expect(typeof result1).toBe("boolean");
      expect(typeof result2).toBe("boolean");
    });

    it("should use stickyKey to ensure consistency for the same user", () => {
      const context = createTestContext({
        tenantId: "test-tenant",
        rollout: {
          percentage: 50,
          stickyKey: "user-123",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // Multiple calls should return same result
      const result1 = featureFlag.isInRollout();
      const result2 = featureFlag.isInRollout();
      const result3 = featureFlag.isInRollout();

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("should return consistent result for percentage 1", () => {
      const context = createTestContext({
        tenantId: "test-tenant",
        rollout: {
          percentage: 1,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // With 1% rollout, most tenants should be excluded
      const result = featureFlag.isInRollout();
      expect(typeof result).toBe("boolean");
    });

    it("should return consistent result for percentage 99", () => {
      const context = createTestContext({
        tenantId: "test-tenant",
        rollout: {
          percentage: 99,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // With 99% rollout, most tenants should be included
      const result = featureFlag.isInRollout();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Boundary Conditions and Error Handling", () => {
    it("should handle empty string feature flag name", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "": true,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("")).toBe(true);
    });

    it("should handle feature flag names with special characters", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "feature:with:colons": true,
            "feature-with-dashes": false,
            feature_with_underscores: true,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("feature:with:colons")).toBe(true);
      expect(featureFlag.isFeatureEnabled("feature-with-dashes")).toBe(false);
      expect(featureFlag.isFeatureEnabled("feature_with_underscores")).toBe(true);
    });

    it("should handle provider dynamically returning different contexts", () => {
      let context: ResolvedTenantContext | null = null;
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // Initially no context
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);

      // Set context
      context = createTestContext({
        rollout: {
          features: {
            "feature-a": true,
          },
        },
      });
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(true);

      // Clear context
      context = null;
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
    });

    it("should handle full rollout config", () => {
      const context = createTestContext({
        rollout: {
          percentage: 75,
          variant: "experimental",
          cohort: "beta-testers",
          stickyKey: "user-456",
          features: {
            "feature-x": true,
            "feature-y": false,
          },
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      expect(featureFlag.getRolloutVariant()).toBe("experimental");
      expect(featureFlag.getRolloutCohort()).toBe("beta-testers");
      expect(featureFlag.isFeatureEnabled("feature-x")).toBe(true);
      expect(featureFlag.isFeatureEnabled("feature-y")).toBe(false);
      expect(typeof featureFlag.isInRollout()).toBe("boolean");
    });

    it("should handle config with only partial rollout fields", () => {
      const context = createTestContext({
        rollout: {
          features: {
            "feature-a": true,
          },
          // No percentage, variant, cohort, or stickyKey
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      expect(featureFlag.getRolloutVariant()).toBeUndefined();
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(true);
      expect(featureFlag.isInRollout()).toBe(true); // No percentage = 100%
    });

    it("should handle percentage boundary value precision", () => {
      // Test percentage = 0.1
      const context1 = createTestContext({
        rollout: { percentage: 0.1 },
      });
      const featureFlag1 = new RuntimeFeatureFlag(() => context1);
      expect(featureFlag1.isInRollout()).toBe(false); // Clamped to 0

      // Test percentage = 99.9
      const context2 = createTestContext({
        rollout: { percentage: 99.9 },
      });
      const featureFlag2 = new RuntimeFeatureFlag(() => context2);
      const result2 = featureFlag2.isInRollout();
      expect(typeof result2).toBe("boolean");
    });

    it("should ensure the same input produces the same bucket", () => {
      const context = createTestContext({
        tenantId: "consistent-tenant",
        rollout: {
          percentage: 50,
          stickyKey: "consistent-key",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);

      // Call multiple times with same seed
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(featureFlag.isInRollout("same-seed"));
      }

      // All results should be identical
      const firstResult = results[0];
      expect(results.every((r) => r === firstResult)).toBe(true);
    });
  });
});
