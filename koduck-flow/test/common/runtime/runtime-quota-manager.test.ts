import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeQuotaManager } from "../../../src/common/runtime/runtime-quota-manager";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";
import { TENANT_ENTITY_QUOTA_KEY } from "../../../src/common/runtime/types";
import { logger } from "../../../src/common/logger";

/**
 * 创建测试用的租户上下文
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

describe("RuntimeQuotaManager", () => {
  let quotaManager: RuntimeQuotaManager;
  let tenantContext: ResolvedTenantContext | null;
  let entityCount: number;

  // Provider functions
  const getTenantContext = () => tenantContext;
  const getEntityCount = () => entityCount;

  beforeEach(() => {
    tenantContext = null;
    entityCount = 0;
    quotaManager = new RuntimeQuotaManager(getTenantContext, getEntityCount);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("构造函数和初始化", () => {
    it("应该成功创建配额管理器实例", () => {
      expect(quotaManager).toBeDefined();
      expect(quotaManager).toBeInstanceOf(RuntimeQuotaManager);
    });

    it("应该接受租户上下文提供函数", () => {
      const manager = new RuntimeQuotaManager(
        () => createTestContext(),
        () => 0
      );
      expect(manager).toBeDefined();
    });

    it("应该接受实体数量提供函数", () => {
      const manager = new RuntimeQuotaManager(
        () => null,
        () => 42
      );
      expect(manager).toBeDefined();
    });
  });

  describe("claimQuota() - 配额申请", () => {
    it("无租户上下文时应该总是返回 true", () => {
      tenantContext = null;
      expect(quotaManager.claimQuota("api-calls", 10)).toBe(true);
      expect(quotaManager.claimQuota("storage", 100)).toBe(true);
    });

    it("空桶名应该返回 true", () => {
      tenantContext = createTestContext();
      expect(quotaManager.claimQuota("", 10)).toBe(true);
    });

    it("amount <= 0 应该返回 true", () => {
      tenantContext = createTestContext();
      expect(quotaManager.claimQuota("api-calls", 0)).toBe(true);
      expect(quotaManager.claimQuota("api-calls", -5)).toBe(true);
    });

    it("无配额限制时应该总是返回 true", () => {
      tenantContext = createTestContext(); // 无 quotas 配置
      expect(quotaManager.claimQuota("api-calls", 100)).toBe(true);
      expect(quotaManager.claimQuota("storage", 1000)).toBe(true);
    });

    it("应该成功申请配额（未超限）", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
          },
        },
      });

      expect(quotaManager.claimQuota("api-calls", 10)).toBe(true);
      expect(quotaManager.claimQuota("api-calls", 20)).toBe(true);
      expect(quotaManager.claimQuota("api-calls", 30)).toBe(true);
    });

    it("应该拒绝申请配额（超限）", () => {
      const warnSpy = vi.spyOn(logger, "warn");
      tenantContext = createTestContext({
        tenantId: "tenant-quota-test",
        quotas: {
          custom: {
            "api-calls": 50,
          },
        },
      });

      // 申请 40，成功
      expect(quotaManager.claimQuota("api-calls", 40)).toBe(true);

      // 再申请 20，总共 60，超过限制 50，失败
      expect(quotaManager.claimQuota("api-calls", 20)).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith("DuckFlowRuntime tenant quota exceeded", {
        tenantId: "tenant-quota-test",
        bucket: "api-calls",
        limit: 50,
        attempted: 60,
      });
    });

    it("应该正确累加配额使用量", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 10);
      const snapshot1 = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot1?.usage).toBe(10);

      quotaManager.claimQuota("api-calls", 20);
      const snapshot2 = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot2?.usage).toBe(30);

      quotaManager.claimQuota("api-calls", 15);
      const snapshot3 = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot3?.usage).toBe(45);
    });

    it("应该支持多个配额桶", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
            storage: 500,
            bandwidth: 1000,
          },
        },
      });

      expect(quotaManager.claimQuota("api-calls", 50)).toBe(true);
      expect(quotaManager.claimQuota("storage", 200)).toBe(true);
      expect(quotaManager.claimQuota("bandwidth", 800)).toBe(true);

      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(50);
      expect(quotaManager.getQuotaSnapshot("storage")?.usage).toBe(200);
      expect(quotaManager.getQuotaSnapshot("bandwidth")?.usage).toBe(800);
    });

    it("实体配额应该调用 ensureEntityQuotaAvailable()", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;

      expect(quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1)).toBe(true);

      entityCount = 10; // 已达限制
      expect(quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1)).toBe(false);
    });
  });

  describe("releaseQuota() - 配额释放", () => {
    it("空桶名应该返回当前使用量", () => {
      tenantContext = createTestContext();
      expect(quotaManager.releaseQuota("", 10)).toBe(0);
    });

    it("amount <= 0 应该返回当前使用量", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      expect(quotaManager.releaseQuota("api-calls", 0)).toBe(50);
      expect(quotaManager.releaseQuota("api-calls", -5)).toBe(50);
    });

    it("应该正确释放配额", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 50);
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(50);

      const remaining = quotaManager.releaseQuota("api-calls", 20);
      expect(remaining).toBe(30);
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(30);
    });

    it("释放量大于使用量时应该归零", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 30);

      const remaining = quotaManager.releaseQuota("api-calls", 100);
      expect(remaining).toBe(0);
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(0);
    });

    it("使用量归零后应该删除配额桶", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      quotaManager.releaseQuota("api-calls", 50);
      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(0);
    });

    it("未申请过的配额桶释放应该返回 0", () => {
      tenantContext = createTestContext();
      expect(quotaManager.releaseQuota("non-existent", 10)).toBe(0);
    });

    it("实体配额释放应该同步实际数量", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;
      quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1);

      entityCount = 3; // 实体数量减少
      const remaining = quotaManager.releaseQuota(TENANT_ENTITY_QUOTA_KEY, 1);

      // 应该同步为实际数量 3，而不是 5-1=4
      expect(remaining).toBe(3);
    });
  });

  describe("getQuotaSnapshot() - 配额快照", () => {
    it("无租户上下文应该返回 undefined", () => {
      tenantContext = null;
      expect(quotaManager.getQuotaSnapshot("api-calls")).toBeUndefined();
    });

    it("应该返回正确的配额快照（有限制）", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 40);
      const snapshot = quotaManager.getQuotaSnapshot("api-calls");

      expect(snapshot).toEqual({
        key: "api-calls",
        usage: 40,
        limit: 100,
        remaining: 60,
      });
    });

    it("应该返回正确的配额快照（无限制）", () => {
      tenantContext = createTestContext(); // 无 quotas 配置
      quotaManager.claimQuota("api-calls", 50);

      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot).toEqual({
        key: "api-calls",
        usage: 50,
      });
      expect(snapshot?.limit).toBeUndefined();
      expect(snapshot?.remaining).toBeUndefined();
    });

    it("应该返回正确的配额快照（已用尽）", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 50,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 50);
      const snapshot = quotaManager.getQuotaSnapshot("api-calls");

      expect(snapshot).toEqual({
        key: "api-calls",
        usage: 50,
        limit: 50,
        remaining: 0,
      });
    });

    it("应该返回正确的配额快照（超额，不应该出现但需防御）", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 50,
          },
        },
      });

      // 手动设置超额使用量（测试防御逻辑）
      quotaManager.claimQuota("api-calls", 40);
      quotaManager.claimQuota("api-calls", 15); // 总共 55，超过 50

      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(40); // 第二次申请失败，只有 40
      expect(snapshot?.remaining).toBe(10);
    });
  });

  describe("listQuotaSnapshots() - 列出所有配额快照", () => {
    it("无租户上下文应该返回空数组", () => {
      tenantContext = null;
      expect(quotaManager.listQuotaSnapshots()).toEqual([]);
    });

    it("应该列出所有已使用的配额桶", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
            storage: 500,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 30);
      quotaManager.claimQuota("storage", 200);

      const snapshots = quotaManager.listQuotaSnapshots();
      expect(snapshots).toHaveLength(2);

      const apiSnapshot = snapshots.find((s) => s.key === "api-calls");
      expect(apiSnapshot).toEqual({
        key: "api-calls",
        usage: 30,
        limit: 100,
        remaining: 70,
      });

      const storageSnapshot = snapshots.find((s) => s.key === "storage");
      expect(storageSnapshot).toEqual({
        key: "storage",
        usage: 200,
        limit: 500,
        remaining: 300,
      });
    });

    it("应该包含已配置但未使用的配额桶", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
            storage: 500,
            bandwidth: 1000,
          },
        },
      });

      // 只使用 api-calls
      quotaManager.claimQuota("api-calls", 30);

      const snapshots = quotaManager.listQuotaSnapshots();
      expect(snapshots).toHaveLength(3); // 应该包含 3 个配额桶

      const bandwidthSnapshot = snapshots.find((s) => s.key === "bandwidth");
      expect(bandwidthSnapshot).toEqual({
        key: "bandwidth",
        usage: 0,
        limit: 1000,
        remaining: 1000,
      });
    });

    it("应该包含实体配额（已配置）", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();

      const snapshots = quotaManager.listQuotaSnapshots();
      expect(snapshots).toHaveLength(1);

      const entitySnapshot = snapshots.find((s) => s.key === TENANT_ENTITY_QUOTA_KEY);
      expect(entitySnapshot).toEqual({
        key: TENANT_ENTITY_QUOTA_KEY,
        usage: 5,
        limit: 10,
        remaining: 5,
      });
    });

    it("应该同时列出自定义配额和实体配额", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 20,
          custom: {
            "api-calls": 100,
          },
        },
      });
      entityCount = 8;
      quotaManager.syncEntityQuotaUsage();
      quotaManager.claimQuota("api-calls", 50);

      const snapshots = quotaManager.listQuotaSnapshots();
      expect(snapshots).toHaveLength(2);

      const keys = snapshots.map((s) => s.key);
      expect(keys).toContain(TENANT_ENTITY_QUOTA_KEY);
      expect(keys).toContain("api-calls");
    });
  });

  describe("ensureEntityQuotaAvailable() - 实体配额检查", () => {
    it("无租户上下文应该返回 true", () => {
      tenantContext = null;
      entityCount = 100;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);
    });

    it("无实体配额限制应该返回 true", () => {
      tenantContext = createTestContext(); // 无 maxEntities
      entityCount = 100;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);
    });

    it("实体数量未达限制应该返回 true", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);

      entityCount = 9;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);
    });

    it("实体数量达到限制应该返回 false 并记录警告", () => {
      const warnSpy = vi.spyOn(logger, "warn");
      tenantContext = createTestContext({
        tenantId: "tenant-entity-limit",
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 10;

      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith("DuckFlowRuntime tenant entity quota exceeded", {
        tenantId: "tenant-entity-limit",
        limit: 10,
        current: 10,
      });
    });

    it("实体数量超过限制应该返回 false", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 15;

      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(false);
    });
  });

  describe("syncEntityQuotaUsage() - 同步实体配额", () => {
    it("无租户上下文应该删除实体配额桶", () => {
      tenantContext = createTestContext({
        quotas: { maxEntities: 10 },
      });
      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(5);

      tenantContext = null;
      quotaManager.syncEntityQuotaUsage();
      // 无租户上下文时，getQuotaSnapshot 返回 undefined
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)).toBeUndefined();
    });

    it("无实体配额限制应该删除实体配额桶", () => {
      tenantContext = createTestContext({
        quotas: { maxEntities: 10 },
      });
      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(5);

      tenantContext = createTestContext(); // 移除 maxEntities
      quotaManager.syncEntityQuotaUsage();
      // 无实体配额限制时，快照应该显示 usage 为 0（因为配额桶已被删除）
      const snapshot = quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot?.usage).toBe(0);
    });

    it("应该同步实际实体数量", () => {
      tenantContext = createTestContext({
        quotas: { maxEntities: 20 },
      });

      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(5);

      entityCount = 12;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(12);

      entityCount = 0;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(0);
    });
  });

  describe("clear() - 清空配额", () => {
    it("应该清空所有配额使用量", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
            storage: 500,
          },
        },
      });

      quotaManager.claimQuota("api-calls", 50);
      quotaManager.claimQuota("storage", 200);

      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(50);
      expect(quotaManager.getQuotaSnapshot("storage")?.usage).toBe(200);

      quotaManager.clear();

      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(0);
      expect(quotaManager.getQuotaSnapshot("storage")?.usage).toBe(0);
    });
  });

  describe("边界条件和错误处理", () => {
    it("应该处理配额限制为 0 的情况", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 0,
          },
        },
      });

      expect(quotaManager.claimQuota("api-calls", 1)).toBe(false);
    });

    it("应该处理大数量配额申请", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 1000000,
          },
        },
      });

      expect(quotaManager.claimQuota("api-calls", 999999)).toBe(true);
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(999999);
    });

    it("应该处理多次清空操作", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      quotaManager.clear();
      quotaManager.clear();
      quotaManager.clear();

      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(0);
    });

    it("应该处理租户上下文切换", () => {
      // 第一个租户
      tenantContext = createTestContext({
        tenantId: "tenant-1",
        quotas: {
          custom: { "api-calls": 100 },
        },
      });
      quotaManager.claimQuota("api-calls", 50);

      // 切换到第二个租户（应该使用独立的配额）
      tenantContext = createTestContext({
        tenantId: "tenant-2",
        quotas: {
          custom: { "api-calls": 200 },
        },
      });

      // 注意：切换租户时需要手动 clear()，这里测试的是未清空的情况
      // 配额使用量仍然是 50（因为没有清空）
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(50);
      expect(quotaManager.claimQuota("api-calls", 100)).toBe(true); // 限制变为 200
    });

    it("应该处理配额桶名称包含特殊字符", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api:calls:v2": 100,
            "storage/bucket/1": 500,
          },
        },
      });

      expect(quotaManager.claimQuota("api:calls:v2", 50)).toBe(true);
      expect(quotaManager.claimQuota("storage/bucket/1", 200)).toBe(true);

      expect(quotaManager.getQuotaSnapshot("api:calls:v2")?.usage).toBe(50);
      expect(quotaManager.getQuotaSnapshot("storage/bucket/1")?.usage).toBe(200);
    });
  });
});
