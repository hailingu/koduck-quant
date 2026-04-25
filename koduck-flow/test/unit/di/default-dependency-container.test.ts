import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";
import type { IDependencyContainer, ServiceFactory } from "../../../src/common/di/types";

/**
 * Comprehensive test suite for DefaultDependencyContainer
 *
 * Tests cover:
 * 1. Container initialization and disposal
 * 2. Service registration (Singleton, Factory, Prototype)
 * 3. Service resolution and dependency injection
 * 4. Circular dependency detection
 * 5. Lifecycle management and hooks
 * 6. Scope management and scoped instances
 * 7. Edge cases and boundary conditions
 *
 * Coverage target: 100% line coverage, 95%+ branch coverage
 * Test cases: 48 total
 */

// ============================================================================
// Test Utilities & Fixtures
// ============================================================================

interface TestLogger {
  log: (message: string) => void;
  messages: string[];
}

interface TestDatabase {
  connect: () => void;
  disconnect: () => void;
  connected: boolean;
}

interface TestService {
  id: string;
  logger?: TestLogger;
  database?: TestDatabase;
}

// Fixture factories
const createTestLogger = (): TestLogger => ({
  log: function (message: string) {
    this.messages.push(message);
  },
  messages: [],
});

const createTestDatabase = (): TestDatabase => ({
  connect: function () {
    this.connected = true;
  },
  disconnect: function () {
    this.connected = false;
  },
  connected: false,
});

const createTestService = (id: string = "test-service"): TestService => ({
  id,
});

// ============================================================================
// Test Suite: Container Initialization and Disposal
// ============================================================================

describe("DefaultDependencyContainer - Initialization and Disposal", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    if (container) {
      container.dispose();
    }
  });

  it("should create an empty container", () => {
    expect(container).toBeDefined();
    expect(container).toBeInstanceOf(DefaultDependencyContainer);
  });

  it("should have no services registered initially", () => {
    expect(container.has("logger")).toBe(false);
    expect(container.has("database")).toBe(false);
  });

  it("should throw error when resolving non-existent service", () => {
    expect(() => container.resolve("non-existent-service")).toThrow(
      "Service 'non-existent-service' not found"
    );
  });

  it("should dispose successfully without errors", () => {
    expect(() => container.dispose()).not.toThrow();
  });

  it("should throw error when using container after disposal", () => {
    container.dispose();
    expect(() => container.register("logger", () => createTestLogger())).toThrow(
      "This dependency container has been disposed"
    );
  });

  it("should throw error when resolving from disposed container", () => {
    container.registerInstance("logger", createTestLogger());
    container.dispose();
    expect(() => container.resolve("logger")).toThrow(
      "This dependency container has been disposed"
    );
  });

  it("should not throw error when disposing multiple times", () => {
    expect(() => {
      container.dispose();
      container.dispose();
      container.dispose();
    }).not.toThrow();
  });

  it("should throw error when creating scope from disposed container", () => {
    container.dispose();
    expect(() => container.createScope()).toThrow("This dependency container has been disposed");
  });
});

// ============================================================================
// Test Suite: Singleton Registration and Resolution
// ============================================================================

