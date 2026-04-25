/**
 * Scoped Meter tests
 * 测试作用域meter的功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ScopedMeter } from "../../src/common/metrics/scoped-meter";
import { NoopMetricsProvider } from "../../src/common/metrics/noop";
import type { Meter, Attributes } from "../../src/common/metrics/types";

describe("ScopedMeter", () => {
  let baseMeter: Meter;
  let scopedMeter: ScopedMeter;
  const baseAttributes: Attributes = { service: "test", version: "1.0" };

  beforeEach(() => {
    const provider = new NoopMetricsProvider();
    baseMeter = provider.getMeter("test-scope");
    scopedMeter = new ScopedMeter(baseMeter, baseAttributes);
  });

  describe("Construction", () => {
    it("应该创建ScopedMeter实例", () => {
      expect(scopedMeter).toBeInstanceOf(ScopedMeter);
    });

    it("应该支持无基础属性的构造", () => {
      const noAttrsMeter = new ScopedMeter(baseMeter);
      expect(noAttrsMeter).toBeInstanceOf(ScopedMeter);
    });

    it("应该支持空属性的构造", () => {
      const emptyAttrsMeter = new ScopedMeter(baseMeter, {});
      expect(emptyAttrsMeter).toBeInstanceOf(ScopedMeter);
    });
  });

  describe("Counter", () => {
    it("应该创建counter并合并属性", () => {
      const createCounterSpy = vi.spyOn(baseMeter, "counter");
      const counter = scopedMeter.counter("test_counter");

      expect(createCounterSpy).toHaveBeenCalledWith("test_counter", undefined);
      expect(counter).toBeDefined();
    });

    it("应该传递counter选项", () => {
      const createCounterSpy = vi.spyOn(baseMeter, "counter");
      const options = { description: "Test counter", unit: "count" };

      scopedMeter.counter("test_counter", options);

      expect(createCounterSpy).toHaveBeenCalledWith("test_counter", options);
    });

    it("应该在counter操作中合并属性", () => {
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = scopedMeter.counter("test_counter");
      counter.add(5, { method: "GET" });

      expect(mockCounter.add).toHaveBeenCalledWith(5, {
        service: "test",
        version: "1.0",
        method: "GET",
      });
    });

    it("应该处理无额外属性的counter操作", () => {
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = scopedMeter.counter("test_counter");
      counter.add(5);

      expect(mockCounter.add).toHaveBeenCalledWith(5, {
        service: "test",
        version: "1.0",
      });
    });

    it("应该处理属性冲突（额外属性优先）", () => {
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = scopedMeter.counter("test_counter");
      counter.add(5, { service: "override", method: "POST" });

      expect(mockCounter.add).toHaveBeenCalledWith(5, {
        service: "override", // 额外属性覆盖基础属性
        version: "1.0",
        method: "POST",
      });
    });
  });

  describe("UpDownCounter", () => {
    it("应该创建upDownCounter并合并属性", () => {
      const createUpDownCounterSpy = vi.spyOn(baseMeter, "upDownCounter");
      const upDownCounter = scopedMeter.upDownCounter("test_updown");

      expect(createUpDownCounterSpy).toHaveBeenCalledWith(
        "test_updown",
        undefined
      );
      expect(upDownCounter).toBeDefined();
    });

    it("应该在upDownCounter操作中合并属性", () => {
      const mockUpDownCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "upDownCounter").mockReturnValue(mockUpDownCounter);

      const upDownCounter = scopedMeter.upDownCounter("test_updown");
      upDownCounter.add(-3, { component: "memory" });

      expect(mockUpDownCounter.add).toHaveBeenCalledWith(-3, {
        service: "test",
        version: "1.0",
        component: "memory",
      });
    });
  });

  describe("Gauge", () => {
    it("应该创建gauge并合并属性", () => {
      const createGaugeSpy = vi.spyOn(baseMeter, "gauge");
      const gauge = scopedMeter.gauge("test_gauge");

      expect(createGaugeSpy).toHaveBeenCalledWith("test_gauge", undefined);
      expect(gauge).toBeDefined();
    });

    it("应该在gauge操作中合并属性", () => {
      const mockGauge = {
        set: vi.fn(),
      };
      vi.spyOn(baseMeter, "gauge").mockReturnValue(mockGauge);

      const gauge = scopedMeter.gauge("test_gauge");
      gauge.set(42, { type: "cpu" });

      expect(mockGauge.set).toHaveBeenCalledWith(42, {
        service: "test",
        version: "1.0",
        type: "cpu",
      });
    });
  });

  describe("Histogram", () => {
    it("应该创建histogram并合并属性", () => {
      const createHistogramSpy = vi.spyOn(baseMeter, "histogram");
      const histogram = scopedMeter.histogram("test_histogram");

      expect(createHistogramSpy).toHaveBeenCalledWith(
        "test_histogram",
        undefined
      );
      expect(histogram).toBeDefined();
    });

    it("应该传递histogram选项", () => {
      const createHistogramSpy = vi.spyOn(baseMeter, "histogram");
      const options = {
        description: "Test histogram",
        unit: "ms",
        boundaries: [1, 5, 10, 50, 100],
      };

      scopedMeter.histogram("test_histogram", options);

      expect(createHistogramSpy).toHaveBeenCalledWith(
        "test_histogram",
        options
      );
    });

    it("应该在histogram操作中合并属性", () => {
      const mockHistogram = {
        record: vi.fn(),
      };
      vi.spyOn(baseMeter, "histogram").mockReturnValue(mockHistogram);

      const histogram = scopedMeter.histogram("test_histogram");
      histogram.record(125, { endpoint: "/api/users" });

      expect(mockHistogram.record).toHaveBeenCalledWith(125, {
        service: "test",
        version: "1.0",
        endpoint: "/api/users",
      });
    });
  });

  describe("ObservableGauge", () => {
    it("应该创建observableGauge", () => {
      const createObservableGaugeSpy = vi.spyOn(baseMeter, "observableGauge");
      const observableGauge = scopedMeter.observableGauge("test_observable");

      expect(createObservableGaugeSpy).toHaveBeenCalledWith(
        "test_observable",
        undefined
      );
      expect(observableGauge).toBeDefined();
    });

    it("应该在observableGauge回调中合并属性", () => {
      const mockObservableGauge = {
        addCallback: vi.fn(),
        removeCallback: vi.fn(),
      };
      vi.spyOn(baseMeter, "observableGauge").mockReturnValue(
        mockObservableGauge
      );

      const observableGauge = scopedMeter.observableGauge("test_observable");
      const callback = vi.fn();

      observableGauge.addCallback(callback);

      expect(mockObservableGauge.addCallback).toHaveBeenCalled();

      // 获取传递给底层observableGauge的wrapped callback
      const wrappedCallback = mockObservableGauge.addCallback.mock.calls[0][0];
      const mockObserve = vi.fn();

      // 执行wrapped callback
      wrappedCallback(mockObserve);

      // 验证原始callback被调用，并且observe函数被正确包装
      expect(callback).toHaveBeenCalled();
      const observeWrapper = callback.mock.calls[0][0];

      // 测试observe wrapper
      observeWrapper({ value: 100, attributes: { cpu: "high" } });

      expect(mockObserve).toHaveBeenCalledWith({
        value: 100,
        attributes: {
          service: "test",
          version: "1.0",
          cpu: "high",
        },
      });
    });

    it("应该在observableGauge observe调用中处理无属性情况", () => {
      const mockObservableGauge = {
        addCallback: vi.fn(),
        removeCallback: vi.fn(),
      };
      vi.spyOn(baseMeter, "observableGauge").mockReturnValue(
        mockObservableGauge
      );

      const observableGauge = scopedMeter.observableGauge("test_observable");
      const callback = vi.fn();

      observableGauge.addCallback(callback);

      const wrappedCallback = mockObservableGauge.addCallback.mock.calls[0][0];
      const mockObserve = vi.fn();

      wrappedCallback(mockObserve);

      const observeWrapper = callback.mock.calls[0][0];

      // 测试无属性的observe调用
      observeWrapper({ value: 50 });

      expect(mockObserve).toHaveBeenCalledWith({
        value: 50,
        attributes: {
          service: "test",
          version: "1.0",
        },
      });
    });

    it("应该支持removeCallback", () => {
      const mockObservableGauge = {
        addCallback: vi.fn(),
        removeCallback: vi.fn(),
      };
      vi.spyOn(baseMeter, "observableGauge").mockReturnValue(
        mockObservableGauge
      );

      const observableGauge = scopedMeter.observableGauge("test_observable");
      const callback = vi.fn();

      observableGauge.addCallback(callback);
      observableGauge.removeCallback(callback);

      expect(mockObservableGauge.removeCallback).toHaveBeenCalled();
    });
  });

  describe("Time Helper", () => {
    it("应该支持time方法并合并属性", async () => {
      const mockTimeFn = vi.fn().mockResolvedValue("result");
      vi.spyOn(baseMeter, "time").mockImplementation(mockTimeFn);

      const result = await scopedMeter.time("operation", () => "test", {
        method: "GET",
      });

      expect(result).toBe("result");
      expect(mockTimeFn).toHaveBeenCalledWith(
        "operation",
        expect.any(Function),
        {
          service: "test",
          version: "1.0",
          method: "GET",
        }
      );
    });

    it("应该支持无属性的time方法", async () => {
      const mockTimeFn = vi.fn().mockResolvedValue("result");
      vi.spyOn(baseMeter, "time").mockImplementation(mockTimeFn);

      await scopedMeter.time("operation", () => "test");

      expect(mockTimeFn).toHaveBeenCalledWith(
        "operation",
        expect.any(Function),
        {
          service: "test",
          version: "1.0",
        }
      );
    });
  });

  describe("Collect", () => {
    it("应该委托collect调用给底层meter", () => {
      const mockCollect = vi.fn();
      baseMeter.collect = mockCollect;

      scopedMeter.collect?.();

      expect(mockCollect).toHaveBeenCalled();
    });

    it("应该处理底层meter没有collect方法的情况", () => {
      delete (baseMeter as unknown as { collect?: () => void }).collect;

      expect(() => scopedMeter.collect?.()).not.toThrow();
    });
  });

  describe("Attribute Merging", () => {
    it("应该正确合并空基础属性", () => {
      const noBaseMeter = new ScopedMeter(baseMeter, {});
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = noBaseMeter.counter("test");
      counter.add(1, { key: "value" });

      expect(mockCounter.add).toHaveBeenCalledWith(1, { key: "value" });
    });

    it("应该正确合并undefined基础属性", () => {
      const noBaseMeter = new ScopedMeter(baseMeter);
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = noBaseMeter.counter("test");
      counter.add(1, { key: "value" });

      expect(mockCounter.add).toHaveBeenCalledWith(1, { key: "value" });
    });

    it("应该处理复杂的属性合并", () => {
      const complexBaseMeter = new ScopedMeter(baseMeter, {
        service: "test",
        environment: "prod",
        region: "us-east-1",
      });

      const mockGauge = {
        set: vi.fn(),
      };
      vi.spyOn(baseMeter, "gauge").mockReturnValue(mockGauge);

      const gauge = complexBaseMeter.gauge("complex_gauge");
      gauge.set(42, {
        instance: "i-123456",
        environment: "staging", // 应该覆盖基础属性
        metric_type: "cpu",
      });

      expect(mockGauge.set).toHaveBeenCalledWith(42, {
        service: "test",
        environment: "staging", // 覆盖值
        region: "us-east-1",
        instance: "i-123456",
        metric_type: "cpu",
      });
    });
  });

  describe("Error Handling", () => {
    it("应该处理底层meter方法调用中的错误", () => {
      const errorMeter = {
        counter: vi.fn().mockImplementation(() => {
          throw new Error("Counter creation failed");
        }),
        upDownCounter: vi.fn(),
        gauge: vi.fn(),
        histogram: vi.fn(),
        observableGauge: vi.fn(),
        time: vi.fn(),
      };

      const scopedErrorMeter = new ScopedMeter(
        errorMeter as Meter,
        baseAttributes
      );

      expect(() => scopedErrorMeter.counter("error_counter")).toThrow(
        "Counter creation failed"
      );
    });

    it("应该处理属性合并中的错误", () => {
      // 测试大量属性的情况
      const manyAttributes: Attributes = {};
      for (let i = 0; i < 100; i++) {
        manyAttributes[`attr_${i}`] = `value_${i}`;
      }

      const problematicMeter = new ScopedMeter(baseMeter, manyAttributes);
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = problematicMeter.counter("test");

      // 应该能够正常调用，即使有大量属性
      expect(() => counter.add(1, { normal: "value" })).not.toThrow();
      expect(mockCounter.add).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          normal: "value",
          attr_0: "value_0",
          attr_99: "value_99",
        })
      );
    });
  });

  describe("Type Safety", () => {
    it("应该保持类型安全", () => {
      // 这是一个编译时测试，确保类型系统正确工作
      const counter = scopedMeter.counter("typed_counter");
      const upDownCounter = scopedMeter.upDownCounter("typed_updown");
      const gauge = scopedMeter.gauge("typed_gauge");
      const histogram = scopedMeter.histogram("typed_histogram");
      const observableGauge = scopedMeter.observableGauge("typed_observable");

      // 这些调用应该通过类型检查
      counter.add(1, {
        string_attr: "value",
        number_attr: 42,
        boolean_attr: true,
      });
      upDownCounter.add(-1, { nested_deep: "value" });
      gauge.set(3.14, { pi: true });
      histogram.record(100, { percentile: 95 });

      observableGauge.addCallback((observe) => {
        observe({ value: 1, attributes: { observed: true } });
      });

      expect(counter).toBeDefined();
      expect(upDownCounter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();
      expect(observableGauge).toBeDefined();
    });
  });
});
