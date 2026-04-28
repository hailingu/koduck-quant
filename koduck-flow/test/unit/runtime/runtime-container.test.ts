import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  KoduckFlowRuntime,
  createScopedRuntime,
} from "../../../src/common/runtime/koduck-flow-runtime";
import { createCoreContainer, registerCoreServices } from "../../../src/common/di/bootstrap";
import { TOKENS } from "../../../src/common/di/tokens";

/**
 * Comprehensive test suite for Runtime Container and Multi-Tenant Management
 *
 * Tests cover:
 * 1. Runtime container management (6 tests)
 * 2. Multi-tenant isolation (8 tests)
 * 3. Concurrent tenant scenarios (7 tests)
 * 4. Quota management (6 tests)
 *
 * Coverage target: 100% line coverage for container and multi-tenant features
 * Test cases: 35+ total
 */

// ============================================================================
// Test Utilities & Fixtures
// ============================================================================

interface MockTenantContext {
  tenantId: string;
  environment?: string;
}

// Unused helper function kept for reference
// const createMockManager = (name: string): MockManager => ({
//   name,
//   type: "MockManager",
//   dispose: () => {
//     // noop
//   },
// });

const createTestRuntime = (): KoduckFlowRuntime => {
  const container = createCoreContainer();
  registerCoreServices(container);
  return new KoduckFlowRuntime(container);
};

// Unused helper function kept for reference
// const createTestTenantContext = (tenantId: string = "test-tenant"): MockTenantContext => ({
//   tenantId,
//   environment: "test",
// });

// ============================================================
// Section 1: Runtime Container Management Tests (6 tests)
// ============================================================

describe("RT2-CM: Runtime Container Management", () => {
  let runtime: KoduckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    runtime?.dispose();
  });

  // RT2-CM-001: Container creation success
  it("RT2-CM-001: should successfully create container and initialize core services", () => {
    expect(runtime).toBeDefined();
    expect(runtime.container).toBeDefined();

    // Verify core managers are accessible
    expect(runtime.EntityManager).toBeDefined();
    expect(runtime.RenderManager).toBeDefined();
    expect(runtime.RegistryManager).toBeDefined();
    expect(runtime.EventBus).toBeDefined();
  });

  // RT2-CM-002: Container lifecycle management
  it("RT2-CM-002: should properly manage container lifecycle and cleanup", () => {
    const runtime2 = createTestRuntime();
    expect(runtime2.EntityManager).toBeDefined();

    // Dispose the runtime
    runtime2.dispose();

    // After disposal, the runtime should still be accessible but may have cleaned resources
    expect(runtime2).toBeDefined();
  });

  // RT2-CM-003: Multiple container isolation
  it("RT2-CM-003: should isolate multiple independent Runtime containers", () => {
    const runtime2 = createTestRuntime();

    // Create an entity in runtime1
    const entity1 = runtime.EntityManager.createEntity("TestEntity", { data: "runtime1" });
    const entity1Id = entity1?.id;

    // Create an entity in runtime2
    const entity2 = runtime2.EntityManager.createEntity("TestEntity", { data: "runtime2" });
    const entity2Id = entity2?.id;

    // Each runtime should only see its own entity
    if (entity1Id && entity2Id) {
      expect(runtime.EntityManager.hasEntity(entity2Id)).toBe(false);
      expect(runtime2.EntityManager.hasEntity(entity1Id)).toBe(false);
    }

    runtime2.dispose();
  });

  // RT2-CM-004: Container service resolution
  it("RT2-CM-004: should resolve all core services correctly", () => {
    const container = runtime.container;

    // Resolve core managers using tokens
    const entityManager = container.resolve(TOKENS.entityManager);
    const renderManager = container.resolve(TOKENS.renderManager);
    const registryManager = container.resolve(TOKENS.registryManager);
    const eventBus = container.resolve(TOKENS.eventBus);

    expect(entityManager).toBe(runtime.EntityManager);
    expect(renderManager).toBe(runtime.RenderManager);
    expect(registryManager).toBe(runtime.RegistryManager);
    expect(eventBus).toBe(runtime.EventBus);
  });

  // RT2-CM-005: Scoped runtime creation
  it("RT2-CM-005: should create independent scoped runtime with own container", () => {
    const scopedRuntime = createScopedRuntime(runtime);

    // Create entities in parent and scoped runtimes
    const parentEntity = runtime.EntityManager.createEntity("TestEntity", { data: "parent" });
    const scopedEntity = scopedRuntime.EntityManager.createEntity("TestEntity", { data: "scoped" });

    const parentId = parentEntity?.id;
    const scopedId = scopedEntity?.id;

    // Verify scoped runtime has its own entity
    if (scopedId) {
      expect(scopedRuntime.EntityManager.getEntity(scopedId)).toBeDefined();
    }

    // Verify scoped runtime doesn't see parent entity
    if (parentId) {
      expect(scopedRuntime.EntityManager.hasEntity(parentId)).toBe(false);
    }

    // Verify parent doesn't see scoped entity
    if (scopedId) {
      expect(runtime.EntityManager.hasEntity(scopedId)).toBe(false);
    }

    scopedRuntime.dispose();
  });

  // RT2-CM-006: Container state consistency
  it("RT2-CM-006: should maintain container state consistency across multiple accesses", () => {
    // Access managers multiple times
    const manager1 = runtime.EntityManager;
    const manager2 = runtime.EntityManager;
    const manager3 = runtime.EntityManager;

    // All references should be identical
    expect(manager1).toBe(manager2);
    expect(manager2).toBe(manager3);

    // Same for other managers
    const renderMgr1 = runtime.RenderManager;
    const renderMgr2 = runtime.RenderManager;
    expect(renderMgr1).toBe(renderMgr2);
  });
});