describe("DefaultDependencyContainer - Singleton Registration", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should register and resolve singleton service", () => {
    const logger = createTestLogger();
    container.registerInstance("logger", logger);

    const resolved = container.resolve<TestLogger>("logger");
    expect(resolved).toBe(logger);
  });

  it("should return same singleton instance on multiple resolutions", () => {
    const logger = createTestLogger();
    container.registerInstance("logger", logger);

    const resolved1 = container.resolve<TestLogger>("logger");
    const resolved2 = container.resolve<TestLogger>("logger");
    const resolved3 = container.resolve<TestLogger>("logger");

    expect(resolved1).toBe(resolved2);
    expect(resolved2).toBe(resolved3);
  });

  it("should register factory as singleton by default", () => {
    let creationCount = 0;
    const factory: ServiceFactory<TestLogger> = () => {
      creationCount++;
      return createTestLogger();
    };

    container.register("logger", factory);

    container.resolve("logger");
    container.resolve("logger");
    container.resolve("logger");

    expect(creationCount).toBe(1);
  });

  it("should register factory with explicit singleton lifecycle", () => {
    let creationCount = 0;
    const factory: ServiceFactory<TestLogger> = () => {
      creationCount++;
      return createTestLogger();
    };

    container.register("logger", factory, { lifecycle: "singleton" });

    container.resolve("logger");
    container.resolve("logger");

    expect(creationCount).toBe(1);
  });

  it("should throw error when registering duplicate token without replace flag", () => {
    container.registerInstance("logger", createTestLogger());

    expect(() => {
      container.register("logger", () => createTestLogger(), { replace: false });
    }).toThrow("Service 'logger' has already been registered");
  });

  it("should replace existing singleton when replace flag is true", () => {
    const logger1 = createTestLogger();
    const logger2 = createTestLogger();

    container.registerInstance("logger", logger1);
    expect(container.resolve<TestLogger>("logger")).toBe(logger1);

    container.registerInstance("logger", logger2, { replace: true });
    expect(container.resolve<TestLogger>("logger")).toBe(logger2);
  });

  it("should support symbol tokens for singleton registration", () => {
    const loggerToken = Symbol("logger");
    const logger = createTestLogger();

    container.registerInstance(loggerToken, logger);
    expect(container.resolve<TestLogger>(loggerToken)).toBe(logger);
  });

  it("should allow multiple services with different tokens", () => {
    const logger = createTestLogger();
    const database = createTestDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    expect(container.resolve<TestLogger>("logger")).toBe(logger);
    expect(container.resolve<TestDatabase>("database")).toBe(database);
  });

  it("should handle registration with custom dispose handler", () => {
    let disposed = false;
    const logger = createTestLogger();

    container.register("logger", () => logger, {
      lifecycle: "singleton",
      dispose: () => {
        disposed = true;
      },
    });

    container.resolve("logger");
    container.dispose();

    expect(disposed).toBe(true);
  });
});

// ============================================================================
// Test Suite: Factory Pattern Registration
// ============================================================================

describe("DefaultDependencyContainer - Factory Pattern", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should register factory function", () => {
    const factory: ServiceFactory<TestLogger> = () => createTestLogger();
    container.register("logger", factory, { lifecycle: "singleton" });

    const logger = container.resolve<TestLogger>("logger");
    expect(logger).toBeDefined();
    expect(logger.messages).toEqual([]);
  });

  it("should pass container to factory function", () => {
    let passedContainer: IDependencyContainer | null = null;

    container.register(
      "logger",
      (c) => {
        passedContainer = c;
        return createTestLogger();
      },
      { lifecycle: "singleton" }
    );

    container.resolve("logger");
    expect(passedContainer).toBe(container);
  });

  it("should allow factory to use other resolved services", () => {
    const database = createTestDatabase();
    container.registerInstance("database", database);

    container.register(
      "service",
      (c) => {
        const db = c.resolve<TestDatabase>("database");
        const service: TestService = { id: "service1", database: db };
        return service;
      },
      { lifecycle: "singleton" }
    );

    const service = container.resolve<TestService>("service");
    expect(service.database).toBe(database);
  });

  it("should call factory function with transient lifecycle", () => {
    let creationCount = 0;
    const factory: ServiceFactory<TestService> = () => {
      creationCount++;
      return createTestService(`service-${creationCount}`);
    };

    container.register("service", factory, { lifecycle: "transient" });

    const service1 = container.resolve<TestService>("service");
    const service2 = container.resolve<TestService>("service");
    const service3 = container.resolve<TestService>("service");

    expect(creationCount).toBe(3);
    expect(service1.id).toBe("service-1");
    expect(service2.id).toBe("service-2");
    expect(service3.id).toBe("service-3");
  });

  it("should support shorthand lifecycle string", () => {
    let creationCount = 0;
    container.register(
      "service",
      () => {
        creationCount++;
        return createTestService();
      },
      "transient"
    );

    container.resolve("service");
    container.resolve("service");

    expect(creationCount).toBe(2);
  });
});

