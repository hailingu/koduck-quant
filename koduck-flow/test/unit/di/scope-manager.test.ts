import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";
import type { IDependencyContainer } from "../../../src/common/di/types";

/**
 * Comprehensive test suite for Scope Management
 *
 * Tests cover:
 * 1. Scope creation and lifecycle
 * 2. Scope isolation and service instances
 * 3. Scope inheritance and parent-child relationships
 * 4. Scope disposal and cleanup
 * 5. Service resolution in scoped contexts
 * 6. Nested scopes and hierarchy
 * 7. Performance and stress testing
 *
 * Coverage target: 100% line coverage
 * Test cases: 24 total
 */

// ============================================================================
// Test Fixtures
// ============================================================================

interface ScopedService {
  id: string;
  createdAt: number;
}

interface ScopedDatabase {
  connectionId: string;
  created: boolean;
}

const createScopedService = (id: string): ScopedService => ({
  id,
  createdAt: Date.now(),
});

const createScopedDatabase = (): ScopedDatabase => ({
  connectionId: `conn-${Math.random()}`,
  created: true,
});

// ============================================================================
// Test Suite: Scope Creation and Basic Lifecycle
// ============================================================================

describe("Scope Manager - Scope Creation", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should create a child scope", () => {
    const scope = container.createScope();
    expect(scope).toBeDefined();
    expect(scope).toBeInstanceOf(DefaultDependencyContainer);
    scope.dispose();
  });

  it("should create multiple independent scopes", () => {
    const scope1 = container.createScope();
    const scope2 = container.createScope();
    const scope3 = container.createScope();

    expect(scope1).not.toBe(scope2);
    expect(scope2).not.toBe(scope3);
    expect(scope1).not.toBe(scope3);

    scope1.dispose();
    scope2.dispose();
    scope3.dispose();
  });

  it("should allow scope to be used for service registration", () => {
    const scope = container.createScope();

    expect(() => {
      scope.registerInstance("scoped-service", createScopedService("service-1"));
    }).not.toThrow();

    scope.dispose();
  });

  it("should allow scope to resolve services", () => {
    const scope = container.createScope();
    const service = createScopedService("test");
    scope.registerInstance("scoped-service", service);

    const resolved = scope.resolve<ScopedService>("scoped-service");
    expect(resolved).toBe(service);

    scope.dispose();
  });

  it("should throw error when creating scope from disposed container", () => {
    container.dispose();
    expect(() => container.createScope()).toThrow();
  });
});

// ============================================================================
// Test Suite: Scope Isolation
// ============================================================================

describe("Scope Manager - Scope Isolation", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should isolate scoped service instances between scopes", () => {
    let creationCount = 0;

    container.register(
      "scoped-service",
      () => {
        creationCount++;
        return createScopedService(`service-${creationCount}`);
      },
      { lifecycle: "scoped" }
    );

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const service1 = scope1.resolve<ScopedService>("scoped-service");
    const service2 = scope2.resolve<ScopedService>("scoped-service");

    expect(service1.id).toBe("service-1");
    expect(service2.id).toBe("service-2");
    expect(creationCount).toBe(2);

    scope1.dispose();
    scope2.dispose();
  });

  it("should return same scoped instance within same scope", () => {
    let creationCount = 0;

    container.register(
      "scoped-service",
      () => {
        creationCount++;
        return createScopedService(`service-${creationCount}`);
      },
      { lifecycle: "scoped" }
    );

    const scope = container.createScope();

    const service1 = scope.resolve<ScopedService>("scoped-service");
    const service2 = scope.resolve<ScopedService>("scoped-service");
    const service3 = scope.resolve<ScopedService>("scoped-service");

    expect(service1).toBe(service2);
    expect(service2).toBe(service3);
    expect(creationCount).toBe(1);

    scope.dispose();
  });

  it("should prevent scope from affecting parent container services", () => {
    const parentService = createScopedService("parent");
    container.registerInstance("service", parentService, { lifecycle: "singleton" });

    const scope = container.createScope();

    const resolvedFromParent = container.resolve<ScopedService>("service");
    const resolvedFromScope = scope.resolve<ScopedService>("service");

    expect(resolvedFromParent).toBe(parentService);
    expect(resolvedFromScope).toBe(parentService);

    scope.dispose();
  });

  it("should prevent child scope from affecting parent scope services", () => {
    const scope1 = container.createScope();
    const service1 = createScopedService("scope1-service");
    scope1.registerInstance("scoped", service1);

    const scope2 = container.createScope();

    expect(scope1.has("scoped")).toBe(true);
    expect(scope2.has("scoped")).toBe(false);

    scope1.dispose();
    scope2.dispose();
  });
});

