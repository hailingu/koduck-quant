import { describe, it, expect, beforeEach } from "vitest";
import { TaskQueue } from "../../../src/common/worker-pool/task-queue";
import type { QueueItem } from "../../../src/common/worker-pool/task-queue";

describe("TaskQueue", () => {
  let queue: TaskQueue;

  beforeEach(() => {
    queue = new TaskQueue();
  });

  describe("enqueue and dequeue", () => {
    it("should enqueue and dequeue items in priority order", () => {
      const item1: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      const item2: QueueItem = {
        id: "2",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 2,
      };

      queue.enqueue(item1);
      queue.enqueue(item2);

      expect(queue.size).toBe(2);

      const dequeued1 = queue.dequeue();
      expect(dequeued1?.id).toBe("2"); // Higher priority first

      const dequeued2 = queue.dequeue();
      expect(dequeued2?.id).toBe("1");

      expect(queue.size).toBe(0);
    });
  });

  describe("remove", () => {
    it("should remove items matching predicate", () => {
      const item1: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      const item2: QueueItem = {
        id: "2",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      queue.enqueue(item1);
      queue.enqueue(item2);

      expect(queue.size).toBe(2);

      queue.remove((item) => item.id === "1");

      expect(queue.size).toBe(1);

      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe("2");
    });

    it("should remove all items from a priority bucket when all match", () => {
      const item1: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      const item2: QueueItem = {
        id: "2",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      queue.enqueue(item1);
      queue.enqueue(item2);

      queue.remove((item) => item.priority === 1);

      expect(queue.size).toBe(0);
    });

    it("should not remove items when predicate matches nothing", () => {
      const item: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      queue.enqueue(item);

      queue.remove((item) => item.id === "nonexistent");

      expect(queue.size).toBe(1);
    });
  });

  describe("clear", () => {
    it("should clear all items from the queue", () => {
      const item1: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      const item2: QueueItem = {
        id: "2",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 2,
      };

      queue.enqueue(item1);
      queue.enqueue(item2);

      expect(queue.size).toBe(2);

      queue.clear();

      expect(queue.size).toBe(0);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe("size", () => {
    it("should return correct size", () => {
      expect(queue.size).toBe(0);

      const item: QueueItem = {
        id: "1",
        task: { type: "test", payload: null },
        resolve: () => {},
        reject: () => {},
        attempt: 0,
        enqueuedAt: Date.now(),
        priority: 1,
      };

      queue.enqueue(item);
      expect(queue.size).toBe(1);

      queue.dequeue();
      expect(queue.size).toBe(0);
    });
  });
});
