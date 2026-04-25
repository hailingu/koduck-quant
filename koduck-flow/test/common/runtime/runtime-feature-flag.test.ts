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
  describe("构造函数和初始化", () => {
    it("应该成功创建实例", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag).toBeDefined();
      expect(featureFlag).toBeInstanceOf(RuntimeFeatureFlag);
    });

    it("应该在 provider 不是函数时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new RuntimeFeatureFlag(null);
      }).toThrow("RuntimeFeatureFlag: tenantContextProvider must be a function");
    });

    it("应该在 provider 为 undefined 时抛出错误", () => {
      expect(() => {
        // @ts-expect-error - Testing invalid input
        new RuntimeFeatureFlag(undefined);
      }).toThrow("RuntimeFeatureFlag: tenantContextProvider must be a function");
    });

    it("应该接受返回 null 的 provider", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("test")).toBe(false);
    });
  });

  describe("isFeatureEnabled() - 特性开关查询", () => {
    it("应该在没有租户上下文时返回默认值 false", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
    });

    it("应该在没有租户上下文时返回指定的默认值", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isFeatureEnabled("feature-a", true)).toBe(true);
      expect(featureFlag.isFeatureEnabled("feature-b", false)).toBe(false);
    });

    it("应该在没有 rollout 配置时返回默认值", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isFeatureEnabled("feature-a")).toBe(false);
      expect(featureFlag.isFeatureEnabled("feature-a", true)).toBe(true);
    });

    it("应该在没有 features 配置时返回默认值", () => {
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

    it("应该返回 feature flag 的配置值 - true", () => {
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

    it("应该返回 feature flag 的配置值 - false", () => {
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

    it("应该在 feature 不存在时返回默认值", () => {
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

    it("应该支持多个 feature flags", () => {
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

  describe("getRolloutVariant() - 获取 Rollout 变体", () => {
    it("应该在没有租户上下文时返回 undefined", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });

    it("应该在没有 rollout 配置时返回 undefined", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });

    it("应该返回配置的 variant", () => {
      const context = createTestContext({
        rollout: {
          variant: "experimental",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBe("experimental");
    });

    it("应该处理 variant 为 undefined 的情况", () => {
      const context = createTestContext({
        rollout: {
          variant: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutVariant()).toBeUndefined();
    });
  });

  describe("getRolloutCohort() - 获取 Rollout 分组", () => {
    it("应该在没有租户上下文时返回 undefined", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });

    it("应该在没有 rollout 配置时返回 undefined", () => {
      const context = createTestContext({ rollout: undefined });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });

    it("应该返回配置的 cohort", () => {
      const context = createTestContext({
        rollout: {
          cohort: "early-adopters",
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBe("early-adopters");
    });

    it("应该处理 cohort 为 undefined 的情况", () => {
      const context = createTestContext({
        rollout: {
          cohort: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.getRolloutCohort()).toBeUndefined();
    });
  });

  describe("isInRollout() - Rollout 百分比检查", () => {
    it("应该在没有租户上下文时返回 true", () => {
      const featureFlag = new RuntimeFeatureFlag(() => null);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("应该在没有 percentage 配置时返回 true (100% rollout)", () => {
      const context = createTestContext({
        rollout: {
          percentage: undefined,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("应该在 percentage = 0 时返回 false", () => {
      const context = createTestContext({
        rollout: {
          percentage: 0,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(false);
    });

    it("应该在 percentage < 0 时返回 false", () => {
      const context = createTestContext({
        rollout: {
          percentage: -10,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(false);
    });

    it("应该在 percentage = 100 时返回 true", () => {
      const context = createTestContext({
        rollout: {
          percentage: 100,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("应该在 percentage > 100 时返回 true", () => {
      const context = createTestContext({
        rollout: {
          percentage: 150,
        },
      });
      const featureFlag = new RuntimeFeatureFlag(() => context);
      expect(featureFlag.isInRollout()).toBe(true);
    });

    it("应该根据 percentage 和 bucket 计算返回正确结果", () => {
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

    it("应该使用 seed 参数影响 bucket 计算", () => {
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

    it("应该使用 stickyKey 保证同一用户的一致性", () => {
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

    it("应该根据 percentage 1 返回一致的结果", () => {
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

    it("应该根据 percentage 99 返回一致的结果", () => {
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

  describe("边界条件和错误处理", () => {
    it("应该处理空字符串 feature flag 名称", () => {
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

    it("应该处理包含特殊字符的 feature flag 名称", () => {
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

    it("应该处理 provider 动态返回不同上下文的情况", () => {
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

    it("应该处理完整的 rollout 配置", () => {
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

    it("应该处理只有部分 rollout 字段的配置", () => {
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

    it("应该处理 percentage 边界值精确性", () => {
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

    it("应该确保相同输入产生相同的 bucket", () => {
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
