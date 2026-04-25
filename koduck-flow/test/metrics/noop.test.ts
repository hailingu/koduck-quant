/**
 * Noop Metrics Provider tests
 * 测试NoopMetricsProvider的功能
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NoopMetricsProvider } from "../../src/common/metrics/noop";
import type { Attributes } from "../../src/common/metrics/types";

describe("NoopMetricsProvider", () => {
  let provider: NoopMetricsProvider;
  let meter: ReturnType<typeof provider.getMeter>;

  beforeEach(() => {
    provider = new NoopMetricsProvider();
    meter = provider.getMeter("test-scope");
  });

  describe("Provider Level", () => {
    it("应该创建NoopMetricsProvider实例", () => {
      expect(provider).toBeInstanceOf(NoopMetricsProvider);
    });

    it("应该返回相同的meter实例", () => {
      const meter1 = provider.getMeter("scope1");
      const meter2 = provider.getMeter("scope2");
      const meter3 = provider.getMeter("scope1");

      // NoopMetricsProvider总是返回相同的内部meter实例
      expect(meter1).toBe(meter2);
      expect(meter1).toBe(meter3);
    });

    it("应该支持collect方法", () => {
      expect(() => provider.collect()).not.toThrow();
    });
  });

  describe("Counter", () => {
    it("应该创建counter", () => {
      const counter = meter.counter("test_counter");
      expect(counter).toBeDefined();
      expect(typeof counter.add).toBe("function");
    });

    it("应该支持add操作不抛出错误", () => {
      const counter = meter.counter("test_counter", {
        description: "Test counter",
        unit: "count",
      });

      expect(() => counter.add(1)).not.toThrow();
      expect(() => counter.add(5, { service: "api" })).not.toThrow();
      expect(() => counter.add(0)).not.toThrow();
      expect(() => counter.add(-1)).not.toThrow(); // noop应该接受任何值
    });

    it("应该处理复杂的属性", () => {
      const counter = meter.counter("complex_counter");
      const attrs: Attributes = {
        service: "api",
        version: "1.0.0",
        enabled: true,
        count: 42,
        ratio: 3.14,
      };

      expect(() => counter.add(10, attrs)).not.toThrow();
    });
  });

  describe("UpDownCounter", () => {
    it("应该创建upDownCounter", () => {
      const upDownCounter = meter.upDownCounter("test_updown");
      expect(upDownCounter).toBeDefined();
      expect(typeof upDownCounter.add).toBe("function");
    });

    it("应该支持add操作", () => {
      const upDownCounter = meter.upDownCounter("test_updown", {
        description: "Test updown counter",
        unit: "count",
      });

      expect(() => upDownCounter.add(1)).not.toThrow();
      expect(() => upDownCounter.add(-1)).not.toThrow();
      expect(() => upDownCounter.add(0)).not.toThrow();
      expect(() => upDownCounter.add(100, { service: "web" })).not.toThrow();
    });
  });

  describe("Gauge", () => {
    it("应该创建gauge", () => {
      const gauge = meter.gauge("test_gauge");
      expect(gauge).toBeDefined();
      expect(typeof gauge.set).toBe("function");
    });

    it("应该支持set操作", () => {
      const gauge = meter.gauge("test_gauge", {
        description: "Test gauge",
        unit: "bytes",
      });

      expect(() => gauge.set(100)).not.toThrow();
      expect(() => gauge.set(0)).not.toThrow();
      expect(() => gauge.set(-50)).not.toThrow();
      expect(() => gauge.set(3.14159)).not.toThrow();
      expect(() => gauge.set(1024, { component: "memory" })).not.toThrow();
    });
  });

  describe("Histogram", () => {
    it("应该创建histogram", () => {
      const histogram = meter.histogram("test_histogram");
      expect(histogram).toBeDefined();
      expect(typeof histogram.record).toBe("function");
    });

    it("应该支持record操作", () => {
      const histogram = meter.histogram("test_histogram", {
        description: "Test histogram",
        unit: "ms",
        boundaries: [1, 5, 10, 50, 100],
      });

      expect(() => histogram.record(25)).not.toThrow();
      expect(() => histogram.record(0)).not.toThrow();
      expect(() => histogram.record(999.99)).not.toThrow();
      expect(() =>
        histogram.record(123, { endpoint: "/api/users" })
      ).not.toThrow();
    });
  });

  describe("ObservableGauge", () => {
    it("应该创建observableGauge", () => {
      const observableGauge = meter.observableGauge("test_observable");
      expect(observableGauge).toBeDefined();
      expect(typeof observableGauge.addCallback).toBe("function");
      expect(typeof observableGauge.removeCallback).toBe("function");
    });

    it("应该支持addCallback操作", () => {
      const observableGauge = meter.observableGauge("test_observable", {
        description: "Test observable gauge",
        unit: "ratio",
      });

      const callback = vi.fn();
      expect(() => observableGauge.addCallback(callback)).not.toThrow();
    });

    it("应该支持removeCallback操作", () => {
      const observableGauge = meter.observableGauge("test_observable");

      const callback = vi.fn();
      observableGauge.addCallback(callback);
      expect(() => observableGauge.removeCallback(callback)).not.toThrow();
    });

    it("应该支持复杂的callback", () => {
      const observableGauge = meter.observableGauge("complex_observable");

      const callback = (
        observe: (o: { value: number; attributes?: Attributes }) => void
      ) => {
        observe({ value: 100, attributes: { type: "test" } });
        observe({ value: 200 });
      };

      expect(() => observableGauge.addCallback(callback)).not.toThrow();
      expect(() => observableGauge.removeCallback(callback)).not.toThrow();
    });
  });

  describe("Time Helper", () => {
    it("应该支持同步函数计时", async () => {
      const syncFn = vi.fn(() => "sync result");

      const result = await meter.time("sync_operation", syncFn);

      expect(result).toBe("sync result");
      expect(syncFn).toHaveBeenCalledTimes(1);
    });

    it("应该支持异步函数计时", async () => {
      const asyncFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      });

      const result = await meter.time("async_operation", asyncFn);

      expect(result).toBe("async result");
      expect(asyncFn).toHaveBeenCalledTimes(1);
    });

    it("应该支持带属性的计时", async () => {
      const fn = vi.fn(() => 42);

      const result = await meter.time("operation_with_attrs", fn, {
        service: "api",
        method: "GET",
      });

      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("应该处理函数抛出的错误", async () => {
      const errorFn = vi.fn(() => {
        throw new Error("Test error");
      });

      await expect(meter.time("error_operation", errorFn)).rejects.toThrow(
        "Test error"
      );
      expect(errorFn).toHaveBeenCalledTimes(1);
    });

    it("应该处理异步函数抛出的错误", async () => {
      const asyncErrorFn = vi.fn(async () => {
        throw new Error("Async test error");
      });

      await expect(
        meter.time("async_error_operation", asyncErrorFn)
      ).rejects.toThrow("Async test error");
      expect(asyncErrorFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("Collect", () => {
    it("应该支持collect方法", () => {
      expect(() => meter.collect?.()).not.toThrow();
    });

    it("应该支持多次collect", () => {
      expect(() => meter.collect?.()).not.toThrow();
      expect(() => meter.collect?.()).not.toThrow();
      expect(() => meter.collect?.()).not.toThrow();
    });
  });

  describe("Integration", () => {
    it("应该支持创建多种metric类型", () => {
      const counter = meter.counter("test_counter");
      const upDownCounter = meter.upDownCounter("test_updown");
      const gauge = meter.gauge("test_gauge");
      const histogram = meter.histogram("test_histogram");
      const observableGauge = meter.observableGauge("test_observable");

      expect(counter).toBeDefined();
      expect(upDownCounter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();
      expect(observableGauge).toBeDefined();
    });

    it("应该支持复杂的使用场景", async () => {
      // 创建各种metrics
      const requestCounter = meter.counter("requests_total");
      const activeConnections = meter.upDownCounter("active_connections");
      const memoryUsage = meter.gauge("memory_usage");
      const requestDuration = meter.histogram("request_duration");

      // 模拟一些操作
      requestCounter.add(1, { method: "GET", path: "/api/users" });
      requestCounter.add(1, { method: "POST", path: "/api/users" });

      activeConnections.add(1);
      activeConnections.add(-1);

      memoryUsage.set(1024 * 1024);

      requestDuration.record(125.5, { method: "GET" });
      requestDuration.record(89.2, { method: "POST" });

      // 计时操作
      const result = await meter.time(
        "database_query",
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return "query result";
        },
        { table: "users" }
      );

      expect(result).toBe("query result");

      // 收集metrics
      expect(() => meter.collect?.()).not.toThrow();
    });

    it("应该处理极端值", () => {
      const counter = meter.counter("extreme_counter");
      const gauge = meter.gauge("extreme_gauge");
      const histogram = meter.histogram("extreme_histogram");

      // 测试极大值
      expect(() => counter.add(Number.MAX_SAFE_INTEGER)).not.toThrow();
      expect(() => gauge.set(Number.MAX_VALUE)).not.toThrow();
      expect(() => histogram.record(Number.MAX_VALUE)).not.toThrow();

      // 测试极小值
      expect(() => counter.add(Number.MIN_SAFE_INTEGER)).not.toThrow();
      expect(() => gauge.set(-Number.MAX_VALUE)).not.toThrow();
      expect(() => histogram.record(0)).not.toThrow();

      // 测试特殊值
      expect(() => counter.add(Infinity)).not.toThrow();
      expect(() => gauge.set(-Infinity)).not.toThrow();
      expect(() => histogram.record(NaN)).not.toThrow();
    });

    it("应该处理大量属性", () => {
      const counter = meter.counter("many_attrs_counter");

      const manyAttrs: Attributes = {};
      for (let i = 0; i < 100; i++) {
        manyAttrs[`attr_${i}`] = `value_${i}`;
      }

      expect(() => counter.add(1, manyAttrs)).not.toThrow();
    });
  });
});
