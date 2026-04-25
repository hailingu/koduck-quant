/**
 * Metrics Index tests
 * 测试metrics模块的导出和API表面
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as MetricsIndex from "../../src/common/metrics/index";

describe("Metrics Index", () => {
  beforeEach(() => {
    // 在每个测试前重置配置
    MetricsIndex.configureMetrics({});
  });

  describe("Module Exports", () => {
    it("应该导出所有必需的类型", () => {
      // 检查类型是否可以被引用（编译时检查）
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

        // 避免未使用变量的警告
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

    it("应该导出MetricData类型", () => {
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

    it("应该导出Snapshot类型", () => {
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

    it("应该导出接口类型", () => {
      // 这是编译时检查，确保接口类型可用
      const checkInterfaces = () => {
        // 模拟实现检查类型兼容性
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

    it("应该导出配置函数", () => {
      expect(typeof MetricsIndex.configureMetrics).toBe("function");
      expect(typeof MetricsIndex.getMetricsConfig).toBe("function");
      expect(typeof MetricsIndex.filterAttributes).toBe("function");
      expect(typeof MetricsIndex.shouldSample).toBe("function");
    });

    it("应该导出配置类型", () => {
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

    it("应该导出实现类", () => {
      expect(typeof MetricsIndex.NoopMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.InMemoryMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.ScopedMeter).toBe("function");
    });

    it("应该导出全局函数", () => {
      expect(typeof MetricsIndex.setMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.getMetricsProvider).toBe("function");
      expect(typeof MetricsIndex.meter).toBe("function");
      expect(typeof MetricsIndex.collect).toBe("function");
    });

    it("应该导出工具函数", () => {
      expect(typeof MetricsIndex.renderPrometheusExposition).toBe("function");
    });
  });

  describe("Module Integration", () => {
    it("应该支持完整的metrics工作流", () => {
      // 配置metrics
      MetricsIndex.configureMetrics({
        governance: {
          samplingRate: 1.0,
        },
        naming: {
          metricNamePrefix: "test_",
        },
      });

      // 创建provider
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      MetricsIndex.setMetricsProvider(provider);

      // 使用全局meter
      const testMeter = MetricsIndex.meter("integration_test");
      const counter = testMeter.counter("test_counter");
      counter.add(42, { test: "integration" });

      // 收集和导出
      MetricsIndex.collect();
      const snapshot = provider.snapshot();
      const prometheus = MetricsIndex.renderPrometheusExposition(snapshot);

      expect(snapshot.meters).toHaveLength(1);
      expect(snapshot.meters[0].counters).toHaveLength(1);
      expect(prometheus).toContain("test__test_counter_total");
      expect(prometheus).toContain('scope="integration_test"');
    });

    it("应该支持作用域meter", () => {
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

    it("应该支持noop provider", () => {
      const noopProvider = new MetricsIndex.NoopMetricsProvider();
      const meter = noopProvider.getMeter("noop");

      // 这些操作不应该抛出错误
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

      // Noop provider应该有collect方法但不返回任何内容
      expect(noopProvider.collect).toBeDefined();
      expect(typeof noopProvider.collect).toBe("function");
    });
  });

  describe("Type Safety", () => {
    it("应该支持泛型类型安全", () => {
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      const meter = provider.getMeter("type_safe");

      // 应该接受正确的属性类型
      const counter = meter.counter("typed_counter");
      const gauge = meter.gauge("typed_gauge");
      const histogram = meter.histogram("typed_histogram");

      // 这些调用应该通过类型检查
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

    it("应该支持复杂的metrics配置类型", () => {
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
    it("应该正常处理配置错误", () => {
      // 配置无效的采样率
      expect(() => {
        MetricsIndex.configureMetrics({
          governance: {
            samplingRate: -1, // 负数
          },
        });
      }).not.toThrow();

      // shouldSample应该处理无效值
      expect(typeof MetricsIndex.shouldSample()).toBe("boolean");
    });

    it("应该处理attributes过滤", () => {
      // 测试边界情况
      expect(MetricsIndex.filterAttributes(undefined)).toBe(undefined);
      expect(MetricsIndex.filterAttributes({})).toEqual({});

      // 重置配置确保干净状态
      MetricsIndex.configureMetrics({});

      // 测试白名单功能
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

      // 重置并测试黑名单 - 需要显式设置labelWhitelist为undefined
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

      // 最终重置配置
      MetricsIndex.configureMetrics({});
    });

    it("应该处理provider切换", () => {
      const provider1 = new MetricsIndex.InMemoryMetricsProvider();
      const provider2 = new MetricsIndex.NoopMetricsProvider();

      MetricsIndex.setMetricsProvider(provider1);
      expect(MetricsIndex.getMetricsProvider()).toBe(provider1);

      MetricsIndex.setMetricsProvider(provider2);
      expect(MetricsIndex.getMetricsProvider()).toBe(provider2);

      // 切换后的meter应该使用新的provider
      const meter = MetricsIndex.meter("switch_test");
      expect(meter).toBeDefined();
    });
  });

  describe("Performance", () => {
    it("应该高效处理大量metrics操作", () => {
      const provider = new MetricsIndex.InMemoryMetricsProvider();
      MetricsIndex.setMetricsProvider(provider);

      const meter = MetricsIndex.meter("performance_test");
      const counter = meter.counter("perf_counter");
      const gauge = meter.gauge("perf_gauge");
      const histogram = meter.histogram("perf_histogram");

      const start = Date.now();

      // 执行大量操作
      for (let i = 0; i < 1000; i++) {
        counter.add(1, { iteration: String(i % 10) });
        gauge.set(Math.random() * 100, { batch: String(Math.floor(i / 100)) });
        histogram.record(Math.random() * 1000, {
          type: i % 2 === 0 ? "even" : "odd",
        });
      }

      const elapsed = Date.now() - start;

      // 操作应该在合理时间内完成（这是一个粗略的性能测试）
      expect(elapsed).toBeLessThan(1000); // 1秒内完成1000次操作

      // 验证数据正确性
      const snapshot = provider.snapshot();
      expect(snapshot.meters[0].counters).toHaveLength(1);
      expect(snapshot.meters[0].gauges).toHaveLength(1);
      expect(snapshot.meters[0].histograms).toHaveLength(1);
    });
  });
});
