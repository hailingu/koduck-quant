/**
 * Metrics Index tests
 * Tests the exports and API surface of the metrics module
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as MetricsIndex from "../../src/common/metrics/index";

describe("Metrics Index", () => {
  beforeEach(() => {
    // Reset configuration before each test
    MetricsIndex.configureMetrics({});
  });

  describe("Module Exports", () => {
    it("should export all required types", () => {
      // Check if types can be referenced (compile-time check)
      const checkTypes = () => {
        const _attr: MetricsIndex.Attributes = { key: "value" };
        const _options: MetricsIndex.MetricOptions = { description: "test" };
        const _observation: MetricsIndex.Observation = { value: 1 };
        const _counterPoint: MetricsIndex.CounterPoint = { value: 1 };
        const _gaugePoint: MetricsIndex.GaugePoint = { value: 1 };
        const _upDownCounterPoint: MetricsIndex.UpDownCounterPoint = {
          value: 1,
        };
        const _histogramPoint: MetricsIndex.HistogramPoint = {
          count: 1,
          sum: 1,
          buckets: [1],
          boundaries: [1],
        };

        // Avoid unused variable warnings
        void _attr;
        void _options;
        void _observation;
        void _counterPoint;
        void _gaugePoint;
        void _upDownCounterPoint;
        void _histogramPoint;
      };

      expect(() => checkTypes()).not.toThrow();
    });

    it("should export MetricData type", () => {
      const checkMetricData = () => {
        const _metricData: MetricsIndex.MetricData<MetricsIndex.CounterPoint> =
          {
            name: "test_metric",
            points: {
              "": { value: 1 },
            },
          };
        void _metricData;
      };

      expect(() => checkMetricData()).not.toThrow();
    });

    it("should export Snapshot type", () => {
      const checkSnapshots = () => {
        const _meterSnapshot: MetricsIndex.MeterSnapshot = {
          scope: "test",
          counters: [],
          upDownCounters: [],
          gauges: [],
          histograms: [],
        };

        const _providerSnapshot: MetricsIndex.ProviderSnapshot = {
          meters: [_meterSnapshot],
        };

        void _meterSnapshot;
        void _providerSnapshot;
      };

      expect(() => checkSnapshots()).not.toThrow();
    });

    it("should export interface types", () => {
      // This is a compile-time check to ensure interface types are available
      const checkInterfaces = () => {
        // Mock implementation to check type compatibility
        const mockCounter: MetricsIndex.Counter = {
          add: () => void 0,
        };

        const mockUpDownCounter: MetricsIndex.UpDownCounter = {
          add: () => void 0,
        };

        const mockGauge: MetricsIndex.Gauge = {
          set: () => void 0,
        };

        const mockHistogram: MetricsIndex.Histogram = {
          record: () => void 0,
        };

        const mockObservableGauge: MetricsIndex.ObservableGauge = {
          addCallback: () => void 0,
          removeCallback: () => void 0,
        };

        const mockMeter: MetricsIndex.Meter = {
          counter: () => mockCounter,
          upDownCounter: () => mockUpDownCounter,
          gauge: () => mockGauge,
          histogram: () => mockHistogram,
          observableGauge: () => mockObservableGauge,
          time: async <T>(name: string, fn: () => Promise<T> | T) => await fn(),
        };

        const mockProvider: MetricsIndex.MetricsProvider = {
          getMeter: () => mockMeter,
        };

        const mockExporter: MetricsIndex.MetricsExporter = {
          render: () => "exported",
        };

        void mockCounter;
        void mockUpDownCounter;
        void mockGauge;
        void mockHistogram;
        void mockObservableGauge;
        void mockMeter;
        void mockProvider;
        void mockExporter;
      };

      expect(() => checkInterfaces()).not.toThrow();
    });

    it("should export configuration functions", () => {
      expect(typeof MetricsIndex.configureMetrics).toBe("function");
      expect(typeof MetricsIndex.getMetricsConfig).toBe("function");
      expect(typeof MetricsIndex.filterAttributes).toBe("function");
      expect(typeof MetricsIndex.shouldSample).toBe("function");
    });

    it("should export configuration types", () => {
      const checkConfigTypes = () => {
        const _governanceConfig: MetricsIndex.MetricsGovernanceConfig = {
          seriesLimitPerMetric: 1000,
          seriesTTLms: 60000,
          samplingRate: 1.0,
          labelWhitelist: ["service", "method"],
          labelBlacklist: ["internal", "debug"],
        };

        const _namingConfig: MetricsIndex.MetricsNamingConfig = {
          metricNamePrefix: "app_",
        };

        const _config: MetricsIndex.MetricsConfig = {
          governance: _governanceConfig,
          naming: _namingConfig,
        };

        void _governanceConfig;
        void _namingConfig;
        void _config;
      };

      expect(() => checkConfigTypes()).not.toThrow();
    });

    it("should export implementation classes", () => {
      expect(typeof MetricsIndex.NoopMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.InMemoryMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.ScopedMeter).toBe("function");
    });

    it("should export global functions", () => {
      expect(typeof MetricsIndex.setMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.getMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.meter).toBe("function");
      expect(typeof MetricsIndex.collect).toBe("function");
    });

    it("should export utility functions", () => {
      expect(typeof MetricsIndex.renderPrometheusExposition).toBe("function");
    });
  });

  describe("Module Integration", () => {
    it("should support complete metrics workflow", () => {
      // Configure metrics
      MetricsIndex.configureMetrics({
        governance: {
          samplingRate: 1.0,
        },
        naming: {
          metricNamePrefix: "test_",
        },
      });

      // Create provider
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      MetricsIndex.setMetricsProvider(provider);

      // Use global meter
      const testMeter = MetricsIndex.meter("integration_test");
      const counter = testMeter.counter("test_counter");
      counter.add(42, { test: "integration" });

      // Collect and export
      MetricsIndex.collect();
      const snapshot = provider.snapshot();
      const prometheus = MetricsIndex.renderPrometheusExposition(snapshot);

      expect(snapshot.meters).toHaveLength(1);
      expect(snapshot.meters[0].counters).toHaveLength(1);
      expect(prometheus).toContain("test__test_counter_total");
      expect(prometheus).toContain('scope="integration_test"');
    });

    it("should support scoped meter", () => {
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      const baseMeter = provider.getMeter("base");
      const scopedMeter = new MetricsIndex.ScopedMeter(baseMeter, {
        service: "api",
        version: "1.0",
      });

      const counter = scopedMeter.counter("scoped_counter");
      counter.add(1, { method: "GET" });

      const snapshot = provider.snapshot();
      expect(snapshot.meters[0].counters[0].points).toHaveProperty(
        "method=GET|service=api|version=1.0"
      );
    });

    it("should support noop provider", () => {
      const noopProvider = new MetricsIndex.NoopMetricsProvider();
      const meter = noopProvider.getMeter("noop");

      // These operations should not throw errors
      const counter = meter.counter("noop_counter");
      const gauge = meter.gauge("noop_gauge");
      const histogram = meter.histogram("noop_histogram");
      const upDownCounter = meter.upDownCounter("noop_updown");
      const observableGauge = meter.observableGauge("noop_observable");

      expect(() => {
        counter.add(1);
        gauge.set(100);
        histogram.record(50);
        upDownCounter.add(-1);
        observableGauge.addCallback(() => void 0);
      }).not.toThrow();

      // Noop provider should have collect method but return nothing
      expect(noopProvider.collect).toBeDefined();
      expect(typeof noopProvider.collect).toBe("function");
    });
  });

  describe("Type Safety", () => {
    it("should support generic type safety", () => {
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      const meter = provider.getMeter("type_safe");

      // Should accept correct attribute types
      const counter = meter.counter("typed_counter");
      const gauge = meter.gauge("typed_gauge");
      const histogram = meter.histogram("typed_histogram");

      // These calls should pass type checking
      counter.add(1, {
        string_attr: "value",
        number_attr: 42,
        boolean_attr: true,
      });

      gauge.set(3.14, {
        pi: true,
        precision: 2,
      });

      histogram.record(100, {
        method: "POST",
        status_code: 201,
        success: true,
      });

      expect(counter).toBeDefined();
      expect(gauge).toBeDefined();
      expect(histogram).toBeDefined();
    });

    it("should support complex metrics configuration types", () => {
      const complexConfig: MetricsIndex.MetricsConfig = {
        governance: {
          seriesLimitPerMetric: 10000,
          seriesTTLms: 300000,
          samplingRate: 0.95,
          labelWhitelist: ["service", "method", "status", "endpoint"],
          labelBlacklist: ["internal_id", "debug_info", "trace_id"],
        },
        naming: {
          metricNamePrefix: "myapp_service_",
        },
      };

      expect(() => {
        MetricsIndex.configureMetrics(complexConfig);
        const config = MetricsIndex.getMetricsConfig();
        expect(config.governance?.seriesLimitPerMetric).toBe(10000);
        expect(config.naming?.metricNamePrefix).toBe("myapp_service_");
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should correctly handle configuration errors", () => {
      // Configure invalid sampling rate
      expect(() => {
        MetricsIndex.configureMetrics({
          governance: {
            samplingRate: -1, // negative number
          },
        });
      }).not.toThrow();

      // shouldSample should handle invalid values
      expect(typeof MetricsIndex.shouldSample()).toBe("boolean");
    });

    it("should handle attributes filtering", () => {
      // Test edge cases
      expect(MetricsIndex.filterAttributes(undefined)).toBe(undefined);
      expect(MetricsIndex.filterAttributes({})).toEqual({});

      // Reset configuration to ensure clean state
      MetricsIndex.configureMetrics({});

      // Test whitelist functionality
      MetricsIndex.configureMetrics({
        governance: {
          labelWhitelist: ["allowed"],
        },
      });

      const filtered = MetricsIndex.filterAttributes({
        key: "value",
        allowed: "keep",
      });
      expect(filtered).toEqual({ allowed: "keep" });

      // Reset and test blacklist - need to explicitly set labelWhitelist to undefined
      MetricsIndex.configureMetrics({
        governance: {
          labelWhitelist: undefined,
          labelBlacklist: ["key"],
        },
      });

      const filtered2 = MetricsIndex.filterAttributes({
        key: "value",
        other: "keep",
      });
      expect(filtered2).toEqual({ other: "keep" });

      // Finally reset configuration
      MetricsIndex.configureMetrics({});
    });

    it("should handle provider switching", () => {
      const provider1 = new MetricsIndex.InMemoryMetricsProvider();
      const provider2 = new MetricsIndex.NoopMetricsProvider();

      MetricsIndex.setMetricsProvider(provider1);
      expect(MetricsIndex.getMetricsProvider()).toBe(provider1);

      MetricsIndex.setMetricsProvider(provider2);
      expect(MetricsIndex.getMetricsProvider()).toBe(provider2);

      // Meter after switching should use the new provider
      const meter = MetricsIndex.meter("switch_test");
      expect(meter).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("should efficiently handle large number of metrics operations", () => {
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      MetricsIndex.setMetricsProvider(provider);

      const meter = MetricsIndex.meter("performance_test");
      const counter = meter.counter("perf_counter");
      const gauge = meter.gauge("perf_gauge");
      const histogram = meter.histogram("perf_histogram");

      const start = Date.now();

      // Perform a large number of operations
      for (let i = 0; i < 1000; i++) {
        counter.add(1, { iteration: String(i % 10) });
        gauge.set(Math.random() * 100, { batch: String(Math.floor(i / 100)) });
        histogram.record(Math.random() * 1000, {
          type: i % 2 === 0 ? "even" : "odd",
        });
      }

      const elapsed = Date.now() - start;

      // Operations should complete within reasonable time (this is a rough performance test)
      expect(elapsed).toBeLessThan(1000); // complete 1000 operations within 1 second

      // Verify data correctness
      const snapshot = provider.snapshot();
      expect(snapshot.meters[0].counters).toHaveLength(1);
      expect(snapshot.meters[0].gauges).toHaveLength(1);
      expect(snapshot.meters[0].histograms).toHaveLength(1);
    });
  });
});