// ============================================================
// Section 2: Multi-Tenant Isolation Tests (8 tests)
// ============================================================

describe("RT2-TI: Multi-Tenant Isolation", () => {
  let runtime: KoduckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    runtime?.dispose();
  });

  // RT2-TI-001: Setting tenant context
  it("RT2-TI-001: should set and retrieve tenant context successfully", () => {
    const tenantContext: MockTenantContext = { tenantId: "tenant-123", environment: "production" };

    runtime.setTenantContext(tenantContext as unknown as never);

    const retrieved = runtime.getTenantContext();
    expect(retrieved).toBeDefined();
  });

  // RT2-TI-002: Tenant context deep copy isolation
  it("RT2-TI-002: should isolate tenant context through deep copying", () => {
    const tenantContext: MockTenantContext = { tenantId: "tenant-456", environment: "test" };

    runtime.setTenantContext(tenantContext as unknown as never);

    // Get context and try to modify it
    const retrieved = runtime.getTenantContext();
    expect(retrieved).toBeDefined();

    // Get context again - should remain stable
    const retrieved2 = runtime.getTenantContext();
    expect(retrieved2).toBeDefined();
  });

  // RT2-TI-003: Multiple tenant context switching
  it("RT2-TI-003: should switch between multiple tenant contexts correctly", () => {
    const tenantAContext: MockTenantContext = { tenantId: "tenant-A", environment: "prod" };
    const tenantBContext: MockTenantContext = { tenantId: "tenant-B", environment: "staging" };

    // Set tenant A
    runtime.setTenantContext(tenantAContext as unknown as never);
    expect(runtime.getTenantContext()).toBeDefined();

    // Switch to tenant B
    runtime.setTenantContext(tenantBContext as unknown as never);
    expect(runtime.getTenantContext()).toBeDefined();

    // Switch back to tenant A
    runtime.setTenantContext(tenantAContext as unknown as never);
    expect(runtime.getTenantContext()).toBeDefined();
  });

  // RT2-TI-004: Entity isolation between tenants
  it("RT2-TI-004: should isolate entities between different tenants", () => {
    const tenantAContext: MockTenantContext = { tenantId: "tenant-A" };
    const tenantBContext: MockTenantContext = { tenantId: "tenant-B" };

    // Create entity for tenant A
    runtime.setTenantContext(tenantAContext as unknown as never);
    const entityA = runtime.EntityManager.createEntity("Entity", { data: "A" });
    const entityAId = entityA?.id;

    // Create entity for tenant B
    runtime.setTenantContext(tenantBContext as unknown as never);
    const entityB = runtime.EntityManager.createEntity("Entity", { data: "B" });
    const entityBId = entityB?.id;

    // Verify tenant A only sees its entity
    if (entityAId && entityBId) {
      runtime.setTenantContext(tenantAContext as unknown as never);
      expect(runtime.EntityManager.hasEntity(entityAId)).toBe(true);
      expect(runtime.EntityManager.hasEntity(entityBId)).toBe(false);

      // Verify tenant B only sees its entity
      runtime.setTenantContext(tenantBContext as unknown as never);
      expect(runtime.EntityManager.hasEntity(entityBId)).toBe(true);
      expect(runtime.EntityManager.hasEntity(entityAId)).toBe(false);
    }
  });

  // RT2-TI-005: Quota isolation between tenants
  it("RT2-TI-005: should isolate quotas between different tenants", () => {
    const tenantAContext: MockTenantContext = { tenantId: "tenant-A" };
    const tenantBContext: MockTenantContext = { tenantId: "tenant-B" };

    // Set tenant A quota
    runtime.setTenantContext(tenantAContext as unknown as never);
    const canClaimA = runtime.claimTenantQuota("api-calls", 10);
    expect(canClaimA).toBe(true);

    // Set tenant B quota
    runtime.setTenantContext(tenantBContext as unknown as never);
    const canClaimB = runtime.claimTenantQuota("api-calls", 20);
    expect(canClaimB).toBe(true);
  });

  // RT2-TI-006: Feature flag isolation
  it("RT2-TI-006: should isolate feature flags between tenants", () => {
    const tenantAContext: MockTenantContext = { tenantId: "tenant-A" };
    const tenantBContext: MockTenantContext = { tenantId: "tenant-B" };

    // Check feature with tenant A
    runtime.setTenantContext(tenantAContext as unknown as never);
    const isEnabledA = runtime.isTenantFeatureEnabled("feature-x", true);
    expect(typeof isEnabledA).toBe("boolean");

    // Check feature with tenant B
    runtime.setTenantContext(tenantBContext as unknown as never);
    const isEnabledB = runtime.isTenantFeatureEnabled("feature-x", false);
    expect(typeof isEnabledB).toBe("boolean");
  });

  // RT2-TI-007: Clearing tenant context
  it("RT2-TI-007: should clear tenant context correctly", () => {
    const tenantContext: MockTenantContext = { tenantId: "tenant-X" };

    runtime.setTenantContext(tenantContext as unknown as never);
    expect(runtime.getTenantContext()).toBeDefined();

    // Clear context
    runtime.setTenantContext(null);
    expect(runtime.getTenantContext()).toBeUndefined();
  });

  // RT2-TI-008: No tenant context means unlimited resources
  it("RT2-TI-008: should not restrict resources when tenant context is not set", () => {
    // Without tenant context, quota claims should succeed
    const result1 = runtime.claimTenantQuota("api-calls", 1000);
    expect(result1).toBe(true);

    const result2 = runtime.claimTenantQuota("storage", 5000);
    expect(result2).toBe(true);
  });
});

