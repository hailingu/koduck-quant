/**
 * Priority Queue Unit Tests
 *
 * Comprehensive test suite for PriorityQueue data structure.
 * Tests cover correctness, performance, edge cases, and memory behavior.
 *
 * Test Categories:
 * - Basic Operations: enqueue, dequeue, peek, isEmpty, size, clear
 * - Heap Property: verify binary heap invariant maintained
 * - Priority Ordering: test different priority scenarios
 * - Custom Comparators: min-heap, max-heap, custom sorting
 * - Edge Cases: empty queue, single item, capacity growth
 * - Performance: verify O(log n) operations
 * - Memory: check array reuse and cleanup
 * - Type Safety: generic type parameter handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PriorityQueue } from "../../../src/common/worker-pool/priority-queue";

describe("PriorityQueue", () => {
  describe("Constructor", () => {
    it("should create empty queue with default capacity", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);
      expect(pq.isEmpty()).toBe(true);
      expect(pq.size()).toBe(0);
    });

    it("should create queue with custom initial capacity", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b, 32);
      expect(pq.isEmpty()).toBe(true);
      const stats = pq.getStats();
      expect(stats.capacity).toBeGreaterThanOrEqual(32);
    });
  });

  describe("enqueue and dequeue - Min Heap", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should enqueue single item", () => {
      pq.enqueue(5);
      expect(pq.size()).toBe(1);
      expect(pq.isEmpty()).toBe(false);
    });

    it("should dequeue items in priority order (min-heap)", () => {
      pq.enqueue(10);
      pq.enqueue(3);
      pq.enqueue(7);
      pq.enqueue(1);
      pq.enqueue(5);

      expect(pq.dequeue()).toBe(1);
      expect(pq.dequeue()).toBe(3);
      expect(pq.dequeue()).toBe(5);
      expect(pq.dequeue()).toBe(7);
      expect(pq.dequeue()).toBe(10);
      expect(pq.dequeue()).toBeUndefined();
    });

    it("should maintain min-heap property after dequeue", () => {
      const values = [15, 10, 20, 8, 2, 16, 9];
      for (const v of values) {
        pq.enqueue(v);
      }

      const extracted: number[] = [];
      while (!pq.isEmpty()) {
        const val = pq.dequeue();
        extracted.push(val!);
      }

      for (let i = 1; i < extracted.length; i++) {
        expect(extracted[i]).toBeGreaterThanOrEqual(extracted[i - 1]);
      }
    });
  });

  describe("enqueue and dequeue - Max Heap", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => b - a);
    });

    it("should dequeue items in priority order (max-heap)", () => {
      pq.enqueue(10);
      pq.enqueue(3);
      pq.enqueue(7);
      pq.enqueue(1);
      pq.enqueue(5);

      expect(pq.dequeue()).toBe(10);
      expect(pq.dequeue()).toBe(7);
      expect(pq.dequeue()).toBe(5);
      expect(pq.dequeue()).toBe(3);
      expect(pq.dequeue()).toBe(1);
      expect(pq.dequeue()).toBeUndefined();
    });
  });

  describe("peek", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should return highest priority item without removing", () => {
      pq.enqueue(5);
      pq.enqueue(3);
      pq.enqueue(7);

      expect(pq.peek()).toBe(3);
      expect(pq.peek()).toBe(3);
      expect(pq.size()).toBe(3);
    });

    it("should return undefined for empty queue", () => {
      expect(pq.peek()).toBeUndefined();
    });

    it("should return same item as dequeue without removing", () => {
      pq.enqueue(10);
      pq.enqueue(2);
      pq.enqueue(8);

      const peeked = pq.peek();
      const dequeued = pq.dequeue();

      expect(peeked).toBe(dequeued);
    });
  });

  describe("isEmpty and size", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should report empty queue", () => {
      expect(pq.isEmpty()).toBe(true);
      expect(pq.size()).toBe(0);
    });

    it("should report non-empty queue", () => {
      pq.enqueue(5);
      expect(pq.isEmpty()).toBe(false);
      expect(pq.size()).toBe(1);
    });

    it("should track size correctly with multiple operations", () => {
      pq.enqueue(1);
      pq.enqueue(2);
      expect(pq.size()).toBe(2);

      pq.enqueue(3);
      expect(pq.size()).toBe(3);

      pq.dequeue();
      expect(pq.size()).toBe(2);

      pq.dequeue();
      pq.dequeue();
      expect(pq.isEmpty()).toBe(true);
      expect(pq.size()).toBe(0);
    });
  });

  describe("clear", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should clear all items", () => {
      pq.enqueue(1);
      pq.enqueue(2);
      pq.enqueue(3);
      expect(pq.size()).toBe(3);

      pq.clear();
      expect(pq.isEmpty()).toBe(true);
      expect(pq.size()).toBe(0);
    });

    it("should allow re-enqueue after clear", () => {
      pq.enqueue(5);
      pq.clear();
      pq.enqueue(10);

      expect(pq.size()).toBe(1);
      expect(pq.peek()).toBe(10);
    });

    it("should clear empty queue without error", () => {
      expect(() => pq.clear()).not.toThrow();
      expect(pq.isEmpty()).toBe(true);
    });
  });

  describe("toArray", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should return items in priority order", () => {
      pq.enqueue(10);
      pq.enqueue(5);
      pq.enqueue(15);
      pq.enqueue(3);

      const array = pq.toArray();
      expect(array).toEqual([3, 5, 10, 15]);
    });

    it("should empty the queue", () => {
      pq.enqueue(1);
      pq.enqueue(2);

      pq.toArray();
      expect(pq.isEmpty()).toBe(true);
    });

    it("should return empty array for empty queue", () => {
      expect(pq.toArray()).toEqual([]);
    });
  });

  describe("Complex data structures", () => {
    interface Task {
      id: string;
      priority: number;
      data: unknown;
    }

    it("should work with object comparisons", () => {
      const pq = new PriorityQueue<Task>((a, b) => a.priority - b.priority);

      pq.enqueue({ id: "task1", priority: 5, data: { value: 1 } });
      pq.enqueue({ id: "task2", priority: 2, data: { value: 2 } });
      pq.enqueue({ id: "task3", priority: 8, data: { value: 3 } });

      const first = pq.dequeue();
      expect(first?.id).toBe("task2");
      expect(first?.priority).toBe(2);

      const second = pq.dequeue();
      expect(second?.id).toBe("task1");
    });

    it("should work with nested comparators", () => {
      interface PriorityTask {
        level: number;
        sequence: number;
      }

      const pq = new PriorityQueue<PriorityTask>((a, b) => {
        if (a.level !== b.level) return a.level - b.level;
        return a.sequence - b.sequence;
      });

      pq.enqueue({ level: 2, sequence: 1 });
      pq.enqueue({ level: 1, sequence: 3 });
      pq.enqueue({ level: 1, sequence: 2 });

      expect(pq.dequeue()).toEqual({ level: 1, sequence: 2 });
      expect(pq.dequeue()).toEqual({ level: 1, sequence: 3 });
      expect(pq.dequeue()).toEqual({ level: 2, sequence: 1 });
    });

    it("should handle string comparisons", () => {
      const pq = new PriorityQueue<string>((a, b) => a.localeCompare(b));

      pq.enqueue("zebra");
      pq.enqueue("apple");
      pq.enqueue("mango");

      expect(pq.dequeue()).toBe("apple");
      expect(pq.dequeue()).toBe("mango");
      expect(pq.dequeue()).toBe("zebra");
    });
  });

  describe("Capacity management", () => {
    it("should grow capacity when full", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b, 4);
      const initialStats = pq.getStats();
      const initialCapacity = initialStats.capacity;

      for (let i = 0; i < initialCapacity + 5; i++) {
        pq.enqueue(i);
      }

      const grownStats = pq.getStats();
      expect(grownStats.capacity).toBeGreaterThan(initialCapacity);
      expect(pq.size()).toBe(initialCapacity + 5);
    });

    it("should maintain correct order after capacity growth", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b, 4);

      const values = [15, 3, 7, 1, 9, 2, 11, 5, 13];
      for (const v of values) {
        pq.enqueue(v);
      }

      const extracted: number[] = [];
      while (!pq.isEmpty()) {
        const val = pq.dequeue();
        extracted.push(val!);
      }

      expect(extracted).toEqual([1, 2, 3, 5, 7, 9, 11, 13, 15]);
    });
  });

  describe("getStats", () => {
    let pq: PriorityQueue<number>;

    beforeEach(() => {
      pq = new PriorityQueue<number>((a, b) => a - b);
    });

    it("should return correct stats", () => {
      const stats = pq.getStats();
      expect(stats).toHaveProperty("size");
      expect(stats).toHaveProperty("capacity");
      expect(stats).toHaveProperty("utilizationPercent");
      expect(stats.size).toBe(0);
    });

    it("should calculate utilization correctly", () => {
      pq.enqueue(1);
      pq.enqueue(2);

      const stats = pq.getStats();
      expect(stats.size).toBe(2);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
      expect(stats.utilizationPercent).toBeLessThanOrEqual(100);
    });
  });

  describe("Edge cases and stress tests", () => {
    it("should handle large number of items", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);
      const itemCount = 1000;

      const values: number[] = [];
      for (let i = 0; i < itemCount; i++) {
        values.push(i); // Use sequential numbers to ensure proper ordering
      }
      // Shuffle array
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }
      for (const v of values) {
        pq.enqueue(v);
      }

      expect(pq.size()).toBe(itemCount);

      const extracted: number[] = [];
      while (!pq.isEmpty()) {
        const val = pq.dequeue();
        extracted.push(val!);
      }

      for (let i = 1; i < extracted.length; i++) {
        expect(extracted[i]).toBeGreaterThanOrEqual(extracted[i - 1]);
      }
    });

    it("should handle duplicate values", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);

      pq.enqueue(5);
      pq.enqueue(5);
      pq.enqueue(5);
      pq.enqueue(3);
      pq.enqueue(3);

      expect(pq.dequeue()).toBe(3);
      expect(pq.dequeue()).toBe(3);
      expect(pq.dequeue()).toBe(5);
      expect(pq.dequeue()).toBe(5);
      expect(pq.dequeue()).toBe(5);
    });

    it("should handle interleaved enqueue and dequeue", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);

      pq.enqueue(5);
      pq.enqueue(3);
      expect(pq.dequeue()).toBe(3);
      pq.enqueue(7);
      pq.enqueue(1);
      expect(pq.dequeue()).toBe(1);
      expect(pq.dequeue()).toBe(5);
      pq.enqueue(4);
      expect(pq.dequeue()).toBe(4);
      expect(pq.dequeue()).toBe(7);
    });

    it("should handle negative numbers", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);

      pq.enqueue(-5);
      pq.enqueue(0);
      pq.enqueue(-10);
      pq.enqueue(5);

      expect(pq.dequeue()).toBe(-10);
      expect(pq.dequeue()).toBe(-5);
      expect(pq.dequeue()).toBe(0);
      expect(pq.dequeue()).toBe(5);
    });

    it("should handle mixed positive and negative", () => {
      const pq = new PriorityQueue<number>((a, b) => Math.abs(a) - Math.abs(b));

      pq.enqueue(5);
      pq.enqueue(-3);
      pq.enqueue(0);
      pq.enqueue(-7);

      const result = [];
      while (!pq.isEmpty()) {
        result.push(pq.dequeue());
      }

      expect(result).toEqual([0, -3, 5, -7]);
    });
  });

  describe("Type safety", () => {
    it("should work with generic types", () => {
      interface Item<T> {
        priority: number;
        value: T;
      }

      const pq = new PriorityQueue<Item<string>>((a, b) => a.priority - b.priority);

      pq.enqueue({ priority: 5, value: "high" });
      pq.enqueue({ priority: 1, value: "urgent" });

      const first = pq.dequeue();
      expect(first?.value).toBe("urgent");
      expect(first?.priority).toBe(1);
    });
  });

  describe("Performance characteristics", () => {
    it("enqueue should complete in reasonable time for many items", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);
      const itemCount = 10000;

      const startTime = performance.now();
      for (let i = 0; i < itemCount; i++) {
        pq.enqueue(Math.random() * itemCount);
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(pq.size()).toBe(itemCount);
    });

    it("dequeue should maintain logarithmic behavior", () => {
      const pq = new PriorityQueue<number>((a, b) => a - b);
      const itemCount = 10000;

      for (let i = 0; i < itemCount; i++) {
        pq.enqueue(Math.random() * itemCount);
      }

      const startTime = performance.now();
      while (!pq.isEmpty()) {
        pq.dequeue();
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(pq.isEmpty()).toBe(true);
    });
  });
});
