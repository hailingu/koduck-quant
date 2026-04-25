import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultDependencyContainer } from "../../../src/common/di/default-dependency-container";

interface TenantContext {
  id: string;
  name: string;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

interface TenantScoped {
  tenantId: string;
  createdAt: number;
}

// Helper functions
function createTenantContext(id: string, name: string): TenantContext {
  return {
    id,
    name,
    createdAt: Date.now(),
    metadata: { index: 0 },
  };
}

function createTenantScopedService(tenantId: string): TenantScoped {
  return {
    tenantId,
    createdAt: Date.now(),
  };
}

function createCacheService() {
  const cache = new Map<string, unknown>();
  return {
    set: (key: string, value: unknown) => cache.set(key, value),
    get: (key: string) => cache.get(key),
  };
}

describe("DI Tenant Context Management", () => {
  let container: DefaultDependencyContainer;

  beforeEach(() => {
    container = new DefaultDependencyContainer();
  });

  afterEach(() => {
    container.dispose();
  });

  describe("Tenant Context Creation and Binding", () => {
    it("should create and bind tenant context to scope", () => {
      const tenantId = "tenant-1";
      const context = createTenantContext(tenantId, "Tenant One");

      container.registerInstance("current-tenant", context);

      const scope = container.createScope();
      const resolvedContext = scope.resolve<TenantContext>("current-tenant");

      expect(resolvedContext).toBe(context);
      expect(resolvedContext.id).toBe(tenantId);
      expect(resolvedContext.name).toBe("Tenant One");

      scope.dispose();
    });

    it("should support multiple tenant contexts in container", () => {
      const tenant1 = createTenantContext("tenant-1", "Tenant One");
      const tenant2 = createTenantContext("tenant-2", "Tenant Two");
      const tenant3 = createTenantContext("tenant-3", "Tenant Three");

      container.registerInstance("tenant-1-context", tenant1);
      container.registerInstance("tenant-2-context", tenant2);
      container.registerInstance("tenant-3-context", tenant3);

      const scope1 = container.createScope();
      const scope2 = container.createScope();
      const scope3 = container.createScope();

      expect(scope1.resolve<TenantContext>("tenant-1-context").id).toBe("tenant-1");
      expect(scope2.resolve<TenantContext>("tenant-2-context").id).toBe("tenant-2");
      expect(scope3.resolve<TenantContext>("tenant-3-context").id).toBe("tenant-3");

      scope1.dispose();
      scope2.dispose();
      scope3.dispose();
    });

    it("should bind tenant-specific services to scopes", () => {
      const tenant1 = createTenantContext("tenant-1", "Tenant One");
      const tenant2 = createTenantContext("tenant-2", "Tenant Two");

      container.registerInstance("tenant-1-context", tenant1);
      container.registerInstance("tenant-2-context", tenant2);

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.registerInstance("service", createTenantScopedService("tenant-1"));
      scope2.registerInstance("service", createTenantScopedService("tenant-2"));

      const service1 = scope1.resolve<TenantScoped>("service");
      const service2 = scope2.resolve<TenantScoped>("service");

      expect(service1.tenantId).toBe("tenant-1");
      expect(service2.tenantId).toBe("tenant-2");

      scope1.dispose();
      scope2.dispose();
    });

    it("should maintain tenant context metadata", () => {
      const context = createTenantContext("tenant-1", "Tenant One");
      context.metadata = { region: "us-east-1", tier: "premium" };

      container.registerInstance("current-tenant", context);

      const scope = container.createScope();
      const resolved = scope.resolve<TenantContext>("current-tenant");

      expect(resolved.metadata?.region).toBe("us-east-1");
      expect(resolved.metadata?.tier).toBe("premium");

      scope.dispose();
    });
  });

  describe("Tenant Data Isolation", () => {
    it("should isolate tenant data across different scopes", () => {
      const tenant1 = createTenantContext("tenant-1", "Tenant One");
      const tenant2 = createTenantContext("tenant-2", "Tenant Two");

      container.registerInstance("tenant-1", tenant1);
      container.registerInstance("tenant-2", tenant2);

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const context1 = scope1.resolve<TenantContext>("tenant-1");
      const context2 = scope2.resolve<TenantContext>("tenant-2");

      expect(context1).toBe(tenant1);
      expect(context2).toBe(tenant2);
      expect(context1).not.toBe(context2);
      expect(context1.id).not.toBe(context2.id);

      scope1.dispose();
      scope2.dispose();
    });

    it("should isolate tenant database connections per scope", () => {
      interface TenantDatabase {
        tenantId: string;
        connectionId: string;
      }

      let connectionCounter = 0;

      container.register(
        "database",
        (): TenantDatabase => ({
          tenantId: `tenant-${++connectionCounter}`,
          connectionId: `conn-${connectionCounter}`,
        }),
        { lifecycle: "scoped" }
      );

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const db1 = scope1.resolve<TenantDatabase>("database");
      const db2 = scope2.resolve<TenantDatabase>("database");

      expect(db1.connectionId).toBe("conn-1");
      expect(db2.connectionId).toBe("conn-2");
      expect(db1.connectionId).not.toBe(db2.connectionId);

      scope1.dispose();
      scope2.dispose();
    });

    it("should maintain separate tenant registrations", () => {
      const context1 = createTenantContext("tenant-1", "Tenant One");
      const context2 = createTenantContext("tenant-2", "Tenant Two");

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.registerInstance("context", context1);
      scope2.registerInstance("context", context2);

      const resolved1 = scope1.resolve<TenantContext>("context");
      const resolved2 = scope2.resolve<TenantContext>("context");

      expect(resolved1.id).toBe("tenant-1");
      expect(resolved2.id).toBe("tenant-2");
      expect(resolved1).not.toBe(resolved2);

      scope1.dispose();
      scope2.dispose();
    });

    it("should prevent data contamination between tenant scopes", () => {
      interface Repository {
        getUserForTenant(id: string): Record<string, unknown> | undefined;
      }

      const userData = new Map<string, Record<string, unknown>>();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.register(
        "user-repo",
        (): Repository => ({
          getUserForTenant: (tenantId: string) => userData.get(tenantId),
        })
      );

      scope2.register(
        "user-repo",
        (): Repository => ({
          getUserForTenant: (tenantId: string) => userData.get(tenantId),
        })
      );

      userData.set("tenant-1", { username: "user1", email: "user1@tenant1.com" });

      const repo1 = scope1.resolve<Repository>("user-repo");
      const repo2 = scope2.resolve<Repository>("user-repo");

      const user1 = repo1.getUserForTenant("tenant-1");
      expect(user1).toBeDefined();
      expect(user1?.username).toBe("user1");

      const user2 = repo2.getUserForTenant("tenant-2");
      expect(user2).toBeUndefined();

      scope1.dispose();
      scope2.dispose();
    });

    it("should maintain cache isolation between tenants", () => {
      interface CacheService {
        set(key: string, value: unknown): void;
        get(key: string): unknown;
      }

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.register("cache", createCacheService, { lifecycle: "scoped" });
      scope2.register("cache", createCacheService, { lifecycle: "scoped" });

      const cache1 = scope1.resolve<CacheService>("cache");
      const cache2 = scope2.resolve<CacheService>("cache");

      cache1.set("user", { id: 1, name: "User1" });
      cache2.set("user", { id: 2, name: "User2" });

      const user1 = cache1.get("user") as Record<string, unknown>;
      const user2 = cache2.get("user") as Record<string, unknown>;

      expect(user1.id).toBe(1);
      expect(user2.id).toBe(2);

      scope1.dispose();
      scope2.dispose();
    });
  });

  describe("Tenant Context Switching", () => {
    it("should support switching between tenant contexts", () => {
      const tenant1 = createTenantContext("tenant-1", "Tenant One");
      const tenant2 = createTenantContext("tenant-2", "Tenant Two");

      let currentTenantContext: TenantContext | null = null;

      container.registerInstance("tenant-1", tenant1);
      container.registerInstance("tenant-2", tenant2);

      const scope1 = container.createScope();
      currentTenantContext = scope1.resolve<TenantContext>("tenant-1");
      expect(currentTenantContext.id).toBe("tenant-1");
      scope1.dispose();

      const scope2 = container.createScope();
      currentTenantContext = scope2.resolve<TenantContext>("tenant-2");
      expect(currentTenantContext.id).toBe("tenant-2");
      scope2.dispose();

      const scope3 = container.createScope();
      currentTenantContext = scope3.resolve<TenantContext>("tenant-1");
      expect(currentTenantContext.id).toBe("tenant-1");
      scope3.dispose();
    });

    it("should manage tenant context switching with service updates", () => {
      interface ContextualService {
        getTenantId(): string;
        execute(): string;
      }

      const tenant1 = createTenantContext("tenant-1", "T1");
      const tenant2 = createTenantContext("tenant-2", "T2");

      let scope1 = container.createScope();
      scope1.registerInstance("context", tenant1);
      scope1.register(
        "service",
        (c): ContextualService => {
          const ctx = c.resolve<TenantContext>("context");
          return {
            getTenantId: () => ctx.id,
            execute: () => `Executing for ${ctx.name}`,
          };
        },
        { lifecycle: "scoped" }
      );

      let service = scope1.resolve<ContextualService>("service");
      expect(service.getTenantId()).toBe("tenant-1");
      expect(service.execute()).toBe("Executing for T1");
      scope1.dispose();

      scope1 = container.createScope();
      scope1.registerInstance("context", tenant2);
      scope1.register(
        "service",
        (c): ContextualService => {
          const ctx = c.resolve<TenantContext>("context");
          return {
            getTenantId: () => ctx.id,
            execute: () => `Executing for ${ctx.name}`,
          };
        },
        { lifecycle: "scoped" }
      );

      service = scope1.resolve<ContextualService>("service");
      expect(service.getTenantId()).toBe("tenant-2");
      expect(service.execute()).toBe("Executing for T2");
      scope1.dispose();
    });

    it("should clear tenant context on scope disposal", () => {
      const tenant = createTenantContext("tenant-1", "Tenant One");
      let contextExists = false;

      const scope = container.createScope();
      scope.registerInstance("context", tenant);

      const resolved = scope.resolve<TenantContext>("context");
      contextExists = resolved.id === "tenant-1";
      expect(contextExists).toBe(true);

      scope.dispose();

      expect(() => {
        scope.resolve<TenantContext>("context");
      }).toThrow();
    });
  });

  describe("Concurrent Tenant Access", () => {
    it("should handle concurrent tenant scope creation", async () => {
      const tenants: TenantContext[] = [];
      for (let i = 1; i <= 5; i++) {
        tenants.push(createTenantContext(`tenant-${i}`, `Tenant ${i}`));
      }

      const processScope = (tenant: TenantContext): Promise<void> => {
        return new Promise<void>((resolve) => {
          const scope = container.createScope();
          scope.registerInstance("context", tenant);
          const resolved = scope.resolve<TenantContext>("context");
          expect(resolved.id).toBe(tenant.id);
          scope.dispose();
          resolve();
        });
      };

      const promises = tenants.map(processScope);
      await Promise.all(promises);
    });

    it("should maintain isolation during concurrent operations", async () => {
      interface TenantOperation {
        id: string;
        value: number;
        timestamp: number;
      }

      const operationResults: TenantOperation[] = [];

      const processTenantOperation = (i: number): Promise<void> => {
        return new Promise<void>((resolve) => {
          const tenantId = `tenant-${(i % 3) + 1}`;
          const scope = container.createScope();

          scope.register(
            "operation",
            (): TenantOperation => ({
              id: tenantId,
              value: i * 100,
              timestamp: Date.now(),
            }),
            { lifecycle: "scoped" }
          );

          const operation = scope.resolve<TenantOperation>("operation");
          operationResults.push(operation);

          scope.dispose();
          resolve();
        });
      };

      const promises = Array.from({ length: 10 }, (_, i) => processTenantOperation(i));
      await Promise.all(promises);

      expect(operationResults.length).toBe(10);

      const tenant1Ops = operationResults.filter((op) => op.id === "tenant-1");
      const tenant2Ops = operationResults.filter((op) => op.id === "tenant-2");
      const tenant3Ops = operationResults.filter((op) => op.id === "tenant-3");

      expect(tenant1Ops.length).toBeGreaterThan(0);
      expect(tenant2Ops.length).toBeGreaterThan(0);
      expect(tenant3Ops.length).toBeGreaterThan(0);
    });

    it("should prevent race conditions in tenant state access", async () => {
      interface TenantState {
        tenantId: string;
        counter: number;
        incrementAndGet(): number;
      }

      const states = new Map<string, number>();

      const createTenantState = (tenantId: string): TenantState => {
        if (!states.has(tenantId)) {
          states.set(tenantId, 0);
        }
        const stateValue = states.get(tenantId)!;
        return {
          tenantId,
          counter: stateValue,
          incrementAndGet: () => {
            const current = states.get(tenantId)!;
            const next = current + 1;
            states.set(tenantId, next);
            return next;
          },
        };
      };

      const processStateOperation = (i: number): Promise<number> => {
        return new Promise<number>((resolve) => {
          const tenantId = `tenant-${(i % 2) + 1}`;
          const state = createTenantState(tenantId);
          const value = state.incrementAndGet();
          resolve(value);
        });
      };

      const promises = Array.from({ length: 20 }, (_, i) => processStateOperation(i));
      const results = await Promise.all(promises);

      expect(results.length).toBe(20);
      expect(states.get("tenant-1")).toBe(10);
      expect(states.get("tenant-2")).toBe(10);
    });

    it("should handle concurrent scope creation and disposal", async () => {
      interface ScopeOperation {
        created: boolean;
        disposed: boolean;
      }

      const scopeOperations: ScopeOperation[] = [];

      const processScopeOperation = (i: number): Promise<void> => {
        return new Promise<void>((resolve) => {
          const operation: ScopeOperation = { created: false, disposed: false };
          scopeOperations.push(operation);

          const scope = container.createScope();
          operation.created = true;

          scope.registerInstance("id", `scope-${i}`);

          const resolved = scope.resolve<string>("id");
          expect(resolved).toBe(`scope-${i}`);

          scope.dispose();
          operation.disposed = true;

          resolve();
        });
      };

      const promises = Array.from({ length: 15 }, (_, i) => processScopeOperation(i));
      await Promise.all(promises);

      expect(scopeOperations.every((op) => op.created)).toBe(true);
      expect(scopeOperations.every((op) => op.disposed)).toBe(true);
    });
  });

  describe("Tenant Data Contamination Prevention", () => {
    it("should prevent cross-tenant data access through shared state", () => {
      interface UserData {
        tenantId: string;
        username: string;
        email: string;
      }

      interface Repository {
        getUserForTenant(tenantId: string): UserData | undefined;
      }

      const userData = new Map<string, UserData>();

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.register(
        "user-repo",
        (): Repository => ({
          getUserForTenant: (tenantId: string) => userData.get(tenantId),
        })
      );

      scope2.register(
        "user-repo",
        (): Repository => ({
          getUserForTenant: (tenantId: string) => userData.get(tenantId),
        })
      );

      userData.set("tenant-1", {
        tenantId: "tenant-1",
        username: "user1",
        email: "user1@tenant1.com",
      });

      const repo1 = scope1.resolve<Repository>("user-repo");
      const repo2 = scope2.resolve<Repository>("user-repo");

      const user1 = repo1.getUserForTenant("tenant-1");
      expect(user1).toBeDefined();
      expect(user1?.username).toBe("user1");

      const user2 = repo2.getUserForTenant("tenant-2");
      expect(user2).toBeUndefined();

      scope1.dispose();
      scope2.dispose();
    });

    it("should ensure tenant isolation in database connections", () => {
      interface TenantConnection {
        tenantId: string;
        connectionId: string;
        query(sql: string): string;
      }

      let connectionCounter = 0;

      const createConnection = (tenantId: string): TenantConnection => {
        connectionCounter++;
        return {
          tenantId,
          connectionId: `conn-${connectionCounter}`,
          query: (sql: string) => `[${tenantId}] Executing: ${sql}`,
        };
      };

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      scope1.register("db-connection", () => createConnection("tenant-1"), { lifecycle: "scoped" });

      scope2.register("db-connection", () => createConnection("tenant-2"), { lifecycle: "scoped" });

      const conn1 = scope1.resolve<TenantConnection>("db-connection");
      const conn2 = scope2.resolve<TenantConnection>("db-connection");

      const result1 = conn1.query("SELECT * FROM users");
      const result2 = conn2.query("SELECT * FROM users");

      expect(result1).toContain("tenant-1");
      expect(result2).toContain("tenant-2");
      expect(conn1.connectionId).not.toBe(conn2.connectionId);

      scope1.dispose();
      scope2.dispose();
    });
  });

  describe("Performance Baselines", () => {
    it("should create multiple tenant scopes efficiently", () => {
      const startTime = Date.now();
      const scopes: Array<{ dispose(): void }> = [];

      for (let i = 0; i < 50; i++) {
        const scope = container.createScope();
        scope.registerInstance("tenant-id", `tenant-${i}`);
        scopes.push(scope);
      }

      const elapsed = Date.now() - startTime;

      expect(scopes.length).toBe(50);
      expect(elapsed).toBeLessThan(1000);

      scopes.forEach((scope) => scope.dispose());
    });

    it("should resolve services within tenant scopes efficiently", () => {
      interface TenantServiceResolved {
        execute(): string;
      }

      const scopes: Array<{ dispose(): void; resolve(key: string): unknown }> = [];

      for (let i = 0; i < 10; i++) {
        const scope = container.createScope();
        scope.registerInstance("context", createTenantContext(`tenant-${i}`, `T${i}`));
        scope.register(
          "service",
          (c): TenantServiceResolved => ({
            execute: () => c.resolve<TenantContext>("context").id,
          }),
          { lifecycle: "scoped" }
        );
        scopes.push(scope);
      }

      const startTime = Date.now();
      const results: string[] = [];

      scopes.forEach((scope) => {
        const service = scope.resolve("service") as TenantServiceResolved;
        results.push(service.execute());
      });

      const elapsed = Date.now() - startTime;

      expect(results.length).toBe(10);
      expect(elapsed).toBeLessThan(500);

      scopes.forEach((scope) => scope.dispose());
    });

    it("should handle rapid tenant context switching", () => {
      const tenants = Array.from({ length: 20 }, (_, i) =>
        createTenantContext(`tenant-${i}`, `Tenant ${i}`)
      );

      const startTime = Date.now();

      for (let iteration = 0; iteration < 100; iteration++) {
        const tenant = tenants[iteration % tenants.length];
        const scope = container.createScope();
        scope.registerInstance("context", tenant);

        const resolved = scope.resolve<TenantContext>("context");
        expect(resolved.id).toBe(tenant.id);

        scope.dispose();
      }

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
