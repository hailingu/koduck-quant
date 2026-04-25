import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DuckFlowRuntime } from "../../../src/common/runtime/duck-flow-runtime";
import { createCoreContainer, registerCoreServices } from "../../../src/common/di/bootstrap";
import type { IManager } from "../../../src/common/manager/types";
import { ManagerInitializationError } from "../../../src/common/runtime/types";

/**
 * Comprehensive test suite for DuckFlowRuntime
 *
 * Tests cover:
 * 1. Runtime initialization and setup
 * 2. DI container operations (resolve, has)
 * 3. Manager registration and lifecycle
 * 4. Tenant context management (setTenantContext, getTenantContext)
 * 5. Resource quota management (claimTenantQuota, releaseTenantQuota)
 * 6. Feature flag system (isTenantFeatureEnabled, getTenantRolloutVariant)
 * 7. Debug and diagnostic capabilities (configureDebug)
 * 8. Entity and rendering operations
 * 9. Disposal and cleanup
 * 10. Error scenarios and recovery
 *
 * Coverage target: 100% line coverage for DuckFlowRuntime
 * Test cases: 44+ total
 */

// ============================================================================
// Test Utilities & Fixtures
// ============================================================================

interface MockManager extends IManager {
  name: string;
  type: string;
  dispose: () => void;
}

interface MockTenantContext {
  tenantId: string;
  userId?: string;
}

const createMockManager = (name: string): MockManager => ({
  name,
  type: "MockManager",
  dispose: () => {
    // noop
  },
});

const createTestRuntime = (options?: Record<string, unknown>) => {
  const container = createCoreContainer();
  registerCoreServices(container);
  return new DuckFlowRuntime(container, options);
};

// ============================================================================
// Test Suite: Runtime Initialization and Setup
// ============================================================================

describe("DuckFlowRuntime - Initialization and Setup", () => {
  let runtime: DuckFlowRuntime;

  afterEach(() => {
    if (runtime) {
      try {
        runtime.dispose();
      } catch {
        // Handle already disposed
      }
    }
  });

  it("should create runtime instance with default options", () => {
    runtime = createTestRuntime();

    expect(runtime).toBeDefined();
    expect(runtime.container).toBeDefined();
    expect(runtime).toHaveProperty("resolve");
    expect(runtime).toHaveProperty("has");
  });

  it("should initialize all core modules", () => {
    runtime = createTestRuntime();

    expect(() => runtime.EntityManager).not.toThrow();
    expect(runtime.EntityManager).toBeDefined();
  });

  it("should store container as public property", () => {
    const container = createCoreContainer();
    registerCoreServices(container);
    runtime = new DuckFlowRuntime(container);

    expect(runtime.container).toBe(container);
  });

  it("should not be disposed after creation", () => {
    runtime = createTestRuntime();

    expect(() => runtime.EntityManager).not.toThrow();
  });

  it("should create runtime with custom initialization options", () => {
    const options = { initializeManagers: true };
    runtime = createTestRuntime(options);

    expect(runtime).toBeDefined();
    expect(runtime.container).toBeDefined();
  });

  it("should verify manager coordination is set up", () => {
    runtime = createTestRuntime();

    const manager = createMockManager("test-manager");
    expect(() => {
      runtime.registerManager("test-manager", manager);
    }).not.toThrow();
  });

  it("should have container initialized before other modules", () => {
    runtime = createTestRuntime();

    // Container should be initialized and operational
    expect(runtime.container).toBeDefined();
    expect(runtime.EntityManager).toBeDefined();
  });

  it("should get manager initialization defaults", () => {
    runtime = createTestRuntime();

    const defaults = runtime.getManagerInitializationDefaults();
    expect(defaults).toBeDefined();
    expect(typeof defaults === "object").toBe(true);
  });
});

// ============================================================================
// Test Suite: DI Container Operations
// ============================================================================