// ============================================================================
// Test Suite: Scope Inheritance
// ============================================================================

describe("Scope Manager - Scope Inheritance", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should share singleton services across scopes", () => {
    const singleton = createScopedService("singleton");
    container.registerInstance("singleton", singleton, { lifecycle: "singleton" });

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const resolved1 = scope1.resolve<ScopedService>("singleton");
    const resolved2 = scope2.resolve<ScopedService>("singleton");
    const resolvedParent = container.resolve<ScopedService>("singleton");

    expect(resolved1).toBe(singleton);
    expect(resolved2).toBe(singleton);
    expect(resolvedParent).toBe(singleton);

    scope1.dispose();
    scope2.dispose();
  });

  it("should inherit parent container registrations in child scope", () => {
    interface Logger {
      log: () => void;
    }

    const logger: Logger = { log: () => {} };
    const database = createScopedDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    const scope = container.createScope();

    expect(scope.has("logger")).toBe(true);
    expect(scope.has("database")).toBe(true);

    const resolvedLogger = scope.resolve<Logger>("logger");
    const resolvedDb = scope.resolve<ScopedDatabase>("database");

    expect(resolvedLogger).toBe(logger);
    expect(resolvedDb).toBe(database);

    scope.dispose();
  });

  it("should allow child scope to override parent registration", () => {
    const parentService = createScopedService("parent");
    const childService = createScopedService("child");

    container.registerInstance("service", parentService);

    const scope = container.createScope();
    scope.registerInstance("service", childService, { replace: true });

    expect(container.resolve<ScopedService>("service")).toBe(parentService);
    expect(scope.resolve<ScopedService>("service")).toBe(childService);

    scope.dispose();
  });

  it("should support nested scope hierarchies", () => {
    const service1 = createScopedService("scope1");
    const service2 = createScopedService("scope2");
    const service3 = createScopedService("scope3");

    const scope1 = container.createScope();
    scope1.registerInstance("level-1", service1);

    const scope2 = scope1.createScope();
    scope2.registerInstance("level-2", service2);

    const scope3 = scope2.createScope();
    scope3.registerInstance("level-3", service3);

    expect(scope1.has("level-1")).toBe(true);
    expect(scope2.has("level-1")).toBe(true);
    expect(scope2.has("level-2")).toBe(true);
    expect(scope3.has("level-1")).toBe(true);
    expect(scope3.has("level-2")).toBe(true);
    expect(scope3.has("level-3")).toBe(true);

    scope1.dispose();
    scope2.dispose();
    scope3.dispose();
  });

  it("should not allow scope to inherit sibling scope services", () => {
    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const service1 = createScopedService("service1");
    scope1.registerInstance("service", service1);

    expect(scope1.has("service")).toBe(true);
    expect(scope2.has("service")).toBe(false);

    scope1.dispose();
    scope2.dispose();
  });
});

// ============================================================================
// Test Suite: Scope Disposal and Cleanup
// ============================================================================

describe("Scope Manager - Scope Disposal", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    if (!container["disposed"]) {
      container.dispose();
    }
  });

  it("should dispose scope independently", () => {
    const scope = container.createScope();
    scope.registerInstance("service", createScopedService("test"));

    expect(scope.has("service")).toBe(true);

    scope.dispose();

    expect(() => scope.resolve("service")).toThrow("This dependency container has been disposed");
  });

  it("should dispose multiple scopes independently", () => {
    container.registerInstance("shared-service", { id: "shared" });

    const scope1 = container.createScope();
    const scope2 = container.createScope();
    const scope3 = container.createScope();

    // All scopes can resolve before disposal
    expect(() => scope1.resolve("shared-service")).not.toThrow();
    expect(() => scope2.resolve("shared-service")).not.toThrow();
    expect(() => scope3.resolve("shared-service")).not.toThrow();

    scope1.dispose();
    scope2.dispose();

    // Disposed scopes should throw
    expect(() => scope1.resolve("shared-service")).toThrow();
    expect(() => scope2.resolve("shared-service")).toThrow();
    // Undisposed scope should still work
    expect(() => scope3.resolve("shared-service")).not.toThrow();

    scope3.dispose();
  });

  it("should dispose child scopes when parent is disposed", () => {
    const scope1 = container.createScope();
    const scope2 = container.createScope();

    container.dispose();

    expect(() => scope1.resolve("any")).toThrow();
    expect(() => scope2.resolve("any")).toThrow();
  });

  it("should call dispose handlers for scoped services", () => {
    let disposed = false;
    const service = {
      dispose: () => {
        disposed = true;
      },
    };

    const scope = container.createScope();
    scope.register("service", () => service, {
      lifecycle: "scoped",
      dispose: () => {
        disposed = true;
      },
    });

    scope.resolve("service");
    scope.dispose();

    expect(disposed).toBe(true);
  });

  it("should cleanup scoped instances on disposal", () => {
    const scope = container.createScope();

    container.register("scoped", () => createScopedService("test"), { lifecycle: "scoped" });

    scope.resolve("scoped");

    scope.dispose();

    expect(() => scope.resolve("scoped")).toThrow();
  });
});

