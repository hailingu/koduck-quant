/**
 * In-Memory Metrics Provider tests
 * Tests the functionality of the in-memory metrics provider
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { InMemoryMetricsProvider } from "../../src/common/metrics/in-memory";
import { configureMetrics } from "../../src/common/metrics/config";
import type { ProviderSnapshot } from "../../src/common/metrics/types";

describe("InMemoryMetricsProvider", () => {
  let provider: InMemoryMetricsProvider;

  beforeEach(() => {
    // Reset configuration
    configureMetrics({
      governance: {
        seriesLimitPerMetric: undefined,
        seriesTTLms: undefined,
        samplingRate: 1.0,
        labelWhitelist: undefined,
        labelBlacklist: undefined,
      },
    });
    provider = new InMemoryMetricsProvider();
  });

  describe("Provider Management", () => {
    it("should create InMemoryMetricsProvider instance", () => {
      expect(provider).toBeInstanceOf(InMemoryMetricsProvider);
    });

    it("should support getMeter", () => {
      const meter = provider.getMeter("test-scope");
      expect(meter).toBeDefined();
      expect(typeof meter.counter).toBe("function");
      expect(typeof meter.gauge).toBe("function");
      expect(typeof meter.histogram).toBe("function");
    });

    it("should return the same meter for the same scope", () => {
      const meter1 = provider.getMeter("same-scope");
      const meter2 = provider.getMeter("same-scope");
      expect(meter1).toBe(meter2);
    });

    it("should return different meters for different scopes", () => {
      const meter1 = provider.getMeter("scope-1");
      const meter2 = provider.getMeter("scope-2");
      expect(meter1).not.toBe(meter2);
    });

    it("should support collect", () => {
      expect(() => provider.collect()).not.toThrow();
    });

    it("should support collect", () => {
      expect(() => provider.collect()).not.toThrow();
    });

    it("should support snapshot", () => {
      const snapshot = provider.snapshot();
      expect(snapshot).toBeDefined();
      expect(Array.isArray(snapshot.meters)).toBe(true);
    });
  });

  describe("Counter", () => {
    it("should create and use counter", () => {
      const meter = provider.getMeter("counter-test");
      const counter = meter.counter("test_counter");

      counter.add(5);
      counter.add(3, { service: "api" });

      const snapshot = provider.snapshot();
      const meterData = snapshot.meters.find((m) => m.scope === "counter-test");
      expect(meterData).toBeDefined();
      expect(meterData!.counters).toHaveLength(1);

      const counterData = meterData!.counters[0];
      expect(counterData.name).toBe("test_counter");
      expect(Object.keys(counterData.points)).toHaveLength(2);
    });

    it("should accumulate counter values", () => {
      const meter = provider.getMeter("accumulate-test");
      const counter = meter.counter("accumulating_counter");

      counter.add(10);
      counter.add(20);
      counter.add(5);

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];
      expect(counterData.points[""]).toEqual({ value: 35 });
    });

    it("should handle counter attributes", () => {
      const meter = provider.getMeter("attrs-test");
      const counter = meter.counter("attributed_counter");

      counter.add(1, { method: "GET", status: "200" });
      counter.add(1, { method: "POST", status: "201" });
      counter.add(2, { method: "GET", status: "200" });

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];

      expect(Object.keys(counterData.points)).toHaveLength(2);
      expect(counterData.points["method=GET|status=200"]).toEqual({ value: 3 });
      expect(counterData.points["method=POST|status=201"]).toEqual({
        value: 1,
      });
    });

    it("should support counter options", () => {
      const meter = provider.getMeter("options-test");
      const counter = meter.counter("described_counter", {
        description: "A test counter",
        unit: "count",
      });

      counter.add(1);

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];
      expect(counterData.description).toBe("A test counter");
      expect(counterData.unit).toBe("count");
    });
  });

  describe("UpDownCounter", () => {
    it("should create and use upDownCounter", () => {
      const meter = provider.getMeter("updown-test");
      const upDownCounter = meter.upDownCounter("test_updown");

      upDownCounter.add(5);
      upDownCounter.add(-2);
      upDownCounter.add(3);

      const snapshot = provider.snapshot();
      const upDownData = snapshot.meters[0].upDownCounters[0];
      expect(upDownData.points[""]).toEqual({ value: 6 });
    });

    it("should handle negative values", () => {
      const meter = provider.getMeter("negative-test");
      const upDownCounter = meter.upDownCounter("negative_counter");

      upDownCounter.add(-10);
      upDownCounter.add(-5);

      const snapshot = provider.snapshot();
      const upDownData = snapshot.meters[0].upDownCounters[0];
      expect(upDownData.points[""]).toEqual({ value: -15 });
    });

    it("should handle zero values", () => {
      const meter = provider.getMeter("zero-test");
      const upDownCounter = meter.upDownCounter("zero_counter");

      upDownCounter.add(0);
      upDownCounter.add(5);
      upDownCounter.add(0);

      const snapshot = provider.snapshot();
      const upDownData = snapshot.meters[0].upDownCounters[0];
      expect(upDownData.points[""]).toEqual({ value: 5 });
    });
  });

  describe("Gauge", () => {
    it("should create and use gauge", () => {
      const meter = provider.getMeter("gauge-test");
      const gauge = meter.gauge("test_gauge");

      gauge.set(42);
      gauge.set(36); // should override the previous value

      const snapshot = provider.snapshot();
      const gaugeData = snapshot.meters[0].gauges[0];
      expect(gaugeData.points[""]).toEqual({ value: 36 });
    });

    it("should handle floating point values", () => {
      const meter = provider.getMeter("float-test");
      const gauge = meter.gauge("float_gauge");

      gauge.set(3.14159);

      const snapshot = provider.snapshot();
      const gaugeData = snapshot.meters[0].gauges[0];
      expect(gaugeData.points[""]).toEqual({ value: 3.14159 });
    });

    it("should handle negative values", () => {
      const meter = provider.getMeter("negative-gauge-test");
      const gauge = meter.gauge("negative_gauge");

      gauge.set(-100);

      const snapshot = provider.snapshot();
      const gaugeData = snapshot.meters[0].gauges[0];
      expect(gaugeData.points[""]).toEqual({ value: -100 });
    });
  });

  describe("Histogram", () => {
    it("should create and use histogram", () => {
      const meter = provider.getMeter("histogram-test");
      const histogram = meter.histogram("test_histogram");

      histogram.record(25);
      histogram.record(75);
      histogram.record(125);

      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];
      expect(histData.points[""]).toEqual({
        count: 3,
        sum: 225,
        buckets: expect.any(Array),
        boundaries: expect.any(Array),
      });
    });

    it("should use default boundaries", () => {
      const meter = provider.getMeter("default-bounds-test");
      const histogram = meter.histogram("default_histogram");

      histogram.record(15);

      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];
      expect(histData.points[""].boundaries).toEqual([
        1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000,
      ]);
      expect(histData.points[""].buckets).toHaveLength(13); // boundaries.length + 1
    });

    it("should support custom boundaries", () => {
      const meter = provider.getMeter("custom-bounds-test");
      const histogram = meter.histogram("custom_histogram", {
        boundaries: [10, 50, 100],
      });

      histogram.record(25);
      histogram.record(75);
      histogram.record(150);

      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];
      expect(histData.points[""].boundaries).toEqual([10, 50, 100]);
      expect(histData.points[""].buckets).toEqual([0, 1, 2, 3]); // cumulative counts
    });

    it("should correctly calculate cumulative buckets", () => {
      const meter = provider.getMeter("cumulative-test");
      const histogram = meter.histogram("cumulative_histogram", {
        boundaries: [5, 10, 20],
      });

      // Record some values: 3, 7, 15, 25
      histogram.record(3); // in bucket [0, 5]
      histogram.record(7); // in bucket (5, 10]
      histogram.record(15); // in bucket (10, 20]
      histogram.record(25); // in bucket (20, +Inf]

      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];

      // Cumulative buckets: [<=5, <=10, <=20, <=+Inf]
      expect(histData.points[""].buckets).toEqual([1, 2, 3, 4]);
      expect(histData.points[""].count).toBe(4);
      expect(histData.points[""].sum).toBe(50);
    });
  });

  describe("ObservableGauge", () => {
    it("should create observableGauge", () => {
      const meter = provider.getMeter("observable-test");
      const observableGauge = meter.observableGauge("test_observable");

      expect(observableGauge).toBeDefined();
      expect(typeof observableGauge.addCallback).toBe("function");
      expect(typeof observableGauge.removeCallback).toBe("function");
    });

    it("should support adding and removing callbacks", () => {
      const meter = provider.getMeter("callback-test");
      const observableGauge = meter.observableGauge("callback_observable");

      const callback1 = vi.fn();
      const callback2 = vi.fn();

      observableGauge.addCallback(callback1);
      observableGauge.addCallback(callback2);

      // collect should trigger callbacks
      meter.collect?.();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();

      // Remove callback
      observableGauge.removeCallback(callback1);
      callback1.mockClear();
      callback2.mockClear();

      meter.collect?.();

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it("should support observe functionality", () => {
      const meter = provider.getMeter("observe-test");
      const observableGauge = meter.observableGauge("observe_gauge");

      observableGauge.addCallback((observe) => {
        observe({ value: 100, attributes: { type: "cpu" } });
        observe({ value: 80, attributes: { type: "memory" } });
        observe({ value: 90 }); // no attributes
      });

      meter.collect?.();

      const snapshot = provider.snapshot();
      const gaugeData = snapshot.meters[0].gauges.find(
        (g) => g.name === "observe_gauge"
      );

      expect(gaugeData).toBeDefined();
      expect(Object.keys(gaugeData!.points)).toHaveLength(3);
      expect(gaugeData!.points["type=cpu"]).toEqual({ value: 100 });
      expect(gaugeData!.points["type=memory"]).toEqual({ value: 80 });
      expect(gaugeData!.points[""]).toEqual({ value: 90 });
    });
  });

  describe("Time Helper", () => {
    it("should support synchronous function timing", async () => {
      const meter = provider.getMeter("time-sync-test");

      const result = await meter.time("sync_operation", () => {
        return "sync result";
      });

      expect(result).toBe("sync result");

      const snapshot = provider.snapshot();
      const histData = snapshot.meters.find((m) => m.scope === "time-sync-test")
        ?.histograms[0];
      expect(histData).toBeDefined();
      expect(histData!.name).toBe("sync_operation");
      expect(histData!.points[""]).toBeDefined();
      expect(histData!.points[""].count).toBe(1);
    });

    it("should support asynchronous function timing", async () => {
      const meter = provider.getMeter("time-async-test");

      const result = await meter.time("async_operation", async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "async result";
      });

      expect(result).toBe("async result");

      const snapshot = provider.snapshot();
      const histData = snapshot.meters.find(
        (m) => m.scope === "time-async-test"
      )?.histograms[0];
      expect(histData).toBeDefined();
      expect(histData!.points[""].count).toBe(1);
      expect(histData!.points[""].sum).toBeGreaterThan(0);
    });

    it("should support timing with attributes", async () => {
      const meter = provider.getMeter("time-attrs-test");

      await meter.time("operation_with_attrs", () => "done", {
        service: "api",
        method: "GET",
      });

      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];
      expect(histData.points["method=GET|service=api"]).toBeDefined(); // attribute keys sorted alphabetically
    });

    it("should handle errors during timing", async () => {
      const meter = provider.getMeter("time-error-test");

      await expect(
        meter.time("error_operation", () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");

      // Even if an error occurs, the time should be recorded
      const snapshot = provider.snapshot();
      const histData = snapshot.meters[0].histograms[0];
      expect(histData.points[""]).toBeDefined();
      expect(histData.points[""].count).toBe(1);
    });
  });

  describe("Sampling", () => {
    it("should support sampling configuration", () => {
      // Reset configuration to sampling rate 0 only
      configureMetrics({
        governance: {
          seriesLimitPerMetric: undefined,
          seriesTTLms: undefined,
          samplingRate: 0.0, // do not sample any data
          labelWhitelist: undefined,
          labelBlacklist: undefined,
        },
      });

      // Create new provider to use the new configuration
      const samplingProvider = new InMemoryMetricsProvider();
      const meter = samplingProvider.getMeter("sampling-test");
      const counter = meter.counter("sampled_counter");

      counter.add(10);
      counter.add(20);

      const snapshot = samplingProvider.snapshot();
      // With sampling rate 0, meters exist but should not have actual data
      expect(snapshot.meters).toHaveLength(1);
      expect(snapshot.meters[0].counters).toHaveLength(1);
      expect(Object.keys(snapshot.meters[0].counters[0].points)).toHaveLength(
        0
      );
    });

    it("should record all data when sampling rate is 1", () => {
      // Reset configuration to sampling rate 1.0
      configureMetrics({
        governance: {
          seriesLimitPerMetric: undefined,
          seriesTTLms: undefined,
          samplingRate: 1.0,
          labelWhitelist: undefined,
          labelBlacklist: undefined,
        },
      });

      // Create new provider to use the new configuration
      const fullSamplingProvider = new InMemoryMetricsProvider();
      const meter = fullSamplingProvider.getMeter("full-sampling-test");
      const counter = meter.counter("full_sampled_counter");

      counter.add(5);
      counter.add(10);

      const snapshot = fullSamplingProvider.snapshot();
      expect(snapshot.meters).toHaveLength(1);
      expect(snapshot.meters[0].counters[0].points[""]).toEqual({ value: 15 });
    });
  });

  describe("Label Filtering", () => {
    it("should support whitelist filtering", () => {
      configureMetrics({
        governance: {
          labelWhitelist: ["service", "method"],
        },
      });

      const meter = provider.getMeter("whitelist-test");
      const counter = meter.counter("filtered_counter");

      counter.add(1, {
        service: "api",
        method: "GET",
        internal: "debug", // should be filtered out
        user: "test", // should be filtered out
      });

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];
      const keys = Object.keys(counterData.points);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe("method=GET|service=api");
    });

    it("should support blacklist filtering", () => {
      configureMetrics({
        governance: {
          labelBlacklist: ["internal", "debug"],
        },
      });

      const meter = provider.getMeter("blacklist-test");
      const counter = meter.counter("blacklist_counter");

      counter.add(1, {
        service: "api",
        method: "GET",
        internal: "value", // should be filtered out
        debug: "info", // should be filtered out
      });

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];
      const keys = Object.keys(counterData.points);
      expect(keys).toHaveLength(1);
      expect(keys[0]).toBe("method=GET|service=api");
    });
  });

  describe("Series Management", () => {
    it("should support series limit", () => {
      configureMetrics({
        governance: {
          seriesLimitPerMetric: 2,
        },
      });

      const meter = provider.getMeter("limit-test");
      const counter = meter.counter("limited_counter");

      // Add 3 different series, but only 2 should be retained
      counter.add(1, { series: "1" });
      counter.add(1, { series: "2" });
      counter.add(1, { series: "3" }); // this should trigger LRU eviction

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];
      expect(Object.keys(counterData.points)).toHaveLength(2);
    });

    it("should support TTL cleanup", async () => {
      configureMetrics({
        governance: {
          seriesTTLms: 50, // 50ms TTL
        },
      });

      const meter = provider.getMeter("ttl-test");
      const counter = meter.counter("ttl_counter");

      counter.add(1, { series: "short-lived" });

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 60));

      // Trigger cleanup (by adding new data)
      counter.add(1, { series: "new" });

      const snapshot = provider.snapshot();
      const counterData = snapshot.meters[0].counters[0];

      // Should only have new data, old data should be cleaned up
      expect(Object.keys(counterData.points)).toHaveLength(1);
      expect(counterData.points["series=new"]).toBeDefined();
    });
  });

  describe("Integration", () => {
    it("should support complex metrics combinations", () => {
      const apiMeter = provider.getMeter("api");
      const dbMeter = provider.getMeter("database");

      // API metrics
      const requests = apiMeter.counter("requests_total");
      const responseTime = apiMeter.histogram("response_time");
      const activeConnections = apiMeter.upDownCounter("active_connections");

      // Database metrics
      const queries = dbMeter.counter("queries_total");
      const connectionPool = dbMeter.gauge("connection_pool_size");

      // Record some data
      requests.add(10, { method: "GET", status: "200" });
      requests.add(5, { method: "POST", status: "201" });
      responseTime.record(125);
      responseTime.record(89);
      activeConnections.add(3);
      activeConnections.add(-1);

      queries.add(20, { type: "SELECT" });
      queries.add(5, { type: "INSERT" });
      connectionPool.set(10);

      const snapshot = provider.snapshot();
      expect(snapshot.meters).toHaveLength(2);

      const apiMeterData = snapshot.meters.find((m) => m.scope === "api");
      const dbMeterData = snapshot.meters.find((m) => m.scope === "database");

      expect(apiMeterData?.counters).toHaveLength(1);
      expect(apiMeterData?.histograms).toHaveLength(1);
      expect(apiMeterData?.upDownCounters).toHaveLength(1);

      expect(dbMeterData?.counters).toHaveLength(1);
      expect(dbMeterData?.gauges).toHaveLength(1);
    });

    it("should correctly handle snapshot", () => {
      const meter = provider.getMeter("snapshot-test");

      const counter = meter.counter("test_counter", {
        description: "Test counter for snapshot",
        unit: "count",
      });
      const gauge = meter.gauge("test_gauge", {
        description: "Test gauge for snapshot",
        unit: "bytes",
      });

      counter.add(42, { type: "test" });
      gauge.set(1024, { component: "memory" });

      const snapshot: ProviderSnapshot = provider.snapshot();

      expect(snapshot).toEqual({
        meters: [
          {
            scope: "snapshot-test",
            counters: [
              {
                name: "test_counter",
                description: "Test counter for snapshot",
                unit: "count",
                points: {
                  "type=test": { value: 42 },
                },
              },
            ],
            upDownCounters: [],
            gauges: [
              {
                name: "test_gauge",
                description: "Test gauge for snapshot",
                unit: "bytes",
                points: {
                  "component=memory": { value: 1024 },
                },
              },
            ],
            histograms: [],
          },
        ],
      });
    });
  });
});
