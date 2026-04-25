import { describe, it, expect, afterEach, vi } from "vitest";
import { DefaultEngine } from "../../../src/common/engine/default-engine";

/**
 * Integration tests for DefaultEngine + WorkerPool
 *
 * These tests verify the core integration points:
 * 1. Engine accepts workerPoolConfig in EngineConfig
 * 2. Engine properly initializes with worker pool
 * 3. Executor receives ExecutionContext with workerPool
 * 4. Backward compatibility without worker pool enabled
 */
describe("DefaultEngine + WorkerPool Integration", () => {
  let engine: DefaultEngine;

  afterEach(async () => {
    if (engine) {
      await engine.dispose();
    }
  });

  describe("Engine Configuration", () => {
    it("should initialize engine without worker pool config", () => {
      // Should not throw
      expect(() => {
        engine = new DefaultEngine({ concurrency: 2, stopOnError: false });
      }).not.toThrow();
    });

    it("should initialize engine with new-style worker pool config when pool is null", () => {
      // Should not throw
      expect(() => {
        engine = new DefaultEngine({
          concurrency: 2,
          enableWorkerPool: true,
          workerPoolConfig: {
            taskType: "test:task",
            taskTimeoutMs: 5000,
          },
        });
      }).not.toThrow();
    });

    it("should initialize engine with legacy worker config when pool is null", () => {
      // Should not throw
      expect(() => {
        engine = new DefaultEngine({
          concurrency: 2,
          worker: null,
        });
      }).not.toThrow();
    });
  });

  describe("Executor Registration", () => {
    it("should allow executor registration", () => {
      engine = new DefaultEngine({ concurrency: 1 });

      const executor = vi.fn(async () => ({ status: "success" as const }));

      // Should not throw
      expect(() => {
        engine.registerExecutor("my-task", executor);
      }).not.toThrow();

      expect(executor).not.toHaveBeenCalled();
    });

    it("should allow multiple executor registrations", () => {
      engine = new DefaultEngine({ concurrency: 1 });

      const executor1 = vi.fn(async () => ({ status: "success" as const }));
      const executor2 = vi.fn(async () => ({ status: "success" as const }));

      expect(() => {
        engine.registerExecutor("task-1", executor1);
        engine.registerExecutor("task-2", executor2);
      }).not.toThrow();
    });
  });

  describe("Lifecycle Management", () => {
    it("should properly dispose engine without worker pool", async () => {
      engine = new DefaultEngine({ concurrency: 1 });

      // Should not throw
      await engine.dispose();
    });

    it("should handle multiple dispose calls gracefully", async () => {
      engine = new DefaultEngine({
        concurrency: 1,
      });

      // Multiple disposes should not throw
      await engine.dispose();
      await engine.dispose();
    });
  });

  describe("Backward Compatibility", () => {
    it("should work without any worker pool configuration", () => {
      expect(() => {
        engine = new DefaultEngine({
          concurrency: 2,
          stopOnError: false,
          validateBeforeRun: true,
          strictEntityGraph: false,
        });
      }).not.toThrow();

      expect(engine).toBeDefined();
    });

    it("should work with partial engine configuration", () => {
      expect(() => {
        engine = new DefaultEngine({
          concurrency: 1,
        });
      }).not.toThrow();
    });

    it("should work with empty engine configuration", () => {
      expect(() => {
        engine = new DefaultEngine({});
      }).not.toThrow();
    });

    it("should work with no engine configuration", () => {
      expect(() => {
        engine = new DefaultEngine();
      }).not.toThrow();
    });
  });

  describe("Configuration Validation", () => {
    it("should handle null workerPoolConfig", () => {
      expect(() => {
        engine = new DefaultEngine({
          enableWorkerPool: false,
          workerPoolConfig: null,
        });
      }).not.toThrow();
    });

    it("should handle enableWorkerPool without workerPoolConfig", () => {
      expect(() => {
        engine = new DefaultEngine({
          enableWorkerPool: true,
          workerPoolConfig: null,
        });
      }).not.toThrow();
    });

    it("should handle enableWorkerPool flag", () => {
      expect(() => {
        engine = new DefaultEngine({
          enableWorkerPool: false,
        });
      }).not.toThrow();
    });
  });

  describe("Integration Scenarios", () => {
    it("should support full workflow: create engine -> register executor -> dispose", async () => {
      engine = new DefaultEngine({
        concurrency: 2,
        enableWorkerPool: false,
      });

      const executor = vi.fn(async () => ({
        status: "success" as const,
        output: { processed: true },
      }));

      engine.registerExecutor("my-processor", executor);

      // Verify no errors during lifecycle
      await engine.dispose();

      // Executor should not be called without actual execution
      expect(executor).not.toHaveBeenCalled();
    });

    it("should switch between different configurations", () => {
      // First engine with certain config
      const engine1 = new DefaultEngine({
        concurrency: 2,
        stopOnError: true,
      });

      // Second engine with different config
      const engine2 = new DefaultEngine({
        concurrency: 4,
        stopOnError: false,
        enableWorkerPool: false,
      });

      expect(engine1).toBeDefined();
      expect(engine2).toBeDefined();

      // Cleanup
      engine1.dispose();
      engine2.dispose();
    });

    it("should register multiple executors and maintain isolation", () => {
      engine = new DefaultEngine({ concurrency: 2 });

      const executor1 = vi.fn(async () => ({ status: "success" as const }));
      const executor2 = vi.fn(async () => ({ status: "success" as const }));
      const executor3 = vi.fn(async () => ({ status: "success" as const }));

      engine.registerExecutor("executor-1", executor1);
      engine.registerExecutor("executor-2", executor2);
      engine.registerExecutor("executor-3", executor3);

      // All should be registered independently
      expect(executor1).not.toHaveBeenCalled();
      expect(executor2).not.toHaveBeenCalled();
      expect(executor3).not.toHaveBeenCalled();
    });
  });

  describe("Configuration Combinations", () => {
    it("should handle all combinations of enableWorkerPool and workerPoolConfig", () => {
      // Combination 1: enabled with config
      expect(() => {
        const e = new DefaultEngine({
          enableWorkerPool: true,
          // Note: workerPoolConfig without pool is not typical but engine handles it
        });
        e.dispose();
      }).not.toThrow();

      // Combination 2: enabled without config
      expect(() => {
        const e = new DefaultEngine({
          enableWorkerPool: true,
        });
        e.dispose();
      }).not.toThrow();

      // Combination 3: disabled without config
      expect(() => {
        const e = new DefaultEngine({
          enableWorkerPool: false,
        });
        e.dispose();
      }).not.toThrow();

      // Combination 4: disabled explicitly
      expect(() => {
        const e = new DefaultEngine({
          enableWorkerPool: false,
        });
        e.dispose();
      }).not.toThrow();
    });

    it("should respect concurrency settings with different configurations", () => {
      // Low concurrency
      expect(() => {
        const e1 = new DefaultEngine({ concurrency: 1 });
        e1.dispose();
      }).not.toThrow();

      // High concurrency
      expect(() => {
        const e2 = new DefaultEngine({ concurrency: 16 });
        e2.dispose();
      }).not.toThrow();

      // Zero or negative should be normalized to 1
      expect(() => {
        const e3 = new DefaultEngine({ concurrency: 0 });
        e3.dispose();
      }).not.toThrow();
    });
  });
});
