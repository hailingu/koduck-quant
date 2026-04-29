import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RuntimeQuotaManager } from "../../../src/common/runtime/runtime-quota-manager";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";
import { TENANT_ENTITY_QUOTA_KEY } from "../../../src/common/runtime/types";
import { logger } from "../../../src/common/logger";

/**
 * Create test tenant context
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

  describe("Constructor and Initialization", () => {
    it("should successfully create quota manager instance", () => {
      expect(quotaManager).toBeDefined();
      expect(quotaManager).toBeInstanceOf(RuntimeQuotaManager);
    });

    it("should accept tenant context provider function", () => {
      const manager = new RuntimeQuotaManager(
        () => createTestContext(),
        () => 0
      );
      expect(manager).toBeDefined();
    });

    it("should accept entity count provider function", () => {
      const manager = new RuntimeQuotaManager(
        () => null,
        () => 42
      );
      expect(manager).toBeDefined();
    });
  });

  describe("claimQuota() - Quota Claim", () => {
    it("should always return true when no tenant context", () => {
      tenantContext = null;
      expect(quotaManager.claimQuota("api-calls", 10)).toBe(true);
      expect(quotaManager.claimQuota("storage", 100)).toBe(true);
    });

    it("should return true for empty bucket name", () => {
      tenantContext = createTestContext();
      expect(quotaManager.claimQuota("", 10)).toBe(true);
    });

    it("should return true when amount <= 0", () => {
      tenantContext = createTestContext();
      expect(quotaManager.claimQuota("api-calls", 0)).toBe(true);
      expect(quotaManager.claimQuota("api-calls", -5)).toBe(true);
    });

    it("should always return true when no quota limit", () => {
      tenantContext = createTestContext(); // No quotas config
      expect(quotaManager.claimQuota("api-calls", 100)).toBe(true);
      expect(quotaManager.claimQuota("storage", 1000)).toBe(true);
    });

    it("should successfully claim quota (within limit)", () => {
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

    it("should reject quota claim (exceeds limit)", () => {
      const warnSpy = vi.spyOn(logger, "warn");
      tenantContext = createTestContext({
        tenantId: "tenant-quota-test",
        quotas: {
          custom: {
            "api-calls": 50,
          },
        },
      });

      // Claim 40, success
      expect(quotaManager.claimQuota("api-calls", 40)).toBe(true);

      // Claim another 20, total 60, exceeds limit 50, failure
      expect(quotaManager.claimQuota("api-calls", 20)).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith("KoduckFlowRuntime tenant quota exceeded", {
        tenantId: "tenant-quota-test",
        bucket: "api-calls",
        limit: 50,
        attempted: 60,
      });
    });

    it("should correctly accumulate quota usage", () => {
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

    it("should support multiple quota buckets", () => {
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

    it("entity quota should call ensureEntityQuotaAvailable()", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;

      expect(quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1)).toBe(true);

      entityCount = 10; // Limit reached
      expect(quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1)).toBe(false);
    });
  });

  describe("releaseQuota() - Quota Release", () => {
    it("should return current usage for empty bucket name", () => {
      tenantContext = createTestContext();
      expect(quotaManager.releaseQuota("", 10)).toBe(0);
    });

    it("should return current usage when amount <= 0", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      expect(quotaManager.releaseQuota("api-calls", 0)).toBe(50);
      expect(quotaManager.releaseQuota("api-calls", -5)).toBe(50);
    });

    it("should correctly release quota", () => {
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

    it("should reset to zero when release amount exceeds usage", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 30);

      const remaining = quotaManager.releaseQuota("api-calls", 100);
      expect(remaining).toBe(0);
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(0);
    });

    it("should delete quota bucket when usage reaches zero", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      quotaManager.releaseQuota("api-calls", 50);
      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(0);
    });

    it("should return 0 when releasing unclaimed quota bucket", () => {
      tenantContext = createTestContext();
      expect(quotaManager.releaseQuota("non-existent", 10)).toBe(0);
    });

    it("entity quota release should sync with actual count", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 5;
      quotaManager.claimQuota(TENANT_ENTITY_QUOTA_KEY, 1);

      entityCount = 3; // Entity count decreased
      const remaining = quotaManager.releaseQuota(TENANT_ENTITY_QUOTA_KEY, 1);

      // Should sync to actual count 3, not 5-1=4
      expect(remaining).toBe(3);
    });
  });

  describe("getQuotaSnapshot() - Quota Snapshot", () => {
    it("should return undefined when no tenant context", () => {
      tenantContext = null;
      expect(quotaManager.getQuotaSnapshot("api-calls")).toBeUndefined();
    });

    it("should return correct quota snapshot (with limit)", () => {
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

    it("should return correct quota snapshot (no limit)", () => {
      tenantContext = createTestContext(); // No quotas config
      quotaManager.claimQuota("api-calls", 50);

      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot).toEqual({
        key: "api-calls",
        usage: 50,
      });
      expect(snapshot?.limit).toBeUndefined();
      expect(snapshot?.remaining).toBeUndefined();
    });

    it("should return correct quota snapshot (exhausted)", () => {
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

    it("should return correct quota snapshot (over-quota, shouldn't happen but needs defense)", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 50,
          },
        },
      });

      // Manually set over-quota usage (test defensive logic)
      quotaManager.claimQuota("api-calls", 40);
      quotaManager.claimQuota("api-calls", 15); // Total 55, exceeds 50

      const snapshot = quotaManager.getQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(40); // Second claim failed, only 40
      expect(snapshot?.remaining).toBe(10);
    });
  });

  describe("listQuotaSnapshots() - List All Quota Snapshots", () => {
    it("should return empty array when no tenant context", () => {
      tenantContext = null;
      expect(quotaManager.listQuotaSnapshots()).toEqual([]);
    });

    it("should list all used quota buckets", () => {
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

    it("should include configured but unused quota buckets", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 100,
            storage: 500,
            bandwidth: 1000,
          },
        },
      });

      // Only use api-calls
      quotaManager.claimQuota("api-calls", 30);

      const snapshots = quotaManager.listQuotaSnapshots();
      expect(snapshots).toHaveLength(3); // Should include 3 quota buckets

      const bandwidthSnapshot = snapshots.find((s) => s.key === "bandwidth");
      expect(bandwidthSnapshot).toEqual({
        key: "bandwidth",
        usage: 0,
        limit: 1000,
        remaining: 1000,
      });
    });

    it("should include entity quota (configured)", () => {
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

    it("should list both custom and entity quotas", () => {
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

  describe("ensureEntityQuotaAvailable() - Entity Quota Check", () => {
    it("should return true when no tenant context", () => {
      tenantContext = null;
      entityCount = 100;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);
    });

    it("should return true when no entity quota limit", () => {
      tenantContext = createTestContext(); // No maxEntities
      entityCount = 100;
      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(true);
    });

    it("should return true when entity count hasn't reached limit", () => {
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

    it("should return false and log warning when entity count reaches limit", () => {
      const warnSpy = vi.spyOn(logger, "warn");
      tenantContext = createTestContext({
        tenantId: "tenant-entity-limit",
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 10;

      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(false);

      expect(warnSpy).toHaveBeenCalledWith("KoduckFlowRuntime tenant entity quota exceeded", {
        tenantId: "tenant-entity-limit",
        limit: 10,
        current: 10,
      });
    });

    it("should return false when entity count exceeds limit", () => {
      tenantContext = createTestContext({
        quotas: {
          maxEntities: 10,
        },
      });
      entityCount = 15;

      expect(quotaManager.ensureEntityQuotaAvailable()).toBe(false);
    });
  });

  describe("syncEntityQuotaUsage() - Sync Entity Quota", () => {
    it("should delete entity quota bucket when no tenant context", () => {
      tenantContext = createTestContext({
        quotas: { maxEntities: 10 },
      });
      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(5);

      tenantContext = null;
      quotaManager.syncEntityQuotaUsage();
      // When no tenant context, getQuotaSnapshot returns undefined
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)).toBeUndefined();
    });

    it("should delete entity quota bucket when no entity quota limit", () => {
      tenantContext = createTestContext({
        quotas: { maxEntities: 10 },
      });
      entityCount = 5;
      quotaManager.syncEntityQuotaUsage();
      expect(quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY)?.usage).toBe(5);

      tenantContext = createTestContext(); // Remove maxEntities
      quotaManager.syncEntityQuotaUsage();
      // When no entity quota limit, snapshot should show usage as 0 (because quota bucket was deleted)
      const snapshot = quotaManager.getQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot?.usage).toBe(0);
    });

    it("should sync with actual entity count", () => {
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

  describe("clear() - Clear Quotas", () => {
    it("should clear all quota usage", () => {
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

  describe("Boundary Conditions and Error Handling", () => {
    it("should handle quota limit of 0", () => {
      tenantContext = createTestContext({
        quotas: {
          custom: {
            "api-calls": 0,
          },
        },
      });

      expect(quotaManager.claimQuota("api-calls", 1)).toBe(false);
    });

    it("should handle large quota claims", () => {
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

    it("should handle multiple clear operations", () => {
      tenantContext = createTestContext();
      quotaManager.claimQuota("api-calls", 50);

      quotaManager.clear();
      quotaManager.clear();
      quotaManager.clear();

      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(0);
    });

    it("should handle tenant context switching", () => {
      // First tenant
      tenantContext = createTestContext({
        tenantId: "tenant-1",
        quotas: {
          custom: { "api-calls": 100 },
        },
      });
      quotaManager.claimQuota("api-calls", 50);

      // Switch to second tenant (should use independent quotas)
      tenantContext = createTestContext({
        tenantId: "tenant-2",
        quotas: {
          custom: { "api-calls": 200 },
        },
      });

      // Note: Manual clear() is needed when switching tenants, here we test the uncleared case
      // Quota usage is still 50 (because it wasn't cleared)
      expect(quotaManager.getQuotaSnapshot("api-calls")?.usage).toBe(50);
      expect(quotaManager.claimQuota("api-calls", 100)).toBe(true); // Limit becomes 200
    });

    it("should handle quota bucket names with special characters", () => {
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