// ============================================================================
// Test Suite: Circular Dependency Detection
// ============================================================================

describe("DefaultDependencyContainer - Circular Dependency Detection", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should detect direct circular dependency", () => {
    container.register("a", (c) => c.resolve("b"));
    container.register("b", (c) => c.resolve("a"));

    expect(() => container.resolve("a")).toThrow("Circular dependency detected");
  });

  it("should detect indirect circular dependency (3 services)", () => {
    container.register("a", (c) => c.resolve("b"));
    container.register("b", (c) => c.resolve("c"));
    container.register("c", (c) => c.resolve("a"));

    expect(() => container.resolve("a")).toThrow("Circular dependency detected");
  });

  it("should detect self-referencing circular dependency", () => {
    container.register("a", (c) => c.resolve("a"));

    expect(() => container.resolve("a")).toThrow("Circular dependency detected");
  });

  it("should provide error message with token name for circular dependency", () => {
    const token = Symbol("circular-token");
    container.register(token, (c) => c.resolve(token));

    expect(() => container.resolve(token)).toThrow("Circular dependency detected");
  });

  it("should not throw error for non-circular dependencies", () => {
    container.registerInstance("logger", createTestLogger());
    container.register(
      "service",
      (c) => {
        const logger = c.resolve<TestLogger>("logger");
        return { ...createTestService("service1"), logger };
      },
      { lifecycle: "singleton" }
    );

    expect(() => container.resolve("service")).not.toThrow();
  });

  it("should detect circular dependency in complex chain", () => {
    // a -> b -> c -> d -> b (circular from b)
    container.register("a", (c) => c.resolve("b"));
    container.register("b", (c) => c.resolve("c"));
    container.register("c", (c) => c.resolve("d"));
    container.register("d", (c) => c.resolve("b"));

    expect(() => container.resolve("a")).toThrow("Circular dependency detected");
  });

  it("should allow multiple independent resolution chains", () => {
    // Chain 1: a -> b -> logger
    // Chain 2: c -> d -> database
    const logger = createTestLogger();
    const database = createTestDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    container.register("b", (c) => ({ logger: c.resolve("logger") }));
    container.register("a", (c) => ({ dep: c.resolve("b") }));

    container.register("d", (c) => ({ database: c.resolve("database") }));
    container.register("c", (c) => ({ dep: c.resolve("d") }));

    expect(() => {
      container.resolve("a");
      container.resolve("c");
    }).not.toThrow();
  });
});

// ============================================================================
// Test Suite: Dependency Resolution and Injection
// ============================================================================