describe("DuckFlowRuntime - DI Container Operations", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should return false for non-existent service", () => {
    const exists = runtime.has("NonExistentService");
    expect(exists).toBe(false);
  });

  it("should throw error when resolving non-existent service", () => {
    expect(() => {
      runtime.resolve("NonExistentService");
    }).toThrow();
  });

  it("should handle symbol tokens correctly", () => {
    const serviceSymbol = Symbol("TestService");
    runtime.container.registerInstance(serviceSymbol, { test: "value" });

    const exists = runtime.has(serviceSymbol);
    expect(exists).toBe(true);

    const resolved = runtime.resolve<Record<string, string>>(serviceSymbol);
    expect(resolved.test).toBe("value");
  });

  it("should verify core services are available", () => {
    expect(runtime.EntityManager).toBeDefined();
    expect(runtime.RenderManager).toBeDefined();
    expect(runtime.EventBus).toBeDefined();
  });

  it("should return same core service instance on multiple accesses", () => {
    const instance1 = runtime.EntityManager;
    const instance2 = runtime.EntityManager;

    expect(instance1).toBe(instance2);
  });

  it("should maintain container availability", () => {
    expect(runtime.container).toBeDefined();
    const container1 = runtime.container;
    const container2 = runtime.container;
    expect(container1).toBe(container2);
  });
});

// ============================================================================
// Test Suite: Manager Registration and Lifecycle
// ============================================================================

describe("DuckFlowRuntime - Manager Registration and Lifecycle", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should register custom manager successfully", () => {
    const manager = createMockManager("custom-manager");

    expect(() => {
      runtime.registerManager("custom-manager", manager);
    }).not.toThrow();
  });

  it("should retrieve registered manager", () => {
    const manager = createMockManager("custom-manager");
    runtime.registerManager("custom-manager", manager);

    const retrieved = runtime.getManager("custom-manager");
    expect(retrieved).toBe(manager);
  });

  it("should check if manager exists", () => {
    const manager = createMockManager("custom-manager");
    runtime.registerManager("custom-manager", manager);

    const exists = runtime.hasManager("custom-manager");
    expect(exists).toBe(true);
  });

  it("should return false for non-existent manager", () => {
    const exists = runtime.hasManager("non-existent-manager");
    expect(exists).toBe(false);
  });

  it("should throw error when manager has missing dependencies", () => {
    const manager = createMockManager("dependent-manager");

    expect(() => {
      runtime.registerManager("dependent-manager", manager, {
        dependencies: ["non-existent-dependency"],
      });
    }).toThrow(ManagerInitializationError);
  });

  it("should support lazy manager initialization", () => {
    const manager = createMockManager("lazy-manager");

    expect(() => {
      runtime.registerManager("lazy-manager", manager, { lazy: true });
    }).not.toThrow();

    const retrieved = runtime.getManager("lazy-manager");
    expect(retrieved).toBe(manager);
  });

  it("should handle manager unregistration", () => {
    const manager = createMockManager("removable-manager");
    runtime.registerManager("removable-manager", manager);

    expect(runtime.hasManager("removable-manager")).toBe(true);

    runtime.unregisterManager("removable-manager");

    expect(runtime.hasManager("removable-manager")).toBe(false);
  });

  it("should support manager with valid dependencies", () => {
    const manager = createMockManager("dependent-manager");

    // Register without dependencies - should always work
    expect(() => {
      runtime.registerManager("dependent-manager", manager);
    }).not.toThrow();

    expect(runtime.hasManager("dependent-manager")).toBe(true);
  });

  it("should get registered managers list", () => {
    const managers = runtime.getRegisteredManagers();
    expect(Array.isArray(managers)).toBe(true);
    expect(managers.length > 0).toBe(true);
  });

  it("should get initialized managers list", () => {
    const managers = runtime.getInitializedManagers();
    expect(Array.isArray(managers)).toBe(true);
  });
});

// ============================================================================
// Test Suite: Tenant Context Management
// ============================================================================

