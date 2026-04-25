/**
 * Global metrics registry tests
 * 测试全局metrics注册表的功能
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

// 创建一个模拟的MetricsProvider用于测试
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
    // 重置为默认的NoopMetricsProvider
    setMetricsProvider(new NoopMetricsProvider());
  });

  describe("GlobalMetrics Registry", () => {
    it("应该有默认的NoopMetricsProvider", () => {
      const provider = getMetricsProvider();
      expect(provider).toBeInstanceOf(NoopMetricsProvider);
    });

    it("应该支持设置新的provider", () => {
      setMetricsProvider(mockProvider);
      const provider = getMetricsProvider();
      expect(provider).toBe(mockProvider);
    });

    it("应该支持获取meter", () => {
      setMetricsProvider(mockProvider);
      const testMeter = GlobalMetrics.getMeter("test-scope");
      expect(testMeter).toBeDefined();
      expect(typeof testMeter.counter).toBe("function");
    });

    it("应该支持collect操作", () => {
      setMetricsProvider(mockProvider);
      GlobalMetrics.collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("应该处理没有collect方法的provider", () => {
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
    it("应该支持meter()助手函数", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("helper-test");
      expect(testMeter).toBeDefined();
      expect(typeof testMeter.counter).toBe("function");
      expect(typeof testMeter.gauge).toBe("function");
      expect(typeof testMeter.histogram).toBe("function");
    });

    it("应该支持collect()助手函数", () => {
      setMetricsProvider(mockProvider);
      collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("应该支持setMetricsProvider()助手函数", () => {
      const originalProvider = getMetricsProvider();
      setMetricsProvider(mockProvider);
      expect(getMetricsProvider()).toBe(mockProvider);

      // 恢复原始provider
      setMetricsProvider(originalProvider);
    });

    it("应该支持getMetricsProvider()助手函数", () => {
      const provider = getMetricsProvider();
      expect(provider).toBeDefined();
      expect(typeof provider.getMeter).toBe("function");
    });
  });

  describe("Integration", () => {
    it("应该支持完整的metrics工作流", () => {
      // 设置mock provider
      setMetricsProvider(mockProvider);

      // 获取meter
      const appMeter = meter("app");
      const dbMeter = meter("database");

      // 创建metrics
      const requestCounter = appMeter.counter("requests_total");
      const dbConnections = dbMeter.gauge("connections_active");

      expect(requestCounter).toBeDefined();
      expect(dbConnections).toBeDefined();

      // 使用metrics
      requestCounter.add(1, { method: "GET" });
      dbConnections.set(5);

      // 收集metrics
      collect();
      expect(mockProvider.collectCalled).toBe(true);
    });

    it("应该支持多个scope的meter", () => {
      setMetricsProvider(mockProvider);

      const scopes = ["service-a", "service-b", "service-c"];
      const meters = scopes.map((scope) => meter(scope));

      expect(meters).toHaveLength(3);
      meters.forEach((m) => {
        expect(m).toBeDefined();
        expect(typeof m.counter).toBe("function");
      });
    });

    it("应该支持异步时间测量", async () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("async-test");

      const result = await testMeter.time("async_operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "completed";
      });

      expect(result).toBe("completed");
    });

    it("应该处理provider切换", () => {
      // 开始使用默认provider
      const defaultProvider = getMetricsProvider();
      const meter1 = meter("test1");
      expect(meter1).toBeDefined();

      // 切换到mock provider
      setMetricsProvider(mockProvider);
      const meter2 = meter("test2");
      expect(meter2).toBeDefined();

      // 验证provider已切换
      expect(getMetricsProvider()).toBe(mockProvider);

      // 切换回默认provider
      setMetricsProvider(defaultProvider);
      expect(getMetricsProvider()).toBe(defaultProvider);
    });
  });

  describe("Error Handling", () => {
    it("应该处理provider中的错误", () => {
      const faultyProvider: MetricsProvider = {
        getMeter: () => {
          throw new Error("Provider error");
        },
      };

      setMetricsProvider(faultyProvider);

      // 调用应该抛出错误，但不应该崩溃整个系统
      expect(() => meter("test")).toThrow("Provider error");
    });

    it("应该处理collect中的错误", () => {
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

      // collect调用应该抛出错误
      expect(() => collect()).toThrow("Collect error");
    });
  });

  describe("Type Safety", () => {
    it("应该正确处理泛型类型", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("type-test");

      // 测试time方法的类型推断
      const syncResult = testMeter.time("sync", () => 42);
      expect(syncResult).resolves.toBe(42);

      const asyncResult = testMeter.time("async", async () => "hello");
      expect(asyncResult).resolves.toBe("hello");
    });

    it("应该支持复杂的属性类型", () => {
      setMetricsProvider(mockProvider);
      const testMeter = meter("complex-attrs");

      const counter = testMeter.counter("test_counter");

      // 测试不同类型的属性值
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
    it("应该高效处理大量meter创建", () => {
      setMetricsProvider(mockProvider);

      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const testMeter = meter(`test-scope-${i}`);
        testMeter.counter(`counter-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在合理时间内完成（100ms内）
      expect(duration).toBeLessThan(100);
    });

    it("应该高效处理频繁的collect调用", () => {
      setMetricsProvider(mockProvider);

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        collect();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 应该在合理时间内完成
      expect(duration).toBeLessThan(50);
      expect(mockProvider.collectCalled).toBe(true);
    });
  });
});