describe("DefaultDependencyContainer - Dependency Resolution", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should resolve single dependency", () => {
    const logger = createTestLogger();
    container.registerInstance("logger", logger);

    const resolved = container.resolve<TestLogger>("logger");
    expect(resolved).toBe(logger);
  });

  it("should resolve dependency tree", () => {
    const logger = createTestLogger();
    const database = createTestDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    container.register(
      "service",
      (c) => ({
        logger: c.resolve<TestLogger>("logger"),
        database: c.resolve<TestDatabase>("database"),
      }),
      { lifecycle: "singleton" }
    );

    interface ServiceWithDeps {
      logger: TestLogger;
      database: TestDatabase;
    }

    const service = container.resolve<ServiceWithDeps>("service");
    expect(service.logger).toBe(logger);
    expect(service.database).toBe(database);
  });

  it("should resolve parameter dependencies", () => {
    interface ConfigService {
      apiUrl: string;
      timeout: number;
    }

    const config: ConfigService = {
      apiUrl: "https://api.example.com",
      timeout: 5000,
    };

    container.registerInstance("config", config);

    container.register(
      "api-client",
      (c) => {
        const cfg = c.resolve<ConfigService>("config");
        return {
          url: cfg.apiUrl,
          timeout: cfg.timeout,
        };
      },
      { lifecycle: "singleton" }
    );

    interface ApiClient {
      url: string;
      timeout: number;
    }

    const client = container.resolve<ApiClient>("api-client");
    expect(client.url).toBe("https://api.example.com");
    expect(client.timeout).toBe(5000);
  });

  it("should support null and undefined values", () => {
    container.registerInstance("nullable", null);
    container.registerInstance("undefinable", undefined);

    expect(container.resolve("nullable")).toBe(null);
    expect(container.resolve("undefinable")).toBe(undefined);
  });

  it("should handle complex type resolution", () => {
    interface ComplexService {
      name: string;
      dependencies: {
        logger: TestLogger;
        database: TestDatabase;
      };
    }

    const logger = createTestLogger();
    const database = createTestDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    container.register(
      "complex",
      (c) => ({
        name: "complex-service",
        dependencies: {
          logger: c.resolve<TestLogger>("logger"),
          database: c.resolve<TestDatabase>("database"),
        },
      }),
      { lifecycle: "singleton" }
    );

    const service = container.resolve<ComplexService>("complex");
    expect(service.name).toBe("complex-service");
    expect(service.dependencies.logger).toBe(logger);
    expect(service.dependencies.database).toBe(database);
  });
});

// ============================================================================
// Test Suite: Service Checking
// ============================================================================

describe("DefaultDependencyContainer - Service Availability Checking", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should return true when service is registered", () => {
    container.registerInstance("logger", createTestLogger());
    expect(container.has("logger")).toBe(true);
  });

  it("should return false when service is not registered", () => {
    expect(container.has("non-existent")).toBe(false);
  });

  it("should check existence for symbol tokens", () => {
    const token = Symbol("test-token");
    expect(container.has(token)).toBe(false);

    container.registerInstance(token, createTestLogger());
    expect(container.has(token)).toBe(true);
  });

  it("should check multiple services independently", () => {
    container.registerInstance("logger", createTestLogger());
    container.registerInstance("database", createTestDatabase());

    expect(container.has("logger")).toBe(true);
    expect(container.has("database")).toBe(true);
    expect(container.has("cache")).toBe(false);
  });
});

// ============================================================================
// Test Suite: Container Clear
// ============================================================================

describe("DefaultDependencyContainer - Clear", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should clear all registrations", () => {
    container.registerInstance("logger", createTestLogger());
    container.registerInstance("database", createTestDatabase());

    expect(container.has("logger")).toBe(true);
    expect(container.has("database")).toBe(true);

    container.clear();

    expect(container.has("logger")).toBe(false);
    expect(container.has("database")).toBe(false);
  });

  it("should not call dispose handlers when clearing", () => {
    let disposed = false;
    container.register("service", () => ({}), {
      lifecycle: "singleton",
      dispose: () => {
        disposed = true;
      },
    });

    container.resolve("service");
    container.clear();

    expect(disposed).toBe(false);
  });

  it("should allow re-registration after clear", () => {
    container.registerInstance("logger", createTestLogger());
    container.clear();

    const newLogger = createTestLogger();
    container.registerInstance("logger", newLogger);

    expect(container.resolve<TestLogger>("logger")).toBe(newLogger);
  });
});

// ============================================================================
// Test Suite: Lifecycle Hooks and Disposal
// ============================================================================