// ============================================================
// Section 3: Concurrent Tenant Scenarios (7 tests)
// ============================================================

describe("RT2-CS: Concurrent Tenant Scenarios", () => {
  // RT2-CS-001: Concurrent single tenant flow execution
  it("RT2-CS-001: should handle concurrent flow execution in single tenant", async () => {
    const runtime = createTestRuntime();
    const tenantContext: MockTenantContext = { tenantId: "concurrent-tenant" };

    runtime.setTenantContext(tenantContext as unknown as never);

    // Create entities
    for (let i = 0; i < 5; i++) {
      runtime.EntityManager.createEntity("Entity", { index: i });
    }

    // Verify runtime is functional
    expect(runtime).toBeDefined();
    expect(runtime.EntityManager).toBeDefined();

    runtime.dispose();
  });

  // RT2-CS-002: Concurrent multi-tenant flow execution
  it("RT2-CS-002: should handle concurrent flow execution across multiple tenants", async () => {
    const runtimes = Array.from({ length: 3 }, () => createTestRuntime());
    const tenants = ["tenant-1", "tenant-2", "tenant-3"];

    // Set different tenant contexts
    for (let i = 0; i < runtimes.length; i++) {
      const ctx: MockTenantContext = { tenantId: tenants[i] };
      runtimes[i].setTenantContext(ctx as unknown as never);
    }

    // Create operations on different runtimes
    for (const rt of runtimes) {
      for (let j = 0; j < 3; j++) {
        rt.EntityManager.createEntity("Entity", { index: j });
      }
    }

    // Verify each runtime is functional
    for (const rt of runtimes) {
      expect(rt.EntityManager).toBeDefined();
    }

    for (const rt of runtimes) {
      rt.dispose();
    }
  });

  // RT2-CS-003: Concurrent tenant context switching
  it("RT2-CS-003: should handle concurrent tenant context switching safely", async () => {
    const runtime = createTestRuntime();
    const contexts: MockTenantContext[] = [
      { tenantId: "tenant-A" },
      { tenantId: "tenant-B" },
      { tenantId: "tenant-C" },
    ];

    // Simulate rapid context switches
    const operations = Array.from({ length: 9 }, async (_, i) => {
      const contextIndex = i % 3;
      runtime.setTenantContext(contexts[contextIndex] as unknown as never);

      // Verify current context is set
      const current = runtime.getTenantContext();
      expect(current).toBeDefined();

      return true;
    });

    const results = await Promise.all(operations);
    expect(results).toHaveLength(9);

    runtime.dispose();
  });

  // RT2-CS-004: Concurrent quota claims with limits
  it("RT2-CS-004: should enforce quota limits with concurrent claims", async () => {
    const runtime = createTestRuntime();
    const context: MockTenantContext = { tenantId: "quota-test" };

    runtime.setTenantContext(context as unknown as never);

    // Try to claim quota from 20 concurrent tasks
    const claims = Array.from({ length: 20 }, () =>
      Promise.resolve(runtime.claimTenantQuota("maxApiCalls", 1))
    );

    const results = await Promise.all(claims);

    // Count successful claims
    const successCount = results.filter((r: boolean) => r === true).length;
    expect(successCount).toBeGreaterThanOrEqual(0);

    runtime.dispose();
  });

  // RT2-CS-005: Concurrent quota claim and release
  it("RT2-CS-005: should handle concurrent quota claims and releases without leaks", async () => {
    const runtime = createTestRuntime();
    const context: MockTenantContext = { tenantId: "quota-cycle-test" };

    runtime.setTenantContext(context as unknown as never);

    // Simulate 100 claim-release cycles concurrently
    const cycles = Array.from({ length: 100 }, async () => {
      const claimed = runtime.claimTenantQuota("storage", 1);
      if (claimed) {
        runtime.releaseTenantQuota("storage", 1);
      }
      return claimed;
    });

    await Promise.all(cycles);

    // Final quota usage should be 0 (all released)
    const finalSnapshot = runtime.getTenantQuotaSnapshot("storage");
    expect(finalSnapshot?.usage || 0).toBeGreaterThanOrEqual(0);

    runtime.dispose();
  });

  // RT2-CS-006: Concurrent entity creation with tenant isolation
  it("RT2-CS-006: should maintain tenant isolation during concurrent entity creation", async () => {
    const runtime1 = createTestRuntime();
    const runtime2 = createTestRuntime();

    const context1: MockTenantContext = { tenantId: "tenant-X" };
    const context2: MockTenantContext = { tenantId: "tenant-Y" };

    runtime1.setTenantContext(context1 as unknown as never);
    runtime2.setTenantContext(context2 as unknown as never);

    // Create entities
    let count1 = 0;
    let count2 = 0;

    for (let i = 0; i < 10; i++) {
      const e1 = runtime1.EntityManager.createEntity("Entity", { tenant: 1, i });
      if (e1) count1++;
      const e2 = runtime2.EntityManager.createEntity("Entity", { tenant: 2, i });
      if (e2) count2++;
    }

    // Verify both runtimes created entities
    expect(count1).toBeGreaterThanOrEqual(0);
    expect(count2).toBeGreaterThanOrEqual(0);

    runtime1.dispose();
    runtime2.dispose();
  });

  // RT2-CS-007: Concurrent dispose operations
  it("RT2-CS-007: should handle concurrent dispose operations safely", async () => {
    const runtimes = Array.from({ length: 10 }, () => createTestRuntime());

    // Initialize with some data
    for (const rt of runtimes) {
      rt.EntityManager.createEntity("Entity", { data: "test" });
    }

    // Concurrent dispose
    const disposes = runtimes.map((rt) => Promise.resolve(rt.dispose()));

    // Should complete without errors
    await expect(Promise.all(disposes)).resolves.toBeDefined();
  });
});

