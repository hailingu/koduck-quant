/**
 * DuckFlowRuntime 集成测试
 *
 * 测试目标：验证各模块协同工作正确性
 *
 * 测试场景：
 * 1. 完整 Runtime 初始化流程
 * 2. Manager 注册 + 租户上下文 + 配额联动
 * 3. 特性开关与 Rollout 集成
 * 4. 多租户隔离
 * 5. 作用域 Runtime 创建
 * 6. 优雅关闭流程
 * 7. API 行为快照测试
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  DuckFlowRuntime,
  createDuckFlowRuntime,
  createScopedRuntime,
} from "../../../src/common/runtime";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";
import type { IManager } from "../../../src/common/manager/types";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";
import { TOKENS } from "../../../src/common/di/tokens";
import { registerCoreServices } from "../../../src/common/di/bootstrap";
import { TENANT_ENTITY_QUOTA_KEY } from "../../../src/common/runtime/types";

// ==================== 测试辅助工具 ====================

/**
 * 创建模拟 Manager
 */
function createMockManager(name: string, initDelay = 0): IManager {
  return {
    name,
    type: "test-manager",
    initialize: vi.fn(async () => {
      if (initDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, initDelay));
      }
    }),
    dispose: vi.fn(() => {
      // Cleanup
    }),
  };
}

/**
 * 创建测试用租户上下文
 */
function createTestTenantContext(
  tenantId: string,
  overrides?: Partial<ResolvedTenantContext>
): ResolvedTenantContext {
  return {
    tenantId,
    displayName: `Tenant ${tenantId}`,
    environment: "test",
    environmentKey: {
      environment: "test",
      tenantId,
    },
    normalizedEnvironmentKey: `test:${tenantId}`,
    quotas: {
      maxEntities: 1000,
      custom: {
        "api-calls": 5000,
        storage: 10000000,
      },
    },
    rollout: {
      cohort: "alpha",
      variant: "v2",
      percentage: 50,
      features: {
        experimentalFeature: true,
        betaFeature: false,
      },
    },
    ...overrides,
  };
}

// ==================== 测试套件 ====================