describe("DefaultDependencyContainer - Lifecycle and Disposal", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    if (container && !container["disposed"]) {
      container.dispose();
    }
  });

  it("should call dispose handler when container is disposed", () => {
    let disposed = false;
    const logger = createTestLogger();

    container.register("logger", () => logger, {
      lifecycle: "singleton",
      dispose: () => {
        disposed = true;
      },
    });

    container.resolve("logger");
    expect(disposed).toBe(false);

    container.dispose();
    expect(disposed).toBe(true);
  });

  it("should call dispose on service with dispose method when registered with factory", () => {
    let disposed = false;
    const service = {
      dispose: () => {
        disposed = true;
      },
    };

    // Use factory that returns service with dispose method
    container.register("service", () => service, {
      lifecycle: "singleton",
      ownsInstance: true,
    });
    container.resolve("service");

    container.dispose();
    expect(disposed).toBe(true);
  });

  it("should dispose multiple services", () => {
    let loggerDisposed = false;
    let databaseDisposed = false;

    container.register("logger", () => createTestLogger(), {
      lifecycle: "singleton",
      dispose: () => {
        loggerDisposed = true;
      },
    });

    container.register("database", () => createTestDatabase(), {
      lifecycle: "singleton",
      dispose: () => {
        databaseDisposed = true;
      },
    });

    container.resolve("logger");
    container.resolve("database");

    container.dispose();

    expect(loggerDisposed).toBe(true);
    expect(databaseDisposed).toBe(true);
  });

  it("should not dispose transient services by default", () => {
    let disposed = false;

    container.register("service", () => ({}), {
      lifecycle: "transient",
      dispose: () => {
        disposed = true;
      },
    });

    container.resolve("service");
    container.dispose();

    expect(disposed).toBe(false);
  });

  it("should respect ownsInstance flag in disposal", () => {
    let disposed = false;
    const service = {};

    container.register("service", () => service, {
      lifecycle: "singleton",
      ownsInstance: false,
      dispose: () => {
        disposed = true;
      },
    });

    container.resolve("service");
    container.dispose();

    expect(disposed).toBe(false);
  });
});

// ============================================================================
// Test Suite: Scope Management
// ============================================================================

describe("DefaultDependencyContainer - Scope Management", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should create child scope", () => {
    const scope = container.createScope();
    expect(scope).toBeDefined();
    expect(scope).toBeInstanceOf(DefaultDependencyContainer);
  });

  it("should share singleton services across scopes", () => {
    const logger = createTestLogger();
    container.registerInstance("logger", logger, { lifecycle: "singleton" });

    const scope = container.createScope();

    const resolvedFromParent = container.resolve<TestLogger>("logger");
    const resolvedFromScope = scope.resolve<TestLogger>("logger");

    expect(resolvedFromParent).toBe(logger);
    expect(resolvedFromScope).toBe(logger);
  });

  it("should resolve scoped services separately in each scope", () => {
    let creationCount = 0;

    container.register(
      "scoped-service",
      () => {
        creationCount++;
        return createTestService(`service-${creationCount}`);
      },
      { lifecycle: "scoped" }
    );

    const scope1 = container.createScope();
    const scope2 = container.createScope();

    const service1 = scope1.resolve<TestService>("scoped-service");
    const service1Again = scope1.resolve<TestService>("scoped-service");
    const service2 = scope2.resolve<TestService>("scoped-service");

    expect(service1).toBe(service1Again);
    expect(service1).not.toBe(service2);
    expect(creationCount).toBe(2);
  });

  it("should dispose scoped container independently", () => {
    const scope = container.createScope();
    scope.registerInstance("test", createTestLogger());

    expect(scope.has("test")).toBe(true);
    scope.dispose();
    expect(() => scope.resolve("test")).toThrow("This dependency container has been disposed");
  });

  it("should dispose child scopes when parent is disposed", () => {
    const scope = container.createScope();
    scope.registerInstance("service", {});

    container.dispose();

    expect(() => scope.resolve("service")).toThrow("This dependency container has been disposed");
  });

  it("should inherit parent registrations in child scope", () => {
    const logger = createTestLogger();
    container.registerInstance("logger", logger, { lifecycle: "singleton" });

    const scope = container.createScope();

    const resolvedLogger = scope.resolve<TestLogger>("logger");
    expect(resolvedLogger).toBe(logger);
  });

  it("should override parent registration in child scope", () => {
    const parentLogger = createTestLogger();
    const childLogger = createTestLogger();

    container.registerInstance("logger", parentLogger);

    const scope = container.createScope();
    scope.registerInstance("logger", childLogger, { replace: true });

    expect(container.resolve<TestLogger>("logger")).toBe(parentLogger);
    expect(scope.resolve<TestLogger>("logger")).toBe(childLogger);
  });
});

