/**
 * Global metrics registry tests
 * Tests the functionality of the global metrics registry
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  GlobalMetrics,
  meter,
  collect,
  setMetricsProvider,
  getMetricsProvider,
} from "../../src/common/metrics/global";
import { NoopMetricsProvider } from "../../src/common/metrics/noop";
import type { MetricsProvider, Meter } from "../../src/common/metrics/types";

// Create a mock MetricsProvider for testing
class MockMetricsProvider implements MetricsProvider {
  private meters = new Map<string, Meter>();
  public collectCalled = false;
  public shutdownCalled = false;

  getMeter(scope: string): Meter {
    if (!this.meters.has(scope)) {
      const mockMeter: Meter = {
        counter: () => ({ add: () => {} }),
        upDownCounter: () => ({ add: () => {} }),
        gauge: () => ({ set: () => {} }),
        histogram: () => ({ record: () => {} }),
        observableGauge: () => ({
          addCallback: () => {},
          removeCallback: () => {},
        }),
        time: async (name, fn) => await fn(),
        collect: () => {
          this.collectCalled = true;
        },
      };
      this.meters.set(scope, mockMeter);
    }
    return this.meters.get(scope)!;
  }

  collect(): void {
    this.collectCalled = true;
  }

  shutdown(): void {
    this.shutdownCalled = true;
  }

  snapshot() {
    return { meters: [] };
  }
}

describe("Global Metrics Registry", () => {
  let mockProvider: MockMetricsProvider;

  beforeEach(() => {
    mockProvider = new MockMetricsProvider();
    // Reset to default NoopMetricsProvider
    setMetricsProvider(new NoopMetricsProvider());
  });

  describe("GlobalMetrics Registry", () => {
    it("should have default NoopMetricsProvider", () => {
      const provider = getMetricsProvider();
      expect(provider).toBeInstanceOf(NoopMetricsProvider);
    });

    it("should support setting a new provider", () => {
      setMetricsProvider(mockProvider);
      const provider = getMetricsProvider();
      expect(provider).toBe(mockProvider);
    });

    it("should support getting a meter", () => {
      setMetricsProvider(mockProvider);
      const testMeter = GlobalMetrics.getMeter("test-scope");
      expect(testMeter).toBeDefined();
      expect(typeof testMeter.counter).toBe("function");
    });

    it("should support collect operation", () => {
      setMetricsProvider(mockProvider);
      GlobalMetrics.collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("should handle provider without collect method", () => {
      const providerWithoutCollect: MetricsProvider = {
        getMeter: () => ({
          counter: () => ({ add: () => {} }),
          upDownCounter: () => ({ add: () => {} }),
          gauge: () => ({ set: () => {} }),
          histogram: () => ({ record: () => {} }),
          observableGauge: () => ({
            addCallback: () => {},
            removeCallback: () => {},
          }),
          time: async (name, fn) => await fn(),
        }),
      };

      setMetricsProvider(providerWithoutCollect);
      expect(() => GlobalMetrics.collect()).not.toThrow();
    });
  });

  describe("Helper Functions", () => {
    it("should support meter() helper function", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("helper-test");
      expect(testMeter).toBeDefined();
      expect(typeof testMeter.counter).toBe("function");
      expect(typeof testMeter.gauge).toBe("function");
      expect(typeof testMeter.histogram).toBe("function");
    });

    it("should support collect() helper function", () => {
      setMetricsProvider(mockProvider);
      collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("should support setMetricsProvider() helper function", () => {
      const originalProvider = getMetricsProvider();
      setMetricsProvider(mockProvider);
      expect(getMetricsProvider()).toBe(mockProvider);

      // Restore original provider
      setMetricsProvider(originalProvider);
    });

    it("should support getMetricsProvider() helper function", () => {
      const provider = getMetricsProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getMeter).toBe("function");
    });
  });

  describe("Integration", () => {
    it("should support complete metrics workflow", () => {
      // Set mock provider
      setMetricsProvider(mockProvider);

      // Get meter
      const appMeter = meter("app");
      const dbMeter = meter("database");

      // Create metrics
      const requestCounter = appMeter.counter("requests_total");
      const dbConnections = dbMeter.gauge("connections_active");

      expect(requestCounter).toBeDefined();
      expect(dbConnections).toBeDefined();

      // Use metrics
      requestCounter.add(1, { method: "GET" });
      dbConnections.set(5);

      // Collect metrics
      collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("should support meters with multiple scopes", () => {
      setMetricsProvider(mockProvider);

      const scopes = ["service-a", "service-b", "service-c"];
      const meters = scopes.map((scope) => meter(scope));

      expect(meters).toHaveLength(3);
      meters.forEach((m) => {
        expect(m).toBeDefined();
        expect(typeof m.counter).toBe("function");
      });
    });

    it("should support asynchronous time measurement", async () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("async-test");

      const result = await testMeter.time("async_operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "completed";
      });

      expect(result).toBe("completed");
    });

    it("should handle provider switching", () => {
      // Start with default provider
      const defaultProvider = getMetricsProvider();
      const meter1 = meter("test1");
      expect(meter1).toBeDefined();

      // Switch to mock provider
      setMetricsProvider(mockProvider);
      const meter2 = meter("test2");
      expect(meter2).toBeDefined();

      // Verify provider has switched
      expect(getMetricsProvider()).toBe(mockProvider);

      // Switch back to default provider
      setMetricsProvider(defaultProvider);
      expect(getMetricsProvider()).toBe(defaultProvider);
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in provider", () => {
      const faultyProvider: MetricsProvider = {
        getMeter: () => {
          throw new Error("Provider error");
        },
      };

      setMetricsProvider(faultyProvider);

      // Call should throw error, but should not crash the entire system
      expect(() => meter("test")).toThrow("Provider error");
    });

    it("should handle errors in collect", () => {
      const faultyProvider: MetricsProvider = {
        getMeter: () => ({
          counter: () => ({ add: () => {} }),
          upDownCounter: () => ({ add: () => {} }),
          gauge: () => ({ set: () => {} }),
          histogram: () => ({ record: () => {} }),
          observableGauge: () => ({
            addCallback: () => {},
            removeCallback: () => {},
          }),
          time: async (name, fn) => await fn(),
        }),
        collect: () => {
          throw new Error("Collect error");
        },
      };

      setMetricsProvider(faultyProvider);

      // collect call should throw error
      expect(() => collect()).toThrow("Collect error");
    });
  });

  describe("Type Safety", () => {
    it("should correctly handle generic types", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("type-test");

      // Test type inference for time method
      const syncResult = testMeter.time("sync", () => 42);
      expect(syncResult).resolves.toBe(42);

      const asyncResult = testMeter.time("async", async () => "hello");
      expect(asyncResult).resolves.toBe("hello");
    });

    it("should support complex attribute types", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("complex-attrs");

      const counter = testMeter.counter("test_counter");

      // Test different types of attribute values
      expect(() =>
        counter.add(1, {
          service: "api",
          version: 123,
          enabled: true,
          ratio: 3.14,
        })
      ).not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should efficiently handle large number of meter creations", () => {
      setMetricsProvider(mockProvider);

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const testMeter = meter(`test-scope-${i}`);
        testMeter.counter(`counter-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (within 100ms)
      expect(duration).toBeLessThan(100);
    });

    it("should efficiently handle frequent collect calls", () => {
      setMetricsProvider(mockProvider);

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        collect();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(50);
      expect(mockProvider.collectCalled).toBe(true);
    });
  });
});