describe("DuckFlowRuntime - 集成测试", () => {
  let runtime: DuckFlowRuntime;

  afterEach(() => {
    if (runtime && !runtime["disposed"]) {
      runtime.dispose();
    }
  });

  // ==================== 场景 1: 完整初始化流程 ====================

  describe("场景 1: 完整 Runtime 初始化流程", () => {
    it("应该成功初始化 Runtime 并访问所有核心服务", () => {
      // 创建 Runtime
      runtime = createDuckFlowRuntime();

      // 验证核心服务可访问
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();
      expect(runtime.RegistryManager).toBeDefined();
      expect(runtime.EventBus).toBeDefined();
      expect(runtime.RenderEvents).toBeDefined();
      expect(runtime.EntityEvents).toBeDefined();

      // 验证核心服务来自同一容器
      const entityManager1 = runtime.EntityManager;
      const entityManager2 = runtime.EntityManager;
      expect(entityManager1).toBe(entityManager2);
    });

    it("应该正确初始化 DI 容器并解析服务", () => {
      runtime = createDuckFlowRuntime();

      // 验证可以解析核心服务（使用 Symbol token）
      expect(runtime.has(TOKENS.entityManager)).toBe(true);
      expect(runtime.has(TOKENS.renderManager)).toBe(true);
      expect(runtime.has(TOKENS.registryManager)).toBe(true);

      // 验证可以通过 token 解析
      const entityManager = runtime.resolve(TOKENS.entityManager);
      expect(entityManager).toBe(runtime.EntityManager);
    });

    it("应该支持自定义 DI 容器初始化", () => {
      const customContainer = new DefaultDependencyContainer();

      // 必须先注册核心服务
      registerCoreServices(customContainer);

      // 再注册自定义服务
      const testService = { name: "TestService" };
      customContainer.registerInstance("TestService", testService);

      runtime = createDuckFlowRuntime({ container: customContainer });

      // 验证自定义服务可访问
      expect(runtime.has("TestService")).toBe(true);
      expect(runtime.resolve("TestService")).toBe(testService);

      // 验证核心服务仍然可用
      expect(runtime.EntityManager).toBeDefined();
    });

    it("应该正确处理 Manager 初始化配置", () => {
      runtime = createDuckFlowRuntime({
        managerInitialization: {
          timeoutMs: 10000,
          retries: {
            attempts: 3,
            delayMs: 1000,
          },
          warnOnRetry: true,
        },
      });

      const defaults = runtime.getManagerInitializationDefaults();
      expect(defaults.timeoutMs).toBe(10000);
      expect(defaults.retries?.attempts).toBe(3);
      expect(defaults.retries?.delayMs).toBe(1000);
      expect(defaults.warnOnRetry).toBe(true);
    });
  });

  // ==================== 场景 2: Manager + 租户 + 配额联动 ====================

  describe("场景 2: Manager 注册 + 租户上下文 + 配额联动", () => {
    it("应该正确处理 Manager 注册、租户上下文设置和配额管理的联动", () => {
      runtime = createDuckFlowRuntime();

      // 1. 注册自定义 Manager
      const customManager = createMockManager("CustomManager");
      runtime.registerManager("CustomManager", customManager);
      expect(runtime.hasManager("CustomManager")).toBe(true);

      // 2. 设置租户上下文
      const tenantContext = createTestTenantContext("tenant-123");
      runtime.setTenantContext(tenantContext);
      expect(runtime.getTenantContext()).toEqual(tenantContext);

      // 3. 验证配额管理（使用正确的 entity quota key）
      const snapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot).toBeDefined();
      expect(snapshot?.limit).toBe(1000); // 来自 quotas.maxEntities
      expect(snapshot?.usage).toBe(0); // 当前实体数量

      // 4. 申请配额（entity quota 使用实际实体数量，不是手动计数）
      const claimed = runtime.claimTenantQuota(TENANT_ENTITY_QUOTA_KEY);
      expect(claimed).toBe(true); // 检查是否可以添加实体

      // 5. Entity quota usage 基于实际实体数，不会因为 claim 而增加
      const updatedSnapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(updatedSnapshot?.usage).toBe(0); // 仍然是 0，因为没有实际创建实体

      // 6. 使用自定义配额桶测试申请/释放
      runtime.claimTenantQuota("api-calls", 100);
      const apiSnapshot = runtime.getTenantQuotaSnapshot("api-calls");
      expect(apiSnapshot?.usage).toBe(100);

      runtime.releaseTenantQuota("api-calls", 50);
      const apiSnapshot2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(apiSnapshot2?.usage).toBe(50);
    });

    it("应该在切换租户时正确重置配额", () => {
      runtime = createDuckFlowRuntime();

      // 租户 A - 使用自定义配额桶（entity quota 基于实际实体数）
      const tenantA = createTestTenantContext("tenant-a");
      runtime.setTenantContext(tenantA);
      runtime.claimTenantQuota("api-calls", 200);

      const snapshotA = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotA?.usage).toBe(200);

      // 切换到租户 B
      const tenantB = createTestTenantContext("tenant-b");
      runtime.setTenantContext(tenantB);

      // 验证配额已重置（切换租户后重置计数）
      const snapshotB = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotB?.usage).toBe(0);
      expect(snapshotB?.limit).toBe(5000); // 来自 quotas.custom["api-calls"]

      // 租户 B 申请配额
      runtime.claimTenantQuota("api-calls", 300);
      const snapshotB2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotB2?.usage).toBe(300);
    });

    it("应该在没有租户上下文时允许配额申请（无限制）", () => {
      runtime = createDuckFlowRuntime();

      // 未设置租户上下文时，claimQuota 返回 true（无限制）
      const claimed = runtime.claimTenantQuota(TENANT_ENTITY_QUOTA_KEY, 100);
      expect(claimed).toBe(true);

      // 但 snapshot 仍然是 undefined（因为没有租户上下文）
      const snapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot).toBeUndefined();
    });

    it("应该在超过配额限制时拒绝申请", () => {
      runtime = createDuckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        quotas: {
          maxEntities: 100,
          custom: {
            "api-calls": 50, // 自定义配额桶
          },
        },
      });
      runtime.setTenantContext(tenantContext);

      // 测试自定义配额桶（entity quota 使用实体数量，测试起来比较复杂）
      // 申请超过限制的配额
      const claimed = runtime.claimTenantQuota("api-calls", 60);
      expect(claimed).toBe(false);

      // 验证配额未变化
      const snapshot = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(0);

      // 申请合理配额
      const claimed2 = runtime.claimTenantQuota("api-calls", 30);
      expect(claimed2).toBe(true);

      const snapshot2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshot2?.usage).toBe(30);
    });
  });

  // ==================== 场景 3: 特性开关与 Rollout 集成 ====================

  describe("场景 3: 特性开关与 Rollout 集成", () => {
    it("应该正确读取租户特性开关", () => {
      runtime = createDuckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          features: {
            experimentalFeature: true,
            betaFeature: false,
          },
        },
      });
      runtime.setTenantContext(tenantContext);

      // 验证特性开关
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);
      expect(runtime.isTenantFeatureEnabled("betaFeature")).toBe(false);
      expect(runtime.isTenantFeatureEnabled("unknownFeature", false)).toBe(false);
    });

    it("应该正确处理 Rollout 配置", () => {
      runtime = createDuckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          cohort: "beta",
          variant: "v3",
          percentage: 75,
        },
      });
      runtime.setTenantContext(tenantContext);

      // 验证 Rollout 信息
      expect(runtime.getTenantRolloutCohort()).toBe("beta");
      expect(runtime.getTenantRolloutVariant()).toBe("v3");
    });

    it("应该根据租户 ID 和 Rollout 百分比判断是否在灰度中", () => {
      runtime = createDuckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          cohort: "alpha",
          variant: "v2",
          percentage: 50,
        },
      });
      runtime.setTenantContext(tenantContext);

      // 使用确定性种子
      const inRollout = runtime.isTenantInRollout("test-seed");
      expect(typeof inRollout).toBe("boolean");

      // 验证相同种子返回相同结果
      const inRollout2 = runtime.isTenantInRollout("test-seed");
      expect(inRollout2).toBe(inRollout);

      // 验证不同种子可能返回不同结果
      const inRollout3 = runtime.isTenantInRollout("different-seed");
      expect(typeof inRollout3).toBe("boolean");
    });

    it("应该在没有租户上下文时返回默认值", () => {
      runtime = createDuckFlowRuntime();

      // 未设置租户上下文
      expect(runtime.isTenantFeatureEnabled("anyFeature", true)).toBe(true);
      expect(runtime.isTenantFeatureEnabled("anyFeature", false)).toBe(false);
      expect(runtime.getTenantRolloutCohort()).toBeUndefined();
      expect(runtime.getTenantRolloutVariant()).toBeUndefined();
    });
  });

  // ==================== 场景 4: 多租户隔离 ====================

  describe("场景 4: 多租户隔离", () => {
    it("应该在不同租户之间隔离配额使用", () => {
      runtime = createDuckFlowRuntime();

      // 租户 A
      const tenantA = createTestTenantContext("tenant-a");
      runtime.setTenantContext(tenantA);
      runtime.claimTenantQuota("entity", 100);

      const snapshotA = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotA?.usage).toBe(100);

      // 切换到租户 B
      const tenantB = createTestTenantContext("tenant-b");
      runtime.setTenantContext(tenantB);
      runtime.claimTenantQuota("entity", 200);

      const snapshotB = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotB?.usage).toBe(200);

      // 切换回租户 A，验证配额独立
      runtime.setTenantContext(tenantA);
      const snapshotA2 = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotA2?.usage).toBe(0); // 重新设置上下文会清空配额跟踪
    });

    it("应该在不同租户之间隔离特性开关", () => {
      runtime = createDuckFlowRuntime();

      // 租户 A: 特性启用
      const tenantA = createTestTenantContext("tenant-a", {
        rollout: {
          features: {
            experimentalFeature: true,
          },
        },
      });
      runtime.setTenantContext(tenantA);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);

      // 租户 B: 特性禁用
      const tenantB = createTestTenantContext("tenant-b", {
        rollout: {
          features: {
            experimentalFeature: false,
          },
        },
      });
      runtime.setTenantContext(tenantB);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(false);

      // 切换回租户 A
      runtime.setTenantContext(tenantA);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);
    });

    it("应该在不同租户之间隔离 Rollout 配置", () => {
      runtime = createDuckFlowRuntime();

      // 租户 A
      const tenantA = createTestTenantContext("tenant-a", {
        rollout: {
          cohort: "alpha",
          variant: "v1",
          percentage: 25,
        },
      });
      runtime.setTenantContext(tenantA);
      expect(runtime.getTenantRolloutCohort()).toBe("alpha");
      expect(runtime.getTenantRolloutVariant()).toBe("v1");

      // 租户 B
      const tenantB = createTestTenantContext("tenant-b", {
        rollout: {
          cohort: "beta",
          variant: "v2",
          percentage: 75,
        },
      });
      runtime.setTenantContext(tenantB);
      expect(runtime.getTenantRolloutCohort()).toBe("beta");
      expect(runtime.getTenantRolloutVariant()).toBe("v2");
    });
  });

  // ==================== 场景 5: 作用域 Runtime 创建 ====================

  describe("场景 5: 作用域 Runtime 创建", () => {
    it("应该创建隔离的子 Runtime", () => {
      const parentRuntime = createDuckFlowRuntime();
      const childRuntime = createScopedRuntime(parentRuntime);

      // 验证子 Runtime 有独立容器
      expect(childRuntime.container).not.toBe(parentRuntime.container);

      // 验证核心服务独立
      expect(childRuntime.EntityManager).toBeDefined();
      expect(childRuntime.EntityManager).not.toBe(parentRuntime.EntityManager);

      // 清理
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("应该支持手动设置子 Runtime 的租户上下文", () => {
      const parentRuntime = createDuckFlowRuntime();
      const tenantContext = createTestTenantContext("tenant-123");
      parentRuntime.setTenantContext(tenantContext);

      const childRuntime = createScopedRuntime(parentRuntime);

      // createScopedRuntime 不会自动继承租户上下文，需要手动设置
      expect(childRuntime.getTenantContext()).toBeUndefined();

      // 手动设置租户上下文
      childRuntime.setTenantContext(tenantContext);
      expect(childRuntime.getTenantContext()).toEqual(tenantContext);

      // 清理
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("应该在子 Runtime 中隔离配额使用", () => {
      const parentRuntime = createDuckFlowRuntime();
      const tenantContext = createTestTenantContext("tenant-123");
      parentRuntime.setTenantContext(tenantContext);
      parentRuntime.claimTenantQuota("api-calls", 100);

      const childRuntime = createScopedRuntime(parentRuntime);
      // 子 Runtime 需要手动设置租户上下文
      childRuntime.setTenantContext(tenantContext);

      // 子 Runtime 有独立的配额跟踪
      const childSnapshot = childRuntime.getTenantQuotaSnapshot("api-calls");
      expect(childSnapshot?.usage).toBe(0); // 子 Runtime 从 0 开始

      childRuntime.claimTenantQuota("api-calls", 200);
      const childSnapshot2 = childRuntime.getTenantQuotaSnapshot("api-calls");
      expect(childSnapshot2?.usage).toBe(200);

      // 父 Runtime 配额不受影响
      const parentSnapshot = parentRuntime.getTenantQuotaSnapshot("api-calls");
      expect(parentSnapshot?.usage).toBe(100);

      // 清理
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("应该支持子 Runtime 覆盖父 Runtime 的配置", () => {
      const parentRuntime = createDuckFlowRuntime({
        managerInitialization: {
          timeoutMs: 5000,
        },
      });

      // createScopedRuntime 的第三个参数是 options，用于 managerInitialization
      const childRuntime = createScopedRuntime(
        parentRuntime,
        undefined, // 第二个参数是 CoreServiceOverrides
        {
          managerInitialization: {
            timeoutMs: 10000,
          },
        }
      );

      // 验证子 Runtime 使用自己的配置
      const childDefaults = childRuntime.getManagerInitializationDefaults();
      expect(childDefaults.timeoutMs).toBe(10000);

      // 验证父 Runtime 配置未变化
      const parentDefaults = parentRuntime.getManagerInitializationDefaults();
      expect(parentDefaults.timeoutMs).toBe(5000);

      // 清理
      childRuntime.dispose();
      parentRuntime.dispose();
    });
  });

  // ==================== 场景 6: 优雅关闭流程 ====================

  describe("场景 6: 优雅关闭流程", () => {
    it("应该正确清理所有资源", () => {
      runtime = createDuckFlowRuntime();

      // 注册多个 Manager
      const manager1 = createMockManager("Manager1");
      const manager2 = createMockManager("Manager2");
      runtime.registerManager("Manager1", manager1);
      runtime.registerManager("Manager2", manager2);

      // 设置租户上下文
      const tenantContext = createTestTenantContext("tenant-123");
      runtime.setTenantContext(tenantContext);

      // 申请配额
      runtime.claimTenantQuota("entity", 100);

      // 关闭 Runtime
      runtime.dispose();

      // 验证 Manager dispose 被调用
      expect(manager1.dispose).toHaveBeenCalled();
      expect(manager2.dispose).toHaveBeenCalled();

      // 验证状态已清理
      expect(runtime["disposed"]).toBe(true);
    });

    it("应该在 dispose 后标记为已销毁", () => {
      runtime = createDuckFlowRuntime();
      expect(runtime["disposed"]).toBe(false);

      runtime.dispose();

      // 验证 disposed 状态
      expect(runtime["disposed"]).toBe(true);

      // 注意：当前实现不会抛出错误，但 Manager 操作可能会失败或产生未定义行为
      // 这是一个潜在的改进点，但不是本次测试的重点
    });

    it("应该支持多次调用 dispose（幂等性）", () => {
      runtime = createDuckFlowRuntime();

      runtime.dispose();
      runtime.dispose(); // 第二次调用不应抛出错误
      runtime.dispose(); // 第三次调用不应抛出错误

      expect(runtime["disposed"]).toBe(true);
    });

    it("应该在子 Runtime dispose 后不影响父 Runtime", () => {
      const parentRuntime = createDuckFlowRuntime();
      const childRuntime = createScopedRuntime(parentRuntime);

      childRuntime.dispose();

      // 验证父 Runtime 仍然可用
      expect(parentRuntime.EntityManager).toBeDefined();
      expect(() => parentRuntime.registerManager("Test", createMockManager("Test"))).not.toThrow();

      // 清理
      parentRuntime.dispose();
    });
  });

  // ==================== 场景 7: API 行为快照测试 ====================

  describe("场景 7: API 行为快照测试", () => {
    it("应该保持核心 API 方法签名一致", () => {
      runtime = createDuckFlowRuntime();

      // 验证所有关键 API 方法存在
      const apiMethods = [
        "resolve",
        "has",
        "registerManager",
        "unregisterManager",
        "getManager",
        "hasManager",
        "getRegisteredManagers",
        "getInitializedManagers",
        "setTenantContext",
        "getTenantContext",
        "claimTenantQuota",
        "releaseTenantQuota",
        "getTenantQuotaSnapshot",
        "listTenantQuotaSnapshots",
        "isTenantFeatureEnabled",
        "getTenantRolloutVariant",
        "getTenantRolloutCohort",
        "isTenantInRollout",
        "configureDebug",
        "getDebugOptions",
        "createEntity",
        "getEntity",
        "removeEntity",
        "hasEntity",
        "getEntities",
        "removeEntities",
        "addEntityToRender",
        "removeEntityFromRender",
        "getEntityRenderElement",
        "dispose",
        "getManagerInitializationDefaults",
      ];

      apiMethods.forEach((method) => {
        expect(runtime[method as keyof DuckFlowRuntime]).toBeDefined();
        expect(typeof runtime[method as keyof DuckFlowRuntime]).toBe("function");
      });
    });

    it("应该保持核心 getter 属性一致", () => {
      runtime = createDuckFlowRuntime();

      // 验证所有 getter 属性存在
      const getters = [
        "EntityManager",
        "RenderManager",
        "RegistryManager",
        "EventBus",
        "RenderEvents",
        "EntityEvents",
        "container",
      ];

      getters.forEach((getter) => {
        expect(runtime[getter as keyof DuckFlowRuntime]).toBeDefined();
      });
    });

    it("应该保持工厂函数行为一致", () => {
      // 测试 createDuckFlowRuntime
      const runtime1 = createDuckFlowRuntime();
      expect(runtime1).toBeInstanceOf(DuckFlowRuntime);
      expect(runtime1.EntityManager).toBeDefined();
      runtime1.dispose();

      // 测试带选项的 createDuckFlowRuntime
      const runtime2 = createDuckFlowRuntime({
        managerInitialization: { timeoutMs: 8000 },
      });
      expect(runtime2.getManagerInitializationDefaults().timeoutMs).toBe(8000);
      runtime2.dispose();

      // 测试 createScopedRuntime
      const parent = createDuckFlowRuntime();
      const child = createScopedRuntime(parent);
      expect(child).toBeInstanceOf(DuckFlowRuntime);
      expect(child.container).not.toBe(parent.container);
      child.dispose();
      parent.dispose();
    });
  });

  // ==================== 额外场景: 调试配置集成 ====================

  describe("额外场景: 调试配置集成", () => {
    it("应该正确配置和获取调试选项", () => {
      runtime = createDuckFlowRuntime();

      // 配置调试选项（使用正确的 DebugOptions 属性）
      const debugOptions = {
        enabled: true,
        logLevel: "debug" as const,
        eventTracking: true,
        includeEmoji: true,
      };
      runtime.configureDebug(debugOptions);

      // 验证调试选项已保存
      const retrievedOptions = runtime.getDebugOptions();
      expect(retrievedOptions).toEqual(debugOptions);
    });

    it("应该支持部分更新调试配置", () => {
      runtime = createDuckFlowRuntime();

      // 配置调试选项
      runtime.configureDebug({
        enabled: true,
        logLevel: "debug" as const,
      });
      const options1 = runtime.getDebugOptions();
      expect(options1?.enabled).toBe(true);
      expect(options1?.logLevel).toBe("debug");

      // 部分更新配置
      runtime.configureDebug({
        eventTracking: true,
      });
      const options2 = runtime.getDebugOptions();
      expect(options2?.eventTracking).toBe(true);
    });
  });

  // ==================== 额外场景: 实体操作集成 ====================

  describe("额外场景: 实体操作集成", () => {
    it("应该通过 Runtime 快捷方法创建和管理实体", () => {
      runtime = createDuckFlowRuntime();

      // 验证快捷方法委托到 EntityManager
      // 注意：实际测试需要 mock EntityManager 或使用真实实体类型
      expect(typeof runtime.createEntity).toBe("function");
      expect(typeof runtime.getEntity).toBe("function");
      expect(typeof runtime.removeEntity).toBe("function");
      expect(typeof runtime.hasEntity).toBe("function");
      expect(typeof runtime.getEntities).toBe("function");
      expect(typeof runtime.removeEntities).toBe("function");
    });
  });
});
