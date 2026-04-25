import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  WorkerPoolRuntime,
  WorkerPoolError,
  WORKER_POOL_WORKER_CRASH_CODE,
  type WorkerPoolEvent,
  type TaskFallbackExecutor,
  type TaskHandler,
} from "../../../src/common/worker-pool";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("WorkerPoolRuntime", () => {
  const pools: WorkerPoolRuntime[] = [];
  type FallbackPayload = { value: number; viaFallback?: boolean; attempts?: number };

  const createPool = (config: ConstructorParameters<typeof WorkerPoolRuntime>[0] = {}) => {
    const pool = new WorkerPoolRuntime(config);
    pools.push(pool);
    return pool;
  };

  beforeEach(() => {
    pools.length = 0;
  });

  afterEach(() => {
    for (const pool of pools) {
      pool.dispose();
    }
    pools.length = 0;
  });

  it("should execute tasks with concurrency limit and return results in order", async () => {
    const pool = createPool({ workerCount: 2, retryDelay: 0 });

    let currentConcurrency = 0;
    let peakConcurrency = 0;

    const doubleHandler: TaskHandler<{ id: number; wait: number }, number> = async (payload) => {
      currentConcurrency += 1;
      peakConcurrency = Math.max(peakConcurrency, currentConcurrency);
      await delay(payload.wait);
      currentConcurrency -= 1;
      return payload.id * 2;
    };

    pool.registerHandler("double", doubleHandler);

    const tasks = Array.from({ length: 6 }, (_, index) =>
      pool.execute({ type: "double", payload: { id: index, wait: 3 } })
    );

    const results = await Promise.all(tasks);

    expect(results).toEqual([0, 2, 4, 6, 8, 10]);
    expect(peakConcurrency).toBeLessThanOrEqual(2);

    const stats = pool.getStats();
    expect(stats.completedTasks).toBe(6);
    expect(stats.failedTasks).toBe(0);
    expect(stats.queueSize).toBe(0);
  });

  it("should retry failing tasks and succeed within default attempts", async () => {
    const pool = createPool({ workerCount: 1, retryDelay: 0 });

    let attempts = 0;
    const unstableHandler: TaskHandler<null, string> = () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error(`failure-${attempts}`);
      }
      return "ok";
    };

    pool.registerHandler("unstable", unstableHandler);

    const result = await pool.execute({ type: "unstable", payload: null });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
    expect(pool.getStats().completedTasks).toBe(1);
  });

  it("should trigger fallback executor after retry exhaustion", async () => {
    let fallbackCalls = 0;
    const fallbackExecutor: TaskFallbackExecutor = (task, failure) => {
      fallbackCalls += 1;
      const payload = task.payload as FallbackPayload;
      return {
        ...payload,
        viaFallback: true,
        attempts: failure.attempts,
      } as typeof task.payload;
    };
    const pool = createPool({
      workerCount: 1,
      maxRetries: 2,
      retryDelay: 0,
      fallbackExecutor,
    });

    const failingHandler: TaskHandler<unknown, never> = () => {
      throw new Error("boom");
    };

    pool.registerHandler("always_fail", failingHandler);

    const payload: FallbackPayload = { value: 42 };
    const result = await pool.execute({ type: "always_fail", payload, timeout: 5 });

    expect(result).toEqual({ value: 42, viaFallback: true, attempts: 2 });
    expect(fallbackCalls).toBe(1);
    expect(pool.getStats().failedTasks).toBe(1);
  });

  it("should recover workers after crash and continue processing", async () => {
    const pool = createPool({ workerCount: 1, retryDelay: 0, workerRecoveryDelay: 1 });
    const events: WorkerPoolEvent[] = [];
    pool.addEventListener((event) => {
      events.push(event);
    });

    let attempts = 0;
    pool.registerHandler("flaky-crash", () => {
      attempts += 1;
      if (attempts === 1) {
        throw new WorkerPoolError("crash", WORKER_POOL_WORKER_CRASH_CODE);
      }
      return "ok";
    });

    const result = await pool.execute({ type: "flaky-crash", payload: null });
    await delay(5);

    expect(result).toBe("ok");
    expect(events.some((event) => event.type === "WORKER_UNAVAILABLE")).toBe(true);
    expect(events.some((event) => event.type === "WORKER_RECOVERED")).toBe(true);
  });

  it("should fall back to main thread after repeated crashes", async () => {
    const pool = createPool({
      workerCount: 1,
      retryDelay: 0,
      maxRetries: 1,
      workerRecoveryDelay: 1,
      fallbackExecutor: ((task) => task.payload) as TaskFallbackExecutor,
    });

    const events: WorkerPoolEvent[] = [];
    pool.addEventListener((event) => {
      events.push(event);
    });

    pool.registerHandler("always-crash", () => {
      throw new WorkerPoolError("boom", WORKER_POOL_WORKER_CRASH_CODE);
    });

    const payload = { marker: "payload" } as const;
    const result = await pool.execute({ type: "always-crash", payload: payload });
    await delay(5);

    expect(result).toEqual(payload);
    expect(events.some((event) => event.type === "TASK_FALLBACK")).toBe(true);
  });

  it("should maintain task order in executeBatch", async () => {
    const pool = createPool();

    const identityHandler: TaskHandler<number, number> = (payload) => payload;
    pool.registerHandler("identity", identityHandler);

    const batch = await pool.executeBatch(
      [0, 1, 2, 3, 4].map((value) => ({ type: "identity", payload: value }))
    );

    expect(batch).toEqual([0, 1, 2, 3, 4]);
  });

  it("should handle large task volume", async () => {
    const pool = createPool({ workerCount: 4, retryDelay: 0 });
    const noopHandler: TaskHandler<number, number> = (payload) => payload;
    pool.registerHandler("noop", noopHandler);

    const taskCount = 10_000;
    const results = await Promise.all(
      Array.from({ length: taskCount }, (_, index) =>
        pool.execute({ type: "noop", payload: index })
      )
    );

    expect(results).toHaveLength(taskCount);
    expect(results.at(0)).toBe(0);
    expect(results.at(-1)).toBe(taskCount - 1);
    expect(pool.getStats().completedTasks).toBe(taskCount);
  });

  it("should reject when queue size limit exceeded", async () => {
    const pool = createPool({ workerCount: 1, maxQueueSize: 2 });

    const sleepHandler: TaskHandler<null, string> = async () => {
      await delay(10);
      return "done";
    };

    pool.registerHandler("sleep", sleepHandler);

    const first = pool.execute({ type: "sleep", payload: null });
    const second = pool.execute({ type: "sleep", payload: null });

    await expect(pool.execute({ type: "sleep", payload: null })).rejects.toThrow(/queue is full/);

    await Promise.allSettled([first, second]);
  });

  describe("handler management", () => {
    it("should register and unregister handlers", () => {
      const pool = createPool();

      const handler: TaskHandler<null, string> = () => "ok";
      pool.registerHandler("test", handler);

      expect(() => pool.unregisterHandler("test")).not.toThrow();

      // Should not throw when unregistering non-existent handler
      expect(() => pool.unregisterHandler("nonexistent")).not.toThrow();
    });
  });

  describe("event listeners", () => {
    it("should add and remove event listeners", () => {
      const pool = createPool();

      const listener = () => {};
      pool.addEventListener(listener);

      expect(() => pool.removeEventListener(listener)).not.toThrow();

      // Should not throw when removing non-existent listener
      const anotherListener = () => {};
      expect(() => pool.removeEventListener(anotherListener)).not.toThrow();
    });

    it("should emit events to listeners", () => {
      const pool = createPool();

      let eventReceived: unknown;
      const listener = (event: unknown) => {
        eventReceived = event;
      };

      pool.addEventListener(listener);

      // Trigger an event by executing a task
      pool.registerHandler("test", () => "ok");
      pool.execute({ type: "test", payload: null });

      // Event should be emitted (though timing might vary)
      expect(typeof eventReceived).toBe("object");
    });
  });

  describe("dispose", () => {
    it("should dispose and reject pending tasks", async () => {
      const pool = createPool({ workerCount: 1 });

      const slowHandler: TaskHandler<null, string> = async () => {
        await delay(100);
        return "done";
      };

      pool.registerHandler("slow", slowHandler);

      const promise = pool.execute({ type: "slow", payload: null });

      pool.dispose();

      await expect(promise).rejects.toThrow("Worker pool disposed");
    });

    it("should be idempotent", () => {
      const pool = createPool();
      pool.dispose();
      expect(() => pool.dispose()).not.toThrow();
    });
  });
});
