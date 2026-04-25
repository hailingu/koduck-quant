import { describe, it, expect, vi, beforeEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";
import type { IDependencyContainer } from "../../../src/common/di/types";

// Mock classes for testing
class TestService {
  constructor(public value: string = "test") {}
}

describe("Dependency Injection (DI) Module", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  describe("DefaultDependencyContainer", () => {
    describe("constructor", () => {
      it("should create a new container instance", () => {
        const newContainer = new DefaultDependencyContainer();
        expect(newContainer).toBeInstanceOf(DefaultDependencyContainer);
        expect(newContainer).toBeDefined();
      });

      it("should implement IDependencyContainer interface", () => {
        const newContainer: IDependencyContainer =
          new DefaultDependencyContainer();
        expect(typeof newContainer.register).toBe("function");
        expect(typeof newContainer.resolve).toBe("function");
        expect(typeof newContainer.has).toBe("function");
        expect(typeof newContainer.clear).toBe("function");
        expect(typeof newContainer.createScope).toBe("function");
      });
    });

    describe("register", () => {
      it("should register a service with default singleton lifecycle", () => {
        const factory = () => new TestService("singleton");

        expect(() => {
          container.register("test", factory);
        }).not.toThrow();

        expect(container.has("test")).toBe(true);
      });

      it("should register a service with singleton lifecycle", () => {
        const factory = () => new TestService("singleton");

        container.register("test", factory, "singleton");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(instance1).toBe(instance2); // Same instance
        expect(instance1.value).toBe("singleton");
      });

      it("should register a service with transient lifecycle", () => {
        const factory = () => new TestService("transient");

        container.register("test", factory, "transient");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(instance1).not.toBe(instance2); // Different instances
        expect(instance1.value).toBe("transient");
        expect(instance2.value).toBe("transient");
      });

      it("should register a service with scoped lifecycle", () => {
        const factory = () => new TestService("scoped");

        container.register("test", factory, "scoped");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(instance1).toBe(instance2); // Same instance within scope
        expect(instance1.value).toBe("scoped");
      });

      it("should allow service registration override", () => {
        const factory1 = () => new TestService("first");
        const factory2 = () => new TestService("second");

        container.register("test", factory1);
        container.register("test", factory2); // Should not throw

        const instance = container.resolve<TestService>("test");
        expect(instance.value).toBe("second");
      });

      it("should support symbol tokens", () => {
        const token = Symbol("test");
        const factory = () => new TestService("symbol");

        container.register(token, factory);

        expect(container.has(token)).toBe(true);
        const instance = container.resolve<TestService>(token);
        expect(instance.value).toBe("symbol");
      });

      it("should support string tokens", () => {
        const factory = () => new TestService("string");

        container.register("string-token", factory);

        expect(container.has("string-token")).toBe(true);
        const instance = container.resolve<TestService>("string-token");
        expect(instance.value).toBe("string");
      });
    });

    describe("resolve", () => {
      it("should resolve singleton service", () => {
        const factory = vi.fn(() => new TestService("singleton"));
        container.register("test", factory, "singleton");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(factory).toHaveBeenCalledTimes(1); // Factory called only once
        expect(instance1).toBe(instance2);
        expect(instance1.value).toBe("singleton");
      });

      it("should resolve transient service", () => {
        const factory = vi.fn(() => new TestService("transient"));
        container.register("test", factory, "transient");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(factory).toHaveBeenCalledTimes(2); // Factory called each time
        expect(instance1).not.toBe(instance2);
        expect(instance1.value).toBe("transient");
        expect(instance2.value).toBe("transient");
      });

      it("should resolve scoped service", () => {
        const factory = vi.fn(() => new TestService("scoped"));
        container.register("test", factory, "scoped");

        const instance1 = container.resolve<TestService>("test");
        const instance2 = container.resolve<TestService>("test");

        expect(factory).toHaveBeenCalledTimes(1); // Factory called only once per scope
        expect(instance1).toBe(instance2);
        expect(instance1.value).toBe("scoped");
      });

      it("should throw error when resolving unregistered service", () => {
        expect(() => {
          container.resolve("nonexistent");
        }).toThrow("Service 'nonexistent' not found");
      });

      it("should detect circular dependencies", () => {
        // Create services that depend on each other
        container.register("serviceA", () => {
          container.resolve("serviceB");
          return new TestService("A");
        });

        container.register("serviceB", () => {
          container.resolve("serviceA");
          return new TestService("B");
        });

        expect(() => {
          container.resolve("serviceA");
        }).toThrow("Circular dependency detected for token: serviceA");
      });

      it("should handle complex circular dependency chains", () => {
        container.register("A", () => {
          container.resolve("B");
          return "A";
        });

        container.register("B", () => {
          container.resolve("C");
          return "B";
        });

        container.register("C", () => {
          container.resolve("A"); // Back to A
          return "C";
        });

        expect(() => {
          container.resolve("A");
        }).toThrow("Circular dependency detected for token: A");
      });

      it("should resolve services with symbol tokens", () => {
        const token = Symbol("symbol-test");
        const factory = () => new TestService("symbol");

        container.register(token, factory);

        const instance = container.resolve<TestService>(token);
        expect(instance.value).toBe("symbol");
      });

      it("should maintain resolution stack correctly", () => {
        const callOrder: string[] = [];

        container.register("A", () => {
          callOrder.push("A");
          return "A";
        });

        container.register("B", () => {
          callOrder.push("B");
          container.resolve("A");
          callOrder.push("B-end");
          return "B";
        });

        container.register("C", () => {
          callOrder.push("C");
          container.resolve("B");
          container.resolve("A");
          callOrder.push("C-end");
          return "C";
        });

        const result = container.resolve("C");

        expect(result).toBe("C");
        expect(callOrder).toEqual(["C", "B", "A", "B-end", "C-end"]);
      });
    });

    describe("has", () => {
      it("should return true for registered service", () => {
        container.register("test", () => new TestService());

        expect(container.has("test")).toBe(true);
      });

      it("should return false for unregistered service", () => {
        expect(container.has("nonexistent")).toBe(false);
      });

      it("should work with symbol tokens", () => {
        const token = Symbol("symbol-test");
        container.register(token, () => new TestService());

        expect(container.has(token)).toBe(true);
        expect(container.has(Symbol("different"))).toBe(false);
      });

      it("should return false after clearing container", () => {
        container.register("test", () => new TestService());
        expect(container.has("test")).toBe(true);

        container.clear();
        expect(container.has("test")).toBe(false);
      });
    });

    describe("clear", () => {
      it("should clear all registered services", () => {
        container.register("service1", () => new TestService("1"));
        container.register("service2", () => new TestService("2"));

        expect(container.has("service1")).toBe(true);
        expect(container.has("service2")).toBe(true);

        container.clear();

        expect(container.has("service1")).toBe(false);
        expect(container.has("service2")).toBe(false);
      });

      it("should clear singleton instances", () => {
        const factory = vi.fn(() => new TestService("singleton"));
        container.register("test", factory, "singleton");

        container.resolve("test"); // Create instance
        expect(factory).toHaveBeenCalledTimes(1);

        container.clear();

        container.register("test", factory, "singleton");
        container.resolve("test"); // Should create new instance
        expect(factory).toHaveBeenCalledTimes(2);
      });

      it("should clear scoped instances", () => {
        container.register("scoped", () => new TestService("scoped"), "scoped");
        container.resolve("scoped"); // Create scoped instance

        container.clear();

        // Should be able to register again
        container.register(
          "scoped",
          () => new TestService("scoped2"),
          "scoped"
        );
        const instance = container.resolve<TestService>("scoped");
        expect(instance.value).toBe("scoped2");
      });

      it("should clear resolution stack", () => {
        container.register("test", () => new TestService());

        // Start a resolution
        container.resolve("test");

        // Clear should reset everything
        container.clear();

        expect(container.has("test")).toBe(false);
      });
    });

    describe("createScope", () => {
      it("should create a new scoped container", () => {
        const scoped = container.createScope();

        expect(scoped).toBeInstanceOf(DefaultDependencyContainer);
        expect(scoped).not.toBe(container);
      });

      it("should copy registered services to scoped container", () => {
        container.register(
          "test",
          () => new TestService("original"),
          "singleton"
        );

        const scoped = container.createScope();

        expect(scoped.has("test")).toBe(true);
        const instance = scoped.resolve<TestService>("test");
        expect(instance.value).toBe("original");
      });

      it("should maintain separate instances for scoped services", () => {
        container.register("scoped", () => new TestService("parent"), "scoped");

        const scoped1 = container.createScope();
        const scoped2 = container.createScope();

        const instance1 = scoped1.resolve<TestService>("scoped");
        const instance2 = scoped2.resolve<TestService>("scoped");

        // Different scopes should have different instances
        expect(instance1).not.toBe(instance2);
        expect(instance1.value).toBe("parent");
        expect(instance2.value).toBe("parent");
      });

      it("should share singleton instances between parent and scoped containers", () => {
        container.register(
          "singleton",
          () => new TestService("shared"),
          "singleton"
        );

        const parentInstance = container.resolve<TestService>("singleton");
        const scoped = container.createScope();
        const scopedInstance = scoped.resolve<TestService>("singleton");

        // Should be the same instance
        expect(parentInstance).toBe(scopedInstance);
        expect(scopedInstance.value).toBe("shared");
      });

      it("should allow scoped container to have its own registrations", () => {
        const scoped = container.createScope();

        scoped.register("scoped-only", () => new TestService("scoped-only"));

        expect(container.has("scoped-only")).toBe(false);
        expect(scoped.has("scoped-only")).toBe(true);

        const instance = scoped.resolve<TestService>("scoped-only");
        expect(instance.value).toBe("scoped-only");
      });

      it("should handle scoped services correctly in nested scopes", () => {
        container.register("scoped", () => new TestService("scoped"), "scoped");

        const scoped = container.createScope();
        const nestedScoped = scoped.createScope();

        const instance1 = scoped.resolve<TestService>("scoped");
        const instance2 = nestedScoped.resolve<TestService>("scoped");

        // Different scopes should have different instances
        expect(instance1).not.toBe(instance2);
        expect(instance1.value).toBe("scoped");
        expect(instance2.value).toBe("scoped");
      });

      it("should return scoped container that implements IDependencyContainer", () => {
        const scoped = container.createScope();

        expect(typeof scoped.register).toBe("function");
        expect(typeof scoped.resolve).toBe("function");
        expect(typeof scoped.has).toBe("function");
        expect(typeof scoped.clear).toBe("function");
        expect(typeof scoped.createScope).toBe("function");
      });
    });

    describe("Integration Tests", () => {
      it("should support complex dependency graphs", () => {
        // Register services
        container.register("logger", () => ({ log: vi.fn() }), "singleton");
        container.register("config", () => ({ port: 3000 }), "singleton");
        container.register("database", () => ({ connect: vi.fn() }), "scoped");

        // Register service that depends on others
        container.register("app", () => {
          const logger = container.resolve("logger");
          const config = container.resolve("config");
          const db = container.resolve("database");

          return { logger, config, db };
        });

        const app = container.resolve<{
          logger: unknown;
          config: { port: number };
          db: unknown;
        }>("app");

        expect(app.logger).toBeDefined();
        expect(app.config.port).toBe(3000);
        expect(app.db).toBeDefined();
      });

      it("should handle service replacement in scoped containers", () => {
        container.register("service", () => new TestService("original"));

        const scoped = container.createScope();

        // Override in scoped container
        scoped.register("service", () => new TestService("overridden"));

        const originalInstance = container.resolve<TestService>("service");
        const scopedInstance = scoped.resolve<TestService>("service");

        expect(originalInstance.value).toBe("original");
        expect(scopedInstance.value).toBe("overridden");
      });

      it("should maintain isolation between multiple scopes", () => {
        container.register("counter", () => ({ value: 0 }), "scoped");

        const scope1 = container.createScope();
        const scope2 = container.createScope();

        const counter1 = scope1.resolve<{ value: number }>("counter");
        const counter2 = scope2.resolve<{ value: number }>("counter");

        counter1.value = 10;
        counter2.value = 20;

        expect(counter1.value).toBe(10);
        expect(counter2.value).toBe(20);
        expect(counter1).not.toBe(counter2);
      });
    });

    describe("Type Safety", () => {
      it("should maintain type safety with generic constraints", () => {
        interface IService {
          name: string;
        }

        class ConcreteService implements IService {
          name = "concrete";
        }

        container.register<IService>("service", () => new ConcreteService());

        const instance = container.resolve<IService>("service");

        expect(instance.name).toBe("concrete");
        expect(typeof instance.name).toBe("string");
      });

      it("should support complex generic types", () => {
        type ServiceMap = {
          logger: { log: (msg: string) => void };
          config: { port: number; host: string };
        };

        container.register("logger", () => ({
          log: (msg: string) => console.log(msg),
        }));

        container.register("config", () => ({
          port: 8080,
          host: "localhost",
        }));

        const logger = container.resolve<ServiceMap["logger"]>("logger");
        const config = container.resolve<ServiceMap["config"]>("config");

        expect(typeof logger.log).toBe("function");
        expect(config.port).toBe(8080);
        expect(config.host).toBe("localhost");
      });
    });
  });

  describe("Module Exports", () => {
    it("should export DefaultDependencyContainer", () => {
      expect(DefaultDependencyContainer).toBeDefined();
      expect(typeof DefaultDependencyContainer).toBe("function");
    });
  });
});
