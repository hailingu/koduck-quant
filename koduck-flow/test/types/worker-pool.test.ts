/**
 * Worker Pool 类型定义单元测试
 *
 * 测试 WorkerPool 相关的类型定义和错误类
 */

import { describe, it, expect } from "vitest";
import { WorkerPoolError, type Task, type PoolStats } from "../../src/common/worker-pool/types";

describe("WorkerPool Types", () => {
  describe("WorkerPoolError", () => {
    it("should create error with message and code", () => {
      const error = new WorkerPoolError("Test error", "TEST_ERROR");

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_ERROR");
      expect(error.name).toBe("WorkerPoolError");
      expect(error.task).toBeUndefined();
    });

    it("should create error with task", () => {
      const task: Task<string> = {
        type: "test",
        payload: "test payload",
        timeout: 5000,
      };

      const error = new WorkerPoolError("Task failed", "TASK_FAILED", task);

      expect(error.message).toBe("Task failed");
      expect(error.code).toBe("TASK_FAILED");
      expect(error.task).toBe(task);
    });

    it("should inherit from Error", () => {
      const error = new WorkerPoolError("Test", "TEST");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(WorkerPoolError);
    });

    it("should have correct stack trace", () => {
      const error = new WorkerPoolError("Test", "TEST");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });

  describe("Task interface", () => {
    it("should allow generic type parameter", () => {
      // TypeScript will enforce this at compile time
      const stringTask: Task<string> = {
        type: "string_task",
        payload: "hello world",
      };

      const numberTask: Task<number> = {
        type: "number_task",
        payload: 42,
      };

      const objectTask: Task<{ id: string; value: number }> = {
        type: "object_task",
        payload: { id: "test", value: 123 },
      };

      expect(stringTask.payload).toBe("hello world");
      expect(numberTask.payload).toBe(42);
      expect(objectTask.payload).toEqual({ id: "test", value: 123 });
    });

    it("should allow optional timeout", () => {
      const taskWithoutTimeout: Task = {
        type: "no_timeout",
        payload: "test",
      };

      const taskWithTimeout: Task = {
        type: "with_timeout",
        payload: "test",
        timeout: 30000,
      };

      expect(taskWithoutTimeout.timeout).toBeUndefined();
      expect(taskWithTimeout.timeout).toBe(30000);
    });
  });

  describe("PoolStats interface", () => {
    it("should define all required properties", () => {
      const stats: PoolStats = {
        totalWorkers: 4,
        activeWorkers: 2,
        queueSize: 5,
        completedTasks: 100,
        failedTasks: 3,
      };

      expect(stats.totalWorkers).toBe(4);
      expect(stats.activeWorkers).toBe(2);
      expect(stats.queueSize).toBe(5);
      expect(stats.completedTasks).toBe(100);
      expect(stats.failedTasks).toBe(3);
    });
  });

  describe("Type safety", () => {
    it("should enforce Task payload type", () => {
      // This would cause TypeScript error if uncommented:
      // const invalidTask: Task<string> = {
      //   type: 'test',
      //   payload: 123 // Error: Type 'number' is not assignable to type 'string'
      // };

      const validTask: Task<string> = {
        type: "test",
        payload: "valid",
      };

      expect(validTask.payload).toBe("valid");
    });

    it("should allow unknown type for flexible tasks", () => {
      const flexibleTask: Task = {
        type: "flexible",
        payload: { any: "data", works: true },
      };

      expect(flexibleTask.payload).toEqual({ any: "data", works: true });
    });
  });

  describe("Error codes", () => {
    it("should support common error codes", () => {
      const errors = [
        new WorkerPoolError("Worker initialization failed", "WORKER_INIT_FAILED"),
        new WorkerPoolError("Task timeout", "TASK_TIMEOUT"),
        new WorkerPoolError("Worker pool full", "POOL_FULL"),
        new WorkerPoolError("Invalid task", "INVALID_TASK"),
        new WorkerPoolError("Worker terminated", "WORKER_TERMINATED"),
      ];

      errors.forEach((error) => {
        expect(error.code).toBeDefined();
        expect(typeof error.code).toBe("string");
        expect(error.code.length).toBeGreaterThan(0);
      });
    });
  });
});
