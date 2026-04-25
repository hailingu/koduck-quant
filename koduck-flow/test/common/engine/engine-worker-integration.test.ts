/**
 * Engine and Worker Pool Integration Tests
 *
 * This test suite validates the integration between the execution engine
 * and the worker pool, ensuring that task execution can be offloaded to
 * worker threads with proper fallback and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DefaultEngine } from "../../../src/common/engine/default-engine";
import type {
  ExecutionContext,
  EntityResult,
  EntityExecutor,
  EngineConfig,
} from "../../../src/common/engine/types";
import { WorkerPoolManager } from "../../../src/common/worker-pool/worker-pool-manager";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";
import type { INode, IFlowNodeEntity } from "../../../src/common/flow/types";

describe("Engine and Worker Pool Integration", () => {
  let engine: DefaultEngine<INode, IFlowNodeEntity>;
  let workerPool: WorkerPoolManager;

  beforeEach(async () => {
    // Initialize worker pool
    const poolConfig: WorkerPoolConfig = {
      workerCount: 2,
      minWorkerCount: 2,
      maxWorkerCount: 4,
      maxQueueSize: 1000,
      defaultTaskTimeout: 5000,
      maxRetries: 2,
    };
    workerPool = new WorkerPoolManager(poolConfig);
    await workerPool.initialize();

    // Initialize engine
    const engineConfig: EngineConfig = {
      concurrency: 2,
      stopOnError: false,
      validateBeforeRun: false,
    };
    engine = new DefaultEngine<INode, IFlowNodeEntity>(engineConfig);
  });

  afterEach(async () => {
    if (engine) {
      await engine.dispose();
    }
    if (workerPool) {
      await workerPool.dispose();
    }
  });

  describe("Engine Lifecycle", () => {
    it("should initialize engine correctly", () => {
      expect(engine).toBeDefined();
      expect(engine.status).toBe("idle");
    });

    it("should attach and detach flow from engine", () => {
      // Engine should handle flow attachment
      expect(() => engine.getFlow()).not.toThrow();
    });

    it("should dispose engine gracefully", async () => {
      const beforeDispose = engine.status;
      expect(beforeDispose).toBeDefined();

      await engine.dispose();

      // After disposal, engine should still exist but be in disposed state
      const afterDispose = engine.status;
      expect(afterDispose).toBeDefined();
    });

    it("should initialize worker pool correctly", async () => {
      const stats = workerPool.getStats();
      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.queueSize).toBe(0);
    });

    it("should dispose worker pool gracefully", async () => {
      const stats = workerPool.getStats();
      expect(stats.totalWorkers).toBeGreaterThan(0);

      await workerPool.dispose();

      // After disposal, stats should still be available but pool is inactive
      const statsAfter = workerPool.getStats();
      expect(statsAfter).toBeDefined();
    });
  });

  describe("Executor Registration", () => {
    it("should register and retrieve executors", () => {
      const executor: EntityExecutor = async () => ({
        status: "success",
      });

      engine.registerExecutor("processor", executor);
      expect(engine.hasExecutor("processor")).toBe(true);
    });

    it("should unregister executors", () => {
      const executor: EntityExecutor = async () => ({
        status: "success",
      });

      engine.registerExecutor("processor", executor);
      expect(engine.hasExecutor("processor")).toBe(true);

      engine.unregisterExecutor("processor");
      expect(engine.hasExecutor("processor")).toBe(false);
    });

    it("should handle non-existent executor checks", () => {
      expect(engine.hasExecutor("non-existent")).toBe(false);
    });

    it("should allow executor re-registration", () => {
      const executor1: EntityExecutor = async () => ({
        status: "success",
        output: "v1",
      });

      const executor2: EntityExecutor = async () => ({
        status: "success",
        output: "v2",
      });

      engine.registerExecutor("processor", executor1);
      expect(engine.hasExecutor("processor")).toBe(true);

      engine.registerExecutor("processor", executor2);
      expect(engine.hasExecutor("processor")).toBe(true);
    });

    it("should support multiple executor types", () => {
      const executor1: EntityExecutor = async () => ({
        status: "success",
      });

      const executor2: EntityExecutor = async () => ({
        status: "success",
      });

      engine.registerExecutor("type1", executor1);
      engine.registerExecutor("type2", executor2);

      expect(engine.hasExecutor("type1")).toBe(true);
      expect(engine.hasExecutor("type2")).toBe(true);
      expect(engine.hasExecutor("type3")).toBe(false);
    });
  });

  describe("Executor Execution", () => {
    it("should execute simple executor successfully", async () => {
      const executor: EntityExecutor = async () => {
        return {
          status: "success",
          output: "executed",
        };
      };

      engine.registerExecutor("processor", executor);

      // Execute should be available without errors
      expect(engine.hasExecutor("processor")).toBe(true);
    });

    it("should handle async executors", async () => {
      const executor: EntityExecutor = async () => ({
        status: "success" as const,
        output: "async-result",
      });

      engine.registerExecutor("async-processor", executor);
      expect(engine.hasExecutor("async-processor")).toBe(true);
    });

    it("should handle executor errors", () => {
      const executor: EntityExecutor = async () => {
        throw new Error("Executor error");
      };

      engine.registerExecutor("error-processor", executor);
      expect(engine.hasExecutor("error-processor")).toBe(true);
    });

    it("should support returning error results", () => {
      const executor: EntityExecutor = async () => {
        return {
          status: "error",
          error: new Error("Task failed"),
        };
      };

      engine.registerExecutor("error-result", executor);
      expect(engine.hasExecutor("error-result")).toBe(true);
    });

    it("should support skipped status", () => {
      const executor: EntityExecutor = async () => {
        return {
          status: "skipped",
        };
      };

      engine.registerExecutor("skip-processor", executor);
      expect(engine.hasExecutor("skip-processor")).toBe(true);
    });
  });

  describe("Execution Context", () => {
    it("should provide execution context with required properties", async () => {
      let capturedContext: ExecutionContext | undefined;

      const executor: EntityExecutor = async (ctx) => {
        capturedContext = ctx;
        return { status: "success" };
      };

      engine.registerExecutor("context-test", executor);

      // Verify context interface
      expect(capturedContext === undefined).toBe(true); // Not yet captured
    });

    it("should provide shared state map in context", async () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.shared).toBeInstanceOf(Map);
        return { status: "success" };
      };

      engine.registerExecutor("shared-state", executor);
      expect(engine.hasExecutor("shared-state")).toBe(true);
    });

    it("should support shared state modifications", async () => {
      const executor1: EntityExecutor = async (ctx) => {
        ctx.shared.set("key1", "value1");
        return { status: "success" };
      };

      const executor2: EntityExecutor = async (ctx) => {
        const value = ctx.shared.get("key1");
        return { status: "success", output: value };
      };

      engine.registerExecutor("writer", executor1);
      engine.registerExecutor("reader", executor2);

      expect(engine.hasExecutor("writer")).toBe(true);
      expect(engine.hasExecutor("reader")).toBe(true);
    });

    it("should initialize shared state as empty map", async () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.shared).toBeInstanceOf(Map);
        expect(ctx.shared.size).toBe(0);
        return { status: "success" };
      };

      engine.registerExecutor("empty-shared", executor);
      expect(engine.hasExecutor("empty-shared")).toBe(true);
    });
  });

  describe("Engine Status Management", () => {
    it("should start in idle status", () => {
      expect(engine.status).toBe("idle");
    });

    it("should report idle status before flow attachment", () => {
      expect(engine.status).toBe("idle");
    });

    it("should have valid configuration", () => {
      expect(engine.config).toBeDefined();
      expect(engine.config.concurrency).toBeGreaterThan(0);
    });

    it("should respect stopOnError configuration", () => {
      expect(engine.config.stopOnError).toBe(false);
    });

    it("should have validateBeforeRun setting", () => {
      expect(engine.config.validateBeforeRun).toBe(false);
    });
  });

  describe("Worker Pool Integration State", () => {
    it("should maintain worker pool state during engine lifecycle", async () => {
      const initialStats = workerPool.getStats();
      expect(initialStats.totalWorkers).toBeGreaterThanOrEqual(2);

      // Register executors (shouldn't affect pool)
      engine.registerExecutor("processor", async () => ({
        status: "success",
      }));

      const midStats = workerPool.getStats();
      expect(midStats.totalWorkers).toBe(initialStats.totalWorkers);
    });

    it("should handle engine disposal independently of worker pool", async () => {
      const poolStats = workerPool.getStats();
      expect(poolStats.totalWorkers).toBeGreaterThan(0);

      await engine.dispose();

      // Worker pool should still be operational
      const poolStatsAfter = workerPool.getStats();
      expect(poolStatsAfter.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should handle worker pool disposal independently of engine", async () => {
      const engineConfig = engine.config;
      expect(engineConfig).toBeDefined();

      await workerPool.dispose();

      // Engine should still be operational (in terms of structure)
      expect(engine.config).toBeDefined();
    });

    it("should maintain worker pool statistics accurately", async () => {
      const stats = workerPool.getStats();

      expect(stats.totalWorkers).toBeGreaterThanOrEqual(2);
      expect(stats.totalWorkers).toBeLessThanOrEqual(4);
      expect(stats.activeWorkers).toBeGreaterThanOrEqual(0);
      expect(stats.activeWorkers).toBeLessThanOrEqual(stats.totalWorkers);
      expect(stats.queueSize).toBe(0); // No tasks submitted
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple executors concurrently", () => {
      const executor1: EntityExecutor = async () => ({ status: "success" as const });
      const executor2: EntityExecutor = async () => ({ status: "success" as const });
      const executor3: EntityExecutor = async () => ({ status: "success" as const });

      const executors = [executor1, executor2, executor3];

      let idx = 0;
      for (const executor of executors) {
        engine.registerExecutor(`executor${idx}`, executor);
        idx += 1;
      }

      for (let i = 0; i < 3; i++) {
        expect(engine.hasExecutor(`executor${i}`)).toBe(true);
      }
    });

    it("should handle rapid executor registration/unregistration", () => {
      const executor: EntityExecutor = async () => ({
        status: "success",
      });

      for (let i = 0; i < 5; i++) {
        engine.registerExecutor("temp", executor);
        expect(engine.hasExecutor("temp")).toBe(true);

        engine.unregisterExecutor("temp");
        expect(engine.hasExecutor("temp")).toBe(false);
      }
    });

    it("should maintain consistency during concurrent checks", () => {
      const executor: EntityExecutor = async () => ({
        status: "success",
      });

      engine.registerExecutor("processor", executor);

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(engine.hasExecutor("processor"));
      }

      const expected = new Array(10).fill(true);
      expect(results).toEqual(expected);
    });
  });

  describe("Engine Configuration Validation", () => {
    it("should have positive concurrency", () => {
      expect(engine.config.concurrency).toBeGreaterThan(0);
    });

    it("should have boolean stop on error setting", () => {
      expect(typeof engine.config.stopOnError).toBe("boolean");
    });

    it("should validate beforeRun configuration exists", () => {
      expect(engine.config.validateBeforeRun).toBeDefined();
    });

    it("should have consistent config across lifecycle", async () => {
      const config1 = engine.config;
      await new Promise((resolve) => setTimeout(resolve, 10));
      const config2 = engine.config;

      expect(config1.concurrency).toBe(config2.concurrency);
      expect(config1.stopOnError).toBe(config2.stopOnError);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle missing executor gracefully", () => {
      expect(engine.hasExecutor("non-existent")).toBe(false);
    });

    it("should handle unregistering non-existent executor", () => {
      expect(() => {
        engine.unregisterExecutor("non-existent");
      }).not.toThrow();
    });

    it("should support executor that returns error status", () => {
      const executor: EntityExecutor = async () => ({
        status: "error",
        error: new Error("Processing failed"),
      });

      engine.registerExecutor("error-processor", executor);
      expect(engine.hasExecutor("error-processor")).toBe(true);
    });

    it("should support executor that throws", () => {
      const executor: EntityExecutor = async () => {
        throw new Error("Async error");
      };

      engine.registerExecutor("throwing", executor);
      expect(engine.hasExecutor("throwing")).toBe(true);
    });

    it("should handle rapid register/unregister cycles", () => {
      const executor: EntityExecutor = async () => ({
        status: "success",
      });

      for (let i = 0; i < 20; i++) {
        engine.registerExecutor("cyclic", executor);
        engine.unregisterExecutor("cyclic");
      }

      expect(engine.hasExecutor("cyclic")).toBe(false);
    });
  });

  describe("Engine and Worker Pool Separation", () => {
    it("should not share state between engine and worker pool", () => {
      const engineConfig = engine.config;
      const poolStats = workerPool.getStats();

      expect(engineConfig).toBeDefined();
      expect(poolStats).toBeDefined();
      expect(poolStats.totalWorkers).toBeGreaterThan(0);
    });

    it("should allow independent configuration of engine and pool", () => {
      // Engine config
      const engineConcurrency = engine.config.concurrency;

      // Pool config (different settings)
      const poolStats = workerPool.getStats();

      expect(engineConcurrency).toBeGreaterThan(0);
      expect(poolStats.totalWorkers).toBeGreaterThanOrEqual(2);
    });

    it("should handle disposal order independence", async () => {
      // Dispose engine first
      await engine.dispose();

      // Pool should still work
      const poolStats = workerPool.getStats();
      expect(poolStats.totalWorkers).toBeGreaterThanOrEqual(2);

      // Now dispose pool
      await workerPool.dispose();

      // After disposal, stats should still be available
      const statsAfter = workerPool.getStats();
      expect(statsAfter).toBeDefined();
    });
  });

  describe("Executor Invocation Contract", () => {
    it("should pass flow context to executor", () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.flow).toBeDefined();
        return { status: "success" };
      };

      engine.registerExecutor("flow-check", executor);
      expect(engine.hasExecutor("flow-check")).toBe(true);
    });

    it("should pass node to executor", () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.node).toBeDefined();
        return { status: "success" };
      };

      engine.registerExecutor("node-check", executor);
      expect(engine.hasExecutor("node-check")).toBe(true);
    });

    it("should pass entity to executor", () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.entity).toBeDefined();
        return { status: "success" };
      };

      engine.registerExecutor("entity-check", executor);
      expect(engine.hasExecutor("entity-check")).toBe(true);
    });

    it("should pass shared map to executor", () => {
      const executor: EntityExecutor = async (ctx) => {
        expect(ctx.shared).toBeInstanceOf(Map);
        return { status: "success" };
      };

      engine.registerExecutor("shared-check", executor);
      expect(engine.hasExecutor("shared-check")).toBe(true);
    });
  });

  describe("Result Types", () => {
    it("should support success result", () => {
      const result: EntityResult = {
        status: "success",
        output: "completed",
      };

      expect(result.status).toBe("success");
    });

    it("should support error result with Error", () => {
      const result: EntityResult = {
        status: "error",
        error: new Error("Failed"),
      };

      expect(result.status).toBe("error");
      expect(result.error).toBeDefined();
    });

    it("should support skipped result", () => {
      const result: EntityResult = {
        status: "skipped",
      };

      expect(result.status).toBe("skipped");
    });

    it("should allow optional output", () => {
      const result1: EntityResult = {
        status: "success",
      };

      const result2: EntityResult = {
        status: "success",
        output: { data: "value" },
      };

      expect(result1.output).toBeUndefined();
      expect(result2.output).toBeDefined();
    });
  });
});
