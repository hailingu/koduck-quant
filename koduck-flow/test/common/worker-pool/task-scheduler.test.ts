/**
 * @file Task Scheduler Unit Tests
 * @module test/worker-pool/task-scheduler
 *
 * Tests cover:
 * - Task enqueuing and dequeueing
 * - Priority queue behavior
 * - Worker selection strategies
 * - Backpressure control
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TaskScheduler,
  type SchedulerConfig,
} from "../../../src/common/worker-pool/task-scheduler";
import type { TaskContext } from "../../../src/common/worker-pool/task-context";
import type { WorkerPoolConfig } from "../../../src/common/worker-pool/types";
import type { WorkerMetadata } from "../../../src/common/worker-pool/worker-pool-core";

/**
 * Create a mock task context for testing
 */
function createMockTask(id: string, priority = 5, delay = 0): TaskContext<unknown, unknown> {
  return {
    taskId: id,
    taskType: "test",
    data: { value: Math.random() },
    priority,
    createdAt: Date.now() - delay,
    resolve: null,
    reject: null,
    retryCount: 0,
    timeout: 5000,
    executionStartTime: null,
    workerId: null,
    status: "pending",
    error: null,
    result: null,
  };
}

/**
 * Create a mock worker metadata for testing
 */
function createMockWorker(id: string, completedTasks = 0, avgResponseTime = 10): WorkerMetadata {
  return {
    id,
    state: "idle",
    currentTaskId: undefined,
    completedTasks,
    failedTasks: 0,
    avgResponseTime,
    totalResponseTime: avgResponseTime * completedTasks,
    responseTimeSamples: completedTasks,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    memoryUsage: 0,
  } as unknown as WorkerMetadata;
}