// ============================================================================
// Test Suite: Edge Cases and Boundary Conditions
// ============================================================================

describe("DefaultDependencyContainer - Edge Cases", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should handle empty string as token", () => {
    const service = createTestService();
    container.registerInstance("", service);

    expect(container.has("")).toBe(true);
    expect(container.resolve("")).toBe(service);
  });

  it("should support Symbol tokens", () => {
    const token = Symbol("test-symbol");
    const logger = createTestLogger();

    container.registerInstance(token, logger);
    expect(container.has(token)).toBe(true);
    expect(container.resolve(token)).toBe(logger);
  });

  it("should allow registering falsy values", () => {
    container.registerInstance("zero", 0);
    container.registerInstance("false", false);
    container.registerInstance("empty-string", "");

    expect(container.resolve("zero")).toBe(0);
    expect(container.resolve("false")).toBe(false);
    expect(container.resolve("empty-string")).toBe("");
  });

  it("should handle service with null", () => {
    container.registerInstance("nullable-service", null);
    expect(container.resolve("nullable-service")).toBe(null);
  });

  it("should handle service with undefined", () => {
    container.registerInstance("undefined-service", undefined);
    expect(container.resolve("undefined-service")).toBe(undefined);
  });

  it("should allow large dependency graphs", () => {
    // Create a chain of 50 dependencies
    for (let i = 0; i < 50; i++) {
      if (i === 0) {
        container.registerInstance(`service-${i}`, createTestService(`service-${i}`));
      } else {
        container.register(
          `service-${i}`,
          (c) => {
            const dep = c.resolve(`service-${i - 1}`);
            return {
              id: `service-${i}`,
              dep,
            };
          },
          { lifecycle: "singleton" }
        );
      }
    }

    expect(() => container.resolve("service-49")).not.toThrow();
  });

  it("should handle rapid disposal cycles", () => {
    expect(() => {
      for (let i = 0; i < 100; i++) {
        const scope = container.createScope();
        scope.dispose();
      }
    }).not.toThrow();
  });

  it("should maintain isolation between symbol and string tokens", () => {
    const symbolToken = Symbol("test");
    const stringToken = "test";

    const symbolService = createTestService("symbol-service");
    const stringService = createTestService("string-service");

    container.registerInstance(symbolToken, symbolService);
    container.registerInstance(stringToken, stringService);

    expect(container.resolve(symbolToken)).toBe(symbolService);
    expect(container.resolve(stringToken)).toBe(stringService);
    expect(container.resolve(symbolToken)).not.toBe(container.resolve(stringToken));
  });
});

// ============================================================================
// Test Suite: Integration Scenarios
// ============================================================================