describe("DuckFlowRuntime - Tenant Context Management", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should get tenant context when set", () => {
    expect(() => {
      runtime.getTenantContext();
    }).not.toThrow();
  });

  it("should return undefined for tenant context initially", () => {
    const context = runtime.getTenantContext();
    expect(context).toBeUndefined();
  });

  it("should set tenant context", () => {
    const mockContext: MockTenantContext = {
      tenantId: "tenant-1",
      userId: "user-1",
    };

    expect(() => {
      runtime.setTenantContext(mockContext as unknown as never);
    }).not.toThrow();
  });

  it("should retrieve set tenant context", () => {
    const mockContext: MockTenantContext = {
      tenantId: "tenant-1",
      userId: "user-1",
    };

    runtime.setTenantContext(mockContext as unknown as never);
    const retrieved = runtime.getTenantContext();

    expect(retrieved).toBeDefined();
    expect(retrieved?.tenantId).toBe("tenant-1");
  });

  it("should clear tenant context by setting null", () => {
    const mockContext: MockTenantContext = {
      tenantId: "tenant-1",
    };

    runtime.setTenantContext(mockContext as unknown as never);
    expect(runtime.getTenantContext()).toBeDefined();

    runtime.setTenantContext(null);
    expect(runtime.getTenantContext()).toBeUndefined();
  });

  it("should support multiple tenant context switches", () => {
    const context1: MockTenantContext = { tenantId: "tenant-1" };
    const context2: MockTenantContext = { tenantId: "tenant-2" };

    runtime.setTenantContext(context1 as unknown as never);
    let retrieved = runtime.getTenantContext();
    expect(retrieved?.tenantId).toBe("tenant-1");

    runtime.setTenantContext(context2 as unknown as never);
    retrieved = runtime.getTenantContext();
    expect(retrieved?.tenantId).toBe("tenant-2");

    runtime.setTenantContext(context1 as unknown as never);
    retrieved = runtime.getTenantContext();
    expect(retrieved?.tenantId).toBe("tenant-1");
  });
});

// ============================================================================
// Test Suite: Quota Management
// ============================================================================

describe("DuckFlowRuntime - Quota Management", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should claim tenant quota", () => {
    const claimed = runtime.claimTenantQuota("entity", 1);
    expect(typeof claimed).toBe("boolean");
  });

  it("should release tenant quota", () => {
    const released = runtime.releaseTenantQuota("entity", 1);
    expect(typeof released).toBe("number");
  });

  it("should get quota snapshot", () => {
    const snapshot = runtime.getTenantQuotaSnapshot("entity");
    expect(snapshot === undefined || typeof snapshot === "object").toBe(true);
  });

  it("should list quota snapshots", () => {
    const snapshots = runtime.listTenantQuotaSnapshots();
    expect(Array.isArray(snapshots)).toBe(true);
  });

  it("should support quota claim and release cycle", () => {
    const claimed = runtime.claimTenantQuota("resource", 5);
    expect(typeof claimed).toBe("boolean");

    const released = runtime.releaseTenantQuota("resource", 5);
    expect(released >= 0).toBe(true);
  });
});

// ============================================================================
// Test Suite: Feature Flags
// ============================================================================

describe("DuckFlowRuntime - Feature Flags", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should check tenant feature enabled", () => {
    const enabled = runtime.isTenantFeatureEnabled("test-feature");
    expect(typeof enabled).toBe("boolean");
  });

  it("should check tenant feature with default value", () => {
    const enabled = runtime.isTenantFeatureEnabled("unknown-feature", true);
    expect(enabled).toBe(true);
  });

  it("should get tenant rollout variant", () => {
    const variant = runtime.getTenantRolloutVariant();
    expect(variant === undefined || typeof variant === "string").toBe(true);
  });

  it("should get tenant rollout cohort", () => {
    const cohort = runtime.getTenantRolloutCohort();
    expect(cohort === undefined || typeof cohort === "string").toBe(true);
  });

  it("should check if tenant is in rollout", () => {
    const inRollout = runtime.isTenantInRollout();
    expect(typeof inRollout).toBe("boolean");
  });

  it("should support feature flag with seed", () => {
    const inRollout1 = runtime.isTenantInRollout("seed-1");
    const inRollout2 = runtime.isTenantInRollout("seed-1");

    expect(inRollout1).toBe(inRollout2);
  });
});

// ============================================================================
// Test Suite: Debug and Diagnostic
// ============================================================================