// ============================================================================
// Test Suite: Scoped Service Resolution
// ============================================================================

describe("Scope Manager - Service Resolution in Scopes", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should resolve transient services with new instance each time in scope", () => {
    let creationCount = 0;

    container.register(
      "transient",
      () => {
        creationCount++;
        return createScopedService(`transient-${creationCount}`);
      },
      { lifecycle: "transient" }
    );

    const scope = container.createScope();

    const service1 = scope.resolve<ScopedService>("transient");
    const service2 = scope.resolve<ScopedService>("transient");

    expect(service1.id).toBe("transient-1");
    expect(service2.id).toBe("transient-2");
    expect(creationCount).toBe(2);

    scope.dispose();
  });

  it("should allow scope to resolve factory-created scoped services", () => {
    const dependency = { value: "test-dependency" };
    container.registerInstance("dependency", dependency);

    interface ScopedWithDep extends ScopedService {
      dependency: Record<string, string>;
    }

    container.register(
      "scoped-service",
      (c): ScopedWithDep => {
        const dep = c.resolve<Record<string, string>>("dependency");
        return {
          ...createScopedService("scoped"),
          dependency: dep,
        };
      },
      { lifecycle: "scoped" }
    );

    const scope = container.createScope();
    const service1 = scope.resolve<ScopedWithDep>("scoped-service");
    const service2 = scope.resolve<ScopedWithDep>("scoped-service");

    expect(service1).toBe(service2);
    expect(service1.dependency).toBe(dependency);

    scope.dispose();
  });

  it("should allow scoped services to depend on singletons", () => {
    const singleton = createScopedService("singleton");
    container.registerInstance("singleton", singleton);

    container.register(
      "scoped",
      (c) => {
        const s = c.resolve<ScopedService>("singleton");
        return {
          ...createScopedService("scoped"),
          dependsOn: s,
        };
      },
      { lifecycle: "scoped" }
    );

    const scope = container.createScope();
    interface ScopedWithDependency extends ScopedService {
      dependsOn: ScopedService;
    }
    const service = scope.resolve<ScopedWithDependency>("scoped");

    expect(service.dependsOn).toBe(singleton);

    scope.dispose();
  });

  it("should maintain independence of scoped dependencies across scopes", () => {
    let creationCount = 0;

    container.register(
      "scoped-dep",
      () => {
        creationCount++;
        return { id: `dep-${creationCount}` };
      },
      { lifecycle: "scoped" }
    );

    interface DepService {
      id: string;
    }

    interface ScopedWithDep {
      id: string;
      dep: DepService;
    }

    container.register(
      "scoped-service",
      (c): ScopedWithDep => ({
        id: "service",
        dep: c.resolve<DepService>("scoped-dep"),
      }),
      { lifecycle: "scoped" }
    );

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const service1 = scope1.resolve<ScopedWithDep>("scoped-service");
    const service2 = scope2.resolve<ScopedWithDep>("scoped-service");

    expect(service1.dep.id).toBe("dep-1");
    expect(service2.dep.id).toBe("dep-2");

    scope1.dispose();
    scope2.dispose();
  });
});

// ============================================================================
// Test Suite: Nested Scopes and Hierarchy
// ============================================================================

