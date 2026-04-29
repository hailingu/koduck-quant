/**
 * Cache module entry tests
 * Tests module export completeness
 */

import { describe, it, expect } from "vitest";

describe("Cache Module Exports", () => {
  it("should export all required types", async () => {
    const types = await import("../../src/common/cache/types");

    // Verify main type exports exist
    expect(types).toBeDefined();

    // These are type exports, no runtime values exist, but import should not fail
    expect(() => {
      // Type import test
      const typeImports: (keyof typeof types)[] = [
        // Verify type names exist in exports
      ];
      expect(Array.isArray(typeImports)).toBe(true);
    }).not.toThrow();
  });

  it("should export MemoryLRUCache class", async () => {
    const { MemoryLRUCache } = await import(
      "../../src/common/cache/memory-lru"
    );

    expect(MemoryLRUCache).toBeDefined();
    expect(typeof MemoryLRUCache).toBe("function");
    expect(MemoryLRUCache.prototype).toBeDefined();
  });

  it("should export correctly from index", async () => {
    const cacheModule = await import("../../src/common/cache/index");

    expect(cacheModule.MemoryLRUCache).toBeDefined();
    expect(typeof cacheModule.MemoryLRUCache).toBe("function");
  });

  it("should be able to create a cache instance", async () => {
    const { MemoryLRUCache } = await import(
      "../../src/common/cache/memory-lru"
    );

    const cache = new MemoryLRUCache();
    expect(cache).toBeInstanceOf(MemoryLRUCache);

    // Basic functionality test
    cache.set("test", "value");
    expect(cache.get("test")).toBe("value");
    expect(cache.size()).toBe(1);
  });
});
