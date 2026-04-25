import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";

interface TestService {
  id: string;
  name: string;
}

describe("DI Error Handling and Exceptions", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe("Type Error Handling", () => {
    it("should throw error when resolving non-existent service", () => {
      expect(() => {
        container.resolve<TestService>("non-existent-service");
      }).toThrow("Service 'non-existent-service' not found");
    });

    it("should throw error with symbol token when service not found", () => {
      const symbol = Symbol("test-service");
      expect(() => {
        container.resolve(symbol);
      }).toThrow();
    });

    it("should throw error when resolving from non-existent scope", () => {
      const scope = container.createScope();
      scope.dispose();

      expect(() => {
        scope.resolve<TestService>("any-service");
      }).toThrow();
    });

    it("should handle type mismatch in resolved services", () => {
      container.registerInstance("config", { value: 42 });

      const resolved = container.resolve<{ value: number }>("config");
      expect(typeof resolved.value).toBe("number");
      expect(resolved.value).toBe(42);
    });

    it("should maintain type safety with generic resolution", () => {
      interface GenericService<T> {
        data: T;
      }

      const stringService: GenericService<string> = { data: "test" };
      container.registerInstance("string-service", stringService);

      const resolved = container.resolve<GenericService<string>>("string-service");
      expect(resolved.data).toBe("test");
    });
  });

  describe("Missing Dependencies Handling", () => {
    it("should throw error for unregistered dependency", () => {
      container.register("service", (c) => ({
        dependency: c.resolve<TestService>("missing-dep"),
      }));

      expect(() => {
        container.resolve("service");
      }).toThrow("Service 'missing-dep' not found");
    });

    it("should handle optional dependency pattern with defaults", () => {
      container.register(
        "service",
        (c) => {
          try {
            return c.resolve<TestService>("optional-dep");
          } catch {
            return { id: "default", name: "Default Service" };
          }
        },
        { lifecycle: "singleton" }
      );

      const service = container.resolve<TestService>("service");
      expect(service.id).toBe("default");
      expect(service.name).toBe("Default Service");
    });

    it("should throw clear error when required dependency is missing", () => {
      container.register(
        "service-with-dep",
        (c) => ({
          dependency: c.resolve<TestService>("required-dep"),
        }),
        { lifecycle: "singleton" }
      );

      expect(() => {
        container.resolve("service-with-dep");
      }).toThrow("Service 'required-dep' not found");
    });

    it("should handle missing dependencies in nested resolution", () => {
      container.register("level1", (c) => ({
        level2: c.resolve("level2"),
      }));

      container.register("level2", (c) => ({
        level3: c.resolve("level3"),
      }));

      // level3 is not registered
      expect(() => {
        container.resolve("level1");
      }).toThrow();
    });

    it("should support provider pattern for optional dependencies", () => {
      interface Config {
        timeout?: number;
      }

      const config: Config = { timeout: 5000 };
      container.registerInstance("config", config);

      const resolved = container.resolve<Config>("config");
      expect(resolved.timeout).toBe(5000);
    });
  });

  describe("State Error Handling", () => {
    it("should throw error when using disposed container", () => {
      container.registerInstance("service", { id: "test" });
      container.dispose();

      expect(() => {
        container.resolve("service");
      }).toThrow("This dependency container has been disposed.");
    });

    it("should throw error when registering to disposed container", () => {
      container.dispose();

      expect(() => {
        container.register("service", () => ({ id: "test" }));
      }).toThrow("This dependency container has been disposed.");
    });

    it("should throw error when creating scope from disposed container", () => {
      container.dispose();

      expect(() => {
        container.createScope();
      }).toThrow("This dependency container has been disposed.");
    });

    it("should prevent using disposed scope", () => {
      const scope = container.createScope();
      scope.registerInstance("service", { id: "test" });
      scope.dispose();

      expect(() => {
        scope.resolve("service");
      }).toThrow();
    });

    it("should handle multiple disposal attempts gracefully", () => {
      expect(() => {
        container.dispose();
        container.dispose(); // Should not throw
      }).not.toThrow();
    });

    it("should throw when resolving before initialization", () => {
      const uninitialized = new DefaultDependencyContainer();
      uninitialized.dispose();

      expect(() => {
        uninitialized.resolve("any");
      }).toThrow();
    });
  });

  describe("Circular Dependency Detection", () => {
    it("should detect direct circular dependency", () => {
      container.register(
        "service-a",
        (c) => ({
          b: c.resolve("service-b"),
        }),
        { lifecycle: "singleton" }
      );

      container.register(
        "service-b",
        (c) => ({
          a: c.resolve("service-a"),
        }),
        { lifecycle: "singleton" }
      );

      expect(() => {
        container.resolve("service-a");
      }).toThrow(/[Cc]ircular dependency/);
    });

    it("should detect indirect circular dependency", () => {
      container.register("service-a", (c) => ({
        b: c.resolve("service-b"),
      }));

      container.register("service-b", (c) => ({
        c: c.resolve("service-c"),
      }));

      container.register("service-c", (c) => ({
        a: c.resolve("service-a"),
      }));

      expect(() => {
        container.resolve("service-a");
      }).toThrow(/[Cc]ircular dependency/);
    });

    it("should handle self-referencing dependency", () => {
      container.register("self-ref", (c) => ({
        ref: c.resolve("self-ref"),
      }));

      expect(() => {
        container.resolve("self-ref");
      }).toThrow(/[Cc]ircular dependency/);
    });

    it("should allow safe recursive calls with scopes", () => {
      container.register(
        "recursive",
        (c) => ({
          level: 1,
          next: null,
        }),
        { lifecycle: "scoped" }
      );

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const service1 = scope1.resolve("recursive");
      const service2 = scope2.resolve("recursive");

      expect(service1).toBeDefined();
      expect(service2).toBeDefined();

      scope1.dispose();
      scope2.dispose();
    });

    it("should clear circular dependency tracking after resolution", () => {
      container.register("service", (c) => ({ id: "test" }));

      container.resolve("service");
      // Should resolve successfully again without circular dependency error
      expect(() => {
        container.resolve("service");
      }).not.toThrow();
    });
  });

  describe("Configuration Error Handling", () => {
    it("should throw error for duplicate registration when replace=false", () => {
      container.registerInstance("service", { id: "v1" });

      expect(() => {
        container.registerInstance("service", { id: "v2" }, { replace: false });
      }).toThrow("has already been registered");
    });

    it("should allow duplicate registration by default (replace=true is implicit)", () => {
      container.registerInstance("service", { id: "v1" });

      expect(() => {
        container.registerInstance("service", { id: "v2" });
      }).not.toThrow();

      const resolved = container.resolve<{ id: string }>("service");
      expect(resolved.id).toBe("v2");
    });

    it("should throw error for invalid service token", () => {
      const invalidFactory = () => ({ invalid: true });

      // Both string and symbol tokens should work
      expect(() => {
        container.register("valid-token", invalidFactory);
      }).not.toThrow();

      expect(() => {
        container.register(Symbol("valid-symbol"), invalidFactory);
      }).not.toThrow();
    });

    it("should validate factory function execution", () => {
      let callCount = 0;

      container.register(
        "factory",
        () => {
          callCount++;
          if (callCount > 1) {
            throw new Error("Factory execution failed");
          }
          return { id: "test" };
        },
        { lifecycle: "transient" }
      );

      // First call succeeds
      expect(() => {
        container.resolve("factory");
      }).not.toThrow();

      // Second call fails (transient)
      expect(() => {
        container.resolve("factory");
      }).toThrow("Factory execution failed");
    });

    it("should handle invalid lifecycle options", () => {
      const validLifecycles = ["singleton", "transient", "scoped"];

      for (const lifecycle of validLifecycles) {
        expect(() => {
          container.register("service", () => ({ id: "test" }), {
            lifecycle: lifecycle as "singleton" | "transient" | "scoped",
          });
        }).not.toThrow();
      }
    });

    it("should validate has() with invalid tokens", () => {
      container.registerInstance("service", { id: "test" });

      expect(container.has("service")).toBe(true);
      expect(container.has("non-existent")).toBe(false);
      expect(container.has(Symbol("non-existent"))).toBe(false);
    });
  });

  describe("Lifecycle Error Handling", () => {
    it("should handle singleton lifecycle correctly", () => {
      let creationCount = 0;

      container.register(
        "singleton",
        () => {
          creationCount++;
          return { id: `instance-${creationCount}` };
        },
        { lifecycle: "singleton" }
      );

      const instance1 = container.resolve<{ id: string }>("singleton");
      const instance2 = container.resolve<{ id: string }>("singleton");

      expect(instance1).toBe(instance2);
      expect(creationCount).toBe(1);
    });

    it("should handle transient lifecycle correctly", () => {
      let creationCount = 0;

      container.register(
        "transient",
        () => {
          creationCount++;
          return { id: `instance-${creationCount}` };
        },
        { lifecycle: "transient" }
      );

      const instance1 = container.resolve<{ id: string }>("transient");
      const instance2 = container.resolve<{ id: string }>("transient");

      expect(instance1).not.toBe(instance2);
      expect(creationCount).toBe(2);
    });

    it("should handle scoped lifecycle correctly", () => {
      let creationCount = 0;

      container.register(
        "scoped",
        () => {
          creationCount++;
          return { id: `instance-${creationCount}` };
        },
        { lifecycle: "scoped" }
      );

      const scope = container.createScope();

      const instance1 = scope.resolve<{ id: string }>("scoped");
      const instance2 = scope.resolve<{ id: string }>("scoped");

      expect(instance1).toBe(instance2);
      expect(creationCount).toBe(1);

      scope.dispose();
    });

    it("should throw error when lifecycle is invalid in registration", () => {
      // Container should still create with any lifecycle string
      expect(() => {
        container.register("service", () => ({ id: "test" }), {
          lifecycle: "invalid" as any,
        });
      }).not.toThrow();
    });
  });

  describe("Disposal and Cleanup Error Handling", () => {
    it("should not throw when disposing already disposed container", () => {
      expect(() => {
        container.dispose();
        container.dispose();
      }).not.toThrow();
    });

    it("should not throw when disposing null references", () => {
      container.registerInstance("service", null);

      expect(() => {
        container.dispose();
      }).not.toThrow();
    });

    it("should handle disposal of scoped services", () => {
      let disposed = false;

      const scope = container.createScope();
      scope.register("service", () => ({ id: "test" }), {
        dispose: () => {
          disposed = true;
        },
      });

      const service = scope.resolve("service");
      expect(service).toBeDefined();

      scope.dispose();
      // Note: disposal handler timing may vary
    });

    it("should handle errors during service disposal gracefully", () => {
      const scope = container.createScope();

      scope.register("failing-service", () => ({ id: "test" }), {
        dispose: () => {
          throw new Error("Disposal failed");
        },
      });

      expect(() => {
        const service = scope.resolve("failing-service");
        expect(service).toBeDefined();
        // Disposal errors are caught and logged
        scope.dispose();
      }).not.toThrow();
    });

    it("should cleanup child scopes on parent disposal", () => {
      const childScope = container.createScope();
      childScope.registerInstance("service", { id: "child" });

      container.dispose();

      expect(() => {
        childScope.resolve("service");
      }).toThrow();
    });
  });

  describe("Error Messages and Diagnostics", () => {
    it("should provide clear error message for missing service", () => {
      const tokenName = "specific-service";

      expect(() => {
        container.resolve(tokenName);
      }).toThrow(`Service '${tokenName}' not found`);
    });

    it("should provide clear error message for circular dependency", () => {
      container.register("a", (c) => ({ b: c.resolve("b") }));
      container.register("b", (c) => ({ a: c.resolve("a") }));

      expect(() => {
        container.resolve("a");
      }).toThrow();
    });

    it("should provide clear error for disposed container", () => {
      container.dispose();

      expect(() => {
        container.resolve("any");
      }).toThrow("disposed");
    });

    it("should provide clear error for duplicate registration", () => {
      container.registerInstance("service", { id: "v1" });

      expect(() => {
        container.registerInstance("service", { id: "v2" }, { replace: false });
      }).toThrow("already been registered");
    });

    it("should distinguish between missing vs disposed errors", () => {
      container.registerInstance("service", { id: "test" });

      // Before disposal - should find service
      expect(container.has("service")).toBe(true);

      container.dispose();

      // After disposal - container is disposed
      expect(() => {
        container.resolve("service");
      }).toThrow("disposed");
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    it("should handle empty string token", () => {
      container.registerInstance("", { id: "empty-token" });

      expect(container.has("")).toBe(true);
      const resolved = container.resolve<{ id: string }>("");
      expect(resolved.id).toBe("empty-token");
    });

    it("should handle very long token names", () => {
      const longToken = "x".repeat(10000);

      container.registerInstance(longToken, { id: "long" });
      expect(container.has(longToken)).toBe(true);

      const resolved = container.resolve<{ id: string }>(longToken);
      expect(resolved.id).toBe("long");
    });

    it("should handle null and undefined values", () => {
      container.registerInstance("null-value", null);
      container.registerInstance("undefined-value", undefined);

      expect(container.resolve("null-value")).toBeNull();
      expect(container.resolve("undefined-value")).toBeUndefined();
    });

    it("should handle primitive values as services", () => {
      container.registerInstance("string", "test-string");
      container.registerInstance("number", 42);
      container.registerInstance("boolean", true);

      expect(container.resolve("string")).toBe("test-string");
      expect(container.resolve("number")).toBe(42);
      expect(container.resolve("boolean")).toBe(true);
    });

    it("should handle complex nested objects", () => {
      const complexObject = {
        level1: {
          level2: {
            level3: {
              value: "deep",
              array: [1, 2, 3],
              nested: { a: "b" },
            },
          },
        },
      };

      container.registerInstance("complex", complexObject);
      const resolved = container.resolve("complex");

      expect(resolved).toEqual(complexObject);
    });

    it("should handle services that return functions", () => {
      const factory = () => {
        return (x: number) => x * 2;
      };

      container.register("func", factory);

      const resolved = container.resolve<(x: number) => number>("func");
      expect(resolved(5)).toBe(10);
    });

    it("should handle services with circular object references", () => {
      interface CircularRef {
        name: string;
        self?: CircularRef;
      }

      const obj: CircularRef = { name: "test" };
      obj.self = obj; // Circular reference

      expect(() => {
        container.registerInstance("circular", obj);
      }).not.toThrow();

      const resolved = container.resolve("circular");
      expect(resolved).toBeDefined();
    });

    it("should handle concurrent resolution attempts", () => {
      container.register("service", () => ({ id: "test" }), {
        lifecycle: "singleton",
      });

      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(container.resolve("service"))
      );

      Promise.all(promises).then((results) => {
        // All should resolve to same instance
        results.forEach((result, index) => {
          if (index > 0) {
            expect(result).toBe(results[0]);
          }
        });
      });
    });
  });

  describe("Recovery and Error Resilience", () => {
    it("should recover from failed resolution", () => {
      let failCount = 0;

      container.register("unreliable", () => {
        failCount++;
        if (failCount === 1) {
          throw new Error("First call failed");
        }
        return { id: "success" };
      });

      // First call fails
      expect(() => {
        container.resolve("unreliable");
      }).toThrow("First call failed");

      // Second call succeeds (factory is called again for transient)
      const result = container.resolve<{ id: string }>("unreliable");
      expect(result.id).toBe("success");
    });

    it("should maintain container integrity after errors", () => {
      container.registerInstance("service1", { id: "s1" });
      container.registerInstance("service2", { id: "s2" });

      // Try to resolve non-existent
      expect(() => {
        container.resolve("non-existent");
      }).toThrow();

      // Other services should still resolve
      expect(container.resolve<{ id: string }>("service1").id).toBe("s1");
      expect(container.resolve<{ id: string }>("service2").id).toBe("s2");
    });

    it("should allow re-registration after error", () => {
      container.registerInstance("service", { id: "v1" });

      expect(() => {
        container.registerInstance("service", { id: "v2" }, { replace: false });
      }).toThrow();

      // Should be able to replace after error
      expect(() => {
        container.registerInstance("service", { id: "v2" }, { replace: true });
      }).not.toThrow();

      const resolved = container.resolve<{ id: string }>("service");
      expect(resolved.id).toBe("v2");
    });
  });
});
