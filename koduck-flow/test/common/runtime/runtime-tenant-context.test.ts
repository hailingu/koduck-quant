/**
 * RuntimeTenantContext 单元测试
 *
 * @description
 * 测试租户上下文管理器的所有功能，确保上下文设置、获取、同步和清空正常工作。
 *
 * @coverage
 * - 构造函数和初始化
 * - 上下文设置 (setTenantContext)
 * - 上下文获取 (getTenantContext)
 * - 上下文检查 (hasTenantContext)
 * - DI 容器同步
 * - 边界条件和错误处理
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RuntimeTenantContext } from "../../../src/common/runtime/runtime-tenant-context";
import { createCoreContainer } from "../../../src/common/di/bootstrap";
import type { IDependencyContainer } from "../../../src/common/di/types";
import { TOKENS } from "../../../src/common/di/tokens";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";

/**
 * 创建测试用的完整租户上下文
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

  describe("构造函数和初始化", () => {
    it("应该成功创建实例", () => {
      expect(tenantContext).toBeDefined();
    });

    it("应该在容器为 null 时抛出错误", () => {
      const fn = () => new RuntimeTenantContext(null as unknown as IDependencyContainer);
      expect(fn).toThrow("Container cannot be null or undefined");
    });

    it("应该在容器为 undefined 时抛出错误", () => {
      const fn = () => new RuntimeTenantContext(undefined as unknown as IDependencyContainer);
      expect(fn).toThrow("Container cannot be null or undefined");
    });

    it("应该初始化时没有租户上下文", () => {
      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });
  });

  describe("setTenantContext() - 设置租户上下文", () => {
    it("应该成功设置租户上下文", () => {
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

    it("应该对租户上下文进行深拷贝，而非引用", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
        quotas: { maxEntities: 1000 },
      });

      tenantContext.setTenantContext(context);

      // 修改原始对象
      context.quotas!.maxEntities = 999;

      // 内部状态不应受影响
      const retrieved = tenantContext.getTenantContext();
      expect(retrieved?.quotas?.maxEntities).toBe(1000);
    });

    it("应该同步租户上下文到 DI 容器", () => {
      const context = createTestContext({
        tenantId: "tenant-456",
        environment: "staging",
      });

      tenantContext.setTenantContext(context);

      const registered = container.resolve<ResolvedTenantContext>(TOKENS.tenantContext);
      expect(registered).toBeDefined();
      expect(registered.tenantId).toBe("tenant-456");
    });

    it("应该同步租户配额到 DI 容器", () => {
      const context = createTestContext({
        tenantId: "tenant-789",
        environment: "production",
        quotas: {
          maxEntities: 500,
        },
      });

      tenantContext.setTenantContext(context);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotas = container.resolve<any>(TOKENS.tenantQuota);
      expect(quotas).toBeDefined();
      expect(quotas.maxEntities).toBe(500);
    });

    it("应该同步租户 Rollout 配置到 DI 容器", () => {
      const context = createTestContext({
        tenantId: "tenant-rollout",
        environment: "production",
        rollout: {
          percentage: 50,
          variant: "beta",
        },
      });

      tenantContext.setTenantContext(context);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rollout = container.resolve<any>(TOKENS.tenantRollout);
      expect(rollout).toBeDefined();
      expect(rollout.percentage).toBe(50);
      expect(rollout.variant).toBe("beta");
    });

    it("应该在配额不存在时将 DI 容器中的配额设置为 null", () => {
      const context = createTestContext({
        tenantId: "tenant-no-quota",
        environment: "production",
        // 没有 quotas 字段
      });

      tenantContext.setTenantContext(context);

      const quotas = container.resolve(TOKENS.tenantQuota);
      expect(quotas).toBeNull();
    });

    it("应该在 Rollout 不存在时将 DI 容器中的 Rollout 设置为 null", () => {
      const context = createTestContext({
        tenantId: "tenant-no-rollout",
        environment: "production",
        // 没有 rollout 字段
      });

      tenantContext.setTenantContext(context);

      const rollout = container.resolve(TOKENS.tenantRollout);
      expect(rollout).toBeNull();
    });

    it("应该支持传入 null 清空租户上下文", () => {
      // 先设置上下文
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });
      tenantContext.setTenantContext(context);
      expect(tenantContext.hasTenantContext()).toBe(true);

      // 清空上下文
      tenantContext.setTenantContext(null);

      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("应该支持传入 undefined 清空租户上下文", () => {
      // 先设置上下文
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });
      tenantContext.setTenantContext(context);
      expect(tenantContext.hasTenantContext()).toBe(true);

      // 清空上下文
      tenantContext.setTenantContext(undefined);

      expect(tenantContext.hasTenantContext()).toBe(false);
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("应该在清空上下文时清理 DI 容器", () => {
      // 先设置上下文
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
        quotas: { maxEntities: 1000 },
        rollout: { percentage: 50 },
      });
      tenantContext.setTenantContext(context);

      // 清空上下文
      tenantContext.setTenantContext(null);

      // 验证 DI 容器中的值被清空
      expect(container.resolve(TOKENS.tenantContext)).toBeNull();
      expect(container.resolve(TOKENS.tenantQuota)).toBeNull();
      expect(container.resolve(TOKENS.tenantRollout)).toBeNull();
    });

    it("应该支持替换现有的租户上下文", () => {
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

  describe("getTenantContext() - 获取租户上下文", () => {
    it("应该返回租户上下文的深拷贝", () => {
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

      // 修改返回的对象不应影响内部状态
      retrieved!.tenantId = "tenant-modified";
      retrieved!.quotas!.maxEntities = 9999;

      const retrieved2 = tenantContext.getTenantContext();
      expect(retrieved2?.tenantId).toBe("tenant-123");
      expect(retrieved2?.quotas?.maxEntities).toBe(1000);
    });

    it("应该在没有租户上下文时返回 undefined", () => {
      expect(tenantContext.getTenantContext()).toBeUndefined();
    });

    it("应该每次返回新的副本", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      const copy1 = tenantContext.getTenantContext();
      const copy2 = tenantContext.getTenantContext();

      // 应该是不同的对象引用
      expect(copy1).not.toBe(copy2);
      // 但内容应该相同
      expect(copy1).toEqual(copy2);
    });
  });

  describe("hasTenantContext() - 检查租户上下文是否存在", () => {
    it("应该在没有租户上下文时返回 false", () => {
      expect(tenantContext.hasTenantContext()).toBe(false);
    });

    it("应该在有租户上下文时返回 true", () => {
      const context = createTestContext({
        tenantId: "tenant-123",
        environment: "production",
      });

      tenantContext.setTenantContext(context);

      expect(tenantContext.hasTenantContext()).toBe(true);
    });

    it("应该在清空租户上下文后返回 false", () => {
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

  describe("边界条件和错误处理", () => {
    it("应该处理包含所有字段的完整租户上下文", () => {
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

    it("应该处理最小化的租户上下文（只有必填字段）", () => {
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

    it("应该正确处理多次设置和清空的交替操作", () => {
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
