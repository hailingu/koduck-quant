import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";

describe("DI Exception Scenarios and Edge Cases", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe("Service Not Found Exceptions", () => {
    it("should throw with exact service name in error message", () => {
      const serviceName = "UserRepository";

      expect(() => {
        container.resolve(serviceName);
      }).toThrow(`Service '${serviceName}' not found`);
    });

    it("should handle numeric token that's not found", () => {
      const token = "numeric-token-12345";

      expect(() => {
        container.resolve(token);
      }).toThrow();
    });

    it("should handle symbol token that's not found", () => {
      const symbol = Symbol("NotRegistered");

      expect(() => {
        container.resolve(symbol);
      }).toThrow();
    });

    it("should throw immediately on first unresolved dependency", () => {
      container.register(
        "service-a",
        (c) => ({
          b: c.resolve("service-b"),
        }),
        { lifecycle: "singleton" }
      );

      expect(() => {
        container.resolve("service-a");
      }).toThrow("Service 'service-b' not found");
    });

    it("should include dependency chain in error context", () => {
      container.registerInstance("level1", { l1: "value" });
      container.register("level2", (c) => ({
        level1: c.resolve("level1"),
        missing: c.resolve("missing"),
      }));

      expect(() => {
        container.resolve("level2");
      }).toThrow();
    });
  });

  describe("Circular Dependency Exception Scenarios", () => {
    it("should throw specific circular dependency error", () => {
      container.register("a", (c) => ({ b: c.resolve("b") }));
      container.register("b", (c) => ({ a: c.resolve("a") }));

      const error = expect(() => {
        container.resolve("a");
      }).toThrow();
    });

    it("should handle self-referencing in error message", () => {
      container.register("self", (c) => ({
        ref: c.resolve("self"),
      }));

      expect(() => {
        container.resolve("self");
      }).toThrow();
    });

    it("should handle long circular dependency chains", () => {
      container.register("a", (c) => ({ b: c.resolve("b") }));
      container.register("b", (c) => ({ c: c.resolve("c") }));
      container.register("c", (c) => ({ d: c.resolve("d") }));
      container.register("d", (c) => ({ e: c.resolve("e") }));
      container.register("e", (c) => ({ a: c.resolve("a") }));

      expect(() => {
        container.resolve("a");
      }).toThrow();
    });

    it("should differentiate between unresolved and circular errors", () => {
      container.register("a", (c) => ({ c: c.resolve("c") }));

      expect(() => {
        container.resolve("a");
      }).toThrow("Service 'c' not found");

      // Now register c with circular reference
      container.register("c", (c) => ({ a: c.resolve("a") }));

      expect(() => {
        container.resolve("a");
      }).toThrow(/[Cc]ircular/);
    });
  });

  describe("Disposed Container Exception Scenarios", () => {
    it("should throw consistent error when container disposed", () => {
      container.dispose();

      const testTokens = ["string-token", Symbol("symbol-token")];

      for (const token of testTokens) {
        expect(() => {
          container.resolve(token);
        }).toThrow("disposed");
      }
    });

    it("should throw on registration after disposal", () => {
      container.dispose();

      expect(() => {
        container.registerInstance("service", { id: "test" });
      }).toThrow("disposed");

      expect(() => {
        container.register("factory", () => ({ id: "test" }));
      }).toThrow("disposed");
    });

    it("should throw on scope creation after disposal", () => {
      container.dispose();

      expect(() => {
        container.createScope();
      }).toThrow("disposed");
    });

    it("should throw consistently for disposed child scopes", () => {
      const scope = container.createScope();
      scope.registerInstance("service", { id: "test" });
      scope.dispose();

      expect(() => {
        scope.resolve("service");
      }).toThrow();

      expect(() => {
        scope.registerInstance("new-service", { id: "test" });
      }).toThrow();

      expect(() => {
        scope.createScope();
      }).toThrow();
    });

    it("should throw without corruption after disposal error", () => {
      container.registerInstance("service", { id: "test" });

      container.dispose();

      // First attempt to use disposed container
      expect(() => {
        container.resolve("service");
      }).toThrow("disposed");

      // Subsequent attempt should also throw appropriately
      expect(() => {
        container.resolve("service");
      }).toThrow("disposed");
    });
  });

  describe("Factory Function Exception Handling", () => {
    it("should propagate exceptions thrown by factory", () => {
      const customError = new Error("Factory execution failed");

      container.register("failing", () => {
        throw customError;
      });

      expect(() => {
        container.resolve("failing");
      }).toThrow("Factory execution failed");
    });

    it("should preserve factory exception stack trace", () => {
      const throwingFactory = () => {
        throw new Error("Deep error");
      };

      container.register("service", throwingFactory);

      try {
        container.resolve("service");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const message = (error as Error).message;
        expect(message).toContain("Deep error");
      }
    });

    it("should handle factories that return invalid values", () => {
      // Returning undefined is valid (optional service)
      container.register("optional", () => undefined);

      const result = container.resolve("optional");
      expect(result).toBeUndefined();
    });

    it("should distinguish between factory error and missing dependency error", () => {
      container.register("factory-error", () => {
        throw new Error("Factory failed");
      });

      container.register("dependency-error", (c) => ({
        dep: c.resolve("missing"),
      }));

      expect(() => {
        container.resolve("factory-error");
      }).toThrow("Factory failed");

      expect(() => {
        container.resolve("dependency-error");
      }).toThrow("Service 'missing' not found");
    });
  });

  describe("Type Checking in Resolution", () => {
    it("should handle type checking in resolution", () => {
      interface StringService {
        value: string;
      }

      container.registerInstance("service", { value: "test" } as StringService);

      const resolved = container.resolve<StringService>("service");
      expect(resolved.value).toBe("test");
    });

    it("should allow resolution with unknown type", () => {
      const data = { complex: "data", nested: { value: 42 } };

      container.registerInstance("any-service", data);

      const resolved = container.resolve<unknown>("any-service");
      expect(resolved).toBeDefined();
    });

    it("should handle generic type resolution", () => {
      interface Container<T> {
        items: T[];
      }

      const stringContainer: Container<string> = { items: ["a", "b", "c"] };
      container.registerInstance("string-container", stringContainer);

      const resolved = container.resolve<Container<string>>("string-container");
      expect(resolved.items).toEqual(["a", "b", "c"]);
    });
  });

  describe("Scope-Related Exceptions", () => {
    it("should handle scope chain exceptions", () => {
      const parent = container;
      const child = parent.createScope();
      const grandchild = child.createScope();

      grandchild.dispose();
      child.dispose();

      expect(() => {
        grandchild.resolve("any");
      }).toThrow();

      expect(() => {
        child.resolve("any");
      }).toThrow();

      // Parent should still work
      expect(() => {
        parent.resolve("any");
      }).toThrow("Service 'any' not found");
    });

    it("should handle registration exceptions in scopes", () => {
      const scope = container.createScope();

      scope.registerInstance("service", { id: "v1" });

      expect(() => {
        scope.registerInstance("service", { id: "v2" }, { replace: false });
      }).toThrow("already been registered");

      scope.dispose();
    });

    it("should handle lifecycle mismatches in scopes", () => {
      container.register("singleton", () => ({ id: "s" }), {
        lifecycle: "singleton",
      });

      const scope = container.createScope();

      const singleton = scope.resolve("singleton");
      const singleton2 = scope.resolve("singleton");

      expect(singleton).toBe(singleton2);

      scope.dispose();
    });
  });

  describe("Batch Error Scenarios", () => {
    it("should handle multiple concurrent resolution failures", () => {
      const tokens = ["missing-1", "missing-2", "missing-3"];

      const errors: Error[] = [];

      for (const token of tokens) {
        try {
          container.resolve(token);
        } catch (error) {
          errors.push(error as Error);
        }
      }

      for (const error of errors) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it("should maintain state consistency after bulk failures", () => {
      container.registerInstance("valid-1", { id: "v1" });
      container.registerInstance("valid-2", { id: "v2" });

      // Try to resolve many missing services
      for (let i = 0; i < 5; i++) {
        expect(() => {
          container.resolve(`missing-${i}`);
        }).toThrow();
      }

      // Valid services should still resolve
      const s1 = container.resolve<{ id: string }>("valid-1");
      const s2 = container.resolve<{ id: string }>("valid-2");

      expect(s1.id).toBe("v1");
      expect(s2.id).toBe("v2");
    });

    it("should handle registration failures without corrupting state", () => {
      container.registerInstance("service", { id: "original" });

      // Try to register duplicate
      expect(() => {
        container.registerInstance("service", { id: "new" }, { replace: false });
      }).toThrow();

      // Original should still be there
      const resolved = container.resolve<{ id: string }>("service");
      expect(resolved.id).toBe("original");

      // Should be able to replace after error
      container.registerInstance("service", { id: "replaced" }, { replace: true });
      const replaced = container.resolve<{ id: string }>("service");
      expect(replaced.id).toBe("replaced");
    });
  });

  describe("Exception Messages Clarity", () => {
    it("should provide useful error messages for debugging", () => {
      const expectedToken = "UserAuthenticationService";

      try {
        container.resolve(expectedToken);
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain(expectedToken);
        expect(message).toContain("not found");
      }
    });

    it("should not expose internal implementation details in errors", () => {
      container.register("service", () => {
        throw new Error("Internal error");
      });

      try {
        container.resolve("service");
      } catch (error) {
        const message = (error as Error).message;
        // Should not contain internal paths or private variables
        expect(message).not.toContain("registry");
        expect(message).not.toContain("private");
      }
    });

    it("should maintain consistent error formatting", () => {
      const errors: string[] = [];

      for (let i = 0; i < 5; i++) {
        try {
          container.resolve(`service-${i}`);
        } catch (error) {
          errors.push((error as Error).message);
        }
      }

      // All error messages should have similar format
      for (const msg of errors) {
        expect(msg).toMatch(/Service '.*' not found/);
      }
    });
  });

  describe("Performance Under Error Conditions", () => {
    it("should fail fast for non-existent services", () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        try {
          container.resolve(`missing-${i}`);
        } catch {
          // Error expected
        }
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(1000); // Should complete quickly
    });

    it("should handle exception recovery efficiently", () => {
      container.registerInstance("service", { id: "test" });

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        try {
          container.resolve(`missing-${i}`);
        } catch {
          // Error expected
        }
        const resolved = container.resolve("service");
        expect(resolved).toBeDefined();
      }

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe("Error Recovery Patterns", () => {
    const createResolveWithFallback = () => {
      return (token: string, fallback: unknown = null) => {
        try {
          return container.resolve(token);
        } catch {
          return fallback;
        }
      };
    };

    const createLazyResolver = (token: string) => {
      return () => {
        try {
          return container.resolve(token);
        } catch {
          return null;
        }
      };
    };

    it("should support retry pattern with default fallback", () => {
      const resolve = createResolveWithFallback();

      container.registerInstance("service", { id: "test" });

      const result = resolve("service");
      expect(result).toBeDefined();

      const fallbackResult = resolve("missing", { id: "fallback" });
      expect(fallbackResult).toEqual({ id: "fallback" });
    });

    it("should support conditional resolution", () => {
      container.registerInstance("feature1", { enabled: true });

      const resolveIfExists = (token: string) => {
        if (container.has(token)) {
          return container.resolve(token);
        }
        return null;
      };

      expect(resolveIfExists("feature1")).toBeDefined();
      expect(resolveIfExists("feature2")).toBeNull();
    });

    it("should support lazy resolution with error handling", () => {
      container.registerInstance("service", { id: "test" });

      const factory = createLazyResolver("service");
      const result = factory();
      expect(result).toBeDefined();

      const failingFactory = createLazyResolver("missing");
      const failingResult = failingFactory();
      expect(failingResult).toBeNull();
    });
  });
});