describe("Scope Manager - Nested Scopes", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should support nested scope creation", () => {
    const scope1 = container.createScope();
    const scope2 = scope1.createScope();
    const scope3 = scope2.createScope();

    expect(scope1).toBeDefined();
    expect(scope2).toBeDefined();
    expect(scope3).toBeDefined();

    scope1.dispose();
    scope2.dispose();
    scope3.dispose();
  });

  it("should maintain scoped service independence in nested scopes", () => {
    let creationCount = 0;

    container.register(
      "scoped",
      () => {
        creationCount++;
        return createScopedService(`scoped-${creationCount}`);
      },
      { lifecycle: "scoped" }
    );

    const scope1 = container.createScope();
    const scope2 = scope1.createScope();
    const scope3 = scope2.createScope();

    const s1 = scope1.resolve<ScopedService>("scoped");
    const s2 = scope2.resolve<ScopedService>("scoped");
    const s3 = scope3.resolve<ScopedService>("scoped");

    expect(s1.id).toBe("scoped-1");
    expect(s2.id).toBe("scoped-2");
    expect(s3.id).toBe("scoped-3");

    scope1.dispose();
    scope2.dispose();
    scope3.dispose();
  });

  it("should inherit registrations through nested scope chain", () => {
    interface InheritedService {
      value: string;
    }

    const service: InheritedService = { value: "inherited" };
    container.registerInstance("inherited", service);

    const scope1 = container.createScope();
    const scope2 = scope1.createScope();
    const scope3 = scope2.createScope();

    expect(scope1.has("inherited")).toBe(true);
    expect(scope2.has("inherited")).toBe(true);
    expect(scope3.has("inherited")).toBe(true);

    expect(scope1.resolve<InheritedService>("inherited")).toBe(service);
    expect(scope2.resolve<InheritedService>("inherited")).toBe(service);
    expect(scope3.resolve<InheritedService>("inherited")).toBe(service);

    scope1.dispose();
    scope2.dispose();
    scope3.dispose();
  });

  it("should dispose nested scopes independently", () => {
    container.registerInstance("service", { id: "test-service" });

    const scope1 = container.createScope();
    const scope2 = scope1.createScope();
    const scope3 = scope2.createScope();

    // All can resolve before disposal
    expect(() => scope1.resolve("service")).not.toThrow();
    expect(() => scope2.resolve("service")).not.toThrow();
    expect(() => scope3.resolve("service")).not.toThrow();

    scope2.dispose();

    // After disposing scope2, it should throw, but scope1 and scope3 should be affected
    expect(() => scope1.resolve("service")).not.toThrow();
    expect(() => scope2.resolve("service")).toThrow();
    // scope3 is child of scope2, so it should also be disposed
    expect(() => scope3.resolve("service")).toThrow();

    scope1.dispose();
    scope3.dispose();
  });
});

// ============================================================================
// Test Suite: Complex Scope Scenarios
// ============================================================================

describe("Scope Manager - Complex Scenarios", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should support multiple concurrent scope operations", () => {
    const scopes: IDependencyContainer[] = [];

    for (let i = 0; i < 10; i++) {
      scopes.push(container.createScope());
    }

    for (let i = 0; i < scopes.length; i++) {
      scopes[i].registerInstance(`service-${i}`, { id: i });
      expect(scopes[i].has(`service-${i}`)).toBe(true);
    }

    for (const scope of scopes) {
      scope.dispose();
    }
  });

  it("should handle scope branching pattern", () => {
    // Create parent scope
    const parentScope = container.createScope();
    parentScope.registerInstance("parent-service", { name: "parent" });

    // Create two child branches
    const branch1 = parentScope.createScope();
    const branch2 = parentScope.createScope();

    branch1.registerInstance("branch1-service", { name: "branch1" });
    branch2.registerInstance("branch2-service", { name: "branch2" });

    // Verify isolation
    expect(branch1.has("parent-service")).toBe(true);
    expect(branch1.has("branch2-service")).toBe(false);
    expect(branch2.has("parent-service")).toBe(true);
    expect(branch2.has("branch1-service")).toBe(false);

    parentScope.dispose();
    branch1.dispose();
    branch2.dispose();
  });

  it("should support rapid scope creation and disposal", () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        const scope = container.createScope();
        scope.dispose();
      }
    }).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Performance and Stress Testing
// ============================================================================

describe("Scope Manager - Performance", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should handle large number of scoped services", () => {
    for (let i = 0; i < 50; i++) {
      container.register(`service-${i}`, () => createScopedService(`service-${i}`), {
        lifecycle: "scoped",
      });
    }

    const scope = container.createScope();

    expect(() => {
      for (let i = 0; i < 50; i++) {
        scope.resolve(`service-${i}`);
      }
    }).not.toThrow();

    scope.dispose();
  });

  it("should handle deep scope hierarchies efficiently", () => {
    let currentScope: IDependencyContainer = container;

    expect(() => {
      for (let i = 0; i < 20; i++) {
        const newScope = currentScope.createScope();
        newScope.registerInstance(`level-${i}`, { level: i });
        currentScope = newScope;
      }
    }).not.toThrow();

    // Clean up
    const scope = currentScope as DefaultDependencyContainer;
    for (let i = 0; i < 20; i++) {
      if ("dispose" in scope) {
        scope.dispose();
      }
    }
  });

  it("should maintain performance with repeated scope operations", () => {
    const startTime = Date.now();

    for (let i = 0; i < 50; i++) {
      const scope = container.createScope();
      scope.registerInstance("service", createScopedService(`service-${i}`));
      const resolved = scope.resolve("service");
      expect(resolved).toBeDefined();
      scope.dispose();
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // Should complete in reasonable time
  });
});