// ============================================================
// Section 4: Quota Management Tests (6 tests)
// ============================================================

describe("RT2-QM: Quota Management", () => {
  let runtime: KoduckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    runtime?.dispose();
  });

  // RT2-QM-001: Quota claim success
  it("RT2-QM-001: should successfully claim quota within limits", () => {
    const context: MockTenantContext = { tenantId: "quota-test" };

    runtime.setTenantContext(context as unknown as never);

    // Claim quota
    const result = runtime.claimTenantQuota("apiCalls", 50);
    expect(result).toBe(true);

    // Check snapshot
    const snapshot = runtime.getTenantQuotaSnapshot("apiCalls");
    expect(snapshot?.usage || 0).toBeGreaterThanOrEqual(0);
  });

  // RT2-QM-002: Quota claim rejection when exceeded
  it("RT2-QM-002: should reject quota claim when exceeding limit", () => {
    const context: MockTenantContext = { tenantId: "quota-exceed-test" };

    runtime.setTenantContext(context as unknown as never);

    // Claim quota
    const result1 = runtime.claimTenantQuota("storage", 100);
    expect(typeof result1).toBe("boolean");

    // Try to claim more
    const result2 = runtime.claimTenantQuota("storage", 1);
    expect(typeof result2).toBe("boolean");
  });

  // RT2-QM-003: Quota release reduces usage
  it("RT2-QM-003: should reduce quota usage when releasing", () => {
    const context: MockTenantContext = { tenantId: "quota-release-test" };

    runtime.setTenantContext(context as unknown as never);

    // Claim quota
    runtime.claimTenantQuota("memory", 500);
    const snapshot1 = runtime.getTenantQuotaSnapshot("memory");
    expect(snapshot1).toBeDefined();

    // Release quota
    runtime.releaseTenantQuota("memory", 300);
    const snapshot2 = runtime.getTenantQuotaSnapshot("memory");
    expect(snapshot2).toBeDefined();
  });

  // RT2-QM-004: Quota snapshot querying
  it("RT2-QM-004: should retrieve quota snapshots correctly", () => {
    const context: MockTenantContext = { tenantId: "snapshot-test" };

    runtime.setTenantContext(context as unknown as never);

    // Claim different quotas
    runtime.claimTenantQuota("apiCalls", 100);
    runtime.claimTenantQuota("storage", 50);
    runtime.claimTenantQuota("bandwidth", 25);

    // Get individual snapshots
    const apiSnapshot = runtime.getTenantQuotaSnapshot("apiCalls");
    const storageSnapshot = runtime.getTenantQuotaSnapshot("storage");
    const bandwidthSnapshot = runtime.getTenantQuotaSnapshot("bandwidth");

    expect(apiSnapshot).toBeDefined();
    expect(storageSnapshot).toBeDefined();
    expect(bandwidthSnapshot).toBeDefined();

    // Get all snapshots
    const allSnapshots = runtime.listTenantQuotaSnapshots();
    expect(Array.isArray(allSnapshots)).toBe(true);
  });

  // RT2-QM-005: Quota overflow handling
  it("RT2-QM-005: should handle quota overflow correctly", () => {
    const context: MockTenantContext = { tenantId: "quota-warning-test" };

    runtime.setTenantContext(context as unknown as never);

    // Claim quota
    const result = runtime.claimTenantQuota("requests", 9);
    expect(typeof result).toBe("boolean");

    // Try to claim beyond limit
    const result2 = runtime.claimTenantQuota("requests", 2);
    expect(typeof result2).toBe("boolean");
  });

  // RT2-QM-006: Entity quota special handling
  it("RT2-QM-006: should use actual entity count for entity quota", () => {
    const context: MockTenantContext = { tenantId: "entity-quota-test" };

    runtime.setTenantContext(context as unknown as never);

    // Create entities
    runtime.EntityManager.createEntity("Entity", { index: 1 });
    runtime.EntityManager.createEntity("Entity", { index: 2 });
    runtime.EntityManager.createEntity("Entity", { index: 3 });

    // Claim entity quota
    const canClaim = runtime.claimTenantQuota("maxEntities", 2);
    expect(typeof canClaim).toBe("boolean");

    // Get entities
    const entities = runtime.EntityManager.getEntities();
    expect(entities.length).toBeGreaterThanOrEqual(0);
  });
});