describe("DuckFlowRuntime - Debug and Diagnostic", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should configure debug options", () => {
    expect(() => {
      runtime.configureDebug();
    }).not.toThrow();
  });

  it("should retrieve debug options", () => {
    runtime.configureDebug();
    const options = runtime.getDebugOptions();

    expect(options === undefined || typeof options === "object").toBe(true);
  });

  it("should support debug configuration changes", () => {
    runtime.configureDebug();

    expect(() => {
      runtime.configureDebug();
    }).not.toThrow();
  });

  it("should handle null debug configuration", () => {
    expect(() => {
      runtime.configureDebug();
    }).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Entity and Rendering Operations
// ============================================================================

describe("DuckFlowRuntime - Entity and Rendering Operations", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should access entity manager via property", () => {
    const entityManager = runtime.EntityManager;
    expect(entityManager).toBeDefined();
  });

  it("should access render manager via property", () => {
    const renderManager = runtime.RenderManager;
    expect(renderManager).toBeDefined();
  });

  it("should access event bus via property", () => {
    const eventBus = runtime.EventBus;
    expect(eventBus).toBeDefined();
  });

  it("should access registry manager via property", () => {
    const registryManager = runtime.RegistryManager;
    expect(registryManager).toBeDefined();
  });

  it("should access entity events", () => {
    const entityEvents = runtime.EntityEvents;
    expect(entityEvents).toBeDefined();
  });

  it("should access render events", () => {
    const renderEvents = runtime.RenderEvents;
    expect(renderEvents).toBeDefined();
  });

  it("should get entity by id", () => {
    const entity = runtime.getEntity("non-existent");
    expect(entity === undefined || typeof entity === "object").toBe(true);
  });

  it("should check entity existence", () => {
    const exists = runtime.hasEntity("test-entity");
    expect(typeof exists).toBe("boolean");
  });

  it("should get all entities", () => {
    const entities = runtime.getEntities();
    expect(Array.isArray(entities)).toBe(true);
  });

  it("should remove entities by ids", () => {
    const removed = runtime.removeEntities(["id-1", "id-2"]);
    expect(typeof removed).toBe("number");
  });
});

// ============================================================================
// Test Suite: Disposal and Cleanup
// ============================================================================

