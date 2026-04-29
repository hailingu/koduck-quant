import { describe, test, expect, beforeEach } from "vitest";
import { DedupeManager } from "../../src/common/event/dedupe-manager";
import type {
  EventConfiguration,
  PayloadDedupeConfig,
} from "../../src/common/event/types";

describe("DedupeManager", () => {
  let config: EventConfiguration;
  let dedupeManager: DedupeManager<unknown>;

  beforeEach(() => {
    config = {
      maxListeners: 100,
      enableBatching: false,
      batchSize: 10,
      batchInterval: 0,
      enableAutoOptimization: false,
      autoOptimizeThreshold: 1000,
      enableDebugMode: false,
      concurrencyMode: "parallel" as const,
      concurrencyLimit: 5,
    };
  });

  describe("Constructor and initialization", () => {
    test("should correctly initialize without deduplication", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });

    test("should correctly initialize with deduplication enabled", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(0);
    });
  });

  describe("Deduplication functionality", () => {
    test("should not drop any events when deduplication is disabled", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(false);
    });

    test("should correctly deduplicate when enabled", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // First time should not be dropped
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);

      // Second time with same data should be dropped
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // Different data should not be dropped
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(false);

      // New data same as before should be dropped
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(true);
    });

    test("should correctly handle complex object deduplication", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const obj1 = { id: 1, name: "test" };
      const obj2 = { id: 1, name: "test" }; // Same content
      const obj3 = { id: 2, name: "test" }; // Different content

      expect(dedupeManager.shouldDropByDedupe(obj1)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(obj2)).toBe(true); // Should be deduplicated
      expect(dedupeManager.shouldDropByDedupe(obj3)).toBe(false);
    });

    test("should support custom key generation function", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: (data: unknown) =>
          (data as { id?: number }).id?.toString() || "default",
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const obj1 = { id: 1, name: "first" };
      const obj2 = { id: 1, name: "second" }; // Different name but same ID
      const obj3 = { id: 2, name: "first" }; // Different ID

      expect(dedupeManager.shouldDropByDedupe(obj1)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(obj2)).toBe(true); // Same ID, should be deduplicated
      expect(dedupeManager.shouldDropByDedupe(obj3)).toBe(false); // Different ID
    });

    test("should handle key generation function errors", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => {
          throw new Error("Key generation error");
        },
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Events should not be dropped when key generation fails
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
    });

    test("should handle circular reference objects", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      const circular: { id: number; self?: unknown } = { id: 1 };
      circular.self = circular; // Create circular reference

      // JSON.stringify will fail, should not drop
      expect(dedupeManager.shouldDropByDedupe(circular)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(circular)).toBe(false);
    });
  });

  describe("Configuration updates", () => {
    test("should rebuild cache when deduplication is enabled", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      // Initial state not enabled
      expect(dedupeManager.getCacheStats().enabled).toBe(false);

      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const newConfig = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager.updateConfiguration(newConfig);

      // Should be enabled after update
      expect(dedupeManager.getCacheStats().enabled).toBe(true);
    });

    test("should clear cache when deduplication is disabled", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Add some data
      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.getCacheStats().enabled).toBe(true);

      // Disable deduplication
      const newConfig = { ...config };
      dedupeManager.updateConfiguration(newConfig);

      expect(dedupeManager.getCacheStats().enabled).toBe(false);
    });

    test("should rebuild cache when TTL changes", () => {
      const dedupeConfig1: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe1 = { ...config, payloadDedupe: dedupeConfig1 };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe1);

      // Add data
      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // Change TTL
      const dedupeConfig2: PayloadDedupeConfig = {
        enabled: true,
        ttl: 2000,
        maxEntries: 100,
      };

      const configWithDedupe2 = { ...config, payloadDedupe: dedupeConfig2 };
      dedupeManager.updateConfiguration(configWithDedupe2);

      // Cache should be rebuilt, previous data should be lost
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("should rebuild cache when maxEntries changes", () => {
      const dedupeConfig1: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe1 = { ...config, payloadDedupe: dedupeConfig1 };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe1);

      dedupeManager.shouldDropByDedupe("data1");

      // Change maxEntries
      const dedupeConfig2: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 200,
      };

      const configWithDedupe2 = { ...config, payloadDedupe: dedupeConfig2 };
      dedupeManager.updateConfiguration(configWithDedupe2);

      // Cache should be rebuilt
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("should not rebuild cache when configuration is unchanged", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      dedupeManager.shouldDropByDedupe("data1");
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);

      // Update with same configuration
      dedupeManager.updateConfiguration(configWithDedupe);

      // Cache should be retained
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(true);
    });
  });

  describe("Cache statistics", () => {
    test("should return correct cache statistics", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      let stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(0);

      // Add some data
      dedupeManager.shouldDropByDedupe("data1");
      dedupeManager.shouldDropByDedupe("data2");

      stats = dedupeManager.getCacheStats();
      expect(stats.size).toBe(2);
    });

    test("should return correct statistics when disabled", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      const stats = dedupeManager.getCacheStats();
      expect(stats.enabled).toBe(false);
      expect(stats.size).toBe(0);
    });
  });

  describe("Cleanup functionality", () => {
    test("should be able to clear cache", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Add data
      dedupeManager.shouldDropByDedupe("data1");
      dedupeManager.shouldDropByDedupe("data2");

      expect(dedupeManager.getCacheStats().size).toBe(2);

      // Cleanup
      dedupeManager.clear();

      expect(dedupeManager.getCacheStats().size).toBe(0);

      // Previous data should no longer be deduplicated
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
    });

    test("should handle cleanup in disabled state", () => {
      dedupeManager = new DedupeManager("TestEvent", config);

      // Should not throw an error
      expect(() => {
        dedupeManager.clear();
      }).not.toThrow();
    });
  });

  describe("Edge cases", () => {
    test("should handle undefined and null data", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // JSON.stringify(undefined) returns undefined, not a valid string key
      // So undefined should never be deduplicated
      expect(dedupeManager.shouldDropByDedupe(undefined)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(undefined)).toBe(false);

      // JSON.stringify(null) returns "null", which is a valid key
      expect(dedupeManager.shouldDropByDedupe(null)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(null)).toBe(true);
    });

    test("should handle numbers and booleans", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      expect(dedupeManager.shouldDropByDedupe(42)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(42)).toBe(true);

      expect(dedupeManager.shouldDropByDedupe(true)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(true)).toBe(true);

      expect(dedupeManager.shouldDropByDedupe(false)).toBe(false);
      expect(dedupeManager.shouldDropByDedupe(false)).toBe(true);
    });

    test("should use default maxEntries value", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        // Not specifying maxEntries, should use default value 1000
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Should work normally
      expect(dedupeManager.shouldDropByDedupe("test")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("test")).toBe(true);
    });

    test("should handle custom key returning undefined", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => undefined as unknown as string,
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Should not deduplicate when key is undefined
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data")).toBe(false);
    });

    test("should handle empty string keys", () => {
      const dedupeConfig: PayloadDedupeConfig = {
        enabled: true,
        ttl: 1000,
        maxEntries: 100,
        key: () => "",
      };

      const configWithDedupe = { ...config, payloadDedupe: dedupeConfig };
      dedupeManager = new DedupeManager("TestEvent", configWithDedupe);

      // Empty string keys should work normally
      expect(dedupeManager.shouldDropByDedupe("data1")).toBe(false);
      expect(dedupeManager.shouldDropByDedupe("data2")).toBe(true); // Same key, should deduplicate
    });
  });
});
