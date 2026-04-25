/**
 * Performance Optimization Unit Tests
 *
 * Comprehensive test suite for message pooling, transferable objects,
 * result caching, and message batching optimizations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MessagePool,
  getMessagePool,
  resetMessagePool,
} from "../../../src/common/worker-pool/message-pool";
import {
  getTransferables,
  isTransferable,
  analyzeTransferables,
  OptimizedMessage,
  formatBytes,
} from "../../../src/common/worker-pool/transferable-optimizer";
import {
  ResultCache,
  getResultCache,
  resetResultCache,
} from "../../../src/common/worker-pool/result-cache";
import {
  MessageBatch,
  BatchProcessor,
  type BatchItem,
} from "../../../src/common/worker-pool/message-batch";

// ============================================================================
// Message Pool Tests
// ============================================================================

describe("MessagePool", () => {
  let pool: MessagePool;

  beforeEach(() => {
    pool = new MessagePool(100);
  });

  describe("acquire and release", () => {
    it("should acquire main thread message", () => {
      const msg = pool.acquireMainThreadMessage();
      expect(msg).toBeDefined();
      expect(msg.type).toBe("ping");
      expect(msg.timestamp).toBe(0);
    });

    it("should acquire worker message", () => {
      const msg = pool.acquireWorkerMessage();
      expect(msg).toBeDefined();
      expect(msg.type).toBe("pong");
      expect(msg.timestamp).toBe(0);
    });

    it("should reuse released main thread messages", () => {
      const msg1 = pool.acquireMainThreadMessage();
      msg1.id = "test-1";
      msg1.timestamp = Date.now();

      pool.releaseMainThreadMessage(msg1);

      const msg2 = pool.acquireMainThreadMessage();
      // Should be from pool (reused)
      expect(msg2).toBe(msg1);
      // Should be reset
      expect(msg2.id).toBeUndefined();
      expect(msg2.timestamp).toBe(0);
    });

    it("should reuse released worker messages", () => {
      const msg1 = pool.acquireWorkerMessage();
      msg1.id = "task-1";
      msg1.data = { value: 42 };

      pool.releaseWorkerMessage(msg1);

      const msg2 = pool.acquireWorkerMessage();
      expect(msg2).toBe(msg1);
      expect(msg2.id).toBeUndefined();
      expect(msg2.data).toBeUndefined();
    });

    it("should track pool statistics", () => {
      pool.acquireMainThreadMessage();
      pool.acquireMainThreadMessage();
      pool.acquireMainThreadMessage();

      const stats = pool.getMainThreadPoolStats();
      expect(stats.acquisitions).toBe(3);
      expect(stats.misses).toBe(0); // All from pre-allocated pool
    });

    it("should respect max pool size", () => {
      const smallPool = new MessagePool(2);

      const msg1 = smallPool.acquireMainThreadMessage();
      const msg2 = smallPool.acquireMainThreadMessage();

      smallPool.releaseMainThreadMessage(msg1);
      smallPool.releaseMainThreadMessage(msg2);

      // Try to release third message - should exceed max
      const msg3 = smallPool.acquireMainThreadMessage();
      smallPool.releaseMainThreadMessage(msg3);

      const stats = smallPool.getMainThreadPoolStats();
      expect(stats.currentSize).toBeLessThanOrEqual(2);
    });
  });

  describe("statistics", () => {
    it("should calculate hit rate correctly", () => {
      // Acquire 10, release 8 -> 80% release rate
      for (let i = 0; i < 10; i++) {
        pool.acquireMainThreadMessage();
      }

      // Simulate reuses
      const messages = [];
      for (let i = 0; i < 8; i++) {
        const msg = pool.acquireMainThreadMessage();
        messages.push(msg);
      }

      for (const msg of messages) {
        pool.releaseMainThreadMessage(msg);
      }

      const stats = pool.getMainThreadPoolStats();
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it("should track combined statistics", () => {
      pool.acquireMainThreadMessage();
      pool.acquireWorkerMessage();

      const combined = pool.getCombinedStats();
      expect(combined.mainThread).toBeDefined();
      expect(combined.worker).toBeDefined();
      expect(combined.overallHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("singleton", () => {
    it("should return singleton instance", () => {
      resetMessagePool();
      const pool1 = getMessagePool(100);
      const pool2 = getMessagePool(200);

      expect(pool1).toBe(pool2);
    });

    it("should use initial size on first creation", () => {
      resetMessagePool();
      const pool = getMessagePool(50);

      // Add enough messages to fill pool
      for (let i = 0; i < 60; i++) {
        pool.acquireMainThreadMessage();
      }

      // Some should have been cache misses
      const stats = pool.getMainThreadPoolStats();
      expect(stats.misses).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Transferable Objects Tests
// ============================================================================

describe("Transferable Objects Optimizer", () => {
  describe("isTransferable", () => {
    it("should identify ArrayBuffer as transferable", () => {
      const buffer = new ArrayBuffer(1024);
      expect(isTransferable(buffer)).toBe(true);
    });

    it("should identify TypedArray as transferable", () => {
      const uint8 = new Uint8Array(10);
      expect(isTransferable(uint8)).toBe(true);

      const float32 = new Float32Array(10);
      expect(isTransferable(float32)).toBe(true);
    });

    it("should not identify non-transferable objects", () => {
      expect(isTransferable({ data: 42 })).toBe(false);
      expect(isTransferable([1, 2, 3])).toBe(false);
      expect(isTransferable("string")).toBe(false);
      expect(isTransferable(42)).toBe(false);
    });
  });

  describe("getTransferables", () => {
    it("should extract ArrayBuffer from nested object", () => {
      const buffer = new ArrayBuffer(1024);
      const data = { buffer, other: "data" };

      const transferables = getTransferables(data);
      expect(transferables).toContain(buffer);
      expect(transferables.length).toBe(1);
    });

    it("should extract multiple transferables", () => {
      const buffer1 = new ArrayBuffer(1024);
      const buffer2 = new ArrayBuffer(512);
      const uint8 = new Uint8Array(10);

      const data = {
        buffers: [buffer1, buffer2],
        typed: uint8,
      };

      const transferables = getTransferables(data);
      expect(transferables.length).toBe(3);
      expect(transferables).toContain(buffer1);
      expect(transferables).toContain(buffer2);
      expect(transferables).toContain(uint8);
    });

    it("should handle circular references", () => {
      const obj: Record<string, unknown> = { buffer: new ArrayBuffer(100) };
      obj.self = obj; // Create cycle

      const transferables = getTransferables(obj);
      expect(transferables.length).toBe(1);
    });

    it("should extract from Map and Set", () => {
      const buffer = new ArrayBuffer(256);
      const map = new Map<string, unknown>([["key", buffer]]);
      const set = new Set([buffer]);

      const transferablesMap = getTransferables(map);
      const transferablesSet = getTransferables(set);

      expect(transferablesMap.length).toBe(1);
      expect(transferablesSet.length).toBe(1);
    });
  });

  describe("analyzeTransferables", () => {
    it("should analyze transfer potential", () => {
      const buffer = new ArrayBuffer(1024 * 100); // 100KB
      const data = { buffer };

      const analysis = analyzeTransferables(data);
      expect(analysis.count).toBe(1);
      expect(analysis.bytes).toBe(1024 * 100);
      expect(analysis.types.has("ArrayBuffer")).toBe(true);
      expect(analysis.estimatedSavings).toBeGreaterThan(0);
    });

    it("should identify TypedArray types", () => {
      const uint8 = new Uint8Array(100);
      const float32 = new Float32Array(100);
      const data = { uint8, float32 };

      const analysis = analyzeTransferables(data);
      expect(analysis.count).toBe(2);
      expect(analysis.types.has("Uint8Array")).toBe(true);
      expect(analysis.types.has("Float32Array")).toBe(true);
    });
  });

  describe("OptimizedMessage", () => {
    it("should wrap message and extract transferables", () => {
      const buffer = new ArrayBuffer(512);
      const data = { payload: buffer, id: "msg-1" };

      const optimized = new OptimizedMessage(data);
      expect(optimized.data).toBe(data);
      expect(optimized.transferables.length).toBe(1);
      expect(optimized.transferables[0]).toBe(buffer);
    });

    it("should track statistics", () => {
      const buffer = new ArrayBuffer(1024 * 50);
      const data = { buffer };

      const optimized = new OptimizedMessage(data);
      expect(optimized.stats.count).toBe(1);
      expect(optimized.stats.bytes).toBeGreaterThan(0);
    });
  });

  describe("formatBytes", () => {
    it("should format bytes correctly", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(1024)).toContain("KB");
      expect(formatBytes(1024 * 1024)).toContain("MB");
      expect(formatBytes(1024 * 1024 * 1024)).toContain("GB");
    });
  });
});

// ============================================================================
// Result Cache Tests
// ============================================================================

describe("ResultCache", () => {
  let cache: ResultCache<number>;

  beforeEach(() => {
    cache = new ResultCache({ maxSize: 10, ttl: 1000 });
  });

  describe("cache operations", () => {
    it("should set and get values", () => {
      cache.set("compute", { value: 42 }, 84);

      const result = cache.get("compute", { value: 42 });
      expect(result).toBe(84);
    });

    it("should return undefined for missing keys", () => {
      const result = cache.get("compute", { value: 42 });
      expect(result).toBeUndefined();
    });

    it("should check if key exists", () => {
      cache.set("compute", { value: 42 }, 84);

      expect(cache.has("compute", { value: 42 })).toBe(true);
      expect(cache.has("compute", { value: 43 })).toBe(false);
    });

    it("should handle different task data", () => {
      cache.set("compute", { x: 1 }, 1);
      cache.set("compute", { x: 2 }, 2);
      cache.set("compute", { x: 3 }, 3);

      expect(cache.get("compute", { x: 1 })).toBe(1);
      expect(cache.get("compute", { x: 2 })).toBe(2);
      expect(cache.get("compute", { x: 3 })).toBe(3);
    });
  });

  describe("LRU eviction", () => {
    it("should evict least recently used entries", () => {
      // Fill cache to max
      for (let i = 0; i < 10; i++) {
        cache.set("compute", { id: i }, i);
      }

      expect(cache.getSize()).toBe(10);

      // Add one more - should evict LRU
      cache.set("compute", { id: 100 }, 100);

      expect(cache.getSize()).toBe(10);
      expect(cache.getStats().evictions).toBe(1);
    });

    it("should track eviction statistics", () => {
      for (let i = 0; i < 15; i++) {
        cache.set("task", { index: i }, i);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(5); // 15 - 10 max
    });
  });

  describe("TTL expiration", () => {
    it("should expire old entries", async () => {
      cache.set("compute", { value: 1 }, 100);

      // Should be in cache initially
      expect(cache.has("compute", { value: 1 })).toBe(true);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be expired now
      expect(cache.has("compute", { value: 1 })).toBe(false);
      expect(cache.getStats().expirations).toBe(1);
    });

    it("should clean expired entries", async () => {
      cache.set("task-1", { id: 1 }, 10);
      cache.set("task-2", { id: 2 }, 20);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const removed = cache.removeExpired();
      expect(removed).toBe(2);
      expect(cache.getSize()).toBe(0);
    });
  });

  describe("statistics", () => {
    it("should track hit/miss ratio", () => {
      cache.set("compute", { value: 42 }, 84);

      // Hit
      cache.get("compute", { value: 42 });
      // Miss
      cache.get("compute", { value: 43 });

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(50);
    });

    it("should estimate memory usage", () => {
      const largeValue = new Array(1000).fill(0);
      cache.set("compute", { id: 1 }, largeValue as unknown as number);

      const stats = cache.getStats();
      expect(stats.memoryUsed).toBeGreaterThan(0);
    });

    it("should calculate hit rate correctly", () => {
      for (let i = 0; i < 10; i++) {
        cache.set("task", { id: i }, i);
      }

      // All hits
      for (let i = 0; i < 10; i++) {
        cache.get("task", { id: i });
      }

      const stats = cache.getStats();
      expect(stats.hitRate).toBe(100);
    });
  });

  describe("singleton", () => {
    it("should return singleton instance", () => {
      resetResultCache();
      const cache1 = getResultCache({ maxSize: 50 });
      const cache2 = getResultCache({ maxSize: 100 });

      expect(cache1).toBe(cache2);
    });
  });
});

// ============================================================================
// Message Batch Tests
// ============================================================================

describe("MessageBatch", () => {
  let batch: MessageBatch;

  beforeEach(() => {
    batch = new MessageBatch({
      maxBatchSize: 5,
      maxBatchBytes: 1024,
      flushInterval: 50,
    });
  });

  describe("batch accumulation", () => {
    it("should add messages to batch", () => {
      batch.add("task", { id: 1, data: "test" });

      expect(batch.getBatchSize()).toBe(1);
      expect(batch.hasPending()).toBe(true);
    });

    it("should respect maxBatchSize limit", () => {
      for (let i = 0; i < 5; i++) {
        batch.add("task", { id: i });
      }

      expect(batch.getBatchSize()).toBe(5);

      // Adding 6th should flush previous batch
      batch.add("task", { id: 6 });
      expect(batch.getBatchSize()).toBe(1); // New batch
    });

    it("should respect maxBatchBytes limit", () => {
      const largeData = new Array(256).fill(0);

      for (let i = 0; i < 5; i++) {
        const flushed = batch.add("task", { id: i, data: largeData });
        if (i === 4) {
          expect(flushed).toBe(true);
        }
      }
    });
  });

  describe("flush", () => {
    it("should flush accumulated messages", () => {
      batch.add("task", { id: 1 });
      batch.add("task", { id: 2 });

      const flushed = batch.flushSync();
      expect(flushed.length).toBe(2);
      expect(batch.getBatchSize()).toBe(0);
    });

    it("should return empty array when no pending", () => {
      const flushed = batch.flushSync();
      expect(flushed.length).toBe(0);
    });

    it("should update statistics on flush", () => {
      batch.add("task", { id: 1 });
      batch.add("task", { id: 2 });
      batch.flushSync();

      const stats = batch.getStats();
      expect(stats.batchesSent).toBe(1);
      expect(stats.messagesSent).toBe(2);
    });
  });

  describe("statistics", () => {
    it("should calculate average batch size", () => {
      for (let i = 0; i < 3; i++) {
        batch.add("task", { id: i });
      }
      batch.flushSync();

      for (let i = 0; i < 5; i++) {
        batch.add("task", { id: i });
      }
      batch.flushSync();

      const stats = batch.getStats();
      expect(stats.avgBatchSize).toBe(4); // (3 + 5) / 2
    });

    it("should calculate compression ratio", () => {
      for (let i = 0; i < 10; i++) {
        batch.add("task", { id: i });
      }
      batch.flushSync();

      const ratio = batch.getCompressionRatio();
      expect(ratio).toBeGreaterThan(1); // Should show compression benefit
    });
  });

  describe("auto-flush", () => {
    it("should schedule auto-flush on first message", async () => {
      const flushEvents: BatchItem[][] = [];
      const batchWithCallback = new MessageBatch({ flushInterval: 50 }, (messages: BatchItem[]) =>
        flushEvents.push(messages)
      );

      batchWithCallback.add("task", { id: 1 });
      expect(flushEvents.length).toBe(0); // Not flushed yet

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(flushEvents.length).toBe(1); // Should be flushed
    });
  });
});

// ============================================================================
// Batch Processor Tests
// ============================================================================

describe("BatchProcessor", () => {
  let processor: BatchProcessor;

  beforeEach(() => {
    processor = new BatchProcessor({
      maxBatchSize: 3,
      maxBatchBytes: 512,
      flushInterval: 50,
    });
  });

  describe("batch management", () => {
    it("should create separate batches for different keys", () => {
      processor.add("worker-1", "task", { id: 1 });
      processor.add("worker-2", "task", { id: 2 });

      const batch1 = processor.getBatch("worker-1");
      const batch2 = processor.getBatch("worker-2");

      expect(batch1).not.toBe(batch2);
      expect(batch1.getBatchSize()).toBe(1);
      expect(batch2.getBatchSize()).toBe(1);
    });

    it("should flush specific batch", () => {
      processor.add("worker-1", "task", { id: 1 });
      processor.add("worker-1", "task", { id: 2 });

      const messages = processor.flush("worker-1");
      expect(messages.length).toBe(2);
    });

    it("should flush all batches", () => {
      processor.add("worker-1", "task", { id: 1 });
      processor.add("worker-2", "task", { id: 2 });

      const allFlushed = processor.flushAll();
      expect(allFlushed.size).toBe(2);
    });
  });

  describe("statistics", () => {
    it("should collect statistics from all batches", () => {
      processor.add("worker-1", "task", { id: 1 });
      processor.add("worker-2", "task", { id: 1 });

      const allStats = processor.getAllStats();
      expect(allStats.size).toBe(2);
      expect(allStats.get("worker-1")).toBeDefined();
      expect(allStats.get("worker-2")).toBeDefined();
    });
  });

  describe("cleanup", () => {
    it("should clear all batches", () => {
      processor.add("worker-1", "task", { id: 1 });
      processor.add("worker-2", "task", { id: 2 });

      processor.clear();

      expect(processor.flush("worker-1").length).toBe(0);
      expect(processor.flush("worker-2").length).toBe(0);
    });

    it("should dispose all batches", () => {
      processor.add("worker-1", "task", { id: 1 });

      processor.dispose();

      expect(processor.flush("worker-1").length).toBe(0);
    });
  });
});
