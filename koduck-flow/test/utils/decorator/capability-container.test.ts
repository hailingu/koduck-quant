import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  DefaultCapabilityProvider,
  DefaultCapabilityCache,
  CapabilityContainerUtils,
  DefaultCapabilityExecutor,
  CapabilityManager,
} from "../../../src/utils/decorator/capability-container";

describe("Capability Container", () => {
  describe("DefaultCapabilityProvider", () => {
    let provider: DefaultCapabilityProvider;

    beforeEach(() => {
      provider = new DefaultCapabilityProvider();
    });

    describe("constructor", () => {
      it("should create empty provider", () => {
        expect(provider.all()).toEqual([]);
        expect(provider.has("test")).toBe(false);
      });

      it("should initialize with capabilities", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        const providerWithCaps = new DefaultCapabilityProvider([cap1, cap2]);

        expect(providerWithCaps.all()).toHaveLength(2);
        expect(providerWithCaps.has("cap1")).toBe(true);
        expect(providerWithCaps.has("cap2")).toBe(true);
      });
    });

    describe("all", () => {
      it("should return all capabilities", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        provider.add(cap1).add(cap2);

        const all = provider.all();
        expect(all).toHaveLength(2);
        expect(all).toContain(cap1);
        expect(all).toContain(cap2);
      });

      it("should return copy of capabilities", () => {
        const cap = { name: "cap", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        const all1 = provider.all();
        const all2 = provider.all();

        expect(all1).not.toBe(all2); // Different references
        expect(all1).toEqual(all2); // Same content
      });
    });

    describe("get", () => {
      it("should return capability by name", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        expect(provider.get("test")).toBe(cap);
      });

      it("should return undefined for non-existent capability", () => {
        expect(provider.get("nonexistent")).toBeUndefined();
      });
    });

    describe("has", () => {
      it("should return true for existing capability", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        expect(provider.has("test")).toBe(true);
      });

      it("should return false for non-existent capability", () => {
        expect(provider.has("nonexistent")).toBe(false);
      });
    });

    describe("add", () => {
      it("should add capability and return this", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };

        const result = provider.add(cap);

        expect(result).toBe(provider);
        expect(provider.has("test")).toBe(true);
        expect(provider.get("test")).toBe(cap);
      });

      it("should overwrite existing capability with same name", () => {
        const cap1 = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "test", canHandle: vi.fn(), execute: vi.fn() };

        provider.add(cap1);
        provider.add(cap2);

        expect(provider.get("test")).toBe(cap2);
        expect(provider.all()).toHaveLength(1);
      });
    });

    describe("remove", () => {
      it("should remove capability and return this", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        const result = provider.remove("test");

        expect(result).toBe(provider);
        expect(provider.has("test")).toBe(false);
        expect(provider.get("test")).toBeUndefined();
      });

      it("should do nothing for non-existent capability", () => {
        const cap = { name: "existing", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        provider.remove("nonexistent");

        expect(provider.has("existing")).toBe(true);
      });
    });

    describe("batch", () => {
      it("should perform batch add operations", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        provider.batch([
          { type: "add", capability: cap1 },
          { type: "add", capability: cap2 },
        ]);

        expect(provider.has("cap1")).toBe(true);
        expect(provider.has("cap2")).toBe(true);
      });

      it("should perform batch remove operations", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap1).add(cap2);

        provider.batch([
          { type: "remove", name: "cap1" },
          { type: "remove", name: "cap2" },
        ]);

        expect(provider.has("cap1")).toBe(false);
        expect(provider.has("cap2")).toBe(false);
      });

      it("should handle mixed operations", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };
        const cap3 = { name: "cap3", canHandle: vi.fn(), execute: vi.fn() };

        provider.add(cap1).add(cap2);

        provider.batch([
          { type: "remove", name: "cap1" },
          { type: "add", capability: cap3 },
        ]);

        expect(provider.has("cap1")).toBe(false);
        expect(provider.has("cap2")).toBe(true);
        expect(provider.has("cap3")).toBe(true);
      });

      it("should handle empty batch", () => {
        const cap = { name: "cap", canHandle: vi.fn(), execute: vi.fn() };
        provider.add(cap);

        provider.batch([]);

        expect(provider.has("cap")).toBe(true);
      });
    });
  });

  describe("DefaultCapabilityCache", () => {
    let cache: DefaultCapabilityCache;

    beforeEach(() => {
      vi.useFakeTimers();
      cache = new DefaultCapabilityCache();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("setCapability", () => {
      it("should store capability with key", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };

        cache.setCapability("key", cap);

        expect(cache.getCapability("key")).toBe(cap);
      });

      it("should overwrite existing capability", () => {
        const cap1 = { name: "test1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "test2", canHandle: vi.fn(), execute: vi.fn() };

        cache.setCapability("key", cap1);
        cache.setCapability("key", cap2);

        expect(cache.getCapability("key")).toBe(cap2);
      });
    });

    describe("getCapability", () => {
      it("should return stored capability", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap);

        expect(cache.getCapability("key")).toBe(cap);
      });

      it("should return undefined for non-existent key", () => {
        expect(cache.getCapability("nonexistent")).toBeUndefined();
      });
    });

    describe("setCapabilities", () => {
      it("should set multiple capabilities", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        cache.setCapabilities([
          { name: "key1", capability: cap1 },
          { name: "key2", capability: cap2 },
        ]);

        expect(cache.getCapability("key1")).toBe(cap1);
        expect(cache.getCapability("key2")).toBe(cap2);
      });
    });

    describe("clear", () => {
      it("should remove all capabilities", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap);

        cache.clear();

        expect(cache.getCapability("key")).toBeUndefined();
      });
    });

    describe("getStats", () => {
      it("should return cache statistics", () => {
        const stats = cache.getStats();

        expect(stats).toHaveProperty("size");
        expect(stats).toHaveProperty("hitRate");
        expect(stats).toHaveProperty("missRate");
        expect(stats).toHaveProperty("expiredCount");
        expect(stats).toHaveProperty("averageAccessTime");
      });

      it("should track hits and misses", () => {
        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap);

        // Miss
        cache.getCapability("nonexistent");
        // Hit
        cache.getCapability("key");

        const stats = cache.getStats();
        expect(stats.hitRate).toBe(0.5);
        expect(stats.missRate).toBe(0.5);
        expect(stats.expiredCount).toBe(0);
      });
    });

    describe("TTL functionality", () => {
      it("should expire capabilities after TTL", () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap, 1000);

        expect(cache.getCapability("key")).toBe(cap);

        vi.setSystemTime(startTime + 1001); // Just over the TTL

        expect(cache.getCapability("key")).toBeUndefined();
      });

      it("should not expire capabilities without TTL", () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap);

        vi.setSystemTime(startTime + 10000);

        expect(cache.getCapability("key")).toBe(cap);
      });

      it("should handle multiple TTL capabilities", () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        cache.setCapability("key1", cap1, 1000);
        cache.setCapability("key2", cap2, 2000);

        vi.setSystemTime(startTime + 1500);

        expect(cache.getCapability("key1")).toBeUndefined();
        expect(cache.getCapability("key2")).toBe(cap2);
      });
    });

    describe("cleanup", () => {
      it("should remove expired capabilities", () => {
        const startTime = Date.now();
        vi.setSystemTime(startTime);

        const cap = { name: "test", canHandle: vi.fn(), execute: vi.fn() };
        cache.setCapability("key", cap, 1000);

        vi.setSystemTime(startTime + 500);
        cache.cleanup(); // Should not remove yet

        expect(cache.getCapability("key")).toBe(cap);

        vi.setSystemTime(startTime + 1100);
        cache.cleanup(); // Should remove now

        expect(cache.getCapability("key")).toBeUndefined();
      });
    });
  });

  describe("CapabilityContainerUtils", () => {
    beforeEach(() => {
      // Clear static cache before each test
      CapabilityContainerUtils.clearCache();
    });

    describe("hasCapability", () => {
      it("should return true when container has capability", () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn(),
          execute: vi.fn(),
        };
        const container = {
          capabilities: [mockCapability],
        };

        expect(CapabilityContainerUtils.hasCapability(container, "cap1")).toBe(
          true
        );
      });

      it("should return false when container does not have capability", () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn(),
          execute: vi.fn(),
        };
        const container = {
          capabilities: [mockCapability],
        };

        expect(CapabilityContainerUtils.hasCapability(container, "cap2")).toBe(
          false
        );
      });

      it("should return false for empty container", () => {
        const container = {};

        expect(CapabilityContainerUtils.hasCapability(container, "cap1")).toBe(
          false
        );
      });

      it("should return false for container without capabilities", () => {
        const container = {
          capabilities: undefined,
        };

        expect(CapabilityContainerUtils.hasCapability(container, "cap1")).toBe(
          false
        );
      });
    });

    describe("executeCapability", () => {
      it("should execute capability from container", async () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi.fn().mockResolvedValue("result"),
        };
        const container = {
          capabilities: [mockCapability],
        };

        const result = await CapabilityContainerUtils.executeCapability(
          container,
          "cap1",
          "arg"
        );

        expect(result).toBe("result");
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg");
      });

      it("should return undefined when capability not found", async () => {
        const container = {
          capabilities: [],
        };

        const result = await CapabilityContainerUtils.executeCapability(
          container,
          "cap1",
          "arg"
        );

        expect(result).toBeUndefined();
      });

      it("should return undefined when capability cannot handle args", async () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn().mockReturnValue(false),
          execute: vi.fn().mockResolvedValue("result"),
        };
        const container = {
          capabilities: [mockCapability],
        };

        const result = await CapabilityContainerUtils.executeCapability(
          container,
          "cap1",
          "arg"
        );

        expect(result).toBeUndefined();
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg");
        expect(mockCapability.execute).not.toHaveBeenCalled();
      });

      it("should handle execution errors", async () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi.fn().mockRejectedValue(new Error("Execution failed")),
        };
        const container = {
          capabilities: [mockCapability],
        };

        const result = await CapabilityContainerUtils.executeCapability(
          container,
          "cap1",
          "arg"
        );

        expect(result).toBeUndefined();
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg");
      });
    });

    describe("createFluentProvider", () => {
      it("should create provider from container", () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn(),
          execute: vi.fn(),
        };
        const container = {
          capabilities: [mockCapability],
        };

        const provider =
          CapabilityContainerUtils.createFluentProvider(container);

        expect(provider.has("cap1")).toBe(true);
        expect(provider.get("cap1")).toBe(mockCapability);
      });

      it("should handle container without capabilities", () => {
        const container = {};

        const provider =
          CapabilityContainerUtils.createFluentProvider(container);

        expect(provider.all()).toEqual([]);
      });
    });

    describe("extractCapabilities", () => {
      it("should extract capabilities from container", () => {
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn(),
          execute: vi.fn(),
        };
        const container = {
          capabilities: [mockCapability],
        };

        const capabilities =
          CapabilityContainerUtils.extractCapabilities(container);

        expect(capabilities).toEqual([mockCapability]);
      });

      it("should return empty array for container without capabilities", () => {
        const container = {};

        const capabilities =
          CapabilityContainerUtils.extractCapabilities(container);

        expect(capabilities).toEqual([]);
      });
    });

    describe("mergeContainers", () => {
      it("should merge multiple containers", () => {
        const cap1 = { name: "cap1", canHandle: vi.fn(), execute: vi.fn() };
        const cap2 = { name: "cap2", canHandle: vi.fn(), execute: vi.fn() };

        const container1 = { capabilities: [cap1] };
        const container2 = { capabilities: [cap2] };

        const merged = CapabilityContainerUtils.mergeContainers(
          container1,
          container2
        );

        expect(merged.capabilities).toHaveLength(2);
        expect(merged.capabilities).toContain(cap1);
        expect(merged.capabilities).toContain(cap2);
      });

      it("should merge configs", () => {
        const container1 = { config: { key1: "value1" } };
        const container2 = { config: { key2: "value2" } };

        const merged = CapabilityContainerUtils.mergeContainers(
          container1,
          container2
        );

        expect(merged.config).toEqual({
          key1: "value1",
          key2: "value2",
        });
      });

      it("should handle empty containers", () => {
        const merged = CapabilityContainerUtils.mergeContainers({}, {});

        expect(merged.capabilities).toBeUndefined();
        expect(merged.config).toBeUndefined();
      });
    });

    describe("getCacheStats", () => {
      it("should return cache statistics", () => {
        const stats = CapabilityContainerUtils.getCacheStats();

        expect(stats).toHaveProperty("size");
        expect(stats).toHaveProperty("hitRate");
        expect(stats).toHaveProperty("missRate");
        expect(stats).toHaveProperty("expiredCount");
        expect(stats).toHaveProperty("averageAccessTime");
      });
    });

    describe("clearCache", () => {
      it("should clear the cache", () => {
        // First add something to cache
        const mockCapability = {
          name: "cap1",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi.fn().mockResolvedValue("result"),
        };
        const container = {
          capabilities: [mockCapability],
        };

        // Execute to populate cache
        CapabilityContainerUtils.executeCapability(container, "cap1", "arg");

        let stats = CapabilityContainerUtils.getCacheStats();
        expect(stats.size).toBeGreaterThan(0);

        CapabilityContainerUtils.clearCache();

        stats = CapabilityContainerUtils.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });
  });

  describe("DefaultCapabilityExecutor", () => {
    let provider: DefaultCapabilityProvider;
    let cache: DefaultCapabilityCache;
    let executor: DefaultCapabilityExecutor;
    let mockCapability: {
      name: string;
      canHandle: ReturnType<typeof vi.fn>;
      execute: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      provider = new DefaultCapabilityProvider();
      cache = new DefaultCapabilityCache();
      executor = new DefaultCapabilityExecutor(provider, cache);

      mockCapability = {
        name: "testCapability",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue("result"),
      };

      provider.add(mockCapability);
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("constructor", () => {
      it("should create executor with provider and cache", () => {
        const newProvider = new DefaultCapabilityProvider();
        const newCache = new DefaultCapabilityCache();
        const newExecutor = new DefaultCapabilityExecutor(
          newProvider,
          newCache
        );

        expect(newExecutor).toBeDefined();
      });

      it("should create executor with default cache when not provided", () => {
        const newProvider = new DefaultCapabilityProvider();
        const newExecutor = new DefaultCapabilityExecutor(newProvider);

        expect(newExecutor).toBeDefined();
      });
    });

    describe("execute", () => {
      it("should execute capability synchronously", () => {
        mockCapability.execute.mockReturnValue("sync result");

        const result = executor.execute("testCapability", "arg1", "arg2");

        expect(result).toBe("sync result");
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg1", "arg2");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg1", "arg2");
      });

      it("should return undefined when capability not found", () => {
        const result = executor.execute("nonexistent");

        expect(result).toBeUndefined();
      });

      it("should return undefined when capability cannot handle args", () => {
        mockCapability.canHandle.mockReturnValue(false);

        const result = executor.execute("testCapability", "arg");

        expect(result).toBeUndefined();
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg");
        expect(mockCapability.execute).not.toHaveBeenCalled();
      });

      it("should return undefined when async capability is executed synchronously", async () => {
        mockCapability.execute.mockResolvedValue("async result");

        const result = executor.execute("testCapability");

        expect(result).toBeUndefined();
        expect(mockCapability.canHandle).toHaveBeenCalled();
        expect(mockCapability.execute).toHaveBeenCalled();
      });

      it("should handle execution errors gracefully", () => {
        mockCapability.execute.mockImplementation(() => {
          throw new Error("Execution failed");
        });

        const result = executor.execute("testCapability");

        expect(result).toBeUndefined();
      });
    });

    describe("executeAsync", () => {
      it("should execute capability asynchronously", async () => {
        const result = await executor.executeAsync("testCapability", "arg1");

        expect(result).toBe("result");
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg1");
        expect(mockCapability.execute).toHaveBeenCalledWith("arg1");
      });

      it("should return undefined when capability not found", async () => {
        const result = await executor.executeAsync("nonexistent");

        expect(result).toBeUndefined();
      });

      it("should return undefined when capability cannot handle args", async () => {
        mockCapability.canHandle.mockReturnValue(false);

        const result = await executor.executeAsync("testCapability", "arg");

        expect(result).toBeUndefined();
        expect(mockCapability.canHandle).toHaveBeenCalledWith("arg");
        expect(mockCapability.execute).not.toHaveBeenCalled();
      });

      it("should handle execution errors gracefully", async () => {
        mockCapability.execute.mockRejectedValue(
          new Error("Async execution failed")
        );

        const result = await executor.executeAsync("testCapability");

        expect(result).toBeUndefined();
      });
    });

    describe("executeBatch", () => {
      it("should execute multiple capabilities in batch", async () => {
        const operations = [
          { capability: "testCapability", args: ["arg1"] },
          { capability: "testCapability", args: ["arg2"] },
        ];

        const results = await executor.executeBatch(operations);

        expect(results).toHaveLength(2);
        expect(results[0]).toEqual({
          capability: "testCapability",
          success: true,
          result: "result",
        });
        expect(results[1]).toEqual({
          capability: "testCapability",
          success: true,
          result: "result",
        });
      });

      it("should handle mixed success and failure in batch", async () => {
        // Clear cache to ensure nonexistent capability is not found
        cache.clear();

        const operations = [
          { capability: "testCapability", args: ["arg1"] },
          { capability: "nonexistent", args: [] },
        ];

        const results = await executor.executeBatch(operations);

        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[0].result).toBe("result");
        expect(results[1].success).toBe(true); // executeAsync returns undefined, not throws
        expect(results[1].result).toBeUndefined();
      });

      it("should handle execution errors in batch", async () => {
        mockCapability.execute.mockRejectedValueOnce(
          new Error("Batch execution failed")
        );

        const operations = [{ capability: "testCapability", args: [] }];

        const results = await executor.executeBatch(operations);

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true); // executeAsync catches errors and returns undefined
        expect(results[0].result).toBeUndefined();
      });
    });

    describe("executeIf", () => {
      it("should execute when condition is met", async () => {
        const condition = vi.fn().mockReturnValue(true);

        const result = await executor.executeIf(
          condition,
          "testCapability",
          "arg"
        );

        expect(result).toEqual({
          capability: "testCapability",
          success: true,
          result: "result",
        });
        expect(condition).toHaveBeenCalledWith(mockCapability);
      });

      it("should not execute when condition is not met", async () => {
        const condition = vi.fn().mockReturnValue(false);

        const result = await executor.executeIf(
          condition,
          "testCapability",
          "arg"
        );

        expect(result).toBeUndefined();
        expect(condition).toHaveBeenCalledWith(mockCapability);
        expect(mockCapability.execute).not.toHaveBeenCalled();
      });

      it("should return undefined when capability not found", async () => {
        const condition = vi.fn().mockReturnValue(true);

        const result = await executor.executeIf(condition, "nonexistent");

        expect(result).toBeUndefined();
        expect(condition).not.toHaveBeenCalled();
      });

      it("should handle execution errors", async () => {
        const condition = vi.fn().mockReturnValue(true);
        mockCapability.execute.mockRejectedValue(new Error("Execution failed"));

        const result = await executor.executeIf(condition, "testCapability");

        expect(result).toEqual({
          capability: "testCapability",
          success: false,
          error: expect.any(Error),
        });
      });
    });

    describe("executeWithRetry", () => {
      let failingCapability: {
        name: string;
        canHandle: ReturnType<typeof vi.fn>;
        execute: ReturnType<typeof vi.fn>;
      };

      beforeEach(() => {
        failingCapability = {
          name: "failingCapability",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi.fn(),
        };
        provider.add(failingCapability);
      });

      it("should execute successfully on first attempt", async () => {
        failingCapability.execute.mockResolvedValue("success");

        const result = await executor.executeWithRetry(
          "failingCapability",
          3,
          "arg"
        );

        expect(result).toBe("success");
        expect(failingCapability.execute).toHaveBeenCalledTimes(1);
      });

      it("should retry on failure and succeed", async () => {
        failingCapability.execute
          .mockRejectedValueOnce(new Error("First attempt failed"))
          .mockResolvedValueOnce("success on retry");

        const result = await executor.executeWithRetry(
          "failingCapability",
          3,
          "arg"
        );

        expect(result).toBe("success on retry");
        expect(failingCapability.execute).toHaveBeenCalledTimes(2);
      });

      it("should exhaust retries and return undefined", async () => {
        failingCapability.execute.mockRejectedValue(new Error("Always fails"));

        const result = await executor.executeWithRetry(
          "failingCapability",
          2,
          "arg"
        );

        expect(result).toBeUndefined();
        expect(failingCapability.execute).toHaveBeenCalledTimes(3); // initial + 2 retries
      });

      it("should return undefined when capability not found", async () => {
        const result = await executor.executeWithRetry("nonexistent", 3);

        expect(result).toBeUndefined();
      });
    });

    describe("executeWithTimeout", () => {
      it("should execute successfully within timeout", async () => {
        const result = await executor.executeWithTimeout(
          "testCapability",
          1000,
          "arg"
        );

        expect(result).toBe("result");
        expect(mockCapability.execute).toHaveBeenCalledTimes(1);
      });

      it.skip("should timeout and return undefined", async () => {
        // Create a capability that takes longer than timeout
        const slowCapability = {
          name: "slowCapability",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi
            .fn()
            .mockImplementation(
              () =>
                new Promise((resolve) =>
                  setTimeout(() => resolve("too late"), 100)
                )
            ),
        };
        provider.add(slowCapability);

        const result = await executor.executeWithTimeout("slowCapability", 50);

        expect(result).toBeUndefined();
      }, 200);

      it("should return undefined when capability not found", async () => {
        const result = await executor.executeWithTimeout("nonexistent", 1000);

        expect(result).toBeUndefined();
      });
    });

    describe("getExecutionStats", () => {
      it("should return execution statistics", async () => {
        // Add some delay to ensure measurable execution time
        mockCapability.execute.mockImplementation(async () => {
          // Simulate some work without actual delay
          return "result";
        });

        await executor.executeAsync("testCapability", "arg1");
        await executor.executeAsync("testCapability", "arg2");

        const stats = executor.getExecutionStats();

        expect(stats).toHaveLength(1);
        expect(stats[0]).toEqual({
          name: "testCapability",
          count: 2,
          avgTime: expect.any(Number),
        });
        // Allow for some variance in timing
        expect(stats[0].avgTime).toBeGreaterThanOrEqual(0);
      }, 200); // Increase timeout for this test

      it("should return empty array when no executions", () => {
        const stats = executor.getExecutionStats();

        expect(stats).toEqual([]);
      });
    });
  });

  describe("CapabilityManager", () => {
    let manager: CapabilityManager;
    let mockCapability: {
      name: string;
      canHandle: ReturnType<typeof vi.fn>;
      execute: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      manager = new CapabilityManager();
      mockCapability = {
        name: "testCapability",
        canHandle: vi.fn().mockReturnValue(true),
        execute: vi.fn().mockResolvedValue("result"),
      };
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    describe("constructor", () => {
      it("should create manager with default config", () => {
        const newManager = new CapabilityManager();

        expect(newManager.provider).toBeDefined();
        expect(newManager.executor).toBeDefined();
        expect(newManager.cache).toBeDefined();
      });

      it("should create manager with custom config", () => {
        const config = {
          cache: { enabled: false },
          execution: { defaultTimeoutMs: 10000 },
        };

        const newManager = new CapabilityManager(config);

        expect(newManager).toBeDefined();
      });
    });

    describe("registerCapability", () => {
      it("should register single capability and return this", () => {
        const result = manager.registerCapability(mockCapability);

        expect(result).toBe(manager);
        expect(manager.provider.has("testCapability")).toBe(true);
      });
    });

    describe("registerCapabilities", () => {
      it("should register multiple capabilities", () => {
        const cap1 = { ...mockCapability, name: "cap1" };
        const cap2 = { ...mockCapability, name: "cap2" };

        manager.registerCapabilities([cap1, cap2]);

        expect(manager.provider.has("cap1")).toBe(true);
        expect(manager.provider.has("cap2")).toBe(true);
      });
    });

    describe("smartExecute", () => {
      beforeEach(() => {
        manager.registerCapability(mockCapability);
      });

      it("should execute with default options", async () => {
        const result = await manager.smartExecute("testCapability", {}, "arg");

        expect(result).toBe("result");
      });

      it("should execute with custom timeout", async () => {
        const result = await manager.smartExecute(
          "testCapability",
          { timeout: 2000 },
          "arg"
        );

        expect(result).toBe("result");
      });

      it("should execute with retries", async () => {
        const failingCap = {
          name: "failingCap",
          canHandle: vi.fn().mockReturnValue(true),
          execute: vi
            .fn()
            .mockRejectedValueOnce(new Error("First attempt failed"))
            .mockResolvedValueOnce("success after retry"),
        };
        manager.registerCapability(failingCap);

        const result = await manager.smartExecute(
          "failingCap",
          { retries: 1 },
          "arg"
        );

        expect(result).toBe("success after retry");
        expect(failingCap.execute).toHaveBeenCalledTimes(2);
      });

      it("should execute with condition", async () => {
        const condition = vi.fn().mockReturnValue(true);

        const result = await manager.smartExecute(
          "testCapability",
          { condition },
          "arg"
        );

        expect(result).toBe("result");
        expect(condition).toHaveBeenCalledWith(mockCapability);
      });

      it("should return undefined when condition not met", async () => {
        const condition = vi.fn().mockReturnValue(false);

        const result = await manager.smartExecute(
          "testCapability",
          { condition },
          "arg"
        );

        expect(result).toBeUndefined();
        expect(mockCapability.execute).not.toHaveBeenCalled();
      });

      it("should return undefined when capability not found", async () => {
        const result = await manager.smartExecute("nonexistent");

        expect(result).toBeUndefined();
      });
    });

    describe("getPerformanceReport", () => {
      beforeEach(async () => {
        manager.registerCapability(mockCapability);
        // Add minimal delay to ensure measurable execution time
        mockCapability.execute.mockImplementation(async () => {
          // Simulate some work without actual delay
          return "result";
        });
        await manager.smartExecute("testCapability", {}, "arg1");
        await manager.smartExecute("testCapability", {}, "arg2");
      });

      it("should return performance report", () => {
        const report = manager.getPerformanceReport();

        expect(report).toEqual({
          totalCapabilities: 1,
          totalExecutions: 2,
          averageExecutionTime: expect.any(Number),
          cacheStats: expect.any(Object),
          topPerformers: expect.any(Array),
        });
        expect(report.averageExecutionTime).toBeGreaterThanOrEqual(0);
        expect(report.topPerformers).toHaveLength(1);
      });
    });

    describe("healthCheck", () => {
      it("should return healthy status when everything is fine", async () => {
        manager.registerCapability(mockCapability);

        // Execute multiple times to build cache hits
        await manager.smartExecute("testCapability", {}, "arg1");
        await manager.smartExecute("testCapability", {}, "arg1"); // Cache hit
        await manager.smartExecute("testCapability", {}, "arg1"); // Cache hit
        await manager.smartExecute("testCapability", {}, "arg1"); // Cache hit
        await manager.smartExecute("testCapability", {}, "arg1"); // Cache hit

        const health = manager.healthCheck();

        expect(health.status).toBe("healthy");
        expect(health.issues).toEqual([]);
        expect(health.recommendations).toEqual([]);
      });

      it("should return unhealthy status when no capabilities", () => {
        const health = manager.healthCheck();

        expect(health.status).toBe("degraded");
        expect(health.issues).toContain("No capabilities registered");
        expect(health.recommendations).toContain(
          "Register at least one capability to enable functionality"
        );
      });

      it("should detect cache issues", () => {
        manager.registerCapability(mockCapability);

        // Manually set cache stats to simulate poor performance
        const cacheInstance = manager.cache as unknown as {
          hits: number;
          misses: number;
        };
        cacheInstance.hits = 1;
        cacheInstance.misses = 9;

        const health = manager.healthCheck();

        expect(health.status).toBe("degraded");
        expect(
          health.issues.some((issue: string) =>
            issue.includes("cache hit rate")
          )
        ).toBe(true);
      });
    });
  });
});
