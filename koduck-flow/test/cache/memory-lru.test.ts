/**
 * MemoryLRUCache 单元测试
 * 目标：达到85%+的代码覆盖率
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryLRUCache } from "../../src/common/cache/memory-lru";
import type { Clock, SchedulerLike } from "../../src/common/cache/types";

// Mock 时钟
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

// Mock 调度器
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

  describe("基础操作", () => {
    it("应该能创建缓存实例", () => {
      const cache = new MemoryLRUCache<string, number>();
      expect(cache).toBeDefined();
      expect(cache.size()).toBe(0);
    });

    it("应该能设置和获取值", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);
      expect(cache.size()).toBe(1);
    });

    it("应该在键不存在时返回undefined", () => {
      const cache = new MemoryLRUCache<string, number>();
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    it("应该能检查键是否存在", () => {
      const cache = new MemoryLRUCache<string, number>();

      expect(cache.has("key1")).toBe(false);
      cache.set("key1", 100);
      expect(cache.has("key1")).toBe(true);
    });

    it("应该能删除键", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100);
      expect(cache.delete("key1")).toBe(true);
      expect(cache.has("key1")).toBe(false);
      expect(cache.delete("nonexistent")).toBe(false);
    });

    it("应该能清空缓存", () => {
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

  describe("LRU 行为", () => {
    it("应该实现LRU淘汰策略", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.set("key3", 300); // 应该淘汰 key1

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
    });

    it("访问时应该更新LRU顺序", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.get("key1"); // 访问key1，使其变为最新
      cache.set("key3", 300); // 应该淘汰 key2

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    it("替换已存在的键时应该保持LRU顺序", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 2,
      });

      cache.set("key1", 100);
      cache.set("key2", 200);
      cache.set("key1", 150); // 替换key1的值
      cache.set("key3", 300); // 应该淘汰 key2

      expect(cache.get("key1")).toBe(150);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });
  });

  describe("TTL 功能", () => {
    it("应该支持TTL过期", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      expect(cache.get("key1")).toBe(100);

      mockClock.advance(1001);
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.has("key1")).toBe(false);
    });

    it("应该支持默认TTL", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100);
      expect(cache.get("key1")).toBe(100);

      mockClock.advance(501);
      expect(cache.get("key1")).toBeUndefined();
    });

    it("显式TTL应该覆盖默认TTL", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(600);
      expect(cache.get("key1")).toBe(100); // 应该还未过期

      mockClock.advance(500);
      expect(cache.get("key1")).toBeUndefined(); // 现在应该过期
    });

    it("TTL为0或undefined应该表示不过期", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        defaultTTL: 500,
      });

      cache.set("key1", 100, { ttl: 0 });
      // 对于undefined，不传ttl参数或显式传入undefined都会使用defaultTTL
      // 要真正避免过期，需要传递0或负数
      cache.set("key2", 200, { ttl: -1 });

      mockClock.advance(1000);
      expect(cache.get("key1")).toBe(100);
      expect(cache.get("key2")).toBe(200);
    });
  });

  describe("权重管理", () => {
    it("应该支持基于权重的淘汰", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "hello"); // 权重5
      cache.set("key2", "world"); // 权重5，总权重10
      cache.set("key3", "test"); // 权重4，应该触发淘汰

      expect(cache.has("key1")).toBe(false); // 最旧的被淘汰
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
    });

    it("应该支持显式设置权重", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        // 注意：权重淘汰需要配合weigh函数或显式weight，但代码中的逻辑要求weigh函数存在
        weigh: () => 1, // 提供默认weigh函数
      });

      cache.set("key1", "value1", { weight: 5 });
      cache.set("key2", "value2", { weight: 6 }); // 应该触发淘汰

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
    });

    it("替换条目时应该正确更新权重", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 10,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "hello"); // 权重5
      const info1 = cache.info();
      expect(info1.currentWeight).toBe(5);

      cache.set("key1", "hi"); // 权重2，替换原值
      const info2 = cache.info();
      expect(info2.currentWeight).toBe(2);
    });
  });

  describe("标签化失效", () => {
    it("应该支持按标签失效", () => {
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

    it("应该能添加标签到已存在的条目", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1"] });
      cache.addTags("key1", "tag2", "tag3");

      cache.invalidateByTag("tag2");
      expect(cache.has("key1")).toBe(false);
    });

    it("对不存在的标签进行失效应该返回0", () => {
      const cache = new MemoryLRUCache<string, number>();
      const count = cache.invalidateByTag("nonexistent");
      expect(count).toBe(0);
    });

    it("对不存在的键添加标签应该无操作", () => {
      const cache = new MemoryLRUCache<string, number>();
      cache.addTags("nonexistent", "tag1");

      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(0);
    });
  });

  describe("getOrSet 方法", () => {
    it("缓存命中时应该返回缓存值", () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(() => 200);

      cache.set("key1", 100);
      const result = cache.getOrSet("key1", producer);

      expect(result).toBe(100);
      expect(producer).not.toHaveBeenCalled();
    });

    it("缓存未命中时应该调用生产者", () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(() => 200);

      const result = cache.getOrSet("key1", producer);

      expect(result).toBe(200);
      expect(producer).toHaveBeenCalledOnce();
      expect(cache.get("key1")).toBe(200);
    });
  });

  describe("getOrSetAsync 方法", () => {
    it("缓存命中时应该返回resolved Promise", async () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(async () => 200);

      cache.set("key1", 100);
      const result = await cache.getOrSetAsync("key1", producer);

      expect(result).toBe(100);
      expect(producer).not.toHaveBeenCalled();
    });

    it("缓存未命中时应该调用异步生产者", async () => {
      const cache = new MemoryLRUCache<string, number>();
      const producer = vi.fn(async () => 200);

      const result = await cache.getOrSetAsync("key1", producer);

      expect(result).toBe(200);
      expect(producer).toHaveBeenCalledOnce();
      expect(cache.get("key1")).toBe(200);
    });

    it("应该支持并发去重", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let producerCallCount = 0;
      const producer = vi.fn(async () => {
        producerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 200;
      });

      // 同时发起多个相同键的请求
      const promises = [
        cache.getOrSetAsync("key1", producer),
        cache.getOrSetAsync("key1", producer),
        cache.getOrSetAsync("key1", producer),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual([200, 200, 200]);
      expect(producerCallCount).toBe(1); // 只调用一次生产者
    });

    it("可以禁用并发去重", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let producerCallCount = 0;
      const producer = vi.fn(async () => {
        producerCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 200;
      });

      // 禁用去重
      const promises = [
        cache.getOrSetAsync("key1", producer, { dedupe: false }),
        cache.getOrSetAsync("key1", producer, { dedupe: false }),
      ];

      await Promise.all(promises);
      expect(producerCallCount).toBe(2); // 调用两次生产者
    });

    it("应该支持超时", async () => {
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

  describe("统计信息", () => {
    it("应该正确跟踪缓存统计", () => {
      const cache = new MemoryLRUCache<string, number>({
        namespace: "test",
        maxEntries: 2,
        maxWeight: 100,
      });

      cache.set("key1", 100);
      cache.get("key1"); // 命中
      cache.get("key2"); // 未命中
      cache.set("key2", 200);
      cache.set("key3", 300); // 触发淘汰

      const info = cache.info();
      expect(info.namespace).toBe("test");
      expect(info.maxEntries).toBe(2);
      expect(info.maxWeight).toBe(100);
      expect(info.currentEntries).toBe(2);
      expect(info.hits).toBe(1);
      expect(info.misses).toBe(1);
      expect(info.evictions).toBe(1);
    });

    it("应该跟踪过期统计", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(1001);
      cache.get("key1"); // 触发过期

      const info = cache.info();
      expect(info.expirations).toBe(1);
    });
  });

  describe("回调和事件", () => {
    it("应该在淘汰时调用回调", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 1,
        onEvict,
      });

      cache.set("key1", 100);
      cache.set("key2", 200); // 触发淘汰

      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "key1",
          value: 100,
        }),
        "evict"
      );
    });

    it("应该在手动删除时调用回调", () => {
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

    it("应该在清空时调用回调", () => {
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

    it("应该在过期时调用回调", () => {
      const onEvict = vi.fn();
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
        onEvict,
      });

      cache.set("key1", 100, { ttl: 1000 });
      mockClock.advance(1001);
      cache.get("key1"); // 触发过期检查

      expect(onEvict).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "key1",
          value: 100,
        }),
        "expire"
      );
    });
  });

  describe("自定义键哈希", () => {
    it("应该支持自定义键哈希函数", () => {
      interface ComplexKey {
        id: number;
        type: string;
      }

      const keyHash = vi.fn((key: ComplexKey) => `${key.type}-${key.id}`);
      const cache = new MemoryLRUCache<ComplexKey, string>({ keyHash });

      const key1 = { id: 1, type: "user" };
      const key2 = { id: 1, type: "user" }; // 不同对象但相同内容

      cache.set(key1, "value1");
      expect(cache.get(key2)).toBe("value1"); // 应该能找到

      expect(keyHash).toHaveBeenCalledWith(key1);
      expect(keyHash).toHaveBeenCalledWith(key2);
    });
  });

  describe("边界情况", () => {
    it("应该处理空的maxEntries", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 0,
      });

      cache.set("key1", 100);
      expect(cache.size()).toBe(0); // 立即被淘汰
    });

    it("应该处理空的maxWeight", () => {
      const cache = new MemoryLRUCache<string, string>({
        maxWeight: 0,
        weigh: (_, value) => value.length,
      });

      cache.set("key1", "a");
      expect(cache.size()).toBe(0); // 立即被淘汰
    });

    it("应该正确处理标签清理", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1"] });
      cache.set("key2", 200, { tags: ["tag1"] });

      // 删除一个条目后，标签映射应该正确更新
      cache.delete("key1");
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1); // 只有key2被影响
    });

    it("应该在替换时正确处理标签", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1", "tag2"] });
      cache.set("key1", 200, { tags: ["tag3"] }); // 替换并更改标签

      // 旧标签应该不再有效
      expect(cache.invalidateByTag("tag1")).toBe(0);
      expect(cache.invalidateByTag("tag2")).toBe(0);

      // 新标签应该有效
      expect(cache.invalidateByTag("tag3")).toBe(1);
      expect(cache.has("key1")).toBe(false);
    });

    it("应该处理重复的标签", () => {
      const cache = new MemoryLRUCache<string, number>();

      cache.set("key1", 100, { tags: ["tag1", "tag1", "tag2"] });
      cache.addTags("key1", "tag2", "tag3", "tag3");

      // 验证标签去重
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1);
    });

    it("应该在has()检查时处理过期条目", () => {
      const cache = new MemoryLRUCache<string, number>({
        clock: mockClock,
      });

      cache.set("key1", 100, { ttl: 1000 });
      expect(cache.has("key1")).toBe(true);

      mockClock.advance(1001);
      expect(cache.has("key1")).toBe(false); // 应该触发过期并返回false
    });

    it("应该处理标签映射中的孤立引用", () => {
      const cache = new MemoryLRUCache<string, number>();

      // 创建一个有问题的内部状态，模拟标签映射中存在但实际条目不存在的情况
      cache.set("key1", 100, { tags: ["tag1"] });

      // 通过直接操作模拟孤立引用（这在正常使用中不会发生，但测试边界情况）
      const key2Hash = JSON.stringify("key2");

      // 获取内部标签映射并添加孤立引用
       
      const tagsMap = (cache as any).tags;
      const tag1Set = tagsMap.get("tag1");
      if (tag1Set) {
        tag1Set.add(key2Hash); // 添加一个不存在的条目引用
      }

      // 失效时应该清理孤立引用
      const count = cache.invalidateByTag("tag1");
      expect(count).toBe(1); // 只有key1被影响，key2的孤立引用被清理
    });
  });

  describe("内存和性能", () => {
    it("应该正确清理飞行中的Promise", async () => {
      const cache = new MemoryLRUCache<string, number>();
      let resolveProducer: (value: number) => void;

      const producer = vi.fn(
        () =>
          new Promise<number>((resolve) => {
            resolveProducer = resolve;
          })
      );

      const promise = cache.getOrSetAsync("key1", producer);

      // 解决Promise
      resolveProducer!(100);
      await promise;

      // 再次调用应该使用缓存值，而不是创建新的Promise
      const result = await cache.getOrSetAsync("key1", producer);
      expect(result).toBe(100);
      expect(producer).toHaveBeenCalledOnce();
    });

    it("大量操作后应该保持一致性", () => {
      const cache = new MemoryLRUCache<string, number>({
        maxEntries: 100,
      });

      // 添加大量条目
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, i);
      }

      expect(cache.size()).toBe(100);

      // 验证最新的100个条目存在
      for (let i = 900; i < 1000; i++) {
        expect(cache.has(`key${i}`)).toBe(true);
      }

      // 验证最旧的条目不存在
      for (let i = 0; i < 900; i++) {
        expect(cache.has(`key${i}`)).toBe(false);
      }
    });
  });
});
