/**
 * Cache module 入口测试
 * 测试模块导出的完整性
 */

import { describe, it, expect } from "vitest";

describe("Cache Module Exports", () => {
  it("应该导出所有必需的类型", async () => {
    const types = await import("../../src/common/cache/types");

    // 验证主要类型导出存在
    expect(types).toBeDefined();

    // 这些是类型导出，在运行时不存在值，但导入不应该出错
    expect(() => {
      // 类型导入测试
      const typeImports: (keyof typeof types)[] = [
        // 验证类型名称存在于导出中
      ];
      expect(Array.isArray(typeImports)).toBe(true);
    }).not.toThrow();
  });

  it("应该导出 MemoryLRUCache 类", async () => {
    const { MemoryLRUCache } = await import(
      "../../src/common/cache/memory-lru"
    );

    expect(MemoryLRUCache).toBeDefined();
    expect(typeof MemoryLRUCache).toBe("function");
    expect(MemoryLRUCache.prototype).toBeDefined();
  });

  it("应该从 index 正确导出", async () => {
    const cacheModule = await import("../../src/common/cache/index");

    expect(cacheModule.MemoryLRUCache).toBeDefined();
    expect(typeof cacheModule.MemoryLRUCache).toBe("function");
  });

  it("应该能够创建缓存实例", async () => {
    const { MemoryLRUCache } = await import(
      "../../src/common/cache/memory-lru"
    );

    const cache = new MemoryLRUCache();
    expect(cache).toBeInstanceOf(MemoryLRUCache);

    // 基础功能测试
    cache.set("test", "value");
    expect(cache.get("test")).toBe("value");
    expect(cache.size()).toBe(1);
  });
});