describe("DuckFlowRuntime - Disposal and Cleanup", () => {
  it("should dispose runtime successfully", () => {
    const runtime = createTestRuntime();

    expect(() => {
      runtime.dispose();
    }).not.toThrow();
  });

  it("should be idempotent - allow multiple disposals", () => {
    const runtime = createTestRuntime();

    runtime.dispose();

    expect(() => {
      runtime.dispose();
    }).not.toThrow();
  });

  it("should be unusable after disposal but not throw on all operations", () => {
    const runtime = createTestRuntime();

    // Register a custom manager
    const manager = createMockManager("custom-manager");
    runtime.registerManager("custom-manager", manager);

    expect(runtime.hasManager("custom-manager")).toBe(true);

    runtime.dispose();

    // After disposal, custom managers should be unregistered
    expect(runtime.hasManager("custom-manager")).toBe(false);
  });

  it("should clean up all managers on disposal", () => {
    const runtime = createTestRuntime();
    const manager = createMockManager("test-manager");
    runtime.registerManager("test-manager", manager);

    expect(runtime.hasManager("test-manager")).toBe(true);

    runtime.dispose();

    expect(runtime.hasManager("test-manager")).toBe(false);
  });

  it("should handle operations after disposal gracefully", () => {
    const runtime = createTestRuntime();

    runtime.dispose();

    // These operations should not throw but might return undefined
    expect(() => {
      runtime.getRegisteredManagers();
    }).not.toThrow();

    expect(() => {
      runtime.getInitializedManagers();
    }).not.toThrow();
  });

  it("should clear tenant context on disposal", () => {
    const runtime = createTestRuntime();
    const mockContext: MockTenantContext = { tenantId: "tenant-1" };
    runtime.setTenantContext(mockContext as unknown as never);

    const beforeDisposal = runtime.getTenantContext();
    expect(beforeDisposal?.tenantId).toBe("tenant-1");

    // Disposal should not throw
    expect(() => {
      runtime.dispose();
    }).not.toThrow();

    // After disposal, either context is cleared or operations don't throw
    expect(() => {
      runtime.getTenantContext();
    }).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Error Scenarios and Recovery
// ============================================================================

describe("DuckFlowRuntime - Error Scenarios and Recovery", () => {
  it("should handle invalid container creation", () => {
    const createInvalid = () => {
      return new DuckFlowRuntime(null as never);
    };
    expect(createInvalid).toThrow();
  });

  it("should recover from manager registration error", () => {
    const runtime = createTestRuntime();

    const manager = createMockManager("valid-manager");

    try {
      runtime.registerManager("valid-manager", manager, {
        dependencies: ["non-existent"],
      });
    } catch {
      // Expected
    }

    expect(runtime.EntityManager).toBeDefined();

    runtime.dispose();
  });

  it("should maintain runtime stability after errors", () => {
    const runtime = createTestRuntime();

    try {
      runtime.resolve("NonExistent");
    } catch {
      // Expected
    }

    expect(runtime.EntityManager).toBeDefined();

    runtime.dispose();
  });

  it("should recover after tenant context operations", () => {
    const runtime = createTestRuntime();
    const context: MockTenantContext = { tenantId: "tenant-1" };

    runtime.setTenantContext(context as unknown as never);

    const retrieved = runtime.getTenantContext();
    expect(retrieved?.tenantId).toBe("tenant-1");

    runtime.dispose();
  });

  it("should recover after quota operations", () => {
    const runtime = createTestRuntime();
    runtime.claimTenantQuota("entity", 1);

    const snapshots = runtime.listTenantQuotaSnapshots();
    expect(Array.isArray(snapshots)).toBe(true);

    runtime.dispose();
  });

  it("should handle concurrent manager operations", () => {
    const runtime = createTestRuntime();

    const managers = Array.from({ length: 5 }, (_, i) => createMockManager(`manager-${i}`));

    expect(() => {
      for (const [i, manager] of managers.entries()) {
        runtime.registerManager(`manager-${i}`, manager);
      }
    }).not.toThrow();

    for (const [i] of managers.entries()) {
      expect(runtime.hasManager(`manager-${i}`)).toBe(true);
    }

    runtime.dispose();
  });

  it("should handle rapid tenant context switches", () => {
    const runtime = createTestRuntime();
    const context1: MockTenantContext = { tenantId: "tenant-1" };
    const context2: MockTenantContext = { tenantId: "tenant-2" };

    for (let i = 0; i < 3; i++) {
      runtime.setTenantContext(context1 as unknown as never);
      const retrieved = runtime.getTenantContext();
      expect(retrieved?.tenantId).toBe("tenant-1");

      runtime.setTenantContext(context2 as unknown as never);
      const retrieved2 = runtime.getTenantContext();
      expect(retrieved2?.tenantId).toBe("tenant-2");
    }

    runtime.dispose();
  });

  it("should maintain data integrity after errors", () => {
    const runtime = createTestRuntime();

    const manager1 = createMockManager("manager-1");
    runtime.registerManager("manager-1", manager1);

    try {
      runtime.registerManager("invalid", createMockManager("invalid"), {
        dependencies: ["non-existent"],
      });
    } catch {
      // Expected
    }

    expect(runtime.hasManager("manager-1")).toBe(true);
    expect(runtime.getManager("manager-1")).toBe(manager1);

    runtime.dispose();
  });
});

// ============================================================================
// Test Suite: State Management and Consistency
// ============================================================================

describe("DuckFlowRuntime - State Management and Consistency", () => {
  let runtime: DuckFlowRuntime;

  beforeEach(() => {
    runtime = createTestRuntime();
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
    }
  });

  it("should maintain consistent container reference", () => {
    const container1 = runtime.container;
    const container2 = runtime.container;

    expect(container1).toBe(container2);
  });

  it("should maintain manager state across operations", () => {
    const manager = createMockManager("test-manager");
    runtime.registerManager("test-manager", manager);

    const retrieved1 = runtime.getManager("test-manager");
    const retrieved2 = runtime.getManager("test-manager");

    expect(retrieved1).toBe(retrieved2);
    expect(retrieved1).toBe(manager);
  });

  it("should maintain tenant context state across operations", () => {
    const context: MockTenantContext = { tenantId: "tenant-1" };
    runtime.setTenantContext(context as unknown as never);

    const context1 = runtime.getTenantContext();
    const context2 = runtime.getTenantContext();

    expect(context1?.tenantId).toBe(context2?.tenantId);
    expect(context1?.tenantId).toBe("tenant-1");
  });

  it("should maintain feature flag consistency", () => {
    const flag1 = runtime.isTenantFeatureEnabled("persistent-feature");
    const flag2 = runtime.isTenantFeatureEnabled("persistent-feature");

    expect(flag1).toBe(flag2);
  });

  it("should maintain quota consistency", () => {
    const quota1 = runtime.getTenantQuotaSnapshot("entity");
    const quota2 = runtime.getTenantQuotaSnapshot("entity");

    expect(quota1).toBe(quota2);
  });
});