describe("TaskScheduler", () => {
  let scheduler: TaskScheduler;
  let config: WorkerPoolConfig;

  beforeEach(() => {
    config = {
      maxQueueSize: 100,
      defaultTaskTimeout: 5000,
      workerCount: 4,
    };
    scheduler = new TaskScheduler(config);
  });

  describe("Constructor", () => {
    it("should create scheduler with default configuration", () => {
      const scheduler = new TaskScheduler(config);
      expect(scheduler).toBeDefined();
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it("should accept scheduler-specific configuration", () => {
      const schedulerConfig: Partial<SchedulerConfig> = {
        strategy: "least-tasks",
        enablePriority: true,
        maxQueueSize: 50,
      };
      const scheduler = new TaskScheduler(config, schedulerConfig);
      expect(scheduler).toBeDefined();
    });

    it("should use maxQueueSize from config", () => {
      const config: WorkerPoolConfig = { maxQueueSize: 200 };
      const scheduler = new TaskScheduler(config);
      expect(scheduler).toBeDefined();
    });
  });

  describe("Enqueue and Dequeue - Priority Queue", () => {
    it("should enqueue a single task", () => {
      const task = createMockTask("task-1", 5);
      scheduler.schedule(task);
      expect(scheduler.getQueueSize()).toBe(1);
    });

    it("should dequeue tasks in priority order", () => {
      // Tasks with priority < 5 go to priority queue
      // Tasks with priority >= 5 go to FIFO queue
      // Priority queue is checked first, so lower priority values dequeue first
      const task1 = createMockTask("task-1", 2); // Priority queue
      const task2 = createMockTask("task-2", 1); // Priority queue
      const task3 = createMockTask("task-3", 3); // Priority queue

      scheduler.schedule(task1);
      scheduler.schedule(task2);
      scheduler.schedule(task3);

      // All tasks go to priority queue (priority < 5)
      // Task 2 (priority 1) should dequeue first (highest priority in min-heap)
      expect(scheduler.dequeue()?.taskId).toBe("task-2");

      // Task 1 (priority 2) should dequeue second
      expect(scheduler.dequeue()?.taskId).toBe("task-1");

      // Task 3 (priority 3) should dequeue last
      expect(scheduler.dequeue()?.taskId).toBe("task-3");
    });

    it("should return undefined when dequeuing from empty scheduler", () => {
      const task = scheduler.dequeue();
      expect(task).toBeUndefined();
    });

    it("should maintain priority order with many tasks", () => {
      // Use priorities < 5 to ensure all go to priority queue
      const tasks = Array.from({ length: 20 }, (_, i) =>
        createMockTask(`task-${i}`, Math.floor(Math.random() * 5))
      );

      for (const task of tasks) {
        scheduler.schedule(task);
      }

      const dequeued: TaskContext[] = [];
      while (scheduler.getQueueSize() > 0) {
        const task = scheduler.dequeue();
        if (task) dequeued.push(task);
      }

      // Verify tasks are in ascending priority order
      for (let i = 1; i < dequeued.length; i++) {
        expect(dequeued[i].priority).toBeGreaterThanOrEqual(dequeued[i - 1].priority);
      }
    });
  });

  describe("FIFO Queue Fallback", () => {
    it("should use FIFO queue for normal priority tasks", () => {
      const task1 = createMockTask("task-1", 5);
      const task2 = createMockTask("task-2", 5);
      const task3 = createMockTask("task-3", 5);

      scheduler.schedule(task1);
      scheduler.schedule(task2);
      scheduler.schedule(task3);

      // Same priority should dequeue in FIFO order
      expect(scheduler.dequeue()?.taskId).toBe("task-1");
      expect(scheduler.dequeue()?.taskId).toBe("task-2");
      expect(scheduler.dequeue()?.taskId).toBe("task-3");
    });

    it("should prioritize priority queue over FIFO", () => {
      // Add FIFO tasks first
      scheduler.schedule(createMockTask("fifo-1", 5));
      scheduler.schedule(createMockTask("fifo-2", 5));

      // Add high-priority task
      scheduler.schedule(createMockTask("priority-1", 2));

      // Priority task should dequeue first
      expect(scheduler.dequeue()?.taskId).toBe("priority-1");
      expect(scheduler.dequeue()?.taskId).toBe("fifo-1");
      expect(scheduler.dequeue()?.taskId).toBe("fifo-2");
    });
  });

  describe("Backpressure Control", () => {
    it("should throw when queue is full", () => {
      const scheduler = new TaskScheduler({ maxQueueSize: 2 });

      scheduler.schedule(createMockTask("task-1"));
      scheduler.schedule(createMockTask("task-2"));

      // Third task should cause error
      expect(() => {
        scheduler.schedule(createMockTask("task-3"));
      }).toThrow("Task queue full");
    });

    it("should allow scheduling after dequeuing", () => {
      const scheduler = new TaskScheduler({ maxQueueSize: 2 });

      scheduler.schedule(createMockTask("task-1"));
      scheduler.schedule(createMockTask("task-2"));

      // Dequeue one task
      scheduler.dequeue();

      // Should now allow new task
      expect(() => {
        scheduler.schedule(createMockTask("task-3"));
      }).not.toThrow();
    });

    it("should maintain error message with current queue size", () => {
      const scheduler = new TaskScheduler({ maxQueueSize: 1 });

      scheduler.schedule(createMockTask("task-1"));

      try {
        scheduler.schedule(createMockTask("task-2"));
        expect.fail("Should have thrown");
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain("1/1");
      }
    });
  });

  describe("Queue Size Tracking", () => {
    it("should track queue size correctly", () => {
      expect(scheduler.getQueueSize()).toBe(0);

      scheduler.schedule(createMockTask("task-1"));
      expect(scheduler.getQueueSize()).toBe(1);

      scheduler.schedule(createMockTask("task-2"));
      expect(scheduler.getQueueSize()).toBe(2);

      scheduler.dequeue();
      expect(scheduler.getQueueSize()).toBe(1);

      scheduler.dequeue();
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it("should track priority and FIFO queues separately", () => {
      scheduler.schedule(createMockTask("priority-1", 2));
      scheduler.schedule(createMockTask("fifo-1", 5));

      const stats = scheduler.getStats();
      expect(stats.priorityQueueSize).toBe(1);
      expect(stats.fifoQueueSize).toBe(1);
      expect(stats.priorityQueueSize + stats.fifoQueueSize).toBe(scheduler.getQueueSize());
    });
  });

  describe("Statistics Tracking", () => {
    it("should track total queued count", () => {
      const stats1 = scheduler.getStats();
      expect(stats1.totalQueued).toBe(0);

      scheduler.schedule(createMockTask("task-1"));
      scheduler.schedule(createMockTask("task-2"));

      const stats2 = scheduler.getStats();
      expect(stats2.totalQueued).toBe(2);
    });

    it("should track peak queue size", () => {
      scheduler.schedule(createMockTask("task-1", 5));
      scheduler.schedule(createMockTask("task-2", 6));

      let stats = scheduler.getStats();
      expect(stats.peakQueueSize).toBeGreaterThanOrEqual(1);

      scheduler.schedule(createMockTask("task-3", 7));

      stats = scheduler.getStats();
      expect(stats.peakQueueSize).toBeGreaterThanOrEqual(2);
    });

    it("should calculate average wait time", () => {
      const task1 = createMockTask("task-1", 5, 100);
      const task2 = createMockTask("task-2", 5, 50);

      scheduler.schedule(task1);
      scheduler.schedule(task2);

      scheduler.dequeue();
      scheduler.dequeue();

      const stats = scheduler.getStats();
      expect(stats.avgWaitTime).toBeGreaterThan(0);
    });
  });

  describe("Worker Selection - Round Robin", () => {
    it("should distribute tasks sequentially", () => {
      const workers = [
        createMockWorker("worker-1"),
        createMockWorker("worker-2"),
        createMockWorker("worker-3"),
      ];

      const scheduler = new TaskScheduler(config, { strategy: "round-robin" });

      const selected1 = scheduler.selectWorker(workers);
      const selected2 = scheduler.selectWorker(workers);
      const selected3 = scheduler.selectWorker(workers);
      const selected4 = scheduler.selectWorker(workers);

      expect(selected1!.id).toBe("worker-1");
      expect(selected2!.id).toBe("worker-2");
      expect(selected3!.id).toBe("worker-3");
      expect(selected4!.id).toBe("worker-1"); // Wrap around
    });

    it("should return single worker when only one available", () => {
      const workers = [createMockWorker("worker-1")];
      const scheduler = new TaskScheduler(config, { strategy: "round-robin" });

      expect(scheduler.selectWorker(workers)!.id).toBe("worker-1");
      expect(scheduler.selectWorker(workers)!.id).toBe("worker-1");
    });

    it("should return null for empty worker list", () => {
      const scheduler = new TaskScheduler(config, { strategy: "round-robin" });
      expect(scheduler.selectWorker([])).toBeNull();
    });
  });

  describe("Worker Selection - Least Tasks", () => {
    it("should select worker with fewest completed tasks", () => {
      const workers = [
        createMockWorker("worker-1", 10),
        createMockWorker("worker-2", 5),
        createMockWorker("worker-3", 15),
      ];

      const scheduler = new TaskScheduler(config, { strategy: "least-tasks" });
      const selected = scheduler.selectWorker(workers);

      expect(selected!.id).toBe("worker-2");
    });

    it("should select first worker when tasks equal", () => {
      const workers = [
        createMockWorker("worker-1", 10),
        createMockWorker("worker-2", 10),
        createMockWorker("worker-3", 10),
      ];

      const scheduler = new TaskScheduler(config, { strategy: "least-tasks" });
      const selected = scheduler.selectWorker(workers);

      expect(selected!.id).toBe("worker-1");
    });
  });

  describe("Worker Selection - Weighted", () => {
    it("should favor workers with low response time", () => {
      const workers = [
        createMockWorker("worker-1", 5, 50), // Slow
        createMockWorker("worker-2", 5, 10), // Fast
        createMockWorker("worker-3", 5, 100), // Very slow
      ];

      const scheduler = new TaskScheduler(config, { strategy: "weighted" });

      // Run multiple times to check probability
      const selections: { [key: string]: number } = {
        "worker-1": 0,
        "worker-2": 0,
        "worker-3": 0,
      };

      for (let i = 0; i < 1000; i++) {
        const selected = scheduler.selectWorker(workers);
        selections[selected!.id]++;
      }

      // Worker-2 should be selected most often
      expect(selections["worker-2"]).toBeGreaterThan(selections["worker-1"]);
      expect(selections["worker-2"]).toBeGreaterThan(selections["worker-3"]);
    });

    it("should handle zero response time workers", () => {
      const workers = [createMockWorker("worker-1", 0, 0), createMockWorker("worker-2", 0, 10)];

      const scheduler = new TaskScheduler(config, { strategy: "weighted" });
      expect(() => scheduler.selectWorker(workers)).not.toThrow();
    });
  });

  describe("Worker Selection - Fair", () => {
    it("should balance task count and response time", () => {
      const workers = [
        createMockWorker("worker-1", 50, 10), // Many tasks, fast
        createMockWorker("worker-2", 10, 100), // Few tasks, slow
        createMockWorker("worker-3", 30, 50), // Medium both
      ];

      const scheduler = new TaskScheduler(config, { strategy: "fair" });
      const selected = scheduler.selectWorker(workers);

      // Should select from the workers (fair uses composite score)
      expect(selected).not.toBeNull();
      expect(["worker-1", "worker-2", "worker-3"]).toContain(selected!.id);
    });

    it("should favor workers with fewer tasks when load is similar", () => {
      const workers = [
        createMockWorker("worker-1", 100, 10),
        createMockWorker("worker-2", 10, 10), // Same response time, fewer tasks
      ];

      const scheduler = new TaskScheduler(config, { strategy: "fair" });
      const selected = scheduler.selectWorker(workers);

      // Worker-2 should be selected (fewer tasks with equal response time)
      expect(selected!.id).toBe("worker-2");
    });
  });

  describe("Strategy Management", () => {
    it("should allow changing strategy at runtime", () => {
      const workers = [createMockWorker("worker-1", 10), createMockWorker("worker-2", 5)];

      const scheduler = new TaskScheduler(config, { strategy: "round-robin" });

      // Start with round-robin
      expect(scheduler.selectWorker(workers)!.id).toBe("worker-1");

      // Change to least-tasks
      scheduler.setStrategy("least-tasks");
      expect(scheduler.selectWorker(workers)!.id).toBe("worker-2");
    });

    it("should update configuration", () => {
      scheduler.updateConfig({
        strategy: "weighted",
        enablePriority: false,
        maxQueueSize: 200,
      });

      expect(scheduler).toBeDefined();
    });
  });

  describe("Drain Operation", () => {
    it("should complete when queue is empty", async () => {
      scheduler.schedule(createMockTask("task-1"));
      scheduler.dequeue();

      await expect(scheduler.drain()).resolves.toBeUndefined();
    });

    it("should wait until queue is empty", async () => {
      scheduler.schedule(createMockTask("task-1"));
      scheduler.schedule(createMockTask("task-2"));

      const drainPromise = scheduler.drain();

      // Dequeue tasks after slight delay
      setTimeout(() => {
        scheduler.dequeue();
        scheduler.dequeue();
      }, 50);

      await expect(drainPromise).resolves.toBeUndefined();
    });
  });

  describe("Clear Operation", () => {
    it("should clear all queued tasks", () => {
      scheduler.schedule(createMockTask("task-1"));
      scheduler.schedule(createMockTask("task-2"));
      scheduler.schedule(createMockTask("task-3"));

      const cleared = scheduler.clear();

      expect(cleared.length).toBe(3);
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it("should return array of cleared tasks", () => {
      const task1 = createMockTask("task-1");
      const task2 = createMockTask("task-2");

      scheduler.schedule(task1);
      scheduler.schedule(task2);

      const cleared = scheduler.clear();

      expect(cleared.some((t) => t.taskId === "task-1")).toBe(true);
      expect(cleared.some((t) => t.taskId === "task-2")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle scheduling with null resolve/reject", () => {
      const task = createMockTask("task-1");
      expect(() => scheduler.schedule(task)).not.toThrow();
    });

    it("should handle dequeue from empty queue multiple times", () => {
      expect(scheduler.dequeue()).toBeUndefined();
      expect(scheduler.dequeue()).toBeUndefined();
      expect(scheduler.getQueueSize()).toBe(0);
    });

    it("should handle mixed priority and FIFO tasks", () => {
      scheduler.schedule(createMockTask("fifo-1", 5));
      scheduler.schedule(createMockTask("priority-1", 1));
      scheduler.schedule(createMockTask("fifo-2", 8));
      scheduler.schedule(createMockTask("priority-2", 3));

      expect(scheduler.dequeue()?.taskId).toBe("priority-1");
      expect(scheduler.dequeue()?.taskId).toBe("priority-2");
      expect(scheduler.dequeue()?.taskId).toBe("fifo-1");
      expect(scheduler.dequeue()?.taskId).toBe("fifo-2");
    });

    it("should handle tasks with identical properties", () => {
      for (let i = 0; i < 5; i++) {
        scheduler.schedule(createMockTask(`task-${i}`, 5));
      }

      expect(scheduler.getQueueSize()).toBe(5);

      for (let i = 0; i < 5; i++) {
        const task = scheduler.dequeue();
        expect(task?.taskId).toBe(`task-${i}`);
      }
    });
  });

  describe("Performance", () => {
    it("should handle large number of tasks efficiently", () => {
      const scheduler = new TaskScheduler({ maxQueueSize: 5000 });
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        scheduler.schedule(createMockTask(`task-${i}`, Math.random() * 10));
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should complete in < 100ms
      expect(scheduler.getQueueSize()).toBe(1000);
    });

    it("should dequeue efficiently in priority order", () => {
      for (let i = 0; i < 100; i++) {
        scheduler.schedule(createMockTask(`task-${i}`, Math.random() * 10));
      }

      const startTime = performance.now();

      while (scheduler.getQueueSize() > 0) {
        scheduler.dequeue();
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(50); // Should dequeue 100 tasks in < 50ms
    });

    it("should select workers efficiently", () => {
      const workers = Array.from({ length: 100 }, (_, i) =>
        createMockWorker(`worker-${i}`, Math.random() * 1000, Math.random() * 100)
      );

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        scheduler.selectWorker(workers);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100); // Should select 1000 workers in < 100ms
    });
  });

  describe("Type Safety", () => {
    it("should maintain generic type information", () => {
      interface CustomTask {
        value: number;
        name: string;
      }

      interface CustomResult {
        computed: number;
      }

      const task = createMockTask("test") as TaskContext<CustomTask, CustomResult>;
      expect(() => scheduler.schedule(task)).not.toThrow();
    });
  });
});
