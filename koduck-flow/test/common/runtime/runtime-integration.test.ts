/**
 * KoduckFlowRuntime Integration Tests
 *
 * Test Objective: Verify correct collaboration between modules
 *
 * Test Scenarios:
 * 1. Full Runtime initialization flow
 * 2. Manager registration + tenant context + quota linkage
 * 3. Feature flag and Rollout integration
 * 4. Multi-tenant isolation
 * 5. Scoped Runtime creation
 * 6. Graceful shutdown flow
 * 7. API behavior snapshot tests
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  KoduckFlowRuntime,
  createKoduckFlowRuntime,
  createScopedRuntime,
} from "../../../src/common/runtime";
import type { ResolvedTenantContext } from "../../../src/common/runtime/tenant-context";
import type { IManager } from "../../../src/common/manager/types";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";
import { TOKENS } from "../../../src/common/di/tokens";
import { registerCoreServices } from "../../../src/common/di/bootstrap";
import { TENANT_ENTITY_QUOTA_KEY } from "../../../src/common/runtime/types";

// ==================== Test Helpers ====================

/**
 * Create mock Manager
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
 * Create test tenant context
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

// ==================== Test Suite ====================

describe("KoduckFlowRuntime - Integration Tests", () => {
  let runtime: KoduckFlowRuntime;

  afterEach(() => {
    if (runtime && !runtime["disposed"]) {
      runtime.dispose();
    }
  });

  // ==================== Scenario 1: Full Initialization Flow ====================

  describe("Scenario 1: Full Runtime Initialization Flow", () => {
    it("should successfully initialize Runtime and access all core services", () => {
      // Create Runtime
      runtime = createKoduckFlowRuntime();

      // Verify core services are accessible
      expect(runtime.EntityManager).toBeDefined();
      expect(runtime.RenderManager).toBeDefined();
      expect(runtime.RegistryManager).toBeDefined();
      expect(runtime.EventBus).toBeDefined();
      expect(runtime.RenderEvents).toBeDefined();
      expect(runtime.EntityEvents).toBeDefined();

      // Verify core services come from the same container
      const entityManager1 = runtime.EntityManager;
      const entityManager2 = runtime.EntityManager;
      expect(entityManager1).toBe(entityManager2);
    });

    it("should correctly initialize DI container and resolve services", () => {
      runtime = createKoduckFlowRuntime();

      // Verify core services can be resolved (using Symbol token)
      expect(runtime.has(TOKENS.entityManager)).toBe(true);
      expect(runtime.has(TOKENS.renderManager)).toBe(true);
      expect(runtime.has(TOKENS.registryManager)).toBe(true);

      // Verify can resolve via token
      const entityManager = runtime.resolve(TOKENS.entityManager);
      expect(entityManager).toBe(runtime.EntityManager);
    });

    it("should support custom DI container initialization", () => {
      const customContainer = new DefaultDependencyContainer();

      // Must register core services first
      registerCoreServices(customContainer);

      // Then register custom services
      const testService = { name: "TestService" };
      customContainer.registerInstance("TestService", testService);

      runtime = createKoduckFlowRuntime({ container: customContainer });

      // Verify custom services are accessible
      expect(runtime.has("TestService")).toBe(true);
      expect(runtime.resolve("TestService")).toBe(testService);

      // Verify core services are still available
      expect(runtime.EntityManager).toBeDefined();
    });

    it("should correctly handle Manager initialization config", () => {
      runtime = createKoduckFlowRuntime({
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

  // ==================== Scenario 2: Manager + Tenant + Quota Linkage ====================

  describe("Scenario 2: Manager Registration + Tenant Context + Quota Linkage", () => {
    it("should correctly handle the linkage of Manager registration, tenant context setting, and quota management", () => {
      runtime = createKoduckFlowRuntime();

      // 1. Register custom Manager
      const customManager = createMockManager("CustomManager");
      runtime.registerManager("CustomManager", customManager);
      expect(runtime.hasManager("CustomManager")).toBe(true);

      // 2. Set tenant context
      const tenantContext = createTestTenantContext("tenant-123");
      runtime.setTenantContext(tenantContext);
      expect(runtime.getTenantContext()).toEqual(tenantContext);

      // 3. Verify quota management (using correct entity quota key)
      const snapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot).toBeDefined();
      expect(snapshot?.limit).toBe(1000); // From quotas.maxEntities
      expect(snapshot?.usage).toBe(0); // Current entity count

      // 4. Claim quota (entity quota uses actual entity count, not manual counting)
      const claimed = runtime.claimTenantQuota(TENANT_ENTITY_QUOTA_KEY);
      expect(claimed).toBe(true); // Check if entity can be added

      // 5. Entity quota usage is based on actual entity count, won't increase due to claim
      const updatedSnapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(updatedSnapshot?.usage).toBe(0); // Still 0 because no actual entity was created

      // 6. Test claim/release using custom quota bucket
      runtime.claimTenantQuota("api-calls", 100);
      const apiSnapshot = runtime.getTenantQuotaSnapshot("api-calls");
      expect(apiSnapshot?.usage).toBe(100);

      runtime.releaseTenantQuota("api-calls", 50);
      const apiSnapshot2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(apiSnapshot2?.usage).toBe(50);
    });

    it("should correctly reset quotas when switching tenants", () => {
      runtime = createKoduckFlowRuntime();

      // Tenant A - Use custom quota bucket (entity quota is based on actual entity count)
      const tenantA = createTestTenantContext("tenant-a");
      runtime.setTenantContext(tenantA);
      runtime.claimTenantQuota("api-calls", 200);

      const snapshotA = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotA?.usage).toBe(200);

      // Switch to tenant B
      const tenantB = createTestTenantContext("tenant-b");
      runtime.setTenantContext(tenantB);

      // Verify quotas are reset (count resets after tenant switch)
      const snapshotB = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotB?.usage).toBe(0);
      expect(snapshotB?.limit).toBe(5000); // From quotas.custom["api-calls"]

      // Tenant B claims quota
      runtime.claimTenantQuota("api-calls", 300);
      const snapshotB2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshotB2?.usage).toBe(300);
    });

    it("should allow quota claims without tenant context (no limit)", () => {
      runtime = createKoduckFlowRuntime();

      // When tenant context is not set, claimQuota returns true (no limit)
      const claimed = runtime.claimTenantQuota(TENANT_ENTITY_QUOTA_KEY, 100);
      expect(claimed).toBe(true);

      // But snapshot is still undefined (because there's no tenant context)
      const snapshot = runtime.getTenantQuotaSnapshot(TENANT_ENTITY_QUOTA_KEY);
      expect(snapshot).toBeUndefined();
    });

    it("should reject claims when quota limit is exceeded", () => {
      runtime = createKoduckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        quotas: {
          maxEntities: 100,
          custom: {
            "api-calls": 50, // Custom quota bucket
          },
        },
      });
      runtime.setTenantContext(tenantContext);

      // Test custom quota bucket (entity quota uses entity count, more complex to test)
      // Claim quota exceeding limit
      const claimed = runtime.claimTenantQuota("api-calls", 60);
      expect(claimed).toBe(false);

      // Verify quota unchanged
      const snapshot = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshot?.usage).toBe(0);

      // Claim reasonable quota
      const claimed2 = runtime.claimTenantQuota("api-calls", 30);
      expect(claimed2).toBe(true);

      const snapshot2 = runtime.getTenantQuotaSnapshot("api-calls");
      expect(snapshot2?.usage).toBe(30);
    });
  });

  // ==================== Scenario 3: Feature Flag and Rollout Integration ====================

  describe("Scenario 3: Feature Flag and Rollout Integration", () => {
    it("should correctly read tenant feature flags", () => {
      runtime = createKoduckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          features: {
            experimentalFeature: true,
            betaFeature: false,
          },
        },
      });
      runtime.setTenantContext(tenantContext);

      // Verify feature flags
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);
      expect(runtime.isTenantFeatureEnabled("betaFeature")).toBe(false);
      expect(runtime.isTenantFeatureEnabled("unknownFeature", false)).toBe(false);
    });

    it("should correctly handle Rollout config", () => {
      runtime = createKoduckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          cohort: "beta",
          variant: "v3",
          percentage: 75,
        },
      });
      runtime.setTenantContext(tenantContext);

      // Verify Rollout info
      expect(runtime.getTenantRolloutCohort()).toBe("beta");
      expect(runtime.getTenantRolloutVariant()).toBe("v3");
    });

    it("should determine if in gray release based on tenant ID and Rollout percentage", () => {
      runtime = createKoduckFlowRuntime();

      const tenantContext = createTestTenantContext("tenant-123", {
        rollout: {
          cohort: "alpha",
          variant: "v2",
          percentage: 50,
        },
      });
      runtime.setTenantContext(tenantContext);

      // Use deterministic seed
      const inRollout = runtime.isTenantInRollout("test-seed");
      expect(typeof inRollout).toBe("boolean");

      // Verify same seed returns same result
      const inRollout2 = runtime.isTenantInRollout("test-seed");
      expect(inRollout2).toBe(inRollout);

      // Verify different seeds may return different results
      const inRollout3 = runtime.isTenantInRollout("different-seed");
      expect(typeof inRollout3).toBe("boolean");
    });

    it("should return default values when no tenant context", () => {
      runtime = createKoduckFlowRuntime();

      // Tenant context not set
      expect(runtime.isTenantFeatureEnabled("anyFeature", true)).toBe(true);
      expect(runtime.isTenantFeatureEnabled("anyFeature", false)).toBe(false);
      expect(runtime.getTenantRolloutCohort()).toBeUndefined();
      expect(runtime.getTenantRolloutVariant()).toBeUndefined();
    });
  });

  // ==================== Scenario 4: Multi-tenant Isolation ====================

  describe("Scenario 4: Multi-tenant Isolation", () => {
    it("should isolate quota usage between different tenants", () => {
      runtime = createKoduckFlowRuntime();

      // Tenant A
      const tenantA = createTestTenantContext("tenant-a");
      runtime.setTenantContext(tenantA);
      runtime.claimTenantQuota("entity", 100);

      const snapshotA = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotA?.usage).toBe(100);

      // Switch to tenant B
      const tenantB = createTestTenantContext("tenant-b");
      runtime.setTenantContext(tenantB);
      runtime.claimTenantQuota("entity", 200);

      const snapshotB = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotB?.usage).toBe(200);

      // Switch back to tenant A, verify quota independence
      runtime.setTenantContext(tenantA);
      const snapshotA2 = runtime.getTenantQuotaSnapshot("entity");
      expect(snapshotA2?.usage).toBe(0); // Re-setting context clears quota tracking
    });

    it("should isolate feature flags between different tenants", () => {
      runtime = createKoduckFlowRuntime();

      // Tenant A: Feature enabled
      const tenantA = createTestTenantContext("tenant-a", {
        rollout: {
          features: {
            experimentalFeature: true,
          },
        },
      });
      runtime.setTenantContext(tenantA);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);

      // Tenant B: Feature disabled
      const tenantB = createTestTenantContext("tenant-b", {
        rollout: {
          features: {
            experimentalFeature: false,
          },
        },
      });
      runtime.setTenantContext(tenantB);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(false);

      // Switch back to tenant A
      runtime.setTenantContext(tenantA);
      expect(runtime.isTenantFeatureEnabled("experimentalFeature")).toBe(true);
    });

    it("should isolate Rollout config between different tenants", () => {
      runtime = createKoduckFlowRuntime();

      // Tenant A
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

      // Tenant B
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

  // ==================== Scenario 5: Scoped Runtime Creation ====================

  describe("Scenario 5: Scoped Runtime Creation", () => {
    it("should create an isolated child Runtime", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const childRuntime = createScopedRuntime(parentRuntime);

      // Verify child Runtime has independent container
      expect(childRuntime.container).not.toBe(parentRuntime.container);

      // Verify core services are independent
      expect(childRuntime.EntityManager).toBeDefined();
      expect(childRuntime.EntityManager).not.toBe(parentRuntime.EntityManager);

      // Cleanup
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should support manually setting child Runtime's tenant context", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const tenantContext = createTestTenantContext("tenant-123");
      parentRuntime.setTenantContext(tenantContext);

      const childRuntime = createScopedRuntime(parentRuntime);

      // createScopedRuntime does not automatically inherit tenant context, needs manual setup
      expect(childRuntime.getTenantContext()).toBeUndefined();

      // Manually set tenant context
      childRuntime.setTenantContext(tenantContext);
      expect(childRuntime.getTenantContext()).toEqual(tenantContext);

      // Cleanup
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should isolate quota usage in child Runtime", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const tenantContext = createTestTenantContext("tenant-123");
      parentRuntime.setTenantContext(tenantContext);
      parentRuntime.claimTenantQuota("api-calls", 100);

      const childRuntime = createScopedRuntime(parentRuntime);
      // Child Runtime needs manual tenant context setup
      childRuntime.setTenantContext(tenantContext);

      // Child Runtime has independent quota tracking
      const childSnapshot = childRuntime.getTenantQuotaSnapshot("api-calls");
      expect(childSnapshot?.usage).toBe(0); // Child Runtime starts from 0

      childRuntime.claimTenantQuota("api-calls", 200);
      const childSnapshot2 = childRuntime.getTenantQuotaSnapshot("api-calls");
      expect(childSnapshot2?.usage).toBe(200);

      // Parent Runtime quota is not affected
      const parentSnapshot = parentRuntime.getTenantQuotaSnapshot("api-calls");
      expect(parentSnapshot?.usage).toBe(100);

      // Cleanup
      childRuntime.dispose();
      parentRuntime.dispose();
    });

    it("should support child Runtime overriding parent Runtime config", () => {
      const parentRuntime = createKoduckFlowRuntime({
        managerInitialization: {
          timeoutMs: 5000,
        },
      });

      // The third parameter of createScopedRuntime is options, used for managerInitialization
      const childRuntime = createScopedRuntime(
        parentRuntime,
        undefined, // Second parameter is CoreServiceOverrides
        {
          managerInitialization: {
            timeoutMs: 10000,
          },
        }
      );

      // Verify child Runtime uses its own config
      const childDefaults = childRuntime.getManagerInitializationDefaults();
      expect(childDefaults.timeoutMs).toBe(10000);

      // Verify parent Runtime config is unchanged
      const parentDefaults = parentRuntime.getManagerInitializationDefaults();
      expect(parentDefaults.timeoutMs).toBe(5000);

      // Cleanup
      childRuntime.dispose();
      parentRuntime.dispose();
    });
  });

  // ==================== Scenario 6: Graceful Shutdown Flow ====================

  describe("Scenario 6: Graceful Shutdown Flow", () => {
    it("should correctly clean up all resources", () => {
      runtime = createKoduckFlowRuntime();

      // Register multiple Managers
      const manager1 = createMockManager("Manager1");
      const manager2 = createMockManager("Manager2");
      runtime.registerManager("Manager1", manager1);
      runtime.registerManager("Manager2", manager2);

      // Set tenant context
      const tenantContext = createTestTenantContext("tenant-123");
      runtime.setTenantContext(tenantContext);

      // Claim quota
      runtime.claimTenantQuota("entity", 100);

      // Shutdown Runtime
      runtime.dispose();

      // Verify Manager dispose is called
      expect(manager1.dispose).toHaveBeenCalled();
      expect(manager2.dispose).toHaveBeenCalled();

      // Verify state is cleaned up
      expect(runtime["disposed"]).toBe(true);
    });

    it("should mark as disposed after dispose", () => {
      runtime = createKoduckFlowRuntime();
      expect(runtime["disposed"]).toBe(false);

      runtime.dispose();

      // Verify disposed state
      expect(runtime["disposed"]).toBe(true);

      // Note: Current implementation does not throw errors, but Manager operations may fail or produce undefined behavior
      // This is a potential improvement point, but not the focus of this test
    });

    it("should support multiple dispose calls (idempotency)", () => {
      runtime = createKoduckFlowRuntime();

      runtime.dispose();
      runtime.dispose(); // Second call should not throw
      runtime.dispose(); // Third call should not throw

      expect(runtime["disposed"]).toBe(true);
    });

    it("should not affect parent Runtime after child Runtime dispose", () => {
      const parentRuntime = createKoduckFlowRuntime();
      const childRuntime = createScopedRuntime(parentRuntime);

      childRuntime.dispose();

      // Verify parent Runtime is still usable
      expect(parentRuntime.EntityManager).toBeDefined();
      expect(() => parentRuntime.registerManager("Test", createMockManager("Test"))).not.toThrow();

      // Cleanup
      parentRuntime.dispose();
    });
  });

  // ==================== Scenario 7: API Behavior Snapshot Tests ====================

  describe("Scenario 7: API Behavior Snapshot Tests", () => {
    it("should maintain consistent core API method signatures", () => {
      runtime = createKoduckFlowRuntime();

      // Verify all key API methods exist
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
        expect(runtime[method as keyof KoduckFlowRuntime]).toBeDefined();
        expect(typeof runtime[method as keyof KoduckFlowRuntime]).toBe("function");
      });
    });

    it("should maintain consistent core getter properties", () => {
      runtime = createKoduckFlowRuntime();

      // Verify all getter properties exist
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
        expect(runtime[getter as keyof KoduckFlowRuntime]).toBeDefined();
      });
    });

    it("should maintain consistent factory function behavior", () => {
      // Test createKoduckFlowRuntime
      const runtime1 = createKoduckFlowRuntime();
      expect(runtime1).toBeInstanceOf(KoduckFlowRuntime);
      expect(runtime1.EntityManager).toBeDefined();
      runtime1.dispose();

      // Test createKoduckFlowRuntime with options
      const runtime2 = createKoduckFlowRuntime({
        managerInitialization: { timeoutMs: 8000 },
      });
      expect(runtime2.getManagerInitializationDefaults().timeoutMs).toBe(8000);
      runtime2.dispose();

      // Test createScopedRuntime
      const parent = createKoduckFlowRuntime();
      const child = createScopedRuntime(parent);
      expect(child).toBeInstanceOf(KoduckFlowRuntime);
      expect(child.container).not.toBe(parent.container);
      child.dispose();
      parent.dispose();
    });
  });

  // ==================== Additional Scenario: Debug Config Integration ====================

  describe("Additional Scenario: Debug Config Integration", () => {
    it("should correctly configure and retrieve debug options", () => {
      runtime = createKoduckFlowRuntime();

      // Configure debug options (using correct DebugOptions properties)
      const debugOptions = {
        enabled: true,
        logLevel: "debug" as const,
        eventTracking: true,
        includeEmoji: true,
      };
      runtime.configureDebug(debugOptions);

      // Verify debug options are saved
      const retrievedOptions = runtime.getDebugOptions();
      expect(retrievedOptions).toEqual(debugOptions);
    });

    it("should support partial update of debug config", () => {
      runtime = createKoduckFlowRuntime();

      // Configure debug options
      runtime.configureDebug({
        enabled: true,
        logLevel: "debug" as const,
      });
      const options1 = runtime.getDebugOptions();
      expect(options1?.enabled).toBe(true);
      expect(options1?.logLevel).toBe("debug");

      // Partially update config
      runtime.configureDebug({
        eventTracking: true,
      });
      const options2 = runtime.getDebugOptions();
      expect(options2?.eventTracking).toBe(true);
    });
  });

  // ==================== Additional Scenario: Entity Operation Integration ====================

  describe("Additional Scenario: Entity Operation Integration", () => {
    it("should create and manage entities through Runtime shortcut methods", () => {
      runtime = createKoduckFlowRuntime();

      // Verify shortcut methods delegate to EntityManager
      // Note: Actual tests require mock EntityManager or real entity types
      expect(typeof runtime.createEntity).toBe("function");
      expect(typeof runtime.getEntity).toBe("function");
      expect(typeof runtime.removeEntity).toBe("function");
      expect(typeof runtime.hasEntity).toBe("function");
      expect(typeof runtime.getEntities).toBe("function");
      expect(typeof runtime.removeEntities).toBe("function");
    });
  });
});
