/**
 * MemoryLRUCache unit tests
 * Goal: achieve 85%+ code coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryLRUCache } from "../../src/common/cache/memory-lru";
import type { Clock, SchedulerLike } from "../../src/common/cache/types";

// Mock clock
class MockClock implements Clock {
  private time = 1000;

  now(): number {
    return this.time;
  }

  advance(ms: number): void {
    this.time += ms;
  }

  set(time: number): void {
    this.time = time;
  }
}

// Mock scheduler
class MockScheduler implements SchedulerLike {
  private timers = new Map<number, NodeJS.Timeout>();
  private nextId = 1;

  set(fn: () => void, delayMs: number): number {
    const id = this.nextId++;
    const timer = setTimeout(fn, delayMs);
    this.timers.set(id, timer);
    return id;
  }

  clear(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}

describe("MemoryLRUCache", () => {
  let mockClock: MockClock;
  let mockScheduler: MockScheduler;

  beforeEach(() => {
    mockClock = new MockClock();
    mockScheduler = new MockScheduler();
  });

  afterEach(() => {
    mockScheduler.clearAll();
  });

  describe("Basic operations", () => {
    it("should be able to create a cache instance", () => {
      const cache = new MemoryLRUCache<string, number>();
      expect(cache).toBeDefined();
      expect(cache.size()).toBe(0);
    });

    it("should be able to set and get values", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);
      expect(cache.size()).toBe(1);
    });

    it("should return undefined when key does not exist", () => {
      const cache = new MemoryLRUCache<string, number>();
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("should be able to check if a key exists", () => {
      const cache = new MemoryLRUCache<string, number>();

      expect(cache.has("key1")).toBe(false);
      cache.set("key1", 100);
      expect(cache.has("key1")).toBe(true);
    });

    it("should be able to delete keys", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100);
      expect(cache.delete("key1")).toBe(true);
      expect(cache.has("key1")).toBe(false);
      expect(cache.delete("nonexistent")).toBe(false);
    });

    it("should be able to clear the cache", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100);
      cache.set("key2", 200);
      expect(cache.size()).toBe(2);

      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("LRU behavior", () => {
    it("should implement LRU eviction policy", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.set("key3", 300); // should evict key1

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
    });

    it("should update LRU order on access", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.get("key1"); // access key1, making it the most recent
      cache.set("key3", 300); // should evict key2

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    it("should maintain LRU order when replacing existing keys", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.set("key1", 150); // replace key1's value
      cache.set("key3", 300); // should evict key2

      expect(cache.get("key1")).toBe(150);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });
  });

  describe("TTL features", () => {
    it("should support TTL expiration", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      expect(cache.get("key1")).toBe(100);

      mockClock.advance(1001);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.has("key1")).toBe(false);
    });

    it("should support default TTL", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);

      mockClock.advance(501);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("explicit TTL should override default TTL", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(600);
      expect(cache.get("key1")).toBe(100); // should not have expired yet

      mockClock.advance(500);
      expect(cache.get("key1")).toBeUndefined(); // should have expired now
    });

    it("TTL of 0 or undefined should mean no expiration", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100, { ttl: 0 });
      // For undefined, omitting ttl or explicitly passing undefined uses defaultTTL
      // To truly avoid expiration, pass 0 or a negative number
      cache.set("key2", 200, { ttl: -1 });

      mockClock.advance(1000);
      expect(cache.get("key1")).toBe(100);
      expect(cache.get("key2")).toBe(200);
    });
  });

  describe("Weight management", () => {
    it("should support weight-based eviction", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "hello"); // weight 5
      cache.set("key2", "world"); // weight 5, total weight 10
      cache.set("key3", "test"); // weight 4, should trigger eviction

      expect(cache.has("key1")).toBe(false); // oldest evicted
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
    });

    it("should support explicit weight setting", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        // Note: weight eviction requires a weigh function or explicit weight, but the code logic requires a weigh function to exist
        weigh: () => 1, // provide default weigh function
      });

      cache.set("key1", "value1", { weight: 5 });
      cache.set("key2", "value2", { weight: 6 }); // should trigger eviction

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
    });

    it("should correctly update weight when replacing entries", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "hello"); // weight 5
      const info1 = cache.info();
      expect(info1.currentWeight).toBe(5);

      cache.set("key1", "hi"); // weight 2, replacing original value
      const info2 = cache.info();
      expect(info2.currentWeight).toBe(2);
    });
  });

  describe("Tag-based invalidation", () => {
    it("should support invalidation by tag", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1", "tag2"] });
      cache.set("key2", 200, { tags: ["tag2", "tag3"] });
      cache.set("key3", 300, { tags: ["tag3"] });

      const count = cache.invalidateByTag("tag2");
      expect(count).toBe(2);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    it("should be able to add tags to existing entries", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1"] });
      cache.addTags("key1", "tag2", "tag3");

      cache.invalidateByTag("tag2");
      expect(cache.has("key1")).toBe(false);
    });

    it("invalidating a non-existent tag should return 0", () => {
      const cache = new MemoryLRUCache<string, number>();
      const count = cache.invalidateByTag("nonexistent");
      expect(count).toBe(0);
    });

    it("adding tags to a non-existent key should be a no-op", () => {
      const cache = new MemoryLRUCache<string, number>();
      cache.addTags("nonexistent", "tag1");

      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(0);
    });
  });

  describe("getOrSet method", () => {
    it("should return cached value on cache hit", () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(() => 200);

      cache.set("key1", 100);
      const result = cache.getOrSet("key1", producer);

      expect(result).toBe(100);
      expect(producer).not.toHaveBeenCalled();
    });

    it("should call producer on cache miss", () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(() => 200);

      const result = cache.getOrSet("key1", producer);

      expect(result).toBe(200);
      expect(producer).toHaveBeenCalledOnce();
      expect(cache.get("key1")).toBe(200);
    });
  });

  describe("getOrSetAsync method", () => {
    it("should return resolved Promise on cache hit", async () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(async () => 200);

      cache.set("key1", 100);
      const result = await cache.getOrSetAsync("key1", producer);

      expect(result).toBe(100);
      expect(producer).not.toHaveBeenCalled();
    });

    it("should call async producer on cache miss", async () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(async () => 200);

      const result = await cache.getOrSetAsync("key1", producer);

      expect(result).toBe(200);
      expect(producer).toHaveBeenCalledOnce();
      expect(cache.get("key1")).toBe(200);
    });

    it("should support concurrent deduplication", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let producerCallCount = 0;
      const producer = vi.fn(async () => {
        producerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 200;
      });

      // Initiate multiple requests for the same key simultaneously
      const promises = [
        cache.getOrSetAsync("key1", producer),
        cache.getOrSetAsync("key1", producer),
        cache.getOrSetAsync("key1", producer),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([200, 200, 200]);
      expect(producerCallCount).toBe(1); // producer called only once
    });

    it("should be able to disable concurrent deduplication", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let producerCallCount = 0;
      const producer = vi.fn(async () => {
        producerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 200;
      });

      // Disable deduplication
      const promises = [
        cache.getOrSetAsync("key1", producer, { dedupe: false }),
        cache.getOrSetAsync("key1", producer, { dedupe: false }),
      ];

      await Promise.all(promises);
      expect(producerCallCount).toBe(2); // producer called twice
    });

    it("should support timeout", async () => {
      const cache = new MemoryLRUCache<string, number>({
        scheduler: mockScheduler,
      });

      const producer = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 200;
      });

      await expect(
        cache.getOrSetAsync("key1", producer, { timeout: 100 })
      ).rejects.toThrow("Cache compute timeout: 100ms");
    });
  });

  describe("Statistics", () => {
    it("should correctly track cache statistics", () => {
      const cache = new MemoryLRUCache<string, number>({
        namespace: "test",
        maxEntries: 2,
        maxWeight: 100,
      });

      cache.set("key1", 100);
      cache.get("key1"); // hit
      cache.get("key2"); // miss
      cache.set("key2", 200);
      cache.set("key3", 300); // trigger eviction

      const info = cache.info();
      expect(info.namespace).toBe("test");
      expect(info.maxEntries).toBe(2);
      expect(info.maxWeight).toBe(100);
      expect(info.currentEntries).toBe(2);
      expect(info.hits).toBe(1);
      expect(info.misses).toBe(1);
      expect(info.evictions).toBe(1);
    });

    it("should track expiration statistics", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(1001);
      cache.get("key1"); // trigger expiration

      const info = cache.info();
      expect(info.expirations).toBe(1);
    });
  });

  describe("Callbacks and events", () => {
    it("should call callback on eviction", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 1,
        onEvict,
      });

      cache.set("key1", 100);
      cache.set("key2", 200); // trigger eviction

      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "key1",
          value: 100,
        }),
        "evict"
      );
    });

    it("should call callback on manual deletion", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({ onEvict });

      cache.set("key1", 100);
      cache.delete("key1");

      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "key1",
          value: 100,
        }),
        "manual"
      );
    });

    it("should call callback on clear", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({ onEvict });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.clear();

      expect(onEvict).toHaveBeenCalledTimes(2);
      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({ key: "key1" }),
        "clear"
      );
      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({ key: "key2" }),
        "clear"
      );
    });

    it("should call callback on expiration", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        onEvict,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(1001);
      cache.get("key1"); // trigger expiration check

      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "key1",
          value: 100,
        }),
        "expire"
      );
    });
  });

  describe("Custom key hashing", () => {
    it("should support custom key hash function", () => {
      interface ComplexKey {
        id: number;
        type: string;
      }

      const keyHash = vi.fn((key: ComplexKey) => `${key.type}-${key.id}`);
      const cache = new MemoryLRUCache<ComplexKey, string>({ keyHash });

      const key1 = { id: 1, type: "user" };
      const key2 = { id: 1, type: "user" }; // different object but same content

      cache.set(key1, "value1");
      expect(cache.get(key2)).toBe("value1"); // should be found

      expect(keyHash).toHaveBeenCalledWith(key1);
      expect(keyHash).toHaveBeenCalledWith(key2);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty maxEntries", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 0,
      });

      cache.set("key1", 100);
      expect(cache.size()).toBe(0); // immediately evicted
    });

    it("should handle empty maxWeight", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 0,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "a");
      expect(cache.size()).toBe(0); // immediately evicted
    });

    it("should correctly handle tag cleanup", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1"] });
      cache.set("key2", 200, { tags: ["tag1"] });

      // After deleting an entry, the tag mapping should be correctly updated
      cache.delete("key1");
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1); // only key2 is affected
    });

    it("should correctly handle tags on replacement", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1", "tag2"] });
      cache.set("key1", 200, { tags: ["tag3"] }); // replace and change tags

      // Old tags should no longer be valid
      expect(cache.invalidateByTag("tag1")).toBe(0);
      expect(cache.invalidateByTag("tag2")).toBe(0);

      // New tags should be valid
      expect(cache.invalidateByTag("tag3")).toBe(1);
      expect(cache.has("key1")).toBe(false);
    });

    it("should handle duplicate tags", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1", "tag1", "tag2"] });
      cache.addTags("key1", "tag2", "tag3", "tag3");

      // Verify tag deduplication
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1);
    });

    it("should handle expired entries during has() check", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      expect(cache.has("key1")).toBe(true);

      mockClock.advance(1001);
      expect(cache.has("key1")).toBe(false); // should trigger expiration and return false
    });

    it("should handle orphaned references in tag mapping", () => {
      const cache = new MemoryLRUCache<string, number>();

      // Create a problematic internal state, simulating a case where the tag mapping exists but the actual entry does not
      cache.set("key1", 100, { tags: ["tag1"] });

      // Simulate orphaned references by direct manipulation (this won't happen in normal use, but tests edge cases)
      const key2Hash = JSON.stringify("key2");

      // Get internal tag mapping and add orphaned reference
       
      const tagsMap = (cache as any).tags;
      const tag1Set = tagsMap.get("tag1");
      if (tag1Set) {
        tag1Set.add(key2Hash); // add a reference to a non-existent entry
      }

      // Invalidation should clean up orphaned references
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1); // only key1 is affected, key2's orphaned reference is cleaned up
    });
  });

  describe("Memory and performance", () => {
    it("should correctly clean up in-flight Promises", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let resolveProducer: (value: number) => void;

      const producer = vi.fn(
        () =>
          new Promise<number>((resolve) => {
            resolveProducer = resolve;
          })
      );

      const promise = cache.getOrSetAsync("key1", producer);

      // Resolve Promise
      resolveProducer!(100);
      await promise;

      // Subsequent calls should use cached value instead of creating new Promises
      const result = await cache.getOrSetAsync("key1", producer);
      expect(result).toBe(100);
      expect(producer).toHaveBeenCalledOnce();
    });

    it("should remain consistent after a large number of operations", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 100,
      });

      // Add a large number of entries
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      expect(cache.size()).toBe(100);

      // Verify the latest 100 entries exist
      for (let i = 900; i < 1000; i++) {
        expect(cache.has(`key${i}`)).toBe(true);
      }

      // Verify the oldest entries do not exist
      for (let i = 0; i < 900; i++) {
        expect(cache.has(`key${i}`)).toBe(false);
      }
    });
  });
});
