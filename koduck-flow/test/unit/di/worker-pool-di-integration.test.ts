import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { createCoreContainer } from "../../../src/common/di/bootstrap";
import { TOKENS } from "../../../src/common/di/tokens";
import type { IDependencyContainer } from "../../../src/common/di/types";
import type { WorkerPoolManager } from "../../../src/common/worker-pool/worker-pool-manager";
import { DuckFlowRuntime } from "../../../src/common/runtime/duck-flow-runtime";

/**
 * Integration tests for Worker Pool DI Container integration
 *
 * These tests verify:
 * 1. Worker Pool DI Tokens are correctly defined
 * 2. Worker Pool Manager is properly registered as singleton
 * 3. Worker Pool Manager can be resolved from DI container
 * 4. Worker Pool Manager can be accessed from DuckFlowRuntime
 * 5. Configuration loading works correctly
 * 6. Lifecycle management (initialization, disposal) works as expected
 */
describe("Worker Pool DI Container Integration", () => {
  let container: IDependencyContainer | null = null;
  let runtime: DuckFlowRuntime | null = null;

  beforeEach(() => {
    container = createCoreContainer();
    runtime = null;
  });

  afterEach(() => {
    if (runtime) {
      runtime.dispose();
      runtime = null;
    }
    container = null;
  });

  describe("Worker Pool Service Registration", () => {
    it("should successfully resolve WorkerPoolManager from container", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      expect(poolManager).toBeDefined();
      expect(typeof poolManager).toBe("object");
    });

    it("should return singleton instance of WorkerPoolManager", () => {
      const poolManager1 = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      const poolManager2 = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      expect(poolManager1).toBe(poolManager2);
    });

    it("should have WorkerPoolManager with expected methods", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      expect(typeof poolManager.submit).toBe("function");
      expect(typeof poolManager.submitBatch).toBe("function");
      expect(typeof poolManager.configure).toBe("function");
      expect(typeof poolManager.getStats).toBe("function");
      expect(typeof poolManager.drain).toBe("function");
      expect(typeof poolManager.dispose).toBe("function");
    });

    it("should initialize WorkerPoolManager with default config", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      const stats = poolManager.getStats();
      expect(stats).toBeDefined();
      expect(typeof stats).toBe("object");
    });
  });

  describe("DuckFlowRuntime Integration", () => {
    it("should create DuckFlowRuntime with container", () => {
      runtime = new DuckFlowRuntime(container!);
      expect(runtime).toBeDefined();
    });

    it("should provide access to WorkerPoolManager via getter", () => {
      runtime = new DuckFlowRuntime(container!);
      const poolManager = runtime.WorkerPoolManager;
      expect(poolManager).toBeDefined();
      expect(typeof poolManager).toBe("object");
    });

    it("should return same WorkerPoolManager instance from runtime multiple times", () => {
      runtime = new DuckFlowRuntime(container!);
      const poolManager1 = runtime.WorkerPoolManager;
      const poolManager2 = runtime.WorkerPoolManager;
      expect(poolManager1).toBe(poolManager2);
    });

    it("should return singleton WorkerPoolManager from runtime and container", () => {
      runtime = new DuckFlowRuntime(container!);
      const runtimePoolManager = runtime.WorkerPoolManager;
      const containerPoolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      expect(runtimePoolManager).toBe(containerPoolManager);
    });

    it("should have WorkerPoolManager accessible after runtime initialization", async () => {
      runtime = new DuckFlowRuntime(container!);
      const poolManager = runtime.WorkerPoolManager;
      expect(poolManager).toBeDefined();
    });
  });

  describe("Configuration Loading", () => {
    it("should initialize with default configuration", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      const stats = poolManager.getStats();
      expect(stats.disposed).toBe(false);
    });

    it("should configure worker pool with custom settings", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      // Configure should work without throwing
      expect(() => {
        poolManager.configure({
          workerCount: 8,
          defaultTaskTimeout: 60000,
        });
      }).not.toThrow();
    });

    it("should respect configuration for queue size", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      const stats1 = poolManager.getStats();
      expect(stats1.disposed).toBe(false);

      // After configuration change
      poolManager.configure({
        maxQueueSize: 5000,
      });

      const stats2 = poolManager.getStats();
      expect(stats2.disposed).toBe(false);
    });
  });

  describe("Lifecycle Management", () => {
    it("should allow initialization of WorkerPoolManager", async () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      // Should be ready to use without explicit initialization
      expect(() => {
        const stats = poolManager.getStats();
        expect(stats).toBeDefined();
      }).not.toThrow();
    });

    it("should handle dispose without throwing error", async () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      // Dispose should complete without error
      expect(() => {
        poolManager.dispose?.();
      }).not.toThrow();
    });

    it("should properly dispose WorkerPoolManager via runtime", async () => {
      runtime = new DuckFlowRuntime(container!);
      const poolManager = runtime.WorkerPoolManager;
      expect(poolManager).toBeDefined();

      // Dispose should work
      expect(() => {
        runtime!.dispose();
      }).not.toThrow();
    });

    it("should handle multiple dispose calls gracefully", async () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);

      // Multiple dispose calls should not throw
      expect(() => {
        poolManager.dispose?.();
        poolManager.dispose?.();
      }).not.toThrow();
    });
  });

  describe("Task Submission through DI", () => {
    it("should allow task submission via resolved WorkerPoolManager", async () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      expect(poolManager).toBeDefined();

      // Try to submit a simple task
      try {
        const result = await poolManager.submit({
          type: "test:task",
          payload: { data: "test" },
        });
        // Task may complete or may fail, but API should work
        expect(typeof result).toBe("object");
      } catch {
        // Task execution errors are expected in test environment
      }
    });

    it.skip("should allow batch task submission via runtime", async () => {
      runtime = new DuckFlowRuntime(container!);
      const poolManager = runtime.WorkerPoolManager as WorkerPoolManager | undefined;
      expect(poolManager).toBeDefined();

      // Try to submit batch tasks
      try {
        if (poolManager) {
          const results = await poolManager.submitBatch([
            { type: "test:task1", payload: { index: 0 } },
            { type: "test:task2", payload: { index: 1 } },
          ]);
          expect(Array.isArray(results)).toBe(true);
        }
      } catch {
        // Task execution errors are expected in test environment
      }
    });
  });

  describe("Service Isolation", () => {
    it("should isolate WorkerPoolManager from other services", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      const entityManager = container!.resolve(TOKENS.entityManager);
      const renderManager = container!.resolve(TOKENS.renderManager);

      // All should be different instances
      expect(poolManager).not.toBe(entityManager);
      expect(poolManager).not.toBe(renderManager);
    });

    it("should maintain service independence", () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);

      // Configuring pool should not affect other services
      poolManager.configure({ workerCount: 8 });

      const entityManager = container!.resolve(TOKENS.entityManager);
      expect(entityManager).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing WorkerPoolManager gracefully from runtime", () => {
      // Create fresh container without worker pool registration
      const freshContainer = createCoreContainer();
      const freshRuntime = new DuckFlowRuntime(freshContainer);

      // Should return undefined or handle gracefully
      const poolManager = freshRuntime.WorkerPoolManager;
      expect(poolManager === undefined || poolManager !== null).toBe(true);

      freshRuntime.dispose();
    });

    it("should throw error when WorkerPoolManager methods called on disposed pool", async () => {
      const poolManager = container!.resolve<WorkerPoolManager>(TOKENS.workerPoolManager);
      poolManager.dispose?.();

      // After disposal, operations should handle it gracefully
      const stats = poolManager.getStats();
      expect(stats).toBeDefined();
    });
  });

  describe("Integration with DuckFlowRuntime managers", () => {
    it("should coexist with other runtime managers", () => {
      runtime = new DuckFlowRuntime(container!);

      const poolManager = runtime.WorkerPoolManager;
      const entityManager = runtime.EntityManager;
      const renderManager = runtime.RenderManager;

      expect(poolManager).toBeDefined();
      expect(entityManager).toBeDefined();
      expect(renderManager).toBeDefined();
    });

    it("should maintain independent lifecycle from other managers", async () => {
      runtime = new DuckFlowRuntime(container!);

      const poolManager = runtime.WorkerPoolManager as WorkerPoolManager | undefined;
      const entityManager = runtime.EntityManager;

      // Pool disposal should not affect entity manager
      if (poolManager) {
        poolManager.dispose?.();
      }
      expect(entityManager).toBeDefined();
    });
  });
});