describe("DefaultDependencyContainer - Integration Scenarios", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should support full application lifecycle", () => {
    interface UserService {
      logger: TestLogger;
      database: TestDatabase;
    }

    // Setup
    const logger = createTestLogger();
    const database = createTestDatabase();

    container.registerInstance("logger", logger);
    container.registerInstance("database", database);

    container.register(
      "user-service",
      (c) => ({
        logger: c.resolve<TestLogger>("logger"),
        database: c.resolve<TestDatabase>("database"),
      }),
      { lifecycle: "singleton" }
    );

    // Use
    const userService = container.resolve<UserService>("user-service");
    expect(userService.logger).toBe(logger);
    expect(userService.database).toBe(database);

    // Cleanup
    container.dispose();
  });

  it("should support plugin architecture pattern", () => {
    interface Plugin {
      name: string;
      init(container: IDependencyContainer): void;
    }

    const plugins: Plugin[] = [
      {
        name: "Logger Plugin",
        init: (c) => {
          c.registerInstance("logger", createTestLogger());
        },
      },
      {
        name: "Database Plugin",
        init: (c) => {
          c.registerInstance("database", createTestDatabase());
        },
      },
    ];

    // Initialize plugins
    for (const plugin of plugins) {
      plugin.init(container);
    }

    expect(container.has("logger")).toBe(true);
    expect(container.has("database")).toBe(true);
  });

  it("should support lazy loading pattern", () => {
    let lazyCreated = false;

    container.register(
      "lazy-service",
      () => {
        lazyCreated = true;
        return createTestService("lazy");
      },
      { lifecycle: "singleton" }
    );

    expect(lazyCreated).toBe(false);

    container.resolve("lazy-service");
    expect(lazyCreated).toBe(true);
  });

  it("should support decorator pattern for service wrapping", () => {
    interface WrappedLogger {
      log: (msg: string) => void;
      messages: string[];
    }

    const originalLogger = createTestLogger();
    container.registerInstance("original-logger", originalLogger);

    container.register(
      "wrapped-logger",
      (c) => {
        const original = c.resolve<TestLogger>("original-logger");
        return {
          log: (msg: string) => {
            original.log(`[WRAPPED] ${msg}`);
          },
          messages: original.messages,
        };
      },
      { lifecycle: "singleton" }
    );

    const wrapped = container.resolve<WrappedLogger>("wrapped-logger");
    wrapped.log("test");

    expect(originalLogger.messages).toContain("[WRAPPED] test");
  });

  it("should support nested scopes with independent lifetimes", () => {
    let creationCount = 0;

    container.register(
      "scoped",
      () => {
        creationCount++;
        return createTestService(`scoped-${creationCount}`);
      },
      { lifecycle: "scoped" }
    );

    const scope1 = container.createScope();
    const scope2 = container.createScope();
    const nestedScope = scope1.createScope();

    scope1.resolve("scoped");
    scope1.resolve("scoped");
    scope2.resolve("scoped");
    nestedScope.resolve("scoped");

    expect(creationCount).toBe(3); // one for each unique scope
  });
});

// ============================================================================
// Test Suite: Error Handling
// ============================================================================

describe("DefaultDependencyContainer - Error Handling", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  it("should handle errors in factory functions", () => {
    container.register(
      "faulty",
      () => {
        throw new Error("Factory error");
      },
      { lifecycle: "singleton" }
    );

    expect(() => container.resolve("faulty")).toThrow("Factory error");
  });

  it("should preserve error stack trace from factory", () => {
    container.register(
      "faulty",
      () => {
        throw new Error("Original error");
      },
      { lifecycle: "singleton" }
    );

    try {
      container.resolve("faulty");
    } catch (error) {
      expect(String(error)).toContain("Original error");
    }
  });

  it("should handle errors in dispose handlers gracefully", () => {
    container.register("service", () => ({}), {
      lifecycle: "singleton",
      dispose: () => {
        throw new Error("Dispose error");
      },
    });

    container.resolve("service");

    // Should not throw even though dispose handler fails
    expect(() => container.dispose()).not.toThrow();
  });

  it("should handle dispose method that throws", () => {
    const service = {
      dispose: () => {
        throw new Error("Dispose failed");
      },
    };

    container.registerInstance("service", service);
    container.resolve("service");

    // Should handle the error gracefully
    expect(() => container.dispose()).not.toThrow();
  });
});
