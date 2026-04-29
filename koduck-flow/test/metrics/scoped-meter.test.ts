/**
 * Scoped Meter tests
 * Tests the functionality of the scoped meter
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
    it("should create ScopedMeter instance", () => {
      expect(scopedMeter).toBeInstanceOf(ScopedMeter);
    });

    it("should support construction without base attributes", () => {
      const noAttrsMeter = new ScopedMeter(baseMeter);
      expect(noAttrsMeter).toBeInstanceOf(ScopedMeter);
    });

    it("should support construction with empty attributes", () => {
      const emptyAttrsMeter = new ScopedMeter(baseMeter, {});
      expect(emptyAttrsMeter).toBeInstanceOf(ScopedMeter);
    });
  });

  describe("Counter", () => {
    it("should create counter and merge attributes", () => {
      const createCounterSpy = vi.spyOn(baseMeter, "counter");
      const counter = scopedMeter.counter("test_counter");

      expect(createCounterSpy).toHaveBeenCalledWith("test_counter", undefined);
      expect(counter).toBeDefined();
    });

    it("should pass counter options", () => {
      const createCounterSpy = vi.spyOn(baseMeter, "counter");
      const options = { description: "Test counter", unit: "count" };

      scopedMeter.counter("test_counter", options);

      expect(createCounterSpy).toHaveBeenCalledWith("test_counter", options);
    });

    it("should merge attributes in counter operation", () => {
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

    it("should handle counter operation without extra attributes", () => {
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

    it("should handle attribute conflicts (extra attributes take priority)", () => {
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = scopedMeter.counter("test_counter");
      counter.add(5, { service: "override", method: "POST" });

      expect(mockCounter.add).toHaveBeenCalledWith(5, {
        service: "override", // extra attributes override base attributes
        version: "1.0",
        method: "POST",
      });
    });
  });

  describe("UpDownCounter", () => {
    it("should create upDownCounter and merge attributes", () => {
      const createUpDownCounterSpy = vi.spyOn(baseMeter, "upDownCounter");
      const upDownCounter = scopedMeter.upDownCounter("test_updown");

      expect(createUpDownCounterSpy).toHaveBeenCalledWith(
        "test_updown",
        undefined
      );
      expect(upDownCounter).toBeDefined();
    });

    it("should merge attributes in upDownCounter operation", () => {
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
    it("should create gauge and merge attributes", () => {
      const createGaugeSpy = vi.spyOn(baseMeter, "gauge");
      const gauge = scopedMeter.gauge("test_gauge");

      expect(createGaugeSpy).toHaveBeenCalledWith("test_gauge", undefined);
      expect(gauge).toBeDefined();
    });

    it("should merge attributes in gauge operation", () => {
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
    it("should create histogram and merge attributes", () => {
      const createHistogramSpy = vi.spyOn(baseMeter, "histogram");
      const histogram = scopedMeter.histogram("test_histogram");

      expect(createHistogramSpy).toHaveBeenCalledWith(
        "test_histogram",
        undefined
      );
      expect(histogram).toBeDefined();
    });

    it("should pass histogram options", () => {
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

    it("should merge attributes in histogram operation", () => {
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
    it("should create observableGauge", () => {
      const createObservableGaugeSpy = vi.spyOn(baseMeter, "observableGauge");
      const observableGauge = scopedMeter.observableGauge("test_observable");

      expect(createObservableGaugeSpy).toHaveBeenCalledWith(
        "test_observable",
        undefined
      );
      expect(observableGauge).toBeDefined();
    });

    it("should merge attributes in observableGauge callback", () => {
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

      // Get the wrapped callback passed to the underlying observableGauge
      const wrappedCallback = mockObservableGauge.addCallback.mock.calls[0][0];
      const mockObserve = vi.fn();

      // Execute wrapped callback
      wrappedCallback(mockObserve);

      // Verify original callback is called and observe function is correctly wrapped
      expect(callback).toHaveBeenCalled();
      const observeWrapper = callback.mock.calls[0][0];

      // Test observe wrapper
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

    it("should handle no-attribute case in observableGauge observe call", () => {
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

      // Test observe call without attributes
      observeWrapper({ value: 50 });

      expect(mockObserve).toHaveBeenCalledWith({
        value: 50,
        attributes: {
          service: "test",
          version: "1.0",
        },
      });
    });

    it("should support removeCallback", () => {
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
    it("should support time method and merge attributes", async () => {
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

    it("should support time method without attributes", async () => {
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
    it("should delegate collect calls to the underlying meter", () => {
      const mockCollect = vi.fn();
      baseMeter.collect = mockCollect;

      scopedMeter.collect?.();

      expect(mockCollect).toHaveBeenCalled();
    });

    it("should handle case where underlying meter has no collect method", () => {
      delete (baseMeter as unknown as { collect?: () => void }).collect;

      expect(() => scopedMeter.collect?.()).not.toThrow();
    });
  });

  describe("Attribute Merging", () => {
    it("should correctly merge empty base attributes", () => {
      const noBaseMeter = new ScopedMeter(baseMeter, {});
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = noBaseMeter.counter("test");
      counter.add(1, { key: "value" });

      expect(mockCounter.add).toHaveBeenCalledWith(1, { key: "value" });
    });

    it("should correctly merge undefined base attributes", () => {
      const noBaseMeter = new ScopedMeter(baseMeter);
      const mockCounter = {
        add: vi.fn(),
      };
      vi.spyOn(baseMeter, "counter").mockReturnValue(mockCounter);

      const counter = noBaseMeter.counter("test");
      counter.add(1, { key: "value" });

      expect(mockCounter.add).toHaveBeenCalledWith(1, { key: "value" });
    });

    it("should handle complex attribute merging", () => {
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
        environment: "staging", // should override base attribute
        metric_type: "cpu",
      });

      expect(mockGauge.set).toHaveBeenCalledWith(42, {
        service: "test",
        environment: "staging", // overridden value
        region: "us-east-1",
        instance: "i-123456",
        metric_type: "cpu",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle errors in underlying meter method calls", () => {
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

    it("should handle errors in attribute merging", () => {
      // Test case with a large number of attributes
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

      // Should be able to call normally even with a large number of attributes
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
    it("should maintain type safety", () => {
      // This is a compile-time test to ensure the type system works correctly
      const counter = scopedMeter.counter("typed_counter");
      const upDownCounter = scopedMeter.upDownCounter("typed_updown");
      const gauge = scopedMeter.gauge("typed_gauge");
      const histogram = scopedMeter.histogram("typed_histogram");
      const observableGauge = scopedMeter.observableGauge("typed_observable");

      // These calls should pass type checking
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
